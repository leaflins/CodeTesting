// layout.js - chapter rail: click to scroll, and highlight the chapter being read.
document.addEventListener('DOMContentLoaded', () => {
  const buttons = [...document.querySelectorAll('.header-nav .nav-btn')];
  const target = b => document.getElementById(b.dataset.section + '-section');
  buttons.forEach(b => b.addEventListener('click', () => {
    const el = target(b);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  if (!('IntersectionObserver' in window)) return;
  const setActive = b => buttons.forEach(x => x.classList.toggle('active', x === b));
  const io = new IntersectionObserver(entries => {
    const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (hit) setActive(buttons.find(b => target(b) === hit.target));
  }, { rootMargin: '-10% 0px -70% 0px' });
  buttons.forEach(b => { const el = target(b); if (el) io.observe(el); });
});
