// validate-moving-platforms.mjs
// For every moving platform in every level, sample its position across
// a full oscillation cycle and check what fraction of that cycle keeps
// it within a fair jump distance of the platform immediately BEFORE it
// in the level sequence (the platform the player is jumping FROM).
//
// A platform that is only reachable for a small fraction of its cycle
// effectively demands precise timing, which the spec explicitly warns
// against ("do not create jumps that are technically possible only
// with perfect frame timing... reasonable margin for a human player").
//
// We treat "reachable fraction >= 55%" as fair (player has generous
// margin even with imperfect timing/reaction), 35-55% as marginal
// (flag for review), and <35% as requiring redesign.

import { LEVELS } from './levels.js';
import { isJumpAchievable } from './physics.js';

const HORIZONTAL_SPEED = 6.2;
const SAMPLE_COUNT = 240; // samples across one full cycle

function platformPositionAtTime(plat, t) {
  const cfg = plat.moving;
  const phase = t * cfg.speed + (cfg.phase || 0);
  const offset = Math.sin(phase) * cfg.range;
  const pos = { x: plat.x, y: plat.y, z: plat.z };
  if (cfg.axis === 'x') pos.x += offset;
  else if (cfg.axis === 'y') pos.y += offset;
  else if (cfg.axis === 'z') pos.z += offset;
  return pos;
}

function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

function edgeGap(a, aBox, b, bBox) {
  const centerDist = dist2D(a, b);
  const aRadius = Math.min(aBox.w, aBox.d) / 2;
  const bRadius = Math.min(bBox.w, bBox.d) / 2;
  return Math.max(0, centerDist - aRadius - bRadius);
}

console.log('='.repeat(70));
console.log('MOVING PLATFORM REACHABILITY ANALYSIS');
console.log('='.repeat(70));

let flaggedCount = 0;

for (const level of LEVELS) {
  const plats = level.platforms;
  for (let i = 1; i < plats.length; i++) {
    const plat = plats[i];
    if (!plat.moving) continue;
    const prev = plats[i - 1];

    // sample across one full cycle (period = 2*PI / speed)
    const period = (Math.PI * 2) / plat.moving.speed;
    let reachableSamples = 0;

    for (let s = 0; s < SAMPLE_COUNT; s++) {
      const t = (s / SAMPLE_COUNT) * period;
      const platPos = platformPositionAtTime(plat, t);
      const gap = edgeGap(prev, prev, platPos, plat);
      const heightDiff = (platPos.y + plat.h / 2) - (prev.y + prev.h / 2);
      if (isJumpAchievable(gap, heightDiff, HORIZONTAL_SPEED)) {
        reachableSamples++;
      }
    }

    const fraction = reachableSamples / SAMPLE_COUNT;
    let verdict = 'FAIR';
    if (fraction < 0.35) verdict = 'FAIL (needs redesign)';
    else if (fraction < 0.55) verdict = 'MARGINAL (review)';

    if (verdict !== 'FAIR') flaggedCount++;

    console.log(`Level ${level.id}, platform@z=${plat.z} (axis=${plat.moving.axis}, range=${plat.moving.range}, speed=${plat.moving.speed}): reachable ${(fraction * 100).toFixed(0)}% of cycle -- ${verdict}`);
  }
}

console.log('');
console.log(`${flaggedCount} platform(s) flagged for review/redesign.`);
if (flaggedCount > 0) process.exit(1);
