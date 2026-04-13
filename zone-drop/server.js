// =============================================================================
// ZONE DROP — Multiplayer Server
// WebSocket game server + static file serving.
// Run:  npm install && npm start
// =============================================================================

const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const Database = require('better-sqlite3');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── Auth config ──────────────────────────────────────────────────────────────
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'hunters-dev-secret-change-in-prod';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── SQLite database ──────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'hunters.db'));
db.exec(`
    CREATE TABLE IF NOT EXISTS hunters_users (
        username      TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt          TEXT NOT NULL,
        created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        save_data     TEXT,
        story_save    TEXT
    )
`);
console.log('[DB] SQLite ready at data/hunters.db');

// ── DB helpers (synchronous — better-sqlite3) ────────────────────────────────
const stmtGetUser     = db.prepare('SELECT * FROM hunters_users WHERE username = ?');
const stmtUserExists  = db.prepare('SELECT 1 FROM hunters_users WHERE username = ?');
const stmtCreateUser  = db.prepare('INSERT INTO hunters_users (username, display_name, password_hash, salt) VALUES (?, ?, ?, ?)');
const stmtGetSave     = db.prepare('SELECT save_data, story_save FROM hunters_users WHERE username = ?');
const stmtSetBoth     = db.prepare('UPDATE hunters_users SET save_data = ?, story_save = ? WHERE username = ?');
const stmtSetSave     = db.prepare('UPDATE hunters_users SET save_data = ? WHERE username = ?');
const stmtSetStory    = db.prepare('UPDATE hunters_users SET story_save = ? WHERE username = ?');

function dbGetUser(key)    { return stmtGetUser.get(key) || null; }
function dbUserExists(key) { return !!stmtUserExists.get(key); }
function dbCreateUser(key, displayName, passwordHash, salt) {
    stmtCreateUser.run(key, displayName, passwordHash, salt);
}
function dbGetSave(key) {
    const row = stmtGetSave.get(key);
    if (!row) return null;
    return {
        save:      row.save_data   ? JSON.parse(row.save_data)   : null,
        storySave: row.story_save  ? JSON.parse(row.story_save)  : null,
    };
}
function dbSetSave(key, save, storySave) {
    if (save !== undefined && storySave !== undefined) {
        stmtSetBoth.run(JSON.stringify(save), JSON.stringify(storySave), key);
    } else if (save !== undefined) {
        stmtSetSave.run(JSON.stringify(save), key);
    } else if (storySave !== undefined) {
        stmtSetStory.run(JSON.stringify(storySave), key);
    }
}

