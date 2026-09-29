import { state, commit, orderTotals, customer, product } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, fmtDate, fmtDateTime, badge, ORDER_STATUS, PAYMENT_STATUS, pageHead, backLink, toast, confirmDialog, emptyState } from '../ui.js';

const filters = { q: '', status: 'all', channel: 'all' };

const STATUS_CHIPS = [
  ['all', 'All'], ['open', 'Open'], ['new', 'New'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['picked_up', 'Picked up'], ['cancelled', 'Cancelled'],
];

function matches(o) {
  if (filters.status === 'open' && !(o.status === 'new' || o.status === 'packed')) return false;
  if (filters.status !== 'all' && filters.status !== 'open' && o.status !== filters.status) return false;
  if (filters.channel !== 'all' && o.channel !== filters.channel) return false;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const c = customer(o.customerId);
    const hay = [String(o.number), c ? c.name : '', ...o.items.map((i) => i.sku + ' ' + i.name)].join(' ').toLowerCase();
    if (!hay.includes(q.replace(/^#/, ''))) return false;
  }
  return true;
}

function rowHtml(o) {
  const c = customer(o.customerId);
  const t = orderTotals(o);
  const units = o.items.reduce((s, i) => s + i.qty, 0);
  return `<tr class="row-link" data-href="#/orders/${o.id}">
    <td data-label="Order"><a class="strong-link" href="#/orders/${o.id}">#${o.number}</a></td>
    <td data-label="Date" class="nowrap">${fmtDateTime(o.date)}</td>
    <td data-label="Customer">${esc(c ? c.name : 'Walk-in')}</td>
    <td data-label="Items" class="nowrap">${units} unit${units === 1 ? '' : 's'}</td>
    <td data-label="Channel">${esc(o.channel)} · ${o.fulfillment === 'ship' ? 'Ship' : 'Pickup'}</td>
    <td data-label="Payment">${badge(PAYMENT_STATUS, o.payment)}</td>
    <td data-label="Status">${badge(ORDER_STATUS, o.status)}</td>
    <td data-label="Total" class="num strong td-top">${money(t.total)}</td>
  </tr>`;
}

export function renderOrders({ main, query }) {
  if (query.status && STATUS_CHIPS.some(([k]) => k === query.status)) filters.status = query.status;
  const channels = ['all', ...new Set(state.orders.map((o) => o.channel))];

  main.innerHTML = `
    ${pageHead('Orders', `${state.orders.length} orders in the last 30 days`)}
    <div class="toolbar">
      <label class="search">
        <span class="sr-only">Search orders</span>
        ${icon('search')}
        <input type="search" id="o-q" placeholder="Search order #, customer, or SKU" value="${esc(filters.q)}" autocomplete="off">
      </label>
      <label class="select-wrap">
        <span class="sr-only">Channel</span>
        <select id="o-channel">${channels.map((c) => `<option value="${esc(c)}"${filters.channel === c ? ' selected' : ''}>${c === 'all' ? 'All channels' : esc(c)}</option>`).join('')}</select>
      </label>
    </div>
    <div class="chips" role="group" aria-label="Filter by status">
      ${STATUS_CHIPS.map(([k, l]) => `<button type="button" class="chip${filters.status === k ? ' is-on' : ''}" data-status="${k}" aria-pressed="${filters.status === k}">${l}<span class="chip__n" data-count="${k}"></span></button>`).join('')}
    </div>
    <section class="card card--flush">
      <table class="table table--cards" aria-label="Orders">
        <thead><tr>
          <th scope="col">Order</th><th scope="col">Date</th><th scope="col">Customer</th><th scope="col">Items</th>
          <th scope="col">Channel</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col" class="num">Total</th>
        </tr></thead>
        <tbody id="o-rows"></tbody>
      </table>
      <div id="o-empty"></div>
    </section>
    <p class="result-count" id="o-count" aria-live="polite"></p>
  `;

  const rows = main.querySelector('#o-rows');
  const update = () => {
    const list = state.orders.filter(matches).sort((a, b) => new Date(b.date) - new Date(a.date));
    rows.innerHTML = list.map(rowHtml).join('');
    main.querySelector('#o-empty').innerHTML = list.length ? '' : emptyState('No orders match', 'Try a different search or status filter.');
    main.querySelector('#o-count').textContent = `Showing ${list.length} of ${state.orders.length} orders`;
    const saved = filters.status;
    main.querySelectorAll('[data-count]').forEach((el) => {
      filters.status = el.dataset.count;
      el.textContent = state.orders.filter(matches).length;
    });
    filters.status = saved;
  };
  update();

  main.querySelector('#o-q').addEventListener('input', (e) => { filters.q = e.target.value.trim(); update(); });
  main.querySelector('#o-channel').addEventListener('change', (e) => { filters.channel = e.target.value; update(); });
  main.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    filters.status = b.dataset.status;
    main.querySelectorAll('[data-status]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on); });
    update();
  }));
  bindRowLinks(rows);
}

export function bindRowLinks(container) {
  container.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, select')) return;
    const tr = e.target.closest('[data-href]');
    if (tr && !window.getSelection().toString()) location.hash = tr.dataset.href;
  });
}

