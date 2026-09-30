/*
 * Card Console screens. Each function builds DOM from the app's state;
 * app.js owns the state and every action.
 */
import { h, clear, icon, toast, showOverlay, closeOverlay, copyText, usDate, shortDate, ago, initials, plural,
  statusClass, STATUS_LABEL } from "./ui.js";
import { cardFace, phoneWith, sealStamp, tickNow } from "./card-face.js";
import { LAKE_VIEWBOX, LAKE_PATH } from "./lake-art.js";

const NAV = [
  ["overview", "Overview", "overview"],
  ["members", "Members", "members"],
  ["cancellations", "Cancellations", "cancel"],
  ["check", "Check a card", "check"],
  ["settings", "Settings & key", "settings"],
];

export function lakeSvg(cls, { stroke = false, draw = false } = {}) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", LAKE_VIEWBOX);
  s.setAttribute("class", cls + (draw ? " draw" : ""));
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = stroke
    ? `<path d="${LAKE_PATH}" fill="currentColor" fill-opacity=".35" fill-rule="evenodd" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`
    : `<path d="${LAKE_PATH}" fill="currentColor" fill-rule="evenodd"/>`;
  return s;
}

export function brandMark() {
  // A card with a wave: the membership card, on the water.
  const m = h("div.brand-mark");
  m.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="7" width="24" height="17" rx="3.5"/><path d="M8 13h8"/><path d="M4 19.5c2.5-2 5-2 7.5 0s5 2 7.5 0 5-2 9 0" stroke-width="1.8"/></svg>`;
  return m;
}

// ---------------------------------------------------------------- shell

export function shell(app) {
  return h("div.app",
    sidebar(app),
    h("div.main",
      app.demo ? h("div.demo-ribbon", h("b", "DEMO"), h("span", "Sample roster of fictional members, signed with a key made for this visit. Nothing here is real or leaves this browser."),
        h("button.btn.sm", { on: { click: () => app.resetDemo() } }, icon("refresh"), "Reset demo")) : null,
      app.viewOnly ? h("div.demo-ribbon", h("b", "VIEW ONLY"), h("span", "Unlock the signing key to issue, cancel or publish."),
        h("button.btn.sm.primary", { on: { click: () => { app.viewOnly = false; app.render(); } } }, icon("unlock"), "Unlock")) : null,
      page(app, { animate: true })));
}

function sidebar(app) {
  const s = app.C.rosterStats(app.members, app.today, app.issuer);
  const diff = app.listDiff();
  const counts = {
    members: s.needSending ? { n: s.needSending, alert: false } : null,
    cancellations: diff.added.length + diff.removed.length ? { n: diff.added.length + diff.removed.length, alert: true } : null,
  };
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  return h("aside.side",
    lakeSvg("lake-watermark"),
    h("div.brand", brandMark(), h("div", h("div.brand-name", "Card Console"), h("div.brand-sub", "Lake Cumberland"))),
    app.hosted
      ? h("div.org-chip",
        h("div.who", app.issuer.name),
        h("div.meta", h("span.key-dot.on"), app.hosted.keyHome || "Key held in AWS KMS"),
        h("div.meta", { style: { marginTop: "1px", paddingLeft: "13px" } }, h("span", { title: app.hosted.email }, app.hosted.email.split("@")[0]), " · ", h("b.role", app.hosted.role || "no role")))
      : h("div.org-chip",
        h("div.who", app.issuer.name),
        h("div.meta", h("span.key-dot" + (app.signingKey ? ".on" : "")), app.signingKey ? "Signing key unlocked" : "Signing key locked"),
        h("div.meta.mono", { style: { marginTop: "1px", paddingLeft: "13px" } }, app.issuer.kid)),
    h("nav.nav", { "aria-label": "Sections" },
      h("div.nav-label", "Manage"),
      NAV.map(([route, label, ic]) => {
        const c = counts[route];
        return h("button", { "aria-current": app.route === route ? "page" : null, on: { click: () => app.go(route) } },
          icon(ic), label, c ? h(`span.count${c.alert ? ".alert" : ""}`, c.n) : null);
      })),
    h("div.side-foot",
      h("button.side-btn", { on: { click: () => openPalette(app) } }, icon("command"), "Quick find", h("span.kbd", "Ctrl K")),
      h("button.side-btn", { on: { click: () => app.toggleTheme() } }, icon(dark ? "sun" : "moon"), dark ? "Light mode" : "Dark mode"),
      app.hosted ? h("button.side-btn", { on: { click: () => app.lock() } }, icon("lock"), "Sign out")
        : app.signingKey && !app.demo ? h("button.side-btn", { on: { click: () => app.lock() } }, icon("lock"), "Lock now") : null));
}

export function refreshSidebar(app) {
  const old = document.querySelector(".side");
  if (old) old.replaceWith(sidebar(app));
}

export function page(app, { animate = false } = {}) {
  const view = { overview, members, cancellations, check, settings }[app.route] || overview;
  const el = h("main.page", { id: "page" });
  el.append(...[].concat(view(app)));
  requestAnimationFrame(() => { tickNow(); animate ? animateNumbers(el) : settleNumbers(el); });
  return el;
}

/** Final values with no animation, for re-renders while someone is typing. */
function settleNumbers(root) {
  root.querySelectorAll("[data-count]").forEach((el) => (el.textContent = (+el.dataset.count).toLocaleString("en-US")));
  root.querySelectorAll("[data-width]").forEach((el) => { el.style.transition = "none"; el.style.width = el.dataset.width; });
}

function head(title, sub, ...actions) {
  return h("header.page-head", h("div", h("h1", title), sub ? h("div.sub", sub) : null), actions.length ? h("div.actions", actions) : null);
}

// ---------------------------------------------------------------- overview

function overview(app) {
  const C = app.C, t = app.today;
  const s = C.rosterStats(app.members, t, app.issuer);
  const season = C.seasonFor(t);
  const renewals = C.renewalsDue(app.members, t, 30);
  const months = C.seasonMonths(app.activity, t);
  const diff = app.listDiff();
  const thisMonth = (months.find((m) => m.month === t.slice(0, 7)) || { issued: 0 }).issued;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const hero = h("section.hero",
    lakeSvg("lake", { stroke: true, draw: true }),
    h("div.hero-inner",
      h("div",
        h("div.eyebrow", `${greet} · ${usDate(t)}`),
        h("h1", `${app.issuer.name}, ${season.inSeason ? `the ${season.year} season is ${Math.round(season.progress * 100)}% done` : `the ${season.year} season opens in ${plural(season.daysUntilStart, "day")}`}.`),
        h("p", "Every card below is signed by your key and checked on the member's phone, anywhere on the lake, with or without signal."),
        h("div.hero-big", h("b", { "data-count": s.covered }, "0"), h("span", "members carrying a valid card", h("br"), `${plural(s.boats, "boat")} covered`))),
      seasonGauge(season, t)));

  const tiles = h("div.grid.g-4",
    statTile(app, "Signed this season", months.reduce((a, m) => a + m.issued, 0), "var(--good)",
      [h("b", thisMonth), " this month · ", h("b", s.byStatus.expiring), " expiring soon"], () => filterTo(app, "active")),
    statTile(app, "Need a card sent", s.needSending, "var(--info)",
      s.needSending ? [h("b", s.byStatus["not issued"]), " new, ", h("b", s.byStatus.changed), " edited since sent"] : "Everyone is up to date",
      () => filterTo(app, "needs")),
    statTile(app, "Renewals due", renewals.length, "var(--warn)",
      renewals.length ? ["Next: ", h("b", renewals[0].m.name), ` in ${plural(renewals[0].left, "day")}`] : "None in the next 30 days",
      () => filterTo(app, "expiring")),
    statTile(app, "Canceled", s.byStatus.canceled, "var(--bad)",
      diff.added.length || diff.removed.length ? [h("b", { style: { color: "var(--bad)" } }, "Not yet on phones"), " · publish the list"] : "Published list is up to date",
      () => app.go("cancellations")));

  const chart = h("section.panel",
    h("div.panel-head", h("h2", `Cards signed, ${season.year} season`), h("span.hint", `${months.reduce((a, m) => a + m.issued, 0)} this season`)),
    h("div.panel-body", seasonChart(months)));

  const mix = h("section.panel",
    h("div.panel-head", h("h2", "Plan mix"), h("span.hint", plural(s.total - s.byStatus.canceled, "member"))),
    h("div.panel-body", planMix(s.byTier),
      h("div.mini-stats",
        h("div", h("b.tabular", s.boats), h("span", "boats covered")),
        h("div", h("b.tabular", (s.boats / Math.max(1, s.total - s.byStatus.canceled)).toFixed(1)), h("span", "boats per member")),
        h("div", h("b.tabular", app.members.filter((m) => !m.canceled && (m.boats || []).length > 1).length), h("span", "multi-boat plans")))));

  const due = h("section.panel",
    h("div.panel-head", h("h2", "Renewals due"), h("span.hint", "next 30 days")),
    h("div.panel-body", renewals.length
      ? h("ul.list", renewals.slice(0, 6).map(({ m, left }) => h("li", { style: { cursor: "pointer" }, on: { click: () => openMember(app, m.id) } },
        h(`div.avatar.${m.tier}`, initials(m.name)),
        h("div.grow", h("div.title", m.name), h("div.meta", h("span.mono", m.num), ` · ${m.tier} · ends ${shortDate(m.expires)}`)),
        h(`span.days${left <= 7 ? ".urgent" : ""}`, left === 0 ? "today" : `${left}d`))))
      : emptyMini("anchor", "Nothing due", "No cards run out in the next 30 days.")));

  const feed = h("section.panel",
    h("div.panel-head", h("h2", "Recent activity"), h("span.hint", "everything is recorded")),
    h("div.panel-body", activityFeed(app, app.activity.slice(-8).reverse())));

  const promise = h("div.promise",
    promiseCard("signal", "Works with no signal", "The phone checks the signature itself. A card is as good in a cove as at the dock."),
    promiseCard("shield", "Can't be faked", "Change one letter and the check fails. A screenshot fails too: the card is live."),
    promiseCard("bolt", "Nothing per member", "No per-record monthly fees. Sign as many cards as you have members."));

  return [hero, tiles, h("div.grid.g-main", { style: { marginTop: "16px" } }, h("div.grid", chart, feed), h("div.grid", mix, due)), promise];
}

function filterTo(app, f) { app.ui.filter = f; app.ui.query = ""; app.go("members"); }

function statTile(app, label, value, color, foot, onClick) {
  return h("div.panel.stat.clickable", { tabindex: 0, role: "button", on: { click: onClick, keydown: (e) => { if (e.key === "Enter") onClick(); } } },
    h("div.label", h("span.dot", { style: { background: color } }), label),
    h("div.value", { "data-count": value }, "0"),
    h("div.foot", foot));
}

function seasonGauge(season, today) {
  const months = ["M", "A", "M", "J", "J", "A", "S", "O", "N"];
  const pct = season.progress * 100;
  return h("div.gauge",
    h("div.gauge-top", h("span", "Season ", h("b", `${shortDate(season.start)} – ${shortDate(season.end)}`)),
      h("span", season.inSeason ? h("b", `${season.daysLeft} days left`) : h("b", `opens in ${season.daysUntilStart} days`))),
    h("div.gauge-track",
      h("div.gauge-bar", h("div.gauge-fill", { style: { width: "0%" }, "data-width": pct.toFixed(1) + "%" })),
      season.inSeason ? h("div.gauge-now", { style: { left: pct + "%" }, "data-label": "TODAY" }) : null,
      h("div.gauge-ticks", months.map((m) => h("span", m)))));
}

function seasonChart(months) {
  const W = 640, H = 190, padL = 28, padB = 26, padT = 12;
  const max = Math.max(4, ...months.map((m) => m.issued));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const bw = (W - padL) / months.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cards signed per month this season">`;
  for (let i = 0; i <= 4; i++) {
    const v = step * i, yy = y(v);
    svg += `<line class="gridline" x1="${padL}" x2="${W}" y1="${yy}" y2="${yy}"/><text x="${padL - 8}" y="${yy + 4}" text-anchor="end">${v}</text>`;
  }
  months.forEach((m, i) => {
    const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
    const yy = y(m.issued), hgt = H - padB - yy;
    if (m.future) svg += `<rect x="${x}" y="${H - padB - 3}" width="${w}" height="3" rx="1.5" fill="var(--rule-strong)"/>`;
    else svg += `<rect class="bar" x="${x}" y="${yy}" width="${w}" height="${Math.max(hgt, 2)}" rx="4" fill="url(#barg)"><title>${m.label}: ${m.issued} signed${m.canceled ? `, ${m.canceled} canceled` : ""}</title></rect>`
      + (m.issued ? `<text x="${x + w / 2}" y="${yy - 6}" text-anchor="middle" style="fill:var(--ink-2)">${m.issued}</text>` : "");
    svg += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${m.label}</text>`;
  });
  svg += `<defs><linearGradient id="barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--channel)"/><stop offset="1" stop-color="var(--water)"/></linearGradient></defs></svg>`;
  return h("div", { html: svg });
}

function planMix(byTier) {
  const total = Object.values(byTier).reduce((a, b) => a + b, 0) || 1;
  const rows = [["GOLD", "One boat, unlimited towing", "linear-gradient(90deg,#E6C272,#B08227)"],
    ["ULTIMATE", "Up to four boats", "linear-gradient(90deg,#3B6585,#14263A)"],
    ["COMMERCIAL", "Business fleets", "linear-gradient(90deg,#5A626A,#2A2F34)"]];
  return h("div",
    h("div.mix", rows.map(([t, , bg]) => byTier[t] ? h("div", { style: { width: (byTier[t] / total * 100) + "%", background: bg }, title: `${t}: ${byTier[t]}` }) : null)),
    h("div.mix-legend", rows.map(([t, d]) => h("div.mix-row",
      h(`span.tier.tier-${t}`, t), h("span.muted", { style: { fontSize: "12.5px" } }, d),
      h("b.tabular", byTier[t]), h("span.pct", Math.round(byTier[t] / total * 100) + "%")))));
}

const FEED_ICON = { issued: "sign", renewed: "refresh", texted: "sms", emailed: "mail", copied: "link", sent: "send", canceled: "cancel",
  reinstated: "ok", edited: "pen", added: "user", deleted: "trash", published: "send", imported: "upload", settings: "settings", exported: "download" };
const FEED_VERB = { issued: "Card signed for", renewed: "Renewed", texted: "Texted card to", emailed: "Emailed card to",
  copied: "Copied card link for", canceled: "Canceled", reinstated: "Reinstated", edited: "Edited", added: "Added",
  deleted: "Deleted", published: "Published the cancellation list", imported: "Imported the roster", sent: "Sent card to",
  settings: "Changed settings", exported: "Exported the roster" };

function activityFeed(app, entries) {
  if (!entries.length) return emptyMini("clock", "No activity yet", "Issuing, sending and canceling cards shows up here.");
  return h("ul.feed", entries.map((a) => h("li",
    h(`span.ic.${a.type}`, icon(FEED_ICON[a.type] || "clock")),
    h("div",
      h("div.what", FEED_VERB[a.type] || a.type, a.name ? [" ", h("b", a.name)] : null),
      a.detail && !["published", "imported"].includes(a.type) ? h("div.detail", a.detail) : a.detail ? h("div.detail", a.detail) : null),
    h("span.when", ago(a.at), a.actor ? h("span.by", a.actor.split("@")[0]) : null))));
}

function promiseCard(ic, title, text) {
  return h("div.panel", h("div.ico", icon(ic)), h("div", h("h3", title), h("p", text)));
}

function emptyMini(ic, title, text) {
  return h("div.empty", { style: { padding: "22px 10px" } }, icon(ic), h("h3", title), h("div", text));
}

/** Count-up animation for big numbers, and the gauge fill. */
export function animateNumbers(root = document) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const target = +el.dataset.count;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0) { el.textContent = target.toLocaleString("en-US"); return; }
    const start = performance.now(), dur = 900;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  root.querySelectorAll("[data-width]").forEach((el) => requestAnimationFrame(() => (el.style.width = el.dataset.width)));
  // Animation frames pause in a hidden tab or frame; make sure every number
  // still lands on its real value.
  setTimeout(() => settleNumbers(root), 1500);
}

// ---------------------------------------------------------------- members

const FILTERS = [
  ["all", "All"], ["active", "Active"], ["needs", "Needs sending"], ["expiring", "Expiring"],
  ["expired", "Expired"], ["canceled", "Canceled"],
];
function matchesFilter(f, st) {
  if (f === "all") return true;
  if (f === "active") return st === "active" || st === "expiring";
  if (f === "needs") return st === "not issued" || st === "changed";
  return st === f;
}

function members(app) {
  const t = app.today;
  const q = app.ui.query.trim().toLowerCase();
  const withStatus = app.members.map((m) => ({ m, st: app.status(m) }));
  const counts = Object.fromEntries(FILTERS.map(([f]) => [f, withStatus.filter((x) => matchesFilter(f, x.st)).length]));
  const rows = withStatus
    .filter(({ m, st }) => matchesFilter(app.ui.filter, st) && (app.ui.tier === "all" || m.tier === app.ui.tier))
    .filter(({ m }) => !q || [m.num, m.name, m.phone, m.email, ...(m.boats || []).flatMap((b) => [b.name, b.reg])].some((v) => (v || "").toLowerCase().includes(q)))
    .sort((a, b) => a.m.name.localeCompare(b.m.name));

  const search = h("input.input", { type: "search", placeholder: "Search name, number, boat or registration", value: app.ui.query, "aria-label": "Search members",
    on: { input: (e) => { app.ui.query = e.target.value; const pos = e.target.selectionStart; app.refresh(); const n = document.querySelector(".search input"); n?.focus(); n?.setSelectionRange(pos, pos); } } });

  const pending = counts.needs;
  return [
    head("Members", `${plural(app.members.length, "member")} · ${plural(counts.active, "active card")}`,
      h("label.btn", { title: "Import a roster CSV" }, icon("upload"), "Import", h("input", { type: "file", accept: ".csv,text/csv", hidden: true, on: { change: (e) => importWizard(app, e) } })),
      h("button.btn", { on: { click: () => app.exportCsv() } }, icon("download"), "Export"),
      h("button.btn", { on: { click: () => renewModal(app, rows.map((r) => r.m)) } }, icon("refresh"), "Renew season"),
      h("button.btn.primary", { on: { click: () => memberEditor(app, null) } }, icon("plus"), "Add member")),
    pending ? h("div.panel", { style: { padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px", background: "var(--info-soft)", borderColor: "transparent" } },
      icon("send"), h("div", h("b", plural(pending, "member")), pending === 1 ? " needs a card sent." : " need a card sent."),
      h("button.btn.sm.primary", { style: { marginLeft: "auto" }, on: { click: () => app.issuePending() } }, icon("sign"), `Sign all ${pending}`)) : null,
    h("div.toolbar",
      h("div.search", icon("search"), search),
      h("div.chips", FILTERS.map(([f, label]) => h("button.chip", { "aria-pressed": app.ui.filter === f ? "true" : "false", on: { click: () => { app.ui.filter = f; app.refresh(); } } }, label, h("span.n", counts[f])))),
      h("select.input", { style: { width: "auto" }, "aria-label": "Plan", on: { change: (e) => { app.ui.tier = e.target.value; app.refresh(); } } },
        [["all", "All plans"], ["GOLD", "GOLD"], ["ULTIMATE", "ULTIMATE"], ["COMMERCIAL", "COMMERCIAL"]].map(([v, l]) => h("option", { value: v, selected: app.ui.tier === v }, l)))),
    h("div.panel.table-wrap",
      rows.length ? h("table.roster.members-list",
        h("thead", h("tr", ["Member", "Number", "Plan", "Boats", "Valid", "Status", ""].map((c) => h("th", c)))),
        h("tbody", rows.map(({ m, st }) => memberRow(app, m, st, t))))
        : h("div.empty", icon("members"), h("h3", app.members.length ? "No members match" : "No members yet"),
          h("div", app.members.length ? "Try a different search or filter." : "Add a member, or import the CSV your sign-up form exports."))),
    rows.length !== app.members.length ? h("p.muted", { style: { fontSize: "12.5px" } }, `Showing ${rows.length} of ${app.members.length}`) : null,
  ];
}

function memberRow(app, m, st, t) {
  const start = Date.parse(m.issued), end = Date.parse(m.expires), now = Date.parse(t);
  const frac = end > start ? Math.max(0, Math.min(1, (now - start) / (end - start))) : 0;
  const boats = m.boats || [];
  const open = () => openMember(app, m.id);
  return h("tr", { class: app.ui.openId === m.id ? "selected" : "", tabindex: 0, on: { click: open, keydown: (e) => { if (e.key === "Enter") open(); } } },
    h("td", h("div.who", h(`div.avatar.${m.tier}`, initials(m.name)), h("div", h("div.n", m.name), h("div.s", m.phone || m.email || "—")))),
    h("td.num", m.num),
    h("td", h(`span.tier.tier-${m.tier}`, m.tier)),
    h("td.boats-cell", boats.length ? [h("div.b1", boats[0].name || boats[0].reg), boats.length > 1 ? h("div.more", `+${boats.length - 1} more`) : h("div.more.mono", boats[0].reg || "")] : h("span.faint", "—")),
    h("td", h("div.valid", h("div.dates", `${shortDate(m.issued)} – ${usDate(m.expires)}`),
      h("div.track", h("i", { class: st === "expiring" ? "warn" : st === "expired" || st === "canceled" ? "bad" : "", style: { width: (frac * 100) + "%" } })))),
    h("td", h(`span.pill.${statusClass(st)}`, STATUS_LABEL[st])),
    h("td", h("div.row-actions",
      m.token && !m.canceled && st !== "expired" ? h("button.icon-btn", { title: "Send card", on: { click: (e) => { e.stopPropagation(); sendSheet(app, m); } } }, icon("send")) : null,
      !m.canceled && (st === "not issued" || st === "changed") ? h("button.icon-btn", { title: "Sign card", on: { click: async (e) => { e.stopPropagation(); if (await app.issue(m)) { app.persist(); app.refresh(); sendSheet(app, m, { justSigned: true }); } } } }, icon("sign")) : null,
      h("button.icon-btn", { title: "Edit", on: { click: (e) => { e.stopPropagation(); memberEditor(app, m); } } }, icon("pen")))));
}

// ---------------------------------------------------------------- member drawer

export function openMember(app, id, opts = {}) {
  const m = app.find(id);
  if (!m) return;
  app.ui.openId = id;
  if (app.route !== "members") { app.ui.filter = "all"; app.go("members"); setTimeout(() => openMember(app, id, opts), 60); return; }
  document.querySelectorAll(".roster tr.selected").forEach((r) => r.classList.remove("selected"));
  const st = app.status(m);
  const face = cardFace({ ...m, number: m.num, issuerName: app.issuer.name }, st);
  const phone = phoneWith(face, { issuerName: app.issuer.name, phone: app.issuer.phone });
  if (opts.justSigned) phone.querySelector(".phone-screen").append(sealStamp(sigShort(m.token)));
  const history = app.activity.filter((a) => a.num === m.num).slice(-12).reverse();

  const actions = [];
  if (!m.canceled && (st === "not issued" || st === "changed"))
    actions.push(h("button.btn.brass", { on: { click: async () => { if (await app.issue(m)) { app.persist(); app.refresh(); openMember(app, id, { justSigned: true }); } } } }, icon("sign"), st === "changed" ? "Re-sign card" : "Sign card"));
  if (m.token && !m.canceled && st !== "expired")
    actions.push(h("button.btn.primary", { on: { click: () => sendSheet(app, m) } }, icon("send"), "Send card"));
  if (m.token && !m.canceled && (st === "active" || st === "expiring" || st === "expired"))
    actions.push(h("button.btn", { on: { click: async () => { if (await app.issue(m)) { app.persist(); app.refresh(); openMember(app, id, { justSigned: true }); } } } }, icon("refresh"), "Re-sign"));
  actions.push(h("button.btn", { on: { click: () => memberEditor(app, m) } }, icon("pen"), "Edit"));

  const drawer = h("aside.drawer", { role: "dialog", "aria-modal": "true", "aria-label": m.name },
    h("div.drawer-head",
      h(`div.avatar.lg.${m.tier}`, initials(m.name)),
      h("div", h("h2", m.name), h("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" } },
        h(`span.tier.tier-${m.tier}`, m.tier), h(`span.pill.${statusClass(st)}`, STATUS_LABEL[st]), h("span.mono.muted", { style: { fontSize: "12.5px" } }, m.num))),
      h("button.icon-btn.close", { "aria-label": "Close", on: { click: () => { closeOverlay(); app.ui.openId = null; } } }, icon("x"))),
    h("div.drawer-body",
      h("div", h("div.section-label", "What their phone shows"), phone,
        h("p.muted", { style: { fontSize: "12.5px", textAlign: "center", margin: "10px 0 0" } },
          st === "not issued" ? "Preview. No card has been signed yet." : st === "changed" ? "Edited since it was signed. Their phone still shows the old details until you re-sign and send." : "Live: the clock ticks and the sheen moves, so a screenshot is obvious.")),
      h("div.drawer-actions", actions),
      h("div", h("div.section-label", "Details"), h("dl.kv",
        h("dt", "Phone"), h("dd", m.phone || h("span.faint", "—")),
        h("dt", "Email"), h("dd", m.email || h("span.faint", "—")),
        h("dt", "Valid"), h("dd", `${usDate(m.issued)} – ${usDate(m.expires)}`),
        h("dt", "Card signed"), h("dd", m.issuedAt ? ago(m.issuedAt) : h("span.faint", "not yet")),
        h("dt", "Last sent"), h("dd", m.sentAt ? ago(m.sentAt) : h("span.faint", "not sent")))),
      h("div", h("div.section-label", `Boats covered (${(m.boats || []).length})`),
        (m.boats || []).length ? h("div.boat-list", m.boats.map((b) => h("div.boat", icon("boat"), h("span", b.name || h("span.faint", "Unnamed")), h("span.reg", b.reg || "")))) : h("p.muted", "No boats listed.")),
      h("div", h("div.section-label", "History"), activityFeed(app, history)),
      h("div.danger-zone",
        m.token ? (m.canceled
          ? [h("p", "Canceled. Reinstating takes effect on phones after you publish the cancellation list."), h("button.btn", { on: { click: () => { app.reinstate(m); app.refresh(); openMember(app, id); } } }, icon("ok"), "Reinstate")]
          : [h("p", "Canceling stops this card working on their phone once the cancellation list is published."), h("button.btn.danger", { on: { click: async () => { if (await app.cancel(m)) { app.refresh(); openMember(app, id); } } } }, icon("cancel"), "Cancel card")])
          : [h("p", "No card has been issued, so removing this member changes nothing on any phone."), h("button.btn.danger", { on: { click: async () => { if (await app.remove(m)) { app.ui.openId = null; app.refresh(); } } } }, icon("trash"), "Delete")])));
  showOverlay(drawer, { onClose: () => { app.ui.openId = null; } });
  tickNow();
}

/** A text-message bubble with long card links shortened, the way phones show them. */
export function smsBubble(text) {
  return h("div.bubble", text.split(/(https?:\/\/\S+|lakecumberland:\/\/\S+)/).map((part, i) => i % 2
    ? h("a", { href: "#", on: { click: (e) => e.preventDefault() } }, part.length > 58 ? part.slice(0, 55) + "…" : part) : part));
}

function sigShort(token) {
  const sig = (token || "").split(".")[2] || "";
  return sig.slice(-8).toUpperCase();
}

// ---------------------------------------------------------------- send sheet

export function sendSheet(app, m, { justSigned = false } = {}) {
  const link = app.link(m);
  const msg = app.message(m);
  let qrBox;
  if (app.qr) {
    try {
      const code = app.qr.encodeQR(link, { ecc: "L" });
      const { viewBox, d } = app.qr.qrToSvgPath(code, { margin: 3 });
      qrBox = h("div.qr", { html: `<svg viewBox="${viewBox}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${m.name}'s card"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#0D1F24"/></svg>` });
    } catch { qrBox = null; }
  }
  const modal = h("div.modal", { role: "dialog", "aria-modal": "true" },
    h("div.modal-head", justSigned ? h("span.pill.s-active", "Signed") : null, h("h2", `Send ${m.name.split(" ")[0]}'s card`),
      h("button.icon-btn", { style: { marginLeft: "auto" }, "aria-label": "Close", on: { click: closeOverlay } }, icon("x"))),
    h("div.modal-body",
      h("div.send-grid",
        h("div", qrBox || h("div.qr", h("div.empty", { style: { padding: "30px 8px" } }, icon("qr"), h("div", "QR code unavailable"))),
          h("div.qr-cap", "At the desk? They scan this with their phone camera.")),
        h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h("div.section-label", { style: { margin: 0 } }, "The text they'll get"),
          h("div.sms", smsBubble(msg)),
          h("div.link-box", h("input.input", { value: link, readonly: true, "aria-label": "Card link", on: { focus: (e) => e.target.select() } }),
            h("button.btn", { on: { click: () => app.copyLink(m).then(() => app.refresh()) } }, icon("copy"), "Copy")))) ),
    h("div.modal-foot",
      h("span.left", m.sentAt ? `Last sent ${ago(m.sentAt)}` : "Not sent yet"),
      h("button.btn", { disabled: !m.email, title: m.email ? "" : "No email on file", on: { click: async () => { closeOverlay(); await app.emailMember(m); app.refresh(); } } }, icon("mail"), "Email"),
      h("button.btn.primary", { disabled: !m.phone, title: m.phone ? "" : "No phone on file", on: { click: async () => { closeOverlay(); await app.textMember(m); app.refresh(); } } }, icon("sms"), app.onPhone() ? "Text it" : "Copy text message")));
  showOverlay(modal);
  app.emit("send-opened", m);
}

