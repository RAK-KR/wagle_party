// 흔들 시소 — tilt your seesaw so your character rolls onto the stars. Roll off the end and you lose a star.
// Everyone gets the same star positions and the same gusts of wind, in their own panel.
import { text, byDiff, clamp, star, QW, QH, inPanel, panelHeader, panelFrame, softBg, INK, rr, pastel } from './common.js';

const LIMIT = 35, PX = QW / 2, PY = 196, L = 226, AMAX = 0.34, ROT = 1.8, G = 980, FRIC = 1.6;
const BR = 24, CATCH = 26, FALL_T = 1.5;

export default {
  id: 'seesaw', name: '흔들 시소', typeLabel: '물리', color: '#7fd1c7',
  rule: '시소를 기울여 캐릭터를 굴리고 별을 모으세요. 끝으로 굴러떨어지면 별 1개를 잃습니다. 가끔 부는 바람을 조심하세요.',
  controls: [['기울이기', 'A D / ← →']],
  touch: { stick: true, a: false },

  init(game, rng) {
    // same stars and gusts for everyone
    const stars = [];
    let side = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < 80; k++) {
      if (rng.chance(0.75)) side = -side;            // mostly alternate sides so you have to roll across
      stars.push(Math.round(side * rng.range(0.22, 0.88) * L));
    }
    const gusts = [];
    let t = rng.range(5, 7);
    while (t < LIMIT - 2) {
      const dur = rng.range(1.2, 2.0), f = (rng.chance(0.5) ? 1 : -1) * (120 + (t / LIMIT) * 110);
      gusts.push({ t0: t, t1: t + dur, f: Math.round(f) });
      t += dur + rng.range(3, 5.5);
    }
    return { t: 0, stars, gusts, pl: [0, 1, 2, 3].map(i => ({ i, x: 0, v: 0, ang: 0, k: 0, stars: 0, falls: 0, fall: 0, y: 0, side: 0, gain: 0, bot: { mx: 0, next: 0, err: 0 } })) };
  },

  gust(st, t) { for (const g of st.gusts) if (t >= g.t0 && t < g.t1) return g.f; return 0; },
  nextGust(st, t) { for (const g of st.gusts) if (g.t0 > t) return g; return null; },

  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    const live = !ended && st.t < LIMIT, wind = live ? this.gust(st, st.t) : 0;
    for (const p of st.pl) {
      p.gain = Math.max(0, p.gain - dt);
      if (p.fall > 0) {                                // falling off: drop, then respawn in the middle
        p.fall -= dt; p.y += (200 + (FALL_T - p.fall) * 900) * dt; p.ang += (0 - p.ang) * Math.min(1, dt * 3);
        if (p.fall <= 0) { p.fall = 0; p.x = 0; p.v = 0; p.y = 0; p.ang = 0; }
        continue;
      }
      const mx = live ? clamp(inputs[p.i].mx || 0, -1, 1) : 0;
      const want = mx * AMAX, d = want - p.ang, step = ROT * dt;
      p.ang += Math.abs(d) < step ? d : Math.sign(d) * step;
      p.v += (G * Math.sin(p.ang) + wind) * dt;
      p.v *= Math.max(0, 1 - FRIC * dt);
      p.x += p.v * dt;
      if (!live) { p.v *= 0.9; continue; }
      // star
      const s = st.stars[p.k];
      if (Math.abs(p.x - s) < CATCH) { p.k++; p.stars++; p.gain = 0.35; game.sfx('coin', p.i); }
      // off the end
      if (Math.abs(p.x) > L + 4) {
        p.side = Math.sign(p.x); p.fall = FALL_T; p.y = 0; p.falls++;
        if (p.stars > 0) p.stars--;
        game.sfx('fall', p.i); game.sfx('bad', p.i, 0, 0.5);
      }
    }
  },
  done(st) { return st.t >= LIMIT + 0.8; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => p.stars); },
  detail(st, i) { const p = st.pl[i]; return `별 ${p.stars}개` + (p.falls ? ` · ${p.falls}번 떨어짐` : ''); },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    if (p.fall > 0) return {};
    if (st.t >= b.next) {
      b.next = st.t + byDiff(game, [0.3, 0.16, 0.06]) * (0.7 + rng.next() * 0.6);
      if (rng.next() < 0.25) b.err = (rng.next() - 0.5) * byDiff(game, [110, 50, 12]);
      const target = clamp(st.stars[p.k] + b.err, -L + 30, L - 30);
      const vMax = byDiff(game, [250, 215, 200]) * (0.9 + rng.next() * 0.2);
      const vd = clamp((target - p.x) * byDiff(game, [2.2, 2.5, 2.8]), -vMax, vMax);
      // how much of the wind the bot notices
      const sees = rng.next() < byDiff(game, [0.3, 0.75, 1]) ? this.gust(st, st.t) : 0;
      let acc = (vd - p.v) * 4 - sees;
      // late safety brake near the edges
      if (Math.abs(p.x) > L - 60 && Math.sign(p.v) === Math.sign(p.x) && rng.next() < byDiff(game, [0.45, 0.85, 1])) acc = -Math.sign(p.x) * G;
      b.mx = clamp(Math.asin(clamp(acc / G, -1, 1)) / AMAX + (rng.next() - 0.5) * byDiff(game, [0.9, 0.4, 0.1]), -1, 1);
    }
    return { mx: b.mx };
  },

  render(ctx, st, game) {
    softBg(ctx);
    const wind = this.gust(st, st.t), ng = this.nextGust(st, st.t);
    const warn = !wind && ng && ng.t0 - st.t < 1 ? ng.f : 0;
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i];
      inPanel(ctx, i, () => {
        const g = ctx.createLinearGradient(0, 0, 0, QH); g.addColorStop(0, '#c9ecff'); g.addColorStop(1, '#f2faff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, QW, QH);
        // hills and pit
        ctx.fillStyle = '#c8ecc0'; ctx.beginPath(); ctx.ellipse(110, QH + 30, 190, 80, 0, 0, Math.PI * 2); ctx.ellipse(540, QH + 40, 210, 90, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let k = 0; k < 3; k++) { const x = ((k * 230 + st.t * 12) % 760) - 60, y = 70 + k * 30; ctx.beginPath(); ctx.ellipse(x, y, 40, 13, 0, 0, Math.PI * 2); ctx.ellipse(x + 20, y - 8, 24, 12, 0, 0, Math.PI * 2); ctx.fill(); }
        // wind streaks
        const wv = wind || warn;
        if (wv) {
          const dir = Math.sign(wv), a = wind ? 0.75 : 0.3;
          ctx.strokeStyle = `rgba(110,150,210,${a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
          for (let k = 0; k < 9; k++) {
            const y = 60 + (k * 37) % 200, len = 40 + (k % 3) * 18;
            let x = ((k * 97 + st.t * 420 * dir) % (QW + 120) + QW + 120) % (QW + 120) - 60;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dir * len, y); ctx.stroke();
          }
          ctx.lineCap = 'butt';
        }
        // fulcrum
        ctx.fillStyle = '#c4b5fd'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(PX, PY + 4); ctx.lineTo(PX - 30, PY + 70); ctx.quadraticCurveTo(PX, PY + 78, PX + 30, PY + 70); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#efe8ff'; ctx.beginPath(); ctx.arc(PX, PY + 4, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // plank (rotated)
        ctx.save(); ctx.translate(PX, PY); ctx.rotate(p.ang);
        ctx.fillStyle = pastel(pl.color, 0.45); rr(ctx, -L - 12, -8, (L + 12) * 2, 18, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff9aa8'; for (const sx of [-1, 1]) { rr(ctx, sx > 0 ? L - 6 : -L - 12, -8, 18, 18, 8); ctx.fill(); ctx.stroke(); }
        // current star, sitting above the plank
        if (p.k < st.stars.length && p.fall <= 0) {
          const s = st.stars[p.k], bob = Math.sin(st.t * 5) * 3;
          star(ctx, s, -42 + bob, 15, '#ffd76e', '#c99a1a');
          ctx.fillStyle = 'rgba(255,215,110,0.35)'; ctx.beginPath(); ctx.ellipse(s, -6, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
        // character rolling on top
        if (p.fall <= 0) {
          game.drawPlayer(ctx, i, p.x, -9, BR * 2.2, { noShadow: true, pivot: true, rot: p.x / BR, tag: true, expr: p.gain > 0 ? 'win' : Math.abs(p.x) > L - 50 ? 'lose' : 'idle' });
        }
        ctx.restore();
        // falling character (world space)
        if (p.fall > 0) {
          const ex = PX + p.side * (L + 20), ey = PY - 10 + p.y;
          game.drawPlayer(ctx, i, ex + p.side * p.y * 0.25, ey, BR * 2.2, { noShadow: true, pivot: true, rot: p.side * p.y * 0.04, expr: 'lose', alpha: Math.max(0, p.fall / FALL_T) });
          text(ctx, '별 -1', ex - p.side * 30, PY - 60 - (FALL_T - p.fall) * 20, { size: 22, title: true, align: 'center', color: '#ff8fa3', stroke: INK, strokeW: 5, alpha: Math.max(0, p.fall / FALL_T) });
        }
        const mid = wind ? (wind > 0 ? '바람 →' : '← 바람') : warn ? '바람이 불어요!' : '';
        panelHeader(ctx, game, i, `★ ${p.stars}`, mid);
        if (i === game.local && !game.auto && st.t < 4) text(ctx, '← → 로 시소를 기울이세요', QW / 2, QH - 14, { size: 18, title: true, align: 'center', color: '#fff', stroke: INK, strokeW: 5 });
      });
      panelFrame(ctx, game, i);
    }
  },
};
