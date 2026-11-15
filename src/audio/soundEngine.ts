/**
 * Procedural Web Audio Engine for Motoboy Express 3D
 * Zero external audio files; 100% synthesized in real time.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning: boolean = false;

  // Rain ambient sound (atmospheric hiss)
  private rainNoiseNode: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;

  // Rain on Motorcycle Trunk / Baú (crisp drumming impacts on hollow plastic/box)
  private trunkRainNode: AudioBufferSourceNode | null = null;
  private trunkRainFilter: BiquadFilterNode | null = null;
  private trunkRainGain: GainNode | null = null;
  private isTrunkRainRunning: boolean = false;

  // Dynamic High-Speed Wind Audio
  private windNoiseNode: AudioBufferSourceNode | null = null;
  private windLowpass: BiquadFilterNode | null = null;
  private windHighpass: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windLfo: OscillatorNode | null = null;
  private windLfoGain: GainNode | null = null;
  private isWindRunning: boolean = false;

  constructor() {
    // Lazy init on first user gesture
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startEngine(exhaustType: 'stock' | 'sport' | 'coyote' | 'direto' = 'stock') {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isEngineRunning) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = exhaustType === 'direto' ? 'sawtooth' : (exhaustType === 'coyote' ? 'sawtooth' : 'triangle');
      this.engineSubOsc.type = 'sawtooth';

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = exhaustType === 'direto' ? 700 : (exhaustType === 'sport' ? 550 : 380);
      this.engineFilter.Q.value = exhaustType === 'direto' ? 4.5 : 2.5;

      this.engineGain.gain.value = 0.08;

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.engineSubOsc.frequency.setValueAtTime(22.5, this.ctx.currentTime);

      this.engineOsc.start();
      this.engineSubOsc.start();
      this.isEngineRunning = true;
    } catch {
      // Audio context error guard
    }
  }

  public updateEngine(speedRatio: number, isAccelerating: boolean, isWheelie: boolean) {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc || !this.engineSubOsc || !this.engineGain) return;

    const t = this.ctx.currentTime;
    const baseFreq = 42 + speedRatio * 90 + (isAccelerating ? 25 : 0) + (isWheelie ? 18 : 0);
    
    // Simulate gear steps
    const simulatedGears = 4;
    const gearFraction = (speedRatio * simulatedGears) % 1;
    const gearPitchBump = gearFraction * 40;
    const targetFreq = baseFreq + gearPitchBump;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, t, 0.05);

    const targetGain = 0.06 + speedRatio * 0.08 + (isAccelerating ? 0.05 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.08);
  }

  public stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* ignore */ }
      this.engineOsc.disconnect();
      this.engineOsc = null;
    }
    if (this.engineSubOsc) {
      try { this.engineSubOsc.stop(); } catch { /* ignore */ }
      this.engineSubOsc.disconnect();
      this.engineSubOsc = null;
    }
    this.isEngineRunning = false;
  }

  public playHorn() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Standard high-pitched motorcycle horn beep-beep
    osc1.frequency.setValueAtTime(460, t);
    osc2.frequency.setValueAtTime(580, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.setValueAtTime(0.2, t + 0.09);
    gain.gain.linearRampToValueAtTime(0, t + 0.11);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.14);
    gain.gain.setValueAtTime(0.2, t + 0.23);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.29);
    osc2.stop(t + 0.29);
  }

  public playSkid() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // White noise with highpass
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  public playCash() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6
    osc.frequency.setValueAtTime(1975.53, t + 0.16); // B6

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  public playOrderNotification() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Crisp smartphone app delivery alert chime (D6 -> A6 -> D7)
    osc1.frequency.setValueAtTime(1174.66, t);
    osc1.frequency.setValueAtTime(1760.0, t + 0.09);
    osc1.frequency.setValueAtTime(2349.32, t + 0.18);

    osc2.frequency.setValueAtTime(587.33, t);
    osc2.frequency.setValueAtTime(880.0, t + 0.09);
    osc2.frequency.setValueAtTime(1174.66, t + 0.18);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
    gain.gain.setValueAtTime(0.2, t + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.44);
    osc2.stop(t + 0.44);
  }


  public playDoorbell() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Ding-Dong
    const ding = this.ctx.createOscillator();
    const dong = this.ctx.createOscillator();
    const dingGain = this.ctx.createGain();
    const dongGain = this.ctx.createGain();

    ding.type = 'sine';
    ding.frequency.setValueAtTime(659.25, t); // E5
    dingGain.gain.setValueAtTime(0.2, t);
    dingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    dong.type = 'sine';
    dong.frequency.setValueAtTime(523.25, t + 0.3); // C5
    dongGain.gain.setValueAtTime(0.25, t + 0.3);
    dongGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    ding.connect(dingGain);
    dingGain.connect(this.masterGain);
    dong.connect(dongGain);
    dongGain.connect(this.masterGain);

    ding.start(t);
    ding.stop(t + 0.45);
    dong.start(t + 0.3);
    dong.stop(t + 0.85);
  }

  public playCrash() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Low thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playPedestrianScream() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Dual-formant vocal scream synthesis ("AAAHH!")
    const glottal = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();

    const f1 = this.ctx.createBiquadFilter();
    const f2 = this.ctx.createBiquadFilter();
    const screamGain = this.ctx.createGain();

    const isHighVoice = Math.random() > 0.45;
    const startPitch = isHighVoice ? 520 : 340;
    const peakPitch = isHighVoice ? 820 : 540;
    const endPitch = isHighVoice ? 380 : 240;

    glottal.type = 'sawtooth';
    glottal.frequency.setValueAtTime(startPitch, t);
    glottal.frequency.linearRampToValueAtTime(peakPitch, t + 0.12);
    glottal.frequency.exponentialRampToValueAtTime(endPitch, t + 0.62);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(14, t);
    vibratoGain.gain.setValueAtTime(22, t);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(glottal.frequency);

    // Open "AAAH" vowel formants
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(850, t);
    f1.Q.value = 4.5;

    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(1450, t);
    f2.Q.value = 5.5;

    screamGain.gain.setValueAtTime(0.01, t);
    screamGain.gain.linearRampToValueAtTime(0.42, t + 0.05);
    screamGain.gain.setValueAtTime(0.38, t + 0.35);
    screamGain.gain.exponentialRampToValueAtTime(0.005, t + 0.65);

    glottal.connect(f1);
    glottal.connect(f2);
    f1.connect(screamGain);
    f2.connect(screamGain);
    screamGain.connect(this.masterGain);

    glottal.start(t);
    vibrato.start(t);
    glottal.stop(t + 0.66);
    vibrato.stop(t + 0.66);

    // Also trigger a quick pt-BR vocal exclamation if Web Speech is available
    try {
      if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
        const cries = ['Aaaah! Cuidado!', 'Eita! Olha a moto!', 'Aaaai! Socorro!', 'Ei! Cuidado!'];
        const utter = new SpeechSynthesisUtterance(
          cries[Math.floor(Math.random() * cries.length)]
        );
        utter.lang = 'pt-BR';
        utter.pitch = isHighVoice ? 1.6 : 1.25;
        utter.rate = 1.35;
        utter.volume = 0.85;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // Ignore speech synthesis errors
    }
  }

  public playNitro() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(450, t + 0.35);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.42);
  }

  private initRainNodes() {
    if (!this.ctx || !this.masterGain || this.rainNoiseNode) return;
    try {
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 2.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start();
      this.rainNoiseNode = noise;
      this.rainFilter = filter;
      this.rainGain = gain;
    } catch {
      // Audio context error guard
    }
  }

  private initTrunkRainNodes() {
    if (!this.ctx || !this.masterGain || this.isTrunkRainRunning) return;
    try {
      const sampleRate = this.ctx.sampleRate;
      const durationSec = 3.0;
      const bufferSize = Math.floor(sampleRate * durationSec);
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      data.fill(0);

      // Procedural synthesis of individual raindrop impacts striking a hollow plastic/fiberglass delivery trunk
      // Each drop has an initial click impulse followed by a fast resonant decay (modal ringing of the box: 1400 - 2400 Hz)
      const numDrops = Math.floor(durationSec * 90); // Dense rain patter (~90 impacts per second for storms)
      for (let d = 0; d < numDrops; d++) {
        const startSample = Math.floor(Math.random() * (bufferSize - 1500));
        const impactFreq = 1450 + Math.random() * 950; // Resonant frequency of the hollow trunk lid/walls
        const decaySamples = Math.floor(sampleRate * (0.012 + Math.random() * 0.022)); // 12ms to 34ms quick decay
        const intensity = 0.35 + Math.random() * 0.65;

        for (let s = 0; s < decaySamples; s++) {
          const t = s / sampleRate;
          const osc = Math.sin(2 * Math.PI * impactFreq * t);
          const noise = (Math.random() * 2 - 1) * 0.3;
          const env = Math.exp(-s / (decaySamples * 0.25));
          data[startSample + s] += (osc + noise) * env * intensity * 0.22;
        }
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Resonant bandpass filter tuned to the hollow trunk box cavity
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1750;
      filter.Q.value = 4.2;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start();
      this.trunkRainNode = noise;
      this.trunkRainFilter = filter;
      this.trunkRainGain = gain;
      this.isTrunkRainRunning = true;
    } catch {
      // Audio error guard
    }
  }

  private initWindNodes() {
    if (!this.ctx || !this.masterGain || this.isWindRunning) return;
    try {
      const sampleRate = this.ctx.sampleRate;
      const durationSec = 3.0;
      const bufferSize = Math.floor(sampleRate * durationSec);
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      // Pink-filtered noise for rich aerodynamic body and weight
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 95; // Cut off DC and sub-rumble, keep low-mid wind roar
      highpass.Q.value = 0.8;

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 220; // Dynamically opens up to 2200 Hz with speed
      lowpass.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      // Turbulence LFO (buffeting flutter across helmet and windshield)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 4.2;
      lfoGain.gain.value = 0;

      lfo.connect(lfoGain);
      lfoGain.connect(lowpass.frequency);

      noise.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(this.masterGain);

      noise.start();
      lfo.start();

      this.windNoiseNode = noise;
      this.windHighpass = highpass;
      this.windLowpass = lowpass;
      this.windGain = gain;
      this.windLfo = lfo;
      this.windLfoGain = lfoGain;
      this.isWindRunning = true;
    } catch {
      // Audio error guard
    }
  }

  public updateAmbient(
    weatherType: string,
    speedKmH: number,
    isOnFoot: boolean = false,
    isNitro: boolean = false,
    isSheltered: boolean = false
  ) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    this.initRainNodes();
    this.initTrunkRainNodes();
    this.initWindNodes();

    // 1. DYNAMIC WEATHER: RAIN AMBIENCE & RAIN DROPS DRUMMING ON MOTORCYCLE TRUNK
    const isSevere = weatherType === 'severe_storm';
    const isStorm = weatherType === 'storm' || isSevere;
    const isRain = weatherType === 'rain';

    if (isStorm || isRain) {
      // General atmospheric rain hiss
      let targetRainGain = isSevere ? 0.14 : isStorm ? 0.09 : 0.05;
      let targetRainCutoff = isSevere ? 2200 : isStorm ? 1600 : 1100;

      // When sheltered under a canopy or viaduct, rain is muffled overhead
      if (isSheltered) {
        targetRainGain *= 0.35;
        targetRainCutoff = 650;
      }

      if (this.rainGain) this.rainGain.gain.setTargetAtTime(targetRainGain, t, 0.3);
      if (this.rainFilter) this.rainFilter.frequency.setTargetAtTime(targetRainCutoff, t, 0.3);

      // Rain hitting the hollow motorcycle trunk (baú da moto)
      if (this.trunkRainGain && this.trunkRainFilter && this.trunkRainNode) {
        if (isSheltered) {
          // No rain hits the trunk under a roof!
          this.trunkRainGain.gain.setTargetAtTime(0, t, 0.15);
        } else {
          // As speed increases, raindrops slam harder and faster against the front and top of the trunk!
          const speedEffect = Math.min(1.0, speedKmH / 110);
          let targetTrunkGain = isSevere
            ? (0.24 + speedEffect * 0.12) // Severe storm: thunderous barrage on trunk
            : isStorm
            ? (0.16 + speedEffect * 0.10) // Storm: very intense drumming on the trunk
            : (0.07 + speedEffect * 0.04); // Moderate rain: steady rhythmic drumming
          
          // If dismounted and on foot, player is slightly further from the bike trunk
          if (isOnFoot) {
            targetTrunkGain *= 0.35;
          }

          const targetTrunkFreq = isSevere
            ? (2200 + speedEffect * 400)
            : isStorm
            ? (1850 + speedEffect * 350)
            : (1600 + speedEffect * 200);

          // Slightly increase playback rate at higher speeds (drops hitting faster due to relative forward motion)
          const targetRate = isSevere
            ? (1.18 + speedEffect * 0.35)
            : isStorm
            ? (1.05 + speedEffect * 0.3)
            : (0.95 + speedEffect * 0.15);

          this.trunkRainGain.gain.setTargetAtTime(targetTrunkGain, t, 0.12);
          this.trunkRainFilter.frequency.setTargetAtTime(targetTrunkFreq, t, 0.15);
          this.trunkRainNode.playbackRate.setTargetAtTime(targetRate, t, 0.2);
        }
      }
    } else {
      // Dry weather: smooth fade out of rain & trunk patter
      if (this.rainGain) this.rainGain.gain.setTargetAtTime(0, t, 0.4);
      if (this.trunkRainGain) this.trunkRainGain.gain.setTargetAtTime(0, t, 0.3);
    }

    // 2. DYNAMIC AERODYNAMIC WIND NOISE (SCALING WITH HIGH SPEED & NITRO)
    if (this.windGain && this.windLowpass && this.windLfoGain && this.windLfo) {
      const speedRatio = Math.min(1.0, speedKmH / 135);

      if (speedKmH < 14 || isOnFoot) {
        // Idle, very low speed, or on-foot: silent or minimal draft (wind gale during storm)
        const onFootDraft = isSevere ? 0.04 : (isOnFoot && speedKmH > 6) ? 0.015 : 0;
        this.windGain.gain.setTargetAtTime(onFootDraft, t, 0.18);
        this.windLowpass.frequency.setTargetAtTime(180, t, 0.2);
        this.windLfoGain.gain.setTargetAtTime(0, t, 0.2);
      } else {
        // High speed wind: roaring rush & aerodynamic buffeting!
        // Non-linear cubic-exponential progression (quieter at 30km/h, soaring at 90-130km/h)
        const speedFactor = Math.pow(speedRatio, 1.45);
        const targetWindGain = speedFactor * 0.24 + (isNitro ? 0.09 : 0) + (isSevere ? 0.05 : 0);
        
        // Highpass & Lowpass frequency tracking: opens up from 260 Hz to 2200 Hz
        const targetCutoff = 260 + speedFactor * 1750 + (isNitro ? 400 : 0) + (isSevere ? 250 : 0);
        
        // Buffeting turbulence oscillation intensity
        const targetBuffeting = 25 + speedRatio * 160 + (isNitro ? 60 : 0) + (isSevere ? 40 : 0);
        
        // LFO speed buffeting frequency: oscillates faster at higher speeds
        const targetLfoRate = 3.5 + speedRatio * 4.0;

        this.windGain.gain.setTargetAtTime(targetWindGain, t, 0.08);
        this.windLowpass.frequency.setTargetAtTime(targetCutoff, t, 0.08);
        this.windLfoGain.gain.setTargetAtTime(targetBuffeting, t, 0.1);
        this.windLfo.frequency.setTargetAtTime(targetLfoRate, t, 0.15);
      }
    }
  }

  public setRainActive(active: boolean, intensity: number = 0.5) {
    this.updateAmbient(active ? (intensity >= 0.8 ? 'storm' : 'rain') : 'sunny', 0);
  }

  public pauseAmbient() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(0, t, 0.15);
    if (this.trunkRainGain) this.trunkRainGain.gain.setTargetAtTime(0, t, 0.15);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.15);
  }

  public stopAmbient() {
    if (this.rainNoiseNode) {
      try { this.rainNoiseNode.stop(); } catch { /* ignore */ }
      this.rainNoiseNode.disconnect();
      this.rainNoiseNode = null;
    }
    if (this.trunkRainNode) {
      try { this.trunkRainNode.stop(); } catch { /* ignore */ }
      this.trunkRainNode.disconnect();
      this.trunkRainNode = null;
      this.isTrunkRainRunning = false;
    }
    if (this.windNoiseNode) {
      try { this.windNoiseNode.stop(); } catch { /* ignore */ }
      this.windNoiseNode.disconnect();
      this.windNoiseNode = null;
    }
    if (this.windLfo) {
      try { this.windLfo.stop(); } catch { /* ignore */ }
      this.windLfo.disconnect();
      this.windLfo = null;
    }
    this.isWindRunning = false;
  }

  public playThunder() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 1.2);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 1.45);
  }

  public playTaunt(phrase: string) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Aggressive vocal shout + horn burst
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.linearRampToValueAtTime(340, t + 0.14);
    osc.frequency.exponentialRampToValueAtTime(170, t + 0.42);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, t);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.44);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.45);

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(phrase);
        utter.lang = 'pt-BR';
        utter.pitch = 0.92;
        utter.rate = 1.25;
        utter.volume = 0.95;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // Ignore speech synthesis errors
    }
  }

  public playGunshot() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Sharp percussive crack + low punch
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.045));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  public playBanditThreat() {
    this.initCtx();
    if (this.isMuted) return;
    try {
      if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
        const threats = [
          'Perdeu! Passa a moto agora!',
          'Desce da moto! Perdeu, motoboy!',
          'Parou, parou! Passa a chave da moto!',
        ];
        const utter = new SpeechSynthesisUtterance(
          threats[Math.floor(Math.random() * threats.length)]
        );
        utter.lang = 'pt-BR';
        utter.pitch = 0.8;
        utter.rate = 1.3;
        utter.volume = 0.9;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // Ignore
    }
  }

  public playJump() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.18);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  public playPunch() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Heavy martial arts punch impact (low thump + noise snap)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.008, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playPush() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.22);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.008, t + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playPoliceSiren() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Classic Brazilian Police Yelp/Wail two-tone siren cycle
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.linearRampToValueAtTime(920, t + 0.28);
    osc.frequency.linearRampToValueAtTime(640, t + 0.56);
    osc.frequency.linearRampToValueAtTime(920, t + 0.84);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
    gain.gain.setValueAtTime(0.18, t + 0.78);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.88);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.9);
  }

  public playGameOver() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(293.66, t); // D4
    osc.frequency.setValueAtTime(261.63, t + 0.22); // C4
    osc.frequency.setValueAtTime(220.0, t + 0.44); // A3
    osc.frequency.exponentialRampToValueAtTime(110.0, t + 0.95); // A2

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 1.0);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.02);
  }

  public playWhistle() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    // High-pitched Traffic Guardpea whistle trill (~2.9 kHz)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2850, t);
    osc.frequency.setValueAtTime(3020, t + 0.12);

    mod.type = 'square';
    mod.frequency.setValueAtTime(42, t);
    modGain.gain.setValueAtTime(140, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
    gain.gain.setValueAtTime(0.22, t + 0.34);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.masterGain);

    mod.start(t);
    osc.start(t);
    mod.stop(t + 0.43);
    osc.stop(t + 0.43);
  }

  public playPoliceArrest(announcement = true) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(587.33, t + 0.14);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.36);

    try {
      if (announcement && 'speechSynthesis' in window && !window.speechSynthesis.speaking) {
        const utter = new SpeechSynthesisUtterance('Parado! Polícia! Desce da moto, você está preso!');
        utter.lang = 'pt-BR';
        utter.pitch = 0.78;
        utter.rate = 1.3;
        utter.volume = 0.95;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // Ignore
    }
  }

  public playGhostWail() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(540, t);
    osc1.frequency.exponentialRampToValueAtTime(860, t + 0.35);
    osc1.frequency.exponentialRampToValueAtTime(340, t + 1.15);

    osc2.frequency.setValueAtTime(547, t);
    osc2.frequency.exponentialRampToValueAtTime(872, t + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(332, t + 1.15);

    // Eerie ghostly vibrato
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(8.5, t);
    lfoGain.gain.setValueAtTime(28, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.18);
    gain.gain.setValueAtTime(0.22, t + 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    lfo.start(t);
    osc1.start(t);
    osc2.start(t);
    lfo.stop(t + 1.22);
    osc1.stop(t + 1.22);
    osc2.stop(t + 1.22);
  }
}

export const sound = new SoundEngine();


