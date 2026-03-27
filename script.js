import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. CONFIGURACIÓN FIREBASE & TMDB ---
const FB_CONFIG = {
    apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
    authDomain: "mipunto-e32c9.firebaseapp.com",
    projectId: "mipunto-e32c9",
    storageBucket: "mipunto-e32c9.firebasestorage.app",
    appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const TMDB_KEY = "4f5f43495afcc67e9553f6c684a82873";
const TMDB = "https://api.themoviedb.org/3";
const MOD_EMAIL = "moderador@videoteca.com"; // Email de administración

const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables Globales de Estado
let allItems = [], cart = [], isLogin = true, curItem = null, _trailerKey = null, isMod = false;
let priceMode = "ficheros", filePrices = {}, capPrices = {};

// Categorías para precios (Moderador)
const CATS_PRICE = ["pelicula", "peli_animada", "serie", "anime", "show", "novela"];
const CAP_TIERS = ["1gb", "2gb", "4gb", "8gb", "16gb", "32gb", "64gb", "128gb"];

// --- 2. SISTEMA DE PRECIOS HÍBRIDO ---
async function loadConfig() {
    try {
        const snap = await getDoc(doc(db, "config", "precios"));
        if (snap.exists()) {
            const d = snap.data();
            priceMode = d.modo || "ficheros"; 
            filePrices = d.ficheros || {}; 
            capPrices = d.capacidad || {};
        }
    } catch (_) { console.log("Usando defaults de precios"); }
}

// Cálculo del precio de un ítem para el carrito
function getItemPrice(item) {
    if (priceMode === "capacidad") return "GB"; // Indica cobro por GB en el pedido
    const cat_map = { Peliculas: "pelicula", Series: "serie", Novelas: "novela", Shows: "show", Animados: "anime", Anime: "anime" };
    return filePrices[cat_map[item.category]] || 0;
}

// --- 3. AUTENTICACIÓN (LOGIN/REGISTRO) ---
const btnAuth = document.getElementById('btnAuth');
if(btnAuth) {
    btnAuth.onclick = async () => {
        const ph = document.getElementById('phone').value.trim(), ps = document.getElementById('pass').value, nm = document.getElementById('reg-name').value;
        if (ph.length < 8) return alert("Número telefónico inválido (8 dígitos)");
        const mail = `+53${ph}@videoteca.com`;
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, mail, ps);
            } else {
                if (!nm) return alert("Escribe tu nombre completo");
                const res = await createUserWithEmailAndPassword(auth, mail, ps);
                await updateProfile(res.user, { displayName: nm });
                location.reload();
            }
        } catch (e) { alert("Error: Verifica tus datos de acceso."); }
    };
}

