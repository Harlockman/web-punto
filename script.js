import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         onAuthStateChanged, signOut,
         updateProfile }   from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore,
         collection, getDocs, query, orderBy, limit,
         doc, getDoc, setDoc, updateDoc, deleteDoc,
         addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ── CONFIG ──────────────────────────────────────────────── */
const FB = {
  apiKey:            "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
  authDomain:        "mipunto-e32c9.firebaseapp.com",
  projectId:         "mipunto-e32c9",
  storageBucket:     "mipunto-e32c9.firebasestorage.app",
  messagingSenderId: "109212632970",
  appId:             "1:109212632970:web:d57a11a01f5365fad0aa73"
};

/* Email que tiene rol de moderador en Firebase Auth */
const MOD_EMAIL = "user54812901@videotecavip.com";

/* ── CATEGORÍAS ──────────────────────────────────────────── */
const CATS = [
  { key:"Peliculas",         label:"🎬 Películas"           },
  { key:"Sagas",             label:"🎞 Sagas"               },
  { key:"Series",            label:"📺 Series"              },
  { key:"Novelas",           label:"💕 Novelas"             },
  { key:"Shows",             label:"🎤 Shows"               },
  { key:"PeliculasAnimadas", label:"✨ Películas animadas"  },
  { key:"Animados",          label:"🎨 Animados"            },
  { key:"Anime",             label:"⛩ Anime"               },
  { key:"Donghua",           label:"🐉 Donghua"             },
];

const FILE_TYPES = [
  { key:"pelicula",           label:"Película"                              },
  { key:"saga",               label:"Saga (por película)"                   },
  { key:"cap_serie",          label:"Cap. de serie (por capítulo)"          },
  { key:"cap_novela",         label:"Cap. de novela (por capítulo)"         },
  { key:"show",               label:"Show / programa (por emisión)"         },
  { key:"pelicula_animada",   label:"Película animada occidental"           },
  { key:"cap_animado",        label:"Cap. animado/cartoon occidental"       },
  { key:"cap_anime",          label:"Cap. anime japonés (por capítulo)"     },
  { key:"pelicula_anime",     label:"Película anime japonesa"               },
  { key:"cap_donghua",        label:"Cap. donghua chino (por capítulo)"     },
  { key:"pelicula_donghua",   label:"Película donghua china"                },
];

const CAP_TIERS = [
  {key:"1gb",label:"1 GB"},{key:"2gb",label:"2 GB"},{key:"4gb",label:"4 GB"},
  {key:"8gb",label:"8 GB"},{key:"16gb",label:"16 GB"},{key:"32gb",label:"32 GB"},
  {key:"64gb",label:"64 GB"},{key:"128gb",label:"128 GB"},
];

const CAT_TO_FILE = {
  Peliculas:"pelicula", Sagas:"saga", Series:"cap_serie",
  Novelas:"cap_novela", Shows:"show", PeliculasAnimadas:"pelicula_animada",
  Animados:"cap_animado", Anime:"cap_anime", Donghua:"cap_donghua",
};

const DEFAULT_FILE = {
  pelicula:200, saga:200, cap_serie:50, cap_novela:40, show:80,
  pelicula_animada:150, cap_animado:50, cap_anime:50, cap_donghua:50
};
const DEFAULT_CAP = {
  "1gb":50,"2gb":90,"4gb":160,"8gb":280,
  "16gb":500,"32gb":900,"64gb":1600,"128gb":2800
};

/* ── ESTADO ──────────────────────────────────────────────── */
let allItems   = [];
let cart       = [];
let curItem    = null;
let isMod      = false;
let priceMode  = "ficheros";
let filePrices = {...DEFAULT_FILE};
let capPrices  = {...DEFAULT_CAP};
let isLoginMode= true;
let _trailerKey= null;
let _orderCode = null;      // código de pedido generado para esta sesión
let _orderDocId= null;      // ID del documento en Firestore
let _orderUnsub= null;      // listener de tiempo real del pedido

/* ── FIREBASE ────────────────────────────────────────────── */
const fbApp = initializeApp(FB);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

/* ── AUTH ────────────────────────────────────────────────── */
document.getElementById("btnAuth").onclick = async () => {
  const ph  = String(document.getElementById("phone").value).trim();
  const ps  = document.getElementById("pass").value;
  const nm  = document.getElementById("reg-name").value.trim();
  const err = document.getElementById("auth-err");
  err.textContent = "";
  if (ph.length < 7) { err.textContent = "Número inválido (mínimo 7 dígitos)"; return; }
  const mail = `user${ph}@videotecavip.com`;
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, mail, ps);
    } else {
      if (!nm) { err.textContent = "Escribe tu nombre para registrarte"; return; }
      const r = await createUserWithEmailAndPassword(auth, mail, ps);
      await updateProfile(r.user, { displayName: nm });
      location.reload();
    }
  } catch (e) {
    const msg = e.code === "auth/wrong-password"      ? "Contraseña incorrecta."
               :e.code === "auth/user-not-found"      ? "Usuario no registrado."
               :e.code === "auth/email-already-in-use"? "Ya existe una cuenta con ese número."
               :e.code === "auth/weak-password"       ? "Contraseña demasiado débil (min 6 chars)."
               :"Error al acceder. Verifica tus datos.";
    err.textContent = msg;
  }
};

