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

// Debug listeners and test button (helps diagnose why audio may not play)
if(audioElem){
  audioElem.addEventListener('canplay', ()=>{ console.info('Audio canplay — source loaded:', audioElem.currentSrc); });
  audioElem.addEventListener('error', (e)=>{
    console.error('Audio element error', audioElem.error, e);
    try{ if(audioElem.error && audioElem.error.code){ console.error('HTMLMediaElement.error.code =', audioElem.error.code); } }catch(_){}
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  const testBtn = document.getElementById('testAudioBtn');
  if(!testBtn) return;
  testBtn.addEventListener('click', async ()=>{
    try{
      console.info('Test button pressed — attempting audioElem.play()');
      const p = audioElem.play();
      if(p && p.catch) p.catch(err=>{ console.error('audioElem.play() rejected:', err); alert('Playback failed — see console for details.'); });
    }catch(err){
      console.error('Error calling audioElem.play():', err);
      alert('Playback error — check console.');
    }
  });
});

let isLit = false;
let audioCtx, bgGain, bgOscNodes = [];
let masterGain, mediaSource, mediaGain;
let padNodes = [];
let confettiLibLoaded = false;
let bgAudioElem = null;
let bgMediaSource = null;
let bgMediaGain = null;

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
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(audioCtx.destination);

    bgGain = audioCtx.createGain();
    bgGain.gain.value = 0.0001; // start near 0 for smooth ramp for generated music
    bgGain.connect(masterGain);

    // If there's an <audio> element, route it through the AudioContext so we can mix a background pad
    if(audioElem){
      try{
        mediaSource = audioCtx.createMediaElementSource(audioElem);
        mediaGain = audioCtx.createGain();
        mediaGain.gain.value = 1.0; // main song level
        mediaSource.connect(mediaGain);
        mediaGain.connect(masterGain);
      }catch(e){
        // Some browsers throw if media element was already connected; ignore
        console.warn('MediaElementSource unavailable:', e);
      }
    }
  }catch(e){
    audioCtx = null;
    console.warn('WebAudio not supported', e);
  }
}

function startBackgroundPad(){
  if(!audioCtx) return;
  stopBackgroundPad();
  const now = audioCtx.currentTime;
  const padGain = audioCtx.createGain();
  padGain.gain.value = 0.0;
  padGain.connect(masterGain || audioCtx.destination);
  // gentle pad: two detuned sine/saw oscillators through a lowpass
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  lp.Q.value = 0.8;
  lp.connect(padGain);

  const freqs = [130.81, 195.99]; // C3 + G3 (simple interval)
  freqs.forEach((f,i)=>{
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = (i%2===0)?'sine':'sawtooth';
    osc.frequency.value = f * (i===1?1.0:1.0);
    g.gain.value = 0.0;
    osc.connect(g);
    g.connect(lp);
    osc.start(now);
    padNodes.push({osc,g});
  });

  // ramp pad up
  padGain.gain.setValueAtTime(0.0001, now);
  padGain.gain.exponentialRampToValueAtTime(0.06, now + 1.2);
  padNodes.padGain = padGain;
}

function stopBackgroundPad(){
  try{
    if(padNodes.padGain){
      const t = audioCtx.currentTime;
      padNodes.padGain.gain.cancelScheduledValues(t);
      padNodes.padGain.gain.setValueAtTime(padNodes.padGain.gain.value, t);
      padNodes.padGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    }
    padNodes.forEach(n=>{ try{ n.osc.stop?.(audioCtx.currentTime + 0.85); }catch(_){} });
  }catch(e){}
  padNodes.length = 0;
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
    // start background pad when media plays
    audioElem.addEventListener('play', ()=>{ try{ startBackgroundPad(); }catch(e){} });
    audioElem.addEventListener('pause', ()=>{ try{ stopBackgroundPad(); }catch(e){} });
    audioElem.addEventListener('ended', ()=>{ try{ stopBackgroundPad(); }catch(e){} });
    return;
  }
  playGeneratedMusic();
}

// Background MP3 handling (Option A: mix a second MP3 in-browser)
function ensureBgAudio(){
  if(bgAudioElem) return;
  bgAudioElem = new Audio();
  bgAudioElem.loop = true;
  bgAudioElem.preload = 'auto';
}

function connectBgToAudioCtx(){
  if(!audioCtx || !bgAudioElem || bgMediaSource) return;
  try{
    bgMediaSource = audioCtx.createMediaElementSource(bgAudioElem);
    bgMediaGain = audioCtx.createGain();
    bgMediaGain.gain.value = parseFloat(document.getElementById('bgVolume')?.value || 0.35);
    bgMediaSource.connect(bgMediaGain);
    bgMediaGain.connect(masterGain || audioCtx.destination);
  }catch(e){ console.warn('BG media source connect failed', e); }
}

function setBgVolume(v){ if(bgMediaGain) bgMediaGain.gain.value = v; }

function startBg(){
  if(!bgAudioElem) return;
  try{ bgAudioElem.currentTime = 0; const p = bgAudioElem.play(); if(p && p.catch) p.catch(e=>console.error('BG play rejected', e)); }catch(e){ console.error(e); }
}

function stopBg(){ if(bgAudioElem) try{ bgAudioElem.pause(); bgAudioElem.currentTime = 0; }catch(e){} }

// wire UI for background controls
document.addEventListener('DOMContentLoaded', ()=>{
  const fileIn = document.getElementById('bgFileInput');
  const toggle = document.getElementById('bgToggle');
  const vol = document.getElementById('bgVolume');
  if(fileIn){
    fileIn.addEventListener('change', (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      ensureBgAudio();
      const url = URL.createObjectURL(f);
      bgAudioElem.src = url;
      // init audio context and route
      initAudio();
      connectBgToAudioCtx();
      // if toggle on, start
      if(toggle && toggle.checked){ startBg(); }
      console.info('Background file loaded:', f.name);
    });
  }
  // select from mp3/ folder
  const select = document.getElementById('bgSelect');
  if(select){
    select.addEventListener('change', (e)=>{
      const v = e.target.value;
      if(!v) return;
      ensureBgAudio();
      // use relative URL served by the site
      bgAudioElem.src = v;
      initAudio();
      connectBgToAudioCtx();
      if(document.getElementById('bgToggle')?.checked){ startBg(); }
      console.info('Background selected from mp3/:', v);
    });
  }
  if(toggle){
    toggle.addEventListener('change', ()=>{
      initAudio();
      connectBgToAudioCtx();
      if(toggle.checked){ startBg(); }
      else { stopBg(); }
    });
  }
  if(vol){ vol.addEventListener('input', (e)=>{ const v=parseFloat(e.target.value); setBgVolume(v); }); }
});

function showCard(){ 
  card.classList.add('show');
  const stage = document.querySelector('.stage');
  if(stage) stage.style.display = 'none';
}
function hideCard(){ 
  card.classList.remove('show');
  const stage = document.querySelector('.stage');
  if(stage) stage.style.display = '';
}

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
  document.body.classList.add('focus-cake'); // display only cake

  cake.setAttribute('aria-pressed','true');
  cake.classList.add('lit');
  candle.innerHTML = '<span class="flame">🔥</span>';
  candle.setAttribute('aria-hidden','false');
  playAudioOnInteraction();
  startConfetti();
  setTimeout(showCard, 8500); // Wait for the 8s song to finish before showing the card
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