onAuthStateChanged(auth, async u => {
    if (u) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('uName').innerText = u.displayName || u.email.split('@')[0];
        // Verificar si es moderador
        isMod = (u.email === MOD_EMAIL);
        if (isMod) document.getElementById('mod-btn').style.display = 'flex';
        await loadConfig(); fetchData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

// --- 4. CARGA DE DATOS & RENDER CATÁLOGO ---
async function fetchData() {
    const s = await getDocs(collection(db, "catalogo"));
    allItems = s.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid('all');
    renderHero();
}

function renderGrid(filterCat) {
    const cats = ["Peliculas", "Series", "Novelas", "Shows", "Anime"];
    const wrap = document.getElementById('sections-wrapper');
    wrap.innerHTML = "";

    cats.forEach(cat => {
        if (filterCat !== 'all' && filterCat !== cat) return;
        const list = allItems.filter(i => i.category === cat);
        if (!list.length) return;

        const secHtml = `
            <section class="section-container" data-cat="${cat}">
                <h2 class="section-title">${cat.toUpperCase()}</h2>
                <div class="grid">${list.map(i => `
                    <div class="card" onclick="window.openDetails('${i.id}')">
                        <img src="${i.poster}" alt="${i.title}">
                        <button class="quick-add" onclick="event.stopPropagation(); window.startQuickAdd('${i.id}')">+</button>
                        <div class="card-label">${i.title}</div>
                    </div>
                `).join('')}</div>
            </section>`;
        wrap.innerHTML += secHtml;
    });
}

// Carrusel Hero (Netflix Premium Style)
function renderHero() {
    const news = allItems.filter(i => i.nuevo).slice(0, 5);
    const hero = document.getElementById('hero');
    if (!news.length) { hero.style.display = 'none'; return; }
    hero.innerHTML = news.map((i, idx) => `
        <div class="hero-slide ${idx === 0 ? 'active' : ''}">
            <div class="hero-bg" style="background-image:url('${i.backdrop || i.poster}')"></div>
            <div class="hero-fade"></div>
            <div class="hero-content">
                <span style="color:var(--red);font-weight:bold;letter-spacing:1px">🔴 RECIÉN AGREGADO</span>
                <h1 class="hero-title">${i.title}</h1>
                <p style="margin-bottom:20px;color:#ccc;max-width:550px;font-size:14px;line-height:1.6">${i.plot || 'Sin descripción disponible.'}</p>
                <div class="hero-btns">
                    <button class="btn-red" onclick="window.openDetails('${i.id}')">▶ MÁS INFORMACIÓN</button>
                </div>
            </div>
        </div>`).join('');

    let cur = 0;
    setInterval(() => {
        const s = document.querySelectorAll('.hero-slide'); if (!s.length) return;
        s[cur].classList.remove('active'); cur = (cur + 1) % s.length; s[cur].classList.add('active');
    }, 8000);
}

// --- 5. DETALLES CON TRÁILER VERIFICADO (EVITA ERROR 153) ---
async function fetchTrailerKey(item) {
    _trailerKey = null; const type = (item.category === 'Peliculas') ? 'movie' : 'tv';
    try {
        const r = await fetch(`${TMDB}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(item.title)}&language=es-ES`);
        const d = await r.json();
        if (d.results.length) {
            const id = d.results[0].id;
            const vd = await (await fetch(`${TMDB}/${type}/${id}/videos?api_key=${TMDB_KEY}&language=es-ES`)).json();
            const t = vd.results.find(v => v.type === "Trailer" && v.site === "YouTube");
            if (t) _trailerKey = t.key;
        }
    } catch (_) { }
}

window.openDetails = async (id) => {
    curItem = allItems.find(x => x.id === id); if (!curItem) return;
    document.getElementById("mTitle").innerText = curItem.title;
    document.getElementById("mDesc").innerText = curItem.plot || "Sin descripción disponible.";
    
    // Precio estático para mostrar en detalles
    const cat_map = { Peliculas: "pelicula", Series: "serie", Novelas: "novela", Shows: "show", Animados: "anime", Anime: "anime" };
    const pKey = cat_map[curItem.category];
    const priceDisplay = priceMode === 'ficheros' ? `CUP ${filePrices[pKey] || 0} / fichero` : "Cobro por GB (Capacidad)";

    document.getElementById("mStats").innerHTML = 
        `${curItem.year || ''} · ★ ${curItem.rating || 'N/A'} · <span style="color:var(--green)">${priceDisplay}</span>`;

    const box = document.getElementById("videoBox");
    // Imagen de fondo mientras carga
    box.innerHTML = `<img src="${curItem.backdrop || curItem.poster}" style="width:100%;height:100%;object-fit:cover">`;

    // Botón Tráiler
    document.getElementById("btnPlayTrailer").onclick = () => {
        if (!_trailerKey) return alert("Tráiler no disponible para este título.");
        const origin = window.location.origin; // ¡Crucial para evitar Error 153!
        box.innerHTML = `<iframe src="https://www.youtube.com/embed/${_trailerKey}?autoplay=1&rel=0&enablejsapi=1&origin=${origin}" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:100%;border:none"></iframe>`;
    };

    // Botón Añadir (desde Modal)
    document.getElementById("btnAddFromModal").onclick = () => {
        window.closeModals(); window.startQuickAdd(curItem.id);
    };

    document.getElementById("modal-details").classList.add("active");
    fetchTrailerKey(curItem); // Carga la key en segundo plano
};

// --- 6. LÓGICA DE AÑADIR (SELECTORES SERIES) ---
window.startQuickAdd = (id) => {
    curItem = allItems.find(x => x.id === id);
    if (!curItem) return;
    const isTv = ["Series", "Novelas", "Anime"].includes(curItem.category);
    if (isTv) {
        document.getElementById('qtyTitle').innerText = curItem.title;
        const sel = document.getElementById('selSeason'); sel.innerHTML = "";
        for (let i = 1; i <= (curItem.seasons_count || 1); i++) {
            sel.innerHTML += `<option value="${i}">Temporada ${i}</option>`;
        }
        document.getElementById('selType').value = 'completa';
        window.toggleCustomCaps();
        document.getElementById('modal-qty').classList.add('active');
    } else {
        addToCart(curItem, "Película Completa");
    }
};

window.toggleCustomCaps = () => {
    const val = document.getElementById('selType').value;
    document.getElementById('customCaps').style.display = (val === 'especifico') ? 'block' : 'none';
};

document.getElementById('btnConfirmAdd').onclick = () => {
    const s = document.getElementById('selSeason').value;
    const t = document.getElementById('selType').value;
    const caps = document.getElementById('customCaps').value;
    const note = (t === 'serie_completa') ? "Serie Completa" : (t === 'completa' ? `T${s} Completa` : `T${s}: ${caps}`);
    addToCart(curItem, note); window.closeModals();
};

function addToCart(item, note) {
    cart.push({ ...item, pedidoNote: note, pedidoPrice: getItemPrice(item) });
    updateCartUI(); window.toggleCart(true);
}

function updateCartUI() {
    document.getElementById('cCount').innerText = cart.length;
    let totalCUP = 0; let hasGB = false;
    cart.forEach(i => {
        if(i.pedidoPrice === 'GB') hasGB = true;
        else totalCUP += Number(i.pedidoPrice);
    });

    document.getElementById('cTotal').innerText = `CUP ${totalCUP}${hasGB ? ' + Costo GB' : ''}`;
    document.getElementById('cItems').innerHTML = cart.map((i, idx) => `
        <div class="cart-item">
            <img src="${i.poster}" style="width:40px;height:60px;object-fit:cover;border-radius:3px">
            <div style="flex-grow:1;font-size:12px">
                <b>${i.title}</b><br><span style="color:#aaa">${i.pedidoNote}</span><br>
                ${i.pedidoPrice !== 'GB' ? `<span style="color:var(--green)">CUP ${i.pedidoPrice}</span>` : '<span style="color:#777;font-size:10px">Cálculo x GB al copiar</span>'}
            </div>
            <button onclick="window.removeFromCart(${idx})" style="background:none;border:none;color:red;cursor:pointer;font-weight:bold;font-size:16px">✕</button>
        </div>`).join('');
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); updateCartUI(); };

window.checkout = async () => {
    if (!cart.length) return alert("Tu pedido está vacío.");
    const cod = Math.floor(1000 + Math.random() * 9000);
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente: auth.currentUser.displayName, 
            telefono: auth.currentUser.email.split('@')[0],
            items: cart.map(i => ({ titulo: i.title, note: i.pedidoNote, precio: i.pedidoPrice })),
            total: document.getElementById('cTotal').innerText, 
            codigo: cod, 
            modo_cobro: priceMode,
            fecha: serverTimestamp()
        });
        document.getElementById('resCode').innerText = `#${cod}`;
        document.getElementById('divCode').style.display = 'block'; 
        cart = []; updateCartUI();
    } catch(e) { alert("Error al enviar el pedido."); }
};

