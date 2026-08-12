/* ==========================================================================
   PLAYER-CONTROLLER.JS — Movement, gravity, jump, and collision against a
   list of axis-aligned box colliders (platforms/hazards). This is the 3D
   analogue of the 2D game's player.js: same design goals (forgiving jump
   arcs, explicit collision resolution, no tunneling at normal frame rates),
   adapted to three dimensions.

   COLLISION STRATEGY:
   The player is treated as a vertical capsule approximated by a cylinder
   for collision purposes (radius + height). Each platform is an AABB box.
   Every frame:
     1. Apply gravity to vertical velocity.
     2. Move horizontally, resolve X/Z collisions against all platform
        tops+sides (so the player can't walk through a platform's edge).
     3. Move vertically, resolve Y collision (landing on top / hitting a
        ceiling), using the same "previous Y" technique as the 2D game to
        correctly distinguish landing from tunneling-through at high speed.
   ========================================================================== */

import * as THREE from "three";

// Tuned jump physics — see PHYSICS_NOTES.md for the derivation. Comfortable
// margins were computed against these before any level geometry was built.
export const PHYSICS = {
  gravity: 22,          // units/s^2
  jumpVelocity: 9.0,     // initial upward velocity on jump
  walkSpeed: 4.2,
  runSpeed: 7.5,
  airControlFactor: 0.85, // horizontal control while airborne (slightly reduced)
  maxFallSpeed: 26,
  coyoteTime: 0.12,      // grace period after leaving a ledge
  jumpBufferTime: 0.14,  // grace period for an early jump press
};

// Derived, for level-design reference (also asserted against in level data
// validation — see levels.js).
export const MAX_JUMP_HEIGHT = (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity);
export const MAX_JUMP_RANGE = PHYSICS.runSpeed * (2 * PHYSICS.jumpVelocity / PHYSICS.gravity);

export class PlayerController {
  constructor(character, animator) {
    this.character = character;
    this.animator = animator;

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.radius = character.userData.collisionRadius;
    this.height = character.userData.standHeight;

    this.onGround = false;
    this.facingAngle = 0;

    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHeld = false;

    this.deathState = false; // true while playing the death/respawn sequence
    this.celebrateState = false;

    this.spawnPoint = new THREE.Vector3(0, 0, 0);
    this.lastCheckpoint = new THREE.Vector3(0, 0, 0);
  }

  setSpawn(pos) {
    this.spawnPoint.copy(pos);
    this.lastCheckpoint.copy(pos);
  }

  setCheckpoint(pos) {
    this.lastCheckpoint.copy(pos);
  }