// ---------------------------------------------------------------- member editor

const TIER_INFO = { GOLD: "One boat", ULTIMATE: "Up to 4 boats", COMMERCIAL: "Business fleets", CAPTAIN: "Staff: can check cards" };

export function memberEditor(app, existing) {
  const C = app.C;
  const x = existing || { tier: "GOLD", issued: app.today, expires: C.seasonFor(app.today).end, boats: [] };
  const f = {};
  const input = (name, attrs = {}) => (f[name] = h("input", { name, value: x[name] || "", ...attrs, on: { input: check } }));
  const boatsBox = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
  const addBoat = (b = {}) => {
    const row = h("div.boat-row",
      h("input.input", { placeholder: "Boat name", value: b.name || "", "aria-label": "Boat name", on: { input: check } }),
      h("input.input", { placeholder: "Registration (KY 1234 AB)", value: b.reg || "", "aria-label": "Registration", on: { input: check } }),
      h("button.icon-btn", { type: "button", "aria-label": "Remove boat", on: { click: () => { row.remove(); check(); } } }, icon("x")));
    boatsBox.append(row);
  };
  (x.boats?.length ? x.boats : [{}]).forEach(addBoat);
  const tierPick = h("div.tier-pick", C.TIERS.map((t) => h("label",
    h("input", { type: "radio", name: "tier", value: t, checked: x.tier === t, on: { change: check } }),
    h(`span.tier.tier-${t}`, { style: { alignSelf: "flex-start" } }, t), h("span.d", TIER_INFO[t]))));
  const errs = h("ul.msgs.err"), warns = h("ul.msgs.warn");
  const saveBtn = h("button.btn", { on: { click: () => save(false) } }, "Save");
  const signBtn = h("button.btn.primary", { on: { click: () => save(true) } }, icon("sign"), existing?.token ? "Save and re-sign" : "Save and sign card");

  // New members get the next free number, locked so two can't collide:
  // PREFIX-YEAR-0001 for members, PREFIX-YEAR-C001 for captains' staff cards.
  // "Change" unlocks it for the rare card that must match an existing number.
  const autoNum = !existing;
  let manualNum = false;
  const numFor = () => C.nextMemberNumber(app.members, {
    prefix: C.numberPrefix(app.issuer),
    year: String(f.issued?.value || app.today).slice(0, 4),
    captain: tierPick.querySelector("input:checked")?.value === "CAPTAIN",
  });
  const numHint = h("small", autoNum ? "Assigned automatically. Captain cards get a C number." : "Printed on their card; changing it means re-signing.");
  const numChange = autoNum ? h("button.btn.ghost.sm", { type: "button", style: { padding: "0 6px", marginLeft: "6px" }, on: { click: () => {
    manualNum = true; f.num.readOnly = false; f.num.focus(); numChange.remove();
    numHint.textContent = "Typed by hand: check it isn't already on someone else's card.";
  } } }, "Change") : null;

  function read() {
    return {
      num: f.num.value.trim(), name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(),
      issued: f.issued.value, expires: f.expires.value,
      tier: tierPick.querySelector("input:checked")?.value || "GOLD",
      boats: [...boatsBox.children].map((r) => ({ name: r.children[0].value.trim(), reg: r.children[1].value.trim() })).filter((b) => b.name || b.reg),
    };
  }
  function check() {
    if (autoNum && !manualNum && f.num && f.issued) f.num.value = numFor();
    const m = read();
    const { errors, warnings } = C.checkMember(m, app.today);
    const dup = app.members.find((o) => o !== existing && o.num.trim() === m.num && m.num);
    if (dup) errors.push(`member number ${m.num} already belongs to ${dup.name}`);
    clear(errs).append(...errors.map((e) => h("li", e)));
    clear(warns).append(...warnings.map((w) => h("li", w)));
    saveBtn.disabled = signBtn.disabled = errors.length > 0;
    return errors.length === 0;
  }
  async function save(andSign) {
    if (!check()) return;
    const m = app.saveMember(read(), existing);
    if (andSign && await app.issue(m)) { app.persist(); closeOverlay(); app.refresh(); openMember(app, m.id, { justSigned: true }); return; }
    closeOverlay(); app.refresh(); toast(existing ? "Saved" : `${m.name} added`);
  }

  const modal = h("div.modal", { role: "dialog", "aria-modal": "true" },
    h("div.modal-head", h("h2", existing ? `Edit ${existing.name}` : "Add a member"),
      h("button.icon-btn", { style: { marginLeft: "auto" }, "aria-label": "Close", on: { click: closeOverlay } }, icon("x"))),
    h("div.modal-body",
      h("div.form-grid",
        h("label.field", h("span", "Name"), input("name", { autofocus: true, placeholder: "Pat Example" })),
        h("label.field", h("span", "Member number", numChange), input("num", { placeholder: `MA-${C.seasonFor(app.today).year}-0001`, class: "mono", readOnly: autoNum }), numHint)),
      h("div.field", h("span", "Plan"), tierPick),
      h("div.form-grid",
        h("label.field", h("span", "Phone"), input("phone", { inputmode: "tel", placeholder: "606-555-0100" })),
        h("label.field", h("span", "Email"), input("email", { type: "email", placeholder: "pat@example.com" })),
        h("label.field", h("span", "Starts"), input("issued", { type: "date" })),
        h("label.field", h("span", "Valid through"), input("expires", { type: "date" }))),
      h("div.field", h("span", { style: { display: "flex", justifyContent: "space-between" } }, "Boats covered",
        h("button.btn.ghost.sm", { type: "button", on: { click: () => { if (boatsBox.children.length < C.MAX_BOATS) addBoat(); } } }, icon("plus"), "Add boat")), boatsBox),
      errs, warns),
    h("div.modal-foot", h("span.left", existing?.token ? "Changes reach their phone once you re-sign and send." : ""),
      h("button.btn.ghost", { on: { click: closeOverlay } }, "Cancel"), saveBtn, signBtn));
  showOverlay(modal);
  check();
}

