// main.js
// Game orchestration: canvas setup with fixed internal render
// resolution (scaled to fit the device, pixelated for a crisp retro
// look), explicit game state machine, keyboard + touch input, and the
// frame loop tying physics/player/level/camera/effects together.

import { Player } from './player.js';
import { drawCharacter, drawCollectible } from './sprites.js';
import {
  BuiltLevel, drawBackground, drawDecorations, drawGround, drawHazards,
  drawCheckpoints, drawCollectibleMarkers, drawGate, drawPortal,
} from './level-builder.js';
import { LEVELS, PALETTES, TOTAL_COMMON_SENSE } from './levels.js';
import { Camera2D } from './camera.js';
import { ParticleSystem, Confetti } from './effects.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { DEATH_Y } from './physics.js';

const RENDER_WIDTH = 480; // logical horizontal resolution (fixed reference)
const MIN_RENDER_HEIGHT = 220; // never show less vertical world than this
const MAX_RENDER_HEIGHT = 340; // never show more than this (keeps camera framing sane)

const STATE = {
  LOADING: 'LOADING',
  PLAYING: 'PLAYING',
  DYING: 'DYING',
  RESPAWNING: 'RESPAWNING',
  TRANSITIONING: 'TRANSITIONING',
  ENDING: 'ENDING',
};

class Game {
  constructor() {
    this.ui = new UI();
    this.audio = new AudioSystem();
    this.state = STATE.LOADING;

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.lastTime = performance.now();
    this.elapsed = 0;

    this.currentLevelIndex = 0;
    this.totalCollected = 0;
    this.activeCheckpoint = null;

    this.input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

    this._transitionLock = false;

    this.camera = new Camera2D(RENDER_WIDTH, 280); // placeholder height; corrected by _onResize below
    this.particles = new ParticleSystem();
    this.confetti = new Confetti();

    this.player = new Player(40, 480);
    this.player.onJump = () => this.audio.jump();
    this.player.onLand = () => {
      this.audio.land();
      this.camera.shake(2);
    };

    this.built = null;

    this._initInput();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());

    this.ui.setTotalCommonSense(TOTAL_COMMON_SENSE);

