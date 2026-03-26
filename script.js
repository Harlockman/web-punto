import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         onAuthStateChanged,
         signOut,
         updateProfile }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore,
         collection, getDocs,
         doc, getDoc, setDoc,
         addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── CONFIG ─────────────────────────────────────────────────
const FB_CONFIG = {
    apiKey:            "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
    authDomain:        "mipunto-e32c9.firebaseapp.com",
    projectId:         "mipunto-e32c9",
    storageBucket:     "mipunto-e32c9.firebasestorage.app",
    messagingSenderId: "109212632970",
    appId:             "1:109212632970:web:d57a11a01f5365fad0aa73"
};

// Email del moderador — cambia por el correo real que uses para esa cuenta
const MOD_EMAIL = "moderador@videoteca.com";

const TMDB_KEY = "4f5f43495afcc67e9553f6c684a82873";
const TMDB     = "https://api.themoviedb.org/3";
const IMG_W    = "https://image.tmdb.org/t/p/w342";
const IMG_BD   = "https://image.tmdb.org/t/p/w1280";

// ── CATEGORÍAS DE FICHEROS ─────────────────────────────────
// Estos son los tipos de fichero para el sistema de precios
const FILE_CATS = [
    { key: "pelicula",          label: "Película" },
    { key: "cap_serie",         label: "Capítulo de serie" },
    { key: "cap_novela",        label: "Capítulo de novela" },
    { key: "show",              label: "Show / programa" },
    { key: "pelicula_animada",  label: "Película animada" },
    { key: "animado",           label: "Animado (serie)" },
    { key: "anime",             label: "Anime" },
    { key: "donghua",           label: "Donghua" },
];

// Tamaños para precios por capacidad (GB)
const CAP_TIERS = [
    { key: "1gb",   label: "1 GB"   },
    { key: "2gb",   label: "2 GB"   },
    { key: "4gb",   label: "4 GB"   },
    { key: "8gb",   label: "8 GB"   },
    { key: "16gb",  label: "16 GB"  },
    { key: "32gb",  label: "32 GB"  },
    { key: "64gb",  label: "64 GB"  },
    { key: "128gb", label: "128 GB" },
];

// Mapeo de categoría Firebase → tipo fichero para calcular precio
const CAT_TO_FILE = {
    "Peliculas":         "pelicula",
    "PeliculasAnimadas": "pelicula_animada",
    "Series":            "cap_serie",
    "Novelas":           "cap_novela",
    "Shows":             "show",
    "Animados":          "animado",
    "Anime":             "anime",
    "Donghua":           "donghua",
};

// Precios por defecto si Firebase no tiene nada aún
const DEFAULT_FILE_PRICES = {
    pelicula: 200, cap_serie: 50, cap_novela: 40,
    show: 80, pelicula_animada: 150, animado: 50, anime: 50, donghua: 50
};
const DEFAULT_CAP_PRICES = {
    "1gb": 50, "2gb": 90, "4gb": 160, "8gb": 280,
    "16gb": 500, "32gb": 900, "64gb": 1600, "128gb": 2800
};

// ── INIT ───────────────────────────────────────────────────
const app  = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

let allItems    = [];
let cart        = [];
let curItem     = null;
let isLogin     = true;
let isMod       = false;
let priceMode   = "ficheros"; // "ficheros" | "capacidad"
let filePrices  = { ...DEFAULT_FILE_PRICES };
let capPrices   = { ...DEFAULT_CAP_PRICES };
let _trailerKey = null;

// ── AUTH UI ────────────────────────────────────────────────
document.getElementById("btnAuth").onclick = async () => {
    const ph = document.getElementById("phone").value.trim();
    const ps = document.getElementById("pass").value;
    const nm = document.getElementById("reg-name").value.trim();
    if (ph.length < 8) return toast("Número telefónico inválido");
    const mail = `+53${ph}@videoteca.com`;
    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, mail, ps);
        } else {
            if (!nm) return toast("Escribe tu nombre para registrarte");
            const r = await createUserWithEmailAndPassword(auth, mail, ps);
            await updateProfile(r.user, { displayName: nm });
            location.reload();
        }
    } catch (e) {
        toast("Datos incorrectos o usuario no registrado");
    }
};

