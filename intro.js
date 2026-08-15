// intro.js
// Skippable animated intro cutscene: the brother roasts Mokshita for
// having "no common sense," she gets increasingly annoyed then has a
// cartoonish crying-fit moment, and he sends her off on the quest.
// Runs once before Level 1, then transitions straight into gameplay.
//
// Self-contained: owns its own timeline of beats (speaker, pose, line,
// duration) and draws both characters directly via sprites.js, so it
// doesn't need to touch player.js/physics.js at all.

import { drawCharacter, drawBrother } from './sprites.js';

// Each beat: { speaker: 'bro'|'mok'|null, line: string, duration: s,
//              broPose, mokPose, mokExpression }
// duration is how long this beat displays before auto-advancing.
const BEATS = [
  { speaker: 'bro', line: "Yo. Mokshita. C'mere a sec.", duration: 1.6,
    broPose: 'wave', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'bro', line: "Real talk \u2014 you have ZERO common sense.", duration: 2.1,
    broPose: 'point', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'bro', line: "You once microwaved a fork \"to see what happens.\"", duration: 2.3,
    broPose: 'laugh', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'mok', line: "That was ONE time!", duration: 1.5,
    broPose: 'smug', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'bro', line: "So here's the deal, since you clearly need it \u2014", duration: 2.0,
    broPose: 'point', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'bro', line: "go collect some ACTUAL Common Sense. Three levels. Go.", duration: 2.4,
    broPose: 'point', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'bro', line: "I'll wait here. Calmly. Confident you'll fail.", duration: 2.2,
    broPose: 'smug', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'mok', line: "You are SO annoying \u2014", duration: 1.5,
    broPose: 'smug', mokPose: 'idle', mokExpression: 'angry-cry' },
  { speaker: null, line: "(Mokshita has an extremely dramatic, entirely justified meltdown.)", duration: 2.2,
    broPose: 'laugh', mokPose: 'cryfit', mokExpression: 'angry-cry' },
  { speaker: 'bro', line: "...okay that's a lot of tears for a fork joke.", duration: 2.0,
    broPose: 'shrug', mokPose: 'cryfit', mokExpression: 'angry-cry' },
  { speaker: 'mok', line: "FINE. I'll get so much common sense.", duration: 1.9,
    broPose: 'shrug', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'mok', line: "You won't even recognize me. Unbearably sensible.", duration: 2.3,
    broPose: 'smug', mokPose: 'idle', mokExpression: 'sad' },
  { speaker: 'bro', line: "Sure, sure. Go touch some platforms or whatever.", duration: 2.2,
    broPose: 'wave', mokPose: 'run-tease', mokExpression: 'sad' },
];

const SKIP_HOLD_TIME = 0; // tap-to-skip, no hold required

export class IntroScene {
  constructor(renderWidth, renderHeight) {
    this.renderWidth = renderWidth;
    this.renderHeight = renderHeight;
    this.beatIndex = 0;
    this.beatTime = 0;
    this.totalTime = 0;
    this.done = false;
    this.textRevealChars = 0;
    this._onDone = null;
  }

  onComplete(cb) {
    this._onDone = cb;
  }

  skip() {
    if (this.done) return;
    this.done = true;
    if (this._onDone) this._onDone();
  }

  update(dt) {
    if (this.done) return;
    this.beatTime += dt;
    this.totalTime += dt;

    const beat = BEATS[this.beatIndex];
    // Text types on at a readable pace; once fully revealed, the beat
    // still holds for its full duration so the line has time to land.
    const charsPerSecond = 38;
    this.textRevealChars = Math.min(beat.line.length, Math.floor(this.beatTime * charsPerSecond));

    if (this.beatTime >= beat.duration) {
      this.beatIndex++;
      this.beatTime = 0;
      this.textRevealChars = 0;
      if (this.beatIndex >= BEATS.length) {
        this.skip(); // triggers onComplete via the same path
      }
    }
  }

  draw(ctx) {
    if (this.done) return;
    const w = this.renderWidth, h = this.renderHeight;
    const beat = BEATS[Math.min(this.beatIndex, BEATS.length - 1)];

    // background: simple warm gradient (matches level 1's palette so
    // the transition into gameplay doesn't jar)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff9a56');
    grad.addColorStop(1, '#ffdca6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ground strip
    ctx.fillStyle = '#d9a55f';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.fillStyle = '#f4c98a';
    ctx.fillRect(0, h * 0.78, w, 6);

    const groundY = h * 0.78;
    const scale = Math.min(w, h) / 220; // keep characters a sensible size across viewport shapes

    // Mokshita on the left, brother on the right, facing each other.
    const mokX = w * 0.32;
    const broX = w * 0.68;

    ctx.save();
    ctx.translate(0, 0);
    ctx.scale(scale, scale);

    let mokPose = beat.mokPose;
    let mokFacing = 1;
    let mokDrawX = mokX / scale;
    if (mokPose === 'run-tease') {
      // she jogs off toward the right (toward the level start) during
      // the sign-off beats, matching "the quest begins" energy
      mokPose = 'run';
      const runOffset = Math.min(1, this.totalTime > 0 ? (this.beatTime / beat.duration) : 0);
      mokDrawX = (mokX + runOffset * w * 0.18) / scale;
    }

    drawCharacter(ctx, mokDrawX, groundY / scale, {
      facing: mokFacing,
      pose: mokPose,
      t: this.beatTime,
      expression: beat.mokExpression,
      squash: 0,
      vy: 0,
    });

    drawBrother(ctx, broX / scale, groundY / scale, {
      facing: -1,
      pose: beat.broPose,
      t: this.beatTime,
    });

    ctx.restore();

    // ---- dialogue box ----
    if (beat.speaker) {
      const boxH = Math.min(90, h * 0.22);
      const boxY = h - boxH - 14;
      const boxX = 14;
      const boxW = w - 28;

      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#1a1420';
      roundRectPath(ctx, boxX, boxY, boxW, boxH, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = beat.speaker === 'bro' ? '#8ec0da' : '#ffd97a';
      ctx.lineWidth = 2;
      roundRectPath(ctx, boxX, boxY, boxW, boxH, 12);
      ctx.stroke();

      ctx.fillStyle = beat.speaker === 'bro' ? '#8ec0da' : '#ffd97a';
      ctx.font = `bold ${Math.max(11, boxH * 0.16)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(beat.speaker === 'bro' ? 'BROTHER' : 'MOKSHITA', boxX + 16, boxY + boxH * 0.32);

      ctx.fillStyle = '#f5f0ea';
      ctx.font = `${Math.max(13, boxH * 0.19)}px sans-serif`;
      const revealedText = beat.line.slice(0, this.textRevealChars);
      wrapText(ctx, revealedText, boxX + 16, boxY + boxH * 0.62, boxW - 32, boxH * 0.26);
      ctx.restore();
    } else {
      // narration-style beat (no speaker box) -- small italic caption
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `italic ${Math.max(12, h * 0.03)}px sans-serif`;
      ctx.textAlign = 'center';
      const revealedText = beat.line.slice(0, this.textRevealChars);
      ctx.fillText(revealedText, w / 2, h - 40);
      ctx.restore();
    }

    // ---- skip button ----
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#000';
    roundRectPath(ctx, w - 90, 14, 76, 30, 15);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Skip \u25B6\u25B6', w - 52, 34);
    ctx.restore();
  }

  // hit-test for the skip button in render-space coordinates
  isSkipHit(x, y) {
    const w = this.renderWidth;
    return x >= w - 90 && x <= w - 14 && y >= 14 && y <= 44;
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, lineY);
      line = words[i] + ' ';
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, lineY);
}
