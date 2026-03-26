import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── CONFIGURACIÓN (Tus credenciales actuales) ──
const FB_CONFIG = {
    apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
    authDomain: "mipunto-e32c9.firebaseapp.com",
    projectId: "mipunto-e32c9",
    storageBucket: "mipunto-e32c9.firebasestorage.app",
    messagingSenderId: "109212632970",
    appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const app = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const MOD_EMAIL = "bambuman98@gmail.com"; // Tu correo para ser admin

let allItems = [], cart = [], isLogin = true, curItem = null;

// ── EXPOSICIÓN GLOBAL PARA EL HTML ──
window.toggleAuthMode = () => {
    isLogin = !isLogin;
    document.getElementById('reg-name').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnAuth').innerText = isLogin ? "INICIAR SESIÓN" : "REGISTRARME";
    document.getElementById('auth-msg').innerText = isLogin ? "Ingresa para continuar" : "Crea tu cuenta VIP";
};

window.userLogout = () => signOut(auth).then(() => location.reload());

window.closeModals = () => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.getElementById("videoBox").innerHTML = "";
};

window.overlayClose = (e, id) => { if (e.target.id === id) window.closeModals(); };

// ── AUTENTICACIÓN ──
const btnAuth = document.getElementById('btnAuth');
if(btnAuth) {
    btnAuth.onclick = async () => {
        const ph = document.getElementById('phone').value.trim();
        const ps = document.getElementById('pass').value;
        const nm = document.getElementById('reg-name').value;
        if (ph.length < 8) return alert("Número inválido");
        const mail = `+53${ph}@videoteca.com`;
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, mail, ps);
            } else {
                const res = await createUserWithEmailAndPassword(auth, mail, ps);
                await updateProfile(res.user, { displayName: nm || "Usuario" });
                location.reload();
            }
        } catch (e) { alert("Error de acceso. Verifica tus datos."); }
    };
}

onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('uName').innerText = u.displayName || "VIP";
        if (u.email === MOD_EMAIL) document.getElementById('mod-btn').style.display = 'block';
        fetchData();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

// ── CARGA DE DATOS ──
async function fetchData() {
    const snap = await getDocs(collection(db, "catalogo"));
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGrid();
}

function renderGrid() {
    const wrap = document.getElementById('sections-wrapper');
    if (!allItems.length) {
        wrap.innerHTML = "<p style='text-align:center; padding:50px;'>No hay contenido disponible en la base de datos.</p>";
        return;
    }
    
    // Agrupar por categorías
    const cats = [...new Set(allItems.map(i => i.category))];
    wrap.innerHTML = cats.map(cat => `
        <section class="section-container">
            <h2 class="section-title">${cat}</h2>
            <div class="grid">
                ${allItems.filter(i => i.category === cat).map(i => `
                    <div class="card" onclick="window.openDetails('${i.id}')">
                        <img src="${i.poster}" alt="${i.title}">
                        <div class="card-label">${i.title}</div>
                    </div>
                `).join('')}
            </div>
        </section>
    `).join('');
}

window.openDetails = (id) => {
    curItem = allItems.find(x => x.id === id);
    if (!curItem) return;
    document.getElementById("mTitle").innerText = curItem.title;
    document.getElementById("mDesc").innerText = curItem.plot || "Sin descripción.";
    document.getElementById("videoBox").innerHTML = `<img src="${curItem.backdrop || curItem.poster}" style="width:100%;height:100%;object-fit:cover">`;
    document.getElementById("modal-details").classList.add("active");
};