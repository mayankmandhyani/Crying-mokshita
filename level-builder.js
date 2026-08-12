/* ==========================================================================
   LEVEL-BUILDER.JS — Converts declarative level data (levels.js) into real
   Three.js scene objects: platforms, hazards, collectibles, checkpoints,
   gates, and the final portal. Also returns the physics collider list the
   PlayerController needs, kept in sync with the visual meshes every frame
   for moving platforms.
   ========================================================================== */

import * as THREE from "three";

function makeRoundedBoxGeometry(w, h, d, radius = 0.12, segments = 3) {
  // Three's built-in BoxGeometry has sharp edges; a lightly rounded box
  // reads as much more "designed" than a raw cube, matching the brief's
  // "rounded shapes, clear silhouettes" visual target, without the cost
  // of a full bevel pipeline.
  const shape = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  const rw = w, rd = d;
  const r = Math.min(radius, rw / 2, rd / 2);
  shape.moveTo(x, y + r);
  shape.lineTo(x, y + rd - r);
  shape.quadraticCurveTo(x, y + rd, x + r, y + rd);
  shape.lineTo(x + rw - r, y + rd);
  shape.quadraticCurveTo(x + rw, y + rd, x + rw, y + rd - r);
  shape.lineTo(x + rw, y + r);
  shape.quadraticCurveTo(x + rw, y, x + rw - r, y);
  shape.lineTo(x + r, y);
  shape.quadraticCurveTo(x, y, x, y + r);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: segments });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, h, 0);
  geo.computeVertexNormals();
  return geo;
}

