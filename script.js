import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const FB_CONFIG = {
    apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
    authDomain: "mipunto-e32c9.firebaseapp.com",
    projectId: "mipunto-e32c9",
    storageBucket: "mipunto-e32c9.firebasestorage.app",
    appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

let allItems = [];
let isLoginMode = true;

// --- FUNCIONES GLOBALES ---
window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('reg-name').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLoginMode ? 'ENTRAR' : 'CREAR CUENTA';
    document.querySelector('.toggle-text').innerText = isLoginMode ? '¿Nuevo aquí? Regístrate' : '¿Ya tienes cuenta? Entra';
};

window.userLogout = () => signOut(auth).then(() => location.reload());

window.filterCat = (btn, cat) => {
    document.querySelectorAll('.m-item').forEach(m => m.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderGrid(cat);
};

// --- AUTENTICACIÓN ---
document.getElementById('btnAuth').onclick = async () => {
    const phone = document.getElementById('phone').value;
    const pass = document.getElementById('pass').value;
    const email = `user${phone}@videotecavip.com`;

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            const name = document.getElementById('reg-name').value;
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });
            location.reload();
        }
    } catch (e) {
        alert("Error en el acceso. Verifica tus datos.");
    }
};

onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-ui').style.display = 'block';
        document.getElementById('user-display').innerText = user.displayName || "Usuario";
        loadCatalog();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-ui').style.display = 'none';
    }
});

// --- CARGA DE DATOS ---
async function loadCatalog() {
    const snap = await getDocs(collection(db, "catalogo"));
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // CLASIFICACIÓN DE ANIME (Si el título contiene anime o el escáner lo marcó)
    allItems = allItems.map(item => {
        const title = item.title.toLowerCase();
        if (item.isAnime || title.includes('anime') || item.genre_ids?.includes(16)) {
            item.category = "Anime";
        }
        return item;
    });

    renderHero();
    renderGrid('all');
}

function renderHero() {
    const hero = document.getElementById('hero');
    if (allItems.length === 0) return;
    const pick = allItems[Math.floor(Math.random() * allItems.length)];
    
    hero.style.backgroundImage = `url(${pick.backdrop || pick.poster})`;
    hero.innerHTML = `
        <div style="position:relative; z-index:10; max-width:700px;">
            <h1 style="font-family:'Bebas Neue'; font-size: clamp(3rem, 8vw, 5rem); line-height:0.9;">${pick.title}</h1>
            <p style="margin: 20px 0; color: #ccc; font-size: 14px; max-width: 500px;">${pick.plot ? pick.plot.substring(0, 160) + '...' : ''}</p>
            <button class="btn-red" style="width:auto; padding: 12px 35px; font-size: 16px;">▶ VER AHORA</button>
        </div>
    `;
}

function renderGrid(filter) {
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";
    const categories = filter === 'all' ? ['Peliculas', 'Series', 'Anime'] : [filter];

    categories.forEach(cat => {
        const filtered = allItems.filter(i => i.category === cat);
        if (filtered.length === 0) return;

        let html = `<div class="section-title">${cat}</div><div class="grid">`;
        filtered.forEach(item => {
            const label = item.category === 'Series' || item.category === 'Anime' ? `${item.seasons_count || 1} Temp` : item.year;
            html += `
                <div class="card">
                    <span class="badge">${label}</span>
                    <img src="${item.poster}" loading="lazy">
                    <div class="card-title">${item.title}</div>
                </div>`;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
}