document.getElementById("toggleAuth").onclick = () => {
  isLoginMode = !isLoginMode;
  document.getElementById("reg-name").style.display = isLoginMode ? "none" : "block";
  document.getElementById("btnAuth").textContent     = isLoginMode ? "INICIAR SESIÓN" : "CREAR CUENTA";
  document.getElementById("auth-msg").textContent    = isLoginMode ? "Ingresa tus datos para entrar" : "Regístrate como nuevo usuario";
  document.getElementById("toggleAuth").innerHTML    = isLoginMode
    ? "¿No tienes cuenta? <b>Regístrate aquí</b>"
    : "¿Ya tienes cuenta? <b>Inicia sesión</b>";
};

onAuthStateChanged(auth, async u => {
  if (u) {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("uname").textContent = u.displayName || "Usuario";
    isMod = (u.email === MOD_EMAIL);
    if (isMod) document.getElementById("mod-btn").classList.remove("mod-hidden");
    await loadPrices();
    loadCatalog();
  } else {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app").style.display = "none";
  }
});

window.doLogout = () => signOut(auth).then(() => location.reload());

/* ── PRECIOS ─────────────────────────────────────────────── */
async function loadPrices() {
  try {
    const snap = await getDoc(doc(db, "config", "precios"));
    if (snap.exists()) {
      const d = snap.data();
      if (d.modo)      priceMode  = d.modo;
      if (d.ficheros)  filePrices = {...DEFAULT_FILE, ...d.ficheros};
      if (d.capacidad) capPrices  = {...DEFAULT_CAP,  ...d.capacidad};
    }
  } catch(_) {}
}

window.savePrices = async () => {
  FILE_TYPES.forEach(c => {
    const el = document.getElementById(`fp-${c.key}`);
    if (el) filePrices[c.key] = Number(el.value) || 0;
  });
  CAP_TIERS.forEach(c => {
    const el = document.getElementById(`cp-${c.key}`);
    if (el) capPrices[c.key] = Number(el.value) || 0;
  });
  try {
    await setDoc(doc(db,"config","precios"),{
      modo:priceMode, ficheros:filePrices, capacidad:capPrices, updated:serverTimestamp()
    });
    toast("✓ Precios guardados");
  } catch(e) { toast("Error: " + e.message); }
};

function itemPrice(item) {
  if (priceMode === "capacidad") return "—";
  return filePrices[CAT_TO_FILE[item.category] || "pelicula"] ?? 0;
}

/* ── CATÁLOGO ────────────────────────────────────────────── */
async function loadCatalog() {
  document.getElementById("sections").innerHTML =
    `<div style="text-align:center;padding:80px 0;color:#666">
       <div style="font-size:36px;margin-bottom:14px">⏳</div>Cargando catálogo…</div>`;
  try {
    const snap = await getDocs(collection(db, "catalogo"));
    allItems = snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i => i.active !== false);
    renderHero();
    renderSections("all");
    renderCart();
  } catch(e) {
    document.getElementById("sections").innerHTML =
      `<p style="color:#f88;padding:40px 4%">Error al cargar catálogo: ${e.message}</p>`;
  }
}

/* ── HERO ────────────────────────────────────────────────── */
function renderHero() {
  const slides = allItems.filter(i => i.nuevo || i.destacado).slice(0,7);
  if (!slides.length) { document.getElementById("hero").style.minHeight="0"; return; }
  document.getElementById("hero").innerHTML = slides.map((item,idx) => `
    <div class="hslide ${idx===0?"active":""}">
      <div class="hbg" style="background-image:url('${esc(item.backdrop||item.poster||"")}')"></div>
      <div class="hfade"></div>
      <div class="hcontent">
        <div class="hbadge ${item.en_emision?"on-air-badge":""}">
          ${item.en_emision?"🔴 EN EMISIÓN":"🔴 "+catLabel(item.category)}
        </div>
        <div class="htitle">${esc(item.title||"")}</div>
        <div class="hmeta">
          ${item.rating?`<span class="hscore">★ ${item.rating}</span>`:""}
          ${item.year?`<span>${item.year}</span>`:""}
          ${item.genre?`<span>·</span><span>${esc(item.genre.split(",")[0])}</span>`:""}
        </div>
        <div class="hdesc">${esc((item.plot||item.synopsis||"").substring(0,180))}</div>
        <div class="hbtns">
          <button class="btn-play" onclick="openDetail('${item.id}')">▶ Ver info</button>
          <button class="btn-more" onclick="startAdd('${item.id}')">🛒 Añadir</button>
        </div>
      </div>
    </div>`).join("");
  let cur=0;
  clearInterval(window._heroT);
  window._heroT = setInterval(() => {
    const sl = document.querySelectorAll(".hslide");
    if (!sl.length) return;
    sl[cur].classList.remove("active");
    cur = (cur+1)%sl.length;
    sl[cur].classList.add("active");
  }, 7000);
}

