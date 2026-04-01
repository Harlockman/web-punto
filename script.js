import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const FB = {
  apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
  authDomain: "mipunto-e32c9.firebaseapp.com",
  projectId: "mipunto-e32c9",
  storageBucket: "mipunto-e32c9.firebasestorage.app",
  messagingSenderId: "109212632970",
  appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const app = initializeApp(FB);
const auth = getAuth(app);
const db = getFirestore(app);

let isReg = false;

// --- LOGIN / REGISTRO ---
document.getElementById("toggleAuth").onclick = () => {
  isReg = !isReg;
  document.getElementById("reg-name").style.display = isReg ? "block" : "none";
  document.getElementById("btnAuth").textContent = isReg ? "CREAR CUENTA" : "INICIAR SESIÓN";
  document.getElementById("toggleAuth").innerHTML = isReg ? "¿Ya tienes cuenta? <b>Entra aquí</b>" : "¿No tienes cuenta? <b>Regístrate aquí</b>";
};

document.getElementById("btnAuth").onclick = async () => {
  const phone = document.getElementById("phone").value;
  const pass = document.getElementById("pass").value;
  const email = `${phone}@videoteca.com`;
  const err = document.getElementById("auth-err");

  try {
    if (isReg) {
      const name = document.getElementById("reg-name").value;
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (e) {
    err.textContent = "Error: Datos incorrectos.";
  }
};

onAuthStateChanged(auth, (user) => {
  document.getElementById("auth-screen").style.display = user ? "none" : "flex";
  document.getElementById("app").style.display = user ? "block" : "none";
  if (user) {
    document.getElementById("btn-mod").style.display = (user.email === "moderador@videotecavip.com") ? "block" : "none";
    loadData();
  }
});

// --- FUNCIONES APP ---
document.getElementById("btn-search-toggle").onclick = () => {
  document.getElementById("si").classList.toggle("active");
  document.getElementById("si").focus();
};

document.getElementById("btn-cart-open").onclick = () => document.getElementById("ov-cart").style.display = "flex";
document.getElementById("btn-news-open").onclick = () => {
  document.getElementById("ov-news").style.display = "flex";
  document.getElementById("news-dot").style.display = "none";
};
document.getElementById("btn-mod").onclick = () => document.getElementById("ov-mod").style.display = "flex";

document.querySelectorAll(".close-ov").forEach(b => {
  b.onclick = () => b.closest(".overlay").style.display = "none";
});

function loadData() {
  onSnapshot(doc(db, "config", "noticias"), (s) => {
    if (s.exists()) {
      document.getElementById("news-content").textContent = s.data().msg;
      document.getElementById("news-dot").style.display = "block";
    }
  });
}

// --- MODERADOR ---
document.getElementById("pub-news").onclick = async () => {
  const msg = document.getElementById("mod-news-input").value;
  await setDoc(doc(db, "config", "noticias"), { msg, date: serverTimestamp() });
  alert("Noticia publicada.");
};

document.getElementById("clear-orders").onclick = async () => {
  if (confirm("¿Borrar todo el inbox?")) {
    const snap = await getDocs(collection(db, "pedidos"));
    snap.forEach(async (d) => await deleteDoc(doc(db, "pedidos", d.id)));
    alert("Inbox limpio.");
  }
};
