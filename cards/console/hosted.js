/*
 * Hosted mode: the same console, backed by the Valleyside card service
 * (card-service/) instead of this browser. Turned on by a
 * <meta name="console-hosted" content='{"api": ..., "authDomain": ..., "clientId": ...}'>
 * in index.html, which the deploy step writes.
 *
 * Every screen stays the same. What changes is underneath each action:
 *   - staff sign in (Cognito, with two-factor) instead of unlocking a key;
 *   - cards are signed by the server's key in AWS KMS, never in the browser;
 *   - the roster lives on the server, so the whole office shares it, and
 *     nothing is written to this browser's storage.
 *
 * Actions the screens call without waiting (save, reinstate, mark sent) are
 * applied on screen at once and confirmed with the server in the background.
 * Calls for one member run in order, and if the server refuses one, the
 * console says why and reloads the roster from the server.
 */
import { h, clear, icon, toast, download, confirmBox } from "./ui.js";
import { createAuth } from "./auth.js";

export async function startHosted(app, config, { V, C, render }) {
  const auth = createAuth(config);
  const root = document.getElementById("root");
  const api = config.api.replace(/\/+$/, "");

  let signedIn;
  try { signedIn = await auth.start(); }
  catch (err) { signedIn = false; setTimeout(() => toast(err.message, "alert"), 50); }
  if (!signedIn) { clear(root).append(signInScreen(app, auth)); return; }

  async function call(method, path, body, { raw = false } = {}) {
    let token;
    try { token = await auth.token(); }
    catch { clear(root).append(signInScreen(app, auth)); throw new Error("Your session ended. Sign in again."); }
    const res = await fetch(api + path, {
      method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { clear(root).append(signInScreen(app, auth)); throw new Error("Your session ended. Sign in again."); }
    if (raw && res.ok) return res.text();
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || `the server said ${res.status}`), { status: res.status });
    return out;
  }
  app.call = call;

  // One queue per member, so a save, a sign and a "sent" never race each other.
  const queues = new Map();
  const queue = (id, fn) => {
    const next = (queues.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    queues.set(id, next);
    return next;
  };
  const merge = (m, saved) => { Object.assign(m, saved); return m; };
  const refused = (err) => { toast(err.message, "alert"); resync(); };

  const serverActivity = (entries) => entries.slice().reverse(); // oldest first, like the local log

  async function load() {
    const [issuer, roster, rev, activity] = await Promise.all([
      call("GET", "/v1/issuer"), call("GET", "/v1/members"), call("GET", "/v1/revocations"), call("GET", "/v1/activity?limit=1000"),
    ]);
    app.issuer = {
      ...issuer,
      name: issuer.name || issuer.iss,
      webBase: issuer.webBase || `${location.origin}/card/`,
      revocationUrl: issuer.revocationUrl || `${location.origin}/revoked.txt`,
    };
    app.members = roster.members;
    app.rev = rev.token ? rev : { publishedAt: null, numbers: [] };
    app.activity = serverActivity(activity.entries);
  }

  async function resync() {
    try {
      const [roster, activity] = await Promise.all([call("GET", "/v1/members"), call("GET", "/v1/activity?limit=1000")]);
      app.members = roster.members;
      app.activity = serverActivity(activity.entries);
      if (document.querySelector(".page")) app.refresh();
    } catch (err) { if (!/session/.test(err.message)) toast(`Couldn't reach the server: ${err.message}`, "alert"); }
  }

  // ------------------------------------------------------------ actions

  app.persist = () => {};
  app.saveIssuer = () => {
    const { name, phone, webBase, revocationUrl, message } = app.issuer;
    call("PUT", "/v1/issuer", { name, phone, webBase, revocationUrl, message }).then((iss) => Object.assign(app.issuer, iss)).catch(refused);
  };
  app.newId = () => crypto.randomUUID();

  app.issue = (m, { quiet = false, reason = "issued" } = {}) => queue(m.id, async () => {
    try {
      const wasIssued = !!m.token;
      merge(m, await call("POST", `/v1/members/${m.id}/issue`));
      app.log(reason === "renewed" ? "renewed" : "issued", m, `${m.tier} card ${wasIssued ? "re-signed" : "signed"}`);
      return true;
    } catch (err) {
      if (!quiet) toast(`${m.name || "Member"}: ${err.message}`, "alert");
      return false;
    }
  });

  app.markSent = (m, how) => {
    m.sentAt = new Date().toISOString();
    app.log(how, m, how === "copied" ? "Card link copied" : "Card link sent");
    queue(m.id, () => call("POST", `/v1/members/${m.id}/sent`, { how }).then((s) => merge(m, s))).catch(refused);
  };

  app.cancel = async (m) => {
    const ok = await confirmBox({
      title: `Cancel ${m.name}'s card?`,
      body: "Their card turns grey and reads CANCELED on their phone the next time it has signal, once you publish the cancellation list. You can reinstate them later.",
      confirm: "Cancel card", danger: true,
    });
    if (!ok) return false;
    try { merge(m, await queue(m.id, () => call("POST", `/v1/members/${m.id}/cancel`))); }
    catch (err) { refused(err); return false; }
    app.log("canceled", m, "Card canceled");
    toast("Canceled. Publish the cancellation list to reach phones.", "cancel");
    return true;
  };

  app.reinstate = (m) => {
    m.canceled = false; m.canceledAt = null;
    app.log("reinstated", m, "Card reinstated");
    queue(m.id, () => call("POST", `/v1/members/${m.id}/reinstate`).then((s) => merge(m, s))).catch(refused);
    toast(`${m.name} reinstated. Publish the list to reach phones.`);
  };

  app.remove = async (m) => {
    const ok = await confirmBox({ title: `Delete ${m.name}?`, body: "No card was issued, so nothing changes on any phone. This only removes them from the roster.", confirm: "Delete", danger: true });
    if (!ok) return false;
    try { await queue(m.id, () => call("DELETE", `/v1/members/${m.id}`)); }
    catch (err) { refused(err); return false; }
    app.members = app.members.filter((x) => x !== m);
    app.log("deleted", m, "Removed from roster");
    return true;
  };

  const FIELDS = ["num", "name", "tier", "boats", "issued", "expires", "phone", "email"];
  const pick = (o) => Object.fromEntries(FIELDS.filter((k) => k in o).map((k) => [k, o[k]]));
  app.saveMember = (data, existing) => {
    if (existing) {
      const before = JSON.stringify(C.cardPayload(app.issuer, existing));
      Object.assign(existing, data);
      if (JSON.stringify(C.cardPayload(app.issuer, existing)) !== before) app.log("edited", existing, "Card details changed");
      queue(existing.id, () => call("PUT", `/v1/members/${existing.id}`, { ...pick(existing), version: existing.version }).then((s) => merge(existing, s))).catch(refused);
      return existing;
    }
    const m = { ...data, id: app.newId() };
    app.members.push(m);
    app.log("added", m, "Added to roster");
    queue(m.id, () => call("POST", "/v1/members", { ...pick(m), id: m.id }).then((s) => merge(m, s))).catch(refused);
    return m;
  };

  app.importRows = (rows) => {
    const local = { added: 0, updated: 0 };
    for (const row of rows) app.members.some((m) => m.num === row.num) ? local.updated++ : local.added++;
    call("POST", "/v1/import", { members: rows.map(pick) })
      .then((r) => {
        if (r.problems?.length) toast(`${r.problems.length} row${r.problems.length === 1 ? " was" : "s were"} skipped by the server: ${r.problems[0].errors[0]}`, "alert");
        return resync();
      })
      .catch(refused);
    app.log("imported", null, `Roster import: ${local.added} new, ${local.updated} updated`);
    return local;
  };

  app.renew = async ({ issued, expires, onlyIds }) => {
    const pool = app.members.filter((m) => !m.canceled && (!onlyIds || onlyIds.includes(m.id)));
    let ok = 0;
    for (const m of pool) {
      try {
        await queue(m.id, async () => {
          merge(m, await call("PUT", `/v1/members/${m.id}`, { issued, expires, version: m.version }));
          merge(m, await call("POST", `/v1/members/${m.id}/issue`));
        });
        app.log("renewed", m, `${m.tier} card renewed`);
        ok++;
      } catch (err) { toast(`${m.name}: ${err.message}`, "alert"); }
    }
    return ok;
  };

  app.publish = async () => {
    try {
      app.rev = await call("POST", "/v1/revocations/publish");
      app.log("published", null, `Cancellation list signed (${app.rev.numbers.length} card${app.rev.numbers.length === 1 ? "" : "s"})`);
      return app.rev.token;
    } catch (err) { toast(err.message, "alert"); return null; }
  };

  app.exportCsv = async () => {
    try { download(`${app.issuer.iss}-roster-${app.today}.csv`, await call("GET", "/v1/export", null, { raw: true }), "text/csv"); }
    catch (err) { toast(err.status === 403 ? "Exporting the roster needs the admin role." : err.message, "alert"); }
  };

  app.lastBackup = () => null;
  app.lock = () => auth.signOut();

  // ------------------------------------------------------------ go

  try { await load(); }
  catch (err) {
    clear(root).append(signInScreen(app, auth, `Couldn't load the roster: ${err.message}`));
    return;
  }
  app.signingKey = { hosted: true };
  app.hosted = { ...auth.who(), signOut: () => auth.signOut(), keyHome: auth.dev ? "Dev key, in memory" : null };
  await app.ready();
  render();

  // Other staff are working too: pick up their changes every 90 seconds while
  // this tab is open and visible.
  setInterval(() => { if (document.visibilityState === "visible" && !document.querySelector(".scrim")) resync(); }, 90000);
}

function signInScreen(app, auth, error = "") {
  const V = app.V;
  const card = h("div.gate-card",
    h("h1", "Sign in"),
    h("p.muted", { style: { margin: 0 } }, "Use the email your office invited, then the code from your authenticator app."),
    error ? h("div.err-text", error) : null,
    auth.dev
      ? [h("div.section-label", { style: { margin: "6px 0 0" } }, "Local dev server: sign in as"),
        ...["admin", "issuer", "viewer"].map((role) => h("button.btn" + (role === "admin" ? ".primary" : ""), {
          style: { justifyContent: "center", padding: "11px" }, on: { click: () => { auth.devSignIn(`${role}@example.com`, role); location.reload(); } },
        }, icon("user"), `${role[0].toUpperCase()}${role.slice(1)}`))]
      : h("button.btn.primary", { style: { justifyContent: "center", padding: "11px" }, on: { click: () => auth.signIn() } }, icon("lock"), "Sign in"));
  return h("div.gate",
    h("div.gate-art", V.lakeSvg("lake", { stroke: true }),
      h("div", { style: { position: "relative", display: "flex", gap: "12px", alignItems: "center" } }, V.brandMark(), h("b", { style: { font: "700 18px var(--display)" } }, "Card Console")),
      h("div", h("h2", "Staff sign-in"), h("p", "Every card is signed by a key held in a vault. Every change is recorded."))),
    h("div.gate-form", card));
}
