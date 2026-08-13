// levels.js
// Declarative level data. All jump gaps/heights here are designed to be
// well within the safe envelope computed by physics.js:
//   safe horizontal gap  <= ~3.9 units (we target 2.0-3.2)
//   safe height step     <= ~2.25 units (we target <=1.8)
// See validate-levels.mjs for automated distance checks against every
// consecutive platform pair.

export const PALETTES = {
  level1: {
    platformTop: 0xf4c98a,
    platformSide: 0xd9a55f,
    trim: 0xffe9b0,
    hazard: 0xff6a3d,
    collectible: 0xffe27a,
    collectibleRing: 0xfff4cc,
    checkpointOff: 0x9fb6c9,
    checkpointOn: 0x7be08a,
    gateArch: 0xb9812f,
    gateRing: 0xffd97a,
    portalArch: 0xb9812f,
    portalRing: 0xffd97a,
    decoration: 0xffdca6,
    fog: 0xffd9a0,
    sky: [0xffdca6, 0xff9a56],
    ground: 0xe8b979,
  },
  level2: {
    platformTop: 0x8fb2d9,
    platformSide: 0x5c7fa8,
    trim: 0xbfe3ff,
    hazard: 0x7c3aed,
    collectible: 0x8ce6ff,
    collectibleRing: 0xd6f7ff,
    checkpointOff: 0x9fb6c9,
    checkpointOn: 0x7be08a,
    gateArch: 0x4a6a8f,
    gateRing: 0x8ce6ff,
    portalArch: 0x4a6a8f,
    portalRing: 0x8ce6ff,
    decoration: 0xbcd6f2,
    fog: 0x4a5f7a,
    sky: [0x2c3e5c, 0x6c8fb5],
    ground: 0x3f5872,
  },
  level3: {
    platformTop: 0x6a4a9e,
    platformSide: 0x462f6e,
    trim: 0xd9a4ff,
    hazard: 0xff2d7a,
    collectible: 0xffd1f0,
    collectibleRing: 0xffffff,
    checkpointOff: 0x9fb6c9,
    checkpointOn: 0x7be08a,
    gateArch: 0x7a4fae,
    gateRing: 0xe6b8ff,
    portalArch: 0x9b5fd6,
    portalRing: 0xffe6ff,
    decoration: 0xc9a0ff,
    fog: 0x2a1a4a,
    sky: [0x1a0f33, 0x4a2a6e],
    ground: 0x3a2560,
  },
};

// ---------------------------------------------------------------
// LEVEL 1 — "The Search for Common Sense"
// Warm, welcoming, teaches: move, jump small gaps, step up, collect,
// checkpoint, gate. 2 collectibles.
// ---------------------------------------------------------------
export const LEVEL_1 = {
  id: 1,
  title: 'THE SEARCH FOR COMMON SENSE',
  spawn: { x: 0, y: 1.0, z: 0 },
  platforms: [
    { x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },          // start platform
    { x: 0, y: 0, z: -5.2, w: 3.4, h: 1, d: 3 },      // step forward
    { x: 0, y: 0.5, z: -9.6, w: 3.2, h: 1, d: 3 },    // small step up
    { x: 2.6, y: 0.5, z: -13.4, w: 3, h: 1, d: 3 },   // gentle turn right
    { x: 2.6, y: 1.0, z: -17.2, w: 3, h: 1, d: 3 },   // step up
    { x: -0.4, y: 1.0, z: -20.6, w: 3, h: 1, d: 3 },  // turn left
    { x: -0.4, y: 1.0, z: -25.5, w: 5, h: 1, d: 4.5 }, // checkpoint plaza
    { x: -0.4, y: 1.4, z: -29.6, w: 3, h: 1, d: 3 },  // small step
    { x: 2.2, y: 1.4, z: -33.2, w: 2.8, h: 1, d: 2.8 },
    { x: 2.2, y: 1.8, z: -36.9, w: 2.8, h: 1, d: 2.8 },
    { x: -0.6, y: 1.8, z: -40.4, w: 2.8, h: 1, d: 2.8 },
    { x: -0.6, y: 1.8, z: -44.6, w: 6, h: 1, d: 5 },   // gate plaza
  ],
  hazards: [
    { x: 0, y: -1.5, z: -7.4, w: 2.4, h: 0.2, d: 2.2 },
    { x: 1.3, y: -1.0, z: -11.5, w: 2.2, h: 0.2, d: 2.0 },
    { x: 1.1, y: -0.7, z: -15.3, w: 2.0, h: 0.2, d: 2.0 },
    { x: 1.1, y: -0.2, z: -18.9, w: 2.0, h: 0.2, d: 2.0 },
    { x: -0.4, y: -0.4, z: -27.55, w: 1.8, h: 0.2, d: 1.6 },
    { x: 0.8, y: -0.05, z: -31.4, w: 1.8, h: 0.2, d: 1.6 },
    { x: 2.2, y: 0.35, z: -35.05, w: 1.6, h: 0.2, d: 1.6 },
    { x: 0.8, y: 0.35, z: -38.65, w: 1.8, h: 0.2, d: 1.8 },
  ],
  collectibles: [
    { id: 'l1-a', x: 2.6, y: 1.9, z: -17.2 },
    { id: 'l1-b', x: 2.2, y: 2.7, z: -36.9 },
  ],
  checkpoints: [
    { id: 'l1-cp1', x: -0.4, y: 1.5, z: -25.5 },
  ],
  gate: { x: -0.6, y: 0, z: -46.6, rotY: 0 },
  decorations: [
    { type: 'cloud', x: -6, y: 5, z: -15, r: 1.1, color: 0xffe9c9 },
    { type: 'cloud', x: 6, y: 6, z: -28, r: 1.4, color: 0xffe9c9 },
    { type: 'cloud', x: -5, y: 4.5, z: -38, r: 0.9, color: 0xffe9c9 },
  ],
};