    this._boot();
  }

  // ---------------- Setup ----------------

  _onResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = window.innerWidth;
    const availH = window.innerHeight;

    // Derive the internal vertical resolution from the actual viewport
    // aspect ratio so the canvas fills the screen with no letterboxing,
    // while clamping so extreme aspect ratios (very tall phones, very
    // wide desktops) don't break level framing.
    const aspect = availH / availW;
    let renderHeight = Math.round(RENDER_WIDTH * aspect);
    renderHeight = Math.max(MIN_RENDER_HEIGHT, Math.min(MAX_RENDER_HEIGHT, renderHeight));

    this.renderWidth = RENDER_WIDTH;
    this.renderHeight = renderHeight;

    const scale = Math.min(availW / RENDER_WIDTH, availH / renderHeight);
    const cssW = RENDER_WIDTH * scale;
    const cssH = renderHeight * scale;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = RENDER_WIDTH * dpr;
    this.canvas.height = renderHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    if (this.camera) {
      this.camera.viewH = renderHeight;
      if (this.built) this.camera.snapTo(this.player.x, this.player.y, this.built.levelWidth, this.built.groundY);
    }
  }

  _initInput() {
    const keyMap = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' };
    window.addEventListener('keydown', (e) => {
      this.audio.resume();
      const mapped = keyMap[e.code];
      if (!mapped) return;
      if (mapped === 'left') this.input.left = true;
      else if (mapped === 'right') this.input.right = true;
      else if (mapped === 'jump') {
        if (!this.input.jumpHeld) this.input.jumpPressed = true;
        this.input.jumpHeld = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const mapped = keyMap[e.code];
      if (!mapped) return;
      if (mapped === 'left') this.input.left = false;
      else if (mapped === 'right') this.input.right = false;
      else if (mapped === 'jump') this.input.jumpHeld = false;
    });

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) this.ui.showMobileControls(true);

    const bind = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.audio.resume(); onDown(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
      el.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); this.audio.resume(); onDown(); });
      window.addEventListener('mouseup', () => onUp());
    };
    bind('btn-left', () => { this.input.left = true; }, () => { this.input.left = false; });
    bind('btn-right', () => { this.input.right = true; }, () => { this.input.right = false; });
    bind('btn-jump', () => {
      if (!this.input.jumpHeld) this.input.jumpPressed = true;
      this.input.jumpHeld = true;
    }, () => { this.input.jumpHeld = false; });
  }

  // ---------------- Boot / level loading ----------------

  async _boot() {
    for (let i = 0; i <= 5; i++) {
      this.ui.setLoadingProgress(i / 5);
      await this._wait(60);
    }
    this.ui.hideLoadingScreen();
    await this._loadLevel(0, { showIntro: true, fade: false });
    this.state = STATE.PLAYING;
    this.lastTime = performance.now();
    this._loop();
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _loadLevel(index, { showIntro = true, fade = true } = {}) {
    if (this._transitionLock) return;
    this._transitionLock = true;
    this.state = STATE.TRANSITIONING;

    try {
      if (fade) await this.ui.fadeToBlack(400);

      const levelDef = LEVELS[index];
      const palette = PALETTES[`level${levelDef.id}`];
      this.built = new BuiltLevel(levelDef, palette);

      const spawn = levelDef.spawn;
      this.player.teleport(spawn.x, spawn.y);
      this.player.facing = 1;
      this.activeCheckpoint = { x: spawn.x, y: spawn.y };

      this.currentLevelIndex = index;
      this.ui.setLevelLabel(levelDef.id);

      this.camera.snapTo(this.player.x, this.player.y, this.built.levelWidth, this.built.groundY);

      if (fade) await this.ui.fadeFromBlack(400);
      if (showIntro) this.ui.showLevelIntro(levelDef.id, levelDef.title);

      this.state = STATE.PLAYING;
    } catch (err) {
      console.error('Level load failed:', err);
      this.ui.forceFadeCleared();
      this.state = STATE.PLAYING;
    } finally {
      this._transitionLock = false;
    }
  }

  // ---------------- Frame loop ----------------

  _loop() {
    requestAnimationFrame(() => this._loop());
    if (this._paused) return;
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 1 / 15);
    this.elapsed += dt;

    if (this.state === STATE.PLAYING) this._updatePlaying(dt);
    else if (this.state === STATE.DYING) this._updateDying(dt);
    else if (this.state === STATE.ENDING) this._updateEnding(dt);

    if (this.built) this.built.updateMovingPlatforms(dt, this.elapsed);
    this.particles.update(dt);
    this.confetti.update(dt);

    this._render();

    this.input.jumpPressed = false;
  }

  _updatePlaying(dt) {
    if (this.input.jumpPressed) this.player.requestJump();

    this.player.update(dt, this.input, this.built.platforms);

    if (this.player.y - this.built.groundY > DEATH_Y) {
      this._die();
      return;
    }

    if (this._checkHazardCollision()) {
      this._die();
      return;
    }

    this._checkCollectibles();
    this._checkCheckpoints();
    this._checkGateAndPortal();

    this.camera.update(dt, this.player.x, this.player.y, this.player.facing, this.built.levelWidth, this.built.groundY);
  }

  _checkHazardCollision() {
    const px = this.player.x;
    const py = this.player.y;
    for (const hz of this.built.hazards) {
      const withinX = px + 10 > hz.x && px - 10 < hz.x + hz.w;
      if (!withinX) continue;
      // Hazards are placed (see levels.js) at least 50px below BOTH
      // adjacent platforms' surfaces, specifically so no valid jump arc
      // between those platforms can ever reach the hazard's trigger
      // height while still airborne toward a safe landing -- reaching
      // this height within the hazard's x-span means the player has
      // genuinely fallen into the gap.
      if (py >= hz.y) return true;
    }
    return false;
  }

  _checkCollectibles() {
    for (const c of this.built.collectibles) {
      if (c.collected) continue;
      const dx = this.player.x - c.x;
      const playerFeet = this.player.y;
      const playerHead = this.player.y - 30;
      const dy = c.y < playerHead ? playerHead - c.y : (c.y > playerFeet ? c.y - playerFeet : 0);
      const distSq = dx * dx + dy * dy;
      if (distSq < 26 * 26) {
        c.collected = true;
        this.totalCollected++;
        this.ui.setCommonSenseCount(this.totalCollected);
        this.particles.spawnBurst(c.x, c.y, { color: '#ffe27a', count: 12, speed: 130 });
        this.audio.pickup();
      }
    }
  }

  _checkCheckpoints() {
    for (const cp of this.built.checkpoints) {
      if (cp.activated) continue;
      const dx = this.player.x - cp.x;
      if (Math.abs(dx) < 20 && Math.abs(this.player.y - cp.y) < 10) {
        cp.activated = true;
        this.activeCheckpoint = { x: cp.x, y: cp.y };
        this.audio.checkpoint();
        this.particles.spawnBurst(cp.x, cp.y - 40, { color: this.built.palette.checkpointOn, count: 10, speed: 90 });
      }
    }
  }

  _checkGateAndPortal() {
    if (this.built.gate) {
      const dx = this.player.x - this.built.gate.x;
      if (Math.abs(dx) < 26) {
        this.audio.gate();
        this._advanceLevel();
        return;
      }
    }
    if (this.built.portal) {
      const dx = this.player.x - this.built.portal.x;
      if (Math.abs(dx) < 26) {
        this.audio.portal();
        this._beginEnding();
      }
    }
  }

  async _advanceLevel() {
    if (this._transitionLock) return;
    const next = this.currentLevelIndex + 1;
    if (next >= LEVELS.length) return;
    await this._loadLevel(next, { showIntro: true, fade: true });
  }

  // ---------------- Death / respawn ----------------

  _die() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.DYING;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.setAnim('dead');
    this.player.deathTime = 0;
    this.particles.spawnBurst(this.player.x, this.player.y - 15, { color: '#ff5a3d', count: 16, speed: 180, size: 3.5 });
    this.audio.death();
    this.camera.shake(4);
  }

  _updateDying(dt) {
    this.player.deathTime += dt;
    this.player.animTime = this.player.deathTime;
    if (this.player.deathTime > 0.6) this._respawn();
  }

  _respawn() {
    this.state = STATE.RESPAWNING;
    const cp = this.activeCheckpoint;
    this.player.teleport(cp.x, cp.y);
    this.camera.snapTo(this.player.x, this.player.y, this.built.levelWidth, this.built.groundY);
    this.state = STATE.PLAYING;
  }

  // ---------------- Ending ----------------

  _beginEnding() {
    if (this.state === STATE.ENDING) return;
    this.state = STATE.ENDING;
    this._endingTimer = 0;
    this._endingPhase = 'zoom';
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.setAnim('celebrate');
    this.player.expression = 'happy';
  }

  _updateEnding(dt) {
    this._endingTimer += dt;
    this.player.animTime += dt;

    if (this._endingPhase === 'zoom') {
      if (this._endingTimer > 1.1) {
        this._endingPhase = 'confetti';
        this._endingTimer = 0;
        this.audio.celebrate();
        this.ui.runEndingSequence(() => this._restartGame());
      }
    } else if (this._endingPhase === 'confetti') {
      if (Math.random() < 0.06) {
        this.confetti.burst(this.renderWidth / 2, this.renderHeight * 0.3, 18);
      }
    }
  }

  async _restartGame() {
    if (this._transitionLock) return;
    this.ui.resetEndingScreen();
    this.confetti.clear();
    this.totalCollected = 0;
    this.ui.setCommonSenseCount(0);
    this.player.expression = 'sad';
    await this._loadLevel(0, { showIntro: true, fade: true });
  }

  // ---------------- Rendering ----------------

  _render() {
    const ctx = this.ctx;
    const w = this.renderWidth, h = this.renderHeight;

    if (!this.built) {
      ctx.fillStyle = '#0a0812';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const shake = this.camera.applyShake(1 / 60);
    const camX = this.camera.x + shake.x;
    const camY = this.camera.y;

    const palette = this.built.palette;
    drawBackground(ctx, w, h, palette, camX, this.elapsed);

    ctx.save();
    ctx.translate(0, -camY);

    drawDecorations(ctx, this.built.decorations, camX, w, this.elapsed, palette);
    drawGround(ctx, this.built, palette, camX, w, h);
    drawHazards(ctx, this.built.hazards, palette, camX, w, this.elapsed);
    drawCheckpoints(ctx, this.built.checkpoints, palette, camX, w, this.elapsed);
    drawCollectibleMarkers(ctx, this.built.collectibles, camX, w, this.elapsed, drawCollectible);
    drawGate(ctx, this.built.gate, palette, camX, w, this.elapsed);
    drawPortal(ctx, this.built.portal, palette, camX, w, this.elapsed);

    const screenX = this.player.x - camX;
    const screenY = this.player.y + shake.y;
    if (this.state !== STATE.DYING || this.player.deathTime < 0.6) {
      drawCharacter(ctx, screenX, screenY, {
        facing: this.player.facing,
        pose: this.player.animState,
        t: this.player.animTime,
        expression: this.player.expression,
        squash: this.player.landSquash,
      });
    }

    this.particles.draw(ctx, camX);

    ctx.restore();

    if (this.confetti.pieces.length > 0) this.confetti.draw(ctx);
  }
}

window.__game = new Game();
