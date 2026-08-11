/* ==========================================================================
   GAME.JS — Core engine: canvas rendering loop, world simulation, camera,
   input, collision with collectibles/spikes/vault/gate, per-level scripted
   joke sequences, particle effects, screen shake.
   ========================================================================== */

const Game = (() => {
  let canvas, ctx;
  let width = 0, height = 0, dpr = 1;

  let player = null;
  let currentLevelIndex = 0;
  let levelState = null;
  let running = false;
  let paused = false;
  let rafId = null;
  let lastTime = 0;

  let camX = 0;
  let camShake = { t: 0, mag: 0 };

  let totalCommonSenseCollected = 0; // tracked but always displayed as 0 (the joke)

  const input = {
    left: false, right: false, jumpPressed: false, jumpHeld: false
  };

  let particles = [];

  // -------------------- Setup --------------------
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    bindKeyboard();
    bindMobileControls();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = true;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = true;
      if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) {
        if (!input.jumpHeld) input.jumpPressed = true;
        input.jumpHeld = true;
        e.preventDefault();
      }
      if (e.key === 'Escape' && running) togglePause();
    });
    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = false;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = false;
      if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) input.jumpHeld = false;
    });
  }

  function bindMobileControls() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');

    const press = (btn, onDown, onUp) => {
      const start = (e) => { e.preventDefault(); btn.classList.add('pressed'); onDown(); };
      const end = (e) => { e.preventDefault(); btn.classList.remove('pressed'); onUp(); };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    };

    press(btnLeft, () => input.left = true, () => input.left = false);
    press(btnRight, () => input.right = true, () => input.right = false);
    press(btnJump,
      () => { if (!input.jumpHeld) input.jumpPressed = true; input.jumpHeld = true; },
      () => input.jumpHeld = false
    );
  }

  function showMobileControls(show) {
    document.getElementById('mobile-controls').classList.toggle('visible', show);
  }

  // -------------------- Level lifecycle --------------------
  function startLevel(index) {
    currentLevelIndex = index;
    const def = LEVELS[index];
    levelState = buildLevelState(def);
    player = new Player(def.spawn.x, def.spawn.y);
    player.setCheckpoint(def.spawn.x, def.spawn.y);
    camX = 0;
    particles = [];

    UI.setHudLevel(def.id, def.title);
    UI.setHudCommonSense(0);
    UI.showScreen('game-screen');
    showMobileControls(true);

    if (def.introJokes) {
      UI.toastSequence(def.introJokes);
    }

    running = true;
    paused = false;
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function buildLevelState(def) {
    return {
      def,
      collectibles: def.collectibles.map((c) => ({ ...c, collected: false })),
      movingPlatforms: (def.movingPlatforms || []).map((p) => ({ ...p, t: p.phase || 0 })),
      collectedCount: 0,
      totalCollectibles: def.collectibles.length,
      levelCommonSense: 0,
      vaultOpened: false,
      vaultSequenceStarted: false,
      choiceMade: false,
      exitReached: false,
      finished: false,
      lastCheckpointX: def.spawn.x,
      lastCheckpointY: def.spawn.y,
      shownCheckpoints: new Set(),
    };
  }

  function restartLevel() {
    startLevel(currentLevelIndex);
  }

  function quitToMenu() {
    running = false;
    cancelAnimationFrame(rafId);
    showMobileControls(false);
    UI.showScreen('menu-screen');
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    document.getElementById('pause-modal').classList.toggle('active', paused);
  }

  // -------------------- Update --------------------
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    if (!paused) {
      update(dt);
    }
    render();

    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    const def = levelState.def;

    // moving platforms
    levelState.movingPlatforms.forEach((p) => {
      p.t += dt * p.speed;
      if (p.axis === 'x') {
        p.x = p.baseX + Math.sin(p.t) * p.range;
      } else {
        p.y = p.baseY + Math.sin(p.t) * p.range;
      }
    });

    const allPlatforms = [...def.platforms, ...levelState.movingPlatforms];

    const world = {
      minX: -80,
      maxX: def.worldWidth,
      killY: 900,
      platforms: allPlatforms,
      onFall: () => handleFall(),
    };

    player.update(dt, input, world);
    input.jumpPressed = false;

    // spikes
    if (def.spikes) {
      for (const s of def.spikes) {
        if (rectsOverlap(player.bounds, s)) {
          handleSpikeHit();
          break;
        }
      }
    }

    // collectibles
    levelState.collectibles.forEach((c) => {
      if (c.collected) return;
      c.bob += dt * 3;
      const dx = player.x - c.x;
      const dy = (player.y - 26) - c.y;
      if (dx * dx + dy * dy < 34 * 34) {
        collectItem(c);
      }
    });

    // checkpoints
    if (def.checkpoints) {
      def.checkpoints.forEach((cx) => {
        if (!levelState.shownCheckpoints.has(cx) && player.x > cx) {
          levelState.shownCheckpoints.add(cx);
          player.setCheckpoint(cx, def.groundY - 60);
          levelState.lastCheckpointX = cx;
          GameAudio.checkpoint();
          UI.toast('Checkpoint reached.', { dim: true });
        }
      });
    }

    // level-specific special zones
    handleSpecialZones(dt);

    // camera follow
    const targetCamX = clamp(player.x - width * 0.4, 0, Math.max(0, def.worldWidth - width));
    camX += (targetCamX - camX) * Math.min(1, dt * 6);

    // shake decay
    if (camShake.t > 0) camShake.t -= dt;

    // particles
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
    });
  }

  function handleFall() {
    GameAudio.hit();
    shake(0.3, 6);
    player.triggerConfused(0.6);
    player.reset();
  }

  function handleSpikeHit() {
    if (player.stunTimer > 0) return;
    GameAudio.hit();
    shake(0.25, 8);
    player.stunTimer = 0.5;
    player.vy = -400;
    player.vx = -player.facing * 200;
    UI.toast('Ouch.', { dim: true });
  }

  function collectItem(c) {
    c.collected = true;
    levelState.collectedCount++;
    levelState.levelCommonSense++;
    totalCommonSenseCollected++;

    GameAudio.collect();
    spawnCollectParticles(c.x, c.y);

    UI.toast('+1 COMMON SENSE', { accent: true });
    UI.toastSequence([
      { text: 'Common Sense collected!', delay: 250, accent: true },
      { text: 'Inventory check…', delay: 1200, dim: true },
      { text: 'Common Sense: 0', delay: 2000 },
      { text: 'Interesting.', delay: 2800, dim: true },
    ]);
  }

  function spawnCollectParticles(x, y) {
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14;
      particles.push({
        x, y,
        vx: Math.cos(angle) * (80 + Math.random() * 60),
        vy: Math.sin(angle) * (80 + Math.random() * 60) - 60,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        color: Math.random() > 0.5 ? '#ffd166' : '#ff8a5c',
        size: 3 + Math.random() * 3,
      });
    }
  }

  function shake(duration, magnitude) {
    camShake.t = duration;
    camShake.mag = magnitude;
  }

  // -------------------- Special per-level zones --------------------
  function handleSpecialZones(dt) {
    const def = levelState.def;

    // Standard exit gate (levels 1-3)
    if (def.exit && !levelState.exitReached) {
      const gate = def.exit;
      if (rectsOverlap(player.bounds, gate)) {
        levelState.exitReached = true;
        completeStandardLevel();
      }
    }

    // Level 4: Vault sequence
    if (def.vault && !levelState.vaultSequenceStarted) {
      const v = def.vault;
      const triggerX = v.x - 40;
      if (player.x > triggerX) {
        levelState.vaultSequenceStarted = true;
        runVaultSequence();
      }
    }

    // Level 5: choice gate
    if (def.choiceGate && !levelState.choiceMade) {
      if (player.x > def.choiceGate.x - 30) {
        levelState.choiceMade = true;
        running = false; // pause simulation, show choice UI
        showMobileControls(false);
        setTimeout(showFinalChoice, 400);
      }
    }
  }

  function completeStandardLevel() {
    running = false;
    showMobileControls(false);
    GameAudio.levelComplete();
    player.triggerCelebrate(2);

    const def = levelState.def;
    const idx = currentLevelIndex;

    setTimeout(() => {
      if (idx === 0) {
        UI.showTransition({
          emoji: '🧠',
          heading: 'LEVEL COMPLETE!',
          lines: [
            { text: `Common Sense Acquired: 0` },
            { text: 'MOKSHITA STATUS:' },
            { text: 'Still looking.', dim: true },
          ],
          buttonText: 'CONTINUE',
          onContinue: () => advanceLevel(),
        });
      } else if (idx === 1) {
        UI.showTransition({
          emoji: '🧗',
          heading: 'LEVEL COMPLETE!',
          lines: [
            { text: 'Common Sense Acquired: 0' },
            { text: 'MOKSHITA STATUS:' },
            { text: 'Getting warmer. Allegedly.', dim: true },
          ],
          buttonText: 'CONTINUE',
          onContinue: () => advanceLevel(),
        });
      } else if (idx === 2) {
        UI.showTransition({
          emoji: '🎉',
          heading: 'LEVEL COMPLETE',
          lines: [
            { text: 'Parkour skills: +100' },
            { text: 'Common Sense: +0', dim: true },
            { text: 'Was it worth it?' },
          ],
          buttonText: 'OBVIOUSLY',
          onContinue: () => advanceLevel(),
        });
      }
    }, 600);
  }

  function runVaultSequence() {
    // Dramatic build-up: shake + toasts while walking toward the vault.
    shake(1.2, 4);
    UI.toastSequence([
      { text: 'The Vault is opening…', delay: 200, accent: true },
      { text: 'This is it.', delay: 1400 },
      { text: 'This is really it.', delay: 2400, dim: true },
    ]);

    setTimeout(() => {
      levelState.vaultOpened = true;
      GameAudio.levelComplete();
      shake(0.6, 10);
    }, 3200);

    setTimeout(() => {
      running = false;
      showMobileControls(false);
      player.triggerCelebrate(1.5);
      GameAudio.celebrate();
      shake(0.5, 14);
      UI.toast('COMMON SENSE ACQUIRED!', { accent: true });
    }, 4200);

    setTimeout(() => {
      GameAudio.glitch();
      shake(0.4, 18);
    }, 6000);

    setTimeout(() => {
      UI.showTransition({
        emoji: '⚠️',
        heading: 'Error.',
        lines: [
          { text: 'Common Sense could not be installed.' },
          { text: 'Please try again.', dim: true },
        ],
        buttonText: 'TRY AGAIN',
        onContinue: () => advanceLevel(),
      });
      GameAudio.error();
    }, 6800);
  }

  function showFinalChoice() {
    UI.showTransition({
      heading: 'THE FINAL TEST',
      lines: [{ text: 'A completely obvious choice awaits.' }],
      stats: [],
      buttonText: null, // no default button — custom choice buttons injected below
      onContinue: () => {},
    });

    const card = document.getElementById('transition-card');

    const wrap = document.createElement('div');
    wrap.className = 'modal-btn-col';
    wrap.style.marginTop = '10px';

    const rightBtn = document.createElement('button');
    rightBtn.className = 'btn btn-primary btn-big';
    rightBtn.textContent = 'TAKE THE OBVIOUS PATH';
    rightBtn.onclick = () => {
      GameAudio.click();
      showChoiceResult(true);
    };

    const wrongBtn = document.createElement('button');
    wrongBtn.className = 'btn btn-ghost';
    wrongBtn.textContent = 'WALK INTO THE OBVIOUSLY WRONG PATH';
    wrongBtn.onclick = () => {
      GameAudio.click();
      showChoiceResult(false);
    };

    wrap.appendChild(rightBtn);
    wrap.appendChild(wrongBtn);
    card.appendChild(wrap);
  }

  function showChoiceResult(correct) {
    if (correct) {
      GameAudio.levelComplete();
      setTimeout(() => {
        UI.showTransition({
          emoji: '✅',
          heading: 'Excellent.',
          lines: [
            { text: 'You have demonstrated approximately 1 unit of Common Sense.', accent: true },
          ],
          buttonText: 'CONTINUE',
          onContinue: () => {
            setTimeout(() => {
              GameAudio.error();
              UI.showTransition({
                emoji: '⚠️',
                heading: 'System error.',
                lines: [{ text: 'Unit lost.', dim: true }],
                buttonText: 'FINISH THE QUEST',
                onContinue: () => finishGame(),
              });
            }, 300);
          },
        });
      }, 200);
    } else {
      GameAudio.error();
      UI.showTransition({
        emoji: '🤔',
        heading: 'Interesting decision.',
        lines: [{ text: 'Common Sense remains unavailable.', dim: true }],
        buttonText: 'FINISH THE QUEST',
        onContinue: () => finishGame(),
      });
    }
  }

  function advanceLevel() {
    const next = currentLevelIndex + 1;
    if (next < LEVELS.length) {
      startLevel(next);
    } else {
      finishGame();
    }
  }

  function finishGame() {
    running = false;
    showMobileControls(false);
    UI.showFinalScreen();
  }

  // -------------------- Rendering --------------------
  function render() {
    if (!levelState) return;
    const def = levelState.def;
    const theme = def.theme;

    ctx.save();

    // shake offset
    let shakeX = 0, shakeY = 0;
    if (camShake.t > 0) {
      const f = camShake.t;
      shakeX = (Math.random() - 0.5) * camShake.mag * f;
      shakeY = (Math.random() - 0.5) * camShake.mag * f;
    }
    ctx.translate(shakeX, shakeY);

    // sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-shakeX - 4, -shakeY - 4, width + 8, height + 8);

    drawParallaxBg(theme, camX);

    // world
    ctx.save();
    ctx.translate(-camX, 0);

    drawPlatforms(def.platforms, theme);
    levelState.movingPlatforms.forEach((p) => drawPlatform(p, theme, true));

    drawSpikes(def.spikes, theme);
    drawCollectibles(levelState.collectibles, theme);

    if (def.vault) drawVault(def.vault, theme);
    if (def.choiceGate) drawChoiceGate(def.choiceGate, theme);
    if (def.exit) drawExitGate(def.exit, theme);

    drawParticles();

    // Player is positioned in world space, so draw it with no additional
    // camX offset here (the ctx is already translated by -camX above).
    player.draw(ctx, 0);

    ctx.restore(); // end world translate

    ctx.restore(); // end shake translate
  }

  function drawParallaxBg(theme, camX) {
    // distant soft hill shapes for depth
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = theme.accent;
    const offset1 = -(camX * 0.15) % 400;
    for (let i = -1; i < Math.ceil(width / 400) + 1; i++) {
      const x = offset1 + i * 400;
      ctx.beginPath();
      ctx.ellipse(x + 200, height - 40, 260, 90, 0, Math.PI, 0, true);
      ctx.fill();
    }
    ctx.globalAlpha = 0.15;
    const offset2 = -(camX * 0.3) % 300;
    for (let i = -1; i < Math.ceil(width / 300) + 1; i++) {
      const x = offset2 + i * 300;
      ctx.beginPath();
      ctx.ellipse(x + 150, height - 20, 200, 70, 0, Math.PI, 0, true);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlatforms(platforms, theme) {
    platforms.forEach((p) => drawPlatform(p, theme, false));
  }

  function drawPlatform(p, theme, isMoving) {
    const screenY = p.y;
    if (screenY > height + 400 || screenY + p.h < -400) return; // cheap cull for huge ground strip is fine

    ctx.fillStyle = isMoving ? lighten(theme.ground, 15) : theme.ground;
    roundRect(ctx, p.x, p.y, p.w, Math.min(p.h, height), 8);
    ctx.fill();

    ctx.fillStyle = isMoving ? theme.accent : theme.groundTop;
    roundRect(ctx, p.x, p.y, p.w, 10, 8);
    ctx.fill();

    if (isMoving) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, Math.min(p.h, height) - 4);
    }
  }

  function drawSpikes(spikes, theme) {
    if (!spikes) return;
    ctx.fillStyle = '#e85d5d';
    spikes.forEach((s) => {
      const count = Math.max(1, Math.floor(s.w / 18));
      const segW = s.w / count;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.moveTo(s.x + i * segW, s.y + s.h);
        ctx.lineTo(s.x + i * segW + segW / 2, s.y);
        ctx.lineTo(s.x + i * segW + segW, s.y + s.h);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  function drawCollectibles(collectibles, theme) {
    collectibles.forEach((c) => {
      if (c.collected) return;
      const y = c.y + Math.sin(c.bob) * 5;
      const glow = 0.5 + Math.sin(c.bob * 1.3) * 0.3;

      ctx.save();
      ctx.translate(c.x, y);

      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 18 * glow;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧠', 0, 1);

      ctx.restore();
    });
  }

  function drawVault(v, theme) {
    ctx.save();
    ctx.translate(v.x, v.y);

    // vault body
    ctx.fillStyle = '#20182f';
    roundRect(ctx, 0, -v.h, v.w, v.h, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 4;
    roundRect(ctx, 6, -v.h + 6, v.w - 12, v.h - 12, 12);
    ctx.stroke();

    // door circle
    const opened = levelState.vaultOpened;
    ctx.save();
    ctx.translate(v.w / 2, -v.h / 2);
    ctx.fillStyle = opened ? 'rgba(255,209,102,0.15)' : '#151020';
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    ctx.stroke();

    if (opened) {
      const t = performance.now() / 300;
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 30 + Math.sin(t) * 10;
      ctx.fillStyle = theme.accent;
      ctx.font = '34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧠', 0, 0);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 13px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', 0, 0);
    }
    ctx.restore();

    // label
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COMMON SENSE', v.w / 2, -v.h - 14);

    ctx.restore();
  }

  function drawChoiceGate(g, theme) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 400) * 0.15;
    roundRect(ctx, -6, -140, 12, 140, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawExitGate(g, theme) {
    ctx.save();
    ctx.translate(g.x, g.y - g.h);
    const t = performance.now() / 500;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 20 + Math.sin(t) * 8;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, 0, 0, g.w, g.h, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, 4, 4, g.w - 8, g.h - 8, 10);
    ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚪', g.w / 2, g.h / 2 + 8);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((p) => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // -------------------- Utilities --------------------
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lighten(hex, amt) {
    const c = hex.replace('#', '');
    const num = parseInt(c, 16);
    let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `rgb(${r},${g},${b})`;
  }

  return {
    init,
    startLevel,
    restartLevel,
    quitToMenu,
    togglePause,
    get totalCommonSenseCollected() { return totalCommonSenseCollected; },
    get isPaused() { return paused; },
  };
})();
