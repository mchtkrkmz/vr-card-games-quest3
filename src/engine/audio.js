// Master Turkish Kıraathane & Card/Tile Physical Acoustic Modeling Engine
class CardAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.85;
    this.ambianceEnabled = true;
    this.ambianceVolume = 0.35;
    this.ambianceNodes = null;

    this.initContext = this.initContext.bind(this);
    ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(evt => {
      window.addEventListener(evt, this.initContext, { once: true });
    });
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.ambianceEnabled && !this.ambianceNodes) {
      this.startKahvehaneAmbiance();
    }
  }

  // Helper to create a stereo panner or fallback gain
  createPanner(pan = 0) {
    if (!this.ctx) return null;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
      return panner;
    }
    return this.ctx.createGain();
  }

  // --- 1. ULTRA-REALISTIC OKEY TILE SLAP / THROW (Okey Taşı Masaya / Istakaya Çakma Sesi) ---
  // Recreates authentic heavy melamine/bakelite stone hitting a solid wooden table
  playOkeyTileClick(intensity = 1.0, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this.ctx.destination);

    // --- Layer 1: High-Velocity Melamine Impact Transient (Sert kemik taş teması) ---
    const clickDuration = 0.028;
    const clickBufferSize = Math.floor(this.ctx.sampleRate * clickDuration);
    const clickBuffer = this.ctx.createBuffer(1, clickBufferSize, this.ctx.sampleRate);
    const clickData = clickBuffer.getChannelData(0);
    for (let i = 0; i < clickBufferSize; i++) {
      // Extremely sharp initial spike with high-frequency noise tail
      const decay = Math.exp(-i / (clickBufferSize * 0.08));
      const spike = i < 8 ? (1 - i / 8) * 1.5 : 0;
      clickData[i] = ((Math.random() * 2 - 1) + spike) * decay;
    }
    const clickSource = this.ctx.createBufferSource();
    clickSource.buffer = clickBuffer;

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(4600 + (Math.random() - 0.5) * 600, t);
    clickFilter.Q.setValueAtTime(5.5, t);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.75 * intensity * this.volume, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + clickDuration);

    clickSource.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(panner);
    clickSource.start(t);

    // --- Layer 2: Heavy Melamine "TOK" Bone Body Resonance (Tok Kemik Rezonansı) ---
    const bodyOsc1 = this.ctx.createOscillator();
    const bodyGain1 = this.ctx.createGain();
    bodyOsc1.type = 'sine';
    const fundamental = 920 + (Math.random() - 0.5) * 80;
    bodyOsc1.frequency.setValueAtTime(fundamental, t);
    bodyOsc1.frequency.exponentialRampToValueAtTime(fundamental * 0.42, t + 0.048);

    bodyGain1.gain.setValueAtTime(0.85 * intensity * this.volume, t);
    bodyGain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.052);

    bodyOsc1.connect(bodyGain1);
    bodyGain1.connect(panner);
    bodyOsc1.start(t);
    bodyOsc1.stop(t + 0.055);

    // --- Layer 3: Secondary Melamine Overtone Harmonic ---
    const bodyOsc2 = this.ctx.createOscillator();
    const bodyGain2 = this.ctx.createGain();
    bodyOsc2.type = 'triangle';
    bodyOsc2.frequency.setValueAtTime(fundamental * 1.85, t);
    bodyOsc2.frequency.exponentialRampToValueAtTime(fundamental * 0.7, t + 0.035);

    bodyGain2.gain.setValueAtTime(0.45 * intensity * this.volume, t);
    bodyGain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);

    bodyOsc2.connect(bodyGain2);
    bodyGain2.connect(panner);
    bodyOsc2.start(t);
    bodyOsc2.stop(t + 0.04);

    // --- Layer 4: Solid Walnut Table Acoustic Thud ("GÜM" Gövde Vuruşu) ---
    const woodOsc = this.ctx.createOscillator();
    const woodGain = this.ctx.createGain();
    woodOsc.type = 'sine';
    woodOsc.frequency.setValueAtTime(140 + (Math.random() - 0.5) * 20, t);
    woodOsc.frequency.exponentialRampToValueAtTime(38, t + 0.085);

    woodGain.gain.setValueAtTime(0.6 * intensity * this.volume, t);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.088);

    woodOsc.connect(woodGain);
    woodGain.connect(panner);
    woodOsc.start(t);
    woodOsc.stop(t + 0.09);

    // --- Layer 5: Realistic Micro-Rebounds (Taşın masaya otururken sekmesi) ---
    const bounceDelay1 = 0.016 + Math.random() * 0.008;
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(1150 + Math.random() * 150, t2);
      bOsc.frequency.exponentialRampToValueAtTime(420, t2 + 0.022);

      bGain.gain.setValueAtTime(0.32 * intensity * this.volume, t2);
      bGain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.022);

      bOsc.connect(bGain);
      bGain.connect(panner);
      bOsc.start(t2);
      bOsc.stop(t2 + 0.025);
    }, bounceDelay1 * 1000);

    const bounceDelay2 = bounceDelay1 + 0.014;
    setTimeout(() => {
      if (!this.ctx) return;
      const t3 = this.ctx.currentTime;
      const bOsc3 = this.ctx.createOscillator();
      const bGain3 = this.ctx.createGain();
      bOsc3.type = 'sine';
      bOsc3.frequency.setValueAtTime(1350 + Math.random() * 200, t3);
      bOsc3.frequency.exponentialRampToValueAtTime(600, t3 + 0.015);

      bGain3.gain.setValueAtTime(0.18 * intensity * this.volume, t3);
      bGain3.gain.exponentialRampToValueAtTime(0.0001, t3 + 0.015);

      bOsc3.connect(bGain3);
      bGain3.connect(panner);
      bOsc3.start(t3);
      bOsc3.stop(t3 + 0.018);
    }, bounceDelay2 * 1000);
  }

  // Alias for strong slap
  playOkeyTileSlap(intensity = 1.2, pan = 0) {
    this.playOkeyTileClick(intensity, pan);
  }

  // --- 2. 106 OKEY TILES SHUFFLE / WASH (Taşları Masada Yıkama / Karıştırma Sesi) ---
  // Recreates the iconic Turkish coffeehouse sound of 106 melamine tiles scrambling & sliding together
  playOkeyTilesShuffle() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();

    const duration = 1.8;
    const clackCount = 38;

    // A. Bed of sliding melamine friction
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const rubBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = rubBuffer.getChannelData(c);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.sin((i / bufferSize) * Math.PI);
        const white = Math.random() * 2 - 1;
        last = (last + 0.08 * white) / 1.08;
        data[i] = (last * 0.7 + white * 0.3) * envelope;
      }
    }
    const rubSource = this.ctx.createBufferSource();
    rubSource.buffer = rubBuffer;

    const rubFilter = this.ctx.createBiquadFilter();
    rubFilter.type = 'bandpass';
    rubFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    rubFilter.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + duration * 0.5);
    rubFilter.frequency.linearRampToValueAtTime(950, this.ctx.currentTime + duration);
    rubFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    const rubGain = this.ctx.createGain();
    rubGain.gain.setValueAtTime(0.4 * this.volume, this.ctx.currentTime);
    rubGain.gain.linearRampToValueAtTime(0.55 * this.volume, this.ctx.currentTime + 0.6);
    rubGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    rubSource.connect(rubFilter);
    rubFilter.connect(rubGain);
    rubGain.connect(this.ctx.destination);
    rubSource.start(this.ctx.currentTime);

    // B. Staggered burst of stone-on-stone clicks & impacts
    for (let i = 0; i < clackCount; i++) {
      const delay = (i / clackCount) * (duration - 0.25) + (Math.random() - 0.5) * 0.08;
      if (delay < 0) continue;

      setTimeout(() => {
        if (!this.ctx) return;
        const pan = (Math.random() - 0.5) * 1.6;
        const panner = this.createPanner(pan);
        panner.connect(this.ctx.destination);

        const t = this.ctx.currentTime;
        const freq = 1200 + Math.random() * 2400;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = Math.random() > 0.4 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.028);

        const amp = (0.2 + Math.random() * 0.35) * this.volume;
        gain.gain.setValueAtTime(amp, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);

        osc.connect(gain);
        gain.connect(panner);
        osc.start(t);
        osc.stop(t + 0.03);
      }, delay * 1000);
    }

    // Final cluster gather thump (Taşların toparlanıp deste yapılması)
    setTimeout(() => {
      this.playOkeyTileClick(0.75, 0);
    }, (duration - 0.15) * 1000);
  }

  // --- 3. OKEY TILE SLIDE ON WOODEN ISTAKA (Istakada Taş Kaydırma & Dizme Sesi) ---
  playOkeyTileSlide(pan = 0) {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this.ctx.destination);

    // Tactile melamine sliding friction along walnut wood groove
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.13);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, t);
    filter.frequency.linearRampToValueAtTime(950, t + 0.11);
    filter.Q.setValueAtTime(3.8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.42 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    noise.start(t);

    // End Notch Click (Taşın istaka yuvasına yerleşme tıkı)
    setTimeout(() => {
      this.playOkeyStoneClack(0.4, pan);
    }, 85);
  }

  // Melamine stone-on-stone gentle clack
  playOkeyStoneClack(intensity = 0.5, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this.ctx.destination);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 1800 + Math.random() * 400;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(650, t + 0.025);

    gain.gain.setValueAtTime(0.5 * intensity * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(t);
    osc.stop(t + 0.028);
  }

  // --- 4. ULTRA-REALISTIC CARD RIFFLE SHUFFLE (Profesyonel İskambil Kağıdı Karıştırma) ---
  // Recreates the thumb-riffle flutter and the waterfall bridge snap
  playCardShuffle() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const cardCount = 28;
    const totalDuration = 0.55;

    // Phase 1: Rapid thumb-riffle card flicks
    for (let i = 0; i < cardCount; i++) {
      // Accelerating logarithmic curve for natural thumb release
      const progress = i / cardCount;
      const delay = Math.pow(progress, 1.25) * totalDuration * 0.72 + (Math.random() - 0.5) * 0.012;

      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const pan = (i % 2 === 0 ? -0.25 : 0.25); // Alternating left/right halves
        const panner = this.createPanner(pan);
        panner.connect(this.ctx.destination);

        // Crisp card corner flick transient
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.022);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) {
          data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.22));
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        // Pitch naturally rises as tension builds in the deck
        filter.frequency.setValueAtTime(2200 + i * 55 + (Math.random() - 0.5) * 150, t);
        filter.Q.setValueAtTime(4.2, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime((0.28 + (i / cardCount) * 0.18) * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        source.start(t);
      }, Math.max(0, delay) * 1000);
    }

    // Phase 2: Waterfall / Bridge Flush Snap (Köprü kapanışı ve destenin oturması)
    setTimeout(() => {
      this.playCardSnap(0.9, 0);
    }, 480);
    setTimeout(() => {
      this.playCardSnap(0.65, 0);
    }, 530);
  }

  // --- 5. ULTRA-REALISTIC CARD SLAP ON TABLE (Masaya Kart Vurma / Şaklatma Sesi) ---
  // Recreates the authentic Turkish Kahvehane card slam on a solid wooden felt table
  playCardTableSlap(intensity = 1.0, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this.ctx.destination);

    // --- Layer 1: Razor-Sharp Cardstock Snap ("ŞAAK!" Transient) ---
    const snapSize = Math.floor(this.ctx.sampleRate * 0.038);
    const snapBuffer = this.ctx.createBuffer(1, snapSize, this.ctx.sampleRate);
    const snapData = snapBuffer.getChannelData(0);
    for (let i = 0; i < snapSize; i++) {
      const decay = Math.exp(-i / (snapSize * 0.12));
      const spike = i < 6 ? (1 - i / 6) * 2.2 : 0;
      snapData[i] = ((Math.random() * 2 - 1) + spike) * decay;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = snapBuffer;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(3600 + (Math.random() - 0.5) * 450, t);
    snapFilter.Q.setValueAtTime(3.8, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.95 * intensity * this.volume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);

    noiseSource.connect(snapFilter);
    snapFilter.connect(noiseGain);
    noiseGain.connect(panner);
    noiseSource.start(t);

    // --- Layer 2: Heavy Solid Walnut Table Body Thump ("GÜM / TOK!" Masanın İnlemesi) ---
    const tableOsc = this.ctx.createOscillator();
    const tableGain = this.ctx.createGain();
    tableOsc.type = 'sine';
    const fundamental = 145 + (Math.random() - 0.5) * 20;
    tableOsc.frequency.setValueAtTime(fundamental, t);
    tableOsc.frequency.exponentialRampToValueAtTime(38, t + 0.088);

    tableGain.gain.setValueAtTime(0.85 * intensity * this.volume, t);
    tableGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.092);

    tableOsc.connect(tableGain);
    tableGain.connect(panner);
    tableOsc.start(t);
    tableOsc.stop(t + 0.095);

    // --- Layer 3: Card Mid-Body Whiplash (Plastik Kaplı Kağıt Gövdesi) ---
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(680 + (Math.random() - 0.5) * 90, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(190, t + 0.042);

    bodyGain.gain.setValueAtTime(0.55 * intensity * this.volume, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(panner);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.048);

    // --- Layer 4: Felt Table Cushion Air Slap (Yeşil Çuha Hava Sıkışması) ---
    const feltFilter = this.ctx.createBiquadFilter();
    feltFilter.type = 'lowpass';
    feltFilter.frequency.setValueAtTime(950, t);
    feltFilter.frequency.linearRampToValueAtTime(250, t + 0.06);

    const feltOsc = this.ctx.createOscillator();
    feltOsc.type = 'sawtooth';
    feltOsc.frequency.setValueAtTime(220, t);
    feltOsc.frequency.exponentialRampToValueAtTime(65, t + 0.055);

    const feltGain = this.ctx.createGain();
    feltGain.gain.setValueAtTime(0.35 * intensity * this.volume, t);
    feltGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.058);

    feltOsc.connect(feltFilter);
    feltFilter.connect(feltGain);
    feltGain.connect(panner);
    feltOsc.start(t);
    feltOsc.stop(t + 0.062);

    // --- Layer 5: Card Corner Settling Micro-Rebound (Kartın Masaya Oturma İkinci Çıtı) ---
    setTimeout(() => {
      if (!this.ctx) return;
      const t2 = this.ctx.currentTime;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(1400 + Math.random() * 200, t2);
      bOsc.frequency.exponentialRampToValueAtTime(450, t2 + 0.016);

      bGain.gain.setValueAtTime(0.28 * intensity * this.volume, t2);
      bGain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.016);

      bOsc.connect(bGain);
      bGain.connect(panner);
      bOsc.start(t2);
      bOsc.stop(t2 + 0.018);
    }, 14);
  }

  // Backward-compatible alias for table slap
  playCardSnap(intensity = 1.0, pan = 0) {
    this.playCardTableSlap(intensity, pan);
  }

  // --- 6. CARD DEALING WHOOSH (Desteden Kağıt Çekme / Havada Süzülme) ---
  playCardDeal(pitchOffset = 0, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const panner = this.createPanner(pan);
    panner.connect(this.ctx.destination);

    // A: Friction whoosh
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.095);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200 + pitchOffset * 120, t);
    filter.frequency.linearRampToValueAtTime(1400, t + 0.09);
    filter.Q.setValueAtTime(2.6, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.38 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.092);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    noise.start(t);

    // B: Soft corner release tick
    const tickOsc = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    tickOsc.type = 'sine';
    tickOsc.frequency.setValueAtTime(1800, t);
    tickOsc.frequency.exponentialRampToValueAtTime(700, t + 0.015);

    tickGain.gain.setValueAtTime(0.25 * this.volume, t);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

    tickOsc.connect(tickGain);
    tickGain.connect(panner);
    tickOsc.start(t);
    tickOsc.stop(t + 0.018);
  }

  // --- 7. WINNING / OKEY ATMA / VICTORY SLAM ---
  playOkeyWinSlam() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    // Dramatic heavy double slap with victor fanfare
    this.playOkeyTileSlap(1.5, 0);
    setTimeout(() => {
      this.playOkeyTileSlap(1.2, 0.1);
    }, 70);
    setTimeout(() => {
      this.playTrumpFanfare();
    }, 180);
  }

  // --- 8. KAHVEHANE AMBIANCE SYNTHESIZER ---
  startKahvehaneAmbiance() {
    if (!this.ctx || this.ambianceNodes) return;

    try {
      const masterAmbianceGain = this.ctx.createGain();
      masterAmbianceGain.gain.setValueAtTime(this.ambianceVolume, this.ctx.currentTime);
      masterAmbianceGain.connect(this.ctx.destination);

      // Warm background crowd murmur noise (stereo brown/pink noise)
      const bufferSize = this.ctx.sampleRate * 4;
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
      murmurGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      noiseSource.connect(murmurFilter);
      murmurFilter.connect(murmurGain);
      murmurGain.connect(masterAmbianceGain);
      noiseSource.start();

      // Periodic Turkish Tea Glass Spoon Clinking & Distant Dice Rolls
      const intervalId = setInterval(() => {
        if (!this.ambianceEnabled || !this.ctx) return;
        const rand = Math.random();
        if (rand < 0.45) {
          this.playTeaGlassStir();
        } else if (rand < 0.75) {
          this.playDistantTavlaRoll();
        } else {
          this.playDistantTileClick();
        }
      }, 4500);

      this.ambianceNodes = {
        masterGain: masterAmbianceGain,
        noiseSource,
        intervalId
      };
    } catch (e) {
      console.warn('Ambiance audio init skipped', e);
    }
  }

  setAmbiance(enabled) {
    this.ambianceEnabled = enabled;
    if (this.ambianceNodes && this.ambianceNodes.masterGain) {
      this.ambianceNodes.masterGain.gain.setValueAtTime(
        enabled ? this.ambianceVolume : 0,
        this.ctx ? this.ctx.currentTime : 0
      );
    } else if (enabled) {
      this.initContext();
    }
  }

  // Realistic Tea Spoon Stirring in Glass (İnce belli çay bardağında kaşık şıkırtısı)
  playTeaGlassStir() {
    if (!this.ctx || !this.ambianceEnabled) return;
    const t = this.ctx.currentTime;
    const clinkCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < clinkCount; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      
      const freq = 3400 + Math.random() * 600;
      osc.frequency.setValueAtTime(freq, t + i * 0.13);

      gain.gain.setValueAtTime(0.045 * this.ambianceVolume, t + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 0.085);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + i * 0.13);
      osc.stop(t + i * 0.13 + 0.09);
    }
  }

  // Distant Tavla wooden dice shake & roll
  playDistantTavlaRoll() {
    if (!this.ctx || !this.ambianceEnabled) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 80, t + i * 0.06);

      gain.gain.setValueAtTime(0.03 * this.ambianceVolume, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.06);
    }
  }

  playDistantTileClick() {
    const pan = (Math.random() - 0.5) * 1.8;
    this.playOkeyTileClick(0.28, pan);
  }

  playPistiChime() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, t + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.65);
    });
  }

  playTrumpFanfare() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880];
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);

      gain.gain.setValueAtTime(0.22 * this.volume, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.04);
      osc.stop(t + idx * 0.04 + 0.9);
    });
  }

  playCollectTrick() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.playCardSnap(0.55 + i * 0.1, (i % 2 === 0 ? -0.2 : 0.2));
      }, i * 38);
    }
  }

  playButtonClick() {
    if (!this.ctx || !this.enabled) return;
    this.initContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.045);

    gain.gain.setValueAtTime(0.22 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

export const soundFx = new CardAudioEngine();
