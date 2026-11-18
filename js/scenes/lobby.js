// Online menu (make / join a room) and the room (seats, character pick, settings, chat)
import { W, H, COL, ROUND_OPTIONS, DIFFS, FONT } from '../config.js';
import { ROSTER, drawCharacter, shade } from '../characters.js';
import { text, button, bgFill, stripes, inRect, measure, card } from '../ui.js';
import { sfx, playMusic } from '../audio.js';
import { setTouchLayout } from '../input.js';
import { openChat, chatOpen } from '../chat.js';

let form = null;
function buildForm(game) {
  form = document.createElement('div');
  form.id = 'onlineform';
  form.innerHTML = `
    <h2>온라인 대전</h2>
    <p class="sub">방을 만들고 4자리 코드를 친구에게 알려 주세요. 최대 4명, 빈자리는 봇이 채웁니다.</p>
    <label for="of-name">닉네임</label>
    <input id="of-name" maxlength="8" autocomplete="off" placeholder="최대 8글자">
    <button id="of-host" class="wide">방 만들기</button>
    <label for="of-code">방 코드로 참가</label>
    <div class="row"><input id="of-code" maxlength="4" inputmode="numeric" autocomplete="off" placeholder="0000"><button id="of-join">참가하기</button></div>
    <div class="status" id="of-status"></div>
    <button id="of-back" class="ghost wide">뒤로</button>`;
  document.body.appendChild(form);
  const $ = (id) => form.querySelector('#' + id);
  for (const el of form.querySelectorAll('input')) { el.addEventListener('keydown', (e) => e.stopPropagation()); el.addEventListener('keyup', (e) => e.stopPropagation()); }
  const nameOk = () => {
    const n = $('of-name').value.trim();
    if (!n) { game.online.error = '닉네임을 입력해 주세요.'; $('of-name').focus(); return null; }
    try { localStorage.setItem('wagle.nick', n); } catch (e) { }
    return n;
  };
  $('of-host').onclick = () => { const n = nameOk(); if (n) { sfx.click(); game.online.host(n); } };
  $('of-join').onclick = () => {
    const n = nameOk(); if (!n) return;
    const c = $('of-code').value.replace(/\D/g, '');
    if (c.length !== 4) { game.online.error = '방 코드 4자리를 입력해 주세요.'; $('of-code').focus(); return; }
    sfx.click(); game.online.join(c, n);
  };
  $('of-code').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) $('of-join').click(); });
  $('of-name').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) $('of-code').focus(); });
  $('of-back').onclick = () => { sfx.click(); game.online.leave(); game.go('title'); };
}

// chat field sits over the chat panel's write button (game coordinates)
const CHAT_AT = { x: 888, y: 638, w: 344 };

export function onlineScene(game) {
  return {
    allowEmote: false,
    enter() {
      if (!form) buildForm(game);
      const $ = (id) => form.querySelector('#' + id);
      try { $('of-name').value = $('of-name').value || localStorage.getItem('wagle.nick') || ''; } catch (e) { }
      const q = new URLSearchParams(location.search).get('room');
      if (q && !$('of-code').value) $('of-code').value = q.replace(/\D/g, '').slice(0, 4);
      form.style.display = 'block';
      $('of-host').disabled = false; $('of-join').disabled = false;   // don't keep the last room's 'busy' state
      setTouchLayout({ stick: false, a: false }); playMusic('menu');
      game.players = ROSTER.map(r => ({ char: r.id, color: r.color, name: r.name }));
      if (game.online.notice) { game.online.error = game.online.notice.text; game.online.notice = null; }
    },
    exit() { if (form) form.style.display = 'none'; },
    update(dt, inp) { if (inp.escP) { game.online.leave(); game.go('title'); } },
    render(ctx) {
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      ROSTER.forEach((r, i) => {
        const x = i < 3 ? 110 + i * 120 : W - 110 - (i - 3) * 120;
        drawCharacter(ctx, r.id, x, 640 - Math.abs(Math.sin(game.t * 2 + i)) * 10, 100, { t: game.t + i, facing: i < 3 ? 1 : -1 });
      });
      const o = game.online, st = form.querySelector('#of-status');
      const busy = o.role === 'hosting' || o.role === 'joining';
      st.textContent = o.error || o.status || '';
      st.className = 'status' + (o.error ? ' err' : '');
      form.querySelector('#of-host').disabled = busy; form.querySelector('#of-join').disabled = busy;
    },
  };
}

