/* ════════════════════════════════════════════════════════════
   VIDEOTECA VIP  ·  script.js
   Firebase Auth + Firestore + TMDB enrichment + Moderador
════════════════════════════════════════════════════════════ */
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         onAuthStateChanged, signOut, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore,
         collection, getDocs,
         doc, getDoc, setDoc,
         addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ── CONFIGURACIÓN ─────────────────────────────────────── */
const FB = {
  apiKey:            "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
  authDomain:        "mipunto-e32c9.firebaseapp.com",
  projectId:         "mipunto-e32c9",
  storageBucket:     "mipunto-e32c9.firebasestorage.app",
  messagingSenderId: "109212632970",
  appId:             "1:109212632970:web:d57a11a01f5365fad0aa73"
};

// ⚠️ Cambia esto por el email real del moderador en Firebase Auth
const MOD_EMAIL = "moderador@videotecavip.com";

const TMDB_KEY = "7307350d0b166058d1b926aad793eeec";
const TMDB     = "https://api.themoviedb.org/3";
const IMG_SM   = "https://image.tmdb.org/t/p/w342";
const IMG_LG   = "https://image.tmdb.org/t/p/w1280";

/* ── SECCIONES DEL CATÁLOGO ────────────────────────────── */
// El scanner sube documentos con un campo "category".
// Estas son todas las categorías que mostramos, en orden.
const SECTIONS = [
  { key: "Peliculas",         label: "🎬 Películas",           episodic: false },
  { key: "Sagas",             label: "🎞 Sagas / Colecciones", episodic: false },
  { key: "Series",            label: "📺 Series",              episodic: true  },
  { key: "Novelas",           label: "💕 Novelas",             episodic: true  },
  { key: "Shows",             label: "🎤 Shows",               episodic: false },
  { key: "PeliculasAnimadas", label: "✨ Películas animadas",  episodic: false },
  { key: "Animados",          label: "🎨 Animados",            episodic: true  },
  { key: "Anime",             label: "⛩ Anime",               episodic: true  },
  { key: "Donghua",           label: "🐉 Donghua",             episodic: true  },
];

// Tipos de fichero para el panel de precios por fichero
const FILE_TYPES = [
  { key: "pelicula",         label: "Película"             },
  { key: "cap_serie",        label: "Capítulo de serie"    },
  { key: "cap_novela",       label: "Capítulo de novela"   },
  { key: "show",             label: "Show / programa"      },
  { key: "pelicula_animada", label: "Película animada"     },
  { key: "animado",          label: "Animado (serie)"      },
  { key: "anime",            label: "Anime"                },
  { key: "donghua",          label: "Donghua"              },
];

// Mapa de categoría → tipo de fichero para calcular precio
const CAT_FILE = {
  Peliculas:"pelicula", Sagas:"pelicula",
  Series:"cap_serie", Novelas:"cap_novela",
  Shows:"show", PeliculasAnimadas:"pelicula_animada",
  Animados:"animado", Anime:"anime", Donghua:"donghua"
};

const CAP_TIERS = [
  {key:"1gb",label:"1 GB"},{key:"2gb",label:"2 GB"},
  {key:"4gb",label:"4 GB"},{key:"8gb",label:"8 GB"},
  {key:"16gb",label:"16 GB"},{key:"32gb",label:"32 GB"},
  {key:"64gb",label:"64 GB"},{key:"128gb",label:"128 GB"},
];

const DEF_FILE = { pelicula:200,cap_serie:50,cap_novela:40,show:80,pelicula_animada:150,animado:50,anime:50,donghua:50 };
const DEF_CAP  = { "1gb":50,"2gb":90,"4gb":160,"8gb":280,"16gb":500,"32gb":900,"64gb":1600,"128gb":2800 };

/* ── ESTADO GLOBAL ─────────────────────────────────────── */
const app  = initializeApp(FB);
const auth = getAuth(app);
const db   = getFirestore(app);

let allItems    = [];
let cart        = [];
let curItem     = null;     // ítem abierto en el modal
let isLoginMode = true;
let isMod       = false;
let priceMode   = "ficheros";
let filePrices  = { ...DEF_FILE };
let capPrices   = { ...DEF_CAP };
let heroTimer   = null;
let curSlide    = 0;
let heroSlides  = [];
let _trKey      = null;     // clave de trailer TMDB en curso
let activeFilter = "all";

