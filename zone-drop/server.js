// =============================================================================
// ZONE DROP — Multiplayer Server
// WebSocket game server + static file serving.
// Run:  npm install && npm start
// =============================================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── Static file server ──────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.glb':  'model/gltf-binary',
  '.ico':  'image/x-icon',
};

const STATIC_ROOT = path.join(__dirname, 'ZoneDrop');

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/zone-drop.html';

  const filePath = path.join(STATIC_ROOT, urlPath);
  // Prevent directory traversal
  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403); res.end(); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// ── WebSocket Game Server ───────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

let nextId = 1;
const players = new Map(); // id → { ws, id, name, state, alive }

wss.on('connection', (ws) => {
  const id = String(nextId++);
  const player = {
    ws,
    id,
    name: 'Player' + id,
    state: null,  // latest position/rotation/anim
    alive: true,
  };
  players.set(id, player);

  // Send welcome with assigned id + current players
  const existing = [];
  for (const [pid, p] of players) {
    if (pid !== id && p.state) {
      existing.push({ id: pid, name: p.name, state: p.state });
    }
  }
  send(ws, { type: 'welcome', id, players: existing });

  // Notify everyone else
  broadcast({ type: 'playerJoin', id, name: player.name }, id);

  console.log(`[+] Player ${id} connected (${players.size} online)`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join':
        player.name = String(msg.name || 'Player' + id).slice(0, 20);
        broadcast({ type: 'playerJoin', id, name: player.name }, id);
        break;

      case 'state':
        // Player position/rotation/animation update
        player.state = msg;
        player.alive = msg.alive !== false;
        break;

      case 'shoot':
        // Relay shot visual to all other players (tracer effect)
        broadcast({
          type: 'shot',
          playerId: id,
          origin: msg.origin,
          dir: msg.dir,
          weaponColor: msg.weaponColor,
          hitPoint: msg.hitPoint,
        }, id);
        break;

      case 'hit':
        // Player claims they hit another player → relay damage
        const target = players.get(msg.targetId);
        if (target && target.alive) {
          send(target.ws, {
            type: 'damage',
            fromId: id,
            fromName: player.name,
            amount: msg.damage,
            headshot: !!msg.headshot,
          });
        }
        break;

      case 'kill':
        // Relay kill event to everyone
        broadcast({
          type: 'kill',
          killerId: id,
          killerName: player.name,
          victimId: msg.victimId,
          victimName: msg.victimName,
        });
        break;

      case 'respawn':
        player.alive = true;
        break;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'playerLeave', id });
    console.log(`[-] Player ${id} disconnected (${players.size} online)`);
  });
});

// Broadcast states at 20Hz (every 50ms)
setInterval(() => {
  const states = {};
  for (const [id, p] of players) {
    if (p.state) {
      states[id] = {
        name: p.name,
        pos: p.state.pos,
        rot: p.state.rot,
        anim: p.state.anim,
        hp: p.state.hp,
        shield: p.state.shield,
        alive: p.state.alive,
        weaponColor: p.state.weaponColor,
      };
    }
  }
  if (Object.keys(states).length > 0) {
    broadcast({ type: 'states', players: states });
  }
}, 50);

// ── Helpers ─────────────────────────────────────────────────────────────────
function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(obj, excludeId) {
  const msg = JSON.stringify(obj);
  for (const [id, p] of players) {
    if (id !== excludeId && p.ws.readyState === 1) {
      p.ws.send(msg);
    }
  }
}

// ── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Zone Drop server running at http://localhost:${PORT}`);
});
