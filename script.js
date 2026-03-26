import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── CONFIGURACIÓN ──────────────────────────────────────────
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

let allItems = [], cart = [], isLogin = true, curItem = null;

// ── AUTENTICACIÓN (CORREGIDA) ──────────────────────────────
const btnAuth = document.getElementById("btnAuth");
if(btnAuth) {
    btnAuth.onclick = async () => {
        const ph = document.getElementById("phone").value.trim();
        const ps = document.getElementById("pass").value;
        const nm = document.getElementById("reg-name").value.trim();

        if (ph.length < 8) return alert("Número móvil no válido (mínimo 8 dígitos)");
        const mail = `+53${ph}@videoteca.com`;

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, mail, ps);
            } else {
                if (!nm) return alert("Por favor, ingresa tu nombre");
                const res = await createUserWithEmailAndPassword(auth, mail, ps);
                await updateProfile(res.user, { displayName: nm });
                location.reload();
            }
        } catch (e) {
            alert("Error de acceso: Verifica tus datos.");
            console.error(e);
        }
    };
}

// ── CARGA DE DATOS ─────────────────────────────────────────
async function loadData() {
    try {
        const snap = await getDocs(collection(db, "catalogo"));
        allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Aquí llamarías a tu función de renderizado original
        if (typeof renderApp === "function") renderApp(); 
        else console.log("Catálogo cargado:", allItems.length, "ítems");
    } catch (e) {
        console.error("Error cargando base de datos:", e);
    }
}

// ── FUNCIONES GLOBALES (ACCESIBLES DESDE EL HTML) ──────────
window.openDetails = (id) => {
    curItem = allItems.find(x => x.id === id);
    if (!curItem) return;

    document.getElementById("mTitle").innerText = curItem.title;
    document.getElementById("mDesc").innerText = curItem.plot || "Sin descripción disponible.";
    
    const box = document.getElementById("videoBox");
    // Imagen de respaldo mientras no se da al play
    box.innerHTML = `<img src="${curItem.backdrop || curItem.poster}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;

    document.getElementById("modal-details").classList.add("active");

    // Configurar botón de tráiler dentro del modal
    const btnT = document.getElementById("btnTrailer");
    if(btnT) {
        btnT.onclick = () => {
            if (!curItem.trailerId) return alert("Tráiler no disponible para este título");
            box.innerHTML = `<iframe src="https://www.youtube.com/embed/${curItem.trailerId}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:100%;border:none"></iframe>`;
        };
    }
};

window.closeModals = () => {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    document.getElementById("videoBox").innerHTML = ""; // Detener video
};

window.userLogout = () => signOut(auth).then(() => location.reload());

window.toggleAuth = () => {
    isLogin = !isLogin;
    document.getElementById("reg-name").style.display = isLogin ? "none" : "block";
    document.getElementById("btnAuth").innerText = isLogin ? "INICIAR SESIÓN" : "CREAR CUENTA";
    document.getElementById("auth-msg").innerText = isLogin ? "Ingresa tus datos para entrar" : "Regístrate en VideoTeca VIP";
};

// ── ESTADO DE LA SESIÓN ────────────────────────────────────
onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById("auth-screen").style.display = "none";
        const uName = document.getElementById("uName");
        if(uName) uName.innerText = u.displayName || "Usuario VIP";
        loadData();
    } else {
        document.getElementById("auth-screen").style.display = "flex";
    }
});

// Vincular el toggle de registro
const tgl = document.getElementById("toggleAuth");
if(tgl) tgl.onclick = window.toggleAuth;