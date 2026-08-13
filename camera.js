// camera.js
// Side-scrolling camera: follows the player horizontally with smooth
// lerp and a small look-ahead bias. Vertically, the camera mostly
// holds a level-appropriate resting position (ground comfortably in
// the lower portion of the frame) but will smoothly pan upward when
// the player climbs into the level's higher platforms, and back down
// as they descend -- this keeps very tall level sections readable
// even on short/wide viewports where a purely static offset can't fit
// the whole vertical span at once.

const LOOKAHEAD = 60;
const SMOOTH_X = 5.5;
const SMOOTH_Y = 3.2;
const TOP_MARGIN = 40;    // keep at least this much screen space above the player
const BOTTOM_ANCHOR = 0.68; // resting fraction of screen height below which ground sits

export class Camera2D {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0;
    this.y = 0;
    this.targetLookahead = 0;
  }

  _restingY(groundY) {
    return groundY - this.viewH * BOTTOM_ANCHOR;
  }

  snapTo(playerX, playerY, levelWidth, groundY) {
    const desiredX = clamp(playerX - this.viewW / 2, 0, Math.max(0, levelWidth - this.viewW));
    this.x = desiredX;
    this.y = this._clampedY(playerY, groundY);
    this.targetLookahead = 0;
  }

  // Camera.y (top edge of the visible world, world-space): the resting
  // position keeps the ground near the bottom of the frame. If the
  // player climbs high enough that the resting position would put them
  // within TOP_MARGIN of the top edge (or above it), the camera pans
  // up just enough to keep TOP_MARGIN of headroom above the player.
  // It never scrolls lower than the resting position (so the ground
  // stays anchored once the player is back down near it).
  _clampedY(playerY, groundY) {
    const resting = this._restingY(groundY);
    const requiredForPlayer = playerY - this.viewH + TOP_MARGIN;
    return Math.min(resting, requiredForPlayer);
  }

  update(dt, playerX, playerY, facing, levelWidth, groundY) {
    const desiredLookahead = facing * LOOKAHEAD;
    this.targetLookahead += (desiredLookahead - this.targetLookahead) * Math.min(1, SMOOTH_X * 0.5 * dt);

    const desiredX = clamp(
      playerX + this.targetLookahead - this.viewW / 2,
      0,
      Math.max(0, levelWidth - this.viewW)
    );
    this.x += (desiredX - this.x) * Math.min(1, SMOOTH_X * dt);

    const desiredY = this._clampedY(playerY, groundY);
    this.y += (desiredY - this.y) * Math.min(1, SMOOTH_Y * dt);
  }

  shake(amount) {
    this._shakeAmount = amount;
    this._shakeTime = 0.25;
  }

  applyShake(dt) {
    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const t = Math.max(0, this._shakeTime / 0.25);
      return {
        x: (Math.random() - 0.5) * this._shakeAmount * t,
        y: (Math.random() - 0.5) * this._shakeAmount * t,
      };
    }
    return { x: 0, y: 0 };
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
