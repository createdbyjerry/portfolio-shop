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

// Expandable images: every case-study image (hero + figures) lifts on hover and opens in a lightbox.
// Click the enlarged image to view it at full size and pan; arrows step through the page's images; Esc closes.
(() => {
  const imgs = [...document.querySelectorAll('main .cs-hero__media, main .figure__img')].filter((img) => img.tagName === 'IMG');
  if (!imgs.length || typeof HTMLDialogElement !== 'function') return;

  const icon = (d) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON_EXPAND = 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9';
  const captionFor = (img) => {
    const hero = img.closest('.cs-hero');
    const title = hero && hero.querySelector('.h1');
    if (title) return title.textContent.trim();
    const fig = img.closest('.figure-pair__item, .figure .container');
    const cap = fig && fig.querySelector('.figure__caption');
    return (cap ? cap.textContent : '').trim() || img.alt || 'Image';
  };

  // Make each image a trigger: reuse an existing full-size link, otherwise wrap the image in a button
  const triggers = imgs.map((img, i) => {
    let el = img.closest('a.figure__link');
    if (el) {
      el.classList.add('zoomable');
      el.removeAttribute('target');
    } else {
      el = document.createElement('button');
      el.type = 'button';
      el.className = 'zoomable';
      img.parentNode.insertBefore(el, img);
      el.appendChild(img);
    }
    el.setAttribute('aria-label', `Expand image: ${captionFor(img)}`);
    el.setAttribute('aria-haspopup', 'dialog');
    el.insertAdjacentHTML('beforeend', `<span class="zoomable__badge" aria-hidden="true">${icon(ICON_EXPAND)}Expand</span>`);
    el.addEventListener('click', (e) => { e.preventDefault(); open(i, el); });
    return el;
  });

  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.setAttribute('aria-label', 'Image viewer');
  box.innerHTML = `
    <div class="lightbox__bar">
      <span class="lightbox__caption"></span>
      <div class="lightbox__controls">
        <button class="lightbox__btn" type="button" data-step="-1" aria-label="Previous image">${icon('M10 3 5 8l5 5')}</button>
        <button class="lightbox__btn" type="button" data-step="1" aria-label="Next image">${icon('M6 3l5 5-5 5')}</button>
        <a class="lightbox__btn" data-full target="_blank" rel="noopener" aria-label="Open full size in a new tab">${icon('M6 3h7v7M13 3 4 12')}</a>
        <button class="lightbox__btn" type="button" data-close aria-label="Close">${icon('M3.5 3.5l9 9M12.5 3.5l-9 9')}</button>
      </div>
    </div>
    <div class="lightbox__stage"><img class="lightbox__img" alt=""></div>
    <span class="lightbox__hint">Click image to zoom · Esc to close</span>`;
  document.body.appendChild(box);

  const big = box.querySelector('.lightbox__img');
  const cap = box.querySelector('.lightbox__caption');
  const full = box.querySelector('[data-full]');
  const stage = box.querySelector('.lightbox__stage');
  const steppers = box.querySelectorAll('[data-step]');
  let index = 0;
  let opener = null;

  const show = (i) => {
    index = (i + imgs.length) % imgs.length;
    const img = imgs[index];
    box.classList.remove('is-zoomed');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    cap.textContent = captionFor(img);
    full.href = img.src;
    stage.scrollTo(0, 0);
  };
  const open = (i, el) => {
    opener = el;
    steppers.forEach((b) => { b.hidden = imgs.length < 2; });
    show(i);
    box.showModal();
  };

  box.addEventListener('close', () => { big.removeAttribute('src'); if (opener) opener.focus(); });
  box.querySelector('[data-close]').addEventListener('click', () => box.close());
  steppers.forEach((b) => b.addEventListener('click', () => show(index + Number(b.dataset.step))));
  // Clicking the dark area around the image closes the viewer
  box.addEventListener('click', (e) => { if (e.target === box || e.target === stage) box.close(); });
  // Toggle between fit-to-screen and full size; when zooming in, keep the clicked point in view
  big.addEventListener('click', (e) => {
    const r = big.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const zoomed = box.classList.toggle('is-zoomed');
    if (zoomed) stage.scrollTo(fx * big.offsetWidth - stage.clientWidth / 2, fy * big.offsetHeight - stage.clientHeight / 2);
  });
  box.addEventListener('keydown', (e) => {
    if (imgs.length < 2) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
  });
})();
