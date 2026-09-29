import { state, commit, customer, nextNumber } from '../store.js';
import { icon } from '../icons.js';
import { esc, fmtDate, JOB_STATUS, pageHead, toast, openDialog, badge, QUOTE_STATUS } from '../ui.js';
import { TECHS } from '../seed.js';

function promisedLabel(j) {
  const d = new Date(j.promised); const today = new Date(); today.setHours(0, 0, 0, 0);
  const pd = new Date(d); pd.setHours(0, 0, 0, 0);
  const diff = Math.round((pd - today) / 86400000);
  if (j.status === 'ready') return { text: 'Ready now', cls: 'is-ready' };
  if (diff < 0) return { text: `Overdue ${-diff} day${diff === -1 ? '' : 's'}`, cls: 'is-late' };
  if (diff === 0) return { text: 'Due today', cls: 'is-soon' };
  if (diff === 1) return { text: 'Due tomorrow', cls: '' };
  return { text: `Due ${fmtDate(j.promised, { weekday: 'short', month: 'short', day: 'numeric' })}`, cls: '' };
}

function cardHtml(j, colIdx) {
  const c = customer(j.customerId);
  const q = j.quoteId ? state.quotes.find((x) => x.id === j.quoteId) : null;
  const prev = JOB_STATUS[colIdx - 1]; const next = JOB_STATUS[colIdx + 1];
  const due = promisedLabel(j);
  return `<li class="job" draggable="true" data-job="${j.id}" aria-label="Job ${j.number}, ${esc(j.unit)}">
    <div class="job__top">
      <span class="job__num">#${j.number}</span>
      <span class="job__due ${due.cls}">${icon('clock', 'icon--xs')}${due.text}</span>
      <span class="job__grip" aria-hidden="true" title="Drag to move">${icon('grip', 'icon--sm')}</span>
    </div>
    <button type="button" class="job__title" data-open="${j.id}">${esc(j.unit)}</button>
    <p class="job__problem">${esc(j.problem)}</p>
    <div class="job__meta">
      <span>${icon('user', 'icon--xs')}${esc(c ? c.name : '—')}</span>
      <span>${icon('wrench', 'icon--xs')}${esc(j.tech)}</span>
    </div>
    ${q ? `<a class="job__quote" href="#/quotes/${q.id}">${icon('quotes', 'icon--xs')}Q-${q.number} ${badge(QUOTE_STATUS, q.status)}</a>` : ''}
    <div class="job__moves">
      <button type="button" class="btn btn--ghost btn--xs" data-move="${j.id}" data-to="${prev ? prev.key : ''}" ${prev ? '' : 'disabled'} aria-label="Move job ${j.number} back to ${prev ? prev.label : ''}">${icon('chevronLeft', 'icon--sm')}<span class="job__movelbl">${prev ? esc(prev.label) : 'Start'}</span></button>
      <button type="button" class="btn btn--ghost btn--xs" data-move="${j.id}" data-to="${next ? next.key : ''}" ${next ? '' : 'disabled'} aria-label="Move job ${j.number} forward to ${next ? next.label : ''}"><span class="job__movelbl">${next ? esc(next.label) : 'Done'}</span>${icon('chevronRight', 'icon--sm')}</button>
    </div>
  </li>`;
}

export function renderShop(ctx) {
  const { main } = ctx;
  const active = state.jobs.filter((j) => j.status !== 'ready').length;
  main.innerHTML = `
    ${pageHead('Service shop', `${state.jobs.length} jobs on the board · ${active} in the works`, `<button type="button" class="btn btn--primary" id="checkin">${icon('plus')}Check in a job</button>`)}
    <p class="muted small board-help">Drag cards between columns, or use the arrow buttons on each card (works with keyboard and touch). Select a job title for details.</p>
    <div class="board" id="board">
      ${JOB_STATUS.map((s, i) => {
        const jobs = state.jobs.filter((j) => j.status === s.key).sort((a, b) => new Date(a.promised) - new Date(b.promised));
        return `<section class="col col--${s.key}" data-col="${s.key}" aria-labelledby="col-${s.key}">
          <header class="col__head"><h2 id="col-${s.key}" class="col__title">${s.label}</h2><span class="col__count" aria-label="${jobs.length} jobs">${jobs.length}</span></header>
          <ul class="col__list" role="list">${jobs.map((j) => cardHtml(j, i)).join('') || '<li class="col__empty">Drop a job here</li>'}</ul>
        </section>`;
      }).join('')}
    </div>
  `;

  const board = main.querySelector('#board');
  const move = (jobId, to, focusDir) => {
    const j = state.jobs.find((x) => x.id === jobId);
    if (!j || !to || j.status === to) return;
    const label = JOB_STATUS.find((s) => s.key === to).label;
    commit((s) => {
      const job = s.jobs.find((x) => x.id === jobId);
      job.status = to;
      if (to !== 'checked_in' && job.tech === 'Unassigned') job.tech = TECHS[job.number % 2];
    }, { kind: 'job', text: `Job #${j.number} moved to ${label}`, href: '#/shop' });
    toast(`Job #${j.number} → ${label}`);
    ctx.rerender();
    const card = main.querySelector(`[data-job="${jobId}"]`);
    if (card) {
      const btns = card.querySelectorAll('[data-move]');
      const target = focusDir === 'back' ? btns[0] : btns[1];
      (target && !target.disabled ? target : card.querySelector('[data-open]')).focus();
      card.classList.add('job--flash');
    }
  };

  board.addEventListener('click', (e) => {
    const mv = e.target.closest('[data-move]');
    if (mv) { const back = mv === mv.parentElement.firstElementChild; move(mv.dataset.move, mv.dataset.to, back ? 'back' : 'fwd'); return; }
    const op = e.target.closest('[data-open]');
    if (op) openJob(op.dataset.open, ctx, move);
  });

  // Mouse drag and drop
  let dragId = null;
  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('[data-job]'); if (!card) return;
    dragId = card.dataset.job;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch { /* ignore */ }
    card.classList.add('is-dragging');
  });
  board.addEventListener('dragend', (e) => {
    const card = e.target.closest('[data-job]'); if (card) card.classList.remove('is-dragging');
    board.querySelectorAll('.col.is-over').forEach((c) => c.classList.remove('is-over'));
  });
  board.addEventListener('dragover', (e) => {
    const col = e.target.closest('[data-col]'); if (!col || !dragId) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    board.querySelectorAll('.col.is-over').forEach((c) => { if (c !== col) c.classList.remove('is-over'); });
    col.classList.add('is-over');
  });
  board.addEventListener('dragleave', (e) => {
    const col = e.target.closest('[data-col]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over');
  });
  board.addEventListener('drop', (e) => {
    const col = e.target.closest('[data-col]'); if (!col || !dragId) return;
    e.preventDefault();
    const id = dragId; dragId = null;
    move(id, col.dataset.col, 'fwd');
  });

  main.querySelector('#checkin').addEventListener('click', () => checkInDialog(ctx));
}

