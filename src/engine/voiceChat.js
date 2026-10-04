// WebRTC 3D Spatial Binaural Voice Chat Engine
// Provides 3D localized audio for seated players with HRTF panning, mic controls, and voice detection

import { soundFx } from './audio.js';

export class SpatialVoiceChatEngine {
  constructor() {
    this.localStream = null;
    this.isMuted = false;
    this.peerAudioNodes = new Map(); // peerId -> { source, panner, gain, analyser }
    this.audioContext = null;
    this.isVoiceActive = false;
    this.onTalkingCallbacks = [];
    this.peerTalkingState = new Map(); // peerId -> boolean

    // 3D Table Seating Seat Coordinates (Match VR table positions)
    this.seatCoordinates = [
      { x: 0, y: 1.2, z: 0.8 },     // Player 0 (Self)
      { x: 0.72, y: 1.2, z: 0 },    // Player 1 (Right)
      { x: 0, y: 1.2, z: -0.72 },   // Player 2 (Across)
      { x: -0.72, y: 1.2, z: 0 }    // Player 3 (Left)
    ];
  }

  // Initialize Microphone & Local Audio
  async initVoiceChat() {
    try {
      this.ensureAudioContext();
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      this.isVoiceActive = true;
      this.monitorLocalVoiceActivity();
      return true;
    } catch (err) {
      console.warn('[VOICE-CHAT] Mikrofon izni alınamadı veya mikrofon bulunamadı:', err);
      return false;
    }
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Attach Remote Peer's MediaStream with 3D Spatial PannerNode
  attachRemoteAudioStream(peerId, seatIndex, remoteStream) {
    this.ensureAudioContext();
    if (!remoteStream || !this.audioContext) return;

    try {
      // Remove any existing node for this peer
      this.detachRemoteAudio(peerId);

      const source = this.audioContext.createMediaStreamSource(remoteStream);
      
      // 3D HRTF Spatial Panner Node
      const panner = this.audioContext.createPanner();
      panner.panningModel = 'HRTF'; // High-quality Head-Related Transfer Function
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.5;
      panner.maxDistance = 15;
      panner.rolloffFactor = 1.2;
      panner.coneInnerAngle = 360;

      // Position in 3D Kıraathane Space
      const seat = this.seatCoordinates[seatIndex] || this.seatCoordinates[1];
      if (panner.positionX) {
        panner.positionX.setValueAtTime(seat.x, this.audioContext.currentTime);
        panner.positionY.setValueAtTime(seat.y, this.audioContext.currentTime);
        panner.positionZ.setValueAtTime(seat.z, this.audioContext.currentTime);
      } else {
        panner.setPosition(seat.x, seat.y, seat.z);
      }

      // Gain & Volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.0;

      // Analyser node for voice activity wave detection
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);
      analyser.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      this.peerAudioNodes.set(peerId, { source, panner, gain: gainNode, analyser, seatIndex });
      this.monitorPeerVoiceActivity(peerId, analyser);

      console.log(`[VOICE-CHAT] 3D Konumsal ses bağlandı: Peer ${peerId}, Koltuk ${seatIndex} (${seat.x}, ${seat.y}, ${seat.z})`);
    } catch (e) {
      console.warn('[VOICE-CHAT] Remote audio attach hatası:', e);
    }
  }

  detachRemoteAudio(peerId) {
    const node = this.peerAudioNodes.get(peerId);
    if (node) {
      try {
        node.source.disconnect();
        node.panner.disconnect();
        node.gain.disconnect();
      } catch (e) {}
      this.peerAudioNodes.delete(peerId);
    }
  }

  // Toggle Mic Mute
  toggleMute() {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  setMute(muteState) {
    if (!this.localStream) return;
    this.isMuted = muteState;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !muteState;
    });
  }

  // Real-time Voice Activity Detection (Detect when someone is talking to animate avatar lips/speech waves)
  monitorLocalVoiceActivity() {
    if (!this.localStream || !this.audioContext) return;
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkVoice = () => {
      if (!this.isVoiceActive) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const isTalking = avg > 20 && !this.isMuted;
      this.notifyTalking(0, isTalking, avg);
      requestAnimationFrame(checkVoice);
    };
    checkVoice();
  }

  monitorPeerVoiceActivity(peerId, analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkPeer = () => {
      if (!this.peerAudioNodes.has(peerId)) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const isTalking = avg > 18;
      const node = this.peerAudioNodes.get(peerId);
      if (node) {
        this.notifyTalking(node.seatIndex, isTalking, avg);
      }
      requestAnimationFrame(checkPeer);
    };
    checkPeer();
  }

  onTalkingUpdate(callback) {
    this.onTalkingCallbacks.push(callback);
  }

  notifyTalking(seatIndex, isTalking, volume) {
    this.onTalkingCallbacks.forEach(cb => cb(seatIndex, isTalking, volume));
  }

  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.peerAudioNodes.forEach((node, peerId) => {
      this.detachRemoteAudio(peerId);
    });
    this.isVoiceActive = false;
  }
}

export const spatialVoice = new SpatialVoiceChatEngine();
