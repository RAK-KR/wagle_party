// Online room: the host runs the whole game (bots included) and sends the state ~20 times a second.
// Other players send their inputs and draw what the host sends.
import { createNet } from './net.js';
import { ROSTER } from './characters.js';
import { DIFFS, ROUND_OPTIONS, COL, W, H } from './config.js';
import { sfx } from './audio.js';
import { text, measure } from './ui.js';

const VERSION = 1;
const SNAP_EVERY = 0.05;
const LERP = new Set(['x', 'y', 'z', 'ang', 'rope', 'mx', 'cam', 'pow', 'R', 'held']);
const MONO = new Set(['t', 'pt', 'ft', 'fallT']);

function lerpState(p, c, a, key) {
  if (typeof c === 'number') {
    if (typeof p !== 'number') return c;
    if (LERP.has(key)) {
      if (key === 'ang') { let d = c - p; d = Math.atan2(Math.sin(d), Math.cos(d)); return p + d * a; }
      if (Math.abs(c - p) > 400) return c;   // teleport, don't slide
      return p + (c - p) * a;
    }
    if (MONO.has(key)) return c >= p && c - p < 1 ? p + (c - p) * a : c;
    return c;
  }
  if (Array.isArray(c)) {
    if (!Array.isArray(p) || p.length !== c.length) return c;
    const out = new Array(c.length);
    for (let i = 0; i < c.length; i++) {
      const ci = c[i], pi = p[i];
      out[i] = (ci && pi && typeof ci === 'object' && ci.id !== undefined && ci.id !== pi.id) ? ci : lerpState(pi, ci, a, key);
    }
    return out;
  }
  if (c && typeof c === 'object') {
    if (!p || typeof p !== 'object') return c;
    const out = {};
    for (const k in c) out[k] = lerpState(p[k], c[k], a, k);
    return out;
  }
  return c;
}

