// level-builder.js
// Builds runtime state for a level (colliders + animated entities) and
// renders the level's visuals to a 2D canvas context: sky gradient,
// parallax decorations, ground/platforms, hazards, collectibles,
// checkpoints, gate/portal.

export class BuiltLevel {
  constructor(def, palette) {
    this.def = def;
    this.palette = palette;
    this.platforms = def.platforms.map((p) => ({ ...p, baseX: p.x, baseY: p.y }));
    this.hazards = def.hazards || [];
    this.collectibles = (def.collectibles || []).map((c) => ({ ...c, collected: false }));
    this.checkpoints = (def.checkpoints || []).map((c) => ({ ...c, activated: false }));
    this.gate = def.gate ? { ...def.gate } : null;
    this.portal = def.portal ? { ...def.portal } : null;
    this.decorations = def.decorations || [];
    this.levelWidth = def.levelWidth;
    this.groundY = def.groundY;
    this.spawn = def.spawn;
  }

  updateMovingPlatforms(dt, elapsed) {
    for (const p of this.platforms) {
      if (!p.moving) continue;
      const cfg = p.moving;
      const phase = elapsed * cfg.speed + (cfg.phase || 0);
      const offset = Math.sin(phase) * cfg.range;
      p.prevX = p.x;
      p.prevY = p.y;
      if (cfg.axis === 'x') p.x = p.baseX + offset;
      else if (cfg.axis === 'y') p.y = p.baseY + offset;
      else p.x = p.baseX, p.y = p.baseY;
      if (p.prevX === undefined) { p.prevX = p.x; p.prevY = p.y; }
    }
  }
}

