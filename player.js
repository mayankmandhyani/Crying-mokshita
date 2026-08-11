/* ==========================================================================
   PLAYER.JS — Avatar physics + procedural cartoon rendering + animation
   states. No external sprite sheet is required by default: the avatar is
   drawn with canvas primitives so the game works out-of-the-box. See the
   README section "Where I can replace the avatar" to swap in an image.
   ========================================================================== */

// Avatar palette — easy to re-theme. Change these to restyle the character
// without touching the drawing logic.
const AVATAR_THEME = {
  skin: '#e8b48a',
  skinShade: '#d49a6c',
  hair: '#1c1720',
  hairShine: '#332a3c',
  top: '#4a3b56',
  topShade: '#3a2e44',
  pants: '#5a6a8a',
  pantsShade: '#48566f',
  shoes: '#242028',
  cheeks: '#f0a598',
  outline: 'rgba(20,14,30,0.35)'
};

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 34;
    this.h = 52;
    this.vx = 0;
    this.vy = 0;
    this.speed = 260;
    this.jumpForce = 620;
    this.onGround = false;
    this.facing = 1; // 1 = right, -1 = left
    this.state = 'idle'; // idle, run, jump, fall, celebrate, confused
    this.animTime = 0;
    this.stunTimer = 0;
    this.celebrateTimer = 0;
    this.confusedTimer = 0;
    this.spawnX = x;
    this.spawnY = y;
    this.squash = 1; // squash & stretch factor
    this.prevY = y;
    this.coyoteTimer = 0;     // grace period after walking off a ledge
    this.jumpBufferTimer = 0; // grace period for a jump pressed just before landing
  }

  reset(x, y) {
    this.x = x != null ? x : this.spawnX;
    this.y = y != null ? y : this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.state = 'idle';
    this.stunTimer = 0;
    this.celebrateTimer = 0;
    this.confusedTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  setCheckpoint(x, y) {
    this.spawnX = x;
    this.spawnY = y;
  }

  triggerCelebrate(duration = 1.2) {
    this.celebrateTimer = duration;
  }

  triggerConfused(duration = 1.0) {
    this.confusedTimer = duration;
  }

  get bounds() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  update(dt, input, world) {
    // gravity
    const GRAVITY = 1500;

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
    } else if (this.celebrateTimer > 0) {
      this.celebrateTimer -= dt;
      this.vx *= 0.85;
    } else if (this.confusedTimer > 0) {
      this.confusedTimer -= dt;
      this.vx *= 0.85;
    } else {
      // horizontal movement
      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;
      this.vx = move * this.speed;
      if (move !== 0) this.facing = move > 0 ? 1 : -1;

      // Record a jump press into the buffer; actual consumption happens
      // after collision resolution below, once we know this frame's true
      // onGround state (see jump buffer / coyote time block).
      if (input.jumpPressed) this.jumpBufferTimer = 0.12;
    }

    this.vy += GRAVITY * dt;
    if (this.vy > 1400) this.vy = 1400;

    // integrate
    const prevYBeforeMove = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // world collision (platforms)
    this.onGround = false;
    if (world && world.platforms) {
      for (const p of world.platforms) {
        this.resolvePlatformCollision(p, prevYBeforeMove);
      }
    }
    this.prevY = prevYBeforeMove;

    // coyote time: refresh the grace window while grounded, count it down
    // once the player leaves the ground (walking off a ledge, etc).
    if (this.onGround) {
      this.coyoteTimer = 0.1;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }
    // jump buffer: counts down regardless, so a press only "counts" for a
    // short window even if the player hasn't landed yet.
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
    }

    // Consume a buffered jump the instant both windows are open — this is
    // what actually makes coyote time AND jump buffering work correctly,
    // since it runs after this frame's real onGround state is known.
    const canAct = this.stunTimer <= 0 && this.celebrateTimer <= 0 && this.confusedTimer <= 0;
    if (canAct && this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = -this.jumpForce;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      GameAudio.jump();
      this.squash = 1.3;
    }

    // world bounds
    if (world) {
      if (this.x - this.w / 2 < world.minX) { this.x = world.minX + this.w / 2; this.vx = 0; }
      if (this.x + this.w / 2 > world.maxX) { this.x = world.maxX - this.w / 2; this.vx = 0; }
      if (this.y > world.killY) {
        world.onFall && world.onFall();
      }
    }

    // squash/stretch recovery
    this.squash += (1 - this.squash) * Math.min(1, dt * 10);

    // animation state machine
    this.animTime += dt;
    if (this.stunTimer > 0) {
      this.state = 'confused';
    } else if (this.celebrateTimer > 0) {
      this.state = 'celebrate';
    } else if (this.confusedTimer > 0) {
      this.state = 'confused';
    } else if (!this.onGround && this.vy < 0) {
      this.state = 'jump';
    } else if (!this.onGround && this.vy >= 0) {
      this.state = 'fall';
    } else if (Math.abs(this.vx) > 5) {
      this.state = 'run';
    } else {
      this.state = 'idle';
    }
  }

  resolvePlatformCollision(p, prevY) {
    const b = this.bounds;
    const px = p.x, py = p.y, pw = p.w, ph = p.h;

    const overlapX = b.x < px + pw && b.x + b.w > px;
    const overlapY = b.y < py + ph && b.y + b.h > py;
    if (!(overlapX && overlapY)) return;

    // Determine collision side using the player's actual position before
    // this frame's movement was applied (tracked explicitly, not estimated).
    const prevBottom = prevY;
    const prevTop = prevY - this.h;

    if (this.vy >= 0 && prevBottom <= py + 2) {
      // landing on top
      this.y = py - 0.001;
      if (this.vy > 500) {
        GameAudio.land();
        this.squash = 0.65;
      }
      this.vy = 0;
      this.onGround = true;
    } else if (this.vy < 0 && prevTop >= py + ph - 2) {
      // hit head on underside
      this.y = py + ph + this.h;
      this.vy = 40;
    } else {
      // side collision — push out horizontally
      const centerP = px + pw / 2;
      if (this.x < centerP) {
        this.x = px - this.w / 2 - 0.5;
      } else {
        this.x = px + pw + this.w / 2 + 0.5;
      }
      this.vx = 0;
    }
  }

  // ---------------- Rendering ----------------
  draw(ctx, camX) {
    const t = this.animTime;
    const drawX = this.x - camX;
    const drawY = this.y;

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.scale(this.facing, 1);

    // squash/stretch
    const sx = this.squash < 1 ? (2 - this.squash) : 1 / this.squash;
    const sy = this.squash;
    ctx.scale(1, 1); // baseline (avoid double scaling weirdness)

    let bob = 0, legSwing = 0, armSwing = 0, tilt = 0, bounceY = 0;

    if (this.state === 'idle') {
      bob = Math.sin(t * 2.4) * 1.6;
    } else if (this.state === 'run') {
      const cycle = t * 12;
      legSwing = Math.sin(cycle) * 16;
      armSwing = Math.sin(cycle + Math.PI) * 14;
      bob = Math.abs(Math.sin(cycle)) * 3;
    } else if (this.state === 'jump') {
      tilt = -8;
      armSwing = -20;
    } else if (this.state === 'fall') {
      tilt = 4;
      armSwing = 12;
    } else if (this.state === 'celebrate') {
      bounceY = -Math.abs(Math.sin(t * 10)) * 8;
      armSwing = Math.sin(t * 14) * 30;
      tilt = Math.sin(t * 10) * 6;
    } else if (this.state === 'confused') {
      tilt = Math.sin(t * 6) * 5;
      bob = Math.sin(t * 3) * 2;
    }

    ctx.translate(0, bob + bounceY);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.scale(1, sy);

    this.drawBody(ctx, legSwing, armSwing);

    ctx.restore();

    // confused "?" bubble
    if (this.state === 'confused') {
      ctx.save();
      ctx.translate(drawX + this.facing * 14, drawY - this.h - 14 + Math.sin(t * 6) * 2);
      ctx.font = 'bold 20px Fredoka, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeText('?', 0, 0);
      ctx.fillText('?', 0, 0);
      ctx.restore();
    }
  }

  drawBody(ctx, legSwing, armSwing) {
    const th = AVATAR_THEME;
    const w = this.w, h = this.h;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // shadow ellipse anchor is at (0,0) = feet position
    // Legs
    ctx.strokeStyle = th.pantsShade;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-5, -20);
    ctx.lineTo(-5 + legSwing * 0.25, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -20);
    ctx.lineTo(5 - legSwing * 0.25, -1);
    ctx.stroke();

    // shoes
    ctx.fillStyle = th.shoes;
    ctx.beginPath();
    ctx.ellipse(-5 + legSwing * 0.25, -1, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5 - legSwing * 0.25, -1, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // torso
    const torsoTop = -h + 16;
    const torsoBottom = -18;
    ctx.fillStyle = th.top;
    roundRect(ctx, -w / 2 + 4, torsoTop, w - 8, torsoBottom - torsoTop, 10);
    ctx.fill();
    ctx.fillStyle = th.topShade;
    roundRect(ctx, -w / 2 + 4, torsoBottom - 10, w - 8, 10, 6);
    ctx.fill();

    // arms
    ctx.strokeStyle = th.top;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, torsoTop + 8);
    ctx.lineTo(-w / 2 + 6 - 4, torsoTop + 26 + armSwing * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, torsoTop + 8);
    ctx.lineTo(w / 2 - 6 + 4, torsoTop + 26 - armSwing * 0.3);
    ctx.stroke();

    // hands
    ctx.fillStyle = th.skin;
    ctx.beginPath();
    ctx.arc(-w / 2 + 2, torsoTop + 26 + armSwing * 0.3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 + 2, torsoTop + 26 - armSwing * 0.3, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // head
    const headCY = torsoTop - 14;
    const headR = 15;

    // hair back
    ctx.fillStyle = th.hair;
    ctx.beginPath();
    ctx.ellipse(0, headCY + 4, headR + 3, headR + 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // face
    ctx.fillStyle = th.skin;
    ctx.beginPath();
    ctx.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // cheeks
    ctx.fillStyle = th.cheeks;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(-7, headCY + 4, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7, headCY + 4, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // hair front / fringe
    ctx.fillStyle = th.hair;
    ctx.beginPath();
    ctx.moveTo(-headR - 1, headCY - 2);
    ctx.quadraticCurveTo(0, headCY - headR - 10, headR + 1, headCY - 2);
    ctx.quadraticCurveTo(headR - 2, headCY - headR + 4, 0, headCY - headR + 2);
    ctx.quadraticCurveTo(-headR + 2, headCY - headR + 4, -headR - 1, headCY - 2);
    ctx.fill();

    // side hair strands
    ctx.beginPath();
    ctx.ellipse(-headR + 1, headCY + 6, 4, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headR - 1, headCY + 6, 4, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // eyes — expression depends on state
    ctx.fillStyle = '#241a2e';
    if (this.state === 'celebrate') {
      // happy closed-arc eyes
      ctx.strokeStyle = '#241a2e';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(-5, headCY - 1, 3, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(5, headCY - 1, 3, Math.PI, 0);
      ctx.stroke();
    } else if (this.state === 'confused') {
      ctx.beginPath();
      ctx.arc(-5, headCY - 1, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5.5, headCY - 2.6, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(-5, headCY - 1, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, headCY - 1, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // mouth
    ctx.strokeStyle = '#8a5a4a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (this.state === 'celebrate') {
      ctx.arc(0, headCY + 5, 4, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (this.state === 'confused') {
      ctx.moveTo(-3, headCY + 6);
      ctx.lineTo(3, headCY + 5);
    } else {
      ctx.arc(0, headCY + 4, 2.5, 0.2 * Math.PI, 0.8 * Math.PI);
    }
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
