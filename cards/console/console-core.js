/*
 * The issuer console's logic: keys, members, signing, cancellations.
 *
 * Everything runs in the browser of whoever manages the cards. There is no
 * server. The private key is created or imported here, kept in this browser
 * encrypted under a passphrase the issuer chooses, and never sent anywhere.
 * That is the property that matters most: the people who host this page, and
 * the app's developer, cannot issue a card in the issuer's name.
 *
 * Output is byte-compatible with tools/issuer/Issuer.java: the same payload
 * field order, DER signatures, and base64url with no padding. The console's
 * tests verify its cards with the Java tool and the web card verifier.
 */

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

// CAPTAIN is for the issuer's own staff. The app shows its "check a member's
// card" screen only on a phone holding a genuine, current CAPTAIN card, so
// captains need no login and regular members never see the captain tools.
export const TIERS = ["GOLD", "ULTIMATE", "COMMERCIAL", "CAPTAIN"];
export const TIER_BOAT_LIMIT = { GOLD: 1, ULTIMATE: 4 };
export const MAX_BOATS = 8;

// ---------------------------------------------------------------- encoding

export const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const b64 = (bytes) => {
  let s = "";
  const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s) => Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0));

/** WebCrypto signs as raw r||s; the card format (and Java) uses DER. */
export function rawToDer(raw) {
  const int = (b) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = Array.from(b.slice(i));
    if (v[0] & 0x80) v = [0, ...v];
    return [0x02, v.length, ...v];
  };
  const body = [...int(raw.slice(0, 32)), ...int(raw.slice(32, 64))];
  return Uint8Array.from([0x30, body.length, ...body]);
}

// ---------------------------------------------------------------- keys

const EC = { name: "ECDSA", namedCurve: "P-256" };

/** A new key pair. Returns {privatePkcs8, publicSpki} as bytes. */
export async function generateKeyPair() {
  const kp = await subtle.generateKey(EC, true, ["sign", "verify"]);
  return {
    privatePkcs8: new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey)),
    publicSpki: new Uint8Array(await subtle.exportKey("spki", kp.publicKey)),
  };
}

export async function importPrivate(pkcs8) {
  return subtle.importKey("pkcs8", pkcs8, EC, false, ["sign"]);
}

export async function importPublic(spki) {
  return subtle.importKey("spki", spki, EC, true, ["verify"]);
}

/**
 * Proves a private key and a public key belong together by signing and
 * verifying a probe. Importing someone's .pk8 next to the wrong .b64 would
 * otherwise issue a roster of cards the app rejects.
 */
export async function keysMatch(privateKey, publicKey) {
  const probe = enc.encode("lake-cumberland-key-check");
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, probe);
  return subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, sig, probe);
}

/** Derives the public key from a PKCS#8 private key via its embedded JWK. */
export async function publicFromPrivate(pkcs8) {
  const k = await subtle.importKey("pkcs8", pkcs8, EC, true, ["sign"]);
  const jwk = await subtle.exportKey("jwk", k);
  const pub = await subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true }, EC, true, ["verify"]);
  return new Uint8Array(await subtle.exportKey("spki", pub));
}

const KDF_ITERATIONS = 310000;

/**
 * Encrypts the private key under a passphrase: PBKDF2-SHA256 then AES-GCM.
 * This blob is what sits in the browser and what the backup file holds. The
 * passphrase is never stored.
 */
export async function sealKey(pkcs8, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await deriveAes(passphrase, salt, KDF_ITERATIONS);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, aes, pkcs8));
  return { v: 1, kdf: "PBKDF2-SHA256", iterations: KDF_ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** Throws on a wrong passphrase (AES-GCM authentication fails). */
export async function openKey(sealed, passphrase) {
  const aes = await deriveAes(passphrase, unb64(sealed.salt), sealed.iterations);
  return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, aes, unb64(sealed.ct)));
}

