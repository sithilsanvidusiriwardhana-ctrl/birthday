// Core interaction script
// - Lights candle on click/tap (emoji swap + flame animation)
// - Plays generated celebratory music (WebAudio) as fallback / primary
// - Loads canvas-confetti and fires confetti
// - Shows birthday card after 2s

const cake = document.getElementById('cake');
const candle = document.getElementById('candle');
const card = document.getElementById('birthdayCard');
const closeCardBtn = document.getElementById('closeCard');
const shareBtn = document.getElementById('shareBtn');
const audioElem = document.getElementById('bgAudio');

let isLit = false;
let audioCtx, bgGain, bgOscNodes = [];
let confettiLibLoaded = false;

// load confetti lib dynamically
function loadConfetti(){
  return new Promise((res, rej)=>{
    if(window.confetti){ confettiLibLoaded = true; return res(); }
    const s = document.createElement('script');
    s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    s.onload = ()=>{ confettiLibLoaded = true; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// small confetti burst routine
async function startConfetti(){
  try{
    await loadConfetti();
    if(!window.confetti) return;
    const duration = 2500;
    const end = Date.now() + duration;

    (function frame(){
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff7b7b','#ffd27a','#7ee7a6','#7bd3ff','#d79bff']
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ff7b7b','#ffd27a','#7ee7a6','#7bd3ff','#d79bff']
      });
      if(Date.now() < end) requestAnimationFrame(frame);
    })();
  }catch(e){
    console.warn('Confetti failed to load', e);
  }
}

// tiny WebAudio celebratory loop (synth) - short, pleasant arpeggio
function initAudio(){
  if(audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgGain = audioCtx.createGain();
    bgGain.gain.value = 0.0001; // start near 0 for smooth ramp
    bgGain.connect(audioCtx.destination);
  }catch(e){
    audioCtx = null;
    console.warn('WebAudio not supported', e);
  }
}

function playGeneratedMusic(){
  if(!audioCtx) return;
  bgOscNodes.forEach(n=>n.stop?.());
  bgOscNodes.length = 0;
  const now = audioCtx.currentTime;
  const gain = bgGain;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.6);

  const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5,E5,G5,C6
  for(let i=0;i<4;i++){
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = (i%2===0)?'sawtooth':'triangle';
    osc.frequency.value = freqs[i];
    g.gain.value = 0.0;
    osc.connect(g);
    g.connect(gain);
    const start = now + i*0.18;
    const dur = 1.2;
    g.gain.setValueAtTime(0.0, start);
    g.gain.linearRampToValueAtTime(0.35, start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    bgOscNodes.push(osc);
  }

  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.type = 'sine';
  bass.frequency.value = 130.81; // C3
  bassGain.gain.value = 0.0;
  bass.connect(bassGain);
  bassGain.connect(gain);
  bassGain.gain.setValueAtTime(0.0, now);
  bassGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.3);
  bass.start(now);
  bass.stop(now + 3.4);
  bgOscNodes.push(bass);

  gain.gain.setValueAtTime(gain.gain.value, now + 5.0);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.0);
}

// try to play <audio> element if an mp3 is provided; otherwise use generated music
function playAudioOnInteraction(){
  initAudio();
  const hasSource = Array.from(audioElem.children).some(s => s.src && s.src.length);
  if(hasSource){
    audioElem.currentTime = 0;
    const p = audioElem.play();
    if(p && p.catch){
      p.catch(()=> { playGeneratedMusic(); });
    }
    return;
  }
  playGeneratedMusic();
}

function showCard(){ card.classList.add('show'); }
function hideCard(){ card.classList.remove('show'); }

shareBtn.addEventListener('click', ()=>{
  const text = "Happy Birthday! 🎈 I'm so glad to have a friend like you.";
  if(navigator.share){ navigator.share({ title:'Happy Birthday', text }).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(text).then(()=>{ alert('Message copied to clipboard — share it!'); }); }
  else { alert('Copy this message: ' + text); }
});

closeCardBtn.addEventListener('click', hideCard);

// light the candle handler
async function lightCandle(){
  if(isLit) return;
  isLit = true;
  cake.setAttribute('aria-pressed','true');
  cake.classList.add('lit');
  candle.innerHTML = '<span class="flame">🔥</span>';
  candle.setAttribute('aria-hidden','false');
  playAudioOnInteraction();
  startConfetti();
  setTimeout(showCard, 2000);
}

// accessibility
cake.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lightCandle(); } });
cake.addEventListener('click', ()=>{ try{ if(window.AudioContext && audioCtx && audioCtx.state === 'suspended'){ audioCtx.resume(); } }catch(e){} lightCandle(); });

document.addEventListener('click', (e)=>{ if(!card.classList.contains('show')) return; if(!card.contains(e.target) && !cake.contains(e.target)){ hideCard(); } });

// helper API
window.bdayHelpers = { light: lightCandle, showCard, hideCard, startConfetti };

// init audio on first gesture
function attachFirstGesture(){
  const once = ()=>{ initAudio(); document.removeEventListener('pointerdown', once); document.removeEventListener('keydown', once); };
  document.addEventListener('pointerdown', once, { once:true });
  document.addEventListener('keydown', once, { once:true });
}
attachFirstGesture();