document.getElementById("toggleAuth").onclick = () => {
    isLogin = !isLogin;
    document.getElementById("reg-name").style.display = isLogin ? "none" : "block";
    document.getElementById("btnAuth").textContent    = isLogin ? "INICIAR SESIÓN" : "CREAR MI CUENTA";
    document.getElementById("auth-msg").textContent   = isLogin ? "Ingresa tus datos para entrar" : "Regístrate como nuevo usuario";
    document.getElementById("toggleAuth").innerHTML   = isLogin
        ? "¿No tienes cuenta? <b>Regístrate aquí</b>"
        : "¿Ya tienes cuenta? <b>Inicia sesión</b>";
};

onAuthStateChanged(auth, async (u) => {
    if (u) {
        document.getElementById("auth-screen").style.display = "none";
        document.getElementById("uName").textContent = u.displayName || "Usuario";
        // Detectar moderador por email
        isMod = (u.email === MOD_EMAIL);
        if (isMod) document.getElementById("mod-btn").style.display = "flex";
        await loadPrices();
        fetchData();
    } else {
        document.getElementById("auth-screen").style.display = "flex";
    }
});

window.userLogout = () => signOut(auth).then(() => location.reload());

// ── CARGAR PRECIOS DESDE FIREBASE ─────────────────────────
async function loadPrices() {
    try {
        const snap = await getDoc(doc(db, "config", "precios"));
        if (snap.exists()) {
            const d = snap.data();
            if (d.modo)       priceMode  = d.modo;
            if (d.ficheros)   filePrices = { ...DEFAULT_FILE_PRICES, ...d.ficheros };
            if (d.capacidad)  capPrices  = { ...DEFAULT_CAP_PRICES,  ...d.capacidad };
        }
    } catch (_) { /* usa defaults */ }
}

// ── GUARDAR PRECIOS ────────────────────────────────────────
window.savePrices = async () => {
    // leer inputs
    FILE_CATS.forEach(c => {
        const el = document.getElementById(`fp-${c.key}`);
        if (el) filePrices[c.key] = Number(el.value) || 0;
    });
    CAP_TIERS.forEach(c => {
        const el = document.getElementById(`cp-${c.key}`);
        if (el) capPrices[c.key] = Number(el.value) || 0;
    });
    try {
        await setDoc(doc(db, "config", "precios"), {
            modo: priceMode, ficheros: filePrices, capacidad: capPrices,
            updated: serverTimestamp()
        });
        toast("✓ Precios guardados correctamente");
    } catch (e) {
        toast("Error al guardar: " + e.message);
    }
};

// ── FETCH CATÁLOGO ─────────────────────────────────────────
async function fetchData() {
    try {
        const snap = await getDocs(collection(db, "catalogo"));
        allItems = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.active !== false);
        renderApp();
        enrichTMDB();
    } catch (e) {
        document.getElementById("sections-wrapper").innerHTML =
            `<p style="color:#f88;padding:40px 4%">Error al cargar catálogo: ${e.message}</p>`;
    }
}

// ── TMDB ENRIQUECIMIENTO ───────────────────────────────────
async function enrichTMDB() {
    for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        if (item.poster && item.backdrop) continue;
        const isTv = ["Series","Novelas","Anime","Donghua","Shows"].includes(item.category);
        const type = isTv ? "tv" : "movie";
        try {
            const r = await fetch(`${TMDB}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=es-ES`);
            const d = await r.json();
            if (d.results && d.results.length) {
                const t = d.results[0];
                if (t.poster_path && !item.poster)    allItems[i].poster   = IMG_W  + t.poster_path;
                if (t.backdrop_path && !item.backdrop) allItems[i].backdrop = IMG_BD + t.backdrop_path;
                if (t.overview && !item.plot)          allItems[i].plot     = t.overview;
                if (t.vote_average && !item.rating)    allItems[i].rating   = t.vote_average.toFixed(1);
                allItems[i]._tmdb_id   = t.id;
                allItems[i]._tmdb_type = type;
                refreshCard(item.id);
            }
        } catch (_) {}
        await sleep(110);
    }
    renderHero(); // actualizar hero con datos frescos
}

