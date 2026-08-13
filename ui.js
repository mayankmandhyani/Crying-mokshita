// ui.js
// Handles all DOM/HUD updates: Common Sense counter, level label,
// level intro title cards, ending text sequence. Deliberately kept
// minimal per spec — no debug info, no permanent notification boxes.

export class UI {
  constructor() {
    this.csCount = document.getElementById('cs-count');
    this.csTotal = document.getElementById('cs-total');
    this.csCounter = document.getElementById('cs-counter');
    this.levelLabel = document.getElementById('level-label');

    this.levelIntro = document.getElementById('level-intro');
    this.levelIntroNumber = document.getElementById('level-intro-number');
    this.levelIntroTitle = document.getElementById('level-intro-title');

    this.endingScreen = document.getElementById('ending-screen');
    this.endingLines = [
      document.getElementById('ending-text-1'),
      document.getElementById('ending-text-2'),
      document.getElementById('ending-text-3'),
      document.getElementById('ending-text-4'),
    ];
    this.restartBtn = document.getElementById('restart-btn');

    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBarFill = document.getElementById('loading-bar-fill');

    this.fadeOverlay = document.getElementById('fade-overlay');

    this._introTimer = null;
  }

  setLoadingProgress(pct) {
    this.loadingBarFill.style.width = `${Math.round(pct * 100)}%`;
  }

  hideLoadingScreen() {
    this.loadingScreen.classList.add('hidden');
  }

  setTotalCommonSense(total) {
    this.csTotal.textContent = String(total);
  }

  setCommonSenseCount(count) {
    this.csCount.textContent = String(count);
    this.csCounter.classList.add('pulse');
    setTimeout(() => this.csCounter.classList.remove('pulse'), 220);
  }

  setLevelLabel(n) {
    this.levelLabel.textContent = `Level ${n}`;
  }

  showLevelIntro(levelNumber, title, durationMs = 2600) {
    if (this._introTimer) {
      clearTimeout(this._introTimer);
      this._introTimer = null;
    }
    this.levelIntroNumber.textContent = `LEVEL ${levelNumber}`;
    this.levelIntroTitle.textContent = title;
    this.levelIntro.classList.remove('hide');
    this.levelIntro.classList.add('show');

    this._introTimer = setTimeout(() => {
      this.levelIntro.classList.remove('show');
      this.levelIntro.classList.add('hide');
    }, durationMs);
  }

  fadeToBlack(durationMs = 500) {
    this.fadeOverlay.style.transitionDuration = `${durationMs}ms`;
    this.fadeOverlay.classList.add('active');
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  fadeFromBlack(durationMs = 500) {
    this.fadeOverlay.style.transitionDuration = `${durationMs}ms`;
    this.fadeOverlay.classList.remove('active');
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  // Force-clear the fade overlay instantly. Used as a safety net so a
  // failed transition can never leave a permanent black screen (spec 23).
  forceFadeCleared() {
    this.fadeOverlay.style.transitionDuration = '0ms';
    this.fadeOverlay.classList.remove('active');
  }

  async runEndingSequence(onRestart) {
    this.endingScreen.classList.add('active');
    const lines = this.endingLines;
    const texts = [
      'YOU DID IT! 🎉',
      "You thought you were going to collect Common Sense...\n\nTurns out, we just made you do parkour for it. 😭",
      'Happy Raksha Bandhan ❤️',
      'Made with love, chaos, and questionable sibling decisions.',
    ];

    lines[1].style.whiteSpace = 'pre-line';

    for (let i = 0; i < lines.length; i++) {
      lines[i].textContent = texts[i];
      await this._wait(i === 0 ? 400 : 900);
      lines[i].classList.add('show');
    }

    await this._wait(700);
    this.restartBtn.classList.add('show');
    this.restartBtn.onclick = onRestart;
  }

  resetEndingScreen() {
    this.endingScreen.classList.remove('active');
    for (const line of this.endingLines) line.classList.remove('show');
    this.restartBtn.classList.remove('show');
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  showMobileControls(show) {
    document.getElementById('mobile-controls').classList.toggle('active', show);
  }
}
