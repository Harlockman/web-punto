import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
let cart = [];
let isReg = false;

// ── AUTH LOGIC ──
const btnAuth = document.getElementById("btnAuth");
const toggleAuth = document.getElementById("toggleAuth");
const phoneIn = document.getElementById("phone");
const passIn = document.getElementById("pass");
const nameIn = document.getElementById("reg-name");
const authErr = document.getElementById("auth-err");

toggleAuth.onclick = () => {
  isReg = !isReg;
  nameIn.style.display = isReg ? "block" : "none";
  btnAuth.textContent = isReg ? "CREAR CUENTA" : "INICIAR SESIÓN";
  toggleAuth.innerHTML = isReg ? "¿Ya tienes cuenta? <b>Entra aquí</b>" : "¿No tienes cuenta? <b>Regístrate aquí</b>";
};

btnAuth.onclick = async () => {
  const phone = phoneIn.value.trim();
  const pass = passIn.value.trim();
  const email = `${phone}@videoteca.com`;

  if(phone.length < 8 || pass.length < 6) {
    authErr.textContent = "Datos inválidos (mín. 8 dígitos y 6 carac. clave)";
    return;
  }

  try {
    if(isReg) {
      const name = nameIn.value.trim();
      if(!name) { authErr.textContent="Escribe tu nombre"; return; }
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch(e) {
    authErr.textContent = "Error: Datos incorrectos o red fallida";
  }
};

onAuthStateChanged(auth, (user) => {
  document.getElementById("auth-screen").style.display = user ? "none" : "flex";
  document.getElementById("app").style.display = user ? "block" : "none";
  if(user) {
    document.getElementById("btn-mod").style.display = (user.email === MOD_EMAIL) ? "block" : "none";
    initApp();
  }
});

// ── FUNCIONES DE LA APP ──
window.toggleSearch = () => {
  const si = document.getElementById("si");
  si.classList.toggle("active");
  if(si.classList.contains("active")) si.focus();
};

window.openOv = (id) => { 
  document.getElementById(id).style.display = "flex";
  document.getElementById(id).classList.add("open");
};
window.closeOv = (id) => {
  document.getElementById(id).style.display = "none";
  document.getElementById(id).classList.remove("open");
};

// Sincronización de pedidos y noticias igual que antes...
function initApp() {
    onSnapshot(doc(db, "config", "noticias"), (s) => {
        if(s.exists()){
            document.getElementById("news-content").textContent = s.data().msg;
            document.getElementById("news-dot").style.display = "block";
        }
    });
}
