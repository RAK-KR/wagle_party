// 순서 기억 — watch the pads light up, then repeat the order. One mistake and you are out. The sequence grows every round.
import { W, H, COL, text, byDiff, clamp, shade, softBg, pcard, scard, nameText, hudPill, INK, rr, pastel } from './common.js';

const CX = W / 2, CY = 392, PS = 128, MAXR = 14;
const PADS = [
  { dx: 0, dy: -1, col: '#ffcf3a', key: '↑' }, { dx: 1, dy: 0, col: '#5ed0d6', key: '→' },
  { dx: 0, dy: 1, col: '#ff5d6c', key: '↓' }, { dx: -1, dy: 0, col: '#79c66b', key: '←' },
];
const padRect = (k) => ({ x: CX + PADS[k].dx * (PS + 14) - PS / 2, y: CY + PADS[k].dy * (PS + 14) - PS / 2, w: PS, h: PS });

export default {
  id: 'simon', name: '순서 기억', typeLabel: '기억 / 관찰', color: '#79c66b',
  rule: '불이 켜지는 순서를 기억했다가 똑같이 누르세요. 틀리면 탈락이고, 판마다 하나씩 길어집니다.',
  controls: [['입력', '방향키 / WASD / 칸 클릭']],
  touch: { stick: false, a: false },

  init(game, rng) {
    const seq = []; for (let k = 0; k < MAXR + 3; k++) seq.push(rng.int(0, 3));
    const st = { t: 0, seq, len: 3, phase: 'show', pt: 0, flash: -1, flashT: 0, pl: [0, 1, 2, 3].map(i => ({ i, alive: true, prog: 0, done: false, outRound: 0, lastPad: -1, padT: 0, plan: null, next: 0 })), endFlag: false, round: 1 };
    return st;
  },
  stepTime(st) { return Math.max(0.3, 0.6 - st.round * 0.025); },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    if (st.phase === 'show') {
      const per = this.stepTime(st), k = Math.floor((st.pt - 0.6) / per);
      if (st.pt > 0.6 && k < st.len) {
        const inStep = (st.pt - 0.6) - k * per;
        const f = inStep < per * 0.72 ? st.seq[k] : -1;
        if (f >= 0 && st.flash !== k) { st.flash = k; game.sfx('pad', null, st.seq[k]); }
        st.lit = f;
      } else st.lit = -1;
      if (st.pt > 0.6 + per * st.len + 0.2) {
        st.phase = 'input'; st.pt = 0; st.flash = -1;
        for (const p of st.pl) { p.prog = 0; p.done = false; p.plan = null; }
      }
      return;
    }
    if (st.phase === 'input') {
      const limit = 2.5 + st.len * 0.75;
      for (const p of st.pl) {
        if (!p.alive || p.done || ended) continue;
        const inp = inputs[p.i];
        let pad = inp.num ?? -1;
        if (inp.upP) pad = 0; if (inp.rightP) pad = 1; if (inp.downP) pad = 2; if (inp.leftP) pad = 3;
        if (inp.pP) for (let k = 0; k < 4; k++) { const r = padRect(k); if (inp.px >= r.x && inp.px <= r.x + r.w && inp.py >= r.y && inp.py <= r.y + r.h) pad = k; }
        if (pad < 0) continue;
        p.lastPad = pad; p.padT = st.t;
        if (pad === st.seq[p.prog]) { p.prog++; game.sfx('pad', p.i, pad); if (p.prog >= st.len) { p.done = true; game.sfx('good', p.i); } }
        else { p.alive = false; p.outRound = st.round; game.sfx('bad', p.i); game.sfx('miss', ~p.i); }
      }
      const waiting = st.pl.filter(p => p.alive && !p.done).length;
      if (waiting === 0 || st.pt > limit) {
        for (const p of st.pl) if (p.alive && !p.done) { p.alive = false; p.outRound = st.round; }
        st.phase = 'judge'; st.pt = 0;
      }
      return;
    }
    if (st.phase === 'judge' && st.pt > 1.3) {
      const alive = st.pl.filter(p => p.alive).length;
      if (alive <= 1 || st.round >= MAXR) { st.phase = 'end'; return; }
      st.round++; st.len++; st.phase = 'show'; st.pt = 0; st.flash = -1;
    }
  },
  done(st) { return st.phase === 'end'; },
  scores(st) { return st.pl.map(p => p.alive ? 10000 : p.outRound * 100 + p.prog); },
  detail(st, i) { const p = st.pl[i]; return p.alive ? '끝까지 생존' : `${p.outRound + 2}개 순서에서 탈락`; },
  hud(ctx, st) { hudPill(ctx, `${st.len}개 순서`, '#79c66b'); },

  bot(st, i, game, rng) {
    const p = st.pl[i];
    if (st.phase !== 'input' || !p.alive || p.done) return {};
    if (!p.plan) {
      const cap = byDiff(game, [5, 7, 9]) + rng.int(-1, 1);
      p.plan = st.seq.slice(0, st.len).map((v, k) => {
        const pErr = (k >= 2 ? 0.01 : 0) + Math.max(0, st.len - cap) * 0.09;
        return rng.next() < pErr ? (v + rng.int(1, 3)) % 4 : v;
      });
      p.next = st.pt + rng.range(0.5, 1.0);
    }
    if (st.pt >= p.next) { p.next = st.pt + rng.range(0.28, 0.55) + byDiff(game, [0.15, 0.06, 0]); return { num: p.plan[p.prog] }; }
    return {};
  },

  render(ctx, st, game) {
    softBg(ctx);
    const me = st.pl[game.local];
    for (let k = 0; k < 4; k++) {
      const r = padRect(k), pd = PADS[k];
      const litShow = st.phase === 'show' && st.lit === k;
      const litMe = st.phase === 'input' && me.lastPad === k && st.t - me.padT < 0.2;
      const lit = litShow || litMe;
      if (lit) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(ctx, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 30); ctx.fill(); ctx.restore(); }
      scard(ctx, r.x, r.y, r.w, r.h, { r: 24, fill: lit ? pd.col : pastel(pd.col, 0.6), lw: lit ? 5 : 3.5 });
      text(ctx, pd.key, r.x + r.w / 2, r.y + r.h / 2 + 4, { size: 50, title: true, align: 'center', base: 'middle', color: lit ? '#fff' : INK, stroke: lit ? INK : null, strokeW: 8, alpha: lit ? 1 : 0.55 });
    }
    // center status
    const msg = st.phase === 'show' ? '잘 보세요' : st.phase === 'input' ? (me.alive ? (me.done ? '완료!' : '따라 누르세요') : '탈락') : st.phase === 'judge' ? '다음 판' : '';
    scard(ctx, CX - PS / 2, CY - PS / 2, PS, PS, { r: 22, fill: '#fff' });
    text(ctx, msg, CX, CY + 2, { size: 21, title: true, align: 'center', base: 'middle', color: INK });
    if (st.phase === 'input' && me.alive && !me.done) text(ctx, `${me.prog} / ${st.len}`, CX, CY + 30, { size: 17, title: true, align: 'center', color: COL.soft });
    // players on both sides
    for (let i = 0; i < 4; i++) {
      const p = st.pl[i], pl = game.players[i];
      const x = i < 2 ? 40 : W - 300, y = 90 + (i % 2) * 300, w = 260, h = 270;
      pcard(ctx, game, i, x, y, w, h, { r: 30, alpha: p.alive ? 1 : 0.6 });
      game.drawPlayer(ctx, i, x + w / 2, y + 190, 120, { tag: true, expr: !p.alive ? 'lose' : p.done ? 'win' : 'idle', alpha: p.alive ? 1 : 0.55 });
      nameText(ctx, pl.name, x + w / 2, y + 224, 20);
      // progress dots (no colors, so the order is not revealed)
      if (st.phase === 'input' || st.phase === 'judge') {
        const n = st.len, dw = Math.min(16, (w - 30) / n);
        for (let k = 0; k < n; k++) { ctx.fillStyle = k < p.prog ? (p.alive ? COL.good : COL.bad) : 'rgba(255,255,255,0.75)'; rr(ctx, x + 15 + k * dw, y + 242, dw - 3, 12, 6); ctx.fill(); }
      }
      if (!p.alive) text(ctx, '탈락', x + w / 2, y + 60, { size: 34, title: true, align: 'center', color: COL.bad, stroke: INK, strokeW: 7 });
      else if (p.done && st.phase === 'input') text(ctx, '성공!', x + w / 2, y + 60, { size: 30, title: true, align: 'center', color: COL.good, stroke: INK, strokeW: 7 });
    }
  },
};
