import { state, commit, orderTotals, docTotals, nextNumber } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, fmtDate, relTime, badge, ORDER_STATUS, PAYMENT_STATUS, QUOTE_STATUS, INVOICE_STATUS, JOB_STATUS, pageHead, backLink, toast, openDialog, emptyState } from '../ui.js';
import { bindRowLinks, initials } from './orders.js';

const filters = { q: '', type: 'all' };

function statsFor(c) {
  const orders = state.orders.filter((o) => o.customerId === c.id && o.status !== 'cancelled');
  const spend = orders.reduce((s, o) => s + orderTotals(o).total, 0);
  const last = orders.reduce((m, o) => (!m || new Date(o.date) > new Date(m) ? o.date : m), null);
  return { count: orders.length, spend, last };
}

export async function newCustomerDialog() {
  const res = await openDialog({
    title: 'New customer',
    bodyHtml: `
      <p class="muted small">Demo only: nothing leaves this browser. Use made-up details.</p>
      <label class="field"><span class="field__label">Name or business</span><input name="name" required maxlength="60" autofocus></label>
      <div class="form-grid">
        <label class="field"><span class="field__label">Type</span><select name="type"><option>Retail</option><option>Marina</option><option>Guide</option><option>Business</option></select></label>
        <label class="field"><span class="field__label">Phone</span><input name="phone" type="tel" maxlength="20" placeholder="(606) 555-0199"></label>
      </div>
      <label class="field"><span class="field__label">Email</span><input name="email" type="email" maxlength="80" placeholder="name@example.com"></label>
      <label class="field"><span class="field__label">Street address</span><input name="address" maxlength="80" placeholder="123 Heron Cove Ct"></label>
      <label class="field"><span class="field__label">City</span><input name="city" maxlength="40" value="Kettle Ridge, KY"></label>`,
    actionsHtml: '<button class="btn btn--ghost" value="cancel" formnovalidate>Cancel</button><button class="btn btn--primary" value="ok">Add customer</button>',
  });
  if (!res) return null;
  let id;
  commit((s) => {
    id = 'c' + nextNumber('customer');
    s.customers.push({
      id, name: res.name.trim(), type: res.type, email: res.email.trim() || '—', phone: res.phone.trim() || '—',
      address: res.address.trim() || '—', city: res.city.trim() || '—', since: new Date().toISOString(),
      terms: res.type === 'Retail' ? 'Pay at sale' : 'Net 30', notes: '',
    });
  }, { kind: 'customer', text: `Customer added: ${res.name.trim()}`, href: '#/customers' });
  toast(`${res.name.trim()} added`);
  return id;
}