/* ── SECCIONES ───────────────────────────────────────────── */
function renderSections(filter) {
  const wrap = document.getElementById("sections");
  wrap.innerHTML = "";

  // Sección "Recientes" — NO incluir películas que pertenecen a una saga
  // (aparecerán dentro de la saga cuando el usuario pinche)
  if (filter === "all") {
    const news = allItems.filter(i => i.nuevo && !(i.category === "Peliculas" && i.saga));
    if (news.length) wrap.appendChild(buildSection("🔥 Recién llegados", news, "_nuevo"));
  }

  const cats = filter === "all" ? CATS : CATS.filter(c => c.key === filter);
  cats.forEach(c => {
    let items;
    if (c.key === "Peliculas") {
      // Solo películas que NO pertenecen a ninguna saga
      items = allItems.filter(i => i.category === "Peliculas" && !i.saga);
    } else if (c.key === "Sagas") {
      // Solo los documentos de tipo Saga (la colección), no las películas individuales
      items = allItems.filter(i => i.category === "Sagas");
    } else {
      items = allItems.filter(i => i.category === c.key);
    }
    if (!items.length) return;
    wrap.appendChild(buildSection(c.label, items, c.key));
  });

  if (!wrap.children.length)
    wrap.innerHTML = `<p style="color:#666;padding:40px 4%;text-align:center">Sin contenido en esta categoría.</p>`;
}

function buildSection(title, items, secId) {
  const uid = "row-" + secId.replace(/[^a-z0-9]/gi,"_") + "_" + Date.now();
  const div = document.createElement("div");
  div.className = "secblock"; div.dataset.sec = secId;

  // Cabecera con título y flechas
  div.innerHTML = `
    <div class="sec-header">
      <div class="sectitle">${title}</div>
      <div class="sec-arrows">
        <button class="sec-arrow" onclick="scrollRow('${uid}',-1)" aria-label="Anterior">&#8249;</button>
        <button class="sec-arrow" onclick="scrollRow('${uid}', 1)" aria-label="Siguiente">&#8250;</button>
      </div>
    </div>`;

  const row = document.createElement("div");
  row.className = "rowscroll"; row.id = uid;
  items.forEach(item => row.appendChild(makeCard(item)));
  div.appendChild(row);
  return div;
}

window.scrollRow = (rowId, dir) => {
  const row = document.getElementById(rowId);
  if (!row) return;
  // Desplaza ~3 tarjetas (cada una ~160px aprox con gap)
  const step = row.clientWidth * 0.75;
  row.scrollBy({ left: dir * step, behavior: "smooth" });
};

function makeCard(item) {
  const div = document.createElement("div");
  div.className = "card"; div.dataset.id = item.id;
  const img = item.poster
    ? `<img class="card-img" src="${esc(item.poster)}" alt="${esc(item.title||"")}" loading="lazy"/>`
    : `<div class="card-ph">🎬</div>`;
  const price = itemPrice(item);
  // Etiquetas: EN EMISIÓN tiene prioridad sobre NUEVO
  let badge = "";
  if (item.en_emision) badge = '<span class="on-air-tag">EN EMISIÓN</span>';
  else if (item.nuevo)  badge = '<span class="new-tag">NUEVO</span>';

  div.innerHTML = `
    ${img}
    ${badge}
    <button class="qadd" onclick="event.stopPropagation();quickAdd('${item.id}')" title="Añadir al carrito">+</button>
    <div class="card-hov">
      <div class="card-hov-name">${esc(item.title||"")}</div>
      <div class="card-hov-meta">★ ${item.rating||"N/A"}${price!=="—"?" · CUP "+price:""}</div>
    </div>
    <div class="card-lbl">${esc(item.title||"")}</div>`;
  div.onclick = () => openDetail(item.id);
  return div;
}

/* quickAdd: desde la tarjeta — añade directo sin picker para peliculas/shows,
   abre picker para episódicos/sagas */
window.quickAdd = (id) => {
  const item = allItems.find(x => x.id === id);
  if (!item) return;
  const cat = item.category;
  if (cat === "Sagas") { curItem = item; openSagaPicker(item); return; }
  if (["Series","Novelas","Anime","Donghua","Animados"].includes(cat)) {
    curItem = item; openEpPicker(item); return;
  }
  // Películas, shows, peli animada → directo al carrito
  addToCart(item, catLabel(cat));
};

