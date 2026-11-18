// Web Audio: synthesized sound effects and a small original background loop.
let ac = null, master = null, sfxBus = null, musicBus = null;
let muted = false;
try { muted = localStorage.getItem('wagle.mute') === '1'; } catch (e) { }

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(comp);
    musicBus = ac.createGain(); musicBus.gain.value = 0.22; musicBus.connect(comp);
  }
  if (ac.state === 'suspended') ac.resume();
}
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('wagle.mute', muted ? '1' : '0'); } catch (e) { }
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.02);
}

function tone(f, dur, { type = 'sine', vol = 0.3, slide = 0, at = 0, attack = 0.005, bus } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', at = 0, sweep = 0 } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t0 + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t0);
}

export const sfx = {
  click() { tone(520, 0.06, { type: 'triangle', vol: 0.18 }); },
  hover() { tone(700, 0.03, { type: 'sine', vol: 0.06 }); },
  tick() { tone(440, 0.09, { type: 'square', vol: 0.08 }); },
  go() { tone(523, 0.12, { type: 'square', vol: 0.12 }); tone(784, 0.25, { type: 'square', vol: 0.12, at: 0.1 }); },
  pop() { noise(0.08, { vol: 0.35, freq: 2200, q: 0.8 }); tone(380, 0.08, { type: 'sine', vol: 0.2, slide: 0.5 }); },
  coin() { tone(660, 0.07, { type: 'square', vol: 0.09 }); tone(990, 0.16, { type: 'square', vol: 0.09, at: 0.06 }); },
  bomb() { noise(0.35, { vol: 0.5, freq: 400, q: 0.6, type: 'lowpass', sweep: 0.3 }); tone(120, 0.3, { type: 'sawtooth', vol: 0.15, slide: 0.5 }); },
  bump(v = 1) { tone(110, 0.14, { type: 'sine', vol: 0.35 * v, slide: 0.6 }); noise(0.06, { vol: 0.2 * v, freq: 600 }); },
  boost() { noise(0.25, { vol: 0.2, freq: 500, sweep: 3 }); },
  jump() { tone(300, 0.14, { type: 'triangle', vol: 0.14, slide: 1.8 }); },
  land() { tone(140, 0.07, { type: 'sine', vol: 0.18, slide: 0.7 }); },
  crack() { noise(0.12, { vol: 0.18, freq: 1600, q: 2 }); },
  fall() { tone(500, 0.6, { type: 'triangle', vol: 0.14, slide: 0.25 }); },
  whoosh() { noise(0.35, { vol: 0.22, freq: 300, sweep: 4 }); },
  boom() { noise(0.4, { vol: 0.45, freq: 220, type: 'lowpass', sweep: 0.5 }); tone(80, 0.3, { type: 'sine', vol: 0.4, slide: 0.5 }); },
  stop() { tone(880, 0.05, { type: 'square', vol: 0.1 }); tone(660, 0.08, { type: 'square', vol: 0.08, at: 0.04 }); },
  lock() { tone(392, 0.06, { type: 'triangle', vol: 0.14 }); tone(523, 0.1, { type: 'triangle', vol: 0.14, at: 0.05 }); },
  good() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.14, at: i * 0.06 })); },
  bad() { tone(330, 0.18, { type: 'triangle', vol: 0.14 }); tone(247, 0.3, { type: 'triangle', vol: 0.14, at: 0.14 }); },
  emote() { tone(600, 0.06, { type: 'sine', vol: 0.14 }); tone(900, 0.1, { type: 'sine', vol: 0.1, at: 0.05 }); },
  kick() { tone(150, 0.16, { type: 'sine', vol: 0.5, slide: 0.35 }); },
  snare() { noise(0.12, { vol: 0.35, freq: 1800, q: 0.7 }); tone(220, 0.08, { type: 'triangle', vol: 0.12, slide: 0.6 }); },
  hat() { noise(0.04, { vol: 0.12, freq: 8000, q: 0.8, type: 'highpass' }); },
  perfect() { tone(784, 0.07, { type: 'triangle', vol: 0.12 }); tone(1175, 0.1, { type: 'triangle', vol: 0.1, at: 0.04 }); },
  miss() { tone(180, 0.12, { type: 'sawtooth', vol: 0.06, slide: 0.7 }); },
  pad(n) { const f = [330, 392, 494, 587][n % 4]; tone(f, 0.32, { type: 'triangle', vol: 0.2 }); tone(f * 2, 0.2, { type: 'sine', vol: 0.06 }); },
  slide() { noise(0.5, { vol: 0.12, freq: 900, q: 0.5, sweep: 0.6 }); },
  alarm() { tone(660, 0.12, { type: 'square', vol: 0.1 }); tone(660, 0.12, { type: 'square', vol: 0.1, at: 0.18 }); },
  spin() { tone(300 + Math.random() * 40, 0.04, { type: 'square', vol: 0.05 }); },
  fanfare() {
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.54], [1047, 0.66]];
    seq.forEach(([f, at]) => { tone(f, 0.22, { type: 'square', vol: 0.09, at }); tone(f / 2, 0.22, { type: 'triangle', vol: 0.12, at }); });
  },
};

// ---- background loop (original, simple chord progression) ----
let musicTimer = null, musicStep = 0, musicNext = 0, currentTheme = null;
const THEMES = {
  menu: { bpm: 104, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], lead: [0, 2, 4, 2, 0, -1, 0, 2] },
  game: { bpm: 132, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], lead: [4, 2, 0, 2, 4, 4, 2, 0] },
  tense: { bpm: 150, chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 58, 62]], lead: [0, 0, 3, 0, 5, 3, 0, -2] },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function playMusic(name) {
  if (currentTheme === name) return;
  currentTheme = name;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (!name) return;
  musicStep = 0; musicNext = 0;
  musicTimer = setInterval(scheduleMusic, 60);
}
function scheduleMusic() {
  if (!ac || !currentTheme) return;
  const th = THEMES[currentTheme], spb = 60 / th.bpm / 2; // eighth notes
  if (musicNext < ac.currentTime) musicNext = ac.currentTime + 0.05;
  while (musicNext < ac.currentTime + 0.25) {
    const bar = Math.floor(musicStep / 8) % th.chords.length, st = musicStep % 8;
    const ch = th.chords[bar];
    const at = musicNext - ac.currentTime;
    if (st % 2 === 0) tone(mtof(ch[0] - 24), spb * 1.6, { type: 'triangle', vol: 0.5, at, bus: musicBus });
    tone(mtof(ch[st % 3] + 12), spb * 0.8, { type: 'square', vol: 0.08, at, bus: musicBus });
    if (st === 0 || st === 3 || st === 6) {
      const deg = th.lead[(musicStep / 1 + bar) % th.lead.length];
      const scale = [0, 2, 4, 5, 7, 9, 11];
      const m = 72 + (deg >= 0 ? scale[deg % 7] : -12 + scale[(deg + 7) % 7]);
      tone(mtof(m), spb * 1.4, { type: 'triangle', vol: 0.12, at, bus: musicBus });
    }
    if (st % 4 === 2) noiseMusic(at);
    musicNext += spb; musicStep++;
  }
}
function noiseMusic(at) {
  const t0 = ac.currentTime + at, len = Math.floor(ac.sampleRate * 0.05);
  const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
  const g = ac.createGain(); g.gain.value = 0.35;
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(t0);
}
