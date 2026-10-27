/* ===== VOLT STORE CO — contenido administrable + interacciones =====
   El contenido (textos, imágenes, colores, secciones) y el catálogo se
   administran en el panel (/admin) y se guardan en Supabase. Esta página
   lee SOLO lo publicado. Si Supabase no responde, usa la última copia
   (data/site.json, generada a diario) y, si tampoco, el HTML original. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rxdokvoljoxtficvbjhc.supabase.co';
  // Clave pública ("publishable"): solo permite leer lo publicado; las políticas de la base de datos impiden escribir.
  var SUPABASE_KEY = 'sb_publishable_Sv34Sje2NPVUZEpAWDpzuw_L5X2w7_H';
  var CACHE_KEY = 'volt-site-v1';
  var REFRESH_MS = 180000;   // revisa cambios cada 3 min aunque la pestaña quede abierta

  // Carpeta desde donde se cargó este script (la raíz del sitio; o el CDN si otra página la incrusta).
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*(\?.*)?$/, '') : '';
  })();
  var PREVIEW = /[?&]preview=1\b/.test(location.search);

  var ICONS = {
    wa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>',
    bolt: function (s) { return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true"><path fill="currentColor" d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z"/></svg>'; },
    apple: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.365 1.43c0 1.14-.42 2.2-1.13 3.02-.78.9-2.06 1.6-3.13 1.51-.13-1.06.42-2.2 1.06-2.94.78-.86 2.13-1.5 3.2-1.59zM20.5 17.2c-.6 1.4-.9 2-1.67 3.24-1.07 1.72-2.58 3.86-4.45 3.88-1.66.02-2.08-1.08-4.33-1.07-2.25.01-2.72 1.09-4.38 1.07-1.87-.02-3.3-1.95-4.37-3.67C-1.2 16.5-2.05 9.8 1.5 6.6c1.27-1.14 2.92-1.81 4.5-1.81 1.66 0 2.7 1.09 4.07 1.09 1.33 0 2.14-1.09 4.07-1.09 1.4 0 2.89.76 3.95 2.08-3.47 1.9-2.9 6.86 1.91 9.33z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.44c-3.15 0-3.52.01-4.76.07-1.15.05-1.77.24-2.19.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.42-.35 1.04-.4 2.19-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.05 1.15.24 1.77.4 2.19.21.55.47.94.88 1.35.41.41.8.67 1.35.88.42.16 1.04.35 2.19.4 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c1.15-.05 1.77-.24 2.19-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.42.35-1.04.4-2.19.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.05-1.15-.24-1.77-.4-2.19-.21-.55-.47-.94-.88-1.35-.41-.41-.8-.67-1.35-.88-.42-.16-1.04-.35-2.19-.4-1.24-.06-1.61-.07-4.76-.07zm0 2.45a5.95 5.95 0 110 11.9 5.95 5.95 0 010-11.9zm0 1.44a4.51 4.51 0 100 9.02 4.51 4.51 0 000-9.02zm6.19-.19a1.39 1.39 0 11-2.78 0 1.39 1.39 0 012.78 0z"/></svg>'
  };
  // Ancla de cada sección (para ocultar del menú los enlaces a secciones ocultas).
  var ANCHOR = { hero: 'inicio', marquee: 'franja', productos: 'productos', catalogo: 'catalogo', iphone: 'iphone',
                 servicio: 'servicio', beneficios: 'beneficios', galeria: 'galeria', cta: 'cta', contacto: 'contacto' };
  var FONTS = ['Sora', 'Inter', 'Poppins', 'Montserrat', 'Outfit', 'Space Grotesk', 'Manrope', 'Roboto', 'Open Sans', 'Lato', 'Nunito Sans', 'DM Sans'];

  /* ---------- utilidades seguras: todo texto del panel se escapa ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var LINK_RE = /^(#[A-Za-z0-9_-]*|https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|tel:[+0-9 ()-]+)$/;
  var IMG_RE = /^((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9._-]+\.(?:webp|png|jpe?g|gif|svg|ico)|https:\/\/[^\s"'<>]+)$/;
  function safeHref(h) { return LINK_RE.test(h || '') ? h : '#'; }
  function src(u) { if (!u || !IMG_RE.test(u)) return ''; return /^https:/.test(u) ? u : BASE + u; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function sec(id) { return document.querySelector('[data-section="' + id + '"]'); }
  function money(n) { return '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 }); }

  var G = {};   // información general (WhatsApp, redes) del contenido vigente
  function wa(msg) {
    return 'https://wa.me/' + String(G.whatsapp || '573171076290').replace(/\D/g, '') + '?text=' +
      encodeURIComponent(msg || G.whatsappMessage || '');
  }
  function linkAttrs(href) {
    href = safeHref(href);
    return 'href="' + esc(href) + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '');
  }
  // Botón administrable: { label, kind: 'whatsapp'|'link', message, href }
  function btn(b, cls, waCls) {
    if (!b || !b.label) return '';
    var isWa = b.kind !== 'link';
    var attrs = isWa ? 'href="' + esc(wa(b.message)) + '" target="_blank" rel="noopener"' : linkAttrs(b.href);
    return '<a class="btn ' + (isWa && waCls ? waCls : cls) + '" ' + attrs + '>' + esc(b.label) + '</a>';
  }
  function head(c) {
    return (c.kicker ? '<span class="kicker">' + esc(c.kicker) + '</span>' : '') +
      (c.title ? '<h2>' + esc(c.title) + '</h2>' : '') + (c.text ? '<p>' + esc(c.text) + '</p>' : '');
  }
  function icon(i) {
    if (i === 'apple') return '';
    if (i === 'rayo' || i === 'bolt') return ICONS.bolt(22);
    return esc(i || '');
  }
  function setHTML(el, html) { if (el && el.innerHTML !== html) el.innerHTML = html; }

  /* ---------- tema (colores, tipografía, esquinas) con límites seguros ---------- */
  function hex(c, d) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : d; }
  function rgba(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function shade(h, p) {
    var n = parseInt(h.slice(1), 16), f = function (x) { return Math.max(0, Math.min(255, Math.round(x * (1 + p)))); };
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(function (x) { return ('0' + f(x).toString(16)).slice(-2); }).join('');
  }
  function applyTheme(t) {
    if (!t) return;
    var r = document.documentElement, s = r.style;
    var primary = hex(t.primary, '#FFD400'), primary2 = hex(t.primary2, '#FFC400'), dark = hex(t.dark, '#121219'), waC = hex(t.wa, '#25D366');
    s.setProperty('--volt', primary);
    s.setProperty('--volt-2', primary2);
    s.setProperty('--volt-ink', hex(t.primaryInk, '#1A1500'));
    s.setProperty('--volt-soft', rgba(primary2, 0.14));
    s.setProperty('--shadow-volt', '0 14px 34px ' + rgba(primary2, 0.30));
    s.setProperty('--dark', dark);
    s.setProperty('--dark-2', shade(dark, -0.3));
    s.setProperty('--bg', hex(t.bg, '#FFFFFF'));
    s.setProperty('--bg-soft', hex(t.bgSoft, '#F3F4F7'));
    s.setProperty('--ink', hex(t.ink, '#15161C'));
    s.setProperty('--muted', hex(t.muted, '#6A6B76'));
    s.setProperty('--wa', waC);
    s.setProperty('--wa-d', shade(waC, -0.1));
    var fh = FONTS.indexOf(t.fontHead) >= 0 ? t.fontHead : 'Sora', fb = FONTS.indexOf(t.fontBody) >= 0 ? t.fontBody : 'Inter';
    s.setProperty('--ff-head', "'" + fh + "',system-ui,sans-serif");
    s.setProperty('--ff-body', "'" + fb + "',system-ui,sans-serif");
    var extra = [fh, fb].filter(function (f) { return f !== 'Sora' && f !== 'Inter'; });
    var link = document.getElementById('volt-fonts');
    if (extra.length) {
      var href = 'https://fonts.googleapis.com/css2?' + extra.map(function (f) {
        return 'family=' + f.replace(/ /g, '+') + ':wght@400;500;600;700;800';
      }).join('&') + '&display=swap';
      if (!link) { link = document.createElement('link'); link.id = 'volt-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
      if (link.href !== href) link.href = href;
    } else if (link) link.remove();
    var cls = r.className.replace(/\bvolt-(r|scale|cards|sp)-\S+/g, '').trim();
    var pick = function (v, ok, d) { return ok.indexOf(v) >= 0 ? v : d; };
    r.className = (cls + ' volt-r-' + pick(t.radius, ['square', 'soft', 'round'], 'square') +
      ' volt-scale-' + pick(t.scale, ['sm', 'md', 'lg'], 'md') +
      ' volt-cards-' + pick(t.cardStyle, ['border', 'shadow', 'flat'], 'border') +
      ' volt-sp-' + pick(t.spacing, ['compact', 'normal', 'wide'], 'normal')).trim();
  }

  /* ---------- SEO (título, descripción, Open Graph, indexación) ---------- */
  function meta(attr, name, value) {
    var el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!value) return;
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }
  function applySeo(s) {
    if (!s) return;
    if (s.title) document.title = s.title;       // vacío = se conserva el título del HTML
    meta('name', 'description', s.description);
    meta('property', 'og:title', s.ogTitle || s.title);
    meta('property', 'og:description', s.ogDescription || s.description);
    if (s.ogImage) meta('property', 'og:image', /^https:/.test(s.ogImage) ? s.ogImage : new URL(src(s.ogImage), location.href).href);
    var robots = document.head.querySelector('meta[name="robots"][data-volt]');
    if (s.index === false) {
      if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; robots.setAttribute('data-volt', ''); document.head.appendChild(robots); }
      robots.content = 'noindex,nofollow';
    } else if (robots) robots.remove();
  }
  function applyJsonLd(g) {
    var data = {
      '@context': 'https://schema.org', '@type': 'ElectronicsStore', name: g.name || 'VOLT STORE CO',
      description: g.tagline || '', image: new URL(src('img/og.jpg'), location.href).href,
      telephone: '+' + String(g.whatsapp || '').replace(/\D/g, ''),
      address: { '@type': 'PostalAddress', streetAddress: g.address || '', addressRegion: 'Norte de Santander', addressCountry: 'CO' },
      sameAs: (g.socials || []).map(function (x) { return x.url; }).filter(function (u) { return /^https?:/.test(u); })
    };
    if (g.email) data.email = g.email;
    if (g.hours) data.openingHours = g.hours;
    var el = document.getElementById('volt-jsonld');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'volt-jsonld'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }

  /* ---------- render de cada sección (mismo HTML y clases que el original) ---------- */
  function socialsHTML() {
    return (G.socials || []).map(function (x) {
      return '<a ' + linkAttrs(x.url) + ' aria-label="' + esc((x.label || x.network) + ' de ' + (G.name || 'VOLT STORE CO')) + '">' + esc(x.label || x.network) + '</a>';
    }).join('');
  }
  function navHTML(items) {
    return (items || []).map(function (x) { return '<a ' + linkAttrs(x.href) + '>' + esc(x.label) + '</a>'; }).join('');
  }

  function renderHeader(h) {
    var logo = $('.header .brand__logo');
    if (logo && h.logo) { logo.src = src(h.logo); logo.alt = h.logoAlt || G.name || ''; }
    setHTML(document.getElementById('nav'), navHTML(h.nav));
    var hw = $('.header__wa');
    if (hw) {
      hw.style.display = h.showWhatsapp === false ? 'none' : '';
      hw.href = wa();
      setHTML(hw, ICONS.wa + ' ' + esc(h.ctaLabel || 'WhatsApp'));
    }
    var mm = document.getElementById('mobileMenu');
    if (mm) {
      setHTML($('nav', mm), navHTML(h.mobileNav));
      var mb = $('.btn--wa', mm);
      if (mb) { mb.href = wa(); mb.textContent = h.mobileCtaLabel || 'Escríbenos por WhatsApp'; mb.style.display = h.showWhatsapp === false ? 'none' : ''; }
    }
    var lg = $('.loader__logo');
    if (lg && h.logoWhite) lg.src = src(h.logoWhite);
    var lt = $('.loader__text');
    if (lt && h.loaderText) setHTML(lt, '<i class="blink"></i> ' + esc(h.loaderText));
    if (h.showLoader === false && loader) hideLoader();
    if (h.favicon && h.favicon !== 'favicon.svg') {   // favicon.svg ya viene en el HTML
      var fav = document.head.querySelector('link[rel="icon"]');
      if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
      fav.href = src(h.favicon);
      fav.removeAttribute('type');
    }
  }

  function renderHero(c) {
    var s = sec('hero'); if (!s) return;
    var title = esc(c.title || '');
    if (c.highlight && c.title && c.title.indexOf(c.highlight) >= 0) {
      title = esc(c.title).split(esc(c.highlight)).join('<span class="hl">' + esc(c.highlight) + '</span>');
    }
    setHTML($('.hero__content', s),
      (c.eyebrow ? '<span class="eyebrow"><i class="dot"></i> ' + esc(c.eyebrow) + '</span>' : '') +
      '<h1>' + title + '</h1>' +
      (c.subtitle ? '<p class="hero__sub">' + esc(c.subtitle) + '</p>' : '') +
      (c.badge ? '<div class="hero__badge">' + ICONS.bolt(16) + ' ' + esc(c.badge) + '</div>' : '') +
      '<div class="hero__cta">' + btn(c.primary, 'btn--volt btn--lg', 'btn--wa btn--lg') + btn(c.secondary, 'btn--ghost btn--lg', 'btn--wa btn--lg') + '</div>' +
      ((c.stats || []).length ? '<ul class="hero__stats">' + c.stats.map(function (x) {
        return '<li><strong>' + esc(x.value) + '</strong><span>' + esc(x.label) + '</span></li>';
      }).join('') + '</ul>' : ''));
    var img = $('.hero__frame img', s);
    if (img && c.image) { img.src = src(c.image); img.alt = c.imageAlt || ''; }
    var top = $('.hero__chip--top', s), bot = $('.hero__chip--bottom', s);
    if (top) { top.style.display = c.chipTop ? '' : 'none'; setHTML(top, ICONS.bolt(15) + ' ' + esc(c.chipTop)); }
    if (bot) { bot.style.display = c.chipBottom ? '' : 'none'; bot.textContent = c.chipBottom || ''; }
  }

  function renderMarquee(c) {
    var t = $('.marquee__track'); if (!t) return;
    var one = (c.items || []).map(function (x) { return '<span>' + esc(x) + '</span><i>⚡</i>'; }).join('');
    setHTML(t, one + one);
  }

  function renderProductos(c) {
    var s = sec('productos'); if (!s) return;
    setHTML($('.section__head', s), head(c));
    var cards = (c.cards || []).map(function (x) {
      return '<article class="card reveal"><div class="card__img">' +
        (x.image ? '<img src="' + esc(src(x.image)) + '" alt="' + esc(x.imageAlt) + '" loading="lazy" width="800" height="600" />' : '') +
        (x.tag ? '<span class="tag">' + esc(x.tag) + '</span>' : '') + '</div><div class="card__body"><h3>' + esc(x.title) + '</h3>' +
        (x.text ? '<p>' + esc(x.text) + '</p>' : '') + btn(x.button, 'btn--soft') + '</div></article>';
    }).join('');
    if (c.showCtaCard !== false && c.ctaTitle) {
      cards += '<article class="card card--cta reveal"><div class="card__body"><span class="card__icon">' + ICONS.bolt(26) + '</span><h3>' +
        esc(c.ctaTitle) + '</h3>' + (c.ctaText ? '<p>' + esc(c.ctaText) + '</p>' : '') + btn(c.ctaButton, 'btn--volt', 'btn--wa') + '</div></article>';
    }
    setHTML($('.cards', s), cards);
  }

  function renderIphone(c) {
    var s = sec('iphone'); if (!s) return;
    setHTML($('.iphone__content', s),
      (c.kicker ? '<span class="kicker">' + esc(c.kicker) + '</span>' : '') + '<h2>' + esc(c.title) + '</h2>' +
      (c.text ? '<p class="lead">' + esc(c.text) + '</p>' : '') +
      ((c.ticks || []).length ? '<ul class="ticks">' + c.ticks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="iphone__cta">' + btn(c.primary, 'btn--volt btn--lg') + btn(c.secondary, 'btn--ghost btn--lg') + '</div>');
    var img = $('.iphone__frame img', s);
    if (img && c.image) { img.src = src(c.image); img.alt = c.imageAlt || ''; }
  }

  function renderServicio(c) {
    var s = sec('servicio'); if (!s) return;
    setHTML($('.section__head', s), head(c));
    setHTML($('.service__grid', s), (c.items || []).map(function (x) {
      var h3 = x.icon === 'apple' ? '<h3 class="srv__apple">' + ICONS.apple + ' ' + esc(x.title) + '</h3>' : '<h3>' + esc(x.title) + '</h3>';
      return '<div class="srv' + (x.soon ? ' srv--soon' : '') + ' reveal"><span class="srv__ic">' + icon(x.icon) + '</span>' + h3 +
        (x.text ? '<p>' + esc(x.text) + '</p>' : '') + (x.soon ? '<span class="soon">' + esc(x.soonLabel || 'Próximamente') + '</span>' : '') + '</div>';
    }).join(''));
    var cta = $('.service__cta', s);
    if (cta) { cta.style.display = c.button && c.button.label ? '' : 'none'; setHTML(cta, btn(c.button, 'btn--volt btn--lg')); }
  }

  function renderBeneficios(c) {
    var s = sec('beneficios'); if (!s) return;
    setHTML($('.section__head', s), head(c));
    setHTML($('.benefits__grid', s), (c.items || []).map(function (x) {
      return '<div class="ben reveal"><span class="ben__ic">' + icon(x.icon) + '</span><h3>' + esc(x.title) + '</h3>' +
        (x.text ? '<p>' + esc(x.text) + '</p>' : '') + '</div>';
    }).join(''));
  }

  function renderGaleria(c) {
    var s = sec('galeria'); if (!s) return;
    setHTML($('.section__head', s), head(c) + (c.showButton !== false && c.buttonLabel ?
      '<a class="btn btn--ig btn--lg section__head-cta" ' + linkAttrs(c.buttonUrl) + ' aria-label="' + esc(c.buttonLabel) + '">' + ICONS.ig + ' ' + esc(c.buttonLabel) + '</a>' : ''));
    setHTML($('.gallery__grid', s), (c.images || []).map(function (x) {
      var size = x.size === 'tall' ? ' g-item--tall' : x.size === 'wide' ? ' g-item--wide' : '';
      return '<figure class="g-item' + size + ' reveal"><img src="' + esc(src(x.image)) + '" alt="' + esc(x.alt) + '" loading="lazy" /></figure>';
    }).join(''));
  }

  function renderCta(c) {
    var s = sec('cta'); if (!s) return;
    setHTML($('.cta-band__inner', s), '<h2>' + esc(c.title) + '</h2>' + (c.text ? '<p>' + esc(c.text) + '</p>' : '') + btn(c.button, 'btn--volt btn--xl', 'btn--wa btn--xl'));
  }

  function renderContacto(c, h) {
    var s = sec('contacto'); if (!s) return;
    setHTML($('.contact__info', s),
      (c.kicker ? '<span class="kicker">' + esc(c.kicker) + '</span>' : '') + '<h2>' + esc(c.title) + '</h2>' +
      (c.text ? '<p class="lead">' + esc(c.text) + '</p>' : '') +
      '<ul class="contact__list">' + (c.items || []).map(function (x) {
        return '<li><span class="ci">' + icon(x.icon) + '</span><div><strong>' + esc(x.title) + '</strong><small>' + esc(x.text) + '</small></div></li>';
      }).join('') + '</ul>' +
      (c.showSocials !== false ? '<div class="contact__socials">' + socialsHTML() + '</div>' : ''));
    setHTML($('.contact__card', s),
      '<div class="contact__card-glow" aria-hidden="true"></div>' +
      '<img class="brand__logo" src="' + esc(src(h.logoWhite || 'img/logo-white.webp')) + '" alt="' + esc(G.name) + '" width="200" height="46" />' +
      '<h3>' + esc(c.cardTitle) + '</h3>' + (c.cardText ? '<p>' + esc(c.cardText) + '</p>' : '') +
      btn(c.cardButton, 'btn--volt btn--block btn--lg', 'btn--wa btn--block btn--lg') +
      (c.showNumber !== false && G.whatsappDisplay ? '<span class="contact__num">' + esc(G.whatsappDisplay) + '</span>' : ''));
  }

  function renderFooter(f, h) {
    var foot = $('.footer'); if (!foot) return;
    setHTML($('.footer__brand', foot),
      '<a href="#inicio" class="brand"><img class="brand__logo" src="' + esc(src(h.logoWhite || 'img/logo-white.webp')) + '" alt="' + esc(G.name) + '" width="200" height="46" /></a>' +
      (f.text ? '<p>' + esc(f.text) + '</p>' : '') + '<div class="footer__socials">' + socialsHTML() + '</div>');
    var cols = foot.querySelectorAll('.footer__col');
    if (cols[0]) setHTML(cols[0], '<h4>' + esc(f.linksTitle) + '</h4>' + navHTML(f.links));
    if (cols[1]) setHTML(cols[1], '<h4>' + esc(f.contactTitle) + '</h4>' +
      (f.showWhatsapp !== false ? '<a href="' + esc(wa()) + '" target="_blank" rel="noopener">WhatsApp: ' + esc(G.whatsappDisplay) + '</a>' : '') +
      (f.showEmail !== false && G.email ? '<a href="mailto:' + esc(G.email) + '">' + esc(G.email) + '</a>' : '') +
      (G.phone ? '<a href="tel:' + esc(G.phone.replace(/[^0-9+]/g, '')) + '">' + esc(G.phone) + '</a>' : '') +
      (f.showAddress !== false && G.address ? (G.mapUrl ? '<a ' + linkAttrs(G.mapUrl) + '>' + esc(G.address) + '</a>' : '<span>' + esc(G.address) + '</span>') : '') +
      (f.showHours !== false && G.hours ? '<span>' + esc(G.hours) + '</span>' : ''));
    setHTML($('.footer__bottom', foot),
      '<p>© ' + new Date().getFullYear() + ' ' + esc(f.copyright) + '</p>' +
      ((f.legal || []).length ? '<p class="footer__legal">' + f.legal.map(function (x) { return '<a ' + linkAttrs(x.href) + '>' + esc(x.label) + '</a>'; }).join(' · ') + '</p>' : '') +
      (f.slogan ? '<p>' + esc(f.slogan) + '</p>' : ''));
    var fl = $('.wa-float');
    if (fl) { fl.href = wa(); fl.style.display = G.floatingWhatsapp === false ? 'none' : ''; }
  }

  function applyLayout(l) {
    var list = (l && l.sections) || [];
    var first = sec('hero'), parent = first && first.parentElement;
    if (!parent) return;
    var seen = {};
    list.forEach(function (x) {
      var el = sec(x.id);
      if (!el || seen[x.id]) return;
      seen[x.id] = 1;
      parent.appendChild(el);
      el.classList.toggle('is-section-hidden', x.visible === false);
    });
    // Oculta del menú los enlaces a secciones ocultas.
    var hidden = list.filter(function (x) { return x.visible === false; }).map(function (x) { return '#' + ANCHOR[x.id]; });
    document.querySelectorAll('#nav a, #mobileMenu nav a, .footer__col a').forEach(function (a) {
      a.style.display = hidden.indexOf(a.getAttribute('href')) >= 0 ? 'none' : '';
    });
  }

  /* ---------- catálogo ---------- */
  var CAT = { P: [], cats: [], cfg: {}, brand: 'all', page: 1 };
  var PS = 6;
  function catByCode(code) { for (var i = 0; i < CAT.cats.length; i++) if (CAT.cats[i].code === code) return CAT.cats[i]; return {}; }
  function priceHTML(x, cfg) {
    if (x.price == null) return '<span class="model__price model__price--ask">' + esc(cfg.askPriceLabel || 'Consultar precio') + '</span>';
    var base = money(x.price) + (x.price_max ? '–' + money(x.price_max) : '');
    if (x.promo != null && x.promo < x.price) {
      return '<span class="model__price"><s class="model__old">' + base + '</s> ' + money(x.promo) + '</span>';
    }
    return '<span class="model__price">' + base + '</span>';
  }
  function productLink(x, cfg) {
    var cat = catByCode(x.c);
    if (x.url) return linkAttrs(x.url);
    var msg = x.msg || String(cfg.productMessage || 'Hola, quiero consultar disponibilidad y precio de: {producto} ({categoria}) en VOLT STORE CO.')
      .split('{producto}').join(x.n).split('{categoria}').join(cat.singular || '');
    return 'href="' + esc(wa(msg)) + '" target="_blank" rel="noopener"';
  }
  function card(x, n, cfg) {
    var cat = catByCode(x.c);
    var stk = '';
    if (cfg.showStock !== false && x.s != null) {
      stk = x.s <= 0 ? '<span class="model__stock model__stock--out">' + esc(cfg.outOfStockLabel || 'Agotado') + '</span>'
                     : '<span class="model__stock model__stock--in">' + x.s + ' ' + esc(cfg.inStockLabel || 'disp.') + '</span>';
    }
    var zoom = x.img || (x.gallery && x.gallery.length) || (x.features && x.features.length);
    var media = x.img ? '<img src="' + esc(src(x.img)) + '" alt="' + esc(x.alt || x.n) + '" loading="lazy" />' : '<span class="model__icon">' + esc(cat.icon || '🛒') + '</span>';
    return '<article class="model' + (x.f ? ' model--featured' : '') + '" data-c="' + esc(x.c) + '"><span class="model__num">' + n + '</span>' + stk +
      (x.f ? '<span class="model__feat">' + esc(cfg.featuredLabel || 'Destacado') + '</span>' : '') +
      '<div class="model__media' + (x.img ? ' has-img' : '') + (zoom ? ' is-zoom" role="button" tabindex="0" aria-label="Ver detalles de ' + esc(x.n) + '" data-pid="' + esc(x.id) : '') + '">' + media + '</div>' +
      '<div class="model__body"><span class="model__brand">' + esc(x.b || cat.singular || '') + '</span><h3>' + esc(x.n) + '</h3>' +
      (x.d ? '<p class="model__detail">' + esc(x.d) + '</p>' : '') + priceHTML(x, cfg) +
      '<a class="btn btn--soft" ' + productLink(x, cfg) + '>' + esc(x.cta || cfg.buttonLabel || 'Consultar') + '</a></div></article>';
  }
  function buildCat(cfg, cats, products) {
    var cont = document.querySelector('#catalogo .container'); if (!cont) return;
    // Destacados primero (el orden estable conserva el resto tal como viene del panel).
    CAT.P = (products || []).slice().sort(function (a, b) { return (b.f ? 1 : 0) - (a.f ? 1 : 0); });
    CAT.cats = cats || []; CAT.cfg = cfg || {};
    var present = {}; CAT.P.forEach(function (x) { present[x.c] = 1; });
    var chips = [['all', cfg.allLabel || 'Todos']].concat(CAT.cats.filter(function (c) { return present[c.code]; }).map(function (c) { return [c.code, c.name]; }));
    if (CAT.brand !== 'all' && !present[CAT.brand]) { CAT.brand = 'all'; CAT.page = 1; }
    cont.innerHTML = '<header class="section__head reveal in" data-volt-cat>' + head(cfg) + '</header>' +
      '<div class="catalog__filters" id="cf2">' + chips.map(function (c) {
        return '<button class="chip' + (c[0] === CAT.brand ? ' is-active' : '') + '" data-c="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
      }).join('') + '</div><div class="catalog__viewport" id="cv2"><div class="catalog__track" id="cg2"></div></div><nav class="catalog__pages" id="cp2" aria-label="Páginas del catálogo"></nav>' +
      (CAT.P.length ? '' : '<p class="catalog__note">El catálogo no está disponible en este momento. <a href="' + esc(wa(cfg.noteMessage)) + '" target="_blank" rel="noopener">Escríbenos por WhatsApp</a> y te ayudamos.</p>') +
      (cfg.noteText || cfg.noteLinkLabel ? '<p class="catalog__note reveal in">' + esc(cfg.noteText) + ' <a href="' + esc(wa(cfg.noteMessage)) + '" target="_blank" rel="noopener">' + esc(cfg.noteLinkLabel) + '</a>.</p>' : '');
    var grid = document.getElementById('cg2'), cf = document.getElementById('cf2'), cp = document.getElementById('cp2'), vp = document.getElementById('cv2');
    function listF() { return CAT.P.filter(function (x) { return CAT.brand === 'all' || x.c === CAT.brand; }); }
    function vw() { return Math.round(vp.getBoundingClientRect().width) || 1; }
    function pageCount() { return Math.max(1, Math.ceil(listF().length / PS)); }
    function setW() { var w = vw(); var pgs = grid.querySelectorAll('.catpage'); for (var i = 0; i < pgs.length; i++) pgs[i].style.width = w + 'px'; }
    function pagHTML(tp) {
      if (tp <= 1) return '';
      var page = CAT.page, h = '<button class="page-btn page-btn--nav" data-g="prev" aria-label="Anterior"' + (page === 1 ? ' disabled' : '') + '>‹</button>', show = [], n, last = 0;
      for (n = 1; n <= tp; n++) if (n === 1 || n === tp || (n >= page - 1 && n <= page + 1)) show.push(n);
      for (var i = 0; i < show.length; i++) {
        n = show[i];
        if (last && n - last > 1) h += '<span class="page-ellipsis">…</span>';
        h += '<button class="page-btn' + (n === page ? ' is-active' : '') + '" data-g="' + n + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>';
        last = n;
      }
      return h + '<button class="page-btn page-btn--nav" data-g="next" aria-label="Siguiente"' + (page === tp ? ' disabled' : '') + '>›</button>';
    }
    function updPag() { cp.innerHTML = pagHTML(pageCount()); }
    function render() {
      var L = listF(), tp = pageCount(); if (CAT.page > tp) CAT.page = tp;
      var h = '';
      for (var p = 0; p < tp; p++) {
        h += '<div class="catpage">';
        for (var k = 0; k < PS; k++) { var idx = p * PS + k; if (idx >= L.length) break; h += card(L[idx], idx + 1, CAT.cfg); }
        h += '</div>';
      }
      grid.innerHTML = h; setW(); updPag(); vp.scrollLeft = (CAT.page - 1) * vw();
    }
    function go(n) { var tp = pageCount(); CAT.page = Math.min(tp, Math.max(1, n)); vp.scrollTo({ left: (CAT.page - 1) * vw(), behavior: 'smooth' }); updPag(); }
    function realign() { setW(); vp.scrollLeft = (CAT.page - 1) * vw(); }
    cf.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      cf.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('is-active', c === b); });
      CAT.brand = b.dataset.c; CAT.page = 1; render();
    });
    cp.addEventListener('click', function (ev) {
      var b = ev.target.closest('.page-btn'); if (!b || b.disabled) return;
      var g = b.dataset.g; if (g === 'prev') go(CAT.page - 1); else if (g === 'next') go(CAT.page + 1); else go(parseInt(g, 10));
    });
    var tmr; vp.addEventListener('scroll', function () {
      clearTimeout(tmr); tmr = setTimeout(function () {
        var tp = pageCount(), cur = Math.round(vp.scrollLeft / vw()) + 1; cur = Math.max(1, Math.min(tp, cur));
        if (cur !== CAT.page) { CAT.page = cur; updPag(); }
      }, 120);
    }, { passive: true });
    CAT.realign = realign;
    if (window.ResizeObserver) { var lw = 0; new ResizeObserver(function () { var w = vw(); if (w !== lw) { lw = w; realign(); } }).observe(vp); }
    render();
    // Compatibilidad mientras voltstoreco.com siga en WordPress: su puente antiguo redibujaba el
    // catálogo desde la hoja de Google. Si algo ajeno reemplaza el catálogo, se vuelve a dibujar con el panel.
    if (!cont._voltGuard && window.MutationObserver) {
      cont._voltGuard = new MutationObserver(function () {
        if (!cont.querySelector('[data-volt-cat]') && CAT.cfg) buildCat(CAT.cfg, CAT.cats, CAT.P);
      });
      cont._voltGuard.observe(cont, { childList: true });
    }
  }
  var rtmr; window.addEventListener('resize', function () { clearTimeout(rtmr); rtmr = setTimeout(function () { if (CAT.realign) CAT.realign(); }, 150); });
  window.addEventListener('load', function () { if (CAT.realign) CAT.realign(); });

  /* ---------- detalle de producto (imagen, galería, características) ---------- */
  function openProduct(id) {
    var x = CAT.P.filter(function (p) { return p.id === id; })[0]; if (!x) return;
    var imgs = [x.img].concat(x.gallery || []).filter(Boolean), i = 0;
    var m = document.getElementById('pmodal');
    if (!m) {
      m = document.createElement('div'); m.id = 'pmodal'; m.className = 'pmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-hidden', 'true');
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.pmodal__close')) closeProduct(); });
    }
    function draw() {
      var cat = catByCode(x.c);
      m.innerHTML = '<div class="pmodal__box"><button class="pmodal__close" aria-label="Cerrar">&times;</button>' +
        (imgs.length ? '<div class="pmodal__media"><img src="' + esc(src(imgs[i])) + '" alt="' + esc(x.alt || x.n) + '" />' +
          (imgs.length > 1 ? '<button class="pmodal__nav pmodal__nav--prev" data-d="-1" aria-label="Foto anterior">‹</button><button class="pmodal__nav pmodal__nav--next" data-d="1" aria-label="Foto siguiente">›</button>' : '') + '</div>' : '') +
        '<div class="pmodal__body"><span class="model__brand">' + esc(x.b || cat.singular || '') + '</span><h3>' + esc(x.n) + '</h3>' +
        (x.d ? '<p class="model__detail">' + esc(x.d) + '</p>' : '') +
        ((x.features || []).length ? '<ul class="ticks">' + x.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
        priceHTML(x, CAT.cfg) + '<a class="btn btn--wa btn--block" ' + productLink(x, CAT.cfg) + '>' + esc(x.cta || CAT.cfg.buttonLabel || 'Consultar') + '</a></div></div>';
      m.querySelectorAll('.pmodal__nav').forEach(function (b) {
        b.addEventListener('click', function () { i = (i + parseInt(b.dataset.d, 10) + imgs.length) % imgs.length; draw(); });
      });
    }
    draw();
    m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    var c = m.querySelector('.pmodal__close'); if (c) c.focus();
  }
  function closeProduct() {
    var m = document.getElementById('pmodal'); if (!m || !m.classList.contains('open')) return;
    m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
  }

  /* ---------- aplicar todo el contenido ---------- */
  var lastJSON = '';
  function apply(site) {
    if (!site || !site.content) return false;
    var json = JSON.stringify(site);
    if (json === lastJSON) return true;
    lastJSON = json;
    var c = site.content;
    G = c.general || {};
    var h = c.header || {};
    try {
      applyTheme(c.theme);
      if (c.header) renderHeader(h);
      if (c.hero) renderHero(c.hero);
      if (c.marquee) renderMarquee(c.marquee);
      if (c.productos) renderProductos(c.productos);
      buildCat(c.catalogo || {}, site.categories, site.products);
      if (c.iphone) renderIphone(c.iphone);
      if (c.servicio) renderServicio(c.servicio);
      if (c.beneficios) renderBeneficios(c.beneficios);
      if (c.galeria) renderGaleria(c.galeria);
      if (c.cta) renderCta(c.cta);
      if (c.contacto) renderContacto(c.contacto, h);
      if (c.footer) renderFooter(c.footer, h);
      applyLayout(c.layout);
      applySeo(c.seo);
      if (c.general) applyJsonLd(G);
    } catch (e) {
      if (window.console) console.error('VOLT: no se pudo aplicar el contenido', e);
    }
    observeReveals();
    document.documentElement.setAttribute('data-volt-content', site.preview ? 'preview' : 'live');
    return true;
  }

  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  function fetchLive() {
    return timeout(fetch(SUPABASE_URL + '/rest/v1/rpc/get_public_site', {
      method: 'POST', cache: 'no-store',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}'
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), 6000);
  }
  function fetchSnapshot() {
    return timeout(fetch(BASE + 'data/site.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }), 6000);
  }
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function writeCache(s) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) { /* almacenamiento no disponible */ } }

  var gotPreview = false;
  function load() {
    return fetchLive().then(function (s) {
      if (gotPreview) return;          // en vista previa mandan los borradores del panel
      if (!PREVIEW) writeCache(s);
      apply(s);
    }).catch(function () {
      if (lastJSON || gotPreview) return;   // ya se mostró la copia guardada
      return fetchSnapshot().then(function (s) { if (!gotPreview) apply(s); })
        .catch(function () { if (!lastJSON) buildCat({}, [], []); });
    });
  }

  /* ---------- pantalla de carga (contador + barra) ---------- */
  var loader = document.getElementById('loader'), loaderDone = false;
  function hideLoader() {
    if (!loader || loaderDone) return;
    loaderDone = true;
    loader.classList.add('is-hidden');
    document.body.style.overflow = '';
  }
  if (loader) {
    var fill = document.getElementById('loaderFill'), pctEl = document.getElementById('loaderPct');
    var DURATION = 2100, startTs = null;
    var tick = function (ts) {
      if (loaderDone) return;
      if (startTs === null) startTs = ts;
      var t = Math.min(1, (ts - startTs) / DURATION), pct = Math.round((1 - Math.pow(1 - t, 2)) * 100);
      if (pctEl) pctEl.textContent = pct + '%';
      if (fill) fill.style.width = pct + '%';
      if (t < 1) requestAnimationFrame(tick); else setTimeout(hideLoader, 180);
    };
    requestAnimationFrame(tick);
    setTimeout(hideLoader, 5000); // failsafe
  }

  /* ---------- header al hacer scroll ---------- */
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 20); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- menú móvil ---------- */
  var burger = document.getElementById('hamburger'), menu = document.getElementById('mobileMenu'), overlay = document.getElementById('overlay');
  function setMenu(open) {
    if (!burger || !menu) return;
    burger.classList.toggle('active', open);
    menu.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('show', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    if (overlay) overlay.addEventListener('click', function () { setMenu(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }

  /* ---------- aparición al hacer scroll ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var sibs = [].slice.call(entry.target.parentElement.children).filter(function (c) { return c.classList.contains('reveal'); });
      entry.target.style.transitionDelay = (Math.min(sibs.indexOf(entry.target), 5) * 70) + 'ms';
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
  function observeReveals() {
    document.querySelectorAll('.reveal:not(.in)').forEach(function (r) { if (io) io.observe(r); else r.classList.add('in'); });
  }
  observeReveals();

  /* ---------- lightbox de la galería ---------- */
  var lb = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg'), lbClose = document.getElementById('lbClose');
  function closeLb() {
    if (!lb) return;
    lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
  }
  if (lb) {
    lbClose.addEventListener('click', closeLb);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  }

  /* ---------- clics delegados (sirven también para lo que el panel vuelve a dibujar) ---------- */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('.gallery__grid .g-item img');
    if (g && lb) {
      lbImg.src = g.src; lbImg.alt = g.alt;
      lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
      return;
    }
    var z = e.target.closest('.model__media.is-zoom');
    if (z) { openProduct(z.getAttribute('data-pid')); return; }
    var a = e.target.closest('a[href^="#"]');
    if (a) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setMenu(false); closeLb(); closeProduct(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.model__media.is-zoom')) {
      e.preventDefault(); openProduct(e.target.getAttribute('data-pid'));
    }
  });

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- arranque ---------- */
  if (PREVIEW) {
    // Vista previa del panel: recibe los borradores por postMessage, solo desde el mismo origen que el panel.
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'volt:preview') return;
      gotPreview = true;
      lastJSON = '';
      apply(e.data.site);
      hideLoader();
      if (e.data.scrollTo) {
        var t = sec(e.data.scrollTo);
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 64 });
      }
    });
    var parentWin = window.opener || (window.parent !== window ? window.parent : null);
    if (parentWin) parentWin.postMessage({ type: 'volt:preview-ready' }, location.origin);
  }
  var cached = !PREVIEW && readCache();
  if (cached) apply(cached);       // muestra al instante la última versión conocida
  load();
  if (!PREVIEW) setInterval(load, REFRESH_MS);
})();
