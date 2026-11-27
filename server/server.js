import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import selfsigned from 'selfsigned';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CERTS_DIR = path.join(__dirname, 'certs');
const ADMIN_EMAIL = 'mchtkrkmz@gmail.com';
const DEFAULT_USERS_DB_PATH = path.join(__dirname, 'data', 'users.json');

const HTTP_PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const DISABLE_HTTPS = process.env.DISABLE_HTTPS === '1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
};

export function getLanIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function generateRoomCode(rooms) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

async function ensureSelfSignedCert(lanIps) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
  const certPath = path.join(CERTS_DIR, 'cert.pem');
  const keyPath = path.join(CERTS_DIR, 'key.pem');
  const ipsPath = path.join(CERTS_DIR, 'ips.json');

  const currentIpsKey = JSON.stringify([...lanIps].sort());
  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(ipsPath)) {
    try {
      const savedKey = fs.readFileSync(ipsPath, 'utf8');
      if (savedKey === currentIpsKey) {
        return {
          cert: fs.readFileSync(certPath, 'utf8'),
          key: fs.readFileSync(keyPath, 'utf8'),
        };
      }
    } catch {
      // Regenerate below
    }
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...lanIps.map((ip) => ({ type: 7, ip })),
  ];

  const attrs = [{ name: 'commonName', value: 'VR Kiraathane LAN' }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.writeFileSync(certPath, pems.cert, 'utf8');
  fs.writeFileSync(keyPath, pems.private, 'utf8');
  fs.writeFileSync(ipsPath, currentIpsKey, 'utf8');

  return { cert: pems.cert, key: pems.private };
}

function hashPasswordServer(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return { salt, hash };
}

