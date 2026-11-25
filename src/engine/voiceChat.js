// WebRTC 3D Spatial Binaural Voice Chat + Speaker & Mic Test Engine
// Transmits live microphone over WebRTC mesh (signaled via WebSocket room)
// and spatializes remote voices using HRTF PannerNodes synced to the player's VR head.

import * as THREE from 'three';
import { soundFx } from './audio.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class SpatialVoiceChatEngine {
  constructor() {
    this.network = null;
    this.localStream = null;
    this.localAnalyser = null;
    this.localSource = null;
    this.micLoopbackGain = null;

    this.isMuted = false; // Mic mute state
    this.isVoiceActive = false;
    this.isMicTesting = false;
    this.isVRActive = false;
    this.speakerMuted = false;
    this.speakerVolume = 0.85;
    this.lastError = '';
    this.localMicLevel = 0;

    this.audioContext = null;
    this.masterSpeakerGain = null;
    this._audioSinkEl = null;

    this.peerConnections = new Map(); // remoteClientId -> { pc, pendingIce: [], makingOffer: false }
    this.peerAudioNodes = new Map(); // remoteClientId -> { source, panner, gain, analyser, audioEl, stream, seatIndex, visualSeat }
    this.onTalkingCallbacks = [];
    this.onMicLevelCallbacks = [];
    this._vadInterval = null;
    this._seatResolver = null; // (clientId) => visualSeatIndex

    // Reusable vectors to avoid per-frame allocations when syncing Web Audio listener
    this._forwardVec = new THREE.Vector3();
    this._upVec = new THREE.Vector3();
    this._worldPos = new THREE.Vector3();

    // Visual 3D coordinates around the table matching VR seats
    this.seatCoordinates = [
      { x: 0, y: 1.18, z: 0.76 },   // Seat 0: Local Player
      { x: 0.78, y: 1.18, z: 0 },   // Seat 1: Right
      { x: 0, y: 1.18, z: -0.78 },  // Seat 2: Across
      { x: -0.78, y: 1.18, z: 0 },  // Seat 3: Left
    ];

    this.unlockRemoteAudio = this.unlockRemoteAudio.bind(this);
    if (typeof window !== 'undefined') {
      ['touchstart', 'pointerdown', 'click'].forEach((evt) => {
        window.addEventListener(evt, this.unlockRemoteAudio, { passive: true });
      });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.unlockRemoteAudio();
        }
      });
    }
  }

  shouldUseDirectMobileAudio(
    userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    isVR = this.isVRActive
  ) {
    if (isVR) return false;
    if (!userAgent) return false;
    if (/OculusBrowser|Quest|PicoBrowser|Wolvic/i.test(userAgent)) return false;
    return /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(userAgent);
  }

  setVRActive(active) {
    this.isVRActive = Boolean(active);
    this._syncSpeakerGain();
  }

  _getAudioSinkContainer() {
    if (typeof document === 'undefined' || !document.body) return null;
    if (!this._audioSinkEl) {
      let el = document.getElementById('vr-remote-audio-sink');
      if (!el) {
        el = document.createElement('div');
        el.id = 'vr-remote-audio-sink';
        el.style.cssText = 'position:fixed;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden;';
        document.body.appendChild(el);
      }
      this._audioSinkEl = el;
    }
    return this._audioSinkEl;
  }

  unlockRemoteAudio() {
    if (this.audioContext && (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted')) {
      this.audioContext.resume().then(() => this._syncSpeakerGain()).catch(() => {});
    }
    for (const node of this.peerAudioNodes.values()) {
      if (node.audioEl && node.audioEl.paused) {
        node.audioEl.play().catch(() => {});
      }
    }
  }

  ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.audioContext = new AudioCtx();
      this.masterSpeakerGain = this.audioContext.createGain();
      this._syncSpeakerGain();
      this.masterSpeakerGain.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  _syncSpeakerGain() {
    const useDirectMobile = this.shouldUseDirectMobileAudio();
    const ctxRunning = this.audioContext && this.audioContext.state === 'running';
    const vol = this.speakerMuted || useDirectMobile ? 0 : this.speakerVolume;
    if (this.masterSpeakerGain && this.audioContext) {
      this.masterSpeakerGain.gain.setValueAtTime(vol, this.audioContext.currentTime);
    }
    for (const node of this.peerAudioNodes.values()) {
      if (node.audioEl) {
        const useDomPlayback = useDirectMobile || !ctxRunning;
        node.audioEl.muted = this.speakerMuted || !useDomPlayback;
        node.audioEl.volume = this.speakerMuted ? 0 : this.speakerVolume;
        if (!this.speakerMuted && useDomPlayback && node.audioEl.paused) {
          node.audioEl.play().catch(() => {});
        }
      }
    }
  }

  setSpeakerVolume(vol) {
    this.speakerVolume = Math.max(0, Math.min(1, Number(vol)));
    if (this.speakerVolume > 0 && this.speakerMuted) {
      this.speakerMuted = false;
    }
    this._syncSpeakerGain();
    soundFx.setMasterVolume(this.speakerVolume);
    soundFx.setSpeakerMuted(this.speakerMuted);
  }

  setSpeakerMuted(muted) {
    this.speakerMuted = Boolean(muted);
    this._syncSpeakerGain();
    soundFx.setSpeakerMuted(this.speakerMuted);
  }

  toggleSpeakerMute() {
    this.setSpeakerMuted(!this.speakerMuted);
    return this.speakerMuted;
  }

  attachNetwork(networkManager, visualSeatResolver = null) {
    if (this._netUnsub) {
      this._netUnsub();
      this._netUnsub = null;
    }
    this.network = networkManager;
    if (visualSeatResolver) this._seatResolver = visualSeatResolver;

    this._netUnsub = networkManager.onEvent((event, data) => {
      if (event === 'voice_signal') {
        this._handleVoiceSignal(data);
      } else if (event === 'room_updated' || event === 'joined_successfully' || event === 'game_started_by_host') {
        this.syncPeersWithRoom(data?.players || networkManager.roomPlayers);
      } else if (event === 'player_disconnected' && data?.clientId) {
        this._closePeerConnection(data.clientId);
      } else if (event === 'host_disconnected') {
        this.closeAllPeers();
      }
    });
  }

  setSeatResolver(fn) {
    this._seatResolver = fn;
    for (const [clientId, node] of this.peerAudioNodes.entries()) {
      const vSeat = this._resolveVisualSeat(clientId, node.visualSeat);
      this.setPeerVisualSeat(clientId, vSeat);
    }
  }

  _resolveVisualSeat(remoteClientId, fallbackSeat = 1) {
    if (this._seatResolver) {
      const resolved = this._seatResolver(remoteClientId);
      if (typeof resolved === 'number' && resolved >= 0) return resolved;
    }
    return fallbackSeat;
  }

  // Initialize Microphone & Local Audio
  async initVoiceChat() {
    this.lastError = '';
    try {
      this.ensureAudioContext();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isInsecure = typeof window !== 'undefined' && !window.isSecureContext;
        this.lastError = isInsecure
          ? 'Güvensiz HTTP bağlantısında mikrofon kapalı. Mobil ve Quest üzerinden HTTPS (port 3443) ile bağlanmanız gerekiyor.'
          : 'Tarayıcı mikrofon API erişimini engelliyor.';
        return false;
      }

      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      }

      this.isVoiceActive = true;
      this.isMuted = false;
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });

      this._setupLocalAnalyser();
      this._startVadTimer();

      // Add mic tracks to all existing RTCPeerConnections and signal readiness
      if (this.network && this.network.isConnected) {
        this.syncPeersWithRoom(this.network.roomPlayers);
        for (const [remoteId, entry] of this.peerConnections.entries()) {
          this._attachLocalTrackToPc(entry.pc);
          if (entry.pc.signalingState === 'stable') {
            await this._sendOffer(remoteId, entry);
          }
        }
        this.network.sendVoiceSignal('VOICE_READY', { micActive: true, muted: this.isMuted });
      }

      return true;
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        this.lastError = 'Mikrofon izni reddedildi. Tarayıcı adres çubuğundan mikrofon izni verin.';
      } else if (err?.name === 'NotFoundError') {
        this.lastError = 'Sistemde aktif mikrofon bulunamadı.';
      } else {
        this.lastError =
          'Mikrofon başlatılamadı (LAN üzerinden HTTPS port 3443 gerekir): ' + (err?.message || '');
      }
      console.warn('[VOICE-CHAT]', this.lastError, err);
      return false;
    }
  }

  _setupLocalAnalyser() {
    if (!this.localStream || !this.audioContext) return;
    if (this.localSource) return;

    this.localSource = this.audioContext.createMediaStreamSource(this.localStream);
    this.localAnalyser = this.audioContext.createAnalyser();
    this.localAnalyser.fftSize = 256;
    this.localSource.connect(this.localAnalyser);
  }

  // Self-test microphone directly through speakers (works solo!)
  async toggleMicTest() {
    if (!this.isVoiceActive) {
      const ok = await this.initVoiceChat();
      if (!ok) return false;
    }
    this.ensureAudioContext();
    this.isMicTesting = !this.isMicTesting;

    if (this.isMicTesting) {
      if (!this.micLoopbackGain && this.localSource && this.masterSpeakerGain) {
        this.micLoopbackGain = this.audioContext.createGain();
        this.micLoopbackGain.gain.value = 0.75;
        this.localSource.connect(this.micLoopbackGain);
        this.micLoopbackGain.connect(this.masterSpeakerGain);
      } else if (this.micLoopbackGain) {
        this.micLoopbackGain.gain.setValueAtTime(0.75, this.audioContext.currentTime);
      }
    } else if (this.micLoopbackGain) {
      this.micLoopbackGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    }

    return this.isMicTesting;
  }

  stopMicTest() {
    this.isMicTesting = false;
    if (this.micLoopbackGain && this.audioContext) {
      this.micLoopbackGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
  }

  // Sync WebRTC connections for everyone in the multiplayer room
  syncPeersWithRoom(roomPlayers = []) {
    if (!this.network || !this.network.isConnected || !this.network.clientId) return;
    const myId = this.network.clientId;
    const activeIds = new Set();

    for (const p of roomPlayers) {
      const cid = p.clientId || p.peerId;
      if (!cid || cid === myId) continue;
      activeIds.add(cid);

      if (!this.peerConnections.has(cid)) {
        const isPolite = myId < cid;
        this._createPeerConnection(cid, isPolite, p.seatIndex ?? p.seat ?? 1);
      } else {
        const vSeat = this._resolveVisualSeat(cid, p.seatIndex ?? p.seat ?? 1);
        this.setPeerVisualSeat(cid, vSeat);
      }
    }

    // Close removed peers
    for (const cid of Array.from(this.peerConnections.keys())) {
      if (!activeIds.has(cid)) {
        this._closePeerConnection(cid);
      }
    }
  }

  _createPeerConnection(remoteClientId, isPolite, fallbackSeat = 1) {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 4,
    });
    const entry = {
      pc,
      isPolite,
      pendingIce: [],
      makingOffer: false,
      seatIndex: fallbackSeat,
    };
    this.peerConnections.set(remoteClientId, entry);

    // Proactively open sendrecv transceiver on initiator side so Safari/Mobile SDP matches cleanly
    if (!isPolite) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
    this._attachLocalTrackToPc(pc);

    pc.onicecandidate = (evt) => {
      if (evt.candidate && this.network) {
        this.network.sendVoiceSignal(
          'VOICE_ICE',
          { candidate: evt.candidate },
          remoteClientId
        );
      }
    };

    pc.ontrack = (evt) => {
      const stream = evt.streams && evt.streams[0] ? evt.streams[0] : new MediaStream([evt.track]);
      const vSeat = this._resolveVisualSeat(remoteClientId, entry.seatIndex);
      this.attachRemoteAudioStream(remoteClientId, vSeat, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce?.();
      }
    };

    // Deterministic initiator avoids SDP glare
    if (!isPolite) {
      this._sendOffer(remoteClientId, entry);
    }

    return entry;
  }

  _attachLocalTrackToPc(pc) {
    if (!this.localStream) return;
    const senders = pc.getSenders();
    for (const track of this.localStream.getAudioTracks()) {
      const existing = senders.find((s) => s.track && s.track.id === track.id);
      if (existing) continue;
      const audioTransceiver = pc
        .getTransceivers()
        .find((tr) => tr.receiver?.track?.kind === 'audio' && !tr.sender.track);
      if (audioTransceiver) {
        audioTransceiver.direction = 'sendrecv';
        audioTransceiver.sender.replaceTrack(track).catch(() => {});
      } else {
        pc.addTrack(track, this.localStream);
      }
    }
  }

  async _sendOffer(remoteClientId, entry) {
    if (!this.network || entry.makingOffer) return;
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      this.network.sendVoiceSignal(
        'VOICE_OFFER',
        { sdp: entry.pc.localDescription },
        remoteClientId
      );
    } catch (err) {
      console.warn('[VOICE-CHAT] Offer oluşturma hatası:', err);
    } finally {
      entry.makingOffer = false;
    }
  }

  async _handleVoiceSignal(msg) {
    const remoteId = msg.fromClientId;
    if (!remoteId || !this.network || remoteId === this.network.clientId) return;

    let entry = this.peerConnections.get(remoteId);
    if (!entry) {
      const isPolite = this.network.clientId < remoteId;
      entry = this._createPeerConnection(remoteId, isPolite, msg.fromSeat ?? 1);
    }

    const pc = entry.pc;
    const payload = msg.payload || {};

    try {
      if (msg.type === 'VOICE_READY') {
        if (!entry.isPolite && pc.signalingState === 'stable') {
          await this._sendOffer(remoteId, entry);
        }
      } else if (msg.type === 'VOICE_OFFER' && payload.sdp) {
        const offerCollision = entry.makingOffer || pc.signalingState !== 'stable';
        if (offerCollision && !entry.isPolite) {
          return; // Glare: impolite peer ignores colliding offer
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        this._attachLocalTrackToPc(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.network.sendVoiceSignal(
          'VOICE_ANSWER',
          { sdp: pc.localDescription },
          remoteId
        );
        await this._flushPendingIce(entry);
      } else if (msg.type === 'VOICE_ANSWER' && payload.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await this._flushPendingIce(entry);
        }
      } else if (msg.type === 'VOICE_ICE' && payload.candidate) {
        const cand = new RTCIceCandidate(payload.candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(cand);
        } else {
          entry.pendingIce.push(cand);
        }
      }
    } catch (err) {
      console.warn('[VOICE-CHAT] Sinyal işleme hatası:', err);
    }
  }

  async _flushPendingIce(entry) {
    while (entry.pendingIce.length > 0) {
      const c = entry.pendingIce.shift();
      try {
        await entry.pc.addIceCandidate(c);
      } catch {
        // ignore stale candidates
      }
    }
  }

  _closePeerConnection(remoteId) {
    const entry = this.peerConnections.get(remoteId);
    if (entry) {
      try {
        entry.pc.close();
      } catch {
        // ignore
      }
      this.peerConnections.delete(remoteId);
    }
    this.detachRemoteAudio(remoteId);
  }

  closeAllPeers() {
    for (const remoteId of Array.from(this.peerConnections.keys())) {
      this._closePeerConnection(remoteId);
    }
  }

  // Attach Remote Peer's MediaStream with mobile DOM <audio> support & Desktop/VR 3D HRTF Panner
  attachRemoteAudioStream(peerId, visualSeatIndex, remoteStream) {
    this.ensureAudioContext();
    if (!remoteStream) return;

    try {
      this.detachRemoteAudio(peerId);

      const useDirectMobile = this.shouldUseDirectMobileAudio();
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.setAttribute('playsinline', '');
      audioEl.setAttribute('webkit-playsinline', '');
      audioEl.srcObject = remoteStream;

      const sink = this._getAudioSinkContainer();
      if (sink) sink.appendChild(audioEl);

      const ctxRunning = this.audioContext && this.audioContext.state === 'running';
      const useDomPlayback = useDirectMobile || !ctxRunning;
      audioEl.muted = this.speakerMuted || !useDomPlayback;
      audioEl.volume = this.speakerMuted ? 0 : this.speakerVolume;
      audioEl.play().catch(() => {});

      let source = null;
      let panner = null;
      let gainNode = null;
      let analyser = null;

      if (this.audioContext && this.masterSpeakerGain) {
        source = this.audioContext.createMediaStreamSource(remoteStream);
        analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // On Desktop & Meta Quest VR, route through 3D HRTF Panner; on mobile DOM <audio> plays directly without echo
        if (!useDirectMobile) {
          panner = this.audioContext.createPanner();
          panner.panningModel = 'HRTF';
          panner.distanceModel = 'inverse';
          panner.refDistance = 0.5;
          panner.maxDistance = 12;
          panner.rolloffFactor = 1.1;
          panner.coneInnerAngle = 360;

          gainNode = this.audioContext.createGain();
          gainNode.gain.value = 1.0;

          analyser.connect(panner);
          panner.connect(gainNode);
          gainNode.connect(this.masterSpeakerGain);
        }
      }

      this.peerAudioNodes.set(peerId, {
        source,
        panner,
        gain: gainNode,
        analyser,
        audioEl,
        stream: remoteStream,
        seatIndex: visualSeatIndex,
        visualSeat: visualSeatIndex,
      });

      this.setPeerVisualSeat(peerId, visualSeatIndex);
      this._startVadTimer();
    } catch (e) {
      console.warn('[VOICE-CHAT] Remote audio attach hatası:', e);
    }
  }

  setPeerVisualSeat(peerId, visualSeatIndex) {
    const node = this.peerAudioNodes.get(peerId);
    if (!node) return;
    node.visualSeat = visualSeatIndex;
    node.seatIndex = visualSeatIndex;
    if (!node.panner || !this.audioContext) return;

    const seat = this.seatCoordinates[visualSeatIndex] || this.seatCoordinates[2];
    const t = this.audioContext.currentTime;
    if (node.panner.positionX) {
      node.panner.positionX.setValueAtTime(seat.x, t);
      node.panner.positionY.setValueAtTime(seat.y, t);
      node.panner.positionZ.setValueAtTime(seat.z, t);
    } else {
      node.panner.setPosition(seat.x, seat.y, seat.z);
    }
  }

  updateListenerFromCamera(camera) {
    if (!camera || !this.audioContext || this.audioContext.state !== 'running') return;
    if (this.peerAudioNodes.size === 0) return;

    const listener = this.audioContext.listener;
    if (!listener) return;

    camera.getWorldPosition(this._worldPos);
    camera.getWorldDirection(this._forwardVec);
    this._upVec.copy(camera.up).applyQuaternion(camera.quaternion);

    const t = this.audioContext.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(this._worldPos.x, t);
      listener.positionY.setValueAtTime(this._worldPos.y, t);
      listener.positionZ.setValueAtTime(this._worldPos.z, t);
      listener.forwardX.setValueAtTime(this._forwardVec.x, t);
      listener.forwardY.setValueAtTime(this._forwardVec.y, t);
      listener.forwardZ.setValueAtTime(this._forwardVec.z, t);
      listener.upX.setValueAtTime(this._upVec.x, t);
      listener.upY.setValueAtTime(this._upVec.y, t);
      listener.upZ.setValueAtTime(this._upVec.z, t);
    }
  }

  detachRemoteAudio(peerId) {
    const node = this.peerAudioNodes.get(peerId);
    if (node) {
      try {
        node.source?.disconnect();
        node.panner?.disconnect();
        node.gain?.disconnect();
        if (node.audioEl) {
          node.audioEl.pause();
          node.audioEl.srcObject = null;
          node.audioEl.remove?.();
        }
      } catch {
        // ignore
      }
      this.peerAudioNodes.delete(peerId);
    }
  }

  toggleMute() {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
    if (this.network && this.network.isConnected) {
      this.network.sendVoiceSignal('VOICE_STATE', { muted: this.isMuted });
    }
    return this.isMuted;
  }

  setMute(muteState) {
    this.isMuted = Boolean(muteState);
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });
  }

  // Throttled 12 Hz VAD loop (replaces multiple per-frame requestAnimationFrame loops)
  _startVadTimer() {
    if (this._vadInterval) return;
    const freqBuf = new Uint8Array(128);

    this._vadInterval = setInterval(() => {
      if (this.localAnalyser && this.isVoiceActive) {
        this.localAnalyser.getByteFrequencyData(freqBuf);
        let sum = 0;
        for (let i = 0; i < freqBuf.length; i++) sum += freqBuf[i];
        const avg = sum / freqBuf.length;
        const norm = Math.min(1, avg / 55);
        this.localMicLevel = this.isMuted ? 0 : norm;
        const isTalking = avg > 16 && !this.isMuted;
        this.notifyTalking(0, isTalking, avg);
        for (const cb of this.onMicLevelCallbacks) {
          try {
            cb(this.localMicLevel, isTalking);
          } catch {}
        }
      } else {
        this.localMicLevel = 0;
      }

      for (const node of this.peerAudioNodes.values()) {
        if (!node.analyser) continue;
        node.analyser.getByteFrequencyData(freqBuf);
        let sum = 0;
        for (let i = 0; i < freqBuf.length; i++) sum += freqBuf[i];
        const avg = sum / freqBuf.length;
        const isTalking = avg > 15 && !this.speakerMuted;
        this.notifyTalking(node.visualSeat, isTalking, avg);
      }

      if (!this.isVoiceActive && this.peerAudioNodes.size === 0) {
        clearInterval(this._vadInterval);
        this._vadInterval = null;
      }
    }, 85);
  }

  onTalkingUpdate(callback) {
    this.onTalkingCallbacks.push(callback);
  }

  onMicLevel(callback) {
    this.onMicLevelCallbacks.push(callback);
  }

  notifyTalking(seatIndex, isTalking, volume) {
    for (const cb of this.onTalkingCallbacks) {
      try {
        cb(seatIndex, isTalking, volume);
      } catch {}
    }
  }

  cleanup() {
    this.stopMicTest();
    if (this._vadInterval) {
      clearInterval(this._vadInterval);
      this._vadInterval = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    try {
      this.localSource?.disconnect();
    } catch {}
    this.localSource = null;
    this.localAnalyser = null;
    this.closeAllPeers();
    this.isVoiceActive = false;
    this.localMicLevel = 0;
  }
}

export const spatialVoice = new SpatialVoiceChatEngine();
