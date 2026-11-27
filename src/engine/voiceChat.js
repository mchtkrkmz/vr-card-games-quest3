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

const RELAY_SAMPLE_RATE = 12000;

function linearToMuLawByte(sample) {
  const BIAS = 0x84;
  const CLIP = 32635;
  let s = Math.max(-1, Math.min(1, sample));
  let pcm = Math.round(s * 32767);
  let sign = 0;
  if (pcm < 0) {
    sign = 0x80;
    pcm = -pcm;
  }
  if (pcm > CLIP) pcm = CLIP;
  pcm += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    // find segment
  }
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function muLawByteToLinear(uVal) {
  const u = ~uVal & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return (sign ? -sample : sample) / 32768;
}

function uint8ToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
}

function base64ToUint8(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

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

    // Relay fallback (server/P2P data channel audio) when direct WebRTC fails behind NAT / mobile data
    this._relayProcessor = null;
    this._relaySink = null;
    this._relayPlayback = new Map(); // remoteClientId -> { gain, nextTime, lastAt }

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
      ['touchstart', 'pointerdown', 'click', 'keydown'].forEach((evt) => {
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
    const vol = this.speakerMuted ? 0 : this.speakerVolume;
    if (this.masterSpeakerGain && this.audioContext) {
      this.masterSpeakerGain.gain.setValueAtTime(vol, this.audioContext.currentTime);
    }
    for (const node of this.peerAudioNodes.values()) {
      if (node.audioEl) {
        node.audioEl.muted = this.speakerMuted;
        node.audioEl.volume = this.speakerMuted ? 0 : this.speakerVolume;
        if (!this.speakerMuted && node.audioEl.paused) {
          node.audioEl.play().catch(() => {});
        }
      }
    }
    if (this.audioContext && this._relayPlayback) {
      for (const state of this._relayPlayback.values()) {
        if (state.gain) {
          state.gain.gain.setValueAtTime(vol, this.audioContext.currentTime);
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
      this._startRelayCapture();

      // Add mic tracks to all existing RTCPeerConnections and signal readiness
      if (this.network && this.network.isConnected) {
        this.syncPeersWithRoom(this.network.roomPlayers);
        for (const [remoteId, entry] of this.peerConnections.entries()) {
          await this._attachLocalTrackToPc(entry.pc);
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
      createdAt: Date.now(),
    };
    this.peerConnections.set(remoteClientId, entry);

    // Proactively open sendrecv transceiver on both peers so bidirectional RTP flows reliably
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    entry.audioTransceiver = audioTransceiver;
    this._attachLocalTrackToPc(pc).catch(() => {});

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

  async _attachLocalTrackToPc(pc) {
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
        try {
          await audioTransceiver.sender.replaceTrack(track);
        } catch {}
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

    if (msg.type === 'VOICE_AUDIO') {
      this._playRelayAudio(remoteId, msg.payload || {}, msg.fromSeat ?? 1);
      return;
    }

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
        if (offerCollision && entry.isPolite && pc.signalingState !== 'stable') {
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {}
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this._attachLocalTrackToPc(pc);
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
    const relayState = this._relayPlayback?.get(remoteId);
    if (relayState) {
      try {
        relayState.gain?.disconnect();
      } catch {}
      this._relayPlayback.delete(remoteId);
    }
    this.detachRemoteAudio(remoteId);
  }

  closeAllPeers() {
    for (const remoteId of Array.from(this.peerConnections.keys())) {
      this._closePeerConnection(remoteId);
    }
  }

  // Attach Remote Peer's MediaStream with reliable direct DOM <audio> playback on all platforms & Analyser VAD
  attachRemoteAudioStream(peerId, visualSeatIndex, remoteStream) {
    this.ensureAudioContext();
    if (!remoteStream) return;

    try {
      this.detachRemoteAudio(peerId);

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.setAttribute('playsinline', '');
      audioEl.setAttribute('webkit-playsinline', '');
      audioEl.srcObject = remoteStream;

      const sink = this._getAudioSinkContainer();
      if (sink) sink.appendChild(audioEl);

      // Play remote voice directly through <audio> on Desktop, Mobile & Quest 3 (avoids Chromium silent MediaStreamAudioSourceNode bug)
      audioEl.muted = this.speakerMuted;
      audioEl.volume = this.speakerMuted ? 0 : this.speakerVolume;
      audioEl.play().catch(() => {});

      remoteStream.getAudioTracks().forEach((tr) => {
        tr.onunmute = () => {
          if (!this.speakerMuted && audioEl.paused) {
            audioEl.play().catch(() => {});
          }
        };
      });

      let source = null;
      let analyser = null;

      if (this.audioContext) {
        source = this.audioContext.createMediaStreamSource(remoteStream);
        analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
      }

      this.peerAudioNodes.set(peerId, {
        source,
        panner: null,
        gain: null,
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

  // --- RELAY AUDIO FALLBACK (works through WS server and PeerJS data channel) ---
  isPeerWebRtcConnected(remoteId) {
    const pc = this.peerConnections.get(remoteId)?.pc;
    if (!pc) return false;
    const ice = pc.iceConnectionState;
    return pc.connectionState === 'connected' || ice === 'connected' || ice === 'completed';
  }

  _needsRelay() {
    if (!this.network || !this.network.isConnected) return false;
    const now = Date.now();
    for (const [remoteId, entry] of this.peerConnections.entries()) {
      if (!this.isPeerWebRtcConnected(remoteId) && now - (entry.createdAt || 0) > 3000) return true;
    }
    return false;
  }

  _startRelayCapture() {
    if (this._relayProcessor || !this.audioContext || !this.localSource) return;
    if (typeof this.audioContext.createScriptProcessor !== 'function') return;
    const ctx = this.audioContext;
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      out.fill(0);
      if (!this.isVoiceActive || this.isMuted || !this._needsRelay()) return;
      const input = e.inputBuffer.getChannelData(0);
      let peak = 0;
      for (let k = 0; k < input.length; k += 4) peak = Math.max(peak, Math.abs(input[k]));
      if (peak < 0.008) return; // noise gate: don't stream silence
      const ratio = ctx.sampleRate / RELAY_SAMPLE_RATE;
      const outLen = Math.floor(input.length / ratio);
      const bytes = new Uint8Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(input.length, Math.floor((i + 1) * ratio));
        let sum = 0;
        for (let j = start; j < end; j++) sum += input[j];
        bytes[i] = linearToMuLawByte(sum / Math.max(1, end - start));
      }
      this.network.sendVoiceSignal('VOICE_AUDIO', { pcmu: uint8ToBase64(bytes), sr: RELAY_SAMPLE_RATE });
    };
    this.localSource.connect(proc);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    proc.connect(sink);
    sink.connect(ctx.destination);
    this._relayProcessor = proc;
    this._relaySink = sink;
  }

  _stopRelayCapture() {
    try {
      this._relayProcessor?.disconnect();
      this._relaySink?.disconnect();
    } catch {}
    if (this._relayProcessor) this._relayProcessor.onaudioprocess = null;
    this._relayProcessor = null;
    this._relaySink = null;
  }

  _playRelayAudio(remoteId, payload, fromSeat = 1) {
    // Direct WebRTC audio already flowing for this peer -> avoid double voice
    if (this.isPeerWebRtcConnected(remoteId) && this.peerAudioNodes.has(remoteId)) return;
    if (!payload?.pcmu) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const bytes = base64ToUint8(payload.pcmu);
    if (bytes.length === 0) return;
    const srcRate = Number(payload.sr) || RELAY_SAMPLE_RATE;
    const decoded = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) decoded[i] = muLawByteToLinear(bytes[i]);

    // Upsample to native context rate (Safari rejects low-rate AudioBuffers)
    const outLen = Math.max(1, Math.round(bytes.length * (ctx.sampleRate / srcRate)));
    const buf = ctx.createBuffer(1, outLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    const step = (bytes.length - 1) / Math.max(1, outLen - 1);
    for (let i = 0; i < outLen; i++) {
      const pos = i * step;
      const i0 = Math.floor(pos);
      const i1 = Math.min(bytes.length - 1, i0 + 1);
      const frac = pos - i0;
      ch[i] = decoded[i0] * (1 - frac) + decoded[i1] * frac;
    }

    let state = this._relayPlayback.get(remoteId);
    if (!state) {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      state = { gain, nextTime: 0, lastAt: 0 };
      this._relayPlayback.set(remoteId, state);
    }
    state.gain.gain.setValueAtTime(this.speakerMuted ? 0 : this.speakerVolume, ctx.currentTime);
    state.lastAt = Date.now();

    const now = ctx.currentTime;
    if (state.nextTime < now + 0.03 || state.nextTime > now + 0.9) {
      state.nextTime = now + 0.12; // small jitter buffer
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.gain);
    src.start(state.nextTime);
    state.nextTime += buf.duration;

    let peak = 0;
    for (let i = 0; i < decoded.length; i += 8) peak = Math.max(peak, Math.abs(decoded[i]));
    const vSeat = this._resolveVisualSeat(remoteId, fromSeat);
    this.notifyTalking(vSeat, peak > 0.06 && !this.speakerMuted, peak * 100);
  }

  cleanup() {
    this._stopRelayCapture();
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
    if (this._relayPlayback) {
      for (const state of this._relayPlayback.values()) {
        try {
          state.gain?.disconnect();
        } catch {}
      }
      this._relayPlayback.clear();
    }
    this.isVoiceActive = false;
    this.localMicLevel = 0;
  }
}

export const spatialVoice = new SpatialVoiceChatEngine();
