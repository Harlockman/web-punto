import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const MOD_EMAIL = "moderador@videotecavip.com";
let isReg = false;

// ── MANEJO DE LOGIN ──
const btnAuth = document.getElementById("btnAuth");
const toggleAuth = document.getElementById("toggleAuth");
const authErr = document.getElementById("auth-err");

toggleAuth.onclick = () => {
    isReg = !isReg;
    document.getElementById("reg-name").style.display = isReg ? "block" : "none";
    btnAuth.textContent = isReg ? "CREAR CUENTA" : "INICIAR SESIÓN";
    toggleAuth.innerHTML = isReg ? "¿Ya tienes cuenta? <b>Entra aquí</b>" : "¿No tienes cuenta? <b>Regístrate aquí</b>";
};

btnAuth.onclick = async () => {
    authErr.textContent = "";
    const phone = document.getElementById("phone").value.trim();
    const pass = document.getElementById("pass").value.trim();
    const email = `${phone}@videoteca.com`;

    if(phone.length < 8 || pass.length < 6) {
        authErr.textContent = "Datos incompletos"; return;
    }

    try {
        if(isReg) {
            const name = document.getElementById("reg-name").value.trim();
            if(!name) { authErr.textContent = "Falta el nombre"; return; }
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name });
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch(e) {
        authErr.textContent = "Error de acceso: Verifica tus datos";
    }
};

onAuthStateChanged(auth, (user) => {
    document.getElementById("auth-screen").style.display = user ? "none" : "flex";
    document.getElementById("app").style.display = user ? "block" : "none";
    if(user) {
        document.getElementById("btn-mod").style.display = (user.email === MOD_EMAIL) ? "block" : "none";
        loadConfig();
    }
});

// ── LOGICA DE UI ──
document.querySelectorAll(".close-ov").forEach(btn => {
    btn.onclick = (e) => e.target.closest(".overlay").style.display = "none";
});

document.getElementById("btn-search-toggle").onclick = () => {
    const si = document.getElementById("si");
    si.classList.toggle("active");
    if(si.classList.contains("active")) si.focus();
};

document.getElementById("btn-cart-open").onclick = () => document.getElementById("ov-cart").style.display = "flex";
document.getElementById("btn-news-open").onclick = () => {
    document.getElementById("ov-news").style.display = "flex";
    document.getElementById("news-dot").style.display = "none";
};
document.getElementById("btn-mod").onclick = () => document.getElementById("ov-mod").style.display = "flex";

// ── MODERADOR Y CONFIG ──
function loadConfig() {
    // Escuchar nombre del negocio
    onSnapshot(doc(db, "config", "negocio"), (s) => {
        if(s.exists()){
            const d = s.data();
            document.title = d.nombre || "VideoTeca VIP";
            document.getElementById("main-logo-ui").innerHTML = (d.nombre || "VideoTeca VIP").toUpperCase();
            document.getElementById("auth-logo-ui").innerHTML = (d.nombre || "VideoTeca VIP").toUpperCase();
        }
    });
    // Escuchar noticias
    onSnapshot(doc(db, "config", "noticias"), (s) => {
        if(s.exists()){
            document.getElementById("news-content").textContent = s.data().msg;
            document.getElementById("news-dot").style.display = "block";
        }
    });
}

// Publicar noticia
document.getElementById("pub-news-btn").onclick = async () => {
    const msg = document.getElementById("mod-news-input").value;
    await setDoc(doc(db, "config", "noticias"), { msg, date: serverTimestamp() });
    alert("Publicado");
};

// Limpiar pedidos
document.getElementById("clear-orders-btn").onclick = async () => {
    if(!confirm("¿Borrar todo el inbox?")) return;
    const snap = await getDocs(collection(db, "pedidos"));
    const batch = snap.docs.map(d => deleteDoc(doc(db, "pedidos", d.id)));
    await Promise.all(batch);
    alert("Inbox limpio");
};