// ---------------------------------------------------------------- import wizard

async function importWizard(app, e) {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  let parsed;
  try { parsed = app.C.membersFromCsv(await file.text()); } catch (err) { toast("Couldn't read that file: " + err.message, "alert"); return; }
  if (parsed.problems.length) { toast(parsed.problems.join("; "), "alert"); return; }
  const rows = parsed.members.map((row) => {
    const { errors, warnings } = app.C.checkMember(row, app.today);
    const existing = app.members.find((m) => m.num === row.num);
    return { row, errors, warnings, kind: errors.length ? "skip" : existing ? "update" : "new" };
  });
  const n = (k) => rows.filter((r) => r.kind === k).length;
  const modal = h("div.modal", { role: "dialog", "aria-modal": "true", style: { width: "min(900px, 96vw)" } },
    h("div.modal-head", h("h2", `Import ${file.name}`), h("button.icon-btn", { style: { marginLeft: "auto" }, "aria-label": "Close", on: { click: closeOverlay } }, icon("x"))),
    h("div.modal-body",
      h("div.chips",
        h("span.pill.s-active", `${n("new")} new`), h("span.pill.s-changed", `${n("update")} updates`),
        n("skip") ? h("span.pill.s-canceled", `${n("skip")} can't be imported`) : null),
      h("div.panel.table-wrap", { style: { maxHeight: "48vh", overflowY: "auto" } },
        h("table.roster", { style: { minWidth: "760px" } },
          h("thead", h("tr", ["", "Name", "Number", "Plan", "Boats", "Valid", "Notes"].map((c) => h("th", c)))),
          h("tbody", rows.map(({ row, errors, warnings, kind }) => h("tr", { style: { cursor: "default" } },
            h("td", h(`span.pill.${kind === "new" ? "s-active" : kind === "update" ? "s-changed" : "s-canceled"}`, kind === "new" ? "New" : kind === "update" ? "Update" : "Skip")),
            h("td", row.name || h("span.faint", "—")), h("td.num", row.num || "—"),
            h("td", app.C.TIERS.includes(row.tier) ? h(`span.tier.tier-${row.tier}`, row.tier) : h("span.faint", row.tier || "—")),
            h("td", (row.boats || []).length), h("td", `${usDate(row.issued)} – ${usDate(row.expires)}`),
            h("td", { style: { fontSize: "12.5px", color: errors.length ? "var(--bad)" : "var(--warn)" } }, (errors[0] || warnings[0] || "")))))))),
    h("div.modal-foot", h("span.left", "Existing members are matched by member number and updated."),
      h("button.btn.ghost", { on: { click: closeOverlay } }, "Cancel"),
      h("button.btn.primary", { disabled: !n("new") && !n("update"), on: { click: () => {
        const res = app.importRows(rows.filter((r) => r.kind !== "skip").map((r) => r.row));
        closeOverlay(); app.refresh(); toast(`Imported: ${res.added} new, ${res.updated} updated`, "upload");
      } } }, icon("upload"), `Import ${n("new") + n("update")}`)));
  showOverlay(modal);
}

