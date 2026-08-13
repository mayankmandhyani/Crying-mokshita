// camera.js
// Smooth third-person follow camera.
// Positioned back and above the player at a downward angle so the
// player occupies roughly 15-25% of vertical screen space and the
// upcoming path (platforms/gaps/hazards) stays visible.

import * as THREE from 'three';

const FOLLOW_DISTANCE = 7.2;
const FOLLOW_HEIGHT = 4.4;
const LOOK_HEIGHT_OFFSET = 1.1; // look slightly above player feet (roughly chest height)
const LOOK_AHEAD_DISTANCE = 2.6; // bias look target toward direction of travel
const POSITION_SMOOTH = 4.2;
const LOOK_SMOOTH = 6.0;

export class GameCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 200);
    this.currentPos = new THREE.Vector3(0, FOLLOW_HEIGHT, FOLLOW_DISTANCE);
    this.currentLookAt = new THREE.Vector3(0, LOOK_HEIGHT_OFFSET, 0);
    this.camera.position.copy(this.currentPos);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // Snap instantly (used on respawn / level transitions so the camera
  // doesn't visibly swoop across the map).
  snapTo(playerPos, facingAngle) {
    const desired = this._desiredPosition(playerPos, facingAngle);
    this.currentPos.copy(desired);
    this.currentLookAt.set(playerPos.x, playerPos.y + LOOK_HEIGHT_OFFSET, playerPos.z);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  _desiredPosition(playerPos) {
    // Camera sits behind the player along -Z travel direction (levels
    // run down -Z), slightly elevated, looking down at a gentle angle.
    // We keep it mostly fixed-behind rather than fully orbit-following
    // rotation for readability (per spec: path must stay readable).
    return new THREE.Vector3(
      playerPos.x * 0.35, // slight horizontal parallax toward player x
      playerPos.y + FOLLOW_HEIGHT,
      playerPos.z + FOLLOW_DISTANCE
    );
  }

  update(dt, playerPos, moveDirZ) {
    const desired = this._desiredPosition(playerPos);
    const posT = 1 - Math.exp(-POSITION_SMOOTH * dt);
    this.currentPos.lerp(desired, posT);
    this.camera.position.copy(this.currentPos);

    const lookAhead = moveDirZ < 0 ? -LOOK_AHEAD_DISTANCE : (moveDirZ > 0 ? LOOK_AHEAD_DISTANCE * 0.4 : 0);
    const desiredLook = new THREE.Vector3(
      playerPos.x * 0.5,
      playerPos.y + LOOK_HEIGHT_OFFSET,
      playerPos.z + lookAhead
    );
    const lookT = 1 - Math.exp(-LOOK_SMOOTH * dt);
    this.currentLookAt.lerp(desiredLook, lookT);
    this.camera.lookAt(this.currentLookAt);
  }
}
