/* ==========================================================================
   MAIN.JS — Entry point. Scene/renderer setup, input handling, level
   lifecycle (load/build/dispose), checkpoint + respawn flow, HUD updates,
   gate/portal triggers, and the final ending sequence.
   ========================================================================== */

import * as THREE from "three";
import { createCharacter, CharacterAnimator } from "./character.js";
import { PlayerController } from "./player-controller.js";
import { LEVELS, getTotalCollectibles } from "./levels.js";
import { LevelBuilder } from "./level-builder.js";
import { CameraController } from "./camera-controller.js";
import { SFX, unlockAudio, setMuted, isMuted } from "./audio.js";

// -------------------- Renderer / scene / camera --------------------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 150);

const hemi = new THREE.HemisphereLight(0xffffff, 0x554466, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
sun.shadow.camera.far = 40;
scene.add(sun);
scene.add(sun.target);

const cameraController = new CameraController(camera);

// -------------------- Character / player --------------------
const character = createCharacter();
character.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
scene.add(character);
const animator = new CharacterAnimator(character);
const player = new PlayerController(character, animator);

// -------------------- Level state --------------------
const levelBuilder = new LevelBuilder(scene);
let currentLevelIndex = 0;
let currentLevel = null;
let colliders = [];
let elapsed = 0;
let running = false;
let paused = false;

let totalCommonSense = 0;         // running total across the whole game, shown in the HUD
const TOTAL_COMMON_SENSE = getTotalCollectibles();

let deathTimer = 0;
let gateTransitionActive = false;
let portalSequenceActive = false;

// -------------------- Input --------------------
const keys = {};
const input = { moveX: 0, moveZ: 0, jumpPressed: false, running: false };
let jumpHeld = false;

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    if (!jumpHeld) input.jumpPressed = true;
    jumpHeld = true;
  }
  if (e.code === 'Escape') togglePause();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) jumpHeld = false;
});

function readKeyboardInput() {
  const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const z = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  input.moveX = x;
  input.moveZ = -z; // forward (W/Up) should move toward +Z in level space (away from spawn)
  input.running = !!(keys.ShiftLeft || keys.ShiftRight);
}

// ---- Mobile virtual joystick ----
const stickZone = document.getElementById('move-stick');
const stickKnob = document.getElementById('stick-knob');
let stickActive = false;
let stickVec = { x: 0, y: 0 };
const STICK_MAX = 34;

function stickPointerStart(e) {
  stickActive = true;
  updateStick(e);
}
function stickPointerMove(e) {
  if (!stickActive) return;
  updateStick(e);
}
function stickPointerEnd() {
  stickActive = false;
  stickVec = { x: 0, y: 0 };
  stickKnob.style.left = '34px';
  stickKnob.style.top = '34px';
}
function updateStick(e) {
  const rect = stickZone.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.min(STICK_MAX, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  stickKnob.style.left = (34 + dx) + 'px';
  stickKnob.style.top = (34 + dy) + 'px';
  stickVec = { x: dx / STICK_MAX, y: dy / STICK_MAX };
}
stickZone.addEventListener('touchstart', (e) => { e.preventDefault(); stickPointerStart(e); }, { passive: false });
stickZone.addEventListener('touchmove', (e) => { e.preventDefault(); stickPointerMove(e); }, { passive: false });
stickZone.addEventListener('touchend', (e) => { e.preventDefault(); stickPointerEnd(); }, { passive: false });

const jumpBtn = document.getElementById('jump-btn');
jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); input.jumpPressed = true; }, { passive: false });

function isMobile() {
  return 'ontouchstart' in window && matchMedia('(hover: none), (pointer: coarse)').matches;
}
if (isMobile()) document.getElementById('mobile-controls').classList.add('visible');

function readMobileInput() {
  if (!stickActive) return;
  input.moveX = stickVec.x;
  input.moveZ = stickVec.y; // stick "down" (positive y) = move forward, matches on-screen convention
  input.running = Math.hypot(stickVec.x, stickVec.y) > 0.75;
}

// -------------------- HUD --------------------
const csValueEl = document.getElementById('cs-value');
const csTotalEl = document.getElementById('cs-total');
const csIconEl = document.getElementById('cs-icon');
const csPillEl = document.getElementById('cs-pill');
const levelTitleEl = document.getElementById('level-title');
const levelSubtitleEl = document.getElementById('level-subtitle');
const toastStack = document.getElementById('toast-stack');
const deathFadeEl = document.getElementById('death-fade');

csTotalEl.textContent = String(TOTAL_COMMON_SENSE);

function updateHudCount() {
  csValueEl.textContent = String(totalCommonSense);
}

function pulseHudCollect() {
  csPillEl.classList.add('pop');
  csIconEl.classList.add('glow');
  setTimeout(() => {
    csPillEl.classList.remove('pop');
    csIconEl.classList.remove('glow');
  }, 220);
}