async function fetchTrailerKey(item) {
    _trailerKey = null;
    if (!item) return;
    const type = item._tmdb_type || (["Series","Novelas","Anime","Donghua","Shows"].includes(item.category) ? "tv" : "movie");
    let id = item._tmdb_id || item.tmdb_id;
    try {
        if (!id) {
            const r = await fetch(`${TMDB}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=es-ES`);
            const d = await r.json();
            if (d.results && d.results.length) id = d.results[0].id;
        }
        if (!id) return;
        for (const lang of ["es-ES", ""]) {
            const suffix = lang ? `&language=${lang}` : "";
            const vd = await (await fetch(`${TMDB}/${type}/${id}/videos?api_key=${TMDB_KEY}${suffix}`)).json();
            const vids = vd.results || [];
            const t = vids.find(v => v.type === "Trailer" && v.site === "YouTube")
                   || vids.find(v => v.site === "YouTube");
            if (t) { _trailerKey = t.key; return; }
        }
    } catch (_) {}
}

// ── RENDER HERO ────────────────────────────────────────────
function renderHero() {
    const slides = allItems.filter(i => i.nuevo).slice(0, 6);
    const hero   = document.getElementById("hero");
    if (!slides.length) { hero.style.display = "none"; return; }
    hero.style.display = "";
    hero.innerHTML = slides.map((item, idx) => `
        <div class="hero-slide ${idx === 0 ? "active" : ""}">
            <div class="hero-bg" style="background-image:url('${item.backdrop || item.poster || ""}')"></div>
            <div class="hero-fade"></div>
            <div class="hero-content">
                <div class="hero-badge">🔴 NUEVO</div>
                <div class="hero-title">${item.title || ""}</div>
                <div class="hero-meta">
                    <span class="hero-score">★ ${item.rating || "N/A"}</span>
                    ${item.year ? ` · ${item.year}` : ""}
                    ${item.genre ? ` · ${item.genre.split(",")[0]}` : ""}
                </div>
                <div class="hero-desc">${item.plot || item.synopsis || "Sin descripción disponible."}</div>
                <div class="hero-btns">
                    <button class="btn-play" onclick="openDetails('${item.id}')">▶ VER INFO</button>
                    <button class="btn-more" onclick="startAdd('${item.id}')">🛒 AÑADIR</button>
                </div>
            </div>
        </div>`).join("");

    let cur = 0;
    clearInterval(window._heroTimer);
    window._heroTimer = setInterval(() => {
        const sl = document.querySelectorAll(".hero-slide");
        if (!sl.length) return;
        sl[cur].classList.remove("active");
        cur = (cur + 1) % sl.length;
        sl[cur].classList.add("active");
    }, 7000);
}

// ── RENDER SECCIONES ───────────────────────────────────────
const CATS = [
    { key: "Peliculas",         label: "🎬 Películas"          },
    { key: "Series",            label: "📺 Series"             },
    { key: "Novelas",           label: "💕 Novelas"            },
    { key: "Shows",             label: "🎤 Shows"              },
    { key: "PeliculasAnimadas", label: "✨ Películas animadas"  },
    { key: "Animados",          label: "🎨 Animados"           },
    { key: "Anime",             label: "⛩ Anime"              },
    { key: "Donghua",           label: "🐉 Donghua"            },
];

function renderApp() {
    renderHero();
    const wrapper = document.getElementById("sections-wrapper");

    // Sección "Recientes"
    const recientes = allItems.filter(i => i.nuevo);
    let html = "";
    if (recientes.length) html += buildSection("🔥 Recién llegados", recientes, "nuevo");
    CATS.forEach(c => {
        const items = allItems.filter(i => i.category === c.key);
        if (items.length) html += buildSection(c.label, items, c.key);
    });
    wrapper.innerHTML = html || `<p style="color:#888;padding:40px 4%">El catálogo está vacío.</p>`;
    attachCardListeners();
}

