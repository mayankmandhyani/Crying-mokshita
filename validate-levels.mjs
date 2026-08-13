// validate-levels.mjs
// Automated geometric validation of level data:
//  - consecutive platform-to-platform jump distance/height checked against
//    the real jump physics envelope from physics.js
//  - hazards must not overlap any platform's walkable footprint
//  - collectibles must be reachable (near a platform, not floating in void)
//  - checkpoints must sit on a platform
//
// Run: node validate-levels.mjs

import { LEVELS } from './levels.js';
import { isJumpAchievable, jumpProfile, boxBounds } from './physics.js';

const HORIZONTAL_SPEED = 6.2; // conservative estimate of sustained run speed (see player.js MOVE_SPEED in main.js)
let failures = 0;
let warnings = 0;

function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

function platformTopY(p) {
  return p.y + p.h / 2;
}

function edgeGap(a, b) {
  // approximate gap between the nearest edges of two boxes along the
  // dominant travel axis, rather than center-to-center distance,
  // since center distance over-estimates the real jump gap.
  const centerDist = dist2D(a, b);
  const aRadius = Math.min(a.w, a.d) / 2;
  const bRadius = Math.min(b.w, b.d) / 2;
  return Math.max(0, centerDist - aRadius - bRadius);
}

console.log('='.repeat(60));
console.log('LEVEL VALIDATION');
console.log('='.repeat(60));

const profile = jumpProfile(HORIZONTAL_SPEED);
console.log(`Jump profile @ speed=${HORIZONTAL_SPEED}: maxHeight=${profile.maxHeight.toFixed(2)}, maxDist=${profile.maxDistance.toFixed(2)}`);
console.log('');

for (const level of LEVELS) {
  console.log(`--- Level ${level.id}: ${level.title} ---`);
  const plats = level.platforms;

  // 1. Consecutive platform jump checks
  for (let i = 0; i < plats.length - 1; i++) {
    const a = plats[i];
    const b = plats[i + 1];
    const gap = edgeGap(a, b);
    const heightDiff = platformTopY(b) - platformTopY(a);
    const ok = isJumpAchievable(gap, heightDiff, HORIZONTAL_SPEED);
    const status = ok ? 'OK  ' : 'FAIL';
    if (!ok) failures++;
    console.log(`  [${status}] plat ${i}->${i + 1}: gap=${gap.toFixed(2)} heightDiff=${heightDiff.toFixed(2)}`);
  }

  // 2. Hazard vs platform overlap check (hazard should NOT sit at/above
  // any platform's walkable top surface within the same XZ footprint)
  for (const hz of level.hazards || []) {
    for (const p of plats) {
      const dx = Math.abs(hz.x - p.x);
      const dz = Math.abs(hz.z - p.z);
      const overlapX = dx < (hz.w / 2 + p.w / 2);
      const overlapZ = dz < (hz.d / 2 + p.d / 2);
      if (overlapX && overlapZ) {
        const platTop = platformTopY(p);
        if (hz.y >= platTop - 0.3) {
          console.log(`  [FAIL] hazard at (${hz.x},${hz.z}) overlaps walkable platform top at (${p.x},${p.z})`);
          failures++;
        }
      }
    }
  }

  // 3. Collectible reachability: must be within reasonable XZ distance
  // and height of at least one platform (i.e., not floating in the void
  // unreachably far from any surface).
  for (const col of level.collectibles || []) {
    let nearest = Infinity;
    let nearestHeightDiff = Infinity;
    for (const p of plats) {
      const d = dist2D(col, p);
      if (d < nearest) {
        nearest = d;
        nearestHeightDiff = col.y - platformTopY(p);
      }
    }
    if (nearest > 4.5 || nearestHeightDiff > 3.2) {
      console.log(`  [FAIL] collectible ${col.id} unreachable: nearestPlatDist=${nearest.toFixed(2)} heightAbovePlat=${nearestHeightDiff.toFixed(2)}`);
      failures++;
    } else {
      console.log(`  [OK  ] collectible ${col.id}: nearestPlatDist=${nearest.toFixed(2)} heightAbovePlat=${nearestHeightDiff.toFixed(2)}`);
    }
  }

  // 4. Checkpoint must sit on/near a platform surface
  for (const cp of level.checkpoints || []) {
    let onPlatform = false;
    for (const p of plats) {
      const dx = Math.abs(cp.x - p.x);
      const dz = Math.abs(cp.z - p.z);
      if (dx < p.w / 2 && dz < p.d / 2) {
        const platTop = platformTopY(p);
        if (Math.abs(cp.y - platTop) < 1.0) {
          onPlatform = true;
        }
      }
    }
    if (!onPlatform) {
      console.log(`  [FAIL] checkpoint ${cp.id} not resting on any platform surface`);
      failures++;
    } else {
      console.log(`  [OK  ] checkpoint ${cp.id} resting correctly`);
    }
  }

  // 5. Gate/portal reachability from last platform
  const exit = level.gate || level.portal;
  if (exit) {
    const last = plats[plats.length - 1];
    const d = dist2D(exit, last);
    if (d > 6) {
      console.log(`  [WARN] exit is ${d.toFixed(2)} units from last platform (verify visually)`);
      warnings++;
    } else {
      console.log(`  [OK  ] exit reachable from last platform (dist=${d.toFixed(2)})`);
    }
  }

  console.log('');
}

console.log('='.repeat(60));
console.log(`RESULT: ${failures} failures, ${warnings} warnings`);
console.log('='.repeat(60));

if (failures > 0) {
  process.exit(1);
}
