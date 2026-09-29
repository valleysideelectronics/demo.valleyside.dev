import { state, commit, isLow, round2, customer, nextNumber } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, fmtDate, pageHead, backLink, toast, openDialog, emptyState, lowBadge } from '../ui.js';
import { bindRowLinks } from './orders.js';

const filters = { q: '', cat: 'all', stock: 'all' };

function matches(p) {
  if (filters.cat !== 'all' && p.category !== filters.cat) return false;
  if (filters.stock === 'low' && !isLow(p)) return false;
  if (filters.stock === 'out' && p.stock > 0) return false;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    if (!(`${p.name} ${p.sku} ${p.vendor}`.toLowerCase().includes(q))) return false;
  }
  return true;
}

function stockMeter(p) {
  const pct = Math.min(100, Math.round((p.stock / Math.max(1, p.reorder * 2.5)) * 100));
  return `<span class="meter ${isLow(p) ? 'meter--low' : ''}" aria-hidden="true"><span style="width:${pct}%"></span></span>`;
}

function rowHtml(p) {
  return `<tr class="row-link" data-href="#/inventory/${p.id}">
    <td data-label="Product"><a class="strong-link" href="#/inventory/${p.id}">${esc(p.name)}</a><div class="muted small">${esc(p.sku)}</div></td>
    <td data-label="Category">${esc(p.category)}</td>
    <td data-label="Bin">${esc(p.bin)}</td>
    <td data-label="Price" class="num">${money(p.price)}</td>
    <td data-label="On hand" class="num"><span class="onhand"><strong>${p.stock}</strong>${stockMeter(p)}</span></td>
    <td data-label="Reorder at" class="num">${p.reorder}</td>
    <td data-label="Status">${p.stock === 0 ? '<span class="badge badge--bad">Out of stock</span>' : isLow(p) ? lowBadge() : '<span class="badge badge--good"><span class="badge__dot" aria-hidden="true"></span>In stock</span>'}</td>
    <td data-label="" class="cell-actions"><button type="button" class="btn btn--ghost btn--sm" data-adjust="${p.id}" aria-label="Adjust stock for ${esc(p.name)}">${icon('edit', 'icon--sm')}Adjust</button></td>
  </tr>`;
}

export async function adjustStock(p, after) {
  const res = await openDialog({
    title: 'Adjust stock',
    bodyHtml: `
      <p class="muted">${esc(p.name)} · <span class="mono">${esc(p.sku)}</span><br>Currently <strong>${p.stock}</strong> on hand, reorder at ${p.reorder}.</p>
      <fieldset class="seg">
        <legend class="sr-only">Adjustment type</legend>
        <label><input type="radio" name="mode" value="receive" checked> Receive (+)</label>
        <label><input type="radio" name="mode" value="remove"> Remove (−)</label>
        <label><input type="radio" name="mode" value="count"> Set count</label>
      </fieldset>
      <label class="field"><span class="field__label">Quantity</span>
        <input type="number" name="qty" min="0" max="9999" step="1" required inputmode="numeric" value="${Math.max(1, p.reorder * 2 - p.stock)}" autofocus>
      </label>
      <label class="field"><span class="field__label">Reason (optional)</span>
        <select name="reason"><option>Vendor delivery</option><option>Cycle count</option><option>Damaged / shrink</option><option>Returned by customer</option></select>
      </label>`,
    actionsHtml: '<button class="btn btn--ghost" value="cancel" formnovalidate>Cancel</button><button class="btn btn--primary" value="ok">Save adjustment</button>',
  });
  if (!res) return;
  const qty = Math.max(0, parseInt(res.qty, 10) || 0);
  let next = p.stock;
  if (res.mode === 'receive') next = p.stock + qty;
  else if (res.mode === 'remove') next = Math.max(0, p.stock - qty);
  else next = qty;
  commit((s) => { s.products.find((x) => x.id === p.id).stock = next; },
    { kind: next <= p.reorder ? 'stock' : 'product', text: `Stock for ${p.name} set to ${next} (${res.reason.toLowerCase()})`, href: `#/inventory/${p.id}` });
  toast(`${p.sku}: ${p.stock} → ${next} on hand`);
  if (after) after();
}