// Sparse, non-stacking toasts — used only for the occasional ambient joke
// or checkpoint confirmation, never for routine pickups (per the brief).
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// -------------------- Level lifecycle --------------------
function loadLevel(index) {
  currentLevelIndex = index;
  currentLevel = LEVELS[index];

  colliders = levelBuilder.build(currentLevel);

  scene.background = new THREE.Color(currentLevel.skyColor);
  scene.fog = new THREE.Fog(currentLevel.fogColor, 20, 60);

  const spawn = new THREE.Vector3(currentLevel.spawn.x, currentLevel.spawn.y, currentLevel.spawn.z);
  player.setSpawn(spawn);
  player.teleportTo(spawn);
  player.deathState = false;
  player.celebrateState = false;
  animator.setState('idle');

  cameraController.requestSnap();

  levelTitleEl.textContent = currentLevel.title;
  levelSubtitleEl.textContent = currentLevel.subtitle;

  gateTransitionActive = false;
  portalSequenceActive = false;
  portalIntensityTarget = 1;

  if (currentLevel.introText) {
    setTimeout(() => toast(currentLevel.introText), 300);
  }

  running = true;
}

function respawnPlayer() {
  player.respawnAtCheckpoint();
  cameraController.requestSnap();
  deathFadeEl.classList.remove('active');
}

function handleDeath() {
  if (player.deathState) return; // already dying, ignore repeat triggers
  player.deathState = true;
  SFX.death();
  deathFadeEl.classList.add('active');
  deathTimer = 0.55;
}

function handleCheckpoint(cp) {
  const pos = new THREE.Vector3(cp.x, cp.y + 0.1, cp.z);
  const distSq = player.position.distanceToSquared(pos);
  if (distSq < 4 && !cp._activated) {
    cp._activated = true;
    player.setCheckpoint(pos);
    SFX.checkpoint();
    toast('Checkpoint reached.');
  }
}

function handleGateEnter() {
  if (gateTransitionActive) return;
  gateTransitionActive = true;
  running = false;
  SFX.gate();
  showTransitionScreen(() => {
    if (currentLevelIndex + 1 < LEVELS.length) {
      loadLevel(currentLevelIndex + 1);
      hideTransitionScreen();
    }
  });
}

function handlePortalEnter() {
  if (portalSequenceActive) return;
  portalSequenceActive = true;
  running = false;
  player.celebrateState = true;
  SFX.portalEnter();
  runEndingSequence();
}

// -------------------- Transition screen --------------------
const transitionScreen = document.getElementById('transition-screen');
const transitionPanel = document.getElementById('transition-panel');

function showTransitionScreen(onContinue) {
  transitionPanel.innerHTML = `
    <h1>Level Complete!</h1>
    <p>🧠 Common Sense: ${totalCommonSense} / ${TOTAL_COMMON_SENSE}</p>
    <p style="font-size:0.8rem;">Onward.</p>
    <button class="btn" id="btn-continue">Continue</button>
  `;
  transitionScreen.classList.add('active');
  document.getElementById('btn-continue').addEventListener('click', () => {
    SFX.click();
    onContinue();
  }, { once: true });
}
function hideTransitionScreen() {
  transitionScreen.classList.remove('active');
}

// -------------------- Ending sequence --------------------
const finalScreen = document.getElementById('final-screen');
const finalPanel = document.getElementById('final-panel');
const confettiLayer = document.getElementById('confetti-layer');

function runEndingSequence() {
  // 1. Portal brightens (handled per-frame via portalIntensity ramp in the
  //    render loop, driven by portalSequenceActive + a timer below).
  portalIntensityTarget = 2.2;

  setTimeout(() => {
    // 2. Brief screen fade + confetti burst.
    spawnConfetti();
    SFX.celebrate();
    finalScreen.classList.add('active');
  }, 900);

  setTimeout(() => {
    // 3. Final message appears.
    finalPanel.innerHTML = `
      <h1>YOU DID IT! 🎉</h1>
      <p>You thought you were going to collect Common Sense…</p>
      <p>Turns out, we just made you do parkour for it. 😭</p>
      <p style="font-size:0.82rem;">Maybe the Common Sense was the friends we lost along the way.</p>
      <p style="margin-top:18px; font-weight:600; color:var(--text-hi);">Happy Raksha Bandhan ❤️</p>
      <p style="font-size:0.78rem;">Made with love, chaos, and questionable sibling decisions.</p>
      <button class="btn" id="btn-restart">Play Again</button>
    `;
    document.getElementById('btn-restart').addEventListener('click', () => {
      SFX.click();
      restartGame();
    }, { once: true });
  }, 1500);
}