export function renderCustomers({ main }) {
  const types = ['all', ...new Set(state.customers.map((c) => c.type))];
  main.innerHTML = `
    ${pageHead('Customers', `${state.customers.length} accounts`, `<button type="button" class="btn btn--primary" id="new-cust">${icon('plus')}New customer</button>`)}
    <div class="toolbar">
      <label class="search"><span class="sr-only">Search customers</span>${icon('search')}
        <input type="search" id="c-q" placeholder="Search name, email, phone, or town" value="${esc(filters.q)}" autocomplete="off"></label>
      <label class="select-wrap"><span class="sr-only">Account type</span>
        <select id="c-type">${types.map((t) => `<option value="${esc(t)}"${filters.type === t ? ' selected' : ''}>${t === 'all' ? 'All account types' : esc(t)}</option>`).join('')}</select></label>
    </div>
    <section class="card card--flush">
      <table class="table table--cards" aria-label="Customers">
        <thead><tr><th scope="col">Customer</th><th scope="col">Type</th><th scope="col">Phone</th><th scope="col">Town</th><th scope="col" class="num">Orders</th><th scope="col" class="num">30-day spend</th><th scope="col">Last order</th></tr></thead>
        <tbody id="c-rows"></tbody>
      </table>
      <div id="c-empty"></div>
    </section>
    <p class="result-count" id="c-count" aria-live="polite"></p>
  `;
  const rows = main.querySelector('#c-rows');
  const update = () => {
    const q = filters.q.toLowerCase();
    const list = state.customers
      .filter((c) => (filters.type === 'all' || c.type === filters.type) && (!q || `${c.name} ${c.email} ${c.phone} ${c.city}`.toLowerCase().includes(q)))
      .map((c) => ({ c, s: statsFor(c) }))
      .sort((a, b) => b.s.spend - a.s.spend);
    rows.innerHTML = list.map(({ c, s }) => `
      <tr class="row-link" data-href="#/customers/${c.id}">
        <td data-label="Customer"><span class="cell-person"><span class="avatar" aria-hidden="true">${esc(initials(c.name))}</span><span><a class="strong-link" href="#/customers/${c.id}">${esc(c.name)}</a><span class="muted small block">${esc(c.email)}</span></span></span></td>
        <td data-label="Type"><span class="tag">${esc(c.type)}</span></td>
        <td data-label="Phone" class="nowrap">${esc(c.phone)}</td>
        <td data-label="Town" class="nowrap">${esc(c.city)}</td>
        <td data-label="Orders" class="num">${s.count}</td>
        <td data-label="30-day spend" class="num strong">${money(s.spend)}</td>
        <td data-label="Last order">${s.last ? relTime(s.last) : '—'}</td>
      </tr>`).join('');
    main.querySelector('#c-empty').innerHTML = list.length ? '' : emptyState('No customers match', 'Try a different search.');
    main.querySelector('#c-count').textContent = `Showing ${list.length} of ${state.customers.length} customers`;
  };
  update();
  main.querySelector('#c-q').addEventListener('input', (e) => { filters.q = e.target.value.trim(); update(); });
  main.querySelector('#c-type').addEventListener('change', (e) => { filters.type = e.target.value; update(); });
  main.querySelector('#new-cust').addEventListener('click', async () => { const id = await newCustomerDialog(); if (id) location.hash = `#/customers/${id}`; });
  bindRowLinks(rows);
}

