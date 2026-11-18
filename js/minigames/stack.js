// 탑 쌓기 — a block slides back and forth; drop it on the tower. Overhang gets cut off. Highest tower wins.
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, shade, quad, inPanel, panelHeader, panelFrame, QW, QH } from './common.js';

const BH = 24, BASEW = 230, LIMIT = 45, BASEY = 292;

export default {
  id: 'stack', name: '탑 쌓기', typeLabel: '타이밍', color: '#ffb36b',
  rule: '좌우로 움직이는 블록을 떨어뜨려 탑을 쌓으세요. 삐져나온 부분은 잘려 나가고, 완전히 빗나가면 끝입니다.',
  controls: [['떨어뜨리기', 'Space / 클릭']],
  touch: { stick: false, a: true, aLabel: '쌓기' },

  init(game, rng) {
    return {
      t: 0,
      pl: [0, 1, 2, 3].map(i => ({ i, blocks: [{ x: QW / 2, w: BASEW }], mx: 60, dir: 1, speed: 230, failed: false, failT: 0, cam: 0, perfect: 0, chips: [], fall: null, bot: { tol: 0, react: 0, wait: 0 } })),
    };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    for (const p of st.pl) {
      for (const c of p.chips) { c.t += dt; c.vy += 900 * dt; c.y += c.vy * dt; c.x += c.vx * dt; }
      p.chips = p.chips.filter(c => c.t < 1.2);
      p.perfect = Math.max(0, p.perfect - dt);
      if (p.fall) { p.fall.t += dt; }
      const h = p.blocks.length;
      const camTarget = Math.max(0, (h - 6) * BH);
      p.cam += (camTarget - p.cam) * Math.min(1, dt * 6);
      if (p.failed || ended || st.t > LIMIT) continue;
      const top = p.blocks[h - 1];
      p.mx += p.dir * p.speed * dt;
      const half = top.w / 2;
      if (p.mx > QW - 20 - half) { p.mx = QW - 20 - half; p.dir = -1; }
      if (p.mx < 20 + half) { p.mx = 20 + half; p.dir = 1; }
      if (inputs[p.i].aP || inputs[p.i].pP) {
        const dx = p.mx - top.x;
        if (Math.abs(dx) < 5) { p.blocks.push({ x: top.x, w: top.w }); p.perfect = 0.5; if (p.i === game.local) sfx.perfect(); }
        else if (Math.abs(dx) >= top.w) { p.failed = true; p.failT = st.t; p.fall = { x: p.mx, w: top.w, t: 0 }; if (p.i === game.local) sfx.bad(); else sfx.miss(); continue; }
        else {
          const nw = top.w - Math.abs(dx), nx = top.x + dx / 2;
          const cutX = dx > 0 ? nx + nw / 2 + Math.abs(dx) / 2 : nx - nw / 2 - Math.abs(dx) / 2;
          p.chips.push({ x: cutX, y: 0, w: Math.abs(dx), vy: -60, vx: Math.sign(dx) * 80, t: 0, h });
          p.blocks.push({ x: nx, w: nw });
          if (p.i === game.local) sfx.land();
        }
        p.speed = Math.min(520, 230 + p.blocks.length * 11);
        p.mx = p.dir > 0 ? 20 + p.blocks[p.blocks.length - 1].w / 2 : QW - 20 - p.blocks[p.blocks.length - 1].w / 2;
      }
    }
  },
  done(st) { return st.t > LIMIT + 1 || st.pl.every(p => p.failed && st.t - p.failT > 1); },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return st.pl.map(p => p.blocks.length - 1); },
  detail(st, i) { return `${st.pl[i].blocks.length - 1}층`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    if (p.failed) return {};
    const top = p.blocks[p.blocks.length - 1];
    if (b.h !== p.blocks.length) { b.h = p.blocks.length; b.off = rng.gauss() * (byDiff(game, [13, 8, 4.5]) + p.speed * byDiff(game, [0.03, 0.018, 0.01])); b.wait = st.t + 0.25; }
    if (st.t < b.wait) return {};
    // aim error is in b.tol; the window also covers one frame of movement so fast blocks are not skipped
    if (Math.abs(p.mx - (top.x + b.off)) <= p.speed / 60 * 0.6) return { a: true };
    return {};
  },

  render(ctx, st, game) {
    ctx.fillStyle = '#1b1824'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i], h = p.blocks.length;
      inPanel(ctx, i, () => {
        const sky = clamp(p.cam / 900, 0, 1);
        const g = ctx.createLinearGradient(0, 0, 0, QH);
        g.addColorStop(0, sky > 0.5 ? '#1a1840' : '#7ec8ff'); g.addColorStop(1, sky > 0.5 ? '#4a3a7a' : '#ffe2c4');
        ctx.fillStyle = g; ctx.fillRect(0, 0, QW, QH);
        if (sky > 0.5) for (let k = 0; k < 30; k++) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect((k * 97) % QW, (k * 53) % QH, 2, 2); }
        const yOf = (k) => BASEY - k * BH + p.cam;
        ctx.fillStyle = '#6fbf5a'; ctx.fillRect(0, yOf(0) + BH, QW, 200);
        p.blocks.forEach((bk, k) => {
          const y = yOf(k); if (y < -30 || y > QH + 30) return;
          const c = k === 0 ? '#7a6a5a' : shade(pl.color, -0.25 + (k % 5) * 0.08);
          ctx.fillStyle = c; ctx.fillRect(bk.x - bk.w / 2, y, bk.w, BH);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bk.x - bk.w / 2, y, bk.w, 4);
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(bk.x - bk.w / 2, y + BH - 4, bk.w, 4);
        });
        for (const c of p.chips) { ctx.fillStyle = shade(pl.color, -0.3); ctx.globalAlpha = 1 - c.t / 1.2; ctx.fillRect(c.x - c.w / 2, yOf(c.h) + c.y, c.w, BH); ctx.globalAlpha = 1; }
        const topB = p.blocks[h - 1];
        if (!p.failed && st.t <= LIMIT) {
          const y = yOf(h);
          ctx.fillStyle = pl.color; ctx.fillRect(p.mx - topB.w / 2, y, topB.w, BH);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(p.mx - topB.w / 2, y, topB.w, 4);
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(p.mx, y + BH); ctx.lineTo(p.mx, yOf(h - 1)); ctx.stroke(); ctx.setLineDash([]);
        }
        if (p.fall) { ctx.fillStyle = pl.color; ctx.globalAlpha = Math.max(0, 1 - p.fall.t); ctx.fillRect(p.fall.x - p.fall.w / 2, yOf(h) + p.fall.t * p.fall.t * 500, p.fall.w, BH); ctx.globalAlpha = 1; }
        // character on top of tower
        const cy = yOf(h - 1);
        game.drawPlayer(ctx, i, topB.x + (p.failed ? 0 : 0), cy, 44, { tag: true, expr: p.failed ? 'lose' : p.perfect > 0 ? 'win' : 'idle', noShadow: false });
        if (p.perfect > 0) text(ctx, '딱!', topB.x + topB.w / 2 + 20, cy - 10, { size: 22, weight: 900, color: COL.accent, stroke: '#1b1824', strokeW: 5 });
        panelHeader(ctx, game, i, `${h - 1}층`);
        if (p.failed) text(ctx, '끝!', QW / 2, 150, { size: 34, title: true, align: 'center', color: '#fff', stroke: '#1b1824', strokeW: 6 });
      });
      panelFrame(ctx, game, i);
    }
  },
};
