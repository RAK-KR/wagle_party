// 인간 대포 — lock the angle, then the power, and launch yourself onto the target. Wind matters. 3 shots.
import { W, H, COL } from '../config.js';
import { shade } from '../characters.js';
import { text } from '../ui.js';
import { softBg, INK, rr } from './common.js';

const SHOTS = 3, V0 = 720, G = 620, GROUND = 250, CANX = 70;
const AMIN = 18, AMAX = 72, APER = 1.7, PPER = 1.25, PMIN = 0.3, IDLE = 7, LIMIT = 60;
const PW = 628, PH = 316;
const panel = (i) => ({ x: 8 + (i % 2) * 636, y: 52 + Math.floor(i / 2) * 334 });

function angleAt(t) { return AMIN + (AMAX - AMIN) * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / APER)); }
function powerAt(t) { const f = (t / PPER) % 1; const tri = f < 0.5 ? f * 2 : 2 - f * 2; return PMIN + (1 - PMIN) * tri; }
function simulate(angDeg, pow, wind) {
  const a = angDeg * Math.PI / 180;
  let x = CANX + Math.cos(a) * 44, y = GROUND - 30 - Math.sin(a) * 44, vx = Math.cos(a) * V0 * pow, vy = -Math.sin(a) * V0 * pow;
  const dt = 1 / 120;
  for (let k = 0; k < 2000; k++) { vx += wind * dt; vy += G * dt; x += vx * dt; y += vy * dt; if (y >= GROUND && vy > 0) return x; }
  return x;
}
function pointsFor(d) { return d <= 14 ? 10 : d <= 36 ? 6 : d <= 70 ? 3 : 0; }

export default {
  id: 'cannon', name: '인간 대포', typeLabel: '물리', color: '#79c66b',
  rule: '각도를 정하고 힘을 정해서 대포로 날아가 과녁 한가운데에 착지하세요. 바람을 잘 보세요. 3번 쏩니다.',
  controls: [['각도 정하기', 'Space (움직이는 각도에서 멈춤)'], ['힘 정하고 발사', 'Space 한 번 더']],
  touch: { stick: false, a: true, aLabel: '정하기' },

  init(game, rng) {
    const course = [];
    for (let s = 0; s < SHOTS; s++) course.push({ tx: 300 + rng.next() * 240, wind: Math.round((rng.next() * 2 - 1) * (40 + s * 45)) });
    const pl = [0, 1, 2, 3].map(i => ({ i, shot: 0, phase: 'angle', pt: rng.next() * APER, ang: 45, pow: 0.6, x: 0, y: 0, vx: 0, vy: 0, rot: 0, total: 0, marks: [], last: null, wait: 0, bot: null }));
    return { t: 0, course, pl };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    for (const p of st.pl) {
      if (p.phase === 'done') continue;
      const inp = inputs[p.i];
      const press = !ended && (inp.aP || inp.pP);
      const c = st.course[p.shot];
      p.pt += dt;
      if (p.phase === 'angle') {
        p.ang = angleAt(p.pt);
        if (press || p.pt > IDLE + 3) { p.phase = 'power'; p.pt = 0; game.sfx('lock', p.i); }
      } else if (p.phase === 'power') {
        p.pow = powerAt(p.pt);
        if (press || p.pt > IDLE) {
          p.phase = 'fly'; p.pt = 0;
          const a = p.ang * Math.PI / 180;
          p.x = CANX + Math.cos(a) * 44; p.y = GROUND - 30 - Math.sin(a) * 44;
          p.vx = Math.cos(a) * V0 * p.pow; p.vy = -Math.sin(a) * V0 * p.pow; p.rot = 0;
          game.sfx('boom', p.i); game.sfx('bump', ~p.i, 0.4);
        }
      } else if (p.phase === 'fly') {
        const sub = 4;
        for (let k = 0; k < sub; k++) {
          const h = dt / sub;
          p.vx += c.wind * h; p.vy += G * h; p.x += p.vx * h; p.y += p.vy * h;
          if (p.y >= GROUND && p.vy > 0) break;
        }
        p.rot += dt * 9;
        if (p.y >= GROUND && p.vy > 0) {
          p.y = GROUND;
          const d = Math.abs(p.x - c.tx), pts = pointsFor(d);
          p.total += pts; p.last = { pts, x: p.x }; p.marks.push({ x: p.x, pts, shot: p.shot });
          p.phase = 'land'; p.pt = 0;
          game.sfx(pts >= 6 ? 'good' : pts ? 'coin' : 'land', p.i);
        }
      } else if (p.phase === 'land') {
        if (p.pt > 1.4) {
          p.shot++;
          if (p.shot >= SHOTS) p.phase = 'done';
          else { p.phase = 'angle'; p.pt = rng.next() * APER; p.bot = null; }
        }
      }
    }
    if (st.t > LIMIT) for (const p of st.pl) p.phase = 'done';
  },
  done(st) { return st.pl.every(p => p.phase === 'done'); },
  scores(st) { return st.pl.map(p => p.total); },
  detail(st, i) { return `${st.pl[i].total}점`; },
  timeLeft(st) { return LIMIT - st.t; },

  bot(st, i, game, rng) {
    const p = st.pl[i], k = game.diff.k, c = st.course[Math.min(p.shot, SHOTS - 1)];
    if (p.phase !== 'angle' && p.phase !== 'power') return {};
    if (!p.bot) {
      // find a good angle/power pair by search
      let best = null, be = 1e9;
      for (let a = AMIN + 2; a <= AMAX - 2; a += 1) for (let pw = PMIN; pw <= 1; pw += 0.01) {
        const e = Math.abs(simulate(a, pw, c.wind) - c.tx) + Math.abs(a - 47) * 0.4;
        if (e < be) { be = e; best = { a, pw }; }
      }
      const tolA = [7, 3.5, 1.4][Math.round(k * 3) - 1] ?? 3.5;
      p.bot = { a: best.a + (rng.next() - 0.5) * tolA, tolA: tolA * 0.5, tolP: [0.07, 0.03, 0.011][Math.round(k * 3) - 1] ?? 0.03, pw: null, delay: 0.5 + rng.next() * 0.8 };
    }
    if (p.pt < p.bot.delay) return {};
    if (p.phase === 'angle') return { a: Math.abs(p.ang - p.bot.a) < p.bot.tolA };
    if (p.bot.pw == null) {
      // smarter bots re-aim power for the angle they actually locked
      let bp = 0.6, be = 1e9;
      for (let pw = PMIN; pw <= 1; pw += 0.005) { const e = Math.abs(simulate(p.ang, pw, c.wind) - c.tx); if (e < be) { be = e; bp = pw; } }
      p.bot.pw = bp + (rng.next() - 0.5) * (1 - k) * 0.08;
    }
    return { a: Math.abs(p.pow - p.bot.pw) < p.bot.tolP };
  },

  render(ctx, st, game) {
    softBg(ctx);
    for (const p of st.pl) drawPanel(ctx, st, p, game);
  },
};