// ---------------------------------------------------------------- renew season

function renewModal(app, shown) {
  const next = app.C.seasonFor(app.today);
  const year = next.inSeason ? next.year + 1 : next.year;
  const issued = h("input", { type: "date", value: `${year}-03-01` });
  const expires = h("input", { type: "date", value: `${year}-11-30` });
  const onlyShown = h("input", { type: "checkbox", checked: shown.length !== app.members.length, style: { width: "auto" } });
  const eligible = () => (onlyShown.checked ? shown : app.members).filter((m) => !m.canceled);
  const count = h("b", eligible().length);
  onlyShown.addEventListener("change", () => (count.textContent = eligible().length));
  const modal = h("div.modal", { role: "dialog", "aria-modal": "true", style: { width: "min(560px, 94vw)" } },
    h("div.modal-head", h("h2", "Renew for a new season")),
    h("div.modal-body",
      h("p", { style: { margin: 0, color: "var(--ink-2)" } }, "Sets new dates and signs a new card for each member. On their phone the new card replaces last season's. Canceled members are skipped."),
      h("div.form-grid", h("label.field", h("span", "Season starts"), issued), h("label.field", h("span", "Valid through"), expires)),
      shown.length !== app.members.length ? h("label", { style: { display: "flex", gap: "8px", alignItems: "center" } }, onlyShown, "Only the members in the current search and filter") : null,
      h("p.muted", { style: { margin: 0 } }, count, " members will get new cards.")),
    h("div.modal-foot", h("button.btn.ghost", { on: { click: closeOverlay } }, "Cancel"),
      h("button.btn.primary", { on: { click: async () => {
        if (!app.C.parseDate(issued.value) || !app.C.parseDate(expires.value) || expires.value < issued.value) { toast("Check the season dates", "alert"); return; }
        const ok = await app.renew({ issued: issued.value, expires: expires.value, onlyIds: eligible().map((m) => m.id) });
        closeOverlay(); app.refresh(); toast(`Renewed ${ok} members. Send the new cards from the list.`, "refresh");
      } } }, icon("refresh"), "Renew and sign")));
  showOverlay(modal);
}