function verifyPasswordServer(password, userRecord) {
  if (!userRecord || !userRecord.salt || !userRecord.passwordHash) return false;
  try {
    const derived = crypto.scryptSync(String(password), userRecord.salt, 32);
    const stored = Buffer.from(userRecord.passwordHash, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function sanitizeUser(u) {
  if (!u) return null;
  const email = String(u.email || '').trim().toLowerCase();
  const isAdmin = email === ADMIN_EMAIL;
  return {
    name: u.name || 'Oyuncu',
    email,
    avatarId: u.avatarId || 'dayi',
    role: isAdmin ? 'ADMIN' : 'PLAYER',
    isAdmin,
    aiAccess: isAdmin ? true : Boolean(u.aiAccess),
    createdAt: u.createdAt || null,
  };
}

function loadUsersStore(dbPath) {
  const map = new Map();
  try {
    if (fs.existsSync(dbPath)) {
      const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const list = Array.isArray(raw) ? raw : [];
      for (const u of list) {
        if (u && u.email) {
          const norm = String(u.email).trim().toLowerCase();
          map.set(norm, { ...u, email: norm });
        }
      }
    }
  } catch (err) {
    console.warn('[AUTH] users.json okunamadı:', err.message);
  }
  return map;
}

function saveUsersStore(dbPath, usersMap) {
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const list = Array.from(usersMap.values());
    fs.writeFileSync(dbPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[AUTH] users.json kaydedilemedi:', err.message);
  }
}

function readJsonBody(req, maxBytes = 32768) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error('İstek boyutu sınırı aşıldı.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendHttpJson(res, statusCode, obj) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

export async function startGameServer(options = {}) {
  const httpPort = options.httpPort ?? HTTP_PORT;
  const httpsPort = options.httpsPort ?? HTTPS_PORT;
  const disableHttps = options.disableHttps ?? DISABLE_HTTPS;
  const quiet = options.quiet ?? false;
  const usersDbPath = options.usersDbPath || DEFAULT_USERS_DB_PATH;
  const usersStore = loadUsersStore(usersDbPath);
  const sessions = new Map(); // token -> normalizedEmail

  function getAuthEmail(req) {
    const auth = String(req.headers.authorization || '');
    if (!auth.toLowerCase().startsWith('bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    return sessions.get(token) || null;
  }

  const rooms = new Map(); // roomCode -> Room
  const clients = new Map(); // clientId -> { ws, clientId, roomCode, name, avatarId, isAlive }
  const startedAt = Date.now();
  const lanIps = getLanIps();

  function sendJson(ws, obj) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  function serializeRoom(room) {
    return {
      code: room.code,
      gameType: room.gameType,
      maxPlayers: room.maxPlayers,
      hasPassword: Boolean(room.password),
      hostId: room.hostId,
      started: room.started,
      players: room.players.map((p) => ({
        clientId: p.clientId,
        seatIndex: p.seatIndex,
        name: p.name,
        avatarId: p.avatarId,
        isHost: p.clientId === room.hostId,
        isVip: Boolean(p.isVip),
      })),
    };
  }

  function listPublicRooms() {
    const list = [];
    for (const room of rooms.values()) {
      list.push({
        code: room.code,
        gameType: room.gameType,
        hostName: room.players.find((p) => p.clientId === room.hostId)?.name || 'Masa Sahibi',
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        hasPassword: Boolean(room.password),
        started: room.started,
      });
    }
    return list;
  }

  function broadcastRoomUpdate(room) {
    const payload = { type: 'ROOM_UPDATE', room: serializeRoom(room) };
    for (const p of room.players) {
      const c = clients.get(p.clientId);
      if (c) sendJson(c.ws, payload);
    }
  }

  function broadcastToRoom(room, obj, excludeClientId = null) {
    for (const p of room.players) {
      if (excludeClientId && p.clientId === excludeClientId) continue;
      const c = clients.get(p.clientId);
      if (c) sendJson(c.ws, obj);
    }
  }

  function removeClientFromRoom(client) {
    if (!client.roomCode) return;
    const room = rooms.get(client.roomCode);
    client.roomCode = null;
    if (!room) return;

    const leavingPlayer = room.players.find((p) => p.clientId === client.clientId);
    room.players = room.players.filter((p) => p.clientId !== client.clientId);

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }

    if (room.started && leavingPlayer) {
      broadcastToRoom(room, {
        type: 'PLAYER_DISCONNECTED',
        seatIndex: leavingPlayer.seatIndex,
        clientId: client.clientId,
        playerName: leavingPlayer.name,
      });
    }

    if (room.hostId === client.clientId) {
      room.hostId = room.players[0].clientId;
      broadcastToRoom(room, {
        type: 'HOST_CHANGED',
        hostId: room.hostId,
        hostSeatIndex: room.players[0].seatIndex,
      });
    }

    broadcastRoomUpdate(room);
  }

  function handleWsMessage(client, rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'PING': {
        sendJson(client.ws, { type: 'PONG', ts: Date.now() });
        break;
      }

      case 'LIST_ROOMS': {
        sendJson(client.ws, { type: 'ROOMS_LIST', rooms: listPublicRooms() });
        break;
      }

      case 'CREATE_ROOM': {
        removeClientFromRoom(client);
        const maxPlayers = Math.max(2, Math.min(4, Number(msg.maxPlayers) || 4));
        const gameType = String(msg.gameType || 'BATAK').toUpperCase();
        const password = typeof msg.password === 'string' ? msg.password : '';
        const name = String(msg.playerName || 'Masa Sahibi').trim().slice(0, 18) || 'Masa Sahibi';
        const avatarId = String(msg.avatarId || 'dayi');

        const code = generateRoomCode(rooms);
        const room = {
          code,
          gameType,
          maxPlayers,
          password,
          hostId: client.clientId,
          started: false,
          lastSnapshot: null,
          players: [
            {
              clientId: client.clientId,
              seatIndex: 0,
              name,
              avatarId,
              isVip: Boolean(msg.isVip),
            },
          ],
        };
        rooms.set(code, room);
        client.roomCode = code;
        client.name = name;
        client.avatarId = avatarId;

        sendJson(client.ws, {
          type: 'ROOM_CREATED',
          roomCode: code,
          clientId: client.clientId,
          seatIndex: 0,
          room: serializeRoom(room),
        });
        broadcastRoomUpdate(room);
        break;
      }

      case 'JOIN_ROOM': {
        const roomCode = String(msg.roomCode || '').trim().toUpperCase();
        const password = typeof msg.password === 'string' ? msg.password : '';
        const name = String(msg.playerName || 'Misafir').trim().slice(0, 18) || 'Misafir';
        const avatarId = String(msg.avatarId || 'beyefendi');

        const room = rooms.get(roomCode);
        if (!room) {
          sendJson(client.ws, { type: 'JOIN_REJECTED', reason: `"${roomCode}" kodlu oda bulunamadı!` });
          return;
        }
        if (room.password && room.password !== password) {
          sendJson(client.ws, { type: 'JOIN_REJECTED', reason: 'Oda parolası hatalı!' });
          return;
        }
        if (room.started) {
          sendJson(client.ws, { type: 'JOIN_REJECTED', reason: 'Bu masadaki oyun zaten başlamış!' });
          return;
        }
        if (room.players.length >= room.maxPlayers) {
          sendJson(client.ws, { type: 'JOIN_REJECTED', reason: 'Masa tamamen dolu!' });
          return;
        }

        removeClientFromRoom(client);

        // Assign lowest available seat index
        const usedSeats = new Set(room.players.map((p) => p.seatIndex));
        let seatIndex = 0;
        while (usedSeats.has(seatIndex) && seatIndex < room.maxPlayers) seatIndex++;

        room.players.push({
          clientId: client.clientId,
          seatIndex,
          name,
          avatarId,
          isVip: Boolean(msg.isVip),
        });
        room.players.sort((a, b) => a.seatIndex - b.seatIndex);

        client.roomCode = roomCode;
        client.name = name;
        client.avatarId = avatarId;

        sendJson(client.ws, {
          type: 'ROOM_JOINED',
          roomCode,
          clientId: client.clientId,
          seatIndex,
          room: serializeRoom(room),
        });
        broadcastRoomUpdate(room);
        break;
      }

      case 'LEAVE_ROOM': {
        removeClientFromRoom(client);
        sendJson(client.ws, { type: 'LEFT_ROOM' });
        break;
      }

      case 'START_GAME': {
        const room = rooms.get(client.roomCode);
        if (!room || room.hostId !== client.clientId) return;
        room.started = true;
        if (msg.gameType) room.gameType = String(msg.gameType).toUpperCase();
        if (msg.maxPlayers) room.maxPlayers = Math.max(2, Math.min(4, Number(msg.maxPlayers)));

        broadcastToRoom(room, {
          type: 'GAME_STARTED',
          gameType: room.gameType,
          maxPlayers: room.maxPlayers,
          hostId: room.hostId,
          room: serializeRoom(room),
        });
        break;
      }

      case 'GAME_STATE': {
        const room = rooms.get(client.roomCode);
        if (!room || room.hostId !== client.clientId) return;
        room.lastSnapshot = msg.snapshot || null;
        broadcastToRoom(
          room,
          {
            type: 'GAME_STATE',
            snapshot: msg.snapshot,
            event: msg.event || null,
          },
          client.clientId
        );
        break;
      }

      case 'PLAYER_ACTION': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const senderPlayer = room.players.find((p) => p.clientId === client.clientId);
        if (!senderPlayer) return;

        const hostClient = clients.get(room.hostId);
        if (!hostClient) return;
        sendJson(hostClient.ws, {
          type: 'PLAYER_ACTION',
          fromClientId: client.clientId,
          fromSeat: senderPlayer.seatIndex,
          action: msg.action,
          payload: msg.payload || {},
        });
        break;
      }

      case 'VOICE_READY':
      case 'VOICE_OFFER':
      case 'VOICE_ANSWER':
      case 'VOICE_ICE':
      case 'VOICE_STATE':
      case 'VOICE_AUDIO': {
        const room = rooms.get(client.roomCode);
        if (!room) return;
        const senderPlayer = room.players.find((p) => p.clientId === client.clientId);
        if (!senderPlayer) return;

        const relayPayload = {
          type: msg.type,
          fromClientId: client.clientId,
          fromSeat: senderPlayer.seatIndex,
          fromName: senderPlayer.name,
          payload: msg.payload || {},
        };

        if (msg.targetClientId) {
          const target = clients.get(msg.targetClientId);
          const inSameRoom = room.players.some((p) => p.clientId === msg.targetClientId);
          if (target && inSameRoom) {
            sendJson(target.ws, relayPayload);
          }
        } else {
          broadcastToRoom(room, relayPayload, client.clientId);
        }
        break;
      }

      case 'IDENTIFY_USER': {
        const token = typeof msg.token === 'string' ? msg.token.trim() : '';
        const email = token ? sessions.get(token) : null;
        if (email) {
          client.userEmail = email;
        } else {
          client.userEmail = null;
        }
        break;
      }
    }
  }

  async function handleHttpRequest(req, res) {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(reqUrl.pathname);

    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          rooms: rooms.size,
          clients: clients.size,
          uptimeSec: Math.round((Date.now() - startedAt) / 1000),
          lanIps,
          httpPort,
          httpsPort: disableHttps ? null : httpsPort,
        })
      );
      return;
    }

    if (pathname === '/api/rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ rooms: listPublicRooms() }));
      return;
    }

    // --- ÜYELİK & YÖNETİCİ YAPAY ZEKA YETKİ ENDPOINT'LERİ ---
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const avatarId = String(body.avatarId || 'dayi');

      if (!name) return sendHttpJson(res, 400, { ok: false, error: 'Lütfen adınızı ve soyadınızı girin.' });
      if (!email || !email.includes('@')) return sendHttpJson(res, 400, { ok: false, error: 'Geçerli e-posta girin.' });
      if (password.length < 3) return sendHttpJson(res, 400, { ok: false, error: 'Şifre en az 3 karakter olmalıdır.' });

      if (usersStore.has(email)) {
        return sendHttpJson(res, 409, { ok: false, error: 'Bu e-posta adresiyle kayıtlı bir üyelik zaten mevcut!' });
      }

      const { salt, hash } = hashPasswordServer(password);
      const isAdmin = email === ADMIN_EMAIL;
      const newUser = {
        name,
        email,
        avatarId,
        salt,
        passwordHash: hash,
        role: isAdmin ? 'ADMIN' : 'PLAYER',
        aiAccess: isAdmin,
        createdAt: new Date().toISOString(),
      };
      usersStore.set(email, newUser);
      saveUsersStore(usersDbPath, usersStore);

      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, email);
      return sendHttpJson(res, 200, { ok: true, token, user: sanitizeUser(newUser) });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      const user = usersStore.get(email);
      if (!user) {
        return sendHttpJson(res, 404, {
          ok: false,
          error: 'Bu e-posta adresi ile kayıtlı üye bulunamadı. Lütfen "Üye Ol" sekmesinden kayıt olun.',
        });
      }
      if (!verifyPasswordServer(password, user)) {
        return sendHttpJson(res, 401, { ok: false, error: 'Hatalı şifre girdiniz! Lütfen tekrar deneyin.' });
      }

      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, email);
      return sendHttpJson(res, 200, { ok: true, token, user: sanitizeUser(user) });
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const email = getAuthEmail(req);
      const user = email ? usersStore.get(email) : null;
      if (!user) return sendHttpJson(res, 401, { ok: false, error: 'Oturum bulunamadı veya süresi doldu.' });
      return sendHttpJson(res, 200, { ok: true, user: sanitizeUser(user) });
    }

    if (pathname === '/api/admin/users' && req.method === 'GET') {
      const email = getAuthEmail(req);
      if (email !== ADMIN_EMAIL) {
        return sendHttpJson(res, 403, { ok: false, error: 'Bu işlem için yalnızca yönetici yetkilidir.' });
      }
      const list = Array.from(usersStore.values()).map(sanitizeUser);
      return sendHttpJson(res, 200, { ok: true, users: list });
    }

    if (pathname === '/api/admin/set-ai-access' && req.method === 'POST') {
      const adminEmail = getAuthEmail(req);
      if (adminEmail !== ADMIN_EMAIL) {
        return sendHttpJson(res, 403, { ok: false, error: 'Bu işlem için yalnızca yönetici yetkilidir.' });
      }
      const body = await readJsonBody(req);
      const targetEmail = String(body.email || '').trim().toLowerCase();
      if (!targetEmail || targetEmail === ADMIN_EMAIL) {
        return sendHttpJson(res, 400, { ok: false, error: 'Geçersiz üye hedefi veya yönetici yetkisi değiştirilemez.' });
      }
      const targetUser = usersStore.get(targetEmail);
      if (!targetUser) {
        return sendHttpJson(res, 404, { ok: false, error: 'Üye bulunamadı.' });
      }
      targetUser.aiAccess = Boolean(body.aiAccess);
      usersStore.set(targetEmail, targetUser);
      saveUsersStore(usersDbPath, usersStore);

      // Anlık bağlı WebSocket istemcisine yetki değişimini bildir
      for (const c of clients.values()) {
        if (c.userEmail === targetEmail) {
          sendJson(c.ws, {
            type: 'AI_ACCESS_UPDATED',
            email: targetEmail,
            aiAccess: targetUser.aiAccess,
          });
        }
      }
      return sendHttpJson(res, 200, { ok: true, user: sanitizeUser(targetUser) });
    }

    // Serve production build from dist/
    let safeRelPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    safeRelPath = path.normalize(safeRelPath).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = path.join(DIST_DIR, safeRelPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const indexFallback = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(indexFallback)) {
        filePath = indexFallback;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('dist/ bulunamadı. Lütfen önce "npm run build" çalıştırın.');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const isNoStore = ext === '.html' || path.basename(filePath) === 'sw.js';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': isNoStore ? 'no-store, no-cache, must-revalidate' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  }

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    const clientId = 'c_' + crypto.randomUUID().slice(0, 12);
    const client = {
      ws,
      clientId,
      roomCode: null,
      name: 'Oyuncu',
      avatarId: 'dayi',
      isAlive: true,
    };
    clients.set(clientId, client);

    sendJson(ws, { type: 'WELCOME', clientId, rooms: listPublicRooms() });

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data) => handleWsMessage(client, data));

    ws.on('close', () => {
      removeClientFromRoom(client);
      clients.delete(clientId);
    });

    ws.on('error', () => {
      removeClientFromRoom(client);
      clients.delete(clientId);
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.isAlive) {
        client.ws.terminate();
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 25000);

  function attachUpgrade(server) {
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  const httpServer = http.createServer(handleHttpRequest);
  attachUpgrade(httpServer);

  let httpsServer = null;
  if (!disableHttps) {
    try {
      const creds = await ensureSelfSignedCert(lanIps);
      httpsServer = https.createServer(creds, handleHttpRequest);
      attachUpgrade(httpsServer);
    } catch (err) {
      if (!quiet) {
        console.warn('[SUNUCU] HTTPS sertifikası oluşturulamadı, yalnızca HTTP çalışacak:', err.message);
      }
    }
  }

  const startPromise = new Promise((resolve) => {
    httpServer.listen(httpPort, '0.0.0.0', () => {
      const actualHttpPort = httpServer.address().port;
      if (httpsServer) {
        httpsServer.listen(httpsPort, '0.0.0.0', () => {
          const actualHttpsPort = httpsServer.address().port;
          if (!quiet) printBanner(actualHttpPort, actualHttpsPort, lanIps);
          resolve({ httpPort: actualHttpPort, httpsPort: actualHttpsPort });
        });
      } else {
        if (!quiet) printBanner(actualHttpPort, null, lanIps);
        resolve({ httpPort: actualHttpPort, httpsPort: null });
      }
    });
  });

  function close() {
    clearInterval(heartbeatInterval);
    for (const client of clients.values()) {
      try {
        client.ws.close();
      } catch {
        // ignore
      }
    }
    wss.close();
    const closers = [new Promise((r) => httpServer.close(r))];
    if (httpsServer) closers.push(new Promise((r) => httpsServer.close(r)));
    return Promise.all(closers);
  }

  return { httpServer, httpsServer, wss, rooms, clients, startPromise, close };
}

function printBanner(httpPort, httpsPort, lanIps) {
  console.log('\n====================================================================');
  console.log('  VR KIRAATHANE (BATAK • PİŞTİ • OKEY • 101) — SUNUCU HAZIR');
  console.log('====================================================================');
  console.log(`  PC Tarayıcı (HTTP)      : http://localhost:${httpPort}`);
  for (const ip of lanIps) {
    console.log(`  Yerel Ağ (HTTP)         : http://${ip}:${httpPort}`);
  }
  if (httpsPort) {
    console.log(`  PC Güvenli (HTTPS)      : https://localhost:${httpsPort}`);
    for (const ip of lanIps) {
      console.log(`  Quest 3 VR + Mik (HTTPS): https://${ip}:${httpsPort}`);
    }
    console.log('  (Quest 3 tarayıcıda ilk açılışta Gelişmiş -> Devam Et onaylayın)');
  }
  console.log('====================================================================\n');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  startGameServer();
}
