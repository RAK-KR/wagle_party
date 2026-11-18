// 술래 몰래 — run while the watcher chants with their back turned; freeze before they look. Moving while watched sends you back.
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, shade, raceScores } from './common.js';

const LANES = [318, 412, 506, 600], START = 110, GOAL = 1040, RUN = 112, LIMIT = 55, TURN = 0.45, GRACE = 0.1;
const CHANT = ['무', '궁', '화', '꽃', '이', '피', '었', '습', '니', '다'];

export default {
  id: 'redlight', name: '술래 몰래', typeLabel: '타이밍', color: '#ff6b5a',
  rule: '술래가 뒤돌아 있을 때만 달리세요. "피었습니다"가 끝나고 술래가 돌아봤을 때 움직이면 뒤로 밀려납니다.',
  controls: [['달리기', 'Space / → 누르고 있기'], ['멈추기', '손 떼기']],
  touch: { stick: false, a: true, aLabel: '달리기' },

  init(game, rng) {
    const st = { t: 0, phase: 'away', pt: 0, dur: 3, pl: [0, 1, 2, 3].map(i => ({ i, x: START, v: 0, finishT: null, progress: 0, caught: 0, place: 0, bot: { greedy: false } })), finished: 0, caughtFx: [] };
    this.newAway(st, rng, game);
    return st;
  },
  newAway(st, rng, game) {
    st.phase = 'away'; st.pt = 0;
    st.dur = clamp(rng.range(1.5, 4.2) - st.t * 0.02, 1.2, 4.2);
    for (const p of st.pl) {
      p.bot.greedy = rng.next() < byDiff(game, [0.3, 0.18, 0.08]);
      p.bot.react = byDiff(game, [0.32, 0.22, 0.13]) + Math.abs(rng.gauss()) * byDiff(game, [0.14, 0.09, 0.05]);
      p.bot.overrun = rng.range(0.15, 0.4);
    }
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    if (st.phase === 'away' && st.pt >= st.dur) { st.phase = 'turn'; st.pt = 0; sfx.alarm(); }
    else if (st.phase === 'turn' && st.pt >= TURN) { st.phase = 'watch'; st.pt = 0; st.wdur = rng.range(1.3, 2.4); }
    else if (st.phase === 'watch' && st.pt >= st.wdur) this.newAway(st, rng, game);
    for (const p of st.pl) {
      p.caught = Math.max(0, p.caught - dt);
      if (p.finishT != null) continue;
      const inp = inputs[p.i];
      const go = !ended && p.caught <= 0 && (inp.a || inp.mx > 0.5);
      const target = go ? RUN : 0;
      p.v += clamp(target - p.v, -2600 * dt, 900 * dt);
      p.x += p.v * dt;
      if (st.phase === 'watch' && st.pt > GRACE && p.v > 18 && p.caught <= 0) {
        p.caught = 0.9; p.v = 0; p.x = Math.max(START, p.x - 260);
        st.caughtFx.push({ i: p.i, t: 0 });
        if (p.i === game.local) sfx.bad(); else sfx.miss();
      }
      if (p.x >= GOAL) { p.x = GOAL; p.finishT = st.t; st.finished++; p.place = st.finished; if (p.i === game.local) sfx.good(); }
      p.progress = (p.x - START) / (GOAL - START);
    }
    for (const f of st.caughtFx) f.t += dt;
    st.caughtFx = st.caughtFx.filter(f => f.t < 1);
  },
  done(st) {
    const first = st.pl.filter(p => p.finishT != null).map(p => p.finishT);
    return st.pl.every(p => p.finishT != null) || st.t > LIMIT || (first.length && st.t > Math.min(...first) + 10);
  },
  timeLeft(st) { const f = st.pl.filter(p => p.finishT != null); return f.length ? Math.min(...f.map(p => p.finishT)) + 10 - st.t : LIMIT - st.t; },
  scores(st) { return raceScores(st.pl); },
  detail(st, i) { const p = st.pl[i]; return p.finishT != null ? `${p.finishT.toFixed(1)}초 도착` : `${Math.round(p.progress * 100)}% 지점`; },

  bot(st, i, game, rng) {
    const p = st.pl[i];
    const b = p.bot;
    if (st.phase === 'away') return { a: true };
    if (st.phase === 'turn') return { a: b.greedy || st.pt < b.react };
    if (st.phase === 'watch') return { a: (b.greedy && st.pt < b.overrun) || (st.pt < b.react - TURN) };
    return {};
  },

  render(ctx, st, game) {
    // sky + schoolyard
    const g = ctx.createLinearGradient(0, 0, 0, 280); g.addColorStop(0, '#8ccfff'); g.addColorStop(1, '#dff1ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 280);
    ctx.fillStyle = '#c9a26a'; ctx.fillRect(0, 260, W, H - 260);
    ctx.fillStyle = '#7ec26a'; ctx.fillRect(0, 248, W, 18);
    // trees
    for (let k = 0; k < 9; k++) { const x = 60 + k * 150; ctx.fillStyle = '#6b4f3a'; ctx.fillRect(x - 5, 190, 10, 60); ctx.fillStyle = k % 2 ? '#4f9a46' : '#5cab51'; ctx.beginPath(); ctx.arc(x, 180, 34, 0, Math.PI * 2); ctx.fill(); }
    // lanes + lines
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; ctx.fillRect(0, LANES[k] - 70, W, 94); }
    ctx.fillStyle = '#fff'; ctx.fillRect(START - 4, 250, 6, H - 250);
    for (let y = 250; y < H; y += 24) { ctx.fillStyle = (y / 24) % 2 ? '#1b1824' : '#fff'; ctx.fillRect(GOAL + 30, y, 14, 24); ctx.fillStyle = (y / 24) % 2 ? '#fff' : '#1b1824'; ctx.fillRect(GOAL + 44, y, 14, 24); }
    // watcher
    drawWatcher(ctx, st);
    // chant bubble
    const n = st.phase === 'away' ? Math.floor(st.pt / st.dur * CHANT.length) : CHANT.length;
    const chant = CHANT.slice(0, n);
    const words = [chant.slice(0, 3).join(''), chant.slice(3, 5).join(''), chant.slice(5).join('')].filter(Boolean).join(' ');
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(380, 66, 520, 70);
    ctx.fillStyle = st.phase === 'away' ? '#6ee08a' : '#ff5d6c'; ctx.fillRect(380, 66, 8, 70);
    text(ctx, st.phase === 'away' ? (words || '...') : st.phase === 'turn' ? words + '!' : '멈춰!', 640, 113, { size: 36, title: true, align: 'center', color: st.phase === 'away' ? '#2a2433' : '#d8323f' });
    // runners
    for (const p of st.pl) {
      const y = LANES[p.i], moving = p.v > 18;
      const bob = moving ? Math.abs(Math.sin(st.t * 14)) * 6 : 0;
      const expr = p.finishT != null ? 'win' : p.caught > 0 ? 'lose' : 'idle';
      ctx.save();
      if (p.caught > 0 && Math.sin(st.t * 30) > 0) ctx.globalAlpha = 0.5;
      game.drawPlayer(ctx, p.i, p.x, y - bob, 76, { tag: true, expr, rot: moving ? 0.12 : 0 });
      ctx.restore();
      text(ctx, game.players[p.i].name, 30, y - 20, { size: 15, weight: 900, color: game.players[p.i].color });
      if (p.finishT != null) text(ctx, `${p.place}등`, p.x, y - 92, { size: 24, weight: 900, align: 'center', color: COL.accent, stroke: '#1b1824', strokeW: 5 });
    }
    for (const f of st.caughtFx) { const p = st.pl[f.i]; text(ctx, '걸렸다!', p.x, LANES[f.i] - 96 - f.t * 30, { size: 24, weight: 900, align: 'center', color: '#ff5d6c', stroke: '#fff', strokeW: 5, alpha: 1 - f.t }); }
  },
};