export function renderInventory({ main, query }) {
  if (query.filter === 'low') filters.stock = 'low';
  const cats = [...new Set(state.products.map((p) => p.category))].sort();
  const value = state.products.reduce((a, p) => a + p.stock * p.cost, 0);
  const lowN = state.products.filter(isLow).length;

  main.innerHTML = `
    ${pageHead('Inventory', `<span id="i-sub">${state.products.length} products · ${money(value)} on hand at cost · ${lowN} low</span>`, `<a class="btn btn--primary" href="#/inventory/new">${icon('plus')}Add product</a>`)}
    <div class="toolbar">
      <label class="search">
        <span class="sr-only">Search products</span>
        ${icon('search')}
        <input type="search" id="i-q" placeholder="Search name, SKU, or vendor" value="${esc(filters.q)}" autocomplete="off">
      </label>
      <label class="select-wrap">
        <span class="sr-only">Category</span>
        <select id="i-cat"><option value="all">All categories</option>${cats.map((c) => `<option${filters.cat === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </label>
    </div>
    <div class="chips" role="group" aria-label="Filter by stock level">
      ${[['all', 'All products'], ['low', 'Low stock'], ['out', 'Out of stock']].map(([k, l]) => `<button type="button" class="chip${filters.stock === k ? ' is-on' : ''}" data-stock="${k}" aria-pressed="${filters.stock === k}">${l}</button>`).join('')}
    </div>
    <section class="card card--flush">
      <table class="table table--cards" aria-label="Products">
        <thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Bin</th><th scope="col" class="num">Price</th><th scope="col" class="num">On hand</th><th scope="col" class="num">Reorder at</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody id="i-rows"></tbody>
      </table>
      <div id="i-empty"></div>
    </section>
    <p class="result-count" id="i-count" aria-live="polite"></p>
  `;
  const rows = main.querySelector('#i-rows');
  const update = () => {
    const list = state.products.filter(matches).sort((a, b) => (filters.stock !== 'all' ? a.stock / a.reorder - b.stock / b.reorder : a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
    rows.innerHTML = list.map(rowHtml).join('');
    main.querySelector('#i-empty').innerHTML = list.length ? '' : emptyState('No products match', 'Try another search, category, or stock filter.');
    main.querySelector('#i-count').textContent = `Showing ${list.length} of ${state.products.length} products`;
    const v = state.products.reduce((a, p) => a + p.stock * p.cost, 0);
    main.querySelector('#i-sub').textContent = `${state.products.length} products · ${money(v)} on hand at cost · ${state.products.filter(isLow).length} low`;
  };
  update();
  main.querySelector('#i-q').addEventListener('input', (e) => { filters.q = e.target.value.trim(); update(); });
  main.querySelector('#i-cat').addEventListener('change', (e) => { filters.cat = e.target.value; update(); });
  main.querySelectorAll('[data-stock]').forEach((b) => b.addEventListener('click', () => {
    filters.stock = b.dataset.stock;
    if (b.dataset.stock !== 'low' && query.filter) history.replaceState(null, '', '#/inventory');
    main.querySelectorAll('[data-stock]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on); });
    update();
  }));
  rows.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-adjust]');
    if (!btn) return;
    const p = state.products.find((x) => x.id === btn.dataset.adjust);
    adjustStock(p, () => { update(); const again = rows.querySelector(`[data-adjust="${p.id}"]`); if (again) again.focus(); });
  });
  bindRowLinks(rows);
}

export function renderProductForm(ctx) {
  const { main, id } = ctx;
  const isNew = !id;
  const p = isNew ? { name: '', sku: '', category: 'Fishing', price: '', cost: '', stock: 0, reorder: 5, vendor: '', bin: '' } : state.products.find((x) => x.id === id);
  if (!p) { main.innerHTML = backLink('#/inventory', 'Inventory') + emptyState('Product not found', 'It may have been removed when the demo was reset.'); return; }
  ctx.setTitle(isNew ? 'New product' : p.name);
  const cats = [...new Set(state.products.map((x) => x.category))].sort();
  const vendors = [...new Set(state.products.map((x) => x.vendor))].sort();

  const sold = isNew ? [] : state.orders.filter((o) => o.items.some((i) => i.productId === p.id)).sort((a, b) => new Date(b.date) - new Date(a.date));
  const units30 = sold.reduce((s, o) => s + (o.status === 'cancelled' ? 0 : o.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.qty, 0)), 0);
  const margin = p.price && p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : null;

  main.innerHTML = `
    ${backLink('#/inventory', 'Inventory')}
    ${pageHead(isNew ? 'Add a product' : p.name, isNew ? 'New items appear in inventory and can be added to quotes right away.' : `<span class="mono">${esc(p.sku)}</span> · ${esc(p.category)} ${isLow(p) ? ' · ' + lowBadge() : ''}`,
      isNew ? '' : `<button type="button" class="btn btn--ghost" id="adj">${icon('edit')}Adjust stock</button>`)}
    <div class="detail-grid">
      <form class="card form-card" id="pform" novalidate>
        <div class="form-grid">
          <label class="field field--span2"><span class="field__label">Product name</span>
            <input name="name" required maxlength="80" value="${esc(p.name)}" placeholder="e.g. Spinning Reel, 3000 Size"></label>
          <label class="field"><span class="field__label">SKU</span>
            <input name="sku" required maxlength="20" pattern="[A-Za-z0-9\\-]+" value="${esc(p.sku)}" placeholder="REL-SP3000" class="mono" autocapitalize="characters">
            <span class="field__hint">Letters, numbers, and dashes</span></label>
          <label class="field"><span class="field__label">Category</span>
            <input name="category" required list="cat-list" value="${esc(p.category)}"><datalist id="cat-list">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
          <label class="field"><span class="field__label">Retail price ($)</span>
            <input name="price" type="number" min="0" step="0.01" required inputmode="decimal" value="${p.price}"></label>
          <label class="field"><span class="field__label">Unit cost ($)</span>
            <input name="cost" type="number" min="0" step="0.01" required inputmode="decimal" value="${p.cost}"></label>
          <label class="field"><span class="field__label">${isNew ? 'Starting stock' : 'On hand'}</span>
            <input name="stock" type="number" min="0" step="1" required inputmode="numeric" value="${p.stock}"></label>
          <label class="field"><span class="field__label">Reorder point</span>
            <input name="reorder" type="number" min="0" step="1" required inputmode="numeric" value="${p.reorder}">
            <span class="field__hint">Flag as low stock at or below this</span></label>
          <label class="field"><span class="field__label">Vendor</span>
            <input name="vendor" list="vendor-list" maxlength="60" value="${esc(p.vendor)}"><datalist id="vendor-list">${vendors.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></label>
          <label class="field"><span class="field__label">Bin / shelf</span>
            <input name="bin" maxlength="8" value="${esc(p.bin)}" placeholder="F3"></label>
        </div>
        <p class="form-error" id="perr" role="alert" hidden></p>
        <div class="form-actions">
          <a class="btn btn--ghost" href="#/inventory">Cancel</a>
          <button class="btn btn--primary" type="submit">${icon('check')}${isNew ? 'Add product' : 'Save changes'}</button>
        </div>
      </form>
      ${isNew ? `<aside class="card tip-card"><h2 class="card__title">${icon('inventory', 'icon--sm')} How stock alerts work</h2><p class="muted small">When on-hand drops to the reorder point, the product shows a Low stock badge and appears on the dashboard, so nothing sells out unnoticed.</p></aside>` : `
      <div class="stack">
        <section class="card">
          <div class="stat-row">
            <div><span class="stat-row__label">On hand</span><span class="stat-row__value">${p.stock}</span></div>
            <div><span class="stat-row__label">Sold (30 days)</span><span class="stat-row__value">${units30}</span></div>
            <div><span class="stat-row__label">Margin</span><span class="stat-row__value">${margin === null ? '—' : margin + '%'}</span></div>
          </div>
        </section>
        <section class="card">
          <div class="card__head"><h2 class="card__title">Recent orders</h2></div>
          ${sold.length ? `<ul class="mini-list">${sold.slice(0, 6).map((o) => {
            const c = customer(o.customerId); const q = o.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.qty, 0);
            return `<li><a class="mini-list__row" href="#/orders/${o.id}"><span class="mini-list__main"><span class="mini-list__title">#${o.number} · ${esc(c ? c.name : 'Walk-in')}</span><span class="mini-list__meta">${fmtDate(o.date)}</span></span><span class="mini-list__amt">×${q}</span></a></li>`;
          }).join('')}</ul>` : '<p class="muted small">No orders in the last 30 days.</p>'}
        </section>
      </div>`}
    </div>
  `;

  const form = main.querySelector('#pform');
  const err = main.querySelector('#perr');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(form).entries());
    const sku = d.sku.trim().toUpperCase();
    if (state.products.some((x) => x.sku === sku && x.id !== id)) { err.textContent = `SKU ${sku} is already used by another product.`; err.hidden = false; form.sku.focus(); return; }
    const data = {
      name: d.name.trim(), sku, category: d.category.trim(), price: round2(+d.price), cost: round2(+d.cost),
      stock: Math.max(0, parseInt(d.stock, 10) || 0), reorder: Math.max(0, parseInt(d.reorder, 10) || 0),
      vendor: d.vendor.trim() || 'Unassigned', bin: d.bin.trim().toUpperCase() || '—',
    };
    if (isNew) {
      let newId;
      commit((s) => { newId = 'p' + nextNumber('product'); s.products.push({ id: newId, ...data }); }, { kind: 'product', text: `Product added: ${data.name}`, href: '#/inventory' });
      toast(`${data.name} added to inventory`);
      location.hash = `#/inventory/${newId}`;
    } else {
      commit((s) => Object.assign(s.products.find((x) => x.id === id), data), { kind: 'product', text: `Product updated: ${data.name}`, href: `#/inventory/${id}` });
      toast('Changes saved');
      ctx.rerender();
    }
  });
  const adj = main.querySelector('#adj');
  if (adj) adj.addEventListener('click', () => adjustStock(p, () => ctx.rerender()));
}
