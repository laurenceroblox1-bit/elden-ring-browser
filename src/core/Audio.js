// All sound is synthesized with WebAudio, so the game ships with zero audio files.
// Swap individual cues for recorded samples later by replacing the cases in play().
export class AudioFx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.tollTimer = null;
    this.listener = null; // the camera: playAt() pans and fades by where a sound is relative to it
    this.region = 'vale';
    this.croakTimer = null;
  }

  // A cue at a place in the world: quieter with distance (silent past `range`), panned left or right.
  playAt(name, pos, range = 45) {
    if (!this.ctx || this.muted || !this.listener) return;
    const cam = this.listener;
    const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return;
    const g = this.ctx.createGain();
    g.gain.value = Math.pow(1 - d / range, 1.4) * 1.1 + 0.05;
    let out = g;
    if (this.ctx.createStereoPanner) {
      const e = cam.matrixWorld.elements; // camera's right vector is the first column
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, ((dx * e[0] + dz * e[2]) / (d || 1)) * 0.8));
      g.connect(pan);
      out = pan;
    }
    out.connect(this.sfx);
    const prev = this.sfx;
    this.sfx = g;
    try { this.play(name); } finally { this.sfx = prev; }
    setTimeout(() => { g.disconnect(); out.disconnect(); }, 4000);
  }

  // Region ambience: wind howling through the Rimewold, frogs croaking in the Ashen Fen, the deep
  // rumble and crackle of the Cinderfall Wastes, surf and gulls on the Drowned Coast, water dripping
  // in the Glowcap Hollows.
  setRegion(r) {
    if (r === this.region) return;
    this.region = r;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rumble?.gain.setTargetAtTime(r === 'cinder' ? 0.5 : 0, t, 1.5);
    this.surf?.gain.setTargetAtTime(r === 'coast' ? 0.42 : 0, t, 1.5);
    this.rainBed?.gain.setTargetAtTime(r === 'storm' ? 0.3 : 0, t, 1.5);
    this.howl?.gain.setTargetAtTime(r === 'rime' ? 0.32 : r === 'dunes' ? 0.14 : r === 'storm' ? 0.12 : 0, t, 1.5);
    clearInterval(this.croakTimer);
    if (r === 'fen') {
      this.croakTimer = setInterval(() => {
        if (this.muted || Math.random() < 0.4) return;
        const f = 90 + Math.random() * 60;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this._tone({ freq: f, to: f * 0.8, type: 'square', dur: 0.09, gain: 0.025, delay: i * 0.14, dest: this.amb });
      }, 1300);
    } else if (r === 'cinder') {
      this.croakTimer = setInterval(() => {
        if (this.muted) return;
        // Crackling embers, and now and then a lava pop.
        for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) this._noise({ dur: 0.03, type: 'highpass', freq: 2500 + Math.random() * 2000, gain: 0.04, dest: this.amb });
        if (Math.random() < 0.3) this._tone({ freq: 70, to: 40, type: 'sine', dur: 0.35, gain: 0.12, dest: this.amb });
      }, 900);
    } else if (r === 'coast') {
      this.croakTimer = setInterval(() => {
        if (this.muted || Math.random() < 0.55) return;
        // A gull: two or three falling cries.
        const f = 1500 + Math.random() * 500;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this._tone({ freq: f, to: f * 0.62, type: 'triangle', dur: 0.22, gain: 0.03, delay: i * 0.28, dest: this.amb });
      }, 2600);
    } else if (r === 'dunes') {
      this.croakTimer = setInterval(() => {
        if (this.muted || Math.random() < 0.5) return;
        // Sand hissing over the ridges.
        this._noise({ dur: 1.6, type: 'bandpass', freq: 3500, to: 2200, q: 0.8, gain: 0.05, attack: 0.6, dest: this.amb });
      }, 2400);
    } else if (r === 'glow') {
      this.croakTimer = setInterval(() => {
        if (this.muted || Math.random() < 0.3) return;
        // A drip in a still pool, with its echo off the caps.
        const f = 900 + Math.random() * 1100;
        for (let i = 0; i < 3; i++) this._tone({ freq: f, to: f * 1.4, type: 'sine', dur: 0.12, gain: 0.05 / (1 + i * 2), delay: i * 0.21, dest: this.amb });
      }, 1100);
    }
  }

  // The Wastes' rumble (low, slow-breathing noise) and the coast's surf (waves rolling in and out).
  _startRegionBeds() {
    const c = this.ctx;
    const bed = (freq, type, q, lfoHz, lfoDepth) => {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const swell = c.createGain();
      swell.gain.value = 1 - lfoDepth;
      const lfo = c.createOscillator();
      lfo.frequency.value = lfoHz;
      const lg = c.createGain();
      lg.gain.value = lfoDepth;
      lfo.connect(lg).connect(swell.gain);
      const out = c.createGain();
      out.gain.value = 0;
      src.connect(f).connect(swell).connect(out).connect(this.amb);
      src.start();
      lfo.start();
      return out;
    };
    this.rumble = bed(80, 'lowpass', 0.8, 0.07, 0.4);
    this.surf = bed(700, 'lowpass', 0.6, 0.13, 0.85);
    this.rainBed = bed(3200, 'highpass', 0.5, 0.31, 0.2);
  }

  _startHowl() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 650;
    f.Q.value = 7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(f.frequency);
    this.howl = c.createGain();
    this.howl.gain.value = 0;
    src.connect(f).connect(this.howl).connect(this.amb);
    src.start();
    lfo.start();
  }

  // Must be called from a user gesture (browsers block audio before one).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(c.destination);
    this.sfx = this._gain(1, this.master);
    this.music = this._gain(0, this.master);
    this.amb = this._gain(0, this.master);

    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._startAmbient();
    this._startHowl();
    this._startRegionBeds();
    this._startDrone();
    const r = this.region;
    this.region = null;
    this.setRegion(r);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  _gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  _noise({ dur = 0.2, type = 'bandpass', freq = 1000, q = 1, gain = 0.4, to = null, attack = 0.005, delay = 0, dest = this.sfx }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _tone({ freq = 440, type = 'sine', dur = 0.3, gain = 0.3, to = null, attack = 0.005, delay = 0, dest = this.sfx }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Inharmonic partials make a convincing bronze bell.
  _bell(base = 220, gain = 0.25, dur = 3.5, dest = this.sfx) {
    const partials = [[0.5, 0.5], [1, 1], [1.19, 0.6], [1.56, 0.45], [2, 0.5], [2.74, 0.25], [3.76, 0.15]];
    for (const [ratio, amp] of partials) {
      this._tone({ freq: base * ratio, type: 'sine', dur: dur * (1.1 - ratio * 0.12), gain: gain * amp, attack: 0.003, dest });
    }
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'swing': this._noise({ dur: 0.18, freq: 900, to: 2600, q: 0.8, gain: 0.22 }); break;
      case 'heavySwing': this._noise({ dur: 0.32, freq: 500, to: 1800, q: 0.7, gain: 0.3 }); break;
      case 'hit':
        this._noise({ dur: 0.14, type: 'lowpass', freq: 1400, q: 1, gain: 0.5 });
        this._tone({ freq: 140, to: 60, type: 'triangle', dur: 0.16, gain: 0.35 });
        break;
      case 'hurt':
        this._noise({ dur: 0.2, type: 'lowpass', freq: 700, gain: 0.55 });
        this._tone({ freq: 95, to: 45, type: 'sawtooth', dur: 0.22, gain: 0.18 });
        break;
      case 'clang':
        this._tone({ freq: 1250, type: 'square', dur: 0.12, gain: 0.08 });
        this._bell(620, 0.06, 0.6);
        break;
      // Guarding: steel on steel for the sword, a duller knock for a shield, a bright ring for a parry.
      case 'block':
        this._noise({ dur: 0.12, freq: 2400, q: 2, gain: 0.35 });
        this._tone({ freq: 880, type: 'square', dur: 0.07, gain: 0.05 });
        this._bell(540, 0.05, 0.45);
        this._tone({ freq: 130, to: 70, type: 'triangle', dur: 0.14, gain: 0.3 });
        break;
      case 'shield':
        this._noise({ dur: 0.13, type: 'lowpass', freq: 900, gain: 0.5 });
        this._tone({ freq: 170, to: 90, type: 'triangle', dur: 0.13, gain: 0.32 });
        this._tone({ freq: 720, type: 'square', dur: 0.05, gain: 0.035 });
        break;
      case 'parry':
        this._noise({ dur: 0.08, type: 'highpass', freq: 4200, gain: 0.35 });
        this._bell(1046, 0.13, 1.3);
        this._bell(1568, 0.07, 1.0);
        this._tone({ freq: 2093, dur: 0.7, gain: 0.05, attack: 0.002 });
        break;
      case 'guardBreak':
        this._noise({ dur: 0.36, freq: 1800, to: 300, q: 1.5, gain: 0.5 });
        this._tone({ freq: 420, to: 140, type: 'square', dur: 0.3, gain: 0.07 });
        this._tone({ freq: 90, to: 40, dur: 0.42, gain: 0.42 });
        break;
      case 'riposte':
        this._noise({ dur: 0.42, type: 'lowpass', freq: 900, to: 200, gain: 0.75 });
        this._tone({ freq: 110, to: 38, dur: 0.5, gain: 0.6 });
        this._tone({ freq: 220, to: 80, type: 'sawtooth', dur: 0.18, gain: 0.12 });
        break;
      case 'roll': this._noise({ dur: 0.35, freq: 300, to: 120, q: 0.6, gain: 0.25 }); break;
      case 'step': this._noise({ dur: 0.06, type: 'lowpass', freq: 380, gain: 0.08 }); break;
      case 'slam':
        this._noise({ dur: 0.7, type: 'lowpass', freq: 500, to: 80, gain: 0.8 });
        this._tone({ freq: 70, to: 30, type: 'sine', dur: 0.8, gain: 0.6 });
        break;
      case 'bell': this._bell(196, 0.28, 4); break;
      case 'bellSmall': this._bell(392, 0.14, 1.8); break;
      case 'roar':
        this._noise({ dur: 1.6, freq: 260, to: 140, q: 2, gain: 0.5, attack: 0.15 });
        this._tone({ freq: 82, to: 55, type: 'sawtooth', dur: 1.5, gain: 0.2, attack: 0.2 });
        break;
      case 'lanternFlare':
        // A cold flame taking hold: a glassy swell and a high chime.
        this._noise({ dur: 1.2, freq: 1800, to: 5200, q: 1.2, gain: 0.16, attack: 0.5 });
        this._bell(784, 0.1, 3);
        this._tone({ freq: 392, to: 523, type: 'triangle', dur: 1.4, gain: 0.08, attack: 0.4 });
        break;
      case 'alertHuman':
        // A hoarse, hollow grunt: it has seen you.
        this._noise({ dur: 0.38, freq: 340, to: 190, q: 3, gain: 0.32, attack: 0.03 });
        this._tone({ freq: 118, to: 86, type: 'sawtooth', dur: 0.34, gain: 0.08, attack: 0.03 });
        break;
      case 'chant':
        this._tone({ freq: 220, to: 233, type: 'triangle', dur: 0.8, gain: 0.07, attack: 0.15 });
        this._tone({ freq: 330, to: 349, type: 'triangle', dur: 0.8, gain: 0.05, attack: 0.15 });
        break;
      case 'wraithAlert':
        this._tone({ freq: 520, to: 880, type: 'triangle', dur: 0.7, gain: 0.08, attack: 0.2 });
        this._tone({ freq: 880, to: 470, type: 'sine', dur: 0.9, gain: 0.07, delay: 0.6 });
        this._noise({ dur: 1.2, freq: 2600, to: 1600, q: 2, gain: 0.08, attack: 0.3 });
        break;
      case 'spawn':
        // Something steps out of nowhere: a rising rush and a low thud.
        this._noise({ dur: 0.7, freq: 200, to: 2400, q: 0.8, gain: 0.22, attack: 0.3 });
        this._tone({ freq: 70, to: 45, type: 'sine', dur: 0.5, gain: 0.3, delay: 0.55 });
        break;
      case 'return':
        // Resting: the dead of the Vale get up again (a long, low swell).
        this._tone({ freq: 55, to: 82, type: 'sawtooth', dur: 2.2, gain: 0.06, attack: 0.8 });
        this._noise({ dur: 2.4, type: 'lowpass', freq: 200, to: 600, gain: 0.18, attack: 1 });
        break;
      case 'roarBig':
        this._noise({ dur: 2.0, freq: 180, to: 90, q: 2.4, gain: 0.6, attack: 0.12 });
        this._tone({ freq: 62, to: 40, type: 'sawtooth', dur: 1.8, gain: 0.26, attack: 0.2 });
        break;
      case 'frostbite':
        // A crack of ice and a glassy ring.
        this._noise({ dur: 0.35, freq: 3200, to: 900, q: 2, gain: 0.35 });
        this._tone({ freq: 1760, to: 1320, type: 'triangle', dur: 0.7, gain: 0.12 });
        this._tone({ freq: 2640, type: 'sine', dur: 0.9, gain: 0.07, delay: 0.05 });
        break;
      case 'crack':
        // The bolt itself: a sharp white crack.
        this._noise({ dur: 0.25, type: 'highpass', freq: 1800, gain: 0.6 });
        this._noise({ dur: 0.5, type: 'lowpass', freq: 900, to: 200, gain: 0.5, attack: 0.01 });
        break;
      case 'thunder':
        // A long rolling rumble.
        this._noise({ dur: 3.2, type: 'lowpass', freq: 160, to: 60, gain: 0.55, attack: 0.08 });
        this._noise({ dur: 2.4, type: 'lowpass', freq: 380, to: 90, gain: 0.25, attack: 0.3, delay: 0.3 });
        break;
      case 'ignite':
        // A whoomph of catching flame.
        this._noise({ dur: 0.6, type: 'lowpass', freq: 300, to: 2400, gain: 0.4, attack: 0.04 });
        this._tone({ freq: 90, to: 60, type: 'sawtooth', dur: 0.4, gain: 0.08 });
        break;
      case 'poison':
        // A sickly bubbling.
        for (let i = 0; i < 5; i++) this._tone({ freq: 220 + Math.random() * 180, to: 120, type: 'sine', dur: 0.12, gain: 0.08, delay: i * 0.07 });
        this._noise({ dur: 0.5, type: 'bandpass', freq: 600, q: 3, gain: 0.08 });
        break;
      case 'breath':
        // A roaring jet of fire.
        this._noise({ dur: 1.6, type: 'lowpass', freq: 500, to: 1500, gain: 0.45, attack: 0.15 });
        this._noise({ dur: 1.4, type: 'bandpass', freq: 200, q: 1.5, gain: 0.25, attack: 0.1 });
        break;
      case 'wings':
        // A heavy wingbeat.
        this._noise({ dur: 0.45, type: 'lowpass', freq: 260, to: 120, gain: 0.5, attack: 0.08 });
        break;
      case 'spore':
        // A soft puff of spores.
        this._noise({ dur: 0.5, type: 'bandpass', freq: 900, to: 400, q: 1.2, gain: 0.18, attack: 0.03 });
        break;
      case 'splash':
        this._noise({ dur: 0.5, type: 'bandpass', freq: 1200, to: 500, q: 0.8, gain: 0.25 });
        break;
      case 'smith':
        // Hammer on the anvil: a bright ringing clang, twice.
        for (let i = 0; i < 2; i++) {
          this._tone({ freq: 1320, to: 1250, type: 'triangle', dur: 0.6, gain: 0.14, delay: i * 0.32 });
          this._tone({ freq: 2210, type: 'sine', dur: 0.5, gain: 0.06, delay: i * 0.32 });
          this._noise({ dur: 0.06, freq: 3000, q: 1, gain: 0.25, delay: i * 0.32 });
        }
        break;
      case 'shard':
        this._noise({ dur: 0.22, freq: 2600, to: 4200, q: 1.5, gain: 0.16 });
        this._tone({ freq: 1200, to: 1800, type: 'triangle', dur: 0.2, gain: 0.06 });
        break;
      case 'bowDraw':
        this._noise({ dur: 0.6, type: 'bandpass', freq: 500, to: 900, q: 4, gain: 0.08, attack: 0.3 });
        break;
      case 'arrow':
        this._noise({ dur: 0.16, freq: 1400, to: 3000, q: 1, gain: 0.18 });
        break;
      case 'blink':
        this._noise({ dur: 0.4, freq: 600, to: 3000, q: 0.7, gain: 0.14, attack: 0.05 });
        this._tone({ freq: 880, to: 220, type: 'sine', dur: 0.4, gain: 0.08 });
        break;
      case 'howl':
        // A long rising-falling wail over a growl.
        this._tone({ freq: 220, to: 420, type: 'triangle', dur: 0.9, gain: 0.16, attack: 0.25 });
        this._tone({ freq: 420, to: 260, type: 'triangle', dur: 1.2, gain: 0.14, attack: 0.05, delay: 0.85 });
        this._noise({ dur: 1.8, freq: 380, to: 200, q: 1.5, gain: 0.25, attack: 0.3 });
        break;
      case 'snarl':
        this._noise({ dur: 0.45, freq: 320, to: 180, q: 3, gain: 0.35, attack: 0.03 });
        this._tone({ freq: 95, to: 70, type: 'sawtooth', dur: 0.4, gain: 0.12 });
        break;
      case 'heal':
        this._tone({ freq: 520, to: 780, dur: 0.5, gain: 0.12, attack: 0.05 });
        this._tone({ freq: 780, to: 1040, dur: 0.6, gain: 0.08, attack: 0.08, delay: 0.1 });
        break;
      case 'pickup':
        this._tone({ freq: 660, dur: 0.25, gain: 0.12 });
        this._tone({ freq: 990, dur: 0.4, gain: 0.1, delay: 0.09 });
        break;
      case 'quest':
        this._bell(523, 0.08, 1.6);
        this._bell(784, 0.06, 1.8);
        break;
      case 'whistle':
        this._tone({ freq: 1500, to: 2300, type: 'sine', dur: 0.25, gain: 0.14, attack: 0.02 });
        this._tone({ freq: 2300, to: 1700, type: 'sine', dur: 0.35, gain: 0.12, attack: 0.02, delay: 0.24 });
        break;
      case 'mist': this._noise({ dur: 1.4, freq: 1800, to: 400, q: 0.5, gain: 0.18, attack: 0.3 }); break;
      case 'kindle':
        this._noise({ dur: 0.9, type: 'lowpass', freq: 300, to: 3000, gain: 0.2, attack: 0.1 });
        this._bell(330, 0.1, 2.5);
        break;
      case 'death':
        this._tone({ freq: 110, to: 40, type: 'sawtooth', dur: 2.2, gain: 0.22, attack: 0.05 });
        this._bell(98, 0.2, 5);
        break;
      case 'victory':
        this._bell(262, 0.18, 5);
        this._bell(392, 0.12, 5.5);
        this._bell(523, 0.08, 6);
        break;
      case 'ui': this._tone({ freq: 880, dur: 0.07, gain: 0.05 }); break;
      // Gear, weapon arts and rites.
      case 'equip':
        this._noise({ dur: 0.1, freq: 2600, q: 3, gain: 0.18 });
        this._tone({ freq: 620, type: 'triangle', dur: 0.12, gain: 0.08 });
        break;
      case 'noFocus': this._tone({ freq: 220, to: 160, type: 'triangle', dur: 0.16, gain: 0.12 }); break;
      case 'emberArc':
        this._noise({ dur: 0.5, freq: 600, to: 2400, q: 0.7, gain: 0.32 });
        this._noise({ dur: 0.7, type: 'lowpass', freq: 900, to: 300, gain: 0.25, attack: 0.04 });
        break;
      case 'pierce':
        this._noise({ dur: 0.32, freq: 1400, to: 3800, q: 1.2, gain: 0.3 });
        this._tone({ freq: 300, to: 900, type: 'triangle', dur: 0.2, gain: 0.08 });
        break;
      case 'ghost':
        this._noise({ dur: 0.3, type: 'highpass', freq: 3000, to: 900, gain: 0.2 });
        this._tone({ freq: 1320, to: 440, dur: 0.35, gain: 0.07 });
        break;
      case 'toll':
        this._bell(147, 0.3, 4.5);
        this._noise({ dur: 0.7, type: 'lowpass', freq: 500, to: 80, gain: 0.7 });
        this._tone({ freq: 60, to: 30, dur: 0.9, gain: 0.5 });
        break;
      case 'cast': this._noise({ dur: 0.35, type: 'lowpass', freq: 300, to: 2200, gain: 0.16, attack: 0.08 }); break;
      case 'bolt':
        this._noise({ dur: 0.4, freq: 800, to: 2000, q: 0.8, gain: 0.25 });
        this._tone({ freq: 330, to: 520, type: 'triangle', dur: 0.25, gain: 0.07 });
        break;
      case 'boltHit':
        this._noise({ dur: 0.45, type: 'lowpass', freq: 1800, to: 200, gain: 0.5 });
        this._tone({ freq: 160, to: 60, dur: 0.3, gain: 0.3 });
        break;
      case 'ward':
        this._noise({ dur: 1.0, type: 'lowpass', freq: 200, to: 1200, gain: 0.2, attack: 0.15 });
        this._bell(440, 0.06, 2);
        break;
      case 'mend':
        this._tone({ freq: 392, to: 587, dur: 0.8, gain: 0.1, attack: 0.1 });
        this._tone({ freq: 587, to: 784, dur: 1.0, gain: 0.07, attack: 0.15, delay: 0.15 });
        break;
    }
  }

  _startAmbient() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.5;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.amb);
    src.start();
    lfo.start();
    this.amb.gain.setTargetAtTime(0.16, c.currentTime, 2);
  }

  _startDrone() {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 360;
    f.connect(this.music);
    for (const [freq, type, g] of [[55, 'sawtooth', 0.1], [55.4, 'sawtooth', 0.1], [82.4, 'triangle', 0.12], [41.2, 'sine', 0.2]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const og = c.createGain();
      og.gain.value = g;
      o.connect(og).connect(f);
      o.start();
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = c.createGain();
    lg.gain.value = 180;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
  }

  // The boss drone, with a toll every few seconds: low bronze for the Warden and Vharra, a high glassy
  // chime for the Rimewold's bosses (`style` 'winter').
  setMusic(on, style = 'bell') {
    if (!this.ctx || (this.musicOn === on && this.musicStyle === style)) return;
    this.musicOn = on;
    this.musicStyle = style;
    this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, on ? 1.2 : 0.8);
    clearInterval(this.tollTimer);
    if (!on) return;
    // Each boss has its own pulse: the Warden's low bell, winter's high chimes, the drake's war drums,
    // the captain's foghorn and surf, the witch's eerie chimes.
    const STYLES = {
      bell: [() => this._bell(98, 0.12, 5, this.music), 7000],
      winter: [() => { this._bell(392, 0.07, 6, this.music); this._bell(587, 0.04, 5, this.music); }, 5200],
      fire: [() => {
        for (let i = 0; i < 4; i++) this._tone({ freq: 70, to: 45, type: 'sine', dur: 0.35, gain: i === 0 ? 0.3 : 0.18, delay: i * 0.42, dest: this.music });
        this._bell(147, 0.05, 3, this.music);
      }, 3400],
      sea: [() => {
        this._tone({ freq: 82, to: 78, type: 'sawtooth', dur: 2.6, gain: 0.06, attack: 0.6, dest: this.music });
        this._noise({ dur: 3, type: 'lowpass', freq: 400, to: 900, gain: 0.12, attack: 1.2, dest: this.music });
      }, 6000],
      storm: [() => {
        this._noise({ dur: 2.6, type: 'lowpass', freq: 140, to: 60, gain: 0.3, attack: 0.1, dest: this.music });
        this._bell(196, 0.05, 4, this.music);
        this._bell(233, 0.035, 4, this.music);
      }, 3800],
      spore: [() => {
        const f = [523, 622, 784, 932][Math.floor(Math.random() * 4)];
        this._bell(f, 0.04, 5, this.music);
        this._bell(f * 1.5, 0.025, 4, this.music);
      }, 2600],
    };
    const [toll, every] = STYLES[style] ?? STYLES.bell;
    this.tollTimer = setInterval(() => !this.muted && toll(), every);
  }
}
