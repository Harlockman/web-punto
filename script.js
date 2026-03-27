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

let allItems = [], isLogin = true;

// ─── LIMPIADOR DE NOMBRES PARA TMDB ───
function cleanName(name) {
    return name.replace(/\./g, ' ')
               .replace(/_/g, ' ')
               .replace(/(1080p|720p|BRRip|WEB-DL|x264|H264|Dual|Latino)/gi, '')
               .trim();
}

// ─── AUTENTICACIÓN ───
onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('uName').innerText = u.displayName || "VIP";
        loadCatalog();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

window.toggleAuthMode = () => {
    isLogin = !isLogin;
    document.getElementById('reg-name').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLogin ? "ENTRAR" : "REGISTRARME";
};

document.getElementById('btnAuth').onclick = async () => {
    const ph = document.getElementById('phone').value;
    const ps = document.getElementById('pass').value;
    const mail = `+53${ph}@videoteca.com`;
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, mail, ps);
        else {
            const res = await createUserWithEmailAndPassword(auth, mail, ps);
            await updateProfile(res.user, { displayName: document.getElementById('reg-name').value });
            location.reload();
        }
    } catch (e) { alert("Error de acceso"); }
};

window.userLogout = () => signOut(auth).then(() => location.reload());

// ─── CARGA Y AGRUPACIÓN INTELIGENTE ───
async function loadCatalog() {
    const snap = await getDocs(collection(db, "catalogo"));
    const rawData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Eliminar duplicados reales por tmdb_id
    const uniqueMap = new Map();
    rawData.forEach(item => {
        const key = item.tmdb_id || item.title;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        } else {
            // Si es serie, sumar temporadas si vienen por separado
            if (item.category === "Series") {
                uniqueMap.get(key).seasons = Math.max(uniqueMap.get(key).seasons || 1, item.seasons || 1);
            }
        }
    });

    allItems = Array.from(uniqueMap.values());
    renderGrid('all');
}

function renderGrid(filter) {
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";

    const cats = ["Peliculas", "Series"];
    cats.forEach(cat => {
        if (filter !== 'all' && filter !== cat) return;
        
        const list = allItems.filter(i => i.category === cat);
        if (list.length === 0) return;

        let html = `<div class="section-title">${cat}</div><div class="grid">`;
        
        list.forEach(item => {
            // Badge dinámico
            let badge = "";
            if (item.category === "Series") badge = `<span class="badge-group">${item.seasons || 1} Temp</span>`;
            if (item.saga) badge = `<span class="badge-group badge-saga">SAGA</span>`;

            html += `
                <div class="card">
                    ${badge}
                    <img src="${item.poster}" loading="lazy">
                    <div class="card-info">
                        <b>${item.title}</b><br>
                        <span style="color:#888">${item.year || ''}</span>
                    </div>
                </div>`;
        });
        
        html += `</div>`;
        container.innerHTML += html;
    });
}

// ─── BUSCADOR ───
window.doSearch = (q) => {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const title = card.querySelector('b').innerText.toLowerCase();
        card.style.display = title.includes(q.toLowerCase()) ? "" : "none";
    });
};

window.filterCat = (btn, cat) => {
    document.querySelectorAll('.nav-cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(cat);
};