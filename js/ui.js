// Canvas UI helpers
import { FONT, FONT_T, COL } from './config.js';

export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.weight || 700} ${o.size || 20}px ${o.title ? FONT_T : FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || 6; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(str, x, y + (o.shadowY || 4)); }
  ctx.fillStyle = o.color || COL.text;
  ctx.fillText(str, x, y);
  ctx.restore();
}
export function measure(ctx, str, size, weight = 700, title = false) {
  ctx.save(); ctx.font = `${weight} ${size}px ${title ? FONT_T : FONT}`; const w = ctx.measureText(str).width; ctx.restore(); return w;
}
export function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

export function panel(ctx, r, fill = COL.panel, stripe) {
  ctx.fillStyle = fill; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (stripe) { ctx.fillStyle = stripe; ctx.fillRect(r.x, r.y, 6, r.h); }
}

// Draw button; returns true when clicked this frame
export function button(ctx, inp, r, label, o = {}) {
  const hot = !o.disabled && inRect(r, inp.px, inp.py) && !inp.touch;
  const sel = o.selected;
  ctx.save();
  ctx.fillStyle = o.disabled ? '#24202c' : sel ? (o.color || COL.accent) : hot ? COL.line : (o.primary ? (o.color || COL.accent) : COL.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (o.focus) { ctx.strokeStyle = COL.text; ctx.lineWidth = 3; ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3); }
  if (!sel && !o.primary && !o.disabled) { ctx.fillStyle = o.color || COL.accent; ctx.fillRect(r.x, r.y, 4, r.h); }
  const dark = (sel || o.primary) && !o.disabled;
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: o.size || 22, weight: 800, align: 'center', base: 'middle', color: o.disabled ? '#5c5568' : dark ? '#1b1824' : COL.text });
  if (o.sub) text(ctx, o.sub, r.x + r.w / 2, r.y + r.h - 12, { size: 13, weight: 600, align: 'center', color: dark ? '#3a3020' : COL.dim });
  ctx.restore();
  return !o.disabled && inp.pP && inRect(r, inp.px, inp.py);
}

export function bgFill(ctx, w, h, c1 = '#221d2e', c2 = '#15121c') {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// Diagonal stripe pattern background (decorative)
export function stripes(ctx, w, h, t, col = 'rgba(255,255,255,0.025)', gap = 60) {
  ctx.save(); ctx.fillStyle = col;
  const off = (t * 20) % (gap * 2);
  for (let x = -h - gap * 2 + off; x < w + h; x += gap * 2) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + gap, 0); ctx.lineTo(x + gap - h, h); ctx.lineTo(x - h, h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
export function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
