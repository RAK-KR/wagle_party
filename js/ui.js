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

// rounded path
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, h / 2, w / 2))); }

// rounded card with a soft drop and a dark outline
export function card(ctx, r, o = {}) {
  const rad = o.r ?? 20, sh = o.shadow ?? 6;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (sh) { ctx.fillStyle = o.shadowColor || 'rgba(70,50,140,0.2)'; rr(ctx, r.x, r.y + sh, r.w, r.h, rad); ctx.fill(); }
  ctx.fillStyle = o.raw ? (o.fill || COL.panel) : pastel(o.fill || COL.panel, 0.3); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill();
  if (o.gloss !== false) {   // soft light on the top half
    ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h * 0.55); ctx.restore();
  }
  if (o.lw !== 0) { ctx.lineWidth = o.lw ?? 3.5; ctx.strokeStyle = o.stroke || COL.ink; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.stroke(); }
  ctx.restore();
}
export function panel(ctx, r, fill = COL.panel) { card(ctx, r, { fill }); }

function lighten(hex, a) {
  if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  const n = parseInt(hex.slice(1, 7), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(a >= 0 ? v + (255 - v) * a : v * (1 + a)));
  return `rgb(${c.join(',')})`;
}

// Chunky rounded button with a bottom edge; returns true when clicked this frame
export function button(ctx, inp, r, label, o = {}) {
  const hot = !o.disabled && inRect(r, inp.px, inp.py) && !inp.touch;
  const down = hot && inp.pDown;
  const base = o.disabled ? '#b9b2d6' : (o.selected || o.primary) ? (o.color || COL.accent) : hot ? COL.line : COL.panel2;
  const lip = 6, rad = o.r ?? Math.min(22, r.h / 2), dy = down ? lip - 1 : hot ? -1 : 0;
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.7;
  // shadow + edge
  ctx.fillStyle = 'rgba(60,40,120,0.18)'; rr(ctx, r.x, r.y + lip + 3, r.w, r.h, rad); ctx.fill();
  ctx.fillStyle = lighten(base.startsWith('#') ? base : '#c4b5fd', -0.22); rr(ctx, r.x, r.y + lip, r.w, r.h, rad); ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = COL.ink; ctx.stroke();
  // face
  ctx.fillStyle = base; rr(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.fill(); ctx.stroke();
  ctx.save(); rr(ctx, r.x, r.y + dy, r.w, r.h, rad); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, r.x + 8, r.y + dy + 5, r.w - 16, r.h * 0.32, rad); ctx.fill();
  ctx.restore();
  if (o.focus) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; rr(ctx, r.x - 5, r.y + dy - 5, r.w + 10, r.h + 10, rad + 5); ctx.stroke(); }
  const dark = (o.selected || o.primary) && !o.disabled && isLight(o.color || COL.accent);
  text(ctx, label, r.x + r.w / 2, r.y + dy + r.h / 2 + 2, { size: o.size || 22, title: true, align: 'center', base: 'middle', color: dark ? COL.ink : '#fff', stroke: dark ? null : COL.ink, strokeW: 5 });
  ctx.restore();
  return !o.disabled && inp.pP && inRect(r, inp.px, inp.py);
}
function isLight(hex) {
  if (!hex.startsWith('#')) return false;
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

// bright party background; tint shifts the colors toward a minigame/character color
export function bgFill(ctx, w, h, c1 = '#d4c6ff', c2 = '#bfe4fb') {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
export function tintBg(color) { return [lighten(color, 0.42), lighten(color, 0.72)]; }
// soften a saturated color into its pastel version
export function pastel(c, a = 0.32) { return typeof c === 'string' && c.startsWith('#') ? lighten(c, a) : c; }

// floating soft bubbles and little stars (replaces the old stripes)
export function stripes(ctx, w, h, t) {
  ctx.save();
  for (let k = 0; k < 22; k++) {
    const sx = (k * 197.3) % w, sp = 12 + (k % 5) * 6, r = 14 + (k * 37 % 46);
    const y = h + 60 - ((t * sp + k * 131) % (h + 140));
    const x = sx + Math.sin(t * 0.6 + k) * 18;
    ctx.fillStyle = `rgba(255,255,255,${0.06 + (k % 3) * 0.03})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let k = 0; k < 14; k++) {
    const x = (k * 311.7) % w, y = (k * 173.1 + 40) % h, tw = 0.5 + 0.5 * Math.sin(t * 2 + k * 1.7);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.45})`;
    const s = 3 + tw * 3;
    ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.quadraticCurveTo(x, y, x + s * 2, y); ctx.quadraticCurveTo(x, y, x, y + s * 2); ctx.quadraticCurveTo(x, y, x - s * 2, y); ctx.quadraticCurveTo(x, y, x, y - s * 2); ctx.fill();
  }
  ctx.restore();
}

export function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
export function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