// ---------------------------------------------------------------- cancellations

function cancellations(app) {
  const diff = app.listDiff();
  const stale = diff.added.length + diff.removed.length > 0;
  const canceled = app.members.filter((m) => m.canceled).sort((a, b) => (b.canceledAt || "").localeCompare(a.canceledAt || ""));
  return [
    head("Cancellations", "A canceled card stops working on the member's phone the next time it has signal, once the updated list is published."),
    h(`div.pub-status.${stale ? "stale" : "ok"}`,
      icon(stale ? "alert" : "ok"),
      h("div",
        h("h3", stale ? "Phones haven't heard about the latest changes" : "Phones are up to date"),
        h("p", stale ? "Publish the updated list so canceled cards stop working." : app.rev.publishedAt ? `Last published ${ago(app.rev.publishedAt)}.` : "Nothing canceled yet."),
        stale ? h("div.diff", { style: { marginTop: "8px" } },
          diff.added.map((n) => h("span.add", `+ ${n}`)), diff.removed.map((n) => h("span.rem", `− ${n} reinstated`))) : null),
      h(`button.btn${stale ? ".primary" : ""}`, { on: { click: () => publishModal(app) } }, icon("send"), stale ? "Publish now" : "Publish again")),
    h("div.panel.table-wrap", { style: { marginTop: "16px" } },
      canceled.length ? h("table.roster",
        h("thead", h("tr", ["Member", "Number", "Plan", "Canceled", "Would have expired", "On phones", ""].map((c) => h("th", c)))),
        h("tbody", canceled.map((m) => {
          const onList = (app.rev.numbers || []).includes(m.num);
          const expired = (app.C.parseDate(m.expires) || "") < app.today;
          return h("tr", { on: { click: () => openMember(app, m.id) } },
            h("td", h("div.who", h(`div.avatar.${m.tier}`, initials(m.name)), h("div.n", m.name))),
            h("td.num", m.num), h("td", h(`span.tier.tier-${m.tier}`, m.tier)),
            h("td", m.canceledAt ? ago(m.canceledAt) : "—"), h("td", usDate(m.expires)),
            h("td", expired ? h("span.pill.s-not-issued", "Expired anyway") : onList ? h("span.pill.s-canceled", "Canceled") : h("span.pill.s-expiring", "Not yet published")),
            h("td", h("div.row-actions", { style: { opacity: 1 } }, h("button.btn.sm", { on: { click: (e) => { e.stopPropagation(); app.reinstate(m); app.refresh(); } } }, "Reinstate"))));
        })))
        : h("div.empty", icon("cancel"), h("h3", "No canceled cards"), h("div", "Cancel a card from the member's page. It appears here until its season ends."))),
    h("div.flow", { style: { marginTop: "16px" } },
      flowStep("cancel", "1 · Cancel", "Mark the member canceled here. Nothing on their phone changes yet."),
      flowStep("send", "2 · Publish", "The console signs a new list of every canceled card with your key. Nobody else can make one."),
      flowStep("signal", "3 · Phones update", "The next time a member's phone has signal it fetches the list, checks your signature, and greys the card out."),
      flowStep("shield", "Can't be undone by anyone else", "An old list can't be replayed and a fake one is ignored: phones only accept a newer list signed by you.")),
  ];
}

