// Shared UI helpers: escaping, formatting, badges, toasts, dialogs.
import { icon } from './icons.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyFmt0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const money = (n) => moneyFmt.format(n || 0);
export const money0 = (n) => moneyFmt0.format(n || 0);

export function fmtDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-US', opts);
}
export function fmtTime(iso) { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
export function fmtDateTime(iso) { return `${fmtDate(iso, { month: 'short', day: 'numeric' })}, ${fmtTime(iso)}`; }

export function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return fmtDate(iso);
}

export function isToday(iso) {
  const a = new Date(iso); const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const ORDER_STATUS = {
  new: { label: 'New', tone: 'info' },
  packed: { label: 'Packed', tone: 'warn' },
  shipped: { label: 'Shipped', tone: 'good' },
  picked_up: { label: 'Picked up', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};
export const PAYMENT_STATUS = {
  paid: { label: 'Paid', tone: 'good' },
  unpaid: { label: 'Unpaid', tone: 'bad' },
  on_account: { label: 'On account', tone: 'info' },
  refunded: { label: 'Refunded', tone: 'muted' },
};
export const QUOTE_STATUS = {
  draft: { label: 'Draft', tone: 'muted' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'warn' },
  invoiced: { label: 'Invoiced', tone: 'good' },
  declined: { label: 'Declined', tone: 'bad' },
};
export const INVOICE_STATUS = {
  unpaid: { label: 'Unpaid', tone: 'bad' },
  paid: { label: 'Paid', tone: 'good' },
};
export const JOB_STATUS = [
  { key: 'checked_in', label: 'Checked in' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'waiting_parts', label: 'Waiting on parts' },
  { key: 'ready', label: 'Ready for pickup' },
];

export function badge(map, key, extra = '') {
  const s = map[key] || { label: key, tone: 'muted' };
  return `<span class="badge badge--${s.tone} ${extra}"><span class="badge__dot" aria-hidden="true"></span>${esc(s.label)}</span>`;
}

export function lowBadge() {
  return `<span class="badge badge--bad">${icon('alert', 'icon--xs')}Low stock</span>`;
}

// ---------- toasts ----------
export function toast(msg, tone = 'good') {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.innerHTML = `${icon(tone === 'good' ? 'check' : 'alert')}<span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('toast--out'); setTimeout(() => el.remove(), 300); }, 3200);
}

// ---------- dialogs ----------
// Opens a modal <dialog>. `render(body)` fills content; returns a promise resolved with the close value.
export function openDialog({ title, bodyHtml, actionsHtml, onMount, wide = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog' + (wide ? ' dialog--wide' : '');
    dlg.setAttribute('aria-labelledby', 'dlg-title');
    dlg.innerHTML = `
      <form method="dialog" class="dialog__form" novalidate>
        <header class="dialog__head">
          <h2 id="dlg-title">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
        </header>
        <div class="dialog__body">${bodyHtml}</div>
        <footer class="dialog__foot">${actionsHtml}</footer>
      </form>`;
    root.appendChild(dlg);
    const form = dlg.querySelector('form');
    const opener = document.activeElement;
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      if (dlg.open) dlg.close();
      dlg.remove();
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
      resolve(val);
    };
    const close = (val) => finish(val);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    dlg.addEventListener('close', () => finish(null));
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) close(null);
      if (e.target.closest('[data-close]')) close(null);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitter = e.submitter;
      if (submitter && submitter.value === 'cancel') { close(null); return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      close(Object.fromEntries(new FormData(form).entries()));
    });
    if (onMount) onMount(dlg, close);
    dlg.showModal();
    const first = dlg.querySelector('[autofocus], input, select, textarea, .btn--primary');
    if (first) first.focus();
  });
}

export async function confirmDialog(title, message, confirmLabel = 'Confirm', danger = false) {
  const res = await openDialog({
    title,
    bodyHtml: `<p>${esc(message)}</p><input type="hidden" name="ok" value="1">`,
    actionsHtml: `<button class="btn btn--ghost" value="cancel" formnovalidate>Cancel</button><button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" value="ok">${esc(confirmLabel)}</button>`,
  });
  return !!res;
}

export function emptyState(title, text, actionHtml = '') {
  return `<div class="empty">${icon('box', 'icon--lg')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHtml}</div>`;
}

export function pageHead(title, sub = '', actions = '') {
  return `<div class="page-head"><div><h1 class="page-title">${esc(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
}

export function backLink(href, label) {
  return `<a class="back-link" href="${href}">${icon('arrowLeft', 'icon--sm')}${esc(label)}</a>`;
}