/* ── DETALLE MODAL ───────────────────────────────────────── */
window.openDetail = async (id) => {
  curItem = allItems.find(x => x.id === id);
  if (!curItem) return;
  _trailerKey = null;

  // Imagen inicial
  const vbox = document.getElementById("vbox");
  if (curItem.backdrop || curItem.poster) {
    vbox.innerHTML = `<img src="${esc(curItem.backdrop||curItem.poster)}" style="width:100%;height:100%;object-fit:cover"/>`;
  } else {
    vbox.innerHTML = `<div class="vbox-ph">🎬</div>`;
  }

  const price = itemPrice(curItem);
  const isSeries = ["Series","Novelas","Anime","Donghua","Animados"].includes(curItem.category);

  document.getElementById("d-title").textContent = curItem.title || "";
  document.getElementById("d-plot").textContent  = curItem.plot || curItem.synopsis || "Sin descripción disponible.";

  document.getElementById("d-meta").innerHTML = [
    curItem.rating    ? `<span class="dscore">★ ${curItem.rating}</span>` : "",
    curItem.year      ? `<span>${curItem.year}</span>` : "",
    curItem.genre     ? `<span class="dbadge">${esc(curItem.genre.split(",")[0])}</span>` : "",
    isSeries && curItem.seasons ? `<span class="dbadge">${curItem.seasons} temp.</span>` : "",
    curItem.en_emision? `<span class="dbadge on-air-badge-sm">🔴 EN EMISIÓN</span>` : "",
    `<span class="dbadge">${catLabel(curItem.category)}</span>`,
  ].filter(Boolean).join("");

  document.getElementById("d-extra").innerHTML = [
    curItem.director ? `<div><b>Dirección:</b> ${esc(curItem.director)}</div>` : "",
    curItem.actors   ? `<div><b>Reparto:</b> ${esc(curItem.actors)}</div>` : "",
    curItem.saga     ? `<div><b>Saga:</b> ${esc(curItem.saga)}</div>` : "",
  ].filter(Boolean).join("");

  document.getElementById("d-info").innerHTML = `
    ${curItem.genre    ? `<div><b>Géneros:</b> ${esc(curItem.genre)}</div>` : ""}
    ${curItem.year     ? `<div><b>Año:</b> ${curItem.year}</div>` : ""}
    ${curItem.director ? `<div><b>Director:</b> ${esc(curItem.director)}</div>` : ""}
    ${curItem.actors   ? `<div><b>Reparto:</b> ${esc(curItem.actors)}</div>` : ""}
    <div class="price-block">
      <div class="price-lbl">Precio</div>
      <div class="price-val">${price !== "—" ? "CUP " + price : "Consultar"}</div>
    </div>`;

  document.getElementById("btn-trailer").onclick = loadTrailer;
  document.getElementById("btn-add").onclick = () => { closeDetail(); startAdd(curItem.id); };

  openOv("ov-detail");
  fetchTrailer(curItem); // background
};

async function fetchTrailer(item) {
  _trailerKey = item.trailer || null;
  if (_trailerKey) return;
  const TMDB_KEY = "7307350d0b166058d1b926aad793eeec";
  const type = ["Series","Novelas","Anime","Donghua","Shows"].includes(item.category) ? "tv" : "movie";
  let id = item.tmdb_id;
  try {
    if (!id) {
      const r = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=es-MX`);
      const d = await r.json();
      if (d.results?.length) id = d.results[0].id;
    }
    if (!id) return;
    for (const lang of ["es-MX",""]) {
      const vd = await (await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${TMDB_KEY}${lang?"&language="+lang:""}`)).json();
      const vids = vd.results || [];
      const t = vids.find(v=>v.type==="Trailer"&&v.site==="YouTube") || vids.find(v=>v.site==="YouTube");
      if (t) { _trailerKey = t.key; return; }
    }
  } catch(_) {}
}

