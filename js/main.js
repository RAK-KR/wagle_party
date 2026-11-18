// Boot, main loop, shared game context
import { W, H, COL, DIFFS } from './config.js';
import { initInput, readInput, endFrame, setView, drawTouchUI, touchMode } from './input.js';
import { unlock, toggleMute } from './audio.js';
import { createOnline, playEvent } from './online.js';
import { onlineScene, roomScene } from './scenes/lobby.js';
import { chatOpen, openChat } from './chat.js';
import { drawCharacter, ROSTER } from './characters.js';
import { createEmotes } from './emotes.js';
import { titleScene, selectScene, practiceScene } from './scenes/menu.js';
import { matchScenes } from './scenes/match.js';
import { text } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);

const game = {
  t: 0, local: 0,
  players: [],
  diff: DIFFS[1], rounds: 6,
  anchors: [null, null, null, null],
  auto: params.get('auto') === '1',   // test mode: local player is driven by a bot
  speed: Number(params.get('speed') || 1),
  scene: null, scenes: {},
  sceneName: '',
  localIn: null, remoteIn: [null, null, null, null],
  sfxQ: [],
};
game.emotes = createEmotes(game);
game.online = createOnline(game);

// Sound events from the game logic. Offline: just play. Online host: play for itself and send to the others.
// who: null = everyone, a seat number = only that player, ~seat = everyone except that player
game.sfx = (name, who = null, arg, delay = 0) => {
  const on = game.online;
  if (on.role === 'client') return;
  playEvent([name, who, arg, delay], game.local);
  if (on.role === 'host') game.sfxQ.push([name, who ?? null, arg ?? null, delay || 0]);
};
// input of a human player: this device, or what a remote player sent
game.inputFor = (i) => (i === game.local ? game.localIn : game.remoteIn[i]);

game.setPlayers = (localChar, rngPick) => {
  const others = ROSTER.map(c => c.id).filter(id => id !== localChar);
  const picks = rngPick(others);
  const list = [localChar, ...picks.slice(0, 3)];
  game.players = list.map((id, i) => {
    const c = ROSTER.find(r => r.id === id);
    return { char: id, color: c.color, name: i === 0 ? '나' : c.name, charName: c.name, bot: i !== 0 || game.auto };
  });
};

// Draw a player's character; records head anchor for emote bubbles and applies emote poses.
game.drawPlayer = (c, i, x, y, size, opts = {}) => {
  const p = game.players[i];
  if (!p || !p.char) return;
  const m = opts.noEmote ? null : game.emotes.mod(i);
  let expr = opts.expr || 'idle', hop = 0, rot = 0, facing = opts.facing || 1;
  if (m) { if (!opts.lockExpr) expr = m.expr; hop = m.hop || 0; rot = m.rot || 0; if (m.flip) facing *= m.flip; }
  if (opts.rot) rot += opts.rot;
  if (opts.ring) {
    c.save(); c.strokeStyle = p.color; c.lineWidth = Math.max(2, size * 0.05); c.globalAlpha = 0.9;
    c.beginPath(); c.ellipse(x, y, size * 0.5, size * 0.13, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  c.save();
  c.translate(x, y - hop * size - (opts.pivot ? size * 0.4 : 0));
  if (rot) c.rotate(rot);
  if (opts.alpha != null) c.globalAlpha = opts.alpha;
  drawCharacter(c, p.char, 0, opts.pivot ? size * 0.4 : 0, size, { t: game.t + i * 0.37, expr, facing, noShadow: opts.noShadow });
  c.restore();
  const top = y - size * 1.0 - hop * size;
  game.anchors[i] = { x, y: top, s: size };
  if (opts.tag && i === game.local && !game.auto) {
    const ty = top - 6 - Math.abs(Math.sin(game.t * 4)) * 4;
    c.save(); c.fillStyle = p.color; c.strokeStyle = '#1b1824'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - 9, ty - 12); c.lineTo(x + 9, ty - 12); c.lineTo(x, ty); c.closePath(); c.stroke(); c.fill();
    c.restore();
    text(c, '나', x, ty - 17, { size: 14, weight: 900, align: 'center', color: p.color, stroke: '#1b1824', strokeW: 4 });
  }
};

game.go = (name, args) => {
  const s = game.scenes[name];
  if (game.scene && game.scene !== s) game.scene.exit?.();
  game.scene = s; game.sceneName = name; game.anchors = [null, null, null, null];
  s.enter?.(args);
};

const ms = matchScenes(game);
game.matchSync = ms.__sync; delete ms.__sync;
Object.assign(game.scenes, {
  title: titleScene(game), select: selectScene(game), practice: practiceScene(game),
  online: onlineScene(game), room: roomScene(game),
  ...ms,
});

// ---- sizing ----
let dpr = 1, scale = 1, ox = 0, oy = 0;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.floor(cw * dpr); canvas.height = Math.floor(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  scale = Math.min(cw / W, ch / H);
  ox = (cw - W * scale) / 2; oy = (ch - H * scale) / 2;
  setView(scale, ox, oy);
}
window.addEventListener('resize', resize);
resize();
initInput(canvas);
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));

