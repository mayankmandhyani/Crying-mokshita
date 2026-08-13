// effects.js
// Lightweight canvas particle systems: pickup sparkle burst, death
// burst, and celebratory confetti. Kept cheap (small particle counts,
// simple physics) for mobile performance.

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnBurst(x, y, opts = {}) {
    const {
      count = 10, color = '#ffe27a', speed = 140, spread = Math.PI * 2,
      gravity = 500, life = 0.6, size = 3, startAngle = 0,
    } = opts;
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s - 60,
        gravity,
        life: 0,
        maxLife: life * (0.7 + Math.random() * 0.6),
        size: size * (0.7 + Math.random() * 0.6),
        color,
        alpha: 1,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }
  }

  draw(ctx, camX) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

const CONFETTI_COLORS = ['#ff6a3d', '#ffd97a', '#8ce6ff', '#7be08a', '#ff2d7a', '#ffffff'];

export class Confetti {
  constructor() {
    this.pieces = [];
  }

  burst(x, y, count = 90) {
    for (let i = 0; i < count; i++) {
      this.pieces.push({
        x: x + (Math.random() - 0.5) * 120,
        y: y + Math.random() * 40 - 60,
        vx: (Math.random() - 0.5) * 90,
        vy: -220 - Math.random() * 160,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        w: 5 + Math.random() * 3,
        h: 7 + Math.random() * 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 0,
        maxLife: 3 + Math.random() * 1.8,
        alpha: 1,
      });
    }
  }

  update(dt) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.life += dt;
      p.vy += 340 * dt;
      p.vx += Math.sin(p.life * 3 + p.x) * 20 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio > 0.75) p.alpha = Math.max(0, 1 - (lifeRatio - 0.75) / 0.25);
      if (p.life > p.maxLife) this.pieces.splice(i, 1);
    }
  }

  draw(ctx) {
    // confetti is drawn in SCREEN space (not world space) since it's
    // an ending-sequence overlay effect, not part of the scrolling level
    for (const p of this.pieces) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }

  clear() {
    this.pieces = [];
  }
}