function loadTrailer() {
  const vbox = document.getElementById("vbox");
  const origin = encodeURIComponent(window.location.origin);
  if (_trailerKey) {
    vbox.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trailerKey}?autoplay=1&rel=0&origin=${origin}" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  } else {
    toast("Cargando tráiler…");
    setTimeout(() => {
      if (_trailerKey) {
        vbox.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trailerKey}?autoplay=1&rel=0&origin=${origin}" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
      } else if (curItem) {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(curItem.title+" trailer")}`, "_blank");
      }
    }, 1500);
  }
}

window.closeDetail = () => {
  closeOv("ov-detail");
  document.getElementById("vbox").innerHTML = "";
};

/* ── AÑADIR AL PEDIDO ────────────────────────────────────── */
window.startAdd = (id) => {
  curItem = allItems.find(x => x.id === id);
  if (!curItem) return;

  const cat = curItem.category;

  // ── SAGAS: mostrar las películas que componen esa saga ──
  if (cat === "Sagas") {
    openSagaPicker(curItem);
    return;
  }

  // ── EPISÓDICOS: series, novelas, anime, donghua, animados ──
  const isEpisodic = ["Series","Novelas","Anime","Donghua","Animados"].includes(cat);
  if (isEpisodic) {
    openEpPicker(curItem);
    return;
  }

  // ── Todo lo demás (películas, shows, etc.) va directo ──
  addToCart(curItem, catLabel(cat));
};

/* ── SELECTOR DE SAGA ─────────────────────────────────────── */
function openSagaPicker(sagaItem) {
  // Buscar todas las películas de esa saga en el catálogo
  const sagaName = sagaItem.title || sagaItem.saga || "";
  // Coinciden: películas cuyo campo "saga" coincide con el título de la saga,
  // o cuyo título contiene el nombre de la saga
  const parts = allItems.filter(i =>
    i.category === "Peliculas" &&
    (
      (i.saga && i.saga.toLowerCase().includes(sagaName.toLowerCase().replace(" collection","").replace(" saga","").trim())) ||
      (sagaItem.saga && i.saga && i.saga === sagaItem.saga)
    )
  ).sort((a,b) => (a.year||"") < (b.year||"") ? -1 : 1);

  const box = document.getElementById("saga-parts");
  if (!parts.length) {
    // Sin partes detectadas → ofrecer añadir la saga completa
    box.innerHTML = `
      <p style="color:#888;font-size:13px;margin-bottom:14px">
        No se encontraron partes individuales. Puedes añadir la saga completa.
      </p>
      <button class="btn-red" onclick="addToCart(curItem,'Saga completa');closeOv('ov-saga')">
        Añadir saga completa
      </button>`;
  } else {
    box.innerHTML = parts.map((p,idx) => `
      <div class="saga-part" onclick="sagaPartAdd('${p.id}')">
        <div class="saga-part-num">${idx+1}</div>
        ${p.poster
          ? `<img class="saga-part-img" src="${esc(p.poster)}" alt=""/>`
          : `<div class="saga-part-img saga-part-ph">🎬</div>`}
        <div class="saga-part-info">
          <div class="saga-part-title">${esc(p.title)}</div>
          <div class="saga-part-meta">${p.year||""} ${p.rating?"· ★"+p.rating:""}</div>
        </div>
        <div class="saga-part-price">${itemPrice(p)!=="—"?"CUP "+itemPrice(p):""}</div>
        <button class="saga-part-add">+</button>
      </div>`).join("") +
      `<div style="margin-top:14px">
        <button class="btn-red" onclick="sagaAddAll(${JSON.stringify(parts.map(p=>p.id))})">
          ➕ Añadir toda la saga (${parts.length} películas)
        </button>
      </div>`;
  }

  document.getElementById("saga-title").textContent = sagaName;
  openOv("ov-saga");
}

window.sagaPartAdd = (id) => {
  const p = allItems.find(i => i.id === id);
  if (p) { addToCart(p, "Película individual"); closeOv("ov-saga"); }
};

window.sagaAddAll = (ids) => {
  ids.forEach(id => {
    const p = allItems.find(i => i.id === id);
    if (p) addToCartSilent(p, "Parte de saga");
  });
  renderCart();
  document.getElementById("cart-panel").classList.add("open");
  toast(`✓ Saga añadida (${ids.length} películas)`);
  closeOv("ov-saga");
};

/* ── SELECTOR DE EPISODIOS ────────────────────────────────── */
function openEpPicker(item) {
  const seasons = Number(item.seasons) || 1;
  document.getElementById("ep-title").textContent = item.title;

  // Poblar selector de temporadas
  const selS = document.getElementById("ep-season");
  selS.innerHTML = "";
  for (let i = 1; i <= seasons; i++)
    selS.innerHTML += `<option value="${i}">Temporada ${i}</option>`;

  // Resetear tipo y capítulos
  document.getElementById("ep-type").value = "completa";
  document.getElementById("ep-custom").style.display = "none";
  document.getElementById("ep-custom").value = "";

  // Actualizar vista de capítulos para la temporada 1
  updateEpView(item, 1, seasons);

  // Cuando cambia temporada → actualizar vista
  selS.onchange = () => updateEpView(item, Number(selS.value), seasons);

  openOv("ov-ep");
}

function updateEpView(item, seasonNum, totalSeasons) {
  // Intentar obtener episodios de TMDB en background
  fetchEpisodes(item, seasonNum).then(eps => {
    renderEpisodeList(eps, seasonNum);
  });
}

async function fetchEpisodes(item, season) {
  const TMDB_KEY = "7307350d0b166058d1b926aad793eeec";
  const tmdbId   = item.tmdb_id;
  if (!tmdbId) return [];
  try {
    const type = "tv";
    const r  = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/season/${season}?api_key=${TMDB_KEY}&language=es-ES`);
    const d  = await r.json();
    return (d.episodes || []).map(e => ({
      num:   e.episode_number,
      name:  e.name,
      still: e.still_path ? `https://image.tmdb.org/t/p/w185${e.still_path}` : "",
      air:   (e.air_date||"").substring(0,4),
    }));
  } catch(_) { return []; }
}

function renderEpisodeList(eps, seasonNum) {
  const container = document.getElementById("ep-list");
  if (!container) return;
  if (!eps.length) {
    container.innerHTML = `<p style="color:#666;font-size:12px;padding:6px 0">No hay información de episodios disponible. Usa el campo de texto abajo.</p>`;
    return;
  }
  container.innerHTML = eps.map(e => `
    <label class="ep-row">
      <input type="checkbox" class="ep-check" value="${e.num}" onchange="updateEpSelection()"/>
      <div class="ep-info">
        <span class="ep-num">E${String(e.num).padStart(2,"0")}</span>
        <span class="ep-name">${esc(e.name||"Episodio "+e.num)}</span>
        ${e.air ? `<span class="ep-year">${e.air}</span>` : ""}
      </div>
    </label>`).join("");
}

window.updateEpSelection = () => {
  const checks = [...document.querySelectorAll(".ep-check:checked")].map(c => c.value);
  const manual = document.getElementById("ep-custom");
  if (checks.length > 0) {
    manual.value = "Caps " + checks.join(", ");
    document.getElementById("ep-type").value = "custom";
    manual.style.display = "block";
  }
};

window.toggleCustom = () => {
  const v = document.getElementById("ep-type").value;
  document.getElementById("ep-custom").style.display = (v === "custom") ? "block" : "none";
  if (v !== "custom") {
    // Desmarcar todos los checkboxes de episodios
    document.querySelectorAll(".ep-check").forEach(c => c.checked = false);
  }
};