function flowStep(ic, title, text) {
  return h("div.panel.flow-step", h("div.ico", icon(ic)), h("h3", title), h("p", text));
}

async function publishModal(app) {
  const token = await app.publish();
  if (!token) return;
  app.refresh();
  const count = plural((app.rev.numbers || []).length, "canceled card");
  // Hosted: the service already wrote the list where phones fetch it. The demo
  // shows the hosted experience, so it doesn't ask anyone to upload a file either.
  if (app.hosted || app.demo) {
    showOverlay(h("div.modal", { role: "dialog", "aria-modal": "true" },
      h("div.modal-head", h("span.pill.s-active", "Published"), h("h2", "Cancellation list published"),
        h("button.icon-btn", { style: { marginLeft: "auto" }, "aria-label": "Close", on: { click: closeOverlay } }, icon("x"))),
      h("div.modal-body",
        h("p", { style: { margin: 0, color: "var(--ink-2)" } }, `Signed with your key and published: ${count}. Each list replaces the last, so it always contains every canceled card that hasn't expired.`),
        h("ul", { style: { margin: 0, paddingLeft: "20px", color: "var(--ink-2)", fontSize: "13.5px" } },
          h("li", "Nothing to upload. The console put the new list online for you."),
          h("li", "Members' phones pick it up within a few hours of having signal, and those cards turn grey."),
          app.demo ? h("li", { class: "muted" }, "In this demo, publishing is simulated and nothing leaves your browser.") : null)),
      h("div.modal-foot", h("button.btn.primary", { on: { click: closeOverlay } }, "Done"))));
    return;
  }
  const fileName = (app.issuer.revocationUrl || "").split("/").pop() || "revoked.txt";
  const modal = h("div.modal", { role: "dialog", "aria-modal": "true" },
    h("div.modal-head", h("span.pill.s-active", "Signed"), h("h2", "Cancellation list ready"),
      h("button.icon-btn", { style: { marginLeft: "auto" }, "aria-label": "Close", on: { click: closeOverlay } }, icon("x"))),
    h("div.modal-body",
      h("p", { style: { margin: 0, color: "var(--ink-2)" } }, `Signed with your key: ${count}. Each list replaces the last, so it always contains every canceled card that hasn't expired.`),
      h("pre.json", { style: { maxHeight: "140px", whiteSpace: "pre-wrap", wordBreak: "break-all" } }, token),
      h("ol", { style: { margin: 0, paddingLeft: "20px", color: "var(--ink-2)", fontSize: "13.5px" } },
        h("li", "Upload this file, replacing the old one, at ", h("span.mono", app.issuer.revocationUrl || "(set the address in Settings)"), "."),
        h("li", "Phones pick it up within a few hours of having signal."))),
    h("div.modal-foot",
      h("button.btn", { on: { click: () => copyText(token, "List copied") } }, icon("copy"), "Copy"),
      h("button.btn.primary", { on: { click: () => { const a = h("a", { href: URL.createObjectURL(new Blob([token], { type: "text/plain" })), download: fileName }); document.body.append(a); a.click(); a.remove(); } } }, icon("download"), `Download ${fileName}`)));
  showOverlay(modal);
}

// ---------------------------------------------------------------- check a card

function check(app) {
  const out = h("div");
  const ta = h("textarea", { placeholder: "Paste a card, a card link, or the whole text message it came in", "aria-label": "Card to check" });
  const drop = h("div.drop", ta,
    h("div", { style: { display: "flex", gap: "8px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" } },
      h("button.btn.primary.check-run", { on: { click: () => run(ta.value) } }, icon("check"), "Check card"),
      app.members.some((m) => m.token && !m.canceled) ? h("button.btn.ghost", { on: { click: () => { const m = app.members.find((x) => x.token && !x.canceled); ta.value = app.message(m); run(ta.value); } } }, "Try one from the roster") : null,
      h("span.muted", { style: { marginLeft: "auto", fontSize: "12.5px" } }, "Checked right here, with the same code a member's phone uses.")));
  ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); const t = e.dataTransfer.getData("text"); if (t) { ta.value = t; run(t); } });

  async function run(text, { tampered = false } = {}) {
    clear(out);
    const token = app.extractToken(text);
    if (!token) { out.append(h("div.verdict.no", { style: { marginTop: "16px" } }, icon("alert"), h("div", h("h3", "No card in that text"), h("p", "Paste the link or message the member received.")))); return; }
    const r = await app.verifyCard(token, app.verifier, { revoked: app.rev.numbers || [] });
    const inRoster = r.card && app.members.find((m) => m.num === r.card.number);
    const newer = inRoster && inRoster.token && inRoster.token !== token && !tampered;
    let v;
    if (!r.card) v = h("div.verdict.no", icon("alert"), h("div", h("h3", tampered ? "Tampered: the check fails" : "Not a genuine card"), h("p", tampered ? "One letter of the card was changed, and the signature no longer matches. An edited or forged card can't pass." : app.PROBLEMS[r.problem])));
    if (!r.card && tampered && tampered.original) {
      out.append(h("div", { style: { marginTop: "16px" } }, v), h("div.check-grid",
        phoneWith(h("div.mcard.lapsed.refused", h("div.refused-ic", icon("alert")), h("div.nm", "Card can't be trusted"),
          h("div", { style: { fontSize: "12px", opacity: ".9" } }, "This card failed its security check. It may have been altered.")), { issuerName: app.issuer.name, phone: null }),
        h("section.panel", h("div.panel-head", h("h2", "What was changed")), h("div.panel-body", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h("dl.sig", h("dt", "Name signed by the key"), h("dd", h("b", tampered.from)), h("dt", "Name on the altered card"), h("dd", h("b", { style: { color: "var(--bad)" } }, tampered.to))),
          h("p.muted", { style: { margin: 0, fontSize: "13px" } }, "The signature is a mathematical fingerprint of the exact card contents. Changing a single letter, a date, or a boat produces contents the signature doesn't match, and only the holder of the private key could produce a new one."),
          h("div", h("button.btn", { on: { click: () => run(tampered.original) } }, icon("refresh"), "Check the original again"))))));
      return;
    }
    else if (r.problem) v = h("div.verdict.lapsed", icon("clock"), h("div", h("h3", "Genuine, but not valid today"), h("p", app.PROBLEMS[r.problem])));
    else v = h("div.verdict.ok", icon("ok"), h("div", h("h3", "Genuine and current"), h("p", `Signed by ${app.issuer.name}'s key. This is exactly what the member's phone shows.`)));
    out.append(h("div", { style: { marginTop: "16px" } }, v));
    if (!r.card) return;
    if (!tampered) app.emit("checked");
    const payloadJson = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
    const st = r.problem === "EXPIRED" ? "expired" : r.problem === "REVOKED" ? "canceled" : r.problem === "NOT_YET_VALID" ? "not started"
      : (Date.parse(r.card.expires) - Date.parse(app.today)) / 86400000 <= 30 ? "expiring" : "active";
    const face = cardFace({ ...r.card, number: r.card.number, issuerName: r.card.issuerName }, st);
    out.append(h("div.check-grid",
      phoneWith(face, { issuerName: r.card.issuerName, phone: r.card.phone }),
      h("div.grid",
        h("section.panel", h("div.panel-head", h("h2", "Signature")), h("div.panel-body", h("dl.sig",
          h("dt", "Algorithm"), h("dd", "ECDSA P-256 with SHA-256"),
          h("dt", "Issuer"), h("dd", `${r.card.issuerName} (`, h("span.mono", payloadJson.iss), ")"),
          h("dt", "Key"), h("dd.mono", payloadJson.kid),
          h("dt", "Signature"), h("dd.mono", { style: { fontSize: "12px" } }, token.split(".")[2].slice(0, 48) + "…"),
          h("dt", "In your roster"), h("dd", inRoster ? h("a", { href: "#", on: { click: (e) => { e.preventDefault(); openMember(app, inRoster.id); } } }, inRoster.name) : h("span.faint", "not found")),
          newer ? [h("dt", "Newer card"), h("dd", { style: { color: "var(--warn)" } }, "A newer card has been issued to this member.")] : null))),
        h("section.panel", h("div.panel-head", h("h2", "What was signed"), h("span.hint", "exact bytes the signature covers")),
          h("div.panel-body", h("pre.json", { html: prettyJson(payloadJson) }))),
        h("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
          h("button.btn.danger.tamper-btn", { on: { click: () => { const t = tamper(token); run(t.token, { tampered: { ...t, original: token } }); app.emit("tampered"); } } }, icon("flask"), "Try tampering with it"),
          h("span.tamper-note", "Changes one letter of the name, then checks again.")))));
    tickNow();
  }
  if (app.ui.checkPrefill) { ta.value = app.ui.checkPrefill; app.ui.checkPrefill = null; setTimeout(() => run(ta.value), 0); }
  return [head("Check a card", "See exactly what a member's phone will show, and prove a card is genuine."), drop, out];
}

