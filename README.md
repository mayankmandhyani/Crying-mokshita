# MOKSHITA: The Quest for Common Sense

A personalized Raksha Bandhan gift-game, built by Mayank for Mokshita. Pure HTML/CSS/JavaScript, zero backend, zero build step, zero paid services. Deploys as a static site on GitHub Pages.

The premise: Mokshita collects "Common Sense" throughout 5 short levels. She never actually gets any. That's the whole joke.

---

## 1. How to run locally

No build step, no npm install required. Any of these work:

**Option A — just open the file**
Double-click `index.html`. It will run, though some browsers restrict certain features (like audio autoplay policies) slightly more strictly under `file://`. It's fully playable either way.

**Option B — local server (recommended)**
From the project folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Or with Node.js:

```bash
npx serve .
```

---

## 2. How to upload to GitHub

1. Create a new repository on GitHub (e.g. `mokshita-game`).
2. From this project folder:

```bash
git init
git add .
git commit -m "Initial commit: Mokshita's quest for Common Sense"
git branch -M main
git remote add origin https://github.com/<your-username>/mokshita-game.git
git push -u origin main
```

---

## 3. How to enable GitHub Pages

1. Go to your repository on GitHub → **Settings** → **Pages**.
2. Under "Build and deployment", set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and folder to `/ (root)`.
4. Click **Save**.
5. Wait about a minute, then your game will be live at:
   `https://<your-username>.github.io/mokshita-game/`

That URL is what you put in the QR code for the physical card.

---

## 4. Required configuration

None. There is no API key, no environment variable, no database, and no backend. The whole game is static files (`index.html`, `style.css`, `*.js`). It works the moment GitHub Pages finishes deploying.

The only external network call is a Google Fonts stylesheet link (for the "Fredoka" and "Space Grotesk" fonts). If that's ever unreachable, the CSS falls back to the system UI font automatically — nothing breaks.

---

## 5. Where I can replace the avatar

The avatar is currently drawn with canvas code (no image file needed), in **`player.js`**, inside the `Player.drawBody()` method. This keeps the game fully self-contained with no missing-asset risk.

To restyle the *existing* procedural avatar (colors, hair, outfit), edit the `AVATAR_THEME` object at the top of `player.js`:

```js
const AVATAR_THEME = {
  skin: '#e8b48a',
  hair: '#1c1720',
  top: '#4a3b56',
  pants: '#5a6a8a',
  ...
};
```

To swap in an actual **image-based sprite** (e.g. a custom drawing of Mokshita) instead of the procedural avatar:

1. Drop your sprite sheet or individual PNGs into the project's root folder (same place as `index.html`).
2. In `player.js`, replace the contents of `drawBody()` with an `ctx.drawImage(...)` call referencing a preloaded `Image` object instead of the shape-drawing code. The animation state machine (`this.state`: `idle`, `run`, `jump`, `fall`, `celebrate`, `confused`) already exists and drives which frame/pose should show — you just need to map states to your sprite frames.

A reference sheet (`avatar-reference-sheet.png`, in the root folder) is included in this repo as a starting visual reference, but it is **not** wired into the game by default — it's there for you to use if you want to build a real sprite-based version later.

---

## 6. Where I can change Mokshita's name

Names appear in two places:

- **`game.js`** and **`ui.js`** — inside toast messages, transition text, and the final screen strings (search for the word "Mokshita" or "Mayank").
- **`index.html`** — a few places in the final screen and menu screen have the names directly in the markup.

Do a project-wide search for `Mokshita` and `Mayank` and replace as needed. There's no single config variable for this by design — it keeps the writing feeling natural rather than templated.

---

## 7. Where I can add/edit jokes

- **Ambient/random jokes**: `levels.js` → the `AMBIENT_JOKES` array at the top. Add or remove lines freely; they're picked at random during gameplay via `pickRandomJoke()`.
- **Per-level intro jokes**: `levels.js` → each level object has an `introJokes` array with `{ text, delay, dim }` entries.
- **Level-complete / vault / choice sequence jokes**: `game.js` → look for `UI.showTransition(...)` and `UI.toastSequence(...)` calls inside `completeStandardLevel()`, `runVaultSequence()`, and `showChoiceResult()`.
- **Secret Mayank Mode messages**: `ui.js` → the `secretMessages` array.

---

## 8. Where I can change level difficulty

All level layouts live in **`levels.js`**, inside the `LEVELS` array. Each level has:

- `platforms` — static platforms, made with `makePlatform(x, y, width, height)`.
- `movingPlatforms` — made with `makeMovingPlatform(x, y, w, h, { axis: 'x'|'y', range, speed })`.
- `spikes` — made with `makeSpike(x, y, width, height)`. Touching one bounces the player back — it's not punishing, just a nudge.
- `collectibles` — made with `makeCollectible(x, y)`. These are the floating "Common Sense" orbs.
- `checkpoints` — an array of x-positions; passing one resets the respawn point there.

**Jump physics reference** (defined in `player.js`):
- Max jump height: ~128px
- Max horizontal distance per jump (at the same height): ~215px

Keep gaps between platforms comfortably under those numbers — the shipped levels use gaps of roughly 120–215px horizontally and up to ~90px vertically, which plays easy. To make a level harder, widen gaps (but stay under the max) or add more spikes. To make it easier, shrink gaps or remove spikes.

To adjust global movement feel, edit these values in `player.js`, inside the `Player` constructor:

```js
this.speed = 260;       // horizontal movement speed
this.jumpForce = 620;   // jump strength
```

And in `Player.update()`:

```js
const GRAVITY = 1500;   // fall speed / jump arc shape
```

---

## Project structure

Everything lives flat at the repository root — no subfolders. This is deliberate: it keeps GitHub Pages deployment trivial regardless of repo settings, and there's nothing to misconfigure.

```
/
├── index.html                   — all screens (menu, game, transitions, final, modals)
├── README.md
├── style.css                     — all visual styling, responsive rules, animations
├── audio.js                       — Web Audio API sound synthesis (no audio files)
├── player.js                       — avatar physics, collision, procedural rendering
├── levels.js                        — all 5 level layouts + joke text content
├── ui.js                             — screens, toasts, transitions, final screen, secret mode
├── game.js                            — core engine: render loop, camera, per-level scripted events
├── main.js                             — boot sequence, menu wiring, mute toggle
└── avatar-reference-sheet.png          — optional reference art, not required to run the game
```

---

## Controls

**Desktop:** Arrow keys or WASD to move, Space / Up / W to jump, Escape to pause.
**Mobile:** On-screen left/right/jump buttons (auto-shown on touch devices).

## Secret Mayank Mode

There's a nearly-invisible dot in the bottom-right corner of the main menu. Tap it 7 times.

## Tested for

Player movement, jumping, collision (platforms, spikes, world bounds), all collectibles, level transitions and scripted sequences (vault, choice gate), checkpoints, restart, pause/resume, mobile touch controls, responsive layout down to small phone widths, and no broken relative asset paths — everything is self-contained for GitHub Pages.

---

Happy Raksha Bandhan, Mokshita. Still zero Common Sense. Still worth it.

— Mayank