let last = performance.now();
let errorShown = null;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  try {
    const inp = readInput();
    game.localIn = inp;
    if (inp.mP) toggleMute();
    const on = game.online;
    if (on.role) on.beginFrame(inp);
    const sceneBefore = game.scene;
    if (on.role === 'client' && on.following) {
      // online guest during a match: the host runs the game, we draw its state
      const used = game.emotes.handleLocal(inp);
      if (used) inp.pP = false;
      game.matchSync.clientUpdate(inp);
      on.clientApply();
    } else {
      const steps = game.speed > 1 ? Math.round(game.speed) : 1;
      for (let k = 0; k < steps; k++) {
        game.t += dt;
        // extra fast-forward steps must not repeat this frame's presses
        const sInp = k === 0 ? inp : { ...inp, aP: false, pP: false, escP: false, gP: false, leftP: false, rightP: false, upP: false, downP: false, emoteTouchP: false };
        const used = game.scene.allowEmote === false ? false : game.emotes.handleLocal(sInp);
        if (used) sInp.pP = false;
        game.scene.update(dt, sInp);
        if (k === 0 && on.role === 'host') game.remoteIn = [null, null, null, null];  // remote presses count once
      }
    }
    if (on.role && on.lobby && game.matchSync.isMatch(game.sceneName) && inp.enterP && !chatOpen()) openChat((t) => on.sendChat(t));
    // a key/click that already changed the scene in update must not also click the new scene's buttons
    if (game.scene !== sceneBefore) { inp.pP = false; inp.aP = false; }
    // draw
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#cbbdf2'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    game.anchors = [null, null, null, null];
    game.scene.render(ctx, inp);
    game.emotes.drawBubbles(ctx, game.anchors);
    on.drawOverlay(ctx);
    game.scene.renderOverlay?.(ctx, inp);
    drawTouchUI(ctx, game.scene.allowEmote !== false);
    game.emotes.drawWheel(ctx);
    if (touchMode() && window.innerHeight > window.innerWidth) {
      ctx.fillStyle = 'rgba(14,12,19,0.94)'; ctx.fillRect(0, 0, W, H);
      text(ctx, '화면을 가로로 돌려 주세요', W / 2, H / 2, { size: 48, weight: 900, align: 'center', base: 'middle' });
    }
    ctx.restore();
    if (on.role === 'host') on.endFrame();
    endFrame();
  } catch (err) {
    if (!errorShown) { errorShown = err; console.error(err); }
    endFrame();
  }
}

game.go('title');
requestAnimationFrame(frame);
// make sure the round font is ready for canvas text
try { document.fonts.load("40px 'Jua'"); document.fonts.load("40px 'Jua'", '가나다'); } catch (e) { }
window.__wagle = game;
