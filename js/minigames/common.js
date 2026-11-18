// Helpers shared by minigames
import { W, H, COL } from '../config.js';
import { shade } from '../characters.js';
import { text, rr, measure, card, pastel, bgFill } from '../ui.js';

// difficulty index 0 easy, 1 normal, 2 hard
export const dk = (game) => Math.max(0, Math.min(2, Math.round(game.diff.k * 3) - 1));
export const byDiff = (game, arr) => arr[dk(game)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// ---- pastel theme helpers ----
export const INK = COL.ink;
// soft full-screen background
export function softBg(ctx, c1 = '#e6ddff', c2 = '#d3ecfb') { bgFill(ctx, W, H, c1, c2); }
// rounded card tinted with a player's color
export function pcard(ctx, game, i, x, y, w, h, o = {}) {
  card(ctx, { x, y, w, h }, { fill: pastel(game.players[i].color, o.k ?? 0.55), raw: true, r: o.r ?? 24, lw: o.lw ?? 3.5, shadow: o.shadow ?? 4, alpha: o.alpha });
}
// plain rounded card (light)
export function scard(ctx, x, y, w, h, o = {}) {
  card(ctx, { x, y, w, h }, { fill: o.fill || '#fbf8ff', raw: true, r: o.r ?? 22, lw: o.lw ?? 3.5, shadow: o.shadow ?? 4, alpha: o.alpha, gloss: o.gloss });
}
// white name text with ink outline
export function nameText(ctx, str, x, y, size = 18, align = 'center') {
  text(ctx, str, x, y, { size, title: true, align, color: '#fff', stroke: INK, strokeW: Math.max(3, size * 0.25) });
}
// small pill in the middle of the top bar
export function hudPill(ctx, str, color = '#ffd76e') {
  const w = measure(ctx, str, 20, 400, true) + 34;
  card(ctx, { x: W / 2 - w / 2, y: 7, w, h: 32 }, { fill: pastel(color, 0.5), raw: true, r: 16, lw: 3, shadow: 0, gloss: false });
  text(ctx, str, W / 2, 31, { size: 20, title: true, align: "center", color: INK });
}

// small score chip: name on the left, value on the right
export function chip(ctx, game, i, x, y, w, h, value, hot = false) {
  const p = game.players[i];
  card(ctx, { x, y, w, h }, { fill: hot ? '#ffe28a' : pastel(p.color, 0.6), raw: true, r: h / 2, lw: 3, shadow: 3, gloss: false });
  text(ctx, p.name, x + 14, y + h / 2 + 6, { size: 16, title: true, color: '#fff', stroke: INK, strokeW: 4 });
  text(ctx, String(value), x + w - 14, y + h / 2 + 7, { size: 18, title: true, align: 'right', color: INK });
}

// 2x2 split-screen panels below the HUD bar
export const QW = 628, QH = 316;
export function quad(i) { return { x: 8 + (i % 2) * 636, y: 52 + Math.floor(i / 2) * 334, w: QW, h: QH }; }

export function panelHeader(ctx, game, i, right = '', mid = '') {
  const p = game.players[i];
  // rounded name pill on the left, value pill on the right
  ctx.font = `20px 'Jua', sans-serif`;
  const nw = Math.max(70, ctx.measureText(p.name).width + 30);
  ctx.fillStyle = p.color; ctx.strokeStyle = COL.ink; ctx.lineWidth = 3;
  rr(ctx, 6, 4, nw, 26, 13); ctx.fill(); ctx.stroke();
  text(ctx, p.name, 6 + nw / 2, 24, { size: 17, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 4 });
  if (mid) text(ctx, mid, QW / 2, 24, { size: 16, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 4 });
  if (right) {
    ctx.font = `20px 'Jua', sans-serif`;
    const rw = ctx.measureText(String(right)).width + 28;
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; rr(ctx, QW - rw - 6, 4, rw, 26, 13); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, right, QW - 6 - rw / 2, 24, { size: 18, title: true, align: 'center', color: INK });
  }
}
export function panelFrame(ctx, game, i) {
  const r = quad(i), p = game.players[i], me = i === game.local && !game.auto;
  ctx.strokeStyle = me ? p.color : COL.ink; ctx.lineWidth = me ? 5 : 4;
  rr(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 18); ctx.stroke();
}
// run fn inside panel i with clipping and local coordinates
export function inPanel(ctx, i, fn) {
  const r = quad(i);
  ctx.save(); ctx.translate(r.x, r.y); rr(ctx, 3, 3, r.w - 6, r.h - 6, 18); ctx.clip();
  fn(r); ctx.restore();
}

export function vgrad(ctx, y0, y1, c0, c1, x = 0, w = W) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(x, y0, w, y1 - y0);
}

// survival style scoring: alive => 1000, else time of death
export function survivalScores(list) { return list.map(p => p.alive ? 1000 : Math.round(p.deathT * 100) / 100); }

// finish-order scoring: finished earlier is better, unfinished ranked by progress (0..1)
export function raceScores(list) { return list.map(p => p.finishT != null ? 10000 - p.finishT : p.progress * 100); }

export function star(ctx, x, y, r, col = '#ffcf3a', stroke = '#9a6b00') {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.stroke();
}
export function coin(ctx, x, y, r, t = 0) {
  const sx = Math.abs(Math.cos(t * 4)) * 0.7 + 0.3;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  ctx.fillStyle = '#c98a00'; ctx.beginPath(); ctx.arc(0, 2, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8a800'; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.2, r * 0.32, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function crown(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-18, 8); ctx.lineTo(-20, -10); ctx.lineTo(-9, -1); ctx.lineTo(0, -14); ctx.lineTo(9, -1); ctx.lineTo(20, -10); ctx.lineTo(18, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8473f'; ctx.beginPath(); ctx.arc(0, 2, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5ed0d6'; ctx.beginPath(); ctx.arc(-10, 3, 2.4, 0, Math.PI * 2); ctx.arc(10, 3, 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export { shade, text, COL, W, H, rr, pastel };