// --- 7. PANEL MODERADOR (CONFIGURACIÓN) EXHAUSTIVO ---
window.openMod = () => {
    renderModPrecios(); renderModCatalogo();
    document.getElementById("modal-mod").classList.add("active");
};

function renderModPrecios() {
    // Sincronizar UI de modo
    document.getElementById('mode-files-btn').className = priceMode === 'ficheros' ? 'mode-btn active' : 'mode-btn';
    document.getElementById('mode-cap-btn').className = priceMode === 'capacidad' ? 'mode-btn active' : 'mode-btn';
    document.getElementById('panel-ficheros').style.display = priceMode === 'ficheros' ? 'block' : 'none';
    document.getElementById('panel-capacidad').style.display = priceMode === 'capacidad' ? 'block' : 'none';

    // Rellenar grids con inputs
    document.getElementById('price-grid-ficheros').innerHTML = CATS_PRICE.map(cat => `
        <div class="price-row">
            <span style="font-size:12px;color:#ccc">${cat.toUpperCase().replace('_',' ')}</span>
            <div style="display:flex;align-items:center;gap:5px">
                <input type="number" id="fprecio-${cat}" value="${filePrices[cat] || 0}"> 
                <span style="color:#555;font-size:10px">CUP</span>
            </div>
        </div>`).join('');
        
    document.getElementById('price-grid-capacidad').innerHTML = CAP_TIERS.map(cap => `
        <div class="price-row">
            <span style="font-size:12px;color:#ccc">Disco ${cap.toUpperCase()}</span>
            <div style="display:flex;align-items:center;gap:5px">
                <input type="number" id="cprecio-${cap}" value="${capPrices[cap] || 0}">
                <span style="color:#555;font-size:10px">CUP</span>
            </div>
        </div>`).join('');
}

