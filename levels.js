/* ==========================================================================
   LEVELS.JS — Level layouts and content. Edit the arrays below to change
   level difficulty, add platforms, or move collectibles. Coordinates are
   in world pixels; ground level per-level is defined by platform Y values.
   See README "Where I can change level difficulty" for guidance.
   ========================================================================== */

// Small joke lines shown as toasts inside levels. Feel free to add your own —
// see README "Where I can add/edit jokes".
const AMBIENT_JOKES = [
  "COMMON SENSE DETECTED.",
  "Attempting installation…",
  "Installation failed.",
  "Maybe next level.",
  "Mayank has been notified.",
  "Mayank is not surprised.",
  "Recalculating expectations…",
  "This orb looked more promising than it was.",
  "Common Sense.exe stopped responding.",
  "Still zero. Impressively consistent.",
];

function makePlatform(x, y, w, h = 26, options = {}) {
  return { type: 'static', x, y, w, h, ...options };
}

function makeMovingPlatform(x, y, w, h, path) {
  // path: { axis: 'x'|'y', range: number, speed: number }
  return {
    type: 'moving', x, y, w, h,
    baseX: x, baseY: y,
    axis: path.axis, range: path.range, speed: path.speed,
    phase: path.phase || 0
  };
}

function makeCollectible(x, y) {
  return { x, y, collected: false, id: `${x}_${y}`, bob: Math.random() * Math.PI * 2 };
}

function makeSpike(x, y, w = 26, h = 18) {
  return { x, y, w, h, type: 'spike' };
}

