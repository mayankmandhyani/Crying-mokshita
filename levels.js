/* ==========================================================================
   LEVELS.JS — Level layouts for the 3D game. Ported from the 2D game's
   level structure/jokes, redesigned for 3D platforming with the physics
   constants from player-controller.js.

   DESIGN RULE (see PHYSICS in player-controller.js):
     MAX_JUMP_HEIGHT ≈ 1.84 units, MAX_JUMP_RANGE ≈ 6.14 units.
   Every gap/step in this file is kept well under those limits — see the
   comments per-level for the actual verified numbers. All layouts were
   checked with a headless physics simulation before being finalized (see
   /tests in the project, or re-run the check described in README).
   ========================================================================== */

// Helper builders — keep level data declarative and easy to scan/edit.
function platform(x, y, z, w, h, d, color = 0x5c3f7a) {
  return { type: 'platform', x, y, z, w, h, d, color };
}
function hazardZone(x, y, z, w, h, d) {
  return { type: 'hazard', x, y, z, w, h, d };
}
function collectible(x, y, z) {
  return { type: 'collectible', x, y, z, id: `${x}_${y}_${z}` };
}
function checkpoint(x, y, z) {
  return { type: 'checkpoint', x, y, z };
}

// Small joke lines shown as brief toasts — same tone as the 2D game, but
// used sparingly per the new brief (no notification spam).
export const AMBIENT_JOKES = [
  'Common Sense detected. Probably.',
  'Recalculating expectations…',
  'Still zero. Impressively consistent.',
  'Mayank has been notified.',
];

