/*
 * Membership card verification for the web card, the iPhone path.
 *
 * This is a second implementation of the verifier in the Android app
 * (data/MembershipCredential.kt) against the same spec. Both are tested
 * against the fixed vector in tools/issuer/Issuer.java, so the three cannot
 * drift apart without a test failing (see card-core.test.mjs).
 *
 * The rules, same as the app:
 *   TOKEN := "LC1" "." base64url(payload) "." base64url(DER ECDSA signature)
 *   The signature covers exactly the decoded payload bytes and is checked
 *   BEFORE the payload is trusted. Only iss and kid are read first, to pick
 *   the key.
 *   Dates are lake dates (America/Chicago); expiry is inclusive.
 *
 * Works in browsers and in Node 18+, both of which have WebCrypto.
 */

const MAX_TOKEN_CHARS = 16 * 1024;
const MAX_BOATS = 8;
export const LAKE_ZONE = "America/Chicago";

export const PROBLEMS = {
  MALFORMED: "This card is damaged or incomplete. Ask the issuer to send it again.",
  UNKNOWN_FORMAT: "This card is in a format this page cannot read.",
  UNKNOWN_ISSUER: "This card is from an organization this page does not recognize, so it cannot be checked.",
  BAD_SIGNATURE: "This card failed its security check. It may have been altered and cannot be trusted.",
  EXPIRED: "This card has expired. Contact the issuer to renew.",
  NOT_YET_VALID: "This card is not active yet. Check the start date with the issuer.",
  REVOKED: "This card has been canceled by the issuer.",
};

const subtle = globalThis.crypto.subtle;