async function deriveAes(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

// ---------------------------------------------------------------- members

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** ISO date from "2026-03-01" or "3/1/2026" (Excel rewrites ISO dates). Null if invalid. */
export function parseDate(s) {
  s = String(s ?? "").trim();
  let y, m, d, mt;
  if ((mt = ISO.exec(s))) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = US.exec(s))) [y, m, d] = [+mt[3], +mt[1], +mt[2]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "Sea Ray|KY 1234 AB;Bayliner|KY 5678 CD" to [{name, reg}], same as the Java tool. */
export function parseBoats(s) {
  return String(s ?? "").split(";").map((part) => {
    const [name = "", reg = ""] = part.split("|").map((x) => x.trim());
    return { name, reg };
  }).filter((b) => b.name || b.reg);
}

export const formatBoats = (boats) => (boats || []).map((b) => [b.name || "", b.reg || ""].join("|")).join(";");

/**
 * Checks a member record and returns {errors, warnings}. Errors stop a card
 * from being issued; warnings are shown but do not.
 */
export function checkMember(m, today) {
  const errors = [], warnings = [];
  const text = (v) => typeof v === "string" && v.trim() !== "";
  if (!text(m.num)) errors.push("member number is missing");
  if (!text(m.name)) errors.push("name is missing");
  for (const [field, v] of [["name", m.name], ["member number", m.num], ["phone", m.phone]]) {
    if (typeof v === "string" && /[\r\n\t]/.test(v)) errors.push(`${field} contains a line break or tab`);
  }
  if (!TIERS.includes(m.tier)) errors.push(`plan must be ${TIERS.join(", ")}`);
  const issued = parseDate(m.issued), expires = parseDate(m.expires);
  if (!issued) errors.push("start date is missing or not a real date");
  if (!expires) errors.push("expiry date is missing or not a real date");
  if (issued && expires && expires < issued) errors.push("expiry is before the start date");
  const boats = m.boats || [];
  if (boats.length > MAX_BOATS) errors.push(`at most ${MAX_BOATS} boats`);
  const limit = TIER_BOAT_LIMIT[m.tier];
  if (limit && boats.length > limit) warnings.push(`${m.tier} normally covers ${limit} boat${limit > 1 ? "s" : ""}; this card lists ${boats.length}`);
  if (expires && today && expires < today) warnings.push("this card is already expired");
  if (issued && expires) {
    const months = (Date.parse(expires) - Date.parse(issued)) / (30.44 * 86400000);
    if (months > 13) warnings.push("expiry is more than 13 months after the start date; check the year");
  }
  return { errors, warnings };
}

/**
 * The card payload, in the exact field order the Java tool writes, optional
 * fields omitted when empty. The signature covers these bytes.
 */
export function cardPayload(issuer, m) {
  const o = { v: 1, typ: "card", iss: issuer.iss, kid: issuer.kid, num: m.num.trim(), name: m.name.trim(), tier: m.tier };
  const boats = (m.boats || []).map((b) => {
    const x = {};
    if (b.name && b.name.trim()) x.name = b.name.trim();
    if (b.reg && b.reg.trim()) x.reg = b.reg.trim();
    return x;
  }).filter((b) => b.name || b.reg);
  if (boats.length) o.boats = boats;
  o.issued = parseDate(m.issued);
  o.expires = parseDate(m.expires);
  // The phone on a card is the ISSUER's (the app's "Call" button
  // button dials it), never the member's own number from the roster.
  if (issuer.phone && String(issuer.phone).trim()) o.phone = String(issuer.phone).trim();
  return o;
}

/**
 * `signer` is either a WebCrypto private key (the browser console) or an
 * object with `signDer(bytes)` returning a DER signature (the hosted service,
 * where the key lives in AWS KMS and never leaves it).
 */
async function signToken(prefix, obj, signer) {
  const payload = enc.encode(JSON.stringify(obj));
  const der = typeof signer?.signDer === "function"
    ? new Uint8Array(await signer.signDer(payload))
    : rawToDer(new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signer, payload)));
  return `${prefix}.${b64url(payload)}.${b64url(der)}`;
}

/** Signs a member's card. Throws with the reasons if the record has errors. */
export async function issueCard(issuer, privateKey, member, today) {
  const { errors } = checkMember(member, today);
  if (errors.length) throw new Error(errors.join("; "));
  return signToken("LC1", cardPayload(issuer, member), privateKey);
}

/**
 * The signed cancellation list. It REPLACES the previous one, so it must list
 * every canceled card that has not yet expired; the app keeps only the newest.
 */
export async function issueRevocations(issuer, privateKey, numbers, now = new Date()) {
  const revoked = [...new Set(numbers.map((n) => n.trim()).filter(Boolean))].sort();
  const issued = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  return signToken("LCR1", { v: 1, typ: "revocations", iss: issuer.iss, kid: issuer.kid, issued, revoked }, privateKey);
}