function buildSection(title, items, secId) {
    return `
    <div class="section-block" data-sec="${secId}">
        <div class="section-title">${title}</div>
        <div class="row-scroll">
            ${items.map(item => buildCard(item)).join("")}
        </div>
    </div>`;
}

function buildCard(item) {
    const price = getItemPrice(item);
    const img   = item.poster
        ? `<img src="${item.poster}" alt="${esc(item.title)}" loading="lazy"/>`
        : `<div class="card-ph">🎬</div>`;
    return `
    <div class="card" data-id="${item.id}" onclick="openDetails('${item.id}')">
        ${img}
        ${item.nuevo ? '<span class="new-tag">NUEVO</span>' : ""}
        <button class="quick-add" onclick="event.stopPropagation(); startAdd('${item.id}')" title="Añadir al pedido">+</button>
        <div class="card-hover">
            <div class="card-hover-name">${esc(item.title)}</div>
            <div class="card-hover-meta">★ ${item.rating || "N/A"} · CUP ${price}</div>
        </div>
        <div class="card-label">${esc(item.title)}</div>
    </div>`;
}

function attachCardListeners() { /* onclick ya está inline */ }

function refreshCard(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    document.querySelectorAll(`[data-id="${id}"]`).forEach(el => {
        el.outerHTML = buildCard(item);
    });
}

// ── PRECIO DE UN ÍTEM ──────────────────────────────────────
function getItemPrice(item) {
    if (priceMode === "capacidad") return "—"; // depende del tamaño del fichero
    const fileType = CAT_TO_FILE[item.category] || "pelicula";
    return filePrices[fileType] || 0;
}

// ── ABRIR DETALLE ──────────────────────────────────────────
window.openDetails = (id) => {
    curItem = allItems.find(x => x.id === id);
    if (!curItem) return;
    _trailerKey = null;

    const box = document.getElementById("videoBox");
    box.innerHTML = curItem.backdrop || curItem.poster
        ? `<img src="${curItem.backdrop || curItem.poster}" style="width:100%;height:100%;object-fit:cover"/>`
        : `<div style="width:100%;height:100%;background:#0a0a12;display:flex;align-items:center;justify-content:center;font-size:56px">🎬</div>`;

    document.getElementById("mTitle").textContent = curItem.title || "";
    document.getElementById("mDesc").textContent  = curItem.plot || curItem.synopsis || "Sin descripción disponible.";

    const isSeries = ["Series","Novelas","Anime","Donghua","Animados"].includes(curItem.category);
    const price    = getItemPrice(curItem);
    document.getElementById("mStats").innerHTML =
        `${catLabel(curItem.category)} · ${curItem.year || "—"}` +
        (isSeries && curItem.seasons_count ? ` · ${curItem.seasons_count} temp.` : "") +
        (price !== "—" ? ` · <span style="color:var(--green)">CUP ${price}/fichero</span>` : "");

    document.getElementById("btnTrailer").onclick = loadTrailer;
    document.getElementById("btnAddModal").onclick = () => { closeModals(); startAdd(curItem.id); };
    document.getElementById("modal-details").classList.add("active");

    fetchTrailerKey(curItem); // carga en background
};

