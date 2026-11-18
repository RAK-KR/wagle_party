// 왕관 차지 — hold the crown as long as you can. Touch the holder to steal it.
import { W, H, COL, text, byDiff, clamp, crown } from './common.js';

const CX = W / 2, CY = 400, R = 330, YS = 0.62, LIMIT = 30, SPEED = 275, HOLD_SPEED = 252;

export default {
  id: 'crown', name: '왕관 차지', typeLabel: '캐릭터 조작', color: '#e8b830',
  rule: '왕관을 오래 쓰고 있을수록 점수가 올라갑니다. 왕관을 쓴 사람에게 돌진(Space)으로 부딪혀야 빼앗을 수 있고, 그냥 닿는 건 소용없습니다.',
  controls: [['이동', 'WASD / 방향키'], ['돌진', 'Space (뺏기, 도망가기 / 1.2초마다)']],
  touch: { stick: true, a: true, aLabel: '돌진' },

  init() {
    return {
      t: 0, holder: -1, immune: 0, flash: 0,
      pl: [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * Math.PI / 2; return { i, x: Math.cos(a) * 230, y: Math.sin(a) * 230, vx: 0, vy: 0, cd: 0, dash: 0, held: 0, daze: 0, facing: Math.cos(a) < 0 ? 1 : -1, bot: { next: 0, jx: 0, jy: 0 } }; }),
    };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.immune = Math.max(0, st.immune - dt); st.flash = Math.max(0, st.flash - dt);
    for (const p of st.pl) {
      p.cd = Math.max(0, p.cd - dt); p.dash = Math.max(0, p.dash - dt); p.daze = Math.max(0, p.daze - dt);
      const inp = ended || p.daze > 0 ? { mx: 0, my: 0 } : inputs[p.i];
      let mx = inp.mx, my = inp.my; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      const sp = SPEED;
      if (p.dash <= 0) { const k = Math.min(1, dt * 12); p.vx += (mx * sp - p.vx) * k; p.vy += (my * sp - p.vy) * k; }
      if (Math.abs(mx) > 0.2) p.facing = mx > 0 ? 1 : -1;
      if (!ended && inp.aP && p.cd === 0 && l > 0.1) { p.vx = mx / Math.max(l, 0.01) * 700; p.vy = my / Math.max(l, 0.01) * 700; p.dash = 0.2; p.cd = 1.2; game.sfx('boost', null); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const d = Math.hypot(p.x, p.y); if (d > R - 26) { p.x *= (R - 26) / d; p.y *= (R - 26) / d; }
      if (st.holder === p.i && !ended && st.t < LIMIT) p.held += dt;
    }
    // first grab
    if (st.holder < 0) for (const p of st.pl) if (Math.hypot(p.x, p.y) < 40) { st.holder = p.i; st.immune = 0.8; st.flash = 0.4; game.sfx('coin', null); break; }
    // collisions + steals
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = st.pl[a], B = st.pl[b];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 48 && d > 0.01) {
        const nx = dx / d, ny = dy / d, o = (48 - d) / 2;
        A.x -= nx * o; A.y -= ny * o; B.x += nx * o; B.y += ny * o;
        const attacker = st.holder === a ? B : st.holder === b ? A : null;   // the other one in this collision
        if (!ended && attacker && attacker.dash > 0 && st.immune <= 0) {
          const victim = st.pl[st.holder];
          st.holder = attacker.i; st.immune = 1.2; st.flash = 0.4;
          const s = victim === A ? -1 : 1; victim.vx = nx * 420 * s; victim.vy = ny * 420 * s; victim.dash = 0.15; victim.daze = 0.5;
          game.sfx('bump', null, 1); game.sfx('coin', attacker.i);
        } else if (A.dash <= 0 && B.dash <= 0) {
          // plain contact: just a soft push
          const rel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
          if (rel > 0) { A.vx -= nx * rel * 0.5; A.vy -= ny * rel * 0.5; B.vx += nx * rel * 0.5; B.vy += ny * rel * 0.5; }
        }
      }
    }
  },
  done(st) { return st.t >= LIMIT + 0.8; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => Math.round(p.held * 10) / 10); },
  detail(st, i) { return `${st.pl[i].held.toFixed(1)}초 차지`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    const lead = byDiff(game, [0.05, 0.22, 0.38]), dashP = byDiff(game, [0.01, 0.03, 0.06]), jitter = byDiff(game, [0.45, 0.25, 0.1]);
    if (st.t > b.next) { b.next = st.t + 0.3; b.jx = (rng.next() - 0.5) * jitter; b.jy = (rng.next() - 0.5) * jitter; }
    if (st.holder < 0) { const d = Math.hypot(p.x, p.y) || 1; return { mx: -p.x / d + b.jx, my: -p.y / d + b.jy }; }
    if (st.holder === i) {
      let fx = 0, fy = 0;
      for (const o of st.pl) { if (o === p) continue; const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy + 400; fx += dx / d2 * 9000; fy += dy / d2 * 9000; }
      const d = Math.hypot(p.x, p.y);
      if (d > R * 0.55) { const k = (d - R * 0.55) / (R * 0.45) * 2.2; fx -= p.x / d * k; fy -= p.y / d * k; fx += -p.y / d * k * 0.8; fy += p.x / d * k * 0.8; }
      const l = Math.hypot(fx, fy) || 1;
      let near = 1e9; for (const o of st.pl) if (o !== p) near = Math.min(near, Math.hypot(o.x - p.x, o.y - p.y));
      return { mx: fx / l + b.jx, my: fy / l + b.jy, a: p.cd === 0 && near < 110 && rng.next() < dashP * 3 };
    }
    const h = st.pl[st.holder];
    const dist = Math.hypot(h.x - p.x, h.y - p.y);
    const tx = h.x + h.vx * lead * Math.min(1, dist / 200), ty = h.y + h.vy * lead * Math.min(1, dist / 200);
    let mx = tx - p.x, my = ty - p.y; const l = Math.hypot(mx, my) || 1;
    return { mx: mx / l + b.jx, my: my / l + b.jy, a: p.cd === 0 && dist < 150 && st.immune <= 0.05 && rng.next() < dashP * 4 };
  },

  render(ctx, st, game) {
    const g = ctx.createRadialGradient(CX, CY, 40, CX, CY, 760); g.addColorStop(0, '#3b2a1a'); g.addColorStop(1, '#120c08');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stage
    ctx.fillStyle = '#5a2a1a'; ctx.beginPath(); ctx.ellipse(CX, CY + 22, R, R * YS, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c4473a'; ctx.beginPath(); ctx.ellipse(CX, CY, R, R * YS, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d65a4b'; ctx.beginPath(); ctx.ellipse(CX, CY, R - 30, (R - 30) * YS, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(CX, CY, R - 14, (R - 14) * YS, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,207,58,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(CX, CY, 70, 70 * YS, 0, 0, Math.PI * 2); ctx.stroke();
    if (st.holder < 0) { const bob = Math.sin(st.t * 4) * 6; crown(ctx, CX, CY - 30 + bob, 1.6); }
    const list = st.pl.slice().sort((a, b) => a.y - b.y);
    for (const p of list) {
      const X = CX + p.x, Y = CY + p.y * YS;
      const hold = st.holder === p.i;
      if (hold) { ctx.fillStyle = 'rgba(255,207,58,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y, 50, 20, 0, 0, Math.PI * 2); ctx.fill(); }
      game.drawPlayer(ctx, p.i, X, Y, 80, { facing: p.facing, tag: !hold, expr: hold ? 'win' : 'idle', ring: true });
      if (hold) {
        const blink = st.immune > 0 && Math.sin(st.t * 30) > 0;
        if (!blink) crown(ctx, X, Y - 92 - Math.sin(st.t * 6) * 3, 1.15 + st.flash);
      }
    }
    for (let i = 0; i < 4; i++) {
      const p = game.players[i], x = 330 + i * 160;
      ctx.fillStyle = st.holder === i ? 'rgba(255,207,58,0.85)' : 'rgba(14,12,19,0.7)'; ctx.fillRect(x, 54, 150, 28);
      ctx.fillStyle = p.color; ctx.fillRect(x, 54, 5, 28);
      text(ctx, p.name, x + 14, 73, { size: 14, weight: 900, color: st.holder === i ? '#1b1824' : p.color });
      text(ctx, st.pl[i].held.toFixed(1) + '초', x + 140, 74, { size: 16, weight: 900, align: 'right', color: st.holder === i ? '#1b1824' : COL.text });
    }
  },
};
