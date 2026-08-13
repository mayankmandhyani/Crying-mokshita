// player.js
// Player controller: owns position/velocity and the animation-state
// machine (idle/run/jump/fall/land/dead/celebrate). Physics
// integration itself lives in physics.js; this ties input to that.

import {
  GRAVITY, MAX_FALL_SPEED, MOVE_SPEED, ACCEL, DECEL, AIR_ACCEL,
  JUMP_VELOCITY, JUMP_CUT_MULTIPLIER, COYOTE_TIME, JUMP_BUFFER_TIME,
  resolveHorizontal, resolveVertical,
} from './physics.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y; // feet position
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.groundedPlatform = null;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHeld = false;

    this.animState = 'idle';
    this.animTime = 0;
    this.landSquash = 0;
    this.deathTime = 0;
    this.expression = 'sad';
  }

  teleport(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.setAnim('idle');
  }

  setAnim(state) {
    if (this.animState === state) return;
    this.animState = state;
    this.animTime = 0;
    if (state === 'land') this.landSquash = 1;
  }

  requestJump() {
    this.jumpBufferTimer = JUMP_BUFFER_TIME;
  }

  update(dt, input, platforms) {
    const { left, right, jumpHeld } = input;

    // --- horizontal input -> target velocity ---
    let moveDir = 0;
    if (left) moveDir -= 1;
    if (right) moveDir += 1;

    const accel = this.grounded ? ACCEL : AIR_ACCEL;
    const decel = this.grounded ? DECEL : AIR_ACCEL * 0.6;

    if (moveDir !== 0) {
      const targetVX = moveDir * MOVE_SPEED;
      const rate = this.grounded ? accel : AIR_ACCEL;
      this.vx += (targetVX - this.vx) * Math.min(1, (rate / MOVE_SPEED) * dt);
      this.facing = moveDir;
    } else {
      this.vx += (0 - this.vx) * Math.min(1, (decel / MOVE_SPEED) * dt);
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }

    // --- coyote time + jump buffer bookkeeping ---
    if (this.grounded) this.coyoteTimer = COYOTE_TIME;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    const canJump = this.coyoteTimer > 0;
    if (this.jumpBufferTimer > 0 && canJump) {
      this.vy = -JUMP_VELOCITY;
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.setAnim('jump');
      if (this.onJump) this.onJump();
    }

    // variable jump height: releasing jump early while still moving
    // upward cuts the remaining upward velocity.
    if (!jumpHeld && this.jumpHeld && this.vy < 0) {
      this.vy *= JUMP_CUT_MULTIPLIER;
    }
    this.jumpHeld = jumpHeld;

    // --- gravity ---
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // --- resolve collisions ---
    const dx = this.vx * dt;
    this.x = resolveHorizontal(this.x, this.y, dx, platforms);

    const wasGrounded = this.grounded;
    const vRes = resolveVertical(this.x, this.y, this.vy, dt, platforms);
    this.y = vRes.y;
    this.vy = vRes.velY;
    this.grounded = vRes.grounded;
    this.groundedPlatform = vRes.groundedPlatform;

    // carry player with moving platforms
    if (this.grounded && this.groundedPlatform && this.groundedPlatform.prevX !== undefined) {
      const p = this.groundedPlatform;
      this.x += p.x - p.prevX;
      this.y += p.y - p.prevY;
    }

    // --- animation state transitions ---
    if (!wasGrounded && this.grounded) {
      this.setAnim('land');
      if (this.onLand) this.onLand();
    } else if (this.animState === 'land') {
      this.landSquash = Math.max(0, this.landSquash - dt / 0.16);
      if (this.landSquash <= 0) {
        this.setAnim(this.grounded ? (moveDir !== 0 ? 'run' : 'idle') : 'fall');
      }
    } else if (this.grounded) {
      this.setAnim(moveDir !== 0 ? 'run' : 'idle');
    } else {
      if (this.vy < -20) {
        if (this.animState !== 'jump') this.setAnim('jump');
      } else {
        this.setAnim('fall');
      }
    }

    this.animTime += dt;
  }
}
