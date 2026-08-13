// levels.js
// Declarative 2D level data. Coordinates are world pixels; ground/
// platforms use standard canvas convention: (x,y) = top-left corner,
// +y is DOWN. Levels scroll left-to-right (Mario-style): the player
// starts near x=0 and the exit gate/portal sits at the far right.
//
// Jump gaps/height-steps are designed within the safe envelope computed
// by physics.js (isJumpAchievable): safe gap <= ~66px, safe height
// step <= ~55px. See validate-levels.mjs for automated checks.

export const PALETTES = {
  level1: {
    sky: ['#ffdca6', '#ff9a56'],
    ground: '#d9a55f',
    groundTop: '#f4c98a',
    trim: '#ffe9b0',
    hazard: '#ff6a3d',
    hazardGlow: 'rgba(255,106,61,0.4)',
    collectible: '#ffe27a',
    checkpointOff: '#9fb6c9',
    checkpointOn: '#7be08a',
    gate: '#ffd97a',
    gateFrame: '#b9812f',
    decoration: '#ffcf8f',
    fog: 'rgba(255,220,166,0)',
  },
  level2: {
    sky: ['#5b7fa8', '#2c3e5c'],
    ground: '#3f5872',
    groundTop: '#6f93b8',
    trim: '#bfe3ff',
    hazard: '#7c3aed',
    hazardGlow: 'rgba(124,58,237,0.4)',
    collectible: '#8ce6ff',
    checkpointOff: '#9fb6c9',
    checkpointOn: '#7be08a',
    gate: '#8ce6ff',
    gateFrame: '#4a6a8f',
    decoration: '#bcd6f2',
    fog: 'rgba(44,62,92,0)',
  },
  level3: {
    sky: ['#4a2a6e', '#1a0f33'],
    ground: '#3a2560',
    groundTop: '#5e3f96',
    trim: '#d9a4ff',
    hazard: '#ff2d7a',
    hazardGlow: 'rgba(255,45,122,0.45)',
    collectible: '#ffd1f0',
    checkpointOff: '#9fb6c9',
    checkpointOn: '#7be08a',
    gate: '#e6b8ff',
    gateFrame: '#7a4fae',
    decoration: '#c9a0ff',
    fog: 'rgba(26,15,51,0)',
  },
};

// Ground height is measured as the Y coordinate of the walkable top
// surface. Platforms are {x, y, w, h}. Gaps are simply absent ground
// segments (a hazard fills the visual gap).

const GROUND_Y = 480; // baseline ground surface y for "on the ground" segments

// ---------------------------------------------------------------
// LEVEL 1 -- "The Search for Common Sense"
// Warm, welcoming. Teaches: run, jump small gaps, step up, collect,
// checkpoint, gate. 2 collectibles.
// ---------------------------------------------------------------
export const LEVEL_1 = {
  id: 1,
  title: 'THE SEARCH FOR COMMON SENSE',
  spawn: { x: 40, y: GROUND_Y },
  levelWidth: 2350,
  groundY: GROUND_Y,
  platforms: [
    { x: 0, y: GROUND_Y, w: 260, h: 40 },
    { x: 320, y: GROUND_Y, w: 180, h: 40 },
    { x: 560, y: GROUND_Y - 40, w: 140, h: 40 },
    { x: 760, y: GROUND_Y - 40, w: 160, h: 40 },
    { x: 980, y: GROUND_Y - 80, w: 120, h: 40 },
    { x: 1160, y: GROUND_Y - 40, w: 160, h: 40 },
    { x: 1380, y: GROUND_Y, w: 300, h: 40 },  // checkpoint plaza
    { x: 1740, y: GROUND_Y - 40, w: 130, h: 40 },
    { x: 1930, y: GROUND_Y - 80, w: 130, h: 40 },
    { x: 2120, y: GROUND_Y - 40, w: 230, h: 40 }, // gate plaza
  ],
  hazards: [
    { x: 260, y: 530, w: 60, h: 30 },
    { x: 500, y: 490, w: 60, h: 30 },
    { x: 700, y: 490, w: 60, h: 30 },
    { x: 920, y: 450, w: 60, h: 30 },
    { x: 1100, y: 450, w: 60, h: 30 },
    { x: 1680, y: 490, w: 60, h: 30 },
    { x: 1870, y: 450, w: 60, h: 30 },
    { x: 2060, y: 450, w: 60, h: 30 },
  ],
  collectibles: [
    { id: 'l1-a', x: 410, y: 435 },
    { id: 'l1-b', x: 630, y: 395 },
    { id: 'l1-c', x: 830, y: 395 },
    { id: 'l1-d', x: 1040, y: 355 },
    { id: 'l1-e', x: 1805, y: 395 },
  ],
  checkpoints: [
    { id: 'l1-cp1', x: 1530, y: GROUND_Y },
  ],
  gate: { x: 2290, y: GROUND_Y - 40 },
  decorations: [
    { type: 'cloud', x: 200, y: 90, r: 30 },
    { type: 'cloud', x: 700, y: 60, r: 40 },
    { type: 'cloud', x: 1300, y: 100, r: 25 },
    { type: 'cloud', x: 1850, y: 70, r: 35 },
  ],
};

