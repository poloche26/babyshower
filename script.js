/* script.js
   ===============================
   Funcionalidades principales:
   - Sincronización entre pestañas (BroadcastChannel + localStorage)
   - Flujo de presentación por sesiones (presentación -> votación -> interacción)
   - Gestión de nombres y votos únicos por cliente
   - Chat en tiempo real y reacciones flotantes
   - Controles para el anfitrión (con contraseña 'confetti')
   - Fijación del sexo, cuenta regresiva y revelación final con confeti y globos
   - Integración de música en tres etapas: bienvenida, fondo suave e inicio de celebración
   ===============================
*/

// --- Sincronización entre pestañas ---
const channel = new BroadcastChannel("babyshower_v1"); // Canal compartido entre pestañas
const clientId = localStorage.getItem("babyshower-clientId") || Math.random().toString(36).slice(2); // ID único por cliente
localStorage.setItem("babyshower-clientId", clientId);

let userName = localStorage.getItem("babyshower-name") || ""; // Nombre del usuario guardado

// --- Estado global compartido ---
let state = JSON.parse(localStorage.getItem("babyshower-state") || "{}") || {
  voters: {},         // Votos: clientId -> {name, choice}
  messages: [],       // Chat: lista de mensajes
  reactions: [],      // Reacciones flotantes
  chosenSex: null,    // "Niño" o "Niña" (fijado por el anfitrión)
  revealed: false     // Estado de revelación final
};

// --- Selección de elementos del DOM ---
const el = (id)=>document.getElementById(id);
const welcomeOverlay = el("welcome-overlay");
const presOverlay = el("presentation-overlay");
const startPresBtn = el("start-presentation-btn");
const nameInput = el("name-input");
const slides = document.querySelectorAll(".slide");
let currentSlide = 0;
const nextSlideBtn = el("next-slide-btn");
const prevSlideBtn = el("prev-slide-btn");
const app = el("app");
const votesDiv = el("votes");
const presenceCount = el("presence-count") || null;
const countBoyEl = el("count-boy");
const countGirlEl = el("count-girl");
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

// --- Audio ---
const audioWelcome = el("audio-welcome");       // Música al inicio
const audioSoft = el("audio-soft");             // Música de fondo suave
const audioCelebration = el("audio-celebration"); // Música de celebración final

// --- Guardar y compartir estado entre pestañas ---
function persistAndBroadcast(){
  localStorage.setItem("babyshower-state", JSON.stringify(state));
  channel.postMessage({type:'state', state}); // Envía el estado a otras pestañas
  renderAll(); // Refresca interfaz
}

// --- Comunicación entre pestañas ---
channel.onmessage = (ev)=>{
  const msg = ev.data;
  if(!msg) return;
  if(msg.type === 'request_state'){
    // Si otra pestaña pide el estado, se le envía
    channel.postMessage({type:'state', state});
  } else if(msg.type === 'state'){
    // Si recibimos un nuevo estado, lo actualizamos localmente
    state = msg.state || state;
    localStorage.setItem("babyshower-state", JSON.stringify(state));
    renderAll();
  }
};

// --- Al abrir nueva pestaña, solicitar el estado actual ---
function requestStateFromPeers(){
  channel.postMessage({type:'request_state', from:clientId});
  const s = JSON.parse(localStorage.getItem("babyshower-state") || "{}");
  if(s && Object.keys(s).length) { state = s; renderAll(); }
}

// --- Flujo de presentación inicial ---
function showSlide(i){
  slides.forEach((el, idx)=> el.classList.toggle('active', idx===i) );
  currentSlide = i;
}

// Botón siguiente diapositiva
nextSlideBtn?.addEventListener('click', ()=>{
  currentSlide++;
  if(currentSlide >= slides.length) {
    presOverlay.classList.add('hidden');
    app.classList.remove('hidden'); // Muestra la parte principal (votación/chat)
    try{ audioSoft.play(); }catch(e){} // Comienza música suave
  } else showSlide(currentSlide);
});

// Botón anterior diapositiva
prevSlideBtn?.addEventListener('click', ()=>{
  currentSlide = Math.max(0, currentSlide-1);
  showSlide(currentSlide);
});

