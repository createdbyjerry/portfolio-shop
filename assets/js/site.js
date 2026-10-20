// createdbyjerry: shared page behaviour (no dependencies)

// Mobile nav toggle
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');
if (nav && toggle) {
  const setOpen = (open) => {
    nav.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(nav.dataset.open !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  nav.querySelectorAll('.nav__link').forEach((a) => a.addEventListener('click', () => setOpen(false)));
}

// Theme toggle: Perigee (dark, default) ↔ Apogee (light).
// The choice is saved in localStorage, so returning visitors get the theme they picked.
// The inline <head> script applies it before first paint; this wires up the switch.
(() => {
  const KEY = 'cbj-theme';
  const THEMES = { dark: 'perigee', light: 'apogee' };
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const toggles = document.querySelectorAll('.theme-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const current = () => (root.dataset.theme === THEMES.light ? 'light' : 'dark');

  const sync = () => {
    const light = current() === 'light';
    toggles.forEach((t) => {
      t.setAttribute('aria-checked', String(light));
      t.title = light ? 'Switch to dark theme' : 'Switch to light theme';
    });
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--surface-page').trim() || (light ? '#ffffff' : '#0a0b0d');
  };

  const apply = (mode, { save = true, animate = true } = {}) => {
    if (animate && !reduceMotion) {
      root.classList.add('theme-switching');
      clearTimeout(apply.t);
      apply.t = setTimeout(() => root.classList.remove('theme-switching'), 450);
    }
    root.dataset.theme = THEMES[mode];
    if (save) { try { localStorage.setItem(KEY, mode); } catch { /* storage blocked: still switches for this page */ } }
    sync();
    window.dispatchEvent(new CustomEvent('cbj:themechange', { detail: { mode, theme: THEMES[mode] } }));
  };

  if (!root.dataset.theme) root.dataset.theme = THEMES.dark;
  sync();
  toggles.forEach((t) => t.addEventListener('click', () => apply(current() === 'light' ? 'dark' : 'light')));
  // Keep other open tabs in step
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark') && e.newValue !== current()) apply(e.newValue, { save: false });
  });
  window.CBJ_THEME = { apply, current };
})();

// Hero frame cursor readout
const frame = document.querySelector('[data-coords-frame]');
const coords = document.querySelector('[data-coords]');
if (frame && coords && window.matchMedia('(hover: hover)').matches) {
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(3, '0');
  frame.addEventListener('mousemove', (e) => {
    const r = frame.getBoundingClientRect();
    coords.textContent = `x:${pad(e.clientX - r.left)} y:${pad(e.clientY - r.top)}`;
  });
}

// Footer year
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
// Google Analytics (same property as the Webflow site)
(() => {
  const GA_ID = 'G-D56XR5LTNB';
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return; // don't count local previews
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
})();

// Card diagrams: draw in when scrolled into view (home page .viz figures)
const vizzes = document.querySelectorAll('.viz');
if (vizzes.length && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const root = document.documentElement;
  // Hide the figures instantly (no transition), then start watching for them
  root.classList.add('viz-reveal', 'viz-noanim');
  void root.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.remove('viz-noanim');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    vizzes.forEach((el) => io.observe(el));
  }));
}

// Impact stats: count each number up from zero when its card scrolls into view
const counters = document.querySelectorAll('[data-count]');
if (counters.length && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const show = (el, v) => { el.textContent = v.toFixed(Number(el.dataset.decimals || 0)); };
  const countIo = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countIo.unobserve(entry.target);
      const el = entry.target;
      const end = parseFloat(el.dataset.count);
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / 1400, 1);
        show(el, end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => { show(el, 0); countIo.observe(el); });
}

// Card scroll reveal: every .card and .callout fades and slides up as it scrolls into view.
// Cards that enter together are staggered in reading order, so a row cascades in rather than popping at once.
(() => {
  const cards = document.querySelectorAll('.card, .callout');
  if (!cards.length || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const STEP = 90;   // ms between cards in the same batch
  const MAX = 6;     // cap the stagger so long batches don't drag
  document.documentElement.classList.add('card-reveal');
  const io = new IntersectionObserver((entries) => {
    entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left))
      .forEach((entry, i) => {
        const el = entry.target;
        io.unobserve(el);
        el.style.setProperty('--reveal-delay', `${Math.min(i, MAX) * STEP}ms`);
        el.classList.add('is-revealed');
        // Clear the delay once done, so the card's own hover transitions aren't affected
        el.addEventListener('animationend', () => el.style.removeProperty('--reveal-delay'), { once: true });
      });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  cards.forEach((el) => io.observe(el));
})();
