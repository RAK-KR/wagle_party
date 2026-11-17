// 풍선 팡팡 — click rising balloons before others do. Gold is worth more, bombs take points.
import { W, H, COL } from '../config.js';
import { sfx } from '../audio.js';
import { shade } from '../characters.js';
import { text } from '../ui.js';

const LIMIT = 30, TOPY = 60, FLOOR = 560;
const TYPES = {
  normal: { r: 34, pts: 1 },
  gold: { r: 26, pts: 3 },
  bomb: { r: 31, pts: -3 },
};
const PASTEL = ['#ff8fa3', '#8fd3ff', '#b59cff', '#9be59b', '#ffb36b'];

export default {
  id: 'popper', name: '풍선 팡팡', typeLabel: '마우스 / 터치', color: '#ff8fa3',
  rule: '올라오는 풍선을 먼저 클릭하세요. 금색은 3점, 폭탄은 3점이 깎입니다.',
  controls: [['풍선 터뜨리기', '마우스 클릭 / 화면 터치']],
  touch: { stick: false, a: false },

  init(game, rng) {
    return {
      t: 0, balloons: [], nextSpawn: 0, id: 0, score: [0, 0, 0, 0], fx: [], react: [0, 0, 0, 0], reactK: ['idle', 'idle', 'idle', 'idle'],
      cursors: [0, 1, 2, 3].map(i => ({ x: 200 + i * 290, y: 400, tid: -1, wait: 0, vx: 0, vy: 0 })), localPtr: { x: -100, y: -100 },
    };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    if (!ended && st.t < LIMIT && st.t > st.nextSpawn) {
      const rate = 2.1 + st.t / LIMIT * 1.6;
      st.nextSpawn = st.t + (0.6 + rng.next() * 0.8) / rate;
      const roll = rng.next();
      const type = roll < 0.13 ? 'gold' : roll < 0.33 ? 'bomb' : 'normal';
      st.balloons.push({
        id: st.id++, type, x: 110 + rng.next() * (W - 220), y: FLOOR + 50,
        vy: -(type === 'gold' ? 150 : 85) - rng.next() * 60 - st.t * 1.5, ph: rng.next() * 6, col: rng.pick(PASTEL), alive: true,
      });
    }
    for (const b of st.balloons) { b.y += b.vy * dt; b.x += Math.sin(st.t * 2 + b.ph) * 20 * dt; }
    st.balloons = st.balloons.filter(b => b.alive && b.y > TOPY - 60);
    // clicks (random order for fairness)
    const order = rng.shuffle([0, 1, 2, 3]);
    for (const i of order) {
      const inp = inputs[i];
      if (i === game.local) st.localPtr = { x: inp.px, y: inp.py };
      else { st.cursors[i].x = inp.px; st.cursors[i].y = inp.py; }
      if (ended || !inp.pP || st.t >= LIMIT) continue;
      let hit = null, hd = 1e9;
      for (const b of st.balloons) {
        const d = Math.hypot(b.x - inp.px, b.y - inp.py);
        if (d < TYPES[b.type].r + 8 && d < hd) { hd = d; hit = b; }
      }
      if (!hit) continue;
      hit.alive = false;
      const pts = TYPES[hit.type].pts;
      st.score[i] += pts;
      st.react[i] = 0.6; st.reactK[i] = pts > 0 ? 'win' : 'lose';
      st.fx.push({ x: hit.x, y: hit.y, t: 0, pts, i, type: hit.type, col: hit.col });
      if (hit.type === 'bomb') sfx.bomb(); else if (hit.type === 'gold') { sfx.pop(); sfx.coin(); } else sfx.pop();
    }
    for (const f of st.fx) f.t += dt;
    st.fx = st.fx.filter(f => f.t < 0.9);
    for (let i = 0; i < 4; i++) st.react[i] = Math.max(0, st.react[i] - dt);
  },
  done(st) { return st.t >= LIMIT + 0.3; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.score.slice(); },
  detail(st, i) { return `${st.score[i]}점`; },

  bot(st, i, game, rng) {
    const c = st.cursors[i], k = game.diff.k;
    c.wait -= 1 / 60; // approx frame step
    let tgt = st.balloons.find(b => b.id === c.tid && b.alive);
    if (!tgt || c.wait < -2) {
      let best = null, bs = -1e9;
      for (const b of st.balloons) {
        if (b.y > FLOOR - 40 || b.y < TOPY + 20) continue;
        let v = TYPES[b.type].pts;
        if (b.type === 'bomb' && rng.next() < (1 - k) * 0.08) v = 2; // easy bots sometimes go for a bomb by mistake
        if (v < 0) continue;
        const s = v * 140 - Math.hypot(b.x - c.x, b.y - c.y) + rng.next() * 120;
        if (s > bs) { bs = s; best = b; }
      }
      tgt = best; c.tid = best ? best.id : -1; c.wait = 0.22 + (1 - k) * 0.35 + rng.next() * 0.2;
    }
    let click = false;
    if (tgt) {
      const lead = 0.12;
      const tx = tgt.x, ty = tgt.y + tgt.vy * lead;
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      const sp = (380 + k * 560) / 60;
      const step = Math.min(d, sp);
      c.x += (dx / (d || 1)) * step + (rng.next() - 0.5) * (1 - k) * 6;
      c.y += (dy / (d || 1)) * step + (rng.next() - 0.5) * (1 - k) * 6;
      if (d < TYPES[tgt.type].r * (0.5 + (1 - k) * 0.4) && c.wait <= 0) { click = true; c.wait = 0.08 + (1 - k) * 0.25; c.tid = -1; }
    }
    return { px: c.x, py: c.y, pP: click };
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8ed0ff'); g.addColorStop(0.75, '#d6efff'); g.addColorStop(1, '#ffe9c9');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 6; k++) {
      const x = ((k * 260 + game.t * (10 + k * 3)) % (W + 300)) - 150, y = 110 + (k % 3) * 70;
      ctx.beginPath(); ctx.ellipse(x, y, 70, 22, 0, 0, Math.PI * 2); ctx.ellipse(x + 40, y - 14, 44, 22, 0, 0, Math.PI * 2); ctx.ellipse(x - 36, y - 6, 36, 18, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of st.balloons) drawBalloon(ctx, b, game.t);
    // pop effects
    for (const f of st.fx) {
      const k = f.t / 0.9;
      ctx.strokeStyle = f.type === 'bomb' ? 'rgba(60,40,40,' + (1 - k) + ')' : f.type === 'gold' ? 'rgba(255,200,40,' + (1 - k) + ')' : f.col;
      ctx.globalAlpha = 1 - k; ctx.lineWidth = 4;
      for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(an) * (14 + k * 30), f.y + Math.sin(an) * (14 + k * 30)); ctx.lineTo(f.x + Math.cos(an) * (24 + k * 46), f.y + Math.sin(an) * (24 + k * 46)); ctx.stroke(); }
      ctx.globalAlpha = 1;
      text(ctx, (f.pts > 0 ? '+' : '') + f.pts, f.x, f.y - 20 - k * 40, { size: 30, weight: 900, align: 'center', color: f.pts > 0 ? game.players[f.i].color : COL.bad, stroke: '#1b1824', strokeW: 6, alpha: 1 - k * 0.8 });
    }
    // booths
    ctx.fillStyle = '#6b4f8c'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = '#7d5fa0'; ctx.fillRect(0, FLOOR, W, 10);
    for (let i = 0; i < 4; i++) {
      const x = 160 + i * 320, p = game.players[i];
      ctx.fillStyle = shade(p.color, -0.45); ctx.fillRect(x - 140, FLOOR + 20, 280, 130);
      ctx.fillStyle = p.color; ctx.fillRect(x - 140, FLOOR + 20, 280, 6);
      const expr = st.react[i] > 0 ? st.reactK[i] : 'idle';
      game.drawPlayer(ctx, i, x - 70, FLOOR + 140, 92, { expr, tag: true });
      text(ctx, String(st.score[i]), x + 60, FLOOR + 102, { size: 54, title: true, align: 'center', color: '#fff', stroke: '#1b1824', strokeW: 8 });
      text(ctx, p.name, x + 60, FLOOR + 136, { size: 16, weight: 900, align: 'center', color: p.color });
    }
    // cursors (bots + local marker)
    for (let i = 0; i < 4; i++) {
      const c = i === game.local ? st.localPtr : st.cursors[i];
      if (c.x < 0) continue;
      drawCursor(ctx, c.x, c.y, game.players[i].color, i === game.local ? '나' : game.players[i].name);
    }
  },
};

function drawBalloon(ctx, b, t) {
  const r = TYPES[b.type].r;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.strokeStyle = 'rgba(60,50,80,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, r + 6); ctx.quadraticCurveTo(8 * Math.sin(t * 3 + b.ph), r + 30, 0, r + 54); ctx.stroke();
  if (b.type === 'bomb') {
    ctx.fillStyle = '#2a2433';
    ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, rr = k % 2 ? r : r + 9; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5d6c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 1);
  } else {
    const col = b.type === 'gold' ? '#ffcf3a' : b.col;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, shade(col, 0.5)); g.addColorStop(1, shade(col, -0.15));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(col, -0.2); ctx.beginPath(); ctx.moveTo(-5, r - 1); ctx.lineTo(5, r - 1); ctx.lineTo(0, r + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
    if (b.type === 'gold') { ctx.fillStyle = '#fff8d0'; ctx.font = `900 ${r * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('3', 0, 2); }
  }
  ctx.restore();
}
function drawCursor(ctx, x, y, col, label) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#1b1824'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  text(ctx, label, x + 20, y - 16, { size: 13, weight: 900, color: col, stroke: '#1b1824', strokeW: 4 });
}
