// player.js
// Builds the stylized cartoon character (based on the supplied reference:
// black bob hair, dark brown/black t-shirt, blue-grey jeans, black shoes,
// expressive sad/comical face with visible tears) out of procedural
// Three.js geometry, and drives simple procedural animation
// (idle bob, run cycle, jump pose, land squash, death flop).

import * as THREE from 'three';

const SKIN = 0xd9a583;
const SKIN_SHADOW = 0xc78f6c;
const HAIR = 0x15100f;
const HAIR_HILIGHT = 0x241d1c;
const SHIRT = 0x3a332f;
const SHIRT_SHADOW = 0x2b2622;
const JEANS = 0x545f73;
const JEANS_SHADOW = 0x424a5c;
const SHOE = 0x1a1a1a;

function roundBoxGeometry(w, h, d, radius = 0.08, segments = 3) {
  // Cheap "rounded box" via a normal BoxGeometry + bevel-ish smoothing
  // using a small radius is not natively supported without extra deps,
  // so we approximate softness with a slightly smoothed-shaded box.
  const geo = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
  return geo;
}

function makeFaceTexture() {
  // Draw the expressive face (big eyes, eyebrows, tear streaks, small
  // frown mouth) onto a canvas and use it as a texture on the front
  // of the head geometry. This is what keeps the face readable &
  // recognizable instead of a blank primitive.
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // base skin fill (so texture edges blend with head material)
  ctx.fillStyle = '#d9a583';
  ctx.fillRect(0, 0, size, size);

  // --- Eyebrows (angled, worried) ---
  ctx.strokeStyle = '#1c1512';
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(size * 0.28, size * 0.40);
  ctx.lineTo(size * 0.44, size * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.72, size * 0.40);
  ctx.lineTo(size * 0.56, size * 0.35);
  ctx.stroke();

  // --- Eyes (large, glossy, cartoon) ---
  function eye(cx, cy) {
    const rw = size * 0.10;
    const rh = size * 0.115;
    // white
    ctx.fillStyle = '#fbf5ee';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    // iris
    ctx.fillStyle = '#3c2a1e';
    ctx.beginPath();
    ctx.ellipse(cx, cy + rh * 0.12, rw * 0.62, rh * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    // pupil
    ctx.fillStyle = '#0c0806';
    ctx.beginPath();
    ctx.ellipse(cx, cy + rh * 0.12, rw * 0.30, rh * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx - rw * 0.28, cy - rh * 0.15, rw * 0.18, rh * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // lower lid crease (tired/sad look)
    ctx.strokeStyle = 'rgba(60,40,30,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + rh * 0.55, rw * 0.9, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  eye(size * 0.36, size * 0.50);
  eye(size * 0.64, size * 0.50);

  // --- Tears ---
  function tear(cx, cy) {
    ctx.fillStyle = 'rgba(190,225,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx - size * 0.02, cy + size * 0.09, cx, cy + size * 0.15);
    ctx.quadraticCurveTo(cx + size * 0.02, cy + size * 0.09, cx, cy);
    ctx.fill();
  }
  tear(size * 0.32, size * 0.60);
  tear(size * 0.685, size * 0.605);

  // --- Nose (small) ---
  ctx.strokeStyle = 'rgba(150,100,75,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.56);
  ctx.quadraticCurveTo(size * 0.53, size * 0.63, size * 0.5, size * 0.655);
  ctx.stroke();

  // --- Mouth (small sad frown) ---
  ctx.strokeStyle = '#7a4a3c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(size * 0.40, size * 0.755);
  ctx.quadraticCurveTo(size * 0.5, size * 0.72, size * 0.60, size * 0.755);
  ctx.stroke();
  ctx.fillStyle = '#9c5d4a';
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.745, size * 0.045, size * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHappyFaceTexture() {
  // Used briefly for the ending celebration (still same character,
  // just a joyful expression) so the payoff moment reads correctly.
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9a583';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#1c1512';
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(size * 0.27, size * 0.37);
  ctx.quadraticCurveTo(size * 0.36, size * 0.32, size * 0.45, size * 0.37);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.73, size * 0.37);
  ctx.quadraticCurveTo(size * 0.64, size * 0.32, size * 0.55, size * 0.37);
  ctx.stroke();

  function happyEye(cx, cy) {
    ctx.strokeStyle = '#1c1512';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.02, size * 0.075, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  happyEye(size * 0.36, size * 0.50);
  happyEye(size * 0.64, size * 0.50);

  ctx.strokeStyle = 'rgba(150,100,75,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.56);
  ctx.quadraticCurveTo(size * 0.53, size * 0.63, size * 0.5, size * 0.655);
  ctx.stroke();

  ctx.strokeStyle = '#7a4a3c';
  ctx.lineWidth = 7;
  ctx.fillStyle = '#7a4a3c';
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.70, size * 0.13, 0.15, Math.PI - 0.15);
  ctx.fill();
  ctx.fillStyle = '#fbf5ee';
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.71, size * 0.10, size * 0.045, 0, 0, Math.PI);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Player';

    this.faceTexture = makeFaceTexture();
    this.happyFaceTexture = makeHappyFaceTexture();

    this._buildBody();

    // animation state
    this.animState = 'idle'; // idle | run | jump | fall | land | dead | celebrate
    this.animTime = 0;
    this.landTimer = 0;
    this.facingAngle = 0; // radians, smoothed
  }

  _buildBody() {
    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.75, metalness: 0.0 });
    const skinShadowMat = new THREE.MeshStandardMaterial({ color: SKIN_SHADOW, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.85 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: JEANS, roughness: 0.8 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.45, metalness: 0.08 });

    this.faceMat = new THREE.MeshStandardMaterial({ map: this.faceTexture, roughness: 0.7 });

    // ---- Root rig ----
    const root = new THREE.Group();
    root.position.y = 0;
    this.rig = root;
    this.group.add(root);

    // Hips pivot (everything hangs off this so we can bob it)
    const hips = new THREE.Group();
    hips.position.y = 0.92;
    root.add(hips);
    this.hips = hips;

    // ---- Legs ----
    const legGeo = new THREE.CapsuleGeometry(0.135, 0.5, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, jeansMat);
    leftLeg.position.set(-0.16, -0.42, 0);
    leftLeg.castShadow = true;
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.16;
    hips.add(leftLeg, rightLeg);
    this.leftLeg = leftLeg;
    this.rightLeg = rightLeg;

    // pivot groups for leg swing (so rotation happens at hip, not leg center)
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.16, -0.17, 0);
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.16, -0.17, 0);
    hips.remove(leftLeg, rightLeg);
    hips.add(leftLegPivot, rightLegPivot);
    leftLeg.position.set(0, -0.25, 0);
    rightLeg.position.set(0, -0.25, 0);
    leftLegPivot.add(leftLeg);
    rightLegPivot.add(rightLeg);
    this.leftLegPivot = leftLegPivot;
    this.rightLegPivot = rightLegPivot;

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.19, 0.14, 0.32);
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(0, -0.52, 0.06);
    leftShoe.castShadow = true;
    const rightShoe = leftShoe.clone();
    leftLegPivot.add(leftShoe);
    rightLegPivot.add(rightShoe);

    // ---- Torso ----
    const torsoGeo = new THREE.CapsuleGeometry(0.30, 0.42, 4, 10);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.set(0, 0.36, 0);
    torso.scale.set(1.05, 1, 0.85);
    torso.castShadow = true;
    hips.add(torso);
    this.torso = torso;

    // small shirt shading strip (adds a bit of form definition cheaply)
    const shirtShadow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.305, 0.28, 0.15, 10, 1, true, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: SHIRT_SHADOW, roughness: 0.9, side: THREE.DoubleSide })
    );
    shirtShadow.position.set(0, 0.12, 0);
    shirtShadow.rotation.y = Math.PI * 0.5;
    torso.add(shirtShadow);

    // ---- Shoulders / arms (pivots for swing) ----
    const armGeo = new THREE.CapsuleGeometry(0.095, 0.38, 4, 8);
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.34, 0.62, 0);
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.34, 0.62, 0);
    hips.add(leftArmPivot, rightArmPivot);

    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(0, -0.19, 0);
    leftArm.castShadow = true;
    const rightArm = leftArm.clone();
    leftArmPivot.add(leftArm);
    rightArmPivot.add(rightArm);
    this.leftArmPivot = leftArmPivot;
    this.rightArmPivot = rightArmPivot;

    // forearm/hand (skin) at end of sleeve
    const handGeo = new THREE.SphereGeometry(0.095, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(0, -0.42, 0);
    leftArmPivot.add(leftHand);
    const rightHand = leftHand.clone();
    rightArmPivot.add(rightHand);

    // ---- Neck + Head ----
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 8), skinShadowMat);
    neck.position.set(0, 0.60, 0);
    hips.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.80, 0);
    hips.add(headGroup);
    this.headGroup = headGroup;

    const headGeo = new THREE.SphereGeometry(0.30, 16, 14);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.scale.set(0.95, 1.05, 0.92);
    head.castShadow = true;
    headGroup.add(head);
    this.head = head;

    // Face plane (front of head) — carries the expressive texture.
    // Head sphere radius is 0.30 (scaled 0.92 on z), so the front-most
    // point of the head is ~0.276 in z; place the face plane just
    // outside that so it never z-fights with or hides behind the head.
    const faceGeo = new THREE.PlaneGeometry(0.40, 0.40);
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.position.set(0, 0.01, 0.285);
    headGroup.add(face);
    this.faceMesh = face;

    // ears (subtle, so head doesn't read as a bald sphere from the side)
    const earGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.285, -0.02, 0.02);
    leftEar.scale.set(0.6, 1, 1);
    const rightEar = leftEar.clone();
    rightEar.position.x = 0.285;
    headGroup.add(leftEar, rightEar);

    // ---- Hair (frames face, doesn't cover it) ----
    // Crown cap: only the TOP of the head, phiStart=0 (north pole) so it
    // does not wrap down toward the front where the face plane lives.
    // thetaLength (last arg) of ~0.42*PI keeps it a skullcap, not a helmet.
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.318, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      hairMat
    );
    hairCap.position.set(0, 0.09, 0);
    hairCap.castShadow = true;
    headGroup.add(hairCap);

    // Side panels (bob-style, framing cheeks like reference image).
    // Pulled further back (negative z) and narrower so they hug the
    // sides of the head rather than wrapping over the cheeks/face.
    const sidePanelGeo = new THREE.BoxGeometry(0.085, 0.44, 0.20);
    const leftPanel = new THREE.Mesh(sidePanelGeo, hairMat);
    leftPanel.position.set(-0.285, -0.08, -0.05);
    leftPanel.rotation.z = 0.08;
    leftPanel.castShadow = true;
    const rightPanel = leftPanel.clone();
    rightPanel.position.x = 0.285;
    rightPanel.rotation.z = -0.08;
    headGroup.add(leftPanel, rightPanel);

    // Back hair length (falls past shoulders) — sits behind the head only.
    const backHairGeo = new THREE.BoxGeometry(0.42, 0.52, 0.14);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, -0.17, -0.18);
    backHair.castShadow = true;
    headGroup.add(backHair);

    // Small fringe strands at the very top edge of the forehead only
    // (a thin sliver, well above the eyebrows so eyes stay fully clear).
    const fringeGeo = new THREE.BoxGeometry(0.34, 0.06, 0.05);
    const fringe = new THREE.Mesh(fringeGeo, hairMat);
    fringe.position.set(0, 0.245, 0.235);
    fringe.rotation.x = -0.1;
    headGroup.add(fringe);

    // hair highlight sheen on the crown only (cheap secondary tone for depth)
    const sheen = new THREE.Mesh(
      new THREE.SphereGeometry(0.321, 12, 8, Math.PI * 0.2, Math.PI * 0.6, 0, Math.PI * 0.22),
      new THREE.MeshStandardMaterial({ color: HAIR_HILIGHT, roughness: 0.3, metalness: 0.15 })
    );
    sheen.position.set(0, 0.09, 0);
    headGroup.add(sheen);

    // shadow contact blob under feet (cheap fake AO, helps grounding read)
    const shadowGeo = new THREE.CircleGeometry(0.42, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.02;
    contactShadow.renderOrder = 1;
    root.add(contactShadow);
    this.contactShadow = contactShadow;
  }

  setFacing(angleRad) {
    // smooth turning toward movement direction
    let diff = angleRad - this.facingAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facingAngle += diff * Math.min(1, 14 * (1 / 60));
    this.rig.rotation.y = this.facingAngle;
  }

  // Instantly snap facing with no smoothing. Used on spawn/respawn so
  // the character never gets stuck mid-turn (which would leave the
  // face plane visible from the wrong side, or the body facing an
  // arbitrary intermediate angle).
  snapFacing(angleRad) {
    this.facingAngle = angleRad;
    this.rig.rotation.y = angleRad;
  }

  setState(state) {
    if (this.animState === state) return;
    this.animState = state;
    this.animTime = 0;
    if (state === 'land') this.landTimer = 0.18;
  }

  setFace(happy) {
    this.faceMesh.material = happy ? new THREE.MeshStandardMaterial({ map: this.happyFaceTexture, roughness: 0.7 }) : this.faceMat;
  }

  update(dt, moveSpeed01, grounded) {
    this.animTime += dt;
    const t = this.animTime;

    // shadow fades with height off ground handled externally (main.js sets opacity)

    switch (this.animState) {
      case 'idle': {
        const bob = Math.sin(t * 2.2) * 0.02;
        this.hips.position.y = 0.92 + bob;
        this.leftArmPivot.rotation.x = Math.sin(t * 1.6) * 0.05;
        this.rightArmPivot.rotation.x = -Math.sin(t * 1.6) * 0.05;
        this.leftLegPivot.rotation.x = 0;
        this.rightLegPivot.rotation.x = 0;
        this.headGroup.rotation.x = Math.sin(t * 1.1) * 0.02;
        break;
      }
      case 'run': {
        const speed = 9 + moveSpeed01 * 4;
        const swing = Math.sin(t * speed);
        this.leftLegPivot.rotation.x = swing * 0.85;
        this.rightLegPivot.rotation.x = -swing * 0.85;
        this.leftArmPivot.rotation.x = -swing * 0.7;
        this.rightArmPivot.rotation.x = swing * 0.7;
        this.hips.position.y = 0.92 + Math.abs(Math.sin(t * speed)) * 0.05;
        this.headGroup.rotation.x = 0.05;
        break;
      }
      case 'jump': {
        this.leftLegPivot.rotation.x = -0.35;
        this.rightLegPivot.rotation.x = 0.55;
        this.leftArmPivot.rotation.x = -0.9;
        this.rightArmPivot.rotation.x = -1.1;
        this.hips.position.y = 0.92 + Math.min(t * 2, 1) * 0.06;
        this.headGroup.rotation.x = -0.08;
        break;
      }
      case 'fall': {
        this.leftLegPivot.rotation.x = 0.15;
        this.rightLegPivot.rotation.x = 0.15;
        this.leftArmPivot.rotation.x = -0.5;
        this.rightArmPivot.rotation.x = -0.5;
        this.headGroup.rotation.x = 0.12;
        break;
      }
      case 'land': {
        this.landTimer -= dt;
        const squash = Math.max(0, this.landTimer / 0.18);
        this.rig.scale.set(1 + squash * 0.12, 1 - squash * 0.18, 1 + squash * 0.12);
        this.leftLegPivot.rotation.x = 0.1;
        this.rightLegPivot.rotation.x = 0.1;
        if (this.landTimer <= 0) {
          this.rig.scale.set(1, 1, 1);
          this.setState(grounded ? 'idle' : 'fall');
        }
        break;
      }
      case 'dead': {
        // flop rotation handled externally via rig rotation.z tween in main.js death sequence
        break;
      }
      case 'celebrate': {
        const jump = Math.abs(Math.sin(t * 6)) * 0.18;
        this.hips.position.y = 0.92 + jump;
        this.leftArmPivot.rotation.x = -2.6 + Math.sin(t * 6) * 0.3;
        this.rightArmPivot.rotation.x = -2.6 - Math.sin(t * 6) * 0.3;
        this.leftLegPivot.rotation.x = Math.sin(t * 6) * 0.2;
        this.rightLegPivot.rotation.x = -Math.sin(t * 6) * 0.2;
        this.rig.rotation.y = this.facingAngle + Math.sin(t * 1.5) * 0.15;
        break;
      }
    }

    if (this.animState !== 'land') {
      this.rig.scale.set(1, 1, 1);
    }
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }
}
