/* ==========================================================================
   UI.JS — Screen transitions, HUD, toast messages, level-transition cards,
   final screen, secret Mayank Mode, modals.
   ========================================================================== */

const UI = (() => {
  const screens = {};
  let currentScreen = null;

  function cacheScreens() {
    ['boot-screen', 'menu-screen', 'game-screen', 'transition-screen', 'final-screen'].forEach((id) => {
      screens[id] = document.getElementById(id);
    });
  }

  function showScreen(id) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    if (screens[id]) {
      screens[id].classList.add('active');
      currentScreen = id;
    }
  }

  // ---------------- Toasts ----------------
  const toastStack = () => document.getElementById('toast-stack');

  function toast(text, opts = {}) {
    const stack = toastStack();
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast' + (opts.accent ? ' toast-accent' : '') + (opts.dim ? ' toast-dim' : '');
    el.textContent = text;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  function toastSequence(items) {
    // items: [{text, delay, dim, accent}]
    items.forEach((item) => {
      setTimeout(() => toast(item.text, item), item.delay);
    });
  }

  // ---------------- HUD ----------------
  function setHudLevel(num, title) {
    document.getElementById('hud-level').textContent = `LEVEL ${num}`;
    document.getElementById('hud-level-title').textContent = title;
  }

  function setHudCommonSense(_val) {
    // The joke: this always reads 0, no matter what the player collects.
    document.getElementById('hud-cs-value').textContent = '0';
  }

  // ---------------- Level transition card ----------------
  function showTransition(config) {
    const card = document.getElementById('transition-card');
    card.innerHTML = '';

    if (config.emoji) {
      const e = document.createElement('span');
      e.className = 't-emoji';
      e.textContent = config.emoji;
      card.appendChild(e);
    }

    const h2 = document.createElement('h2');
    h2.textContent = config.heading;
    card.appendChild(h2);

    (config.lines || []).forEach((line) => {
      const p = document.createElement('p');
      p.className = 't-line' + (line.dim ? ' dim' : '');
      p.textContent = line.text;
      card.appendChild(p);
    });

    if (config.stats && config.stats.length) {
      const wrap = document.createElement('div');
      wrap.className = 't-stats';
      config.stats.forEach((s) => {
        const row = document.createElement('div');
        row.className = 't-stat-row';
        const label = document.createElement('span');
        label.textContent = s.label;
        const val = document.createElement('strong');
        val.textContent = s.value;
        row.appendChild(label);
        row.appendChild(val);
        wrap.appendChild(row);
      });
      card.appendChild(wrap);
    }

    if (config.buttonText !== null) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-big';
      btn.textContent = config.buttonText || 'CONTINUE';
      btn.onclick = () => {
        GameAudio.click();
        GameAudio.unlock();
        config.onContinue && config.onContinue();
      };
      card.appendChild(btn);
    }

    showScreen('transition-screen');
  }

  // ---------------- Final screen ----------------
  function showFinalScreen() {
    showScreen('final-screen');
    spawnConfetti();
    GameAudio.celebrate();
  }

  function spawnConfetti() {
    const layer = document.getElementById('confetti-layer');
    layer.innerHTML = '';
    const colors = ['#ff8a5c', '#ffd166', '#7ee8fa', '#a78bfa', '#ff6fa5', '#7be495'];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const size = 6 + Math.random() * 8;
      piece.style.width = size + 'px';
      piece.style.height = size * 0.5 + 'px';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const duration = 3 + Math.random() * 3;
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = (Math.random() * 1.5) + 's';
      layer.appendChild(piece);
    }
  }

  // ---------------- Secret Mayank Mode ----------------
  const secretMessages = [
    "Mokshita, if you're reading this: yes, I spent way too long on this.",
    "This game has more polish than most of my actual client projects.",
    "There is no Common Sense in this codebase. There never was.",
    "Fun fact: this entire game runs with zero backend. Just like your patience for me.",
    "Achievement unlocked: You are more thorough than Common Sense itself.",
  ];
  let secretCount = 0;

  function bumpSecret() {
    secretCount++;
    if (secretCount >= 7) {
      secretCount = 0;
      GameAudio.secret();
      document.getElementById('secret-message').textContent =
        secretMessages[Math.floor(Math.random() * secretMessages.length)];
      document.getElementById('secret-modal').classList.add('active');
    }
  }

  return {
    init: cacheScreens,
    showScreen,
    toast,
    toastSequence,
    setHudLevel,
    setHudCommonSense,
    showTransition,
    showFinalScreen,
    bumpSecret,
    get currentScreen() { return currentScreen; },
  };
})();
