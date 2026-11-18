// 몇 번 지나갔지? — count how many times one character ran past in the parade. 3 questions.
import { W, H, COL } from '../config.js';
import { ROSTER, drawCharacter, shade } from '../characters.js';
import { text, inRect } from '../ui.js';

const QN = 3, ASK = 9, REVEAL = 3.4, LANES = [318, 372, 430];
const PANEL_Y = 474;

function josa(name) { const c = name.charCodeAt(name.length - 1) - 0xAC00; return (c >= 0 && c % 28) ? '은' : '는'; }
function panelRect(i) { return { x: 14 + i * 316, y: PANEL_Y, w: 304, h: 232 }; }
function btns(i) {
  const r = panelRect(i);
  return { up: { x: r.x + 204, y: r.y + 34, w: 84, h: 52 }, down: { x: r.x + 204, y: r.y + 92, w: 84, h: 52 }, ok: { x: r.x + 124, y: r.y + 166, w: 164, h: 52 } };
}

export default {
  id: 'parade', name: '몇 번 지나갔지?', typeLabel: '기억 / 관찰', color: '#b59cff',
  rule: '시작 전에 셀 캐릭터를 알려 줍니다. 그 캐릭터가 몇 번 지나가는지 세어서 맞히세요. 3문제입니다.',
  controls: [['숫자 바꾸기', '↑ ↓ 방향키 / 버튼 클릭'], ['결정', 'Space / 결정 버튼']],
  touch: { stick: false, a: false },

  init(game, rng) {
    const st = { t: 0, q: 0, phase: 'show', pt: 0, runners: [], target: null, count: 0, vals: [5, 5, 5, 5], locked: [false, false, false, false], pts: [0, 0, 0, 0], err: [0, 0, 0, 0], botPlan: [], last: null, flash: [0, 0, 0, 0] };
    this.makeParade(st, rng);
    return st;
  },
  makeParade(st, rng) {
    const ids = ROSTER.map(r => r.id);
    const target = rng.pick(ids);
    const q = st.q;
    const n = [rng.int(3, 5), rng.int(4, 6), rng.int(5, 7)][q];
    const others = Math.round(n * (0.9 + q * 0.25));
    const list = [];
    for (let k = 0; k < n; k++) list.push(target);
    const rest = ids.filter(id => id !== target);
    for (let k = 0; k < others; k++) list.push(rng.pick(rest));
    const order = rng.shuffle(list);
    const span = 6.5 + q * 0.6;
    let tt = 0;
    st.runners = order.map((id, k) => {
      // at least 0.3s between runners so two never arrive on top of each other
      tt += Math.max(0.3, (span / order.length) * (0.55 + rng.next() * 0.9) * (rng.next() < 0.08 + q * 0.06 ? 0.45 : 1));
      return { id, t0: tt, speed: 250 + rng.next() * 90 + q * 30, dir: 1, lane: rng.int(0, 2), ph: rng.next() * 6, size: 70 + rng.next() * 10 };
    });
    st.target = target; st.count = n;
    st.paradeLen = Math.max(...st.runners.map(r => r.t0 + (W + 200) / r.speed)) + 0.4;
  },
  update(st, dt, inputs, game, rng, ended) {
    st.t += dt; st.pt += dt;
    for (let i = 0; i < 4; i++) st.flash[i] = Math.max(0, st.flash[i] - dt);
    if (st.phase === 'show') { if (st.pt >= 2.4) { st.phase = 'parade'; st.pt = 0; game.sfx('go', null); } return; }
    if (st.phase === 'parade') {
      if (st.pt >= st.paradeLen) {
        st.phase = 'ask'; st.pt = 0; st.vals = [5, 5, 5, 5]; st.locked = [false, false, false, false]; game.sfx('go', null);
        const sd = [1.0, 0.6, 0.3][Math.round(game.diff.k * 3) - 1] ?? 0.6;
        st.botPlan = [0, 1, 2, 3].map(() => ({ v: Math.max(0, st.count + Math.round(rng.gauss() * sd)), at: 1.6 + rng.next() * 4 }));
      }
    } else if (st.phase === 'ask') {
      for (let i = 0; i < 4; i++) {
        if (st.locked[i] || ended) continue;
        const inp = inputs[i];
        if (inp.num != null) st.vals[i] = inp.num;
        let d = 0;
        if (inp.upP || inp.rightP) d = 1;
        if (inp.downP || inp.leftP) d = -1;
        let lock = inp.aP;
        if (inp.pP) {
          const b = btns(i);
          if (inRect(b.up, inp.px, inp.py)) d = 1;
          if (inRect(b.down, inp.px, inp.py)) d = -1;
          if (inRect(b.ok, inp.px, inp.py)) lock = true;
        }
        if (d) { st.vals[i] = Math.max(0, Math.min(20, st.vals[i] + d)); game.sfx('hover', i); }
        if (lock) { st.locked[i] = true; st.flash[i] = 0.3; game.sfx('lock', null); }
      }
      if (st.locked.every(Boolean) || st.pt >= ASK) {
        st.locked = [true, true, true, true];
        st.phase = 'reveal'; st.pt = 0; game.sfx('whoosh', null);
        const e = st.vals.map(v => Math.abs(v - st.count));
        const gain = e.map(x => x === 0 ? 3 : x === 1 ? 1 : 0);
        for (let i = 0; i < 4; i++) { st.pts[i] += gain[i]; st.err[i] += e[i]; }
        st.last = { e, gain, count: st.count, vals: st.vals.slice(), target: st.target };
        for (let j = 0; j < 4; j++) game.sfx(gain[j] ? 'good' : 'bad', j, undefined, 0.5);
      }
    } else if (st.phase === 'reveal') {
      if (st.pt >= REVEAL) {
        st.q++;
        if (st.q >= QN) st.phase = 'end';
        else { st.phase = 'show'; st.pt = 0; this.makeParade(st, rng); }
      }
    }
  },
  done(st) { return st.phase === 'end'; },
  scores(st) { return st.pts.map((p, i) => p * 100 - st.err[i]); },
  detail(st, i) { return `${st.pts[i]}점 · 오차 ${st.err[i]}`; },

  bot(st, i) {
    if (st.phase !== 'ask' || st.locked[i]) return {};
    const plan = st.botPlan[i];
    // walk the number toward the planned answer, then lock
    const cur = st.vals[i];
    const step = Math.floor(st.pt * 6) % 2 === 0;
    if (cur !== plan.v && st.pt > 0.6) return { num: step ? cur + Math.sign(plan.v - cur) : cur };
    return { num: plan.v, a: st.pt > plan.at };
  },
  hud(ctx, st) {
    text(ctx, `문제 ${Math.min(st.q + 1, QN)} / ${QN}`, W / 2, 33, { size: 22, weight: 900, align: 'center', color: '#b59cff' });
  },

  render(ctx, st, game) {
    // fairground background
    const g = ctx.createLinearGradient(0, 0, 0, PANEL_Y);
    g.addColorStop(0, '#ffb98a'); g.addColorStop(1, '#ffe2b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, PANEL_Y);
    for (let k = 0; k < 7; k++) { // tents
      const x = 40 + k * 190, y = 250, w = 130, h = 70 + (k % 3) * 18;
      ctx.fillStyle = k % 2 ? '#e8473f' : '#4c6fc4';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let s = 0; s < 3; s++) { ctx.beginPath(); ctx.moveTo(x + w / 2, y - h); ctx.lineTo(x + w * (0.12 + s * 0.3), y); ctx.lineTo(x + w * (0.22 + s * 0.3), y); ctx.closePath(); ctx.fill(); }
    }
    // bunting
    ctx.strokeStyle = '#6b4f3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 70); ctx.quadraticCurveTo(W / 2, 120, W, 70); ctx.stroke();
    for (let k = 0; k < 24; k++) {
      const x = k * (W / 23), y = 70 + Math.sin(k / 23 * Math.PI) * 25;
      ctx.fillStyle = ['#ffcf3a', '#e8473f', '#5ed0d6', '#79c66b'][k % 4];
      ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 26); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#8fcf6a'; ctx.fillRect(0, 250, W, PANEL_Y - 250);
    ctx.fillStyle = '#d9b37a'; ctx.fillRect(0, 286, W, 170);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 3; k++) ctx.fillRect(0, 300 + k * 56, W, 3);

    if (st.phase === 'parade') {
      const list = st.runners.slice().sort((a, b) => a.lane - b.lane);
      for (const r of list) {
        const e = st.pt - r.t0; if (e < 0) continue;
        const x = r.dir > 0 ? -100 + e * r.speed : W + 100 - e * r.speed;
        if (x < -120 || x > W + 120) continue;
        const hop = Math.abs(Math.sin(e * 9 + r.ph)) * 16;
        drawCharacter(ctx, r.id, x, LANES[r.lane] + 20 - hop, r.size * (0.86 + r.lane * 0.09), { t: st.t + r.ph, facing: r.dir, noShadow: hop > 4 });
      }
      const tc = ROSTER.find(r => r.id === st.target);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(W / 2 - 170, 130, 340, 70);
      drawCharacter(ctx, tc.id, W / 2 - 120, 194, 58, { t: st.t });
      text(ctx, tc.name + josa(tc.name) + ' 세는 중', W / 2 - 80, 175, { size: 26, title: true, color: shade(tc.color, -0.35) });
    } else if (st.phase === 'show') {
      const tc = ROSTER.find(r => r.id === st.target);
      ctx.fillStyle = 'rgba(27,24,36,0.85)'; ctx.fillRect(W / 2 - 360, 150, 720, 290);
      drawCharacter(ctx, tc.id, W / 2 - 240, 410, 170, { t: st.t, expr: 'win' });
      text(ctx, '이번에 셀 캐릭터', W / 2 - 100, 220, { size: 24, weight: 900, color: COL.sub });
      text(ctx, tc.name, W / 2 - 100, 290, { size: 62, title: true, color: tc.color });
      text(ctx, '몇 번 지나가는지 세어 보세요', W / 2 - 100, 345, { size: 24, weight: 800 });
    } else {
      const ch = ROSTER.find(r => r.id === (st.phase === 'reveal' && st.last ? st.last.target : st.target));
      ctx.fillStyle = 'rgba(27,24,36,0.85)'; ctx.fillRect(W / 2 - 360, 150, 720, 290);
      drawCharacter(ctx, ch.id, W / 2 - 240, 410, 170, { t: st.t, expr: 'idle' });
      text(ctx, ch.name + josa(ch.name), W / 2 - 100, 230, { size: 46, title: true, color: ch.color });
      text(ctx, '몇 번 지나갔을까요?', W / 2 - 100, 290, { size: 36, title: true });
      if (st.phase === 'ask') {
        const left = Math.max(0, ASK - st.pt);
        text(ctx, `남은 시간 ${left.toFixed(1)}초`, W / 2 - 100, 344, { size: 20, weight: 800, color: left < 3 ? COL.bad : COL.sub });
      } else if (st.last) {
        const k = Math.min(1, st.pt / 0.5);
        text(ctx, '정답  ' + st.last.count + '번', W / 2 - 100, 400, { size: 52, title: true, color: COL.accent, alpha: k });
      }
    }
    // answer panels
    ctx.fillStyle = '#2a2236'; ctx.fillRect(0, PANEL_Y - 6, W, H - PANEL_Y + 6);
    for (let i = 0; i < 4; i++) {
      const r = panelRect(i), p = game.players[i], me = i === game.local;
      ctx.fillStyle = shade(p.color, -0.6); ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = p.color; ctx.fillRect(r.x, r.y, r.w, 5);
      let expr = 'idle';
      if (st.phase === 'reveal' && st.last) expr = st.last.e[i] === 0 ? 'win' : st.last.e[i] >= 3 ? 'lose' : 'idle';
      game.drawPlayer(ctx, i, r.x + 60, r.y + 200, 88, { expr, tag: true });
      text(ctx, p.name, r.x + 60, r.y + 224, { size: 15, weight: 900, align: 'center', color: p.color });
      text(ctx, `${st.pts[i]}점`, r.x + 16, r.y + 30, { size: 17, weight: 900, color: COL.sub });
      let numStr = '', ncol = COL.text;
      if (st.phase === 'ask') {
        if (me && !game.auto) numStr = String(st.vals[i]);
        else numStr = st.locked[i] ? '결정!' : '...';
        if (st.locked[i] && me) ncol = COL.accent;
      } else if (st.phase === 'reveal' && st.last) {
        numStr = String(st.last.vals[i]);
        ncol = st.last.e[i] === 0 ? COL.good : st.last.e[i] === 1 ? COL.accent : COL.bad;
      }
      const flash = st.flash[i] > 0 ? 1 + st.flash[i] : 1;
      ctx.save(); ctx.translate(r.x + 158, r.y + 112); ctx.scale(flash, flash);
      text(ctx, numStr, 0, 0, { size: numStr.length > 2 ? 30 : 68, title: true, align: 'center', base: 'middle', color: ncol });
      ctx.restore();
      if (st.phase === 'reveal' && st.last && st.pt > 0.5) {
        const gn = st.last.gain[i];
        text(ctx, gn ? `+${gn}` : '+0', r.x + 270, r.y + 30, { size: 22, weight: 900, align: 'center', color: gn ? COL.good : COL.dim });
      }
      if (me && !game.auto && st.phase === 'ask' && !st.locked[i]) {
        const b = btns(i);
        for (const [key, lab] of [['up', '▲'], ['down', '▼']]) {
          ctx.fillStyle = '#3b3548'; ctx.fillRect(b[key].x, b[key].y, b[key].w, b[key].h);
          text(ctx, lab, b[key].x + b[key].w / 2, b[key].y + b[key].h / 2 + 2, { size: 24, weight: 900, align: 'center', base: 'middle' });
        }
        ctx.fillStyle = COL.accent; ctx.fillRect(b.ok.x, b.ok.y, b.ok.w, b.ok.h);
        text(ctx, '결정', b.ok.x + b.ok.w / 2, b.ok.y + b.ok.h / 2 + 2, { size: 22, weight: 900, align: 'center', base: 'middle', color: '#1b1824' });
      } else if (st.phase === 'parade' || st.phase === 'show') {
        text(ctx, '세는 중', r.x + 158, r.y + 120, { size: 22, weight: 800, align: 'center', color: COL.dim });
      }
    }
  },
};
