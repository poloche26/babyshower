const CHANNEL_NAME = 'babyshower_channel_v1';
const LOCAL_KEY = 'babyshower_state_v1';
const CONFETTI_PASSWORD = 'confetti';
const clientId = localStorage.getItem('babyshower_client_id') || ('c_' + Math.random().toString(36).slice(2,9));
localStorage.setItem('babyshower_client_id', clientId);
const bc = new BroadcastChannel(CHANNEL_NAME);
let lastAppliedAt = 0;

const defaultState = {
  updatedAt: Date.now(),
  revealed: false,
  host: null,
  votes: {},
  options: [
    {id:'op1',text:'Niño'},
    {id:'op2',text:'Niña'},
    {id:'op3',text:'¡Sorpréndeme!'},
  ],
  messages: [],
  reactions: {},
  presence: {},
};

function loadLocal(){
  try{const raw=localStorage.getItem(LOCAL_KEY);if(raw) return JSON.parse(raw);}catch(e){}
  return JSON.parse(JSON.stringify(defaultState));
}
let state = loadLocal();
lastAppliedAt = state.updatedAt;

function persistAndBroadcast(){
  state.updatedAt = Date.now();
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  bc.postMessage({type:'update',from:clientId,state});
  renderAll();
}
function applyIncomingState(incoming){
  if(!incoming||!incoming.updatedAt) return;
  if(incoming.updatedAt <= lastAppliedAt) return;
  lastAppliedAt = incoming.updatedAt;
  state = incoming;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  renderAll();
}

bc.onmessage=(ev)=>{
  const m=ev.data;if(!m||m.from===clientId) return;
  if(m.type==='request_state') bc.postMessage({type:'state',from:clientId,state});
  else if(m.type==='state'||m.type==='update') applyIncomingState(m.state);
  else if(m.type==='presence'){state.presence[m.from]=m.at;localStorage.setItem(LOCAL_KEY,JSON.stringify(state));renderPresence();}
};
bc.postMessage({type:'request_state',from:clientId});

setInterval(()=>{
  const now=Date.now();
  bc.postMessage({type:'presence',from:clientId,at:now});
  state.presence[clientId]=now;
  const cutoff=now-15000;
  Object.keys(state.presence).forEach(k=>{if(state.presence[k]<cutoff) delete state.presence[k]});
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  renderPresence();
},4000);

const votingList=document.getElementById('votingList');
const revealBtn=document.getElementById('revealBtn');
const beHostBtn=document.getElementById('beHostBtn');
const presenceCount=document.getElementById('presenceCount');
const messagesBox=document.getElementById('messages');
const chatInput=document.getElementById('chatInput');
const sendBtn=document.getElementById('sendBtn');
const totalVotesEl=document.getElementById('totalVotes');
const totalMsgsEl=document.getElementById('totalMsgs');
const totalReactsEl=document.getElementById('totalReacts');

function renderVoting(){
  votingList.innerHTML='';
  const myVote=state.votes[clientId]||null;
  state.options.forEach(opt=>{
    const c=document.createElement('div');c.className='vote-option';
    c.innerHTML=`<div><strong>${opt.text}</strong></div>`;
    const b=document.createElement('button');b.className='vote-btn'+(myVote===opt.id?' selected':'');
    b.textContent=myVote===opt.id?'Votado':'Votar';
    b.onclick=()=>{state.votes[clientId]=opt.id;persistAndBroadcast();};
    c.appendChild(b);
    const count=Object.values(state.votes).filter(v=>v===opt.id).length;
    const span=document.createElement('div');span.className='stats';
    span.innerHTML=state.revealed?`Votos: <strong>${count}</strong>`:`Votos: <span class="hidden-count">${count}</span>`;
    c.appendChild(span);
    votingList.appendChild(c);
  });
  if(totalVotesEl) totalVotesEl.textContent=Object.keys(state.votes).length;
}

function renderMessages(){
  messagesBox.innerHTML='';
  state.messages.slice(-200).forEach(m=>{
    const el=document.createElement('div');el.className='msg '+(m.clientId===clientId?'me':'other');
    el.innerHTML=`<div style="font-size:11px;color:var(--muted)">${m.name||'Invitado'} · ${new Date(m.at).toLocaleTimeString()}</div><div>${escapeHtml(m.text)}</div>`;
    messagesBox.appendChild(el);
  });
  messagesBox.scrollTop=messagesBox.scrollHeight;
  if(totalMsgsEl) totalMsgsEl.textContent=state.messages.length;
}