/* ════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════ */
document.getElementById("btn-auth").onclick = async () => {
  const ph = document.getElementById("phone").value.trim();
  const ps = document.getElementById("pass").value;
  if (ph.length < 8) return toast("Número inválido (mínimo 8 dígitos)");
  const email = `u${ph}@videotecavip.com`;
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, ps);
    } else {
      const nm = document.getElementById("reg-name").value.trim();
      if (!nm) return toast("Escribe tu nombre para registrarte");
      const r = await createUserWithEmailAndPassword(auth, email, ps);
      await updateProfile(r.user, { displayName: nm });
      location.reload();
    }
  } catch { toast("Datos incorrectos o usuario no registrado"); }
};

document.getElementById("auth-toggle").onclick = () => {
  isLoginMode = !isLoginMode;
  document.getElementById("reg-name").style.display  = isLoginMode ? "none" : "block";
  document.getElementById("btn-auth").textContent      = isLoginMode ? "INICIAR SESIÓN" : "CREAR CUENTA";
  document.getElementById("auth-subtitle").textContent = isLoginMode ? "Ingresa tus datos para continuar" : "Regístrate como nuevo usuario";
  document.getElementById("auth-toggle").innerHTML     = isLoginMode
    ? "¿No tienes cuenta? <b>Regístrate</b>"
    : "¿Ya tienes cuenta? <b>Inicia sesión</b>";
};

onAuthStateChanged(auth, async u => {
  const authScr = document.getElementById("auth-screen");
  if (u) {
    authScr.style.display = "none";
    document.getElementById("user-name").textContent = u.displayName || "Usuario";
    isMod = (u.email === MOD_EMAIL);
    if (isMod) document.getElementById("btn-mod").style.display = "flex";
    await loadPrices();
    await loadCatalog();
  } else {
    authScr.style.display = "flex";
    document.getElementById("hero-wrap").style.display = "none";
    document.getElementById("catalog").innerHTML = "";
  }
});

window.doLogout = () => signOut(auth).then(() => location.reload());

/* ════════════════════════════════════════════════════════
   PRECIOS (Firebase config/precios)
════════════════════════════════════════════════════════ */
async function loadPrices() {
  try {
    const snap = await getDoc(doc(db, "config", "precios"));
    if (snap.exists()) {
      const d = snap.data();
      if (d.modo)      priceMode  = d.modo;
      if (d.ficheros)  filePrices = { ...DEF_FILE, ...d.ficheros };
      if (d.capacidad) capPrices  = { ...DEF_CAP,  ...d.capacidad };
    }
  } catch (_) { /* usa defaults */ }
}

window.savePrices = async () => {
  FILE_TYPES.forEach(t => {
    const el = document.getElementById(`fp-${t.key}`);
    if (el) filePrices[t.key] = Number(el.value) || 0;
  });
  CAP_TIERS.forEach(t => {
    const el = document.getElementById(`cp-${t.key}`);
    if (el) capPrices[t.key] = Number(el.value) || 0;
  });
  try {
    await setDoc(doc(db, "config", "precios"), {
      modo: priceMode, ficheros: filePrices, capacidad: capPrices,
      updated: serverTimestamp()
    });
    toast("✓ Precios guardados");
  } catch (e) { toast("Error: " + e.message); }
};

function itemPrice(item) {
  if (priceMode === "capacidad") return "—";
  return filePrices[CAT_FILE[item.category] || "pelicula"] ?? 0;
}

/* ════════════════════════════════════════════════════════
   CARGA DEL CATÁLOGO
════════════════════════════════════════════════════════ */
async function loadCatalog() {
  try {
    const snap = await getDocs(collection(db, "catalogo"));
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.active !== false);
    // Normalizar categorías que el scanner pueda haber enviado en minúscula o con variantes
    allItems = allItems.map(normalizeItem);
    renderHero();
    renderCatalog(activeFilter);
    enrichTMDB(); // enriquece en background
  } catch (e) {
    document.getElementById("catalog").innerHTML =
      `<p style="color:#f88;padding:40px 4%">Error al cargar catálogo: ${e.message}</p>`;
  }
}

