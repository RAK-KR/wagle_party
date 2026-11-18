// Helpers shared by minigames
import { W, H, COL } from '../config.js';
import { shade } from '../characters.js';
import { text } from '../ui.js';

// difficulty index 0 easy, 1 normal, 2 hard
export const dk = (game) => Math.max(0, Math.min(2, Math.round(game.diff.k * 3) - 1));
export const byDiff = (game, arr) => arr[dk(game)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// 2x2 split-screen panels below the HUD bar
export const QW = 628, QH = 316;
export function quad(i) { return { x: 8 + (i % 2) * 636, y: 52 + Math.floor(i / 2) * 334, w: QW, h: QH }; }

export function panelHeader(ctx, game, i, right = '', mid = '') {
  const p = game.players[i];
  ctx.fillStyle = 'rgba(27,24,36,0.8)'; ctx.fillRect(0, 0, QW, 30);
  ctx.fillStyle = p.color; ctx.fillRect(0, 0, 6, 30);
  text(ctx, p.name, 16, 21, { size: 16, weight: 900, color: p.color });
  if (mid) text(ctx, mid, QW / 2, 21, { size: 15, weight: 800, align: 'center', color: COL.sub });
  if (right) text(ctx, right, QW - 14, 22, { size: 18, weight: 900, align: 'right', color: COL.accent });
}
export function panelFrame(ctx, game, i) {
  const r = quad(i), p = game.players[i], me = i === game.local && !game.auto;
  ctx.strokeStyle = me ? p.color : 'rgba(255,255,255,0.08)'; ctx.lineWidth = me ? 4 : 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}
// run fn inside panel i with clipping and local coordinates
export function inPanel(ctx, i, fn) {
  const r = quad(i);
  ctx.save(); ctx.translate(r.x, r.y); ctx.beginPath(); ctx.rect(0, 0, r.w, r.h); ctx.clip();
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
export { shade, text, COL, W, H };
