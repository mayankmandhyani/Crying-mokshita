/* ==========================================================================
   AUDIO.JS — Lightweight Web Audio synthesis, ported from the 2D game's
   approach. No external audio files needed, so nothing to swap in unless
   you want to replace these with real recorded sounds later (see README).
   ========================================================================== */

let ctx = null;
let masterGain = null;
let muted = false;

function ensureContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.55;
    masterGain.connect(ctx.destination);
  } catch (e) {
    console.warn('Web Audio unavailable:', e);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(val) {
  muted = val;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.55;
}
export function isMuted() { return muted; }

function tone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.25, glideTo = null, delay = 0 }) {
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

function noiseBurst({ duration = 0.15, gain = 0.2, delay = 0, filterFreq = 1600 }) {
  const c = ensureContext();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * duration));
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

export const SFX = {
  jump() { tone({ freq: 320, glideTo: 640, type: 'triangle', duration: 0.15, gain: 0.2 }); },
  land() { tone({ freq: 180, glideTo: 90, type: 'sine', duration: 0.1, gain: 0.16 }); },
  collect() {
    tone({ freq: 560, glideTo: 920, type: 'sine', duration: 0.1, gain: 0.24 });
    tone({ freq: 820, glideTo: 1250, type: 'sine', duration: 0.16, gain: 0.15, delay: 0.05 });
  },
  checkpoint() {
    tone({ freq: 500, type: 'triangle', duration: 0.1, gain: 0.18 });
    tone({ freq: 720, type: 'triangle', duration: 0.14, gain: 0.14, delay: 0.08 });
  },
  death() {
    noiseBurst({ duration: 0.1, gain: 0.18, filterFreq: 1200 });
    tone({ freq: 220, glideTo: 90, type: 'sawtooth', duration: 0.14, gain: 0.16 });
  },
  gate() {
    [440, 554, 659].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.2, gain: 0.18, delay: i * 0.08 }));
  },
  portalEnter() {
    for (let i = 0; i < 6; i++) {
      tone({ freq: 300 + Math.random() * 700, type: 'sine', duration: 0.12, gain: 0.1, delay: i * 0.06 });
    }
  },
  celebrate() {
    const notes = [523, 587, 659, 784, 880, 1047];
    notes.forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.26, gain: 0.18, delay: i * 0.09 }));
  },
  click() { tone({ freq: 440, type: 'square', duration: 0.05, gain: 0.1 }); },
};
