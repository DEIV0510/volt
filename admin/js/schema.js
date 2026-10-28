/* ===== VOLT STORE CO — modelo de contenido administrable =====
   Fuente única: el panel arma sus formularios con esto y
   scripts/build-sql.mjs genera desde aquí el JSON Schema con el que
   la base de datos valida cada guardado (validación en el servidor).

   Tipos de campo:
   text · textarea · link · image · color · select · bool · icon
   strings (lista de textos) · list (lista de objetos) · button */

// Enlaces permitidos: anclas internas, http(s), mailto y tel. Nada de javascript:, data:, etc.
export const LINK_PATTERN = '^(#[A-Za-z0-9_-]*|https?://[^\\s"\'<>]+|mailto:[^\\s"\'<>]+|tel:[+0-9 ()-]+)$';
// Imágenes: archivos del sitio (img/…, uploads/…) o URLs https.
export const IMAGE_PATTERN = '^((?:[A-Za-z0-9_-]+/)*[A-Za-z0-9._-]+\\.(?:webp|png|jpe?g|gif|svg|ico)|https://[^\\s"\'<>]+)$';
export const COLOR_PATTERN = '^#[0-9a-fA-F]{6}$';
export const PHONE_PATTERN = '^[0-9]{8,15}$';
export const EMAIL_PATTERN = '^[^\\s@<>"\']+@[^\\s@<>"\']+\\.[^\\s@<>"\']+$';

export const SECTION_IDS = ['hero', 'marquee', 'productos', 'catalogo', 'iphone', 'servicio', 'beneficios', 'galeria', 'cta', 'contacto'];
export const SECTION_NAMES = {
  hero: 'Portada (inicio)', marquee: 'Franja animada', productos: 'Productos', catalogo: 'Catálogo',
  iphone: 'iPhone a crédito', servicio: 'Servicio técnico', beneficios: 'Beneficios',
  galeria: 'Comunidad (galería)', cta: 'Llamado a la acción', contacto: 'Contacto'
};

export const FONTS_HEAD = ['Sora', 'Inter', 'Poppins', 'Montserrat', 'Outfit', 'Space Grotesk', 'Manrope'];
export const FONTS_BODY = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Nunito Sans', 'Manrope', 'DM Sans'];

const button = (label, help) => ({ t: 'button', label, help });
const kicker = { k: 'kicker', t: 'text', label: 'Etiqueta superior', max: 40 };
const title = { k: 'title', t: 'text', label: 'Título', max: 120 };
const intro = { k: 'text', t: 'textarea', label: 'Texto de introducción', max: 400 };

