import { state, commit, docTotals, customer, round2, nextNumber } from '../store.js';
import { icon, brandMark } from '../icons.js';
import { esc, money, fmtDate, badge, QUOTE_STATUS, INVOICE_STATUS, pageHead, backLink, toast, confirmDialog, emptyState } from '../ui.js';
import { LABOR_RATE, SERVICE_PRESETS, TAX_RATE } from '../seed.js';
import { bindRowLinks } from './orders.js';
import { newCustomerDialog } from './customers.js';

export const STORE_INFO = {
  name: 'Kettle Ridge Outfitters',
  address: '4410 Harbor Bend Rd',
  city: 'Kettle Ridge, KY',
  phone: '(606) 555-0100',
  email: 'kettleridge.service@example.com',
};

let tab = 'quotes';

export function renderQuotes({ main, query }) {
  if (query.tab === 'invoices') tab = 'invoices';
  const quotes = state.quotes.slice().sort((a, b) => b.number - a.number);
  const invoices = state.invoices.slice().sort((a, b) => b.number - a.number);
  const openQuoteValue = quotes.filter((q) => q.status === 'sent' || q.status === 'accepted').reduce((s, q) => s + docTotals(q.lines).total, 0);
  const unpaid = invoices.filter((i) => i.status === 'unpaid').reduce((s, i) => s + docTotals(i.lines).total, 0);

  main.innerHTML = `
    ${pageHead('Quotes & invoices', `${money(openQuoteValue)} in open quotes · ${money(unpaid)} unpaid on invoices`, `<a class="btn btn--primary" href="#/quotes/new">${icon('plus')}New quote</a>`)}
    <div class="tabs" role="tablist" aria-label="Documents">
      <button role="tab" id="tab-quotes" aria-controls="panel-quotes" aria-selected="${tab === 'quotes'}" tabindex="${tab === 'quotes' ? 0 : -1}" class="tab">Quotes <span class="chip__n">${quotes.length}</span></button>
      <button role="tab" id="tab-invoices" aria-controls="panel-invoices" aria-selected="${tab === 'invoices'}" tabindex="${tab === 'invoices' ? 0 : -1}" class="tab">Invoices <span class="chip__n">${invoices.length}</span></button>
    </div>
    <section class="card card--flush" role="tabpanel" id="panel-quotes" aria-labelledby="tab-quotes" ${tab === 'quotes' ? '' : 'hidden'}>
      ${quotes.length ? `<table class="table table--cards" aria-label="Quotes">
        <thead><tr><th scope="col">Quote</th><th scope="col">Customer</th><th scope="col">Work</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody class="doc-rows">${quotes.map((q) => {
          const c = customer(q.customerId);
          return `<tr class="row-link" data-href="#/quotes/${q.id}">
            <td data-label="Quote"><a class="strong-link" href="#/quotes/${q.id}">Q-${q.number}</a></td>
            <td data-label="Customer">${esc(c ? c.name : '—')}</td>
            <td data-label="Work">${esc(q.title || 'Service quote')}</td>
            <td data-label="Date">${fmtDate(q.date)}</td>
            <td data-label="Status">${badge(QUOTE_STATUS, q.status)}</td>
            <td data-label="Total" class="num strong td-top">${money(docTotals(q.lines).total)}</td></tr>`;
        }).join('')}</tbody></table>` : emptyState('No quotes yet', 'Create a quote for a service job to get started.')}
    </section>
    <section class="card card--flush" role="tabpanel" id="panel-invoices" aria-labelledby="tab-invoices" ${tab === 'invoices' ? '' : 'hidden'}>
      ${invoices.length ? `<table class="table table--cards" aria-label="Invoices">
        <thead><tr><th scope="col">Invoice</th><th scope="col">Customer</th><th scope="col">From quote</th><th scope="col">Issued</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col" class="num">Total</th></tr></thead>
        <tbody class="doc-rows">${invoices.map((i) => {
          const c = customer(i.customerId); const q = state.quotes.find((x) => x.id === i.quoteId);
          return `<tr class="row-link" data-href="#/invoices/${i.id}">
            <td data-label="Invoice"><a class="strong-link" href="#/invoices/${i.id}">INV-${i.number}</a></td>
            <td data-label="Customer">${esc(c ? c.name : '—')}</td>
            <td data-label="From quote">${q ? 'Q-' + q.number : '—'}</td>
            <td data-label="Issued">${fmtDate(i.date)}</td>
            <td data-label="Due">${fmtDate(i.due)}</td>
            <td data-label="Status">${badge(INVOICE_STATUS, i.status)}</td>
            <td data-label="Total" class="num strong td-top">${money(docTotals(i.lines).total)}</td></tr>`;
        }).join('')}</tbody></table>` : emptyState('No invoices yet', 'Convert an accepted quote into an invoice and it will appear here.')}
    </section>
  `;
  main.querySelectorAll('.doc-rows').forEach(bindRowLinks);
  const tabs = [...main.querySelectorAll('[role="tab"]')];
  const select = (t) => {
    tab = t.id === 'tab-quotes' ? 'quotes' : 'invoices';
    tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; main.querySelector('#' + x.getAttribute('aria-controls')).hidden = !on; });
    t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]); }
    });
  });
}