function drawPanel(ctx, st, p, game) {
  const { x: ox, y: oy } = panel(p.i), pl = game.players[p.i];
  const c = st.course[Math.min(p.shot, SHOTS - 1)];
  ctx.save(); ctx.translate(ox, oy); rr(ctx, 3, 3, PW - 6, PH - 6, 18); ctx.clip();
  // sky + hills
  const g = ctx.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, '#a8dcff'); g.addColorStop(1, '#e8f6ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
  ctx.fillStyle = '#bfe6a8'; ctx.beginPath(); ctx.ellipse(160, GROUND + 30, 260, 70, 0, 0, Math.PI * 2); ctx.ellipse(500, GROUND + 40, 220, 80, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#79c66b'; ctx.fillRect(0, GROUND, PW, PH - GROUND);
  ctx.fillStyle = '#5aa64e'; ctx.fillRect(0, GROUND, PW, 6);
  // target
  const tx = c.tx;
  for (const [w, col] of [[140, '#ffffff'], [72, '#e8473f'], [28, '#ffcf3a']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(tx, GROUND + 3, w, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#6b4f3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, GROUND); ctx.lineTo(tx, GROUND - 70); ctx.stroke();
  const wdir = Math.sign(c.wind) || 1, flap = Math.sin(st.t * 8) * 4;
  ctx.fillStyle = pl.color; ctx.beginPath(); ctx.moveTo(tx, GROUND - 70); ctx.lineTo(tx + wdir * (24 + Math.abs(c.wind) * 0.12), GROUND - 62 + flap); ctx.lineTo(tx, GROUND - 52); ctx.closePath(); ctx.fill();
  // past landing marks
  for (const m of p.marks) { ctx.fillStyle = m.pts >= 6 ? '#2e7d32' : m.pts ? '#c49000' : '#7a6a5a'; ctx.beginPath(); ctx.arc(m.x, GROUND + 14, 5, 0, Math.PI * 2); ctx.fill(); }
  // cannon
  const a = p.ang * Math.PI / 180;
  ctx.save(); ctx.translate(CANX, GROUND - 30); ctx.rotate(-a);
  ctx.fillStyle = '#3a3546'; ctx.fillRect(-10, -15, 62, 30); ctx.fillStyle = shade(pl.color, -0.2); ctx.fillRect(44, -18, 14, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-10, -15, 62, 6);
  ctx.restore();
  ctx.fillStyle = '#6b4f3a'; ctx.beginPath(); ctx.arc(CANX - 4, GROUND - 16, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.arc(CANX - 4, GROUND - 16, 6, 0, Math.PI * 2); ctx.fill();
  // aim guide
  if (p.phase === 'angle' || p.phase === 'power') {
    ctx.strokeStyle = 'rgba(27,24,36,0.35)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(CANX, GROUND - 30); ctx.lineTo(CANX + Math.cos(a) * 150, GROUND - 30 - Math.sin(a) * 150); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, Math.round(p.ang) + '°', CANX + Math.cos(a) * 168, GROUND - 26 - Math.sin(a) * 168, { size: 18, weight: 900, align: 'center', color: '#1b1824' });
  }
  // power gauge
  if (p.phase === 'power' || p.phase === 'angle') {
    const gx = 18, gy = 40, gh = 160;
    ctx.fillStyle = 'rgba(27,24,36,0.5)'; ctx.fillRect(gx, gy, 18, gh);
    if (p.phase === 'power') {
      const h = gh * (p.pow - PMIN) / (1 - PMIN);
      const pg = ctx.createLinearGradient(0, gy + gh, 0, gy); pg.addColorStop(0, '#6ee08a'); pg.addColorStop(0.6, '#ffcf3a'); pg.addColorStop(1, '#ff5d6c');
      ctx.fillStyle = pg; ctx.fillRect(gx, gy + gh - h, 18, h);
    }
    text(ctx, '힘', gx + 9, gy - 8, { size: 14, weight: 900, align: 'center', color: '#1b1824' });
  }
  // character
  if (p.phase === 'angle' || p.phase === 'power') {
    game.drawPlayer(ctx, p.i, CANX - 34, GROUND - 2, 58, { tag: true });
  } else if (p.phase === 'fly') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(p.x, GROUND + 2, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    game.drawPlayer(ctx, p.i, p.x, p.y, 58, { rot: p.rot, pivot: true, noShadow: true, expr: 'win', lockExpr: true });
  } else if (p.phase === 'land' || p.phase === 'done') {
    const lx = p.last ? p.last.x : tx;
    const pts = p.last ? p.last.pts : 0;
    const bounce = p.phase === 'land' ? Math.abs(Math.sin(p.pt * 8)) * Math.max(0, 1 - p.pt) * 18 : 0;
    game.drawPlayer(ctx, p.i, Math.max(30, Math.min(PW - 30, lx)), GROUND - bounce, 58, { expr: pts >= 6 ? 'win' : pts ? 'idle' : 'lose', tag: true });
    if (p.phase === 'land' && p.last) text(ctx, pts ? `+${pts}` : '빗나감', Math.max(60, Math.min(PW - 60, lx)), GROUND - 90 - p.pt * 20, { size: 30, title: true, align: 'center', color: pts >= 6 ? COL.good : pts ? COL.accent : '#ff8fa3', stroke: INK, strokeW: 6 });
  }
  // header
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillRect(0, 0, PW, 34);
  { ctx.font = `20px 'Jua', sans-serif`; const nw = Math.max(70, ctx.measureText(pl.name).width + 30);
    ctx.fillStyle = pl.color; ctx.strokeStyle = INK; ctx.lineWidth = 3; rr(ctx, 8, 5, nw, 26, 13); ctx.fill(); ctx.stroke();
    text(ctx, pl.name, 8 + nw / 2, 25, { size: 17, title: true, align: 'center', color: '#fff', stroke: INK, strokeW: 4 }); }
  text(ctx, `${Math.min(p.shot + 1, SHOTS)} / ${SHOTS}발`, 132, 25, { size: 17, title: true, color: INK });
  text(ctx, `${p.total}점`, PW - 16, 26, { size: 20, title: true, align: 'right', color: INK });
  // wind
  const wl = Math.abs(c.wind);
  text(ctx, '바람', PW / 2 - 70, 25, { size: 16, title: true, color: COL.soft });
  ctx.save(); ctx.translate(PW / 2, 18); ctx.fillStyle = wl < 5 ? COL.faint : '#5aa8e8';
  const len = 10 + wl * 0.35;
  ctx.fillRect(c.wind >= 0 ? -len / 2 : -len / 2, -3, len, 6);
  ctx.beginPath(); if (c.wind >= 0) { ctx.moveTo(len / 2 + 8, 0); ctx.lineTo(len / 2 - 2, -8); ctx.lineTo(len / 2 - 2, 8); } else { ctx.moveTo(-len / 2 - 8, 0); ctx.lineTo(-len / 2 + 2, -8); ctx.lineTo(-len / 2 + 2, 8); } ctx.fill();
  ctx.restore();
  text(ctx, wl < 5 ? '없음' : `${Math.round(wl / 10)}`, PW / 2 + 70, 25, { size: 16, title: true, color: COL.soft });
  // phase hint for local
  if (p.i === game.local && !game.auto) {
    const hint = p.phase === 'angle' ? 'Space: 각도 정하기' : p.phase === 'power' ? 'Space: 힘 정하고 발사!' : '';
    if (hint) text(ctx, hint, PW / 2, PH - 18, { size: 20, title: true, align: 'center', color: '#fff', stroke: INK, strokeW: 5 });
  }
  if (p.phase === 'done') { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 34, PW, PH); text(ctx, '완료', PW / 2, 150, { size: 38, title: true, align: 'center', color: '#fff', stroke: INK, strokeW: 8 }); }
  ctx.restore();
  ctx.strokeStyle = p.i === game.local && !game.auto ? pl.color : INK; ctx.lineWidth = p.i === game.local && !game.auto ? 5 : 4;
  rr(ctx, ox + 3, oy + 3, PW - 6, PH - 6, 18); ctx.stroke();
}
