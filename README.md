# MOKSHITA: The Quest for Common Sense — 3D

A 3D Three.js rebuild of the 2D Raksha Bandhan platformer, using the character/animation
foundation from an earlier Three.js prototype. Same premise, same jokes, same "3 levels,
gate, gate, portal" structure — now in three dimensions.

Pure HTML/CSS/JavaScript, zero backend, zero build step. The only external dependency is
Three.js itself, loaded from a CDN via an import map (see `index.html`) — no npm install,
no bundler, nothing to configure.

---

## 1. How to run locally

Because this uses ES modules and an import map, it needs to be served over HTTP (opening
`index.html` directly via `file://` will not work in most browsers — import maps and
module loading require a real origin).

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## 2. How to deploy to GitHub Pages

Same as any static site:

1. Push all files in this folder to the root of a GitHub repository.
2. Repository Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, folder: `/ (root)`.
3. Wait a minute, then it's live at `https://<username>.github.io/<repo>/`.

No build step, no environment variables, no API keys.

---

## 3. Project structure

```
/
├── index.html              — HUD, screens (boot/start/transition/final), mobile controls, all CSS
├── main.js                  — entry point: scene setup, input, level lifecycle, HUD, ending sequence
├── character.js               — the 3D character model + animation state machine
├── player-controller.js         — physics, movement, jump, and AABB collision
├── level-builder.js               — converts level data into real Three.js meshes + colliders
├── levels.js                        — all 3 levels' platform/collectible/gate/portal data
├── camera-controller.js               — third-person follow camera
└── audio.js                             — Web Audio sound synthesis (no audio files needed)
```

---

## 4. Controls

**Desktop:** WASD / Arrow keys to move, Space to jump, Shift to run, Escape to pause.
**Mobile:** on-screen virtual joystick (bottom-left) + jump button (bottom-right), shown
automatically on touch devices.

---

## 5. Where to change the character's appearance

The character is built from primitive shapes (capsules/spheres) in `character.js`, inside
`createCharacter()`. There's a `MATS` object near the top of that file with all the colors
(skin, hair, shirt, jeans, etc.) — edit those to restyle her without touching any geometry.

If you ever want to swap in a real modeled/rigged character (a GLB/GLTF file) instead of
the procedural one:

1. Load it with Three's `GLTFLoader` in place of `createCharacter()`'s body.
2. Keep the `root.userData = { collisionRadius, standHeight }` fields — the physics system
   reads those two numbers to size the player's collision cylinder, regardless of what the
   character actually looks like.
3. The animation state machine in `CharacterAnimator` (states: `idle`, `walk`, `run`,
   `jump`, `fall`, `death`, `celebrate`, `confused`) is written to move Three.js
   `Object3D` rotations directly, which works for a rig of separate limb meshes (as
   shipped) but would need to be swapped for an `AnimationMixer` + real skeletal clips if
   you bring in a rigged model with baked animations instead.

## 6. Where to change level layouts / difficulty

Everything is in `levels.js`. Each level has `platforms` (static, made with
`platform(x, y, z, width, height, depth)`), `movingPlatforms`, `hazards`, `collectibles`,
`checkpoints`, and either a `gate` (levels 1–2) or a `portal` (level 3 only).

**Jump physics reference**, computed in `player-controller.js`:
- `MAX_JUMP_HEIGHT` ≈ 1.84 units
- `MAX_JUMP_RANGE` ≈ 6.14 units (at running speed)

Every gap in the shipped levels is a comfortable 2–3 units — well under the max, on
purpose, so there are no difficult or "impossible" jumps anywhere. If you add a gap,
keep it comfortably under `MAX_JUMP_RANGE`, and if you add a height change, keep it
under `MAX_JUMP_HEIGHT`.

