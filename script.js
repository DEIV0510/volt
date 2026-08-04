/* ===== VOLT STORE CO — interacciones ===== */
(function () {
  'use strict';

  /* ---- Catálogo conectado a Google Sheets (CSV) ----
     El inventario se administra en la hoja "Inventario VOLT STORE CO" y la
     página lo lee del CSV publicado, así se actualiza sola al editar la hoja.
     Columnas: Categoria · Nombre · Detalle · Precio · Mostrar.
     Si el CSV falla, usa la lista de respaldo P_FALLBACK (la web nunca se rompe). */
  var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjlEsDKFmA1am7go3yHcw4HcN7XxVpzTIvcwQ_3VN8syIAS_Kb3aRFZcsurFYO_NSEqGhQi6JwNcU3/pub?gid=0&single=true&output=csv";
  var P_FALLBACK = [{c:"cel",n:"iPhone 17",d:"Apple"},{c:"cel",n:"iPhone 16 Pro Max",d:"Apple"},{c:"cel",n:"iPhone 16",d:"Apple"},{c:"cel",n:"iPhone 15",d:"Apple"},{c:"cel",n:"iPhone 14",d:"Apple"},{c:"cel",n:"iPhone 13",d:"Apple"},{c:"cel",n:"iPhone 11",d:"Apple"},{c:"cel",n:"Galaxy S25 Ultra",d:"Samsung"},{c:"cel",n:"Galaxy S24",d:"Samsung"},{c:"cel",n:"Galaxy A55",d:"Samsung"},{c:"cel",n:"Galaxy A25",d:"Samsung"},{c:"cel",n:"Galaxy A15",d:"Samsung"},{c:"cel",n:"Galaxy A06",d:"Samsung"},{c:"cel",n:"Redmi Note 13",d:"Xiaomi"},{c:"cel",n:"Redmi 15C",d:"Xiaomi"},{c:"cel",n:"Redmi 13C",d:"Xiaomi"},{c:"cel",n:"Redmi A3",d:"Xiaomi"},{c:"cel",n:"Poco X6",d:"Xiaomi"},{c:"cel",n:"Moto Edge 50",d:"Motorola"},{c:"cel",n:"Moto G54",d:"Motorola"},{c:"cel",n:"Moto G24",d:"Motorola"},{c:"cel",n:"Moto G04",d:"Motorola"},{c:"car",n:"Cabeza Samsung 45W",d:"Negro",p:"$30.000"},{c:"car",n:"Cargador Completo Samsung 25W",d:"12 Blanco / 5 Negro",p:"$30.000"},{c:"car",n:"Cargador Completo Samsung 45W",d:"5 Negro / 4 Blanco",p:"$40.000"},{c:"car",n:"Cargador Completo Harvic V8 5A",p:"$30.000"},{c:"car",n:"Cargador Completo Xiaomi 67W",p:"$50.000"},{c:"car",n:"Cargador Completo Harvic V8 3A",p:"$20.000"},{c:"car",n:"Cargador Completo Harvic TC 3A",d:"Tipo C",p:"$20.000"},{c:"car",n:"Cabeza iPhone 1.1 20W",d:"Blanco",p:"$40.000"},{c:"car",n:"Cabeza iPhone Original 20W",d:"Blanco",p:"$130.000"},{c:"car",n:"Cable Harvic TC 3A",d:"Tipo C",p:"$15.000"},{c:"car",n:"Cable Harvic V8 3A",d:"V8",p:"$15.000"},{c:"car",n:"Cable iPhone 1.1 TC a TC",d:"Tipo C a Tipo C",p:"$30.000"},{c:"car",n:"Cable iPhone 1.1 TC a Lightning",d:"Tipo C a Lightning",p:"$30.000"},{c:"car",n:"Cargador Genérico Smartwatch",d:"Negro",p:"$20.000"},{c:"car",n:"Cargador Inalámbrico iPhone",d:"Blanco",p:"$20.000"},{c:"aud",n:"Airpods Pro 2ª Gen",d:"Calidad 1.1",p:"$90.000"},{c:"aud",n:"Airpods 4ª Gen",d:"Calidad 1.1",p:"$120.000"},{c:"aud",n:"Airpods Pro 3ª Gen",d:"Calidad 1.1",p:"$150.000"},{c:"aud",n:"Airpods Max",d:"Calidad 1.1 (Imantadas)",p:"$140.000"},{c:"aud",n:"Galaxy Buds FE",d:"Calidad 1.1",p:"$120.000"},{c:"aud",n:"Galaxy Buds3 Pro",d:"Calidad 1.1",p:"$120.000"},{c:"aud",n:"Audífonos Tipo Arete",d:"Inalámbrico",p:"$70.000"},{c:"aud",n:"Samsung M23 TC",d:"Cable Tipo C",p:"$20.000"},{c:"aud",n:"Galaxy S5 3.5",d:"Cable Plug 3.5mm",p:"$10.000"},{c:"aud",n:"Kr-9900",d:"Diadema / Otro",p:"$40.000"},{c:"sw",n:"S10 Max",d:"Smartwatch",p:"$90.000"},{c:"sw",n:"10 Ultra 3",d:"Smartwatch",p:"$120.000"},{c:"sw",n:"JKMX 10 Pro Max",d:"Smartwatch",p:"$100.000"},{c:"sw",n:"HK 10 Ultra",d:"Smartwatch",p:"$250.000"},{c:"sw",n:"V68",d:"Smartwatch",p:"$200.000"},{c:"sw",n:"HR5 Ultra3",d:"Smartwatch",p:"$80.000"},{c:"sw",n:"Bogmbgx3",d:"Parlante",p:"$150.000"},{c:"vid",n:"Vidrio Templado iPhone",d:"21D $10k · Blindado $15k · Antiespía $20k. iPhone 7 a 17 Pro Max",p:"$10.000–$20.000"},{c:"vid",n:"Vidrio Templado Samsung",d:"Serie A (A03–A57), S20FE, S24FE, S25 Ultra y más",p:"$10.000–$20.000"},{c:"vid",n:"Vidrio Templado Xiaomi",d:"Redmi (9 a 15C), Redmi Note 8–15, Poco X3–X7",p:"$10.000–$20.000"},{c:"vid",n:"Vidrio Templado Otras Marcas",d:"Motorola, Tecno, Honor, Oppo, Vivo, Realme, Huawei",p:"$10.000–$20.000"},{c:"for",n:"Forro iPhone",d:"Silicona/Space $20k · MagSafe $30k · Lujo $40k. iPhone 11 a 17 Pro Max",p:"$20.000–$40.000"},{c:"for",n:"Forro Samsung",d:"Silicona/Armadura/Lujo. Serie A (A02–A57), S24FE, S24/S25 Ultra",p:"$20.000–$40.000"},{c:"for",n:"Forro Xiaomi (Redmi / Poco)",d:"Silicona/Armadura/Space/Diseño. Redmi A1–15C, Note 7–15, Poco",p:"$20.000–$40.000"},{c:"for",n:"Forro Otras Marcas",d:"Motorola, Tecno, Honor, Oppo, Realme, Vivo, Huawei",p:"$20.000–$40.000"},{c:"acc",n:"Pulso Liso (Smartwatch)",p:"$10.000"},{c:"acc",n:"Pulso Corrugado (Smartwatch)",p:"$10.000"},{c:"acc",n:"Ventosa Doble Pega",p:"$10.000"},{c:"acc",n:"Ventosa Bolsillo",p:"$10.000"},{c:"acc",n:"Protector de Cargador iPhone 20W",p:"$20.000"},{c:"acc",n:"Protector Airpods Pro 3ª Gen",p:"$20.000"},{c:"acc",n:"Protector Airpods Pro 2ª Gen",p:"$20.000"},{c:"acc",n:"Protector Airpods 4ª Gen",p:"$20.000"},{c:"acc",n:"Guantes Anti Sudor",p:"$5.000"},{c:"acc",n:"Cámara Mini A9",p:"$30.000"},{c:"acc",n:"Proyector Astronauta",p:"$100.000"},{c:"acc",n:"Cámara de Seguridad WiFi",p:"$130.000"},{c:"acc",n:"Video Making AY-49U",p:"$90.000"},{c:"acc",n:"Video Making AY-49",p:"$40.000"},{c:"acc",n:"Pistola de Hydrogel",p:"$80.000"},{c:"acc",n:"Multiherramienta",p:"$60.000"},{c:"acc",n:"Luz LED 5m",p:"$80.000"},{c:"acc",n:"Stitch que Respira",p:"$55.000"},{c:"acc",n:"Power Bank JKMX",p:"$120.000"},{c:"acc",n:"Panel de Luz Sofistek",p:"$90.000"},{c:"acc",n:"Combo Teclado + Mouse",p:"$50.000"},{c:"acc",n:"Máquina Patillera",p:"$40.000"},{c:"acc",n:"Mouse Inalámbrico",p:"$40.000"}];

  (function initCatalog(){
    if (document.getElementById('cg2')) return;                 // el bootstrapper de WordPress ya lo armó
    if (!document.querySelector('#catalogo .container')) return;
    buildCat(P_FALLBACK);
    fetchCSV(CSV_URL).then(function(t){ var f = csvToProducts(t); if (f && f.length) buildCat(f); }).catch(function(){});
  })();

  function fetchCSV(url){return Promise.race([fetch(url,{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.text();}),new Promise(function(_,rej){setTimeout(function(){rej(0);},7000);})]);}
  function parseCSV(text){var rows=[],row=[],field="",inQ=false,i,c;text=String(text).replace(/\r\n/g,"\n").replace(/\r/g,"\n");for(i=0;i<text.length;i++){c=text[i];if(inQ){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{inQ=false;}}else{field+=c;}}else{if(c==='"'){inQ=true;}else if(c===","){row.push(field);field="";}else if(c==="\n"){row.push(field);rows.push(row);row=[];field="";}else{field+=c;}}}if(field.length||row.length){row.push(field);rows.push(row);}return rows;}
  function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
  function catCode(name){var s=norm(name);if(s.indexOf("celular")>=0)return"cel";if(s.indexOf("cargador")>=0)return"car";if(s.indexOf("audif")>=0||s.indexOf("audio")>=0)return"aud";if(s.indexOf("smartwatch")>=0||s.indexOf("reloj")>=0||s.indexOf("parlante")>=0)return"sw";if(s.indexOf("vidrio")>=0)return"vid";if(s.indexOf("forro")>=0)return"for";if(s.indexOf("accesorio")>=0)return"acc";return"";}
  function csvToProducts(text){var rows=parseCSV(text);if(rows.length<2)return[];var head=rows[0].map(norm);var iCat=head.indexOf("categoria"),iNom=head.indexOf("nombre"),iDet=head.indexOf("detalle"),iPre=head.indexOf("precio"),iMos=head.indexOf("mostrar"),iStk=-1;for(var q=0;q<head.length;q++){if(/stock|cantidad|existencia|disponible/.test(head[q])){iStk=q;break;}}if(iCat<0||iNom<0)return[];var out=[],r;for(r=1;r<rows.length;r++){var row=rows[r];if(!row)continue;var nom=(row[iNom]||"").trim();if(!nom)continue;if(iMos>=0){var mos=norm(row[iMos]);if(mos&&["si","yes","true","1","x"].indexOf(mos)<0)continue;}var cc=catCode(row[iCat]);if(!cc)continue;var o={c:cc,n:nom};var det=iDet>=0?(row[iDet]||"").trim():"";if(det)o.d=det;var pre=iPre>=0?(row[iPre]||"").trim():"";if(pre)o.p=pre;if(iStk>=0){var stk=(row[iStk]||"").trim();if(stk!=="")o.s=stk;}out.push(o);}return out;}
  function buildCat(P){
    var ICON={cel:"📱",car:"🔌",aud:"🎧",sw:"⌚",vid:"🛡️",for:"📲",acc:"🧰"};
    var LBL={cel:"Celular",car:"Cargador",aud:"Audio",sw:"Smartwatch",vid:"Vidrio templado",for:"Forro",acc:"Accesorio"};
    var CATS=[["all","Todos"],["cel","Celulares"],["car","Cargadores"],["aud","Audífonos"],["sw","Smartwatch"],["vid","Vidrios"],["for","Forros"],["acc","Accesorios"]];
    var cont=document.querySelector("#catalogo .container"); if(!cont) return;
    var wa="https://wa.me/573171076290?text=";
    var present={}; P.forEach(function(x){present[x.c]=1;});
    var cats=CATS.filter(function(c){return c[0]==="all"||present[c[0]];});
    cont.innerHTML='<header class="section__head reveal in"><span class="kicker">Catálogo</span><h2>Catálogo de productos</h2><p>Explora nuestro inventario por categorías. Consulta disponibilidad y precio por WhatsApp.</p></header><div class="catalog__filters" id="cf2">'+cats.map(function(c){return '<button class="chip'+(c[0]==="all"?" is-active":"")+'" data-c="'+c[0]+'">'+c[1]+'</button>';}).join("")+'</div><div class="catalog__viewport" id="cv2"><div class="catalog__track" id="cg2"></div></div><nav class="catalog__pages" id="cp2"></nav><p class="catalog__note reveal in">¿Buscas algo puntual? <a href="'+wa+encodeURIComponent("Hola, quiero consultar un producto del catálogo de VOLT STORE CO.")+'" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>.</p>';
    var grid=document.getElementById("cg2"),cf=document.getElementById("cf2"),cp=document.getElementById("cp2"),vp=document.getElementById("cv2");
    var PS=6,brand="all",page=1;
    function listF(){return P.filter(function(x){return brand==="all"||x.c===brand;});}
    function vw(){return Math.round(vp.getBoundingClientRect().width)||1;}
    function pageCount(){return Math.max(1,Math.ceil(listF().length/PS));}
    function card(x,n){var msg=encodeURIComponent("Hola, quiero consultar disponibilidad y precio de: "+x.n+" ("+(LBL[x.c]||"")+") en VOLT STORE CO.");var brandTxt=(x.c==="cel"&&x.d)?x.d:LBL[x.c];var det=(x.c==="cel")?'<p class="model__detail">Disponible a crédito o de contado</p>':((x.d)?'<p class="model__detail">'+x.d+'</p>':'');var pr=x.p?'<span class="model__price">'+x.p+'</span>':((x.c==="cel")?'<span class="model__price model__price--ask">Consultar precio</span>':'');var stk="";if(x.s!==undefined&&x.s!==""){var sn=parseInt(String(x.s).replace(/[^0-9-]/g,""),10);if(!isNaN(sn))stk=(sn<=0)?'<span class="model__stock model__stock--out">Agotado</span>':'<span class="model__stock model__stock--in">'+sn+' disp.</span>';}return '<article class="model" data-c="'+x.c+'"><span class="model__num">'+n+'</span>'+stk+'<div class="model__media"><span class="model__icon">'+(ICON[x.c]||"🛒")+'</span></div><div class="model__body"><span class="model__brand">'+brandTxt+'</span><h3>'+x.n+'</h3>'+det+pr+'<a class="btn btn--soft" href="'+wa+msg+'" target="_blank" rel="noopener">Consultar</a></div></article>';}
    function setW(){var w=vw();var pgs=grid.querySelectorAll(".catpage");for(var i=0;i<pgs.length;i++)pgs[i].style.width=w+"px";}
    function pagHTML(tp){if(tp<=1)return"";var h='<button class="page-btn page-btn--nav" data-g="prev"'+(page===1?" disabled":"")+'>‹</button>';for(var n=1;n<=tp;n++)h+='<button class="page-btn'+(n===page?" is-active":"")+'" data-g="'+n+'">'+n+'</button>';h+='<button class="page-btn page-btn--nav" data-g="next"'+(page===tp?" disabled":"")+'>›</button>';return h;}
    function updPag(){var tp=pageCount();var btns=cp.querySelectorAll(".page-btn");for(var i=0;i<btns.length;i++){var b=btns[i],g=b.dataset.g;if(g==="prev")b.disabled=(page===1);else if(g==="next")b.disabled=(page===tp);else b.classList.toggle("is-active",parseInt(g,10)===page);}}
    function render(){var L=listF();var tp=pageCount();if(page>tp)page=tp;var h="";for(var p=0;p<tp;p++){h+='<div class="catpage">';for(var k=0;k<PS;k++){var idx=p*PS+k;if(idx>=L.length)break;h+=card(L[idx],idx+1);}h+='</div>';}grid.innerHTML=h;setW();cp.innerHTML=pagHTML(tp);vp.scrollLeft=(page-1)*vw();}
    function go(n){var tp=pageCount();page=Math.min(tp,Math.max(1,n));vp.scrollTo({left:(page-1)*vw(),behavior:"smooth"});updPag();}
    function realign(){setW();vp.scrollLeft=(page-1)*vw();}
    cf.addEventListener("click",function(ev){var b=ev.target.closest(".chip");if(!b)return;cf.querySelectorAll(".chip").forEach(function(c){c.classList.toggle("is-active",c===b);});brand=b.dataset.c;page=1;render();});
    cp.addEventListener("click",function(ev){var b=ev.target.closest(".page-btn");if(!b||b.disabled)return;var g=b.dataset.g;if(g==="prev")go(page-1);else if(g==="next")go(page+1);else go(parseInt(g,10));});
    var tmr;vp.addEventListener("scroll",function(){clearTimeout(tmr);tmr=setTimeout(function(){var tp=pageCount();var cur=Math.round(vp.scrollLeft/vw())+1;if(cur<1)cur=1;if(cur>tp)cur=tp;if(cur!==page){page=cur;updPag();}},120);},{passive:true});
    var rtmr;window.addEventListener("resize",function(){clearTimeout(rtmr);rtmr=setTimeout(realign,150);});
    if(window.ResizeObserver){var lw=0;var ro=new ResizeObserver(function(){var w=vw();if(w!==lw){lw=w;realign();}});ro.observe(vp);}
    render();
  }

  /* ---- Pantalla de carga (contador + barra) ---- */
  const loader = document.getElementById('loader');
  if (loader) {
    const fill = document.getElementById('loaderFill');
    const pctEl = document.getElementById('loaderPct');
    const DURATION = 2100;
    let startTs = null, done = false;

    function hideLoader() {
      if (done) return;
      done = true;
      loader.classList.add('is-hidden');
      document.body.style.overflow = '';
    }

    function tick(ts) {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2);          // ease-out
      const pct = Math.round(eased * 100);
      if (pctEl) pctEl.textContent = pct + '%';
      if (fill) fill.style.width = pct + '%';
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(hideLoader, 180);
    }
    requestAnimationFrame(tick);
    setTimeout(hideLoader, 5000); // failsafe
  }

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