// ---------------------------------------------------------------
// LEVEL 2 — "Things Are Getting Questionable"
// Cooler palette, introduces moving platforms + longer gaps. 2 collectibles.
// ---------------------------------------------------------------
export const LEVEL_2 = {
  id: 2,
  title: 'THINGS ARE GETTING QUESTIONABLE',
  spawn: { x: 0, y: 1.0, z: 0 },
  platforms: [
    { x: 0, y: 0, z: 0, w: 5.5, h: 1, d: 5.5 },
    { x: 0, y: 0, z: -4.8, w: 3, h: 1, d: 2.8 },
    { x: 0, y: 0.3, z: -8.6, w: 2.6, h: 1, d: 2.6, moving: { axis: 'x', range: 1.9, speed: 1.1 } },
    { x: 0, y: 0.6, z: -12.6, w: 2.8, h: 1, d: 2.8 },
    { x: 2.9, y: 0.9, z: -16.2, w: 2.6, h: 1, d: 2.6 },
    { x: 2.9, y: 0.9, z: -20.0, w: 2.6, h: 1, d: 2.6, moving: { axis: 'x', range: 1.6, speed: 1.3, phase: 1.5 } },
    { x: 2.9, y: 1.3, z: -23.8, w: 2.8, h: 1, d: 2.8 },
    { x: -0.2, y: 1.3, z: -27.4, w: 3, h: 1, d: 3 },
    { x: -0.2, y: 1.3, z: -31.0, w: 5, h: 1, d: 4.4 }, // checkpoint plaza
    { x: -0.2, y: 1.6, z: -35.0, w: 2.6, h: 1, d: 2.6, moving: { axis: 'y', range: 0.55, speed: 1.6 } },
    { x: -0.2, y: 2.1, z: -38.6, w: 2.6, h: 1, d: 2.6 },
    { x: 2.6, y: 2.1, z: -42.2, w: 2.4, h: 1, d: 2.4 },
    { x: 2.6, y: 2.4, z: -45.9, w: 2.4, h: 1, d: 2.4, moving: { axis: 'x', range: 1.5, speed: 1.0, phase: 2.4 } },
    { x: -0.4, y: 2.4, z: -49.5, w: 2.6, h: 1, d: 2.6 },
    { x: -0.4, y: 2.4, z: -53.6, w: 6, h: 1, d: 5 }, // gate plaza
  ],
  hazards: [
    { x: 0, y: -1.4, z: -6.7, w: 2.0, h: 0.2, d: 1.8 },
    { x: 0, y: -1.1, z: -10.6, w: 2.0, h: 0.2, d: 2.0 },
    { x: 1.5, y: -0.8, z: -14.4, w: 2.2, h: 0.2, d: 2.0 },
    { x: 2.9, y: -0.4, z: -18.1, w: 1.8, h: 0.2, d: 1.6 },
    { x: 1.4, y: -0.05, z: -22.0, w: 2.2, h: 0.2, d: 2.0 },
    { x: 1.4, y: 0.5, z: -25.6, w: 2.2, h: 0.2, d: 2.0 },
    { x: -0.2, y: 0.85, z: -33.0, w: 2.0, h: 0.2, d: 1.8 },
    { x: -0.2, y: 1.35, z: -36.8, w: 1.8, h: 0.2, d: 1.6 },
    { x: 1.2, y: 1.65, z: -40.4, w: 2.0, h: 0.2, d: 1.8 },
    { x: 2.6, y: 2.15, z: -44.05, w: 1.6, h: 0.2, d: 1.6 },
    { x: 1.1, y: 2.35, z: -47.7, w: 2.4, h: 0.2, d: 2.0 },
  ],
  collectibles: [
    { id: 'l2-a', x: 2.9, y: 1.9, z: -23.8 },
    { id: 'l2-b', x: -0.2, y: 2.9, z: -38.6 },
  ],
  checkpoints: [
    { id: 'l2-cp1', x: -0.2, y: 1.8, z: -31.0 },
  ],
  gate: { x: -0.4, y: 0, z: -55.7, rotY: 0 },
  decorations: [
    { type: 'crystal', x: -5.5, y: 2.5, z: -18, r: 0.7, color: 0x8ce6ff, emissive: true },
    { type: 'crystal', x: 5.5, y: 3.0, z: -32, r: 0.9, color: 0x8ce6ff, emissive: true },
    { type: 'crystal', x: -5, y: 3.5, z: -46, r: 0.6, color: 0x8ce6ff, emissive: true },
    { type: 'cloud', x: 6, y: 6, z: -20, r: 1.3, color: 0x6c8fb5 },
  ],
};

