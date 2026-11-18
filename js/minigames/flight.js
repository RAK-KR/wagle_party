// 열기구 별 모으기 — hold to heat and rise, let go to sink. Collect stars, dodge birds.
import { W, H, COL, text, byDiff, clamp, shade, quad, inPanel, panelHeader, panelFrame, star, QW, QH, softBg, INK } from './common.js';

const LIMIT = 34, BX = 150, TOP = 64, BOT = 268, SCROLL0 = 210, LIFT = 560, GRAV = 300, VMAX = 230;

export default {
  id: 'flight', name: '열기구 별 모으기', typeLabel: '탈것', color: '#8fd3ff',
  rule: '누르고 있으면 열기구가 떠오르고, 떼면 내려갑니다. 별을 모으고 새는 피하세요. 부딪히면 별 2개를 잃습니다.',
  controls: [['떠오르기', 'Space / 클릭 누르고 있기'], ['내려가기', '손 떼기']],
  touch: { stick: false, a: true, aLabel: '불꽃' },

  init(game, rng) {
    const items = [];
    let t = 1.2, id = 0;
    while (t < LIMIT - 0.5) {
      const r = rng.next(), y = rng.range(TOP + 10, BOT - 10);
      if (r < 0.68) {
        // star or a little arc of stars
        if (rng.chance(0.35)) { const n = 3, dy = rng.range(-40, 40); for (let k = 0; k < n; k++) items.push({ id: id++, t: t + k * 0.22, y: clamp(y + dy * (k - 1), TOP + 10, BOT - 10), type: 'star' }); t += 0.6; }
        else items.push({ id: id++, t, y, type: 'star' });
      } else items.push({ id: id++, t, y, type: 'bird', amp: rng.range(8, 26), ph: rng.next() * 6 });
      t += rng.range(0.42, 0.85) - t / LIMIT * 0.15;
    }
    return { t: 0, items, pl: [0, 1, 2, 3].map(i => ({ i, y: (TOP + BOT) / 2, vy: 0, stars: 0, got: {}, hit: 0, heat: false, gain: 0, lost: [], bot: { ty: 160, next: 0 } })) };
  },
  scroll(t) { return SCROLL0 + t * 2.2; },
  itemX(st, it) { // distance travelled since start
    const travel = (tt) => SCROLL0 * tt + 1.1 * tt * tt;
    return BX + travel(it.t) - travel(st.t);
  },
  itemY(it, t) { return it.type === 'bird' ? it.y + Math.sin(t * 3 + it.ph) * it.amp : it.y; },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    for (const p of st.pl) {
      p.hit = Math.max(0, p.hit - dt); p.gain = Math.max(0, p.gain - dt);
      const inp = inputs[p.i];
      p.heat = !ended && (inp.a || inp.pDown);
      p.vy += (p.heat ? -LIFT : GRAV) * dt;
      p.vy = clamp(p.vy, -VMAX, VMAX);
      p.y += p.vy * dt;
      if (p.y < TOP) { p.y = TOP; p.vy = Math.max(0, p.vy); }
      if (p.y > BOT) { p.y = BOT; p.vy = Math.min(0, p.vy); }
      for (const it of st.items) {
        if (p.got[it.id]) continue;
        const x = this.itemX(st, it); if (x < BX - 50 || x > BX + 50) continue;
        const y = this.itemY(it, st.t), cy = p.y - 30;
        if (it.type === 'star' && Math.hypot(x - BX, y - cy) < 38) { p.got[it.id] = 1; p.stars++; p.gain = 0.3; game.sfx('coin', p.i); }
        if (it.type === 'bird' && p.hit <= 0 && Math.abs(x - BX) < 34 && Math.abs(y - cy) < 36) {
          p.got[it.id] = 1; p.hit = 1.2; const lose = Math.min(2, p.stars); p.stars -= lose; p.vy = 160;
          for (let k = 0; k < lose; k++) p.lost.push({ t: 0, x: BX, y: cy, vx: -60 - k * 40, vy: -120 });
          game.sfx('bad', p.i); game.sfx('bump', ~p.i, 0.4);
        }
      }
      for (const l of p.lost) { l.t += dt; l.vy += 500 * dt; l.x += l.vx * dt; l.y += l.vy * dt; }
      p.lost = p.lost.filter(l => l.t < 1);
    }
  },
  done(st) { return st.t >= LIMIT + 0.5; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => p.stars); },
  detail(st, i) { return `별 ${st.pl[i].stars}개`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    const react = byDiff(game, [0.45, 0.28, 0.14]), err = byDiff(game, [26, 14, 5]);
    if (st.t > b.next) {
      b.next = st.t + react;
      let target = null, best = 1e9;
      for (const it of st.items) {
        if (it.type !== 'star' || p.got[it.id]) continue;
        const x = this.itemX(st, it); if (x < BX - 20 || x > BX + 420) continue;
        if (x < best) { best = x; target = it; }
      }
      b.ty = target ? this.itemY(target, st.t) + 30 + (rng.next() - 0.5) * err * 2 : (TOP + BOT) / 2;
      // dodge birds about to arrive
      for (const it of st.items) {
        if (it.type !== 'bird' || p.got[it.id]) continue;
        const x = this.itemX(st, it); if (x < BX - 30 || x > BX + 170) continue;
        const by = this.itemY(it, st.t) + 30;
        if (Math.abs(by - b.ty) < 60 && rng.next() < byDiff(game, [0.6, 0.85, 0.97])) b.ty = by < (TOP + BOT) / 2 + 20 ? by + 75 : by - 75;
      }
      b.ty = clamp(b.ty, TOP, BOT);
    }
    // simple PD: want velocity toward target
    const want = clamp((b.ty - p.y) * 3.2, -VMAX, VMAX);
    return { a: p.vy > want };
  },

  render(ctx, st, game) {
    softBg(ctx);
    const travel = SCROLL0 * st.t + 1.1 * st.t * st.t;
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i];
      inPanel(ctx, i, () => {
        const g = ctx.createLinearGradient(0, 0, 0, QH); g.addColorStop(0, '#b8e0ff'); g.addColorStop(1, '#fff0dc');
        ctx.fillStyle = g; ctx.fillRect(0, 0, QW, QH);
        ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.beginPath(); ctx.arc(520, 70, 26, 0, Math.PI * 2); ctx.fill();
        // far hills + clouds parallax
        ctx.fillStyle = '#c4e8b2';
        for (let k = -1; k < 6; k++) { const x = ((k * 200 - travel * 0.15) % 1000 + 1000) % 1000 - 200; ctx.beginPath(); ctx.ellipse(x, QH + 10, 150, 50, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let k = 0; k < 5; k++) { const x = ((k * 170 - travel * 0.4) % 850 + 850) % 850 - 100, y = 70 + (k * 53) % 160; ctx.beginPath(); ctx.ellipse(x, y, 42, 14, 0, 0, Math.PI * 2); ctx.ellipse(x + 22, y - 8, 26, 13, 0, 0, Math.PI * 2); ctx.fill(); }
        // items
        for (const it of st.items) {
          if (p.got[it.id]) continue;
          const x = this.itemX(st, it); if (x < -40 || x > QW + 40) continue;
          const y = this.itemY(it, st.t);
          if (it.type === 'star') star(ctx, x, y, 15 + Math.sin(st.t * 6 + it.id) * 1.5);
          else drawBird(ctx, x, y, st.t + it.ph);
        }
        for (const l of p.lost) star(ctx, l.x, l.y, 11, `rgba(255,207,58,${1 - l.t})`, `rgba(154,107,0,${1 - l.t})`);
        drawBalloon(ctx, game, i, BX, p.y, p.heat, p.hit > 0 && Math.sin(st.t * 30) > 0, st.t, p.hit > 0 ? 'lose' : p.gain > 0 ? 'win' : 'idle');
        panelHeader(ctx, game, i, `★ ${p.stars}`);
        if (i === game.local && !game.auto && st.t < 4) text(ctx, 'Space를 누르고 있으면 떠오릅니다', QW / 2, QH - 16, { size: 18, title: true, align: 'center', color: '#fff', stroke: INK, strokeW: 5 });
      });
      panelFrame(ctx, game, i);
    }
  },
};

