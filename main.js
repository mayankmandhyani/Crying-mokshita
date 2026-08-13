// main.js
// Game orchestration: rendering setup, explicit state machine, input
// handling (keyboard + touch), and the frame loop that ties physics,
// player, camera, level-builder and effects together.

import * as THREE from 'three';
import { Player } from './player.js';
import {
  GRAVITY, JUMP_VELOCITY, MAX_FALL_SPEED, DEATH_Y,
  resolveVertical, resolveHorizontal,
} from './physics.js';
import { buildLevel, updateMovingPlatforms, updateCollectibles, updateHazards, updateGateAnim } from './level-builder.js';
import { LEVELS, PALETTES, TOTAL_COMMON_SENSE } from './levels.js';
import { GameCamera } from './camera.js';
import { PickupBurst, DeathEffect, Confetti, PortalParticles } from './effects.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';

// ---------------- Explicit game states (spec section 22) ----------------
const STATE = {
  LOADING: 'LOADING',
  PLAYING: 'PLAYING',
  DYING: 'DYING',
  RESPAWNING: 'RESPAWNING',
  TRANSITIONING: 'TRANSITIONING',
  ENDING: 'ENDING',
};

const MOVE_SPEED = 6.2; // matches HORIZONTAL_SPEED used in validate-levels.mjs
const ACCEL = 34;
const DECEL = 26;
const TURN_LERP = 10;

class Game {
  constructor() {
    this.ui = new UI();
    this.audio = new AudioSystem();
    this.state = STATE.LOADING;

    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this.currentLevelIndex = 0;
    this.totalCollected = 0;
    this.levelCollected = 0; // collected within current level (for HUD-local logic if needed)

    this.velocity = new THREE.Vector3(0, 0, 0);
    this.playerPos = new THREE.Vector3(0, 1, 0);
    this.grounded = false;
    this.activeCheckpoint = null; // {x,y,z}

    this.input = { forward: 0, right: 0, jump: false, jumpPressed: false };
    this.touchInput = { active: false, x: 0, y: 0 };

    this._transitionLock = false; // prevents overlapping transitions (spec 22)

    this._initRenderer();
    this._initScene();
    this._initInput();

    this.player = new Player();
    this.scene.add(this.player.group);

    this.pickupBurst = new PickupBurst(this.scene);
    this.deathEffect = new DeathEffect(this.scene);
    this.confetti = new Confetti(this.scene);
    this.portalParticles = null;

    this.built = null; // current BuiltLevel

    this.ui.setTotalCommonSense(TOTAL_COMMON_SENSE);

    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    this._boot();
  }

  // ---------------- Setup ----------------

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.gameCamera = new GameCamera(window.innerWidth / window.innerHeight);

    // Lighting: warm key light + soft fill + ambient. Kept lightweight
    // (one shadow-casting light) for mobile performance (spec 20).
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(6, 12, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 14;
    this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.bias = -0.0025;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambient);

