import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, updateProfile, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export function initAuth(appFirebase, readyCallback) {
  const auth = getAuth(appFirebase);
  const root = document.getElementById('auth-root');

  // Inyectamos el HTML del login si no hay sesión
  root.innerHTML = `
    <div id="auth-screen">
      <div class="auth-card">
        <div class="auth-logo" style="font-family:'Bebas Neue'; font-size:45px; color:#e50914;">VIDEOTECA<span>VIP</span></div>
        <div id="auth-inputs">
          <input type="text" id="reg-name" placeholder="Nombre completo" style="display:none"/>
          <input type="number" id="phone" placeholder="Móvil (8 dígitos)"/>
          <input type="password" id="pass" placeholder="Contraseña"/>
          <div id="auth-err" style="color:#ff6b6b; font-size:12px; margin:10px 0;"></div>
          <button id="btnAuth" class="btn-red" style="width:100%; padding:12px; background:#e50914; border:none; color:white; font-weight:bold; cursor:pointer;">ENTRAR</button>
          <p id="toggleAuth" style="margin-top:15px; font-size:13px; cursor:pointer; color:#b3b3b3;">¿No tienes cuenta? <b>Regístrate aquí</b></p>
        </div>
      </div>
    </div>`;

  const btnAuth = document.getElementById("btnAuth");
  const toggle = document.getElementById("toggleAuth");
  let isRegister = false;

  toggle.onclick = () => {
    isRegister = !isRegister;
    document.getElementById("reg-name").style.display = isRegister ? "block" : "none";
    btnAuth.innerText = isRegister ? "CREAR CUENTA" : "ENTRAR";
    toggle.innerHTML = isRegister ? "¿Ya tienes cuenta? <b>Inicia sesión</b>" : "¿No tienes cuenta? <b>Regístrate aquí</b>";
  };

  btnAuth.onclick = async () => {
    const ph = document.getElementById("phone").value.trim();
    const ps = document.getElementById("pass").value;
    const nm = document.getElementById("reg-name").value.trim();
    const email = `user${ph}@videotecavip.com`;

    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, ps);
        await updateProfile(cred.user, { displayName: nm });
      } else {
        await signInWithEmailAndPassword(auth, email, ps);
      }
    } catch (e) {
      document.getElementById("auth-err").innerText = "Error: Datos incorrectos";
    }
  };

  // Observador de estado: decide qué mostrar
  onAuthStateChanged(auth, (user) => {
    if (user) {
      root.style.display = "none";
      document.getElementById("app").style.display = "block";
      readyCallback(user); // Llama a la lógica de script.js
    } else {
      root.style.display = "flex";
      document.getElementById("app").style.display = "none";
    }
  });

  return auth;
}