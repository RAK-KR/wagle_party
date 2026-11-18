// 무너지는 발판 — stand on a tile and it cracks. Keep moving, jump over holes, be the last one standing.
import { W, H } from '../config.js';
import { shade } from '../characters.js';

const COLS = 9, ROWS = 6, TW = 106, TH = 68, DEPTH = 26;
const OX = W / 2 - (COLS * TW) / 2, OY = 190;
const CRACK = 0.85, LIMIT = 45, SPEED = 2.9, JUMP_V = 5.6, GRAV = 16, PR = 0.3;

const sx = (x) => OX + x * TW;
const sy = (y) => OY + y * TH;

export default {
  id: 'tiles', name: '무너지는 발판', typeLabel: '캐릭터 조작', color: '#ff8a4c',
  rule: '밟은 발판은 금이 가다가 떨어집니다. 계속 움직이면서 끝까지 살아남으세요.',
  controls: [['이동', 'WASD / 방향키'], ['점프', 'Space (구멍 한 칸 넘기)']],
  touch: { stick: true, a: true, aLabel: '점프' },

  init(game, rng) {
    const tiles = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) tiles.push({ c, r, s: 'solid', ct: 0, ft: 0, shake: 0 });
    const spawns = [[1.5, 1.5], [7.5, 1.5], [1.5, 4.5], [7.5, 4.5]];
    const players = spawns.map(([x, y], i) => ({ i, x, y, vx: 0, vy: 0, z: 0, vz: 0, alive: true, fallT: 0, deathT: 0, facing: x < COLS / 2 ? 1 : -1, bot: { tx: x, ty: y, next: 0 } }));
    return { t: 0, tiles, players, nextRandom: 8, particles: [], endTimer: -1 };
  },
  tile(st, c, r) { return (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? null : st.tiles[r * COLS + c]; },

  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    const T = this;
    // tiles
    for (const tl of st.tiles) {
      if (tl.s === 'crack') { tl.ct += dt; if (tl.ct >= CRACK) { tl.s = 'fall'; tl.ft = 0; game.sfx('crack', null); } }
      else if (tl.s === 'fall') { tl.ft += dt; if (tl.ft > 1.2) tl.s = 'gone'; }
    }
    // random cracks later in the round
    if (!ended && st.t > st.nextRandom) {
      st.nextRandom = st.t + Math.max(0.35, 1.1 - (st.t - 8) * 0.025);
      const solid = st.tiles.filter(t => t.s === 'solid');
      if (solid.length) { const tl = rng.pick(solid); tl.s = 'crack'; tl.ct = 0; }
    }
    // players
    for (const p of st.players) {
      if (!p.alive) { p.fallT += dt; continue; }
      const inp = ended ? { mx: 0, my: 0 } : inputs[p.i];
      let mx = inp.mx, my = inp.my;
      const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      const k = Math.min(1, dt * (p.z > 0 ? 4 : 14));
      p.vx += (mx * SPEED - p.vx) * k; p.vy += (my * SPEED - p.vy) * k;
      if (Math.abs(mx) > 0.2) p.facing = mx > 0 ? 1 : -1;
      if (!ended && inp.aP && p.z === 0) { p.vz = JUMP_V; p.z = 0.001; game.sfx('jump', null); }
      p.x += p.vx * dt; p.y += p.vy * dt * 1.15;
      if (p.z > 0) {
        p.vz -= GRAV * dt; p.z += p.vz * dt;
        if (p.z <= 0) { p.z = 0; p.vz = 0; game.sfx('land', null); }
      }
      if (p.z === 0) {
        const tl = T.tile(st, Math.floor(p.x), Math.floor(p.y));
        if (!tl || tl.s === 'fall' || tl.s === 'gone') {
          p.alive = false; p.deathT = st.t; p.fallT = 0; game.sfx('fall', null);
        } else if (tl.s === 'solid') { tl.s = 'crack'; tl.ct = 0; }
      }
    }
    // push players apart
    const ps = st.players;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = ps[a], B = ps[b];
      if (!A.alive || !B.alive || Math.abs(A.z - B.z) > 0.6) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < PR * 2 && d > 1e-4) {
        const push = (PR * 2 - d) / 2, nx = dx / d, ny = dy / d;
        A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
        const rel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
        if (rel > 0) { A.vx -= nx * rel; A.vy -= ny * rel; B.vx += nx * rel; B.vy += ny * rel; }
      }
    }
    const alive = ps.filter(p => p.alive).length;
    if (st.endTimer < 0 && (alive <= 1 || st.t >= LIMIT)) st.endTimer = st.t;
  },
  done(st) { return st.endTimer >= 0 && st.t - st.endTimer > 0.6; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.players.map(p => p.alive ? 1000 : Math.round(p.deathT * 100) / 100); },
  detail(st, i) { const p = st.players[i]; return p.alive ? '끝까지 생존' : `${p.deathT.toFixed(1)}초 버팀`; },

  bot(st, i, game, rng) {
    const p = st.players[i];
    if (!p.alive) return {};
    const k = game.diff.k, b = p.bot;
    const here = this.tile(st, Math.floor(p.x), Math.floor(p.y));
    const urgent = here && here.s === 'crack' && here.ct > CRACK * 0.45;
    if (st.t > b.next || urgent && Math.hypot(b.tx - p.x, b.ty - p.y) < 0.3) {
      b.next = st.t + (0.18 + (1 - k) * 0.35) * (0.7 + rng.next() * 0.6);
      let best = null, bestS = -1e9;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const tl = this.tile(st, c, r);
        const cx = c + 0.5, cy = r + 0.5, d = Math.hypot(cx - p.x, cy - p.y);
        if (d > 2.6) continue;
        let s = tl.s === 'solid' ? 2 : tl.s === 'crack' ? 0.4 - tl.ct * 1.5 : -20;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.tile(st, c + dc, r + dr); if (n && n.s === 'solid') s += 0.35; }
        s -= d * 0.35 + Math.hypot(cx - COLS / 2, cy - ROWS / 2) * 0.12;
        for (const o of st.players) if (o !== p && o.alive && Math.hypot(o.x - cx, o.y - cy) < 0.9) s -= 1.2;
        if (c === Math.floor(p.x) && r === Math.floor(p.y)) s -= 1.5;
        s += (rng.next() - 0.5) * (1.6 - k);
        if (s > bestS) { bestS = s; best = [cx, cy]; }
      }
      if (best) { b.tx = best[0]; b.ty = best[1]; }
    }
    let mx = b.tx - p.x, my = b.ty - p.y;
    const d = Math.hypot(mx, my);
    if (d < 0.08) { mx = 0; my = 0; } else { mx /= Math.max(d, 0.35); my /= Math.max(d, 0.35); }
    // jump over a hole straight ahead
    let a = false;
    if (p.z === 0 && d > 0.2) {
      const ux = (b.tx - p.x) / d, uy = (b.ty - p.y) / d;
      const t1 = this.tile(st, Math.floor(p.x + ux * 0.45), Math.floor(p.y + uy * 0.45));
      const bad1 = !t1 || t1.s === 'fall' || t1.s === 'gone';
      if (bad1 && rng.next() < 0.6 + k * 0.4) a = true;
      if (urgent && here.ct > CRACK * 0.8 && rng.next() < k) a = true;
    }
    return { mx, my, a };
  },

  render(ctx, st, game) {
    // sky + void
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ece4ff'); g.addColorStop(0.6, '#cbbcf5'); g.addColorStop(1, '#a796e0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // distant lights
    for (let k = 0; k < 40; k++) {
      const x = (k * 137.5) % W, y = 70 + ((k * 61) % 90), a = 0.25 + 0.25 * Math.sin(game.t * 2 + k);
      ctx.fillStyle = `rgba(255,255,255,${a + 0.3})`; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    const players = st.players.slice().sort((a, b) => a.y - b.y);
    // falling players behind everything first
    for (const p of players) if (!p.alive) drawFallen(ctx, p, game);
    let pi = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) drawTile(ctx, st.tiles[r * COLS + c], game.t);
      const alive = players.filter(p => p.alive);
      for (const p of alive) {
        if (Math.floor(p.y) !== r && !(r === 0 && p.y < 0) && !(r === ROWS - 1 && p.y >= ROWS)) continue;
        const X = sx(p.x), Y = sy(p.y);
        ctx.fillStyle = 'rgba(67,56,110,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y, 26 - p.z * 4, 8, 0, 0, Math.PI * 2); ctx.fill();
        game.drawPlayer(ctx, p.i, X, Y - p.z * TH * 0.9, 74, { facing: p.facing, tag: true, noShadow: true });
      }
    }
  },
};

