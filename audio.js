// audio.js
// No audio assets were provided, so per spec section 21 we create
// clean, functional sound hooks using generated WebAudio tones rather
// than blocking the game on missing files. Swappable later for real
// audio by replacing the oscillator calls with buffer playback.

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
  }

  _ensureCtx() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    this._ensureCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _tone({ freq = 440, duration = 0.12, type = 'sine', startGain = 0.5, endGain = 0.001, delay = 0, glideTo = null }) {
    if (!this.enabled) return;
    this._ensureCtx();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    gain.gain.setValueAtTime(startGain, t0);
    gain.gain.exponentialRampToValueAtTime(endGain, t0 + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  jump() {
    this._tone({ freq: 420, glideTo: 640, duration: 0.16, type: 'square', startGain: 0.22 });
  }

  land() {
    this._tone({ freq: 180, glideTo: 90, duration: 0.12, type: 'sine', startGain: 0.25 });
  }

  pickup() {
    this._tone({ freq: 660, glideTo: 990, duration: 0.1, type: 'sine', startGain: 0.28 });
    this._tone({ freq: 990, glideTo: 1320, duration: 0.14, type: 'sine', startGain: 0.2, delay: 0.06 });
  }

  checkpoint() {
    this._tone({ freq: 520, glideTo: 780, duration: 0.18, type: 'triangle', startGain: 0.25 });
    this._tone({ freq: 780, duration: 0.22, type: 'triangle', startGain: 0.18, delay: 0.1 });
  }

  death() {
    this._tone({ freq: 300, glideTo: 80, duration: 0.35, type: 'sawtooth', startGain: 0.22 });
  }

  gate() {
    this._tone({ freq: 260, glideTo: 520, duration: 0.4, type: 'sine', startGain: 0.22 });
    this._tone({ freq: 390, glideTo: 780, duration: 0.5, type: 'sine', startGain: 0.16, delay: 0.1 });
  }

  portal() {
    this._tone({ freq: 220, glideTo: 880, duration: 0.9, type: 'sine', startGain: 0.24 });
    this._tone({ freq: 330, glideTo: 1100, duration: 1.0, type: 'triangle', startGain: 0.14, delay: 0.15 });
  }

  celebrate() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      this._tone({ freq: f, duration: 0.3, type: 'triangle', startGain: 0.22, delay: i * 0.12 });
    });
  }
}
