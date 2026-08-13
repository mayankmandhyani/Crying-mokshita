// effects.js
// Lightweight particle-style effects using instanced/simple meshes
// rather than heavy GPU particle systems, to keep mobile performance
// reasonable per spec section 20/17.

import * as THREE from 'three';

const CONFETTI_COLORS = [0xff6a3d, 0xffd97a, 0x8ce6ff, 0x7be08a, 0xff2d7a, 0xffffff];

export class PickupBurst {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  spawn(position, color) {
    const group = new THREE.Group();
    const count = 8;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.055, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const p = new THREE.Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2;
      p.userData.vel = new THREE.Vector3(Math.cos(angle) * 1.8, 2.6 + Math.random() * 1.2, Math.sin(angle) * 1.8);
      p.position.copy(position);
      group.add(p);
    }
    group.userData.life = 0;
    this.scene.add(group);
    this.active.push(group);
  }

  update(dt) {
    for (let gi = this.active.length - 1; gi >= 0; gi--) {
      const g = this.active[gi];
      g.userData.life += dt;
      for (const p of g.children) {
        p.userData.vel.y -= 9 * dt;
        p.position.addScaledVector(p.userData.vel, dt);
        p.material.opacity = Math.max(0, 1 - g.userData.life / 0.7);
        p.scale.setScalar(Math.max(0.001, 1 - g.userData.life / 0.7));
      }
      if (g.userData.life > 0.7) {
        this.scene.remove(g);
        g.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); });
        this.active.splice(gi, 1);
      }
    }
  }
}

export class DeathEffect {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  spawn(position) {
    const group = new THREE.Group();
    const count = 14;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff5a3d, transparent: true, opacity: 1 });
      const p = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 2.5;
      p.userData.vel = new THREE.Vector3(Math.cos(angle) * speed, 3 + Math.random() * 2, Math.sin(angle) * speed);
      p.userData.rotVel = (Math.random() - 0.5) * 10;
      p.position.copy(position);
      group.add(p);
    }
    group.userData.life = 0;
    this.scene.add(group);
    this.active.push(group);
  }

  update(dt) {
    for (let gi = this.active.length - 1; gi >= 0; gi--) {
      const g = this.active[gi];
      g.userData.life += dt;
      for (const p of g.children) {
        p.userData.vel.y -= 12 * dt;
        p.position.addScaledVector(p.userData.vel, dt);
        p.rotation.x += p.userData.rotVel * dt;
        p.rotation.y += p.userData.rotVel * dt * 0.7;
        p.material.opacity = Math.max(0, 1 - g.userData.life / 0.9);
      }
      if (g.userData.life > 0.9) {
        this.scene.remove(g);
        g.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); });
        this.active.splice(gi, 1);
      }
    }
  }
}

export class Confetti {
  constructor(scene) {
    this.scene = scene;
    this.pieces = [];
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  burst(origin, count = 140) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.14, 0.2);
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const piece = new THREE.Mesh(geo, mat);
      const spread = 3.5;
      piece.position.set(
        origin.x + (Math.random() - 0.5) * spread,
        origin.y + Math.random() * 1.5,
        origin.z + (Math.random() - 0.5) * spread
      );
      piece.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        6 + Math.random() * 4,
        (Math.random() - 0.5) * 3
      );
      piece.userData.rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8
      );
      piece.userData.life = 0;
      piece.userData.maxLife = 3.5 + Math.random() * 2;
      this.group.add(piece);
      this.pieces.push(piece);
    }
  }

  update(dt) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.userData.life += dt;
      p.userData.vel.y -= 5.5 * dt;
      // gentle air drag / flutter
      p.userData.vel.x += Math.sin(p.userData.life * 3 + i) * 0.4 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      p.rotation.x += p.userData.rotVel.x * dt;
      p.rotation.y += p.userData.rotVel.y * dt;
      p.rotation.z += p.userData.rotVel.z * dt;

      const lifeRatio = p.userData.life / p.userData.maxLife;
      if (lifeRatio > 0.75) {
        p.material.opacity = Math.max(0, 1 - (lifeRatio - 0.75) / 0.25);
      }

      if (p.userData.life > p.userData.maxLife || p.position.y < -6) {
        this.group.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.pieces.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.pieces) {
      this.group.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    }
    this.pieces = [];
  }
}

export class PortalParticles {
  constructor(scene, position, color = 0xffe6ff) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    scene.add(this.group);
    this.color = color;
    this.particles = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.035 + Math.random() * 0.03, 5, 5);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
      const p = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 0.8;
      p.userData.angle = angle;
      p.userData.radius = radius;
      p.userData.speed = 0.6 + Math.random() * 0.8;
      p.userData.heightOffset = (Math.random() - 0.5) * 2.4;
      p.userData.bobPhase = Math.random() * Math.PI * 2;
      this.group.add(p);
      this.particles.push(p);
    }
  }

  update(dt, elapsed) {
    for (const p of this.particles) {
      p.userData.angle += p.userData.speed * dt;
      const x = Math.cos(p.userData.angle) * p.userData.radius;
      const z = Math.sin(p.userData.angle) * p.userData.radius;
      const y = p.userData.heightOffset + Math.sin(elapsed * 1.5 + p.userData.bobPhase) * 0.2;
      p.position.set(x, y, z);
    }
  }
}
