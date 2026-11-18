// Character roster and canvas drawing.
// drawCharacter(ctx, id, x, y, size, opts) draws with feet at (x, y); size = body height in px.

export const ROSTER = [
  { id: 'punch',  name: '펀치', en: 'PUNCH',  color: '#E8473F', role: '열혈 승부사',
    line: '지는 건 내 사전에 없어!', desc: '머리띠와 권투 장갑. 이기면 장갑을 하늘로 뻗고, 지면 바닥을 친다.' },
  { id: 'momo',   name: '모모', en: 'MOMO',   color: '#F3A3C0', role: '느긋한 잠꾸러기',
    line: '음... 벌써 끝났어?', desc: '축 늘어진 긴 귀와 반쯤 감긴 눈. 대충 하는 것 같은데 결과는 1등.' },
  { id: 'volt',   name: '볼트', en: 'VOLT',   color: '#FFCF3A', role: '과속 에너자이저',
    line: '빨리빨리! 다음 판!', desc: '번개 안테나와 볼의 전기 무늬. 가만히 있지 못하고 계속 통통 튄다.' },
  { id: 'nook',   name: '누크', en: 'NOOK',   color: '#4C6FC4', role: '계산형 발명가',
    line: '확률상 제가 이깁니다.', desc: '두꺼운 동그란 안경과 삐친 머리. 지면 안경을 고쳐 쓰며 변명한다.' },
  { id: 'ciel',   name: '시엘', en: 'CIEL',   color: '#5ED0D6', role: '쿨한 리듬 천재',
    line: '...박자만 맞추면 끝이야.', desc: '커다란 헤드폰과 끝이 말린 물방울 머리. 이겨도 표정 변화가 거의 없다.' },
  { id: 'gobble', name: '고블', en: 'GOBBLE', color: '#79C66B', role: '먹보 힘캐',
    line: '그거 먹어도 돼?', desc: '큰 입에 앞니 하나, 턱받이를 찼다. 몸집이 커서 밀치기에 강해 보인다.' },
];

// ---------- color helpers ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(a) { return `rgb(${a.map(v => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`; }
export function shade(hex, amt) { // amt -1..1 (negative = darker)
  const c = hexToRgb(hex);
  return rgb(c.map(v => amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
}

// ---------- body shapes ----------
// Superellipse with vertical taper; origin at feet center, y up is negative.
const SHAPES = {
  punch:  { w: 0.96, h: 0.80, n: 3.0, taper: 0.06, top: 0 },
  momo:   { w: 0.80, h: 0.88, n: 2.4, taper: 0.14, top: 0 },
  volt:   { w: 0.74, h: 0.70, n: 2.1, taper: 0.02, top: 0 },
  nook:   { w: 0.80, h: 0.92, n: 3.4, taper: 0.03, top: 0 },
  ciel:   { w: 0.76, h: 0.90, n: 2.2, taper: 0.30, top: 0.55 },
  gobble: { w: 1.02, h: 0.90, n: 2.3, taper: 0.20, top: 0 },
};

function bodyPath(ctx, s, sx = 1, sy = 1) {
  const a = s.w / 2 * sx, b = s.h / 2 * sy, cy = -b;
  const p = 2 / s.n;
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const c = Math.cos(t), si = Math.sin(t);
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), p);
    let y = b * Math.sign(si) * Math.pow(Math.abs(si), p);
    const yn = y / b; // -1 top .. 1 bottom
    let f = 1 + s.taper * yn;
    if (s.top && yn < 0) f *= 1 - s.top * Math.pow(-yn, 3); // pointed top (teardrop)
    x *= f;
    if (i === 0) ctx.moveTo(x, cy + y); else ctx.lineTo(x, cy + y);
  }
  ctx.closePath();
}