function spawnConfetti() {
  confettiLayer.innerHTML = '';
  const colors = ['#ff8a5c', '#ffd166', '#7ee8fa', '#a78bfa', '#ff6fa5', '#7be495'];
  const count = 70;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = 6 + Math.random() * 8;
    piece.style.width = size + 'px';
    piece.style.height = size * 0.5 + 'px';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (3 + Math.random() * 3) + 's';
    piece.style.animationDelay = (Math.random() * 1.5) + 's';
    confettiLayer.appendChild(piece);
  }
}

function restartGame() {
  finalScreen.classList.remove('active');
  totalCommonSense = 0;
  updateHudCount();
  // Reset checkpoint-activation flags so the fresh playthrough behaves
  // identically to a first playthrough (avoids stale _activated state).
  LEVELS.forEach((lv) => (lv.checkpoints || []).forEach((cp) => { cp._activated = false; }));
  loadLevel(0);
}

let portalIntensityTarget = 1;
let portalIntensityCurrent = 1;

// -------------------- Pause --------------------
function togglePause() {
  if (!running && !paused) return; // nothing to pause (e.g. during a transition)
  paused = !paused;
}

// -------------------- Main update / render loop --------------------
const clock = new THREE.Clock();

function updateWorldBoundsCollider() {
  return currentLevel.worldBounds;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (running && !paused) {
    elapsed += dt;

    readKeyboardInput();
    readMobileInput();

    levelBuilder.updateMovingPlatforms(dt, elapsed);
    levelBuilder.updateCollectibles(dt, elapsed);
    levelBuilder.updateGate(dt, elapsed);

    if (deathTimer > 0) {
      deathTimer -= dt;
      if (deathTimer <= 0) {
        respawnPlayer();
      }
    }

    const worldBounds = updateWorldBoundsCollider();
    player.update(
      dt,
      input,
      colliders,
      () => { handleDeath(); },        // onHazard
      () => { handleDeath(); },        // onFallOut
      worldBounds
    );
    input.jumpPressed = false;

    // Checkpoints
    if (currentLevel.checkpoints) {
      for (const cp of currentLevel.checkpoints) handleCheckpoint(cp);
    }

    // Collectibles
    const hit = levelBuilder.checkCollectibleHit(player.position);
    if (hit) {
      levelBuilder.collectItem(hit);
      totalCommonSense++;
      updateHudCount();
      pulseHudCollect();
      SFX.collect();
    }

    // Gate / portal triggers
    const playerBox = player._playerBox();
    if (currentLevel.gate && levelBuilder.isPlayerAtGate(playerBox)) {
      handleGateEnter();
    }
    if (currentLevel.portal && levelBuilder.isPlayerAtPortal(playerBox)) {
      handlePortalEnter();
    }

    animator.update(dt, elapsed, Math.hypot(player.velocity.x, player.velocity.z) / 7.5);
    // Apply the celebrate-pose vertical bounce, if any, directly to the
    // character's render position without touching physics state.
    if (animator.celebrateBounce) {
      character.position.y = player.position.y + animator.celebrateBounce;
    }

    cameraController.update(dt, player.position, player.facingAngle, player.velocity.y, player.onGround);
  }

  // Portal glow intensity ramps toward its target regardless of `running`,
  // so the brightening effect continues to animate through the ending
  // sequence even after gameplay has been frozen.
  portalIntensityCurrent += (portalIntensityTarget - portalIntensityCurrent) * Math.min(1, dt * 2.5);
  if (currentLevel && currentLevel.portal) {
    levelBuilder.updatePortal(dt, elapsed, portalIntensityCurrent);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// -------------------- Boot sequence --------------------
const bootMessages = [
  'Loading a whole third dimension…',
  'Teaching Common Sense to render in 3D…',
  'Still not finding any Common Sense…',
  'Almost ready…',
];

function runBootSequence(onDone) {
  const fill = document.getElementById('boot-bar-fill');
  const status = document.getElementById('boot-status');
  let progress = 0;
  let msgIndex = 0;
  const interval = setInterval(() => {
    progress += 10 + Math.random() * 16;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(onDone, 220);
    }
    fill.style.width = progress + '%';
    const idx = Math.min(bootMessages.length - 1, Math.floor((progress / 100) * bootMessages.length));
    if (idx !== msgIndex) { msgIndex = idx; status.textContent = bootMessages[idx]; }
  }, 130);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('boot-screen').classList.remove('active');
  document.getElementById('start-screen').classList.add('active');

  runBootSequence(() => {
    document.getElementById('boot-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('active');
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    unlockAudio();
    SFX.click();
    document.getElementById('start-screen').classList.remove('active');
    loadLevel(0);
  });
});

['touchstart', 'click', 'keydown'].forEach((evt) => {
  document.addEventListener(evt, () => unlockAudio(), { once: true, passive: true });
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

tick();