function steps(o) {
  const last = o.fulfillment === 'ship' ? ['shipped', 'Shipped'] : ['picked_up', 'Picked up'];
  const seq = [['new', 'New'], ['packed', 'Packed'], last];
  const cur = seq.findIndex(([k]) => k === o.status);
  return `<ol class="stepper" aria-label="Order progress">${seq.map(([k, l], i) => {
    const done = i < cur || (i === cur && i === seq.length - 1);
    const st = o.status === 'cancelled' ? '' : done ? 'is-done' : i === cur ? 'is-current' : '';
    return `<li class="stepper__step ${st}"${i === cur ? ' aria-current="step"' : ''}><span class="stepper__dot">${done ? icon('check', 'icon--xs') : i + 1}</span><span>${l}</span></li>`;
  }).join('')}</ol>`;
}

export function renderOrder(ctx) {
  const { main, id } = ctx;
  const o = state.orders.find((x) => x.id === id);
  if (!o) { main.innerHTML = backLink('#/orders', 'All orders') + emptyState('Order not found', 'It may have been removed when the demo was reset.'); return; }
  ctx.setTitle(`Order #${o.number}`);
  const c = customer(o.customerId);
  const t = orderTotals(o);
  const finalKey = o.fulfillment === 'ship' ? 'shipped' : 'picked_up';
  let primary = '';
  if (o.status === 'new') primary = `<button class="btn btn--primary" data-set="packed">${icon('box')}Mark packed</button>`;
  else if (o.status === 'packed') primary = `<button class="btn btn--primary" data-set="${finalKey}">${icon(o.fulfillment === 'ship' ? 'truck' : 'store')}${o.fulfillment === 'ship' ? 'Mark shipped' : 'Mark picked up'}</button>`;

  main.innerHTML = `
    ${backLink('#/orders', 'All orders')}
    ${pageHead(`Order #${o.number}`, `${fmtDate(o.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(o.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${esc(o.channel)}`,
      `${badge(ORDER_STATUS, o.status, 'badge--lg')}`)}
    <div class="detail-grid">
      <div class="stack">
        <section class="card">
          <div class="card__head"><h2 class="card__title">Fulfillment</h2></div>
          ${steps(o)}
          <div class="action-row">
            ${primary}
            <label class="select-wrap select-wrap--inline">
              <span class="label-inline">Set status</span>
              <select id="status-select">
                ${['new', 'packed', finalKey, 'cancelled'].map((k) => `<option value="${k}"${o.status === k ? ' selected' : ''}>${ORDER_STATUS[k].label}</option>`).join('')}
              </select>
            </label>
          </div>
          ${o.status === 'shipped' && o.tracking ? `<p class="muted small">Tracking (sample): <code>${esc(o.tracking)}</code></p>` : ''}
          ${o.status === 'cancelled' ? '<p class="muted small">This order was cancelled. Its items were returned to stock.</p>' : ''}
        </section>

        <section class="card card--flush">
          <div class="card__head card__head--pad"><h2 class="card__title">Items</h2><span class="muted small">${o.items.length} line${o.items.length === 1 ? '' : 's'}</span></div>
          <table class="table table--lines">
            <thead><tr><th scope="col">Product</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Price</th><th scope="col" class="num">Amount</th></tr></thead>
            <tbody>${o.items.map((i) => {
              const p = product(i.productId);
              return `<tr>
                <td data-label="Product">${p ? `<a href="#/inventory/${p.id}">${esc(i.name)}</a>` : esc(i.name)}<div class="muted small">${esc(i.sku)}</div></td>
                <td data-label="Qty" class="num">${i.qty}</td>
                <td data-label="Price" class="num">${money(i.price)}</td>
                <td data-label="Amount" class="num strong">${money(i.qty * i.price)}</td></tr>`;
            }).join('')}</tbody>
          </table>
          <dl class="totals">
            <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
            <div><dt>Sales tax (6%)</dt><dd>${money(t.tax)}</dd></div>
            ${o.fulfillment === 'ship' ? `<div><dt>Shipping</dt><dd>${t.shipping ? money(t.shipping) : 'Free'}</dd></div>` : ''}
            <div class="totals__grand"><dt>Total</dt><dd>${money(t.total)}</dd></div>
          </dl>
        </section>

        <section class="card">
          <div class="card__head"><h2 class="card__title">Internal note</h2></div>
          <form id="note-form" class="stack-sm">
            <label class="sr-only" for="note">Internal note</label>
            <textarea id="note" name="note" rows="3" placeholder="Visible to staff only, e.g. “Customer will pick up after 5”">${esc(o.note)}</textarea>
            <div><button class="btn btn--ghost" type="submit">Save note</button></div>
          </form>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card__head"><h2 class="card__title">Customer</h2></div>
          ${c ? `<a class="person" href="#/customers/${c.id}"><span class="avatar avatar--lg" aria-hidden="true">${esc(initials(c.name))}</span><span><span class="person__name">${esc(c.name)}</span><span class="muted small">${esc(c.type)} · ${esc(c.terms)}</span></span></a>
          <ul class="info-list">
            <li>${icon('mail', 'icon--sm')}<span>${esc(c.email)}</span></li>
            <li>${icon('phone', 'icon--sm')}<span>${esc(c.phone)}</span></li>
            <li>${icon('pin', 'icon--sm')}<span>${esc(c.address)}, ${esc(c.city)}</span></li>
          </ul>` : '<p class="muted">Walk-in customer</p>'}
        </section>
        <section class="card">
          <div class="card__head"><h2 class="card__title">Payment</h2>${badge(PAYMENT_STATUS, o.payment)}</div>
          <p class="big-num">${money(t.total)}</p>
          <p class="muted small">${o.payment === 'paid' ? 'Paid in full at time of sale.' : o.payment === 'on_account' ? 'Billed to the customer’s house account (Net 30).' : o.payment === 'refunded' ? 'Refunded to the original payment method.' : 'Payment not yet collected.'}</p>
          ${o.payment !== 'paid' && o.payment !== 'refunded' && o.status !== 'cancelled' ? `<button class="btn btn--ghost btn--block" data-pay>${icon('check')}Record payment</button>` : ''}
        </section>
        <section class="card">
          <div class="card__head"><h2 class="card__title">Delivery</h2></div>
          <p class="muted small">${o.fulfillment === 'ship' ? `Ship to ${c ? esc(c.address) + ', ' + esc(c.city) : 'customer'}` : 'Customer pickup at Harbor Bend counter'}</p>
        </section>
      </div>
    </div>
  `;

  const setStatus = async (next) => {
    if (next === o.status) return;
    if (next === 'cancelled' && !(await confirmDialog('Cancel this order?', `Order #${o.number} will be marked cancelled and its items returned to stock.`, 'Cancel order', true))) {
      ctx.rerender(); return;
    }
    const wasCancelled = o.status === 'cancelled';
    commit((s) => {
      const ord = s.orders.find((x) => x.id === o.id);
      ord.status = next;
      if (next === 'shipped' && !ord.tracking) ord.tracking = `KR${Math.floor(100000 + Math.random() * 899999)}SAMPLE`;
      if (next === 'cancelled' || wasCancelled) {
        const dir = next === 'cancelled' ? 1 : -1;
        ord.items.forEach((i) => { const p = s.products.find((x) => x.id === i.productId); if (p) p.stock = Math.max(0, p.stock + dir * i.qty); });
      }
    }, { kind: 'order', text: `Order #${o.number} marked ${ORDER_STATUS[next].label.toLowerCase()}`, href: `#/orders/${o.id}` });
    toast(`Order #${o.number} is now ${ORDER_STATUS[next].label.toLowerCase()}`);
    ctx.rerender();
    const focusEl = main.querySelector('[data-set]') || main.querySelector('#status-select');
    if (focusEl) focusEl.focus();
  };

  main.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => setStatus(b.dataset.set)));
  main.querySelector('#status-select').addEventListener('change', (e) => setStatus(e.target.value));
  const pay = main.querySelector('[data-pay]');
  if (pay) pay.addEventListener('click', () => {
    commit((s) => { s.orders.find((x) => x.id === o.id).payment = 'paid'; }, { kind: 'order', text: `Payment recorded for order #${o.number}`, href: `#/orders/${o.id}` });
    toast('Payment recorded');
    ctx.rerender();
  });
  main.querySelector('#note-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = main.querySelector('#note').value.trim();
    commit((s) => { s.orders.find((x) => x.id === o.id).note = val; });
    toast('Note saved');
  });
}

export function initials(name) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
