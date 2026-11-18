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

  function wire(conn) {
    conn.on('data', (d) => h.data?.(conn, d));
    conn.on('close', () => { conns.delete(conn); h.close?.(conn); });
    conn.on('error', () => { conns.delete(conn); h.close?.(conn); });
  }

  return {
    host(code) {
      this.destroy();
      peer = new window.Peer(PREFIX + code, peerOptions());
      peer.on('open', () => h.open?.());
      peer.on('connection', (conn) => {
        conn.on('open', () => { conns.add(conn); h.conn?.(conn); });
        wire(conn);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
      peer.on('error', (e) => h.error?.(e.type || 'error'));
    },
    join(code) {
      this.destroy();
      peer = new window.Peer(peerOptions());
      peer.on('open', () => {
        hostConn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        hostConn.on('open', () => h.conn?.(hostConn));
        wire(hostConn);
      });
      peer.on('error', (e) => h.error?.(e.type || 'error'));
    },
    send(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { } },
    toHost(msg) { this.send(hostConn, msg); },
    // skip peers whose channel is backed up (keeps lag from piling up)
    busy(conn) { const dc = conn && conn.dataChannel; return !!dc && dc.bufferedAmount > 256 * 1024; },
    destroy() {
      try { for (const c of conns) c.close(); } catch (e) { }
      conns.clear();
      try { hostConn && hostConn.close(); } catch (e) { }
      hostConn = null;
      try { peer && peer.destroy(); } catch (e) { }
      peer = null;
    },
  };
}
