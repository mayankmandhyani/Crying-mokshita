// physics.js
// Core 2D platformer physics constants and collision resolution.
// Tuned for "Mario-quality" feel: fast acceleration, snappy deceleration,
// coyote time (grace period to jump after walking off a ledge), jump
// buffering (grace period where a jump press just before landing still
// registers), and variable jump height (releasing jump early cuts the
// upward velocity, giving the player control over hop height).
//
// All units are in "world pixels" at the internal render resolution
// (see main.js RENDER_WIDTH/HEIGHT), NOT CSS/device pixels.

export const GRAVITY = 1500;           // px/s^2
export const MAX_FALL_SPEED = 900;     // px/s
export const MOVE_SPEED = 165;         // px/s, max horizontal run speed
export const ACCEL = 1400;             // px/s^2 while input held
export const DECEL = 1600;             // px/s^2 while no input (ground friction)
export const AIR_ACCEL = 900;          // slightly less control in air, still responsive
export const JUMP_VELOCITY = 430;      // px/s initial upward velocity
export const JUMP_CUT_MULTIPLIER = 0.45; // releasing jump early multiplies remaining upward vel
export const COYOTE_TIME = 0.11;       // seconds of grace after leaving ground
export const JUMP_BUFFER_TIME = 0.11;  // seconds a jump press is remembered before landing

export const PLAYER_WIDTH = 20;
export const PLAYER_HEIGHT = 30;
export const DEATH_Y = 400; // falling below this (relative to level floor) triggers death

// An obstacle/platform is {x, y, w, h} where (x,y) is the TOP-LEFT
// corner in world space (standard 2D canvas convention, +y is down).

export function aabb(x, y, w, h) {
  return { minX: x, maxX: x + w, minY: y, maxY: y + h };
}

export function playerAABB(x, y) {
  return aabb(x - PLAYER_WIDTH / 2, y - PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT);
}

function overlapsX(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX;
}
function overlapsY(a, b) {
  return a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Resolve horizontal movement against a list of solid platforms.
 * player position (x,y) is BOTTOM-CENTER (feet position, y grows down).
 * Returns the corrected x.
 */
export function resolveHorizontal(x, y, dx, platforms) {
  let newX = x + dx;
  if (dx === 0) return newX;
  const feet = y;
  const head = y - PLAYER_HEIGHT;

  for (const p of platforms) {
    if (p.oneWay) continue; // one-way platforms never block horizontal movement
    // vertical overlap check (skip platforms we're standing safely on top of / below)
    const verticalOverlap = feet > p.y + 0.5 && head < p.y + p.h - 0.5;
    if (!verticalOverlap) continue;

    const pb = aabb(p.x, p.y, p.w, p.h);
    const testBox = { minX: newX - PLAYER_WIDTH / 2, maxX: newX + PLAYER_WIDTH / 2, minY: head, maxY: feet };
    if (overlapsX(testBox, pb) && overlapsY(testBox, pb)) {
      if (dx > 0) newX = pb.minX - PLAYER_WIDTH / 2;
      else if (dx < 0) newX = pb.maxX + PLAYER_WIDTH / 2;
    }
  }
  return newX;
}

/**
 * Resolve vertical movement against platforms. Handles both solid
 * platforms (block from all sides) and one-way platforms (only block
 * when falling onto them from above).
 * Returns { y, velY, grounded, groundedPlatform }
 */
export function resolveVertical(x, y, velY, dt, platforms) {
  const prevFeet = y;
  let newFeet = y + velY * dt;
  let grounded = false;
  let groundedPlatform = null;

  const halfW = PLAYER_WIDTH / 2;

  for (const p of platforms) {
    const overlapsXNow = x + halfW > p.x && x - halfW < p.x + p.w;
    if (!overlapsXNow) continue;

    if (velY >= 0) {
      // falling or stationary: check landing on top surface
      const platTop = p.y;
      if (prevFeet <= platTop + 0.5 && newFeet >= platTop) {
        // For one-way platforms, only land if we were fully above the
        // platform's top last frame (prevents snapping up through it
        // from below/the side).
        if (p.oneWay && prevFeet > platTop + 0.5) continue;
        newFeet = platTop;
        velY = 0;
        grounded = true;
        groundedPlatform = p;
      }
    } else if (!p.oneWay) {
      // moving up: check hitting the underside (solid platforms only)
      const prevHead = prevFeet - PLAYER_HEIGHT;
      const newHead = newFeet - PLAYER_HEIGHT;
      const platBottom = p.y + p.h;
      if (prevHead >= platBottom - 0.5 && newHead <= platBottom) {
        newFeet = platBottom + PLAYER_HEIGHT;
        velY = 0;
      }
    }
  }

  return { y: newFeet, velY, grounded, groundedPlatform };
}

/**
 * Compute the max jump height and max horizontal distance coverable
 * during a full jump arc, used to validate level design.
 */
export function jumpProfile(horizontalSpeed = MOVE_SPEED) {
  const timeToApex = JUMP_VELOCITY / GRAVITY;
  const maxHeight = JUMP_VELOCITY * timeToApex - 0.5 * GRAVITY * timeToApex * timeToApex;
  const totalAirTime = timeToApex * 2;
  const maxDistance = horizontalSpeed * totalAirTime;
  return { timeToApex, maxHeight, totalAirTime, maxDistance };
}

export function isJumpAchievable(gapDistance, heightDiff, horizontalSpeed = MOVE_SPEED, marginFactor = 0.7) {
  const { maxHeight, maxDistance } = jumpProfile(horizontalSpeed);
  const safeDistance = maxDistance * marginFactor;
  const safeHeight = maxHeight * 0.9;
  if (heightDiff > 0 && heightDiff > safeHeight) return false;
  if (gapDistance > safeDistance) return false;
  return true;
}
