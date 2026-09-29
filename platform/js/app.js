// App shell: navigation, hash router, reset, banner offset.
import { load, reset, isPersistent } from './store.js';
import { icon, brandMark } from './icons.js';
import { confirmDialog, toast, esc } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderOrders, renderOrder } from './views/orders.js';
import { renderInventory, renderProductForm } from './views/inventory.js';
import { renderCustomers, renderCustomer } from './views/customers.js';
import { renderQuotes, renderQuoteEditor, renderInvoice } from './views/quotes.js';
import { renderShop } from './views/shop.js';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'dashboard' },
  { key: 'orders', label: 'Orders', short: 'Orders', icon: 'orders' },
  { key: 'inventory', label: 'Inventory', short: 'Stock', icon: 'inventory' },
  { key: 'customers', label: 'Customers', short: 'Customers', icon: 'customers' },
  { key: 'quotes', label: 'Quotes & invoices', short: 'Quotes', icon: 'quotes' },
  { key: 'shop', label: 'Service shop', short: 'Shop', icon: 'shop' },
];

const main = document.getElementById('main');

function navHtml(short) {
  return SECTIONS.map((s) => `<a class="nav__link" href="#/${s.key}" data-section="${s.key}">${icon(s.icon)}<span>${short ? s.short : s.label}</span></a>`).join('');
}

function parseHash() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { parts, query };
}

function resolve(parts) {
  const [a = 'dashboard', b] = parts;
  switch (a) {
    case 'dashboard': return { section: 'dashboard', view: renderDashboard, title: 'Dashboard' };
    case 'orders': return b ? { section: 'orders', view: renderOrder, id: b, title: 'Order' } : { section: 'orders', view: renderOrders, title: 'Orders' };
    case 'inventory':
      if (b === 'new') return { section: 'inventory', view: renderProductForm, id: null, title: 'New product' };
      return b ? { section: 'inventory', view: renderProductForm, id: b, title: 'Product' } : { section: 'inventory', view: renderInventory, title: 'Inventory' };
    case 'customers': return b ? { section: 'customers', view: renderCustomer, id: b, title: 'Customer' } : { section: 'customers', view: renderCustomers, title: 'Customers' };
    case 'quotes':
      if (b === 'new') return { section: 'quotes', view: renderQuoteEditor, id: null, title: 'New quote' };
      return b ? { section: 'quotes', view: renderQuoteEditor, id: b, title: 'Quote' } : { section: 'quotes', view: renderQuotes, title: 'Quotes & invoices' };
    case 'invoices': return { section: 'quotes', view: renderInvoice, id: b, title: 'Invoice' };
    case 'shop': return { section: 'shop', view: renderShop, title: 'Service shop' };
    default: return { section: null, view: renderNotFound, title: 'Not found' };
  }
}

function renderNotFound({ main: el }) {
  el.innerHTML = `<div class="empty">${icon('alert', 'icon--lg')}<h1 class="page-title">Page not found</h1><p>That screen doesn’t exist in this demo.</p><a class="btn btn--primary" href="#/dashboard">Go to dashboard</a></div>`;
}

let lastPath = null;
function route() {
  const { parts, query } = parseHash();
  const r = resolve(parts);
  const pathKey = parts.join('/');
  const isNav = pathKey !== lastPath;
  lastPath = pathKey;

  document.querySelectorAll('[data-section]').forEach((a) => {
    const on = a.dataset.section === r.section;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  const ctx = {
    main, id: r.id, query,
    setTitle(t) { document.title = `${t} · Kettle Ridge Ops (demo)`; document.getElementById('crumbs').textContent = t; },
    rerender() { renderView(r, ctx); },
  };
  ctx.setTitle(r.title);
  renderView(r, ctx);
  if (isNav) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}

function renderView(r, ctx) {
  try { r.view(ctx); }
  catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty">${icon('alert', 'icon--lg')}<h1 class="page-title">Something went wrong</h1><p>${esc(err.message)}</p><button class="btn btn--primary" data-action="reset">Reset demo data</button></div>`;
  }
}

// Keep the fixed demo banner's height available to CSS.
function trackBanner() {
  const banner = document.getElementById('demo-banner');
  const set = () => document.documentElement.style.setProperty('--banner-h', banner.offsetHeight + 'px');
  set();
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(banner);
  else window.addEventListener('resize', set);
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="reset"]');
  if (!btn) return;
  const ok = await confirmDialog('Reset demo data?', 'This puts every order, product, customer, quote and service job back to the original sample data. Your changes in this browser will be cleared.', 'Reset data', true);
  if (!ok) return;
  reset();
  lastPath = null;
  if (location.hash === '#/dashboard') route(); else location.hash = '#/dashboard';
  toast('Demo data reset');
});

function init() {
  load();
  document.getElementById('brand-mark').innerHTML = brandMark;
  document.getElementById('brand-mark-sm').innerHTML = brandMark;
  document.getElementById('nav').innerHTML = navHtml(false);
  document.getElementById('bottomnav').innerHTML = navHtml(true);
  trackBanner();
  window.addEventListener('hashchange', route);
  route();
  if (!isPersistent()) toast('Browser storage is unavailable, so changes last until you reload.', 'warn');
}

init();
