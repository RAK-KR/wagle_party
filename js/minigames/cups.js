// 컵 섞기 — a star hides under one cup; the cups shuffle. Pick the right cup. 5 rounds, getting faster.
import { sfx } from '../audio.js';
import { W, H, COL, text, byDiff, clamp, shade, star } from './common.js';

const ROUNDS = 5, TABLE_Y = 470, PICK = 7;
const cupX = (n, slot) => W / 2 + (slot - (n - 1) / 2) * (n === 3 ? 250 : 200);

export default {
  id: 'cups', name: '컵 섞기', typeLabel: '기억 / 관찰', color: '#e8473f',
  rule: '별이 들어간 컵을 눈으로 따라가세요. 섞기가 끝나면 별이 있는 컵을 고릅니다. 판마다 빨라집니다.',
  controls: [['컵 고르기', '← → / 컵 클릭'], ['결정', 'Space / 결정 버튼']],
  touch: { stick: false, a: false },

  init(game, rng) {
    const st = { t: 0, round: 0, score: [0, 0, 0, 0], sel: [0, 0, 0, 0], locked: [false, false, false, false], last: null };
    this.newRound(st, rng, game);
    return st;
  },
  newRound(st, rng, game) {
    const n = st.round < 2 ? 3 : 4;
    st.n = n; st.slot = [...Array(n).keys()];   // slot[cup] = position
    st.ball = rng.int(0, n - 1);
    st.swaps = []; const count = 4 + st.round * 2;
    for (let k = 0; k < count; k++) { let a = rng.int(0, n - 1), b = rng.int(0, n - 1); while (b === a) b = rng.int(0, n - 1); st.swaps.push([a, b]); }
    st.swapDur = clamp(0.55 - st.round * 0.07, 0.24, 0.55);
    st.phase = 'peek'; st.pt = 0; st.si = 0;
    st.sel = [0, 0, 0, 0].map(() => Math.floor(n / 2)); st.locked = [false, false, false, false];
    const pc = byDiff(game, [0.78, 0.88, 0.96]) - st.round * byDiff(game, [0.09, 0.06, 0.035]);
    st.plan = [0, 1, 2, 3].map(() => ({ ok: rng.next() < pc, at: rng.range(1.2, 3.5), wrong: rng.int(1, n - 1) }));
  },
  posOf(st, cup) { // animated x of a cup
    if (st.phase !== 'shuffle' || st.si >= st.swaps.length) return { x: cupX(st.n, st.slot[cup]), lift: 0 };
    const [a, b] = st.swaps[st.si], k = clamp(st.pt / st.swapDur, 0, 1), e = k * k * (3 - 2 * k);
    const ca = st.slot.indexOf(a), cb = st.slot.indexOf(b);
    if (cup === ca) return { x: cupX(st.n, a) + (cupX(st.n, b) - cupX(st.n, a)) * e, depth: -Math.sin(e * Math.PI) * 40 };
    if (cup === cb) return { x: cupX(st.n, b) + (cupX(st.n, a) - cupX(st.n, b)) * e, depth: Math.sin(e * Math.PI) * 40 };
    return { x: cupX(st.n, st.slot[cup]), depth: 0 };
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    if (st.phase === 'peek' && st.pt > 1.7) { st.phase = 'shuffle'; st.pt = 0; }
    else if (st.phase === 'shuffle') {
      if (st.pt >= st.swapDur) {
        const [a, b] = st.swaps[st.si];
        const ca = st.slot.indexOf(a), cb = st.slot.indexOf(b);
        st.slot[ca] = b; st.slot[cb] = a;
        st.si++; st.pt = 0; sfx.slide();
        if (st.si >= st.swaps.length) { st.phase = 'pick'; st.pt = 0; }
      }
    } else if (st.phase === 'pick') {
      for (let i = 0; i < 4; i++) {
        if (st.locked[i] || ended) continue;
        const inp = inputs[i];
        if (inp.num != null) st.sel[i] = inp.num;
        if (inp.leftP) st.sel[i] = (st.sel[i] + st.n - 1) % st.n;
        if (inp.rightP) st.sel[i] = (st.sel[i] + 1) % st.n;
        let lock = inp.aP;
        if (i === game.local && inp.pP) {
          for (let s = 0; s < st.n; s++) if (Math.abs(inp.px - cupX(st.n, s)) < 80 && inp.py > TABLE_Y - 200 && inp.py < TABLE_Y + 30) { if (st.sel[i] === s) lock = true; st.sel[i] = s; }
          if (inp.px > W / 2 - 120 && inp.px < W / 2 + 120 && inp.py > 600 && inp.py < 656) lock = true;
        }
        if ((inp.leftP || inp.rightP) && i === game.local) sfx.hover();
        if (lock) { st.locked[i] = true; if (i === game.local) sfx.lock(); }
      }
      if (st.locked.every(Boolean) || st.pt > PICK) {
        st.locked = [true, true, true, true];
        const ans = st.slot[st.ball];
        const ok = st.sel.map(s => s === ans);
        ok.forEach((v, i) => { if (v) st.score[i]++; });
        st.last = { ans, ok, sel: st.sel.slice() };
        st.phase = 'reveal'; st.pt = 0;
        setTimeout(() => (ok[game.local] ? sfx.good() : sfx.bad()), 300);
      }
    } else if (st.phase === 'reveal' && st.pt > 2.2) {
      st.round++;
      if (st.round >= ROUNDS) st.phase = 'end'; else this.newRound(st, rng, game);
    }
  },
  done(st) { return st.phase === 'end'; },
  scores(st) { return st.score.slice(); },
  detail(st, i) { return `${st.score[i]}번 맞힘`; },
  hud(ctx, st) { text(ctx, `${Math.min(st.round + 1, ROUNDS)} / ${ROUNDS}`, W / 2, 33, { size: 22, weight: 900, align: 'center', color: '#e8473f' }); },

  bot(st, i) {
    if (st.phase !== 'pick' || st.locked[i]) return {};
    const pl = st.plan[i];
    if (st.pt < pl.at) return {};
    const ans = st.slot[st.ball];
    return { num: pl.ok ? ans : (ans + pl.wrong) % st.n, a: true };
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a1f2a'); g.addColorStop(1, '#140c10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // spotlight + table
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(W / 2, 380, 20, W / 2, 380, 520); sg.addColorStop(0, 'rgba(255,220,180,0.18)'); sg.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.fillStyle = '#6b3a24'; ctx.beginPath(); ctx.ellipse(W / 2, TABLE_Y + 10, 560, 90, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6b44'; ctx.beginPath(); ctx.ellipse(W / 2, TABLE_Y, 540, 80, 0, 0, Math.PI * 2); ctx.fill();
    const reveal = st.phase === 'peek' || st.phase === 'reveal';
    const lift = st.phase === 'peek' ? Math.sin(clamp(st.pt / 1.7, 0, 1) * Math.PI) * 90 : st.phase === 'reveal' ? clamp(st.pt / 0.4, 0, 1) * 90 : 0;
    // cups sorted by depth (back first)
    const cups = [...Array(st.n).keys()].map(c => ({ c, ...this.posOf(st, c) })).sort((a, b) => (a.depth || 0) - (b.depth || 0));
    for (const cu of cups) {
      const isBall = cu.c === st.ball;
      const y = TABLE_Y + (cu.depth || 0) * 0.3;
      if (isBall && reveal) star(ctx, cu.x, y - 22, 22 + Math.sin(st.t * 6) * 2);
      const up = reveal && (st.phase === 'peek' ? isBall : true) ? lift : 0;
      drawCup(ctx, cu.x, y - up, 1 + (cu.depth || 0) * 0.002);
    }
    // selections
    if (st.phase === 'pick' || st.phase === 'reveal') {
      for (let i = 0; i < 4; i++) {
        const me = i === game.local && !game.auto;
        if (!me && st.phase !== 'reveal') continue;
        const s = st.phase === 'reveal' ? st.last.sel[i] : st.sel[i];
        const sameBefore = [0, 1, 2, 3].slice(0, i).filter(j => (st.phase === 'reveal' ? st.last.sel[j] : st.sel[j]) === s && (st.phase === 'reveal' || j === game.local)).length;
        const x = cupX(st.n, s) + (sameBefore - 1.5) * 36 + (st.phase === 'pick' ? 54 : 0), y = TABLE_Y - 200 - (st.phase === 'reveal' ? lift : 0);
        game.drawPlayer(ctx, i, x, y, 46, { expr: st.phase === 'reveal' ? (st.last.ok[i] ? 'win' : 'lose') : 'idle' });
        if (me && st.phase === 'pick') { ctx.fillStyle = game.players[i].color; ctx.beginPath(); ctx.moveTo(cupX(st.n, s) - 16, TABLE_Y - 150); ctx.lineTo(cupX(st.n, s) + 16, TABLE_Y - 150); ctx.lineTo(cupX(st.n, s), TABLE_Y - 128 + Math.sin(st.t * 8) * 4); ctx.closePath(); ctx.fill(); }
      }
    }
    // bottom player strip
    for (let i = 0; i < 4; i++) {
      const p = game.players[i], x = 90 + i * 290;
      ctx.fillStyle = shade(p.color, -0.6); ctx.fillRect(x, 640, 230, 70);
      ctx.fillStyle = p.color; ctx.fillRect(x, 640, 5, 70);
      game.drawPlayer(ctx, i, x + 44, 704, 52, { tag: true, expr: st.phase === 'reveal' ? (st.last.ok[i] ? 'win' : 'lose') : 'idle' });
      text(ctx, p.name, x + 90, 668, { size: 16, weight: 900, color: p.color });
      text(ctx, st.phase === 'pick' ? (st.locked[i] ? '결정!' : '고르는 중') : `${st.score[i]}점`, x + 90, 698, { size: 18, weight: 900, color: st.phase === 'pick' && st.locked[i] ? COL.accent : COL.text });
    }
    if (st.phase === 'pick' && !st.locked[game.local] && !game.auto) {
      ctx.fillStyle = COL.accent; ctx.fillRect(W / 2 - 120, 584, 240, 46);
      text(ctx, `결정 (Space)  ${Math.max(0, PICK - st.pt).toFixed(0)}`, W / 2, 615, { size: 20, weight: 900, align: 'center', color: '#1b1824' });
    }
    text(ctx, st.phase === 'peek' ? '별이 어디 있는지 보세요' : st.phase === 'shuffle' ? '섞는 중...' : st.phase === 'pick' ? '별은 어느 컵에?' : '', W / 2, 110, { size: 34, title: true, align: 'center', color: '#ffe2c4' });
  },
};

function drawCup(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 70, 14, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, '#a8262a'); g.addColorStop(0.35, '#ff5d5d'); g.addColorStop(1, '#8a1c20');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-64, 0); ctx.lineTo(-44, -150); ctx.lineTo(44, -150); ctx.lineTo(64, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe2c4'; ctx.beginPath(); ctx.moveTo(-58, -36); ctx.lineTo(58, -36); ctx.lineTo(60, -22); ctx.lineTo(-60, -22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a161a'; ctx.beginPath(); ctx.ellipse(0, -150, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.ellipse(0, 0, 64, 9, 0, 0, Math.PI); ctx.fill();
  ctx.restore();
}
