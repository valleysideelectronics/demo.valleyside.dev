/*
 * The membership card exactly as a member sees it: the same face the Android
 * app and the web card draw, including the live clock and sweeping sheen that
 * make a screenshot obvious. Used in the member drawer and on "Check a card",
 * so staff always see what the member's phone will show.
 */
import { h, usDate } from "./ui.js";

const LAPSED = { expired: "EXPIRED", canceled: "CANCELED", "not started": "NOT ACTIVE YET" };

/**
 * @param c {name, number, tier, boats, expires, issuerName}
 * @param status one of the roster statuses; "active"/"expiring"/"changed" read as live
 */
export function cardFace(c, status) {
  const live = ["active", "expiring", "changed", "not issued"].includes(status);
  // An unsigned card is only a preview; it must never read ACTIVE.
  const pill = status === "not issued" ? ["PREVIEW", "idle"] : status === "expiring" ? ["EXPIRING SOON", "warn"]
    : live ? ["ACTIVE", ""] : [LAPSED[status] || "INVALID", "bad"];
  const first = (c.boats || [])[0] || {};
  const also = (c.boats || []).slice(1);
  return h(`div.mcard${live ? ".live" : ".lapsed"}`,
    h("div.top",
      h("div", h("div.iss", (c.issuerName || "").toUpperCase()), h("div.tr", c.tier)),
      h(`span.st${pill[1] ? "." + pill[1] : ""}`, pill[0])),
    h("div", h("div.nm", c.name), h("div.no", c.number)),
    h("div.fl",
      h("div", h("span", "BOAT"), h("b", first.name || "—")),
      h("div", h("span", "REG"), h("b", first.reg || "—")),
      h("div", h("span", status === "expired" ? "EXPIRED" : "VALID THROUGH"), h("b", usDate(c.expires)))),
    also.length ? h("div.also", h("span", "ALSO COVERED"), also.map((b) => h("div", [b.name, b.reg].filter(Boolean).join("  ·  ") || "—"))) : null,
    live ? h("div.lv", h("div", h("div.d", { "data-date": "" }), h("div.t", { "data-clock": "" }, "--:--:--")), h("i", { "data-dot": "" })) : null);
}

/** The card inside a phone, with the app's call button under it. */
export function phoneWith(card, { issuerName, phone }) {
  return h("div.phone",
    h("div.phone-screen",
      h("div.phone-app", h("span", "9:41"), h("span", "Lake Cumberland")),
      h("div.phone-title", "Help on the water"),
      card,
      phone ? h("div.phone-call", `Call ${issuerName}`) : null));
}

// One clock for every live card on the page.
function tick() {
  const now = new Date();
  const phase = (now.getTime() % 6000) / 6000;
  const clock = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  document.querySelectorAll("[data-clock]").forEach((e) => (e.textContent = clock));
  document.querySelectorAll("[data-date]").forEach((e) => (e.textContent = date));
  document.querySelectorAll("[data-dot]").forEach((e) => e.style.setProperty("--pulse", (0.3 + 0.7 * Math.abs(Math.sin(phase * Math.PI))).toFixed(2)));
  document.querySelectorAll(".mcard.live").forEach((e) => e.style.setProperty("--sweep", phase * 220 - 100 + "%"));
}
setInterval(tick, 1000);
export const tickNow = tick;

/** The wax-seal stamp that lands on a card the moment it is signed. */
export function sealStamp(sigShort) {
  const wrap = h("div.seal");
  wrap.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <defs><radialGradient id="sealg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#E9C46A"/><stop offset=".65" stop-color="#B08227"/><stop offset="1" stop-color="#6E4E10"/></radialGradient>
    <path id="sealarc" d="M60,60 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"/></defs>
    <circle cx="60" cy="60" r="56" fill="url(#sealg)"/>
    <circle cx="60" cy="60" r="47" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-dasharray="3 3"/>
    <text font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" fill="#FFF8E6" letter-spacing="2.2"><textPath href="#sealarc">SIGNED · ECDSA P-256 · ${sigShort} ·</textPath></text>
    <path d="M42 61l12 12 25-27" fill="none" stroke="#FFF8E6" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return wrap;
}