function drawTile(ctx, tl, t) {
  if (tl.s === 'gone') return;
  let x = sx(tl.c), y = sy(tl.r), alpha = 1;
  if (tl.s === 'crack') { const k = tl.ct / CRACK; x += Math.sin(t * 60 + tl.c) * k * 2.5; }
  if (tl.s === 'fall') { y += tl.ft * tl.ft * 500; alpha = Math.max(0, 1 - tl.ft / 1.1); }
  ctx.save(); ctx.globalAlpha = alpha;
  const base = (tl.c + tl.r) % 2 ? '#ffe7c4' : '#ffd29a';
  let top = base;
  if (tl.s === 'crack' || tl.s === 'fall') { const k = Math.min(1, tl.ct / CRACK); top = mix(base, '#ff6a52', k * 0.75); }
  // front face
  ctx.fillStyle = shade(top.startsWith('#') ? top : '#ffd29a', -0.38);
  ctx.fillRect(x + 2, y + TH - 2, TW - 4, DEPTH);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 2, y + TH - 2 + DEPTH - 6, TW - 4, 6);
  // top face
  ctx.fillStyle = top; ctx.fillRect(x + 2, y + 2, TW - 4, TH - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 2, y + 2, TW - 4, 5);
  if (tl.s === 'crack' || tl.s === 'fall') {
    const k = Math.min(1, tl.ct / CRACK);
    ctx.strokeStyle = 'rgba(80,20,10,0.75)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    const cx = x + TW / 2, cy = y + TH / 2;
    const arms = [[-38, -18], [30, -24], [36, 16], [-30, 22], [4, 28]];
    ctx.beginPath();
    arms.forEach(([ax, ay], j) => {
      if (j / arms.length > k + 0.15) return;
      ctx.moveTo(cx, cy); ctx.lineTo(cx + ax * 0.5 * k + 3, cy + ay * 0.4 * k); ctx.lineTo(cx + ax * k, cy + ay * k);
    });
    ctx.stroke();
  }
  ctx.restore();
}
function drawFallen(ctx, p, game) {
  const X = sx(p.x), Y = sy(p.y) + p.fallT * p.fallT * 700;
  const s = Math.max(0.2, 1 - p.fallT * 0.6);
  if (p.fallT > 1.6) return;
  game.drawPlayer(ctx, p.i, X, Y, 74 * s, { expr: 'lose', lockExpr: true, rot: p.fallT * 4, pivot: true, noShadow: true, alpha: Math.max(0, 1 - p.fallT / 1.6) });
}
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k, g = ((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k, bl = (pa & 255) * (1 - k) + (pb & 255) * k;
  return '#' + [r, g, bl].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