// ---------- quote editor ----------
function partOptions() {
  const cats = [...new Set(state.products.map((p) => p.category))].sort();
  return cats.map((c) => `<optgroup label="${esc(c)}">${state.products.filter((p) => p.category === c).sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<option value="${p.id}">${esc(p.name)} · ${money(p.price)}${p.stock === 0 ? ' (out of stock)' : ''}</option>`).join('')}</optgroup>`).join('');
}

function totalsHtml(t) {
  return `<dl class="totals totals--doc">
    <div><dt>Labor</dt><dd>${money(t.labor)}</dd></div>
    <div><dt>Parts</dt><dd>${money(t.parts)}</dd></div>
    <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
    <div><dt>Sales tax (${Math.round(TAX_RATE * 100)}%)</dt><dd>${money(t.tax)}</dd></div>
    <div class="totals__grand"><dt>Total</dt><dd>${money(t.total)}</dd></div>
  </dl>`;
}

export function renderQuoteEditor(ctx) {
  const { main, id, query } = ctx;
  const existing = id ? state.quotes.find((q) => q.id === id) : null;
  if (id && !existing) { main.innerHTML = backLink('#/quotes', 'Quotes & invoices') + emptyState('Quote not found', 'It may have been removed when the demo was reset.'); return; }

  const job = !existing && query.job ? state.jobs.find((j) => j.id === query.job) : null;
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: null, number: null, customerId: job ? job.customerId : (query.customer || ''), jobId: job ? job.id : '',
    title: job ? job.problem : '', status: 'draft', invoiceId: null, notes: '', date: new Date().toISOString(),
    lines: [{ type: 'labor', desc: 'Diagnostic inspection', qty: 1, rate: LABOR_RATE }],
  };
  const locked = draft.status === 'invoiced';
  ctx.setTitle(existing ? `Quote Q-${existing.number}` : 'New quote');

  if (locked) { renderLockedQuote(ctx, draft); return; }

  const custOpts = state.customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}"${draft.customerId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const jobOpts = state.jobs.map((j) => `<option value="${j.id}"${draft.jobId === j.id ? ' selected' : ''}>#${j.number} · ${esc(j.unit)}</option>`).join('');

  main.innerHTML = `
    ${backLink('#/quotes', 'Quotes & invoices')}
    ${pageHead(existing ? `Quote Q-${existing.number}` : 'New service quote', existing ? `Created ${fmtDate(existing.date)} · ${badge(QUOTE_STATUS, existing.status)}` : `Labor at ${money(LABOR_RATE)}/hr · parts at retail · ${Math.round(TAX_RATE * 100)}% Kentucky sales tax`)}
    <form id="qform" class="detail-grid detail-grid--wide" novalidate>
      <div class="stack">
        <section class="card">
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="q-cust">Customer</label>
              <div class="input-row">
                <select id="q-cust" name="customerId" required><option value="">Choose a customer…</option>${custOpts}</select>
                <button type="button" class="btn btn--ghost btn--sm" id="q-newcust">${icon('plus', 'icon--sm')}New</button>
              </div>
            </div>
            <label class="field"><span class="field__label">Linked shop job (optional)</span>
              <select name="jobId" id="q-job"><option value="">None</option>${jobOpts}</select></label>
            <label class="field field--span2"><span class="field__label">Work description</span>
              <input name="title" id="q-title" maxlength="90" value="${esc(draft.title)}" placeholder="e.g. Lower unit service and prop replacement"></label>
          </div>
        </section>

        <section class="card card--flush">
          <div class="card__head card__head--pad"><h2 class="card__title">Line items</h2></div>
          <div class="lines" id="lines"></div>
          <div class="add-lines">
            <div class="add-lines__group">
              <button type="button" class="btn btn--ghost btn--sm" id="add-labor">${icon('wrench', 'icon--sm')}Add labor</button>
              <div class="presets" aria-label="Common labor">
                ${SERVICE_PRESETS.map((p, i) => `<button type="button" class="chip chip--sm" data-preset="${i}">${esc(p.desc)} · ${p.hours} h</button>`).join('')}
              </div>
            </div>
            <div class="add-lines__group add-lines__parts">
              <label class="sr-only" for="part-pick">Part from inventory</label>
              <select id="part-pick">${partOptions()}</select>
              <button type="button" class="btn btn--ghost btn--sm" id="add-part">${icon('inventory', 'icon--sm')}Add part</button>
            </div>
          </div>
        </section>

        <section class="card">
          <label class="field"><span class="field__label">Notes to customer</span>
            <textarea name="notes" id="q-notes" rows="3" maxlength="400" placeholder="Warranty terms, assumptions, pickup details…">${esc(draft.notes)}</textarea></label>
        </section>
      </div>

      <aside class="stack sticky-side">
        <section class="card">
          <div class="card__head"><h2 class="card__title">Summary</h2>${existing ? badge(QUOTE_STATUS, draft.status) : '<span class="badge badge--muted">Unsaved</span>'}</div>
          <div id="q-totals"></div>
          <p class="form-error" id="qerr" role="alert" hidden></p>
          <div class="stack-sm">
            <button type="submit" class="btn btn--primary btn--block" value="save">${icon('check')}${existing ? 'Save changes' : 'Save quote'}</button>
            ${draft.status === 'draft' ? `<button type="submit" class="btn btn--ghost btn--block" value="sent">${icon('mail')}Save &amp; mark sent</button>` : ''}
            ${draft.status === 'sent' ? `<button type="submit" class="btn btn--ghost btn--block" value="accepted">${icon('check')}Customer accepted</button>` : ''}
            <button type="submit" class="btn btn--accent btn--block" value="invoice">${icon('convert')}Convert to invoice</button>
          </div>
          <p class="muted small">Demo: marking a quote sent doesn’t email anyone. Converting deducts parts from inventory.</p>
        </section>
      </aside>
    </form>
  `;

  const linesEl = main.querySelector('#lines');
  const totalsEl = main.querySelector('#q-totals');
  const paintTotals = () => { totalsEl.innerHTML = totalsHtml(docTotals(draft.lines)); };

  const paintLines = (focusIdx = null) => {
    if (!draft.lines.length) { linesEl.innerHTML = '<p class="muted pad">No line items yet. Add labor or parts below.</p>'; paintTotals(); return; }
    linesEl.innerHTML = `
      <div class="line line--head" aria-hidden="true"><span>Type</span><span>Description</span><span class="num">Qty / hrs</span><span class="num">Rate</span><span class="num">Amount</span><span></span></div>
      ${draft.lines.map((l, i) => `
        <div class="line" data-i="${i}">
          <span class="line__type"><span class="tag ${l.type === 'labor' ? 'tag--labor' : 'tag--part'}">${l.type === 'labor' ? 'Labor' : 'Part'}</span></span>
          <label class="line__desc"><span class="sr-only">Description, line ${i + 1}</span><input data-f="desc" value="${esc(l.desc)}" maxlength="90" required></label>
          <label class="line__qty"><span class="line__lbl">${l.type === 'labor' ? 'Hours' : 'Qty'}</span><input data-f="qty" type="number" min="0.25" step="${l.type === 'labor' ? '0.25' : '1'}" value="${l.qty}" inputmode="decimal" required aria-label="${l.type === 'labor' ? 'Hours' : 'Quantity'}, line ${i + 1}"></label>
          <label class="line__rate"><span class="line__lbl">Rate</span><input data-f="rate" type="number" min="0" step="0.01" value="${l.rate}" inputmode="decimal" required aria-label="Rate, line ${i + 1}"></label>
          <span class="line__amt num" data-amt>${money(l.qty * l.rate)}</span>
          <button type="button" class="icon-btn icon-btn--danger" data-remove="${i}" aria-label="Remove line ${i + 1}">${icon('trash', 'icon--sm')}</button>
        </div>`).join('')}`;
    paintTotals();
    if (focusIdx !== null) {
      const row = linesEl.querySelector(`[data-i="${focusIdx}"] input[data-f="${draft.lines[focusIdx]?.type === 'labor' ? 'qty' : 'qty'}"]`);
      if (row) row.focus();
    }
  };
  paintLines();

  linesEl.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-f]'); if (!inp) return;
    const i = +inp.closest('[data-i]').dataset.i; const f = inp.dataset.f;
    draft.lines[i][f] = f === 'desc' ? inp.value : Math.max(0, parseFloat(inp.value) || 0);
    inp.closest('[data-i]').querySelector('[data-amt]').textContent = money(draft.lines[i].qty * draft.lines[i].rate);
    paintTotals();
  });
  linesEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]'); if (!b) return;
    draft.lines.splice(+b.dataset.remove, 1);
    paintLines();
    const next = linesEl.querySelector('[data-remove]') || main.querySelector('#add-labor');
    next.focus();
  });
  const addLine = (l) => { draft.lines.push(l); paintLines(draft.lines.length - 1); };
  main.querySelector('#add-labor').addEventListener('click', () => addLine({ type: 'labor', desc: 'Shop labor', qty: 1, rate: LABOR_RATE }));
  main.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = SERVICE_PRESETS[+b.dataset.preset]; addLine({ type: 'labor', desc: p.desc, qty: p.hours, rate: LABOR_RATE });
  }));
  main.querySelector('#add-part').addEventListener('click', () => {
    const p = state.products.find((x) => x.id === main.querySelector('#part-pick').value); if (!p) return;
    const ex = draft.lines.find((l) => l.productId === p.id);
    if (ex) { ex.qty += 1; paintLines(draft.lines.indexOf(ex)); toast(`${p.name}: quantity now ${ex.qty}`); return; }
    addLine({ type: 'part', productId: p.id, desc: `${p.name} (${p.sku})`, qty: 1, rate: p.price });
  });
  main.querySelector('#q-newcust').addEventListener('click', async () => {
    const cid = await newCustomerDialog(); if (!cid) return;
    const sel = main.querySelector('#q-cust'); const c = customer(cid);
    sel.insertAdjacentHTML('beforeend', `<option value="${cid}">${esc(c.name)}</option>`); sel.value = cid; draft.customerId = cid; sel.focus();
  });
  main.querySelector('#q-job').addEventListener('change', (e) => {
    const j = state.jobs.find((x) => x.id === e.target.value);
    if (j) {
      const sel = main.querySelector('#q-cust'); if (!sel.value) sel.value = j.customerId;
      const t = main.querySelector('#q-title'); if (!t.value) t.value = j.problem;
    }
  });

  const form = main.querySelector('#qform');
  const err = main.querySelector('#qerr');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = (e.submitter && e.submitter.value) || 'save';
    err.hidden = true;
    draft.customerId = form.customerId.value;
    draft.jobId = form.jobId.value || null;
    draft.title = main.querySelector('#q-title').value.trim();
    draft.notes = main.querySelector('#q-notes').value.trim();
    if (!draft.customerId) { err.textContent = 'Choose a customer for this quote.'; err.hidden = false; form.customerId.focus(); return; }
    if (!draft.lines.length) { err.textContent = 'Add at least one line item.'; err.hidden = false; main.querySelector('#add-labor').focus(); return; }
    const bad = draft.lines.findIndex((l) => !l.desc.trim() || !(l.qty > 0));
    if (bad >= 0) { err.textContent = `Line ${bad + 1} needs a description and a quantity above zero.`; err.hidden = false; linesEl.querySelector(`[data-i="${bad}"] input`).focus(); return; }
    if (action === 'invoice' && !(await confirmDialog('Convert to invoice?', 'This creates an invoice due in 14 days, locks the quote, and deducts the quoted parts from inventory.', 'Create invoice'))) return;

    draft.lines = draft.lines.map((l) => ({ ...l, desc: l.desc.trim(), qty: round2(l.qty), rate: round2(l.rate) }));
    if (action === 'sent') draft.status = 'sent';
    if (action === 'accepted') draft.status = 'accepted';
    const isNew = !draft.id;
    if (isNew) { draft.number = nextNumber('quote'); draft.id = 'q' + draft.number; draft.date = new Date().toISOString(); }
    const qid = draft.id;
    commit((s) => {
      if (isNew) s.quotes.push(JSON.parse(JSON.stringify(draft)));
      else Object.assign(s.quotes.find((q) => q.id === qid), JSON.parse(JSON.stringify(draft)));
      if (draft.jobId) { const j = s.jobs.find((x) => x.id === draft.jobId); if (j && !j.quoteId) j.quoteId = qid; }
    }, { kind: 'quote', text: isNew ? `Quote Q-${draft.number} created (${money(docTotals(draft.lines).total)})` : action === 'sent' ? `Quote Q-${draft.number} marked sent` : action === 'accepted' ? `Quote Q-${draft.number} accepted` : `Quote Q-${draft.number} updated`, href: `#/quotes/${draft.id}` });

    if (action === 'invoice') {
      const invId = convertToInvoice(qid);
      toast('Invoice created');
      location.hash = `#/invoices/${invId}`;
      return;
    }
    toast(isNew ? `Quote Q-${draft.number} saved` : 'Quote saved');
    if (isNew) location.hash = `#/quotes/${qid}`; else ctx.rerender();
  });
}