function loadTrailer() {
    const box = document.getElementById("videoBox");
    const origin = window.location.origin;
    if (_trailerKey) {
        box.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trailerKey}?autoplay=1&rel=0&origin=${encodeURIComponent(origin)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else {
        setTimeout(() => {
            if (_trailerKey) {
                box.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trailerKey}?autoplay=1&rel=0&origin=${encodeURIComponent(origin)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            } else if (curItem) {
                window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(curItem.title + " trailer")}`, "_blank");
            }
        }, 1400);
        toast("Cargando trailer…");
    }
}

// ── AÑADIR AL CARRITO ──────────────────────────────────────
window.startAdd = (id) => {
    curItem = allItems.find(x => x.id === id);
    if (!curItem) return;
    const isEpisodic = ["Series","Novelas","Anime","Donghua","Animados"].includes(curItem.category);
    if (isEpisodic) {
        document.getElementById("qtyTitle").textContent = curItem.title;
        const selS = document.getElementById("selSeason");
        selS.innerHTML = "";
        for (let i = 1; i <= (curItem.seasons_count || 1); i++)
            selS.innerHTML += `<option value="${i}">Temporada ${i}</option>`;
        document.getElementById("selType").value = "completa";
        document.getElementById("customCaps").style.display = "none";
        document.getElementById("customCaps").value = "";
        document.getElementById("modal-qty").classList.add("active");
    } else {
        addToCart(curItem, "Completa");
    }
};

window.toggleCustomCaps = () => {
    const v = document.getElementById("selType").value;
    document.getElementById("customCaps").style.display = (v === "especifico") ? "block" : "none";
};

document.getElementById("btnConfirmAdd").onclick = () => {
    const s    = document.getElementById("selSeason").value;
    const t    = document.getElementById("selType").value;
    const caps = document.getElementById("customCaps").value;
    const note = t === "serie_completa" ? "Toda la serie" :
                 t === "completa"       ? `Temporada ${s} completa` :
                                         `T${s}: ${caps}`;
    addToCart(curItem, note);
    closeModals();
};

function addToCart(item, note) {
    cart.push({ ...item, note, cartPrice: getItemPrice(item) });
    updateCartUI();
    document.getElementById("cart-panel").classList.add("active");
    toast(`✓ ${item.title} añadido al pedido`);
}

function updateCartUI() {
    document.getElementById("cCount").textContent = cart.length;
    const total = cart.reduce((s, i) => s + (Number(i.cartPrice) || 0), 0);
    document.getElementById("cTotal").textContent = "CUP " + total;
    document.getElementById("divCode").style.display = "none";

    document.getElementById("cItems").innerHTML = cart.map((item, idx) => {
        const thumb = item.poster
            ? `<img src="${item.poster}" alt=""/>`
            : `<div class="ci-ph">🎬</div>`;
        return `
        <div class="cart-item">
            ${thumb}
            <div class="ci-info">
                <div class="ci-title">${esc(item.title)}</div>
                <div class="ci-note">${esc(item.note)}</div>
                ${item.cartPrice !== "—" ? `<div class="ci-price">CUP ${item.cartPrice}</div>` : ""}
            </div>
            <button class="ci-rm" onclick="removeFromCart(${idx})">✕</button>
        </div>`;
    }).join("");
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); updateCartUI(); };

window.checkout = async () => {
    if (!cart.length) return toast("El carrito está vacío");
    const cod = Math.floor(1000 + Math.random() * 9000);
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente:   auth.currentUser.displayName || "Anónimo",
            telefono:  auth.currentUser.email.split("@")[0],
            items:     cart.map(i => ({ titulo: i.title, detalle: i.note, precio: i.cartPrice })),
            total:     document.getElementById("cTotal").textContent,
            codigo:    cod,
            modo_precio: priceMode,
            fecha:     serverTimestamp()
        });
        document.getElementById("resCode").textContent = "#" + cod;
        document.getElementById("divCode").style.display = "block";
        cart = [];
        updateCartUI();
    } catch (e) {
        toast("Error al enviar pedido: " + e.message);
    }
};

// ── PANEL MODERADOR ────────────────────────────────────────
window.openMod = async () => {
    buildPriceGrids();
    buildCatalogList();
    // sync modo activo
    document.getElementById("mode-files-btn").classList.toggle("active", priceMode === "ficheros");
    document.getElementById("mode-cap-btn").classList.toggle("active",   priceMode === "capacidad");
    document.getElementById("panel-ficheros").style.display  = priceMode === "ficheros"  ? "" : "none";
    document.getElementById("panel-capacidad").style.display = priceMode === "capacidad" ? "" : "none";
    document.getElementById("modal-mod").classList.add("active");
};

function buildPriceGrids() {
    // Ficheros
    document.getElementById("price-grid-ficheros").innerHTML = FILE_CATS.map(c => `
        <div class="price-row">
            <span class="price-row-label">${c.label}</span>
            <div class="price-input-wrap">
                <input class="price-input" id="fp-${c.key}" type="number" min="0" value="${filePrices[c.key] || 0}"/>
                <span class="price-cur">CUP</span>
            </div>
        </div>`).join("");

    // Capacidad
    document.getElementById("price-grid-capacidad").innerHTML = CAP_TIERS.map(c => `
        <div class="price-row">
            <span class="price-row-label">${c.label}</span>
            <div class="price-input-wrap">
                <input class="price-input" id="cp-${c.key}" type="number" min="0" value="${capPrices[c.key] || 0}"/>
                <span class="price-cur">CUP</span>
            </div>
        </div>`).join("");
}

function buildCatalogList() {
    document.getElementById("cat-count").textContent = allItems.length;
    document.getElementById("catalog-list").innerHTML = allItems.map(item => {
        const thumb = item.poster
            ? `<img src="${item.poster}" alt=""/>`
            : `<div class="cr-ph">🎬</div>`;
        return `
        <div class="catalog-row">
            ${thumb}
            <span class="cr-title">${esc(item.title)}</span>
            <span class="cr-cat">${item.category || "—"}</span>
        </div>`;
    }).join("");
}

window.setPriceMode = (mode) => {
    priceMode = mode;
    document.getElementById("mode-files-btn").classList.toggle("active", mode === "ficheros");
    document.getElementById("mode-cap-btn").classList.toggle("active",   mode === "capacidad");
    document.getElementById("panel-ficheros").style.display  = mode === "ficheros"  ? "" : "none";
    document.getElementById("panel-capacidad").style.display = mode === "capacidad" ? "" : "none";
};

window.modTab = (btn, tabId) => {
    document.querySelectorAll(".mod-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".mod-tab-content").forEach(t => t.style.display = "none");
    document.getElementById(tabId).style.display = "";
};

// ── FILTRO / BÚSQUEDA ──────────────────────────────────────
window.filterCat = (btn, cat) => {
    document.querySelectorAll(".nav-cat").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("hero").style.display = (cat === "all") ? "" : "none";
    document.querySelectorAll(".section-block").forEach(s => {
        s.style.display = (cat === "all" || s.dataset.sec === cat || s.dataset.sec === "nuevo") ? "" : "none";
    });
};

window.showAll = () => {
    document.querySelectorAll(".nav-cat").forEach((b, i) => b.classList.toggle("active", i === 0));
    document.getElementById("hero").style.display = "";
    document.querySelectorAll(".section-block").forEach(s => s.style.display = "");
};

window.toggleSearch = () => {
    const w = document.getElementById("search-wrap");
    w.classList.toggle("open");
    if (w.classList.contains("open")) document.getElementById("search-input").focus();
};

window.doSearch = (q) => {
    const lo = q.toLowerCase();
    document.querySelectorAll(".section-block").forEach(sec => {
        let any = false;
        sec.querySelectorAll(".card").forEach(card => {
            const id   = card.dataset.id;
            const item = allItems.find(i => i.id === id);
            const match = !q || (item && (item.title || "").toLowerCase().includes(lo));
            card.style.display = match ? "" : "none";
            if (match) any = true;
        });
        sec.style.display = (any || !q) ? "" : "none";
    });
};

// ── MODALES ────────────────────────────────────────────────
window.closeModals = () => {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    document.getElementById("videoBox").innerHTML = "";
};

window.overlayClose = (e, id) => {
    if (e.target === document.getElementById(id)) closeModals();
};

window.toggleCart = () => document.getElementById("cart-panel").classList.toggle("active");

// ── SCROLL NAV ─────────────────────────────────────────────
window.addEventListener("scroll", () =>
    document.getElementById("navbar").classList.toggle("scrolled", window.scrollY > 60));

// ── UTILS ──────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function esc(s)    { return (s || "").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function catLabel(c) {
    const map = {
        Peliculas:"Película", Series:"Serie", Novelas:"Novela", Shows:"Show",
        PeliculasAnimadas:"Peli. animada", Animados:"Animado", Anime:"Anime", Donghua:"Donghua"
    };
    return map[c] || c || "";
}
window.toast = (msg) => {
    const el = document.getElementById("toast-el");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2500);
};
