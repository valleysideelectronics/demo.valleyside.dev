import { state, orderTotals, isLow, customer } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, money0, isToday, relTime, fmtDate, badge, ORDER_STATUS, pageHead, JOB_STATUS } from '../ui.js';
import { dayKey } from '../seed.js';

const KIND_ICON = { order: 'orders', invoice: 'receipt', quote: 'quotes', job: 'wrench', stock: 'alert', product: 'inventory', customer: 'customers' };

function dailyRevenue() {
  const days = [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(start); d.setDate(d.getDate() - i);
    days.push({ key: dayKey(d), date: d, total: 0, count: 0 });
  }
  const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
  state.orders.forEach((o) => {
    if (o.status === 'cancelled') return;
    const i = idx[dayKey(o.date)];
    if (i === undefined) return;
    days[i].total += orderTotals(o).total; days[i].count += 1;
  });
  return days;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function drawChart(wrap, days) {
  const svgHost = wrap.querySelector('.chart__svg');
  const tip = wrap.querySelector('.chart__tip');
  const W = Math.max(280, svgHost.clientWidth);
  const H = 220;
  const m = { t: 12, r: 8, b: 26, l: 48 };
  const pw = W - m.l - m.r; const ph = H - m.t - m.b;
  const max = niceMax(Math.max(...days.map((d) => d.total)) * 1.08);
  const ticks = 4;
  const slot = pw / days.length;
  const gap = Math.max(2, Math.min(6, slot * 0.28));
  const bw = Math.max(2, slot - gap);
  const y = (v) => m.t + ph - (v / max) * ph;
  let g = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i; const yy = Math.round(y(v)) + 0.5;
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" class="chart__grid${i === 0 ? ' chart__base' : ''}"/>`;
    g += `<text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" class="chart__axis">${money0(v).replace('.00', '')}</text>`;
  }
  let bars = ''; let hits = ''; let labels = '';
  days.forEach((d, i) => {
    const x = m.l + i * slot + gap / 2;
    const h = Math.max(0, (d.total / max) * ph);
    const r = Math.min(4, bw / 2, h);
    const top = m.t + ph - h;
    if (h > 0) {
      bars += `<path class="chart__bar${i === days.length - 1 ? ' is-today' : ''}" data-i="${i}" d="M${x},${m.t + ph} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${m.t + ph} Z"/>`;
    }
    hits += `<rect class="chart__hit" data-i="${i}" x="${m.l + i * slot}" y="${m.t}" width="${slot}" height="${ph}"/>`;
    const every = slot < 16 ? 7 : slot < 26 ? 5 : 3;
    if ((days.length - 1 - i) % every === 0) {
      labels += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="chart__axis">${i === days.length - 1 ? 'Today' : d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>`;
    }
  });
  svgHost.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of daily order revenue for the last 30 days">${g}${bars}${labels}${hits}</svg>`;

  let active = -1;
  const show = (i) => {
    active = i;
    svgHost.querySelectorAll('.chart__bar').forEach((b) => b.classList.toggle('is-hover', +b.dataset.i === i));
    if (i < 0) { tip.hidden = true; return; }
    const d = days[i];
    tip.innerHTML = `<strong>${money(d.total)}</strong><span>${d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.count} order${d.count === 1 ? '' : 's'}</span>`;
    tip.hidden = false;
    const cx = m.l + i * slot + slot / 2;
    const tw = tip.offsetWidth;
    const left = Math.min(Math.max(cx - tw / 2, 0), W - tw);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, y(d.total) - tip.offsetHeight - 10) + 'px';
  };
  svgHost.querySelectorAll('.chart__hit').forEach((h) => {
    h.addEventListener('pointerenter', () => show(+h.dataset.i));
    h.addEventListener('pointerdown', () => show(+h.dataset.i));
  });
  svgHost.addEventListener('pointerleave', () => show(-1));
  wrap.onkeydown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = active < 0 ? days.length - 1 : Math.min(days.length - 1, Math.max(0, active + (e.key === 'ArrowRight' ? 1 : -1)));
      show(n);
    } else if (e.key === 'Escape') show(-1);
  };
  wrap.onfocus = () => { if (active < 0) show(days.length - 1); };
  wrap.onblur = () => show(-1);
}

export function renderDashboard({ main }) {
  const today = state.orders.filter((o) => isToday(o.date) && o.status !== 'cancelled');
  const todaySales = today.reduce((s, o) => s + orderTotals(o).total, 0);
  const days = dailyRevenue();
  const month = days.reduce((s, d) => s + d.total, 0);
  const avg = month / days.length;
  const open = state.orders.filter((o) => o.status === 'new' || o.status === 'packed');
  const newCount = open.filter((o) => o.status === 'new').length;
  const low = state.products.filter(isLow).sort((a, b) => a.stock / a.reorder - b.stock / b.reorder);
  const jobsIn = state.jobs.filter((j) => j.status !== 'ready');
  const ready = state.jobs.filter((j) => j.status === 'ready').length;
  const unpaidInv = state.invoices.filter((i) => i.status === 'unpaid').length;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const vsAvg = avg ? Math.round(((todaySales - avg) / avg) * 100) : 0;

  main.innerHTML = `
    ${pageHead(`${greet}, Maggie`, `Here’s the store as of ${new Date().toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.`,
      `<a class="btn btn--ghost" href="#/quotes/new">${icon('plus')}New quote</a><a class="btn btn--primary" href="#/orders?status=open">${icon('orders')}Open orders</a>`)}

    <section class="kpis" aria-label="Key numbers">
      <a class="kpi" href="#/orders">
        <span class="kpi__icon kpi__icon--green">${icon('dollar')}</span>
        <span class="kpi__label">Today’s sales</span>
        <span class="kpi__value">${money(todaySales)}</span>
        <span class="kpi__meta">${today.length} order${today.length === 1 ? '' : 's'} · ${vsAvg >= 0 ? '+' : ''}${vsAvg}% vs 30-day avg</span>
      </a>
      <a class="kpi" href="#/orders?status=open">
        <span class="kpi__icon kpi__icon--blue">${icon('orders')}</span>
        <span class="kpi__label">Open orders</span>
        <span class="kpi__value">${open.length}</span>
        <span class="kpi__meta">${newCount} new · ${open.length - newCount} packed</span>
      </a>
      <a class="kpi" href="#/inventory?filter=low">
        <span class="kpi__icon kpi__icon--red">${icon('alert')}</span>
        <span class="kpi__label">Low-stock items</span>
        <span class="kpi__value">${low.length}</span>
        <span class="kpi__meta">At or below reorder point</span>
      </a>
      <a class="kpi" href="#/shop">
        <span class="kpi__icon kpi__icon--amber">${icon('wrench')}</span>
        <span class="kpi__label">Jobs in the shop</span>
        <span class="kpi__value">${jobsIn.length}</span>
        <span class="kpi__meta">${ready} ready for pickup · ${unpaidInv} unpaid invoice${unpaidInv === 1 ? '' : 's'}</span>
      </a>
    </section>

    <div class="grid-2">
      <section class="card card--chart" aria-labelledby="rev-h">
        <div class="card__head">
          <div>
            <h2 id="rev-h" class="card__title">Order revenue · last 30 days</h2>
            <p class="card__sub">${money(month)} total · ${money(avg)} daily average</p>
          </div>
        </div>
        <div class="chart" tabindex="0" aria-describedby="chart-help">
          <div class="chart__svg"></div>
          <div class="chart__tip" hidden></div>
        </div>
        <p id="chart-help" class="sr-only">Use the left and right arrow keys to read each day’s total.</p>
        <details class="chart__table">
          <summary>View as table</summary>
          <div class="table-scroll">
            <table class="table table--compact">
              <thead><tr><th scope="col">Date</th><th scope="col" class="num">Orders</th><th scope="col" class="num">Revenue</th></tr></thead>
              <tbody>${days.slice().reverse().map((d) => `<tr><td>${d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td><td class="num">${d.count}</td><td class="num">${money(d.total)}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </details>
      </section>

      <section class="card" aria-labelledby="act-h">
        <div class="card__head"><h2 id="act-h" class="card__title">Recent activity</h2></div>
        <ol class="feed">
          ${state.activity.slice(0, 8).map((a) => `
            <li class="feed__item">
              <span class="feed__icon feed__icon--${a.kind}">${icon(KIND_ICON[a.kind] || 'box', 'icon--sm')}</span>
              <div class="feed__body"><a href="${esc(a.href || '#/dashboard')}">${esc(a.text)}</a><time datetime="${esc(a.time)}">${relTime(a.time)}</time></div>
            </li>`).join('')}
        </ol>
      </section>
    </div>

    <div class="grid-2 grid-2--even">
      <section class="card" aria-labelledby="low-h">
        <div class="card__head">
          <h2 id="low-h" class="card__title">Low-stock alerts</h2>
          <a class="link-sm" href="#/inventory?filter=low">View all ${icon('chevronRight', 'icon--xs')}</a>
        </div>
        ${low.length ? `<ul class="mini-list">${low.slice(0, 6).map((p) => `
          <li><a href="#/inventory/${p.id}" class="mini-list__row">
            <span class="mini-list__main"><span class="mini-list__title">${esc(p.name)}</span><span class="mini-list__meta">${esc(p.sku)} · reorder at ${p.reorder}</span></span>
            <span class="stockpill ${p.stock === 0 ? 'is-out' : ''}">${p.stock} left</span>
          </a></li>`).join('')}</ul>` : '<p class="muted pad">Everything is above its reorder point.</p>'}
      </section>

      <section class="card" aria-labelledby="open-h">
        <div class="card__head">
          <h2 id="open-h" class="card__title">Orders to fulfill</h2>
          <a class="link-sm" href="#/orders?status=open">View all ${icon('chevronRight', 'icon--xs')}</a>
        </div>
        ${open.length ? `<ul class="mini-list">${open.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6).map((o) => {
          const c = customer(o.customerId);
          return `<li><a href="#/orders/${o.id}" class="mini-list__row">
            <span class="mini-list__main"><span class="mini-list__title">#${o.number} · ${esc(c ? c.name : 'Walk-in')}</span><span class="mini-list__meta">${o.fulfillment === 'ship' ? 'Ship' : 'Pickup'} · ${relTime(o.date)}</span></span>
            <span class="mini-list__end">${badge(ORDER_STATUS, o.status)}<span class="mini-list__amt">${money(orderTotals(o).total)}</span></span>
          </a></li>`;
        }).join('')}</ul>` : '<p class="muted pad">No open orders. Nice work.</p>'}
      </section>
    </div>

    <section class="card" aria-labelledby="shop-h">
      <div class="card__head">
        <h2 id="shop-h" class="card__title">Service shop at a glance</h2>
        <a class="link-sm" href="#/shop">Open board ${icon('chevronRight', 'icon--xs')}</a>
      </div>
      <div class="shop-strip">
        ${JOB_STATUS.map((s) => {
          const n = state.jobs.filter((j) => j.status === s.key).length;
          return `<a class="shop-strip__col shop-strip__col--${s.key}" href="#/shop"><span class="shop-strip__n">${n}</span><span class="shop-strip__label">${s.label}</span></a>`;
        }).join('')}
      </div>
    </section>
    <p class="fineprint">All figures are sample data. Dates shift so the last 30 days always end today.</p>
  `;

  const wrap = main.querySelector('.chart');
  drawChart(wrap, days);
  if ('ResizeObserver' in window) {
    let w = wrap.clientWidth;
    const ro = new ResizeObserver(() => {
      if (!document.body.contains(wrap)) { ro.disconnect(); return; }
      if (Math.abs(wrap.clientWidth - w) > 4) { w = wrap.clientWidth; drawChart(wrap, days); }
    });
    ro.observe(wrap);
  }
}
