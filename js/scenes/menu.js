// Title, character select, practice list
import { W, H, COL, TITLE, TITLE_KO, ROUND_OPTIONS, DIFFS, FONT, VERSION } from '../config.js';
import { ROSTER, drawCharacter, shade } from '../characters.js';
import { text, button, bgFill, stripes, inRect, easeOutBack, card, measure } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { setTouchLayout } from '../input.js';
import { MINIGAMES } from '../minigames/index.js';
import { makeRng } from '../rng.js';
import { EMOTES } from '../emotes.js';

let selectedChar = 'punch';
let roomLinkUsed = false;
try { selectedChar = localStorage.getItem('wagle.char') || 'punch'; } catch (e) { }

export function titleScene(game) {
  let focus = 0, t0 = 0, nextEmote = 2;
  const items = [
    { label: '시작하기', sub: '봇 3명과 대결', go: () => game.go('select', { mode: 'match' }) },
    { label: '미니게임 연습', sub: '하나만 골라서 해 보기', go: () => game.go('select', { mode: 'practice' }) },
    { label: '온라인 대전', sub: '친구와 방 코드로 대결', go: () => game.go('online') },
  ];
  const fakePlayers = ROSTER.map(r => ({ char: r.id, color: r.color, name: r.name }));
  return {
    enter() {
      t0 = game.t; setTouchLayout({ stick: false, a: false }); playMusic('menu'); game.players = fakePlayers; game.emotes.reset(); game.local = 0;
      if (!roomLinkUsed && new URLSearchParams(location.search).get('room')) { roomLinkUsed = true; game.go('online'); }
    },
    update(dt, inp) {
      if (inp.upP) { focus = (focus + items.length - 1) % items.length; if (items[focus].disabled) focus = (focus + items.length - 1) % items.length; sfx.hover(); }
      if (inp.downP) { focus = (focus + 1) % items.length; if (items[focus].disabled) focus = (focus + 1) % items.length; sfx.hover(); }
      if (inp.aP && !items[focus].disabled) { sfx.click(); items[focus].go(); }
      if (game.auto && game.t - t0 > 0.5) items[0].go();
      if (game.t > nextEmote) { // characters chatter on the title screen
        nextEmote = game.t + 1.8 + Math.random() * 2.5;
        game.emotes.trigger(Math.floor(Math.random() * 4), EMOTES[Math.floor(Math.random() * EMOTES.length)].k);
      }
    },
    render(ctx, inp) {
      const t = game.t - t0;
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      // logo
      const k = Math.min(1, t / 0.6), s = easeOutBack(k);
      ctx.save(); ctx.translate(W / 2, 140); ctx.scale(s, s);
      const letters = [...TITLE_KO], LC = ['#ffd23f', '#ff8fb1', '#7ee0ff', '#ffd23f', '#9ef08a', '#ff8fb1', '#7ee0ff'];
      const widths = letters.map(ch => ch === ' ' ? 34 : measure(ctx, ch, 112, 400, true));
      let lx = -widths.reduce((a, b) => a + b, 0) / 2;
      letters.forEach((ch, k) => {
        const w = widths[k]; if (ch === ' ') { lx += w; return; }
        const hop = Math.abs(Math.sin(game.t * 2.6 - k * 0.45)) * 12, rot = Math.sin(game.t * 2.6 - k * 0.45) * 0.06;
        ctx.save(); ctx.translate(lx + w / 2, -hop); ctx.rotate(rot);
        text(ctx, ch, 0, 8, { size: 112, title: true, align: 'center', base: 'middle', color: 'rgba(67,56,110,0.22)' });
        text(ctx, ch, 0, 0, { size: 112, title: true, align: 'center', base: 'middle', color: LC[k % LC.length], stroke: COL.ink, strokeW: 14 });
        ctx.restore(); lx += w;
      });
      text(ctx, TITLE, 0, 84, { size: 30, title: true, align: 'center', base: 'middle', color: '#fff', stroke: COL.ink, strokeW: 8 });
      ctx.restore();
      // stage + characters (first four can emote)
      // round grassy hill the characters stand on
      ctx.fillStyle = '#9edcb4'; ctx.beginPath(); ctx.ellipse(W / 2, 760, 900, 230, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bdeccd'; ctx.beginPath(); ctx.ellipse(W / 2, 770, 860, 210, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.ellipse(W / 2, 760, 900, 230, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      const xs = [150, 310, 470, 810, 970, 1130];
      ROSTER.forEach((r, i) => {
        const bounce = Math.abs(Math.sin(game.t * 2.2 + i * 0.9)) * 10;
        if (i < 4) game.drawPlayer(ctx, i, xs[i], 600 - bounce, 118, { facing: xs[i] > W / 2 ? -1 : 1 });
        else drawCharacter(ctx, r.id, xs[i], 600 - bounce, 118, { t: game.t + i, facing: -1 });
      });
      // menu
      items.forEach((it, i) => {
        const r = { x: W / 2 - 170, y: 270 + i * 82, w: 340, h: 68 };
        if (button(ctx, inp, r, it.label, { primary: i === 0, focus: focus === i, disabled: it.disabled, size: 26, sub: null })) { sfx.click(); it.go?.(); }
        text(ctx, it.sub, r.x + r.w + 18, r.y + r.h / 2 + 6, { size: 17, title: true, color: '#fff', stroke: COL.ink, strokeW: 5 });
      });
      text(ctx, '방향키/마우스로 고르기 · Space 결정 · G 감정 표현 · M 소리', W / 2, H - 22, { size: 16, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 5 });
      text(ctx, 'v' + VERSION, W - 16, H - 14, { size: 14, weight: 800, align: 'right', color: COL.soft });
    },
  };
}

export function selectScene(game) {
  let mode = 'match', idx = 0, t0 = 0, roundsI = 1, diffI = 1, chosenT = -1;
  try { roundsI = Number(localStorage.getItem('wagle.rounds') ?? 1); diffI = Number(localStorage.getItem('wagle.diff') ?? 1); } catch (e) { }
  function start() {
    const ch = ROSTER[idx].id;
    selectedChar = ch;
    try { localStorage.setItem('wagle.char', ch); localStorage.setItem('wagle.rounds', roundsI); localStorage.setItem('wagle.diff', diffI); } catch (e) { }
    const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
    game.setPlayers(ch, rng.shuffle);
    game.diff = DIFFS[diffI];
    game.rounds = ROUND_OPTIONS[roundsI];
    sfx.go();
    if (mode === 'practice') game.go('practice');
    else game.go('matchStart', { rounds: game.rounds });
  }
  return {
    enter(args) {
      mode = args?.mode || 'match'; t0 = game.t; chosenT = -1;
      idx = Math.max(0, ROSTER.findIndex(r => r.id === selectedChar));
      game.players = [{ char: ROSTER[idx].id, color: ROSTER[idx].color, name: '나' }];
      setTouchLayout({ stick: false, a: false });
    },
    update(dt, inp) {
      if (inp.leftP) { idx = (idx + ROSTER.length - 1) % ROSTER.length; sfx.hover(); chosenT = game.t; }
      if (inp.rightP) { idx = (idx + 1) % ROSTER.length; sfx.hover(); chosenT = game.t; }
      if (inp.escP) game.go('title');
      game.players[0] = { char: ROSTER[idx].id, color: ROSTER[idx].color, name: '나' };
      if (inp.aP) start();
      if (game.auto && game.t - t0 > 0.4) start();
    },
    render(ctx, inp) {
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      text(ctx, mode === 'practice' ? '연습할 캐릭터 고르기' : '캐릭터 선택', 60, 74, { size: 48, title: true, stroke: COL.ink, strokeW: 9 });
      text(ctx, '← → 로 바꾸고 Space로 시작 · 모든 캐릭터는 능력치가 같습니다', 60, 110, { size: 18, title: true, color: '#fff', stroke: COL.ink, strokeW: 5 });
      const cw = 182, gap = 14, x0 = (W - (cw * 6 + gap * 5)) / 2;
      ROSTER.forEach((r, i) => {
        const x = x0 + i * (cw + gap), y = 140, sel = i === idx;
        const rect = { x, y, w: cw, h: 250 };
        if (inp.pP && inRect(rect, inp.px, inp.py)) { if (idx !== i) { idx = i; chosenT = game.t; sfx.click(); } }
        card(ctx, { x, y: y - (sel ? 6 : 0), w: cw, h: 250 }, { fill: sel ? r.color : COL.panel, stroke: COL.ink, lw: sel ? 5 : 3.5, r: 26 });
        const hop = sel ? Math.abs(Math.sin((game.t - chosenT) * 7)) * (game.t - chosenT < 0.8 ? 14 : 0) : 0;
        drawCharacter(ctx, r.id, x + cw / 2, y + 190 - hop - (sel ? 6 : 0), sel ? 128 : 110, { t: game.t + i, expr: sel && game.t - chosenT < 1.2 && chosenT > 0 ? 'win' : 'idle' });
        text(ctx, r.name, x + cw / 2, y + 232 - (sel ? 6 : 0), { size: 28, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 6 });
      });
      // info
      const r = ROSTER[idx];
      card(ctx, { x: x0, y: 410, w: 640, h: 190 }, { r: 28 });
      text(ctx, r.name, x0 + 30, 464, { size: 44, title: true, color: r.color, stroke: COL.ink, strokeW: 8 });
      text(ctx, r.en + '  ·  ' + r.role, x0 + 44 + measure(ctx, r.name, 44, 400, true), 460, { size: 20, title: true, color: COL.soft });
      text(ctx, '“' + r.line + '”', x0 + 30, 506, { size: 22, weight: 700, color: COL.ink });
      text(ctx, r.desc, x0 + 30, 548, { size: 17, weight: 500, color: COL.soft });
      // options
      const ox = x0 + 670;
      if (mode === 'match') {
        text(ctx, '판 수', ox, 438, { size: 20, title: true, stroke: COL.ink, strokeW: 5 });
        ROUND_OPTIONS.forEach((n, i) => {
          if (button(ctx, inp, { x: ox + i * 112, y: 450, w: 104, h: 46 }, n + '판', { selected: roundsI === i, size: 20 })) { roundsI = i; sfx.click(); }
        });
      } else {
        text(ctx, '연습 모드', ox, 438, { size: 20, title: true, stroke: COL.ink, strokeW: 5 });
        text(ctx, '다음 화면에서 미니게임을 고릅니다', ox, 480, { size: 18, title: true, stroke: COL.ink, strokeW: 5 });
      }
      text(ctx, '봇 난이도', ox, 530, { size: 20, title: true, stroke: COL.ink, strokeW: 5 });
      DIFFS.forEach((d, i) => {
        if (button(ctx, inp, { x: ox + i * 112, y: 542, w: 104, h: 46 }, d.name, { selected: diffI === i, size: 20 })) { diffI = i; sfx.click(); }
      });
      if (button(ctx, inp, { x: x0, y: 624, w: 640, h: 62 }, mode === 'practice' ? '미니게임 고르러 가기' : '이 캐릭터로 시작', { primary: true, size: 26, color: r.color })) start();
      if (button(ctx, inp, { x: ox, y: 624, w: 328, h: 62 }, '뒤로', { size: 22 })) { sfx.click(); game.go('title'); }
    },
  };
}

export function practiceScene(game) {
  let focus = 0;
  const C = 5, CW = 228, CH = 118, GAP = 10, X0 = (W - (C * CW + (C - 1) * GAP)) / 2, Y0 = 118;
  const rectOf = (i) => ({ x: X0 + (i % C) * (CW + GAP), y: Y0 + Math.floor(i / C) * (CH + GAP), w: CW, h: CH });
  const start = (mg) => { sfx.go(); game.go('matchStart', { rounds: 1, fixed: mg.id, practice: true }); };
  return {
    enter() { setTouchLayout({ stick: false, a: false }); playMusic('menu'); },
    update(dt, inp) {
      const n = MINIGAMES.length;
      if (inp.leftP) focus = (focus + n - 1) % n;
      if (inp.rightP) focus = (focus + 1) % n;
      if (inp.upP) focus = (focus + n - C) % n;
      if (inp.downP) focus = (focus + C) % n;
      if (inp.aP) start(MINIGAMES[focus]);
      if (inp.escP) game.go('title');
    },
    render(ctx, inp) {
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      text(ctx, '미니게임 연습', X0, 64, { size: 46, title: true, stroke: COL.ink, strokeW: 9 });
      text(ctx, `${MINIGAMES.length}개 중 하나를 골라 봇 3명과 한 판만 합니다. 점수는 기록되지 않습니다.`, X0, 98, { size: 17, title: true, stroke: COL.ink, strokeW: 5 });
      MINIGAMES.forEach((mg, i) => {
        const r = rectOf(i);
        if (!inp.touch && inRect(r, inp.px, inp.py)) focus = i;
        const f = focus === i;
        const lift = f ? 4 : 0;
        card(ctx, { x: r.x, y: r.y - lift, w: r.w, h: r.h }, { fill: f ? mg.color : COL.panel, lw: f ? 5 : 3.5, r: 24 });
        const tw = measure(ctx, mg.typeLabel, 14, 400, true) + 20;
        card(ctx, { x: r.x + 14, y: r.y - lift + 14, w: tw, h: 26 }, { fill: f ? '#fff' : mg.color, shadow: 0, lw: 2.5, r: 13, gloss: false });
        text(ctx, mg.typeLabel, r.x + 24, r.y - lift + 32, { size: 14, title: true, color: COL.ink });
        text(ctx, mg.name, r.x + 18, r.y - lift + 82, { size: mg.name.length > 8 ? 23 : 28, title: true, stroke: COL.ink, strokeW: 6 });
        if (inp.pP && inRect(r, inp.px, inp.py)) start(mg);
      });
      // rule of the focused game
      const mg = MINIGAMES[focus];
      const by = Y0 + 4 * (CH + GAP) + 6;
      card(ctx, { x: X0, y: by, w: C * CW + (C - 1) * GAP, h: 66 }, { r: 22 });
      text(ctx, mg.name, X0 + 22, by + 28, { size: 20, title: true, color: mg.color, stroke: COL.ink, strokeW: 5 });
      text(ctx, mg.rule, X0 + 22, by + 54, { size: 15, weight: 700, color: COL.soft });
      if (button(ctx, inp, { x: W - X0 - 150, y: 34, w: 150, h: 48 }, '뒤로', { size: 20 })) { sfx.click(); game.go('title'); }
    },
  };
}

function measureBadge(ctx, s) { ctx.save(); ctx.font = `800 15px ${FONT}`; const w = ctx.measureText(s).width; ctx.restore(); return w; }

export function wrap(ctx, str, x, y, maxW, lh, o) {
  ctx.save(); ctx.font = `${o.weight || 600} ${o.size || 17}px ${FONT}`;
  const words = str.split(' '); let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { text(ctx, line, x, yy, o); line = w; yy += lh; }
    else line = test;
  }
  if (line) text(ctx, line, x, yy, o);
  ctx.restore();
  return yy;
}
