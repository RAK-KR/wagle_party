// Title, character select, practice list
import { W, H, COL, TITLE, TITLE_KO, ROUND_OPTIONS, DIFFS, FONT } from '../config.js';
import { ROSTER, drawCharacter, shade } from '../characters.js';
import { text, button, bgFill, stripes, inRect, easeOutBack } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { setTouchLayout } from '../input.js';
import { MINIGAMES } from '../minigames/index.js';
import { makeRng } from '../rng.js';
import { EMOTES } from '../emotes.js';

let selectedChar = 'punch';
try { selectedChar = localStorage.getItem('wagle.char') || 'punch'; } catch (e) { }

export function titleScene(game) {
  let focus = 0, t0 = 0, nextEmote = 2;
  const items = [
    { label: '시작하기', sub: '봇 3명과 대결', go: () => game.go('select', { mode: 'match' }) },
    { label: '미니게임 연습', sub: '하나만 골라서 해 보기', go: () => game.go('select', { mode: 'practice' }) },
    { label: '온라인 대전', sub: '준비 중', disabled: true },
  ];
  const fakePlayers = ROSTER.map(r => ({ char: r.id, color: r.color, name: r.name }));
  return {
    enter() { t0 = game.t; setTouchLayout({ stick: false, a: false }); playMusic('menu'); game.players = fakePlayers; game.emotes.reset(); },
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
      bgFill(ctx, W, H, '#2a2238', '#141019'); stripes(ctx, W, H, game.t);
      // logo
      const k = Math.min(1, t / 0.6), s = easeOutBack(k);
      ctx.save(); ctx.translate(W / 2, 150); ctx.scale(s, s); ctx.rotate(-0.03);
      text(ctx, TITLE_KO, 0, 0, { size: 104, title: true, align: 'center', base: 'middle', color: '#ffcf3a', stroke: '#1b1824', strokeW: 16, shadow: '#e8473f', shadowY: 8 });
      text(ctx, TITLE, 0, 74, { size: 30, weight: 900, align: 'center', base: 'middle', color: COL.text, stroke: '#1b1824', strokeW: 8 });
      ctx.restore();
      // stage + characters (first four can emote)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 548, W, 172);
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
        text(ctx, it.sub, r.x + r.w + 16, r.y + r.h / 2 + 6, { size: 15, weight: 600, color: COL.dim });
      });
      text(ctx, '방향키/마우스로 고르기 · Space 결정 · G 감정 표현 · M 소리', W / 2, H - 22, { size: 15, weight: 600, align: 'center', color: COL.dim });
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
      bgFill(ctx, W, H, '#241e30', '#141019'); stripes(ctx, W, H, game.t);
      text(ctx, mode === 'practice' ? '연습할 캐릭터 고르기' : '캐릭터 선택', 60, 74, { size: 44, title: true });
      text(ctx, '← → 로 바꾸고 Space로 시작 · 모든 캐릭터는 능력치가 같습니다', 60, 108, { size: 16, weight: 600, color: COL.dim });
      const cw = 182, gap = 14, x0 = (W - (cw * 6 + gap * 5)) / 2;
      ROSTER.forEach((r, i) => {
        const x = x0 + i * (cw + gap), y = 140, sel = i === idx;
        const rect = { x, y, w: cw, h: 250 };
        if (inp.pP && inRect(rect, inp.px, inp.py)) { if (idx !== i) { idx = i; chosenT = game.t; sfx.click(); } }
        ctx.fillStyle = sel ? shade(r.color, -0.55) : COL.panel; ctx.fillRect(x, y, cw, 250);
        if (sel) { ctx.strokeStyle = r.color; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, cw - 4, 246); }
        const hop = sel ? Math.abs(Math.sin((game.t - chosenT) * 7)) * (game.t - chosenT < 0.8 ? 14 : 0) : 0;
        drawCharacter(ctx, r.id, x + cw / 2, y + 190 - hop, sel ? 128 : 110, { t: game.t + i, expr: sel && game.t - chosenT < 1.2 && chosenT > 0 ? 'win' : 'idle' });
        text(ctx, r.name, x + cw / 2, y + 232, { size: 24, weight: 900, align: 'center', color: sel ? r.color : COL.text });
      });
      // info
      const r = ROSTER[idx];
      ctx.fillStyle = COL.panel; ctx.fillRect(x0, 410, 640, 190); ctx.fillStyle = r.color; ctx.fillRect(x0, 410, 6, 190);
      text(ctx, r.name, x0 + 30, 462, { size: 40, title: true, color: r.color });
      text(ctx, r.en + '  ·  ' + r.role, x0 + 34 + 40 * r.name.length, 458, { size: 18, weight: 800, color: COL.sub });
      text(ctx, '“' + r.line + '”', x0 + 30, 506, { size: 22, weight: 700 });
      text(ctx, r.desc, x0 + 30, 548, { size: 17, weight: 500, color: COL.sub });
      // options
      const ox = x0 + 670;
      if (mode === 'match') {
        text(ctx, '판 수', ox, 438, { size: 18, weight: 800, color: COL.sub });
        ROUND_OPTIONS.forEach((n, i) => {
          if (button(ctx, inp, { x: ox + i * 112, y: 450, w: 104, h: 46 }, n + '판', { selected: roundsI === i, size: 20 })) { roundsI = i; sfx.click(); }
        });
      } else {
        text(ctx, '연습 모드', ox, 438, { size: 18, weight: 800, color: COL.sub });
        text(ctx, '다음 화면에서 미니게임을 고릅니다', ox, 480, { size: 17, weight: 600, color: COL.dim });
      }
      text(ctx, '봇 난이도', ox, 530, { size: 18, weight: 800, color: COL.sub });
      DIFFS.forEach((d, i) => {
        if (button(ctx, inp, { x: ox + i * 112, y: 542, w: 104, h: 46 }, d.name, { selected: diffI === i, size: 20 })) { diffI = i; sfx.click(); }
      });
      if (button(ctx, inp, { x: x0, y: 624, w: 640, h: 62 }, mode === 'practice' ? '미니게임 고르러 가기' : '이 캐릭터로 시작', { primary: true, size: 26, color: r.color })) start();
      if (button(ctx, inp, { x: ox, y: 624, w: 328, h: 62 }, '뒤로', { size: 22 })) { sfx.click(); game.go('title'); }
    },
  };
}