// ── Password helpers (scrypt, no external deps) ──────────────────────────────
function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
}
function verifyPassword(password, salt, storedHash) {
    const hash = hashPassword(password, salt);
    try { return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex')); }
    catch { return false; }
}

// ── Token helpers (HMAC-SHA256, no jsonwebtoken) ─────────────────────────────
function createToken(username) {
    const header  = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
}
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${payload}`).digest('base64url');
    try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; } catch { return null; }
    let data;
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
    return Date.now() > data.exp ? null : data;
}

// ── Request helpers ──────────────────────────────────────────────────────────
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            try { resolve(text ? JSON.parse(text) : {}); } catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}
function requireAuth(req, res) {
    const auth = req.headers['authorization'] || '';
    const data = verifyToken(auth.startsWith('Bearer ') ? auth.slice(7) : null);
    if (!data) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return null;
    }
    return data;
}

// ── Static file server ───────────────────────────────────────────────────────
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
const STATIC_ROOT = path.join(__dirname, '..');

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];

    // ── API Routes ────────────────────────────────────────────────────────
    if (urlPath.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        try {
            // POST /api/auth/register
            if (req.method === 'POST' && urlPath === '/api/auth/register') {
                const { username, password } = await readBody(req);
                if (!username || !password) throw { code: 400, msg: 'Missing fields' };
                if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
                    throw { code: 400, msg: 'Username must be 3-20 alphanumeric chars or underscores' };
                if (password.length < 6)
                    throw { code: 400, msg: 'Password must be at least 6 characters' };
                const key = username.toLowerCase();
                if (dbUserExists(key)) throw { code: 409, msg: 'Username already taken' };
                const salt = crypto.randomBytes(16).toString('hex');
                dbCreateUser(key, username, hashPassword(password, salt), salt);
                res.writeHead(201);
                res.end(JSON.stringify({ token: createToken(key), username }));
                return;
            }

            // POST /api/auth/login
            if (req.method === 'POST' && urlPath === '/api/auth/login') {
                const { username, password } = await readBody(req);
                if (!username || !password) throw { code: 400, msg: 'Missing fields' };
                const key  = username.toLowerCase();
                const user = dbGetUser(key);
                if (!user || !verifyPassword(password, user.salt, user.password_hash))
                    throw { code: 401, msg: 'Invalid username or password' };
                res.writeHead(200);
                res.end(JSON.stringify({ token: createToken(key), username: user.display_name }));
                return;
            }

            // GET /api/save
            if (req.method === 'GET' && urlPath === '/api/save') {
                const auth = requireAuth(req, res);
                if (!auth) return;
                const data = dbGetSave(auth.username);
                if (!data) { res.writeHead(404); res.end(JSON.stringify({ error: 'User not found' })); return; }
                res.writeHead(200);
                res.end(JSON.stringify(data));
                return;
            }

            // POST /api/save
            if (req.method === 'POST' && urlPath === '/api/save') {
                const auth = requireAuth(req, res);
                if (!auth) return;
                const body = await readBody(req);
                dbSetSave(auth.username, body.save, body.storySave);
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
                return;
            }

            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        } catch (e) {
            const code = e.code || 500;
            const msg  = e.msg  || 'Server error';
            if (!e.code) console.error('[API error]', e);
            res.writeHead(code);
            res.end(JSON.stringify({ error: msg }));
        }
        return;
    }

    // ── Static File Server ────────────────────────────────────────────────
    let filePath_url = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(STATIC_ROOT, filePath_url);
    if (!filePath.startsWith(STATIC_ROOT) || filePath_url.includes('/.claude')) {
        res.writeHead(403); res.end(); return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

// ── WebSocket Game Server ────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

let nextId = 1;
const players = new Map();

wss.on('connection', (ws) => {
    const id = String(nextId++);
    const player = { ws, id, name: 'Player' + id, state: null, alive: true };
    players.set(id, player);

    const existing = [];
    for (const [pid, p] of players) {
        if (pid !== id && p.state) existing.push({ id: pid, name: p.name, state: p.state });
    }
    send(ws, { type: 'welcome', id, players: existing });
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
                player.state = msg;
                player.alive = msg.alive !== false;
                break;
            case 'shoot':
                broadcast({ type: 'shot', playerId: id, origin: msg.origin, dir: msg.dir, weaponColor: msg.weaponColor, hitPoint: msg.hitPoint }, id);
                break;
            case 'hit':
                const target = players.get(msg.targetId);
                if (target && target.alive) {
                    send(target.ws, { type: 'damage', fromId: id, fromName: player.name, amount: msg.damage, headshot: !!msg.headshot });
                }
                break;
            case 'kill':
                broadcast({ type: 'kill', killerId: id, killerName: player.name, victimId: msg.victimId, victimName: msg.victimName });
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

// Broadcast states at 20Hz
setInterval(() => {
    const states = {};
    for (const [id, p] of players) {
        if (p.state) {
            states[id] = { name: p.name, pos: p.state.pos, rot: p.state.rot, anim: p.state.anim, hp: p.state.hp, shield: p.state.shield, alive: p.state.alive, weaponColor: p.state.weaponColor };
        }
    }
    if (Object.keys(states).length > 0) broadcast({ type: 'states', players: states });
}, 50);

// ── Helpers ──────────────────────────────────────────────────────────────────
function send(ws, obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}
function broadcast(obj, excludeId) {
    const msg = JSON.stringify(obj);
    for (const [id, p] of players) {
        if (id !== excludeId && p.ws.readyState === 1) p.ws.send(msg);
    }
}

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`Zone Drop server running at http://localhost:${PORT}`);
});
