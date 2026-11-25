// Master Turkish Kıraathane & Card/Tile Physical Acoustic Modeling Engine
class CardAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sharedNoiseBuffer = null;
    this.enabled = true;
    this.speakerMuted = false;
    this.volume = 0.85;
    this.ambianceEnabled = true;
    this.ambianceVolume = 0.32;
    this.ambianceNodes = null;
    this._unlockAttached = false;
    this.cayciAudioBuffer = null;
    this._cayciLoadPromise = null;
    this._cayciPlayingUntil = 0;

    this.initContext = this.initContext.bind(this);
    if (typeof window !== 'undefined') {
      ['click', 'touchstart', 'keydown', 'pointerdown'].forEach((evt) => {
        window.addEventListener(evt, this.initContext, { passive: true });
      });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
          this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  initContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this._syncMasterGain();
        this.masterGain.connect(this.ctx.destination);
        this._buildSharedNoiseBuffer();
      }
    }
    if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
      this.ctx.resume().catch(() => {});
    }
    if (this.ambianceEnabled && !this.speakerMuted && !this.ambianceNodes && this.ctx) {
      this.startKahvehaneAmbiance();
    }
    if (this.ctx && !this.cayciAudioBuffer) {
      this.loadCayciAudio();
    }
    return this.ctx;
  }

  async loadCayciAudio() {
    if (this.cayciAudioBuffer) return this.cayciAudioBuffer;
    if (typeof window === 'undefined' || typeof fetch === 'undefined' || !this.ctx) return null;
    if (this._cayciLoadPromise) return this._cayciLoadPromise;

    this._cayciLoadPromise = (async () => {
      try {
        const resp = await fetch('./assets/cayci_caylar.m4a');
        if (!resp.ok) return null;
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await this.ctx.decodeAudioData(arrayBuf);
        this.cayciAudioBuffer = decoded;
        return decoded;
      } catch {
        return null;
      } finally {
        this._cayciLoadPromise = null;
      }
    })();

    return this._cayciLoadPromise;
  }

  unlockAudio() {
    return this.initContext();
  }

  _syncMasterGain() {
    if (!this.masterGain || !this.ctx) return;
    const effective = this.enabled && !this.speakerMuted ? this.volume : 0;
    this.masterGain.gain.setValueAtTime(effective, this.ctx.currentTime);
  }

  setMasterVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number(vol)));
    if (this.volume > 0 && this.speakerMuted) {
      this.speakerMuted = false;
      this.enabled = true;
    }
    this._syncMasterGain();
    this._syncAmbianceGain();
  }

  setSpeakerMuted(muted) {
    this.speakerMuted = Boolean(muted);
    this.enabled = !this.speakerMuted;
    this._syncMasterGain();
    this._syncAmbianceGain();
  }

  toggleSpeakerMute() {
    this.setSpeakerMuted(!this.speakerMuted);
    return this.speakerMuted;
  }

  _syncAmbianceGain() {
    if (!this.ambianceNodes?.masterGain || !this.ctx) return;
    const active = this.ambianceEnabled && !this.speakerMuted && this.enabled;
    this.ambianceNodes.masterGain.gain.setValueAtTime(
      active ? this.ambianceVolume : 0,
      this.ctx.currentTime
    );
  }

  _buildSharedNoiseBuffer() {
    if (!this.ctx || this.sharedNoiseBuffer) return;
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.sharedNoiseBuffer = buf;
  }

  _getOutputNode() {
    return this.masterGain || this.ctx?.destination;
  }

  createPanner(pan = 0) {
    if (!this.ctx) return null;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
      return panner;
    }
    return this.ctx.createGain();
  }

  // --- 1. ULTRA-REALISTIC OKEY TILE SLAP / THROW ---
  playOkeyTileClick(intensity = 1.0, pan = 0) {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this._getOutputNode());

    // Layer 1: High-Velocity Melamine Impact Transient (zero buffer allocation!)
    const clickSource = this.ctx.createBufferSource();
    clickSource.buffer = this.sharedNoiseBuffer;

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(4600 + (Math.random() - 0.5) * 600, t);
    clickFilter.Q.setValueAtTime(5.5, t);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.75 * intensity, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);

    clickSource.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(panner);
    clickSource.start(t, Math.random() * 0.35, 0.03);

    // Layer 2: Heavy Melamine "TOK" Bone Body Resonance
    const bodyOsc1 = this.ctx.createOscillator();
    const bodyGain1 = this.ctx.createGain();
    bodyOsc1.type = 'sine';
    const fundamental = 920 + (Math.random() - 0.5) * 80;
    bodyOsc1.frequency.setValueAtTime(fundamental, t);
    bodyOsc1.frequency.exponentialRampToValueAtTime(fundamental * 0.42, t + 0.048);

    bodyGain1.gain.setValueAtTime(0.85 * intensity, t);
    bodyGain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.052);

    bodyOsc1.connect(bodyGain1);
    bodyGain1.connect(panner);
    bodyOsc1.start(t);
    bodyOsc1.stop(t + 0.055);

    // Layer 3: Secondary Overtone
    const bodyOsc2 = this.ctx.createOscillator();
    const bodyGain2 = this.ctx.createGain();
    bodyOsc2.type = 'triangle';
    bodyOsc2.frequency.setValueAtTime(fundamental * 1.85, t);
    bodyOsc2.frequency.exponentialRampToValueAtTime(fundamental * 0.7, t + 0.035);

    bodyGain2.gain.setValueAtTime(0.45 * intensity, t);
    bodyGain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);

    bodyOsc2.connect(bodyGain2);
    bodyGain2.connect(panner);
    bodyOsc2.start(t);
    bodyOsc2.stop(t + 0.04);

    // Layer 4: Solid Walnut Table Acoustic Thud
    const woodOsc = this.ctx.createOscillator();
    const woodGain = this.ctx.createGain();
    woodOsc.type = 'sine';
    woodOsc.frequency.setValueAtTime(140 + (Math.random() - 0.5) * 20, t);
    woodOsc.frequency.exponentialRampToValueAtTime(38, t + 0.085);

    woodGain.gain.setValueAtTime(0.6 * intensity, t);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.088);

    woodOsc.connect(woodGain);
    woodGain.connect(panner);
    woodOsc.start(t);
    woodOsc.stop(t + 0.09);

    // Layer 5: Micro-Rebound Scheduled on AudioContext timeline (no setTimeout jitter!)
    const bounceTime = t + 0.018;
    const bOsc = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    bOsc.type = 'sine';
    bOsc.frequency.setValueAtTime(1150 + Math.random() * 150, bounceTime);
    bOsc.frequency.exponentialRampToValueAtTime(420, bounceTime + 0.022);

    bGain.gain.setValueAtTime(0.32 * intensity, bounceTime);
    bGain.gain.exponentialRampToValueAtTime(0.0001, bounceTime + 0.022);

    bOsc.connect(bGain);
    bGain.connect(panner);
    bOsc.start(bounceTime);
    bOsc.stop(bounceTime + 0.025);
  }

  playOkeyTileSlap(intensity = 1.2, pan = 0) {
    this.playOkeyTileClick(intensity, pan);
  }

  // --- 2. 106 OKEY TILES SHUFFLE / WASH ---
  playOkeyTilesShuffle() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const duration = 1.2;
    const clackCount = 24;
    const t0 = this.ctx.currentTime;

    const rubSource = this.ctx.createBufferSource();
    rubSource.buffer = this.sharedNoiseBuffer;
    rubSource.loop = true;

    const rubFilter = this.ctx.createBiquadFilter();
    rubFilter.type = 'bandpass';
    rubFilter.frequency.setValueAtTime(1100, t0);
    rubFilter.frequency.linearRampToValueAtTime(1600, t0 + duration * 0.5);
    rubFilter.frequency.linearRampToValueAtTime(950, t0 + duration);
    rubFilter.Q.setValueAtTime(2.2, t0);

    const rubGain = this.ctx.createGain();
    rubGain.gain.setValueAtTime(0.01, t0);
    rubGain.gain.linearRampToValueAtTime(0.35, t0 + 0.35);
    rubGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    rubSource.connect(rubFilter);
    rubFilter.connect(rubGain);
    rubGain.connect(this._getOutputNode());
    rubSource.start(t0);
    rubSource.stop(t0 + duration);

    for (let i = 0; i < clackCount; i++) {
      const t = t0 + (i / clackCount) * (duration - 0.15) + Math.random() * 0.03;
      const panner = this.createPanner((Math.random() - 0.5) * 1.4);
      panner.connect(this._getOutputNode());

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const freq = 1200 + Math.random() * 2200;
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.025);

      gain.gain.setValueAtTime(0.18 + Math.random() * 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);

      osc.connect(gain);
      gain.connect(panner);
      osc.start(t);
      osc.stop(t + 0.03);
    }
  }

  // --- 3. OKEY TILE SLIDE ON WOODEN ISTAKA ---
  playOkeyTileSlide(pan = 0) {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this._getOutputNode());

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, t);
    filter.frequency.linearRampToValueAtTime(950, t + 0.1);
    filter.Q.setValueAtTime(3.8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    noise.start(t, Math.random() * 0.25, 0.12);

    this.playOkeyStoneClack(0.35, pan);
  }

  playOkeyStoneClack(intensity = 0.5, pan = 0) {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this._getOutputNode());

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 1800 + Math.random() * 400;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(650, t + 0.025);

    gain.gain.setValueAtTime(0.45 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.028);
  }

  // --- 4. CARD RIFFLE SHUFFLE ---
  playCardShuffle() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const cardCount = 24;
    const totalDuration = 0.48;
    const t0 = this.ctx.currentTime;

    for (let i = 0; i < cardCount; i++) {
      const progress = i / cardCount;
      const t = t0 + Math.pow(progress, 1.2) * totalDuration;
      const panner = this.createPanner(i % 2 === 0 ? -0.25 : 0.25);
      panner.connect(this._getOutputNode());

      const source = this.ctx.createBufferSource();
      source.buffer = this.sharedNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200 + i * 55, t);
      filter.Q.setValueAtTime(4.2, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24 + (i / cardCount) * 0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      source.start(t, (i * 0.017) % 0.4, 0.022);
    }

    setTimeout(() => this.playCardSnap(0.85, 0), 420);
  }

  // --- 5. CARD SLAP ON TABLE ---
  playCardTableSlap(intensity = 1.0, pan = 0) {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this._getOutputNode());

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.sharedNoiseBuffer;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(3600 + (Math.random() - 0.5) * 400, t);
    snapFilter.Q.setValueAtTime(3.6, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85 * intensity, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);

    noiseSource.connect(snapFilter);
    snapFilter.connect(noiseGain);
    noiseGain.connect(panner);
    noiseSource.start(t, Math.random() * 0.35, 0.04);

    // Table thump
    const tableOsc = this.ctx.createOscillator();
    const tableGain = this.ctx.createGain();
    tableOsc.type = 'sine';
    tableOsc.frequency.setValueAtTime(145 + (Math.random() - 0.5) * 20, t);
    tableOsc.frequency.exponentialRampToValueAtTime(38, t + 0.088);

    tableGain.gain.setValueAtTime(0.8 * intensity, t);
    tableGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    tableOsc.connect(tableGain);
    tableGain.connect(panner);
    tableOsc.start(t);
    tableOsc.stop(t + 0.095);

    // Cardstock whiplash
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(680 + (Math.random() - 0.5) * 90, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(190, t + 0.042);

    bodyGain.gain.setValueAtTime(0.5 * intensity, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(panner);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.048);
  }

  playCardSnap(intensity = 1.0, pan = 0) {
    this.playCardTableSlap(intensity, pan);
  }

  // --- 6. CARD DEALING WHOOSH ---
  playCardDeal(pitchOffset = 0, pan = 0) {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this._getOutputNode());

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200 + pitchOffset * 120, t);
    filter.frequency.linearRampToValueAtTime(1400, t + 0.085);
    filter.Q.setValueAtTime(2.6, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.088);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    noise.start(t, Math.random() * 0.3, 0.09);

    const tickOsc = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    tickOsc.type = 'sine';
    tickOsc.frequency.setValueAtTime(1800, t);
    tickOsc.frequency.exponentialRampToValueAtTime(700, t + 0.015);

    tickGain.gain.setValueAtTime(0.22, t);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

    tickOsc.connect(tickGain);
    tickGain.connect(panner);
    tickOsc.start(t);
    tickOsc.stop(t + 0.018);
  }

  // --- 7. WINNING SLAM ---
  playOkeyWinSlam() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    this.playOkeyTileSlap(1.4, 0);
    setTimeout(() => this.playOkeyTileSlap(1.1, 0.1), 70);
    setTimeout(() => this.playTrumpFanfare(), 180);
  }

  // --- 8. KAHVEHANE AMBIANCE ---
  startKahvehaneAmbiance() {
    if (!this.ctx || this.ambianceNodes) return;

    try {
      const masterAmbianceGain = this.ctx.createGain();
      masterAmbianceGain.gain.setValueAtTime(
        this.ambianceEnabled && !this.speakerMuted && this.enabled ? this.ambianceVolume : 0,
        this.ctx.currentTime
      );
      masterAmbianceGain.connect(this._getOutputNode());

      const bufferSize = this.ctx.sampleRate * 3;
      const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = noiseBuffer.getChannelData(channel);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
        }
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const murmurFilter = this.ctx.createBiquadFilter();
      murmurFilter.type = 'bandpass';
      murmurFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      murmurFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      const murmurGain = this.ctx.createGain();
      murmurGain.gain.setValueAtTime(0.07, this.ctx.currentTime);

      noiseSource.connect(murmurFilter);
      murmurFilter.connect(murmurGain);
      murmurGain.connect(masterAmbianceGain);
      noiseSource.start();

      const intervalId = setInterval(() => {
        if (!this.ambianceEnabled || this.speakerMuted || !this.enabled || !this.ctx) return;
        const rand = Math.random();
        if (rand < 0.45) {
          this.playTeaGlassStir();
        } else if (rand < 0.75) {
          this.playDistantTavlaRoll();
        } else {
          this.playDistantTileClick();
        }
      }, 4800);

      this.ambianceNodes = {
        masterGain: masterAmbianceGain,
        noiseSource,
        intervalId,
      };
    } catch (e) {
      console.warn('Ambiance audio init skipped', e);
    }
  }

  setAmbiance(enabled) {
    this.ambianceEnabled = enabled;
    if (enabled && !this.ambianceNodes) {
      this.initContext();
    }
    this._syncAmbianceGain();
  }

  playTeaGlassStir() {
    if (!this.ctx || !this.ambianceEnabled || this.speakerMuted || !this.enabled) return;
    const t = this.ctx.currentTime;
    const clinkCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < clinkCount; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3400 + Math.random() * 600, t + i * 0.13);

      gain.gain.setValueAtTime(0.04 * this.ambianceVolume, t + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 0.085);

      osc.connect(gain);
      gain.connect(this._getOutputNode());

      osc.start(t + i * 0.13);
      osc.stop(t + i * 0.13 + 0.09);
    }
  }

  playDistantTavlaRoll() {
    if (!this.ctx || !this.ambianceEnabled || this.speakerMuted || !this.enabled) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 80, t + i * 0.06);

      gain.gain.setValueAtTime(0.025 * this.ambianceVolume, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.05);

      osc.connect(gain);
      gain.connect(this._getOutputNode());

      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.06);
    }
  }

  playDistantTileClick() {
    if (!this.ambianceEnabled || this.speakerMuted || !this.enabled) return;
    const pan = (Math.random() - 0.5) * 1.6;
    this.playOkeyTileClick(0.2, pan);
  }

  // Askılı çay tepsisi yürürken çıkardığı ince bardak/metal şıkırtısı
  playCayciTrayClink(pan = 0) {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this._getOutputNode());

    const clinks = [3600 + Math.random() * 500, 4250 + Math.random() * 400];
    clinks.forEach((freq, idx) => {
      const start = t + idx * 0.095;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);

      osc.connect(gain);
      gain.connect(panner);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  }

  // Taze çay dökme & kaşık sesi
  playTeaPourSound() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx || !this.sharedNoiseBuffer) return;

    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.linearRampToValueAtTime(2400, t + 0.7);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._getOutputNode());
    noise.start(t);
    noise.stop(t + 0.78);

    setTimeout(() => this.playTeaGlassStir(), 350);
  }

  _playCayciBuffer(buffer, pan = 0, distanceGain = 1.0) {
    if (!this.ctx || !buffer || !this.enabled || this.speakerMuted) return false;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs < this._cayciPlayingUntil) return false;
    this._cayciPlayingUntil = nowMs + 2800;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(0.98 + Math.random() * 0.04, t);

    // Warm vocal presence peaking filter
    const presence = this.ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.setValueAtTime(1800, t);
    presence.Q.setValueAtTime(1.2, t);
    presence.gain.setValueAtTime(2.5, t);

    const panner = this.createPanner(pan);
    const gainNode = this.ctx.createGain();
    const clampedGain = Math.max(0.28, Math.min(1.15, distanceGain));
    gainNode.gain.setValueAtTime(clampedGain, t);

    // Dry path
    src.connect(presence);
    presence.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this._getOutputNode());

    // Subtle short kıraathane room reflection
    if (this.ctx.createDelay) {
      const delay = this.ctx.createDelay(0.2);
      delay.delayTime.setValueAtTime(0.055, t);
      const wetGain = this.ctx.createGain();
      wetGain.gain.setValueAtTime(0.16, t);
      presence.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(gainNode);
    }

    src.start(t);
    return true;
  }

  // Çaycı Hüseyin Otantik Sesli Çağrı (YouTube wtRVj7tbf_g klibi + mekansal akustik)
  speakCayciCall(arg1 = 0, distanceGain = 1.0) {
    if (!this.enabled || this.speakerMuted) return false;
    const pan = typeof arg1 === 'number' && Number.isFinite(arg1) ? arg1 : 0;
    const fallbackText = typeof arg1 === 'string' && arg1.trim() ? arg1 : 'Çaylarrrrrrr!';

    this.playCayciTrayClink(pan);

    if (typeof window === 'undefined') {
      return false;
    }

    this.initContext();
    if (this.cayciAudioBuffer) {
      return this._playCayciBuffer(this.cayciAudioBuffer, pan, distanceGain);
    }

    this.loadCayciAudio().then((buf) => {
      if (buf) {
        this._playCayciBuffer(buf, pan, distanceGain);
        return;
      }
      // Fallback ONLY if a real Turkish ('tr') TTS voice is installed (no English fallback)
      try {
        if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return;
        const synth = window.speechSynthesis;
        if (synth.speaking) return;
        const voices = synth.getVoices ? synth.getVoices() : [];
        const trVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
        if (!trVoice) return;
        const utter = new SpeechSynthesisUtterance(fallbackText);
        utter.voice = trVoice;
        utter.lang = 'tr-TR';
        utter.volume = Math.max(0, Math.min(1, this.volume));
        utter.rate = 1.04;
        utter.pitch = 1.08;
        synth.speak(utter);
      } catch {
        // ignore
      }
    });

    return true;
  }

  playPistiChime() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.001, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.28, t + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.55);

      osc.connect(gain);
      gain.connect(this._getOutputNode());

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.6);
    });
  }

  playTrumpFanfare() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880];
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);

      gain.gain.setValueAtTime(0.2, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.8);

      osc.connect(gain);
      gain.connect(this._getOutputNode());

      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.85);
    });
  }

  playCollectTrick() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playCardSnap(0.5 + i * 0.1, i % 2 === 0 ? -0.2 : 0.2);
      }, i * 38);
    }
  }

  playButtonClick() {
    if (!this.enabled || this.speakerMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.045);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this._getOutputNode());
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export const soundFx = new CardAudioEngine();