export function practiceScene(game) {
  let focus = 0, t0 = 0;
  return {
    enter() { t0 = game.t; setTouchLayout({ stick: false, a: false }); playMusic('menu'); },
    update(dt, inp) {
      if (inp.leftP) focus = (focus + MINIGAMES.length - 1) % MINIGAMES.length;
      if (inp.rightP) focus = (focus + 1) % MINIGAMES.length;
      if (inp.upP) focus = (focus + MINIGAMES.length - 3) % MINIGAMES.length;
      if (inp.downP) focus = (focus + 3) % MINIGAMES.length;
      if (inp.aP) { sfx.go(); game.go('matchStart', { rounds: 1, fixed: MINIGAMES[focus].id, practice: true }); }
      if (inp.escP) game.go('title');
    },
    render(ctx, inp) {
      bgFill(ctx, W, H, '#241e30', '#141019'); stripes(ctx, W, H, game.t);
      text(ctx, '미니게임 연습', 60, 74, { size: 44, title: true });
      text(ctx, '하나를 골라 봇 3명과 한 판만 합니다. 점수는 기록되지 않습니다.', 60, 108, { size: 16, weight: 600, color: COL.dim });
      MINIGAMES.forEach((mg, i) => {
        const x = 60 + (i % 3) * 395, y = 140 + Math.floor(i / 3) * 235, r = { x, y, w: 375, h: 215 };
        const hot = inRect(r, inp.px, inp.py) && !inp.touch;
        if (hot) focus = i;
        ctx.fillStyle = focus === i ? COL.line : COL.panel; ctx.fillRect(x, y, r.w, r.h);
        ctx.fillStyle = mg.color; ctx.fillRect(x, y, 6, r.h);
        if (focus === i) { ctx.strokeStyle = mg.color; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, r.w - 3, r.h - 3); }
        ctx.fillStyle = mg.color; ctx.fillRect(x + 26, y + 24, measureBadge(ctx, mg.typeLabel) + 20, 28);
        text(ctx, mg.typeLabel, x + 36, y + 44, { size: 15, weight: 800, color: '#1b1824' });
        text(ctx, mg.name, x + 26, y + 98, { size: 34, title: true });
        wrap(ctx, mg.rule, x + 26, y + 136, r.w - 52, 24, { size: 17, weight: 600, color: COL.sub });
        if (inp.pP && inRect(r, inp.px, inp.py)) { sfx.go(); game.go('matchStart', { rounds: 1, fixed: mg.id, practice: true }); }
      });
      if (button(ctx, inp, { x: W - 220, y: 40, w: 160, h: 50 }, '뒤로', { size: 20 })) { sfx.click(); game.go('title'); }
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
