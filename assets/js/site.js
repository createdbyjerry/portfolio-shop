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
