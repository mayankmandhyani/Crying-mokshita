/* ==========================================================================
   CAMERA-CONTROLLER.JS — Smooth third-person follow camera. Adapted from
   the prototype's simple lerp-follow, but with: jump/fall framing
   adjustments, an instant-snap mode for respawns (so the camera never
   drags the old position across the level after a teleport), and basic
   ground-avoidance so the camera doesn't dip below the floor on steep
   terrain transitions.
   ========================================================================== */

import * as THREE from "three";

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.distance = 6.5;
    this.height = 3.1;
    this.lookHeight = 1.55;
    this.followLerpBase = 0.0006; // lower = smoother/laggier
    this.rotationLerp = 10;       // higher = snappier rotation follow

    this._currentYaw = 0;
    this._targetPos = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._snapNext = true;
  }

  // Call after teleporting the player (respawn, level load) so the camera
  // jumps straight to the correct framing instead of smoothly dragging in
  // from wherever it happened to be.
  requestSnap() {
    this._snapNext = true;
  }

  update(dt, playerPosition, playerFacingAngle, playerVerticalVelocity, onGround) {
    // Smooth the yaw we use for camera placement, separately from the
    // player's own instantaneous facing, so quick direction changes don't
    // whip the camera around violently.
    let angleDelta = playerFacingAngle - this._currentYaw;
    // shortest-path angle wrap
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    this._currentYaw += angleDelta * Math.min(1, this.rotationLerp * dt);

    const forward = new THREE.Vector3(Math.sin(this._currentYaw), 0, Math.cos(this._currentYaw));

    // Slightly pull the camera back and up during a jump/fall for better
    // downward visibility, per the brief's "slightly adjust framing while
    // jumping" requirement.
    let heightAdjust = 0;
    let distAdjust = 0;
    if (!onGround) {
      if (playerVerticalVelocity > 0.5) { heightAdjust = 0.4; distAdjust = 0.6; }
      else if (playerVerticalVelocity < -0.5) { heightAdjust = 0.9; distAdjust = 0.9; }
    }

    this._targetPos.copy(playerPosition)
      .addScaledVector(forward, -(this.distance + distAdjust))
      .add(new THREE.Vector3(0, this.height + heightAdjust, 0));

    this._lookTarget.copy(playerPosition).add(new THREE.Vector3(0, this.lookHeight, 0));

    if (this._snapNext) {
      this.camera.position.copy(this._targetPos);
      this._snapNext = false;
    } else {
      const lerpFactor = 1 - Math.pow(this.followLerpBase, dt);
      this.camera.position.lerp(this._targetPos, lerpFactor);
    }

    // Simple floor-avoidance: never let the camera itself go below a
    // small margin above the player's feet, which prevents the camera
    // clipping through a platform edge on steep height transitions.
    const minCamY = playerPosition.y + 0.6;
    if (this.camera.position.y < minCamY) this.camera.position.y = minCamY;

    this.camera.lookAt(this._lookTarget);
  }
}