    this.fillLight = new THREE.DirectionalLight(0xaac8ff, 0.35);
    this.fillLight.position.set(-6, 5, -4);
    this.scene.add(this.fillLight);
  }

  _initInput() {
    const keyMap = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      Space: 'jump',
    };
    this._keys = {};

    window.addEventListener('keydown', (e) => {
      this.audio.resume();
      const mapped = keyMap[e.code];
      if (!mapped) return;
      if (mapped === 'jump' && !this._keys.jump) this.input.jumpPressed = true;
      this._keys[mapped] = true;
      if (mapped === 'jump') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const mapped = keyMap[e.code];
      if (!mapped) return;
      this._keys[mapped] = false;
    });

    // Touch: joystick + jump button
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) this.ui.showMobileControls(true);

    const joystickZone = document.getElementById('joystick-zone');
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    let joyTouchId = null;
    let baseRect = null;
    const maxKnob = 34;

    const startJoy = (touch) => {
      this.audio.resume();
      baseRect = joystickBase.getBoundingClientRect();
      joyTouchId = touch.identifier;
      updateJoy(touch);
    };
    const updateJoy = (touch) => {
      const cx = baseRect.left + baseRect.width / 2;
      const cy = baseRect.top + baseRect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const dist = Math.min(Math.hypot(dx, dy), maxKnob);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * dist;
      const ky = Math.sin(angle) * dist;
      joystickKnob.style.transform = `translate(${kx}px, ${ky}px)`;
      this.touchInput.active = true;
      this.touchInput.x = kx / maxKnob;
      this.touchInput.y = ky / maxKnob;
    };
    const endJoy = () => {
      joyTouchId = null;
      joystickKnob.style.transform = 'translate(0px, 0px)';
      this.touchInput.active = false;
      this.touchInput.x = 0;
      this.touchInput.y = 0;
    };

    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (joyTouchId !== null) return;
      startJoy(e.changedTouches[0]);
    }, { passive: false });
    joystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) updateJoy(t);
      }
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) endJoy();
      }
    });
    window.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) endJoy();
      }
    });

    const jumpBtn = document.getElementById('jump-btn');
    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.audio.resume();
      this.input.jumpPressed = true;
      this._touchJumpHeld = true;
    }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._touchJumpHeld = false;
    }, { passive: false });
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.gameCamera.setAspect(w / h);
  }

  // ---------------- Boot / level loading ----------------

  async _boot() {
    // simulate brief structured loading (asset/texture prep already
    // happened synchronously in constructors; this also guarantees the
    // loading bar is visible for a beat rather than flashing).
    for (let i = 0; i <= 5; i++) {
      this.ui.setLoadingProgress(i / 5);
      await this._wait(70);
    }
    this.ui.hideLoadingScreen();

    await this._loadLevel(0, { showIntro: true, fade: false });
    this.state = STATE.PLAYING;
    this._loop();
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _loadLevel(index, { showIntro = true, fade = true } = {}) {
    // Guard against overlapping transitions (spec 22/23)
    if (this._transitionLock) return;
    this._transitionLock = true;
    const prevState = this.state;
    this.state = STATE.TRANSITIONING;

    try {
      if (fade) await this.ui.fadeToBlack(450);

      // tear down old level
      if (this.built) {
        this.levelGroup.remove(this.built.scene);
        this._disposeGroup(this.built.scene);
        this.built = null;
      }
      if (this.portalParticles) {
        this.scene.remove(this.portalParticles.group);
        this.portalParticles = null;
      }

      const levelDef = LEVELS[index];
      const paletteKey = `level${levelDef.id}`;
      const palette = PALETTES[paletteKey];

      this.built = buildLevel(levelDef, palette);
      this.levelGroup.add(this.built.scene);
      this._applyEnvironment(palette);

      // position player at spawn
      const spawn = levelDef.spawn;
      this.playerPos.set(spawn.x, spawn.y, spawn.z);
      this.velocity.set(0, 0, 0);
      this.grounded = false;
      this.activeCheckpoint = { x: spawn.x, y: spawn.y, z: spawn.z };
      this.player.setPosition(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.player.snapFacing(Math.PI); // face away from camera (into -Z, deeper into level)
      this.player.setState('idle');

      this.currentLevelIndex = index;
      this.ui.setLevelLabel(levelDef.id);

      // reset per-level collectible tracking (total persists across levels)
      this.levelCollected = 0;

      // portal particle ring if this level has a final portal
      if (this.built.portalMesh) {
        this.portalParticles = new PortalParticles(this.scene, this.built.portalMesh.userData.worldPos, palette.portalRing);
      }

      // snap camera instantly to avoid a swooping camera on load (spec 6/23)
      this.gameCamera.snapTo(this.playerPos, this.player.facingAngle);

      if (fade) await this.ui.fadeFromBlack(450);

      if (showIntro) {
        this.ui.showLevelIntro(levelDef.id, levelDef.title);
      }

      this.state = STATE.PLAYING;
    } catch (err) {
      // Fail visibly and recoverably rather than leaving a permanent
      // black screen (spec 23).
      console.error('Level load failed:', err);
      this.ui.forceFadeCleared();
      this.state = STATE.PLAYING;
    } finally {
      this._transitionLock = false;
    }
  }

  _applyEnvironment(palette) {
    this.scene.background = new THREE.Color(palette.sky[0]);
    this.scene.fog = new THREE.Fog(palette.fog, 18, 46);
    this.sun.color.set(0xffffff);
    this.ambient.color.set(palette.sky[1]);
  }

  _disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  // ---------------- Frame loop ----------------

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this.clock.getDelta(), 1 / 15); // clamp to avoid physics tunnelling on large stalls, but permissive enough for slow devices/tab-switch recovery
    this.elapsed += dt;

    if (this.state === STATE.PLAYING) {
      this._updatePlaying(dt);
    } else if (this.state === STATE.DYING) {
      this._updateDying(dt);
    } else if (this.state === STATE.ENDING) {
      this._updateEnding(dt);
    }

    // Always update ambient effects/animations regardless of state so
    // transitions/ending don't look frozen.
    if (this.built) {
      updateMovingPlatforms(this.built, dt, this.elapsed);
      updateCollectibles(this.built, dt, this.elapsed);
      updateHazards(this.built, dt, this.elapsed);
      updateGateAnim(this.built.gateMesh, dt, this.elapsed);
      updateGateAnim(this.built.portalMesh, dt, this.elapsed);
    }
    if (this.portalParticles) this.portalParticles.update(dt, this.elapsed);
    this.pickupBurst.update(dt);
    this.deathEffect.update(dt);
    this.confetti.update(dt);

    this.renderer.render(this.scene, this.gameCamera.camera);

    // consume one-shot input flags at end of frame
    this.input.jumpPressed = false;
  }

  _readMoveAxes() {
    let x = 0, z = 0;
    if (this._keys.left) x -= 1;
    if (this._keys.right) x += 1;
    if (this._keys.forward) z -= 1;
    if (this._keys.back) z += 1;

    if (this.touchInput.active) {
      x = this.touchInput.x;
      z = this.touchInput.y; // joystick down = +y = move toward camera (+z is back, matches keyboard 's')
    }

    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  _updatePlaying(dt) {
    const axes = this._readMoveAxes();
    const wantJump = this.input.jumpPressed || (this._touchJumpHeld && false); // touch jump is edge-triggered via jumpPressed already

    // Horizontal target velocity
    const targetVX = axes.x * MOVE_SPEED;
    const targetVZ = axes.z * MOVE_SPEED;
    const moving = Math.hypot(axes.x, axes.z) > 0.05;

    const accel = moving ? ACCEL : DECEL;
    this.velocity.x += (targetVX - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (targetVZ - this.velocity.z) * Math.min(1, accel * dt);

    if (!moving && Math.hypot(this.velocity.x, this.velocity.z) < 0.05) {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Jump
    if (wantJump && this.grounded) {
      this.velocity.y = JUMP_VELOCITY;
      this.grounded = false;
      this.player.setState('jump');
      this.audio.jump();
    }

    // Gravity
    this.velocity.y += GRAVITY * dt;
    if (this.velocity.y < MAX_FALL_SPEED) this.velocity.y = MAX_FALL_SPEED;

    // Resolve horizontal against platforms (walls/edges at player height)
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    const hRes = resolveHorizontal(this.playerPos.x, this.playerPos.y, this.playerPos.z, dx, dz, this.built.platforms);
    this.playerPos.x = hRes.x;
    this.playerPos.z = hRes.z;

    // Resolve vertical against platforms (landing / ceiling bump)
    const wasGrounded = this.grounded;
    const vRes = resolveVertical(this.playerPos.x, this.playerPos.y, this.playerPos.z, this.velocity.y, dt, this.built.platforms);
    this.playerPos.y = vRes.y;
    this.velocity.y = vRes.velY;
    this.grounded = vRes.grounded;

    // If standing on a moving platform, carry the player with it
    if (this.grounded && vRes.groundedPlatform && vRes.groundedPlatform.prevX !== undefined) {
      const plat = vRes.groundedPlatform;
      this.playerPos.x += plat.x - plat.prevX;
      this.playerPos.z += plat.z - plat.prevZ;
    }

    if (!wasGrounded && this.grounded) {
      this.player.setState('land');
      this.audio.land();
    } else if (this.grounded && this.player.animState !== 'land') {
      this.player.setState(moving ? 'run' : 'idle');
    } else if (!this.grounded) {
      if (this.velocity.y > 0.5) {
        if (this.player.animState !== 'jump') this.player.setState('jump');
      } else if (this.player.animState !== 'jump' || this.velocity.y < -1) {
        this.player.setState('fall');
      }
    }

    // Face movement direction
    if (moving) {
      const angle = Math.atan2(axes.x, -axes.z); // -z is "forward" (into level)
      this.player.setFacing(angle + 0);
    }

    this.player.setPosition(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.player.update(dt, Math.hypot(this.velocity.x, this.velocity.z) / MOVE_SPEED, this.grounded);

    // fade contact shadow with height above ground (cheap grounding cue)
    if (this.built) {
      let heightAbove = 0;
      if (vRes.groundedPlatform) heightAbove = 0;
      else heightAbove = Math.max(0, this._estimateHeightAboveNearestPlatform());
      this.player.contactShadow.material.opacity = Math.max(0.05, 0.3 - heightAbove * 0.04);
    }

    // Death by falling into void
    if (this.playerPos.y < DEATH_Y) {
      this._die();
      return;
    }

    // Hazard collision (simple radius/box check against player XZ + feet height)
    if (this._checkHazardCollision()) {
      this._die();
      return;
    }

    // Collectibles
    this._checkCollectibles();

    // Checkpoints
    this._checkCheckpoints();

    // Gate / portal triggers
    this._checkGateAndPortal();

    // Camera
    this.gameCamera.update(dt, this.playerPos, axes.z !== 0 ? axes.z : (moving ? -1 : 0));
  }

  _estimateHeightAboveNearestPlatform() {
    let minGap = 99;
    for (const p of this.built.platforms) {
      const dx = Math.abs(this.playerPos.x - p.x);
      const dz = Math.abs(this.playerPos.z - p.z);
      if (dx < p.w / 2 + 0.5 && dz < p.d / 2 + 0.5) {
        const top = p.y + p.h / 2;
        const gap = this.playerPos.y - top;
        if (gap >= -0.05 && gap < minGap) minGap = gap;
      }
    }
    return minGap === 99 ? 0 : minGap;
  }

  _checkHazardCollision() {
    const px = this.playerPos.x, pz = this.playerPos.z, py = this.playerPos.y;
    for (const hz of this.built.hazardMeshes) {
      const d = hz.data;
      const dx = Math.abs(px - d.x);
      const dz = Math.abs(pz - d.z);
      if (dx < d.w / 2 + 0.15 && dz < d.d / 2 + 0.15) {
        // hazard only kills if player is near hazard height (falling into the gap)
        if (py < d.y + 0.6 && py > d.y - 2.5) {
          return true;
        }
      }
    }
    return false;
  }

  _checkCollectibles() {
    for (const mesh of this.built.collectibleMeshes) {
      if (mesh.userData.collected) continue;
      const dx = this.playerPos.x - mesh.position.x;
      const dz = this.playerPos.z - mesh.position.z;
      // Vertical check uses the player's full standing height range
      // (feet to head) rather than a single fixed offset, since
      // collectibles are placed at varying heights above their
      // platform (waist to head height) -- a fixed offset created
      // dead zones where a player standing directly under a
      // collectible still couldn't trigger the pickup.
      const playerFeet = this.playerPos.y;
      const playerHead = this.playerPos.y + 1.75;
      const dy = mesh.position.y < playerFeet
        ? playerFeet - mesh.position.y
        : (mesh.position.y > playerHead ? mesh.position.y - playerHead : 0);
      const horizontalDistSq = dx * dx + dz * dz;
      const distSq = horizontalDistSq + dy * dy;
      if (distSq < 0.95 * 0.95) {
        mesh.userData.collected = true;
        mesh.visible = false;
        this.totalCollected++;
        this.levelCollected++;
        this.ui.setCommonSenseCount(this.totalCollected);
        this.pickupBurst.spawn(mesh.position, 0xffe27a);
        this.audio.pickup();
      }
    }
  }

  _checkCheckpoints() {
    for (const cpMesh of this.built.checkpointMeshes) {
      if (cpMesh.userData.activated) continue;
      const dx = this.playerPos.x - cpMesh.position.x;
      const dz = this.playerPos.z - cpMesh.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 1.3 * 1.3) {
        cpMesh.userData.activated = true;
        cpMesh.userData.flag.material.color.set(PALETTES[`level${LEVELS[this.currentLevelIndex].id}`].checkpointOn);
        cpMesh.userData.flag.material.emissive.set(PALETTES[`level${LEVELS[this.currentLevelIndex].id}`].checkpointOn);
        cpMesh.userData.flag.material.emissiveIntensity = 0.6;
        cpMesh.userData.glow.material.color.set(PALETTES[`level${LEVELS[this.currentLevelIndex].id}`].checkpointOn);
        cpMesh.userData.glow.material.emissive.set(PALETTES[`level${LEVELS[this.currentLevelIndex].id}`].checkpointOn);

        this.activeCheckpoint = { x: cpMesh.position.x, y: cpMesh.position.y, z: cpMesh.position.z + 0.3 };
        this.audio.checkpoint();
      }
    }
  }

  _checkGateAndPortal() {
    if (this.built.gateMesh) {
      const g = this.built.gateMesh;
      const dx = this.playerPos.x - g.position.x;
      const dz = this.playerPos.z - g.position.z;
      if (Math.hypot(dx, dz) < g.userData.triggerRadius) {
        this.audio.gate();
        this._advanceLevel();
        return;
      }
    }
    if (this.built.portalMesh) {
      const p = this.built.portalMesh;
      const dx = this.playerPos.x - p.position.x;
      const dz = this.playerPos.z - p.position.z;
      if (Math.hypot(dx, dz) < p.userData.triggerRadius) {
        this.audio.portal();
        this._beginEnding();
      }
    }
  }

  async _advanceLevel() {
    if (this._transitionLock) return;
    const nextIndex = this.currentLevelIndex + 1;
    if (nextIndex >= LEVELS.length) return; // shouldn't happen (portal handles final)
    await this._loadLevel(nextIndex, { showIntro: true, fade: true });
  }

  // ---------------- Death / respawn ----------------

  _die() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.DYING;
    this.velocity.set(0, 0, 0);
    this.player.setState('dead');
    this._deathTimer = 0;
    this.deathEffect.spawn(new THREE.Vector3(this.playerPos.x, Math.max(this.playerPos.y, 0.3), this.playerPos.z));
    this.audio.death();
  }

  _updateDying(dt) {
    this._deathTimer += dt;
    // small flop animation: rotate rig down
    const t = Math.min(1, this._deathTimer / 0.35);
    this.player.rig.rotation.z = t * 1.4;
    this.player.rig.position.y = -t * 0.3;

    if (this._deathTimer > 0.7) {
      this._respawn();
    }
  }

  _respawn() {
    this.state = STATE.RESPAWNING;
    this.player.rig.rotation.z = 0;
    this.player.rig.position.y = 0;

    const cp = this.activeCheckpoint;
    this.playerPos.set(cp.x, cp.y, cp.z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.player.setPosition(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.player.snapFacing(Math.PI); // avoid stuck mid-turn on respawn
    this.player.setState('idle');

    this.gameCamera.snapTo(this.playerPos, this.player.facingAngle);

    this.state = STATE.PLAYING;
  }

  // ---------------- Ending ----------------

  async _beginEnding() {
    if (this.state === STATE.ENDING) return;
    this.state = STATE.ENDING;
    this._endingTimer = 0;
    this._endingPhase = 'zoom';
    this.velocity.set(0, 0, 0);
    this.player.setState('celebrate');
    this.player.setFace(true);
  }

  _updateEnding(dt) {
    this._endingTimer += dt;

    if (this._endingPhase === 'zoom') {
      // camera slowly pushes in on the player near the portal
      const portalPos = this.built.portalMesh.userData.worldPos;
      const t = Math.min(1, this._endingTimer / 1.2);
      const camPos = new THREE.Vector3(
        this.playerPos.x + Math.sin(this._endingTimer * 0.6) * 0.3,
        this.playerPos.y + 2.2 - t * 0.4,
        this.playerPos.z + 3.6 - t * 1.2
      );
      this.gameCamera.currentPos.lerp(camPos, 0.06);
      this.gameCamera.camera.position.copy(this.gameCamera.currentPos);
      this.gameCamera.currentLookAt.lerp(new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z), 0.08);
      this.gameCamera.camera.lookAt(this.gameCamera.currentLookAt);

      this.player.setPosition(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.player.update(dt, 0, true);

      if (this._endingTimer > 1.3) {
        this._endingPhase = 'confetti';
        this._endingTimer = 0;
        const burstOrigin = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z);
        this.confetti.burst(burstOrigin, 150);
        this.audio.celebrate();
        this.ui.runEndingSequence(() => this._restartGame());
      }
    } else if (this._endingPhase === 'confetti') {
      this.player.setPosition(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.player.update(dt, 0, true);
      // keep spawning light confetti bursts for a while for a celebratory feel
      if (Math.floor(this._endingTimer * 2) % 2 === 0 && Math.random() < 0.04) {
        const origin = new THREE.Vector3(this.playerPos.x + (Math.random() - 0.5) * 2, this.playerPos.y + 3, this.playerPos.z);
        this.confetti.burst(origin, 20);
      }
    }
  }

  async _restartGame() {
    if (this._transitionLock) return;
    this.ui.resetEndingScreen();
    this.confetti.clear();
    this.totalCollected = 0;
    this.ui.setCommonSenseCount(0);
    this.player.setFace(false);
    await this._loadLevel(0, { showIntro: true, fade: true });
  }
}

const __game = new Game();
window.__game = __game;
