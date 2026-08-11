/* ==========================================================================
   AUDIO.JS — All sound effects are synthesized locally with the Web Audio
   API. No external audio files, no copyrighted music, no network requests.
   ========================================================================== */

const GameAudio = (() => {
  let ctx = null;
  let muted = false;
  let masterGain = null;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.6;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
    return ctx;
  }

  // Some browsers require a user gesture to start audio; call this on first input.
  function unlock() {
    const c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
  }

  function setMuted(val) {
    muted = val;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
  }

  function isMuted() { return muted; }

  function tone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.3, glideTo = null, delay = 0 }) {
    const c = ensureContext();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noiseBurst({ duration = 0.15, gain = 0.25, delay = 0, filterFreq = 2000 }) {
    const c = ensureContext();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  return {
    unlock,
    setMuted,
    isMuted,

    jump() {
      tone({ freq: 300, glideTo: 620, type: 'triangle', duration: 0.16, gain: 0.22 });
    },
    land() {
      tone({ freq: 180, glideTo: 90, type: 'sine', duration: 0.12, gain: 0.18 });
    },
    collect() {
      tone({ freq: 520, glideTo: 900, type: 'sine', duration: 0.12, gain: 0.28 });
      tone({ freq: 780, glideTo: 1200, type: 'sine', duration: 0.18, gain: 0.18, delay: 0.06 });
    },
    click() {
      tone({ freq: 440, type: 'square', duration: 0.06, gain: 0.12 });
    },
    hop() {
      tone({ freq: 250, glideTo: 400, type: 'sine', duration: 0.08, gain: 0.14 });
    },
    checkpoint() {
      tone({ freq: 500, type: 'triangle', duration: 0.1, gain: 0.2 });
      tone({ freq: 700, type: 'triangle', duration: 0.14, gain: 0.16, delay: 0.09 });
    },
    levelComplete() {
      [523, 659, 784, 1047].forEach((f, i) => {
        tone({ freq: f, type: 'triangle', duration: 0.22, gain: 0.22, delay: i * 0.1 });
      });
    },
    error() {
      tone({ freq: 300, glideTo: 120, type: 'sawtooth', duration: 0.3, gain: 0.2 });
      noiseBurst({ duration: 0.15, gain: 0.15, delay: 0.05, filterFreq: 900 });
    },
    glitch() {
      for (let i = 0; i < 5; i++) {
        tone({
          freq: 200 + Math.random() * 900,
          type: 'square',
          duration: 0.03,
          gain: 0.1,
          delay: i * 0.035
        });
      }
    },
    celebrate() {
      const notes = [523, 587, 659, 784, 880, 1047, 1175, 1319];
      notes.forEach((f, i) => {
        tone({ freq: f, type: 'triangle', duration: 0.28, gain: 0.2, delay: i * 0.09 });
      });
    },
    bump() {
      tone({ freq: 140, type: 'square', duration: 0.08, gain: 0.15 });
    },
    hit() {
      noiseBurst({ duration: 0.1, gain: 0.2, filterFreq: 1400 });
      tone({ freq: 200, glideTo: 80, type: 'sawtooth', duration: 0.12, gain: 0.15 });
    },
    secret() {
      [880, 1109, 1319, 1760].forEach((f, i) => {
        tone({ freq: f, type: 'square', duration: 0.1, gain: 0.14, delay: i * 0.07 });
      });
    }
  };
})();
