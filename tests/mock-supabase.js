/* Backend SIMULADO en memoria para probar la interfaz del panel en local, sin
   cuentas reales y sin escribir en Supabase. Imita la API de supabase-js que usa
   admin/js/api.js. La seguridad real (RLS, roles, validación) se prueba aparte
   contra la base de datos con supabase/tests/permisos.sql.
   Uso: node serve.js → http://localhost:5230/tests/panel-simulado.html
   Acceso simulado: admin@volt.test / prueba-local */
(function () {
  'use strict';
  const REAL = 'https://rxdokvoljoxtficvbjhc.supabase.co';
  const KEY = 'sb_publishable_Sv34Sje2NPVUZEpAWDpzuw_L5X2w7_H';
  const DB = { site_content: [], site_published: [], content_versions: [], categories: [], products: [], media: [], audit_log: [], admin_users: [] };
  const objects = {};
  const USER = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@volt.test' };
  let session = null;
  const listeners = [];
  const now = () => new Date().toISOString();
  const clone = o => JSON.parse(JSON.stringify(o));
  const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const uuid = () => crypto.randomUUID();
  window.__mock = { DB, objects, calls: [] };

  const ready = (async () => {
    const hdr = { apikey: KEY };
    const [cats, prods, site] = await Promise.all([
      fetch(REAL + '/rest/v1/categories?select=*&order=sort_order', { headers: hdr }).then(r => r.json()),
      fetch(REAL + '/rest/v1/products?select=*&order=sort_order', { headers: hdr }).then(r => r.json()),
      fetch('../data/site.json').then(r => r.json())
    ]);
    DB.categories = cats; DB.products = prods;
    for (const [key, data] of Object.entries(site.content)) {
      DB.site_content.push({ key, data: clone(data), version: 1, updated_at: now(), updated_by_email: null });
      DB.site_published.push({ key, data: clone(data), draft_version: 1, published_at: now(), published_by_email: null });
      DB.content_versions.push({ id: DB.content_versions.length + 1, key, data: clone(data), published_at: now(), published_by_email: null, note: 'Contenido original de la página' });
    }
    ['cases', 'products', 'store', 'laptop', 'tv', 'team', 'taller', 'logo', 'logo-white'].forEach(n =>
      DB.media.push({ id: uuid(), path: null, url: `img/${n}.webp`, filename: `${n}.webp`, alt: n === 'cases' ? 'iPhones con accesorios' : '', folder: 'general', mime: 'image/webp', source: 'repo', created_at: now() }));
    DB.media.push({ id: uuid(), path: null, url: 'img/og.jpg', filename: 'og.jpg', alt: '', folder: 'marca', mime: 'image/jpeg', source: 'repo', created_at: now() });
    DB.media.push({ id: uuid(), path: null, url: 'favicon.svg', filename: 'favicon.svg', alt: '', folder: 'marca', mime: 'image/svg+xml', source: 'repo', created_at: now() });
    DB.admin_users.push({ user_id: USER.id, email: USER.email, role: 'owner', created_at: now() });
  })();

  function log(action, entity, entity_id, label, before, after) {
    DB.audit_log.unshift({ id: DB.audit_log.length + 1, at: now(), user_email: session && session.user.email, action, entity, entity_id, label, before, after });
  }
  const err = (message, code, status) => ({ data: null, error: { message, code, status } });
  const inUse = url => !!url && (DB.site_content.concat(DB.site_published).some(r => JSON.stringify(r.data).includes(url)) ||
    DB.products.some(p => p.image_url === url || (p.gallery || []).includes(url)));
  const pubProduct = (p, c) => Object.fromEntries(Object.entries({
    id: p.id, c: c.code, n: p.name, b: p.brand, d: p.detail, price: p.price, price_max: p.price_max, promo: p.promo_price, s: p.stock,
    f: p.featured || undefined, img: p.image_url, alt: p.image_alt, gallery: (p.gallery || []).length ? p.gallery : undefined,
    features: (p.features || []).length ? p.features : undefined, cta: p.cta_label, msg: p.cta_message, url: p.cta_url
  }).filter(([, v]) => v != null));
  function catalog() {
    const cats = DB.categories.filter(c => c.active).sort((a, b) => a.sort_order - b.sort_order);
    const byId = Object.fromEntries(DB.categories.map(c => [c.id, c]));
    const products = DB.products.filter(p => p.active && byId[p.category_id] && byId[p.category_id].active)
      .sort((a, b) => (b.featured - a.featured) || byId[a.category_id].sort_order - byId[b.category_id].sort_order || a.sort_order - b.sort_order)
      .map(p => pubProduct(p, byId[p.category_id]));
    return { categories: cats.map(c => ({ code: c.code, name: c.name, singular: c.singular, icon: c.icon })), products };
  }
  function stamp(row, isUpdate) {
    row.updated_at = now(); row.updated_by_email = session && session.user.email;
    if (isUpdate) row.version = (row.version || 1) + 1;
  }
  function needAdmin() { return session ? null : err('permission denied', '42501'); }

  /* ---------- tablas ---------- */
  class Query {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; }
    select(_c, opts) { this.ret = true; if (opts && opts.count) this.count = true; return this; }
    eq(k, v) { this.f.push(r => r[k] === v); return this; }
    in(k, vs) { this.f.push(r => vs.includes(r[k])); return this; }
    or(expr) { const m = /ilike\.%([^%]*)%/.exec(expr); if (m) { const s = m[1].trim().toLowerCase(); this.f.push(r => (String(r.label) + ' ' + String(r.user_email)).toLowerCase().includes(s)); } return this; }
    order() { return this; }
    range(a, b) { this.rng = [a, b]; return this; }
    limit(n) { this.lim = n; return this; }
    maybeSingle() { this.one = 'maybe'; return this; }
    single() { this.one = 'one'; return this; }
    insert(row) { this.op = 'insert'; this.payload = row; return this; }
    update(fields) { this.op = 'update'; this.payload = fields; return this; }
    delete() { this.op = 'delete'; return this; }
    then(res, rej) { return ready.then(() => this.exec()).then(res, rej); }
    exec() {
      window.__mock.calls.push([this.t, this.op]);
      const denied = needAdmin(); if (denied && this.op !== 'select') return denied;
      const T = DB[this.t]; const match = r => this.f.every(fn => fn(r));
      if (this.op === 'select') {
        let rows = T.filter(match);
        if (this.t === 'content_versions') rows = rows.sort((a, b) => b.id - a.id);
        const total = rows.length;
        if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
        if (this.lim) rows = rows.slice(0, this.lim);
        if (this.one) { if (this.one === 'one' && rows.length !== 1) return err('JSON object requested, multiple (or no) rows returned', 'PGRST116'); return { data: rows[0] ? clone(rows[0]) : null, error: null }; }
        return { data: clone(rows), error: null, count: this.count ? total : null };
      }
      if (this.op === 'insert') {
        const row = { id: uuid(), version: 1, created_at: now(), ...(this.t === 'media' ? { source: 'upload', alt: '' } : {}), ...clone(this.payload) };
        if (this.t === 'categories' && DB.categories.some(c => c.code === row.code)) return err('duplicate key', '23505');
        stamp(row); T.push(row); log('insert', this.t, row.id, row.name || row.filename, null, row);
        return { data: this.one ? clone(row) : [clone(row)], error: null };
      }
      if (this.op === 'update') {
        if (this.t === 'products' && this.payload.price_max != null && this.payload.price != null && this.payload.price_max < this.payload.price) return err('violates check constraint "products_price_range"', '23514');
        const rows = T.filter(match);
        rows.forEach(r => { const before = clone(r); Object.assign(r, clone(this.payload)); stamp(r, true); log('update', this.t, r.id, r.name || r.filename, before, clone(r)); });
        return { data: this.one ? (rows[0] ? clone(rows[0]) : null) : clone(rows), error: null };
      }
      if (this.op === 'delete') {
        let rows = T.filter(match);
        if (this.t === 'categories' && rows.some(c => DB.products.some(p => p.category_id === c.id))) return err('violates foreign key constraint', '23503');
        if (this.t === 'media') rows = rows.filter(m => m.source === 'upload' && !inUse(m.url));
        rows.forEach(r => { T.splice(T.indexOf(r), 1); log('delete', this.t, r.id, r.name || r.filename, r, null); });
        return { data: clone(rows), error: null };
      }
    }
  }

  /* ---------- funciones (RPC) ---------- */
  const RPC = {
    my_admin_profile: () => ({ user_id: USER.id, email: USER.email, role: 'owner' }),
    record_login: () => { log('login', 'session', USER.id, USER.email); return null; },
    get_admin_overview: () => ({
      products_total: DB.products.length, products_active: DB.products.filter(p => p.active).length,
      products_out: DB.products.filter(p => p.active && p.stock === 0).length, products_featured: DB.products.filter(p => p.featured).length,
      categories: DB.categories.length, media: DB.media.length,
      pending: DB.site_content.filter(c => !same(c.data, (DB.site_published.find(p => p.key === c.key) || {}).data)).map(c => c.key),
      last_publish: { at: DB.content_versions[DB.content_versions.length - 1].published_at, by: DB.content_versions[DB.content_versions.length - 1].published_by_email },
      recent: DB.audit_log.slice(0, 8)
    }),
    get_preview_site: () => ({ content: Object.fromEntries(DB.site_content.map(c => [c.key, clone(c.data)])), preview: true, updated_at: now(), ...catalog() }),
    save_draft: ({ p_key, p_data, p_expected_version }) => {
      if (JSON.stringify(p_data).includes('javascript:')) throw { message: `Datos no válidos en "${p_key}": "javascript:…" does not match`, code: '22023' };
      const r = DB.site_content.find(c => c.key === p_key);
      if (p_expected_version != null && p_expected_version !== r.version) throw { message: `Otra persona modificó “${p_key}” mientras editabas. Recarga para ver la versión actual.`, code: '40001' };
      const before = clone(r); r.data = clone(p_data); stamp(r, true); log('update', 'site_content', p_key, p_key, before, clone(r));
      return { key: p_key, version: r.version, updated_at: r.updated_at, updated_by_email: r.updated_by_email };
    },
    publish_content: ({ p_keys, p_note }) => {
      const keys = [];
      DB.site_content.filter(c => !p_keys || p_keys.includes(c.key)).forEach(c => {
        const p = DB.site_published.find(x => x.key === c.key);
        if (same(p.data, c.data)) return;
        p.data = clone(c.data); p.published_at = now(); p.published_by_email = USER.email;
        DB.content_versions.push({ id: DB.content_versions.length + 1, key: c.key, data: clone(c.data), published_at: now(), published_by_email: USER.email, note: p_note });
        keys.push(c.key);
      });
      if (keys.length) log('publish', 'site_published', keys.join(','), p_note, { keys });
      return { published: keys, at: now() };
    },
    discard_drafts: ({ p_keys }) => { let n = 0; p_keys.forEach(k => { const c = DB.site_content.find(x => x.key === k), p = DB.site_published.find(x => x.key === k); if (!same(c.data, p.data)) { c.data = clone(p.data); stamp(c, true); n++; } }); return { discarded: n }; },
    restore_version: ({ p_id }) => { const v = DB.content_versions.find(x => x.id === p_id); const c = DB.site_content.find(x => x.key === v.key); c.data = clone(v.data); stamp(c, true); log('restore', 'site_content', v.key, 'Versión ' + v.id); return { key: v.key }; },
    media_usage: ({ p_url }) => ({
      content: DB.site_content.filter(r => JSON.stringify(r.data).includes(p_url)).map(r => r.key),
      published: DB.site_published.filter(r => JSON.stringify(r.data).includes(p_url)).map(r => r.key),
      products: DB.products.filter(p => p.image_url === p_url || (p.gallery || []).includes(p_url)).map(p => p.name)
    }),
    replace_media_url: ({ p_old, p_new }) => {
      let c = 0, p = 0;
      DB.site_content.forEach(r => { const s = JSON.stringify(r.data); if (s.includes(JSON.stringify(p_old))) { r.data = JSON.parse(s.split(JSON.stringify(p_old)).join(JSON.stringify(p_new))); c++; } });
      DB.products.forEach(r => { if (r.image_url === p_old || (r.gallery || []).includes(p_old)) { if (r.image_url === p_old) r.image_url = p_new; r.gallery = (r.gallery || []).map(g => g === p_old ? p_new : g); p++; } });
      return { content: c, products: p };
    },
    reorder_products: ({ p_ids }) => { p_ids.forEach((id, i) => { DB.products.find(p => p.id === id).sort_order = (i + 1) * 10; }); return null; },
    reorder_categories: ({ p_ids }) => { p_ids.forEach((id, i) => { DB.categories.find(p => p.id === id).sort_order = (i + 1) * 10; }); return null; },
    export_site: () => ({ format: 'volt-backup', format_version: 1, exported_at: now(), drafts: Object.fromEntries(DB.site_content.map(c => [c.key, c.data])), published: Object.fromEntries(DB.site_published.map(c => [c.key, c.data])), categories: DB.categories, products: DB.products.map(p => ({ ...p, category: (DB.categories.find(c => c.id === p.category_id) || {}).code })), media: DB.media }),
    import_site: ({ p_payload }) => { if (p_payload.format !== 'volt-backup') throw { message: 'El archivo no es un respaldo de VOLT.', code: '22023' }; return { content: Object.keys(p_payload.drafts || {}).length, categories: (p_payload.categories || []).length, products: (p_payload.products || []).length }; },
    grant_admin: ({ p_email, p_role }) => { let u = DB.admin_users.find(a => a.email === p_email); if (!u && !/@volt\.test$/.test(p_email)) throw { message: `No hay una cuenta con el correo ${p_email}. Créala primero en Supabase → Authentication → Users.`, code: 'P0002' }; if (!u) { u = { user_id: uuid(), email: p_email, created_at: now() }; DB.admin_users.push(u); } u.role = p_role; return u; },
    revoke_admin: ({ p_user_id }) => { const u = DB.admin_users.find(a => a.user_id === p_user_id); if (u.role === 'owner' && DB.admin_users.filter(a => a.role === 'owner').length <= 1) throw { message: 'No se puede quitar al único propietario.', code: '42501' }; DB.admin_users.splice(DB.admin_users.indexOf(u), 1); return null; }
  };

  function emit(ev) { listeners.forEach(cb => queueMicrotask(() => cb(ev, session))); }

  window.supabase = {
    createClient() {
      return {
        auth: {
          async getSession() { await ready; return { data: { session }, error: null }; },
          onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithPassword({ email, password }) {
            if (email !== USER.email || password !== 'prueba-local') return { data: {}, error: { message: 'Invalid login credentials', status: 400 } };
            session = { user: USER, access_token: 'simulado' }; emit('SIGNED_IN'); return { data: { session }, error: null };
          },
          async signOut() { session = null; emit('SIGNED_OUT'); return { error: null }; },
          async updateUser() { return { data: {}, error: null }; },
          async resetPasswordForEmail() { return { data: {}, error: null }; }
        },
        from: t => new Query(t),
        async rpc(name, args) {
          await ready; window.__mock.calls.push(['rpc', name]);
          if (!session) return err('permission denied for function ' + name, '42501');
          try { return { data: RPC[name](args || {}), error: null }; } catch (e) { return { data: null, error: e }; }
        },
        storage: {
          from: () => ({
            async upload(path, blob) { objects[path] = { blob, url: URL.createObjectURL(blob) }; return { data: { path }, error: null }; },
            getPublicUrl: path => ({ data: { publicUrl: REAL + '/storage/v1/object/public/media/' + path } }),
            async remove(paths) {
              const ok = paths.filter(p => !inUse((DB.media.find(m => m.path === p) || {}).url));
              ok.forEach(p => delete objects[p]);
              return { data: ok.map(name => ({ name })), error: null };
            }
          })
        }
      };
    }
  };
})();
