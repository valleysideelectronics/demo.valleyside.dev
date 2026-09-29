/*
 * Card Console: state, navigation and actions. The screens live in views.js.
 *
 * Every action that changes a card (issue, send, cancel, edit, publish) is
 * written to an activity log, which feeds the dashboard, each member's
 * history, and later the hosted version's audit trail.
 */
import * as C from "./console-core.js";
import { importIssuers, verifyCard, verifyRevocations, extractToken, lakeToday, PROBLEMS } from "../card/card-core.js";
import { h, clear, icon, toast, closeOverlay, confirmBox, copyText, download, usDate } from "./ui.js";
import { createStore } from "./store.js";
import * as V from "./views.js";

const params = new URLSearchParams(location.search);
// ?demo in the address, or a host page that sets window.CONSOLE_DEMO (used
// where the address can't carry a query string, such as an embedded preview).
// Hosted mode (hosted.js): set by the deploy step as a meta tag, because the
// hosted page's security policy allows no inline script. A hosted page never
// falls back to the browser-only demo.
const HOSTED = (() => {
  try { const m = document.querySelector('meta[name="console-hosted"]'); return m ? JSON.parse(m.content) : null; } catch { return null; }
})();
const DEMO = !HOSTED && (params.has("demo") || window.CONSOLE_DEMO === true);
const store = createStore(DEMO ? "lcconsole.demo" : "lcconsole", { memory: !!HOSTED });

let qr = null;
import("./qr.js").then((m) => { qr = m; }).catch(() => { qr = null; });

export const DEFAULT_MSG = "Your {issuer} card is ready. Tap to add it to your phone: {link}\nIt works with no signal. Valid through {expires}.";

const app = {
  demo: DEMO,
  hosted: null, // { email, role, signOut } once signed in to the hosted console
  V,
  DEFAULT_MSG,
  C, PROBLEMS, verifyCard, extractToken,
  issuer: HOSTED ? null : store.loadIssuer(),
  members: store.loadMembers(),
  activity: store.loadActivity(),
  rev: store.loadRevocations(),
  signingKey: null,
  verifier: null,
  viewOnly: false,
  route: "overview",
  ui: { filter: "all", tier: "all", query: "", openId: null },
  get today() { return lakeToday(); },
  get qr() { return qr; },
};
export default app;

// ---------------------------------------------------------------- persistence

app.persist = () => {
  if (!store.saveMembers(app.members)) toast("This browser refused to save. Check its storage settings.", "alert");
  store.saveActivity(app.activity);
};
app.log = (type, member, detail = "") => {
  app.activity.push(C.activityEntry(type, member, detail));
  store.saveActivity(app.activity);
  app.emit(type, member);
};
// Moments worth reacting to (the demo tour listens); logged actions plus a few views.
const listeners = [];
app.on = (fn) => listeners.push(fn);
app.emit = (type, member) => listeners.forEach((fn) => { try { fn(type, member); } catch {} });
app.status = (m) => C.memberStatus(m, app.today, app.issuer);
app.link = (m) => (app.issuer.webBase ? C.webLink(app.issuer.webBase, m.token) : C.appLink(m.token));
app.message = (m) => (app.issuer.message || DEFAULT_MSG)
  .replace(/\{name\}/g, m.name).replace(/\{issuer\}/g, app.issuer.name)
  .replace(/\{link\}/g, app.link(m)).replace(/\{expires\}/g, usDate(m.expires));
app.find = (id) => app.members.find((m) => m.id === id);
app.newId = () => crypto.getRandomValues(new Uint32Array(2)).join("-");

// ---------------------------------------------------------------- navigation

// The route lives in state; the address bar only mirrors it (so Back works
// and a bookmark lands on the right page) wherever the host allows that.
const ROUTES = ["overview", "members", "cancellations", "check", "settings"];
const fromHash = () => {
  const r = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
  return ROUTES.includes(r) ? r : null;
};
app.route = fromHash() || "overview";
app.go = (route) => {
  app.route = ROUTES.includes(route) ? route : "overview";
  try { if (location.hash !== `#/${app.route}`) history.pushState(null, "", `#/${app.route}`); } catch {}
  closeOverlay();
  render();
};
window.addEventListener("popstate", () => { const r = fromHash(); if (r && r !== app.route) { app.route = r; closeOverlay(); render(); } });
window.addEventListener("hashchange", () => { const r = fromHash(); if (r && r !== app.route) { app.route = r; closeOverlay(); render(); } });

