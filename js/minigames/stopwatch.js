// 딱 맞춰 멈춰 — the timer disappears after a moment. Stop it as close to the target as you can. 3 rounds.
import { W, H, COL } from '../config.js';
import { shade } from '../characters.js';
import { text } from '../ui.js';

const ROUNDS = 3, SHOW = 1.6, VISIBLE = 1.4, REVEAL = 3.0, OVER = 4;

export default {
  id: 'stopwatch', name: '딱 맞춰 멈춰', typeLabel: '타이밍', color: '#ffcf3a',
  rule: '시계는 금방 사라집니다. 속으로 세다가 목표 시간에 최대한 가깝게 멈추세요. 3번 합니다.',
  controls: [['멈추기', 'Space / 클릭 / STOP 버튼']],
  touch: { stick: false, a: true, aLabel: 'STOP' },
  music: 'tense',

  init(game, rng) {
    const pool = [3.5, 4.2, 5.0, 5.7, 6.3, 7.0, 7.7, 8.4];
    const targets = rng.shuffle(pool).slice(0, ROUNDS).sort((a, b) => a - b);
    return { t: 0, round: 0, phase: 'show', pt: 0, targets, stops: [null, null, null, null], err: [0, 0, 0, 0], history: [], botStop: [0, 0, 0, 0], needBot: true };
  },
  newBotTimes(st, game, rng) {
    // human-like: error grows with the target time, plus a personal habit of stopping early or late
    const sd = [0.95, 0.6, 0.35][Math.round(game.diff.k * 3) - 1] ?? 0.6;
    const T = st.targets[st.round];
    if (!st.habit) st.habit = [0, 1, 2, 3].map(() => rng.gauss() * sd * 0.5);
    st.botStop = [0, 1, 2, 3].map(i => Math.max(0.8, T + st.habit[i] + rng.gauss() * sd * (0.6 + T / 10)));
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    if (st.phase === 'show') {
      if (st.needBot) { st.needBot = false; this.newBotTimes(st, game, rng); }
      if (st.pt >= SHOW) { st.phase = 'run'; st.pt = 0; game.sfx('tick', null); }
    } else if (st.phase === 'run') {
      for (let i = 0; i < 4; i++) {
        if (st.stops[i] == null && (inputs[i].aP || inputs[i].pP) && !ended) {
          st.stops[i] = st.pt; game.sfx('stop', i);
        }
      }
      const T = st.targets[st.round];
      if (st.stops.every(s => s != null) || st.pt > T + OVER) {
        for (let i = 0; i < 4; i++) if (st.stops[i] == null) st.stops[i] = T + OVER;
        st.phase = 'reveal'; st.pt = 0; game.sfx('whoosh', null);
        const e = st.stops.map(s => Math.abs(s - T));
        st.history.push({ T, stops: st.stops.slice(), e });
        for (let i = 0; i < 4; i++) st.err[i] += e[i];
        const best = Math.min(...e);
        for (let j = 0; j < 4; j++) game.sfx(e[j] === best ? 'good' : 'bad', j, undefined, 0.4);
      }
    } else if (st.phase === 'reveal') {
      if (st.pt >= REVEAL) {
        st.round++;
        if (st.round >= ROUNDS) st.phase = 'end';
        else { st.phase = 'show'; st.pt = 0; st.stops = [null, null, null, null]; st.needBot = true; }
      }
    }
  },
  done(st) { return st.phase === 'end'; },
  scores(st) { return st.err.map(e => -Math.round(e * 100) / 100); },
  detail(st, i) { return `총 오차 ${st.err[i].toFixed(2)}초`; },

  bot(st, i) {
    if (st.phase !== 'run' || st.stops[i] != null) return {};
    return { a: st.pt >= st.botStop[i] };
  },
  hud(ctx, st) {
    text(ctx, `${Math.min(st.round + 1, ROUNDS)} / ${ROUNDS}번째`, W / 2, 33, { size: 22, weight: 900, align: 'center', color: COL.accent });
  },

  render(ctx, st, game) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b2340'); g.addColorStop(1, '#16121f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const T = st.targets[Math.min(st.round, ROUNDS - 1)];
    // target banner
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(W / 2 - 230, 60, 460, 86);
    text(ctx, '목표', W / 2 - 190, 116, { size: 24, weight: 900, color: COL.sub });
    text(ctx, T.toFixed(2) + '초', W / 2 + 40, 124, { size: 64, title: true, align: 'center', color: COL.accent });
    const hist = st.history[st.history.length - 1];
    for (let i = 0; i < 4; i++) {
      const x = 20 + (i % 2) * 630, y = 162 + Math.floor(i / 2) * 272, w = 610, h = 256;
      const p = game.players[i];
      ctx.fillStyle = shade(p.color, -0.62); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = p.color; ctx.fillRect(x, y, 8, h);
      let expr = 'idle';
      const revealing = st.phase === 'reveal' && hist;
      if (revealing) { const best = Math.min(...hist.e), worst = Math.max(...hist.e); expr = hist.e[i] === best ? 'win' : hist.e[i] === worst ? 'lose' : 'idle'; }
      game.drawPlayer(ctx, i, x + 110, y + 210, 140, { expr, tag: true });
      text(ctx, p.name, x + 110, y + 242, { size: 18, weight: 900, align: 'center', color: p.color });
      // display
      const dx = x + 230, dy = y + 40, dw = 350, dh = 120;
      ctx.fillStyle = '#0d0b12'; ctx.fillRect(dx, dy, dw, dh);
      ctx.strokeStyle = shade(p.color, -0.2); ctx.lineWidth = 4; ctx.strokeRect(dx + 2, dy + 2, dw - 4, dh - 4);
      let shown, col = '#9cf2b0', alpha = 1;
      if (st.phase === 'show') shown = '0.00';
      else if (st.phase === 'run') {
        if (st.stops[i] != null) { shown = '멈춤!'; col = COL.accent; }
        else { shown = st.pt.toFixed(2); alpha = Math.max(0, 1 - Math.max(0, st.pt - VISIBLE) / 0.4); if (alpha === 0) { shown = '??.??'; alpha = 1; col = '#4a6a55'; } }
      } else if (revealing) {
        const k = Math.min(1, st.pt / 0.7);
        shown = (hist.stops[i] * k).toFixed(2); col = '#9cf2b0';
      } else shown = '-';
      text(ctx, shown, dx + dw / 2, dy + 84, { size: 66, weight: 900, align: 'center', color: col, alpha });
      if (revealing && st.pt > 0.7) {
        const diff = hist.stops[i] - hist.T;
        const best = Math.min(...hist.e);
        text(ctx, (diff >= 0 ? '+' : '') + diff.toFixed(2) + '초', dx + dw / 2, dy + 160, { size: 34, weight: 900, align: 'center', color: hist.e[i] === best ? COL.good : Math.abs(diff) > 1 ? COL.bad : COL.text });
        if (hist.e[i] === best) text(ctx, '가장 가까움!', dx + dw / 2, dy + 200, { size: 18, weight: 900, align: 'center', color: COL.good });
      } else if (st.phase === 'run' && st.stops[i] == null && st.pt > VISIBLE + 0.4) {
        text(ctx, '세는 중...', dx + dw / 2, dy + 165, { size: 20, weight: 700, align: 'center', color: COL.dim });
      }
      text(ctx, `누적 오차 ${st.err[i].toFixed(2)}`, x + w - 16, y + 30, { size: 15, weight: 800, align: 'right', color: COL.sub });
    }
  },
};
