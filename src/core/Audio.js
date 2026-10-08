// All sound is synthesized with WebAudio, so the game ships with zero audio files.
// Swap individual cues for recorded samples later by replacing the cases in play().
export class AudioFx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.tollTimer = null;
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
    this._startDrone();
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

  _noise({ dur = 0.2, type = 'bandpass', freq = 1000, q = 1, gain = 0.4, to = null, attack = 0.005, dest = this.sfx }) {
    const c = this.ctx, t = c.currentTime;
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

  setMusic(on) {
    if (!this.ctx || this.musicOn === on) return;
    this.musicOn = on;
    this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, on ? 1.2 : 0.8);
    clearInterval(this.tollTimer);
    if (on) this.tollTimer = setInterval(() => !this.muted && this._bell(98, 0.12, 5, this.music), 7000);
  }
}
