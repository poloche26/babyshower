// Estado compartido
const channel = new BroadcastChannel("babyshower");
const clientId = Math.random().toString(36).slice(2);
let userName = localStorage.getItem("babyshower-name") || "";
let state = JSON.parse(localStorage.getItem("babyshower-state") || "{}") || {
  votes: {},
  messages: [],
  revealed: false,
  countdown: null
};

// === BIENVENIDA & PRESENTACIÓN ===
const startPresentationBtn = document.getElementById("start-presentation-btn");
const presentationOverlay = document.getElementById("presentation-overlay");
const welcomeOverlay = document.getElementById("welcome-overlay");
const music = document.getElementById("presentation-music");

let currentSlide = 0;
const slides = document.querySelectorAll(".slide");

function showSlide(index) {
  slides.forEach((s, i) => {
    s.classList.remove("active");
    if (i === index) s.classList.add("active");
  });
}

document.getElementById("next-slide-btn").onclick = () => {
  currentSlide++;
  if (currentSlide >= slides.length) {
    presentationOverlay.classList.add("hidden");
    music.pause();
    document.getElementById("app").classList.remove("hidden");
    runConfetti();
  } else {
    showSlide(currentSlide);
  }
};

startPresentationBtn.onclick = () => {
  const nameInput = document.getElementById("name-input");
  if (nameInput.value.trim()) {
    userName = nameInput.value.trim();
    localStorage.setItem("babyshower-name", userName);
  } else if (!userName) {
    alert("Por favor escribe tu nombre antes de continuar 🙏");
    return;
  }
  welcomeOverlay.classList.add("hidden");
  presentationOverlay.classList.remove("hidden");
  currentSlide = 0;
  showSlide(currentSlide);
  music.play();
};

// === CHAT ===
function sendMessage() {
  const input = document.getElementById("chat-input");
  if (!input.value.trim()) return;
  state.messages.push({ id: clientId, name: userName || "Invitado", text: input.value });
  input.value = "";
  persistAndBroadcast();
}
document.getElementById("send-btn").onclick = sendMessage;
document.getElementById("chat-input").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// === VOTOS ===
const options = ["Niño", "Niña"];
function renderVotes() {
  const div = document.getElementById("votes");
  div.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.onclick = () => {
      state.votes[clientId] = { name: userName, choice: opt };
      persistAndBroadcast();
    };
    div.appendChild(btn);
  });
}

function renderVoteHistory() {
  const container = document.getElementById("vote-history");
  container.innerHTML = "";

  Object.values(state.votes).forEach(vote => {
    const div = document.createElement("div");
    div.className = "vote-entry";
    div.textContent = `👤 ${vote.name} votó por ${vote.choice}`;
    container.appendChild(div);
  });

  const totals = { Niño: 0, Niña: 0 };
  Object.values(state.votes).forEach(v => {
    if (totals[v.choice] !== undefined) totals[v.choice]++;
  });

  const resumen = document.createElement("p");
  resumen.innerHTML = `💖 Niña: ${totals["Niña"]} votos | 💙 Niño: ${totals["Niño"]} votos`;
  container.appendChild(resumen);
}

// === REACCIONES (ejemplo simple) ===
function renderReactions() {
  const div = document.getElementById("reactions");
  div.innerHTML = "😍 🎉 👏 💖";
}

// === CHAT RENDER ===
function renderChat() {
  const messagesEl = document.getElementById("messages");
  messagesEl.innerHTML = "";
  state.messages.forEach(m => {
    const div = document.createElement("div");
    div.className = `msg ${m.id === clientId ? "me" : "other"}`;
    div.textContent = `${m.name}: ${m.text}`;
    messagesEl.appendChild(div);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// === ANFITRIÓN ===
function becomeHost() {
  const pass = prompt("Contraseña de anfitrión:");
  if (pass === "1234") {
    alert("Ahora eres el anfitrión 🎉");
    document.getElementById("reveal-btn").classList.remove("hidden");
  } else {
    alert("Contraseña incorrecta");
  }
}

function revealVotes() {
  startFinalCountdown("Niña"); // aquí eliges el sexo real
}

// === CONTEO FINAL ===
function startFinalCountdown(sex) {
  const overlay = document.getElementById("final-countdown");
  overlay.classList.remove("hidden");
  let count = 10;
  const numEl = document.getElementById("countdown-number");
  numEl.textContent = count;

  const interval = setInterval(() => {
    count--;
    numEl.textContent = count;
    if (count <= 0) {
      clearInterval(interval);
      overlay.classList.add("hidden");
      showFinalReveal(sex);
    }
  }, 1000);
}

function showFinalReveal(sex) {
  const overlay = document.getElementById("reveal-overlay");
  overlay.classList.remove("hidden");
  const text = document.getElementById("baby-reveal-text");
  const sound = document.getElementById("celebration-sound");

  if (sex === "Niño") {
    text.textContent = "¡Es un Niño! 💙";
    overlay.style.background = "linear-gradient(to top, #87cefa, #e0ffff)";
  } else {
    text.textContent = "¡Es una Niña! 💖";
    overlay.style.background = "linear-gradient(to top, #ffc0cb, #fff0f5)";
  }

  sound.play();
  runConfetti();
  launchBalloons(sex);
}

// === EFECTOS ===
function runConfetti() {
  // Usa canvas-confetti si lo agregas
  console.log("Confetti 🎉");
}

function launchBalloons(sex) {
  const canvas = document.getElementById("balloons");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const balloons = [];
  const color = sex === "Niño" ? "#00bfff" : "#ff69b4";

  for (let i = 0; i < 30; i++) {
    balloons.push({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      r: 20 + Math.random() * 30,
      vy: 1 + Math.random() * 2,
    });
  }

  function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    balloons.forEach((b) => {
      b.y -= b.vy;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(anim);
  }
  anim();
}

// === PERSISTENCIA ===
function persistAndBroadcast() {
  localStorage.setItem("babyshower-state", JSON.stringify(state));
  channel.postMessage({ type: "update", state });
  renderAll();
}

function renderAll() {
  renderVotes();
  renderChat();
  renderReactions();
  renderVoteHistory();
}

document.getElementById("host-btn").onclick = becomeHost;
document.getElementById("reveal-btn").onclick = revealVotes;
document.getElementById("reset-btn").onclick = () => {
  if (confirm("¿Seguro que quieres reiniciar todo?")) {
    localStorage.removeItem("babyshower-state");
    state = { votes: {}, messages: [], revealed: false, countdown: null };
    persistAndBroadcast();
  }
};

channel.onmessage = (ev) => {
  if (ev.data.type === "update") {
    state = ev.data.state;
    localStorage.setItem("babyshower-state", JSON.stringify(state));
    renderAll();
  }
};

renderAll();