document.getElementById("ep-confirm").onclick = () => {
  const s = document.getElementById("ep-season").value;
  const t = document.getElementById("ep-type").value;
  const c = document.getElementById("ep-custom").value;
  const note = t==="serie_completa" ? "Serie completa"
              :t==="completa"       ? `Temporada ${s} completa`
              :c                    ? `T${s}: ${c}`
              :                       `Temporada ${s}`;

  // Calcular cantidad de capítulos para el precio
  let qty = 1;
  if (t === "serie_completa") {
    // Toda la serie: contar todos los capítulos conocidos
    qty = Number(curItem.seasons || 1) * 13; // estimado si no hay dato exacto
    // Si hay episodios cargados en el DOM, contar los checkboxes
    const allEps = document.querySelectorAll(".ep-check");
    if (allEps.length) qty = allEps.length * Number(curItem.seasons || 1);
  } else if (t === "completa") {
    // Temporada completa: contar episodios de esa temporada
    const allEps = document.querySelectorAll(".ep-check");
    qty = allEps.length || 13; // default 13 si TMDB no cargó
  } else if (c) {
    // Capítulos específicos: contar cuántos son
    const checked = document.querySelectorAll(".ep-check:checked");
    if (checked.length) {
      qty = checked.length;
    } else {
      // Parsear el texto manualmente "1, 2, 5 al 10"
      const rangeMatch = c.match(/(\d+)\s+al\s+(\d+)/i);
      if (rangeMatch) {
        qty = Math.max(1, parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1);
      } else {
        qty = (c.match(/\d+/g) || []).length || 1;
      }
    }
  }

  addToCart(curItem, note, qty);
  closeOv("ov-ep");
};

window.closeEp = () => closeOv("ov-ep");

function addToCart(item, note, qty) {
  const unitPrice = (priceMode === "capacidad") ? "—" : (Number(itemPrice(item)) || 0);
  const numQty    = qty || 1;
  const lineTotal = unitPrice === "—" ? "—" : unitPrice * numQty;
  cart.push({...item, _note:note, _price:lineTotal, _unitPrice:unitPrice, _qty:numQty});
  syncCartToFirebase();
  document.getElementById("cart-panel").classList.add("open");
  toast(`✓ ${item.title} añadido`);
}

function addToCartSilent(item, note, qty) {
  const unitPrice = (priceMode === "capacidad") ? "—" : (Number(itemPrice(item)) || 0);
  const numQty    = qty || 1;
  const lineTotal = unitPrice === "—" ? "—" : unitPrice * numQty;
  cart.push({...item, _note:note, _price:lineTotal, _unitPrice:unitPrice, _qty:numQty});
}

/* ── CARRITO ─────────────────────────────────────────────── */
function renderCart() {
  const count = document.getElementById("cart-count");
  const items = document.getElementById("cart-items");
  const total = document.getElementById("cart-total");

  count.textContent = cart.length;
  count.style.display = cart.length ? "flex" : "none";

  const codeEl = document.getElementById("cart-code-display");
  if (codeEl) {
    if (_orderCode) {
      codeEl.textContent = "#" + _orderCode;
      codeEl.style.color = "var(--red)";
    } else {
      codeEl.textContent = cart.length ? "Generando…" : "—";
      codeEl.style.color = cart.length ? "var(--muted)" : "#333";
    }
  }

  if (!cart.length) {
    items.innerHTML = `<div style="text-align:center;padding:30px 0;color:#555;font-size:13px">Tu pedido está vacío</div>`;
    total.textContent = "CUP 0";
    const wEl = document.getElementById("cart-weight");
    if (wEl) wEl.textContent = "";
    return;
  }
  items.innerHTML = "";
  let sum = 0, totalBytes = 0;
  cart.forEach((item, i) => {
    const p = Number(item._price) || 0;
    sum += p;
    const bytes = Number(item._bytes) || 0;
    totalBytes += bytes;
    const sizeStr = bytes ? fmtSize(bytes) : "";
    let priceDetail = "";
    if (item._price !== "—" && item._unitPrice && item._qty > 1) {
      priceDetail = `<span class="ci-price">${item._qty} × CUP ${item._unitPrice} = <b>CUP ${item._price}</b></span>`;
    } else if (item._price !== "—" && item._price) {
      priceDetail = `<span class="ci-price">CUP ${item._price}</span>`;
    }
    const div = document.createElement("div");
    div.className = "ci";
    div.innerHTML = `
      ${item.poster ? `<img class="ci-img" src="${esc(item.poster)}" alt=""/>` : `<div class="ci-ph">🎬</div>`}
      <div class="ci-info">
        <div class="ci-name">${esc(item.title)}</div>
        <div class="ci-note">${esc(item._note||"")}</div>
        <div class="ci-bottom">
          ${priceDetail}
          ${sizeStr?`<span class="ci-size">${sizeStr}</span>`:""}
        </div>
      </div>
      <button class="ci-rm" onclick="removeFromCart(${i})">✕</button>`;
    items.appendChild(div);
  });
  total.textContent = "CUP " + sum;
  const wEl = document.getElementById("cart-weight");
  if (wEl) wEl.textContent = totalBytes ? "Peso total: " + fmtSize(totalBytes) : "";
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes >= 1e12) return (bytes/1e12).toFixed(2) + " TB";
  if (bytes >= 1e9)  return (bytes/1e9).toFixed(2)  + " GB";
  if (bytes >= 1e6)  return (bytes/1e6).toFixed(1)  + " MB";
  return Math.round(bytes/1e3) + " KB";
}

window.removeFromCart = (i) => { cart.splice(i,1); syncCartToFirebase(); };

