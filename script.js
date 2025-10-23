/* ==========================================================
  🍼 Baby Shower Reveal Script - Versión completa
  ----------------------------------------------------------
  - Sincronización entre pestañas (BroadcastChannel + localStorage)
  - Sesiones: presentación → votaciones + interacción
  - Guarda nombre de usuario y evita votos duplicados
  - Chat y reacciones visibles en tiempo real
  - El anfitrión puede fijar el sexo, iniciar el conteo y revelar
  - Animaciones de confetti y globos al final
=========================================================== */

// --- Canal compartido entre pestañas para sincronizar datos ---
const canal = new BroadcastChannel("babyshower_v1");

// ID único del cliente (permite distinguir a cada participante)
const clientId = localStorage.getItem("babyshower-clientId") || Math.random().toString(36).slice(2);
localStorage.setItem("babyshower-clientId", clientId);

// Nombre del usuario
let userName = localStorage.getItem("babyshower-name") || "";

// Estado global compartido (se guarda en localStorage)
let state = JSON.parse(localStorage.getItem("babyshower-state") || "{}") || {
  voters: {},         // clientId -> {name, choice}
  messages: [],       // {id, name, text}
  reactions: [],      // {id, name, emoji, ts}
  chosenSex: null,    // "Niño" | "Niña"
  revealed: false     // si ya se hizo la revelación
};

// --- Elementos del DOM ---
const el = (id)=>document.getElementById(id);
const welcomeOverlay = el("welcome-overlay");
const presOverlay = el("presentation-overlay");
const startPresBtn = el("start-presentation-btn");
const nameInput = el("name-input");
const slides = document.querySelectorAll(".slide");
let currentSlide = 0;
const nextSlideBtn = el("next-slide-btn");
const app = el("app");
const votesDiv = el("votes");
const presenceCount = el("presence-count");
const voteHistoryEl = el("vote-history");
const messagesEl = el("messages");
const chatInput = el("chat-input");
const sendBtn = el("send-btn");
const reactionButtons = document.querySelectorAll(".reaction-option");
const reactionCountsEl = el("reaction-counts");
const hostBtn = el("host-btn");
const hostControls = el("host-controls");
const setBoyBtn = el("set-boy");
const setGirlBtn = el("set-girl");
const chosenSexEl = el("chosen-sex");
const revealBtn = el("reveal-btn");
const resetBtn = el("reset-btn");
const finalCountdown = el("final-countdown");
const countdownNumber = el("countdown-number");
const revealOverlay = el("reveal-overlay");
const revealTitle = el("reveal-title");
const revealSub = el("reveal-sub");
const confettiCanvas = el("confetti-canvas");
const balloonsLayer = el("balloons-layer");

// --- Audios ---
const audioWelcome = el("audio-welcome");
const audioSoft = el("audio-soft");
const audioCelebration = el("audio-celebration");

/* ==========================================================
   🔄 FUNCIONES DE SINCRONIZACIÓN
=========================================================== */
function guardarYTransmitir() {
  localStorage.setItem("babyshower-state", JSON.stringify(state));
  canal.postMessage({ type: 'state', state });
  renderizarTodo();
}

// Escuchar actualizaciones desde otras pestañas
canal.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg) return;
  if (msg.type === 'request_state') {
    canal.postMessage({ type: 'state', state });
  } else if (msg.type === 'state') {
    state = msg.state || state;
    localStorage.setItem("babyshower-state", JSON.stringify(state));
    renderizarTodo();
  }
};

// Pedir estado a las demás pestañas al abrir
function solicitarEstado() {
  canal.postMessage({ type: 'request_state', from: clientId });
  const s = JSON.parse(localStorage.getItem("babyshower-state") || "{}");
  if (s && Object.keys(s).length) {
    state = s;
    renderizarTodo();
  }
}

/* ==========================================================
   🎬 SECCIÓN DE PRESENTACIÓN
=========================================================== */
function mostrarSlide(i) {
  slides.forEach((el, idx) => el.classList.toggle('active', idx === i));
  currentSlide = i;
}

nextSlideBtn?.addEventListener('click', () => {
  currentSlide++;
  if (currentSlide >= slides.length) {
    presOverlay.classList.add('hidden');
    app.classList.remove('hidden');
    try { audioSoft.play(); } catch(e){}
  } else mostrarSlide(currentSlide);
});

startPresBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name && !userName) {
    alert("Por favor escribe tu nombre antes de continuar");
    return;
  }
  if (name) {
    userName = name;
    localStorage.setItem("babyshower-name", userName);
  }
  welcomeOverlay.classList.add('hidden');
  presOverlay.classList.remove('hidden');
  mostrarSlide(0);
  try { audioWelcome.play(); } catch(e){}
});

/* ==========================================================
   🗳️ SECCIÓN DE VOTACIONES
=========================================================== */
function crearBotonesVoto() {
  votesDiv.innerHTML = '';
  const opciones = ['Niño', 'Niña', '¡Sorpréndeme!'];
  opciones.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.dataset.choice = choice;
    btn.textContent = (choice === 'Niño' ? '💙 Niño' :
                      choice === 'Niña' ? '💖 Niña' : '🎁 ¡Sorpréndeme!');
    btn.addEventListener('click', () => {
      state.voters[clientId] = { name: userName || ('Invitado-' + clientId.slice(0,4)), choice, ts: Date.now() };
      guardarYTransmitir();
    });
    votesDiv.appendChild(btn);
  });
}

/* ==========================================================
   💬 CHAT EN VIVO
=========================================================== */
sendBtn.addEventListener('click', enviarMensaje);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensaje(); });

function enviarMensaje() {
  const texto = chatInput.value.trim();
  if (!texto) return;
  const nombre = userName || ('Invitado-' + clientId.slice(0,4));
  const msg = { id: Math.random().toString(36).slice(2), name: nombre, text: texto, ts: Date.now() };
  state.messages.push(msg);
  chatInput.value = '';
  guardarYTransmitir();
  mostrarReaccionFlotante("💬");
}

/* ==========================================================
   🎈 REACCIONES
=========================================================== */
reactionButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.textContent.trim();
    const nombre = userName || ('Invitado-' + clientId.slice(0,4));
    const r = { id: Date.now() + Math.random(), name: nombre, emoji, ts: Date.now() };
    state.reactions.push(r);
    guardarYTransmitir();
    mostrarReaccionFlotante(emoji);
  });
});