export function render() {
  const root = document.getElementById("root");
  if (!app.issuer) { clear(root).append(V.setupScreen(app)); return; }
  if (!app.signingKey && !app.viewOnly) { clear(root).append(V.unlockScreen(app)); return; }
  clear(root).append(V.shell(app));
  window.scrollTo(0, 0);
}
app.render = render;
/** Re-renders the current page without resetting scroll or reopening overlays. */
app.refresh = () => {
  const main = document.querySelector(".page");
  if (!main) return render();
  const y = window.scrollY;
  const fresh = V.page(app);
  main.replaceWith(fresh);
  V.refreshSidebar(app);
  window.scrollTo(0, y);
};

// ---------------------------------------------------------------- keys

app.ready = async () => {
  app.verifier = await importIssuers([{
    iss: app.issuer.iss, kid: app.issuer.kid, name: app.issuer.name, phone: app.issuer.phone || null, key: app.issuer.publicSpki,
  }]);
};
app.needKey = () => {
  if (app.signingKey) return true;
  toast("Unlock the signing key first", "lock");
  app.viewOnly = false; render();
  return false;
};
app.unlock = async (passphrase) => {
  const pkcs8 = await C.openKey(app.issuer.sealed, passphrase);
  app.signingKey = await C.importPrivate(pkcs8);
  await app.ready();
  app.viewOnly = false;
  armIdleLock();
};
app.lock = () => { app.signingKey = null; app.viewOnly = false; closeOverlay(); render(); toast("Locked", "lock"); };

let idleTimer;
function armIdleLock() {
  if (app.demo) return;
  const bump = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (app.signingKey) { app.signingKey = null; render(); toast("Locked after 30 minutes idle", "lock"); } }, 30 * 60000);
  };
  ["click", "keydown"].forEach((ev) => document.addEventListener(ev, bump, { passive: true }));
  bump();
}

app.createKey = async ({ iss, kid, name, phone, pass }, pkcs8, spki) => {
  if (!pkcs8) { const k = await C.generateKeyPair(); pkcs8 = k.privatePkcs8; spki = k.publicSpki; }
  app.issuer = {
    iss, kid, name, phone, publicSpki: C.b64(spki), sealed: await C.sealKey(pkcs8, pass),
    webBase: "", revocationUrl: "", message: DEFAULT_MSG,
  };
  store.saveIssuer(app.issuer);
  app.signingKey = await C.importPrivate(pkcs8);
  await app.ready();
  armIdleLock();
  app.go("settings");
  toast("Signing key ready. Download the key backup now.", "key");
};
app.restoreKeyBackup = async (file, pass) => {
  const b = JSON.parse(await file.text());
  if (b.kind !== "lake-cumberland-key-backup") throw new Error("not a key backup");
  const pkcs8 = await C.openKey(b.sealed, pass);
  app.issuer = { ...b.issuer, sealed: b.sealed };
  store.saveIssuer(app.issuer);
  app.signingKey = await C.importPrivate(pkcs8);
  await app.ready();
  armIdleLock();
  render();
  toast("Key restored", "key");
};
app.saveIssuer = () => store.saveIssuer(app.issuer);

// ---------------------------------------------------------------- card actions

/** Signs a card for a member. Returns true on success; records it. */
app.issue = async (m, { quiet = false, reason = "issued" } = {}) => {
  if (!app.needKey()) return false;
  try {
    const wasIssued = !!m.token;
    m.token = await C.issueCard(app.issuer, app.signingKey, m, app.today);
    m.signedPayload = JSON.stringify(C.cardPayload(app.issuer, m));
    m.issuedAt = new Date().toISOString();
    m.sentAt = null;
    app.log(reason === "renewed" ? "renewed" : "issued", m, `${m.tier} card ${wasIssued ? "re-signed" : "signed"}`);
    return true;
  } catch (err) {
    if (!quiet) toast(`${m.name || "Member"}: ${err.message}`, "alert");
    return false;
  }
};

