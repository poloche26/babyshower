// Espera a que Firebase esté listo
window.addEventListener("load", () => {
  const db = window.firebaseDB;
  const { ref, push, set, onValue, remove, update } = window.firebaseRefs;

  // 🔹 Referencias de la base de datos
  const votesRef = ref(db, "votes");
  const messagesRef = ref(db, "messages");
  const reactionsRef = ref(db, "reactions");
  const settingsRef = ref(db, "settings");

  // 🔹 Elementos del DOM
  const app = document.getElementById("app");
  const welcomeOverlay = document.getElementById("welcome-overlay");
  const presentationOverlay = document.getElementById("presentation-overlay");
  const nextSlideBtn = document.getElementById("next-slide-btn");
  const slides = document.querySelectorAll(".slide");
  const nameInput = document.getElementById("name-input");
  const startBtn = document.getElementById("start-presentation-btn");

  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const messagesDiv = document.getElementById("messages");

  const reactionsDiv = document.getElementById("reactions");
  const reactionCountsDiv = document.getElementById("reaction-counts");

  const votesDiv = document.getElementById("votes");
  const voteHistoryDiv = document.getElementById("vote-history");

  const hostBtn = document.getElementById("host-btn");
  const hostControls = document.getElementById("host-controls");
  const revealBtn = document.getElementById("reveal-btn");
  const resetBtn = document.getElementById("reset-btn");
  const chosenSex = document.getElementById("chosen-sex");

  const countdownOverlay = document.getElementById("final-countdown");
  const countdownNumber = document.getElementById("countdown-number");

  const revealOverlay = document.getElementById("reveal-overlay");
  const revealTitle = document.getElementById("reveal-title");
  const revealSub = document.getElementById("reveal-sub");

  // 🔊 Audios
  const audioWelcome = document.getElementById("audio-welcome");
  const audioSoft = document.getElementById("audio-soft");
  const audioCelebration = document.getElementById("audio-celebration");

  let currentSlide = 0;
  let userName = "";
  let isHost = false;

  // =========================
  // 🎬 BIENVENIDA + PRESENTACIÓN
  // =========================
  startBtn.addEventListener("click", () => {
    userName = nameInput.value.trim();
    if (!userName) return alert("Por favor, escribe tu nombre ❤️");

    welcomeOverlay.classList.add("hidden");
    presentationOverlay.classList.remove("hidden");
    audioWelcome.play();
  });

  nextSlideBtn.addEventListener("click", () => {
    slides[currentSlide].classList.remove("active");
    currentSlide++;
    if (currentSlide >= slides.length) {
      presentationOverlay.classList.add("hidden");
      app.classList.remove("hidden");
      audioWelcome.pause();
      audioSoft.play();
      return;
    }
    slides[currentSlide].classList.add("active");
  });

  // =========================
  // 🗳️ VOTACIONES
  // =========================
  votesDiv.innerHTML = `
    <button id="vote-boy">💙 Niño</button>
    <button id="vote-girl">💖 Niña</button>
  `;

  const voteBoy = document.getElementById("vote-boy");
  const voteGirl = document.getElementById("vote-girl");

  voteBoy.onclick = () => vote("Niño");
  voteGirl.onclick = () => vote("Niña");

  function vote(sex) {
    push(votesRef, { name: userName, sex });
  }

  onValue(votesRef, (snapshot) => {
    const data = snapshot.val() || {};
    let html = "";
    let countBoy = 0;
    let countGirl = 0;

    Object.values(data).forEach((v) => {
      html += `<p>👤 ${v.name} votó por ${v.sex}</p>`;
      if (v.sex === "Niño") countBoy++;
      if (v.sex === "Niña") countGirl++;
    });

    voteHistoryDiv.innerHTML = html;
    votesDiv.insertAdjacentHTML(
      "beforeend",
      `<p>💖 Niñas: ${countGirl} | 💙 Niños: ${countBoy}</p>`
    );
  });

  // =========================
  // 💬 CHAT
  // =========================
  sendBtn.addEventListener("click", () => {
    const msg = chatInput.value.trim();
    if (!msg) return;
    push(messagesRef, { name: userName, msg });
    chatInput.value = "";
  });

  onValue(messagesRef, (snapshot) => {
    const data = snapshot.val() || {};
    messagesDiv.innerHTML = "";
    Object.values(data).forEach((m) => {
      messagesDiv.innerHTML += `<p><b>${m.name}:</b> ${m.msg}</p>`;
    });
  });

  // =========================
  // 🎉 REACCIONES
  // =========================
  reactionsDiv.addEventListener("click", (e) => {
    if (e.target.classList.contains("reaction-option")) {
      const emoji = e.target.textContent;
      push(reactionsRef, { emoji });
    }
  });

  onValue(reactionsRef, (snapshot) => {
    const data = snapshot.val() || {};
    reactionCountsDiv.innerHTML = Object.values(data)
      .map((r) => r.emoji)
      .join(" ");
  });

  // =========================
  // 🧑‍💼 ANFITRIÓN (con contraseña)
  // =========================
  hostBtn.addEventListener("click", () => {
    const password = prompt("🔒 Ingresa la contraseña del anfitrión:");
    if (password === "confetti") {
      isHost = true;
      hostControls.classList.remove("hidden");
      alert("🎉 Modo anfitrión activado");
    } else {
      alert("❌ Contraseña incorrecta");
    }
  });

  document.getElementById("set-boy").onclick = () => {
    if (isHost) update(settingsRef, { chosenSex: "Niño" });
    else alert("Solo el anfitrión puede realizar esta acción.");
  };

  document.getElementById("set-girl").onclick = () => {
    if (isHost) update(settingsRef, { chosenSex: "Niña" });
    else alert("Solo el anfitrión puede realizar esta acción.");
  };

  revealBtn.addEventListener("click", async () => {
    if (!isHost) return alert("Solo el anfitrión puede revelar el resultado.");
    countdownOverlay.classList.remove("hidden");
    let count = 10;
    const timer = setInterval(() => {
      countdownNumber.textContent = count;
      count--;
      if (count < 0) {
        clearInterval(timer);
        countdownOverlay.classList.add("hidden");
        revealOverlay.classList.remove("hidden");
        audioSoft.pause();
        audioCelebration.play();

        onValue(settingsRef, (snap) => {
          const chosen = snap.val()?.chosenSex || "Niño";
          revealTitle.textContent = `¡Es un ${chosen}! 🎉`;
          startCelebration(chosenSex);
          revealSub.textContent =
            chosen === "Niña" ? "💖 Felicidades 💖" : "💙 Felicitaciones 💙";
        });
      }
    }, 1000);
  });

  resetBtn.addEventListener("click", () => {
    if (!isHost) return alert("Solo el anfitrión puede reiniciar el evento.");
    if (confirm("¿Seguro que deseas reiniciar todo?")) {
      remove(votesRef);
      remove(messagesRef);
      remove(reactionsRef);
      update(settingsRef, { chosenSex: null });
      location.reload();
    }
  });
});
// 🎉 EFECTO DE CELEBRACIÓN AL REVELAR SEXO DEL BEBÉ
function startCelebration(chosenSex) {
  // 🌈 Fondo animado según el sexo
  document.body.style.transition = "background 1s ease";
  document.body.style.background =
    chosenSex === "Niña"
      ? "linear-gradient(180deg, #ffd0ea, #ff99c8, #fff)"
      : "linear-gradient(180deg, #b3e5fc, #64b5f6, #fff)";

  // 🎊 CONFETTI (colores adaptados)
  for (let i = 0; i < 200; i++) {
    const confetti = document.createElement("div");
    confetti.classList.add("confetti");
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.top = "-20px";
    confetti.style.width = confetti.style.height =
      8 + Math.random() * 8 + "px";
    confetti.style.backgroundColor =
      chosenSex === "Niña"
        ? ["#ff69b4", "#ffc0cb", "#fff"][Math.floor(Math.random() * 3)]
        : ["#1e90ff", "#87cefa", "#fff"][Math.floor(Math.random() * 3)];
    confetti.style.animation = `confettiFall ${
      3 + Math.random() * 3
    }s linear forwards`;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 6000);
  }

  // 🎈 GLOBOS PERSONALIZADOS (rosas o celestes)
  for (let i = 0; i < 30; i++) {
    const balloon = document.createElement("div");
    balloon.classList.add("balloon");
    balloon.style.left = Math.random() * 100 + "vw";
    balloon.style.fontSize = 2 + Math.random() * 2 + "rem";
    balloon.textContent =
      chosenSex === "Niña"
        ? ["🎀", "🎈", "💖"][Math.floor(Math.random() * 3)]
        : ["💙", "🎈", "🍼"][Math.floor(Math.random() * 3)];
    balloon.style.animation = `floatBalloon ${
      5 + Math.random() * 5
    }s linear forwards`;
    document.body.appendChild(balloon);
    setTimeout(() => balloon.remove(), 7000);
  }

  // 💥 FUEGOS ARTIFICIALES
  for (let i = 0; i < 10; i++) {
    const firework = document.createElement("div");
    firework.classList.add("firework");
    firework.style.left = Math.random() * 100 + "vw";
    firework.style.top = Math.random() * 70 + "vh";
    firework.style.background =
      chosenSex === "Niña"
        ? ["#ff66b2", "#ff1493", "#ffb6c1"][Math.floor(Math.random() * 3)]
        : ["#1e90ff", "#00bfff", "#87cefa"][Math.floor(Math.random() * 3)];
    document.body.appendChild(firework);
    setTimeout(() => firework.remove(), 1500);
  }
}