function b64urlToBytes(s) {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(s)) throw new Error("bad base64url");
  const std = s.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "===".slice((std.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64ToBytes(s) {
  const bin = atob(s.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Java writes ECDSA signatures as DER: SEQUENCE { INTEGER r, INTEGER s }.
 * WebCrypto wants the raw 64 bytes r||s. Strict: anything that is not a clean
 * two-integer sequence is refused rather than guessed at.
 */
export function derToRaw(der) {
  let i = 0;
  const byte = () => {
    if (i >= der.length) throw new Error("short");
    return der[i++];
  };
  const len = () => {
    let n = byte();
    if (n < 0x80) return n;
    const count = n & 0x7f;
    if (count !== 1) throw new Error("length");
    return byte();
  };
  if (byte() !== 0x30) throw new Error("not a sequence");
  if (len() !== der.length - i) throw new Error("sequence length");
  const out = new Uint8Array(64);
  for (let k = 0; k < 2; k++) {
    if (byte() !== 0x02) throw new Error("not an integer");
    let n = len();
    let start = i;
    i += n;
    if (i > der.length) throw new Error("short integer");
    while (n > 0 && der[start] === 0) { start++; n--; }
    if (n > 32) throw new Error("integer too long");
    out.set(der.subarray(start, start + n), k * 32 + (32 - n));
  }
  if (i !== der.length) throw new Error("trailing bytes");
  return out;
}

/** Imports issuer entries: {iss, kid, name, phone, key (SPKI base64), revocationUrl?}. */
export async function importIssuers(list) {
  const out = [];
  for (const entry of list) {
    const key = await subtle.importKey(
      "spki", b64ToBytes(entry.key), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]
    );
    out.push({ ...entry, cryptoKey: key });
  }
  return out;
}

/** Today's date on the lake as YYYY-MM-DD. */
export function lakeToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAKE_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function validDate(s) {
  if (typeof s !== "string") return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * Opens a signed token: splits, decodes, finds the key, checks the signature.
 * Returns {obj, issuer} or {problem}.
 */
async function open(token, prefix, issuers) {
  token = (token || "").trim();
  if (!token || token.length > MAX_TOKEN_CHARS) return { problem: "MALFORMED" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) return { problem: "MALFORMED" };
  if (parts[0] !== prefix) return { problem: "UNKNOWN_FORMAT" };

  let payload, sig, obj;
  try {
    payload = b64urlToBytes(parts[1]);
    sig = b64urlToBytes(parts[2]);
    obj = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload));
  } catch {
    return { problem: "MALFORMED" };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { problem: "MALFORMED" };
  if (typeof obj.iss !== "string" || typeof obj.kid !== "string") return { problem: "MALFORMED" };

  // Choosing the key from unverified iss/kid is safe: a lie here only selects
  // a key the signature then fails against.
  const issuer = issuers.find((k) => k.iss === obj.iss && k.kid === obj.kid);
  if (!issuer) return { problem: "UNKNOWN_ISSUER" };

  let raw;
  try { raw = derToRaw(sig); } catch { return { problem: "BAD_SIGNATURE" }; }
  const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, issuer.cryptoKey, raw, payload);
  if (!ok) return { problem: "BAD_SIGNATURE" };
  return { obj, issuer, token };
}

/**
 * Checks a card. Returns {card, problem}: problem is null for a card to honor.
 * card is present whenever the signature is genuine, so an expired or canceled
 * card can still say whose it was; it is null for anything not genuine.
 */
export async function verifyCard(token, issuers, { revoked = [], today = lakeToday() } = {}) {
  const opened = await open(token, "LC1", issuers);
  if (opened.problem) return { card: null, problem: opened.problem };
  const o = opened.obj;
  if (o.v === undefined || o.typ === undefined) return { card: null, problem: "MALFORMED" };
  if (o.v !== 1 || o.typ !== "card") return { card: null, problem: "UNKNOWN_FORMAT" };

  const boats = o.boats === undefined ? [] : o.boats;
  const text = (x) => typeof x === "string" && x.trim() !== "";
  if (!text(o.num) || !text(o.name) || !text(o.tier) || !validDate(o.issued) || !validDate(o.expires) ||
      !Array.isArray(boats) || boats.length > MAX_BOATS ||
      boats.some((b) => !b || typeof b !== "object" || (b.name != null && typeof b.name !== "string") ||
        (b.reg != null && typeof b.reg !== "string")) ||
      (o.phone != null && typeof o.phone !== "string")) {
    return { card: null, problem: "MALFORMED" };
  }

  const card = {
    iss: opened.issuer.iss,
    issuerName: opened.issuer.name, // always ours, never the card's
    number: o.num,
    name: o.name,
    tier: o.tier,
    boats: boats.map((b) => ({ name: b.name || null, reg: b.reg || null })),
    issued: o.issued,
    expires: o.expires,
    phone: o.phone || opened.issuer.phone || null,
    token: opened.token,
  };
  if (revoked.includes(card.number)) return { card, problem: "REVOKED" };
  if (today < card.issued) return { card, problem: "NOT_YET_VALID" };
  if (today > card.expires) return { card, problem: "EXPIRED" };
  return { card, problem: null };
}

/** A verified revocation list {iss, issued (ms), revoked[]}, or null. */
export async function verifyRevocations(token, issuers) {
  const opened = await open(token, "LCR1", issuers);
  if (opened.problem) return null;
  const o = opened.obj;
  if (o.v !== 1 || o.typ !== "revocations" || !Array.isArray(o.revoked)) return null;
  if (!o.revoked.every((n) => typeof n === "string")) return null;
  const issued = typeof o.issued === "string" ? Date.parse(o.issued) : NaN;
  if (Number.isNaN(issued)) return null;
  return { iss: opened.issuer.iss, issued, revoked: o.revoked, token: opened.token };
}

/** The card token in a page address, a pasted message, or on its own. */
export function extractToken(text) {
  if (!text) return null;
  const m = /LC1\.[A-Za-z0-9_-]+={0,2}\.[A-Za-z0-9_-]+={0,2}/.exec(decodeURIComponent(text));
  return m ? m[0] : null;
}
