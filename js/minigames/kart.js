// 미니 카트 — 3 laps around a small track. Stay on the road; grass slows you down.
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, shade, raceScores } from './common.js';

const LAPS = 3, TW = 108, MAXV = 340, GRASSV = 130, LIMIT = 80, N = 520;
const CTRL = [[250, 150], [640, 118], [1040, 150], [1185, 300], [1100, 445], [870, 470], [735, 560], [880, 650], [560, 690], [240, 655], [100, 480], [115, 285]];

// Closed Catmull-Rom spline sampled evenly enough for progress tracking
const TRACK = (() => {
  const pts = [];
  const n = CTRL.length;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n], p1 = CTRL[i], p2 = CTRL[(i + 1) % n], p3 = CTRL[(i + 2) % n];
    for (let k = 0; k < 60; k++) {
      const t = k / 60, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // resample to N points of equal spacing
  const len = [0];
  for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = len[len.length - 1], out = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const d = (k / N) * total;
    while (len[j + 1] < d) j++;
    const a = pts[j], b = pts[(j + 1) % pts.length], u = (d - len[j]) / (len[j + 1] - len[j]);
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
})();
const tangent = (i) => { const a = TRACK[(i - 2 + N) % N], b = TRACK[(i + 2) % N]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };

function nearest(x, y, guess) {
  let best = guess, bd = 1e18;
  for (let k = -30; k <= 30; k++) {
    const i = (guess + k + N) % N, d = (TRACK[i][0] - x) ** 2 + (TRACK[i][1] - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: Math.sqrt(bd) };
}

export default {
  id: 'kart', name: '미니 카트', typeLabel: '탈것', color: '#ff7a3c',
  rule: '작은 트랙을 3바퀴 먼저 도세요. 도로를 벗어나 잔디로 가면 느려집니다.',
  controls: [['핸들', '← → / A D'], ['브레이크 (급커브)', 'Space 누르고 있기']],
  touch: { stick: true, a: true, aLabel: '브레이크' },

  init() {
    const [tx, ty] = tangent(0), nx = -ty, ny = tx;
    const pl = [0, 1, 2, 3].map(i => {
      const back = 40 + Math.floor(i / 2) * 52, side = (i % 2 ? 1 : -1) * 26;
      const x = TRACK[0][0] - tx * back + nx * side, y = TRACK[0][1] - ty * back + ny * side;
      return { i, x, y, ang: Math.atan2(ty, tx), v: 0, idx: N - 6, lap: 0, half: false, progress: 0, finishT: null, off: false, bump: 0, place: 0, bot: { noise: 0, next: 0 } };
    });
    return { t: 0, pl, finished: 0 };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    for (const p of st.pl) {
      p.bump = Math.max(0, p.bump - dt);
      const inp = ended || p.finishT != null ? { mx: 0, a: false } : inputs[p.i];
      const nr = nearest(p.x, p.y, p.idx);
      // lap counting with a halfway checkpoint
      if (nr.i > N * 0.45 && nr.i < N * 0.55) p.half = true;
      if (p.idx > N * 0.85 && nr.i < N * 0.15 && p.half) { p.lap++; p.half = false; if (p.i === game.local && p.lap < LAPS) sfx.coin(); }
      if (p.idx < N * 0.15 && nr.i > N * 0.85 && p.lap > 0 && !p.half) p.lap--; // backwards over the line
      p.idx = nr.i;
      p.off = nr.d > TW / 2;
      p.progress = Math.max(0, (p.lap + (p.lap === 0 && p.idx > N * 0.9 ? 0 : p.idx / N)) / LAPS);
      if (p.lap >= LAPS && p.finishT == null) { p.finishT = st.t; st.finished++; p.place = st.finished; sfx.fanfare && (p.i === game.local ? sfx.good() : null); }
      const top = p.finishT != null ? MAXV * 0.4 : (p.off ? GRASSV : MAXV) * (inp.a ? 0.55 : 1);
      p.v += (top - p.v) * Math.min(1, dt * (top < p.v ? 3 : 1.4));
      const turn = (inp.a ? 3.9 : 2.9) * clamp(p.v / 180, 0.35, 1.1);
      p.ang += (inp.mx || 0) * turn * dt;
      p.x = clamp(p.x + Math.cos(p.ang) * p.v * dt, 20, W - 20); p.y = clamp(p.y + Math.sin(p.ang) * p.v * dt, 60, H - 15);
    }
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = st.pl[a], B = st.pl[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 34 && d > 0.01) { const o = (34 - d) / 2, nx = dx / d, ny = dy / d; A.x -= nx * o; A.y -= ny * o; B.x += nx * o; B.y += ny * o; A.v *= 0.92; B.v *= 0.92; if (A.bump <= 0 || B.bump <= 0) sfx.bump(0.5); A.bump = B.bump = 0.3; }
    }
  },
  done(st) { return st.pl.every(p => p.finishT != null) || st.t > LIMIT || (st.finished >= 1 && st.t > st.pl.filter(p => p.finishT != null).reduce((m, p) => Math.min(m, p.finishT), 1e9) + 12); },
  timeLeft(st) { const f = st.pl.filter(p => p.finishT != null); return f.length ? Math.min(...f.map(p => p.finishT)) + 12 - st.t : LIMIT - st.t; },
  scores(st) { return raceScores(st.pl); },
  detail(st, i) { const p = st.pl[i]; return p.finishT != null ? `${p.finishT.toFixed(1)}초 완주` : `${Math.min(LAPS, p.lap + 1)}바퀴째`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    if (st.t > b.next) { b.next = st.t + 0.4; b.noise = (rng.next() - 0.5) * byDiff(game, [0.5, 0.25, 0.08]); }
    const look = Math.round(16 + p.v / 22);
    const t = TRACK[(p.idx + look) % N];
    let da = Math.atan2(t[1] - p.y, t[0] - p.x) - p.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    // check curvature further ahead to brake
    const far = TRACK[(p.idx + look + 30) % N];
    let da2 = Math.atan2(far[1] - p.y, far[0] - p.x) - p.ang; da2 = Math.atan2(Math.sin(da2), Math.cos(da2));
    const brakeAt = byDiff(game, [0.75, 0.95, 1.15]);       // weaker bots brake too early
    const lazy = byDiff(game, [0.3, 0.12, 0]);              // and lift off on straights sometimes
    if (st.t > (b.lazyUntil || 0) && rng.next() < lazy * 0.02) b.lazyUntil = st.t + 0.5;
    const a = Math.abs(da2) > brakeAt || st.t < (b.lazyUntil || 0);
    return { mx: clamp(da * 2.6 + b.noise, -1, 1), a };
  },

  render(ctx, st, game) {
    // grass
    ctx.fillStyle = '#6fbf5a'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 60) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y, W, 30); }
    for (const [x, y, r] of [[640, 300, 34], [420, 330, 28], [860, 300, 30], [560, 400, 22], [1000, 590, 26], [330, 520, 30], [460, 560, 24], [1230, 640, 30], [40, 120, 34], [1230, 100, 30]]) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x + 6, y + r * 0.8, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#58a84a'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // track
    const path = () => { ctx.beginPath(); TRACK.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
    ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = '#e8473f'; ctx.lineWidth = TW + 18; ctx.stroke();
    path(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = TW + 18; ctx.setLineDash([22, 22]); ctx.stroke(); ctx.setLineDash([]);
    path(); ctx.strokeStyle = '#4a4553'; ctx.lineWidth = TW; ctx.stroke();
    path(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([20, 26]); ctx.stroke(); ctx.setLineDash([]);
    // start line
    const [tx, ty] = tangent(0), nx = -ty, ny = tx;
    for (let k = -6; k < 6; k++) for (let r = 0; r < 2; r++) {
      ctx.fillStyle = (k + r) % 2 ? '#fff' : '#1b1824';
      const cx = TRACK[0][0] + nx * (k + 0.5) * (TW / 12) + tx * (r - 0.5) * 9, cy = TRACK[0][1] + ny * (k + 0.5) * (TW / 12) + ty * (r - 0.5) * 9;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(ty, tx)); ctx.fillRect(-4.5, -TW / 24, 9, TW / 12); ctx.restore();
    }
    // karts
    const list = st.pl.slice().sort((a, b) => a.y - b.y);
    for (const p of list) {
      const col = game.players[p.i].color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-20, -12, 44, 28);
      ctx.fillStyle = '#1d1a24'; for (const [wx, wy] of [[-14, -15], [-14, 11], [12, -15], [12, 11]]) ctx.fillRect(wx, wy, 11, 5);
      ctx.fillStyle = shade(col, -0.25); ctx.fillRect(-21, -12, 42, 24);
      ctx.fillStyle = col; ctx.fillRect(-17, -9, 36, 18);
      ctx.fillStyle = '#fff'; ctx.fillRect(16, -7, 5, 14);
      ctx.restore();
      game.drawPlayer(ctx, p.i, p.x, p.y + 6, 40, { noShadow: true, tag: true, facing: Math.cos(p.ang) >= 0 ? 1 : -1, expr: p.finishT != null && p.place === 1 ? 'win' : p.off ? 'lose' : 'idle' });
    }
    // lap boards
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i], x = 300 + i * 172;
      ctx.fillStyle = 'rgba(14,12,19,0.75)'; ctx.fillRect(x, 54, 162, 28);
      ctx.fillStyle = pl.color; ctx.fillRect(x, 54, 5, 28);
      text(ctx, pl.name, x + 14, 73, { size: 14, weight: 900, color: pl.color });
      text(ctx, p.finishT != null ? `${p.place}등 골인` : `${Math.min(LAPS, p.lap + 1)}/${LAPS}바퀴`, x + 152, 74, { size: 15, weight: 900, align: 'right', color: p.finishT != null ? COL.accent : COL.text });
    }
  },
};