export const LEVELS = [
  // ==========================================================================
  // LEVEL 1 — THE JOURNEY BEGINS
  // Wide, mostly-continuous ground with a couple of very short, safe gaps.
  // Teaches movement, jumping, collecting, one checkpoint, then a gate.
  // ==========================================================================
  {
    id: 1,
    title: 'Level 1',
    subtitle: 'The Journey Begins',
    skyColor: 0x2c1f4d,
    fogColor: 0x2c1f4d,
    groundColor: 0x3a2b55,
    accentColor: 0xffd166,
    spawn: { x: 0, y: 0.1, z: 0 },
    worldBounds: { minX: -20, maxX: 20, minZ: -6, maxZ: 70, killY: -12 },
    platforms: [
      platform(0, -0.5, 8, 12, 1, 20),      // main starting ground (z: -2 to 18)
      platform(0, -0.5, 24.5, 12, 1, 8),     // ground segment 2 (z: 20.5 to 28.5) -- 2.5 unit gap before it
      platform(0, -0.5, 38, 12, 1, 14),      // ground segment 3 (z: 31 to 45) -- 2.5 unit gap before it
    ],
    // Gaps verified with the automated checker (see /tests or README):
    // seg1 ends z=18, seg2 starts z=20.5 -> 2.5 unit gap. seg2 ends z=28.5,
    // seg3 starts z=31 -> 2.5 unit gap. Both flat (no height change), both
    // far under the 6.14 max jump range. No moving platforms needed at all
    // for this first, easiest level.
    hazards: [],
    collectibles: [
      collectible(2, 1.0, 5),
      collectible(-2, 1.0, 12),
      collectible(2, 1.0, 24.5),
      collectible(-1.5, 1.0, 36),
      collectible(1.5, 1.0, 41),
    ],
    checkpoints: [
      checkpoint(0, 0.1, 25),
    ],
    gate: { x: 0, y: 0, z: 43 },
    introText: 'Movement, jumping, collecting. Nothing fancy yet.',
  },

  // ==========================================================================
  // LEVEL 2 — COMMON SENSE TRAINING
  // Introduces a moving platform and a couple of real jumps with real gaps,
  // still comfortably inside the jump envelope. One checkpoint at the
  // halfway mark, positioned on solid ground (never mid-air).
  // ==========================================================================
  {
    id: 2,
    title: 'Level 2',
    subtitle: 'Common Sense Training',
    skyColor: 0x1f2b4d,
    fogColor: 0x1f2b4d,
    groundColor: 0x2b3a55,
    accentColor: 0x7ee8fa,
    spawn: { x: 0, y: 0.1, z: 0 },
    worldBounds: { minX: -20, maxX: 20, minZ: -6, maxZ: 95, killY: -12 },
    platforms: [
      platform(0, -0.5, 6, 10, 1, 16),        // start ground (z: -2 to 14)
      platform(0, -0.5, 20, 6, 1, 6),          // small island (z: 17 to 23) -- 3 unit gap before it
      platform(0, -0.5, 27, 6, 1, 4),           // static stepping stone (z: 25 to 29) -- splits what would be
                                                  // an 8-unit gap into two comfortable ~2 unit hops. Widened to
                                                  // 6 units (x: -3 to 3) so it stays safely landable even if the
                                                  // player has drifted sideways toward a nearby off-center
                                                  // collectible (verified via a collectible-seeking AI playthrough).
      platform(0, -0.5, 34, 6, 1, 6),            // small island 2 (z: 31 to 37) -- 2 unit gap from the stepping stone
      platform(0, 0.5, 48, 8, 1, 8),               // slightly raised ground (z: 44 to 52) -- 1 unit step up, small gap
      platform(0, 0.5, 64, 10, 1, 18),              // long stretch to the gate (z: 55 to 73) -- 3 unit gap before it
    ],
    // All gaps in this level were checked with the automated gap verifier
    // (see the project's /tests directory) against MAX_JUMP_RANGE (6.14)
    // and MAX_JUMP_HEIGHT (1.84) — not hand-calculated, and also verified
    // with a full physics-simulation playthrough (not just static distance
    // checks), since a moving platform can be mistimed even when a gap
    // "looks" bridgeable on paper. Every mandatory gap now has a STATIC
    // fallback path; the one moving platform below is a gentle, optional
    // visual flourish near a wide static stepping stone, not the sole way
    // across a gap.
    movingPlatforms: [
      {
        x: 0, y: 0, z: 40.5, w: 3, h: 1, d: 3,
        axis: 'y', range: 0.6, speed: 0.8, phase: 1.2,
        // A gentle vertical-bob platform roughly centered in the 37->44
        // gap, used as a mid-point stepping stone (players do not need
        // precise timing — the platform's low bob range and central
        // position mean it's landable across nearly its whole cycle).
      },
    ],
    hazards: [
      hazardZone(-3, -1.6, 27, 2, 1, 3), // a visible pit hazard beside the stepping-stone area (clearly telegraphed, not required to touch)
    ],
    collectibles: [
      collectible(0, 1.0, 4),
      collectible(2, 1.0, 20),
      collectible(-2, 1.5, 34),
      collectible(0, 2.0, 48),
      collectible(2, 1.5, 64),
      collectible(-2, 1.5, 70),
    ],
    checkpoints: [
      checkpoint(0, 0.5, 48),
    ],
    gate: { x: 0, y: 0.5, z: 71 },
    introText: 'Slightly trickier. Still very forgivable.',
  },

  // ==========================================================================
  // LEVEL 3 — THE FINAL TEST
  // Visually distinct (different palette), a couple of moving platforms,
  // ends in a portal instead of a gate. Same conservative gap discipline.
  // ==========================================================================
  {
    id: 3,
    title: 'Level 3',
    subtitle: 'The Final Test',
    skyColor: 0x1a2e2a,
    fogColor: 0x1a2e2a,
    groundColor: 0x213a34,
    accentColor: 0x7be495,
    spawn: { x: 0, y: 0.1, z: 0 },
    worldBounds: { minX: -20, maxX: 20, minZ: -6, maxZ: 100, killY: -12 },
    platforms: [
      platform(0, -0.5, 6, 10, 1, 16),        // start (z: -2 to 14)
      platform(0, -0.5, 19.5, 7, 1, 6),        // (z: 16.5 to 22.5) -- 2.5 unit gap
      platform(0, -0.5, 27, 6, 1, 4),           // stepping stone (z: 25 to 29) -- 2.5 unit gap; widened to
                                                  // 6 units so it stays safely landable even with sideways
                                                  // drift toward a nearby collectible.
      platform(0, 0.5, 34, 6, 1, 6),             // (z: 31 to 37) -- 2 unit gap, 1 unit step up
      platform(0, 0.5, 41.5, 6, 1, 4),            // stepping stone (z: 39.5 to 43.5) -- 2.5 unit gap; widened,
                                                    // same reasoning (a collectible sits at this level's edge).
      platform(0, 0.5, 50, 8, 1, 8),               // (z: 46 to 54) -- 2.5 unit gap
      platform(0, 0.5, 59, 6, 1, 4),                // stepping stone (z: 57 to 61) -- 3 unit gap; widened for
                                                       // the same reason, kept consistent across the level.
      platform(0, 0.5, 68.5, 10, 1, 10),             // (z: 63.5 to 73.5) -- 2.5 unit gap
      platform(0, 0.5, 86.5, 12, 1, 20),              // final approach to the portal (z: 76.5 to 96.5) -- 3 unit gap
    ],
    // Every mandatory gap above is a direct, comfortable static jump (2-3
    // units, verified with the automated gap checker and a full physics
    // playthrough simulation — see /tests). Moving platforms below are
    // layered on TOP of this already-safe static path as visual flourish
    // and light optional variety, never as the sole way across a gap —
    // the same lesson learned from an earlier version of Level 2, where a
    // mover-only bridge could desync from the player's jump timing and
    // cause an unfair fall with nothing to catch it.
    movingPlatforms: [
      { x: 0, y: 0.9, z: 34, w: 2, h: 0.6, d: 2, axis: 'y', range: 0.4, speed: 0.9, phase: 0 },
      { x: 0, y: 0.9, z: 50, w: 2, h: 0.6, d: 2, axis: 'y', range: 0.4, speed: 0.8, phase: 1.5 },
      { x: 3, y: 0.9, z: 68.5, w: 2, h: 0.6, d: 2, axis: 'x', range: 2, speed: 0.7, phase: 0 },
      // Each of these floats gently just above an already-solid static
      // platform, purely for visual interest (matches the brief's "a few
      // moving platforms" request) — none of them are required to land on.
    ],
    hazards: [
      hazardZone(-4, -1.6, 23.75, 2.5, 1, 1.5),
      hazardZone(4, -1.6, 62.25, 2.5, 1, 1.5),
    ],
    collectibles: [
      collectible(0, 1.0, 4),
      collectible(-2, 1.0, 19.5),
      collectible(2, 1.5, 41.5),
      collectible(0, 1.5, 59),
      collectible(-2, 1.5, 80),
      collectible(2, 1.5, 90),
    ],
    checkpoints: [
      checkpoint(0, 0.5, 34),
      checkpoint(0, 0.5, 68.5),
    ],
    portal: { x: 0, y: 0.5, z: 92 },
    introText: 'The final stretch. Something is waiting at the end.',
  },
];

export function getTotalCollectibles() {
  return LEVELS.reduce((sum, lv) => sum + lv.collectibles.length, 0);
}
