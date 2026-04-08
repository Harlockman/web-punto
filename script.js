import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initAuth } from "./auth.js";

const FB_CONFIG = {
  apiKey: "AIzaSyDh7oTJqWg9yo87iCQvJCTMGOAy82AFC94",
  authDomain: "mipunto-e32c9.firebaseapp.com",
  projectId: "mipunto-e32c9",
  storageBucket: "mipunto-e32c9.firebasestorage.app",
  messagingSenderId: "109212632970",
  appId: "1:109212632970:web:d57a11a01f5365fad0aa73"
};

const app = initializeApp(FB_CONFIG);
const db = getFirestore(app);

// Inicializar Auth y arrancar la app solo cuando haya usuario
const auth = initAuth(app, (user) => {
  console.log("App cargada para:", user.displayName);
  cargarContenido();
});

async function cargarContenido() {
  const sectionsEl = document.getElementById("sections");
  sectionsEl.innerHTML = "<p style='padding:20px'>Cargando catálogo...</p>";

  try {
    const q = query(collection(db, "peliculas"), orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      sectionsEl.innerHTML = "<p style='padding:20px'>No hay películas disponibles aún.</p>";
      return;
    }

    let html = `<div class="cardgrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:15px; padding:20px;">`;
    
    snapshot.forEach(doc => {
      const p = doc.data();
      html += `
        <div class="card" style="background:#1a1a1a; border-radius:8px; overflow:hidden;">
          <img src="${p.poster}" style="width:100%; aspect-ratio:2/3; object-fit:cover;">
          <div style="padding:10px; font-size:14px;">${p.titulo}</div>
        </div>`;
    });
    
    html += `</div>`;
    sectionsEl.innerHTML = html;
  } catch (error) {
    console.error(error);
    sectionsEl.innerHTML = "<p style='padding:20px'>Error al conectar con la base de datos.</p>";
  }
}

// Función global para el botón de salida
window.logout = () => auth.signOut();