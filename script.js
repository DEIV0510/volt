/* ===== VOLT STORE CO — contenido administrable + interacciones =====
   El contenido (textos, imágenes, colores, secciones) y el catálogo se
   administran en el panel (/admin) y los guarda el servidor del sitio (/api).
   Esta página lee SOLO lo publicado. Si no responde, usa la última versión
   guardada en este navegador o data/site.json y, si tampoco, el HTML original. */
(function () {
  'use strict';

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
    share: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    bolt: function (s) { return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true"><path fill="currentColor" d="M13 2 L4 14 H11 L9 22 L20 9 H13 Z"/></svg>'; },
    apple: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.365 1.43c0 1.14-.42 2.2-1.13 3.02-.78.9-2.06 1.6-3.13 1.51-.13-1.06.42-2.2 1.06-2.94.78-.86 2.13-1.5 3.2-1.59zM20.5 17.2c-.6 1.4-.9 2-1.67 3.24-1.07 1.72-2.58 3.86-4.45 3.88-1.66.02-2.08-1.08-4.33-1.07-2.25.01-2.72 1.09-4.38 1.07-1.87-.02-3.3-1.95-4.37-3.67C-1.2 16.5-2.05 9.8 1.5 6.6c1.27-1.14 2.92-1.81 4.5-1.81 1.66 0 2.7 1.09 4.07 1.09 1.33 0 2.14-1.09 4.07-1.09 1.4 0 2.89.76 3.95 2.08-3.47 1.9-2.9 6.86 1.91 9.33z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.44c-3.15 0-3.52.01-4.76.07-1.15.05-1.77.24-2.19.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.42-.35 1.04-.4 2.19-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.05 1.15.24 1.77.4 2.19.21.55.47.94.88 1.35.41.41.8.67 1.35.88.42.16 1.04.35 2.19.4 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c1.15-.05 1.77-.24 2.19-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.42.35-1.04.4-2.19.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.05-1.15-.24-1.77-.4-2.19-.21-.55-.47-.94-.88-1.35-.41-.41-.8-.67-1.35-.88-.42-.16-1.04-.35-2.19-.4-1.24-.06-1.61-.07-4.76-.07zm0 2.45a5.95 5.95 0 110 11.9 5.95 5.95 0 010-11.9zm0 1.44a4.51 4.51 0 100 9.02 4.51 4.51 0 000-9.02zm6.19-.19a1.39 1.39 0 11-2.78 0 1.39 1.39 0 012.78 0z"/></svg>'
  };
  // Íconos de línea propios: los emoji que se eligen en el panel se muestran con estos dibujos (iguales en todos los celulares).
  var LI = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.6-4.6"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    battery: '<rect x="2.5" y="7" width="17" height="10" rx="2"/><path d="M22 10.5v3M11.5 9l-2.2 3h3.4l-2.2 3"/>',
    plug: '<path d="M9 2.5v5M15 2.5v5M6 7.5h12v3.5a6 6 0 0 1-12 0zM12 17v4.5"/>',
    laptop: '<rect x="4" y="4.5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>',
    tv: '<rect x="2.5" y="4" width="19" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
    tools: '<path d="M14.6 3.6a5 5 0 0 0-4.4 7L3.6 17.2a2.2 2.2 0 0 0 3.2 3.2l6.6-6.6a5 5 0 0 0 7-4.4l-3 3-3.3-.5-.5-3.3z"/>',
    star: '<path d="M12 2.8l2.8 5.8 6.4.8-4.7 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z"/>',
    person: '<circle cx="9.5" cy="8" r="3.8"/><path d="M2.5 20.5a7 7 0 0 1 14 0M16 11.5l2 2 4-4"/>',
    quality: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.6-5"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
    pin: '<path d="M12 21.5s-7-6.1-7-11.5a7 7 0 0 1 14 0c0 5.4-7 11.5-7 11.5z"/><circle cx="12" cy="10" r="2.6"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.5-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
    store: '<path d="M4 10v10.5h16V10M3 3.5h18l1 5.2a3 3 0 0 1-5.7 1.1 3.1 3.1 0 0 1-5.6 0 3 3 0 0 1-5.7-1.1zM9.5 20.5v-5.5h5v5.5"/>',
    call: '<path d="M5.2 3.5h3.3l1.8 4.4-2.3 1.5a11.2 11.2 0 0 0 6.6 6.6l1.5-2.3 4.4 1.8v3.3a2 2 0 0 1-2.1 2A16.6 16.6 0 0 1 3.2 5.6a2 2 0 0 1 2-2.1z"/>',
    mail: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 6.5l9 6.5 9-6.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
    map: '<path d="M9 4L3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20"/>',
    audio: '<path d="M3.5 17.5V13a8.5 8.5 0 0 1 17 0v4.5"/><rect x="3" y="13.5" width="4.5" height="7" rx="1.5"/><rect x="16.5" y="13.5" width="4.5" height="7" rx="1.5"/>',
    watch: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-3.5h4L15 6M9 18l1 3.5h4l1-3.5M12 9.3V12l1.7 1.5"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.4 11.5h11.2l2-8H6.6"/>',
    truck: '<path d="M2.5 5.5h11v10.5h-11zM13.5 9h4.2l3.3 3.6V16h-7.5"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    check: '<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
    flame: '<path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-4-3-6.2-3.6-10-2 1.5-3.2 3.6-3.2 5.8-1.1-.8-1.7-2.1-1.7-3.6C7.8 9.4 5.5 12 5.5 15a6.5 6.5 0 0 0 6.5 6.5z"/>',
    arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>'
  };
  var EMOJI = { '🔍': 'search', '🔎': 'search', '📱': 'phone', '📲': 'card', '💳': 'card', '💰': 'card', '🔋': 'battery', '🪫': 'battery',
    '🔌': 'plug', '💻': 'laptop', '🖥': 'laptop', '📺': 'tv', '🛠': 'tools', '🔧': 'tools', '🔨': 'tools', '⚙': 'tools', '🧰': 'box',
    '⭐': 'star', '🌟': 'star', '✨': 'quality', '🏆': 'quality', '✅': 'check', '✔': 'check', '🤝': 'person', '👤': 'person', '🙋': 'person',
    '📍': 'pin', '📌': 'pin', '💬': 'chat', '🗨': 'chat', '🏪': 'store', '🏬': 'store', '☎': 'call', '📞': 'call', '✉': 'mail', '📧': 'mail',
    '🕒': 'clock', '⏰': 'clock', '🕐': 'clock', '🗺': 'map', '🎧': 'audio', '🔊': 'audio', '⌚': 'watch', '🛡': 'shield', '📦': 'box',
    '🛒': 'cart', '🚚': 'truck', '🔥': 'flame' };
  function lineIcon(k, s) {
    return LI[k] ? '<svg class="li" viewBox="0 0 24 24" width="' + (s || 22) + '" height="' + (s || 22) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + LI[k] + '</svg>' : '';
  }
  // Ícono propio para un emoji o nombre del panel ('' si no hay equivalente).
  function svgIcon(i, s) {
    var k = String(i || '').replace(/️/g, '').trim();
    if (k === 'rayo' || k === 'bolt' || k === '⚡') return ICONS.bolt(s || 22);
    if (k === 'apple') return ICONS.apple;
    return lineIcon(EMOJI[k] || k, s);
  }
  // Si un texto empieza con un emoji conocido («📍 Atención…»), el emoji se cambia por el ícono propio.
  function iconText(t) {
    var m = /^\s*(\S+)\s+(.+)$/.exec(String(t || ''));
    var ic = m && EMOJI[m[1].replace(/️/g, '')] ? lineIcon(EMOJI[m[1].replace(/️/g, '')], 15) : '';
    return ic ? ic + ' ' + esc(m[2]) : esc(t);
  }
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
  // Texto de varias líneas (áreas de texto del panel): escapado y con los saltos de línea respetados.
  function txt(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
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
      (c.title ? '<h2>' + txt(c.title) + '</h2>' : '') + (c.text ? '<p>' + txt(c.text) + '</p>' : '');
  }
  function icon(i) { return svgIcon(i) || esc(i || ''); }
  function setHTML(el, html) { if (el && el.innerHTML !== html) el.innerHTML = html; }

  /* ---------- tema (colores, tipografía, esquinas) con límites seguros ---------- */
  function hex(c, d) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : d; }
  function rgba(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function shade(h, p) {
    var n = parseInt(h.slice(1), 16), f = function (x) { return Math.max(0, Math.min(255, Math.round(x * (1 + p)))); };
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(function (x) { return ('0' + f(x).toString(16)).slice(-2); }).join('');
  }
  function lum(h) {   // luminancia relativa (WCAG) de un color #RRGGBB
    var n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, p) {   // mezcla a con b (p = parte de b, 0..1)
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    return '#' + [16, 8, 0].map(function (sh) {
      var v = Math.round(((x >> sh) & 255) * (1 - p) + ((y >> sh) & 255) * p);
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }
  function applyTheme(t) {
    if (!t) return;
    var r = document.documentElement, s = r.style;
    var primary = hex(t.primary, '#FFD400'), primary2 = hex(t.primary2, '#FFC400'), dark = hex(t.dark, '#121219'), waC = hex(t.wa, '#25D366');
    var bg = hex(t.bg, '#FFFFFF'), ink = hex(t.ink, '#15161C');
    s.setProperty('--volt', primary);
    s.setProperty('--volt-2', primary2);
    s.setProperty('--volt-ink', hex(t.primaryInk, '#1A1500'));
    s.setProperty('--volt-soft', rgba(primary2, 0.14));
    s.setProperty('--shadow-volt', '0 14px 34px ' + rgba(primary2, 0.30));
    // Texto en el color principal (etiquetas, marcas): una versión oscura con buen contraste sobre el fondo.
    if (primary.toUpperCase() === '#FFD400' && bg.toUpperCase() === '#FFFFFF') { s.removeProperty('--volt-text'); s.removeProperty('--volt-text-d'); }
    else {
      var vt = primary, light = lum(bg) > 0.4;
      for (var k = 0; k < 20 && contrast(vt, bg) < 4.5; k++) vt = mix(vt, light ? '#000000' : '#FFFFFF', 0.12);
      s.setProperty('--volt-text', vt);
      s.setProperty('--volt-text-d', mix(vt, light ? '#000000' : '#FFFFFF', 0.1));
    }
    s.setProperty('--dark', dark);
    s.setProperty('--dark-2', shade(dark, -0.3));
    s.setProperty('--dark-soft', mix(dark, '#FFFFFF', 0.06));
    s.setProperty('--bg', bg);
    s.setProperty('--bg-soft', hex(t.bgSoft, '#F3F4F7'));
    s.setProperty('--ink', ink);
    s.setProperty('--muted', hex(t.muted, '#6A6B76'));
    // Fondo oscuro: tarjetas, líneas y texto secundario se adaptan para que nada quede blanco sobre blanco.
    var darkBg = lum(bg) < 0.2;
    r.setAttribute('data-volt-bg', darkBg ? 'dark' : 'light');
    ['--surface', '--bg-soft-2', '--line', '--line-2', '--ink-soft'].forEach(function (v) { s.removeProperty(v); });
    if (darkBg) {
      s.setProperty('--surface', mix(bg, '#FFFFFF', 0.07));
      s.setProperty('--bg-soft-2', mix(bg, '#FFFFFF', 0.12));
      s.setProperty('--line', 'rgba(255,255,255,.12)');
      s.setProperty('--line-2', 'rgba(255,255,255,.07)');
    }
    if (ink.toUpperCase() !== '#15161C') s.setProperty('--ink-soft', mix(ink, bg, 0.18));
    var tc = document.head.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', bg);
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
  function applyJsonLd(g, seo) {
    var og = seo && seo.ogImage && src(seo.ogImage) ? seo.ogImage : 'img/og.jpg';
    var data = {
      '@context': 'https://schema.org', '@type': 'ElectronicsStore', name: g.name || 'VOLT STORE CO',
      description: g.tagline || '', image: /^https:/.test(og) ? og : new URL(src(og), location.href).href,
      telephone: '+' + String(g.whatsapp || '').replace(/\D/g, ''),
      address: { '@type': 'PostalAddress', streetAddress: g.address || '', addressRegion: 'Norte de Santander', addressCountry: 'CO' },
      sameAs: (g.socials || []).map(function (x) { return x.url; }).filter(function (u) { return /^https?:/.test(u); })
    };
    if (g.email) data.email = g.email;
    if (g.mapUrl && /^https:/.test(g.mapUrl)) data.hasMap = g.mapUrl;
    // El horario es texto libre ("Lunes a sábado…"); schema.org exige otro formato, así que no se incluye.
    var el = document.getElementById('volt-jsonld');
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'volt-jsonld'; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }

  /* ---------- render de cada sección (mismo HTML y clases que el original) ---------- */
  var NETWORKS = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', x: 'X', twitter: 'X',
                   whatsapp: 'WhatsApp', telegram: 'Telegram', linkedin: 'LinkedIn', pinterest: 'Pinterest', threads: 'Threads' };
  function socialsHTML() {
    return (G.socials || []).filter(function (x) { return x && x.url; }).map(function (x) {
      var name = x.label || NETWORKS[x.network] || 'Red social';
      return '<a ' + linkAttrs(x.url) + ' aria-label="' + esc(name + ' de ' + (G.name || 'VOLT STORE CO')) + '">' + esc(name) + '</a>';
    }).join('');
  }
  function navHTML(items) {
    return (items || []).map(function (x) { return '<a ' + linkAttrs(x.href) + '>' + esc(x.label) + '</a>'; }).join('');
  }

  function renderHeader(h) {
    var logo = $('.header .brand__logo');
    // Con fondo oscuro (Diseño → Colores) el encabezado usa el logotipo para fondos oscuros.
    var useWhite = document.documentElement.getAttribute('data-volt-bg') === 'dark' && h.logoWhite;
    var lsrc = src(useWhite ? h.logoWhite : (h.logo || 'img/logo.webp'));
    if (logo && lsrc) { if (logo.getAttribute('src') !== lsrc) logo.src = lsrc; logo.alt = h.logoAlt || G.name || ''; }
    LOGO = src(h.logo || 'img/logo.webp');   // el de fondo claro: es el que va en los recuadros de productos sin foto
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
    title = title.replace(/\r?\n/g, '<br>');
    setHTML($('.hero__content', s),
      (c.eyebrow ? '<span class="eyebrow"><i class="dot"></i> ' + esc(c.eyebrow) + '</span>' : '') +
      (title ? '<h1>' + title + '</h1>' : '') +
      (c.subtitle ? '<p class="hero__sub">' + txt(c.subtitle) + '</p>' : '') +
      (c.badge ? '<div class="hero__badge">' + ICONS.bolt(16) + ' ' + esc(c.badge) + '</div>' : '') +
      '<div class="hero__cta">' + btn(c.primary, 'btn--volt btn--lg', 'btn--wa btn--lg') + btn(c.secondary, 'btn--ghost btn--lg', 'btn--wa btn--lg') + '</div>' +
      ((c.stats || []).length ? '<ul class="hero__stats">' + c.stats.map(function (x) {
        return '<li><strong>' + esc(x.value) + '</strong><span>' + esc(x.label) + '</span></li>';
      }).join('') + '</ul>' : ''));
    var img = $('.hero__frame img', s);
    if (img && c.image) { img.src = src(c.image); img.alt = c.imageAlt || ''; }
    var top = $('.hero__chip--top', s), bot = $('.hero__chip--bottom', s);
    if (top) { top.style.display = c.chipTop ? '' : 'none'; setHTML(top, ICONS.bolt(15) + ' ' + esc(c.chipTop)); }
    if (bot) { bot.style.display = c.chipBottom ? '' : 'none'; setHTML(bot, iconText(c.chipBottom)); }
  }

  function renderMarquee(c) {
    var t = $('.marquee__track'); if (!t) return;
    var items = (c.items || []).filter(function (x) { return x && String(x).trim(); });
    var m = sec('marquee'); if (m) m.classList.toggle('is-empty', !items.length);
    var one = items.map(function (x) { return '<span>' + esc(x) + '</span><i>' + ICONS.bolt(18) + '</i>'; }).join('');
    // Cada mitad repite los textos hasta cubrir pantallas anchas (sin huecos); la velocidad se mantiene.
    var reps = Math.max(1, Math.ceil(12 / Math.max(1, items.length)));
    var half = new Array(reps + 1).join(one);
    setHTML(t, half + half);
    t.style.animationDuration = Math.round(28 * reps * Math.max(1, items.length) / 6) + 's';
  }

  function renderProductos(c) {
    var s = sec('productos'); if (!s) return;
    setHTML($('.section__head', s), head(c));
    var cards = (c.cards || []).map(function (x) {
      var img = x.image && src(x.image);
      // Sin imagen no se deja un recuadro gris vacío: la etiqueta pasa al cuerpo de la tarjeta.
      return '<article class="card reveal' + (img ? '' : ' card--noimg') + '">' + (img ? '<div class="card__img">' +
        '<img src="' + esc(img) + '" alt="' + esc(x.imageAlt) + '" loading="lazy" width="800" height="600" />' +
        (x.tag ? '<span class="tag">' + esc(x.tag) + '</span>' : '') + '</div>' : '') + '<div class="card__body">' +
        (!img && x.tag ? '<span class="tag">' + esc(x.tag) + '</span>' : '') + (x.title ? '<h3>' + esc(x.title) + '</h3>' : '') +
        (x.text ? '<p>' + txt(x.text) + '</p>' : '') + btn(x.button, 'btn--soft') + '</div></article>';
    }).join('');
    var ctaBtn = btn(c.ctaButton, 'btn--volt', 'btn--wa');
    if (c.showCtaCard !== false && (c.ctaTitle || c.ctaText || ctaBtn)) {
      cards += '<article class="card card--cta reveal"><div class="card__body"><span class="card__icon">' + ICONS.bolt(26) + '</span>' +
        (c.ctaTitle ? '<h3>' + esc(c.ctaTitle) + '</h3>' : '') + (c.ctaText ? '<p>' + txt(c.ctaText) + '</p>' : '') + ctaBtn + '</div></article>';
    }
    setHTML($('.cards', s), cards);
  }

  // «Desde $…»: el precio más bajo de los iPhone disponibles en el catálogo (se actualiza solo con los precios del panel).
  function iphoneFrom() {
    var min = null;
    CAT.P.forEach(function (x) {
      // Solo equipos (no cargadores, cables ni forros «para iPhone»).
      if (!/iphone/i.test((x.b || '') + ' ' + x.n) || artKind(x, catByCode(x.c)) !== 'phone' || x.price == null || (x.s != null && x.s <= 0)) return;
      var v = onPromo(x) ? x.promo : x.price;
      if (min == null || v < min) min = v;
    });
    return min == null ? '' : '<p class="iphone__from"><span>Desde</span><strong>' + money(min) + '</strong></p>';
  }
  function renderIphone(c) {
    var s = sec('iphone'); if (!s) return;
    setHTML($('.iphone__content', s),
      (c.kicker ? '<span class="kicker">' + esc(c.kicker) + '</span>' : '') + (c.title ? '<h2>' + txt(c.title) + '</h2>' : '') +
      (c.text ? '<p class="lead">' + txt(c.text) + '</p>' : '') + iphoneFrom() +
      ((c.ticks || []).length ? '<ul class="ticks">' + c.ticks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      ((c.primary && c.primary.label) || (c.secondary && c.secondary.label) ?
        '<div class="iphone__cta">' + btn(c.primary, 'btn--volt btn--lg') + btn(c.secondary, 'btn--ghost btn--lg') + '</div>' : ''));
    var img = $('.iphone__frame img', s);
    if (img && c.image) { img.src = src(c.image); img.alt = c.imageAlt || ''; }
  }

  function renderServicio(c) {
    var s = sec('servicio'); if (!s) return;
    setHTML($('.section__head', s), head(c));
    setHTML($('.service__grid', s), (c.items || []).map(function (x) {
      return '<div class="srv' + (x.soon ? ' srv--soon' : '') + ' reveal"><span class="srv__ic">' + icon(x.icon) + '</span><h3>' + esc(x.title) + '</h3>' +
        (x.text ? '<p>' + txt(x.text) + '</p>' : '') + (x.soon ? '<span class="soon">' + esc(x.soonLabel || 'Próximamente') + '</span>' : '') + '</div>';
    }).join(''));
    var cta = $('.service__cta', s);
    if (cta) { cta.style.display = c.button && c.button.label ? '' : 'none'; setHTML(cta, btn(c.button, 'btn--volt btn--lg')); }
  }

  function renderBeneficios(c) {
    var s = sec('beneficios'); if (!s) return;
    setHTML($('.section__head', s), head(c));
    setHTML($('.benefits__grid', s), (c.items || []).map(function (x) {
      return '<div class="ben reveal"><span class="ben__ic">' + icon(x.icon) + '</span><h3>' + esc(x.title) + '</h3>' +
        (x.text ? '<p>' + txt(x.text) + '</p>' : '') + '</div>';
    }).join(''));
  }

  function renderGaleria(c) {
    var s = sec('galeria'); if (!s) return;
    // Botón con el estilo de Instagram solo si el enlace es de Instagram; para TikTok u otros, el botón principal.
    var isIg = /^https:\/\/(www\.)?instagram\.com\//i.test(c.buttonUrl || '');
    setHTML($('.section__head', s), head(c) + (c.showButton !== false && c.buttonLabel ?
      '<a class="btn ' + (isIg ? 'btn--ig' : 'btn--volt') + ' btn--lg section__head-cta" ' + linkAttrs(c.buttonUrl) + ' aria-label="' + esc(c.buttonLabel) + '">' +
        (isIg ? ICONS.ig + ' ' : '') + esc(c.buttonLabel) + '</a>' : ''));
    setHTML($('.gallery__grid', s), (c.images || []).map(function (x) {
      var size = x.size === 'tall' ? ' g-item--tall' : x.size === 'wide' ? ' g-item--wide' : '';
      return '<figure class="g-item' + size + ' reveal"><img src="' + esc(src(x.image)) + '" alt="' + esc(x.alt) + '" width="800" height="800" loading="lazy" decoding="async" /></figure>';
    }).join(''));
  }

  function renderCta(c) {
    var s = sec('cta'); if (!s) return;
    setHTML($('.cta-band__inner', s), (c.title ? '<h2>' + txt(c.title) + '</h2>' : '') + (c.text ? '<p>' + txt(c.text) + '</p>' : '') + btn(c.button, 'btn--volt btn--xl', 'btn--wa btn--xl'));
  }

  function renderContacto(c, h) {
    var s = sec('contacto'); if (!s) return;
    // Los textos pueden usar {whatsapp}, {telefono}, {correo}, {direccion} y {horario}: se llenan con «Información del negocio».
    var fill = function (t) {
      return String(t || '').replace(/\{(whatsapp|telefono|correo|direccion|horario)\}/g, function (_, k) {
        return { whatsapp: G.whatsappDisplay, telefono: G.phone, correo: G.email, direccion: G.address, horario: G.hours }[k] || '';
      });
    };
    var items = (c.items || []).map(function (x) { return { icon: x.icon, title: x.title, text: fill(x.text) }; });
    // Teléfono, correo, horario y mapa de «Información del negocio» se agregan si la lista aún no los muestra.
    var shown = items.map(function (x) { return (x.title + ' ' + x.text).toLowerCase(); }).join(' | ');
    var has = function (v) { return shown.indexOf(String(v).toLowerCase()) >= 0; };
    var extra = [
      G.phone && !has(G.phone) && ['☎️', 'Teléfono', G.phone, 'tel:' + G.phone.replace(/[^0-9+]/g, '')],
      G.email && !has(G.email) && ['✉️', 'Correo', G.email, 'mailto:' + G.email],
      G.hours && !has(G.hours) && ['🕒', 'Horario', G.hours, ''],
      G.mapUrl && !has('mapa') && ['🗺️', 'Cómo llegar', 'Ver en el mapa', G.mapUrl]
    ].filter(Boolean);
    var li = function (ic, title, text, href) {
      var body = '<div><strong>' + esc(title) + '</strong><small>' + (href ? '<a ' + linkAttrs(href) + '>' + esc(text) + '</a>' : txt(text)) + '</small></div>';
      return '<li><span class="ci">' + icon(ic) + '</span>' + body + '</li>';
    };
    var list = items.map(function (x) { return li(x.icon, x.title, x.text); }).join('') + extra.map(function (x) { return li(x[0], x[1], x[2], x[3]); }).join('');
    var socials = c.showSocials !== false ? socialsHTML() : '';
    setHTML($('.contact__info', s),
      (c.kicker ? '<span class="kicker">' + esc(c.kicker) + '</span>' : '') + (c.title ? '<h2>' + txt(c.title) + '</h2>' : '') +
      (c.text ? '<p class="lead">' + txt(c.text) + '</p>' : '') +
      (list ? '<ul class="contact__list">' + list + '</ul>' : '') +
      (socials ? '<div class="contact__socials">' + socials + '</div>' : ''));
    setHTML($('.contact__card', s),
      '<div class="contact__card-glow" aria-hidden="true"></div>' +
      '<img class="brand__logo" src="' + esc(src(h.logoWhite || 'img/logo-white.webp')) + '" alt="' + esc(G.name) + '" width="200" height="46" />' +
      (c.cardTitle ? '<h3>' + esc(c.cardTitle) + '</h3>' : '') + (c.cardText ? '<p>' + txt(c.cardText) + '</p>' : '') +
      btn(c.cardButton, 'btn--volt btn--block btn--lg', 'btn--wa btn--block btn--lg') +
      (c.showNumber !== false && G.whatsappDisplay ? '<span class="contact__num">' + esc(G.whatsappDisplay) + '</span>' : ''));
  }

  function renderFooter(f, h) {
    var foot = $('.footer'); if (!foot) return;
    setHTML($('.footer__brand', foot),
      '<a href="#inicio" class="brand"><img class="brand__logo" src="' + esc(src(h.logoWhite || 'img/logo-white.webp')) + '" alt="' + esc(G.name) + '" width="200" height="46" /></a>' +
      (f.text ? '<p>' + txt(f.text) + '</p>' : '') + '<div class="footer__socials">' + socialsHTML() + '</div>');
    var cols = foot.querySelectorAll('.footer__col');
    if (cols[0]) setHTML(cols[0], (f.linksTitle ? '<h4>' + esc(f.linksTitle) + '</h4>' : '') + navHTML(f.links));
    if (cols[1]) setHTML(cols[1], (f.contactTitle ? '<h4>' + esc(f.contactTitle) + '</h4>' : '') +
      (f.showWhatsapp !== false ? '<a href="' + esc(wa()) + '" target="_blank" rel="noopener">WhatsApp' + (G.whatsappDisplay ? ': ' + esc(G.whatsappDisplay) : '') + '</a>' : '') +
      (f.showEmail !== false && G.email ? '<a href="mailto:' + esc(G.email) + '">' + esc(G.email) + '</a>' : '') +
      (G.phone ? '<a href="tel:' + esc(G.phone.replace(/[^0-9+]/g, '')) + '">' + esc(G.phone) + '</a>' : '') +
      (f.showAddress !== false && G.address ? (G.mapUrl ? '<a ' + linkAttrs(G.mapUrl) + '>' + esc(G.address) + '</a>' : '<span>' + esc(G.address) + '</span>') : '') +
      (f.showHours !== false && G.hours ? '<span>' + esc(G.hours) + '</span>' : ''));
    // El año se agrega solo; si el texto ya trae «©» o un año, se respeta tal cual.
    var cp = String(f.copyright || '').trim();
    var cpTxt = /©|\b(19|20)\d{2}\b/.test(cp) ? cp : '© ' + new Date().getFullYear() + (cp ? ' ' + cp : '');
    setHTML($('.footer__bottom', foot),
      '<p>' + esc(cpTxt) + '</p>' +
      ((f.legal || []).length ? '<p class="footer__legal">' + f.legal.map(function (x) { return '<a ' + linkAttrs(x.href) + '>' + esc(x.label) + '</a>'; }).join(' · ') + '</p>' : '') +
      (f.slogan ? '<p>' + esc(f.slogan) + '</p>' : ''));
  }
  function renderFloat() {
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
    // Fondos alternados: dos secciones claras seguidas nunca quedan del mismo tono, aunque se reordenen u oculten.
    // Tras una sección oscura (o la portada) cada una conserva su fondo original, así el orden por defecto no cambia.
    var prev = null;
    [].forEach.call(parent.querySelectorAll(':scope > [data-section]'), function (el) {
      if (el.classList.contains('is-section-hidden')) return;
      if (el.dataset.soft == null) el.dataset.soft = el.classList.contains('section--soft') ? '1' : '0';
      var light = el.classList.contains('section') && !el.classList.contains('iphone');
      if (!light) { prev = null; return; }
      var soft = prev === null ? el.dataset.soft === '1' : !prev;
      el.classList.toggle('section--soft', soft);
      prev = soft;
    });
    // Oculta los enlaces (menú, pie y botones) que llevan a secciones ocultas.
    var hidden = list.filter(function (x) { return x.visible === false; }).map(function (x) { return '#' + ANCHOR[x.id]; });
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      if (a.closest('.is-section-hidden')) return;
      a.style.display = hidden.indexOf(a.getAttribute('href')) >= 0 ? 'none' : '';
    });
  }

  /* ---------- catálogo ---------- */
  var CAT = { P: [], cats: [], cfg: {}, brand: 'all', page: 1, q: '' };
  var PS = 6;
  // Productos por página: 4 × 2 en computador, 3 × 2 en tableta y 2 × 3 en celular (igual que las columnas del CSS).
  function perPage() { return window.innerWidth > 980 ? 8 : 6; }
  var HOVER = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  function catByCode(code) { for (var i = 0; i < CAT.cats.length; i++) if (CAT.cats[i].code === code) return CAT.cats[i]; return {}; }
  function onPromo(x) { return x.price != null && x.promo != null && x.promo < x.price; }
  function offPct(x) { return onPromo(x) ? Math.round((1 - x.promo / x.price) * 100) : 0; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  // Quita los corchetes de plantilla que quedan en los textos («[128gb]» → «128gb»).
  function clean(s) { return String(s == null ? '' : s).replace(/\[([^[\]]*)\]/g, '$1').replace(/[ \t]{2,}/g, ' ').trim(); }
  // «iPhone 13 pro max · 128 GB · Negro» → modelo «iPhone 13 Pro Max» y datos [«128 GB», «Negro»].
  function nameParts(x) {
    var segs = String(x.n || '').split(/\s+[·•|]\s+/).map(clean).filter(Boolean);
    var model = (segs.shift() || clean(x.n)).replace(/\b(pro|max|plus|mini|ultra|lite)\b/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
    var chips = segs.slice(0, 4);
    if (!chips.length) chips = (x.specs || []).filter(function (r) { return r && r[1]; }).slice(0, 3).map(function (r) { return clean(r[1]); });
    return { model: model, chips: chips };
  }

  /* ---------- producto sin foto ----------
     Recuadro limpio con el logo de la tienda (sin íconos ni dibujos). Al subir la foto en el panel, la foto lo reemplaza. */
  var LOGO = '';   // logotipo del encabezado (Encabezado y menú → Logotipo)
  function art(x) {
    return '<span class="pa"><img class="pa__logo" src="' + esc(LOGO || src('img/logo.webp')) + '" alt="" width="180" height="38" loading="lazy" decoding="async" /></span>';
  }
  // Tipo de producto (para saber qué es un celular: el «Desde $…» de iPhone no cuenta cargadores ni forros).
  function artKind(x, cat) {
    var n = norm(x.n), t = norm((cat.name || '') + ' ' + (cat.singular || '') + ' ' + x.n), e = String(cat.icon || '').replace(/\uFE0F/g, '');
    if (/\bcable/.test(n)) return 'cable';
    if (/airpod|audifon|auricular|\bbuds|diadema|parlante|bafle/.test(t) || e === '🎧') return 'buds';
    if (/reloj|watch/.test(t) || e === '⌚') return 'watch';
    if (/vidrio|templado|protector de pantalla|\bmica/.test(t) || e === '🛡') return 'glass';
    if (/forro|funda|\bcase\b|estuche/.test(t)) return 'case';
    if (/cargador|adaptador|\bcarga/.test(t) || e === '🔌') return 'charger';
    if (/celular|iphone|smartphone|telefono|galaxy|xiaomi|redmi|motorola/.test(t) || e === '📱') return 'phone';
    return 'other';
  }

  function priceHTML(x, cfg, save, noOff) {
    if (x.price == null) return '<span class="model__price model__price--ask">' + esc(cfg.askPriceLabel || 'Consultar precio') + '</span>';
    if (onPromo(x)) {
      // En oferta se compara con el precio normal más bajo (no con el rango), en dos líneas.
      var off = noOff ? 0 : offPct(x);
      return '<span class="model__price model__price--promo"><s class="model__old">' + money(x.price) + '</s>' +
        '<span class="model__now">' + money(x.promo) + (off >= 1 ? ' <span class="model__off">-' + off + '%</span>' : '') + '</span>' +
        (save ? '<span class="model__save">Ahorras ' + money(x.price - x.promo) + '</span>' : '') + '</span>';
    }
    var max = x.price_max && x.price_max > x.price ? x.price_max : 0;
    return '<span class="model__price">' + money(x.price) + (max ? '<span class="model__max"> – ' + money(max) + '</span>' : '') + '</span>';
  }
  function productLink(x, cfg) {
    var cat = catByCode(x.c);
    if (x.url) return linkAttrs(x.url);
    var price = x.price == null ? '' : money(onPromo(x) ? x.promo : x.price);
    var msg = String(x.msg || cfg.productMessage || 'Hola, quiero consultar disponibilidad y precio de: {producto} ({categoria}) en VOLT STORE CO.')
      .split('{producto}').join(x.n).split('{categoria}').join(cat.singular || '').split('{precio}').join(price).split('{enlace}').join(productUrl(x));
    return 'href="' + esc(wa(msg)) + '" target="_blank" rel="noopener"';
  }
  // Botón de compra: verde con el ícono de WhatsApp si abre WhatsApp; amarillo si lleva a otro enlace.
  function buyBtn(x, cfg, extra) {
    var isWa = !x.url || /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(x.url);
    return '<a class="btn ' + (isWa ? 'btn--wa' : 'btn--volt') + (extra || '') + '" ' + productLink(x, cfg) + '>' + (isWa ? ICONS.wa : '') +
      '<span>' + esc(x.cta || cfg.buttonLabel || 'Consultar') + '</span></a>';
  }
  // Existencias como en una tienda: «Última unidad», «8 disp.» o «Agotado».
  function availHTML(x, cfg) {
    if (cfg.showStock === false || x.s == null) return '';
    if (x.s <= 0) return '<span class="model__avail model__avail--out">' + esc(cfg.outOfStockLabel || 'Agotado') + '</span>';
    if (x.s === 1) return '<span class="model__avail model__avail--low">Última unidad</span>';
    return '<span class="model__avail">' + x.s + ' ' + esc(cfg.inStockLabel || 'disp.') + '</span>';
  }
  function chipsHTML(list, cls) {
    return list.length ? '<ul class="model__chips' + (cls || '') + '">' + list.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '';
  }
  function card(x, n, cfg) {
    var cat = catByCode(x.c), np = nameParts(x), off = offPct(x);
    // La foto llena todo el recuadro cuadrado. Con mouse, si hay galería, al pasar el cursor se ve la segunda foto.
    var alt2 = HOVER && x.img ? (x.gallery || []).filter(function (u) { return u && u !== x.img && src(u); })[0] : '';
    var media = x.img ? '<img class="model__img" src="' + esc(src(x.img)) + '" alt="' + esc(x.alt || x.n) + '" width="600" height="600" loading="lazy" decoding="async" />' +
      (alt2 ? '<img class="model__img model__img--alt" src="' + esc(src(alt2)) + '" alt="" aria-hidden="true" width="600" height="600" loading="lazy" decoding="async" />' : '')
      : art(x, cat);
    var tags = (onPromo(x) ? '<span class="model__promo">' + esc(cfg.promoLabel || 'Oferta') + (off >= 1 ? ' −' + off + '%' : '') + '</span>' : '') +
      (x.f ? '<span class="model__feat">' + esc(cfg.featuredLabel || 'Destacado') + '</span>' : '');
    // Toda la tarjeta abre la ficha del producto (foto y nombre); el botón escribe por WhatsApp.
    return '<article class="model' + (x.f ? ' model--featured' : '') + (x.s != null && x.s <= 0 ? ' model--out' : '') + '" data-c="' + esc(x.c) + '">' +
      '<div class="model__media ' + (x.img ? 'has-img' : 'has-art') + ' is-zoom" role="button" tabindex="0" aria-label="Ver detalles de ' + esc(x.n) + '" data-pid="' + esc(x.id) + '">' + media +
      (tags ? '<span class="model__tags">' + tags + '</span>' : '') + '</div>' +
      '<div class="model__body"><span class="model__brand">' + esc(x.b || cat.singular || '') + '</span>' +
      '<h3><a class="model__link" href="' + esc(productHash(x)) + '" data-open="' + esc(x.id) + '">' + esc(np.model) + '</a></h3>' + chipsHTML(np.chips) +
      '<div class="model__foot">' + priceHTML(x, cfg, false, true) + availHTML(x, cfg) + buyBtn(x, cfg) + '</div></div></article>';
  }
  function buildCat(cfg, cats, products) {
    var cont = document.querySelector('#catalogo .container'); if (!cont) return;
    // Destacados primero y agotados al final (el orden estable conserva el resto tal como viene del panel).
    var rank = function (x) { return (x.f ? 0 : 1) + (x.s != null && x.s <= 0 ? 2 : 0); };
    CAT.P = (products || []).slice().sort(function (a, b) { return rank(a) - rank(b); });
    CAT.cats = cats || []; CAT.cfg = cfg || {};
    var present = {}; CAT.P.forEach(function (x) { present[x.c] = 1; if (onPromo(x)) present.promo = 1; });
    // Si hay productos en oferta aparece el filtro «Ofertas», justo después de «Todos».
    var chips = [['all', cfg.allLabel || 'Todos', '']].concat(present.promo ? [['promo', cfg.promoFilterLabel || 'Ofertas', lineIcon('flame', 16)]] : [])
      .concat(CAT.cats.filter(function (c) { return present[c.code] && c.code !== 'promo'; }).map(function (c) { return [c.code, c.name, svgIcon(c.icon, 16)]; }));
    if (CAT.brand !== 'all' && !present[CAT.brand]) { CAT.brand = 'all'; CAT.page = 1; }
    // Buscador + filtros: como en una tienda en línea, se puede escribir «iphone 13», «cargador», «airpods»…
    cont.innerHTML = '<header class="section__head reveal in" data-volt-cat>' + head(cfg) + '</header>' +
      (CAT.P.length ? '<div class="catalog__bar"><label class="catalog__search">' + lineIcon('search', 19) +
        '<input type="search" id="cq2" placeholder="Buscar iPhone, cargador, AirPods…" autocomplete="off" enterkeyhint="search" aria-label="Buscar en el catálogo" value="' + esc(CAT.q) + '" /></label>' +
        '<span class="catalog__count" id="cn2" aria-live="polite"></span></div>' : '') +
      '<div class="catalog__filters" id="cf2">' + chips.map(function (c) {
        return '<button class="chip' + (c[0] === CAT.brand ? ' is-active' : '') + (c[0] === 'promo' ? ' chip--promo' : '') + '" data-c="' + esc(c[0]) + '">' + c[2] + '<span>' + esc(c[1]) + '</span></button>';
      }).join('') + '</div><div class="catalog__viewport" id="cv2"><div class="catalog__track" id="cg2"></div></div><nav class="catalog__pages" id="cp2" aria-label="Páginas del catálogo"></nav>' +
      (CAT.P.length ? '' : '<p class="catalog__note">El catálogo no está disponible en este momento. <a href="' + esc(wa(cfg.noteMessage)) + '" target="_blank" rel="noopener">Escríbenos por WhatsApp</a> y te ayudamos.</p>') +
      (cfg.noteText || cfg.noteLinkLabel ? '<p class="catalog__note reveal in">' + esc(cfg.noteText) +
        (cfg.noteLinkLabel ? ' <a href="' + esc(wa(cfg.noteMessage)) + '" target="_blank" rel="noopener">' + esc(cfg.noteLinkLabel) + '</a>.' : '') + '</p>' : '');
    var grid = document.getElementById('cg2'), cf = document.getElementById('cf2'), cp = document.getElementById('cp2'), vp = document.getElementById('cv2');
    var cq = document.getElementById('cq2'), cn = document.getElementById('cn2');
    // Búsqueda sin tildes ni mayúsculas; todas las palabras deben aparecer (nombre, marca, categoría o descripción).
    function hit(x) {
      var words = norm(CAT.q).split(/\s+/).filter(Boolean);
      if (!words.length) return true;
      var hay = norm([x.n, x.b, catByCode(x.c).name, x.d].join(' '));
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }
    function listF() { return CAT.P.filter(function (x) { return (CAT.brand === 'all' || (CAT.brand === 'promo' ? onPromo(x) : x.c === CAT.brand)) && hit(x); }); }
    function vw() { return Math.round(vp.getBoundingClientRect().width) || 1; }
    function pageCount() { return Math.max(1, Math.ceil(listF().length / PS)); }
    function setW() { var w = vw(); var pgs = grid.querySelectorAll('.catpage'); for (var i = 0; i < pgs.length; i++) pgs[i].style.width = w + 'px'; }
    function pagHTML(tp) {
      if (tp <= 1) return '';
      var page = CAT.page, h = '<button class="page-btn page-btn--nav" data-g="prev" aria-label="Anterior"' + (page === 1 ? ' disabled' : '') + '>‹</button>', show = [], n, last = 0;
      var near = vw() < 440 ? 0 : 1;   // en pantallas angostas solo la página actual, para que quepa en una línea
      for (n = 1; n <= tp; n++) if (n === 1 || n === tp || Math.abs(n - page) <= near) show.push(n);
      for (var i = 0; i < show.length; i++) {
        n = show[i];
        if (last && n - last > 1) h += '<span class="page-ellipsis">…</span>';
        h += '<button class="page-btn' + (n === page ? ' is-active' : '') + '" data-g="' + n + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>';
        last = n;
      }
      return h + '<button class="page-btn page-btn--nav" data-g="next" aria-label="Siguiente"' + (page === tp ? ' disabled' : '') + '>›</button>';
    }
    function updPag() { cp.innerHTML = pagHTML(pageCount()); fitH(); }
    // El catálogo toma el alto de la página que se está viendo (una última página con menos productos no deja un hueco).
    function fitH() { var pg = grid.children[CAT.page - 1], h = pg ? pg.offsetHeight : 0; vp.style.height = h ? h + 'px' : ''; }
    function render() {
      PS = perPage();
      var L = listF(), tp = pageCount(); if (CAT.page > tp) CAT.page = tp;
      var h = '';
      for (var p = 0; p < tp; p++) {
        h += '<div class="catpage">';
        for (var k = 0; k < PS; k++) { var idx = p * PS + k; if (idx >= L.length) break; h += card(L[idx], idx + 1, CAT.cfg); }
        h += '</div>';
      }
      if (!L.length && CAT.P.length) {
        h = '<div class="catpage catpage--empty"><p class="catalog__empty">' + lineIcon('search', 26) + '<span>No encontramos ' + (CAT.q ? '«' + esc(CAT.q) + '»' : 'productos aquí') +
          ' en el catálogo publicado. <a href="' + esc(wa('Hola, busco ' + (CAT.q || 'un producto') + ' en VOLT STORE CO. ¿Lo tienen disponible?')) + '" target="_blank" rel="noopener">Pregúntanos por WhatsApp</a> y te lo conseguimos.</span></p></div>';
      }
      if (cn) cn.textContent = L.length + (L.length === 1 ? ' producto' : ' productos');
      grid.innerHTML = h; setW(); updPag(); vp.scrollLeft = (CAT.page - 1) * vw();
    }
    function go(n) { var tp = pageCount(); CAT.page = Math.min(tp, Math.max(1, n)); vp.scrollTo({ left: (CAT.page - 1) * vw(), behavior: 'smooth' }); updPag(); }
    function realign() {
      // Si cambia la cantidad por página (al girar el celular o cambiar el tamaño), se queda en la página del primer producto visible.
      if (perPage() !== PS) { CAT.page = Math.floor((CAT.page - 1) * PS / perPage()) + 1; render(); return; }
      setW(); vp.scrollLeft = (CAT.page - 1) * vw(); updPag();
    }
    cf.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      cf.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('is-active', c === b); });
      CAT.brand = b.dataset.c; CAT.page = 1; render();
    });
    if (cq) cq.addEventListener('input', function () { CAT.q = cq.value.trim(); CAT.page = 1; render(); });
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

  /* ---------- oferta destacada en la portada ----------
     Sale sola del catálogo: el producto en oferta con mayor ahorro (los destacados primero). Al tocarla se abre su ficha. */
  function renderDeal() {
    var media = document.querySelector('.hero__media'); if (!media) return;
    var el = media.querySelector('.hero__deal');
    var live = CAT.P.filter(function (x) { return x.price != null && !(x.s != null && x.s <= 0); });
    var pick = live.filter(onPromo).sort(function (a, b) { return ((b.f ? 1 : 0) - (a.f ? 1 : 0)) || ((b.price - b.promo) - (a.price - a.promo)); })[0] ||
      live.filter(function (x) { return x.f; })[0];
    if (!pick) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('a'); el.className = 'hero__deal'; media.appendChild(el); }
    var np = nameParts(pick), cat = catByCode(pick.c), promo = onPromo(pick);
    el.href = productHash(pick); el.setAttribute('data-open', pick.id);
    setHTML(el, '<span class="hero__deal-img">' + (pick.img ? '<img src="' + esc(src(pick.img)) + '" alt="" width="160" height="160" loading="lazy" decoding="async" />' : art(pick, cat)) + '</span>' +
      '<span class="hero__deal-info"><span class="hero__deal-k">' + ICONS.bolt(13) + ' ' + (promo ? 'Oferta destacada' : esc(CAT.cfg.featuredLabel || 'Destacado')) +
      (offPct(pick) >= 1 ? ' <em>−' + offPct(pick) + '%</em>' : '') + '</span>' +
      '<span class="hero__deal-n">' + esc(np.model) + '</span>' + (np.chips.length ? '<span class="hero__deal-c">' + esc(np.chips.slice(0, 3).join(' · ')) + '</span>' : '') +
      '<span class="hero__deal-p">' + (promo ? '<s>' + money(pick.price) + '</s>' : '') + '<b>' + money(promo ? pick.promo : pick.price) + '</b></span>' +
      '<span class="hero__deal-go">Ver producto ' + lineIcon('arrow', 16) + '</span></span>');
  }

  /* ---------- zoom dentro de la foto de la ficha (sin agrandar la página) ----------
     Con mouse: al pasar el cursor la foto se amplía y sigue al cursor.
     En el celular: tocar acerca o aleja, arrastrar mueve la foto ampliada, pellizcar ajusta el zoom
     y, sin zoom, deslizar a los lados cambia de foto. */
  function zoomable(stage, img, swipe) {
    var ZOOM = 2.5, MAX = 4, s = 1, tx = 0, ty = 0, W = 0, H = 0, t0 = null, pinch = null, moved = false;
    function rect() { var r = stage.getBoundingClientRect(); W = r.width; H = r.height; return r; }
    function draw(anim) {
      if (s <= 1.01) { s = 1; tx = ty = 0; }
      tx = Math.min(0, Math.max(W * (1 - s), tx)); ty = Math.min(0, Math.max(H * (1 - s), ty));
      img.style.transition = anim ? '' : 'none';
      img.style.transform = s > 1 ? 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')' : '';
      stage.classList.toggle('is-zoomed', s > 1);
    }
    // Amplía a «ns» dejando quieto el punto (px, py) que está bajo el cursor o el dedo.
    function at(px, py, ns, anim) { tx = px - (px - tx) * ns / s; ty = py - (py - ty) * ns / s; s = ns; draw(anim); }
    function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; }
    stage._reset = function () { s = 1; draw(false); };

    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest('button')) { if (s > 1) { s = 1; draw(true); } return; }   // sobre las flechas se ve la foto completa
      var r = rect(), px = e.clientX - r.left, py = e.clientY - r.top;
      s = ZOOM; tx = px * (1 - s); ty = py * (1 - s); draw(false);
    });
    stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && s > 1) { s = 1; draw(true); } });

    stage.addEventListener('touchstart', function (e) {
      if (e.target.closest('button')) { t0 = pinch = null; return; }
      var r = rect();
      if (e.touches.length === 2) {
        var a = e.touches[0], b = e.touches[1];
        pinch = { d: dist(a, b), s: s, tx: tx, ty: ty, x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top };
        t0 = null; moved = true;
      } else if (e.touches.length === 1 && !pinch) {
        t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: tx, ty: ty }; moved = false;
      }
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        var r = rect(), a = e.touches[0], b = e.touches[1];
        var ns = Math.min(MAX, Math.max(1, pinch.s * dist(a, b) / pinch.d));
        // El punto de la foto que estaba entre los dedos sigue entre los dedos.
        tx = (a.clientX + b.clientX) / 2 - r.left - (pinch.x - pinch.tx) * ns / pinch.s;
        ty = (a.clientY + b.clientY) / 2 - r.top - (pinch.y - pinch.ty) * ns / pinch.s;
        s = ns; draw(false); return;
      }
      if (!t0 || e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - t0.x, dy = e.touches[0].clientY - t0.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (s > 1) { e.preventDefault(); tx = t0.tx + dx; ty = t0.ty + dy; draw(false); }
      else if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();   // deslizar de lado cambia de foto, no mueve la página
    }, { passive: false });
    stage.addEventListener('touchend', function (e) {
      if (pinch) {
        if (e.touches.length < 2) pinch = null;
        if (e.touches.length === 1) t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: tx, ty: ty };
        return;
      }
      if (!t0 || e.touches.length) return;
      var c = e.changedTouches[0], dx = c.clientX - t0.x, dy = c.clientY - t0.y; t0 = null;
      if (moved) { if (s === 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) swipe(dx < 0 ? 1 : -1); return; }
      e.preventDefault();   // un toque: acerca donde se tocó o vuelve a la foto completa
      var r = rect();
      if (s > 1) { s = 1; draw(true); } else at(c.clientX - r.left, c.clientY - r.top, ZOOM, true);
    });
    stage.addEventListener('touchcancel', function () { t0 = pinch = null; });
    stage.addEventListener('gesturestart', function (e) { e.preventDefault(); });   // Safari: el pellizco no agranda la página
  }

  // Garantías bajo el botón de compra de la ficha (editables en Catálogo (textos)).
  var TRUST = ['Garantía en cada compra', 'iPhone a crédito y de contado', 'Tienda física en Convención'];
  function trustHTML(cfg) {
    if (cfg.showTrust === false) return '';
    var items = (cfg.trust || []).filter(function (t) { return String(t || '').trim(); });
    if (!items.length) items = TRUST;
    return '<ul class="pmodal__trust">' + items.map(function (t) { return '<li>' + ICONS.bolt(14) + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul>';
  }

  // Especificaciones de la ficha: la tabla del panel o, si no tiene, las líneas «Nombre: valor» de la descripción.
  // La primera línea que no es especificación se muestra como resumen bajo el nombre.
  function productInfo(x) {
    var specs = (x.specs || []).filter(function (r) { return r && r[0] && r[1]; }).map(function (r) { return [clean(r[0]), clean(r[1])]; }), rest = [];
    String(clean(x.d)).split('\n').forEach(function (line) {
      var m = !(x.specs || []).length && /^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wÁÉÍÓÚÜÑáéíóúüñ .()/-]{1,28}):\s+(\S.{0,240})$/.exec(line);
      if (m) specs.push([m[1].trim(), m[2].trim().replace(/\.$/, '')]); else if (line.trim()) rest.push(line.trim());
    });
    if (!(x.specs || []).length && specs.length < 2) { specs = []; rest = clean(x.d).split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }
    var lead = rest.length ? rest.shift() : '';
    return { specs: specs, lead: lead, text: rest.join('\n') };
  }
  function acc(title, body, open) {
    return '<details class="pacc"' + (open ? ' open' : '') + '><summary>' + esc(title) + '</summary><div class="pacc__body">' + body + '</div></details>';
  }
  // «También te puede interesar»: de la misma categoría primero, disponibles y luego el resto del catálogo.
  function relatedHTML(x) {
    var avail = function (p) { return p.id !== x.id && !(p.s != null && p.s <= 0); };
    var list = CAT.P.filter(function (p) { return avail(p) && p.c === x.c; });
    if (list.length < 4) list = list.concat(CAT.P.filter(function (p) { return avail(p) && p.c !== x.c && (p.f || onPromo(p)); }));
    list = list.slice(0, 4);
    if (!list.length) return '';
    return '<div class="pmodal__more"><h4>' + esc(CAT.cfg.relatedLabel || 'También te puede interesar') + '</h4><div class="prel">' + list.map(function (p) {
      var c = catByCode(p.c), price = p.price == null ? esc(CAT.cfg.askPriceLabel || 'Consultar precio') : money(onPromo(p) ? p.promo : p.price);
      return '<a class="prel__item" href="' + esc(productHash(p)) + '" data-open="' + esc(p.id) + '"><span class="prel__img">' +
        (p.img ? '<img src="' + esc(src(p.img)) + '" alt="" width="300" height="300" loading="lazy" decoding="async" />' : art(p, c)) +
        (onPromo(p) ? '<span class="model__promo">' + esc(CAT.cfg.promoLabel || 'Oferta') + '</span>' : '') + '</span>' +
        '<span class="prel__name">' + esc(nameParts(p).model) + '</span><span class="prel__price">' + price + '</span></a>';
    }).join('') + '</div></div>';
  }
  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function productHash(x) { return '#producto/' + (slug(x.n) || 'producto') + '-' + String(x.id).slice(0, 8); }
  function productUrl(x) { return location.origin + location.pathname + productHash(x); }
  function shareProduct(x) {
    if (!x) return;
    var url = productUrl(x);
    if (navigator.share) { navigator.share({ title: x.n, url: url }).catch(function () { /* el cliente canceló */ }); return; }
    var done = function () { flash('Enlace copiado. Pégalo en WhatsApp o en tus redes.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { flash(url); });
    else flash(url);
  }
  function flash(msg) {
    var t = document.getElementById('vflash');
    if (!t) { t = document.createElement('div'); t.id = 'vflash'; t.className = 'vflash'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  // Abre el producto del enlace compartido (voltstoreco.com/#producto/nombre-xxxxxxxx) cuando el catálogo ya está listo.
  var hashOpened = false;
  function openFromHash() {
    if (hashOpened) return;
    var m = /^#producto\/(?:[a-z0-9-]*-)?([0-9a-f]{8})$/.exec(location.hash);
    if (!m) { hashOpened = true; return; }
    var p = CAT.P.filter(function (q) { return String(q.id).slice(0, 8) === m[1]; })[0];
    if (p) { hashOpened = true; openProduct(p.id); }
  }

  /* ---------- detalle de producto (imagen, galería, características) ---------- */
  function openProduct(id) {
    var x = CAT.P.filter(function (p) { return p.id === id; })[0]; if (!x) return;
    // Foto principal + galería, sin repetir la misma imagen ni incluir rutas no válidas.
    var imgs = [], i = 0;
    [x.img].concat(x.gallery || []).forEach(function (u) { if (u && src(u) && imgs.indexOf(u) < 0) imgs.push(u); });
    var m = document.getElementById('pmodal');
    if (!m) {
      m = document.createElement('div'); m.id = 'pmodal'; m.className = 'pmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-hidden', 'true');
      document.body.appendChild(m);
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.closest('.pmodal__close')) { closeProduct(); return; }
        var rel = e.target.closest('[data-open]');
        if (rel) { e.preventDefault(); e.stopPropagation(); openProduct(rel.getAttribute('data-open')); return; }   // «También te puede interesar»
        if (e.target.closest('[data-share]')) { shareProduct(m._x); return; }
        if (e.target.closest('a[href^="#"]')) { closeProduct(); return; }   // enlace a una sección: cierra y deja que la página baje
        var b = e.target.closest('[data-d], [data-i]');
        if (b && m._show) m._show(b.hasAttribute('data-i') ? parseInt(b.getAttribute('data-i'), 10) : m._i + parseInt(b.getAttribute('data-d'), 10));
      });
    }
    var cat = catByCode(x.c), cfg = CAT.cfg, info = productInfo(x), np = nameParts(x);
    // El resumen no se repite si solo dice lo mismo que las etiquetas («128gb · Negro» ya está en «128 GB», «Negro»).
    var compact = function (s) { return norm(s).replace(/[^a-z0-9%]/g, ''); }, chipsC = compact(np.chips.join(' '));
    var leadDup = !!(info.lead && np.chips.length) && info.lead.split(/[·•|,]/).every(function (p) { var c = compact(p); return !c || chipsC.indexOf(c) >= 0; });
    var alt = x.alt || x.n;
    var badges = (x.f ? '<span class="pmodal__tag pmodal__tag--feat">' + esc(cfg.featuredLabel || 'Destacado') + '</span>' : '') +
      (cfg.showStock !== false && x.s != null ? (x.s <= 0 ? '<span class="pmodal__tag pmodal__tag--out">' + esc(cfg.outOfStockLabel || 'Agotado') + '</span>'
        : '<span class="pmodal__tag pmodal__tag--in">' + (x.s === 1 ? 'Última unidad' : x.s + ' ' + esc(cfg.inStockLabel || 'disp.')) + '</span>') : '');
    if (badges) badges = '<div class="pmodal__tags">' + badges + '</div>';
    m.setAttribute('aria-labelledby', 'pmodal-title');
    m.innerHTML = '<div class="pmodal__box"><button class="pmodal__close" aria-label="Cerrar">&times;</button>' +
      (!imgs.length ? '<div class="pmodal__media pmodal__media--art">' + art(x, cat) + '</div>' : '') +
      (imgs.length ? '<div class="pmodal__media"><div class="pmodal__stage"><img class="pmodal__img" alt="' + esc(alt) + '" />' +
        '<span class="pmodal__hint" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/></svg>' +
        '<span class="pmodal__hint-m">Pasa el cursor para ampliar</span><span class="pmodal__hint-t">Toca para acercar</span></span>' +
        (imgs.length > 1 ? '<button class="pmodal__nav pmodal__nav--prev" data-d="-1" aria-label="Foto anterior">‹</button><button class="pmodal__nav pmodal__nav--next" data-d="1" aria-label="Foto siguiente">›</button>' +
          '<span class="pmodal__count" aria-live="polite"></span>' : '') + '</div>' +
        (imgs.length > 1 ? '<div class="pmodal__thumbs">' + imgs.map(function (u, k) {
          return '<button class="pmodal__thumb" data-i="' + k + '" aria-label="Ver foto ' + (k + 1) + '"><img src="' + esc(src(u)) + '" alt="" width="96" height="96" loading="lazy" /></button>';
        }).join('') + '</div>' : '') + '</div>' : '') +
      '<div class="pmodal__body"><div class="pmodal__top">' + badges + '<button type="button" class="pmodal__share" data-share>' + ICONS.share + '<span>Compartir</span></button></div>' +
      '<span class="model__brand">' + esc(x.b || cat.singular || '') + '</span><h3 id="pmodal-title">' + esc(np.model) + '</h3>' + chipsHTML(np.chips, ' pmodal__chips') +
      (info.lead && !leadDup ? '<p class="pmodal__lead">' + esc(info.lead) + '</p>' : '') +
      // Precio y botón juntos; en el celular quedan fijos al pie de la ficha mientras se lee.
      '<div class="pmodal__buy">' + priceHTML(x, cfg, true) + buyBtn(x, cfg, ' btn--block') + '</div>' + trustHTML(cfg) +
      // Detalle en secciones plegables: especificaciones (abierta), descripción y características.
      (info.specs.length ? acc('Especificaciones', '<table class="pspec"><tbody>' + info.specs.map(function (r) {
        return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
      }).join('') + '</tbody></table>', true) : '') +
      (info.text ? acc('Descripción', '<p class="pmodal__desc">' + txt(info.text) + '</p>', !info.specs.length) : '') +
      ((x.features || []).length ? acc('Características destacadas', '<ul class="ticks">' + x.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>', !info.specs.length && !info.text) : '') +
      '</div>' + relatedHTML(x) + '</div>';
    var stage = m.querySelector('.pmodal__stage'), pimg = m.querySelector('.pmodal__img');
    if (stage) {
      // El recuadro toma la forma de la foto principal (entre 3:4 vertical y 4:3 horizontal) para que no queden franjas vacías.
      pimg.onload = function () {
        pimg.onload = null;
        if (pimg.naturalWidth && pimg.naturalHeight) stage.style.setProperty('--ar', Math.min(4 / 3, Math.max(3 / 4, pimg.naturalWidth / pimg.naturalHeight)).toFixed(4));
      };
      zoomable(stage, pimg, function (d) { if (imgs.length > 1) m._show(m._i + d); });
    }
    m._show = function (n) {
      if (!imgs.length) return;
      m._i = i = (n + imgs.length) % imgs.length;
      if (stage._reset) stage._reset();
      pimg.src = src(imgs[i]);
      var cnt = m.querySelector('.pmodal__count'); if (cnt) cnt.textContent = (i + 1) + ' / ' + imgs.length;
      m.querySelectorAll('.pmodal__thumb').forEach(function (t, k) { t.classList.toggle('is-active', k === i); if (k === i) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
    };
    m._show(0);
    m._x = x;
    m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    var box = m.querySelector('.pmodal__box'); if (box) box.scrollTop = 0;
    // Cada producto tiene su propio enlace (para compartirlo por WhatsApp o redes).
    try { history.replaceState(null, '', productHash(x)); } catch (e) { /* sin historial */ }
    var c = m.querySelector('.pmodal__close'); if (c) c.focus();
  }
  function closeProduct() {
    var m = document.getElementById('pmodal'); if (!m || !m.classList.contains('open')) return;
    m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    if (/^#producto\//.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin historial */ }
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
    // Cada parte por separado: si una falla, las demás se siguen mostrando.
    var steps = [
      ['tema', function () { applyTheme(c.theme); }],
      ['encabezado', function () { if (c.header) renderHeader(h); }],
      ['portada', function () { if (c.hero) renderHero(c.hero); }],
      ['franja', function () { if (c.marquee) renderMarquee(c.marquee); }],
      ['productos', function () { if (c.productos) renderProductos(c.productos); }],
      ['catálogo', function () { buildCat(c.catalogo || {}, site.categories, site.products); }],
      ['oferta de la portada', renderDeal],
      ['iPhone', function () { if (c.iphone) renderIphone(c.iphone); }],
      ['servicio', function () { if (c.servicio) renderServicio(c.servicio); }],
      ['beneficios', function () { if (c.beneficios) renderBeneficios(c.beneficios); }],
      ['galería', function () { if (c.galeria) renderGaleria(c.galeria); }],
      ['llamado', function () { if (c.cta) renderCta(c.cta); }],
      ['contacto', function () { if (c.contacto) renderContacto(c.contacto, h); }],
      ['pie', function () { if (c.footer) renderFooter(c.footer, h); }],
      ['WhatsApp flotante', renderFloat],
      ['orden de secciones', function () { applyLayout(c.layout); }],
      ['SEO', function () { applySeo(c.seo); if (c.general) applyJsonLd(G, c.seo); }]
    ];
    steps.forEach(function (st) {
      try { st[1](); } catch (e) { if (window.console) console.error('VOLT: no se pudo aplicar «' + st[0] + '»', e); }
    });
    observeReveals();
    document.documentElement.setAttribute('data-volt-content', site.preview ? 'preview' : 'live');
    return true;
  }

  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  function fetchLive() {
    return timeout(fetch(BASE + 'api/?a=public', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), 6000);
  }
  function fetchSnapshot() {
    return timeout(fetch(BASE + 'data/site.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }), 6000);
  }
  function readInline() { var el = document.getElementById('volt-data'); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } }
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function writeCache(s) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) { /* almacenamiento no disponible */ } }

  var gotPreview = false;
  function load() {
    return fetchLive().then(function (s) {
      if (gotPreview) return;          // en vista previa mandan los borradores del panel
      if (!PREVIEW) writeCache(s);
      apply(s); openFromHash();
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
  // Breve y solo al entrar por primera vez en la visita: el cliente ve los productos enseguida.
  var seenLoader = false;
  try { seenLoader = sessionStorage.getItem('volt-loader') === '1'; sessionStorage.setItem('volt-loader', '1'); } catch (e) { /* sin almacenamiento */ }
  if (loader && (seenLoader || PREVIEW)) hideLoader();
  if (loader && !loaderDone) {
    var fill = document.getElementById('loaderFill'), pctEl = document.getElementById('loaderPct');
    var DURATION = 650, startTs = null;
    var tick = function (ts) {
      if (loaderDone) return;
      if (startTs === null) startTs = ts;
      var t = Math.min(1, (ts - startTs) / DURATION), pct = Math.round((1 - Math.pow(1 - t, 2)) * 100);
      if (pctEl) pctEl.textContent = pct + '%';
      if (fill) fill.style.width = pct + '%';
      if (t < 1) requestAnimationFrame(tick); else setTimeout(hideLoader, 60);
    };
    requestAnimationFrame(tick);
    setTimeout(hideLoader, 2000); // por si la pestaña está en segundo plano y no anima
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
    var gi = e.target.closest('.gallery__grid .g-item'), g = gi && gi.querySelector('img');
    if (g && lb) {
      lbImg.src = g.src; lbImg.alt = g.alt;
      lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
      return;
    }
    var op = e.target.closest('[data-open]');
    if (op && !op.closest('#pmodal')) { e.preventDefault(); openProduct(op.getAttribute('data-open')); return; }
    // Lupa del encabezado: baja al catálogo y deja el cursor en el buscador.
    if (e.target.closest('[data-search]')) {
      var q = document.getElementById('cq2'), cs = document.getElementById('catalogo');
      if (cs) window.scrollTo({ top: cs.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
      if (q) try { q.focus({ preventScroll: true }); } catch (err) { q.focus(); }
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
    var pm = document.getElementById('pmodal');
    if (pm && pm.classList.contains('open') && pm._show && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) pm._show(pm._i + (e.key === 'ArrowLeft' ? -1 : 1));
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
  // Lo publicado viene dentro del HTML (index.php); si no está, se usa la última versión guardada en este navegador.
  var cached = !PREVIEW && (readInline() || readCache());
  if (cached) { apply(cached); openFromHash(); }       // la página aparece de inmediato con su contenido real
  load();
  if (!PREVIEW) setInterval(load, REFRESH_MS);
})();
