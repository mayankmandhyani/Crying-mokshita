// level-builder.js
// Takes a declarative level definition (plain data: platform boxes,
// hazards, collectibles, checkpoints, gate/portal) and builds both:
//   1) the visual Three.js scene objects
//   2) the physics collider list used by physics.js
//
// This keeps level DATA (levels.js) separate from level CONSTRUCTION
// (this file), so levels.js can be validated with plain math before
// any rendering happens.

import * as THREE from 'three';

function platformMaterial(colorTop, colorSide) {
  return {
    top: new THREE.MeshStandardMaterial({ color: colorTop, roughness: 0.75, metalness: 0.02 }),
    side: new THREE.MeshStandardMaterial({ color: colorSide, roughness: 0.9, metalness: 0.0 }),
  };
}

function buildPlatformMesh(plat, palette) {
  const geo = new THREE.BoxGeometry(plat.w, plat.h, plat.d);
  const mats = platformMaterial(plat.color || palette.platformTop, plat.colorSide || palette.platformSide);
  // 6 faces: +x -x +y -y +z -z. Use top material on +y/-y, side elsewhere.
  const materials = [mats.side, mats.side, mats.top, mats.side, mats.side, mats.side];
  const mesh = new THREE.Mesh(geo, materials);
  mesh.position.set(plat.x, plat.y, plat.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // thin emissive edge trim on top for a "designed" look
  if (plat.trim !== false) {
    const trimGeo = new THREE.BoxGeometry(plat.w + 0.02, 0.06, plat.d + 0.02);
    const trimMat = new THREE.MeshStandardMaterial({
      color: palette.trim,
      emissive: palette.trim,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, plat.h / 2 - 0.02, 0);
    mesh.add(trim);
  }

  return mesh;
}

function buildHazardMesh(hz, palette) {
  const group = new THREE.Group();
  // Hazard reads as glowing lava/void in a gap: a flat glowing plane
  // sitting low, with small emissive "danger" particles above it, and
  // NEVER coincides with walkable platform height.
  const w = hz.w, d = hz.d;
  const surfaceGeo = new THREE.PlaneGeometry(w, d, 6, 6);
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: palette.hazard,
    emissive: palette.hazard,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(hz.x, hz.y, hz.z);
  group.add(surface);

  // glowing rim so it reads clearly against the gap walls
  const rimGeo = new THREE.BoxGeometry(w + 0.1, 0.08, d + 0.1);
  const rimMat = new THREE.MeshStandardMaterial({
    color: palette.hazard,
    emissive: palette.hazard,
    emissiveIntensity: 0.9,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.set(hz.x, hz.y + 0.02, hz.z);
  group.add(rim);

  group.userData.animatePulse = { mesh: surfaceMat, base: 0.55 };
  return group;
}

function buildCollectibleMesh(col, palette) {
  const group = new THREE.Group();

  // Stylized brain/orb collectible: glowing icosahedron core + ring
  const coreGeo = new THREE.IcosahedronGeometry(0.22, 1);
  const coreMat = new THREE.MeshStandardMaterial({
    color: palette.collectible,
    emissive: palette.collectible,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = false;
  group.add(core);

  const ringGeo = new THREE.TorusGeometry(0.34, 0.03, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: palette.collectibleRing,
    emissive: palette.collectibleRing,
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  const light = new THREE.PointLight(palette.collectible, 0.6, 3);
  group.add(light);

  group.position.set(col.x, col.y, col.z);
  group.userData.baseY = col.y;
  group.userData.spinSpeed = 1.4 + Math.random() * 0.4;
  group.userData.bobPhase = Math.random() * Math.PI * 2;
  group.userData.collected = false;
  group.userData.id = col.id;
  return group;
}

function buildCheckpointMesh(cp, palette) {
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.6, metalness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 0.8;
  pole.castShadow = true;
  group.add(pole);

  const flagGeo = new THREE.PlaneGeometry(0.5, 0.34);
  const flagMat = new THREE.MeshStandardMaterial({
    color: palette.checkpointOff,
    emissive: palette.checkpointOff,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
    roughness: 0.6,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.26, 1.35, 0);
  group.add(flag);

  const glowGeo = new THREE.SphereGeometry(0.14, 12, 12);
  const glowMat = new THREE.MeshStandardMaterial({
    color: palette.checkpointOff,
    emissive: palette.checkpointOff,
    emissiveIntensity: 0.4,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = 1.65;
  group.add(glow);

  group.position.set(cp.x, cp.y, cp.z);
  group.userData.flag = flag;
  group.userData.glow = glow;
  group.userData.activated = false;
  group.userData.id = cp.id;
  return group;
}

function buildGateMesh(gate, palette, style = 'gate') {
  const group = new THREE.Group();
  const isPortal = style === 'portal';

  const archColor = isPortal ? palette.portalArch : palette.gateArch;
  const ringColor = isPortal ? palette.portalRing : palette.gateRing;

  const archMat = new THREE.MeshStandardMaterial({ color: archColor, roughness: 0.55, metalness: 0.35 });
  const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 10), archMat);
  leftPost.position.set(-1.35, 1.7, 0);
  leftPost.castShadow = true;
  const rightPost = leftPost.clone();
  rightPost.position.x = 1.35;
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.32, 0.32), archMat);
  topBeam.position.set(0, 3.35, 0);
  topBeam.castShadow = true;
  group.add(leftPost, rightPost, topBeam);

  // glowing energy plane inside the arch
  const fieldGeo = new THREE.PlaneGeometry(2.5, 3.0);
  const fieldMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: isPortal ? 1.1 : 0.75,
    transparent: true,
    opacity: isPortal ? 0.55 : 0.4,
    side: THREE.DoubleSide,
  });
  const field = new THREE.Mesh(fieldGeo, fieldMat);
  field.position.set(0, 1.75, 0);
  group.add(field);
  group.userData.field = field;

  // ring accents
  const ringGeo = new THREE.TorusGeometry(isPortal ? 1.5 : 1.25, 0.06, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: 1.0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 1.75, isPortal ? 0.05 : 0);
  group.add(ring);
  group.userData.ring = ring;

  if (isPortal) {
    // extra outer ring + point lights for the "this is the finale" feel
    const ring2 = ring.clone();
    ring2.scale.set(1.25, 1.25, 1.25);
    ring2.rotation.z = Math.PI / 5;
    group.add(ring2);
    group.userData.ring2 = ring2;

    const pLight = new THREE.PointLight(ringColor, 1.4, 8);
    pLight.position.set(0, 1.9, 1);
    group.add(pLight);
    group.userData.light = pLight;
  } else {
    const pLight = new THREE.PointLight(ringColor, 0.8, 5);
    pLight.position.set(0, 1.9, 0.8);
    group.add(pLight);
    group.userData.light = pLight;
  }

  group.position.set(gate.x, gate.y, gate.z);
  group.rotation.y = gate.rotY || 0;
  group.userData.triggerRadius = isPortal ? 1.6 : 1.4;
  group.userData.worldPos = new THREE.Vector3(gate.x, gate.y + 1.2, gate.z);
  return group;
}

export class BuiltLevel {
  constructor() {
    this.scene = new THREE.Group();
    this.platforms = []; // physics colliders {x,y,z,w,h,d}
    this.hazardMeshes = [];
    this.collectibleMeshes = [];
    this.checkpointMeshes = [];
    this.checkpointData = []; // {id,x,y,z}
    this.gateMesh = null;
    this.portalMesh = null;
    this.movingPlatforms = []; // {mesh, collider, config, t}
    this.decorations = [];
    this.spawn = { x: 0, y: 0, z: 0 };
  }
}

export function buildLevel(def, palette) {
  const built = new BuiltLevel();
  built.spawn = def.spawn;

  for (const plat of def.platforms) {
    const mesh = buildPlatformMesh(plat, palette);
    built.scene.add(mesh);
    const collider = { x: plat.x, y: plat.y, z: plat.z, w: plat.w, h: plat.h, d: plat.d };
    built.platforms.push(collider);

    if (plat.moving) {
      built.movingPlatforms.push({
        mesh,
        collider,
        config: plat.moving,
        t: plat.moving.phase || 0,
        origin: { x: plat.x, y: plat.y, z: plat.z },
      });
    }
  }

  for (const hz of def.hazards || []) {
    const mesh = buildHazardMesh(hz, palette);
    built.scene.add(mesh);
    built.hazardMeshes.push({ mesh, data: hz });
  }

  for (const col of def.collectibles || []) {
    const mesh = buildCollectibleMesh(col, palette);
    built.scene.add(mesh);
    built.collectibleMeshes.push(mesh);
  }

  for (const cp of def.checkpoints || []) {
    const mesh = buildCheckpointMesh(cp, palette);
    built.scene.add(mesh);
    built.checkpointMeshes.push(mesh);
    built.checkpointData.push(cp);
  }

  if (def.gate) {
    built.gateMesh = buildGateMesh(def.gate, palette, 'gate');
    built.scene.add(built.gateMesh);
  }

  if (def.portal) {
    built.portalMesh = buildGateMesh(def.portal, palette, 'portal');
    built.scene.add(built.portalMesh);
  }

  // simple ambient decoration: floating background shapes for atmosphere
  if (def.decorations) {
    for (const d of def.decorations) {
      let geo;
      if (d.type === 'cloud') geo = new THREE.SphereGeometry(d.r || 0.8, 8, 8);
      else if (d.type === 'crystal') geo = new THREE.ConeGeometry(d.r || 0.4, (d.r || 0.4) * 2.2, 5);
      else geo = new THREE.SphereGeometry(d.r || 0.5, 6, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: d.color || palette.decoration,
        emissive: d.emissive ? (d.color || palette.decoration) : 0x000000,
        emissiveIntensity: d.emissive ? 0.4 : 0,
        transparent: d.type === 'cloud',
        opacity: d.type === 'cloud' ? 0.85 : 1,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(d.x, d.y, d.z);
      built.scene.add(mesh);
      built.decorations.push({ mesh, data: d });
    }
  }

  return built;
}

// Update moving platforms; returns nothing but mutates mesh + collider positions.
export function updateMovingPlatforms(built, dt, elapsed) {
  for (const mp of built.movingPlatforms) {
    const { config, origin, mesh, collider } = mp;
    mp.t += dt;
    let dx = 0, dy = 0, dz = 0;
    const speed = config.speed || 1;
    const range = config.range || 3;
    const phase = mp.t * speed + (config.phase || 0);

    if (config.axis === 'x') dx = Math.sin(phase) * range;
    else if (config.axis === 'y') dy = Math.sin(phase) * range;
    else if (config.axis === 'z') dz = Math.sin(phase) * range;

    const newX = origin.x + dx;
    const newY = origin.y + dy;
    const newZ = origin.z + dz;

    collider.prevX = collider.x;
    collider.prevY = collider.y;
    collider.prevZ = collider.z;
    collider.x = newX;
    collider.y = newY;
    collider.z = newZ;
    mesh.position.set(newX, newY, newZ);
  }
}

export function updateCollectibles(built, dt, elapsed) {
  for (const mesh of built.collectibleMeshes) {
    if (mesh.userData.collected) continue;
    const ud = mesh.userData;
    mesh.rotation.y += dt * ud.spinSpeed;
    mesh.position.y = ud.baseY + Math.sin(elapsed * 1.8 + ud.bobPhase) * 0.14;
  }
}

export function updateHazards(built, dt, elapsed) {
  for (const hz of built.hazardMeshes) {
    const pulse = 0.5 + Math.sin(elapsed * 3 + (hz.data.x || 0)) * 0.18;
    hz.mesh.children.forEach((child) => {
      if (child.material && child.material.emissiveIntensity !== undefined) {
        // vary top surface vs rim slightly differently by checking geometry type
      }
    });
    const surface = hz.mesh.children[0];
    if (surface && surface.material) surface.material.emissiveIntensity = 0.4 + pulse * 0.3;
  }
}

export function updateGateAnim(mesh, dt, elapsed) {
  if (!mesh) return;
  if (mesh.userData.ring) mesh.userData.ring.rotation.z += dt * 0.6;
  if (mesh.userData.ring2) mesh.userData.ring2.rotation.z -= dt * 0.4;
  if (mesh.userData.field) {
    mesh.userData.field.material.opacity = 0.35 + Math.sin(elapsed * 2) * 0.12;
  }
}
