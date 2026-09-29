/*
 * Small UI toolkit for the console: an element builder, icons, formatting,
 * toasts and overlays. No framework: the whole console is a few hundred
 * members at most, so re-rendering a view is instant and keeps the code plain.
 */

/** h("div.cls#id", {attrs, on: {click}}, ...children) */
export function h(tag, attrs, ...kids) {
  if (attrs == null || typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs)) {
    if (attrs != null) kids.unshift(attrs);
    attrs = {};
  }
  const [name, ...parts] = tag.split(/(?=[.#])/);
  const el = name === "svg" || attrs.svg ? document.createElementNS("http://www.w3.org/2000/svg", name) : document.createElement(name || "div");
  for (const p of parts) {
    if (p[0] === ".") el.classList.add(p.slice(1));
    else if (p[0] === "#") el.id = p.slice(1);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false || k === "svg") continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "class") el.className += (el.className ? " " : "") + v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && !(el instanceof SVGElement) && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

// ---------------------------------------------------------------- icons

const P = {
  overview: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  members: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  cancel: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  check: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  sign: '<path d="M20 7L9 18l-5-5"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4z"/>',
  boat: '<path d="M2 20c2 1 4 1 6 0s4-1 6 0 4 1 6 0"/><path d="M4 17l-1-5h18l-2 5"/><path d="M12 3v9M12 3l6 7h-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M19 4l2 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6z"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  wave: '<path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  flask: '<path d="M9 3h6M10 3v6L4 20a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 20L14 9V3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  anchor: '<circle cx="12" cy="5" r="3"/><path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/>',
};

export function icon(name, cls = "") {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  // A default size, so an icon placed anywhere without a CSS rule can never
  // stretch to fill its container. Stylesheet sizes still win.
  s.setAttribute("width", "18");
  s.setAttribute("height", "18");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  if (cls) s.setAttribute("class", cls);
  s.innerHTML = P[name] || "";
  return s;
}

// ---------------------------------------------------------------- formatting

export const usDate = (iso) => iso
  ? new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
  : "—";
export const shortDate = (iso) => iso
  ? new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  : "—";
export function ago(isoStamp, now = Date.now()) {
  if (!isoStamp) return "never";
  const s = Math.round((now - Date.parse(isoStamp)) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr} hr ago`;
  const d = Math.round(hr / 24); if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return usDate(isoStamp);
}
export const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
export const plural = (n, word, pl = word + "s") => `${n.toLocaleString("en-US")} ${n === 1 ? word : pl}`;
export const statusClass = (s) => "s-" + s.replace(/ /g, "-");
export const STATUS_LABEL = {
  active: "Active", expiring: "Expiring", changed: "Needs resend", "not issued": "Not issued",
  "not started": "Not started", expired: "Expired", canceled: "Canceled",
};

// ---------------------------------------------------------------- toasts

export function toast(message, iconName = "ok") {
  let box = document.querySelector(".toasts");
  if (!box) box = document.body.appendChild(h("div.toasts", { role: "status", "aria-live": "polite" }));
  const t = h("div.toast", icon(iconName), h("span", message));
  box.append(t);
  setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 320); }, 3400);
}

// ---------------------------------------------------------------- overlays

let openOverlay = null;
export function closeOverlay() {
  if (!openOverlay) return;
  openOverlay.forEach((el) => el.remove());
  const prev = openOverlay.returnFocus;
  openOverlay = null;
  prev?.focus?.();
}
/** Shows a drawer or modal element with a scrim; Escape or the scrim closes it. */
export function showOverlay(panel, { onClose } = {}) {
  closeOverlay();
  const scrim = h("div.scrim", { on: { click: () => { closeOverlay(); onClose?.(); } } });
  document.body.append(scrim, panel);
  openOverlay = [scrim, panel];
  openOverlay.returnFocus = document.activeElement;
  const first = panel.querySelector("[autofocus], input, button, select, textarea");
  setTimeout(() => first?.focus(), 30);
  return panel;
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openOverlay) closeOverlay(); });

/** In-page confirmation (no window.confirm): resolves true or false. */
export function confirmBox({ title, body, confirm = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const done = (v) => { closeOverlay(); resolve(v); };
    const m = h("div.modal", { role: "dialog", "aria-modal": "true", style: { width: "min(460px, 94vw)" } },
      h("div.modal-head", h("h2", title)),
      h("div.modal-body", typeof body === "string" ? h("p", { style: { margin: 0, color: "var(--ink-2)" } }, body) : body),
      h("div.modal-foot",
        h("button.btn", { on: { click: () => done(false) } }, "Keep as is"),
        h(`button.btn.${danger ? "danger" : "primary"}`, { autofocus: true, on: { click: () => done(true) } }, confirm)));
    showOverlay(m, { onClose: () => resolve(false) });
  });
}

export async function copyText(text, what = "Copied") {
  try { await navigator.clipboard.writeText(text); toast(what); return true; }
  catch {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } }, text);
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    if (ok) { toast(what); return true; }
    // Some browsers and embedded pages block the clipboard. Show the text,
    // already selected, so one Ctrl+C (or a long-press on a phone) copies it.
    const box = h("textarea", { readonly: true, "aria-label": "Text to copy", style: { width: "100%", minHeight: "120px", font: "14px/1.45 var(--body)", padding: "10px", borderRadius: "10px", border: "1px solid var(--rule)", background: "var(--sunk)", color: "var(--ink)", resize: "vertical" } }, text);
    const m = h("div.modal", { role: "dialog", "aria-modal": "true", style: { width: "min(520px, 94vw)" } },
      h("div.modal-head", h("h2", "Copy this")),
      h("div.modal-body", h("p", { style: { margin: "0 0 10px", color: "var(--ink-2)" } }, "This browser won't let the page copy for you. The text is selected: press Ctrl+C (or long-press on a phone)."), box),
      h("div.modal-foot", h("button.btn.primary", { on: { click: closeOverlay } }, "Done")));
    showOverlay(m);
    setTimeout(() => { box.focus(); box.select(); }, 60);
    return false;
  }
}

export function download(name, text, type = "text/plain") {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
