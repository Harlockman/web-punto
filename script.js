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

// --- EXPORTAR A WINDOW PARA EL HTML ---
window.toggleAuthMode = () => {
    isLogin = !isLogin;
    document.getElementById('reg-name').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLogin ? "INICIAR SESIÓN" : "REGISTRARME";
};

window.userLogout = () => signOut(auth).then(() => location.reload());

window.filterCat = (btn, cat) => {
    document.querySelectorAll('.nav-cat').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(cat);
};

window.showAll = () => renderGrid('all');

// --- LÓGICA DE ACCESO ---
document.getElementById('btnAuth').onclick = async () => {
    const ph = document.getElementById('phone').value;
    const ps = document.getElementById('pass').value;
    const mail = `+53${ph}@videoteca.com`;
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, mail, ps);
        else {
            const res = await createUserWithEmailAndPassword(auth, mail, ps);
            const nm = document.getElementById('reg-name').value;
            await updateProfile(res.user, { displayName: nm });
            location.reload();
        }
    } catch (e) { alert("Error: Revisa tus datos"); }
};

onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('uName').innerText = u.displayName || "VIP";
        fetchData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

// --- CARGA DE DATOS ---
async function fetchData() {
    const s = await getDocs(collection(db, "catalogo"));
    allItems = s.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid('all');
}

function renderGrid(cat) {
    const container = document.getElementById('catalog-container');
    const filtered = (cat === 'all') ? allItems : allItems.filter(i => i.category === cat);
    
    container.innerHTML = `<div class="grid">
        ${filtered.map(i => `
            <div class="card">
                <img src="${i.poster}">
                <div class="card-title">${i.title}</div>
            </div>
        `).join('')}
    </div>`;
}

document.getElementById('toggleAuth').onclick = window.toggleAuthMode;