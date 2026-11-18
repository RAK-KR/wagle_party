// Local input: keyboard, mouse, touch (virtual stick + buttons). Produces one input object per frame.
import { W, H, FONT } from './config.js';

const view = { scale: 1, ox: 0, oy: 0 };
export function setView(scale, ox, oy) { view.scale = scale; view.ox = ox; view.oy = oy; }
export function getView() { return view; }   // screen position of the 1280x720 game area
function toLogical(cx, cy) { return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale }; }

const keys = new Set();
const pressed = new Set();
const released = new Set();
const ptr = { x: W / 2, y: H / 2, down: false, p: false, r: false, moved: false };
let isTouch = false;
let touchLayout = { stick: false, a: false };
const STICK = { x: 150, y: 575, r: 92 };
const ABTN = { x: 1135, y: 585, r: 70 };
const EBTN = { x: 1210, y: 450, r: 40 };
const MBTN = { x: 44, y: 40, r: 26 };
const touches = new Map(); // id -> role
const stick = { active: false, id: null, dx: 0, dy: 0 };
let touchA = false, touchEmoteP = false;

const MAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  a: ['Space', 'KeyJ', 'KeyZ'],
};
const any = (list) => list.some(k => keys.has(k));
const anyP = (list) => list.some(k => pressed.has(k));
const anyR = (list) => list.some(k => released.has(k));

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    isTouch = false;
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); released.add(e.code); });
  window.addEventListener('blur', () => { keys.clear(); ptr.down = false; stick.active = false; touchA = false; touches.clear(); });

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const p = toLogical(e.clientX, e.clientY);
    if (e.pointerType === 'touch') {
      isTouch = true;
      let role = 'free';
      if (dist(p, MBTN) < MBTN.r + 14) { role = 'menu'; pressed.add('Escape'); }
      else if (dist(p, EBTN) < EBTN.r + 14) { role = 'emote'; touchEmoteP = true; }
      else if (touchLayout.a && dist(p, ABTN) < ABTN.r + 30) { role = 'a'; touchA = true; pressed.add('TouchA'); }
      else if (touchLayout.stick && p.x < W * 0.42 && p.y > H * 0.38 && !stick.active) {
        role = 'stick'; stick.active = true; stick.id = e.pointerId; stick.dx = 0; stick.dy = 0;
        STICK.x = Math.max(110, Math.min(W * 0.36, p.x)); STICK.y = Math.max(H * 0.5, Math.min(H - 100, p.y));
      }
      touches.set(e.pointerId, role);
      if (role !== 'free') return;
    } else isTouch = false;
    ptr.x = p.x; ptr.y = p.y; ptr.down = true; ptr.p = true; ptr.id = e.pointerId;
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toLogical(e.clientX, e.clientY);
    const role = touches.get(e.pointerId);
    if (role === 'stick') {
      let dx = (p.x - STICK.x) / STICK.r, dy = (p.y - STICK.y) / STICK.r;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      stick.dx = dx; stick.dy = dy; return;
    }
    if (role && role !== 'free') return;
    ptr.x = p.x; ptr.y = p.y; ptr.moved = true;
  });
  const up = (e) => {
    const role = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (role === 'stick') { stick.active = false; stick.dx = 0; stick.dy = 0; return; }
    if (role === 'a') { touchA = false; released.add('TouchA'); return; }
    if (role && role !== 'free') return;
    if (ptr.id === e.pointerId || e.pointerType !== 'touch') { ptr.down = false; ptr.r = true; }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function setTouchLayout(layout) { touchLayout = layout; }
export function touchMode() { return isTouch; }

// Build this frame's input snapshot
export function readInput() {
  let mx = (any(MAP.right) ? 1 : 0) - (any(MAP.left) ? 1 : 0);
  let my = (any(MAP.down) ? 1 : 0) - (any(MAP.up) ? 1 : 0);
  if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
  if (stick.active) {
    const l = Math.hypot(stick.dx, stick.dy);
    if (l > 0.18) { mx = stick.dx; my = stick.dy; }
  }
  return {
    mx, my,
    a: any(MAP.a) || touchA, aP: anyP(MAP.a) || pressed.has('TouchA'), aR: anyR(MAP.a) || released.has('TouchA'),
    upP: anyP(MAP.up), downP: anyP(MAP.down), leftP: anyP(MAP.left), rightP: anyP(MAP.right),
    px: ptr.x, py: ptr.y, pDown: ptr.down, pP: ptr.p, pR: ptr.r,
    gDown: keys.has('KeyG'), gP: pressed.has('KeyG'), gR: released.has('KeyG'),
    escP: pressed.has('Escape'), mP: pressed.has('KeyM'), hP: pressed.has('KeyH'), enterP: pressed.has('Enter') || pressed.has('NumpadEnter'),
    emoteTouchP: touchEmoteP, touch: isTouch,
  };
}
export function endFrame() { pressed.clear(); released.clear(); ptr.p = false; ptr.r = false; ptr.moved = false; touchEmoteP = false; }
export function consumePointer() { ptr.p = false; }

// Virtual controls drawing (only on touch devices)
export function drawTouchUI(ctx, showEmote = true) {
  if (!isTouch) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  // menu
  circle(ctx, MBTN, 'rgba(251,248,255,0.85)', '#43386e');
  ctx.fillStyle = '#43386e'; for (let i = -1; i <= 1; i++) ctx.fillRect(MBTN.x - 10, MBTN.y + i * 7 - 1.5, 20, 3);
  if (showEmote) {
    circle(ctx, EBTN, 'rgba(251,248,255,0.85)', '#43386e');
    ctx.fillStyle = '#43386e'; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('감정', EBTN.x, EBTN.y);
  }
  if (touchLayout.stick) {
    circle(ctx, STICK, 'rgba(251,248,255,0.45)', 'rgba(67,56,110,0.6)');
    circle(ctx, { x: STICK.x + stick.dx * STICK.r * 0.6, y: STICK.y + stick.dy * STICK.r * 0.6, r: 38 }, 'rgba(196,181,253,0.85)', '#43386e');
  }
  if (touchLayout.a) {
    circle(ctx, ABTN, touchA ? 'rgba(255,215,110,0.95)' : 'rgba(255,215,110,0.7)', '#43386e');
    ctx.fillStyle = '#43386e'; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(touchLayout.aLabel || 'A', ABTN.x, ABTN.y + 1);
  }
  ctx.restore();
}
function circle(ctx, c, fill, stroke) {
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
}