async function syncCartToFirebase() {
  const u = auth.currentUser;
  if (!u) { renderCart(); renderCartAddress(); return; }

  if (!cart.length) {
    if (_orderDocId) {
      try { await deleteDoc(doc(db,"pedidos",_orderDocId)); } catch(_){}
    }
    _orderCode = null; _orderDocId = null;
    if (_orderUnsub) { _orderUnsub(); _orderUnsub = null; }
    renderCart(); renderCartAddress(); return;
  }

  const total      = cart.reduce((s,c) => s + (Number(c._price)||0), 0);
  const totalBytes = cart.reduce((s,c) => s + (Number(c._bytes)||0), 0);
  const rawPhone   = u.email.replace("user","").replace("@videotecavip.com","");
  const phone      = rawPhone.startsWith("+") ? rawPhone : "+53"+rawPhone;

  const orderData = {
    cliente:     u.displayName || "Anónimo",
    telefono:    phone,
    items:       cart.map(c=>({ titulo:c.title, detalle:c._note, precio:c._price, qty:c._qty||1, bytes:c._bytes||0 })),
    total, peso_total: totalBytes, modo_precio: priceMode,
    status: "pendiente", fecha: serverTimestamp(),
  };

  try {
    if (_orderDocId) {
      await updateDoc(doc(db,"pedidos",_orderDocId), orderData);
    } else {
      _orderCode  = String(Math.floor(1000 + Math.random()*9000));
      const ref   = await addDoc(collection(db,"pedidos"), { ...orderData, codigo: Number(_orderCode) });
      _orderDocId = ref.id;
      if (_orderUnsub) _orderUnsub();
      _orderUnsub = onSnapshot(doc(db,"pedidos",_orderDocId), snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        const el = document.getElementById("cart-code-display");
        if (el && d.status && d.status !== "pendiente")
          el.textContent = `#${_orderCode} · ${d.status.toUpperCase()}`;
      });
    }
  } catch(e) { toast("Sync error: " + e.message); }

  renderCart();
  renderCartAddress();
}

function renderCartAddress() {
  const el = document.getElementById("cart-address");
  if (!el) return;
  getDoc(doc(db,"config","negocio")).then(snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    el.innerHTML = (d.direccion||d.telefono) ? `<div class="cart-addr-box">
      <div class="cart-addr-lbl">📍 Dirección de recogida</div>
      ${d.direccion?`<div class="cart-addr-val">${esc(d.direccion)}</div>`:""}
      ${d.telefono ?`<div class="cart-addr-tel">📞 ${esc(d.telefono)}</div>`:""}
    </div>` : "";
  }).catch(()=>{});
}

window.toggleCart = () => {
  const panel = document.getElementById("cart-panel");
  panel.classList.toggle("open");
  if (panel.classList.contains("open")) renderCartAddress();
};

/* ── MODERADOR ───────────────────────────────────────────── */
window.openMod = async () => {
  buildPriceGrids();
  buildCatalogList();
  await loadOrders();
  await loadNegocioConfig();
  syncModeButtons();
  openOv("ov-mod");
};
window.closeMod = () => closeOv("ov-mod");

async function loadNegocioConfig() {
  try {
    const snap = await getDoc(doc(db,"config","negocio"));
    if (snap.exists()) {
      const d = snap.data();
      const el = document.getElementById("neg-dir");
      const et = document.getElementById("neg-tel");
      const en = document.getElementById("neg-nombre");
      if (el && d.direccion) el.value = d.direccion;
      if (et && d.telefono)  et.value = d.telefono;
      if (en && d.nombre)    en.value = d.nombre;
    }
  } catch(_) {}
}

window.saveNegocio = async () => {
  const dir    = document.getElementById("neg-dir")?.value || "";
  const tel    = document.getElementById("neg-tel")?.value || "";
  const nombre = document.getElementById("neg-nombre")?.value || "";
  try {
    await setDoc(doc(db,"config","negocio"), {
      direccion: dir, telefono: tel, nombre,
      updated: serverTimestamp()
    });
    toast("✓ Datos del negocio guardados");
  } catch(e) { toast("Error: " + e.message); }
};

function buildPriceGrids() {
  document.getElementById("pgrid-f").innerHTML = FILE_TYPES.map(c=>`
    <div class="prow">
      <span class="prow-lbl">${c.label}</span>
      <div class="pinput-wrap">
        <input class="pinput" id="fp-${c.key}" type="number" min="0" value="${filePrices[c.key]||0}"/>
        <span class="pcur">CUP</span>
      </div>
    </div>`).join("");

  document.getElementById("pgrid-c").innerHTML = CAP_TIERS.map(c=>`
    <div class="prow">
      <span class="prow-lbl">${c.label}</span>
      <div class="pinput-wrap">
        <input class="pinput" id="cp-${c.key}" type="number" min="0" value="${capPrices[c.key]||0}"/>
        <span class="pcur">CUP</span>
      </div>
    </div>`).join("");
}

function buildCatalogList() {
  document.getElementById("cat-total").textContent = allItems.length;
  document.getElementById("cat-list").innerHTML = allItems.map(item=>`
    <div class="crow">
      ${item.poster?`<img class="crow-img" src="${esc(item.poster)}" alt=""/>`:`<div class="crow-ph">🎬</div>`}
      <span class="crow-ttl">${esc(item.title||"")}</span>
      <span class="crow-cat">${esc(item.category||"")}</span>
      <span class="crow-price">${itemPrice(item)!=="—"?"CUP "+itemPrice(item):""}</span>
    </div>`).join("");
}