// Botón para iniciar presentación (entrada del nombre)
startPresBtn.addEventListener('click', ()=>{
  const name = nameInput.value.trim();
  if(!name && !userName){
    alert("Por favor escribe tu nombre antes de continuar");
    return;
  }
  if(name){ userName = name; localStorage.setItem("babyshower-name", userName); }
  welcomeOverlay.classList.add('hidden');
  presOverlay.classList.remove('hidden');
  showSlide(0);
  try{ audioWelcome.play(); }catch(e){}
});

// --- Construcción de botones de votación ---
function buildVoteButtons(){
  votesDiv.innerHTML = '';
  const choices = ['Niño','Niña','¡Sorpréndeme!'];
  choices.forEach(choice=>{
    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.dataset.choice = choice;
    btn.textContent = (choice==='Niño'?'💙 Niño': choice==='Niña'?'💖 Niña':'🎁 ¡Sorpréndeme!');
    btn.addEventListener('click', ()=>{
      // Guardar voto por cliente
      state.voters[clientId] = { name: userName || ('Invitado-'+clientId.slice(0,4)), choice, ts:Date.now() };
      persistAndBroadcast();
    });
    votesDiv.appendChild(btn);
  });
}

// --- Chat ---
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e)=>{ if(e.key==='Enter') sendMessage(); });

// Enviar mensaje al chat
function sendMessage(){
  const text = chatInput.value.trim();
  if(!text) return;
  const name = userName || ('Invitado-'+clientId.slice(0,4));
  const msg = { id: Math.random().toString(36).slice(2), name, text, ts:Date.now() };
  state.messages.push(msg);
  chatInput.value = '';
  persistAndBroadcast();
  showReactionToast(`${name} dijo: ${text}`);
}

// --- Reacciones flotantes ---
reactionButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const emoji = btn.textContent.trim();
    const name = userName || ('Invitado-'+clientId.slice(0,4));
    const r = { id: Date.now() + Math.random(), name, emoji, ts: Date.now() };
    state.reactions.push(r);
    persistAndBroadcast();
    animateReaction(r);
  });
});

// Animación de reacciones que suben flotando
function animateReaction(r){
  const node = document.createElement('div');
  node.className = 'reaction-float';
  node.textContent = r.emoji;
  node.style.left = (10 + Math.random()*80) + '%';
  document.body.appendChild(node);
  setTimeout(()=> node.remove(), 3000);
}

// Pequeña notificación en consola (puede reemplazarse por toasts visuales)
function showReactionToast(text){
  console.log(text);
}

