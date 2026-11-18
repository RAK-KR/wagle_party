// 컬링 — take turns sliding stones toward the target. Knock others away. 2 stones each, closest stones score.
import { W, H, COL, text, byDiff, clamp, shade } from './common.js';

const IX0 = 40, IX1 = 1240, IY0 = 150, IY1 = 620, HX = 150, HY = (IY0 + IY1) / 2, TX = 1030, TY = HY;
const SR = 20, FR = 150, V0 = 760, AMAX = 0.2, PMIN = 0.35, RINGS = [34, 74, 118], SHOTS = 2, IDLE = 7;
const angleAt = (t) => Math.sin(t * Math.PI * 2 / 1.9) * AMAX;
const powerAt = (t) => { const f = (t / 1.35) % 1; return PMIN + (1 - PMIN) * (f < 0.5 ? f * 2 : 2 - f * 2); };
const ptsFor = (d) => d <= RINGS[0] ? 3 : d <= RINGS[1] ? 2 : d <= RINGS[2] + SR * 0.5 ? 1 : 0;

export default {
  id: 'curling', name: '컬링', typeLabel: '물리', color: '#5ed0d6',
  rule: '차례대로 돌을 밀어 과녁 가운데에 가깝게 멈추세요. 남의 돌을 쳐낼 수 있습니다. 2번째 바퀴는 순서가 거꾸로라 먼저 던진 사람이 마지막에 던집니다.',
  controls: [['방향 정하기', 'Space (흔들리는 방향에서 멈춤)'], ['힘 정하고 밀기', 'Space 한 번 더']],
  touch: { stick: false, a: true, aLabel: '정하기' },

  init(game, rng) {
    // 1st throw order is random, 2nd round is reversed: whoever throws first also gets the very last stone
    const first = rng.shuffle([0, 1, 2, 3]);
    const order = [...first, ...first.slice().reverse()];
    return { t: 0, order, turn: 0, phase: 'aim', pt: 0, ang: 0, pow: 0.6, stones: [], plan: null, end: false, endT: 0, flash: [] };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    for (const f of st.flash) f.t += dt; st.flash = st.flash.filter(f => f.t < 1);
    if (st.end) return;
    const who = st.order[st.turn], inp = inputs[who];
    const press = !ended && (inp.aP || inp.pP);
    if (st.phase === 'aim') { st.ang = angleAt(st.pt); if (press || st.pt > IDLE) { st.phase = 'power'; st.pt = 0; game.sfx('lock', who); } }
    else if (st.phase === 'power') {
      st.pow = powerAt(st.pt);
      if (press || st.pt > IDLE) {
        st.stones.push({ owner: who, x: HX + 30, y: HY, vx: Math.cos(st.ang) * V0 * st.pow, vy: Math.sin(st.ang) * V0 * st.pow, out: false });
        st.phase = 'slide'; st.pt = 0; game.sfx('slide', null);
      }
    } else if (st.phase === 'slide') {
      this.physics(st, dt, game);
      if (st.stones.every(s => s.out || Math.hypot(s.vx, s.vy) < 3)) {
        st.stones.forEach(s => { s.vx = s.vy = 0; });
        st.turn++; st.pt = 0; st.plan = null;
        if (st.turn >= st.order.length) { st.end = true; st.endT = st.t; game.sfx('fanfare', null); }
        else st.phase = 'aim';
      }
    }
  },
  physics(st, dt, game) {
    const sub = 4, h = dt / sub;
    for (let k = 0; k < sub; k++) {
      for (const s of st.stones) {
        if (s.out) continue;
        const v = Math.hypot(s.vx, s.vy);
        if (v > 0) { const nv = Math.max(0, v - FR * h); s.vx *= nv / v; s.vy *= nv / v; }
        s.x += s.vx * h; s.y += s.vy * h;
        if (s.x > IX1 - SR || s.x < IX0 + SR || s.y < IY0 + SR || s.y > IY1 - SR) { s.out = true; s.vx = s.vy = 0; }
      }
      for (let a = 0; a < st.stones.length; a++) for (let b = a + 1; b < st.stones.length; b++) {
        const A = st.stones[a], B = st.stones[b]; if (A.out || B.out) continue;
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
        if (d < SR * 2 && d > 0.01) {
          const nx = dx / d, ny = dy / d, o = (SR * 2 - d) / 2;
          A.x -= nx * o; A.y -= ny * o; B.x += nx * o; B.y += ny * o;
          const rel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
          if (rel > 0) { const j = rel * 0.95; A.vx -= nx * j; A.vy -= ny * j; B.vx += nx * j; B.vy += ny * j; game.sfx('bump', null, Math.min(1, rel / 300)); st.flash.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, t: 0 }); }
        }
      }
    }
  },
  tally(st) {
    const pts = [0, 0, 0, 0], best = [1e9, 1e9, 1e9, 1e9];
    for (const s of st.stones) { if (s.out) continue; const d = Math.hypot(s.x - TX, s.y - TY); pts[s.owner] += ptsFor(d); best[s.owner] = Math.min(best[s.owner], d); }
    return { pts, best };
  },
  done(st) { return st.end && st.t - st.endT > 1.5; },
  scores(st) { const { pts, best } = this.tally(st); return pts.map((p, i) => p * 10000 - Math.min(best[i], 9999)); },
  detail(st, i) { const { pts } = this.tally(st); return `${pts[i]}점`; },
  hud(ctx, st, game) { if (!st.end) text(ctx, `${game.players[st.order[st.turn]].name} 차례  (${st.turn + 1}/${st.order.length})`, W / 2, 33, { size: 20, weight: 900, align: 'center', color: game.players[st.order[st.turn]].color }); },

  bot(st, i, game, rng) {
    if (st.end || st.order[st.turn] !== i || st.phase === 'slide') return {};
    if (!st.plan) {
      // target: center, or knock away the best rival stone if it beats ours
      let tx = TX, ty = TY, extra = 0;
      const live = st.stones.filter(s => !s.out);
      const rival = live.filter(s => s.owner !== i).sort((a, b) => Math.hypot(a.x - TX, a.y - TY) - Math.hypot(b.x - TX, b.y - TY))[0];
      const mine = live.filter(s => s.owner === i).map(s => Math.hypot(s.x - TX, s.y - TY));
      const rivalD = rival ? Math.hypot(rival.x - TX, rival.y - TY) : 1e9;
      if (rival && rivalD < RINGS[1] && (!mine.length || Math.min(...mine) > rivalD) && rng.next() < byDiff(game, [0.15, 0.45, 0.8])) { tx = rival.x; ty = rival.y; extra = 0.28; }
      const dx = tx - (HX + 30), dy = ty - HY, dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx), pow = clamp(Math.sqrt(2 * FR * dist) / V0 + extra, PMIN, 1);
      st.plan = { ang, pow, tolA: byDiff(game, [0.028, 0.014, 0.006]), tolP: byDiff(game, [0.045, 0.022, 0.009]), delay: rng.range(0.5, 1.2), errA: rng.gauss() * byDiff(game, [0.02, 0.01, 0.004]), errP: rng.gauss() * byDiff(game, [0.035, 0.018, 0.007]) };
    }
    const pl = st.plan;
    if (st.pt < pl.delay) return {};
    if (st.phase === 'aim') return { a: Math.abs(st.ang - (pl.ang + pl.errA)) < pl.tolA };
    if (st.phase === 'power') return { a: Math.abs(st.pow - (pl.pow + pl.errP)) < pl.tolP };
    return {};
  },

  render(ctx, st, game) {
    ctx.fillStyle = '#1d2a3a'; ctx.fillRect(0, 0, W, H);
    // ice sheet
    const g = ctx.createLinearGradient(0, IY0, 0, IY1); g.addColorStop(0, '#eef8ff'); g.addColorStop(1, '#d4ecf7');
    ctx.fillStyle = g; ctx.fillRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
    ctx.strokeStyle = '#8a9fb0'; ctx.lineWidth = 6; ctx.strokeRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
    ctx.strokeStyle = 'rgba(120,160,190,0.25)'; ctx.lineWidth = 1; for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.moveTo(IX0, IY0 + 20 + k * 38); ctx.lineTo(IX1, IY0 + 30 + k * 38); ctx.stroke(); }
    ctx.fillStyle = 'rgba(232,71,63,0.6)'; ctx.fillRect(TX - 220, IY0, 4, IY1 - IY0);
    // house
    const cols = ['#3b6fd8', '#ffffff', '#e8473f'];
    [RINGS[2], RINGS[1], RINGS[0]].forEach((r, k) => { ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.arc(TX, TY, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(TX, TY, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(TX, IY0); ctx.lineTo(TX, IY1); ctx.moveTo(IX0, TY); ctx.lineTo(IX1, TY); ctx.stroke();
    ctx.fillStyle = '#2a2433'; ctx.fillRect(HX - 6, HY - 16, 12, 32);
    // stones
    for (const s of st.stones) if (!s.out) drawStone(ctx, s.x, s.y, game.players[s.owner].color);
    for (const f of st.flash) { ctx.strokeStyle = `rgba(255,255,255,${1 - f.t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 10 + f.t * 40, 0, Math.PI * 2); ctx.stroke(); }
    // thrower + aim
    if (!st.end && st.phase !== 'slide') {
      const who = st.order[st.turn];
      drawStone(ctx, HX + 30, HY, game.players[who].color);
      game.drawPlayer(ctx, who, HX - 20, HY + 30, 70, { tag: true, facing: 1 });
      ctx.strokeStyle = game.players[who].color; ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(HX + 30, HY); ctx.lineTo(HX + 30 + Math.cos(st.ang) * 420, HY + Math.sin(st.ang) * 420); ctx.stroke(); ctx.setLineDash([]);
      // power gauge
      ctx.fillStyle = 'rgba(27,24,36,0.7)'; ctx.fillRect(IX0 + 14, IY1 - 200, 20, 180);
      if (st.phase === 'power') { const h = 180 * (st.pow - PMIN) / (1 - PMIN); const pg = ctx.createLinearGradient(0, IY1 - 20, 0, IY1 - 200); pg.addColorStop(0, '#6ee08a'); pg.addColorStop(0.6, '#ffcf3a'); pg.addColorStop(1, '#ff5d6c'); ctx.fillStyle = pg; ctx.fillRect(IX0 + 14, IY1 - 20 - h, 20, h); }
      if (who === game.local && !game.auto) text(ctx, st.phase === 'aim' ? 'Space: 방향 정하기' : 'Space: 힘 정하고 밀기!', W / 2, IY1 + 40, { size: 22, weight: 900, align: 'center', color: COL.accent });
    }
    // score strip
    const { pts } = this.tally(st);
    for (let i = 0; i < 4; i++) {
      const p = game.players[i], x = 90 + i * 290, y = 64;
      const thrown = st.order.slice(0, st.turn).filter(o => o === i).length;
      ctx.fillStyle = shade(p.color, -0.6); ctx.fillRect(x, y, 240, 70);
      ctx.fillStyle = p.color; ctx.fillRect(x, y, 5, 70);
      game.drawPlayer(ctx, i, x + 40, y + 64, 50, { expr: st.end ? (pts[i] === Math.max(...pts) ? 'win' : 'idle') : 'idle' });
      text(ctx, p.name, x + 80, y + 28, { size: 16, weight: 900, color: p.color });
      text(ctx, `${pts[i]}점`, x + 80, y + 58, { size: 22, weight: 900 });
      for (let k = 0; k < SHOTS; k++) { ctx.fillStyle = k < SHOTS - thrown ? p.color : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(x + 200 + k * 20, y + 50, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    if (st.end) text(ctx, '점수: 빨강 3 · 하양 2 · 파랑 1', W / 2, IY1 + 40, { size: 20, weight: 900, align: 'center', color: COL.sub });
  },
};

function drawStone(ctx, x, y, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 4, SR, SR * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b8d98'; ctx.beginPath(); ctx.arc(x, y, SR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b4b6c0'; ctx.beginPath(); ctx.arc(x, y, SR - 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, SR - 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(col, -0.4); ctx.fillRect(x - 3, y - 12, 6, 12);
}
