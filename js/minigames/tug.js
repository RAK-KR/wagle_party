// 줄다리기 (2:2) — press on the beat to pull hard. Mashing only gives weak pulls. Drag the flag over your line.
import { W, H, COL, text, byDiff, clamp, shade, scard, INK, pastel } from './common.js';

const BEAT = 0.5, WIN = 230, LIMIT = 28, ROPE_Y = 452, CX = W / 2;
const TEAM_COL = ['#ff8a4c', '#4cb2ff'];

export default {
  id: 'tug', name: '줄다리기 (2:2)', typeLabel: '물리 · 팀전', color: '#ff8a4c', music: 'none',
  rule: '2명씩 팀을 나눠 줄을 당깁니다. 원이 줄어들어 딱 맞을 때 누르면 세게 당깁니다. 마구 누르면 약하게만 당겨집니다.',
  controls: [['당기기', 'Space / 클릭 (박자에 맞춰)']],
  touch: { stick: false, a: true, aLabel: '영차' },

  init(game, rng) {
    const order = rng.shuffle([0, 1, 2, 3]);
    const team = []; order.forEach((p, k) => { team[p] = k < 2 ? 0 : 1; });
    return { t: 0, team, rope: 0, v: 0, winner: -1, endT: -1, lastBeat: -1, pl: [0, 1, 2, 3].map(i => ({ i, cd: 0, fx: [], pull: 0, perfect: 0, plan: null })) };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    const beat = Math.floor(st.t / BEAT);
    if (beat !== st.lastBeat && st.winner < 0) { st.lastBeat = beat; game.sfx(beat % 2 ? 'hat' : 'kick'); }
    for (const p of st.pl) {
      p.cd = Math.max(0, p.cd - dt); p.pull = Math.max(0, p.pull - dt);
      for (const f of p.fx) f.t += dt; p.fx = p.fx.filter(f => f.t < 0.5);
      if (ended || st.winner >= 0 || p.cd > 0) continue;
      const inp = inputs[p.i];
      if (!(inp.aP || inp.pP)) continue;
      const ph = st.t / BEAT, off = Math.abs(ph - Math.round(ph)) * BEAT;
      let force, label, col;
      if (off <= 0.06) { force = 30; label = '완벽!'; col = COL.accent; p.perfect++; game.sfx('perfect', p.i); }
      else if (off <= 0.12) { force = 16; label = '좋아'; col = COL.good; game.sfx('land', p.i); }
      else { force = 5; label = '삐끗'; col = COL.dim; }
      p.cd = 0.12; p.pull = 0.2;
      p.fx.push({ txt: label, col, t: 0 });
      st.v += (st.team[p.i] === 0 ? -1 : 1) * force;
    }
    st.v *= Math.exp(-2.4 * dt);
    st.rope += st.v * dt;
    if (st.winner < 0) {
      if (st.rope <= -WIN) st.winner = 0;
      else if (st.rope >= WIN) st.winner = 1;
      else if (st.t >= LIMIT) st.winner = Math.abs(st.rope) < 4 ? 2 : st.rope < 0 ? 0 : 1;
      if (st.winner >= 0) { st.endT = st.t; for (let j = 0; j < 4; j++) game.sfx(st.winner === 2 ? 'miss' : st.team[j] === st.winner ? 'good' : 'bad', j); }
    }
  },
  done(st) { return st.winner >= 0 && st.t - st.endT > 1; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => st.winner === 2 ? 0 : st.team[p.i] === st.winner ? 1 : 0); },
  detail(st, i) { const tn = st.team[i] === 0 ? '주황 팀' : '파랑 팀'; return st.winner === 2 ? `${tn} · 무승부` : st.team[i] === st.winner ? `${tn} 승리` : `${tn} 패배`; },

  bot(st, i, game, rng) {
    const p = st.pl[i];
    if (!p.plan) p.plan = { next: BEAT * 2 };
    if (st.t >= p.plan.next) {
      const sd = byDiff(game, [0.085, 0.055, 0.032]);
      const beatT = Math.round(st.t / BEAT + 1) * BEAT;
      p.plan.next = beatT + rng.gauss() * sd;
      if (rng.next() < byDiff(game, [0.25, 0.12, 0.04])) p.plan.next += BEAT;
      return { a: true };
    }
    return {};
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#bfe3ff'); g.addColorStop(0.55, '#eef7ff'); g.addColorStop(0.56, '#b5e3a3'); g.addColorStop(1, '#9fd68e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // mud pit + win lines
    ctx.fillStyle = '#c99c7a'; ctx.beginPath(); ctx.ellipse(CX, ROPE_Y + 70, 120, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#9e7457'; ctx.beginPath(); ctx.ellipse(CX, ROPE_Y + 72, 90, 18, 0, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) { ctx.fillStyle = TEAM_COL[s < 0 ? 0 : 1]; ctx.fillRect(CX + s * WIN - 3, ROPE_Y + 30, 6, 90); }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(CX - 2, ROPE_Y + 40, 4, 70);
    // rope
    const off = st.rope;
    ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(60, ROPE_Y - 6); ctx.lineTo(W - 60, ROPE_Y - 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(122,82,38,0.6)'; ctx.lineWidth = 2; for (let x = 60; x < W - 60; x += 14) { ctx.beginPath(); ctx.moveTo(x + (off % 14), ROPE_Y - 10); ctx.lineTo(x + 7 + (off % 14), ROPE_Y - 2); ctx.stroke(); }
    // flag
    ctx.fillStyle = '#6b4f3a'; ctx.fillRect(CX + off - 2, ROPE_Y - 6, 4, 50);
    ctx.fillStyle = '#e8473f'; ctx.beginPath(); ctx.moveTo(CX + off, ROPE_Y + 44); ctx.lineTo(CX + off + 26, ROPE_Y + 34); ctx.lineTo(CX + off, ROPE_Y + 24); ctx.closePath(); ctx.fill();
    // pullers
    const slots = [[], []];
    st.pl.forEach(p => slots[st.team[p.i]].push(p.i));
    for (const tm of [0, 1]) {
      slots[tm].forEach((i, k) => {
        const p = st.pl[i], dir = tm === 0 ? -1 : 1;
        const x = CX + off + dir * (300 + k * 130);
        const lean = (p.pull > 0 ? 0.32 : 0.18) * dir * -1;
        const expr = st.winner >= 0 ? (st.winner === tm ? 'win' : st.winner === 2 ? 'idle' : 'lose') : p.pull > 0 ? 'win' : 'idle';
        game.drawPlayer(ctx, i, x, ROPE_Y + 40, 100, { tag: true, facing: -dir, rot: -lean, expr, lockExpr: st.winner >= 0 });
        for (const f of p.fx) text(ctx, f.txt, x, ROPE_Y - 110 - f.t * 40, { size: 20, weight: 900, align: 'center', color: f.col, alpha: 1 - f.t * 2, stroke: INK, strokeW: 5, title: true });
      });
    }
    // beat ring
    const ph = (st.t / BEAT) % 1, r = 24 + (1 - ph) * 60;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(CX, 150, 50, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = COL.accent; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(CX, 150, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(67,56,110,${0.3 + ph * 0.6})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(CX, 150, r, 0, Math.PI * 2); ctx.stroke();
    text(ctx, '원이 겹칠 때 누르기', CX, 228, { size: 20, title: true, align: 'center', color: INK });
    // team labels
    for (const tm of [0, 1]) {
      const x = tm === 0 ? 70 : W - 70, al = tm === 0 ? 'left' : 'right';
      const names = slots[tm].map(i => game.players[i].name).join(' · ');
      scard(ctx, tm === 0 ? 50 : W - 370, 64, 320, 78, { r: 30, fill: pastel(TEAM_COL[tm], 0.45) });
      text(ctx, tm === 0 ? '주황 팀' : '파랑 팀', x, 100, { size: 26, title: true, align: al, color: '#fff', stroke: INK, strokeW: 6 });
      text(ctx, names, x, 128, { size: 17, title: true, align: al, color: INK });
    }
    if (st.winner >= 0) text(ctx, st.winner === 2 ? '무승부!' : (st.winner === 0 ? '주황 팀' : '파랑 팀') + ' 승리!', CX, 320, { size: 54, title: true, align: 'center', color: st.winner === 2 ? '#fff' : TEAM_COL[st.winner], stroke: INK, strokeW: 10 });
  },
};