export const CONTENT = {
  general: {
    label: 'Información del negocio', group: 'Negocio', icon: 'store',
    help: 'Datos que se usan en toda la página: WhatsApp, ubicación, redes sociales.',
    fields: [
      { k: 'name', t: 'text', label: 'Nombre del negocio', max: 60, required: true },
      { k: 'tagline', t: 'text', label: 'Descripción corta', max: 120 },
      { k: 'whatsapp', t: 'text', label: 'Número de WhatsApp', max: 15, pattern: PHONE_PATTERN, required: true,
        help: 'Con indicativo de país y sin espacios ni “+”. Ej.: 573171076290', patternMsg: 'Solo números, de 8 a 15 dígitos, con indicativo (57…).' },
      { k: 'whatsappDisplay', t: 'text', label: 'Número visible en la página', max: 30, help: 'Ej.: 317 107 6290' },
      { k: 'whatsappMessage', t: 'textarea', label: 'Mensaje predeterminado de WhatsApp', max: 300,
        help: 'Texto que aparece escrito al abrir WhatsApp desde los botones generales.' },
      { k: 'floatingWhatsapp', t: 'bool', label: 'Mostrar el botón flotante de WhatsApp' },
      { k: 'phone', t: 'text', label: 'Teléfono adicional (opcional)', max: 30 },
      { k: 'email', t: 'text', label: 'Correo electrónico (opcional)', max: 120, pattern: EMAIL_PATTERN, allowEmpty: true, patternMsg: 'Correo no válido.' },
      { k: 'address', t: 'text', label: 'Ubicación / dirección', max: 160 },
      { k: 'hours', t: 'text', label: 'Horario de atención (opcional)', max: 160 },
      { k: 'mapUrl', t: 'link', label: 'Enlace a Google Maps (opcional)' },
      { k: 'socials', t: 'list', label: 'Redes sociales', max: 8, itemLabel: 'label', fields: [
        { k: 'network', t: 'select', label: 'Red', options: [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['x', 'X (Twitter)'], ['otra', 'Otra']] },
        { k: 'label', t: 'text', label: 'Texto visible', max: 40 },
        { k: 'url', t: 'link', label: 'Enlace', required: true }
      ] }
    ]
  },

  header: {
    label: 'Encabezado y menú', group: 'Negocio', icon: 'menu',
    help: 'Logotipo, favicon, menú de navegación (escritorio y celular) y botón del encabezado.',
    fields: [
      { k: 'logo', t: 'image', label: 'Logotipo (fondo claro)' },
      { k: 'logoAlt', t: 'text', label: 'Texto alternativo del logo', max: 80 },
      { k: 'logoWhite', t: 'image', label: 'Logotipo para fondos oscuros', help: 'Se usa en la pantalla de carga, la tarjeta de contacto y el pie de página.' },
      { k: 'favicon', t: 'image', label: 'Favicon (ícono de la pestaña)' },
      { k: 'nav', t: 'list', label: 'Menú de escritorio', max: 10, itemLabel: 'label', fields: [
        { k: 'label', t: 'text', label: 'Texto', max: 30, required: true },
        { k: 'href', t: 'link', label: 'Destino', required: true, help: 'Sección (#productos) o enlace https://' }
      ] },
      { k: 'mobileNav', t: 'list', label: 'Menú del celular', max: 12, itemLabel: 'label', fields: [
        { k: 'label', t: 'text', label: 'Texto', max: 30, required: true },
        { k: 'href', t: 'link', label: 'Destino', required: true }
      ] },
      { k: 'showWhatsapp', t: 'bool', label: 'Mostrar el botón de WhatsApp en el encabezado' },
      { k: 'ctaLabel', t: 'text', label: 'Texto del botón del encabezado', max: 30 },
      { k: 'mobileCtaLabel', t: 'text', label: 'Texto del botón del menú del celular', max: 40 },
      { k: 'showLoader', t: 'bool', label: 'Mostrar la pantalla de carga animada' },
      { k: 'loaderText', t: 'text', label: 'Texto de la pantalla de carga', max: 60 }
    ]
  },

  hero: {
    label: 'Portada (inicio)', group: 'Secciones', icon: 'home', section: 'hero',
    fields: [
      { k: 'eyebrow', t: 'text', label: 'Etiqueta superior', max: 80 },
      { k: 'title', t: 'textarea', label: 'Título principal', max: 160, required: true },
      { k: 'highlight', t: 'text', label: 'Palabra resaltada en amarillo', max: 60, help: 'Debe aparecer tal cual dentro del título.' },
      { k: 'subtitle', t: 'textarea', label: 'Descripción', max: 400 },
      { k: 'badge', t: 'text', label: 'Distintivo con rayo', max: 80 },
      { ...button('Botón principal'), k: 'primary' },
      { ...button('Botón secundario'), k: 'secondary' },
      { k: 'stats', t: 'list', label: 'Datos destacados', max: 4, itemLabel: 'value', fields: [
        { k: 'value', t: 'text', label: 'Dato', max: 20 },
        { k: 'label', t: 'text', label: 'Descripción', max: 40 }
      ] },
      { k: 'image', t: 'image', label: 'Imagen principal' },
      { k: 'imageAlt', t: 'text', label: 'Texto alternativo de la imagen', max: 160 },
      { k: 'chipTop', t: 'text', label: 'Etiqueta flotante superior', max: 40 },
      { k: 'chipBottom', t: 'text', label: 'Etiqueta flotante inferior', max: 40 }
    ]
  },

  marquee: {
    label: 'Franja animada', group: 'Secciones', icon: 'marquee', section: 'marquee',
    fields: [
      { k: 'items', t: 'strings', label: 'Palabras de la franja', max: 12, itemMax: 30 }
    ]
  },

  productos: {
    label: 'Productos (tarjetas)', group: 'Secciones', icon: 'grid', section: 'productos',
    fields: [
      kicker, title, intro,
      { k: 'cards', t: 'list', label: 'Tarjetas de productos', max: 12, itemLabel: 'title', fields: [
        { k: 'title', t: 'text', label: 'Título', max: 60, required: true },
        { k: 'text', t: 'textarea', label: 'Descripción', max: 200 },
        { k: 'image', t: 'image', label: 'Imagen' },
        { k: 'imageAlt', t: 'text', label: 'Texto alternativo', max: 160 },
        { k: 'tag', t: 'text', label: 'Etiqueta sobre la imagen (opcional)', max: 30 },
        { ...button('Botón'), k: 'button' }
      ] },
      { k: 'showCtaCard', t: 'bool', label: 'Mostrar la tarjeta “¿No ves lo que buscas?”' },
      { k: 'ctaTitle', t: 'text', label: 'Título de esa tarjeta', max: 60 },
      { k: 'ctaText', t: 'textarea', label: 'Texto de esa tarjeta', max: 200 },
      { ...button('Botón de esa tarjeta'), k: 'ctaButton' }
    ]
  },

  catalogo: {
    label: 'Catálogo (textos)', group: 'Secciones', icon: 'list', section: 'catalogo',
    help: 'Textos de la sección. Los productos se administran en Catálogo → Productos.',
    fields: [
      kicker, title, intro,
      { k: 'allLabel', t: 'text', label: 'Texto del filtro “Todos”', max: 20 },
      { k: 'buttonLabel', t: 'text', label: 'Texto del botón de cada producto', max: 30 },
      { k: 'productMessage', t: 'textarea', label: 'Mensaje de WhatsApp de cada producto', max: 300,
        help: 'Usa {producto} y {categoria}; se reemplazan por los datos del producto.' },
      { k: 'askPriceLabel', t: 'text', label: 'Texto cuando no hay precio', max: 30 },
      { k: 'showStock', t: 'bool', label: 'Mostrar la cantidad disponible (stock)' },
      { k: 'inStockLabel', t: 'text', label: 'Texto junto a la cantidad', max: 20 },
      { k: 'outOfStockLabel', t: 'text', label: 'Texto de agotado', max: 20 },
      { k: 'featuredLabel', t: 'text', label: 'Etiqueta de producto destacado', max: 20 },
      { k: 'noteText', t: 'text', label: 'Nota al final', max: 120 },
      { k: 'noteLinkLabel', t: 'text', label: 'Texto del enlace de la nota', max: 60 },
      { k: 'noteMessage', t: 'textarea', label: 'Mensaje de WhatsApp de la nota', max: 300 }
    ]
  },

  iphone: {
    label: 'iPhone a crédito', group: 'Secciones', icon: 'phone', section: 'iphone',
    fields: [
      kicker, title, intro,
      { k: 'ticks', t: 'strings', label: 'Lista de ventajas', max: 8, itemMax: 80 },
      { k: 'image', t: 'image', label: 'Imagen' },
      { k: 'imageAlt', t: 'text', label: 'Texto alternativo', max: 160 },
      { ...button('Botón principal'), k: 'primary' },
      { ...button('Botón secundario'), k: 'secondary' }
    ]
  },

  servicio: {
    label: 'Servicio técnico', group: 'Secciones', icon: 'tool', section: 'servicio',
    fields: [
      kicker, title, intro,
      { k: 'items', t: 'list', label: 'Servicios', max: 12, itemLabel: 'title', fields: [
        { k: 'icon', t: 'icon', label: 'Ícono', help: 'Un emoji, o escribe “apple” o “rayo”.' },
        { k: 'title', t: 'text', label: 'Título', max: 60, required: true },
        { k: 'text', t: 'textarea', label: 'Descripción', max: 200 },
        { k: 'soon', t: 'bool', label: 'Marcar como “Próximamente”' },
        { k: 'soonLabel', t: 'text', label: 'Texto de la marca', max: 20 }
      ] },
      { ...button('Botón al final'), k: 'button' }
    ]
  },

  beneficios: {
    label: 'Beneficios', group: 'Secciones', icon: 'star', section: 'beneficios',
    fields: [
      kicker, title, intro,
      { k: 'items', t: 'list', label: 'Beneficios', max: 12, itemLabel: 'title', fields: [
        { k: 'icon', t: 'icon', label: 'Ícono (emoji)' },
        { k: 'title', t: 'text', label: 'Título', max: 60, required: true },
        { k: 'text', t: 'textarea', label: 'Descripción', max: 200 }
      ] }
    ]
  },

  galeria: {
    label: 'Comunidad (galería)', group: 'Secciones', icon: 'image', section: 'galeria',
    fields: [
      kicker, title, intro,
      { k: 'showButton', t: 'bool', label: 'Mostrar el botón de Instagram' },
      { k: 'buttonLabel', t: 'text', label: 'Texto del botón', max: 40 },
      { k: 'buttonUrl', t: 'link', label: 'Enlace del botón' },
      { k: 'images', t: 'list', label: 'Fotos', max: 12, itemLabel: 'alt', fields: [
        { k: 'image', t: 'image', label: 'Foto', required: true },
        { k: 'alt', t: 'text', label: 'Texto alternativo', max: 160 },
        { k: 'size', t: 'select', label: 'Tamaño en la cuadrícula', options: [['normal', 'Normal'], ['tall', 'Alta'], ['wide', 'Ancha']] }
      ] }
    ]
  },

  cta: {
    label: 'Llamado a la acción', group: 'Secciones', icon: 'bolt', section: 'cta',
    fields: [
      { k: 'title', t: 'textarea', label: 'Título', max: 160 },
      { k: 'text', t: 'textarea', label: 'Texto', max: 300 },
      { ...button('Botón'), k: 'button' }
    ]
  },

  contacto: {
    label: 'Contacto', group: 'Secciones', icon: 'chat', section: 'contacto',
    fields: [
      kicker, title, intro,
      { k: 'items', t: 'list', label: 'Datos de contacto', max: 6, itemLabel: 'title', fields: [
        { k: 'icon', t: 'icon', label: 'Ícono (emoji)' },
        { k: 'title', t: 'text', label: 'Título', max: 60, required: true },
        { k: 'text', t: 'text', label: 'Texto', max: 160, help: 'Puedes escribir {whatsapp}, {telefono}, {correo}, {direccion} o {horario} y se completa con «Información del negocio». El teléfono, el correo, el horario y el mapa de esa sección se agregan solos si no están en esta lista.' }
      ] },
      { k: 'showSocials', t: 'bool', label: 'Mostrar enlaces a redes sociales' },
      { k: 'cardTitle', t: 'text', label: 'Título de la tarjeta oscura', max: 60 },
      { k: 'cardText', t: 'textarea', label: 'Texto de la tarjeta', max: 200 },
      { ...button('Botón de la tarjeta'), k: 'cardButton' },
      { k: 'showNumber', t: 'bool', label: 'Mostrar el número bajo el botón' }
    ]
  },

  footer: {
    label: 'Pie de página', group: 'Negocio', icon: 'footer',
    fields: [
      { k: 'text', t: 'textarea', label: 'Descripción de la empresa', max: 200 },
      { k: 'linksTitle', t: 'text', label: 'Título de enlaces', max: 40 },
      { k: 'links', t: 'list', label: 'Enlaces rápidos', max: 8, itemLabel: 'label', fields: [
        { k: 'label', t: 'text', label: 'Texto', max: 40, required: true },
        { k: 'href', t: 'link', label: 'Destino', required: true }
      ] },
      { k: 'contactTitle', t: 'text', label: 'Título de contacto', max: 40 },
      { k: 'showWhatsapp', t: 'bool', label: 'Mostrar WhatsApp' },
      { k: 'showAddress', t: 'bool', label: 'Mostrar ubicación' },
      { k: 'showEmail', t: 'bool', label: 'Mostrar correo (si está configurado)' },
      { k: 'showHours', t: 'bool', label: 'Mostrar horario (si está configurado)' },
      { k: 'copyright', t: 'text', label: 'Derechos de autor', max: 120, help: 'El año se agrega automáticamente.' },
      { k: 'slogan', t: 'text', label: 'Frase final', max: 80 },
      { k: 'legal', t: 'list', label: 'Avisos legales (opcional)', max: 4, itemLabel: 'label', fields: [
        { k: 'label', t: 'text', label: 'Texto', max: 40, required: true },
        { k: 'href', t: 'link', label: 'Enlace', required: true }
      ] }
    ]
  },

  layout: {
    label: 'Orden y visibilidad', group: 'Diseño', icon: 'layers', special: 'layout',
    fields: [
      { k: 'sections', t: 'list', label: 'Secciones', max: SECTION_IDS.length, fields: [
        { k: 'id', t: 'select', label: 'Sección', options: SECTION_IDS.map(id => [id, SECTION_NAMES[id]]) },
        { k: 'visible', t: 'bool', label: 'Visible' }
      ] }
    ]
  },

  theme: {
    label: 'Colores y tipografía', group: 'Diseño', icon: 'palette', special: 'theme',
    fields: [
      { k: 'primary', t: 'color', label: 'Color principal (amarillo VOLT)' },
      { k: 'primary2', t: 'color', label: 'Color principal (tono 2 del degradado)' },
      { k: 'primaryInk', t: 'color', label: 'Texto sobre el color principal' },
      { k: 'dark', t: 'color', label: 'Color oscuro (franja, iPhone, pie)' },
      { k: 'bg', t: 'color', label: 'Fondo' },
      { k: 'bgSoft', t: 'color', label: 'Fondo de secciones alternas' },
      { k: 'ink', t: 'color', label: 'Color del texto' },
      { k: 'muted', t: 'color', label: 'Texto secundario' },
      { k: 'wa', t: 'color', label: 'Color de los botones de WhatsApp' },
      { k: 'fontHead', t: 'select', label: 'Tipografía de títulos', options: FONTS_HEAD.map(f => [f, f]) },
      { k: 'fontBody', t: 'select', label: 'Tipografía de textos', options: FONTS_BODY.map(f => [f, f]) },
      { k: 'scale', t: 'select', label: 'Tamaño del texto', options: [['sm', 'Compacto'], ['md', 'Normal'], ['lg', 'Grande']] },
      { k: 'radius', t: 'select', label: 'Esquinas', options: [['square', 'Rectas (actual)'], ['soft', 'Suaves'], ['round', 'Redondeadas']] },
      { k: 'cardStyle', t: 'select', label: 'Estilo de tarjetas', options: [['border', 'Con borde (actual)'], ['shadow', 'Con sombra'], ['flat', 'Planas']] },
      { k: 'spacing', t: 'select', label: 'Espaciado entre secciones', options: [['compact', 'Compacto'], ['normal', 'Normal'], ['wide', 'Amplio']] }
    ]
  },

  seo: {
    label: 'SEO y redes', group: 'Diseño', icon: 'search',
    help: 'Título y descripción para Google y para cuando se comparte el enlace.',
    fields: [
      { k: 'title', t: 'text', label: 'Título SEO', max: 70, help: 'Ideal: 50–60 caracteres.' },
      { k: 'description', t: 'textarea', label: 'Meta descripción', max: 170, help: 'Ideal: 140–160 caracteres.' },
      { k: 'ogTitle', t: 'text', label: 'Título al compartir', max: 90 },
      { k: 'ogDescription', t: 'textarea', label: 'Descripción al compartir', max: 200 },
      { k: 'ogImage', t: 'image', label: 'Imagen al compartir', help: 'Recomendado: 1200 × 630 px.' },
      { k: 'index', t: 'bool', label: 'Permitir que Google indexe la página' }
    ]
  }
};