/* Normaliza la categoría que viene del scanner */
function normalizeItem(item) {
  if (!item.category) item.category = "Peliculas";
  const map = {
    "peliculas":"Peliculas","pelicula":"Peliculas",
    "series":"Series","serie":"Series",
    "novelas":"Novelas","novela":"Novelas",
    "shows":"Shows","show":"Shows",
    "animados":"Animados","animado":"Animados",
    "peliculasanimadas":"PeliculasAnimadas","pelicula_animada":"PeliculasAnimadas","peliculaanimada":"PeliculasAnimadas",
    "anime":"Anime",
    "donghua":"Donghua",
    "sagas":"Sagas","saga":"Sagas",
  };
  const norm = map[item.category.toLowerCase().replace(/\s/g,"")];
  if (norm) item.category = norm;
  // Si TMDB marcó isAnime o el scanner, fuerza Anime
  if (item.isAnime) item.category = "Anime";
  return item;
}

/* ════════════════════════════════════════════════════════
   ENRIQUECIMIENTO TMDB (background)
════════════════════════════════════════════════════════ */
async function enrichTMDB() {
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.poster && item.backdrop && item.plot) continue; // ya tiene datos
    const isTv = ["Series","Novelas","Anime","Donghua","Animados"].includes(item.category);
    try {
      const type = isTv ? "tv" : "movie";
      // Primera búsqueda en español, fallback inglés
      let result = null;
      for (const lang of ["es-ES","en-US"]) {
        const r = await fetch(`${TMDB}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=${lang}`);
        const d = await r.json();
        if (d.results && d.results.length) { result = d.results[0]; break; }
      }
      if (!result) continue;
      if (result.poster_path   && !item.poster)   allItems[i].poster   = IMG_SM + result.poster_path;
      if (result.backdrop_path && !item.backdrop)  allItems[i].backdrop = IMG_LG + result.backdrop_path;
      if (result.overview      && !item.plot)      allItems[i].plot     = result.overview;
      if (result.vote_average  && !item.rating)    allItems[i].rating   = result.vote_average.toFixed(1);
      allItems[i]._tmdb_id   = result.id;
      allItems[i]._tmdb_type = type;
      refreshCard(item.id);
    } catch (_) {}
    await sleep(100); // respetar límite de TMDB
  }
  renderHero(); // redibujar hero con imágenes frescas
}

