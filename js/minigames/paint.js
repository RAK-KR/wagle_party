// 페인트 땅따먹기 — walk around to paint floor tiles in your color. Most tiles at the end wins.
// No bumping or stealing: players pass through each other, only the floor matters.
import { W, H, text, byDiff, clamp, softBg, chip, INK, rr, pastel } from './common.js';

const COLS = 16, ROWS = 8, CS = 70, GX = 80, GY = 112;
const GW = COLS * CS, GH = ROWS * CS;
const LIMIT = 30, SPEED = 300, BUCKET_R = 2;   // bucket paints cells within 2 steps (diamond)

const cellOf = (x, y) => {
  const c = Math.floor((x - GX) / CS), r = Math.floor((y - GY) / CS);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
};
const cx = (k) => GX + (k % COLS) * CS + CS / 2;
const cy = (k) => GY + Math.floor(k / COLS) * CS + CS / 2;

export default {
  id: 'paint', name: '페인트 땅따먹기', typeLabel: '캐릭터 조작', color: '#ff9ec7',
  rule: '돌아다니면 밟은 바닥이 내 색으로 칠해집니다. 끝났을 때 가장 많은 칸을 칠한 사람이 이깁니다. 다른 사람 칸도 덮어 칠할 수 있고, 페인트 통을 먹으면 주변이 한 번에 칠해집니다.',
  controls: [['이동', 'WASD / 방향키']],
  touch: { stick: true, a: false },

  init(game, rng) {
    const sp = [[GX + 70, GY + 70], [GX + GW - 70, GY + 70], [GX + 70, GY + GH - 70], [GX + GW - 70, GY + GH - 70]];
    return {
      t: 0, cells: new Array(COLS * ROWS).fill(-1), ct: new Array(COLS * ROWS).fill(-9),
      bucket: null, nextBucket: 4, fx: [],
      pl: sp.map(([x, y], i) => ({ i, x, y, vx: 0, vy: 0, facing: x < W / 2 ? 1 : -1, n: 0, gain: 0, bot: { tk: -1, next: 0 } })),
    };
  },

  paint(st, k, i) {
    if (k < 0 || st.cells[k] === i) return false;
    st.cells[k] = i; st.ct[k] = st.t; return true;
  },

  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    const live = !ended && st.t < LIMIT;
    // paint bucket
    if (live && !st.bucket && st.t > st.nextBucket && st.t < LIMIT - 2) {
      for (let tries = 0; tries < 30; tries++) {
        const k = rng.int(0, COLS * ROWS - 1);
        if (st.pl.every(p => Math.hypot(cx(k) - p.x, cy(k) - p.y) > 200)) { st.bucket = { k, x: cx(k), y: cy(k), t: 0 }; game.sfx('pop', null); break; }
      }
    }
    if (st.bucket) st.bucket.t += dt;
    for (const p of st.pl) {
      p.gain = Math.max(0, p.gain - dt);
      const inp = live ? inputs[p.i] : { mx: 0, my: 0 };
      let mx = inp.mx || 0, my = inp.my || 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      const k = Math.min(1, dt * 14);
      p.vx += (mx * SPEED - p.vx) * k; p.vy += (my * SPEED - p.vy) * k;
      if (Math.abs(mx) > 0.2) p.facing = mx > 0 ? 1 : -1;
      p.x = clamp(p.x + p.vx * dt, GX + 18, GX + GW - 18); p.y = clamp(p.y + p.vy * dt, GY + 24, GY + GH - 8);
      if (!live) continue;
      this.paint(st, cellOf(p.x, p.y - 8), p.i);
      const b = st.bucket;
      if (b && Math.hypot(b.x - p.x, b.y - (p.y - 10)) < 42) {
        const c0 = b.k % COLS, r0 = Math.floor(b.k / COLS);
        for (let r = r0 - BUCKET_R; r <= r0 + BUCKET_R; r++) for (let c = c0 - BUCKET_R; c <= c0 + BUCKET_R; c++) {
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS || Math.abs(c - c0) + Math.abs(r - r0) > BUCKET_R) continue;
          const kk = r * COLS + c;
          if (this.paint(st, kk, p.i)) st.ct[kk] = st.t + (Math.abs(c - c0) + Math.abs(r - r0)) * 0.06;
        }
        st.fx.push({ x: b.x, y: b.y, t: 0, i: p.i });
        st.bucket = null; st.nextBucket = st.t + rng.range(4, 6);
        p.gain = 0.6; game.sfx('good', p.i); game.sfx('pop', ~p.i);
      }
    }
    for (const p of st.pl) p.n = 0;
    for (const o of st.cells) if (o >= 0) st.pl[o].n++;
    for (const f of st.fx) f.t += dt;
    st.fx = st.fx.filter(f => f.t < 0.7);
  },
  done(st) { return st.t >= LIMIT + 1; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => p.n); },
  detail(st, i) { return `${st.pl[i].n}칸`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    const react = byDiff(game, [0.7, 0.4, 0.2]), spd = byDiff(game, [0.8, 0.92, 1]);
    const tgt = b.tk >= 0 ? b.tk : -1;
    const reached = tgt >= 0 && (st.cells[tgt] === i || Math.hypot(cx(tgt) - p.x, cy(tgt) - (p.y - 8)) < 16);
    if (st.t > b.next || reached) {
      b.next = st.t + react * (0.7 + rng.next() * 0.6);
      let best = -1, bs = -1;
      const sloppy = rng.next() < byDiff(game, [0.35, 0.15, 0]);
      for (let k = 0; k < COLS * ROWS; k++) {
        if (st.cells[k] === i) continue;
        const d = Math.hypot(cx(k) - p.x, cy(k) - p.y);
        // value: this cell + unpainted-by-me neighbours (keeps bots sweeping in lines instead of zig-zagging)
        let v = st.cells[k] < 0 ? 1 : 1.15;
        const c = k % COLS, r = Math.floor(k / COLS);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c2 = c + dc, r2 = r + dr;
          if (c2 >= 0 && r2 >= 0 && c2 < COLS && r2 < ROWS && st.cells[r2 * COLS + c2] !== i) v += 0.25;
        }
        // keep a little distance from other players (they'd paint it anyway)
        for (const o of st.pl) if (o !== p && Math.hypot(cx(k) - o.x, cy(k) - o.y) < 90) v *= 0.7;
        let s = v / (d + 50);
        if (sloppy) s *= 0.5 + rng.next();
        if (s > bs) { bs = s; best = k; }
      }
      // paint bucket is worth a detour
      if (st.bucket) {
        const d = Math.hypot(st.bucket.x - p.x, st.bucket.y - p.y);
        if (d < byDiff(game, [260, 420, 640]) && st.pl.every(o => o === p || Math.hypot(st.bucket.x - o.x, st.bucket.y - o.y) > d * 0.7)) best = st.bucket.k;
      }
      b.tk = best;
    }
    if (b.tk < 0) return {};
    let mx = cx(b.tk) - p.x, my = cy(b.tk) - (p.y - 8); const d = Math.hypot(mx, my);
    if (d < 4) return {};
    return { mx: mx / d * spd, my: my / d * spd };
  },

  render(ctx, st, game) {
    softBg(ctx, '#ffe4f0', '#e4ecff');
    // board
    ctx.fillStyle = 'rgba(70,50,140,0.18)'; rr(ctx, GX - 8, GY - 2, GW + 16, GH + 16, 28); ctx.fill();
    ctx.fillStyle = '#fffaf2'; rr(ctx, GX - 8, GY - 8, GW + 16, GH + 16, 28); ctx.fill();
    for (let k = 0; k < COLS * ROWS; k++) {
      const x = GX + (k % COLS) * CS, y = GY + Math.floor(k / COLS) * CS, o = st.cells[k];
      if (o < 0) {
        ctx.fillStyle = (k + Math.floor(k / COLS)) % 2 ? '#f6eedf' : '#fbf5ea';
        rr(ctx, x + 3, y + 3, CS - 6, CS - 6, 14); ctx.fill();
        continue;
      }
      const age = st.t - st.ct[k];
      if (age < 0) { ctx.fillStyle = '#f6eedf'; rr(ctx, x + 3, y + 3, CS - 6, CS - 6, 14); ctx.fill(); continue; }
      const pop = age < 0.25 ? 0.7 + 0.3 * Math.sin(age / 0.25 * Math.PI / 2) + Math.sin(age / 0.25 * Math.PI) * 0.12 : 1;
      const s = (CS - 6) * pop, col = game.players[o].color;
      ctx.fillStyle = pastel(col, 0.38);
      rr(ctx, x + CS / 2 - s / 2, y + CS / 2 - s / 2, s, s, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, x + CS / 2 - s / 2 + 6, y + CS / 2 - s / 2 + 5, s - 12, s * 0.28, 8); ctx.fill();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 4; rr(ctx, GX - 8, GY - 8, GW + 16, GH + 16, 28); ctx.stroke();

    // paint bucket
    if (st.bucket) drawBucket(ctx, st.bucket.x, st.bucket.y - 18 - Math.abs(Math.sin(st.bucket.t * 4)) * 8, Math.min(1, st.bucket.t * 4), st.t);
    // splash rings
    for (const f of st.fx) {
      const k = f.t / 0.7;
      ctx.strokeStyle = game.players[f.i].color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 8 * (1 - k) + 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 40 + k * 150, (40 + k * 150) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // characters
    const list = st.pl.slice().sort((a, b) => a.y - b.y);
    for (const p of list) {
      const moving = Math.hypot(p.vx, p.vy) > 40;
      game.drawPlayer(ctx, p.i, p.x, p.y, 66, { facing: p.facing, tag: true, ring: true, expr: p.gain > 0 ? 'win' : 'idle', rot: moving ? Math.sin(st.t * 16 + p.i) * 0.08 : 0 });
    }
    // scoreboard
    for (let i = 0; i < 4; i++) chip(ctx, game, i, 300 + i * 172, 58, 160, 30, `${st.pl[i].n}칸`);
    const left = LIMIT - st.t;
    if (left < 5 && left > 0) text(ctx, '곧 끝나요!', W / 2, H - 12, { size: 22, title: true, align: 'center', color: '#fff', stroke: INK, strokeW: 6 });
  },
};

function drawBucket(ctx, x, y, k, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(67,56,110,0.2)'; ctx.beginPath(); ctx.ellipse(0, 34, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
  // can
  ctx.fillStyle = '#e9e4f5'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(18, -12); ctx.lineTo(15, 22); ctx.quadraticCurveTo(0, 28, -15, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
  // rainbow paint top + drips
  const cols = ['#ff9ec7', '#ffd76e', '#8fe0b0', '#9cc4ff'];
  ctx.fillStyle = cols[Math.floor(t * 4) % 4]; ctx.beginPath(); ctx.ellipse(0, -12, 18, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, -10); ctx.quadraticCurveTo(-12, 4, -8, 6); ctx.quadraticCurveTo(-4, 4, -5, -9); ctx.fill();
  // handle
  ctx.beginPath(); ctx.arc(0, -14, 20, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.restore();
}
