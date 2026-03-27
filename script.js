import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const FB_CONFIG = { /* TUS DATOS AQUÍ */ };
const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

let allItems = [];

// FUNCIONES GLOBALES (Para que el HTML las reconozca)
window.filterCat = (el, cat) => {
    document.querySelectorAll('.n-link').forEach(l => l.classList.remove('active'));
    if(el) el.classList.add('active');
    renderGrid(cat);
};

window.userLogout = () => signOut(auth).then(() => location.reload());

// DETECTAR ESTADO DE USUARIO
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('auth-screen').style.display = 'none';
        loadData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

async function loadData() {
    try {
        const snap = await getDocs(collection(db, "catalogo"));
        allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Clasificación inteligente: Anime
        allItems = allItems.map(item => {
            // Si el escáner marcó isAnime o tiene género 16 (Animación)
            if (item.isAnime === true || (item.genre_ids && item.genre_ids.includes(16))) {
                item.category = "Anime";
            }
            return item;
        });

        updateHero();
        renderGrid('all');
    } catch (e) {
        console.error("Error cargando Firebase:", e);
    }
}

function updateHero() {
    const hero = document.getElementById('hero');
    if (!hero || allItems.length === 0) return;

    // Tomar uno al azar para el carrusel principal
    const pick = allItems[Math.floor(Math.random() * allItems.length)];
    
    hero.style.backgroundImage = `url(${pick.backdrop || pick.poster})`;
    hero.innerHTML = `
        <div class="hero-content">
            <h1 style="font-family:'Bebas Neue'; font-size: 3rem; margin:0;">${pick.title}</h1>
            <p style="color: #ccc; margin: 10px 0;">${pick.plot ? pick.plot.substring(0, 160) + '...' : ''}</p>
            <div style="display:flex; gap:10px;">
                <button class="btn-main" style="padding: 10px 25px; background:white; color:black; border:none; font-weight:bold; cursor:pointer;">▶ Reproducir</button>
                <button style="padding: 10px 25px; background:rgba(128,128,128,0.5); color:white; border:none; font-weight:bold; cursor:pointer;">ℹ Más Info</button>
            </div>
        </div>
    `;
}

function renderGrid(filter) {
    const container = document.getElementById('catalog-container');
    if (!container) return;
    container.innerHTML = "";

    const cats = (filter === 'all') ? ['Peliculas', 'Series', 'Anime'] : [filter];

    cats.forEach(cat => {
        const list = allItems.filter(i => i.category === cat);
        if (list.length === 0) return;

        let html = `<div class="section-title">${cat}</div><div class="grid">`;
        list.forEach(item => {
            html += `
                <div class="card">
                    <img src="${item.poster}" alt="${item.title}" loading="lazy">
                    <div style="padding:8px; font-size:12px; font-weight:bold;">${item.title}</div>
                    <span class="badge" style="position:absolute; top:5px; right:5px; background:red; font-size:10px; padding:2px 5px; border-radius:2px;">
                        ${item.category === 'Series' ? item.seasons+' Temp' : item.year}
                    </span>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
}