async function openJob(jobId, ctx, move) {
  const j = state.jobs.find((x) => x.id === jobId);
  const c = customer(j.customerId);
  const q = j.quoteId ? state.quotes.find((x) => x.id === j.quoteId) : null;
  const res = await openDialog({
    title: `Job #${j.number}`,
    bodyHtml: `
      <p class="job-dlg__unit"><strong>${esc(j.unit)}</strong><br><span class="muted">${esc(j.problem)}</span></p>
      <ul class="info-list">
        <li>${icon('user', 'icon--sm')}<span>${c ? `<a href="#/customers/${c.id}" data-close-nav>${esc(c.name)}</a> · ${esc(c.phone)}` : '—'}</span></li>
        <li>${icon('clock', 'icon--sm')}<span>Checked in ${fmtDate(j.checkedIn)} · promised ${fmtDate(j.promised)}</span></li>
      </ul>
      <div class="form-grid">
        <label class="field"><span class="field__label">Status</span>
          <select name="status">${JOB_STATUS.map((s) => `<option value="${s.key}"${s.key === j.status ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label>
        <label class="field"><span class="field__label">Technician</span>
          <select name="tech">${TECHS.map((t) => `<option${t === j.tech ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span class="field__label">Shop notes</span><textarea name="notes" rows="3" maxlength="400">${esc(j.notes)}</textarea></label>
      <p>${q ? `<a class="btn btn--ghost btn--sm" href="#/quotes/${q.id}" data-close-nav>${icon('quotes', 'icon--sm')}Open quote Q-${q.number}</a>` : `<a class="btn btn--ghost btn--sm" href="#/quotes/new?job=${j.id}" data-close-nav>${icon('plus', 'icon--sm')}Create a quote for this job</a>`}</p>`,
    actionsHtml: '<button class="btn btn--ghost" value="cancel" formnovalidate>Close</button><button class="btn btn--primary" value="ok">Save job</button>',
    onMount: (dlg, close) => {
      dlg.querySelectorAll('[data-close-nav]').forEach((a) => a.addEventListener('click', () => close(null)));
    },
  });
  if (!res) return;
  const statusChanged = res.status !== j.status;
  commit((s) => { const job = s.jobs.find((x) => x.id === jobId); job.tech = res.tech; job.notes = res.notes.trim(); },
    statusChanged ? null : { kind: 'job', text: `Job #${j.number} updated`, href: '#/shop' });
  if (statusChanged) move(jobId, res.status, 'fwd'); else { toast('Job saved'); ctx.rerender(); }
}

async function checkInDialog(ctx) {
  const custOpts = state.customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const res = await openDialog({
    title: 'Check in a job',
    bodyHtml: `
      <label class="field"><span class="field__label">Customer</span><select name="customerId" required autofocus><option value="">Choose…</option>${custOpts}</select></label>
      <label class="field"><span class="field__label">Boat, motor, or equipment</span><input name="unit" required maxlength="80" placeholder="e.g. 17′ bass boat · 90 hp outboard"></label>
      <label class="field"><span class="field__label">Customer’s description of the problem</span><input name="problem" required maxlength="100" placeholder="e.g. Loses power at full throttle"></label>
      <div class="form-grid">
        <label class="field"><span class="field__label">Promised in (days)</span><input name="days" type="number" min="0" max="30" value="3" required inputmode="numeric"></label>
        <label class="field"><span class="field__label">Technician</span><select name="tech">${TECHS.map((t) => `<option${t === 'Unassigned' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>`,
    actionsHtml: '<button class="btn btn--ghost" value="cancel" formnovalidate>Cancel</button><button class="btn btn--primary" value="ok">Check in</button>',
  });
  if (!res) return;
  let num;
  commit((s) => {
    num = nextNumber('job');
    const promised = new Date(); promised.setDate(promised.getDate() + (parseInt(res.days, 10) || 0)); promised.setHours(16, 0, 0, 0);
    s.jobs.push({ id: 'j' + num, number: num, customerId: res.customerId, unit: res.unit.trim(), problem: res.problem.trim(), status: 'checked_in', tech: res.tech, checkedIn: new Date().toISOString(), promised: promised.toISOString(), notes: '', quoteId: null });
  }, { kind: 'job', text: `Job checked in: ${res.unit.trim()}`, href: '#/shop' });
  toast(`Job #${num} checked in`);
  ctx.rerender();
  const card = document.querySelector(`[data-job="j${num}"] [data-open]`); if (card) card.focus();
}
