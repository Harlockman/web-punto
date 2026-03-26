import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
    authDomain: "mipunto-e32c9.firebaseapp.com",
    projectId: "mipunto-e32c9",
    storageBucket: "mipunto-e32c9.firebasestorage.app",
    appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let allItems = [], cart = [], isLogin = true, curItem = null;

// --- AUTENTICACIÓN ---
document.getElementById('btnAuth').onclick = async () => {
    const ph = document.getElementById('phone').value, ps = document.getElementById('pass').value, nm = document.getElementById('reg-name').value;
    if(ph.length < 8) return alert("Número telefónico inválido");
    const mail = `+53${ph}@videoteca.com`;

    try {
        if(isLogin) {
            await signInWithEmailAndPassword(auth, mail, ps);
        } else {
            if(!nm) return alert("Escribe tu nombre para el registro");
            const res = await createUserWithEmailAndPassword(auth, mail, ps);
            await updateProfile(res.user, { displayName: nm });
            location.reload();
        }
    } catch(e) {
        alert("Datos incorrectos o usuario no registrado.");
    }
};

document.getElementById('toggleAuth').onclick = () => {
    isLogin = !isLogin;
    document.getElementById('reg-name').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLogin ? 'INICIAR SESIÓN' : 'CREAR MI CUENTA';
    document.getElementById('auth-msg').innerText = isLogin ? 'Ingresa tus datos para entrar' : 'Regístrate como nuevo usuario';
};

onAuthStateChanged(auth, u => { 
    if(u){ 
        document.getElementById('auth-screen').style.display='none'; 
        document.getElementById('uName').innerText = u.displayName || "Usuario VIP"; 
        fetchData(); 
    } else {
        document.getElementById('auth-screen').style.display='flex';
    }
});

window.userLogout = () => signOut(auth).then(() => location.reload());

// --- CARGA DE DATOS ---
async function fetchData() {
    const s = await getDocs(collection(db, "catalogo"));
    allItems = s.docs.map(d => ({id: d.id, ...d.data()}));
    renderApp();
}

function renderApp() {
    renderHero();
    const categories = ["Peliculas", "Series", "Novelas", "Shows", "Animados", "Anime"];
    document.getElementById('sections-wrapper').innerHTML = categories.map(cat => {
        const list = allItems.filter(i => i.category === cat);
        if(!list.length) return '';
        return `
            <div class="section-container">
                <h2 class="section-title">${cat.toUpperCase()}</h2>
                <div class="grid">${list.map(i => `
                    <div class="card" onclick="openDetails('${i.id}')">
                        <img src="${i.poster}">
                        <button class="quick-add" onclick="event.stopPropagation(); startAdd('${i.id}')">+</button>
                        <div style="padding:10px; font-size:12px; font-weight:bold; text-align:center">${i.title}</div>
                    </div>
                `).join('')}</div>
            </div>`;
    }).join('');
}

// --- CARRUSEL ---
function renderHero() {
    const news = allItems.filter(i => i.nuevo).slice(0, 5);
    const hero = document.getElementById('hero');
    if(!news.length) { hero.style.display='none'; return; }

    hero.innerHTML = news.map((i, idx) => `
        <div class="hero-slide ${idx === 0 ? 'active' : ''}">
            <div class="hero-bg" style="background-image: url('${i.backdrop || i.poster}')"></div>
            <div class="hero-content">
                <h1 class="hero-title">${i.title}</h1>
                <button class="btn-red" style="width:auto; padding:12px 30px" onclick="openDetails('${i.id}')">VER AHORA</button>
            </div>
        </div>
    `).join('');
    
    let cur = 0;
    setInterval(() => {
        const slides = document.querySelectorAll('.hero-slide');
        if(!slides.length) return;
        slides[cur].classList.remove('active');
        cur = (cur + 1) % slides.length;
        slides[cur].classList.add('active');
    }, 7000);
}