function renderModCatalogo() {
    document.getElementById('cat-count').innerText = allItems.length;
    document.getElementById('catalog-list').innerHTML = allItems.map(i => `
        <div class="catalog-row">
            <span>${i.title}</span><span style="color:#888">${i.category}</span>
        </div>`).join('');
}

window.savePrices = async () => {
    // Leer valores de inputs
    CATS_PRICE.forEach(c => filePrices[c] = Number(document.getElementById(`fprecio-${c}`).value) || 0);
    CAP_TIERS.forEach(c => capPrices[c] = Number(document.getElementById(`cprecio-${c}`).value) || 0);
    
    // Guardar en Firebase
    await setDoc(doc(db, "config", "precios"), { modo: priceMode, ficheros: filePrices, capacidad: capPrices });
    alert("✓ Configuración de precios actualizada en Firebase.");
};

// --- EXPOSICIÓN GLOBAL DE UTILS ---
window.toggleAuthMode = () => {
    isLogin = !isLogin;
    document.getElementById('reg-name').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLogin ? "INICIAR SESIÓN" : "REGISTRARME";
    document.getElementById('auth-msg').innerText = isLogin ? "Ingresa tus datos para entrar" : "Crea una cuenta VIP nueva";
};
window.closeModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.getElementById("videoBox").innerHTML = ""; // Detener video/trailer inmediatamente
};
window.overlayClose = (e, id) => { if (e.target.id === id) window.closeModals(); };
window.toggleCart = (forceOpen) => {
    const p = document.getElementById('cart-panel');
    if(forceOpen === true) p.classList.add('active');
    else p.classList.toggle('active');
};
window.modTab = (btn, tab) => {
    document.querySelectorAll('.mod-tab').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    document.querySelectorAll('.mod-tab-content').forEach(t => t.style.display = 'none'); document.getElementById(tab).style.display = 'block';
};
window.userLogout = () => signOut(auth).then(() => location.reload());
window.setPriceMode = (m) => { priceMode = m; renderModPrecios(); };

// BÚSQUEDA & FILTROS (NETFLIX STYLE)
window.filterCat = (btn, cat) => {
    document.querySelectorAll('.nav-cat').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    document.getElementById('hero').style.display = cat === 'all' ? 'flex' : 'none';
    if (cat === 'all') renderGrid('all');
    else renderGrid(cat);
};
window.showAll = () => { window.filterCat(document.querySelector('.nav-cat'), 'all'); };
window.doSearch = (q) => {
    if(!q) return renderGrid('all');
    renderGrid('all'); // Asegura cargar todo para filtrar
    const sections = document.querySelectorAll('.section-container');
    sections.forEach(sec => {
        let anyMatch = false;
        const cards = sec.querySelectorAll('.card');
        cards.forEach(card => {
            const title = card.querySelector('.card-label').innerText.toLowerCase();
            const match = title.includes(q.toLowerCase());
            card.style.display = match ? 'block' : 'none';
            if (match) anyMatch = true;
        });
        sec.style.display = anyMatch ? 'block' : 'none'; // Oculta sección si no hay coincidencias
    });
};

// Efecto Transparencia Nav al Scroll
window.addEventListener("scroll", () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
});