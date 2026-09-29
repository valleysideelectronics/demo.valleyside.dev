/*
 * The guided tour, shown only in the demo. It walks someone seeing the console
 * for the first time through the five things that matter: sign, send, check,
 * forge, cancel. Each step has a "Show me" that takes them to the right place
 * and points at the button; doing the thing (by any route) ticks the step off.
 */
import { h, clear, icon } from "./ui.js";

const STEPS = [
  { id: "sign", title: "Sign a card", text: "A member has paid but has no card yet. Open them and sign one.", done: ["issued", "renewed"] },
  { id: "send", title: "Send it to their phone", text: "One link by text or email, or a QR code they scan at the desk.", done: ["send-opened", "copied", "sent"] },
  { id: "check", title: "Check it like a captain", text: "Paste any card and see whether it's genuine and current.", done: ["checked", "tampered"] },
  { id: "forge", title: "Try to forge one", text: "Change one letter of a card and watch the phone refuse it.", done: ["tampered"] },
  { id: "cancel", title: "Cancel a card", text: "Cancel a member, then publish the list so their phone stops honoring it.", done: ["published"] },
];

export function installTour(app, V) {
  const done = new Set();
  // On a phone the full panel would cover the very buttons it points at, so it
  // starts as a pill there and folds back after each "Show me".
  const small = () => matchMedia("(max-width: 860px)").matches;
  let open = !small();
  let lastSigned = null;
  const box = h("aside.tour", { "aria-label": "Guided tour" });
  document.body.append(box);

  app.on((type, member) => {
    if ((type === "issued" || type === "renewed") && member) lastSigned = member.id;
    let changed = false;
    for (const s of STEPS) if (s.done.includes(type) && !done.has(s.id)) { done.add(s.id); changed = true; }
    if (changed) { open = !small() || !next(); draw(true); }
  });

  const next = () => STEPS.find((s) => !done.has(s.id));

  function glow(selector, tries = 25) {
    const el = document.querySelector(selector);
    if (!el) { if (tries) setTimeout(() => glow(selector, tries - 1), 120); return; }
    document.querySelectorAll(".tour-glow").forEach((e) => e.classList.remove("tour-glow"));
    el.classList.add("tour-glow");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const off = () => { el.classList.remove("tour-glow"); el.removeEventListener("click", off); };
    el.addEventListener("click", off);
    setTimeout(off, 9000);
  }

  const pick = (pred) => app.members.find(pred);
  const SHOW = {
    sign() {
      const m = pick((x) => !x.canceled && app.status(x) === "not issued") || pick((x) => !x.canceled && x.token && app.status(x) !== "expired");
      if (!m) return;
      V.openMember(app, m.id);
      glow(".drawer-actions .btn.brass, .drawer-actions .btn");
    },
    send() {
      const m = app.find(lastSigned) || pick((x) => x.token && !x.canceled && ["active", "expiring"].includes(app.status(x)));
      if (!m) return;
      V.openMember(app, m.id);
      glow(".drawer-actions .btn.primary");
    },
    check() {
      const m = app.find(lastSigned) || pick((x) => x.token && !x.canceled && ["active", "expiring"].includes(app.status(x)));
      app.ui.checkPrefill = m ? app.message(m) : null;
      app.go("check");
      glow(".check-run");
    },
    forge() {
      if (app.route !== "check" || !document.querySelector(".tamper-btn")) SHOW.check();
      glow(".tamper-btn");
    },
    cancel() {
      const stale = app.listDiff().added.length + app.listDiff().removed.length > 0;
      if (stale) { app.go("cancellations"); glow(".pub-status .btn"); return; }
      const m = pick((x) => x.token && !x.canceled && app.status(x) === "active");
      if (!m) return;
      V.openMember(app, m.id);
      glow(".danger-zone .btn.danger");
    },
  };

  function draw(celebrate = false) {
    clear(box);
    const n = next();
    const count = done.size;
    box.classList.toggle("collapsed", !open);
    if (!open) {
      box.append(h(`button.tour-pill${celebrate ? ".pop" : ""}`, { on: { click: () => { open = true; draw(); } } },
        icon("wave"), n ? (count ? `${count}/${STEPS.length} · Next: ${n.title}` : "Take the guided tour") : "Tour complete"));
      return;
    }
    box.append(
      h("div.tour-head",
        h("div", h("div.tour-kicker", "Guided tour"), h("div.tour-count", n ? `${count} of ${STEPS.length} done` : "All done")),
        h("button.tour-x", { "aria-label": "Hide the tour", on: { click: () => { open = false; draw(); } } }, icon("x"))),
      h("div.tour-bar", h("i", { style: { width: `${(count / STEPS.length) * 100}%` } })),
      n
        ? h("ol.tour-steps", STEPS.map((s) => {
          const isDone = done.has(s.id), isNext = s === n;
          return h(`li${isDone ? ".done" : ""}${isNext ? ".next" : ""}${isDone && celebrate ? ".pop" : ""}`,
            h("span.tour-dot", isDone ? icon("ok") : String(STEPS.indexOf(s) + 1)),
            h("div",
              h("div.tour-title", s.title),
              isNext ? [h("div.tour-text", s.text), h("button.tour-go", { on: { click: () => { if (small()) { open = false; draw(); } SHOW[s.id](); } } }, "Show me", icon("send"))] : null));
        }))
        : h("div.tour-finish",
          h("div.tour-title", "That's the whole system."),
          h("div.tour-text", "Every card was signed with a key that never left this page, checked with the same code a member's phone runs, and a forgery was caught by math, not by a person squinting at a screenshot."),
          h("button.tour-go", { on: { click: () => app.resetDemo() } }, "Start the demo over", icon("refresh"))));
  }
  draw();
}