async function loadOrders() {
  const el = document.getElementById("orders-list");
  el.innerHTML = `<p style="color:#555;font-size:13px;padding:10px 0">Cargando pedidos…</p>`;
  try {
    const snap = await getDocs(query(collection(db,"pedidos"), orderBy("fecha","desc"), limit(30)));
    if (snap.empty) { el.innerHTML=`<p style="color:#555;font-size:13px">Sin pedidos aún.</p>`; return; }
    el.innerHTML = snap.docs.map(d=>{
      const o = d.data();
      const items_txt = (o.items||[]).map(i=>`${i.titulo} (${i.detalle})`).join(", ");
      return `<div class="orow">
        <div class="orow-hdr">
          <span class="orow-code">#${o.codigo}</span>
          <span class="orow-total">CUP ${o.total||"—"}</span>
        </div>
        <div class="orow-items">📞 ${esc(o.telefono||o.cliente||"")} · ${items_txt}</div>
      </div>`;
    }).join("");
  } catch(e) { el.innerHTML=`<p style="color:#f88;font-size:13px">Error: ${e.message}</p>`; }
}

window.setPriceMode = (mode) => {
  priceMode = mode;
  syncModeButtons();
};
function syncModeButtons() {
  document.getElementById("mbtn-f").classList.toggle("active", priceMode==="ficheros");
  document.getElementById("mbtn-c").classList.toggle("active", priceMode==="capacidad");
  document.getElementById("panel-f").style.display = priceMode==="ficheros"  ? "" : "none";
  document.getElementById("panel-c").style.display = priceMode==="capacidad" ? "" : "none";
}

window.modTab = (btn, id) => {
  document.querySelectorAll(".mtab").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".mtab-body").forEach(t=>t.style.display="none");
  document.getElementById(id).style.display="";
};

/* ── FILTRO / BÚSQUEDA ───────────────────────────────────── */
window.navFilter = (btn, cat) => {
  document.querySelectorAll(".ncat").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("hero").style.display = cat==="all" ? "" : "none";
  renderSections(cat);
};

window.showAll = () => {
  document.querySelectorAll(".ncat").forEach((b,i)=>b.classList.toggle("active",i===0));
  document.getElementById("hero").style.display = "";
  renderSections("all");
};

/* ── MENÚ MÓVIL ──────────────────────────────────────────── */
window.toggleMobMenu = () => {
  const panel   = document.getElementById("mob-menu-panel");
  const overlay = document.getElementById("mob-menu-overlay");
  const isOpen  = panel.classList.contains("open");
  panel.classList.toggle("open", !isOpen);
  overlay.classList.toggle("open", !isOpen);
  document.body.style.overflow = isOpen ? "" : "hidden";
};

window.closeMobMenu = () => {
  document.getElementById("mob-menu-panel").classList.remove("open");
  document.getElementById("mob-menu-overlay").classList.remove("open");
  document.body.style.overflow = "";
};

window.mobFilter = (btn, cat) => {
  // Sincronizar con los botones del navbar desktop
  document.querySelectorAll(".ncat").forEach((b,i) => {
    const cats = ["all","Peliculas","Sagas","Series","Novelas","Shows","PeliculasAnimadas","Animados","Anime","Donghua"];
    b.classList.toggle("active", cats[i] === cat);
  });
  document.querySelectorAll(".mob-cat").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("hero").style.display = cat==="all" ? "" : "none";
  renderSections(cat);
  closeMobMenu();
};

window.toggleSearch = () => {
  const w = document.getElementById("search-wrap");
  w.classList.toggle("open");
  if (w.classList.contains("open")) document.getElementById("search-input").focus();
};

window.doSearch = (q) => {
  const lo = q.toLowerCase().trim();
  if (!lo) { renderSections("all"); return; }
  const hits = allItems.filter(i=>(i.title||"").toLowerCase().includes(lo) || (i.genre||"").toLowerCase().includes(lo));
  const wrap = document.getElementById("sections");
  wrap.innerHTML = "";
  document.getElementById("hero").style.display = "none";
  if (!hits.length) { wrap.innerHTML=`<p style="color:#666;padding:40px 4%">Sin resultados para "${esc(q)}"</p>`; return; }
  wrap.appendChild(buildSection(`Resultados: "${esc(q)}"`, hits, "_search"));
};

/* ── OVERLAY HELPERS ─────────────────────────────────────── */
function openOv(id)  { document.getElementById(id).classList.add("open"); document.body.style.overflow="hidden"; }
function closeOv(id) { document.getElementById(id).classList.remove("open"); document.body.style.overflow=""; }
window.closeOv = closeOv;

window.ovClose = (e, id) => { if (e.target === document.getElementById(id)) closeOv(id); };

/* ── SCROLL NAV ──────────────────────────────────────────── */
window.addEventListener("scroll",()=>
  document.getElementById("navbar").classList.toggle("scrolled", scrollY>60));

/* ── UTILS ───────────────────────────────────────────────── */
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function catLabel(c){
  return {Peliculas:"Película",Sagas:"Saga",Series:"Serie",Novelas:"Novela",Shows:"Show",
          PeliculasAnimadas:"Peli. animada",Animados:"Animado",Anime:"Anime",Donghua:"Donghua"}[c]||c||"";
}

window.toast = (msg) => {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove("show"), 2600);
};