export const webLink = (base, token) => base.replace(/#.*$/, "") + "#t=" + token;
export const appLink = (token) => "lakecumberland://card?t=" + encodeURIComponent(token);

// ---------------------------------------------------------------- CSV

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF, line breaks in quotes. */
export function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (q) throw new Error("a quoted field is never closed");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export function writeCsv(rows) {
  const cell = (v) => {
    v = String(v ?? "");
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Members from a roster CSV. Headings are matched loosely, because a Google
 * Forms export says "Member Number" and "Boat(s)" rather than num and boats.
 */
export function membersFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { members: [], problems: ["the file is empty"] };
  const head = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const find = (...names) => head.findIndex((h) => names.includes(h));
  const col = {
    num: find("num", "number", "membernumber", "memberno", "member", "id", "memberid"),
    name: find("name", "membername", "fullname"),
    tier: find("tier", "plan", "membership", "level"),
    boats: find("boats", "boat", "boatsregistration", "vessel", "vessels"),
    issued: find("issued", "start", "startdate", "issuedate"),
    expires: find("expires", "expiry", "expiration", "expirationdate", "enddate", "validthrough"),
    phone: find("phone", "phonenumber", "cell", "mobile"),
    email: find("email", "emailaddress"),
  };
  const missing = ["num", "name", "tier", "issued", "expires"].filter((k) => col[k] < 0);
  if (missing.length) return { members: [], problems: [`missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`] };
  const get = (r, k) => (col[k] >= 0 ? (r[col[k]] ?? "").trim() : "");
  const members = rows.slice(1).map((r) => ({
    num: get(r, "num"), name: get(r, "name"), tier: get(r, "tier").toUpperCase(),
    boats: parseBoats(get(r, "boats")), issued: parseDate(get(r, "issued")) || get(r, "issued"),
    expires: parseDate(get(r, "expires")) || get(r, "expires"), phone: get(r, "phone"), email: get(r, "email"),
  }));
  return { members, problems: [] };
}

// ---------------------------------------------------------------- member numbers

/** The initials on member numbers: "CL" for Cove Line Towing. */
export function numberPrefix(issuer) {
  const words = String(issuer?.name || "").match(/[A-Za-z0-9]+/g) || [];
  const initials = words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  if (initials.length >= 2) return initials;
  return String(issuer?.iss || "").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "CARD";
}

/**
 * The next unused number for a season: PREFIX-YEAR-0001 for members and
 * PREFIX-YEAR-C001 for captains' staff cards, so a captain's card is obvious
 * at a glance and the two series never collide. Counts up from the highest
 * number already used, never reusing a gap (a gap may be a canceled card
 * that is still on someone's phone).
 */
export function nextMemberNumber(members, { prefix, year, captain = false }) {
  const re = new RegExp(`^${prefix}-${year}-${captain ? "C" : ""}(\\d+)$`, "i");
  let max = 0;
  for (const m of members) {
    const mt = re.exec(String(m.num || "").trim());
    if (mt) max = Math.max(max, +mt[1]);
  }
  return `${prefix}-${year}-${captain ? "C" : ""}${String(max + 1).padStart(captain ? 3 : 4, "0")}`;
}

// ---------------------------------------------------------------- status

/** Where a member stands, for the roster's status column. */
export function memberStatus(m, today, issuer) {
  if (m.canceled) return "canceled";
  if (!m.token) return "not issued";
  // Edited since the card was signed: the member's phone still shows the old
  // details until a new card is sent.
  if (issuer && m.signedPayload && m.signedPayload !== JSON.stringify(cardPayload(issuer, m))) return "changed";
  const exp = parseDate(m.expires), iss = parseDate(m.issued);
  if (exp && exp < today) return "expired";
  if (iss && iss > today) return "not started";
  if (exp && (Date.parse(exp) - Date.parse(today)) / 86400000 <= 30) return "expiring";
  return "active";
}

// ---------------------------------------------------------------- dashboard

const DAY = 86400000;
const dayNum = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);
const isoFromDay = (n) => new Date(n * DAY).toISOString().slice(0, 10);

/**
 * The boating season the office thinks in: March 1 through November 30.
 * Outside it (December to February) this reports the NEXT season, with
 * progress 0, so the gauge reads "starts in N days" rather than "done".
 */
export function seasonFor(today) {
  const y = +today.slice(0, 4);
  const md = today.slice(5);
  const year = md > "11-30" ? y + 1 : y;
  const start = `${year}-03-01`, end = `${year}-11-30`;
  const total = dayNum(end) - dayNum(start) + 1;
  const into = dayNum(today) - dayNum(start) + 1;
  return {
    start, end, year,
    inSeason: today >= start && today <= end,
    progress: Math.max(0, Math.min(1, into / total)),
    daysLeft: Math.max(0, dayNum(end) - dayNum(today)),
    daysUntilStart: Math.max(0, dayNum(start) - dayNum(today)),
  };
}

/** Counts behind the overview, all from the roster itself. */
export function rosterStats(members, today, issuer) {
  const byStatus = { active: 0, expiring: 0, changed: 0, "not issued": 0, "not started": 0, expired: 0, canceled: 0 };
  const byTier = { GOLD: 0, ULTIMATE: 0, COMMERCIAL: 0 };
  let boats = 0;
  for (const m of members) {
    byStatus[memberStatus(m, today, issuer)]++;
    if (!m.canceled && byTier[m.tier] !== undefined) byTier[m.tier]++;
    if (!m.canceled) boats += (m.boats || []).length;
  }
  return {
    total: members.length,
    covered: byStatus.active + byStatus.expiring + byStatus.changed,
    needSending: byStatus["not issued"] + byStatus.changed,
    byStatus, byTier, boats,
  };
}

/** Members whose cards run out within `days`, soonest first. Canceled ones are skipped. */
export function renewalsDue(members, today, days = 30) {
  const t = dayNum(today);
  return members
    .filter((m) => !m.canceled && m.token && parseDate(m.expires))
    .map((m) => ({ m, left: dayNum(parseDate(m.expires)) - t }))
    .filter((x) => x.left >= 0 && x.left <= days)
    .sort((a, b) => a.left - b.left || a.m.name.localeCompare(b.m.name));
}

/**
 * Activity per week for the last `weeks` weeks ending with the week that
 * contains `today`, for the issuing chart. Weeks start on Monday.
 * Returns [{ start: "YYYY-MM-DD", issued, canceled }] oldest first.
 */
export function weeklyActivity(activity, today, weeks = 12) {
  const t = dayNum(today);
  const dow = (new Date(t * DAY).getUTCDay() + 6) % 7; // Monday = 0
  const firstWeek = t - dow - (weeks - 1) * 7;
  const out = Array.from({ length: weeks }, (_, i) => ({ start: isoFromDay(firstWeek + i * 7), issued: 0, canceled: 0 }));
  for (const a of activity) {
    const d = dayNum(String(a.at).slice(0, 10));
    const i = Math.floor((d - firstWeek) / 7);
    if (i < 0 || i >= weeks) continue;
    if (a.type === "issued" || a.type === "renewed") out[i].issued++;
    if (a.type === "canceled") out[i].canceled++;
  }
  return out;
}

/** One activity-log entry. Kept small: who, what, when. */
export function activityEntry(type, member, detail = "", at = new Date()) {
  return { at: at.toISOString(), type, num: member?.num ?? "", name: member?.name ?? "", detail };
}

/**
 * A short, stable fingerprint of a public key, for people to compare by eye:
 * SHA-256 of the key bytes, first 16 bytes as 4 groups of 8 hex digits.
 */
export async function keyFingerprint(spkiBase64) {
  const digest = new Uint8Array(await subtle.digest("SHA-256", unb64(spkiBase64)));
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return { hex: hex.match(/.{8}/g).join(" "), bytes: digest };
}

/**
 * Activity by calendar month across the season (March to November), for the
 * season chart. Months after `today` are marked future so the chart can draw
 * them empty rather than as zero.
 */
export function seasonMonths(activity, today) {
  const { year } = seasonFor(today);
  const names = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  const out = names.map((label, i) => ({ label, month: `${year}-${String(i + 3).padStart(2, "0")}`, issued: 0, canceled: 0, future: false }));
  const thisMonth = today.slice(0, 7);
  for (const m of out) m.future = m.month > thisMonth;
  for (const a of activity) {
    const m = out.find((x) => x.month === String(a.at).slice(0, 7));
    if (!m) continue;
    if (a.type === "issued" || a.type === "renewed") m.issued++;
    if (a.type === "canceled") m.canceled++;
  }
  return out;
}
