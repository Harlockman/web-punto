import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const FB_CONFIG = { /* TUS DATOS DE CONFIGURACIÓN */ };
const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

let allItems = [];

onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById('auth-screen').style.display = 'none';
        loadData();
    }
});

async function loadData() {
    const snap = await getDocs(collection(db, "catalogo"));
    const raw = snap.docs.map(d => d.data());

    // --- LÓGICA DE AGRUPACIÓN DE ANIME ---
    allItems = raw.map(item => {
        // Si el género o la categoría indica que es anime, lo movemos a "Anime"
        if (item.genre_ids?.includes(16) || item.isAnime) {
            item.category = "Anime";
        }
        return item;
    });

    setHero();
    renderGrid('all');
}

function setHero() {
    const featured = allItems[Math.floor(Math.random() * allItems.length)];
    if (featured) {
        const hero = document.getElementById('hero');
        hero.style.backgroundImage = `linear-gradient(to top, var(--black), transparent), url(${featured.backdrop || featured.poster})`;
        hero.innerHTML = `
            <div class="hero-content">
                <h1 style="font-family:'Bebas Neue'; font-size: clamp(40px, 8vw, 80px); margin:0;">${featured.title}</h1>
                <p style="max-width: 600px; color: #ccc; font-size: 14px;">${featured.plot?.substring(0, 150)}...</p>
                <button class="btn-main" style="width:auto; padding: 12px 30px;">VER AHORA</button>
            </div>
        `;
    }
}

function renderGrid(filter) {
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";

    // Si filtramos por "all", mostramos filas por categorías
    const categories = filter === 'all' ? ['Peliculas', 'Series', 'Anime'] : [filter];

    categories.forEach(cat => {
        const filtered = allItems.filter(i => i.category === cat);
        if (filtered.length === 0) return;

        let html = `<div class="section-title">${cat}</div><div class="grid">`;
        filtered.forEach(item => {
            const label = item.category === 'Series' ? `${item.seasons} Temp` : item.year;
            html += `
                <div class="card">
                    <span class="badge">${label}</span>
                    <img src="${item.poster}" loading="lazy">
                    <div class="card-overlay">
                        <div class="card-title">${item.title}</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
}

// Controladores de interfaz
window.filterCat = (btn, cat) => {
    document.querySelectorAll('.n-link').forEach(l => l.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderGrid(cat);
    window.scrollTo({top: cat === 'all' ? 0 : 400, behavior: 'smooth'});
};

window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
});

window.doSearch = (q) => {
    // Lógica de búsqueda que oculta/muestra tarjetas
    const query = q.toLowerCase();
    document.querySelectorAll('.card').forEach(card => {
        const title = card.querySelector('.card-title').innerText.toLowerCase();
        card.style.display = title.includes(query) ? "block" : "none";
    });
};