const LEVELS = [
  // ==========================================================================
  // LEVEL 1 — THE SEARCH BEGINS
  // ==========================================================================
  {
    id: 1,
    title: 'The Search Begins',
    subtitle: 'A colorful world. Somewhere in it: Common Sense.',
    theme: { skyTop: '#2c1f4d', skyBottom: '#4a3170', ground: '#3a2b55', groundTop: '#5c3f7a', accent: '#ffd166' },
    worldWidth: 2200,
    groundY: 520,
    spawn: { x: 100, y: 500 },
    exit: { x: 2080, y: 460, w: 60, h: 90 },
    platforms: [
      makePlatform(-100, 520, 2400, 200), // main ground
      makePlatform(500, 420, 160),
      makePlatform(850, 360, 140),
      makePlatform(1150, 440, 180),
      makePlatform(1500, 380, 150),
      makePlatform(1800, 460, 200),
    ],
    movingPlatforms: [],
    spikes: [],
    collectibles: [
      makeCollectible(300, 470), makeCollectible(560, 370),
      makeCollectible(900, 310), makeCollectible(1200, 390),
      makeCollectible(1550, 330), makeCollectible(1850, 410),
      makeCollectible(2000, 460),
    ],
    checkpoints: [700, 1300, 1750],
    introJokes: [
      { text: 'Somewhere out there, Common Sense is waiting.', delay: 300 },
      { text: 'Statistically, it should be easy to find.', delay: 2600, dim: true },
    ]
  },

  // ==========================================================================
  // LEVEL 2 — COMMON SENSE IS DEFINITELY AROUND HERE
  // ==========================================================================
  {
    id: 2,
    title: 'Common Sense Is Definitely Around Here',
    subtitle: 'Simple platforming. Very findable. Probably.',
    theme: { skyTop: '#1f2b4d', skyBottom: '#31447a', ground: '#2b3a55', groundTop: '#3f5c7a', accent: '#7ee8fa' },
    worldWidth: 2600,
    groundY: 520,
    spawn: { x: 100, y: 500 },
    exit: { x: 2500, y: 400, w: 60, h: 90 },
    platforms: [
      makePlatform(-100, 520, 500, 200),
      makePlatform(520, 520, 220, 200),
      makePlatform(880, 520, 260, 200),
      makePlatform(1280, 520, 200, 200),
      makePlatform(1620, 520, 300, 200),
      makePlatform(2060, 520, 540, 200),
      // floating platforms for verticality + collectible placement
      makePlatform(650, 400, 130),
      makePlatform(950, 340, 130),
      makePlatform(1350, 420, 140),
      makePlatform(1750, 380, 150),
      makePlatform(2150, 300, 150),
      makePlatform(2380, 440, 160),
    ],
    movingPlatforms: [],
    spikes: [
      makeSpike(470, 502), makeSpike(800, 502), makeSpike(1200, 502),
      makeSpike(1560, 502), makeSpike(2000, 502),
    ],
    collectibles: [
      makeCollectible(700, 350), makeCollectible(1000, 290),
      makeCollectible(1400, 370), makeCollectible(1800, 330),
      makeCollectible(2200, 250), makeCollectible(2420, 390),
    ],
    checkpoints: [900, 1700, 2100],
    introJokes: [
      { text: 'Small gaps ahead. Nothing Common Sense would fear.', delay: 300 },
    ]
  },

  // ==========================================================================
  // LEVEL 3 — THE PARKOUR ERA
  // ==========================================================================
  {
    id: 3,
    title: 'The Parkour Era',
    subtitle: 'Visually impressive. Mechanically forgiving.',
    theme: { skyTop: '#4a1f3d', skyBottom: '#7a3160', ground: '#552b45', groundTop: '#7a3f60', accent: '#ff6fa5' },
    worldWidth: 2900,
    groundY: 560,
    spawn: { x: 100, y: 540 },
    exit: { x: 2800, y: 380, w: 60, h: 90 },
    platforms: [
      makePlatform(-100, 560, 420, 200),
      makePlatform(500, 480, 130),
      makePlatform(760, 420, 120),
      makePlatform(1000, 480, 120),
      makePlatform(1260, 400, 130),
      makePlatform(1560, 460, 300, 60), // checkpoint rest platform
      makePlatform(2020, 380, 120),
      makePlatform(2260, 440, 120),
      makePlatform(2500, 430, 140),
      makePlatform(2700, 460, 300, 200),
    ],
    movingPlatforms: [
      makeMovingPlatform(1900, 420, 110, 20, { axis: 'y', range: 90, speed: 1.1 }),
      makeMovingPlatform(2380, 500, 110, 20, { axis: 'x', range: 80, speed: 1.4, phase: 1.5 }),
    ],
    spikes: [],
    collectibles: [
      makeCollectible(560, 430), makeCollectible(820, 370),
      makeCollectible(1060, 430), makeCollectible(1320, 350),
      makeCollectible(1700, 400), makeCollectible(2080, 330),
      makeCollectible(2320, 390), makeCollectible(2560, 340),
    ],
    checkpoints: [760, 1560, 2260],
    introJokes: [
      { text: 'Parkour tutorial: jump when there is a gap.', delay: 300 },
      { text: 'That is the whole tutorial.', delay: 2600, dim: true },
    ]
  },

  // ==========================================================================
  // LEVEL 4 — THE COMMON SENSE VAULT
  // ==========================================================================
  {
    id: 4,
    title: 'The Common Sense Vault',
    subtitle: 'This is it. This is definitely it.',
    theme: { skyTop: '#241847', skyBottom: '#3d2a6b', ground: '#2e2050', groundTop: '#4a3577', accent: '#ffd166' },
    worldWidth: 2000,
    groundY: 520,
    spawn: { x: 100, y: 500 },
    exit: null, // handled by vault sequence
    platforms: [
      makePlatform(-100, 520, 2200, 200),
      makePlatform(420, 420, 150),
      makePlatform(720, 360, 150),
      makePlatform(1040, 420, 150),
    ],
    movingPlatforms: [],
    spikes: [],
    collectibles: [
      makeCollectible(250, 470), makeCollectible(480, 370),
      makeCollectible(780, 310), makeCollectible(1100, 370),
    ],
    checkpoints: [700, 1200],
    vault: { x: 1650, y: 520, w: 220, h: 260 }, // big vault structure near end
    introJokes: [
      { text: 'The Vault. It is real. It has always been real.', delay: 300 },
      { text: 'Mayank swears this is not a prank.', delay: 3000, dim: true },
    ]
  },

  // ==========================================================================
  // LEVEL 5 — THE FINAL TEST
  // ==========================================================================
  {
    id: 5,
    title: 'The Final Test',
    subtitle: 'One obstacle course. One obvious choice.',
    theme: { skyTop: '#1a2e2a', skyBottom: '#2a4a42', ground: '#213a34', groundTop: '#33564c', accent: '#7be495' },
    worldWidth: 1900,
    groundY: 520,
    spawn: { x: 100, y: 500 },
    exit: null, // handled by choice gate
    platforms: [
      makePlatform(-100, 520, 900, 200),
      makePlatform(420, 420, 140),
      makePlatform(680, 460, 160),
      makePlatform(960, 520, 900, 200),
    ],
    movingPlatforms: [
      makeMovingPlatform(1150, 440, 110, 20, { axis: 'y', range: 70, speed: 1.3 }),
    ],
    spikes: [makeSpike(1050, 502)],
    collectibles: [
      makeCollectible(300, 470), makeCollectible(500, 370),
      makeCollectible(1050, 470),
    ],
    checkpoints: [700],
    choiceGate: { x: 1650, y: 520 },
    introJokes: [
      { text: 'The final test. Choose wisely. Or do not.', delay: 300 },
    ]
  },
];

function pickRandomJoke(excludeSet) {
  const pool = AMBIENT_JOKES.filter((j) => !excludeSet || !excludeSet.has(j));
  if (pool.length === 0) return AMBIENT_JOKES[Math.floor(Math.random() * AMBIENT_JOKES.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}
