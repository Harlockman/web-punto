import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TUS CREDENCIALES ORIGINALES
const firebaseConfig = {
  apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
  authDomain: "mipunto-e32c9.firebaseapp.com",
  projectId: "mipunto-e32c9",
  storageBucket: "mipunto-e32c9.firebasestorage.app",
  messagingSenderId: "109212632970",
  appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let _orderCode = "";
let cart = [];

// Función para actualizar el nombre en toda la web
function applyBranding(name) {
    const n = name || "VideoTeca VIP";
    document.title = n;
    document.querySelectorAll("#main-logo, #auth-logo").forEach(el => {
        el.innerHTML = `${n.toUpperCase()}`;
    });
}

// Sincronización Real-Time del Carrito
window.syncCart = async () => {
    const list = document.getElementById("cart-list");
    let total = 0;
    list.innerHTML = "";

    cart.forEach((item, i) => {
        const unit = item.precio_por_cap || item.precio || 0;
        const sub = item.qty ? (unit * item.qty) : unit;
        total += sub;
        list.innerHTML += `
            <div class="order-line">
                <b>${item.title}</b> ${item.qty ? `(${item.qty} caps)` : ''}
                <span style="float:right">${sub} CUP <button onclick="removeFromCart(${i})">✕</button></span>
            </div>`;
    });

    document.getElementById("cart-total").textContent = total;

    if (cart.length > 0) {
        if(!_orderCode) _orderCode = "VT-" + Math.random().toString(36).substr(2, 5).toUpperCase();
        document.getElementById("order-id-box").style.display = "block";
        document.getElementById("order-id-val").textContent = _orderCode;

        // Auto-guardar pedido en Firebase (Sincronización en tiempo real)
        await setDoc(doc(db, "pedidos", _orderCode), {
            cliente: auth.currentUser.displayName || "Usuario",
            items: cart,
            total: total,
            date: serverTimestamp()
        });
    }
};

// Función para añadir directo desde el "+"
window.addDirect = (id, e) => {
    e.stopPropagation();
    // Aquí buscarías en tu array de items cargados (db_items)
    const item = window.db_items?.find(x => x.id === id);
    if(item) {
        cart.push({...item});
        syncCart();
    }
};

// Moderador: Limpiar Inbox
window.clearAllOrders = async () => {
    if(!confirm("¿Eliminar todos los pedidos recibidos?")) return;
    const snap = await getDocs(collection(db, "pedidos"));
    snap.forEach(async (d) => await deleteDoc(doc(db, "pedidos", d.id)));
    alert("Inbox vacío.");
};

// Moderador: Noticias
window.publishNews = async () => {
    const msg = document.getElementById("mod-news-input").value;
    if(!msg) return;
    await setDoc(doc(db, "config", "noticias"), { msg, date: serverTimestamp() });
    alert("Noticia publicada a los clientes.");
};

// Escuchar Noticias (Campanita)
onSnapshot(doc(db, "config", "noticias"), (s) => {
    if(s.exists()){
        document.getElementById("news-content").textContent = s.data().msg;
        document.getElementById("news-dot").style.display = "block";
    }
});

// Escuchar Configuración de Negocio
onSnapshot(doc(db, "config", "negocio"), (s) => {
    if(s.exists()) {
        const d = s.data();
        applyBranding(d.nombre);
        document.getElementById("cart-neg-info").innerHTML = `Recoger en: ${d.dir}<br>Tel: ${d.tel}`;
    }
});

// Buscador
window.toggleSearch = () => {
    const input = document.getElementById("si");
    input.classList.toggle("active");
    if(input.classList.contains("active")) input.focus();
};

// (Resto de funciones de auth y tabs omitidas por brevedad, pero usa las de tu archivo original)
