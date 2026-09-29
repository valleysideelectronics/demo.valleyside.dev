// State container. Persists to localStorage when available; otherwise memory only.
import { makeSeed, SEED_VERSION, TAX_RATE, dayKey } from './seed.js';

const KEY = 'kettle-ridge-demo-v' + SEED_VERSION;
let persistent = true;
export let state = null;

function readStorage() {
  try { const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
  catch { persistent = false; return null; }
}
function writeStorage() {
  if (!persistent) return;
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { persistent = false; }
}
function clearStorage() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function isPersistent() { return persistent; }

// Shift every stored date so the sample data always ends "today".
function rebase(s) {
  const today = dayKey(new Date());
  if (!s.seededOn || s.seededOn === today) return s;
  const a = new Date(s.seededOn + 'T12:00:00'); const b = new Date(today + 'T12:00:00');
  const days = Math.round((b - a) / 86400000);
  if (!days) { s.seededOn = today; return s; }
  const shift = (iso) => (iso ? new Date(new Date(iso).getTime() + days * 86400000).toISOString() : iso);
  s.orders.forEach((o) => { o.date = shift(o.date); });
  s.jobs.forEach((j) => { j.checkedIn = shift(j.checkedIn); j.promised = shift(j.promised); });
  s.quotes.forEach((q) => { q.date = shift(q.date); });
  s.invoices.forEach((i) => { i.date = shift(i.date); i.due = shift(i.due); if (i.paidOn) i.paidOn = shift(i.paidOn); });
  s.customers.forEach((c) => { c.since = shift(c.since); });
  s.activity.forEach((a2) => { a2.time = shift(a2.time); });
  s.seededOn = today;
  return s;
}

export function load() {
  const saved = readStorage();
  if (saved && saved.version === SEED_VERSION && Array.isArray(saved.orders)) {
    state = rebase(saved);
  } else {
    state = makeSeed(new Date());
  }
  writeStorage();
  return state;
}

export function reset() {
  clearStorage();
  persistent = true;
  state = makeSeed(new Date());
  writeStorage();
}

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Apply a mutation, optionally log an activity entry, then persist.
export function commit(mutator, activity) {
  mutator(state);
  if (activity) {
    state.activity.unshift({ time: new Date().toISOString(), ...activity });
    state.activity = state.activity.slice(0, 60);
  }
  writeStorage();
  listeners.forEach((fn) => fn());
}

// ---------- lookups & derived values ----------
export const byId = (list, id) => state[list].find((x) => x.id === id);
export const customer = (id) => byId('customers', id);
export const product = (id) => byId('products', id);

export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export function orderTotals(o) {
  const subtotal = round2(o.items.reduce((s, i) => s + i.qty * i.price, 0));
  const tax = round2(subtotal * TAX_RATE);
  const shipping = o.shipping || 0;
  return { subtotal, tax, shipping, total: round2(subtotal + tax + shipping) };
}

export function docTotals(lines) {
  const labor = round2(lines.filter((l) => l.type === 'labor').reduce((s, l) => s + l.qty * l.rate, 0));
  const parts = round2(lines.filter((l) => l.type !== 'labor').reduce((s, l) => s + l.qty * l.rate, 0));
  const subtotal = round2(labor + parts);
  const tax = round2(subtotal * TAX_RATE);
  return { labor, parts, subtotal, tax, total: round2(subtotal + tax) };
}

export function isLow(p) { return p.stock <= p.reorder; }

export function nextNumber(kind) { const n = state.counters[kind]; state.counters[kind] = n + 1; return n; }