export function roomScene(game) {
  let cursor = 0, toast = null;
  const CW = 132, CX0 = 40, CY = 386;
  const charRect = (k) => ({ x: CX0 + k * (CW + 8), y: CY, w: CW, h: 150 });
  const seatRect = (s) => ({ x: 40 + s * 208, y: 126, w: 198, h: 216 });
  const syncPlayers = () => {
    const L = game.online.lobby;
    game.players = L.seats.map((s) => s ? { char: s.char, color: s.char ? ROSTER.find(r => r.id === s.char).color : '#8f88a3', name: s.name } : { char: null, color: '#5c5568', name: '' });
  };
  const takenBy = (ch) => game.online.lobby.seats.findIndex(s => s && s.char === ch);
  const pick = (k) => {
    const ch = ROSTER[k].id, by = takenBy(ch);
    if (by >= 0 && by !== game.online.seat) { sfx.bad(); return; }
    sfx.click(); game.online.pick(ch);
  };
  return {
    enter() {
      setTouchLayout({ stick: false, a: false }); playMusic('menu');
      game.emotes.reset(); syncPlayers();
    },
    update(dt, inp) {
      const o = game.online;
      if (!o.role || !o.lobby) { game.go('title'); return; }
      syncPlayers();
      if (inp.enterP && !chatOpen()) openChat((t) => o.sendChat(t), CHAT_AT);
      if (inp.leftP) cursor = (cursor + ROSTER.length - 1) % ROSTER.length;
      if (inp.rightP) cursor = (cursor + 1) % ROSTER.length;
      if (inp.aP) pick(cursor);
      if (inp.escP) o.leave();
    },
    render(ctx, inp) {
      const o = game.online, L = o.lobby; if (!L) return;
      const host = o.role === 'host';
      bgFill(ctx, W, H); stripes(ctx, W, H, game.t);
      // code
      text(ctx, '방 코드', 40, 52, { size: 20, title: true, stroke: COL.ink, strokeW: 5 });
      text(ctx, L.code, 40, 106, { size: 62, title: true, color: COL.accent, stroke: COL.ink, strokeW: 10 });
      if (button(ctx, inp, { x: 210, y: 62, w: 190, h: 44 }, '초대 링크 복사', { size: 17 })) {
        const url = location.origin + location.pathname + '?room=' + L.code;
        try { navigator.clipboard.writeText(url); toast = { t: game.t, text: '링크를 복사했습니다' }; } catch (e) { toast = { t: game.t, text: url }; }
      }
      if (toast && game.t - toast.t < 2.5) text(ctx, toast.text, 414, 92, { size: 17, title: true, color: COL.good, stroke: COL.ink, strokeW: 5 });
      text(ctx, `${o.humans()}명 접속 · 빈자리는 봇`, 610, 92, { size: 18, title: true, stroke: COL.ink, strokeW: 5 });
      // seats
      for (let s = 0; s < 4; s++) {
        const r = seatRect(s), seat = L.seats[s], p = game.players[s];
        if (seat) card(ctx, r, { fill: p.char ? p.color : COL.panel, r: 30, lw: p.char ? 4.5 : 3.5 });
        else { ctx.save(); ctx.setLineDash([12, 10]); card(ctx, r, { fill: 'rgba(255,255,255,0.12)', r: 30, shadow: 0, stroke: 'rgba(255,255,255,0.6)', gloss: false }); ctx.restore(); }
        if (seat) {
          if (p.char) game.drawPlayer(ctx, s, r.x + r.w / 2, r.y + 156, 108, { tag: true });
          else text(ctx, '?', r.x + r.w / 2, r.y + 120, { size: 80, title: true, align: 'center', color: COL.dim, stroke: COL.ink, strokeW: 8 });
          text(ctx, seat.name, r.x + r.w / 2, r.y + 186, { size: 22, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 6 });
          const tag = s === 0 ? '방장' : '';
          if (tag) text(ctx, tag, r.x + 16, r.y + 30, { size: 17, title: true, color: COL.accent, stroke: COL.ink, strokeW: 5 });
          text(ctx, p.char ? '준비됨' : '캐릭터 고르는 중', r.x + r.w / 2, r.y + 207, { size: 15, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 4 });
        } else {
          text(ctx, '빈자리', r.x + r.w / 2, r.y + 108, { size: 26, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 6 });
          text(ctx, '시작하면 봇이 들어갑니다', r.x + r.w / 2, r.y + 138, { size: 15, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 4 });
        }
      }
      // character picker
      text(ctx, '캐릭터 고르기  (← → 와 Space, 또는 클릭)', 40, 376, { size: 18, title: true, stroke: COL.ink, strokeW: 5 });
      ROSTER.forEach((c, k) => {
        const r = charRect(k), by = takenBy(c.id), mine = by === o.seat, other = by >= 0 && !mine;
        const hot = inRect(r, inp.px, inp.py) && !inp.touch;
        card(ctx, r, { fill: mine ? c.color : hot || cursor === k ? COL.line : COL.panel, r: 26, lw: mine ? 5 : 3.5, alpha: other ? 0.6 : 1 });
        ctx.save(); if (other) ctx.globalAlpha = 0.3;
        drawCharacter(ctx, c.id, r.x + r.w / 2, r.y + 112, 88, { t: game.t + k, expr: mine ? 'win' : 'idle' });
        ctx.restore();
        text(ctx, c.name, r.x + r.w / 2, r.y + 138, { size: 20, title: true, align: 'center', color: other ? COL.dim : '#fff', stroke: COL.ink, strokeW: 5 });
        if (other) text(ctx, L.seats[by].name, r.x + r.w / 2, r.y + 60, { size: 17, title: true, align: 'center', color: '#fff', stroke: COL.ink, strokeW: 5 });
        if (inp.pP && inRect(r, inp.px, inp.py)) { cursor = k; pick(k); }
      });
      // settings
      text(ctx, '판 수', 40, 564, { size: 18, title: true, stroke: COL.ink, strokeW: 5 });
      ROUND_OPTIONS.forEach((n, k) => { if (button(ctx, inp, { x: 40 + k * 92, y: 574, w: 84, h: 42 }, n + '판', { selected: L.roundsI === k, size: 18, disabled: !host && L.roundsI !== k }) && host) { sfx.click(); o.setOption('roundsI', k); } });
      text(ctx, '봇 난이도', 340, 564, { size: 18, title: true, stroke: COL.ink, strokeW: 5 });
      DIFFS.forEach((d, k) => { if (button(ctx, inp, { x: 340 + k * 92, y: 574, w: 84, h: 42 }, d.name, { selected: L.diffI === k, size: 18, disabled: !host && L.diffI !== k }) && host) { sfx.click(); o.setOption('diffI', k); } });
      // start / leave
      if (host) {
        const ok = o.canStart();
        if (button(ctx, inp, { x: 40, y: 636, w: 560, h: 58 }, ok ? '시작하기' : '모두 캐릭터를 골라야 시작할 수 있습니다', { primary: ok, disabled: !ok, size: ok ? 24 : 17 }) && ok) { sfx.go(); o.start(); }
      } else {
        card(ctx, { x: 40, y: 636, w: 560, h: 58 }, { r: 29 });
        text(ctx, L.seats[o.seat]?.char ? '방장이 시작하기를 기다리는 중...' : '캐릭터를 골라 주세요', 320, 673, { size: 21, title: true, align: 'center', color: COL.soft });
      }
      if (button(ctx, inp, { x: 616, y: 636, w: 240, h: 58 }, '방 나가기', { size: 20 })) { sfx.click(); o.leave(); }
      // chat panel
      const px = 880, py = 40, pw = 360, ph = 654;
      card(ctx, { x: px, y: py, w: pw, h: ph }, { r: 30 });
      text(ctx, '채팅', px + 20, py + 34, { size: 22, title: true, stroke: COL.ink, strokeW: 5 });
      const lines = [];
      for (const c of o.chat) {
        const head = c.sys ? '' : c.name + '  ';
        let rest = c.text, first = true;
        while (rest.length) {
          let n = rest.length;
          while (n > 1 && measure(ctx, (first ? head : '') + rest.slice(0, n), 15, 600) > pw - 32) n--;
          lines.push({ head: first ? head : '', body: rest.slice(0, n), c });
          rest = rest.slice(n); first = false;
        }
      }
      lines.slice(-22).forEach((l, k) => {
        const y = py + 64 + k * 24;
        if (l.c.sys) text(ctx, l.body, px + 16, y, { size: 14, weight: 700, color: COL.faint });
        else {
          if (l.head) text(ctx, l.head, px + 16, y, { size: 15, weight: 900, color: l.c.color });
          text(ctx, l.body, px + 16 + (l.head ? measure(ctx, l.head, 15, 900) : 0), y, { size: 15, weight: 600, color: COL.ink });
        }
      });
      if (button(ctx, inp, { x: px + 12, y: py + ph - 54, w: pw - 24, h: 42 }, inp.touch ? '채팅 쓰기' : '채팅 쓰기 (Enter)', { size: 16 })) openChat((t) => o.sendChat(t), CHAT_AT);
    },
  };
}
