// Emotes: radial wheel (hold G, flick direction, release) like TWIN RIFT, plus speech bubbles over characters.
import { FONT, FONT_T, COL, W, H } from './config.js';
import { sfx } from './audio.js';

export const EMOTES = [
  { k: 'thumb', name: '따봉' }, { k: 'heart', name: '하트' }, { k: 'lol', name: 'ㅋㅋㅋ' },
  { k: 'what', name: '물음표' }, { k: 'sorry', name: '미안' }, { k: 'dance', name: '춤' },
];
const DUR = { dance: 3.2 };
const dur = (k) => DUR[k] || 2.6;

export function drawEmoteIcon(ctx, k, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (k === 'thumb') {
    ctx.fillStyle = '#ffd36b'; ctx.strokeStyle = '#7a4a12'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(-3, -9); ctx.quadraticCurveTo(-3, -13, 0.5, -13); ctx.quadraticCurveTo(4, -13, 4, -9); ctx.lineTo(4, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(7, -2); ctx.quadraticCurveTo(10, -2, 10, 1); ctx.lineTo(10, 8); ctx.quadraticCurveTo(10, 11, 7, 11); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (const yy of [2, 5, 8]) { ctx.moveTo(3, yy); ctx.lineTo(10, yy); } ctx.stroke();
    ctx.fillStyle = '#4db8ff'; ctx.fillRect(-11, -3, 5, 15); ctx.strokeRect(-11, -3, 5, 15);
  } else if (k === 'heart') {
    const b = 1 + Math.sin(t * 10) * 0.07; ctx.scale(b, b);
    ctx.fillStyle = '#ff4d6d'; ctx.strokeStyle = '#8a1a33'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-14, 1, -10, -12, 0, -4); ctx.bezierCurveTo(10, -12, 14, 1, 0, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-5, -3, 2.4, 1.5, -0.6, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'lol' || k === 'what' || k === 'sorry') {
    const txt = k === 'lol' ? 'ㅋㅋㅋ' : k === 'what' ? '?' : '미안';
    ctx.font = `${k === 'what' ? 30 : 17}px ${FONT_T}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wob = k === 'lol' ? Math.sin(t * 16) * 1.5 : 0;
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(txt, 0, 1 + wob);
    ctx.fillStyle = k === 'lol' ? '#e0457b' : k === 'what' ? '#3a6df0' : '#5a6478';
    ctx.fillText(txt, 0, 1 + wob);
    if (k === 'sorry') { ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.ellipse(15, -8, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (k === 'dance') {
    const r = Math.sin(t * 8) * 0.25; ctx.rotate(r);
    ctx.fillStyle = '#2a2433';
    ctx.beginPath(); ctx.ellipse(-5, 7, 4.5, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, 4, 4.5, 3.5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-1.5, -10, 2.4, 17); ctx.fillRect(11.5, -13, 2.4, 17);
    ctx.beginPath(); ctx.moveTo(-1.5, -10); ctx.lineTo(13.9, -13); ctx.lineTo(13.9, -8); ctx.lineTo(-1.5, -5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function createEmotes(game) {
  const active = [null, null, null, null];
  const lastAt = [-9, -9, -9, -9];
  const wheel = { open: false, mode: 'hold', sx: 0, sy: 0, sel: -1, openT: 0 };
  const CX = W / 2, CY = H / 2, R1 = 64, R2 = 160;

  function trigger(i, k) {
    if (game.t - lastAt[i] < 0.5) return;
    lastAt[i] = game.t;
    active[i] = { k, t0: game.t };
    if (i === game.local) sfx.emote();
    game.net?.sendEmote?.(i, k);
  }
  function current(i) {
    const a = active[i];
    if (!a) return null;
    if (game.t - a.t0 > dur(a.k)) { active[i] = null; return null; }
    return a;
  }
  // how an emote changes the character's pose
  function mod(i) {
    const a = current(i);
    if (!a) return null;
    const e = game.t - a.t0;
    switch (a.k) {
      case 'dance': return { expr: 'win', hop: Math.abs(Math.sin(e * 8)) * 0.16, rot: Math.sin(e * 8) * 0.18, flip: Math.floor(e * 2.5) % 2 ? -1 : 1 };
      case 'thumb': case 'heart': return { expr: 'win', hop: e < 0.4 ? Math.sin(e / 0.4 * Math.PI) * 0.12 : 0 };
      case 'lol': return { expr: 'win', hop: Math.abs(Math.sin(e * 14)) * 0.04 };
      case 'what': return { expr: 'idle', rot: 0.16 };
      case 'sorry': return { expr: 'lose', rot: -0.06 };
    }
    return null;
  }

  function slotAt(dx, dy) {
    const ang = Math.atan2(dy, dx); // slot 0 at top, clockwise
    let a = ang + Math.PI / 2 + Math.PI / 6;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(a / (Math.PI / 3)) % 6;
  }

  // returns true when the wheel used the pointer click this frame
  function handleLocal(inp) {
    const t = game.t;
    if (inp.emoteTouchP) {
      if (wheel.open) wheel.open = false;
      else Object.assign(wheel, { open: true, mode: 'sticky', sel: -1, openT: t });
      return true;
    }
    if (!wheel.open && inp.gP) {
      Object.assign(wheel, { open: true, mode: 'hold', sx: inp.px, sy: inp.py, sel: -1, openT: t });
      return false;
    }
    if (!wheel.open) return false;
    if (inp.escP) { wheel.open = false; inp.escP = false; return true; }
    if (wheel.mode === 'hold') {
      const dx = inp.px - wheel.sx, dy = inp.py - wheel.sy;
      if (Math.hypot(dx, dy) > 22) wheel.sel = slotAt(dx, dy);
      else if (Math.hypot(inp.mx, inp.my) > 0.5) wheel.sel = slotAt(inp.mx, inp.my);
      if (inp.gR || !inp.gDown) {
        if (wheel.sel >= 0) { trigger(game.local, EMOTES[wheel.sel].k); wheel.open = false; }
        else if (t - wheel.openT < 0.3) wheel.mode = 'sticky';
        else wheel.open = false;
      }
      return false;
    }
    // sticky: click a slot
    const dx = inp.px - CX, dy = inp.py - CY, d = Math.hypot(dx, dy);
    wheel.sel = (d > R1 && d < R2 + 20) ? slotAt(dx, dy) : -1;
    if (inp.gP) { wheel.open = false; return false; }
    if (inp.pP) {
      if (wheel.sel >= 0) trigger(game.local, EMOTES[wheel.sel].k);
      wheel.open = false;
      return true;
    }
    return false;
  }

  function drawWheel(ctx) {
    if (!wheel.open) return;
    const t = game.t, col = game.players[game.local].color;
    const k = Math.min(1, (t - wheel.openT) / 0.12);
    ctx.save();
    ctx.fillStyle = `rgba(10,8,16,${0.45 * k})`; ctx.fillRect(0, 0, W, H);
    ctx.translate(CX, CY); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    for (let i = 0; i < 6; i++) {
      const a0 = -Math.PI / 2 - Math.PI / 6 + i * Math.PI / 3, a1 = a0 + Math.PI / 3;
      const sel = i === wheel.sel, grow = sel ? 12 : 0;
      ctx.beginPath(); ctx.arc(0, 0, R2 + grow, a0 + 0.02, a1 - 0.02); ctx.arc(0, 0, R1, a1 - 0.02, a0 + 0.02, true); ctx.closePath();
      ctx.fillStyle = sel ? col : 'rgba(38,34,47,0.94)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
      const am = (a0 + a1) / 2, rm = (R1 + R2) / 2 + grow / 2;
      const ix = Math.cos(am) * rm, iy = Math.sin(am) * rm;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(ix, iy - 8, 25, 0, Math.PI * 2); ctx.fill();
      drawEmoteIcon(ctx, EMOTES[i].k, ix, iy - 8, sel ? 1.45 : 1.25, t);
      ctx.font = `800 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sel ? '#1b1824' : COL.sub; ctx.fillText(EMOTES[i].name, ix, iy + 30);
    }
    ctx.beginPath(); ctx.arc(0, 0, R1 - 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(27,24,36,0.96)'; ctx.fill();
    ctx.font = `800 15px ${FONT}`; ctx.fillStyle = COL.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('감정 표현', 0, -8);
    ctx.font = `600 11px ${FONT}`; ctx.fillStyle = COL.dim;
    ctx.fillText(wheel.mode === 'hold' ? '방향 고르고 떼기' : '클릭해서 고르기', 0, 12);
    ctx.restore();
  }

  // anchors: [{x, y(top of head), s(size)}] per player, filled by game.drawPlayer
  function drawBubbles(ctx, anchors) {
    for (let i = 0; i < 4; i++) {
      const a = current(i), an = anchors[i];
      if (!a || !an) continue;
      const e = game.t - a.t0, d = dur(a.k);
      const pop = e < 0.22 ? (function (x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); })(e / 0.22) : 1;
      const fade = Math.min(1, (d - e) / 0.3);
      const s = Math.max(0.55, Math.min(1.2, an.s / 90));
      const bx = an.x, by = an.y - 34 * s;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(bx, by); ctx.scale(pop * s, pop * s);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = game.players[i].color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-30, -26, 60, 46, 12); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 19); ctx.lineTo(0, 30); ctx.lineTo(8, 19); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 20.5); ctx.lineTo(0, 30); ctx.lineTo(8, 20.5); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-9, 17, 18, 3);
      drawEmoteIcon(ctx, a.k, 0, -3, 1.3, game.t);
      ctx.restore();
    }
  }

  function reset() { for (let i = 0; i < 4; i++) active[i] = null; wheel.open = false; }
  return { trigger, mod, current, handleLocal, drawWheel, drawBubbles, reset, wheel };
}
