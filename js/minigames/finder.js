// 같은 얼굴 찾기 — find the one tile that matches the target character AND face. First correct click scores.
import { ROSTER, drawCharacter } from '../characters.js';
import { W, H, COL, text, byDiff, clamp, shade } from './common.js';

const ROUNDS = 7, COLS = 8, ROWS = 4, TW = 132, TH = 112, GX = (W - COLS * TW) / 2, GY = 196, ROUND_LIMIT = 12;
const EXPRS = ['idle', 'win', 'lose'];
const EXPR_NAME = { idle: '보통 얼굴', win: '웃는 얼굴', lose: '우는 얼굴' };
const tileRect = (k) => ({ x: GX + (k % COLS) * TW, y: GY + Math.floor(k / COLS) * TH, w: TW, h: TH });

export default {
  id: 'finder', name: '같은 얼굴 찾기', typeLabel: '마우스 / 터치', color: '#f3a3c0',
  rule: '위에 나온 캐릭터와 표정이 똑같은 칸을 가장 먼저 클릭하세요. 틀리면 1초 동안 못 누릅니다.',
  controls: [['고르기', '마우스 클릭 / 화면 터치']],
  touch: { stick: false, a: false },

  init(game, rng) {
    const st = { t: 0, round: 0, phase: 'show', pt: 0, score: [0, 0, 0, 0], lock: [0, 0, 0, 0], wrong: [], winner: -1, tiles: [], target: null, cursors: [0, 1, 2, 3].map(i => ({ x: 200 + i * 300, y: 680 })), plan: [] };
    this.newRound(st, game, rng);
    return st;
  },
  newRound(st, game, rng) {
    const ids = ROSTER.map(r => r.id);
    const target = { id: rng.pick(ids), expr: rng.pick(EXPRS) };
    const tiles = [];
    const n = COLS * ROWS;
    for (let k = 0; k < n; k++) {
      let id, expr;
      do {
        const r = rng.next();
        if (r < 0.35) { id = target.id; expr = rng.pick(EXPRS); }            // same character, other face
        else if (r < 0.65) { id = rng.pick(ids); expr = target.expr; }       // same face, other character
        else { id = rng.pick(ids); expr = rng.pick(EXPRS); }
      } while (id === target.id && expr === target.expr);
      tiles.push({ id, expr, facing: rng.chance(0.5) ? 1 : -1, ph: rng.next() * 6 });
    }
    const ans = rng.int(0, n - 1);
    tiles[ans] = { id: target.id, expr: target.expr, facing: rng.chance(0.5) ? 1 : -1, ph: rng.next() * 6 };
    st.tiles = tiles; st.target = target; st.ans = ans; st.wrong = []; st.winner = -1;
    st.plan = [0, 1, 2, 3].map(() => {
      const base = byDiff(game, [5.2, 3.7, 2.4]), spread = byDiff(game, [1.8, 1.1, 0.6]);
      const mistake = rng.next() < byDiff(game, [0.3, 0.14, 0.04]);
      return { at: Math.max(0.9, base + rng.gauss() * spread), pick: mistake ? rng.int(0, n - 1) : ans, done: false };
    });
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    for (let i = 0; i < 4; i++) st.lock[i] = Math.max(0, st.lock[i] - dt);
    if (st.phase === 'show') { if (st.pt > 0.7) { st.phase = 'find'; st.pt = 0; } return; }
    if (st.phase === 'find') {
      const order = rng.shuffle([0, 1, 2, 3]);
      for (const i of order) {
        const inp = inputs[i];
        st.cursors[i].x = inp.px; st.cursors[i].y = inp.py;
        if (ended || !inp.pP || st.lock[i] > 0 || st.winner >= 0) continue;
        for (let k = 0; k < st.tiles.length; k++) {
          const r = tileRect(k);
          if (inp.px < r.x || inp.px > r.x + r.w || inp.py < r.y || inp.py > r.y + r.h) continue;
          if (k === st.ans) { st.winner = i; st.score[i]++; game.sfx('good', null); }
          else { st.lock[i] = 1.0; st.wrong.push({ k, i, t: st.t }); game.sfx('bad', i); }
          break;
        }
      }
      if (st.winner >= 0 || st.pt > ROUND_LIMIT) { st.phase = 'reveal'; st.pt = 0; if (st.winner < 0) game.sfx('miss', null); }
    } else if (st.phase === 'reveal') {
      if (st.pt > 1.5) {
        st.round++;
        if (st.round >= ROUNDS) st.phase = 'end';
        else { st.phase = 'show'; st.pt = 0; this.newRound(st, game, rng); }
      }
    }
  },
  done(st) { return st.phase === 'end'; },
  scores(st) { return st.score.slice(); },
  detail(st, i) { return `${st.score[i]}번 찾음`; },
  hud(ctx, st) { text(ctx, `${Math.min(st.round + 1, ROUNDS)} / ${ROUNDS}`, W / 2, 33, { size: 22, weight: 900, align: 'center', color: '#f3a3c0' }); },

  bot(st, i, game, rng) {
    const c = st.cursors[i], pl = st.plan[i];
    if (st.phase !== 'find' || !pl) return { px: c.x, py: c.y };
    if (st.pt < pl.at * 0.55) { c.x += (W / 2 - c.x) * 0.02; c.y += (440 - c.y) * 0.02; return { px: c.x, py: c.y }; }
    const r = tileRect(pl.pick), tx = r.x + r.w / 2, ty = r.y + r.h / 2;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), sp = byDiff(game, [9, 13, 18]);
    if (d > sp) { c.x += dx / d * sp; c.y += dy / d * sp; return { px: c.x, py: c.y }; }
    c.x = tx; c.y = ty;
    if (st.pt >= pl.at && st.lock[i] <= 0) {
      if (pl.pick !== st.ans) { pl.pick = st.ans; pl.at = st.pt + byDiff(game, [2.2, 1.4, 0.8]); }
      return { px: c.x, py: c.y, pP: true };
    }
    return { px: c.x, py: c.y };
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2440'); g.addColorStop(1, '#1a1220');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // target card
    ctx.fillStyle = '#fff4f8'; ctx.fillRect(W / 2 - 300, 56, 600, 128);
    ctx.fillStyle = '#f3a3c0'; ctx.fillRect(W / 2 - 300, 56, 600, 6);
    drawCharacter(ctx, st.target.id, W / 2 - 200, 172, 104, { t: st.t, expr: st.target.expr });
    const ch = ROSTER.find(r => r.id === st.target.id);
    text(ctx, '이 얼굴을 찾으세요', W / 2 - 110, 104, { size: 22, weight: 900, color: '#5a3a4a' });
    text(ctx, ch.name + '  ·  ' + EXPR_NAME[st.target.expr], W / 2 - 110, 150, { size: 32, title: true, color: shade(ch.color, -0.35) });
    // grid
    const flip = st.phase === 'show' ? clamp(st.pt / 0.5, 0, 1) : 1;
    for (let k = 0; k < st.tiles.length; k++) {
      const r = tileRect(k), tl = st.tiles[k];
      const isAns = k === st.ans, rev = st.phase === 'reveal';
      ctx.fillStyle = rev && isAns ? '#fff3a8' : (k + Math.floor(k / COLS)) % 2 ? '#2c2236' : '#33283f';
      ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      if (rev && !isAns) ctx.globalAlpha = 0.3;
      ctx.save(); ctx.translate(r.x + r.w / 2, 0); ctx.scale(flip, 1);
      drawCharacter(ctx, tl.id, 0, r.y + r.h - 12, 82, { t: st.t + tl.ph, expr: tl.expr, facing: tl.facing });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    for (const w of st.wrong) {
      const r = tileRect(w.k), k = clamp(1 - (st.t - w.t) / 1, 0, 1); if (k <= 0) continue;
      ctx.strokeStyle = `rgba(255,93,108,${k})`; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(r.x + 30, r.y + 25); ctx.lineTo(r.x + r.w - 30, r.y + r.h - 25); ctx.moveTo(r.x + r.w - 30, r.y + 25); ctx.lineTo(r.x + 30, r.y + r.h - 25); ctx.stroke();
    }
    if (st.phase === 'reveal') {
      const r = tileRect(st.ans);
      ctx.strokeStyle = st.winner >= 0 ? game.players[st.winner].color : '#fff'; ctx.lineWidth = 6; ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      text(ctx, st.winner >= 0 ? `${game.players[st.winner].name} 찾았다!` : '아무도 못 찾음', W / 2, 676, { size: 26, weight: 900, align: 'center', color: st.winner >= 0 ? game.players[st.winner].color : COL.sub, stroke: '#1b1824', strokeW: 6 });
    }
    // score strip (bottom) with small characters
    for (let i = 0; i < 4; i++) {
      const p = game.players[i], x = 16 + i * 80;
      game.drawPlayer(ctx, i, x + 28, 712, 34, { expr: st.phase === 'reveal' && st.winner === i ? 'win' : st.lock[i] > 0 ? 'lose' : 'idle' });
      text(ctx, String(st.score[i]), x + 56, 706, { size: 22, weight: 900, color: p.color });
    }
    // cursors
    for (let i = 0; i < 4; i++) {
      if (i === game.local && !game.auto) continue;
      const c = st.cursors[i], col = game.players[i].color;
      ctx.strokeStyle = '#1b1824'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, Math.PI * 2); ctx.stroke();
      if (st.lock[i] > 0) text(ctx, '×', c.x, c.y + 6, { size: 22, weight: 900, align: 'center', color: COL.bad });
    }
    if (st.lock[game.local] > 0 && !game.auto) text(ctx, '틀렸어요! 잠깐 기다리세요', W / 2, 676, { size: 22, weight: 900, align: 'center', color: COL.bad, stroke: '#1b1824', strokeW: 6 });
  },
};
