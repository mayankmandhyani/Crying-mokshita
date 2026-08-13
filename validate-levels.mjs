// validate-levels.mjs
// Automated geometric validation for the 2D levels: consecutive
// platform jump distance/height checked against the real physics
// envelope, hazard-vs-platform overlap checks, collectible and
// checkpoint reachability. Run: node validate-levels.mjs

import { LEVELS } from './levels.js';
import { isJumpAchievable, jumpProfile } from './physics.js';

const HORIZONTAL_SPEED = 150; // slightly conservative vs MOVE_SPEED=165 to leave margin
let failures = 0;
let warnings = 0;

function edgeGapX(a, b) {
  // horizontal gap between nearest edges (a assumed to the left of b,
  // but works either direction using max(0, ...))
  if (a.x + a.w <= b.x) return b.x - (a.x + a.w);
  if (b.x + b.w <= a.x) return a.x - (b.x + b.w);
  return 0; // overlapping in x
}

console.log('='.repeat(60));
console.log('LEVEL VALIDATION (2D)');
console.log('='.repeat(60));

const profile = jumpProfile(HORIZONTAL_SPEED);
console.log(`Jump profile @ speed=${HORIZONTAL_SPEED}: maxHeight=${profile.maxHeight.toFixed(1)}px, maxDist=${profile.maxDistance.toFixed(1)}px`);
console.log('');

for (const level of LEVELS) {
  console.log(`--- Level ${level.id}: ${level.title} ---`);
  const plats = level.platforms;

  // 1. Consecutive platform jump checks (sorted by x, since level scrolls
  // left to right and platforms are authored roughly in order already,
  // but sort defensively)
  const sorted = [...plats].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = edgeGapX(a, b);
    const heightDiff = a.y - b.y; // positive = b is higher (smaller y)
    const ok = isJumpAchievable(gap, heightDiff, HORIZONTAL_SPEED);
    const status = ok ? 'OK  ' : 'FAIL';
    if (!ok) failures++;
    console.log(`  [${status}] plat ${i}->${i + 1}: gap=${gap.toFixed(0)}px heightDiff=${heightDiff.toFixed(0)}px`);
  }

  // 2. Hazard vs platform overlap: hazard should not sit at/above any
  // platform's walkable top surface within the same x-span.
  for (const hz of level.hazards || []) {
    for (const p of plats) {
      const overlapX = hz.x < p.x + p.w && hz.x + hz.w > p.x;
      if (overlapX) {
        // hazard is drawn "in the gap" -- its y should be below (greater
        // y value than) the platform's walkable surface, not coincide
        // with it.
        if (hz.y < p.y + p.h - 5 && hz.y + hz.h > p.y - 5) {
          console.log(`  [FAIL] hazard at x=${hz.x} overlaps platform at x=${p.x} (walkable surface)`);
          failures++;
        }
      }
    }
  }

  // 3. Collectible reachability: within reasonable distance of some
  // platform (not floating unreachably).
  for (const col of level.collectibles || []) {
    let nearestDist = Infinity;
    let nearestHeightAbove = Infinity;
    for (const p of plats) {
      const dx = Math.max(p.x - col.x, 0, col.x - (p.x + p.w));
      if (dx < nearestDist) {
        nearestDist = dx;
        nearestHeightAbove = p.y - col.y;
      }
    }
    if (nearestDist > 90 || nearestHeightAbove > 110 || nearestHeightAbove < -10) {
      console.log(`  [FAIL] collectible ${col.id} unreachable: nearestDx=${nearestDist.toFixed(0)} heightAbovePlat=${nearestHeightAbove.toFixed(0)}`);
      failures++;
    } else {
      console.log(`  [OK  ] collectible ${col.id}: nearestDx=${nearestDist.toFixed(0)} heightAbovePlat=${nearestHeightAbove.toFixed(0)}`);
    }
  }

  // 4. Checkpoint must sit on a platform
  for (const cp of level.checkpoints || []) {
    let onPlatform = false;
    for (const p of plats) {
      if (cp.x >= p.x && cp.x <= p.x + p.w && Math.abs(cp.y - p.y) < 5) {
        onPlatform = true;
      }
    }
    if (!onPlatform) {
      console.log(`  [FAIL] checkpoint ${cp.id} not resting on a platform surface`);
      failures++;
    } else {
      console.log(`  [OK  ] checkpoint ${cp.id} resting correctly`);
    }
  }

  // 5. Gate/portal reachable from last platform
  const exit = level.gate || level.portal;
  if (exit) {
    const last = sorted[sorted.length - 1];
    const dx = Math.abs(exit.x - (last.x + last.w / 2));
    if (dx > 200) {
      console.log(`  [WARN] exit is ${dx.toFixed(0)}px from last platform center (verify visually)`);
      warnings++;
    } else {
      console.log(`  [OK  ] exit reachable from last platform (dx=${dx.toFixed(0)})`);
    }
  }

  console.log('');
}

console.log('='.repeat(60));
console.log(`RESULT: ${failures} failures, ${warnings} warnings`);
console.log('='.repeat(60));

if (failures > 0) process.exit(1);