function tamper(token) {
  const [p, payload, sig] = token.split(".");
  const bytes = Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  const from = JSON.parse(json).name;
  const to = (from[0] === "X" ? "Y" : "X") + from.slice(1);
  const changed = json.replace(`"name":${JSON.stringify(from)}`, `"name":${JSON.stringify(to)}`);
  const b = new TextEncoder().encode(changed);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  const enc = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { token: `${p}.${enc}.${sig}`, from, to };
}

function prettyJson(obj) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return esc(JSON.stringify(obj, null, 2))
    .replace(/^(\s*)"([^"]+)":/gm, '$1<span class="k">"$2"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="s">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="n">$1</span>');
}

// ---------------------------------------------------------------- settings

function settings(app) {
  const iss = app.issuer;
  const web = h("input", { value: iss.webBase || "", placeholder: "https://valleyside…/card/" });
  const revUrl = h("input", { value: iss.revocationUrl || "", placeholder: "https://valleyside…/card/revoked.txt" });
  const msg = h("textarea", { style: { minHeight: "90px" } }, iss.message || app.DEFAULT_MSG);
  const locked = !!app.hosted && app.hosted.role !== "admin";
  if (locked) for (const el of [web, revUrl, msg]) el.disabled = true;
  const preview = h("div.sms");
  const sample = app.members.find((m) => m.token) || { name: "Pat Example", expires: app.today, token: "LC1.sample.sig" };
  const upd = () => { const saved = iss.message; iss.message = msg.value; clear(preview).append(smsBubble(app.message(sample))); iss.message = saved; };
  msg.addEventListener("input", upd); upd();
  const fpBox = h("div.fp", h("div.fp-art"), h("div", h("div.section-label", { style: { margin: 0 } }, "Key fingerprint"), h("div.fp-hex", "…"), h("div.muted", { style: { fontSize: "12.5px" } }, "Read this to the app developer to confirm the key.")));
  app.C.keyFingerprint(iss.publicSpki).then(({ hex, bytes }) => {
    fpBox.querySelector(".fp-hex").textContent = hex;
    fpBox.querySelector(".fp-art").innerHTML = fingerprintArt(bytes);
  });
  const last = app.lastBackup();
  return [
    head("Settings & key", "How cards are sent, and the key that signs them."),
    h("div.settings-grid",
      h("section.panel", h("div.panel-head", h("h2", "Links and messages")),
        h("div.panel-body", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          h("label.field", h("span", "Web card address"), web, h("small", "Where member links point. Works on iPhone and Android.")),
          h("label.field", h("span", "Cancellation list address"), revUrl),
          h("label.field", h("span", "Text message"), msg, h("small", "{name}, {link} and {expires} are filled in for each member.")),
          h("div.section-label", { style: { margin: 0 } }, "Preview"), preview,
          h("div", h("button.btn.primary", { disabled: locked, on: { click: () => {
            const secure = (v) => /^https:\/\//.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(v);
            if (web.value && !secure(web.value)) { toast("The web card address must start with https://", "alert"); return; }
            if (revUrl.value && !secure(revUrl.value)) { toast("The list address must start with https://", "alert"); return; }
            Object.assign(iss, { webBase: web.value.trim(), revocationUrl: revUrl.value.trim(), message: msg.value.trim() });
            app.saveIssuer(); toast("Saved");
          } } }, "Save"),
            app.hosted && app.hosted.role !== "admin" ? h("span.muted", { style: { marginLeft: "12px", fontSize: "12.5px" } }, "Only an admin can change these.") : null))),
      h("div.grid",
        h("section.panel", h("div.panel-head", h("h2", "Signing key"), h("span.hint", h("span.mono", iss.kid))),
          h("div.panel-body", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
            fpBox,
            h("div", h("div.section-label", "Public key"), h("div.keybox", iss.publicSpki),
              h("div", { style: { marginTop: "8px" } }, h("button.btn.sm", { on: { click: () => copyText(iss.publicSpki, "Public key copied") } }, icon("copy"), "Copy public key"))),
            h("p.muted", { style: { margin: 0, fontSize: "13px" } }, app.demo ? "Demo key, made fresh for this visit and never saved."
              : app.hosted ? "The public key is safe to share: it can only check cards, never make them. The private half was created inside AWS KMS and can't be copied out by anyone, Valleyside included. The service asks KMS for each signature, and every request is logged."
              : "The public key is safe to share: it can only check cards, never make them. The private half stays locked in this browser under your passphrase."))),
        app.hosted ? h("section.panel", h("div.panel-head", h("h2", "Your data"), h("span.hint", "on the server")),
          h("div.panel-body", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
            h("p.muted", { style: { margin: 0, fontSize: "13px" } }, "The roster is kept on the server, encrypted, with continuous backups you can roll back to any point in the last 35 days. Nothing is stored in this browser. Every change is in the activity log with the name of whoever made it."),
            h("div", h("button.btn", { on: { click: () => app.exportCsv() } }, icon("download"), "Export the roster")),
            h("p.muted", { style: { margin: 0, fontSize: "12.5px" } }, "Exporting needs the admin role and is recorded in the activity log.")))
        : app.demo ? h("section.panel", h("div.panel-head", h("h2", "Demo")), h("div.panel-body",
          h("p.muted", { style: { marginTop: 0 } }, "The sample roster is rebuilt every time the page loads."),
          h("button.btn", { on: { click: () => app.resetDemo() } }, icon("refresh"), "Reset demo")))
          : h("section.panel", h("div.panel-head", h("h2", "Backups"), h("span.hint", last ? `roster backed up ${ago(new Date(last).toISOString())}` : "roster never backed up")),
            h("div.panel-body", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
              h("p.muted", { style: { margin: 0, fontSize: "13px" } }, "Everything lives in this browser until the hosted console is set up. Keep both backups off this computer."),
              h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
                h("button.btn", { on: { click: () => app.keyBackup() } }, icon("key"), "Key backup"),
                h("button.btn", { on: { click: () => { app.rosterBackup(); app.refresh(); } } }, icon("download"), "Roster backup"),
                h("label.btn", icon("upload"), "Restore roster", h("input", { type: "file", accept: ".json", hidden: true, on: { change: async (e) => {
                  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
                  try { await app.restoreRoster(file); toast("Roster restored"); app.go("members"); } catch (err) { toast("Couldn't restore: " + err.message, "alert"); }
                } } }))))),
        h("section.panel.danger-panel", h("div.panel-head", h("h2", "If the key is ever stolen")),
          h("div.panel-body", h("p.muted", { style: { margin: 0, fontSize: "13px" } }, "Tell the app developer right away. They ship an update that stops trusting this key; you create a new one with a new key name and reissue every card. Canceling cards can't help, because a stolen key can sign its own lists."))))),
  ];
}

