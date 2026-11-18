// 박자 맞추기 — drum notes scroll in; hit them on the line. Everyone plays the same chart. (drum pattern only, no melody)
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, shade } from './common.js';

const BPM = 120, STEP = 60 / BPM / 2, LEAD = 2.4, HITX = 250, SPD = 430, ROWY = [140, 290, 440, 590];
const PERFECT = 0.05, GOOD = 0.1, OK = 0.15;
const BARS = [
  [1, 0, 1, 0, 1, 0, 1, 0], [1, 0, 1, 1, 0, 0, 1, 0], [1, 1, 0, 1, 0, 1, 0, 0], [1, 0, 0, 1, 1, 0, 1, 0],
  [1, 0, 1, 0, 1, 1, 1, 0], [1, 1, 1, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 0, 1, 1], [0, 1, 1, 0, 1, 1, 0, 1],
];

export default {
  id: 'beat', name: '박자 맞추기', typeLabel: '타이밍', color: '#b59cff', music: 'none',
  rule: '드럼 노트가 왼쪽 선에 닿는 순간 누르세요. 정확할수록 점수가 높습니다. 모두 같은 악보입니다.',
  controls: [['치기', 'Space / 클릭']],
  touch: { stick: false, a: true, aLabel: '쿵' },

  init(game, rng) {
    const notes = [];
    const bars = 12;
    for (let b = 0; b < bars; b++) {
      const pool = b < 3 ? BARS.slice(0, 3) : b < 7 ? BARS.slice(1, 6) : BARS.slice(3);
      const pat = rng.pick(pool);
      pat.forEach((on, k) => { if (on) notes.push({ t: LEAD + (b * 8 + k) * STEP, kind: k % 4 === 0 ? 'kick' : 'snare' }); });
    }
    const end = notes[notes.length - 1].t + 1.2;
    return {
      t: 0, notes, end, lastBeat: -1,
      pl: [0, 1, 2, 3].map(i => ({ i, score: 0, combo: 0, best: 0, judged: new Array(notes.length).fill(null), fx: [], bounce: 0, plan: null })),
    };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    const beat = Math.floor((st.t - LEAD) / (STEP * 2));
    if (beat !== st.lastBeat && st.t < st.end - 1 && st.t > LEAD - 2 * STEP * 2) { st.lastBeat = beat; sfx.hat(); }
    for (const p of st.pl) {
      p.bounce = Math.max(0, p.bounce - dt);
      for (const f of p.fx) f.t += dt; p.fx = p.fx.filter(f => f.t < 0.5);
      // misses
      st.notes.forEach((n, k) => { if (p.judged[k] == null && st.t - n.t > OK) { p.judged[k] = 'miss'; p.combo = 0; p.fx.push({ txt: '놓침', col: COL.dim, t: 0 }); } });
      if (ended || !(inputs[p.i].aP || inputs[p.i].pP)) continue;
      let best = -1, bd = 1e9;
      st.notes.forEach((n, k) => { if (p.judged[k] == null) { const d = Math.abs(st.t - n.t); if (d < bd) { bd = d; best = k; } } });
      if (best >= 0 && bd <= OK) {
        const j = bd <= PERFECT ? 'perfect' : bd <= GOOD ? 'good' : 'ok';
        p.judged[best] = j; p.combo++; p.best = Math.max(p.best, p.combo);
        p.score += j === 'perfect' ? 3 : j === 'good' ? 2 : 1;
        p.bounce = 0.15;
        p.fx.push({ txt: j === 'perfect' ? '완벽!' : j === 'good' ? '좋아' : '아슬', col: j === 'perfect' ? COL.accent : j === 'good' ? COL.good : COL.sub, t: 0 });
        if (p.i === game.local) { st.notes[best].kind === 'kick' ? sfx.kick() : sfx.snare(); }
      } else { p.combo = 0; p.fx.push({ txt: '헛침', col: COL.bad, t: 0 }); if (p.i === game.local) sfx.miss(); }
    }
  },
  done(st) { return st.t >= st.end; },
  timeLeft(st) { return st.end - st.t; },
  scores(st) { return st.pl.map(p => p.score); },
  detail(st, i) { const p = st.pl[i]; return `${p.score}점 · 최대 콤보 ${p.best}`; },

  bot(st, i, game, rng) {
    const p = st.pl[i];
    if (!p.plan) {
      const sd = byDiff(game, [0.07, 0.045, 0.026]), miss = byDiff(game, [0.1, 0.05, 0.015]);
      p.plan = st.notes.map(n => rng.next() < miss ? null : n.t + rng.gauss() * sd);
      p.pi = 0;
    }
    while (p.pi < p.plan.length && (p.plan[p.pi] == null || p.judged[p.pi] != null && p.plan[p.pi] < st.t)) p.pi++;
    const at = p.plan[p.pi];
    if (at != null && st.t >= at) { p.pi++; return { a: true }; }
    return {};
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1534'); g.addColorStop(1, '#0f0b1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const pulse = Math.max(0, 1 - (((st.t - LEAD) / (STEP * 2)) % 1 + 1) % 1 * 3);
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i], y = ROWY[i];
      ctx.fillStyle = shade(pl.color, -0.7); ctx.fillRect(0, y - 62, W, 124);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(HITX, y - 4, W - HITX, 8);
      // hit line
      ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.4})`; ctx.fillRect(HITX - 3, y - 50, 6, 100);
      ctx.strokeStyle = pl.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(HITX, y, 30 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
      // notes
      st.notes.forEach((n, k) => {
        const x = HITX + (n.t - st.t) * SPD;
        if (x < HITX - 60 || x > W + 40) return;
        const j = p.judged[k];
        if (j && j !== 'miss') return;
        ctx.globalAlpha = j === 'miss' ? 0.3 : 1;
        ctx.fillStyle = n.kind === 'kick' ? pl.color : shade(pl.color, 0.45);
        ctx.beginPath(); ctx.arc(x, y, n.kind === 'kick' ? 24 : 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b1824'; ctx.lineWidth = 3; ctx.stroke();
        ctx.globalAlpha = 1;
      });
      // character
      game.drawPlayer(ctx, i, 92, y + 50 - p.bounce * 60, 86, { tag: true, expr: p.combo >= 8 ? 'win' : p.fx.some(f => f.txt === '놓침' || f.txt === '헛침') ? 'lose' : 'idle' });
      for (const f of p.fx) text(ctx, f.txt, HITX, y - 40 - f.t * 40, { size: 20, weight: 900, align: 'center', color: f.col, alpha: 1 - f.t * 2, stroke: '#1b1824', strokeW: 4 });
      text(ctx, `${p.score}`, W - 24, y - 24, { size: 30, weight: 900, align: 'right', color: '#fff' });
      if (p.combo >= 3) text(ctx, `${p.combo} 콤보`, W - 24, y + 4, { size: 16, weight: 900, align: 'right', color: COL.accent });
    }
    if (st.t < LEAD) text(ctx, '박자에 맞춰 준비...', W / 2, 70, { size: 24, weight: 900, align: 'center', color: COL.sub });
  },
};