app.markSent = (m, how) => {
  m.sentAt = new Date().toISOString();
  app.log(how, m, how === "copied" ? "Card link copied" : "Card link sent");
  app.persist();
};
// Texting and email hand off to the phone's or computer's own apps. The page
// itself never navigates: pointing it at an sms: or mailto: link replaces the
// console with a blank page wherever nothing handles that link (a computer
// with no texting app, or the console embedded in another page).
app.onPhone = () => navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function handOff(url) {
  try {
    const a = h("a", { href: url, target: "_blank", rel: "noopener" });
    document.body.append(a); a.click(); a.remove();
  } catch {}
}
app.textMember = async (m) => {
  const msg = app.message(m);
  if (app.onPhone()) {
    handOff(`sms:${(m.phone || "").replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(msg)}`);
    app.markSent(m, "texted");
    return;
  }
  // A computer usually can't send a text, so the message goes on the clipboard
  // to paste into Messages, Google Voice or a phone.
  if (await copyText(msg, `Message copied. Paste it into a text to ${m.phone || m.name}.`)) app.markSent(m, "copied");
};
app.emailMember = async (m) => {
  const msg = app.message(m);
  await copyText(msg, "Opening your email app. The message is copied too, in case it doesn't open.");
  handOff(`mailto:${encodeURIComponent(m.email || "")}?subject=${encodeURIComponent(`Your ${app.issuer.name} card`)}&body=${encodeURIComponent(msg)}`);
  app.markSent(m, "emailed");
};
app.copyLink = async (m) => { if (await copyText(app.link(m), "Card link copied")) app.markSent(m, "copied"); };

app.cancel = async (m) => {
  const ok = await confirmBox({
    title: `Cancel ${m.name}'s card?`,
    body: "Their card turns grey and reads CANCELED on their phone the next time it has signal, once you publish the cancellation list. You can reinstate them later.",
    confirm: "Cancel card", danger: true,
  });
  if (!ok) return false;
  m.canceled = true; m.canceledAt = new Date().toISOString();
  app.log("canceled", m, "Card canceled");
  app.persist();
  toast("Canceled. Publish the cancellation list to reach phones.", "cancel");
  return true;
};
app.reinstate = (m) => {
  m.canceled = false; m.canceledAt = null;
  app.log("reinstated", m, "Card reinstated");
  app.persist();
  toast(`${m.name} reinstated. Publish the list to reach phones.`);
};
app.remove = async (m) => {
  const ok = await confirmBox({ title: `Delete ${m.name}?`, body: "No card was issued, so nothing changes on any phone. This only removes them from the roster.", confirm: "Delete", danger: true });
  if (!ok) return false;
  app.members = app.members.filter((x) => x !== m);
  app.log("deleted", m, "Removed from roster");
  app.persist();
  return true;
};

app.saveMember = (data, existing) => {
  if (existing) {
    const before = JSON.stringify(C.cardPayload(app.issuer, existing));
    Object.assign(existing, data);
    const after = JSON.stringify(C.cardPayload(app.issuer, existing));
    if (before !== after) app.log("edited", existing, "Card details changed");
    app.persist();
    return existing;
  }
  const m = { ...data, id: app.newId() };
  app.members.push(m);
  app.log("added", m, "Added to roster");
  app.persist();
  return m;
};

app.issuePending = async () => {
  if (!app.needKey()) return;
  const todo = app.members.filter((m) => ["not issued", "changed"].includes(app.status(m)));
  if (!todo.length) { toast("Every member's card is up to date"); return; }
  let ok = 0;
  for (const m of todo) if (await app.issue(m, { quiet: true })) ok++;
  app.persist(); app.refresh();
  toast(`Signed ${ok} of ${todo.length} cards. Send them from each member.`, "sign");
};

app.renew = async ({ issued, expires, onlyIds }) => {
  if (!app.needKey()) return 0;
  const pool = app.members.filter((m) => !m.canceled && (!onlyIds || onlyIds.includes(m.id)));
  let ok = 0;
  for (const m of pool) {
    m.issued = issued; m.expires = expires;
    if (await app.issue(m, { quiet: true, reason: "renewed" })) ok++;
  }
  app.persist();
  return ok;
};

// ---------------------------------------------------------------- cancellations

app.activeCanceled = () => app.members.filter((m) => m.canceled && m.token && (C.parseDate(m.expires) || "") >= app.today);
app.listDiff = () => {
  const now = new Set(app.activeCanceled().map((m) => m.num));
  const was = new Set(app.rev.numbers || []);
  return { added: [...now].filter((n) => !was.has(n)), removed: [...was].filter((n) => !now.has(n)), current: [...now].sort() };
};
app.publish = async () => {
  if (!app.needKey()) return null;
  const numbers = app.activeCanceled().map((m) => m.num);
  const token = await C.issueRevocations(app.issuer, app.signingKey, numbers);
  app.rev = { publishedAt: new Date().toISOString(), numbers, token };
  store.saveRevocations(app.rev);
  app.log("published", null, `Cancellation list signed (${numbers.length} card${numbers.length === 1 ? "" : "s"})`);
  return token;
};

