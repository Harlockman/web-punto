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
let _orderCode = "";
let cart = [];

// --- BRANDING DINÁMICO ---
function updateBranding(name) {
    const brand = name || "VideoTeca VIP";
    document.title = brand;
    document.getElementById("main-logo-ui").innerHTML = brand.toUpperCase();
    document.getElementById("auth-logo-ui").innerHTML = brand.toUpperCase();
}

// --- CARRITO REAL-TIME ---
window.syncCart = async () => {
    const list = document.getElementById("cart-list");
    let total = 0;
    list.innerHTML = "";

    cart.forEach((item, i) => {
        const unit = item.precio_por_cap || item.precio || 0;
        const sub = item.qty ? (unit * item.qty) : unit;
        total += sub;
        list.innerHTML += `
            <div style="padding:10px 0; border-bottom:1px solid #333; font-size:14px">
                <b>${item.title}</b> ${item.qty ? `(${item.qty} caps)` : ''}
                <div style="color:var(--red); font-weight:bold">${sub} CUP 
                <button onclick="removeFromCart(${i})" style="float:right; background:none; border:none; color:#fff; cursor:pointer">✕</button></div>
            </div>`;
    });

    document.getElementById("cart-total").textContent = total;

    if (cart.length > 0) {
        if(!_orderCode) _orderCode = "VT-" + Math.random().toString(36).substr(2, 5).toUpperCase();
        document.getElementById("order-id-box").style.display = "block";
        document.getElementById("order-id-val").textContent = _orderCode;

        await setDoc(doc(db, "pedidos", _orderCode), {
            cliente: auth.currentUser.displayName,
            items: cart,
            total: total,
            timestamp: serverTimestamp()
        });
    }
};

window.addDirect = (id, e) => {
    e.stopPropagation();
    const item = window.db_items?.find(x => x.id === id);
    if(item) { cart.push({...item}); window.syncCart(); }
};

// --- MODERADOR: LIMPIAR PEDIDOS ---
window.clearAllOrders = async () => {
    if(!confirm("¿Deseas eliminar todos los pedidos del inbox?")) return;
    const snap = await getDocs(collection(db, "pedidos"));
    const batch = snap.docs.map(d => deleteDoc(doc(db, "pedidos", d.id)));
    await Promise.all(batch);
};

// --- NOTICIAS ---
window.publishNews = async () => {
    const msg = document.getElementById("mod-news-input").value;
    if(!msg) return;
    await setDoc(doc(db, "config", "noticias"), { msg, date: serverTimestamp() });
    alert("Noticia enviada");
};

onSnapshot(doc(db, "config", "noticias"), (s) => {
    if(s.exists()){
        document.getElementById("news-content").textContent = s.data().msg;
        document.getElementById("news-dot").style.display = "block";
    }
});

// --- SESIÓN Y LOGIN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("auth-screen").style.display = "none";
        document.getElementById("app").style.display = "block";
        document.getElementById("btn-mod").style.display = (user.email === MOD_EMAIL) ? "block" : "none";
        
        // Cargar pedidos para el moderador en una sola línea por item
        if(user.email === MOD_EMAIL) {
            onSnapshot(query(collection(db, "pedidos"), orderBy("timestamp", "desc")), (snap) => {
                const container = document.getElementById("orders-list");
                container.innerHTML = snap.docs.map(d => {
                    const o = d.data();
                    return `<div class="order-card">
                        <div style="font-size:12px; margin-bottom:5px"><b>${o.cliente}</b> (#${d.id})</div>
                        ${o.items.map(it => `<span class="order-item-line">• ${it.title} ${it.qty||''}</span>`).join('')}
                        <div style="text-align:right; font-weight:bold; color:var(--red)">${o.total} CUP</div>
                    </div>`;
                }).join('');
            });
        }
    } else {
        document.getElementById("auth-screen").style.display = "flex";
        document.getElementById("app").style.display = "none";
    }
});

// Listener de configuración de negocio
onSnapshot(doc(db, "config", "negocio"), (s) => {
    if(s.exists()){
        const d = s.data();
        updateBranding(d.nombre);
        document.getElementById("cart-neg-info").innerHTML = `<b>Recoger en:</b> ${d.dir}<br><b>WhatsApp:</b> ${d.tel}`;
    }
});

// (Aquí incluirías el resto de las funciones de abrir/cerrar overlays que ya tenías)