// ---------------------------------------------------------------
// LEVEL 2 -- "Things Are Getting Questionable"
// Cooler palette, moving platforms, longer gaps. 2 collectibles.
// ---------------------------------------------------------------
export const LEVEL_2 = {
  id: 2,
  title: 'THINGS ARE GETTING QUESTIONABLE',
  spawn: { x: 40, y: GROUND_Y },
  levelWidth: 2350,
  groundY: GROUND_Y,
  platforms: [
    { x: 0, y: 480, w: 220, h: 40 },
    { x: 268, y: 450, w: 140, h: 40 },
    { x: 456, y: 410, w: 110, h: 40, moving: { axis: 'x', range: 32, speed: 0.9 } },
    { x: 614, y: 375, w: 130, h: 40 },
    { x: 792, y: 420, w: 120, h: 40 },
    { x: 960, y: 420, w: 100, h: 40, moving: { axis: 'x', range: 28, speed: 1.0, phase: 1.5 } },
    { x: 1108, y: 380, w: 130, h: 40 },
    { x: 1286, y: 380, w: 260, h: 40 }, // checkpoint plaza
    { x: 1594, y: 340, w: 110, h: 40, moving: { axis: 'y', range: 25, speed: 1.4 } },
    { x: 1752, y: 305, w: 120, h: 40 },
    { x: 1920, y: 340, w: 100, h: 40, moving: { axis: 'x', range: 45, speed: 1.0, phase: 2.4 } },
    { x: 2068, y: 340, w: 250, h: 40 }, // gate plaza
  ],
  hazards: [
    { x: 220, y: 500, w: 48, h: 30 },
    { x: 408, y: 460, w: 48, h: 30 },
    { x: 744, y: 425, w: 48, h: 30 },
    { x: 912, y: 470, w: 48, h: 30 },
    { x: 1238, y: 430, w: 48, h: 30 },
    { x: 1872, y: 355, w: 48, h: 30 },
  ],
  collectibles: [
    { id: 'l2-a', x: 679, y: 335 },
    { id: 'l2-b', x: 1812, y: 265 },
    { id: 'l2-c', x: 511, y: 365 },
    { id: 'l2-d', x: 852, y: 375 },
    { id: 'l2-e', x: 1173, y: 335 },
    { id: 'l2-f', x: 1970, y: 295 },
  ],
  checkpoints: [
    { id: 'l2-cp1', x: 1416, y: 380 },
  ],
  gate: { x: 2260, y: 340 },
  decorations: [
    { type: 'star', x: 250, y: 80 },
    { type: 'star', x: 800, y: 50 },
    { type: 'star', x: 1400, y: 90 },
    { type: 'star', x: 1950, y: 60 },
  ],
};

// ---------------------------------------------------------------
// LEVEL 3 -- "Final Common Sense Test"
// Dramatic/magical, tightest but still fair. 1 collectible (total
// across all 3 levels = 5).
// ---------------------------------------------------------------
export const LEVEL_3 = {
  id: 3,
  title: 'FINAL COMMON SENSE TEST',
  spawn: { x: 40, y: GROUND_Y },
  levelWidth: 2180,
  groundY: GROUND_Y,
  platforms: [
    { x: 0, y: 480, w: 200, h: 40 },
    { x: 246, y: 440, w: 110, h: 40 },
    { x: 402, y: 400, w: 100, h: 40, moving: { axis: 'x', range: 40, speed: 1.1 } },
    { x: 548, y: 360, w: 110, h: 40 },
    { x: 704, y: 400, w: 100, h: 40, moving: { axis: 'y', range: 25, speed: 1.3 } },
    { x: 850, y: 360, w: 110, h: 40 },
    { x: 1006, y: 360, w: 240, h: 40 }, // checkpoint plaza
    { x: 1292, y: 325, w: 100, h: 40 },
    { x: 1438, y: 285, w: 100, h: 40, moving: { axis: 'x', range: 40, speed: 1.2, phase: 3 } },
    { x: 1584, y: 325, w: 100, h: 40 },
    { x: 1730, y: 285, w: 100, h: 40, moving: { axis: 'y', range: 25, speed: 1.5 } },
    { x: 1876, y: 250, w: 260, h: 40 }, // portal plaza
  ],
  hazards: [
    { x: 200, y: 490, w: 46, h: 30 },
    { x: 356, y: 450, w: 46, h: 30 },
    { x: 658, y: 410, w: 46, h: 30 },
    { x: 960, y: 410, w: 46, h: 30 },
    { x: 1246, y: 375, w: 46, h: 30 },
    { x: 1538, y: 335, w: 46, h: 30 },
    { x: 1684, y: 335, w: 46, h: 30 },
  ],
  collectibles: [
    { id: 'l3-a', x: 1126, y: 315 },
    { id: 'l3-b', x: 301, y: 398 },
    { id: 'l3-c', x: 603, y: 318 },
    { id: 'l3-d', x: 905, y: 318 },
    { id: 'l3-e', x: 1488, y: 243 },
    { id: 'l3-f', x: 1780, y: 243 },
  ],
  checkpoints: [
    { id: 'l3-cp1', x: 1100, y: 360 },
  ],
  portal: { x: 2006, y: 250 },
  decorations: [
    { type: 'crystal', x: 320, y: 340 },
    { type: 'crystal', x: 950, y: 300 },
    { type: 'crystal', x: 1600, y: 260 },
    { type: 'star', x: 450, y: 90 },
    { type: 'star', x: 1200, y: 70 },
    { type: 'star', x: 1800, y: 100 },
  ],
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];
export const TOTAL_COMMON_SENSE = LEVELS.reduce((sum, l) => sum + (l.collectibles?.length || 0), 0);