// ---------------------------------------------------------------
// LEVEL 3 — "Final Common Sense Test"
// Dramatic/magical, tightest but still fair platforming. 1 collectible
// (total across all 3 levels = 5, matching spec's "sensible" count).
// ---------------------------------------------------------------
export const LEVEL_3 = {
  id: 3,
  title: 'FINAL COMMON SENSE TEST',
  spawn: { x: 0, y: 1.0, z: 0 },
  platforms: [
    { x: 0, y: 0, z: 0, w: 5.5, h: 1, d: 5.5 },
    { x: 0, y: 0.2, z: -4.6, w: 2.6, h: 1, d: 2.6 },
    { x: 2.7, y: 0.5, z: -8.2, w: 2.4, h: 1, d: 2.4, moving: { axis: 'x', range: 1.7, speed: 1.2 } },
    { x: 2.7, y: 0.8, z: -11.8, w: 2.4, h: 1, d: 2.4 },
    { x: -0.2, y: 1.1, z: -15.3, w: 2.4, h: 1, d: 2.4, moving: { axis: 'z', range: 1.1, speed: 1.4 } },
    { x: -0.2, y: 1.4, z: -19.0, w: 2.6, h: 1, d: 2.6 },
    { x: -0.2, y: 1.4, z: -22.8, w: 5, h: 1, d: 4.2 }, // checkpoint plaza
    { x: 2.5, y: 1.7, z: -26.4, w: 2.3, h: 1, d: 2.3 },
    { x: 2.5, y: 2.0, z: -30.0, w: 2.3, h: 1, d: 2.3, moving: { axis: 'y', range: 0.6, speed: 1.7, phase: 1 } },
    { x: -0.4, y: 2.3, z: -33.6, w: 2.4, h: 1, d: 2.4 },
    { x: -0.4, y: 2.3, z: -37.2, w: 2.4, h: 1, d: 2.4, moving: { axis: 'x', range: 1.6, speed: 1.3, phase: 3 } },
    { x: 2.4, y: 2.6, z: -40.8, w: 2.3, h: 1, d: 2.3 },
    { x: 2.4, y: 2.9, z: -44.4, w: 2.3, h: 1, d: 2.3, moving: { axis: 'z', range: 1.0, speed: 1.5 } },
    { x: -0.2, y: 3.1, z: -47.9, w: 6.2, h: 1, d: 5.2 }, // portal plaza
  ],
  hazards: [
    { x: 0, y: -1.2, z: -2.4, w: 1.6, h: 0.2, d: 1.2 },
    { x: 1.3, y: -0.9, z: -6.4, w: 1.7, h: 0.2, d: 1.3 },
    { x: 2.7, y: -0.5, z: -10.0, w: 1.4, h: 0.2, d: 1.0 },
    { x: 1.3, y: -0.15, z: -13.55, w: 1.6, h: 0.2, d: 1.1 },
    { x: -0.2, y: 0.45, z: -17.15, w: 1.5, h: 0.2, d: 1.0 },
    { x: 1.1, y: 0.95, z: -20.9, w: 1.6, h: 0.2, d: 1.1 },
    { x: 2.5, y: 2.15, z: -28.2, w: 1.2, h: 0.2, d: 0.9 },
    { x: 1.0, y: 2.65, z: -31.8, w: 1.3, h: 0.2, d: 0.9 },
    { x: -0.4, y: 2.65, z: -35.4, w: 1.2, h: 0.2, d: 0.9 },
    { x: 1.0, y: 2.95, z: -39.0, w: 1.3, h: 0.2, d: 0.9 },
    { x: 2.4, y: 3.25, z: -42.6, w: 1.2, h: 0.2, d: 0.9 },
  ],
  collectibles: [
    { id: 'l3-a', x: -0.2, y: 2.0, z: -22.8 },
  ],
  checkpoints: [
    { id: 'l3-cp1', x: -0.2, y: 1.9, z: -22.8 },
  ],
  portal: { x: -0.2, y: 0, z: -49.9, rotY: 0 },
  decorations: [
    { type: 'crystal', x: -5.5, y: 3.5, z: -14, r: 0.8, color: 0xe6b8ff, emissive: true },
    { type: 'crystal', x: 5.5, y: 4.5, z: -28, r: 1.0, color: 0xe6b8ff, emissive: true },
    { type: 'crystal', x: -5.5, y: 5.0, z: -40, r: 0.9, color: 0xe6b8ff, emissive: true },
    { type: 'cloud', x: 6, y: 7, z: -22, r: 1.5, color: 0x6a4a9e },
  ],
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

export const TOTAL_COMMON_SENSE = LEVELS.reduce((sum, lvl) => sum + (lvl.collectibles?.length || 0), 0);