  teleportTo(pos) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.character.position.copy(this.position);
  }

  respawnAtCheckpoint() {
    this.teleportTo(this.lastCheckpoint);
    this.deathState = false;
    this.animator.setState('idle');
  }

  // input: { moveX, moveZ (world-space intent, already camera-relative),
  //          jumpPressed, running }
  // colliders: array of { box: THREE.Box3, isHazard, id }
  update(dt, input, colliders, onHazard, onFallOut, worldBounds) {
    if (this.deathState || this.celebrateState) {
      // Movement is frozen during death/respawn or the ending celebration —
      // still let gravity + collision run so the character doesn't float,
      // but ignore player input entirely.
      this._applyGravityAndVerticalCollision(dt, colliders);
      return;
    }

    // ---- Horizontal input ----
    const speed = input.running ? PHYSICS.runSpeed : PHYSICS.walkSpeed;
    const controlFactor = this.onGround ? 1 : PHYSICS.airControlFactor;
    const moveVec = new THREE.Vector3(input.moveX, 0, input.moveZ);
    const moving = moveVec.lengthSq() > 0.0001;

    if (moving) {
      moveVec.normalize();
      this.facingAngle = Math.atan2(moveVec.x, moveVec.z);
    }

    const targetVX = moving ? moveVec.x * speed : 0;
    const targetVZ = moving ? moveVec.z * speed : 0;
    // Smooth acceleration rather than instant velocity snap, scaled by
    // control factor so air control feels slightly looser than ground control.
    const accelRate = this.onGround ? 14 : 14 * controlFactor;
    this.velocity.x += (targetVX - this.velocity.x) * Math.min(1, accelRate * dt);
    this.velocity.z += (targetVZ - this.velocity.z) * Math.min(1, accelRate * dt);

    // ---- Jump input (buffered + coyote time, same design as the 2D game) ----
    if (input.jumpPressed) this.jumpBufferTimer = PHYSICS.jumpBufferTime;

    // ---- Horizontal movement + collision ----
    this._moveAndCollideHorizontal(dt, colliders);

    // ---- Gravity + vertical collision ----
    const wasOnGround = this.onGround;
    this._applyGravityAndVerticalCollision(dt, colliders);

    // Coyote time bookkeeping (after vertical collision has set onGround for this frame)
    if (this.onGround) {
      this.coyoteTimer = PHYSICS.coyoteTime;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

    // Consume a buffered jump now that this frame's true onGround state is known.
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = PHYSICS.jumpVelocity;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this._justJumped = true;
    }

    // Landing feedback (only fires on the frame we transition airborne -> grounded)
    if (!wasOnGround && this.onGround) {
      this.animator.triggerLandingPose();
      this._justLanded = true;
    }

    // ---- World bounds / fall-out detection ----
    if (worldBounds) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, worldBounds.minX, worldBounds.maxX);
      this.position.z = THREE.MathUtils.clamp(this.position.z, worldBounds.minZ, worldBounds.maxZ);
    }
    if (this.position.y < (worldBounds?.killY ?? -20)) {
      onFallOut && onFallOut();
    }

    // ---- Hazard check (separate from platform collision — hazards are
    // trigger volumes, not solid) ----
    if (onHazard) {
      for (const c of colliders) {
        if (!c.isHazard) continue;
        if (this._playerIntersectsBox(c.box)) {
          onHazard(c);
          break;
        }
      }
    }

    // Sync the visual character to the physics position.
    this.character.position.copy(this.position);
    this.character.rotation.y = this.facingAngle;

    // ---- Animation state selection ----
    this._updateAnimationState(moving, input.running);
  }

  _updateAnimationState(moving, running) {
    if (this.deathState) { this.animator.setState('death'); return; }
    if (this.celebrateState) { this.animator.setState('celebrate'); return; }

    if (!this.onGround) {
      this.animator.setState(this.velocity.y > 0.5 ? 'jump' : 'fall');
    } else if (moving) {
      this.animator.setState(running ? 'run' : 'walk');
    } else {
      this.animator.setState('idle');
    }
  }

  _playerBox(pos = this.position) {
    // Cylinder-as-box approximation for broad-phase / simple collision.
    return new THREE.Box3(
      new THREE.Vector3(pos.x - this.radius, pos.y, pos.z - this.radius),
      new THREE.Vector3(pos.x + this.radius, pos.y + this.height, pos.z + this.radius)
    );
  }

  _playerIntersectsBox(box) {
    return this._playerBox().intersectsBox(box);
  }

  _moveAndCollideHorizontal(dt, colliders) {
    // Move X and Z independently so sliding along a wall works correctly
    // (moving diagonally into a corner shouldn't fully stop the player).
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;

    // X axis
    this.position.x += dx;
    for (const c of colliders) {
      if (c.isHazard) continue;
      const box = this._playerBox();
      if (box.intersectsBox(c.box)) {
        // Only resolve if this is genuinely a solid-side collision — i.e.
        // the player's vertical span overlaps the platform's vertical
        // span in a way that isn't "standing on top" (top landings are
        // resolved separately in the vertical pass). Skip resolving here
        // if the player's feet are already at/above the platform's top
        // surface (they're standing on it, not walking into its side).
        if (this.position.y >= c.box.max.y - 0.05) continue;
        if (dx > 0) this.position.x = c.box.min.x - this.radius - 0.001;
        else if (dx < 0) this.position.x = c.box.max.x + this.radius + 0.001;
        this.velocity.x = 0;
      }
    }

    // Z axis
    this.position.z += dz;
    for (const c of colliders) {
      if (c.isHazard) continue;
      const box = this._playerBox();
      if (box.intersectsBox(c.box)) {
        if (this.position.y >= c.box.max.y - 0.05) continue;
        if (dz > 0) this.position.z = c.box.min.z - this.radius - 0.001;
        else if (dz < 0) this.position.z = c.box.max.z + this.radius + 0.001;
        this.velocity.z = 0;
      }
    }
  }

  _applyGravityAndVerticalCollision(dt, colliders) {
    this.velocity.y -= PHYSICS.gravity * dt;
    if (this.velocity.y < -PHYSICS.maxFallSpeed) this.velocity.y = -PHYSICS.maxFallSpeed;

    const prevY = this.position.y;
    this.position.y += this.velocity.y * dt;

    this.onGround = false;

    for (const c of colliders) {
      if (c.isHazard) continue;
      const box = this._playerBox();
      if (!box.intersectsBox(c.box)) continue;

      // Only meaningful if there's real horizontal overlap (not just a
      // sliver at the very corner) — same fix as the 2D game's collision
      // system, ported to 3D: a shallow corner graze should not count as
      // a stable landing or a ceiling bonk.
      const overlapX = Math.min(box.max.x, c.box.max.x) - Math.max(box.min.x, c.box.min.x);
      const overlapZ = Math.min(box.max.z, c.box.max.z) - Math.max(box.min.z, c.box.min.z);
      const minOverlap = Math.min(this.radius * 0.6, 0.15);
      if (overlapX < minOverlap || overlapZ < minOverlap) continue;

      const prevFeet = prevY;
      const prevHead = prevY + this.height;

      if (this.velocity.y <= 0 && prevFeet >= c.box.max.y - 0.02) {
        // Landing on top.
        this.position.y = c.box.max.y;
        this.velocity.y = 0;
        this.onGround = true;
      } else if (this.velocity.y > 0 && prevHead <= c.box.min.y + 0.02) {
        // Hit head on the underside.
        this.position.y = c.box.min.y - this.height;
        this.velocity.y = 0;
      }
      // Any other overlap case (e.g. falling past a corner without having
      // been above the platform) is intentionally left unresolved here,
      // matching the 2D game's fix: a fast diagonal fall that clips a
      // corner should pass through rather than get stuck.
    }
  }
}