// --- INTERACCIÓN ---
window.openDetails = (id) => {
    curItem = allItems.find(x => x.id === id);
    document.getElementById('mTitle').innerText = curItem.title;
    document.getElementById('mDesc').innerText = curItem.plot || "Sin descripción disponible.";
    document.getElementById('mStats').innerText = curItem.category === 'Peliculas' ? `Película | ${curItem.year}` : `Serie | ${curItem.seasons_count} Temporadas`;
    
    const box = document.getElementById('videoBox');
    box.innerHTML = `<img src="${curItem.backdrop || curItem.poster}" style="width:100%; height:100%; object-fit:cover">`;
    
    document.getElementById('btnTrailer').onclick = () => {
        if(!curItem.trailerId) return alert("Tráiler no disponible");
        const origin = window.location.origin;
        box.innerHTML = `<iframe src="https://www.youtube.com/embed/${curItem.trailerId}?autoplay=1&mute=1&enablejsapi=1&rel=0&origin=${origin}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    };

    document.getElementById('btnAddModal').onclick = () => { closeModals(); startAdd(curItem.id); };
    document.getElementById('modal-details').classList.add('active');
};

window.startAdd = (id) => {
    curItem = allItems.find(x => x.id === id);
    if(curItem.category === 'Peliculas') {
        addToCart(curItem, "Completa");
    } else {
        document.getElementById('qtyTitle').innerText = curItem.title;
        const selS = document.getElementById('selSeason');
        selS.innerHTML = "";
        for(let i=1; i<=(curItem.seasons_count || 1); i++){
            selS.innerHTML += `<option value="${i}">Temporada ${i}</option>`;
        }
        document.getElementById('modal-qty').classList.add('active');
    }
};

window.toggleCustomCaps = () => {
    const val = document.getElementById('selType').value;
    document.getElementById('customCaps').style.display = (val === 'especifico') ? 'block' : 'none';
};

document.getElementById('btnConfirmAdd').onclick = () => {
    const s = document.getElementById('selSeason').value;
    const t = document.getElementById('selType').value;
    const note = t === 'serie_completa' ? "Toda la Serie" : (t === 'completa' ? `T${s} Completa` : `T${s}: ${document.getElementById('customCaps').value}`);
    addToCart(curItem, note);
    closeModals();
};

function addToCart(item, note) {
    cart.push({...item, note});
    updateCartUI();
    document.getElementById('cart-panel').classList.add('active');
}

function updateCartUI() {
    document.getElementById('cCount').innerText = cart.length;
    const total = cart.reduce((s, i) => s + (Number(i.price)||0), 0);
    document.getElementById('cTotal').innerText = "CUP " + total;
    document.getElementById('cItems').innerHTML = cart.map((i, idx) => `
        <div style="display:flex; gap:12px; margin-bottom:12px; background:#1a1a1a; padding:10px; border-radius:6px; border:1px solid #333">
            <img src="${i.poster}" style="width:40px; height:60px; object-fit:cover">
            <div style="flex-grow:1">
                <div style="font-size:13px; font-weight:bold">${i.title}</div>
                <div style="color:var(--muted); font-size:11px">${i.note}</div>
            </div>
            <button onclick="removeFromCart(${idx})" style="background:none; border:none; color:red; cursor:pointer">✕</button>
        </div>
    `).join('');
}

window.removeFromCart = (idx) => { cart.splice(idx,1); updateCartUI(); };

window.checkout = async () => {
    if(!cart.length) return;
    const cod = Math.floor(1000 + Math.random()*9000);
    try {
        await addDoc(collection(db, "pedidos"), {
            cliente: auth.currentUser.displayName,
            items: cart.map(i => ({titulo: i.title, detalle: i.note})),
            total: document.getElementById('cTotal').innerText,
            codigo: cod,
            fecha: serverTimestamp()
        });
        document.getElementById('resCode').innerText = "#" + cod;
        document.getElementById('divCode').style.display = 'block';
        cart = []; updateCartUI();
    } catch(e) { alert("Error al enviar pedido"); }
};

window.closeModals = () => {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('videoBox').innerHTML = "";
};

window.toggleCart = () => document.getElementById('cart-panel').classList.toggle('active');
window.addEventListener('scroll', () => document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60));