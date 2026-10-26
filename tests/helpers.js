/* Ayudas para probar el panel simulado desde la consola (no dependen de temporizadores,
   que el navegador frena cuando la pestaña no está visible). */
window.T = {
  tick: () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }),
  async until(fn, ms = 8000) { const t0 = performance.now(); while (performance.now() - t0 < ms) { let v; try { v = fn(); } catch (e) { /* aún no */ } if (v) return v; await T.tick(); } return null; },
  set(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); },
  btn(text, root = document) { return [...root.querySelectorAll('button, a.btn')].find(b => b.innerText.trim().includes(text)); },
  field(label, root = document) { return [...root.querySelectorAll('.field')].find(f => (f.querySelector('.field__label') || {}).innerText?.startsWith(label)); },
  toast() { return [...document.querySelectorAll('.toast')].map(t => t.innerText).pop(); },
  async login() {
    await T.until(() => document.getElementById('lg-email'));
    T.set(document.getElementById('lg-email'), 'admin@volt.test'); T.set(document.getElementById('lg-pass'), 'prueba-local');
    document.querySelector('form button[type=submit]').click();
    return T.until(() => document.querySelector('.top__title'));
  },
  async go(hash, sel = '.pagehead h1') { location.hash = hash; await T.tick(); return T.until(() => !document.querySelector('#view .loading') && document.querySelector(sel)); },
  async confirm(label) { const m = await T.until(() => [...document.querySelectorAll('.modal')].pop(), 4000); if (!m) return false; T.btn(label, m).click(); await T.until(() => !document.body.contains(m)); return true; }
};
