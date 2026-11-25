// Gerçek WebSocket Çok Oyunculu Masa ve Ses Sinyali Yöneticisi

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
    this.serverConnected = false; // ws open
    this.serverStatus = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
    this.customServerUrl =
      typeof localStorage !== 'undefined' ? localStorage.getItem('vr52_server_url') || '' : '';

    this._connectPromise = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._pendingRequests = new Map(); // type -> { resolve, reject, timer }
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
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    return this.connect();
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.clientId) {
      return Promise.resolve(this.clientId);
    }
    if (this._connectPromise) return this._connectPromise;

    this.serverStatus = 'connecting';
    this.emit('connection_status', { status: 'connecting', url: this.getDefaultWsUrl() });

    this._connectPromise = new Promise((resolve, reject) => {
      const wsUrl = this.getDefaultWsUrl();
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        this.serverStatus = 'disconnected';
        this.emit('connection_status', { status: 'disconnected', error: err.message });
        this._connectPromise = null;
        reject(err);
        return;
      }

      this.ws = ws;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this._connectPromise = null;
          this.serverStatus = 'disconnected';
          this.emit('connection_status', { status: 'disconnected', error: 'Sunucu zaman aşımı' });
          reject(new Error('Oyun sunucusuna bağlanılamadı. Sunucunun çalıştığından emin olun.'));
        }
      }, 6500);

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
          this.clientId = msg.clientId;
          this.serverConnected = true;
          this.serverStatus = 'connected';
          this.publicRooms = msg.rooms || [];
          this.emit('connection_status', { status: 'connected', clientId: this.clientId, url: wsUrl });
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
        const wasConnected = this.serverConnected;
        this.serverConnected = false;
        this.serverStatus = 'disconnected';
        this.ws = null;
        this.emit('connection_status', { status: 'disconnected', url: wsUrl });

        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this._connectPromise = null;
          reject(new Error('WebSocket sunucusuna ulaşılamadı.'));
        }

        if (wasConnected && this.isConnected) {
          this.isConnected = false;
          this.emit('host_disconnected', { message: 'Sunucu bağlantısı koptu.' });
        }

        this._scheduleReconnect();
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
      case 'VOICE_STATE': {
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
    if (!token) return false;
    return this._send({ type: 'IDENTIFY_USER', token });
  }

  async listRooms() {
    await this.connect();
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

  // --- 2. JOIN ROOM (ODAYA KATIL) ---
  async joinRoom({ roomCode, password = '', playerName = 'Misafir', avatarId = 'hayrettin', isVip = false }) {
    await this.connect();
    this.localPlayerName = (playerName || 'Misafir').trim();
    this.localAvatarId = avatarId;

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

  startGame(gameType, maxPlayers) {
    if (!this.isHost || !this.isConnected) return false;
    return this._send({
      type: 'START_GAME',
      gameType: gameType || this.gameType,
      maxPlayers: maxPlayers || this.maxPlayers,
    });
  }

  broadcastGameState(snapshot, event = null) {
    if (!this.isHost || !this.isConnected) return false;
    return this._send({
      type: 'GAME_STATE',
      snapshot,
      event,
    });
  }

  sendPlayerAction(action, payload = {}) {
    if (!this.isConnected) return false;
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
    return this._send({
      type,
      targetClientId,
      payload,
    });
  }

  leaveRoom() {
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
