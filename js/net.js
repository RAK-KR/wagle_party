// P2P transport (PeerJS). The host's peer id is built from the 4-digit room code.
// Uses the free public PeerJS server only to find each other; game data goes peer to peer.

const PREFIX = 'wagle-party-room-';

function peerOptions() {
  const q = new URLSearchParams(location.search);
  const o = { debug: 0 };
  if (q.get('peerhost')) {          // for local testing with your own PeerJS server
    o.host = q.get('peerhost'); o.port = Number(q.get('peerport') || 9000);
    o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1';
  }
  return o;
}

export function createNet(h) {
  let peer = null, hostConn = null;
  const conns = new Set();
  // Every room gets its own Peer. Events from an older, already closed Peer can arrive late
  // (slow server). They must be ignored, or they would cancel the room that was just made.
  const live = (p) => p === peer;

  function wire(p, conn) {
    conn.on('data', (d) => { if (live(p)) h.data?.(conn, d); });
    conn.on('close', () => { conns.delete(conn); if (live(p)) h.close?.(conn); });
    conn.on('error', () => { conns.delete(conn); if (live(p)) h.close?.(conn); });
  }

  return {
    host(code) {
      this.destroy();
      const p = peer = new window.Peer(PREFIX + code, peerOptions());
      p.on('open', () => { if (live(p)) h.open?.(); });
      p.on('connection', (conn) => {
        if (!live(p)) { try { conn.close(); } catch (e) { } return; }
        conn.on('open', () => { if (!live(p)) return; conns.add(conn); h.conn?.(conn); });
        wire(p, conn);
      });
      p.on('disconnected', () => { if (live(p) && !p.destroyed) { try { p.reconnect(); } catch (e) { } } });
      p.on('error', (e) => { if (live(p)) h.error?.(e.type || 'error'); });
    },
    join(code) {
      this.destroy();
      const p = peer = new window.Peer(peerOptions());
      p.on('open', () => {
        if (!live(p)) return;
        const c = hostConn = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        c.on('open', () => { if (live(p)) h.conn?.(c); });
        wire(p, c);
      });
      p.on('error', (e) => { if (live(p)) h.error?.(e.type || 'error'); });
    },
    send(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { } },
    toHost(msg) { this.send(hostConn, msg); },
    // skip peers whose channel is backed up (keeps lag from piling up)
    busy(conn) { const dc = conn && conn.dataChannel; return !!dc && dc.bufferedAmount > 256 * 1024; },
    destroy() {
      const old = peer, oldConns = [...conns], oldHost = hostConn;
      peer = null; hostConn = null; conns.clear();     // mark as dead first, then close
      try { for (const c of oldConns) c.close(); } catch (e) { }
      try { oldHost && oldHost.close(); } catch (e) { }
      try { old && old.destroy(); } catch (e) { }
    },
  };
}