function renderReactions(){
  const counts={};
  Object.keys(state.reactions).forEach(e=>counts[e]=Object.values(state.reactions[e]).reduce((a,b)=>a+b,0));
  ['❤️','🎉','😂'].forEach(e=>{const el=document.getElementById('count-'+e);if(el)el.textContent=counts[e]||0;});
  if(totalReactsEl) totalReactsEl.textContent=Object.values(counts).reduce((a,b)=>a+b,0);
}

function renderPresence(){
  const now=Date.now(),cutoff=now-15000;
  Object.keys(state.presence).forEach(k=>{if(state.presence[k]<cutoff) delete state.presence[k]});
  presenceCount.textContent=Object.keys(state.presence).length;
}
function renderAll(){renderVoting();renderMessages();renderReactions();renderPresence();if(state.revealed)runConfetti();}

sendBtn.onclick=()=>sendMessage(chatInput.value.trim());
chatInput.onkeydown=(e)=>{if(e.key==='Enter')sendMessage(chatInput.value.trim())};
function sendMessage(text){if(!text)return;state.messages.push({id:'m_'+Math.random().toString(36).slice(2,9),clientId,name:'Invitado',text,at:Date.now()});if(state.messages.length>500)state.messages=state.messages.slice(-500);persistAndBroadcast();chatInput.value='';}

function addReaction(emoji){if(!state.reactions[emoji])state.reactions[emoji]={};state.reactions[emoji][clientId]=(state.reactions[emoji][clientId]||0)+1;persistAndBroadcast();}
document.querySelectorAll('.reaction-btn').forEach(b=>b.onclick=()=>addReaction(b.dataset.emoji));

function attemptReveal(){const pw=prompt('Contraseña:');if(pw===CONFETTI_PASSWORD){state.revealed=true;state.host=clientId;persistAndBroadcast();alert('¡Votos revelados!');}else alert('Incorrecta');}
function becomeHost(){const pw=prompt('Contraseña:');if(pw===CONFETTI_PASSWORD){state.host=clientId;persistAndBroadcast();alert('Eres el anfitrión');}else alert('Incorrecta');}
revealBtn.onclick=attemptReveal;beHostBtn.onclick=becomeHost;

function resetParty(){if(!confirm('¿Reiniciar?'))return;state=JSON.parse(JSON.stringify(defaultState));state.updatedAt=Date.now();localStorage.setItem(LOCAL_KEY,JSON.stringify(state));bc.postMessage({type:'update',from:clientId,state});renderAll();}
document.getElementById('resetBtn').onclick=resetParty;

function escapeHtml(s){return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function runConfetti(){const canvas=document.getElementById('confetti'),ctx=canvas.getContext('2d');canvas.width=innerWidth;canvas.height=innerHeight;const pieces=[];for(let i=0;i<80;i++){pieces.push({x:Math.random()*canvas.width,y:Math.random()*-canvas.height*0.5,vx:(Math.random()-0.5)*2,vy:1+Math.random()*3,rot:Math.random()*360,size:6+Math.random()*10,color:`hsl(${Math.random()*360},80%,60%)`});}
let t=0;function anim(){ctx.clearRect(0,0,canvas.width,canvas.height);pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.rot+=p.vx*6;p.vy+=0.03;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);ctx.restore();});t++;if(t<220)requestAnimationFrame(anim);else ctx.clearRect(0,0,canvas.width,canvas.height);}anim();}

renderAll();
window.addEventListener('storage',(e)=>{if(e.key===LOCAL_KEY){try{applyIncomingState(JSON.parse(e.newValue))}catch(e){}}});

// === Baby Shower Interactivo con Animaciones ===
function addReaction(emoji) {
  if (!state.reactions[emoji]) state.reactions[emoji] = {};
  state.reactions[emoji][clientId] = (state.reactions[emoji][clientId] || 0) + 1;
  persistAndBroadcast();

  // Crear reacción flotante
  const float = document.createElement("div");
  float.className = "reaction-float";
  float.textContent = emoji;
  float.style.left = Math.random() * (window.innerWidth - 50) + "px";
  float.style.top = (window.innerHeight - 100) + "px";
  document.body.appendChild(float);
  setTimeout(() => float.remove(), 2000);
}

// === Confetti más vistoso ===
function runConfetti() {
  const canvas = document.getElementById("confetti"),
    ctx = canvas.getContext("2d");
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const pieces = [];
  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 3,
      vy: 1 + Math.random() * 4,
      rot: Math.random() * 360,
      size: 6 + Math.random() * 12,
      color: `hsl(${Math.random() * 360},80%,70%)`,
    });
  }
  let t = 0;
  function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vx * 6;
      p.vy += 0.03;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    t++;
    if (t < 300) requestAnimationFrame(anim);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  anim();
}
