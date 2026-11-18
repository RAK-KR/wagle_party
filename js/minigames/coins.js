// 코인 줍기 — coins rain down; grab the most. Bombs stun you and scatter your coins. Dash to bump others.
import { sfx } from '../audio.js';
import { W, H, COL, text, coin, byDiff, clamp, shade } from './common.js';

const AX0 = 80, AY0 = 80, AX1 = 1200, AY1 = 690, LIMIT = 32, SPEED = 290, FALL = 0.9, PICK = 36;

export default {
  id: 'coins', name: '코인 줍기', typeLabel: '캐릭터 조작', color: '#ffcf3a',
  rule: '하늘에서 떨어지는 코인을 가장 많이 주우세요. 폭탄 그림자는 피하고, 부딪히면 상대 코인을 떨어뜨릴 수 있습니다.',
  controls: [['이동', 'WASD / 방향키'], ['돌진', 'Space (부딪히면 상대 코인 1개 떨어짐)']],
  touch: { stick: true, a: true, aLabel: '돌진' },

  init(game, rng) {
    const sp = [[300, 250], [980, 250], [300, 560], [980, 560]];
    return {
      t: 0, items: [], next: 0, nextBomb: 5, nextBag: 4, fx: [],
      pl: sp.map(([x, y], i) => ({ i, x, y, vx: 0, vy: 0, coins: 0, stun: 0, cd: 0, dash: 0, facing: x < W / 2 ? 1 : -1, hitFlash: 0, gain: 0, bot: { tx: x, ty: y, next: 0 } })),
    };
  },
  drop(st, rng, type, x, y) {
    st.items.push({ type, x: x ?? rng.range(AX0 + 40, AX1 - 40), y: y ?? rng.range(AY0 + 50, AY1 - 30), t: 0, landed: false, val: type === 'bag' ? 5 : 1 });
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    if (!ended && st.t < LIMIT) {
      if (st.t > st.next) { st.next = st.t + rng.range(0.18, 0.42); this.drop(st, rng, 'coin'); }
      if (st.t > st.nextBag) { st.nextBag = st.t + rng.range(3, 5); this.drop(st, rng, 'bag'); }
      if (st.t > st.nextBomb) { st.nextBomb = st.t + rng.range(0.7, 1.4) - st.t * 0.008; this.drop(st, rng, 'bomb'); }
    }
    for (const it of st.items) {
      it.t += dt;
      if (!it.landed && it.t >= (it.scatter ? 0.45 : FALL)) {
        it.landed = true; it.t = 0;
        if (it.type === 'bomb') {
          it.dead = true; sfx.boom();
          st.fx.push({ kind: 'boom', x: it.x, y: it.y, t: 0 });
          for (const p of st.pl) if (Math.hypot(p.x - it.x, p.y - it.y) < 82 && p.stun <= 0) {
            p.stun = 1.3; const lose = Math.min(3, p.coins); p.coins -= lose;
            for (let k = 0; k < lose; k++) { const a = rng.next() * Math.PI * 2, d = 60 + rng.next() * 60; st.items.push({ type: 'coin', x: clamp(p.x + Math.cos(a) * d, AX0 + 20, AX1 - 20), y: clamp(p.y + Math.sin(a) * d, AY0 + 20, AY1 - 10), t: 0, landed: false, val: 1, scatter: true, fromX: p.x, fromY: p.y }); }
          }
        }
      }
    }
    for (const p of st.pl) {
      p.cd = Math.max(0, p.cd - dt); p.dash = Math.max(0, p.dash - dt); p.stun = Math.max(0, p.stun - dt); p.hitFlash = Math.max(0, p.hitFlash - dt); p.gain = Math.max(0, p.gain - dt);
      const inp = ended || p.stun > 0 ? { mx: 0, my: 0 } : inputs[p.i];
      let mx = inp.mx, my = inp.my; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
      if (p.dash <= 0) { const k = Math.min(1, dt * 12); p.vx += (mx * SPEED - p.vx) * k; p.vy += (my * SPEED - p.vy) * k; }
      if (Math.abs(mx) > 0.2) p.facing = mx > 0 ? 1 : -1;
      if (!ended && p.stun <= 0 && inp.aP && p.cd === 0) {
        const d = l > 0.1 ? [mx / Math.max(l, 1e-3) * Math.min(1, l), my / Math.max(l, 1e-3) * Math.min(1, l)] : [p.facing, 0];
        const dl = Math.hypot(d[0], d[1]) || 1;
        p.vx = d[0] / dl * 720; p.vy = d[1] / dl * 720; p.dash = 0.2; p.cd = 1.2; sfx.boost();
      }
      p.x = clamp(p.x + p.vx * dt, AX0 + 24, AX1 - 24); p.y = clamp(p.y + p.vy * dt, AY0 + 30, AY1 - 6);
      for (const it of st.items) {
        if (!it.landed || it.dead || it.type === 'bomb' || p.stun > 0) continue;
        if (Math.hypot(it.x - p.x, it.y - (p.y - 10)) < PICK) { it.dead = true; p.coins += it.val; p.gain = 0.3; if (p.i === game.local) (it.val > 1 ? sfx.good() : sfx.coin()); }
      }
    }
    // bumping
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = st.pl[a], B = st.pl[b];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 50 && d > 0.01) {
        const nx = dx / d, ny = dy / d, o = (50 - d) / 2;
        A.x -= nx * o; A.y -= ny * o; B.x += nx * o; B.y += ny * o;
        for (const [X, Y, s] of [[A, B, 1], [B, A, -1]]) {
          if (X.dash > 0 && Y.hitFlash <= 0) {
            Y.hitFlash = 0.6; Y.vx = nx * 420 * s; Y.vy = ny * 420 * s; Y.dash = 0.15; sfx.bump(1);
            if (Y.coins > 0) { Y.coins--; const ang = Math.atan2(ny * s, nx * s) + rng.range(-0.6, 0.6); st.items.push({ type: 'coin', x: clamp(Y.x + Math.cos(ang) * 90, AX0 + 20, AX1 - 20), y: clamp(Y.y + Math.sin(ang) * 90, AY0 + 20, AY1 - 10), t: 0, landed: false, val: 1, scatter: true, fromX: Y.x, fromY: Y.y }); }
          }
        }
      }
    }
    st.items = st.items.filter(it => !it.dead && !(it.landed && it.t > 9));
    for (const f of st.fx) f.t += dt;
    st.fx = st.fx.filter(f => f.t < 0.6);
  },
  done(st) { return st.t >= LIMIT + 1; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => p.coins); },
  detail(st, i) { return `코인 ${st.pl[i].coins}개`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    if (p.stun > 0) return {};
    const react = byDiff(game, [0.55, 0.32, 0.16]), spd = byDiff(game, [0.78, 0.9, 1]);
    // flee bombs about to land
    for (const it of st.items) {
      if (it.type !== 'bomb' || it.landed) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < 110 && FALL - it.t < 0.75 && rng.next() < byDiff(game, [0.7, 0.9, 1])) {
        const l = d || 1; return { mx: (p.x - it.x) / l, my: (p.y - it.y) / l };
      }
    }
    if (st.t > b.next) {
      b.next = st.t + react * (0.7 + rng.next() * 0.6);
      let best = null, bs = -1;
      for (const it of st.items) {
        if (it.type === 'bomb' || it.dead) continue;
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        const tl = it.landed ? 0 : (it.scatter ? 0.45 : FALL) - it.t;
        if (d / SPEED + 0.2 < tl * 0.4) continue;
        let danger = 0;
        for (const bm of st.items) if (bm.type === 'bomb' && !bm.landed && Math.hypot(bm.x - it.x, bm.y - it.y) < 90) danger = 1;
        for (const o of st.pl) if (o !== p && Math.hypot(o.x - it.x, o.y - it.y) < d * 0.6) danger += 0.5;
        const s = it.val / (d + 80) * (it.landed ? 1 : 0.85) / (1 + danger * 2);
        if (s > bs) { bs = s; best = it; }
      }
      if (best) { b.tx = best.x; b.ty = best.y; }
    }
    let mx = b.tx - p.x, my = b.ty - p.y; const d = Math.hypot(mx, my);
    if (d < 6) return {};
    mx = mx / d * spd; my = my / d * spd;
    let a = false;
    if (p.cd === 0 && rng.next() < byDiff(game, [0.004, 0.01, 0.02])) {
      for (const o of st.pl) if (o !== p && o.coins > 0 && Math.hypot(o.x - p.x, o.y - p.y) < 130) { mx = (o.x - p.x); my = (o.y - p.y); const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; a = true; }
    }
    return { mx, my, a };
  },

  render(ctx, st, game) {
    ctx.fillStyle = '#2a1f3d'; ctx.fillRect(0, 0, W, H);
    // plaza floor
    ctx.fillStyle = '#e9c98f'; ctx.fillRect(AX0, AY0, AX1 - AX0, AY1 - AY0);
    for (let x = AX0; x < AX1; x += 70) for (let y = AY0; y < AY1; y += 70) {
      if (((x - AX0) / 70 + (y - AY0) / 70) % 2 === 0) { ctx.fillStyle = '#e2bf82'; ctx.fillRect(x, y, 70, 70); }
    }
    ctx.strokeStyle = '#b8935a'; ctx.lineWidth = 10; ctx.strokeRect(AX0 - 5, AY0 - 5, AX1 - AX0 + 10, AY1 - AY0 + 10);
    // shadows of falling things
    for (const it of st.items) {
      if (it.landed) continue;
      const k = it.t / (it.scatter ? 0.45 : FALL), r = it.type === 'bomb' ? 82 : 18;
      ctx.fillStyle = it.type === 'bomb' ? `rgba(220,40,40,${0.12 + k * 0.25})` : `rgba(60,40,20,${0.15 + k * 0.2})`;
      ctx.beginPath(); ctx.ellipse(it.x, it.y, r * (0.4 + k * 0.6), r * 0.45 * (0.4 + k * 0.6), 0, 0, Math.PI * 2); ctx.fill();
      if (it.type === 'bomb') { ctx.strokeStyle = `rgba(220,40,40,${0.5 + k * 0.4})`; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.ellipse(it.x, it.y, 82, 37, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    // landed coins
    for (const it of st.items) if (it.landed) {
      const bob = Math.max(0, 1 - it.t * 3) * Math.abs(Math.sin(it.t * 18)) * 8;
      if (it.type === 'bag') drawBag(ctx, it.x, it.y - 14 - bob); else coin(ctx, it.x, it.y - 12 - bob, 13, st.t + it.x);
    }
    // characters sorted by y
    const list = st.pl.slice().sort((a, b) => a.y - b.y);
    for (const p of list) {
      const expr = p.stun > 0 || p.hitFlash > 0 ? 'lose' : p.gain > 0 ? 'win' : 'idle';
      game.drawPlayer(ctx, p.i, p.x, p.y, 72, { facing: p.facing, tag: true, expr, ring: true });
      if (p.stun > 0) for (let k = 0; k < 3; k++) { const a = st.t * 6 + k * 2.1; text(ctx, '★', p.x + Math.cos(a) * 26, p.y - 82 + Math.sin(a) * 8, { size: 16, weight: 900, align: 'center', color: '#ffcf3a' }); }
      text(ctx, String(p.coins), p.x, p.y + 22, { size: 18, weight: 900, align: 'center', color: '#fff', stroke: '#1b1824', strokeW: 5 });
    }
    // falling objects above
    for (const it of st.items) if (!it.landed) {
      const dur = it.scatter ? 0.45 : FALL, k = it.t / dur;
      let x = it.x, y = it.y - (1 - k) * 520 - 12;
      if (it.scatter) { x = it.fromX + (it.x - it.fromX) * k; y = it.fromY + (it.y - it.fromY) * k - Math.sin(k * Math.PI) * 90 - 12; }
      if (it.type === 'bomb') drawBomb(ctx, x, y, st.t); else if (it.type === 'bag') drawBag(ctx, x, y); else coin(ctx, x, y, 13, st.t * 2);
    }
    for (const f of st.fx) {
      const k = f.t / 0.6;
      ctx.fillStyle = `rgba(255,170,60,${1 - k})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 30 + k * 70, (30 + k * 70) * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,240,180,${1 - k})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, 15 + k * 40, (15 + k * 40) * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // scoreboard strip
    for (let i = 0; i < 4; i++) {
      const p = game.players[i], x = 360 + i * 150;
      ctx.fillStyle = 'rgba(14,12,19,0.7)'; ctx.fillRect(x, 50, 140, 26);
      ctx.fillStyle = p.color; ctx.fillRect(x, 50, 5, 26);
      text(ctx, p.name, x + 14, 68, { size: 14, weight: 900, color: p.color });
      text(ctx, String(st.pl[i].coins), x + 130, 69, { size: 17, weight: 900, align: 'right' });
    }
  },
};

function drawBag(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#b07a3a'; ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(8, -16); ctx.lineTo(5, -10); ctx.quadraticCurveTo(22, -4, 20, 12); ctx.quadraticCurveTo(0, 22, -20, 12); ctx.quadraticCurveTo(-22, -4, -5, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffcf3a'; ctx.font = '900 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('5', 0, 4);
  ctx.restore();
}
function drawBomb(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-6, -6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -14); ctx.quadraticCurveTo(14, -24, 10, -28); ctx.stroke();
  ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffcf3a' : '#ff5d6c'; ctx.beginPath(); ctx.arc(10, -29, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