// --- Renderización general (actualiza interfaz) ---
function renderMessages(){
  messagesEl.innerHTML = '';
  state.messages.slice(-200).forEach(m=>{
    const d = document.createElement('div');
    d.className = 'msg';
    d.innerHTML = `<strong>${escapeHtml(m.name)}:</strong> ${escapeHtml(m.text)}`;
    messagesEl.appendChild(d);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Mostrar votos y conteo
function renderVoteHistory(){
  voteHistoryEl.innerHTML = '';
  Object.values(state.voters).forEach(v=>{
    const d = document.createElement('div');
    d.className = 'vote-entry';
    d.textContent = `${v.name} → ${v.choice}`;
    voteHistoryEl.appendChild(d);
  });

  const totals = { 'Niño':0, 'Niña':0 };
  Object.values(state.voters).forEach(v=>{
    if(v.choice==='Niño') totals['Niño']++;
    else if(v.choice==='Niña') totals['Niña']++;
  });

  const pc = document.getElementById('presence-count');
  if(pc) pc.textContent = Object.keys(state.voters).length.toString();
  if(countBoyEl) countBoyEl.textContent = (totals['Niño']||0).toString();
  if(countGirlEl) countGirlEl.textContent = (totals['Niña']||0).toString();
}

// Mostrar conteo de reacciones
function renderReactionCounts(){
  if(!reactionCountsEl) return;
  const map = {};
  state.reactions.forEach(r=> map[r.emoji] = (map[r.emoji]||0)+1);
  reactionCountsEl.textContent = Object.entries(map).map(([k,v])=>`${k} ${v}`).join('  ');
}

// Renderiza toda la interfaz
function renderAll(){
  buildVoteButtons();
  renderMessages();
  renderVoteHistory();
  renderReactionCounts();
  if(state.chosenSex){
    chosenSexEl.textContent = `Sexo fijado: ${state.chosenSex}`;
  } else {
    chosenSexEl.textContent = 'Sexo no fijado';
  }
  if(state.revealed){
    launchRevealUI(state.chosenSex);
  }
}

// Evita inyección HTML en chat
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// --- Controles del anfitrión ---
hostBtn.addEventListener('click', ()=>{
  const pass = prompt("Contraseña de anfitrión:");
  if(pass === 'confetti'){
    hostControls.classList.remove('hidden');
    alert('Controles de anfitrión activados');
  } else {
    alert('Contraseña incorrecta');
  }
});
setBoyBtn.addEventListener('click', ()=>{
  state.chosenSex = 'Niño';
  persistAndBroadcast();
});
setGirlBtn.addEventListener('click', ()=>{
  state.chosenSex = 'Niña';
  persistAndBroadcast();
});

// Iniciar revelación
revealBtn.addEventListener('click', ()=>{
  if(!state.chosenSex){
    alert('Debes fijar el sexo del bebé antes de iniciar la revelación.');
    return;
  }
  startFinalCountdown(state.chosenSex);
  state.revealed = true;
  persistAndBroadcast();
});

// Reiniciar todo el evento
resetBtn.addEventListener('click', ()=>{
  if(!confirm('¿Reiniciar todo?')) return;
  localStorage.removeItem('babyshower-state');
  state = { voters:{}, messages:[], reactions:[], chosenSex:null, revealed:false };
  persistAndBroadcast();
});

// --- Cuenta regresiva final y revelación ---
function startFinalCountdown(sex){
  finalCountdown.classList.remove('hidden');
  let count = 10;
  countdownNumber.textContent = count;
  try{ audioSoft.pause(); audioWelcome.pause(); }catch(e){}
  const interval = setInterval(()=>{
    count--;
    countdownNumber.textContent = count;
    if(count <= 0){
      clearInterval(interval);
      finalCountdown.classList.add('hidden');
      launchRevealUI(sex);
    }
  },1000);
}

// Mostrar pantalla de revelación
function launchRevealUI(sex){
  revealOverlay.classList.remove('hidden');
  revealTitle.textContent = `¡Es un ${sex}!`;
  revealSub.textContent = (sex === 'Niña') ? '💙 ¡Felicidades!' : '💖 ¡Felicidades!';
  try{
    audioSoft.pause();
    audioCelebration.currentTime = 0;
    audioCelebration.play();
  }catch(e){}
  runConfetti(sex);
  launchBalloons(sex);
}

// --- Confeti ---
function runConfetti(sex){
  if(!confettiCanvas) return;
  const canvas = confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colors = (sex === 'Niño') ? ['#8FD3FF','#4FA3F7','#1E6ED8'] : ['#FFD0EA','#FF8FB4','#FF5BA3'];
  const pieces = [];
  for(let i=0;i<160;i++){
    pieces.push({
      x: Math.random()*canvas.width,
      y: Math.random()*-canvas.height,
      vx: (Math.random()-0.5)*4,
      vy: 2+Math.random()*4,
      size: 6+Math.random()*8,
      color: colors[Math.floor(Math.random()*colors.length)],
      rot: Math.random()*360
    });
  }
  let t=0;
  function frame(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{
      p.x += p.vx;
      p.y += p.vy;
      p.rot += 6*p.vx;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      ctx.restore();
      if(p.y > canvas.height+50){
        p.x = Math.random()*canvas.width;
        p.y = -10;
      }
    });
    t++;
    if(t<600) requestAnimationFrame(frame);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  frame();
}

// --- Globos ---
function launchBalloons(sex){
  const container = balloonsLayer;
  container.innerHTML = '';
  const color = sex === 'Niño' ? '#4fa3f7' : '#ff80c0';
  for(let i=0;i<18;i++){
    const b = document.createElement('div');
    b.className = 'balloon';
    b.style.left = Math.random()*86 + '%';
    b.style.background = color;
    b.style.animationDuration = (5 + Math.random()*4) + 's';
    container.appendChild(b);
    setTimeout(()=> b.remove(), 8000);
  }
}

// --- Sincronización por almacenamiento local ---
window.addEventListener('storage', ()=>{
  const s = JSON.parse(localStorage.getItem("babyshower-state") || "{}");
  if(s && Object.keys(s).length){ state = s; renderAll(); }
});

// --- Inicio ---
requestStateFromPeers();
buildVoteButtons();
renderAll();

// Intentar reproducir música suave tras interacción
document.addEventListener('click', ()=> {
  try{ audioSoft.play().catch(()=>{}); }catch(e){}
}, {once:true});
