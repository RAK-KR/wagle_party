// 숫자 순서대로 — click 1 to 20 in order as fast as you can. Everyone gets the same board.
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, shade, raceScores } from './common.js';

const COUNT = 20, R = 34, BX0 = 40, BY0 = 70, BX1 = 880, BY1 = 700, LIMIT = 45;
const COLS = ['#ff8fa3', '#8fd3ff', '#b59cff', '#9be59b', '#ffb36b', '#ffd36b'];

export default {
  id: 'numbers', name: '숫자 순서대로', typeLabel: '마우스 / 터치', color: '#8fd3ff',
  rule: '흩어진 숫자를 1부터 20까지 순서대로 누르세요. 모두 같은 판이고, 틀리게 누르면 잠깐 멈춥니다.',
  controls: [['누르기', '마우스 클릭 / 화면 터치']],
  touch: { stick: false, a: false },

  init(game, rng) {
    const nums = [];
    for (let n = 1; n <= COUNT; n++) {
      let x, y, tries = 0;
      do { x = rng.range(BX0 + R + 6, BX1 - R - 6); y = rng.range(BY0 + R + 6, BY1 - R - 6); tries++; }
      while (tries < 500 && nums.some(o => Math.hypot(o.x - x, o.y - y) < R * 2 + 14));
      nums.push({ n, x, y, col: rng.pick(COLS), rot: rng.range(-0.3, 0.3) });
    }
    return {
      t: 0, nums,
      pl: [0, 1, 2, 3].map(i => ({ i, next: 1, finishT: null, progress: 0, pen: 0, shake: 0, pop: [], bot: { at: 0 } })),
    };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt;
    for (const p of st.pl) {
      p.pen = Math.max(0, p.pen - dt); p.shake = Math.max(0, p.shake - dt);
      for (const q of p.pop) q.t += dt; p.pop = p.pop.filter(q => q.t < 0.4);
      if (p.finishT != null || ended) continue;
      const inp = inputs[p.i];
      if (inp.num === p.next) this.advance(st, p, game);
      else if (inp.pP && p.pen <= 0) {
        const hit = st.nums.find(o => o.n >= p.next && Math.hypot(o.x - inp.px, o.y - inp.py) < R + 4);
        if (hit) {
          if (hit.n === p.next) this.advance(st, p, game);
          else { p.pen = 0.6; p.shake = 0.3; if (p.i === game.local) sfx.bad(); }
        }
      }
    }
  },
  advance(st, p, game) {
    const o = st.nums[p.next - 1];
    p.pop.push({ x: o.x, y: o.y, t: 0 });
    p.next++; p.progress = (p.next - 1) / COUNT;
    if (p.i === game.local) sfx.pop();
    if (p.next > COUNT) { p.finishT = st.t; if (p.i === game.local) sfx.good(); }
  },
  done(st) { return st.pl.every(p => p.finishT != null) || st.t > LIMIT; },
  timeLeft(st) { return LIMIT - st.t; },
  scores(st) { return raceScores(st.pl); },
  detail(st, i) { const p = st.pl[i]; return p.finishT != null ? `${p.finishT.toFixed(1)}초` : `${p.next - 1} / ${COUNT}`; },

  bot(st, i, game, rng) {
    const p = st.pl[i], b = p.bot;
    if (p.finishT != null) return {};
    if (!b.at) b.at = st.t + 0.4;
    if (st.t < b.at || p.pen > 0) return {};
    const per = byDiff(game, [1.55, 1.12, 0.78]), sd = byDiff(game, [0.5, 0.33, 0.2]);
    const cur = st.nums[p.next - 1], nxt = st.nums[Math.min(COUNT - 1, p.next)];
    const dist = Math.hypot(nxt.x - cur.x, nxt.y - cur.y);
    b.at = st.t + Math.max(0.35, per + rng.gauss() * sd + dist / 2400);
    if (rng.next() < byDiff(game, [0.06, 0.03, 0.01])) { p.pen = 0.6; return {}; }
    return { num: p.next };
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#22324a'); g.addColorStop(1, '#141c2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const me = st.pl[game.local];
    const sx = me.shake > 0 ? Math.sin(st.t * 80) * 6 : 0;
    ctx.save(); ctx.translate(sx, 0);
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
    for (let x = BX0; x < BX1; x += 30) { ctx.beginPath(); ctx.moveTo(x, BY0); ctx.lineTo(x, BY1); ctx.stroke(); }
    for (let y = BY0; y < BY1; y += 30) { ctx.beginPath(); ctx.moveTo(BX0, y); ctx.lineTo(BX1, y); ctx.stroke(); }
    for (const o of st.nums) {
      const done = o.n < me.next;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
      ctx.fillStyle = done ? '#d9d3c8' : o.col; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      if (!done) { ctx.strokeStyle = shade(o.col, -0.4); ctx.lineWidth = 3; ctx.stroke(); }
      text(ctx, String(o.n), 0, 2, { size: 30, weight: 900, align: 'center', base: 'middle', color: done ? '#b8b0a4' : '#1b1824' });
      ctx.restore();
    }
    for (const q of me.pop) { ctx.strokeStyle = `rgba(110,224,138,${1 - q.t / 0.4})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(q.x, q.y, R + q.t * 60, 0, Math.PI * 2); ctx.stroke(); }
    if (me.pen > 0) { ctx.fillStyle = `rgba(255,93,108,${me.pen * 0.4})`; ctx.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0); }
    ctx.restore();
    // next number hint
    ctx.fillStyle = 'rgba(14,12,19,0.85)'; ctx.fillRect(BX0, BY0, 170, 44);
    text(ctx, me.finishT != null ? '완료!' : `다음: ${me.next}`, BX0 + 14, BY0 + 31, { size: 24, weight: 900, color: me.finishT != null ? COL.good : COL.accent });
    // progress column
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i], y = 76 + i * 158, x = 905;
      ctx.fillStyle = shade(pl.color, -0.6); ctx.fillRect(x, y, 355, 146);
      ctx.fillStyle = pl.color; ctx.fillRect(x, y, 6, 146);
      game.drawPlayer(ctx, i, x + 62, y + 128, 92, { expr: p.finishT != null ? 'win' : p.pen > 0 ? 'lose' : 'idle', tag: true });
      text(ctx, pl.name, x + 130, y + 40, { size: 20, weight: 900, color: pl.color });
      text(ctx, p.finishT != null ? `${p.finishT.toFixed(1)}초 완료` : `${p.next - 1} / ${COUNT}`, x + 130, y + 80, { size: 28, weight: 900 });
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 130, y + 100, 205, 14);
      ctx.fillStyle = pl.color; ctx.fillRect(x + 130, y + 100, 205 * p.progress, 14);
    }
  },
};
