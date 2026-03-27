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
let isLogin = true;

// HACER FUNCIONES GLOBALES
window.toggleAuthMode = () => {
    isLogin = !isLogin;
    document.getElementById('reg-name').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLogin ? "ENTRAR" : "REGISTRARME";
};

window.userLogout = () => signOut(auth).then(() => location.reload());

window.filterCat = (btn, cat) => {
    document.querySelectorAll('.m-item').forEach(m => m.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderGrid(cat);
};

// AUTH LOGIC
document.getElementById('btnAuth').onclick = async () => {
    const ph = document.getElementById('phone').value;
    const ps = document.getElementById('pass').value;
    const mail = `+53${ph}@videoteca.com`;
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, mail, ps);
        else {
            const nm = document.getElementById('reg-name').value;
            const res = await createUserWithEmailAndPassword(auth, mail, ps);
            await updateProfile(res.user, { displayName: nm });
            location.reload();
        }
    } catch (e) { alert("Error: Datos incorrectos"); }
};

onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('uName').innerText = u.displayName || "Usuario";
        loadData();
    }
});

async function loadData() {
    const snap = await getDocs(collection(db, "catalogo"));
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Clasificación automática de Anime
    allItems = allItems.map(item => {
        if (item.isAnime || (item.genre_ids && item.genre_ids.includes(16))) {
            item.category = "Anime";
        }
        return item;
    });

    renderHero();
    renderGrid('all');
}

function renderHero() {
    const h = document.getElementById('hero');
    if (allItems.length === 0) return;
    const pick = allItems[Math.floor(Math.random() * allItems.length)];
    h.style.backgroundImage = `url(${pick.backdrop || pick.poster})`;
    h.innerHTML = `<div style="position:relative; z-index:2; max-width:600px;">
        <h1 style="font-family:'Bebas Neue'; font-size:4rem; line-height:1;">${pick.title}</h1>
        <p style="color:#ccc; margin:15px 0;">${pick.plot ? pick.plot.substring(0, 150) + '...' : ''}</p>
        <button class="btn-red" style="width:auto; padding:10px 30px;">▶ VER AHORA</button>
    </div>`;
}

function renderGrid(filter) {
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";
    const cats = filter === 'all' ? ['Peliculas', 'Series', 'Anime'] : [filter];

    cats.forEach(cat => {
        const list = allItems.filter(i => i.category === cat);
        if (list.length === 0) return;

        let html = `<div class="section-title">${cat}</div><div class="grid">`;
        list.forEach(item => {
            const label = item.category === 'Series' || item.category === 'Anime' ? `${item.seasons || 1} Temp` : item.year;
            html += `
                <div class="card">
                    <span class="badge">${label}</span>
                    <img src="${item.poster}" loading="lazy">
                    <div class="card-name">${item.title}</div>
                </div>`;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
}