function drawBalloon(ctx, game, i, x, y, heat, blink, t, expr) {
  const col = game.players[i].color;
  if (blink) ctx.globalAlpha = 0.5;
  // envelope
  const ey = y - 56;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, ey, 34, 38, 0, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const sx of [-17, 3]) ctx.fillRect(x + sx, ey - 40, 10, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - 12, ey - 14, 8, 14, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, ey, 34, 38, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = shade(col, -0.3); ctx.beginPath(); ctx.moveTo(x - 14, ey + 34); ctx.lineTo(x + 14, ey + 34); ctx.lineTo(x + 10, ey + 42); ctx.lineTo(x - 10, ey + 42); ctx.closePath(); ctx.fill();
  // flame
  if (heat) { const f = 8 + Math.sin(t * 40) * 3; ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(x - 5, ey + 46); ctx.quadraticCurveTo(x, ey + 46 - f * 2, x + 5, ey + 46); ctx.fill(); ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.moveTo(x - 2.5, ey + 46); ctx.quadraticCurveTo(x, ey + 46 - f, x + 2.5, ey + 46); ctx.fill(); }
  // ropes
  ctx.strokeStyle = '#6b4f3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 12, ey + 40); ctx.lineTo(x - 15, y - 8); ctx.moveTo(x + 12, ey + 40); ctx.lineTo(x + 15, y - 8); ctx.stroke();
  // rider then basket front
  game.drawPlayer(ctx, i, x, y - 2, 34, { noShadow: true, expr, tag: true });
  ctx.fillStyle = '#a0723c'; ctx.fillRect(x - 17, y - 10, 34, 16);
  ctx.fillStyle = '#7a5226'; ctx.fillRect(x - 17, y - 10, 34, 3); ctx.fillRect(x - 17, y - 1, 34, 2);
  ctx.globalAlpha = 1;
}
function drawBird(ctx, x, y, t) {
  const f = Math.sin(t * 14) * 9;
  ctx.fillStyle = '#3a3546';
  ctx.beginPath(); ctx.ellipse(x, y, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + 8, y - 16 - f); ctx.lineTo(x + 10, y - 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(x - 14, y - 2); ctx.lineTo(x - 23, y + 1); ctx.lineTo(x - 14, y + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 8, y - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1824'; ctx.beginPath(); ctx.arc(x - 9, y - 3, 1.5, 0, Math.PI * 2); ctx.fill();
}