async function fetchTrailerKey(item) {
  _trKey = null;
  if (!item) return;
  const type = item._tmdb_type || (["Series","Novelas","Anime","Donghua","Animados"].includes(item.category) ? "tv" : "movie");
  let id = item._tmdb_id || item.tmdb_id;
  try {
    if (!id) {
      const r = await fetch(`${TMDB}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=es-ES`);
      const d = await r.json();
      if (d.results && d.results.length) id = d.results[0].id;
    }
    if (!id) return;
    for (const lang of ["es-ES", "en-US"]) {
      const vd = await (await fetch(`${TMDB}/${type}/${id}/videos?api_key=${TMDB_KEY}&language=${lang}`)).json();
      const vids = vd.results || [];
      const t = vids.find(v => v.type === "Trailer" && v.site === "YouTube")
             || vids.find(v => v.site === "YouTube");
      if (t) { _trKey = t.key; return; }
    }
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════
   HERO SLIDER
════════════════════════════════════════════════════════ */
function renderHero() {
  heroSlides = allItems.filter(i => i.nuevo).slice(0, 8);
  if (!heroSlides.length) heroSlides = allItems.slice(0, 5);
  if (!heroSlides.length) { document.getElementById("hero-wrap").style.display = "none"; return; }
  document.getElementById("hero-wrap").style.display = "";

  const slidesEl = document.getElementById("hero-slides");
  const dotsEl   = document.getElementById("hero-dots");

  slidesEl.innerHTML = heroSlides.map((item, idx) => `
    <div class="h-slide${idx === 0 ? " active" : ""}" data-idx="${idx}">
      <div class="h-bg" style="background-image:url('${item.backdrop || item.poster || ""}')"></div>
      <div class="h-vignette"></div>
      <div class="h-content">
        ${item.nuevo ? '<span class="h-new-badge">🔴 NUEVO</span>' : ""}
        <div class="h-title">${esc(item.title)}</div>
        <div class="h-meta">
          ${item.rating ? `<span class="h-score">★ ${item.rating}</span> · ` : ""}
          ${item.year || ""} ${item.year && item.genre ? "·" : ""} ${(item.genre||"").split(",")[0]}
        </div>
        <div class="h-plot">${item.plot || item.synopsis || ""}</div>
        <div class="h-btns">
          <button class="btn-play" onclick="openDetail('${item.id}')">▶ VER INFO</button>
          <button class="btn-more" onclick="triggerAdd('${item.id}')">🛒 AÑADIR</button>
        </div>
      </div>
    </div>`).join("");

  dotsEl.innerHTML = heroSlides.map((_, idx) =>
    `<div class="h-dot${idx === 0 ? " active" : ""}" onclick="goSlide(${idx})"></div>`).join("");

  curSlide = 0;
  clearInterval(heroTimer);
  heroTimer = setInterval(() => goSlide((curSlide + 1) % heroSlides.length), 7000);
}

window.goSlide = (n) => {
  document.querySelectorAll(".h-slide").forEach((s, i) => s.classList.toggle("active", i === n));
  document.querySelectorAll(".h-dot").forEach((d, i)   => d.classList.toggle("active", i === n));
  curSlide = n;
};

/* ════════════════════════════════════════════════════════
   CATÁLOGO
════════════════════════════════════════════════════════ */
function renderCatalog(filter) {
  activeFilter = filter;
  const catalog = document.getElementById("catalog");
  catalog.innerHTML = "";

  // Sección especial "Recientes" solo en vista general
  if (filter === "all") {
    const recents = allItems.filter(i => i.nuevo);
    if (recents.length) catalog.appendChild(buildSection("🔥 Recién llegados", recents, "nuevo"));
  }

  const toShow = filter === "all" ? SECTIONS : SECTIONS.filter(s => s.key === filter);
  toShow.forEach(sec => {
    const items = allItems.filter(i => i.category === sec.key);
    if (items.length) catalog.appendChild(buildSection(sec.label, items, sec.key));
  });

  if (!catalog.children.length)
    catalog.innerHTML = `<p class="empty-msg">No hay títulos en esta categoría.</p>`;
}

function buildSection(label, items, secKey) {
  const div = document.createElement("div");
  div.className = "sec-block";
  div.dataset.sec = secKey;
  div.innerHTML = `<div class="sec-title">${label}</div>`;
  const row = document.createElement("div");
  row.className = "sec-row";
  items.forEach(item => row.appendChild(buildCard(item)));
  div.appendChild(row);
  return div;
}

function buildCard(item) {
  const price  = itemPrice(item);
  const isEp   = SECTIONS.find(s => s.key === item.category)?.episodic;
  const badge  = isEp && item.seasons
    ? `${item.seasons} Temp.`
    : (item.year || "");

  const imgHtml = item.poster
    ? `<img class="card-img" src="${item.poster}" alt="${esc(item.title)}" loading="lazy"/>`
    : `<div class="card-ph">🎬</div>`;

  const div = document.createElement("div");
  div.className = "card";
  div.dataset.id = item.id;
  div.onclick = () => openDetail(item.id);
  div.innerHTML = `
    ${imgHtml}
    ${item.nuevo ? '<span class="card-new">NUEVO</span>' : ""}
    ${badge ? `<span class="card-badge">${badge}</span>` : ""}
    <div class="card-hover">
      <div class="card-hover-name">${esc(item.title)}</div>
      <div class="card-hover-meta">★ ${item.rating||"N/A"} · ${price !== "—" ? "CUP "+price : "—"}</div>
      <button class="card-add-btn" onclick="event.stopPropagation();triggerAdd('${item.id}')">+ Añadir al pedido</button>
    </div>
    <div class="card-label">${esc(item.title)}</div>`;
  return div;
}

function refreshCard(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  document.querySelectorAll(`[data-id="${id}"]`).forEach(el => el.replaceWith(buildCard(item)));
}

/* ════════════════════════════════════════════════════════
   MODAL DETALLE
════════════════════════════════════════════════════════ */
window.openDetail = (id) => {
  curItem = allItems.find(i => i.id === id);
  if (!curItem) return;
  _trKey = null;

  // Media: muestra backdrop/poster mientras carga
  const media = document.getElementById("detail-media");
  const src   = curItem.backdrop || curItem.poster || "";
  media.innerHTML = src
    ? `<img src="${src}" alt=""/><div class="detail-media-grad"></div>`
    : `<div style="width:100%;height:100%;background:#0a0a12;display:flex;align-items:center;justify-content:center;font-size:64px">🎬</div>`;

  // Meta
  const isEp  = SECTIONS.find(s => s.key === curItem.category)?.episodic;
  const price = itemPrice(curItem);
  document.getElementById("d-title").textContent  = curItem.title || "";
  document.getElementById("d-plot").textContent   = curItem.plot || curItem.synopsis || curItem.overview || "Sin descripción disponible.";
  document.getElementById("d-score").textContent  = curItem.rating ? "★ " + curItem.rating : "";
  document.getElementById("d-year").textContent   = curItem.year  || "";
  document.getElementById("d-cat").textContent    = catLabel(curItem.category);
  document.getElementById("d-dur").textContent    = isEp && curItem.seasons ? curItem.seasons + " temporadas" : (curItem.runtime || "");
  document.getElementById("d-price").textContent  = price !== "—" ? "CUP " + price : "Consultar";

  // Extra info
  let extra = "";
  if (curItem.genre)    extra += `<div><b>Género:</b> ${esc(curItem.genre)}</div>`;
  if (curItem.director) extra += `<div><b>Director:</b> ${esc(curItem.director)}</div>`;
  if (curItem.actors)   extra += `<div><b>Reparto:</b> ${esc(curItem.actors)}</div>`;
  if (curItem.country)  extra += `<div><b>País:</b> ${esc(curItem.country)}</div>`;
  if (curItem.saga)     extra += `<div><b>Saga:</b> ${esc(curItem.saga)}</div>`;
  document.getElementById("d-extra").innerHTML = extra;

  // Botón "Añadir" del modal apunta al curItem actual
  document.getElementById("d-dur").textContent =
    isEp && curItem.seasons ? curItem.seasons + " temp." : (curItem.runtime || "");

  openOverlay("overlay-detail");
  fetchTrailerKey(curItem); // carga en background
};

window.playTrailer = () => {
  const media = document.getElementById("detail-media");
  const origin = encodeURIComponent(location.origin);
  if (_trKey) {
    media.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trKey}?autoplay=1&rel=0&origin=${origin}" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  } else {
    // esperar un segundo más por si todavía está buscando
    toast("Buscando tráiler…");
    setTimeout(() => {
      if (_trKey) {
        media.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trKey}?autoplay=1&rel=0&origin=${origin}" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
      } else if (curItem) {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(curItem.title + " trailer")}`, "_blank");
      }
    }, 1500);
  }
};

/* ════════════════════════════════════════════════════════
   CARRITO
════════════════════════════════════════════════════════ */

// triggerAdd: punto de entrada unificado desde cards y hero
window.triggerAdd = (id) => {
  if (id) curItem = allItems.find(i => i.id === id);
  if (!curItem) return;
  window.startAdd(null);
};

// startAdd: llamado desde el botón del modal de detalle
window.startAdd = (_unused) => {
  if (!curItem) return;
  const sec = SECTIONS.find(s => s.key === curItem.category);
  if (sec && sec.episodic) {
    // modal selección de temporada/capítulos
    document.getElementById("qty-title").textContent = curItem.title;
    const sel = document.getElementById("sel-season");
    sel.innerHTML = "";
    for (let i = 1; i <= (curItem.seasons || curItem.seasons_count || 1); i++)
      sel.innerHTML += `<option value="${i}">Temporada ${i}</option>`;
    document.getElementById("sel-type").value = "completa";
    document.getElementById("caps-input").style.display = "none";
    document.getElementById("caps-input").value = "";
    closeOverlay("overlay-detail");
    openOverlay("overlay-qty");
  } else {
    addToCart(curItem, "Completa");
    closeOverlay("overlay-detail");
  }
};

window.onTypeChange = () => {
  const v = document.getElementById("sel-type").value;
  document.getElementById("caps-input").style.display = v === "caps" ? "block" : "none";
};

window.confirmAdd = () => {
  const s   = document.getElementById("sel-season").value;
  const t   = document.getElementById("sel-type").value;
  const cap = document.getElementById("caps-input").value;
  const note = t === "serie" ? "Toda la serie" :
               t === "completa" ? `Temporada ${s} completa` :
               `T${s}: ${cap}`;
  addToCart(curItem, note);
  closeOverlay("overlay-qty");
};

function addToCart(item, note) {
  cart.push({ ...item, _note: note, _price: itemPrice(item) });
  renderCart();
  openCart();
  toast(`✓ ${item.title} añadido al pedido`);
}

function renderCart() {
  document.getElementById("cart-count").textContent = cart.length;
  const total = cart.reduce((s, i) => s + (Number(i._price) || 0), 0);
  document.getElementById("cart-total").textContent = "CUP " + total;
  document.getElementById("order-result").style.display = "none";

  document.getElementById("cart-items").innerHTML = cart.map((item, idx) => {
    const thumb = item.poster
      ? `<img class="c-thumb" src="${item.poster}" alt=""/>`
      : `<div class="c-thumb-ph">🎬</div>`;
    return `
      <div class="c-item">
        ${thumb}
        <div class="c-info">
          <div class="c-title">${esc(item.title)}</div>
          <div class="c-note">${esc(item._note)}</div>
          ${item._price !== "—" ? `<div class="c-price">CUP ${item._price}</div>` : ""}
        </div>
        <button class="c-rm" onclick="removeCart(${idx})">✕</button>
      </div>`;
  }).join("");
}

window.removeCart = (idx) => { cart.splice(idx, 1); renderCart(); };

window.doCheckout = async () => {
  if (!cart.length) { toast("El carrito está vacío"); return; }
  const code = Math.floor(1000 + Math.random() * 9000);
  try {
    await addDoc(collection(db, "pedidos"), {
      cliente:     auth.currentUser.displayName || "Anónimo",
      telefono:    auth.currentUser.email.split("@")[0],
      items:       cart.map(i => ({ titulo: i.title, detalle: i._note, precio: i._price })),
      total:       "CUP " + cart.reduce((s, i) => s + (Number(i._price)||0), 0),
      codigo:      code,
      modo_precio: priceMode,
      fecha:       serverTimestamp()
    });
    document.getElementById("order-code").textContent = "#" + code;
    document.getElementById("order-result").style.display = "block";
    cart = [];
    renderCart();
  } catch (e) { toast("Error al enviar pedido: " + e.message); }
};

function openCart()  { document.getElementById("cart-panel").classList.add("open"); }
window.toggleCart = () => document.getElementById("cart-panel").classList.toggle("open");

/* ════════════════════════════════════════════════════════
   PANEL MODERADOR
════════════════════════════════════════════════════════ */
window.openMod = () => {
  buildPriceGrids();
  buildCatList();
  // sincronizar modo activo
  document.getElementById("mode-files").classList.toggle("active", priceMode === "ficheros");
  document.getElementById("mode-cap").classList.toggle("active",   priceMode === "capacidad");
  document.getElementById("pane-files").style.display = priceMode === "ficheros"  ? "" : "none";
  document.getElementById("pane-cap").style.display   = priceMode === "capacidad" ? "" : "none";
  openOverlay("overlay-mod");
};

function buildPriceGrids() {
  document.getElementById("pg-files").innerHTML = FILE_TYPES.map(t => `
    <div class="price-row">
      <span class="price-lbl">${t.label}</span>
      <div class="price-inp-wrap">
        <input class="price-inp" id="fp-${t.key}" type="number" min="0" value="${filePrices[t.key]||0}"/>
        <span class="price-cur">CUP</span>
      </div>
    </div>`).join("");

  document.getElementById("pg-cap").innerHTML = CAP_TIERS.map(t => `
    <div class="price-row">
      <span class="price-lbl">${t.label}</span>
      <div class="price-inp-wrap">
        <input class="price-inp" id="cp-${t.key}" type="number" min="0" value="${capPrices[t.key]||0}"/>
        <span class="price-cur">CUP</span>
      </div>
    </div>`).join("");
}

function buildCatList() {
  document.getElementById("cat-total").textContent = allItems.length;
  document.getElementById("cat-list").innerHTML = allItems.map(item => {
    const thumb = item.poster
      ? `<img src="${item.poster}" alt=""/>`
      : `<div class="cr-ph">🎬</div>`;
    return `
      <div class="cat-row">
        ${thumb}
        <span class="cr-title">${esc(item.title)}</span>
        <span class="cr-cat">${item.category||"—"}</span>
      </div>`;
  }).join("");
}

window.setMode = (mode) => {
  priceMode = mode;
  document.getElementById("mode-files").classList.toggle("active", mode === "ficheros");
  document.getElementById("mode-cap").classList.toggle("active",   mode === "capacidad");
  document.getElementById("pane-files").style.display = mode === "ficheros"  ? "" : "none";
  document.getElementById("pane-cap").style.display   = mode === "capacidad" ? "" : "none";
};

window.modTab = (btn, tabId) => {
  document.querySelectorAll(".mod-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".mtab-content").forEach(t => t.style.display = "none");
  document.getElementById(tabId).style.display = "";
};

/* ════════════════════════════════════════════════════════
   FILTROS Y BÚSQUEDA
════════════════════════════════════════════════════════ */
window.filterSection = (el, cat) => {
  document.querySelectorAll(".m-item").forEach(b => b.classList.remove("active"));
  if (el) el.classList.add("active");
  document.getElementById("hero-wrap").style.display = cat === "all" ? "" : "none";
  renderCatalog(cat);
};

window.resetView = () => {
  document.querySelectorAll(".m-item").forEach((b, i) => b.classList.toggle("active", i === 0));
  document.getElementById("hero-wrap").style.display = "";
  renderCatalog("all");
};

window.toggleSearch = () => {
  const box = document.getElementById("search-box");
  box.classList.toggle("open");
  if (box.classList.contains("open")) document.getElementById("search-input").focus();
};

window.liveSearch = (q) => {
  const lo = q.toLowerCase().trim();
  // Filtrar en el catálogo visible
  document.querySelectorAll(".sec-block").forEach(sec => {
    let any = false;
    sec.querySelectorAll(".card").forEach(card => {
      const item = allItems.find(i => i.id === card.dataset.id);
      const match = !lo || (item && (item.title||"").toLowerCase().includes(lo));
      card.style.display = match ? "" : "none";
      if (match) any = true;
    });
    sec.style.display = (any || !lo) ? "" : "none";
  });
};

/* ════════════════════════════════════════════════════════
   OVERLAY HELPERS
════════════════════════════════════════════════════════ */
function openOverlay(id)  { document.getElementById(id).classList.add("open"); document.body.style.overflow = "hidden"; }
function closeOverlay_(id){ document.getElementById(id).classList.remove("open"); document.body.style.overflow = ""; }

window.closeOverlay = (id) => closeOverlay_(id);

// Cerrar al hacer clic en el fondo oscuro
document.querySelectorAll(".overlay").forEach(el => {
  el.addEventListener("click", e => { if (e.target === el) { closeOverlay_(el.id); } });
});

// ESC cierra todos
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".overlay.open").forEach(el => closeOverlay_(el.id));
});

/* ════════════════════════════════════════════════════════
   SCROLL NAV
════════════════════════════════════════════════════════ */
window.addEventListener("scroll", () =>
  document.getElementById("navbar").classList.toggle("solid", scrollY > 60));

/* ════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════ */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
                  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function catLabel(c) {
  return {
    Peliculas:"Película", Sagas:"Saga / Colección",
    Series:"Serie", Novelas:"Novela",
    Shows:"Show", PeliculasAnimadas:"Peli. animada",
    Animados:"Animado", Anime:"Anime", Donghua:"Donghua"
  }[c] || c || "";
}

window.toast = (msg) => {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600);
};
