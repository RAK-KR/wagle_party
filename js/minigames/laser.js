// 레이저 줄넘기 — laser bars slide across the stage. Jump over low ones, duck under high ones. Last one standing.
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, survivalScores } from './common.js';

const FLOOR = 560, XL = 150, XR = 1130, LIMIT = 45, SPEED = 250, JV = 640, G = 1900, BAR = 120;
const LOW_Y = 26, HIGH_Y = 74;          // bar height above floor
const STAND_TOP = 88, DUCK_TOP = 50;

export default {
  id: 'laser', name: '레이저 줄넘기', typeLabel: '캐릭터 조작', color: '#ff5d8f',
  rule: '레이저 막대가 무대를 가로지릅니다. 낮은 건 점프로 넘고, 높은 건 숙여서 피하세요. 마지막까지 남으면 승리.',
  controls: [['좌우 이동', 'A D / ← →'], ['점프', 'Space'], ['숙이기', 'S / ↓ 누르고 있기']],
  touch: { stick: true, a: true, aLabel: '점프' },

  init() {
    return {
      t: 0, next: 1.2, beams: [], endTimer: -1,
      pl: [0, 1, 2, 3].map(i => ({ i, x: 330 + i * 207, z: 0, vz: 0, vx: 0, duck: false, alive: true, deathT: 0, ft: 0, fvx: 0, fvy: 0, facing: i < 2 ? 1 : -1, bot: { jumpAt: -1, wander: 0, wx: 330 + i * 207 } })),
    };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    const lvl = clamp(st.t / LIMIT, 0, 1);
    if (!ended && st.t > st.next && st.t < LIMIT - 1) {
      // bars come from one side at a time so every pattern can be dodged
      const onStage = st.beams[st.beams.length - 1];
      const dir = onStage ? onStage.dir : (rng.chance(0.5) ? 1 : -1);
      const speed = 330 + lvl * 330 + rng.range(-25, 25);
      const kind = rng.chance(0.62) ? 'low' : 'high';
      const warn = 0.8 - lvl * 0.25;
      st.beams.push({ kind, dir, speed, warn, x: dir > 0 ? XL - BAR : XR + BAR, active: false });
      let gap = Math.max(0.95, rng.range(1.3, 1.8) - lvl * 0.5);
      if (st.t > 14 && rng.chance(0.25 + lvl * 0.3)) {
        const d2 = kind === 'low' ? rng.range(0.95, 1.1) : rng.range(0.6, 0.75);  // jump needs longer to land than a duck
        st.beams.push({ kind: kind === 'low' ? 'high' : 'low', dir, speed, warn: warn + d2, x: dir > 0 ? XL - BAR : XR + BAR, active: false });
        gap += d2;
      }
      st.next = st.t + gap;
      sfx.alarm();
    }
    for (const b of st.beams) {
      if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) { b.active = true; sfx.whoosh(); } continue; }
      b.x += b.dir * b.speed * dt;
    }
    st.beams = st.beams.filter(b => !(b.active && (b.x < XL - BAR * 2 || b.x > XR + BAR * 2)));
    for (const p of st.pl) {
      if (!p.alive) { p.ft += dt; p.x += p.fvx * dt; p.fvy += G * 0.6 * dt; continue; }
      const inp = ended ? { mx: 0, my: 0 } : inputs[p.i];
      p.duck = p.z === 0 && inp.my > 0.5;
      const target = p.duck ? 0 : inp.mx * SPEED;
      p.vx += (target - p.vx) * Math.min(1, dt * 14);
      if (Math.abs(inp.mx) > 0.2) p.facing = inp.mx > 0 ? 1 : -1;
      p.x = clamp(p.x + p.vx * dt, XL + 20, XR - 20);
      if (!ended && inp.aP && p.z === 0) { p.vz = JV; p.z = 0.01; sfx.jump(); }
      if (p.z > 0) { p.vz -= G * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } }
      // hit test
      const top = p.z + (p.duck ? DUCK_TOP : STAND_TOP), bottom = p.z;
      for (const b of st.beams) {
        if (!b.active || Math.abs(b.x - p.x) > BAR / 2 + 16) continue;
        const by = b.kind === 'low' ? LOW_Y : HIGH_Y;
        if (by > bottom + 4 && by < top - 4) {
          p.alive = false; p.deathT = st.t; p.ft = 0; p.fvx = b.dir * 380; p.fvy = -600; sfx.bomb(); break;
        }
      }
    }
    for (let a = 0; a < 4; a++) for (let c = a + 1; c < 4; c++) {
      const A = st.pl[a], B = st.pl[c]; if (!A.alive || !B.alive) continue;
      const d = B.x - A.x; if (Math.abs(d) < 46) { const o = (46 - Math.abs(d)) / 2 * Math.sign(d || 1); A.x -= o; B.x += o; }
    }
    const alive = st.pl.filter(p => p.alive).length;
    if (st.endTimer < 0 && (alive <= 1 || st.t >= LIMIT)) st.endTimer = st.t;
  },
  done(st) { return st.endTimer >= 0 && st.t - st.endTimer > 0.8; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return survivalScores(st.pl); },
  detail(st, i) { const p = st.pl[i]; return p.alive ? '끝까지 생존' : `${p.deathT.toFixed(1)}초 버팀`; },

  bot(st, i, game, rng) {
    const p = st.pl[i]; if (!p.alive) return {};
    const b0 = p.bot, sd = byDiff(game, [0.06, 0.035, 0.02]), miss = byDiff(game, [0.08, 0.03, 0.008]);
    let threat = null, tt = 1e9;
    for (const b of st.beams) {
      if (!b.active) continue;
      const front = b.x + b.dir * BAR / 2, gap = (p.x - front) * b.dir;
      if (gap < -BAR - 30) continue;   // already passed
      const t = Math.max(0, gap - 16) / b.speed;
      if (t < tt) { tt = t; threat = b; }
    }
    let my = 0, a = false, mx = 0;
    const highSoon = st.beams.some(b => b.active && b.kind === 'high' && ((p.x - (b.x + b.dir * BAR / 2)) * b.dir) > -BAR - 30 && Math.max(0, (p.x - (b.x + b.dir * BAR / 2)) * b.dir - 16) / b.speed < 0.72);
    if (threat && tt < 0.6) {
      if (threat.kind === 'high') { if (tt < 0.3 + rng.next() * 0.05 && p.z === 0) my = 1; }
      else if (highSoon && tt > 0.05) { /* wait: jumping now would meet the high bar in the air */ }
      else {
        if (b0.jumpAt < 0 || b0.beam !== threat) { b0.beam = threat; b0.jumpAt = rng.next() < miss ? 1e9 : 0.09 + rng.gauss() * sd; }
        if (tt <= b0.jumpAt && p.z === 0) { a = true; b0.jumpAt = -1; }
      }
    } else {
      if (st.t > b0.wander) { b0.wander = st.t + rng.range(1, 2.5); b0.wx = clamp(p.x + rng.range(-160, 160), XL + 60, XR - 60); }
      if (Math.abs(b0.wx - p.x) > 12) mx = Math.sign(b0.wx - p.x) * 0.6;
    }
    return { mx, my, a };
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120c24'); g.addColorStop(1, '#2a1340');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // back wall grid
    ctx.strokeStyle = 'rgba(255,93,143,0.08)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, FLOOR); ctx.stroke(); }
    for (let y = 60; y < FLOOR; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // floor
    ctx.fillStyle = '#1c1430'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = '#ff5d8f'; ctx.fillRect(XL - 30, FLOOR, XR - XL + 60, 4);
    ctx.fillStyle = 'rgba(255,93,143,0.18)'; ctx.fillRect(XL - 30, FLOOR + 4, XR - XL + 60, 30);
    // emitters
    for (const side of [-1, 1]) {
      const x = side < 0 ? XL - 40 : XR + 40;
      ctx.fillStyle = '#3a2a55'; ctx.fillRect(x - 14, FLOOR - 130, 28, 130);
      ctx.fillStyle = '#5a4580'; ctx.fillRect(x - 14, FLOOR - 134, 28, 8);
      for (const [hy, kind] of [[LOW_Y, 'low'], [HIGH_Y, 'high']]) {
        const warn = st.beams.find(b => b.warn > 0 && b.kind === kind && (b.dir > 0) === (side < 0));
        const on = warn && Math.sin(st.t * 30) > -0.3;
        ctx.fillStyle = on ? '#ff3b6b' : '#5a2440'; ctx.beginPath(); ctx.arc(x, FLOOR - hy, 9, 0, Math.PI * 2); ctx.fill();
        if (warn) text(ctx, kind === 'low' ? '점프!' : '숙여!', x + (side < 0 ? 26 : -26), FLOOR - hy - 14, { size: 18, weight: 900, align: side < 0 ? 'left' : 'right', color: '#ff7aa0', stroke: '#120c24', strokeW: 5 });
      }
    }
    // players
    for (const p of st.pl) {
      if (!p.alive) {
        if (p.ft > 1.4) continue;
        const y = FLOOR - 400 * p.ft + 0.5 * G * 0.6 * p.ft * p.ft;
        game.drawPlayer(ctx, p.i, p.x, y, 92, { expr: 'lose', lockExpr: true, rot: p.ft * 9, pivot: true, noShadow: true, alpha: Math.max(0, 1 - p.ft / 1.4) });
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, FLOOR + 2, 34 - p.z * 0.08, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (p.duck) {
        ctx.save(); ctx.translate(p.x, FLOOR); ctx.scale(1.18, 0.6);
        game.drawPlayer(ctx, p.i, 0, 0, 92, { facing: p.facing, noShadow: true });
        ctx.restore();
        game.anchors[p.i] = { x: p.x, y: FLOOR - 60, s: 92 };
      } else game.drawPlayer(ctx, p.i, p.x, FLOOR - p.z, 92, { facing: p.facing, noShadow: true, tag: true });
    }
    // beams
    for (const b of st.beams) {
      if (!b.active) continue;
      const y = FLOOR - (b.kind === 'low' ? LOW_Y : HIGH_Y);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,40,100,0.25)'; ctx.fillRect(b.x - BAR / 2 - 6, y - 10, BAR + 12, 20);
      ctx.fillStyle = 'rgba(255,90,140,0.9)'; ctx.fillRect(b.x - BAR / 2, y - 4, BAR, 8);
      ctx.fillStyle = '#fff'; ctx.fillRect(b.x - BAR / 2, y - 1.5, BAR, 3);
      ctx.restore();
      ctx.fillStyle = '#d8d0e8'; ctx.fillRect(b.x - BAR / 2 - 8, y - 9, 8, 18); ctx.fillRect(b.x + BAR / 2, y - 9, 8, 18);
    }
  },
};
