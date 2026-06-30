/* ===== VOLT STORE CO — interacciones ===== */
(function () {
  'use strict';

  /* ---- Catálogo por marcas ----
     Para agregar la foto real de un modelo: pon la ruta en "img" (ej. img:'img/iphone16.webp').
     Si "img" queda null, se muestra el ícono provisional. */
  const CATALOG = [
    // Apple
    { brand: 'apple', name: 'iPhone 17', img: null },
    { brand: 'apple', name: 'iPhone 16 Pro Max', img: null },
    { brand: 'apple', name: 'iPhone 16', img: null },
    { brand: 'apple', name: 'iPhone 15', img: null },
    { brand: 'apple', name: 'iPhone 14', img: null },
    { brand: 'apple', name: 'iPhone 13', img: null },
    { brand: 'apple', name: 'iPhone 11', img: null },
    // Samsung
    { brand: 'samsung', name: 'Galaxy S25 Ultra', img: null },
    { brand: 'samsung', name: 'Galaxy S24', img: null },
    { brand: 'samsung', name: 'Galaxy A55', img: null },
    { brand: 'samsung', name: 'Galaxy A25', img: null },
    { brand: 'samsung', name: 'Galaxy A15', img: null },
    { brand: 'samsung', name: 'Galaxy A06', img: null },
    // Xiaomi
    { brand: 'xiaomi', name: 'Redmi Note 13', img: null },
    { brand: 'xiaomi', name: 'Redmi 15C', img: null },
    { brand: 'xiaomi', name: 'Redmi 13C', img: null },
    { brand: 'xiaomi', name: 'Redmi A3', img: null },
    { brand: 'xiaomi', name: 'Poco X6', img: null },
    // Motorola
    { brand: 'motorola', name: 'Moto Edge 50', img: null },
    { brand: 'motorola', name: 'Moto G54', img: null },
    { brand: 'motorola', name: 'Moto G24', img: null },
    { brand: 'motorola', name: 'Moto G04', img: null },
  ];
  const BRAND_NAME = { apple: 'Apple', samsung: 'Samsung', xiaomi: 'Xiaomi', motorola: 'Motorola' };
  const PHONE_SVG = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2" width="11" height="20" rx="2.6"/><path d="M10 5.2h4"/><path d="M10.5 18.8h3"/></svg>';

  const grid = document.getElementById('catalogGrid');
  if (grid) {
    grid.innerHTML = CATALOG.map(p => {
      const msg = encodeURIComponent('Hola, quiero consultar disponibilidad y precio del ' + p.name + ' en VOLT STORE CO.');
      const media = p.img
        ? `<img src="${p.img}" alt="${p.name}" loading="lazy" />`
        : `<span class="model__icon">${PHONE_SVG}</span><span class="model__soon">Foto próximamente</span>`;
      return `<article class="model" data-brand="${p.brand}">
        <div class="model__media${p.img ? ' has-img' : ''}">${media}</div>
        <div class="model__body">
          <span class="model__brand">${BRAND_NAME[p.brand] || ''}</span>
          <h3>${p.name}</h3>
          <a class="btn btn--soft" href="https://wa.me/573171076290?text=${msg}" target="_blank" rel="noopener">Consultar</a>
        </div>
      </article>`;
    }).join('');

    const filters = document.getElementById('catalogFilters');
    filters.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      filters.querySelectorAll('.chip').forEach(c => {
        const on = c === btn;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const b = btn.dataset.brand;
      grid.querySelectorAll('.model').forEach(m => {
        m.style.display = (b === 'all' || m.dataset.brand === b) ? '' : 'none';
      });
    });
  }

  /* ---- Pantalla de carga ---- */
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('is-hidden');
      document.body.style.overflow = '';
    }, 2000);
  });
  // failsafe por si 'load' tarda
  setTimeout(() => loader && loader.classList.add('is-hidden'), 4500);

  /* ---- Header scroll ---- */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Menú móvil ---- */
  const burger = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('overlay');

  function setMenu(open) {
    burger.classList.toggle('active', open);
    menu.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  overlay.addEventListener('click', () => setMenu(false));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---- Reveal al hacer scroll ---- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const sibs = [...entry.target.parentElement.children].filter(c => c.classList.contains('reveal'));
          const idx = sibs.indexOf(entry.target);
          entry.target.style.transitionDelay = (Math.min(idx, 5) * 70) + 'ms';
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(r => io.observe(r));
  } else {
    reveals.forEach(r => r.classList.add('in'));
  }

  /* ---- Lightbox galería ---- */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbClose = document.getElementById('lbClose');
  document.querySelectorAll('.gallery__grid .g-item img').forEach(img => {
    img.addEventListener('click', () => {
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });
  function closeLb() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  lbClose.addEventListener('click', closeLb);
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  /* ---- Año footer ---- */
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---- Smooth scroll con offset header ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      const top = t.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