function convertToInvoice(qid) {
  const q = state.quotes.find((x) => x.id === qid);
  const n = nextNumber('invoice');
  const invId = 'i' + n;
  commit((s) => {
    const quote = s.quotes.find((x) => x.id === qid);
    const now = new Date(); const due = new Date(now); due.setDate(due.getDate() + 14);
    s.invoices.push({ id: invId, number: n, quoteId: qid, customerId: quote.customerId, date: now.toISOString(), due: due.toISOString(), lines: JSON.parse(JSON.stringify(quote.lines)), status: 'unpaid', title: quote.title, notes: quote.notes });
    quote.status = 'invoiced'; quote.invoiceId = invId;
    quote.lines.filter((l) => l.productId).forEach((l) => { const p = s.products.find((x) => x.id === l.productId); if (p) p.stock = Math.max(0, p.stock - Math.round(l.qty)); });
  }, { kind: 'invoice', text: `Invoice INV-${n} created from quote Q-${q.number}`, href: `#/invoices/${invId}` });
  return invId;
}

function docLinesTable(lines) {
  return `<table class="doc-table">
    <thead><tr><th scope="col">Description</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Rate</th><th scope="col" class="num">Amount</th></tr></thead>
    <tbody>${lines.map((l) => `<tr><td><span class="doc-type">${l.type === 'labor' ? 'Labor' : 'Part'}</span> ${esc(l.desc)}</td><td class="num">${l.qty}</td><td class="num">${money(l.rate)}</td><td class="num">${money(l.qty * l.rate)}</td></tr>`).join('')}</tbody>
  </table>`;
}