export class LevelBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.colliders = [];       // { box: THREE.Box3, isHazard, id, mesh?, moverIndex? }
    this.movingPlatformMeshes = []; // { mesh, def, baseX, baseY, baseZ }
    this.collectibleMeshes = []; // { mesh, def, collected }
    this.gateMesh = null;
    this.gateDef = null;
    this.portalMesh = null;
    this.portalDef = null;
    this.portalParticles = null;
  }

  dispose() {
    // Remove all children and let GC reclaim geometry/materials — fine for
    // a small game with only 3 levels, no need for aggressive pooling.
    while (this.group.children.length) {
      const child = this.group.children.pop();
      this.group.remove(child);
    }
    this.colliders = [];
    this.movingPlatformMeshes = [];
    this.collectibleMeshes = [];
    this.gateMesh = null;
    this.portalMesh = null;
    this.portalParticles = null;
  }

  build(level) {
    this.dispose();
    this._buildGround(level);
    this._buildPlatforms(level);
    this._buildMovingPlatforms(level);
    this._buildHazards(level);
    this._buildCollectibles(level);
    this._buildCheckpointMarkers(level);
    if (level.gate) this._buildGate(level);
    if (level.portal) this._buildPortal(level);
    return this.colliders;
  }

  _platformMaterial(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 0.75, metalness: 0.05,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
  }

  _buildGround(level) {
    // A large, mostly-decorative backdrop plane far below the actual
    // platforms, purely so the kill-plane fall doesn't reveal an empty
    // void immediately — reinforces "why did I die" clarity from a
    // visual-continuity angle (you can see yourself falling away from solid ground).
    const mat = this._platformMaterial(level.groundColor, { roughness: 0.95 });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat);
    backdrop.rotation.x = -Math.PI / 2;
    backdrop.position.y = -8;
    backdrop.receiveShadow = true;
    this.group.add(backdrop);
  }

  _buildPlatforms(level) {
    const mat = this._platformMaterial(level.groundColor);
    const topMat = this._platformMaterial(level.accentColor, { roughness: 0.5 });

    for (const p of level.platforms) {
      const geo = makeRoundedBoxGeometry(p.w, p.h, p.d, 0.15);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, p.y - p.h / 2, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // A thin glowing accent strip on top of every platform — makes the
      // "safe surface" silhouette read clearly against the background,
      // per the brief's "clear distinction between safe platforms and hazards".
      const stripGeo = new THREE.BoxGeometry(p.w * 0.96, 0.04, p.d * 0.96);
      const strip = new THREE.Mesh(stripGeo, topMat);
      strip.position.set(p.x, p.y + 0.02, p.z);
      this.group.add(strip);

      const box = new THREE.Box3(
        new THREE.Vector3(p.x - p.w / 2, p.y - p.h, p.z - p.d / 2),
        new THREE.Vector3(p.x + p.w / 2, p.y, p.z + p.d / 2)
      );
      this.colliders.push({ box, isHazard: false, id: 'static' });
    }
  }

  _buildMovingPlatforms(level) {
    if (!level.movingPlatforms) return;
    const mat = this._platformMaterial(level.accentColor, { roughness: 0.4, emissive: level.accentColor, emissiveIntensity: 0.15 });

    level.movingPlatforms.forEach((m, i) => {
      const geo = makeRoundedBoxGeometry(m.w, m.h, m.d, 0.12);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(m.x, m.y - m.h / 2, m.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const box = new THREE.Box3(
        new THREE.Vector3(m.x - m.w / 2, m.y - m.h, m.z - m.d / 2),
        new THREE.Vector3(m.x + m.w / 2, m.y, m.z + m.d / 2)
      );
      const colliderEntry = { box, isHazard: false, id: 'mover' + i };
      this.colliders.push(colliderEntry);

      this.movingPlatformMeshes.push({
        mesh, def: m, colliderEntry,
        baseX: m.x, baseY: m.y, baseZ: m.z,
      });
    });
  }

  _buildHazards(level) {
    if (!level.hazards) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a0f0f, roughness: 0.9, emissive: 0xff3b3b, emissiveIntensity: 0.35,
    });
    for (const h of level.hazards) {
      // Rendered as a dark, glowing-red recessed pit rather than a solid
      // block, so it visually reads as "do not stand here" at a glance.
      const geo = new THREE.BoxGeometry(h.w, h.h, h.d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(h.x, h.y, h.z);
      this.group.add(mesh);

      // A faint red glow marker above the hazard, always visible even
      // when the pit itself is below the camera's typical framing.
      const glowGeo = new THREE.PlaneGeometry(h.w * 1.1, h.d * 1.1);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(h.x, h.y + h.h / 2 + 0.02, h.z);
      this.group.add(glow);

      const box = new THREE.Box3(
        new THREE.Vector3(h.x - h.w / 2, h.y - h.h / 2, h.z - h.d / 2),
        new THREE.Vector3(h.x + h.w / 2, h.y + h.h / 2, h.z + h.d / 2)
      );
      this.colliders.push({ box, isHazard: true, id: 'hazard' });
    }
  }

  _buildCollectibles(level) {
    const geo = new THREE.IcosahedronGeometry(0.22, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: level.accentColor, emissive: level.accentColor, emissiveIntensity: 0.8, roughness: 0.3,
    });
    for (const c of level.collectibles) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.castShadow = true;
      this.group.add(mesh);

      const light = new THREE.PointLight(level.accentColor, 0.6, 2.5);
      light.position.set(0, 0, 0);
      mesh.add(light);

      this.collectibleMeshes.push({ mesh, def: c, collected: false, bobPhase: Math.random() * Math.PI * 2 });
    }
  }

  _buildCheckpointMarkers(level) {
    if (!level.checkpoints) return;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20);
    const mat = new THREE.MeshStandardMaterial({
      color: level.accentColor, emissive: level.accentColor, emissiveIntensity: 0.4, transparent: true, opacity: 0.55,
    });
    for (const cp of level.checkpoints) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cp.x, cp.y + 0.03, cp.z);
      this.group.add(mesh);
    }
  }

  _buildGate(level) {
    const g = level.gate;
    const group = new THREE.Group();
    group.position.set(g.x, g.y, g.z);
    this.group.add(group);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2044, roughness: 0.6, metalness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: level.accentColor, emissive: level.accentColor, emissiveIntensity: 1.4, roughness: 0.3,
    });

    // Two pillars + a curved-looking top (approximated with a torus half)
    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.4, 4.2, 12);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, frameMat);
      pillar.position.set(side * 2.4, 2.1, 0);
      pillar.castShadow = true;
      group.add(pillar);

      const pillarGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.0, 10), glowMat);
      pillarGlow.position.set(side * 2.4, 2.1, 0.42);
      group.add(pillarGlow);
    }

    const archGeo = new THREE.TorusGeometry(2.4, 0.35, 12, 24, Math.PI);
    const arch = new THREE.Mesh(archGeo, frameMat);
    arch.rotation.z = Math.PI;
    arch.position.set(0, 4.2, 0);
    arch.castShadow = true;
    group.add(arch);

    // Glowing plane "membrane" filling the gate — the actual visual cue
    // that this is a passage, not a decorative arch.
    const membraneGeo = new THREE.CircleGeometry(2.15, 32, 0, Math.PI);
    const membraneMat = new THREE.MeshStandardMaterial({
      color: level.accentColor, emissive: level.accentColor, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    const membrane = new THREE.Mesh(membraneGeo, membraneMat);
    membrane.position.set(0, 0.02, 0);
    membrane.rotation.x = -Math.PI / 2;
    membrane.rotation.z = Math.PI;
    group.add(membrane);

    const gateLight = new THREE.PointLight(level.accentColor, 2.0, 8);
    gateLight.position.set(0, 2.2, 0);
    group.add(gateLight);

    this.gateMesh = group;
    this.gateDef = g;

    // A generous trigger volume — entering the gate should not require
    // pixel-perfect alignment, so this box is much wider/taller than the
    // visual membrane itself.
    const triggerBox = new THREE.Box3(
      new THREE.Vector3(g.x - 2.6, g.y - 0.2, g.z - 1.2),
      new THREE.Vector3(g.x + 2.6, g.y + 4.4, g.z + 1.2)
    );
    this.gateTriggerBox = triggerBox;
  }

  _buildPortal(level) {
    const p = level.portal;
    const group = new THREE.Group();
    group.position.set(p.x, p.y, p.z);
    this.group.add(group);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 1.6, roughness: 0.25,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.3, 16, 40), ringMat);
    ring.position.y = 2.7;
    group.add(ring);

    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x6a4fc9, emissive: 0x8f6fff, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), innerMat);
    inner.position.y = 2.7;
    group.add(inner);

    const portalLight = new THREE.PointLight(0x8f6fff, 3.0, 12);
    portalLight.position.y = 2.7;
    group.add(portalLight);

    // Small floating particle motes around the portal — animated in the
    // main update loop via portalParticles.
    const particleCount = 40;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.0 + Math.random() * 1.8;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 1.0 + Math.random() * 3.2;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0xc9b6ff, size: 0.12, transparent: true, opacity: 0.85 });
    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    this.portalMesh = group;
    this.portalRing = ring;
    this.portalInner = inner;
    this.portalDef = p;
    this.portalParticles = { points: particles, seeds, baseY: 2.7 };

    const triggerBox = new THREE.Box3(
      new THREE.Vector3(p.x - 2.8, p.y - 0.2, p.z - 1.4),
      new THREE.Vector3(p.x + 2.8, p.y + 5.2, p.z + 1.4)
    );
    this.portalTriggerBox = triggerBox;
  }

  // ---------------- Per-frame updates ----------------

  updateMovingPlatforms(dt, elapsed) {
    for (const mp of this.movingPlatformMeshes) {
      const m = mp.def;
      const phase = elapsed * m.speed + (m.phase || 0);
      let x = mp.baseX, y = mp.baseY, z = mp.baseZ;
      if (m.axis === 'x') x += Math.sin(phase) * m.range;
      else if (m.axis === 'y') y += Math.sin(phase) * m.range;
      else if (m.axis === 'z') z += Math.sin(phase) * m.range;

      mp.mesh.position.set(x, y - m.h / 2, z);
      mp.colliderEntry.box.min.set(x - m.w / 2, y - m.h, z - m.d / 2);
      mp.colliderEntry.box.max.set(x + m.w / 2, y, z + m.d / 2);
    }
  }

  updateCollectibles(dt, elapsed) {
    for (const c of this.collectibleMeshes) {
      if (c.collected) continue;
      c.mesh.position.y = c.def.y + Math.sin(elapsed * 2 + c.bobPhase) * 0.12;
      c.mesh.rotation.y += dt * 1.4;
    }
  }

  // Returns the collectible entry the player is currently touching, or null.
  checkCollectibleHit(playerPos, radius = 0.7) {
    for (const c of this.collectibleMeshes) {
      if (c.collected) continue;
      const dx = playerPos.x - c.mesh.position.x;
      const dy = (playerPos.y + 1.0) - c.mesh.position.y;
      const dz = playerPos.z - c.mesh.position.z;
      if (dx * dx + dy * dy + dz * dz < radius * radius) return c;
    }
    return null;
  }

  collectItem(c) {
    c.collected = true;
    c.mesh.visible = false;
  }

  updateGate(dt, elapsed) {
    if (!this.gateMesh) return;
    this.gateMesh.rotation.y = 0; // static orientation, but pulse the glow
    const pulse = 0.9 + Math.sin(elapsed * 2.2) * 0.15;
    this.gateMesh.children.forEach((child) => {
      if (child.material && child.material.emissiveIntensity !== undefined && child !== this.gateMesh.children[0]) {
        // pulse only the glow-ish children lightly; skip base frame pillars
      }
    });
  }

  updatePortal(dt, elapsed, intensityMultiplier = 1) {
    if (!this.portalMesh) return;
    this.portalRing.rotation.z = elapsed * 0.6;
    this.portalInner.material.opacity = (0.4 + Math.sin(elapsed * 3) * 0.15) * intensityMultiplier;
    this.portalRing.scale.setScalar(intensityMultiplier);
    this.portalInner.scale.setScalar(intensityMultiplier);

    const posAttr = this.portalParticles.points.geometry.attributes.position;
    const seeds = this.portalParticles.seeds;
    for (let i = 0; i < seeds.length; i++) {
      const idx = i * 3;
      posAttr.array[idx + 1] = this.portalParticles.baseY + Math.sin(elapsed * 1.5 + seeds[i]) * 0.6 - 1.0 + Math.sin(elapsed * 0.4 + seeds[i]) * 0.3;
    }
    posAttr.needsUpdate = true;
  }

  isPlayerAtGate(playerBox) {
    return this.gateTriggerBox && playerBox.intersectsBox(this.gateTriggerBox);
  }

  isPlayerAtPortal(playerBox) {
    return this.portalTriggerBox && playerBox.intersectsBox(this.portalTriggerBox);
  }
}
