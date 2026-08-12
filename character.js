/* ==========================================================================
   CHARACTER.JS — The 3D sister character, adapted from the reference
   prototype. Built from primitives (capsules/spheres) so no external model
   file is required. See README for how to swap in a real GLB/GLTF model
   later if one becomes available — the animation state machine here
   (idle/walk/run/jump/fall/land/death/celebrate) is designed to be reusable
   with a real skeletal rig too, not just these procedural limbs.
   ========================================================================== */

import * as THREE from "three";

const MATS = {
  skin: new THREE.MeshStandardMaterial({ color: 0xd99578, roughness: 0.82 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.65 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x29252b, roughness: 0.9 }),
  jeans: new THREE.MeshStandardMaterial({ color: 0x3d536c, roughness: 0.95 }),
  shoes: new THREE.MeshStandardMaterial({ color: 0x17151a, roughness: 0.9 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xf5f1e9, roughness: 0.7 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x17151a, roughness: 0.5 }),
  tear: new THREE.MeshStandardMaterial({ color: 0x86cfff, transparent: true, opacity: 0.82 }),
  bulb: new THREE.MeshStandardMaterial({ color: 0xffe46b, emissive: 0xffc52e, emissiveIntensity: 1.8 }),
  ring: new THREE.MeshStandardMaterial({ color: 0xfff2a1, emissive: 0xffd84a, emissiveIntensity: 2 }),
};

function capsule(radius, length, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 12), mat);
  m.castShadow = true;
  return m;
}
function sphere(s, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 16), mat);
  m.castShadow = true;
  return m;
}

export function createCharacter() {
  const root = new THREE.Group();
  root.name = 'CharacterRoot';

  const body = new THREE.Group();
  root.add(body);

  const torso = capsule(0.48, 0.82, MATS.shirt);
  torso.scale.set(1.0, 1.0, 0.68);
  torso.position.y = 1.62;
  body.add(torso);

  const neck = capsule(0.16, 0.18, MATS.skin);
  neck.position.y = 2.16;
  body.add(neck);

  const head = new THREE.Group();
  head.position.y = 2.58;
  body.add(head);

  const face = sphere(0.58, MATS.skin);
  face.scale.set(0.88, 1.05, 0.82);
  head.add(face);

  const hairCap = sphere(0.62, MATS.hair);
  hairCap.scale.set(0.94, 0.73, 0.86);
  hairCap.position.set(0, 0.18, -0.03);
  head.add(hairCap);

  for (const x of [-0.48, 0.48]) {
    const lock = capsule(0.16, 0.72, MATS.hair);
    lock.scale.set(0.85, 1, 0.7);
    lock.position.set(x, -0.02, 0.01);
    lock.rotation.z = x < 0 ? -0.12 : 0.12;
    head.add(lock);
  }

  const eyeMeshes = [];
  for (const x of [-0.20, 0.20]) {
    const eye = sphere(0.075, MATS.eye);
    eye.scale.set(1, 0.78, 0.45);
    eye.position.set(x, 0.06, 0.515);
    head.add(eye);

    const pupil = sphere(0.034, MATS.pupil);
    pupil.position.set(x, 0.05, 0.565);
    head.add(pupil);

    const tear = capsule(0.018, 0.20, MATS.tear);
    tear.position.set(x + (x < 0 ? -0.025 : 0.025), -0.12, 0.56);
    tear.rotation.z = x < 0 ? -0.12 : 0.12;
    tear.visible = true; // tears are part of her recognizable look; see setExpression()
    head.add(tear);
    eyeMeshes.push({ eye, pupil, tear });
  }

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 8, 20, Math.PI), MATS.pupil);
  mouth.scale.set(1, 0.65, 1);
  mouth.rotation.set(Math.PI / 2, 0, 0);
  mouth.position.set(0, -0.20, 0.545);
  head.add(mouth);

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.50, 1.85, 0);
  armR.position.set(0.50, 1.85, 0);
  body.add(armL, armR);

  for (const [arm] of [[armL], [armR]]) {
    const upper = capsule(0.16, 0.55, MATS.shirt);
    upper.position.y = -0.27;
    arm.add(upper);
    const fore = capsule(0.14, 0.46, MATS.skin);
    fore.position.y = -0.72;
    arm.add(fore);
    const hand = sphere(0.17, MATS.skin);
    hand.scale.set(0.8, 1, 0.8);
    hand.position.y = -1.0;
    arm.add(hand);
  }

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.23, 1.22, 0);
  legR.position.set(0.23, 1.22, 0);
  body.add(legL, legR);

  for (const [leg] of [[legL], [legR]]) {
    const thigh = capsule(0.19, 0.60, MATS.jeans);
    thigh.position.y = -0.30;
    leg.add(thigh);
    const shin = capsule(0.16, 0.58, MATS.jeans);
    shin.position.y = -0.83;
    leg.add(shin);
    const shoe = capsule(0.18, 0.28, MATS.shoes);
    shoe.scale.set(1.15, 0.75, 1.65);
    shoe.position.set(0, -1.17, 0.12);
    leg.add(shoe);
  }

  // Idea bulb — repurposed as the "Common Sense collected" celebratory pop,
  // and reused as part of the final celebration pose.
  const idea = new THREE.Group();
  const bulb = sphere(0.20, MATS.bulb);
  bulb.position.y = 0.22;
  idea.add(bulb);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 12), MATS.shoes);
  idea.add(stem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 24), MATS.ring);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  idea.add(ring);
  idea.position.set(0.78, 3.18, 0.15);
  idea.visible = false;
  root.add(idea);

  root.userData = { body, head, armL, armR, legL, legR, idea, eyeMeshes, torso };

  // Character footprint (for collision sizing) — approximate capsule radius
  // and total standing height, used by the movement/collision system.
  root.userData.collisionRadius = 0.42;
  root.userData.standHeight = 3.2; // approx top-of-head to feet

  return root;
}