// ---------- face parts ----------
function eyeRound(ctx, x, y, r, look = 0, star = false) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.86, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1a24';
  ctx.beginPath(); ctx.ellipse(x + look * r * 0.18, y + r * 0.08, r * 0.62, r * 0.74, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  if (star) starShape(ctx, x + look * r * 0.18 - r * 0.2, y - r * 0.22, r * 0.3);
  else { ctx.beginPath(); ctx.arc(x + look * r * 0.18 - r * 0.22, y - r * 0.22, r * 0.24, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x + look * r * 0.18 + r * 0.2, y + r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill();
}
function starShape(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
function eyeArc(ctx, x, y, r, up = true, lw) { // happy ^ or sad v closed eye
  ctx.strokeStyle = '#1d1a24'; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  if (up) ctx.arc(x, y + r * 0.35, r * 0.7, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(x, y - r * 0.5, r * 0.7, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}
function eyeLidded(ctx, x, y, r, lid, bodyCol, outline) { // lid: 0 open .. 1 closed (from top)
  eyeRound(ctx, x, y, r, 0);
  const ly = y - r + r * 2 * lid;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.88, r * 1.02, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = bodyCol; ctx.fillRect(x - r * 1.2, y - r * 1.3, r * 2.4, ly - (y - r * 1.3));
  ctx.restore();
  const hw = r * 0.86 * Math.sqrt(Math.max(0, 1 - Math.pow((ly - y) / r, 2)));
  ctx.strokeStyle = '#1d1a24'; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - hw - r * 0.08, ly); ctx.lineTo(x + hw + r * 0.08, ly); ctx.stroke();
}
function brow(ctx, x, y, w, ang, lw) {
  ctx.strokeStyle = '#1d1a24'; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * w / 2, y - Math.sin(ang) * w / 2);
  ctx.lineTo(x + Math.cos(ang) * w / 2, y + Math.sin(ang) * w / 2); ctx.stroke();
}
function blush(ctx, x, y, r, col = 'rgba(255,110,120,0.38)') {
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
}
function mouth(ctx, kind, x, y, w, lw, opts = {}) {
  ctx.strokeStyle = '#1d1a24'; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'smile') { ctx.beginPath(); ctx.arc(x, y - w * 0.4, w * 0.55, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); }
  else if (kind === 'flat') { ctx.beginPath(); ctx.moveTo(x - w * 0.3, y); ctx.lineTo(x + w * 0.3, y); ctx.stroke(); }
  else if (kind === 'frown') { ctx.beginPath(); ctx.arc(x, y + w * 0.45, w * 0.45, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke(); }
  else if (kind === 'cat') { // w shape
    ctx.beginPath(); ctx.arc(x - w * 0.18, y, w * 0.18, 0, Math.PI); ctx.arc(x + w * 0.18, y, w * 0.18, 0, Math.PI); ctx.stroke();
  } else if (kind === 'smirk') {
    ctx.beginPath(); ctx.moveTo(x - w * 0.25, y + w * 0.04); ctx.quadraticCurveTo(x + w * 0.1, y + w * 0.12, x + w * 0.3, y - w * 0.1); ctx.stroke();
  } else if (kind === 'open' || kind === 'big' || kind === 'grin') {
    const mw = kind === 'big' ? w * 1.15 : w * 0.8, mh = kind === 'big' ? w * 0.75 : w * 0.5;
    ctx.fillStyle = '#4a1f2a';
    ctx.beginPath();
    if (kind === 'grin') { ctx.moveTo(x - mw / 2, y - mh * 0.2); ctx.quadraticCurveTo(x, y - mh * 0.05, x + mw / 2, y - mh * 0.2); ctx.quadraticCurveTo(x, y + mh * 1.1, x - mw / 2, y - mh * 0.2); }
    else { ctx.moveTo(x - mw / 2, y - mh * 0.25); ctx.quadraticCurveTo(x, y - mh * 0.1, x + mw / 2, y - mh * 0.25); ctx.quadraticCurveTo(x + mw * 0.45, y + mh, x, y + mh); ctx.quadraticCurveTo(x - mw * 0.45, y + mh, x - mw / 2, y - mh * 0.25); }
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#ff7c8f'; ctx.beginPath(); ctx.ellipse(x, y + mh * 0.95, mw * 0.3, mh * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    if (opts.tooth) { ctx.fillStyle = '#fff'; ctx.fillRect(x - mw * 0.12, y - mh * 0.3, mw * 0.24, mh * 0.42); }
    if (opts.fang) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + mw * 0.12, y - mh * 0.2); ctx.lineTo(x + mw * 0.3, y - mh * 0.22); ctx.lineTo(x + mw * 0.22, y + mh * 0.22); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.stroke();
  }
}

// ---------- main draw ----------
// opts: { t: seconds, expr: 'idle'|'win'|'lose', facing: 1|-1 }
export function drawCharacter(ctx, id, x, y, size, opts = {}) {
  const ch = ROSTER.find(c => c.id === id);
  const s = SHAPES[id];
  const t = opts.t || 0, expr = opts.expr || 'idle';
  const col = ch.color, dark = shade(col, -0.45), outline = shade(col, -0.55);
  const bob = expr === 'win' ? Math.abs(Math.sin(t * 6)) * 0.08 : Math.sin(t * 2.4) * 0.012;
  const sq = expr === 'lose' ? 0.94 : 1 + Math.sin(t * 2.4) * 0.015;
  const sx = 2 - sq, sy = sq;
  const LW = 0.034;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size * (opts.facing || 1), size);

  // ground shadow
  if (!opts.noShadow) {
    ctx.fillStyle = 'rgba(20,16,30,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 0.01, s.w * 0.48 * (1 - bob), 0.05, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.translate(0, -bob);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const H = s.h * sy, W = s.w * sx;
  const faceY = -H * (id === 'ciel' ? 0.48 : 0.56);

  // feet
  ctx.fillStyle = dark; ctx.strokeStyle = outline; ctx.lineWidth = LW;
  for (const fx of [-W * 0.22, W * 0.22]) {
    ctx.beginPath(); ctx.ellipse(fx, -0.03, W * 0.15, 0.06, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // back accessories
  if (id === 'momo') drawMomoEars(ctx, W, H, col, outline, LW, t, expr);
  if (id === 'punch') drawPunchBandTails(ctx, W, H, t);

  // body
  bodyPath(ctx, s, sx, sy);
  const g = ctx.createLinearGradient(0, -H, 0, 0);
  g.addColorStop(0, shade(col, 0.28)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.2));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // belly / bottom occlusion
  ctx.fillStyle = shade(col, -0.25);
  ctx.beginPath(); ctx.ellipse(0, 0.06, W * 0.62, H * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  if (id === 'gobble') { // bib
    ctx.fillStyle = '#fbfaf3'; ctx.beginPath(); ctx.ellipse(0, -H * 0.2, W * 0.3, H * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9504a'; for (const [bx, by] of [[-0.1, -0.24], [0.08, -0.16], [-0.02, -0.08], [0.12, -0.27]]) { ctx.beginPath(); ctx.arc(bx * W * 2, by * H * 1.1, 0.022, 0, Math.PI * 2); ctx.fill(); }
  }
  if (id === 'nook') { // little bow tie collar line
    ctx.fillStyle = shade(col, -0.35); ctx.fillRect(-W, -H * 0.2, W * 2, 0.02);
  }
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath(); ctx.ellipse(-W * 0.22, -H * 0.8, W * 0.16, H * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(-W * 0.06, -H * 0.88, 0.018, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  bodyPath(ctx, s, sx, sy);
  ctx.strokeStyle = outline; ctx.lineWidth = LW; ctx.stroke();

  // character-specific details on body
  if (id === 'nook') drawNookBowtie(ctx, H, outline, LW);
  if (id === 'punch') drawPunchBand(ctx, W, H, outline, LW);
  if (id === 'volt') drawVoltAntenna(ctx, H, outline, LW, t);
  if (id === 'ciel') drawCielCurl(ctx, H, col, outline, LW, t);
  if (id === 'gobble') drawGobbleSprout(ctx, H, outline, LW, t);
  if (id === 'momo') drawMomoPin(ctx, W, H, outline);

  // face
  drawFace(ctx, id, W, H, faceY, col, outline, expr, t);

  // headphones over face sides
  if (id === 'ciel') drawCielPhones(ctx, W, H, faceY, outline, LW);

  // hands
  drawHands(ctx, id, W, H, col, outline, LW, expr, t);

  ctx.restore();
}

function drawFace(ctx, id, W, H, fy, col, outline, expr, t) {
  const ex = W * 0.19, er = 0.085, lw = 0.026;
  const blink = (Math.sin(t * 1.3 + id.length) > 0.985);
  const win = expr === 'win', lose = expr === 'lose';
  if (id !== 'ciel' && id !== 'nook') blush(ctx, 0, 0, 0); // noop keep order
  const cheekY = fy + 0.09;

  if (id === 'punch') {
    blush(ctx, -ex - 0.07, cheekY, 0.055);
    if (win) { eyeArc(ctx, -ex, fy, er, true, lw * 1.3); eyeArc(ctx, ex, fy, er, true, lw * 1.3); }
    else if (lose) { eyeRound(ctx, -ex, fy + 0.01, er * 0.85); eyeRound(ctx, ex, fy + 0.01, er * 0.85); brow(ctx, -ex, fy - 0.11, 0.1, -0.45, lw * 1.3); brow(ctx, ex, fy - 0.11, 0.1, 0.45, lw * 1.3); }
    else { blink ? (eyeArc(ctx, -ex, fy, er, false, lw), eyeArc(ctx, ex, fy, er, false, lw)) : (eyeRound(ctx, -ex, fy, er, 0.4), eyeRound(ctx, ex, fy, er, 0.4)); brow(ctx, -ex, fy - 0.12, 0.12, 0.42, lw * 1.6); brow(ctx, ex, fy - 0.12, 0.12, -0.42, lw * 1.6); }
    mouth(ctx, lose ? 'frown' : 'grin', 0.02, fy + 0.12, 0.16, lw, { fang: true });
    // band-aid on right cheek
    ctx.save(); ctx.translate(ex + 0.08, cheekY); ctx.rotate(-0.5);
    ctx.fillStyle = '#f6d7b0'; ctx.strokeStyle = 'rgba(120,70,40,0.6)'; ctx.lineWidth = 0.01;
    ctx.beginPath(); ctx.roundRect(-0.06, -0.022, 0.12, 0.044, 0.02); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8bf8c'; ctx.fillRect(-0.018, -0.02, 0.036, 0.04);
    ctx.restore();
  }
  else if (id === 'momo') {
    blush(ctx, -ex - 0.06, cheekY, 0.06); blush(ctx, ex + 0.06, cheekY, 0.06);
    if (win) { eyeArc(ctx, -ex, fy, er, true, lw); eyeArc(ctx, ex, fy, er, true, lw); mouth(ctx, 'open', 0, fy + 0.1, 0.12, lw); }
    else if (lose) { eyeArc(ctx, -ex, fy, er, false, lw); eyeArc(ctx, ex, fy, er, false, lw); mouth(ctx, 'flat', 0, fy + 0.11, 0.1, lw); drawZ(ctx, W * 0.42, fy - 0.2, t); }
    else { eyeLidded(ctx, -ex, fy, er, 0.5, shade(col, 0.15), outline); eyeLidded(ctx, ex, fy, er, 0.5, shade(col, 0.15), outline); mouth(ctx, 'cat', 0, fy + 0.1, 0.12, lw); }
  }
  else if (id === 'volt') {
    // electric cheek marks
    ctx.strokeStyle = '#ff8a1f'; ctx.lineWidth = 0.022; ctx.lineJoin = 'miter';
    for (const sgn of [-1, 1]) {
      const cx = sgn * (ex + 0.075);
      ctx.beginPath(); ctx.moveTo(cx - 0.04, cheekY - 0.02); ctx.lineTo(cx - 0.005, cheekY + 0.012); ctx.lineTo(cx + 0.005, cheekY - 0.015); ctx.lineTo(cx + 0.04, cheekY + 0.02); ctx.stroke();
    }
    if (lose) { eyeRound(ctx, -ex, fy, er * 0.9); eyeRound(ctx, ex, fy, er * 0.9); mouth(ctx, 'frown', 0, fy + 0.11, 0.12, lw);
      ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.ellipse(-ex - 0.02, fy + 0.11, 0.018, 0.03, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (win) { eyeArc(ctx, -ex, fy, er * 1.1, true, lw * 1.2); eyeArc(ctx, ex, fy, er * 1.1, true, lw * 1.2); mouth(ctx, 'big', 0, fy + 0.1, 0.13, lw); }
    else { eyeRound(ctx, -ex, fy, er * 1.1, 0, true); eyeRound(ctx, ex, fy, er * 1.1, 0, true); mouth(ctx, 'open', 0, fy + 0.1, 0.13, lw); }
  }
  else if (id === 'nook') {
    const gr = er * 1.45;
    if (win) { eyeArc(ctx, -ex, fy, er, true, lw); eyeArc(ctx, ex, fy, er, true, lw); mouth(ctx, 'smile', 0, fy + 0.16, 0.13, lw); }
    else if (lose) { eyeRound(ctx, -ex, fy + 0.01, er * 0.7); eyeRound(ctx, ex, fy + 0.01, er * 0.7); mouth(ctx, 'flat', 0, fy + 0.15, 0.08, lw);
      ctx.fillStyle = '#9fe0ff'; ctx.beginPath(); ctx.ellipse(W * 0.38, fy - 0.12, 0.022, 0.034, 0, 0, Math.PI * 2); ctx.fill(); }
    else { eyeRound(ctx, -ex, fy, er * 0.82, -0.3); eyeRound(ctx, ex, fy, er * 0.82, -0.3); mouth(ctx, 'smirk', 0, fy + 0.15, 0.13, lw); }
    // glasses (slightly tilted when losing)
    ctx.save(); if (lose) { ctx.translate(0, fy); ctx.rotate(0.08); ctx.translate(0, -fy); }
    ctx.strokeStyle = '#2a2433'; ctx.lineWidth = 0.03;
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = 'rgba(200,235,255,0.25)';
      ctx.beginPath(); ctx.arc(sgn * ex, fy, gr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.arc(sgn * ex, fy, gr * 0.72, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.strokeStyle = '#2a2433'; ctx.lineWidth = 0.03;
    }
    ctx.beginPath(); ctx.moveTo(-ex + gr, fy - 0.01); ctx.quadraticCurveTo(0, fy - 0.04, ex - gr, fy - 0.01); ctx.stroke();
    ctx.restore();
  }
  else if (id === 'ciel') {
    blush(ctx, -ex - 0.05, cheekY + 0.01, 0.045, 'rgba(70,120,200,0.25)'); blush(ctx, ex + 0.05, cheekY + 0.01, 0.045, 'rgba(70,120,200,0.25)');
    if (win) { eyeArc(ctx, -ex, fy, er, true, lw); eyeArc(ctx, ex, fy, er, true, lw); mouth(ctx, 'smile', 0, fy + 0.13, 0.11, lw);
      drawNote(ctx, W * 0.45, fy - 0.25, t); }
    else if (lose) { eyeLidded(ctx, -ex, fy, er, 0.62, shade(col, 0.12), outline); eyeLidded(ctx, ex, fy, er, 0.62, shade(col, 0.12), outline); mouth(ctx, 'flat', 0, fy + 0.12, 0.08, lw); }
    else { eyeLidded(ctx, -ex, fy, er, 0.48, shade(col, 0.12), outline); eyeLidded(ctx, ex, fy, er, 0.48, shade(col, 0.12), outline); mouth(ctx, 'smirk', 0, fy + 0.12, 0.1, lw); }
  }
  else if (id === 'gobble') {
    blush(ctx, -ex - 0.1, cheekY, 0.06); blush(ctx, ex + 0.1, cheekY, 0.06);
    const e2 = er * 0.8;
    if (win) { eyeArc(ctx, -ex, fy - 0.04, e2, true, lw); eyeArc(ctx, ex, fy - 0.04, e2, true, lw); }
    else if (lose) { eyeRound(ctx, -ex, fy - 0.04, e2); eyeRound(ctx, ex, fy - 0.04, e2); brow(ctx, -ex, fy - 0.15, 0.09, -0.4, lw); brow(ctx, ex, fy - 0.15, 0.09, 0.4, lw); }
    else { eyeRound(ctx, -ex, fy - 0.04, e2, 0.2); eyeRound(ctx, ex, fy - 0.04, e2, 0.2); }
    mouth(ctx, lose ? 'frown' : 'big', 0, fy + 0.08, lose ? 0.14 : 0.22, lw, { tooth: true });
    if (!lose && !win) { // drool
      ctx.fillStyle = 'rgba(170,225,255,0.85)'; ctx.beginPath(); ctx.ellipse(0.1, fy + 0.25 + Math.sin(t * 2) * 0.006, 0.014, 0.026, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawZ(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(60,50,90,0.75)'; ctx.font = 'bold 0.14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('z', x, y + Math.sin(t * 2) * 0.01); ctx.font = 'bold 0.1px sans-serif'; ctx.fillText('z', x + 0.06, y - 0.07);
}
function drawNote(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 3) * 0.01); ctx.fillStyle = '#2a2433';
  ctx.beginPath(); ctx.ellipse(0, 0, 0.03, 0.022, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(0.022, -0.1, 0.01, 0.1); ctx.beginPath(); ctx.moveTo(0.032, -0.1); ctx.quadraticCurveTo(0.07, -0.08, 0.06, -0.04); ctx.lineTo(0.032, -0.07); ctx.fill();
  ctx.restore();
}

// ---------- accessories ----------
function drawPunchBand(ctx, W, H, outline, LW) {
  const y = -H * 0.86;
  ctx.save();
  ctx.fillStyle = '#fbfaf3'; ctx.strokeStyle = '#b9b3a6'; ctx.lineWidth = LW * 0.6;
  ctx.beginPath(); ctx.moveTo(-W * 0.47, y + 0.02); ctx.quadraticCurveTo(0, y - 0.04, W * 0.47, y + 0.02);
  ctx.lineTo(W * 0.48, y + 0.09); ctx.quadraticCurveTo(0, y + 0.03, -W * 0.48, y + 0.09); ctx.closePath(); ctx.fill(); ctx.stroke();
  // red dot emblem
  ctx.fillStyle = '#E8473F'; ctx.beginPath(); ctx.arc(0, y + 0.03, 0.028, 0, Math.PI * 2); ctx.fill();
  // knot
  ctx.fillStyle = '#fbfaf3'; ctx.beginPath(); ctx.arc(W * 0.47, y + 0.055, 0.035, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawPunchBandTails(ctx, W, H, t) {
  const y = -H * 0.82, x = W * 0.47;
  ctx.fillStyle = '#fbfaf3'; ctx.strokeStyle = '#b9b3a6'; ctx.lineWidth = 0.02;
  for (let k = 0; k < 2; k++) {
    const w = Math.sin(t * 5 + k) * 0.03;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 0.12, y - 0.02 + k * 0.05 + w, x + 0.22, y + 0.02 + k * 0.08 + w);
    ctx.lineTo(x + 0.2, y + 0.06 + k * 0.08 + w);
    ctx.quadraticCurveTo(x + 0.1, y + 0.04 + k * 0.05, x, y + 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
function drawMomoEars(ctx, W, H, col, outline, LW, t, expr) {
  const droop = expr === 'win' ? -1.6 : expr === 'lose' ? 0.25 : 0;
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(sgn * W * 0.3, -H * 0.86);
    ctx.rotate(sgn * (2.35 + droop + Math.sin(t * 1.6 + sgn) * 0.06));
    ctx.beginPath(); ctx.ellipse(0, -0.22, 0.085, 0.24, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(0, -0.46, 0, 0); g.addColorStop(0, shade(col, -0.1)); g.addColorStop(1, shade(col, 0.2));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = outline; ctx.lineWidth = LW; ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,245,0.75)'; ctx.beginPath(); ctx.ellipse(0, -0.21, 0.04, 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function drawMomoPin(ctx, W, H, outline) {
  ctx.save(); ctx.translate(W * 0.18, -H * 0.86); ctx.fillStyle = '#fff3a8'; ctx.strokeStyle = '#c9a43c'; ctx.lineWidth = 0.012;
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.025 : 0.055; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function drawVoltAntenna(ctx, H, outline, LW, t) {
  const y0 = -H + 0.01;
  ctx.strokeStyle = outline; ctx.lineWidth = LW * 0.9; ctx.lineJoin = 'miter';
  ctx.fillStyle = '#FFE680';
  ctx.beginPath();
  ctx.moveTo(-0.03, y0); ctx.lineTo(0.05, y0 - 0.13); ctx.lineTo(0.0, y0 - 0.13); ctx.lineTo(0.07, y0 - 0.27);
  ctx.lineTo(-0.05, y0 - 0.1); ctx.lineTo(0.0, y0 - 0.1); ctx.lineTo(-0.06, y0 + 0.01); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // spark
  const a = (Math.sin(t * 9) + 1) / 2;
  ctx.strokeStyle = `rgba(255,170,40,${0.5 + a * 0.5})`; ctx.lineWidth = 0.016;
  for (const [dx, dy, l] of [[0.1, -0.3, 0.05], [0.13, -0.24, 0.04], [0.03, -0.34, 0.045]]) {
    ctx.beginPath(); ctx.moveTo(dx, y0 + dy); ctx.lineTo(dx + l * 0.7, y0 + dy - l * 0.7); ctx.stroke();
  }
}
function drawNookBowtie(ctx, H, outline, LW) {
  const y = -H * 0.2;
  ctx.fillStyle = '#F2B233'; ctx.strokeStyle = shade('#F2B233', -0.5); ctx.lineWidth = LW * 0.7;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-0.11, y - 0.055); ctx.lineTo(-0.11, y + 0.055); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(0.11, y - 0.055); ctx.lineTo(0.11, y + 0.055); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, y, 0.028, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // cowlick
  ctx.strokeStyle = outline; ctx.lineWidth = LW * 1.1; ctx.fillStyle = 'transparent';
  ctx.beginPath(); ctx.moveTo(0.02, -H + 0.005); ctx.quadraticCurveTo(0.0, -H - 0.14, 0.11, -H - 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.02, -H + 0.005); ctx.quadraticCurveTo(-0.06, -H - 0.09, -0.01, -H - 0.12); ctx.stroke();
}
function drawCielCurl(ctx, H, col, outline, LW, t) {
  const y = -H + 0.005;
  ctx.strokeStyle = outline; ctx.lineWidth = LW;
  ctx.fillStyle = shade(col, 0.2);
  ctx.beginPath(); ctx.moveTo(-0.025, y + 0.02);
  ctx.quadraticCurveTo(0.0, y - 0.1, 0.09, y - 0.12);
  ctx.quadraticCurveTo(0.15, y - 0.12, 0.13, y - 0.06);
  ctx.quadraticCurveTo(0.11, y - 0.02, 0.07, y - 0.05);
  ctx.quadraticCurveTo(0.05, y - 0.05, 0.03, y + 0.02);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawCielPhones(ctx, W, H, fy, outline, LW) {
  const hy = fy - 0.02;
  const g = ctx.createLinearGradient(0, -H, 0, hy);
  ctx.strokeStyle = '#2a2433'; ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.ellipse(0, hy, W * 0.52, H * 0.6, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  ctx.strokeStyle = '#ff5d8f'; ctx.lineWidth = 0.016;
  ctx.beginPath(); ctx.ellipse(0, hy, W * 0.52, H * 0.6, 0, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(sgn * W * 0.5, hy);
    ctx.fillStyle = '#2a2433'; ctx.beginPath(); ctx.roundRect(-0.07, -0.11, 0.14, 0.22, 0.06); ctx.fill();
    ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.roundRect(sgn > 0 ? 0.01 : -0.05, -0.07, 0.04, 0.14, 0.02); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-0.02, -0.06, 0.018, 0.03, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function drawGobbleSprout(ctx, H, outline, LW, t) {
  const y = -H + 0.005, sw = Math.sin(t * 2) * 0.05;
  ctx.strokeStyle = '#3c7a35'; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(0.01, y - 0.06, sw * 0.3, y - 0.1); ctx.stroke();
  ctx.fillStyle = '#9fe08a'; ctx.strokeStyle = '#3c7a35'; ctx.lineWidth = LW * 0.7;
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.translate(sw * 0.3, y - 0.1); ctx.rotate(sgn * 0.9 + sw);
    ctx.beginPath(); ctx.ellipse(0, -0.05, 0.03, 0.06, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

function drawHands(ctx, id, W, H, col, outline, LW, expr, t) {
  const glove = id === 'punch';
  const r = glove ? 0.085 : 0.06;
  const handCol = glove ? '#D7322C' : col;
  for (const sgn of [-1, 1]) {
    let hx = sgn * (W * 0.5 + (glove ? 0.02 : -0.01)), hy = -H * 0.36;
    if (expr === 'win') { hx = sgn * (W * 0.46); hy = -H * 0.95 - (glove && sgn > 0 ? 0.12 : 0) + Math.sin(t * 6) * 0.02; }
    if (expr === 'lose') { hy = -H * 0.18; hx = sgn * (W * 0.42); }
    if (id === 'ciel' && expr === 'win' && sgn < 0) { hx = -W * 0.5; hy = -H * 0.36; }
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(hx - r * 0.4, hy - r * 0.4, r * 0.1, hx, hy, r);
    g.addColorStop(0, shade(handCol, 0.3)); g.addColorStop(1, shade(handCol, -0.1));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = glove ? '#7a1714' : outline; ctx.lineWidth = LW; ctx.stroke();
    if (glove) { // cuff + shine
      ctx.fillStyle = '#fbfaf3'; ctx.beginPath(); ctx.ellipse(hx - sgn * r * 0.75, hy + r * 0.35, r * 0.28, r * 0.42, sgn * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a1714'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(hx - r * 0.3, hy - r * 0.4, r * 0.25, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}