/** A symmetric, deterministic pattern from the key's hash: easy to compare by eye. */
function fingerprintArt(bytes) {
  const hue = (bytes[0] * 360) / 256, hue2 = (hue + 40 + bytes[1] % 80) % 360;
  let cells = "";
  for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) {
    const b = bytes[2 + y * 3 + x];
    if (b % 3 === 0) continue;
    const col = b % 2 ? `hsl(${hue} 55% 42%)` : `hsl(${hue2} 60% 58%)`;
    cells += `<rect x="${x * 14}" y="${y * 14}" width="14" height="14" fill="${col}"/><rect x="${(5 - x) * 14}" y="${y * 14}" width="14" height="14" fill="${col}"/>`;
  }
  return `<svg viewBox="0 0 84 84"><rect width="84" height="84" fill="hsl(${hue} 30% 94%)"/>${cells}</svg>`;
}

// ---------------------------------------------------------------- setup + unlock

export function setupScreen(app) {
  const f = {
    iss: h("input", { placeholder: "your-org", autocomplete: "off" }), kid: h("input", { placeholder: "key-2027", autocomplete: "off" }),
    name: h("input", { placeholder: "Your organization" }), phone: h("input", { placeholder: "800-555-0134", inputmode: "tel" }),
    pass: h("input", { type: "password", autocomplete: "new-password" }), pass2: h("input", { type: "password", autocomplete: "new-password" }),
  };
  const err = h("div.err-text");
  const fields = () => {
    const v = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, k.startsWith("pass") ? el.value : el.value.trim()]));
    const e = [];
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(v.iss)) e.push("Organization ID: lowercase letters, numbers and dashes.");
    if (!/^[a-z0-9][a-z0-9._-]{0,40}$/i.test(v.kid)) e.push("Key name: letters, numbers and dashes.");
    if (!v.name) e.push("Add the name that goes on the cards.");
    if (v.pass.length < 12) e.push("The passphrase needs at least 12 characters.");
    if (v.pass !== v.pass2) e.push("The two passphrases don't match.");
    err.textContent = e[0] || "";
    return e.length ? null : v;
  };
  const withFile = (accept, label, ic, fn) => h("label.btn", { style: { justifyContent: "center" } }, icon(ic), label,
    h("input", { type: "file", accept, hidden: true, on: { change: async (e) => { const file = e.target.files[0]; e.target.value = ""; if (file) await fn(file); } } }));
  return h("div.gate",
    h("div.gate-art", lakeSvg("lake", { stroke: true }),
      h("div", { style: { position: "relative", display: "flex", gap: "12px", alignItems: "center" } }, brandMark(), h("b", { style: { font: "700 18px var(--display)" } }, "Card Console")),
      h("div", h("h2", "Membership cards that work where the signal doesn't."),
        h("p", "Sign your members' cards with a key only you hold. The phone checks them itself, anywhere on the lake."))),
    h("div.gate-form", h("div.gate-card",
      h("h1", "Set up card signing"),
      h("p.muted", { style: { margin: 0 } }, "Your signing key is created in this browser and locked with a passphrase you choose. Nobody else, including whoever hosts this page, can issue cards in your name."),
      h("div.form-grid",
        h("label.field", h("span", "Organization ID"), f.iss), h("label.field", h("span", "Key name"), f.kid),
        h("label.field", h("span", "Name on the cards"), f.name), h("label.field", h("span", "Phone on the cards"), f.phone)),
      h("div.form-grid",
        h("label.field", h("span", "Passphrase"), f.pass, h("small", "12+ characters. It can't be recovered.")),
        h("label.field", h("span", "Passphrase again"), f.pass2)),
      err,
      h("button.btn.primary", { style: { justifyContent: "center", padding: "11px" }, on: { click: async () => { const v = fields(); if (v) await app.createKey(v); } } }, icon("key"), "Create my signing key"),
      h("div.divider", "or"),
      withFile(".pk8", "Import from the issuer tool (.pk8)", "key", async (file) => { const v = fields(); if (!v) return;
        try { const pkcs8 = new Uint8Array(await file.arrayBuffer()); await app.createKey(v, pkcs8, await app.C.publicFromPrivate(pkcs8)); } catch { err.textContent = "That file isn't a signing key from the issuer tool."; } }),
      withFile(".json", "Restore a key backup", "upload", async (file) => { try { await app.restoreKeyBackup(file, f.pass.value); } catch { err.textContent = "Couldn't open that backup. Type its passphrase in the Passphrase box first."; } }),
      h("p.muted", { style: { fontSize: "12.5px", margin: 0 } }, "Just looking? ", h("a", { href: "?demo" }, "Open the demo"), " with a sample roster."))));
}

export function unlockScreen(app) {
  const pass = h("input", { type: "password", autocomplete: "current-password" });
  const err = h("div.err-text");
  const go = async () => {
    try { await app.unlock(pass.value); app.render(); } catch { err.textContent = "That passphrase doesn't open this key."; pass.select(); }
  };
  pass.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  setTimeout(() => pass.focus(), 50);
  return h("div.gate",
    h("div.gate-art", lakeSvg("lake", { stroke: true }),
      h("div", { style: { position: "relative", display: "flex", gap: "12px", alignItems: "center" } }, brandMark(), h("b", { style: { font: "700 18px var(--display)" } }, "Card Console")),
      h("div", h("h2", app.issuer.name), h("p", `Signing key ${app.issuer.kid}`))),
    h("div.gate-form", h("div.gate-card",
      h("h1", "Unlock"),
      h("label.field", h("span", "Passphrase"), pass), err,
      h("button.btn.primary", { style: { justifyContent: "center", padding: "11px" }, on: { click: go } }, icon("unlock"), "Unlock"),
      h("button.btn.ghost", { style: { justifyContent: "center" }, on: { click: () => { app.viewOnly = true; app.render(); } } }, "View the roster without unlocking"))));
}

// ---------------------------------------------------------------- quick find

export function installPalette(app) {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(app); }
    else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && app.route === "members") {
      e.preventDefault(); document.querySelector(".search input")?.focus();
    }
  });
}

function openPalette(app) {
  if (!app.issuer || (!app.signingKey && !app.viewOnly)) return;
  const input = h("input", { placeholder: "Find a member or jump to an action…", "aria-label": "Quick find" });
  const list = h("ul", { role: "listbox" });
  const actions = [
    ["Add a member", "plus", () => memberEditor(app, null)],
    ["Sign all pending cards", "sign", () => app.issuePending()],
    ["Publish cancellation list", "send", () => { app.go("cancellations"); setTimeout(() => publishModal(app), 80); }],
    ["Check a card", "check", () => app.go("check")],
    ["Go to overview", "overview", () => app.go("overview")],
    ["Go to members", "members", () => app.go("members")],
    ["Settings & key", "settings", () => app.go("settings")],
    ["Toggle dark mode", "moon", () => app.toggleTheme()],
  ];
  let items = [], sel = 0;
  const pick = (i) => { const it = items[i]; if (!it) return; closeOverlay(); it.run(); };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const mem = app.members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.num.toLowerCase().includes(q)
      || (m.boats || []).some((b) => (b.reg || "").toLowerCase().includes(q) || (b.name || "").toLowerCase().includes(q))).slice(0, 7)
      .map((m) => {
        const boat = q && !m.name.toLowerCase().includes(q) && !m.num.toLowerCase().includes(q)
          ? (m.boats || []).find((b) => (b.reg || "").toLowerCase().includes(q) || (b.name || "").toLowerCase().includes(q)) : null;
        return { label: m.name, desc: boat ? `${[boat.name, boat.reg].filter(Boolean).join(" · ")} · ${m.num}` : `${m.num} · ${STATUS_LABEL[app.status(m)]}`,
          ic: boat ? "boat" : "user", run: () => openMember(app, m.id) };
      });
    const act = actions.filter(([l]) => !q || l.toLowerCase().includes(q)).map(([l, ic, run]) => ({ label: l, desc: "Action", ic, run }));
    items = q ? [...mem, ...act] : [...act.slice(0, 4), ...mem.slice(0, 5)];
    sel = Math.min(sel, Math.max(0, items.length - 1));
    clear(list).append(...items.map((it, i) => h("li", { role: "option", "aria-selected": i === sel ? "true" : "false", on: { click: () => pick(i), mousemove: () => { if (sel !== i) { sel = i; draw(); } } } },
      icon(it.ic), h("span.t", it.label), h("span.d", it.desc))));
  };
  input.addEventListener("input", () => { sel = 0; draw(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === "Enter") { e.preventDefault(); pick(sel); }
  });
  draw();
  showOverlay(h("div.palette", { role: "dialog", "aria-label": "Quick find" }, input, list));
}