**A hard-learned lesson from building this** (see the comments in `levels.js` itself):
if you place a **moving platform as the *only* way across a gap**, it can desync from
the player's jump timing — the platform might simply not be in the right place when the
player's jump arc reaches it, causing a fall with nothing to catch it. Every mandatory
gap in the shipped levels has a **static** stepping-stone or platform bridging it; moving
platforms are only ever added as decorative extras layered on top of an already-safe
static path.

**A second lesson, also learned the hard way**: don't place narrow (4-unit-wide) stepping
stones near off-center collectibles. A player will naturally drift sideways to grab a
nearby pickup, and if that drift happens to land them right at a narrow platform's edge
during a jump, they can miss it. The shipped stepping stones are 6 units wide for exactly
this reason — verified by simulating a player that actively seeks out collectibles, not
just one that walks in a straight line.

## 7. Where the "verified" claims in `levels.js` actually come from

Every gap distance and platform placement in this project was checked two ways before
being considered safe, not just eyeballed:

1. **A static geometry checker** — computes every gap distance and height delta between
   platforms and moving-platform oscillation ranges, and flags anything exceeding the
   jump physics limits.
2. **A live physics simulation** — actually runs the real, unmodified `PlayerController`
   and `LevelBuilder` code (the same code that ships in the game) with a simulated player
   that reacts to the level geometry, walking and jumping through all 3 levels end-to-end,
   counting falls and confirming the gate/portal triggers correctly.

The second check is the one that matters — it caught two real bugs (a moving-platform
timing issue, and the narrow-stepping-stone issue above) that the static checker alone
did not, because it only sees distances, not actual playthrough behavior.

If you edit `levels.js`, re-running an equivalent simulation before trusting a "gap
verified" comment is strongly recommended — a comment is not a guarantee.

## 8. Where to edit the jokes / ending

- **Ambient jokes**: `AMBIENT_JOKES` array at the top of `levels.js` (currently unused by
  default per the "remove notification spam" request — wire back in via `toast()` in
  `main.js` if you want occasional flavor text).
- **Level intro text**: each level's `introText` field in `levels.js`.
- **The ending sequence** (confetti → sister-roast → Raksha Bandhan message): in
  `main.js`, inside `runEndingSequence()`. It's a small `setTimeout` chain — edit the
  HTML strings directly.

## 9. Common Sense counter

The HUD shows `collected / total` in the top-right at all times, and pulses briefly on
pickup — no other notification appears for routine collection, per the "remove excessive
notifications" request. The only toast-style messages that still appear are level intro
text (once per level) and checkpoint confirmations (once per checkpoint, first time only).

## 10. Checkpoints & respawn

Each level has 0–2 checkpoints (`checkpoints` array in `levels.js`). Walking near one
saves it as the current respawn point (`PlayerController.setCheckpoint()`). Falling off
the world or touching a hazard triggers a short screen-fade, freezes the character in
place for ~0.55s (gravity still applies visually, but no other systems can double-trigger
during that window — see the guard in `PlayerController.update()`), then respawns cleanly
at the last checkpoint with velocity fully reset. This was tested with 10 consecutive
death/respawn cycles back-to-back with no state leak between them.

## 11. What was tested before shipping

Physics/collision (landing, ceiling bumps, corner grazes, world-bounds walls, genuine
solid obstacles), the full death → respawn → resume cycle (including repeated deaths),
checkpoint scoping across levels and across a full-game restart, moving-platform sync
with checkpoints positioned nearby, gate/portal triggers from straight-on and angled
approaches, chaotic/rapid input (to check for crashes or invalid position values), and
two complete full-game playthrough simulations — one walking a straight line, one
actively seeking out every collectible — both passing all 3 levels with zero falls.

What was **not** tested: actual rendering in a real browser (this sandbox has no GPU/WebGL
context), so please do a real playthrough yourself before sharing the final build — all
of the above verifies the physics/logic layer, not "does it look right on screen."

---

Happy Raksha Bandhan, Mokshita. Still zero Common Sense. Now rendered in three dimensions.

— Mayank