export function createOnline(game) {
  const o = {
    role: null, seat: 0, code: '', name: '', lobby: null, chat: [], status: '', error: '',
    snaps: [], following: false, notice: null,
  };
  const buf = [null, null, null, null];          // host: latest input from each remote seat
  const seatOf = new Map();                      // host: conn -> seat
  const connOf = [null, null, null, null];
  let lastSnap = 0, joinTimer = null, hostTries = 0, lastPing = 0, lastFromHost = 0;
  const lastSeen = [0, 0, 0, 0];
  const nowS = () => performance.now() / 1000;
  // say goodbye when the tab closes so the others notice right away
  window.addEventListener('beforeunload', () => {
    if (o.role === 'host') bcast({ t: 'lobby', lobby: { ...o.lobby, closed: true } });
    else if (o.role === 'client') net.toHost({ t: 'bye' });
  });

  const net = createNet({
    open() {
      if (o.role === 'hosting') {
        o.role = 'host'; o.seat = 0; game.local = 0; o.status = '';
        o.lobby = { code: o.code, seats: [{ name: o.name, char: null }, null, null, null], roundsI: 1, diffI: 1, playing: false };
        o.chat = []; sys(`방 ${o.code}을(를) 만들었습니다. 친구에게 코드를 알려 주세요.`);
        game.go('room');
      }
    },
    conn(conn) {
      if (o.role === 'joining') { net.send(conn, { t: 'hello', name: o.name, ver: VERSION }); }
    },
    data(conn, m) { if (o.role === 'host') hostMsg(conn, m); else { lastFromHost = nowS(); clientMsg(m); } },
    close(conn) { dropConn(conn); },
    error(type) {

      if (o.role === 'hosting' && type === 'unavailable-id' && hostTries < 4) { hostTries++; o.code = newCode(); net.host(o.code); return; }
      const msg = type === 'peer-unavailable' ? '그 코드의 방을 찾을 수 없습니다.'
        : type === 'unavailable-id' ? '방 코드를 만들 수 없습니다. 다시 시도해 주세요.'
          : type === 'browser-incompatible' ? '이 브라우저는 온라인 대전을 지원하지 않습니다.'
            : (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') ? '연결 서버에 접속할 수 없습니다. 인터넷 연결을 확인해 주세요.'
              : '연결 중 문제가 생겼습니다. (' + type + ')';
      if (o.role === 'host' || o.role === 'client') { console.warn('peer error', type); return; }   // already in a room: keep going
      fail(msg);
    },
  });

  function dropConn(conn) {
    if (o.role === 'host') {
      const s = seatOf.get(conn); if (s == null) return;
      seatOf.delete(conn); connOf[s] = null; buf[s] = null;
      try { conn.close(); } catch (e) { }
      const name = o.lobby.seats[s]?.name || '';
      o.lobby.seats[s] = null;
      if (game.players[s] && o.lobby.playing) { game.players[s].bot = true; game.players[s].remote = false; game.players[s].name += ' (봇)'; }
      sys(`${name} 님이 나갔습니다.`); pushLobby();
    } else if (o.role === 'client' || o.role === 'joining') {
      end('방장이 방을 닫았거나 연결이 끊겼습니다.');
    }
  }
  const newCode = () => String(1000 + Math.floor(Math.random() * 9000));
  function sys(textStr) { o.chat.push({ name: '', color: COL.dim, text: textStr, t: game.t, sys: true }); trimChat(); if (o.role === 'host') bcast({ t: 'chat', name: '', color: COL.dim, text: textStr, sys: true }); }
  function trimChat() { if (o.chat.length > 60) o.chat.splice(0, o.chat.length - 60); }
  function bcast(msg, except = -1) { for (let s = 1; s < 4; s++) if (connOf[s] && s !== except) net.send(connOf[s], msg); }
  function pushLobby(go = false) { bcast({ t: 'lobby', lobby: o.lobby, go }); }
  function fail(msg) { clearTimeout(joinTimer); o.error = msg; o.status = ''; net.destroy(); resetSeats(); o.role = null; }
  function resetSeats() {
    seatOf.clear();
    for (let k = 0; k < 4; k++) { connOf[k] = null; buf[k] = null; lastSeen[k] = 0; game.remoteIn[k] = null; }
  }
  function end(msg) {
    clearTimeout(joinTimer); net.destroy(); resetSeats();
    o.role = null; o.following = false; o.snaps = []; o.lobby = null;
    game.local = 0; o.notice = msg ? { text: msg, t: performance.now() } : null;
    game.go(msg ? 'online' : 'title');
  }

  // ---------- host side ----------
  function hostMsg(conn, m) {
    let s = seatOf.get(conn);
    if (s != null) lastSeen[s] = nowS();
    if (m.t === 'ping') return;
    if (m.t === 'bye') { dropConn(conn); return; }
    if (m.t === 'hello') {
      if (m.ver !== VERSION) { net.send(conn, { t: 'reject', reason: '게임 버전이 다릅니다. 둘 다 새로고침해 주세요.' }); return; }
      if (o.lobby.playing) { net.send(conn, { t: 'reject', reason: '이미 게임이 진행 중입니다. 판이 끝나고 다시 들어와 주세요.' }); return; }
      s = o.lobby.seats.findIndex((x, i) => i > 0 && !x);
      if (s < 0) { net.send(conn, { t: 'reject', reason: '방이 꽉 찼습니다. (최대 4명)' }); return; }
      const name = String(m.name || '').slice(0, 8) || `플레이어${s + 1}`;
      seatOf.set(conn, s); connOf[s] = conn; lastSeen[s] = nowS();
      o.lobby.seats[s] = { name, char: null };
      net.send(conn, { t: 'welcome', seat: s, lobby: o.lobby, chat: o.chat.slice(-20) });
      sys(`${name} 님이 들어왔습니다.`); pushLobby();
      return;
    }
    if (s == null) return;
    if (m.t === 'pick') { pickFor(s, m.char); return; }
    if (m.t === 'in') {
      const d = m.d || {}, b = buf[s] || {};
      // keep the latest held state; remember presses until the host's next frame uses them
      buf[s] = {
        mx: d.mx || 0, my: d.my || 0, a: !!d.a, px: d.px, py: d.py, pDown: !!d.pDown,
        aP: b.aP || !!d.aP, pP: b.pP || !!d.pP, upP: b.upP || !!d.upP, downP: b.downP || !!d.downP, leftP: b.leftP || !!d.leftP, rightP: b.rightP || !!d.rightP,
      };
      if (d.pP) { buf[s].px = d.px; buf[s].py = d.py; }
      return;
    }
    if (m.t === 'emote') { game.emotes.trigger(s, m.k, true); bcast({ t: 'emote', i: s, k: m.k }, s); return; }
    if (m.t === 'chat') {
      const seat = o.lobby.seats[s]; if (!seat) return;
      const msg = { name: seat.name, color: colorOf(s), text: String(m.text || '').slice(0, 80), t: game.t };
      o.chat.push(msg); trimChat(); bcast({ t: 'chat', name: msg.name, color: msg.color, text: msg.text }, s);
    }
  }
  function colorOf(s) {
    const c = o.lobby?.seats[s]?.char;
    return c ? ROSTER.find(r => r.id === c).color : '#f4efe6';
  }
  function pickFor(s, ch) {
    if (!ROSTER.some(r => r.id === ch) || o.lobby.playing) return;
    if (o.lobby.seats.some((x, i) => x && i !== s && x.char === ch)) return;
    o.lobby.seats[s].char = ch; pushLobby();
  }

  // ---------- client side ----------
  function clientMsg(m) {
    if (m.t === 'welcome') {
      clearTimeout(joinTimer);
      lastFromHost = nowS();
      o.role = 'client'; o.seat = m.seat; game.local = m.seat; o.lobby = m.lobby; o.chat = m.chat || []; o.error = '';
      game.go('room'); return;
    }
    if (m.t === 'reject') { fail(m.reason); return; }
    if (m.t === 'ping') return;
    if (m.t === 'lobby') {
      if (m.lobby.closed) { end('방장이 방을 닫았습니다.'); return; }
      o.lobby = m.lobby;
      if (m.go || (!o.lobby.playing && o.following)) { o.following = false; o.snaps = []; game.go('room'); }
      return;
    }
    if (m.t === 'snap') {
      const s = m.s;
      o.snaps.push({ s, recv: performance.now() / 1000 });
      if (o.snaps.length > 3) o.snaps.shift();
      for (const ev of s.sfx || []) playEvent(ev, o.seat);
      o.following = true;
      return;
    }
    if (m.t === 'emote') { game.emotes.trigger(m.i, m.k, true); return; }
    if (m.t === 'chat') { o.chat.push({ name: m.name, color: m.color, text: m.text, t: game.t, sys: m.sys }); trimChat(); }
  }

  // ---------- public ----------
  Object.assign(o, {
    host(name) {
      resetSeats(); lastFromHost = 0;
      o.name = name; o.error = ''; o.status = '방을 만드는 중...'; o.role = 'hosting'; hostTries = 0;
      o.code = newCode(); net.host(o.code);
    },
    join(code, name) {
      resetSeats(); lastFromHost = nowS();
      o.name = name; o.error = ''; o.status = '방에 들어가는 중...'; o.role = 'joining'; o.code = code;
      net.join(code);
      clearTimeout(joinTimer);
      joinTimer = setTimeout(() => { if (o.role === 'joining') fail('응답이 없습니다. 코드를 확인하거나 다시 시도해 주세요.'); }, 12000);
    },
    leave() { if (o.role === 'host') bcast({ t: 'lobby', lobby: { ...o.lobby, closed: true } }); end(null); },
    pick(ch) { if (o.role === 'host') pickFor(0, ch); else net.toHost({ t: 'pick', char: ch }); },
    setOption(k, v) { if (o.role !== 'host') return; o.lobby[k] = v; pushLobby(); },
    canStart() { return o.role === 'host' && o.lobby.seats.every(s => !s || s.char); },
    humans() { return o.lobby ? o.lobby.seats.filter(Boolean).length : 0; },
    start() {
      if (!o.canStart()) return;
      const used = o.lobby.seats.filter(Boolean).map(s => s.char);
      const free = ROSTER.map(r => r.id).filter(id => !used.includes(id)).sort(() => Math.random() - 0.5);
      game.players = o.lobby.seats.map((s, i) => {
        const id = s ? s.char : free.pop(), c = ROSTER.find(r => r.id === id);
        return { char: id, color: c.color, name: s ? s.name : `${c.name} (봇)`, charName: c.name, bot: !s, remote: !!s && i !== 0 };
      });
      game.local = 0; game.diff = DIFFS[o.lobby.diffI];
      o.lobby.playing = true; pushLobby();
      for (let s = 0; s < 4; s++) buf[s] = null;
      game.go('matchStart', { rounds: ROUND_OPTIONS[o.lobby.roundsI] });
    },
    toRoom() { if (o.role !== 'host') return; o.lobby.playing = false; pushLobby(true); game.go('room'); },
    sendChat(str) {
      str = String(str || '').trim().slice(0, 80); if (!str || !o.role) return;
      const me = o.lobby?.seats[o.seat];
      o.chat.push({ name: me ? me.name : o.name, color: colorOf(o.seat), text: str, t: game.t }); trimChat();
      if (o.role === 'host') bcast({ t: 'chat', name: me.name, color: colorOf(0), text: str });
      else net.toHost({ t: 'chat', text: str });
    },
    emote(i, k) {
      if (o.role === 'host') bcast({ t: 'emote', i, k });
      else if (o.role === 'client' && i === o.seat) net.toHost({ t: 'emote', k });
    },
    // called every frame before updates
    beginFrame(inp) {
      const now = nowS();
      if (now - lastPing > 1.5) {
        lastPing = now;
        if (o.role === 'host') bcast({ t: 'ping' });
        else if (o.role === 'client') net.toHost({ t: 'ping' });
      }
      if (o.role === 'host') for (let s = 1; s < 4; s++) if (connOf[s] && now - lastSeen[s] > 7) dropConn(connOf[s]);
      if (o.role === 'client' && now - lastFromHost > 7) { end('방장과 연결이 끊겼습니다.'); return; }
      if (o.role === 'host') {
        for (let s = 0; s < 4; s++) {
          const b = buf[s];
          game.remoteIn[s] = b ? { ...b } : null;
          if (b) { b.aP = b.pP = b.upP = b.downP = b.leftP = b.rightP = false; }
        }
      } else if (o.role === 'client' && o.following) {
        net.toHost({ t: 'in', d: { mx: inp.mx, my: inp.my, a: inp.a, px: Math.round(inp.px), py: Math.round(inp.py), pDown: inp.pDown, aP: inp.aP, pP: inp.pP, upP: inp.upP, downP: inp.downP, leftP: inp.leftP, rightP: inp.rightP } });
      }
    },
    // host: after updates, send the state
    endFrame() {
      if (o.role !== 'host' || !o.lobby?.playing || !game.matchSync.isMatch(game.sceneName)) return;
      const now = performance.now() / 1000;
      if (now - lastSnap < SNAP_EVERY) return;
      lastSnap = now;
      const s = game.matchSync.build();
      s.t = game.t; s.players = game.players; s.sfx = game.sfxQ.splice(0);
      const msg = { t: 'snap', s };
      for (let k = 1; k < 4; k++) if (connOf[k] && !net.busy(connOf[k])) net.send(connOf[k], msg);
    },
    // client: draw the host's state, smoothed between the last two snapshots
    clientApply() {
      const n = o.snaps.length; if (!n) return;
      const cur = o.snaps[n - 1], prev = n > 1 ? o.snaps[n - 2] : cur;
      const now = performance.now() / 1000;
      const iv = Math.max(0.02, Math.min(0.2, cur.recv - prev.recv));
      const a = Math.max(0, Math.min(1, (now - cur.recv) / iv));
      const same = prev !== cur && prev.s.scene === cur.s.scene;
      const s = same ? lerpState(prev.s, cur.s, a, '') : cur.s;
      game.t = same ? prev.s.t + (cur.s.t - prev.s.t) * a : cur.s.t;
      game.players = cur.s.players;
      const changed = game.sceneName !== cur.s.scene;
      game.matchSync.apply(s);
      if (changed) { game.scene = game.scenes[cur.s.scene]; game.sceneName = cur.s.scene; game.scene.follow?.(); }
    },
    // chat lines shown over the game
    drawOverlay(ctx) {
      if (!o.role || game.sceneName === 'room' || game.sceneName === 'online') return;
      const now = game.t, lines = o.chat.filter(c => now - c.t < 9 && now >= c.t - 1).slice(-5);
      lines.forEach((c, k) => {
        const y = H - 150 + k * 24, alpha = Math.min(1, (9 - (now - c.t)) / 1.5);
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(14,12,19,0.6)'; ctx.fillRect(12, y - 17, 420, 23);
        ctx.restore();
        if (c.sys) text(ctx, c.text, 20, y, { size: 14, weight: 700, color: COL.dim, alpha });
        else { text(ctx, c.name, 20, y, { size: 14, weight: 900, color: c.color, alpha }); text(ctx, c.text, 30 + measure(ctx, c.name, 14, 900), y, { size: 14, weight: 600, color: COL.text, alpha }); }
      });
    },
  });
  return o;
}

// sound event: [name, who, arg, delay]; who null = everyone, >=0 = only that seat, <0 = everyone except ~who
export function playEvent(ev, seat) {
  const [name, who, arg, delay] = ev;
  if (who != null) { if (who >= 0 && who !== seat) return; if (who < 0 && ~who === seat) return; }
  const f = sfx[name]; if (!f) return;
  if (delay) setTimeout(() => f(arg ?? undefined), delay * 1000); else f(arg ?? undefined);
}