export const CONTENT_KEYS = Object.keys(CONTENT);

/* ---- JSON Schema (lo usa la base de datos para validar) ---- */
function strSchema(max, pattern, allowEmpty = true) {
  const s = { type: 'string', maxLength: max };
  if (pattern) s.pattern = allowEmpty ? `^$|${pattern}` : pattern;
  return s;
}
function buttonSchema() {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      label: { type: 'string', maxLength: 60 },
      kind: { enum: ['whatsapp', 'link'] },
      message: { type: 'string', maxLength: 400 },
      href: strSchema(500, LINK_PATTERN)
    }
  };
}
export function fieldSchema(f) {
  const s = baseSchema(f);
  if (f.required && s.type === 'string') s.minLength = 1;
  return s;
}
function baseSchema(f) {
  switch (f.t) {
    case 'text': return strSchema(f.max || 200, f.pattern, !f.required);
    case 'textarea': return { type: 'string', maxLength: f.max || 1000 };
    case 'link': return strSchema(500, LINK_PATTERN, !f.required);
    case 'image': return strSchema(500, IMAGE_PATTERN, !f.required);
    case 'color': return { type: 'string', pattern: COLOR_PATTERN };
    case 'icon': return { type: 'string', maxLength: 16 };
    case 'bool': return { type: 'boolean' };
    case 'select': return { enum: f.options.map(o => o[0]) };
    case 'strings': return { type: 'array', maxItems: f.max || 20, items: { type: 'string', maxLength: f.itemMax || 100 } };
    case 'button': return buttonSchema();
    case 'list': return { type: 'array', maxItems: f.max || 20, items: objectSchema(f.fields) };
    default: throw new Error('Tipo de campo desconocido: ' + f.t);
  }
}
export function objectSchema(fields) {
  const properties = {};
  for (const f of fields) properties[f.k] = fieldSchema(f);
  return { type: 'object', additionalProperties: false, properties };
}
export function contentSchema(key) {
  return objectSchema(CONTENT[key].fields);
}
