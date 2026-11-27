// createdbyjerry: Resume page behaviour (no dependencies).
// The resume content lives in the HTML (readable without JS, by ATS and by print);
// this file only layers interaction on top of it.
(() => {
  const roles = [...document.querySelectorAll('.rs-role')];
  if (!roles.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---- Dates -----------------------------------------------------------
  const now = new Date();
  const toIndex = (v) => {
    if (v === 'now') return now.getFullYear() * 12 + now.getMonth();
    const [y, m] = v.split('-').map(Number);
    return y * 12 + (m - 1);
  };
  const span = (role) => [toIndex(role.dataset.start), toIndex(role.dataset.end)];
  const duration = (a, b) => {
    const months = b - a + 1;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return [y && `${y} yr${y > 1 ? 's' : ''}`, m && `${m} mo`].filter(Boolean).join(' ');
  };

  // Add a duration line under each date ("1 yr 7 mo")
  roles.forEach((role) => {
    const [a, b] = span(role);
    const when = role.querySelector('.rs-role__when');
    if (when) when.insertAdjacentHTML('beforeend', `<br><span class="text-highlight">${duration(a, b)}</span>`);
  });

  // ---- Open the most recent full-time roles by default ------------------
  roles.slice(0, 2).forEach((r) => { const d = r.querySelector('details'); if (d) d.open = true; });

  // ---- Trajectory (Gantt) -------------------------------------------
  const track = document.querySelector('[data-track]');
  const rowsEl = document.querySelector('[data-track-rows]');
  const axisEl = document.querySelector('[data-track-axis]');
  const rowsById = new Map();

  if (track && rowsEl && axisEl) {
    const firstYear = Math.min(...roles.map((r) => Number(r.dataset.start.slice(0, 4))));
    const startIdx = firstYear * 12;
    const endIdx = (now.getFullYear() + 1) * 12; // through the end of this year
    const total = endIdx - startIdx;
    const pct = (i) => ((i - startIdx) / total) * 100;
    track.style.setProperty('--rs-year', `${(12 / total) * 100}%`);

    // Year ticks
    const years = document.createElement('div');
    years.className = 'rs-track__years';
    for (let y = firstYear; y <= now.getFullYear(); y += 1) {
      const s = document.createElement('span');
      s.style.left = `${pct(y * 12 + 6)}%`;
      s.textContent = y === now.getFullYear() ? 'Now' : `’${String(y).slice(2)}`;
      years.appendChild(s);
    }
    axisEl.append(document.createElement('span'), years);

    // One row per role, oldest at the bottom so the line reads upward like the list
    roles.forEach((role, i) => {
      const [a, b] = span(role);
      const row = document.createElement('div');
      row.className = 'rs-track__row';
      row.dataset.target = role.id;
      const name = document.createElement('span');
      name.className = 'rs-track__name';
      name.textContent = role.dataset.short || role.id;
      const lane = document.createElement('div');
      lane.className = 'rs-track__lane';
      const bar = document.createElement('button');
      bar.type = 'button';
      bar.tabIndex = -1; // the list itself is the keyboard path; bars are a pointer shortcut
      bar.className = 'rs-track__bar';
      if (role.hasAttribute('data-parttime')) bar.classList.add('rs-track__bar--part');
      if (role.dataset.end === 'now') bar.classList.add('rs-track__bar--now');
      bar.style.left = `${pct(a)}%`;
      bar.style.width = `${Math.max(pct(b + 1) - pct(a), 0.8)}%`;
      bar.style.transitionDelay = reduceMotion ? '0ms' : `${(roles.length - i) * 60}ms`;
      const [sm, sy] = [a % 12, Math.floor(a / 12)];
      bar.title = `${name.textContent}: ${MONTHS[sm]} ${sy} → ${role.dataset.end === 'now' ? 'Present' : `${MONTHS[b % 12]} ${Math.floor(b / 12)}`}`;
      lane.appendChild(bar);
      row.append(name, lane);
      rowsEl.appendChild(row);
      rowsById.set(role.id, row);

      bar.addEventListener('click', () => {
        const d = role.querySelector('details');
        if (d) d.open = true;
        role.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        const summary = role.querySelector('summary');
        if (summary) setTimeout(() => summary.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
      });
      [row, role].forEach((el) => {
        el.addEventListener('pointerenter', () => { row.classList.add('is-hot'); role.classList.add('is-hot'); });
        el.addEventListener('pointerleave', () => { row.classList.remove('is-hot'); role.classList.remove('is-hot'); });
      });
    });

    const legend = document.createElement('div');
    legend.className = 'rs-track__legend mono text-tertiary';
    legend.innerHTML = '<span><i></i>Full-time</span><span><i class="part"></i>Part-time / studio</span>';
    track.appendChild(legend);

    // Bars grow in when the chart scrolls into view
    if ('IntersectionObserver' in window && !reduceMotion) {
      track.classList.add('is-armed');
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        track.classList.add('is-in');
        io.disconnect();
      }, { threshold: 0.3 });
      io.observe(track);
    }
  }

  // ---- Domain filter ---------------------------------------------------
  const chips = [...document.querySelectorAll('[data-filter]')];
  const status = document.querySelector('[data-filter-status]');
  const defaultStatus = status ? status.textContent : '';
  const applyFilter = (key) => {
    let hits = 0;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === key)));
    roles.forEach((role) => {
      const match = key === 'all' || role.dataset.tags.split(/\s+/).includes(key);
      if (match) hits += 1;
      role.classList.toggle('is-dim', !match);
      const row = rowsById.get(role.id);
      if (row) row.classList.toggle('is-dim', !match);
    });
    if (status) {
      const label = chips.find((c) => c.dataset.filter === key)?.textContent;
      status.textContent = key === 'all' ? defaultStatus : `${hits} of ${roles.length} roles · ${label}`;
    }
  };
  chips.forEach((c) => c.addEventListener('click', () => applyFilter(c.dataset.filter)));

  // ---- Expand / collapse all --------------------------------------------
  const details = roles.map((r) => r.querySelector('details')).filter(Boolean);
  const expandBtn = document.querySelector('[data-expand-all]');
  const syncExpand = () => {
    if (!expandBtn) return;
    const all = details.every((d) => d.open);
    expandBtn.setAttribute('aria-pressed', String(all));
    expandBtn.textContent = all ? 'Collapse all' : 'Expand all';
  };
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      const open = !details.every((d) => d.open);
      details.forEach((d) => { d.open = open; });
      syncExpand();
    });
    details.forEach((d) => d.addEventListener('toggle', syncExpand));
    syncExpand();
  }

  // ---- Skill finder ---------------------------------------------------
  const search = document.querySelector('[data-skill-search]');
  const skillsWrap = document.querySelector('.rs-skills');
  const count = document.querySelector('[data-skill-count]');
  if (search && skillsWrap) {
    const pills = [...skillsWrap.querySelectorAll('.rs-pills li')];
    const sets = [...skillsWrap.querySelectorAll('.rs-skillset')];
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      skillsWrap.classList.toggle('is-searching', q.length > 0);
      let n = 0;
      pills.forEach((p) => {
        const m = q && p.textContent.toLowerCase().includes(q);
        p.classList.toggle('is-match', Boolean(m));
        if (m) n += 1;
      });
      sets.forEach((s) => s.classList.toggle('has-match', Boolean(s.querySelector('.is-match'))));
      if (count) count.textContent = q ? `${n} match${n === 1 ? '' : 'es'}` : '';
    });
    search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value = ''; search.dispatchEvent(new Event('input')); } });
  }

  // ---- Copy email --------------------------------------------------------
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('[data-copy-label]') || btn;
    const original = label.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        label.textContent = 'Copied ✓';
      } catch {
        window.location.href = `mailto:${btn.dataset.copy}`;
        return;
      }
      clearTimeout(btn.t);
      btn.t = setTimeout(() => { label.textContent = original; }, 1800);
    });
  });

  // ---- Print: open every role first, restore afterwards -----------------
  let openBefore = [];
  window.addEventListener('beforeprint', () => {
    openBefore = details.map((d) => d.open);
    details.forEach((d) => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    details.forEach((d, i) => { d.open = openBefore[i] ?? d.open; });
  });
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));

  // ---- Analytics: count PDF downloads -------------------------------------
  document.querySelectorAll('[data-analytics]').forEach((a) => {
    if (a.tagName !== 'A') return;
    a.addEventListener('click', () => {
      if (typeof window.gtag === 'function') window.gtag('event', a.dataset.analytics, { file_name: 'jerry-borunda-resume.pdf' });
    });
  });
})();
