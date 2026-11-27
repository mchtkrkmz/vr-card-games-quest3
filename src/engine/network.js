// Gerçek WebSocket + PeerJS Bulut P2P Hibrit Çok Oyunculu Masa ve Ses Sinyali Yöneticisi

const P2P_ROOM_PREFIX = 'vr52-kiraathane-v1-';
const P2P_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.isHost = false;
    this.roomCode = null;
    this.roomPassword = '';
    this.gameType = 'BATAK';
    this.maxPlayers = 4;
    this.localPlayerId = 0; // seatIndex
    this.localPlayerName = 'Oyuncu';
    this.localAvatarId = 'dayi';
    this.roomPlayers = []; // [{ clientId, seat, seatIndex, name, avatarId, isHost, isVip }]
    this.publicRooms = [];
    this.eventListeners = [];
    this.isConnected = false; // in room
    this.serverConnected = false; // ws or p2p ready
    this.serverStatus = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
    this.transportMode = 'ws'; // 'ws' | 'p2p'
    this.customServerUrl =
      typeof localStorage !== 'undefined' ? localStorage.getItem('vr52_server_url') || '' : '';

    this._connectPromise = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._pendingRequests = new Map(); // type -> { resolve, reject, timer }

    // PeerJS Cloud P2P state (used automatically on GitHub Pages / static hosts or when WS server is absent)
    this._peer = null;
    this._p2pGuestConns = new Map(); // guestClientId -> DataConnection
    this._p2pHostConn = null; // guest -> DataConnection
    this._p2pStarted = false;
  }

  isStaticHostedWithoutCustomServer(
    hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '',
    protocol = typeof window !== 'undefined' && window.location ? window.location.protocol : ''
  ) {
    if (this.customServerUrl && this.customServerUrl.trim()) return false;
    if (protocol === 'file:') return true;
    return /(\.github\.io|\.netlify\.app|\.vercel\.app|\.pages\.dev)$/i.test(hostname || '');
  }

  _activateP2PMode() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.transportMode = 'p2p';
    this.serverConnected = true;
    this.serverStatus = 'connected';
    this.clientId = this.clientId || `p2p_${Math.random().toString(36).slice(2, 8)}`;
    this.publicRooms = [];
    this.emit('connection_status', { status: 'connected', mode: 'p2p', clientId: this.clientId });
    this.emit('rooms_list', { rooms: [] });
    return this.clientId;
  }

  _generateP2PRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  _buildP2PRoomObj() {
    return {
      code: this.roomCode,
      gameType: this.gameType,
      maxPlayers: this.maxPlayers,
      hostId: this.clientId,
      hasPassword: Boolean(this.roomPassword),
      started: this._p2pStarted,
      players: this.roomPlayers,
    };
  }

  _p2pBroadcastToGuests(msg, excludeClientId = null) {
    for (const [cid, conn] of this._p2pGuestConns.entries()) {
      if (excludeClientId && cid === excludeClientId) continue;
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch {
          // ignore send errors on closing peer
        }
      }
    }
  }

  _cleanupP2P() {
    for (const conn of this._p2pGuestConns.values()) {
      try {
        conn.close();
      } catch {}
    }
    this._p2pGuestConns.clear();
    if (this._p2pHostConn) {
      try {
        this._p2pHostConn.close();
      } catch {}
      this._p2pHostConn = null;
    }
    if (this._peer) {
      try {
        this._peer.destroy();
      } catch {}
      this._peer = null;
    }
    this._p2pStarted = false;
  }

  async _createPeerInstance(peerId = undefined) {
    const mod = await import('peerjs');
    const PeerCtor = mod.Peer || mod.default?.Peer || mod.default;
    return new PeerCtor(peerId, {
      debug: 0,
      secure: true,
      config: P2P_ICE_CONFIG,
    });
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
    };
  }

  emit(event, data) {
    for (const cb of this.eventListeners) {
      try {
        cb(event, data);
      } catch (err) {
        console.warn('[NETWORK] Listener hatası:', err);
      }
    }
  }

  getDefaultWsUrl() {
    if (this.customServerUrl && this.customServerUrl.trim()) {
      let u = this.customServerUrl.trim();
      if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
      if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
      if (!u.startsWith('ws://') && !u.startsWith('wss://')) u = 'ws://' + u;
      if (!u.endsWith('/ws')) u = u.replace(/\/+$/, '') + '/ws';
      return u;
    }
    if (typeof window !== 'undefined' && window.location) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}/ws`;
    }
    return 'ws://localhost:3000/ws';
  }

  setServerUrl(url) {
    this.customServerUrl = (url || '').trim();
    if (typeof localStorage !== 'undefined') {
      if (this.customServerUrl) {
        localStorage.setItem('vr52_server_url', this.customServerUrl);
      } else {
        localStorage.removeItem('vr52_server_url');
      }
    }
    this._cleanupP2P();
    this.isConnected = false;
    this.isHost = false;
    this.roomCode = null;
    this.roomPlayers = [];
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.serverConnected = false;
    this.transportMode =
      !this.customServerUrl && this.isStaticHostedWithoutCustomServer() ? 'p2p' : 'ws';
    return this.connect();
  }

  connect() {
    if (this.isStaticHostedWithoutCustomServer()) {
      return Promise.resolve(this._activateP2PMode());
    }
    if (this.transportMode === 'p2p' && this.serverConnected) {
      return Promise.resolve(this.clientId);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.clientId) {
      return Promise.resolve(this.clientId);
    }
    if (this._connectPromise) return this._connectPromise;

    this.transportMode = 'ws';
    this.serverStatus = 'connecting';
    this.emit('connection_status', { status: 'connecting', mode: 'ws', url: this.getDefaultWsUrl() });

    this._connectPromise = new Promise((resolve, reject) => {
      const wsUrl = this.getDefaultWsUrl();
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        this._connectPromise = null;
        if (!this.customServerUrl.trim()) {
          resolve(this._activateP2PMode());
          return;
        }
        this.serverStatus = 'disconnected';
        this.emit('connection_status', { status: 'disconnected', mode: 'ws', error: err.message });
        reject(err);
        return;
      }

      this.ws = ws;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this._connectPromise = null;
          try {
            ws.close();
          } catch {}
          if (!this.customServerUrl.trim()) {
            resolve(this._activateP2PMode());
            return;
          }
          this.serverStatus = 'disconnected';
          this.emit('connection_status', { status: 'disconnected', mode: 'ws', error: 'Sunucu zaman aşımı' });
          reject(new Error('Oyun sunucusuna bağlanılamadı. Sunucunun çalıştığından emin olun.'));
        }
      }, 4500);

      ws.onopen = () => {
        this._reconnectAttempts = 0;
      };

      ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (msg.type === 'WELCOME') {
          this.transportMode = 'ws';
          this.clientId = msg.clientId;
          this.serverConnected = true;
          this.serverStatus = 'connected';
          this.publicRooms = msg.rooms || [];
          this.emit('connection_status', { status: 'connected', mode: 'ws', clientId: this.clientId, url: wsUrl });
          this.emit('rooms_list', { rooms: this.publicRooms });
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            this._connectPromise = null;
            resolve(this.clientId);
          }
          return;
        }
        this._handleServerMessage(msg);
      };

      ws.onerror = () => {
        // Error handler delegates cleanup to onclose
      };

      ws.onclose = () => {
        if (this.transportMode === 'p2p') {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            this._connectPromise = null;
            resolve(this.clientId);
          }
          return;
        }
        const wasConnected = this.serverConnected;
        this.serverConnected = false;
        this.ws = null;

        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this._connectPromise = null;
          if (!this.customServerUrl.trim()) {
            resolve(this._activateP2PMode());
            return;
          }
          this.serverStatus = 'disconnected';
          this.emit('connection_status', { status: 'disconnected', mode: 'ws', url: wsUrl });
          reject(new Error('WebSocket sunucusuna ulaşılamadı.'));
          return;
        }

        this.serverStatus = 'disconnected';
        this.emit('connection_status', { status: 'disconnected', mode: 'ws', url: wsUrl });

        if (wasConnected && this.isConnected) {
          this.isConnected = false;
          this.emit('host_disconnected', { message: 'Sunucu bağlantısı koptu.' });
        }

        if (this.customServerUrl.trim() || !this.isStaticHostedWithoutCustomServer()) {
          this._scheduleReconnect();
        }
      };
    });

    return this._connectPromise;
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    const delay = Math.min(8000, 1200 * Math.pow(1.4, this._reconnectAttempts));
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  _normalizePlayers(players = []) {
    return players.map((p) => ({
      ...p,
      seat: p.seatIndex ?? p.seat ?? 0,
      seatIndex: p.seatIndex ?? p.seat ?? 0,
      peerId: p.clientId,
    }));
  }

  _handleServerMessage(msg) {
    switch (msg.type) {
      case 'ROOMS_LIST': {
        this.publicRooms = msg.rooms || [];
        this.emit('rooms_list', { rooms: this.publicRooms });
        break;
      }

      case 'ROOM_CREATED': {
        this.roomCode = msg.roomCode;
        this.localPlayerId = msg.seatIndex ?? 0;
        this.isHost = true;
        this.isConnected = true;
        this.gameType = msg.room?.gameType || this.gameType;
        this.maxPlayers = msg.room?.maxPlayers || this.maxPlayers;
        this.roomPlayers = this._normalizePlayers(msg.room?.players || []);

        const pending = this._pendingRequests.get('CREATE_ROOM');
        if (pending) {
          clearTimeout(pending.timer);
          this._pendingRequests.delete('CREATE_ROOM');
          pending.resolve({
            roomCode: this.roomCode,
            seat: this.localPlayerId,
            gameType: this.gameType,
            maxPlayers: this.maxPlayers,
            players: this.roomPlayers,
          });
        }

        this.emit('room_created', {
          roomCode: this.roomCode,
          hasPassword: Boolean(msg.room?.hasPassword),
          gameType: this.gameType,
          maxPlayers: this.maxPlayers,
          players: this.roomPlayers,
        });
        break;
      }

      case 'ROOM_JOINED': {
        this.roomCode = msg.roomCode;
        this.localPlayerId = msg.seatIndex ?? 0;
        this.isHost = msg.room?.hostId === this.clientId;
        this.isConnected = true;
        this.gameType = msg.room?.gameType || this.gameType;
        this.maxPlayers = msg.room?.maxPlayers || this.maxPlayers;
        this.roomPlayers = this._normalizePlayers(msg.room?.players || []);

        const pending = this._pendingRequests.get('JOIN_ROOM');
        if (pending) {
          clearTimeout(pending.timer);
          this._pendingRequests.delete('JOIN_ROOM');
          pending.resolve({
            seat: this.localPlayerId,
            roomCode: this.roomCode,
            gameType: this.gameType,
            maxPlayers: this.maxPlayers,
            players: this.roomPlayers,
          });
        }

        this.emit('joined_successfully', {
          seat: this.localPlayerId,
          roomCode: this.roomCode,
          gameType: this.gameType,
          maxPlayers: this.maxPlayers,
          players: this.roomPlayers,
        });
        break;
      }

      case 'JOIN_REJECTED': {
        const pending = this._pendingRequests.get('JOIN_ROOM');
        if (pending) {
          clearTimeout(pending.timer);
          this._pendingRequests.delete('JOIN_ROOM');
          pending.reject(new Error(msg.reason || 'Odaya katılım reddedildi.'));
        }
        this.emit('join_rejected', { reason: msg.reason });
        break;
      }

      case 'ROOM_UPDATE': {
        if (!msg.room) break;
        this.roomPlayers = this._normalizePlayers(msg.room.players || []);
        this.gameType = msg.room.gameType || this.gameType;
        this.maxPlayers = msg.room.maxPlayers || this.maxPlayers;
        this.isHost = msg.room.hostId === this.clientId;
        const me = this.roomPlayers.find((p) => p.clientId === this.clientId);
        if (me) this.localPlayerId = me.seatIndex;
        this.emit('room_updated', {
          players: this.roomPlayers,
          gameType: this.gameType,
          maxPlayers: this.maxPlayers,
          hostId: msg.room.hostId,
        });
        break;
      }

      case 'GAME_STARTED': {
        if (msg.room) {
          this.roomPlayers = this._normalizePlayers(msg.room.players || []);
          this.gameType = msg.gameType || msg.room.gameType;
          this.maxPlayers = msg.maxPlayers || msg.room.maxPlayers;
          this.isHost = msg.room.hostId === this.clientId;
        }
        this.emit('game_started_by_host', {
          gameType: this.gameType,
          maxPlayers: this.maxPlayers,
          players: this.roomPlayers,
          hostId: msg.hostId,
        });
        break;
      }

      case 'GAME_STATE': {
        this.emit('game_state', {
          snapshot: msg.snapshot,
          event: msg.event || null,
        });
        break;
      }

      case 'PLAYER_ACTION': {
        this.emit('network_action', {
          actionType: msg.action,
          fromSeat: msg.fromSeat,
          fromClientId: msg.fromClientId,
          payload: msg.payload || {},
        });
        break;
      }

      case 'PLAYER_DISCONNECTED': {
        this.emit('player_disconnected', {
          seatIndex: msg.seatIndex,
          clientId: msg.clientId,
          playerName: msg.playerName,
        });
        break;
      }

      case 'HOST_CHANGED': {
        this.isHost = msg.hostId === this.clientId;
        this.emit('host_changed', {
          hostId: msg.hostId,
          hostSeatIndex: msg.hostSeatIndex,
          isMeHost: this.isHost,
        });
        break;
      }

      case 'VOICE_READY':
      case 'VOICE_OFFER':
      case 'VOICE_ANSWER':
      case 'VOICE_ICE':
      case 'VOICE_STATE':
      case 'VOICE_AUDIO': {
        this.emit('voice_signal', msg);
        break;
      }

      case 'AI_ACCESS_UPDATED': {
        this.emit('ai_access_updated', {
          email: msg.email,
          aiAccess: Boolean(msg.aiAccess),
        });
        break;
      }
    }
  }

  identifyUser(token) {
    if (!token || this.transportMode === 'p2p') return false;
    return this._send({ type: 'IDENTIFY_USER', token });
  }

  async listRooms() {
    await this.connect();
    if (this.transportMode === 'p2p') {
      this.publicRooms = [];
      this.emit('rooms_list', { rooms: [] });
      return this.publicRooms;
    }
    this._send({ type: 'LIST_ROOMS' });
    return this.publicRooms;
  }

  // --- 1. CREATE ROOM (ODA KUR) ---
  async createRoom({
    gameType = 'BATAK',
    maxPlayers = 4,
    password = '',
    playerName = 'Masa Sahibi',
    avatarId = 'dayi',
    isVip = false,
  }) {
    await this.connect();
    this.gameType = gameType;
    this.maxPlayers = parseInt(maxPlayers, 10) || 4;
    this.roomPassword = password.trim();
    this.localPlayerName = (playerName || 'Masa Sahibi').trim();
    this.localAvatarId = avatarId;

    if (this.transportMode === 'p2p') {
      return this._createP2PRoom({ isVip });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete('CREATE_ROOM');
        reject(new Error('Oda oluşturma zaman aşımına uğradı.'));
      }, 6000);

      this._pendingRequests.set('CREATE_ROOM', { resolve, reject, timer });
      this._send({
        type: 'CREATE_ROOM',
        gameType: this.gameType,
        maxPlayers: this.maxPlayers,
        password: this.roomPassword,
        playerName: this.localPlayerName,
        avatarId: this.localAvatarId,
        isVip: Boolean(isVip),
      });
    });
  }

  async _createP2PRoom({ isVip = false, retryCount = 0 } = {}) {
    this._cleanupP2P();
    const code = this._generateP2PRoomCode();
    const peerId = `${P2P_ROOM_PREFIX}${code}`;

    let peer;
    try {
      peer = await this._createPeerInstance(peerId);
    } catch (err) {
      throw new Error(`Bulut P2P odası başlatılamadı: ${err.message || 'PeerJS hatası'}`);
    }

    this._peer = peer;

    return new Promise((resolve, reject) => {
      let opened = false;
      const timer = setTimeout(() => {
        if (!opened) {
          this._cleanupP2P();
          reject(new Error('Bulut P2P oda oluşturma zaman aşımına uğradı.'));
        }
      }, 9000);

      peer.on('open', (id) => {
        opened = true;
        clearTimeout(timer);
        this.clientId = id;
        this.roomCode = code;
        this.localPlayerId = 0;
        this.isHost = true;
        this.isConnected = true;
        this._p2pStarted = false;
        this.roomPlayers = this._normalizePlayers([
          {
            clientId: this.clientId,
            seat: 0,
            seatIndex: 0,
            name: this.localPlayerName,
            avatarId: this.localAvatarId,
            isHost: true,
            isVip: Boolean(isVip),
          },
        ]);

        const payload = {
          roomCode: this.roomCode,
          seat: 0,
          hasPassword: Boolean(this.roomPassword),
          gameType: this.gameType,
          maxPlayers: this.maxPlayers,
          players: this.roomPlayers,
        };
        this.emit('room_created', payload);
        resolve(payload);
      });

      peer.on('connection', (conn) => {
        let guestClientId = conn.peer;

        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'JOIN_ROOM') {
            if (this.roomPassword && (msg.password || '').trim() !== this.roomPassword) {
              conn.send({ type: 'JOIN_REJECTED', reason: 'Oda parolası hatalı.' });
              setTimeout(() => {
                try {
                  conn.close();
                } catch {}
              }, 150);
              return;
            }
            if (this.roomPlayers.length >= this.maxPlayers) {
              conn.send({ type: 'JOIN_REJECTED', reason: 'Masa tamamen dolu.' });
              setTimeout(() => {
                try {
                  conn.close();
                } catch {}
              }, 150);
              return;
            }

            guestClientId = msg.clientId || conn.peer;
            const taken = new Set(this.roomPlayers.map((p) => p.seatIndex));
            let seatIdx = 1;
            for (let i = 1; i < this.maxPlayers; i++) {
              if (!taken.has(i)) {
                seatIdx = i;
                break;
              }
            }

            const newPlayer = {
              clientId: guestClientId,
              seat: seatIdx,
              seatIndex: seatIdx,
              name: (msg.playerName || `Oyuncu ${seatIdx + 1}`).trim().slice(0, 18),
              avatarId: msg.avatarId || 'hayrettin',
              isHost: false,
              isVip: Boolean(msg.isVip),
            };

            this._p2pGuestConns.set(guestClientId, conn);
            this.roomPlayers = this._normalizePlayers([...this.roomPlayers, newPlayer]);
            const roomObj = this._buildP2PRoomObj();

            conn.send({
              type: 'ROOM_JOINED',
              roomCode: this.roomCode,
              seatIndex: seatIdx,
              room: roomObj,
            });
            this._p2pBroadcastToGuests({ type: 'ROOM_UPDATE', room: roomObj }, guestClientId);
            this.emit('room_updated', {
              players: this.roomPlayers,
              gameType: this.gameType,
              maxPlayers: this.maxPlayers,
              hostId: this.clientId,
            });
            return;
          }

          if (msg.type === 'PLAYER_ACTION') {
            const p = this.roomPlayers.find((x) => x.clientId === guestClientId);
            this.emit('network_action', {
              actionType: msg.action,
              fromSeat: p?.seatIndex ?? 1,
              fromClientId: guestClientId,
              payload: msg.payload || {},
            });
            return;
          }

          if (['VOICE_READY', 'VOICE_OFFER', 'VOICE_ANSWER', 'VOICE_ICE', 'VOICE_STATE', 'VOICE_AUDIO'].includes(msg.type)) {
            const p = this.roomPlayers.find((x) => x.clientId === guestClientId);
            const stamped = {
              ...msg,
              fromClientId: guestClientId,
              fromSeat: p?.seatIndex ?? 1,
            };
            if (msg.targetClientId === this.clientId) {
              this.emit('voice_signal', stamped);
            } else if (msg.targetClientId) {
              const targetConn = this._p2pGuestConns.get(msg.targetClientId);
              if (targetConn && targetConn.open) targetConn.send(stamped);
            } else {
              this.emit('voice_signal', stamped);
              this._p2pBroadcastToGuests(stamped, guestClientId);
            }
            return;
          }

          if (msg.type === 'LEAVE_ROOM') {
            this._handleP2PGuestLeave(guestClientId);
          }
        });

        conn.on('close', () => {
          this._handleP2PGuestLeave(guestClientId);
        });
      });

      peer.on('error', (err) => {
        if (!opened) {
          clearTimeout(timer);
          if (err?.type === 'unavailable-id' && retryCount < 2) {
            this._createP2PRoom({ isVip, retryCount: retryCount + 1 }).then(resolve).catch(reject);
            return;
          }
          this._cleanupP2P();
          reject(new Error(`P2P oda hatası: ${err?.message || err?.type || 'Bağlantı hatası'}`));
        }
      });
    });
  }

  _handleP2PGuestLeave(guestClientId) {
    if (!guestClientId || !this._p2pGuestConns.has(guestClientId)) return;
    this._p2pGuestConns.delete(guestClientId);
    const departing = this.roomPlayers.find((p) => p.clientId === guestClientId);
    this.roomPlayers = this.roomPlayers.filter((p) => p.clientId !== guestClientId);
    const roomObj = this._buildP2PRoomObj();

    this._p2pBroadcastToGuests({
      type: 'PLAYER_DISCONNECTED',
      seatIndex: departing?.seatIndex,
      clientId: guestClientId,
      playerName: departing?.name || 'Oyuncu',
    });
    this._p2pBroadcastToGuests({ type: 'ROOM_UPDATE', room: roomObj });

    if (departing) {
      this.emit('player_disconnected', {
        seatIndex: departing.seatIndex,
        clientId: guestClientId,
        playerName: departing.name,
      });
    }
    this.emit('room_updated', {
      players: this.roomPlayers,
      gameType: this.gameType,
      maxPlayers: this.maxPlayers,
      hostId: this.clientId,
    });
  }

  // --- 2. JOIN ROOM (ODAYA KATIL) ---
  async joinRoom({ roomCode, password = '', playerName = 'Misafir', avatarId = 'hayrettin', isVip = false }) {
    await this.connect();
    this.localPlayerName = (playerName || 'Misafir').trim();
    this.localAvatarId = avatarId;

    if (this.transportMode === 'p2p') {
      return this._joinP2PRoom({ roomCode, password, isVip });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete('JOIN_ROOM');
        reject(new Error('Odaya katılım zaman aşımına uğradı.'));
      }, 6000);

      this._pendingRequests.set('JOIN_ROOM', { resolve, reject, timer });
      this._send({
        type: 'JOIN_ROOM',
        roomCode: (roomCode || '').trim().toUpperCase(),
        password: password.trim(),
        playerName: this.localPlayerName,
        avatarId: this.localAvatarId,
        isVip: Boolean(isVip),
      });
    });
  }

  async _joinP2PRoom({ roomCode, password = '', isVip = false }) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new Error('Lütfen 4 haneli oda kodunu girin.');
    }

    this._cleanupP2P();
    let peer;
    try {
      peer = await this._createPeerInstance(undefined);
    } catch (err) {
      throw new Error(`Bulut P2P bağlantısı kurulamadı: ${err.message || 'PeerJS hatası'}`);
    }
    this._peer = peer;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this._pendingRequests.delete('JOIN_ROOM');
          this._cleanupP2P();
          reject(new Error(`Oda kodu "${cleanCode}" bulunamadı veya masa sahibi çevrimdışı.`));
        }
      }, 9500);

      this._pendingRequests.set('JOIN_ROOM', {
        resolve: (res) => {
          settled = true;
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          settled = true;
          clearTimeout(timer);
          this._cleanupP2P();
          reject(err);
        },
        timer,
      });

      peer.on('open', (myPeerId) => {
        this.clientId = myPeerId;
        const conn = peer.connect(`${P2P_ROOM_PREFIX}${cleanCode}`, { reliable: true });
        this._p2pHostConn = conn;

        conn.on('open', () => {
          conn.send({
            type: 'JOIN_ROOM',
            roomCode: cleanCode,
            password: (password || '').trim(),
            playerName: this.localPlayerName,
            avatarId: this.localAvatarId,
            isVip: Boolean(isVip),
            clientId: this.clientId,
          });
        });

        conn.on('data', (msg) => {
          if (msg && typeof msg === 'object') {
            this._handleServerMessage(msg);
          }
        });

        conn.on('close', () => {
          const pending = this._pendingRequests.get('JOIN_ROOM');
          if (pending) {
            clearTimeout(pending.timer);
            this._pendingRequests.delete('JOIN_ROOM');
            pending.reject(new Error('Masa sahibiyle bağlantı kurulamadı.'));
            return;
          }
          if (this.isConnected) {
            this.isConnected = false;
            this.isHost = false;
            this.roomCode = null;
            this.roomPlayers = [];
            this.emit('host_disconnected', { message: 'Masa sahibi odadan ayrıldı.' });
          }
        });
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this._pendingRequests.delete('JOIN_ROOM');
          this._cleanupP2P();
          const msg =
            err?.type === 'peer-unavailable'
              ? `Oda kodu "${cleanCode}" bulunamadı veya masa sahibi çevrimdışı.`
              : `Odaya bağlanılamadı: ${err?.message || err?.type || 'P2P hatası'}`;
          reject(new Error(msg));
        }
      });
    });
  }

  startGame(gameType, maxPlayers) {
    if (!this.isHost || !this.isConnected) return false;
    if (this.transportMode === 'p2p') {
      this._p2pStarted = true;
      this.gameType = gameType || this.gameType;
      this.maxPlayers = maxPlayers || this.maxPlayers;
      this._p2pBroadcastToGuests({
        type: 'GAME_STARTED',
        gameType: this.gameType,
        maxPlayers: this.maxPlayers,
        hostId: this.clientId,
        room: this._buildP2PRoomObj(),
      });
      return true;
    }
    return this._send({
      type: 'START_GAME',
      gameType: gameType || this.gameType,
      maxPlayers: maxPlayers || this.maxPlayers,
    });
  }

  broadcastGameState(snapshot, event = null) {
    if (!this.isHost || !this.isConnected) return false;
    if (this.transportMode === 'p2p') {
      this._p2pBroadcastToGuests({
        type: 'GAME_STATE',
        snapshot,
        event,
      });
      return true;
    }
    return this._send({
      type: 'GAME_STATE',
      snapshot,
      event,
    });
  }

  sendPlayerAction(action, payload = {}) {
    if (!this.isConnected) return false;
    if (this.transportMode === 'p2p') {
      if (this._p2pHostConn && this._p2pHostConn.open) {
        this._p2pHostConn.send({
          type: 'PLAYER_ACTION',
          action,
          payload,
        });
        return true;
      }
      return false;
    }
    return this._send({
      type: 'PLAYER_ACTION',
      action,
      payload,
    });
  }

  // Backwards-compatible alias
  sendAction(actionType, payload = {}) {
    return this.sendPlayerAction(actionType, payload);
  }

  sendVoiceSignal(type, payload = {}, targetClientId = null) {
    if (!this.isConnected) return false;
    if (this.transportMode === 'p2p') {
      const msg = {
        type,
        targetClientId,
        payload,
        fromClientId: this.clientId,
        fromSeat: this.localPlayerId,
      };
      if (this.isHost) {
        if (targetClientId) {
          const conn = this._p2pGuestConns.get(targetClientId);
          if (conn && conn.open) conn.send(msg);
        } else {
          this._p2pBroadcastToGuests(msg);
        }
        return true;
      }
      if (this._p2pHostConn && this._p2pHostConn.open) {
        this._p2pHostConn.send(msg);
        return true;
      }
      return false;
    }
    return this._send({
      type,
      targetClientId,
      payload,
    });
  }

  leaveRoom() {
    if (this.transportMode === 'p2p') {
      const wasHost = this.isHost;
      this.isConnected = false;
      this.isHost = false;
      if (!wasHost && this._p2pHostConn && this._p2pHostConn.open) {
        try {
          this._p2pHostConn.send({ type: 'LEAVE_ROOM' });
        } catch {}
      }
      this._cleanupP2P();
      this.roomCode = null;
      this.roomPlayers = [];
      this.localPlayerId = 0;
      this.serverConnected = true;
      this.serverStatus = 'connected';
      this.emit('connection_status', { status: 'connected', mode: 'p2p', clientId: this.clientId });
      return;
    }
    if (this.serverConnected) {
      this._send({ type: 'LEAVE_ROOM' });
    }
    this.isConnected = false;
    this.isHost = false;
    this.roomCode = null;
    this.roomPlayers = [];
    this.localPlayerId = 0;
  }

  disconnect() {
    this.leaveRoom();
  }
}

export const networkManager = new NetworkManager();
