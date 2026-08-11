/* ==========================================================================
   MAIN.JS — Boot sequence, menu wiring, modal wiring, mute toggling,
   secret Mayank Mode trigger, final screen "play again".
   ========================================================================== */

(function () {
  const bootMessages = [
    'Calibrating absurdity levels…',
    'Locating Common Sense (not finding it)…',
    'Rendering parkour…',
    'Installing sibling humor module…',
    'Almost ready…',
  ];

  function runBootSequence(onDone) {
    const fill = document.getElementById('boot-bar-fill');
    const status = document.getElementById('boot-status');
    let progress = 0;
    let msgIndex = 0;
    status.textContent = bootMessages[0];

    const interval = setInterval(() => {
      progress += 8 + Math.random() * 14;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(onDone, 260);
      }
      fill.style.width = progress + '%';
      const nextMsgIndex = Math.min(bootMessages.length - 1, Math.floor((progress / 100) * bootMessages.length));
      if (nextMsgIndex !== msgIndex) {
        msgIndex = nextMsgIndex;
        status.textContent = bootMessages[msgIndex];
      }
    }, 140);
  }

  function updateMuteIcons() {
    const muted = GameAudio.isMuted();
    const icon = muted ? '🔇' : '🔊';
    document.getElementById('mute-btn').textContent = icon;
    document.getElementById('mute-btn-game').textContent = icon;
  }

  function toggleMute() {
    GameAudio.setMuted(!GameAudio.isMuted());
    updateMuteIcons();
  }

  function wireMenu() {
    document.getElementById('btn-start').addEventListener('click', () => {
      GameAudio.unlock();
      GameAudio.click();
      Game.startLevel(0);
    });

    document.getElementById('btn-howto').addEventListener('click', () => {
      GameAudio.unlock();
      GameAudio.click();
      document.getElementById('howto-modal').classList.add('active');
    });
    document.getElementById('btn-howto-close').addEventListener('click', () => {
      GameAudio.click();
      document.getElementById('howto-modal').classList.remove('active');
    });

    document.getElementById('mute-btn').addEventListener('click', toggleMute);
    document.getElementById('mute-btn-game').addEventListener('click', toggleMute);

    // Secret Mayank Mode — click the tiny dot 7 times.
    document.getElementById('secret-dot').addEventListener('click', () => {
      UI.bumpSecret();
    });
    document.getElementById('btn-secret-close').addEventListener('click', () => {
      GameAudio.click();
      document.getElementById('secret-modal').classList.remove('active');
    });
  }

  function wirePause() {
    document.getElementById('pause-btn').addEventListener('click', () => {
      GameAudio.click();
      Game.togglePause();
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
      GameAudio.click();
      Game.togglePause();
    });
    document.getElementById('btn-restart-level').addEventListener('click', () => {
      GameAudio.click();
      document.getElementById('pause-modal').classList.remove('active');
      Game.restartLevel();
    });
    document.getElementById('btn-quit-menu').addEventListener('click', () => {
      GameAudio.click();
      document.getElementById('pause-modal').classList.remove('active');
      Game.quitToMenu();
    });
  }

  function wireFinal() {
    document.getElementById('btn-play-again').addEventListener('click', () => {
      GameAudio.click();
      Game.startLevel(0);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    Game.init();
    wireMenu();
    wirePause();
    wireFinal();
    updateMuteIcons();

    runBootSequence(() => {
      UI.showScreen('menu-screen');
    });
  });

  // Unlock audio context on first user interaction anywhere (mobile requirement).
  ['touchstart', 'click', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, () => GameAudio.unlock(), { once: true, passive: true });
  });
})();
