// Match flow: start → roulette → intro → play → result → standings → ... → podium
import { W, H, COL, POINTS, FONT } from '../config.js';
import { drawCharacter, shade } from '../characters.js';
import { text, button, bgFill, stripes, inRect, easeOutBack, easeOut, clamp, card, tintBg, rr, pastel } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { setTouchLayout } from '../input.js';
import { MINIGAMES, byId } from '../minigames/index.js';
import { makeRng } from '../rng.js';
import { EMOTES } from '../emotes.js';
import { wrap } from './menu.js';

export function matchScenes(game) {
  const M = { rounds: 6, round: 0, queue: [], scores: [0, 0, 0, 0], prevScores: [0, 0, 0, 0], practice: false, fixed: null, mg: null, st: null, rng: null, last: null };
  let paused = false;
  let helpOpen = true;
  try { helpOpen = localStorage.getItem('wagle.help') === '1'; } catch (e) { }

  const online = () => !!game.online && !!game.online.role;
  const canControl = () => !online() || game.online.role === 'host';
  const isLast = () => !M.practice && M.round === M.rounds - 1 && M.rounds > 1;
  const mult = () => (isLast() ? 2 : 1);

  function buildQueue(n) {
    const q = [];
    const type = (id) => byId(id).typeLabel.split(' ')[0];
    const humans = game.players.filter(p => !p.bot).length;
    const allowed = MINIGAMES.filter(m => !(m.id === 'tug' && online() && humans < 4)).map(m => m.id);
    while (q.length < n) {
      const bag = M.rng.shuffle(allowed);
      // avoid the same control type twice in a row where possible
      for (let k = 0; k < bag.length; k++) {
        const prev = k ? bag[k - 1] : q[q.length - 1];
        if (prev && type(bag[k]) === type(prev)) {
          const j = bag.findIndex((id, jj) => jj > k && type(id) !== type(prev) && (k + 1 >= bag.length || jj === k + 1 || type(id) !== type(bag[k + 1])));
          if (j > 0) [bag[k], bag[j]] = [bag[j], bag[k]];
        }
      }
      q.push(...bag);
    }
    return q.slice(0, n);
  }
  function botEmote(i, kinds, p = 0.5, delay = 0) {
    if (!game.players[i].bot || i === game.local && !game.auto) return;
    if (M.rng.next() > p) return;
    setTimeout(() => game.emotes.trigger(i, M.rng.pick(kinds)), delay * 1000 / game.speed);
  }

  // ---------- pause overlay shared by intro/play ----------
  function pauseUpdate(inp) {
    if (inp.escP) { paused = !paused; sfx.click(); return !online(); }
    return online() ? false : paused;   // online: the menu never stops the game for others
  }
  function pauseRender(ctx, inp) {
    if (!paused) return;
    ctx.fillStyle = 'rgba(60,45,120,0.45)'; ctx.fillRect(0, 0, W, H);
    card(ctx, { x: W / 2 - 220, y: 180, w: 440, h: 330 }, { r: 34 });
    text(ctx, online() ? '메뉴' : '일시 정지', W / 2, 250, { size: 54, title: true, align: 'center', stroke: COL.ink, strokeW: 9 });
    if (online()) text(ctx, '온라인에서는 게임이 멈추지 않습니다', W / 2, 290, { size: 17, weight: 700, align: 'center', color: COL.soft });
    if (button(ctx, inp, { x: W / 2 - 160, y: 310, w: 320, h: 62 }, '계속하기', { primary: true, size: 24 })) { paused = false; sfx.click(); }
    if (button(ctx, inp, { x: W / 2 - 160, y: 390, w: 320, h: 62 }, online() ? '방 나가기' : M.practice ? '연습 목록으로' : '그만두고 처음으로', { size: 22 })) {
      paused = false; sfx.click();
      if (online()) game.online.leave(); else game.go(M.practice ? 'practice' : 'title');
    }
    text(ctx, 'Esc 로 돌아가기', W / 2, 500, { size: 16, weight: 600, align: 'center', color: COL.soft });
  }

  // ---------- scenes ----------
  const matchStart = {
    enter(args) {
      M.rng = makeRng((Date.now() * 7 + 13) >>> 0);
      M.practice = !!args.practice; M.fixed = args.fixed || null;
      M.rounds = args.rounds || 6; M.round = 0;
      M.scores = [0, 0, 0, 0]; M.prevScores = [0, 0, 0, 0];
      M.queue = M.fixed ? [M.fixed] : buildQueue(M.rounds);
      game.emotes.reset();
      game.go(M.fixed ? 'intro' : 'roulette');
    },
    update() { }, render() { },
  };

  // Roulette strip
  let rl = null;
  const roulette = {
    follow() { setTouchLayout({ stick: false, a: false }); playMusic('menu'); },
    enter() {
      this.follow();
      const target = MINIGAMES.findIndex(m => m.id === M.queue[M.round]);
      const spins = 3 + Math.floor(M.rng.next() * 2);
      const N = MINIGAMES.length, from = M.rng.next() * N;
      // land exactly on a card whose index (mod N) is the chosen game
      rl = { t0: game.t, from, to: (Math.ceil(from / N) + spins) * N + target, lastCell: -1, done: false };
    },
    update(dt) {
      const e = (game.t - rl.t0) / 2.6;
      const cell = Math.floor(lerpPos(e) + 0.5);
      if (cell !== rl.lastCell) { rl.lastCell = cell; if (e < 1) game.sfx('spin'); }
      if (e >= 1 && !rl.done) { rl.done = true; rl.doneT = game.t; game.sfx('coin'); }
      if (rl.done && game.t - rl.doneT > (isLast() ? 1.8 : 1.1)) game.go('intro');
    },
    render(ctx) {
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      text(ctx, `${M.round + 1} / ${M.rounds} 판`, W / 2, 90, { size: 30, title: true, align: 'center', stroke: COL.ink, strokeW: 6 });
      text(ctx, '다음 미니게임은?', W / 2, 152, { size: 58, title: true, align: 'center', stroke: COL.ink, strokeW: 10 });
      const pos = lerpPos((game.t - rl.t0) / 2.6);
      const cw = 300, cy = 360;
      ctx.save(); ctx.beginPath(); ctx.rect(0, cy - 130, W, 260); ctx.clip();
      for (let k = Math.floor(pos) - 3; k <= Math.floor(pos) + 3; k++) {
        const mg = MINIGAMES[((k % MINIGAMES.length) + MINIGAMES.length) % MINIGAMES.length];
        const x = W / 2 + (k - pos) * (cw + 20);
        const center = Math.abs(k - pos) < 0.5 && rl.done;
        const sc = center ? 1 + 0.08 * easeOutBack(Math.min(1, (game.t - rl.doneT) / 0.3)) : 1;
        ctx.save(); ctx.translate(x, cy); ctx.scale(sc, sc);
        card(ctx, { x: -cw / 2, y: -100, w: cw, h: 200 }, { fill: center ? mg.color : COL.panel, r: 30, lw: center ? 5 : 3.5 });
        text(ctx, mg.typeLabel, 0, -46, { size: 19, title: true, align: 'center', color: center ? COL.ink : mg.color, stroke: center ? null : COL.ink, strokeW: 5 });
        text(ctx, mg.name, 0, 14, { size: 38, title: true, align: 'center', base: 'middle', stroke: COL.ink, strokeW: 8 });
        ctx.restore();
      }
      ctx.restore();
      ctx.fillStyle = COL.accent; ctx.strokeStyle = COL.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(W / 2 - 20, cy - 140); ctx.lineTo(W / 2 + 20, cy - 140); ctx.lineTo(W / 2, cy - 112); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W / 2 - 20, cy + 140); ctx.lineTo(W / 2 + 20, cy + 140); ctx.lineTo(W / 2, cy + 112); ctx.closePath(); ctx.stroke(); ctx.fill();
      if (isLast()) {
        const a = rl.done ? 1 : 0.6 + Math.sin(game.t * 8) * 0.4;
        text(ctx, '마지막 판!  점수 2배', W / 2, 560, { size: 46, title: true, align: 'center', color: COL.accent, alpha: a, stroke: COL.ink, strokeW: 10 });
      }
      drawScoreStrip(ctx);
    },
  };
  function lerpPos(e) { return rl.from + (rl.to - rl.from) * easeOut(clamp(e, 0, 1)); }

  function drawScoreStrip(ctx) {
    if (M.practice) return;
    const n = game.players.length;
    for (let i = 0; i < n; i++) {
      const x = W / 2 - 2 * 210 + i * 210 + 10, y = 620;
      card(ctx, { x, y, w: 190, h: 74 }, { r: 26 });
      card(ctx, { x: x + 8, y: y + 8, w: 60, h: 58 }, { fill: game.players[i].color, r: 20, shadow: 0, lw: 2.5 });
      game.drawPlayer(ctx, i, x + 38, y + 62, 46);
      text(ctx, game.players[i].name, x + 80, y + 32, { size: 18, title: true, color: game.players[i].color, stroke: COL.ink, strokeW: 5 });
      text(ctx, M.scores[i] + '점', x + 80, y + 62, { size: 24, title: true, stroke: COL.ink, strokeW: 5 });
    }
  }

  // Intro: rules + ready
  let it = null;
  const intro = {
    follow() { paused = false; setTouchLayout({ stick: false, a: true, aLabel: '준비' }); playMusic('menu'); },
    enter() {
      M.mg = byId(M.queue[M.round]);
      this.follow();
      it = { t0: game.t, ready: [false, false, false, false], readyAt: [0, 0, 0, 0].map(() => game.t + (game.auto ? 0.3 : 0.9 + M.rng.next() * 2.2)), startT: -1 };
    },
    update(dt, inp) {
      if (pauseUpdate(inp)) return;
      for (let i = 0; i < 4; i++) {
        if (it.ready[i]) continue;
        if (game.players[i].bot) { if (game.t > it.readyAt[i]) { it.ready[i] = true; game.sfx('lock'); } continue; }
        const ii = game.inputFor(i);
        if (ii && (ii.aP || (ii.pP && inRect(READY_BTN, ii.px, ii.py)))) { it.ready[i] = true; game.sfx('lock'); }
      }
      if (game.t - it.t0 > 15) it.ready = [true, true, true, true];
      if (it.startT < 0 && it.ready.every(Boolean)) it.startT = game.t;
      if (it.startT > 0 && game.t - it.startT > 0.5) game.go('play');
    },
    render(ctx, inp) {
      const mg = M.mg, k = easeOutBack(Math.min(1, (game.t - it.t0) / 0.4));
      bgFill(ctx, W, H, ...tintBg(mg.color)); stripes(ctx, W, H, game.t);
      ctx.save(); ctx.translate(0, (1 - k) * 40); ctx.globalAlpha = Math.min(1, (game.t - it.t0) / 0.25);
      text(ctx, M.practice ? '연습' : `${M.round + 1} / ${M.rounds} 판`, 70, 76, { size: 24, title: true, stroke: COL.ink, strokeW: 6 });
      if (isLast()) text(ctx, '마지막 판 · 점수 2배', 230, 76, { size: 24, title: true, color: COL.accent, stroke: COL.ink, strokeW: 6 });
      const bw = measureW(ctx, mg.typeLabel, 18) + 30;
      card(ctx, { x: 70, y: 98, w: bw, h: 36 }, { fill: '#fff', r: 18, shadow: 3, lw: 3, gloss: false });
      text(ctx, mg.typeLabel, 85, 123, { size: 19, title: true, color: COL.ink });
      text(ctx, mg.name, 70, 212, { size: 80, title: true, stroke: COL.ink, strokeW: 12 });
      card(ctx, { x: 62, y: 236, w: 660, h: 120 }, { r: 26 });
      wrap(ctx, mg.rule, 86, 280, 610, 32, { size: 23, weight: 700, color: COL.ink });
      // controls
      const cy0 = 378;
      card(ctx, { x: 62, y: cy0, w: 660, h: 46 + mg.controls.length * 40 }, { r: 26 });
      text(ctx, '조작', 90, cy0 + 34, { size: 20, title: true, color: COL.accent, stroke: COL.ink, strokeW: 5 });
      mg.controls.forEach(([what, key], j) => {
        text(ctx, what, 92, cy0 + 72 + j * 40, { size: 20, weight: 800, color: COL.ink });
        text(ctx, key, 260, cy0 + 72 + j * 40, { size: 19, weight: 600, color: COL.soft });
      });
      ctx.restore();
      // players
      for (let i = 0; i < 4; i++) {
        const x = 800 + (i % 2) * 220, y = 120 + Math.floor(i / 2) * 250;
        card(ctx, { x, y, w: 200, h: 230 }, { fill: it.ready[i] ? game.players[i].color : COL.panel, r: 30, lw: it.ready[i] ? 5 : 3.5 });
        game.drawPlayer(ctx, i, x + 100, y + 160, 110, { expr: it.ready[i] ? 'win' : 'idle' });
        text(ctx, game.players[i].name, x + 100, y + 196, { size: 22, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 6 });
        text(ctx, it.ready[i] ? '준비 완료!' : '규칙 보는 중', x + 100, y + 220, { size: 16, title: true, align: 'center', color: it.ready[i] ? '#fff' : COL.soft, stroke: it.ready[i] ? COL.ink : null, strokeW: 4 });
      }
      if (M.practice && button(ctx, inp, BACK_BTN, '← 다른 미니게임 고르기', { size: 18 })) { sfx.click(); game.go('practice'); return; }
      if (!it.ready[game.local]) {
        button(ctx, inp, READY_BTN, '준비 완료  (Space)', { primary: true, size: 24, color: mg.color });
      } else text(ctx, '다른 플레이어를 기다리는 중...', READY_BTN.x + READY_BTN.w / 2, READY_BTN.y + 38, { size: 22, title: true, align: 'center', stroke: COL.ink, strokeW: 6 });
    },
    renderOverlay: (ctx, inp) => pauseRender(ctx, inp),
  };
  const READY_BTN = { x: 70, y: 630, w: 640, h: 62 };
  const BACK_BTN = { x: W - 300, y: 34, w: 260, h: 46 };
  const HUD_BACK = { x: W - 132, y: 6, w: 124, h: 34 };

  // Play
  let pl = null;
  const prevA = [false, false, false, false];
  const play = {
    follow() {
      paused = false;
      setTouchLayout(Object.assign({ stick: false, a: false }, M.mg.touch || {}));
      playMusic(M.mg.music === 'none' ? null : (M.mg.music || 'game'));
    },
    enter() {
      const mg = M.mg;
      M.st = mg.init(game, M.rng);
      pl = { t0: game.t, phase: 'count', endT: 0, lastCount: 4 };
      prevA.fill(false);
      this.follow();
    },
    update(dt, inp) {
      if (pauseUpdate(inp)) return;
      const mg = M.mg, st = M.st;
      const e = game.t - pl.t0;
      if (pl.phase === 'count') {
        const c = Math.ceil(3 - e);
        if (c !== pl.lastCount && c > 0) { pl.lastCount = c; game.sfx('tick'); }
        if (e >= 3) { pl.phase = 'run'; game.sfx('go'); }
        mg.preview?.(st, dt, game);
        return;
      }
      if (pl.phase === 'run') {
        const inputs = [];
        for (let i = 0; i < 4; i++) {
          let raw;
          const human = !game.players[i].bot;
          const src = human ? game.inputFor(i) : null;   // local keyboard/mouse, or a remote player's input
          if (human) raw = src ? { mx: src.mx, my: src.my, a: src.a, px: src.px, py: src.py, pDown: src.pDown, pP: src.pP, upP: src.upP, downP: src.downP, leftP: src.leftP, rightP: src.rightP } : {};
          else raw = mg.bot(st, i, game, M.rng) || {};
          const a = !!raw.a;
          inputs[i] = {
            mx: raw.mx || 0, my: raw.my || 0, a,
            aP: (human && !!src?.aP) || (a && !prevA[i]), aR: !a && prevA[i],
            px: raw.px ?? -100, py: raw.py ?? -100, pDown: !!raw.pDown, pP: !!raw.pP,
            upP: !!raw.upP, downP: !!raw.downP, leftP: !!raw.leftP, rightP: !!raw.rightP, num: raw.num,
          };
          prevA[i] = a;
        }
        mg.update(st, dt, inputs, game, M.rng);
        if (mg.done(st)) { pl.phase = 'end'; pl.endT = game.t; game.sfx('whoosh'); }
      } else if (pl.phase === 'end') {
        mg.update(st, dt, [0, 1, 2, 3].map(() => ({ mx: 0, my: 0, a: false, aP: false, aR: false, px: -100, py: -100 })), game, M.rng, true);
        if (game.t - pl.endT > 1.6) game.go('result');
      }
    },
    render(ctx, inp) {
      const mg = M.mg, st = M.st;
      mg.render(ctx, st, game);
      // HUD top bar
      ctx.fillStyle = 'rgba(214,202,255,0.96)'; ctx.fillRect(0, 0, W, 46);
      ctx.fillStyle = COL.ink; ctx.fillRect(0, 44, W, 3);
      text(ctx, (M.practice ? '연습' : `${M.round + 1}/${M.rounds}`) + '   ' + mg.name, game.local === 0 && inp.touch ? 84 : 20, 32, { size: 21, title: true, stroke: COL.ink, strokeW: 5 });
      if (isLast()) text(ctx, '점수 2배', 300, 32, { size: 19, title: true, color: COL.accent, stroke: COL.ink, strokeW: 5 });
      const tl = mg.timeLeft?.(st);
      if (tl != null && pl.phase !== 'count') {
        const s = Math.max(0, tl);
        card(ctx, { x: W / 2 - 52, y: 4, w: 104, h: 44 }, { fill: s < 5 ? '#ff8aa0' : COL.panel2, r: 22, shadow: 3, lw: 3 });
        text(ctx, s.toFixed(s < 10 ? 1 : 0), W / 2, 39, { size: 34, title: true, align: 'center', color: s < 5 ? COL.bad : COL.text, stroke: COL.ink, strokeW: 6 });
      }
      if (mg.hud) mg.hud(ctx, st, game);
      if (M.practice && button(ctx, inp, HUD_BACK, '← 목록', { size: 15 })) { sfx.click(); game.go('practice'); return; }
      drawHelp(ctx, inp, mg);
      // countdown / end banners
      const e = game.t - pl.t0;
      if (pl.phase === 'count') {
        const c = Math.ceil(3 - e), f = 1 - (e % 1);
        ctx.fillStyle = 'rgba(30,20,80,0.3)'; ctx.fillRect(0, 0, W, H);
        const s = 0.8 + easeOutBack(Math.min(1, (1 - f) / 0.35)) * 0.4;
        bigBanner(ctx, String(c), s, 1, COL.accent, 150);
        text(ctx, mg.rule, W / 2, H / 2 + 140, { size: 24, title: true, align: 'center', stroke: COL.ink, strokeW: 7 });
      } else if (pl.phase === 'run' && game.t - pl.t0 < 3.7) {
        const k = (game.t - pl.t0 - 3) / 0.7;
        bigBanner(ctx, '시작!', 1 + k * 0.15, 1 - k, COL.accent, 110);
      } else if (pl.phase === 'end') {
        const k = easeOutBack(Math.min(1, (game.t - pl.endT) / 0.35));
        bigBanner(ctx, '끝!', k, 1, '#ffffff', 110);
      }
    },
    renderOverlay: (ctx, inp) => pauseRender(ctx, inp),
  };

  function drawHelp(ctx, inp, mg) {
    if (inp.touch) return;
    if (inp.hP) { helpOpen = !helpOpen; try { localStorage.setItem('wagle.help', helpOpen ? '1' : '0'); } catch (e) { } }
    const rows = [...mg.controls, ['감정 표현', 'G 누르고 방향'], ['메뉴', 'Esc'], ['소리', 'M']];
    // open for the first seconds of every minigame, then folds unless pinned with H
    const open = helpOpen || game.t - pl.t0 < 8;
    const w = open ? 270 : 200, x = W - w - (open ? 10 : (M.practice ? 144 : 10)), y = open ? 52 : 8;
    const r = { x, y, w, h: open ? 34 + rows.length * 24 : 30 };
    card(ctx, r, { fill: 'rgba(250,247,255,0.94)', raw: true, r: 16, shadow: 3, lw: 2.5, gloss: false });
    text(ctx, helpOpen ? '조작법  (H: 고정 해제)' : '조작법  (H: 계속 보기)', x + 12, y + 20, { size: 13, weight: 800, color: COL.soft });
    if (!open) return;
    rows.forEach(([a, b], j) => {
      text(ctx, a, x + 12, y + 46 + j * 24, { size: 14, weight: 800, color: COL.ink });
      text(ctx, b, x + 104, y + 46 + j * 24, { size: 14, weight: 600, color: COL.soft });
    });
  }

  // Result of one minigame
  let rs = null;
  const result = {
    follow() { setTouchLayout({ stick: false, a: canControl(), aLabel: '다음' }); playMusic(null); },
    enter() {
      this.follow();
      const sc = M.mg.scores(M.st);
      const place = placesFrom(sc);
      const pts = place.map(p => M.practice ? 0 : POINTS[p] * mult());
      M.prevScores = M.scores.slice();
      M.scores = M.scores.map((s, i) => s + pts[i]);
      const worst = Math.max(...place);
      rs = { t0: game.t, place, pts, worst, order: [0, 1, 2, 3].sort((a, b) => place[a] - place[b] || a - b) };
      for (let j = 0; j < 4; j++) game.sfx(place[j] === 0 ? 'good' : 'bad', j);
      for (let i = 0; i < 4; i++) {
        if (place[i] === 0) botEmote(i, ['thumb', 'dance', 'lol'], 0.55, 0.6 + M.rng.next());
        else if (place[i] === worst) botEmote(i, ['sorry', 'what', 'lol'], 0.4, 0.8 + M.rng.next());
      }
    },
    update(dt, inp) {
      const e = game.t - rs.t0;
      if (e > 1 && (inp.aP || (inp.pP && inRect(NEXT_BTN, inp.px, inp.py)) || e > 7 || (game.auto && e > 1.2))) {
        sfx.click();
        if (M.practice) game.go('practiceEnd');
        else game.go('standings');
      }
    },
    render(ctx, inp) {
      const e = game.t - rs.t0;
      bgFill(ctx, W, H, ...tintBg(M.mg.color)); stripes(ctx, W, H, game.t);
      text(ctx, M.mg.name + ' 결과', W / 2, 88, { size: 54, title: true, align: 'center', stroke: COL.ink, strokeW: 10 });
      if (isLast()) text(ctx, '마지막 판 · 점수 2배', W / 2, 128, { size: 22, title: true, align: 'center', color: COL.accent, stroke: COL.ink, strokeW: 6 });
      rs.order.forEach((i, k) => {
        const appear = clamp((e - 0.15 - (3 - k) * 0.18) / 0.3, 0, 1);
        const x = 190 + k * 300, base = 560, hgt = [190, 140, 100, 70][rs.place[i]];
        ctx.save(); ctx.globalAlpha = appear;
        card(ctx, { x: x - 110, y: base - hgt * appear, w: 220, h: hgt * appear + 90 }, { fill: game.players[i].color, r: 30, lw: 4 });
        const expr = rs.place[i] === 0 ? 'win' : rs.place[i] === rs.worst ? 'lose' : 'idle';
        game.drawPlayer(ctx, i, x, base - hgt * appear, 130, { expr, tag: true });
        text(ctx, (rs.place[i] + 1) + '등', x, base - hgt * appear + 52, { size: 40, title: true, align: 'center', color: rs.place[i] === 0 ? COL.accent : '#fff', stroke: COL.ink, strokeW: 8 });
        text(ctx, game.players[i].name, x, base + 36, { size: 22, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 6 });
        text(ctx, M.mg.detail(M.st, i), x, base + 64, { size: 17, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 5 });
        if (!M.practice) {
          const pk = clamp((e - 1) / 0.3, 0, 1);
          text(ctx, '+' + rs.pts[i], x + 70, base - hgt * appear - 120 - pk * 10, { size: 36, title: true, align: 'center', color: rs.pts[i] ? COL.good : COL.dim, alpha: pk, stroke: COL.ink, strokeW: 8 });
        }
        ctx.restore();
      });
      if (e > 1 && canControl()) button(ctx, inp, NEXT_BTN, M.practice ? '계속 (Space)' : '순위 보기 (Space)', { primary: true, size: 22 });
      else if (e > 1) waitText(ctx);
    },
  };
  const NEXT_BTN = { x: W / 2 - 160, y: 650, w: 320, h: 54 };

  // practice end
  const practiceEnd = {
    enter() { setTouchLayout({ stick: false, a: false }); },
    update(dt, inp) { if (inp.aP) game.go('matchStart', { rounds: 1, fixed: M.fixed, practice: true }); if (inp.escP) game.go('practice'); },
    render(ctx, inp) {
      bgFill(ctx, W, H, ...tintBg(M.mg.color)); stripes(ctx, W, H, game.t);
      text(ctx, M.mg.name, W / 2, 230, { size: 68, title: true, align: 'center', stroke: COL.ink, strokeW: 12 });
      if (button(ctx, inp, { x: W / 2 - 170, y: 300, w: 340, h: 64 }, '한 번 더 (Space)', { primary: true, size: 24 })) game.go('matchStart', { rounds: 1, fixed: M.fixed, practice: true });
      if (button(ctx, inp, { x: W / 2 - 170, y: 380, w: 340, h: 64 }, '다른 미니게임', { size: 22 })) game.go('practice');
      if (button(ctx, inp, { x: W / 2 - 170, y: 460, w: 340, h: 64 }, '처음으로', { size: 22 })) game.go('title');
    },
  };

  // Cumulative standings
  let sd = null;
  const standings = {
    follow() { setTouchLayout({ stick: false, a: canControl(), aLabel: '다음' }); playMusic('menu'); },
    enter() { this.follow(); sd = { t0: game.t }; },
    update(dt, inp) {
      const e = game.t - sd.t0;
      if (e > 1 && (inp.aP || (inp.pP && inRect(NEXT_BTN, inp.px, inp.py)) || e > 6 || (game.auto && e > 1.2))) {
        sfx.click(); M.round++;
        if (M.round >= M.rounds) game.go('podium'); else game.go('roulette');
      }
    },
    render(ctx, inp) {
      const e = game.t - sd.t0, k = easeOut(clamp((e - 0.3) / 1, 0, 1));
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      text(ctx, '현재 순위', W / 2, 92, { size: 56, title: true, align: 'center', stroke: COL.ink, strokeW: 10 });
      text(ctx, `${M.round + 1} / ${M.rounds} 판 끝` + (M.round + 1 < M.rounds ? `  ·  ${M.rounds - M.round - 1}판 남음` : '  ·  최종 결과로'), W / 2, 134, { size: 22, title: true, align: 'center', stroke: COL.ink, strokeW: 6 });
      const cur = M.scores.map((s, i) => M.prevScores[i] + (s - M.prevScores[i]) * k);
      const place = placesFrom(M.scores);
      const order = [0, 1, 2, 3].sort((a, b) => M.scores[b] - M.scores[a] || a - b);
      const maxS = Math.max(6, ...M.scores);
      order.forEach((i, row) => {
        const y = 175 + row * 112;
        card(ctx, { x: 140, y, w: 1000, h: 96 }, { r: 34, fill: place[i] === 0 ? '#ffe9a8' : COL.panel });
        card(ctx, { x: 152, y: y + 18, w: 60, h: 60 }, { fill: place[i] === 0 ? COL.accent : '#fff', r: 30, shadow: 3, lw: 3, gloss: false });
        text(ctx, (place[i] + 1) + '', 182, y + 61, { size: 36, title: true, align: 'center', color: COL.ink });
        game.drawPlayer(ctx, i, 270, y + 88, 74, { expr: place[i] === 0 ? 'win' : 'idle', tag: true });
        text(ctx, game.players[i].name, 330, y + 42, { size: 24, title: true, color: game.players[i].color, stroke: COL.ink, strokeW: 6 });
        const bw = 640 * cur[i] / maxS;
        ctx.fillStyle = 'rgba(110,90,180,0.18)'; rr(ctx, 330, y + 54, 640, 24, 12); ctx.fill();
        if (bw > 4) { ctx.fillStyle = pastel(game.players[i].color, 0.25); rr(ctx, 330, y + 54, Math.max(24, bw), 24, 12); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke(); }
        text(ctx, Math.round(cur[i]) + '점', 1110, y + 66, { size: 34, title: true, align: 'right', stroke: COL.ink, strokeW: 7 });
        const gain = M.scores[i] - M.prevScores[i];
        if (gain) text(ctx, '+' + gain, 1110, y + 32, { size: 20, title: true, color: COL.good, align: 'right', stroke: COL.ink, strokeW: 5, alpha: clamp(e * 2, 0, 1) });
      });
      if (e > 1 && canControl()) button(ctx, inp, NEXT_BTN, M.round + 1 >= M.rounds ? '최종 결과 (Space)' : '다음 판 (Space)', { primary: true, size: 22 });
      else if (e > 1) waitText(ctx);
    },
  };

  // Final podium
  let pd = null;
  const podium = {
    follow() { setTouchLayout({ stick: false, a: false }); playMusic('menu'); },
    enter() {
      this.follow();
      const place = placesFrom(M.scores);
      pd = { t0: game.t, place };
      game.sfx('fanfare');
      for (let i = 0; i < 4; i++) {
        if (place[i] === 0) botEmote(i, ['dance'], 0.9, 1.2);
        else botEmote(i, ['thumb', 'heart', 'sorry', 'lol'], 0.5, 1.5 + M.rng.next() * 2);
      }
      if (game.auto) window.__matchDone = (window.__matchDone || 0) + 1;
    },
    update(dt, inp) {
      if (inp.aP) { game.go('matchStart', { rounds: M.rounds }); }
      if (inp.escP && !online()) game.go('title');
      if (game.auto && game.t - pd.t0 > 2) game.go('matchStart', { rounds: M.rounds });
    },
    render(ctx, inp) {
      const e = game.t - pd.t0;
      bgFill(ctx, W, H, '#dccbff', '#ffd3e8'); stripes(ctx, W, H, game.t);
      // spotlights
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [x, a] of [[640, 0.16], [420, 0.08], [860, 0.08]]) {
        const g = ctx.createRadialGradient(x, 420, 10, x, 420, 300); g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      text(ctx, '최종 순위', W / 2, 86, { size: 62, title: true, align: 'center', color: COL.accent, stroke: COL.ink, strokeW: 12 });
      const slots = { 0: { x: 640, h: 200 }, 1: { x: 420, h: 140 }, 2: { x: 860, h: 95 }, 3: { x: 1090, h: 70 } };
      // stage floor
      card(ctx, { x: 150, y: 566, w: 1060, h: 60 }, { fill: '#fff4fb', raw: true, r: 30, lw: 4.5 });
      const order = [0, 1, 2, 3].sort((a, b) => pd.place[a] - pd.place[b] || a - b);
      const used = {};
      order.forEach((i) => {
        let pIdx = pd.place[i];
        while (used[pIdx] && pIdx < 3) pIdx++;
        used[pIdx] = true;
        const s = slots[pIdx], base = 572;
        const rise = easeOutBack(clamp((e - 0.3 - (3 - pIdx) * 0.25) / 0.5, 0, 1));
        const top = base - s.h * rise;
        card(ctx, { x: s.x - 105, y: top, w: 210, h: base - top + 26 }, { fill: pIdx === 3 ? COL.panel : game.players[i].color, r: 32, lw: 4.5 });
        text(ctx, (pd.place[i] + 1) + '등', s.x, top + 62, { size: 46, title: true, align: 'center', color: pd.place[i] === 0 ? COL.accent : '#fff', stroke: COL.ink, strokeW: 9 });
        game.drawPlayer(ctx, i, s.x, top, pd.place[i] === 0 ? 170 : 130, { expr: pd.place[i] === 0 ? 'win' : pd.place[i] === 3 ? 'lose' : 'idle', tag: true });
        text(ctx, game.players[i].name + '  ' + M.scores[i] + '점', s.x, top + 100, { size: 21, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 6 });
      });
      // confetti computed from time only (nothing to sync online)
      const CC = ['#ffcf3a', '#e8473f', '#5ed0d6', '#79c66b', '#f3a3c0', '#4c6fc4'];
      for (let k = 0; k < 140; k++) {
        const h1 = Math.sin(k * 12.9898) * 43758.5453, r1 = h1 - Math.floor(h1), h2 = Math.sin(k * 78.233) * 12345.678, r2 = h2 - Math.floor(h2);
        const vy = 80 + r2 * 140, span = H + 40, y = ((r1 * span + e * vy) % span) - 20, x = (r1 * 997 + r2 * 311 + e * (r2 - 0.5) * 80) % W;
        const sz = 5 + r2 * 6;
        ctx.save(); ctx.translate((x + W) % W, y); ctx.rotate(e * 4 + k); ctx.fillStyle = CC[k % 6]; ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
      }
      if (e > 2 && canControl()) {
        if (button(ctx, inp, { x: W / 2 - 340, y: 650, w: 320, h: 54 }, '다시 하기 (Space)', { primary: true, size: 22 })) game.go('matchStart', { rounds: M.rounds });
        if (button(ctx, inp, { x: W / 2 + 20, y: 650, w: 320, h: 54 }, online() ? '대기실로' : '처음으로', { size: 22 })) { if (online()) game.online.toRoom(); else game.go('title'); }
      } else if (e > 2) waitText(ctx, '방장이 다시 할지 고르는 중...');
      const winnerIdx = order[0];
      if (e > 1.2) text(ctx, (online() ? game.players[winnerIdx].name : game.players[winnerIdx].charName) + ' 우승!', W / 2, 150, { size: 36, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 9 });
    },
  };

  function waitText(ctx, msg = '방장이 넘기거나 잠시 뒤 자동으로 넘어갑니다') {
    card(ctx, { x: W / 2 - 300, y: 650, w: 600, h: 50 }, { r: 25, shadow: 4 });
    text(ctx, msg, W / 2, 682, { size: 19, title: true, align: 'center', color: COL.soft });
  }

  // ---------- online sync: the host sends this state, other players draw it ----------
  const NAMES = ['roulette', 'intro', 'play', 'result', 'standings', 'podium'];
  const sync = {
    isMatch: (name) => NAMES.includes(name),
    build() {
      const sc = game.sceneName;
      return {
        scene: sc,
        M: { rounds: M.rounds, round: M.round, queue: M.queue, scores: M.scores, prevScores: M.prevScores, practice: false, fixed: null, mgId: M.mg ? M.mg.id : null },
        S: { rl, it, pl, rs, sd, pd },
        st: sc === 'play' || sc === 'result' ? M.st : null,
      };
    },
    apply(s) {
      Object.assign(M, s.M);
      M.mg = s.M.mgId ? byId(s.M.mgId) : null;
      if (s.st) M.st = s.st;
      ({ rl, it, pl, rs, sd, pd } = s.S);
    },
    clientUpdate(inp) { if (inp.escP) { paused = !paused; sfx.click(); } },
  };

  return { matchStart, roulette, intro, play, result, standings, podium, practiceEnd, __sync: sync };
}

// Big centered word on a dark band; thin outline so letter holes stay open
function bigBanner(ctx, str, scale, alpha, color, size) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(W / 2, H / 2); ctx.scale(scale, scale);
  // round puffy word: dark shadow, thick dark outline, white rim, then the color
  text(ctx, str, 0, size * 0.1, { size, title: true, align: 'center', base: 'middle', color: 'rgba(25,12,70,0.5)', stroke: 'rgba(25,12,70,0.5)', strokeW: size * 0.2 });
  text(ctx, str, 0, 0, { size, title: true, align: 'center', base: 'middle', color, stroke: COL.ink, strokeW: size * 0.2 });
  ctx.restore();
}

export function placesFrom(scores) {
  const order = [0, 1, 2, 3].sort((a, b) => scores[b] - scores[a]);
  const place = [];
  order.forEach((p, k) => {
    if (k > 0 && Math.abs(scores[p] - scores[order[k - 1]]) < 1e-9) place[p] = place[order[k - 1]];
    else place[p] = k;
  });
  return place;
}
function measureW(ctx, s, size) { ctx.save(); ctx.font = `900 ${size}px ${FONT}`; const w = ctx.measureText(s).width; ctx.restore(); return w; }