// ---------------- Animation state machine ----------------
// States: idle, walk, run, jump, fall, land, death, celebrate, confused
export class CharacterAnimator {
  constructor(character) {
    this.character = character;
    this.state = 'idle';
    this.stateTime = 0;
    this.landTimer = 0; // brief landing squash pose
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
    this.character.userData.idea.visible = (state === 'celebrate');
  }

  triggerLandingPose() {
    this.landTimer = 0.15;
  }

  resetPose() {
    const { body, head, armL, armR, legL, legR } = this.character.userData;
    body.rotation.set(0, 0, 0);
    body.scale.set(1, 1, 1);
    head.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, 0);
    armR.rotation.set(0, 0, 0);
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
  }

  update(dt, elapsed, moveSpeed01) {
    const u = this.character.userData;
    this.stateTime += dt;
    if (this.landTimer > 0) this.landTimer -= dt;

    this.resetPose();
    const t = elapsed;

    if (this.state === 'walk' || this.state === 'run') {
      const runFactor = this.state === 'run' ? 1 : 0.7;
      const phase = t * (this.state === 'run' ? 11 : 8);
      const swing = (this.state === 'run' ? 0.9 : 0.6) * Math.max(0.3, moveSpeed01);
      u.armL.rotation.x = Math.sin(phase) * swing;
      u.armR.rotation.x = -Math.sin(phase) * swing;
      u.legL.rotation.x = -Math.sin(phase) * swing;
      u.legR.rotation.x = Math.sin(phase) * swing;
      u.body.rotation.z = Math.sin(phase * 2) * 0.035 * runFactor;
      u.head.rotation.z = Math.sin(phase * 2) * 0.04;
    } else if (this.state === 'jump') {
      u.body.rotation.z = -0.35;
      u.head.rotation.z = -0.1;
      u.armL.rotation.z = -0.6;
      u.armR.rotation.z = 0.6;
      u.armL.rotation.x = -0.3;
      u.armR.rotation.x = -0.3;
      u.legL.rotation.x = 0.4;
      u.legR.rotation.x = 0.5;
    } else if (this.state === 'fall') {
      u.body.rotation.z = -0.55;
      u.head.rotation.z = -0.15;
      u.armL.rotation.z = -0.75;
      u.armR.rotation.z = 0.85;
      u.legL.rotation.x = -0.6;
      u.legR.rotation.x = 0.5;
    } else if (this.state === 'death') {
      // A short, non-graphic "confused tumble" reaction rather than
      // anything grim — matches the game's affectionate tone.
      const spin = Math.min(1, this.stateTime * 3);
      u.body.rotation.z = 0.9 * spin;
      u.head.rotation.z = Math.sin(t * 8) * 0.3;
      u.armL.rotation.z = -1.0;
      u.armR.rotation.z = 1.0;
    } else if (this.state === 'celebrate') {
      const bounce = Math.abs(Math.sin(t * 9)) * 0.12;
      u.body.position ? null : null;
      u.armL.rotation.z = -1.4 + Math.sin(t * 9) * 0.3;
      u.armR.rotation.z = 1.4 - Math.sin(t * 9) * 0.3;
      u.head.rotation.z = Math.sin(t * 6) * 0.1;
      u.body.rotation.z = Math.sin(t * 9) * 0.08;
      this.character.position.y += bounce * dt * 0; // handled by caller via bounceOffset
      this._celebrateBounce = bounce;
    } else if (this.state === 'confused') {
      u.head.rotation.z = Math.sin(t * 3) * 0.18;
      u.armL.rotation.z = -0.8;
      u.armR.rotation.z = 0.8;
      u.armL.rotation.x = -0.2;
      u.armR.rotation.x = -0.2;
    } else {
      // idle
      u.head.rotation.z = Math.sin(t * 1.5) * 0.035;
      u.body.rotation.z = Math.sin(t * 1.5) * 0.018;
      u.armL.rotation.z = -0.05;
      u.armR.rotation.z = 0.05;
    }

    // Landing squash, layered on top of whatever pose is active.
    if (this.landTimer > 0) {
      const s = 1 - (this.landTimer / 0.15) * 0.12;
      u.body.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
    }

    // Idea bulb bob (only visible in 'celebrate' state, matching prior idea-mode motion)
    if (u.idea.visible) {
      const bob = Math.sin(t * 4) * 0.06;
      u.idea.position.y = 3.18 + bob;
      u.idea.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
    }
  }

  // Returns any extra vertical bounce this frame contributes (celebrate pose)
  get celebrateBounce() {
    return this._celebrateBounce || 0;
  }
}