function mostrarReaccionFlotante(emoji) {
  const node = document.createElement('div');
  node.className = 'reaction-float';
  node.textContent = emoji;
  node.style.left = (10 + Math.random()*80) + '%';
  node.style.position = 'fixed';
  node.style.bottom = '0';
  node.style.fontSize = '2rem';
  node.style.animation = 'floatUp 3s ease forwards';
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

/* ==========================================================
   🧾 RENDERIZADO GENERAL
=========================================================== */
function renderizarMensajes() {
  messagesEl.innerHTML = '';
  state.messages.slice(-200).forEach(m => {
    const d = document.createElement('div');
    d.className = 'msg';
    d.innerHTML = `<strong>${escaparHTML(m.name)}:</strong> ${escaparHTML(m.text)}`;
    messagesEl.appendChild(d);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderizarHistorialVotos() {
  voteHistoryEl.innerHTML = '';
  Object.values(state.voters).forEach(v => {
    const d = document.createElement('div');
    d.className = 'vote-entry';
    d.textContent = `${v.name} → ${v.choice}`;
    voteHistoryEl.appendChild(d);
  });
  const totales = { 'Niño': 0, 'Niña': 0 };
  Object.values(state.voters).forEach(v => {
    if (v.choice === 'Niño') totales['Niño']++;
    else if (v.choice === 'Niña') totales['Niña']++;
  });
  presenceCount.textContent = Object.keys(state.voters).length.toString();
}

function renderizarReacciones() {
  const mapa = {};
  state.reactions.forEach(r => mapa[r.emoji] = (mapa[r.emoji] || 0) + 1);
  reactionCountsEl.textContent = Object.entries(mapa).map(([k,v]) => `${k} ${v}`).join('  ');
}

function renderizarTodo() {
  crearBotonesVoto();
  renderizarMensajes();
  renderizarHistorialVotos();
  renderizarReacciones();

  // Mostrar sexo fijado
  if (state.chosenSex) chosenSexEl.textContent = `Sexo fijado: ${state.chosenSex}`;
  else chosenSexEl.textContent = 'Sexo no fijado';

  // Si ya se reveló en otra pestaña, mostrar la animación
  if (state.revealed) {
    mostrarRevelacionFinal(state.chosenSex);
  }
}

function escaparHTML(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ==========================================================
   👑 ANFITRIÓN
=========================================================== */
hostBtn.addEventListener('click', () => {
  const pass = prompt("Contraseña de anfitrión:");
  if (pass === 'confetti') {
    hostControls.classList.remove('hidden');
    alert('✅ Controles de anfitrión activados.');
  } else {
    alert('❌ Contraseña incorrecta.');
  }
});

setBoyBtn.addEventListener('click', () => {
  state.chosenSex = 'Niño';
  guardarYTransmitir();
});
setGirlBtn.addEventListener('click', () => {
  state.chosenSex = 'Niña';
  guardarYTransmitir();
});

revealBtn.addEventListener('click', () => {
  if (!state.chosenSex) {
    alert('Debes fijar el sexo antes de iniciar la revelación.');
    return;
  }
  iniciarConteoFinal(state.chosenSex);
  state.revealed = true;
  guardarYTransmitir();
});

resetBtn.addEventListener('click', () => {
  if (!confirm('¿Reiniciar todo el evento?')) return;
  localStorage.removeItem('babyshower-state');
  state = { voters:{}, messages:[], reactions:[], chosenSex:null, revealed:false };
  guardarYTransmitir();
});

/* ==========================================================
   ⏳ CONTEO Y REVELACIÓN FINAL
=========================================================== */
function iniciarConteoFinal(sexo) {
  finalCountdown.classList.remove('hidden');
  let count = 10;
  countdownNumber.textContent = count;
  try { audioSoft.pause(); audioWelcome.pause(); } catch(e){}
  const intervalo = setInterval(() => {
    count--;
    countdownNumber.textContent = count;
    if (count <= 0) {
      clearInterval(intervalo);
      finalCountdown.classList.add('hidden');
      mostrarRevelacionFinal(sexo);
    }
  }, 1000);
}

function mostrarRevelacionFinal(sexo) {
  revealOverlay.classList.remove('hidden');
  revealTitle.textContent = `¡Es un ${sexo}!`;
  revealSub.textContent = (sexo === 'Niño') ? '💙 ¡Felicidades!' : '💖 ¡Felicidades!';
  try {
    audioSoft.pause();
    audioCelebration.currentTime = 0;
    audioCelebration.play();
  } catch(e){}
  lanzarConfetti(sexo);
  lanzarGlobos(sexo);
}

/* ==========================================================
   🎊 ANIMACIONES DE CELEBRACIÓN
=========================================================== */
function lanzarConfetti(sexo) {
  if (!confettiCanvas) return;
  const canvas = confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colores = (sexo === 'Niño') ? ['#8FD3FF','#4FA3F7','#1E6ED8'] : ['#FFD0EA','#FF8FB4','#FF5BA3'];
  const piezas = [];
  for (let i=0; i<160; i++) {
    piezas.push({
      x: Math.random()*canvas.width,
      y: Math.random()*-canvas.height,
      vx: (Math.random()-0.5)*4,
      vy: 2+Math.random()*4,
      size: 6+Math.random()*8,
      color: colores[Math.floor(Math.random()*colores.length)],
      rot: Math.random()*360
    });
  }
  function frame() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    piezas.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += 6*p.vx;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      ctx.restore();
      if (p.y > canvas.height+50) {
        p.x = Math.random()*canvas.width;
        p.y = -10;
      }
    });
    requestAnimationFrame(frame);
  }
  frame();
}

function lanzarGlobos(sexo) {
  const cont = balloonsLayer;
  cont.innerHTML = '';
  const color = (sexo === 'Niño') ? '#4fa3f7' : '#ff80c0';
  for (let i=0; i<20; i++) {
    const b = document.createElement('div');
    b.className = 'balloon';
    b.style.left = Math.random()*86 + '%';
    b.style.background = color;
    b.style.animationDuration = (5 + Math.random()*4) + 's';
    cont.appendChild(b);
    setTimeout(() => b.remove(), 8000);
  }
}

/* ==========================================================
   🚀 INICIALIZACIÓN
=========================================================== */
window.addEventListener('storage', () => {
  const s = JSON.parse(localStorage.getItem("babyshower-state") || "{}");
  if (s && Object.keys(s).length) { state = s; renderizarTodo(); }
});

solicitarEstado();
crearBotonesVoto();
renderizarTodo();

// Reproducir música suave cuando haya interacción
document.addEventListener('click', () => {
  try { audioSoft.play().catch(()=>{}); } catch(e){}
}, { once: true });