// ---------------------------------------------------------------- import / export / backups

app.importRows = (rows) => {
  let added = 0, updated = 0;
  for (const row of rows) {
    const existing = app.members.find((m) => m.num === row.num);
    if (existing) {
      Object.assign(existing, { ...row, email: row.email || existing.email, phone: row.phone || existing.phone });
      updated++;
    } else {
      const m = { ...row, id: app.newId() };
      app.members.push(m); added++;
    }
  }
  app.log("imported", null, `Roster import: ${added} new, ${updated} updated`);
  app.persist();
  return { added, updated };
};
app.exportCsv = () => {
  const rows = [["num", "name", "tier", "boats", "issued", "expires", "phone", "email", "status", "web_link"]];
  for (const m of app.members) rows.push([m.num, m.name, m.tier, C.formatBoats(m.boats), m.issued, m.expires, m.phone, m.email,
    app.status(m), m.token && !m.canceled ? app.link(m) : ""]);
  download(`${app.issuer.iss}-roster-${app.today}.csv`, C.writeCsv(rows), "text/csv");
};
app.keyBackup = () => {
  const { sealed, ...pub } = app.issuer;
  download(`${app.issuer.iss}-${app.issuer.kid}-key-backup.json`, JSON.stringify({ kind: "lake-cumberland-key-backup", v: 1, issuer: pub, sealed }, null, 2), "application/json");
};
app.rosterBackup = () => {
  download(`${app.issuer.iss}-roster-backup-${app.today}.json`,
    JSON.stringify({ kind: "lake-cumberland-roster", v: 2, iss: app.issuer.iss, members: app.members, revocations: app.rev, activity: app.activity }, null, 1), "application/json");
  store.saveBackupAt(Date.now());
};
app.lastBackup = () => store.loadBackupAt();
app.restoreRoster = async (file) => {
  const b = JSON.parse(await file.text());
  if (b.kind !== "lake-cumberland-roster" || b.iss !== app.issuer.iss) throw new Error(`not a roster backup for ${app.issuer.iss}`);
  app.members = b.members; app.rev = b.revocations || app.rev; app.activity = b.activity || app.activity;
  app.persist(); store.saveRevocations(app.rev);
};
app.resetDemo = () => location.reload();

// ---------------------------------------------------------------- theme

const THEME_KEY = "lcconsole.theme";
app.theme = (() => { try { return localStorage.getItem(THEME_KEY) || ""; } catch { return ""; } })();
if (app.theme) document.documentElement.dataset.theme = app.theme;
app.toggleTheme = () => {
  const dark = (app.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  app.theme = dark ? "light" : "dark";
  document.documentElement.dataset.theme = app.theme;
  try { localStorage.setItem(THEME_KEY, app.theme); } catch {}
  V.refreshSidebar(app);
};

// ---------------------------------------------------------------- errors

// An action that fails should say so on screen, never do nothing.
window.addEventListener("error", (e) => toast(`Something went wrong: ${e.message}`, "alert"));
window.addEventListener("unhandledrejection", (e) => toast(`Something went wrong: ${e.reason?.message || e.reason}`, "alert"));

// ---------------------------------------------------------------- boot

async function boot() {
  if (HOSTED) {
    const { startHosted } = await import("./hosted.js");
    await startHosted(app, HOSTED, { V, C, render });
    if (app.hosted) V.installPalette(app);
    return;
  }
  if (DEMO) {
    const { buildDemo } = await import("./demo.js");
    const d = await buildDemo(app.today);
    // Every visit starts from the same fresh demo with a new in-memory key,
    // so a pitch always opens in a known state. Changes last until reload.
    store.clear();
    app.issuer = d.issuer; app.signingKey = d.signingKey;
    app.members = d.members; app.activity = d.activity; app.rev = d.rev;
    await app.ready();
  } else if (app.issuer) {
    await app.ready();
  }
  render();
  V.installPalette(app);
  if (DEMO) import("./tour.js").then((t) => t.installTour(app, V)).catch(() => {});
}
boot();
