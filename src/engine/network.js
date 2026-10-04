import { Peer } from 'peerjs';

export class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.isHost = false;
    this.roomCode = null;
    this.roomPassword = '';
    this.gameType = 'BATAK';
    this.maxPlayers = 4;
    this.localPlayerId = 0;
    this.localPlayerName = 'Siz';
    this.localAvatarId = 'kasketli';
    this.roomPlayers = []; // [{ seat, name, avatarId, peerId, isHost }]
    this.eventListeners = [];
    this.isConnected = false;
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
  }

  emit(event, data) {
    this.eventListeners.forEach(cb => cb(event, data));
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // --- 1. CREATE ROOM (ODA KUR) ---
  createRoom({ gameType = 'BATAK', maxPlayers = 4, password = '', playerName = 'Masa Sahibi', avatarId = 'kasketli' }) {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.roomCode = this.generateRoomCode();
      this.roomPassword = password.trim();
      this.gameType = gameType;
      this.maxPlayers = parseInt(maxPlayers, 10) || 4;
      this.localPlayerName = playerName.trim() || 'Masa Sahibi';
      this.localAvatarId = avatarId;
      this.localPlayerId = 0;

      const peerId = `vr52-room-${this.roomCode.toLowerCase()}`;

      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.isHost = true;
        this.isConnected = true;
        this.roomPlayers = [
          {
            seat: 0,
            name: this.localPlayerName,
            avatarId: this.localAvatarId,
            peerId: id,
            isHost: true,
            isReady: true
          }
        ];

        this.emit('room_created', {
          roomCode: this.roomCode,
          hasPassword: Boolean(this.roomPassword),
          gameType: this.gameType,
          maxPlayers: this.maxPlayers,
          players: this.roomPlayers
        });

        resolve({
          roomCode: this.roomCode,
          players: this.roomPlayers
        });
      });

      this.peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('Peer error during createRoom:', err);
        if (err.type === 'unavailable-id') {
          // Retry with fresh code
          this.createRoom({ gameType, maxPlayers, password, playerName, avatarId }).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  // --- 2. JOIN ROOM (ODAYA KATIL) ---
  joinRoom({ roomCode, password = '', playerName = 'Misafir', avatarId = 'ekoseli' }) {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.roomCode = roomCode.trim().toUpperCase();
      this.localPlayerName = playerName.trim() || 'Misafir';
      this.localAvatarId = avatarId;
      const targetPeerId = `vr52-room-${this.roomCode.toLowerCase()}`;

      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.isHost = false;
        const conn = this.peer.connect(targetPeerId, { reliable: true });

        conn.on('open', () => {
          this.connections.set(targetPeerId, conn);
          this.isConnected = true;

          // Send join request with credentials
          conn.send({
            type: 'JOIN_REQUEST',
            password: password.trim(),
            playerName: this.localPlayerName,
            avatarId: this.localAvatarId,
            guestPeerId: id
          });

          this.setupGuestConnection(conn);
        });

        conn.on('error', (err) => {
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        reject(err);
      });

      // Internal callback for join approval/rejection
      const onJoinResponse = (event, data) => {
        if (event === 'joined_successfully') {
          resolve(data);
        } else if (event === 'join_rejected') {
          reject(new Error(data.reason || 'Odaya katılım reddedildi.'));
        }
      };
      this.onEvent(onJoinResponse);

      // 10s Timeout safety
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Odaya bağlanılamadı. Oda kodunu ve internet bağlantınızı kontrol edin.'));
        }
      }, 10000);
    });
  }

  setupHostConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      this.handleHostReceivedData(conn, data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      const leftPlayer = this.roomPlayers.find(p => p.peerId === conn.peer);
      this.roomPlayers = this.roomPlayers.filter(p => p.peerId !== conn.peer);
      this.broadcastRoomUpdate();
      this.emit('player_disconnected', { peerId: conn.peer, player: leftPlayer });
    });
  }

  setupGuestConnection(conn) {
    conn.on('data', (data) => {
      this.handleGuestReceivedData(data);
    });

    conn.on('close', () => {
      this.isConnected = false;
      this.emit('host_disconnected', { message: 'Oda sahibi ayrıldı veya bağlantı kesildi.' });
    });
  }

  handleHostReceivedData(conn, data) {
    if (data.type === 'JOIN_REQUEST') {
      // 1. Check Password
      if (this.roomPassword && data.password !== this.roomPassword) {
        conn.send({
          type: 'JOIN_REJECTED',
          reason: 'Hatalı Oda Parolası!'
        });
        conn.close();
        return;
      }

      // 2. Check Capacity
      if (this.roomPlayers.length >= this.maxPlayers) {
        conn.send({
          type: 'JOIN_REJECTED',
          reason: 'Oda Dolu! Maksimum oyuncu sayısına ulaşıldı.'
        });
        conn.close();
        return;
      }

      // 3. Assign Seat
      const usedSeats = new Set(this.roomPlayers.map(p => p.seat));
      let assignedSeat = 1;
      for (let s = 1; s < this.maxPlayers; s++) {
        if (!usedSeats.has(s)) {
          assignedSeat = s;
          break;
        }
      }

      const newPlayer = {
        seat: assignedSeat,
        name: data.playerName,
        avatarId: data.avatarId,
        peerId: conn.peer,
        isHost: false,
        isReady: true
      };

      this.roomPlayers.push(newPlayer);

      conn.send({
        type: 'JOIN_ACCEPTED',
        assignedSeat,
        roomCode: this.roomCode,
        gameType: this.gameType,
        maxPlayers: this.maxPlayers,
        players: this.roomPlayers
      });

      this.broadcastRoomUpdate();
      this.emit('player_joined', newPlayer);
    } else if (data.type === 'ACTION') {
      // Broadcast action to all other clients
      this.broadcast(data, conn.peer);
      this.emit('network_action', data);
    }
  }

  handleGuestReceivedData(data) {
    if (data.type === 'JOIN_ACCEPTED') {
      this.localPlayerId = data.assignedSeat;
      this.gameType = data.gameType;
      this.maxPlayers = data.maxPlayers;
      this.roomPlayers = data.players;
      this.emit('joined_successfully', {
        seat: data.assignedSeat,
        roomCode: data.roomCode,
        gameType: data.gameType,
        maxPlayers: data.maxPlayers,
        players: data.players
      });
    } else if (data.type === 'JOIN_REJECTED') {
      this.emit('join_rejected', { reason: data.reason });
    } else if (data.type === 'ROOM_UPDATE') {
      this.roomPlayers = data.players;
      this.gameType = data.gameType;
      this.maxPlayers = data.maxPlayers;
      this.emit('room_updated', { players: data.players, gameType: data.gameType });
    } else if (data.type === 'START_GAME') {
      this.emit('game_started_by_host', data);
    } else if (data.type === 'ACTION') {
      this.emit('network_action', data);
    }
  }

  broadcastRoomUpdate() {
    this.broadcast({
      type: 'ROOM_UPDATE',
      players: this.roomPlayers,
      gameType: this.gameType,
      maxPlayers: this.maxPlayers
    });
    this.emit('room_updated', { players: this.roomPlayers, gameType: this.gameType });
  }

  broadcast(message, excludePeerId = null) {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        conn.send(message);
      }
    });
  }

  sendAction(actionType, payload) {
    const packet = {
      type: 'ACTION',
      actionType,
      senderId: this.localPlayerId,
      payload,
      timestamp: Date.now()
    };

    if (this.isHost) {
      this.broadcast(packet);
    } else {
      this.connections.forEach(conn => {
        if (conn.open) conn.send(packet);
      });
    }
  }

  disconnect() {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        // ignore
      }
      this.peer = null;
    }
    this.connections.clear();
    this.isConnected = false;
    this.isHost = false;
    this.roomPlayers = [];
  }
}

export const networkManager = new NetworkManager();