function renderLockedQuote(ctx, q) {
  const { main } = ctx;
  const c = customer(q.customerId);
  const inv = state.invoices.find((i) => i.id === q.invoiceId);
  main.innerHTML = `
    ${backLink('#/quotes', 'Quotes & invoices')}
    ${pageHead(`Quote Q-${q.number}`, `${esc(c ? c.name : '')} · ${fmtDate(q.date)} · ${badge(QUOTE_STATUS, q.status)}`, inv ? `<a class="btn btn--primary" href="#/invoices/${inv.id}">${icon('receipt')}View invoice INV-${inv.number}</a>` : '')}
    <section class="card">
      <p class="muted small">This quote was converted to an invoice and is now read-only.</p>
      <h2 class="card__title">${esc(q.title || 'Service quote')}</h2>
      <div class="table-scroll">${docLinesTable(q.lines)}</div>
      ${totalsHtml(docTotals(q.lines))}
    </section>`;
}

// ---------- invoice ----------
export function renderInvoice(ctx) {
  const { main, id } = ctx;
  const inv = state.invoices.find((i) => i.id === id);
  if (!inv) { main.innerHTML = backLink('#/quotes?tab=invoices', 'Invoices') + emptyState('Invoice not found', 'It may have been removed when the demo was reset.'); return; }
  ctx.setTitle(`Invoice INV-${inv.number}`);
  const c = customer(inv.customerId);
  const q = state.quotes.find((x) => x.id === inv.quoteId);
  const job = q && q.jobId ? state.jobs.find((j) => j.id === q.jobId) : null;
  const t = docTotals(inv.lines);

  main.innerHTML = `
    <div class="no-print">
      ${backLink('#/quotes?tab=invoices', 'Invoices')}
      ${pageHead(`Invoice INV-${inv.number}`, `${esc(c ? c.name : '')} · ${badge(INVOICE_STATUS, inv.status)}`,
        `${inv.status === 'unpaid' ? `<button type="button" class="btn btn--ghost" id="mark-paid">${icon('check')}Mark paid</button>` : ''}<button type="button" class="btn btn--primary" id="print">${icon('printer')}Print</button>`)}
    </div>
    <article class="invoice" aria-label="Invoice document">
      <header class="invoice__head">
        <div class="invoice__brand">
          <span class="invoice__logo">${brandMark}</span>
          <div><strong class="invoice__store">${STORE_INFO.name}</strong><span>${STORE_INFO.address}</span><span>${STORE_INFO.city}</span><span>${STORE_INFO.phone} · ${STORE_INFO.email}</span></div>
        </div>
        <div class="invoice__meta">
          <h2 class="invoice__title">Invoice</h2>
          <dl>
            <div><dt>Invoice #</dt><dd>INV-${inv.number}</dd></div>
            <div><dt>Issued</dt><dd>${fmtDate(inv.date)}</dd></div>
            <div><dt>Due</dt><dd>${fmtDate(inv.due)}</dd></div>
            ${q ? `<div><dt>Quote</dt><dd>Q-${q.number}</dd></div>` : ''}
          </dl>
        </div>
      </header>
      <div class="invoice__parties">
        <div><h3>Bill to</h3>${c ? `<p><strong>${esc(c.name)}</strong><br>${esc(c.address)}<br>${esc(c.city)}<br>${esc(c.phone)}<br>${esc(c.email)}</p>` : '<p>—</p>'}</div>
        <div><h3>Service</h3><p><strong>${esc(inv.title || 'Service work')}</strong>${job ? `<br>Job #${job.number}<br>${esc(job.unit)}` : ''}</p></div>
        <div class="invoice__status"><h3>Status</h3><p class="invoice__stamp invoice__stamp--${inv.status}">${inv.status === 'paid' ? 'Paid' : 'Balance due'}</p>${inv.status === 'paid' && inv.paidOn ? `<p class="small">Paid ${fmtDate(inv.paidOn)}</p>` : ''}</div>
      </div>
      <div class="table-scroll">${docLinesTable(inv.lines)}</div>
      <div class="invoice__foot">
        <div class="invoice__notes">
          ${inv.notes ? `<h3>Notes</h3><p>${esc(inv.notes)}</p>` : ''}
          <h3>Terms</h3><p>Payment due within 14 days. Pay at the Harbor Bend counter or call the service desk. Labor warrantied 90 days.</p>
        </div>
        ${totalsHtml(t)}
      </div>
      <p class="invoice__sample">Sample invoice for a fictional business · Demo by Valleyside Electronics LLC</p>
    </article>
  `;
  main.querySelector('#print').addEventListener('click', () => window.print());
  const mp = main.querySelector('#mark-paid');
  if (mp) mp.addEventListener('click', () => {
    commit((s) => { const x = s.invoices.find((i) => i.id === inv.id); x.status = 'paid'; x.paidOn = new Date().toISOString(); },
      { kind: 'invoice', text: `Invoice INV-${inv.number} paid (${money(t.total)})`, href: `#/invoices/${inv.id}` });
    toast(`INV-${inv.number} marked paid`);
    ctx.rerender();
  });
}