export function renderCustomer(ctx) {
  const { main, id } = ctx;
  const c = state.customers.find((x) => x.id === id);
  if (!c) { main.innerHTML = backLink('#/customers', 'Customers') + emptyState('Customer not found', 'It may have been removed when the demo was reset.'); return; }
  ctx.setTitle(c.name);
  const s = statsFor(c);
  const orders = state.orders.filter((o) => o.customerId === c.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const jobs = state.jobs.filter((j) => j.customerId === c.id);
  const quotes = state.quotes.filter((q) => q.customerId === c.id);
  const invoices = state.invoices.filter((i) => i.customerId === c.id);
  const owed = orders.filter((o) => o.payment === 'on_account' || o.payment === 'unpaid').reduce((a, o) => a + orderTotals(o).total, 0)
    + invoices.filter((i) => i.status === 'unpaid').reduce((a, i) => a + docTotals(i.lines).total, 0);

  main.innerHTML = `
    ${backLink('#/customers', 'Customers')}
    <div class="page-head">
      <div class="person person--head"><span class="avatar avatar--xl" aria-hidden="true">${esc(initials(c.name))}</span>
        <div><h1 class="page-title">${esc(c.name)}</h1><p class="page-sub"><span class="tag">${esc(c.type)}</span> Customer since ${fmtDate(c.since, { month: 'long', year: 'numeric' })}</p></div></div>
      <div class="page-actions"><a class="btn btn--primary" href="#/quotes/new?customer=${c.id}">${icon('plus')}New quote</a></div>
    </div>
    <section class="kpis kpis--3" aria-label="Customer summary">
      <div class="kpi kpi--static"><span class="kpi__label">Orders (30 days)</span><span class="kpi__value">${s.count}</span></div>
      <div class="kpi kpi--static"><span class="kpi__label">Spend (30 days)</span><span class="kpi__value">${money(s.spend)}</span><span class="kpi__meta">Avg ${money(s.count ? s.spend / s.count : 0)} per order</span></div>
      <div class="kpi kpi--static"><span class="kpi__label">Open balance</span><span class="kpi__value">${money(owed)}</span><span class="kpi__meta">${esc(c.terms)}</span></div>
    </section>
    <div class="detail-grid">
      <div class="stack">
        <section class="card card--flush">
          <div class="card__head card__head--pad"><h2 class="card__title">Order history</h2><span class="muted small">${orders.length} order${orders.length === 1 ? '' : 's'}</span></div>
          ${orders.length ? `<table class="table table--cards6" aria-label="Order history">
            <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col" class="num">Total</th></tr></thead>
            <tbody id="h-rows">${orders.map((o) => `<tr class="row-link" data-href="#/orders/${o.id}">
              <td data-label="Order"><a class="strong-link" href="#/orders/${o.id}">#${o.number}</a></td>
              <td data-label="Date" class="nowrap">${fmtDate(o.date, { month: 'short', day: 'numeric' })}</td>
              <td data-label="Items">${esc(o.items[0].name)}${o.items.length > 1 ? ` <span class="muted">+${o.items.length - 1} more</span>` : ''}</td>
              <td data-label="Payment">${badge(PAYMENT_STATUS, o.payment)}</td>
              <td data-label="Status">${badge(ORDER_STATUS, o.status)}</td>
              <td data-label="Total" class="num strong td-top">${money(orderTotals(o).total)}</td></tr>`).join('')}</tbody></table>` : `<div class="pad">${emptyState('No orders yet', 'Orders from this customer will show here.')}</div>`}
        </section>
        ${jobs.length || quotes.length || invoices.length ? `
        <section class="card">
          <div class="card__head"><h2 class="card__title">Service work</h2></div>
          <ul class="mini-list">
            ${jobs.map((j) => `<li><a class="mini-list__row" href="#/shop"><span class="mini-list__main"><span class="mini-list__title">Job #${j.number} · ${esc(j.unit)}</span><span class="mini-list__meta">${esc(j.problem)}</span></span><span class="tag">${esc(JOB_STATUS.find((x) => x.key === j.status).label)}</span></a></li>`).join('')}
            ${quotes.map((q) => `<li><a class="mini-list__row" href="#/quotes/${q.id}"><span class="mini-list__main"><span class="mini-list__title">Quote Q-${q.number} · ${esc(q.title)}</span><span class="mini-list__meta">${fmtDate(q.date)}</span></span><span class="mini-list__end">${badge(QUOTE_STATUS, q.status)}<span class="mini-list__amt">${money(docTotals(q.lines).total)}</span></span></a></li>`).join('')}
            ${invoices.map((i) => `<li><a class="mini-list__row" href="#/invoices/${i.id}"><span class="mini-list__main"><span class="mini-list__title">Invoice INV-${i.number}</span><span class="mini-list__meta">Due ${fmtDate(i.due)}</span></span><span class="mini-list__end">${badge(INVOICE_STATUS, i.status)}<span class="mini-list__amt">${money(docTotals(i.lines).total)}</span></span></a></li>`).join('')}
          </ul>
        </section>` : ''}
      </div>
      <div class="stack">
        <section class="card">
          <div class="card__head"><h2 class="card__title">Contact</h2></div>
          <ul class="info-list">
            <li>${icon('mail', 'icon--sm')}<span>${esc(c.email)}</span></li>
            <li>${icon('phone', 'icon--sm')}<span>${esc(c.phone)}</span></li>
            <li>${icon('pin', 'icon--sm')}<span>${esc(c.address)}<br>${esc(c.city)}</span></li>
          </ul>
        </section>
        <section class="card">
          <div class="card__head"><h2 class="card__title">Account notes</h2></div>
          <form id="cnote" class="stack-sm">
            <label class="sr-only" for="cnote-t">Account notes</label>
            <textarea id="cnote-t" rows="4" placeholder="Preferences, boat details, delivery instructions…">${esc(c.notes)}</textarea>
            <div><button class="btn btn--ghost" type="submit">Save notes</button></div>
          </form>
        </section>
      </div>
    </div>
  `;
  const h = main.querySelector('#h-rows');
  if (h) bindRowLinks(h);
  main.querySelector('#cnote').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = main.querySelector('#cnote-t').value.trim();
    commit((st) => { st.customers.find((x) => x.id === c.id).notes = v; });
    toast('Notes saved');
  });
}
