import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let allItems = [];

// ── DINAMISMO DEL NOMBRE DEL NEGOCIO ──
window.saveNegocio = async () => {
    const name = document.getElementById("neg-nombre").value;
    if(!name) return;
    await setDoc(doc(db, "config", "business"), { name }, { merge: true });
    updateUIName(name);
    alert("✓ Nombre del negocio actualizado");
};

function updateUIName(name) {
    if(!name) return;
    document.title = name + " VIP";
    document.getElementById("nav-logo-display").textContent = name;
    document.getElementById("auth-logo-display").innerHTML = `${name}<span>VIP</span>`;
}

// ── GESTIÓN DE NOTICIAS ──
window.saveNews = async () => {
    const text = document.getElementById("mod-news-input").value;
    if(!text) return;
    await setDoc(doc(db, "config", "news"), { msg: text, date: Date.now() });
    alert("✓ Noticia publicada");
};

window.openNews = async () => {
    const d = await getDoc(doc(db, "config", "news"));
    if(d.exists()) {
        document.getElementById("news-content").textContent = d.data().msg;
        document.getElementById("ov-news").classList.add("open");
    } else {
        alert("No hay noticias nuevas.");
    }
};

// ── LIMPIAR PEDIDOS (INBOX) ──
window.clearAllOrders = async () => {
    if(!confirm("¿Estás seguro de eliminar TODOS los pedidos recibidos?")) return;
    const qSnap = await getDocs(collection(db, "pedidos"));
    const batch = writeBatch(db);
    qSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Inbox vaciado correctamente.");
};

// ── LISTADO DE PRECIOS PARA CLIENTES ──
window.openPriceList = async () => {
    const d = await getDoc(doc(db, "config", "precios"));
    const wrap = document.getElementById("prices-display-list");
    wrap.innerHTML = "";
    if(d.exists()) {
        const p = d.data();
        for(let k in p) {
            wrap.innerHTML += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333">
                <span>${k}</span><b>$${p[k]}</b>
            </div>`;
        }
    }
    document.getElementById("ov-prices").classList.add("open");
};

// ── LÓGICA DE PEDIDOS EN LÍNEAS ──
function renderOrders(orders) {
    const list = document.getElementById("order-list");
    list.innerHTML = "";
    orders.forEach(o => {
        const itemsHtml = o.items.map(it => `<span class="order-line-item">• ${it.title} (${it.type})</span>`).join("");
        list.innerHTML += `
            <div class="order-card" style="background:#222;padding:15px;margin-bottom:10px;border-radius:8px">
                <p><b>Cliente:</b> ${o.userName} - ${o.userPhone}</p>
                <div style="margin:10px 0">${itemsHtml}</div>
                <p><b>Total:</b> $${o.total}</p>
            </div>`;
    });
}

// ── FUNCIÓN AÑADIR DIRECTO (Botón +) ──
window.quickAdd = (id) => {
    const item = allItems.find(x => x.id === id);
    if(item) {
        // Aquí llamas a tu función addToCart existente
        // addToCart(item, 1, 'unidad');
        console.log("Añadido directamente:", item.title);
        alert("Añadido al pedido: " + item.title);
    }
};

// ── BUSCADOR CON DESPLAZAMIENTO ──
window.toggleSearch = () => {
    const wrap = document.getElementById("search-wrap");
    wrap.classList.toggle("active");
    if(wrap.classList.contains("active")) document.getElementById("search-input").focus();
};

// ── INICIALIZACIÓN ──
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Escuchar cambios de nombre de negocio en tiempo real
    onSnapshot(doc(db, "config", "business"), d => {
        if(d.exists()) updateUIName(d.data().name);
    });
    // Activar iconos
    lucide.createIcons();
  }
});

// Importante: No olvides incluir tus funciones de filterCat, doSearch, etc. que ya tenías.