// Watcher: an original lookout robot with one big camera eye
function drawWatcher(ctx, st) {
  const x = 1175, y = 520;
  const look = st.phase === 'watch' ? 1 : st.phase === 'turn' ? st.pt / TURN : 0;
  // pole + base
  ctx.fillStyle = '#4a4553'; ctx.fillRect(x - 10, y - 130, 20, 130);
  ctx.fillStyle = '#5a6478'; ctx.fillRect(x - 46, y - 18, 92, 20);
  // body
  ctx.fillStyle = '#c9cfd8'; ctx.beginPath(); ctx.roundRect(x - 50, y - 210, 100, 90, 18); ctx.fill();
  ctx.fillStyle = '#9aa3b0'; ctx.fillRect(x - 50, y - 150, 100, 8);
  // head turns: squash horizontally to fake rotation
  const sx = Math.abs(Math.cos(look * Math.PI)) * 0.65 + 0.35;
  ctx.save(); ctx.translate(x, y - 262); ctx.scale(sx, 1);
  ctx.fillStyle = '#e6eaf0'; ctx.beginPath(); ctx.roundRect(-58, -48, 116, 96, 26); ctx.fill();
  ctx.strokeStyle = '#7a8494'; ctx.lineWidth = 4; ctx.stroke();
  if (look < 0.5) { // back panel with screws
    ctx.fillStyle = '#b6bec9'; ctx.fillRect(-36, -26, 72, 52);
    ctx.fillStyle = '#7a8494'; for (const [a, b] of [[-28, -18], [28, -18], [-28, 18], [28, 18]]) { ctx.beginPath(); ctx.arc(a, b, 4, 0, Math.PI * 2); ctx.fill(); }
  } else { // single camera eye
    ctx.fillStyle = '#1b1824'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    const glow = st.phase === 'watch' ? '#ff3b3b' : '#ffb347';
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(st.t * 12) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-7, -7, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // antenna
  ctx.strokeStyle = '#7a8494'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 310); ctx.lineTo(x, y - 338); ctx.stroke();
  ctx.fillStyle = st.phase === 'away' ? '#6ee08a' : '#ff3b3b'; ctx.beginPath(); ctx.arc(x, y - 342, 9, 0, Math.PI * 2); ctx.fill();
  if (st.phase === 'watch') { ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.moveTo(x - 30, y - 262); ctx.lineTo(0, 260); ctx.lineTo(0, H); ctx.closePath(); ctx.fill(); ctx.restore(); }
}
