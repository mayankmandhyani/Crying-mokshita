// physics.js
// Small self-contained physics helpers for the platformer.
// Uses simple AABB (axis-aligned bounding box) collision against
// a list of static "platform" boxes, plus gravity/jump integration.

export const GRAVITY = -32; // units/s^2
export const JUMP_VELOCITY = 12.5; // units/s, initial upward speed on jump
export const MAX_FALL_SPEED = -40;
export const PLAYER_HALF_WIDTH = 0.42;
export const PLAYER_HALF_DEPTH = 0.42;
export const PLAYER_HEIGHT = 1.75;
export const DEATH_Y = -14; // falling below this triggers death

// A platform is: { x, y, z, w, h, d } where (x,y,z) is the CENTER
// of the box and (w,h,d) are full width/height/depth.

export function boxBounds(box) {
  return {
    minX: box.x - box.w / 2,
    maxX: box.x + box.w / 2,
    minY: box.y - box.h / 2,
    maxY: box.y + box.h / 2,
    minZ: box.z - box.d / 2,
    maxZ: box.z + box.d / 2,
  };
}

// Player AABB at a given feet-position (x, yFeet, z)
export function playerBounds(x, yFeet, z) {
  return {
    minX: x - PLAYER_HALF_WIDTH,
    maxX: x + PLAYER_HALF_WIDTH,
    minY: yFeet,
    maxY: yFeet + PLAYER_HEIGHT,
    minZ: z - PLAYER_HALF_DEPTH,
    maxZ: z + PLAYER_HALF_DEPTH,
  };
}

function overlapXZ(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * Resolve vertical motion against a set of platforms.
 * Returns { y, velY, grounded, groundedPlatform }
 *
 * Approach: swept AABB on Y axis only (we handle X/Z separately).
 * This is standard for platformers: resolve one axis at a time to
 * avoid tunnelling/ambiguous corner cases.
 */
export function resolveVertical(x, y, z, velY, dt, platforms) {
  const prevY = y;
  let newY = y + velY * dt;
  let grounded = false;
  let groundedPlatform = null;

  const pb = playerBounds(x, Math.min(prevY, newY), z);
  // widen the sweep to cover both start and end
  const sweepMinY = Math.min(prevY, newY);
  const sweepMaxY = Math.max(prevY, newY) + PLAYER_HEIGHT;

  for (const plat of platforms) {
    const b = boxBounds(plat);
    // quick XZ overlap check using the moving player's XZ footprint
    const px = { minX: x - PLAYER_HALF_WIDTH, maxX: x + PLAYER_HALF_WIDTH, minZ: z - PLAYER_HALF_DEPTH, maxZ: z + PLAYER_HALF_DEPTH };
    const overlapsXZ = px.minX < b.maxX && px.maxX > b.minX && px.minZ < b.maxZ && px.maxZ > b.minZ;
    if (!overlapsXZ) continue;

    if (velY <= 0) {
      // falling or standing: check landing on top of platform
      const feetPrev = prevY;
      const feetNew = newY;
      if (feetPrev >= b.maxY - 0.001 && feetNew <= b.maxY) {
        // crossed the top surface this frame -> land
        newY = b.maxY;
        velY = 0;
        grounded = true;
        groundedPlatform = plat;
      }
    } else {
      // moving up: check hitting the underside of a platform
      const headPrev = prevY + PLAYER_HEIGHT;
      const headNew = newY + PLAYER_HEIGHT;
      if (headPrev <= b.minY + 0.001 && headNew >= b.minY) {
        newY = b.minY - PLAYER_HEIGHT;
        velY = 0;
      }
    }
  }

  return { y: newY, velY, grounded, groundedPlatform };
}

/**
 * Resolve horizontal motion (X and Z independently) against platforms,
 * but ONLY against platforms the player is roughly level with (i.e.
 * solid walls/platform edges at the player's current height band).
 * This prevents the player being blocked by platforms far below/above.
 */
export function resolveHorizontal(x, y, z, dx, dz, platforms) {
  let newX = x + dx;
  let newZ = z + dz;

  const feet = y;
  const head = y + PLAYER_HEIGHT;

  for (const plat of platforms) {
    const b = boxBounds(plat);
    // only collide horizontally if the player's vertical band overlaps
    // the platform's vertical band by more than a small tolerance AND
    // the player is not comfortably standing on top of it.
    const verticalOverlap = feet < b.maxY - 0.15 && head > b.minY + 0.05;
    if (!verticalOverlap) continue;

    // X axis
    const pbX = { minX: newX - PLAYER_HALF_WIDTH, maxX: newX + PLAYER_HALF_WIDTH, minZ: z - PLAYER_HALF_DEPTH, maxZ: z + PLAYER_HALF_DEPTH };
    if (pbX.minX < b.maxX && pbX.maxX > b.minX && pbX.minZ < b.maxZ && pbX.maxZ > b.minZ) {
      if (dx > 0) newX = b.minX - PLAYER_HALF_WIDTH;
      else if (dx < 0) newX = b.maxX + PLAYER_HALF_WIDTH;
    }

    // Z axis
    const pbZ = { minX: newX - PLAYER_HALF_WIDTH, maxX: newX + PLAYER_HALF_WIDTH, minZ: newZ - PLAYER_HALF_DEPTH, maxZ: newZ + PLAYER_HALF_DEPTH };
    if (pbZ.minX < b.maxX && pbZ.maxX > b.minX && pbZ.minZ < b.maxZ && pbZ.maxZ > b.minZ) {
      if (dz > 0) newZ = b.minZ - PLAYER_HALF_DEPTH;
      else if (dz < 0) newZ = b.maxZ + PLAYER_HALF_DEPTH;
    }
  }

  return { x: newX, z: newZ };
}

/**
 * Given jump velocity and gravity, compute max jump height and the
 * horizontal distance coverable at a given horizontal speed before
 * landing back at the same height. Used to validate level geometry.
 */
export function jumpProfile(horizontalSpeed = 7) {
  const timeToApex = -JUMP_VELOCITY / GRAVITY;
  const maxHeight = JUMP_VELOCITY * timeToApex + 0.5 * GRAVITY * timeToApex * timeToApex;
  const totalAirTime = timeToApex * 2;
  const maxDistance = horizontalSpeed * totalAirTime;
  return { timeToApex, maxHeight, totalAirTime, maxDistance };
}

// Check if a jump from platform A to platform B (both boxes) is
// achievable: horizontal gap must be less than max jump distance
// (with safety margin), and height difference must be less than
// max jump height (with margin) if B is higher than A.
export function isJumpAchievable(gapDistance, heightDiff, horizontalSpeed = 7, marginFactor = 0.72) {
  const { maxHeight, maxDistance } = jumpProfile(horizontalSpeed);
  const safeDistance = maxDistance * marginFactor;
  const safeHeight = maxHeight * 0.92; // less margin needed on height; gravity assists on the way up as long as timed reasonably
  if (heightDiff > 0 && heightDiff > safeHeight) return false;
  if (gapDistance > safeDistance) return false;
  return true;
}
