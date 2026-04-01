/* ── Lógica v6 Mantenida ── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Mantengo tus constantes de categorías y lógica de autenticación de la v6...
// ... (Aquí va todo tu código de window.syncCart, window.addDirect, etc.)

// --- NUEVA FUNCIÓN: LIMPIAR PEDIDOS ---
window.clearAllOrders = async () => {
    if(!confirm("¿Borrar todos los pedidos?")) return;
    const snap = await getDocs(collection(db, "pedidos"));
    const batch = snap.docs.map(d => deleteDoc(doc(db, "pedidos", d.id)));
    await Promise.all(batch);
};

// --- NUEVA FUNCIÓN: NOTICIAS ---
window.publishNews = async () => {
    const msg = document.getElementById("mod-news-input").value;
    if(!msg) return;
    await setDoc(doc(db, "config", "noticias"), { msg, date: serverTimestamp() });
    alert("Noticia publicada");
};

// Escuchar noticias para poner el punto rojo
onSnapshot(doc(db, "config", "noticias"), (s) => {
    if(s.exists()){
        document.getElementById("news-content").textContent = s.data().msg;
        document.getElementById("news-dot").style.display = "block";
    }
});

// --- LÓGICA DE LOGIN ORIGINAL v6 ---
// Se mantiene igual para no perder tus usuarios actuales.
// ... (resto del script.js original)