function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function drawBackground(ctx, w, h, palette, camX, elapsed) {
  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, palette.sky[1]);
  grad.addColorStop(1, palette.sky[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export function drawDecorations(ctx, decorations, camX, w, elapsed, palette) {
  const parallax = 0.35; // decorations scroll slower than foreground
  for (const d of decorations) {
    const sx = d.x - camX * parallax;
    if (sx < -80 || sx > w + 80) continue;
    const bob = Math.sin(elapsed * 0.8 + d.x) * 4;
    if (d.type === 'cloud') {
      drawCloud(ctx, sx, d.y + bob, d.r || 30);
    } else if (d.type === 'star') {
      drawStar(ctx, sx, d.y + bob, elapsed);
    } else if (d.type === 'crystal') {
      drawCrystal(ctx, sx, d.y + bob, palette);
    }
  }
}

function drawCloud(ctx, x, y, r) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.arc(x + r * 0.6, y + 4, r * 0.5, 0, Math.PI * 2);
  ctx.arc(x - r * 0.6, y + 6, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, x, y, elapsed) {
  const twinkle = 0.5 + Math.sin(elapsed * 2 + x) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.4 + twinkle * 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 2 + twinkle, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrystal(ctx, x, y, palette) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = palette.decoration;
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x + 12, y + 6);
  ctx.lineTo(x, y + 22);
  ctx.lineTo(x - 12, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGround(ctx, level, palette, camX, w, h) {
  // Draw the walkable ground/platform surface for a single continuous
  // "floor" (segments determined by contiguous platforms at groundY)
  // plus all elevated platforms.
  for (const p of level.platforms) {
    const sx = p.x - camX;
    if (sx + p.w < -20 || sx > w + 20) continue;
    drawPlatform(ctx, sx, p.y, p.w, p.h, palette);
  }
}

function drawPlatform(ctx, x, y, w, h, palette) {
  // body
  ctx.fillStyle = palette.ground;
  ctx.fillRect(x, y, w, h);
  // top surface highlight strip
  ctx.fillStyle = palette.groundTop;
  ctx.fillRect(x, y, w, 6);
  // glowing trim edge
  ctx.fillStyle = palette.trim;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y, w, 2);
  ctx.globalAlpha = 1;
}

export function drawHazards(ctx, hazards, palette, camX, w, elapsed) {
  for (const hz of hazards) {
    const sx = hz.x - camX;
    if (sx + hz.w < -20 || sx > w + 20) continue;
    const pulse = 0.6 + Math.sin(elapsed * 4 + hz.x * 0.05) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = palette.hazard;
    ctx.fillRect(sx, hz.y, hz.w, hz.h);
    ctx.globalAlpha = 1;
    // glow rim on top
    ctx.fillStyle = palette.hazard;
    ctx.fillRect(sx, hz.y - 2, hz.w, 3);
    // spikes for visual clarity ("danger" read)
    ctx.fillStyle = '#2a1810';
    const spikeCount = Math.max(2, Math.floor(hz.w / 14));
    const spikeW = hz.w / spikeCount;
    for (let i = 0; i < spikeCount; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * spikeW, hz.y);
      ctx.lineTo(sx + i * spikeW + spikeW / 2, hz.y - 8);
      ctx.lineTo(sx + (i + 1) * spikeW, hz.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawCheckpoints(ctx, checkpoints, palette, camX, w, elapsed) {
  for (const cp of checkpoints) {
    const sx = cp.x - camX;
    if (sx < -30 || sx > w + 30) continue;
    const color = cp.activated ? palette.checkpointOn : palette.checkpointOff;

    ctx.save();
    ctx.translate(sx, cp.y);

    // pole
    ctx.strokeStyle = '#8a8a92';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -42);
    ctx.stroke();

    // flag (small wave animation)
    const wave = Math.sin(elapsed * 4) * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(16 + wave, -37);
    ctx.lineTo(0, -30);
    ctx.closePath();
    ctx.fill();

    // glow orb at top
    ctx.globalAlpha = cp.activated ? 0.9 : 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -46, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export function drawCollectibleMarkers(ctx, collectibles, camX, w, elapsed, drawCollectibleFn) {
  for (const c of collectibles) {
    if (c.collected) continue;
    const sx = c.x - camX;
    if (sx < -30 || sx > w + 30) continue;
    drawCollectibleFn(ctx, sx, c.y, elapsed, c.collected);
  }
}

function drawGateShape(ctx, sx, y, palette, isPortal, elapsed) {
  const archH = isPortal ? 100 : 85;
  const archW = isPortal ? 70 : 58;

  ctx.save();
  ctx.translate(sx, y);

  // posts
  ctx.fillStyle = palette.gateFrame;
  ctx.fillRect(-archW / 2 - 6, -archH, 8, archH);
  ctx.fillRect(archW / 2 - 2, -archH, 8, archH);
  ctx.fillRect(-archW / 2 - 6, -archH - 8, archW + 14, 8);

  // energy field
  const pulse = 0.4 + Math.sin(elapsed * 2) * 0.15;
  ctx.globalAlpha = isPortal ? 0.55 + pulse * 0.2 : 0.4 + pulse * 0.15;
  ctx.fillStyle = palette.gate;
  ctx.fillRect(-archW / 2, -archH + 2, archW, archH - 4);
  ctx.globalAlpha = 1;

  // rotating ring accents
  ctx.strokeStyle = palette.gate;
  ctx.lineWidth = 2.2;
  ctx.save();
  ctx.translate(0, -archH / 2);
  ctx.rotate(elapsed * 0.8);
  ctx.scale(1, 0.4);
  ctx.beginPath();
  ctx.arc(0, 0, archW / 2 + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (isPortal) {
    ctx.save();
    ctx.translate(0, -archH / 2);
    ctx.rotate(-elapsed * 0.5);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, archW / 2 + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // swirling particles
    for (let i = 0; i < 8; i++) {
      const a = elapsed * 1.2 + (i / 8) * Math.PI * 2;
      const r = archW / 2 + Math.sin(elapsed * 2 + i) * 8;
      const px = Math.cos(a) * r;
      const py = -archH / 2 + Math.sin(a) * r * 0.4;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawGate(ctx, gate, palette, camX, w, elapsed) {
  if (!gate) return;
  const sx = gate.x - camX;
  if (sx < -100 || sx > w + 100) return;
  drawGateShape(ctx, sx, gate.y, palette, false, elapsed);
}

export function drawPortal(ctx, portal, palette, camX, w, elapsed) {
  if (!portal) return;
  const sx = portal.x - camX;
  if (sx < -100 || sx > w + 100) return;
  drawGateShape(ctx, sx, portal.y, palette, true, elapsed);
}
