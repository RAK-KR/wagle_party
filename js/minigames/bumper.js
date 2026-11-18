// 범퍼카 링 아웃 — bump others off a shrinking round arena.
import { W, H } from '../config.js';
import { shade } from '../characters.js';
import { INK, rr } from './common.js';

const CX = W / 2, CY = 410, YS = 0.6;   // arena center, vertical squash
const R0 = 340, RMIN = 170, LIMIT = 45, CR = 38;
const ACC = 950, MAXV = 330, DRAG = 1.6, BOOST = 560, BOOST_CD = 1.5;

export default {
  id: 'bumper', name: '범퍼카 링 아웃', typeLabel: '탈것', color: '#5ed0d6',
  rule: '범퍼카로 서로 밀어서 경기장 밖으로 떨어뜨리세요. 경기장은 점점 좁아집니다.',
  controls: [['운전', 'WASD / 방향키'], ['부스트 박치기', 'Space (1.5초마다)']],
  touch: { stick: true, a: true, aLabel: '부스트' },

  init() {
    const players = [0, 1, 2, 3].map(i => {
      const a = -Math.PI / 4 + i * Math.PI / 2 + Math.PI;
      return { i, x: Math.cos(a) * 210, y: Math.sin(a) * 210, vx: 0, vy: 0, ang: a + Math.PI, alive: true, fallT: 0, deathT: 0, cd: 0, boostT: 0, hitT: 0, bot: { target: -1, next: 0 } };
    });
    return { t: 0, players, sparks: [], endTimer: -1, R: R0 };
  },
  radius(st) { return st.t < 8 ? R0 : Math.max(RMIN, R0 - (st.t - 8) * ((R0 - RMIN) / 28)); },

  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.R = this.radius(st);
    for (const p of st.players) {
      if (!p.alive) { p.fallT += dt; continue; }
      const inp = ended ? { mx: 0, my: 0 } : inputs[p.i];
      p.cd = Math.max(0, p.cd - dt); p.boostT = Math.max(0, p.boostT - dt); p.hitT = Math.max(0, p.hitT - dt);
      let mx = inp.mx, my = inp.my; const l = Math.hypot(mx, my);
      if (l > 0.1) {
        mx /= Math.max(1, l); my /= Math.max(1, l);
        p.vx += mx * ACC * dt; p.vy += my * ACC * dt;
        const target = Math.atan2(my, mx);
        let da = target - p.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        p.ang += da * Math.min(1, dt * 9);
      }
      if (!ended && inp.aP && p.cd === 0) {
        p.vx += Math.cos(p.ang) * BOOST; p.vy += Math.sin(p.ang) * BOOST; p.cd = BOOST_CD; p.boostT = 0.35; game.sfx('boost', null);
      }
      const sp = Math.hypot(p.vx, p.vy), cap = p.boostT > 0 ? MAXV * 2.2 : MAXV;
      if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
      p.vx *= Math.exp(-DRAG * dt); p.vy *= Math.exp(-DRAG * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.hypot(p.x, p.y) > st.R + CR * 0.35) { p.alive = false; p.deathT = st.t; game.sfx('fall', null); }
    }
    // collisions
    const ps = st.players;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = ps[a], B = ps[b];
      if (!A.alive || !B.alive) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < CR * 2 && d > 1e-3) {
        const nx = dx / d, ny = dy / d, over = CR * 2 - d;
        A.x -= nx * over / 2; A.y -= ny * over / 2; B.x += nx * over / 2; B.y += ny * over / 2;
        const rel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
        if (rel > 0) {
          const bonusA = A.boostT > 0 ? 1.7 : 1, bonusB = B.boostT > 0 ? 1.7 : 1;
          const j = rel * 1.15;
          B.vx += nx * j * bonusA; B.vy += ny * j * bonusA;
          A.vx -= nx * j * bonusB; A.vy -= ny * j * bonusB;
          A.hitT = B.hitT = 0.3;
          const mxp = (A.x + B.x) / 2, myp = (A.y + B.y) / 2;
          for (let k = 0; k < 10; k++) { const an = rng.next() * Math.PI * 2, v = 80 + rng.next() * 220; st.sparks.push({ x: mxp, y: myp, vx: Math.cos(an) * v, vy: Math.sin(an) * v, life: 0.4 }); }
          game.sfx('bump', null, Math.min(1.4, rel / 250));
        }
      }
    }
    for (const s of st.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    st.sparks = st.sparks.filter(s => s.life > 0);
    const alive = ps.filter(p => p.alive).length;
    if (st.endTimer < 0 && (alive <= 1 || st.t >= LIMIT)) st.endTimer = st.t;
  },
  done(st) { return st.endTimer >= 0 && st.t - st.endTimer > 0.8; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.players.map(p => p.alive ? 1000 : Math.round(p.deathT * 100) / 100); },
  detail(st, i) { const p = st.players[i]; return p.alive ? '끝까지 생존' : `${p.deathT.toFixed(1)}초에 추락`; },

  bot(st, i, game, rng) {
    const p = st.players[i];
    if (!p.alive) return {};
    const k = game.diff.k, b = p.bot;
    const dc = Math.hypot(p.x, p.y);
    // danger: near the edge -> steer back to center
    if (dc > st.R - 60 - k * 30) {
      const away = { mx: -p.x / dc, my: -p.y / dc };
      return { ...away, a: dc > st.R - 25 && p.cd === 0 && rng.next() < k * 0.5 };
    }
    if (st.t > b.next) {
      b.next = st.t + 0.5 + (1 - k) * 0.8;
      let best = -1, bs = -1e9;
      for (const o of st.players) {
        if (o === p || !o.alive) continue;
        const s = Math.hypot(o.x, o.y) * 0.8 - Math.hypot(o.x - p.x, o.y - p.y) * 0.5 + rng.next() * 60;
        if (s > bs) { bs = s; best = o.i; }
      }
      b.target = best;
    }
    const o = st.players[b.target];
    if (!o || !o.alive) return { mx: -p.x / (dc + 1), my: -p.y / (dc + 1) };
    // approach from the center side so the hit pushes the target outward
    const od = Math.hypot(o.x, o.y) || 1, ox = o.x / od, oy = o.y / od;
    const dx = o.x - p.x, dy = o.y - p.y, dist = Math.hypot(dx, dy);
    let tx = o.x - ox * 70, ty = o.y - oy * 70;
    if (dist < 150 && (dx * ox + dy * oy) > 0) { tx = o.x; ty = o.y; }
    let mx = tx - p.x, my = ty - p.y; const l = Math.hypot(mx, my) || 1;
    mx /= l; my /= l;
    const facing = Math.cos(p.ang) * dx / (dist || 1) + Math.sin(p.ang) * dy / (dist || 1);
    const a = p.cd === 0 && dist < 170 && facing > 0.85 && rng.next() < 0.15 + k * 0.5;
    return { mx: mx + (rng.next() - 0.5) * (1 - k) * 0.6, my: my + (rng.next() - 0.5) * (1 - k) * 0.6, a };
  },

  render(ctx, st, game) {
    const g = ctx.createRadialGradient(CX, CY, 50, CX, CY, 700);
    g.addColorStop(0, '#f2ecff'); g.addColorStop(1, '#c9dcfb');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // crowd lights ring
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2, x = CX + Math.cos(a) * 560, y = CY - 40 + Math.sin(a) * 300;
      const on = (Math.floor(game.t * 6) + k) % 4 === 0;
      ctx.fillStyle = on ? '#ffd76e' : 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, on ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    const R = st.R;
    // arena side
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(CX, CY + 34, R + 3, R * YS + 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(CX, CY + 30, R, R * YS, 0, 0, Math.PI); ctx.lineTo(CX - R, CY); ctx.ellipse(CX, CY, R, R * YS, 0, Math.PI, 0, true); ctx.closePath(); ctx.clip();
    for (let k = -R; k < R; k += 30) { ctx.fillStyle = (Math.floor(k / 30) % 2) ? '#ffd76e' : '#fbf8ff'; ctx.beginPath(); ctx.moveTo(CX + k, CY); ctx.lineTo(CX + k + 30, CY); ctx.lineTo(CX + k + 30 - 14, CY + 60 + R * YS); ctx.lineTo(CX + k - 14, CY + 60 + R * YS); ctx.fill(); }
    ctx.restore();
    // floor
    const fg = ctx.createRadialGradient(CX, CY, 20, CX, CY, R);
    fg.addColorStop(0, '#d9ccff'); fg.addColorStop(1, '#b9a8f0');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(CX, CY, R, R * YS, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(CX, CY, R, R * YS, 0, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let r = 60; r < R0; r += 60) { ctx.beginPath(); ctx.ellipse(CX, CY, r, r * YS, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    const warn = R < R0 && R > RMIN ? 0.5 + Math.sin(game.t * 10) * 0.5 : 0.3;
    ctx.strokeStyle = `rgba(255,93,108,${0.4 + warn * 0.5})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(CX, CY, R - 4, (R - 4) * YS, 0, 0, Math.PI * 2); ctx.stroke();

    const order = st.players.slice().sort((a, b) => a.y - b.y);
    for (const p of order) {
      if (!p.alive) continue;
      drawCar(ctx, p, game);
    }
    for (const p of order) if (!p.alive && p.fallT < 1.5) {
      const X = CX + p.x, Y = CY + p.y * YS + p.fallT * p.fallT * 600;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.fallT / 1.5);
      drawCar(ctx, { ...p, x: p.x, y: p.y }, game, p.fallT * p.fallT * 600, p.fallT * 3);
      ctx.restore();
    }
    for (const s of st.sparks) { ctx.fillStyle = `rgba(255,220,120,${s.life / 0.4})`; ctx.fillRect(CX + s.x - 2, CY + s.y * YS - 2, 4, 4); }
    // boost cooldown for local
    const me = st.players[game.local];
    if (me.alive) {
      const X = CX + me.x, Y = CY + me.y * YS + 34;
      ctx.fillStyle = 'rgba(67,56,110,0.35)'; rr(ctx, X - 30, Y, 60, 7, 3.5); ctx.fill();
      ctx.fillStyle = me.cd === 0 ? '#6ee08a' : '#ffcf3a'; ctx.fillRect(X - 30, Y, 60 * (1 - me.cd / BOOST_CD), 6);
    }
  },
};

function drawCar(ctx, p, game, drop = 0, spin = 0) {
  const X = CX + p.x, Y = CY + p.y * YS + drop, col = game.players[p.i].color;
  ctx.save(); ctx.translate(X, Y); if (spin) ctx.rotate(spin);
  const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
  // shadow
  if (!drop) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 8, 48, 22, 0, 0, Math.PI * 2); ctx.fill(); }
  // rubber bumper ring
  ctx.fillStyle = '#1d1a24'; ctx.beginPath(); ctx.ellipse(0, 0, 48, 28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(col, -0.25); ctx.beginPath(); ctx.ellipse(0, -4, 42, 23, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(col, 0.15); ctx.beginPath(); ctx.ellipse(0, -7, 34, 17, 0, 0, Math.PI * 2); ctx.fill();
  // headlight in driving direction
  ctx.fillStyle = p.boostT > 0 ? '#fff' : '#ffe9a0';
  ctx.beginPath(); ctx.ellipse(ca * 36, sa * 20 - 4, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  // pole
  ctx.fillStyle = '#c9c3d6'; ctx.fillRect(-2, -70, 4, 50); ctx.fillStyle = '#ff5d6c'; ctx.beginPath(); ctx.arc(0, -72, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // driver
  game.drawPlayer(ctx, p.i, X, Y - 6, 56, { facing: ca >= 0 ? 1 : -1, tag: !drop, noShadow: true, expr: p.hitT > 0 ? 'lose' : drop ? 'lose' : 'idle', rot: spin });
  // front rim over the driver
  ctx.save(); ctx.translate(X, Y); if (spin) ctx.rotate(spin);
  ctx.beginPath(); ctx.ellipse(0, -4, 42, 23, 0, 0.15, Math.PI - 0.15); ctx.lineTo(-38, 8); ctx.ellipse(0, 4, 40, 22, 0, Math.PI - 0.1, 0.1, true); ctx.closePath();
  ctx.fillStyle = shade(col, -0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-20, 12, 40, 3);
  if (p.boostT > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-ca * (50 + k * 12), -sa * (28 + k * 6) + k * 5 - 5); ctx.lineTo(-ca * (70 + k * 12), -sa * (38 + k * 6) + k * 5 - 5); ctx.stroke(); } }
  ctx.restore();
}
