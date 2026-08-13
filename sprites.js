// sprites.js
// Draws the stylized character (matching the supplied reference: black
// bob hair, dark brown/black t-shirt, blue-grey jeans, black shoes,
// expressive sad/teary face with visible eyebrows) directly onto a
// canvas each frame using simple shape primitives. This keeps the
// character crisp at any resolution and lets us swap expressions/poses
// cheaply without needing sprite sheet assets.
//
// Coordinate convention: draw() receives the character's FEET position
// (bottom-center) and draws upward from there, matching physics.js's
// player position convention.

const PALETTE = {
  hair: '#171211',
  hairShade: '#0d0a09',
  skin: '#d9a583',
  skinShade: '#c78f6c',
  shirt: '#3a332f',
  shirtShade: '#2b2622',
  jeans: '#545f73',
  jeansShade: '#424a5c',
  shoe: '#1a1a1a',
  tear: '#bfe1ff',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the character.
 * @param ctx canvas 2d context
 * @param feetX, feetY world position of feet (bottom-center)
 * @param opts {
 *   facing: 1 | -1           (1 = facing right, -1 = facing left)
 *   pose: 'idle'|'run'|'jump'|'fall'|'land'|'dead'|'celebrate'
 *   t: number                animation time in seconds for this pose
 *   expression: 'sad'|'happy'
 *   squash: number 0..1      landing squash amount
 *   vy: number                vertical velocity (px/s, +down) -- used to
 *                              shape the jump/fall silhouette so rising
 *                              fast, hanging near the apex, and falling
 *                              fast all read as visibly different poses.
 * }
 */
export function drawCharacter(ctx, feetX, feetY, opts) {
  const { facing = 1, pose = 'idle', t = 0, expression = 'sad', squash = 0, vy = 0 } = opts;

  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.scale(facing, 1);

  // ---- pose-driven offsets ----
  let bodyBob = 0;
  let legSwing = 0;
  let armSwing = 0;
  let leanX = 0;
  let squashX = 1, squashY = 1;
  let tiltZ = 0;
  // Leg tuck: 0 = fully extended (standing), 1 = fully tucked toward
  // the body (knees-up mid-air). Distinct from legSwing (which is a
  // running/walking swing angle) -- tuck actually shortens the drawn
  // leg length, changing the silhouette height, not just the angle.
  let legTuck = 0;
  let legReach = 0; // uniform forward-angle for BOTH legs together (bracing for landing), distinct from legSwing's alternating gait
  let armsUp = 0; // 0 = arms at sides, 1 = arms raised overhead
  let stretchY = 1; // >1 stretches the whole body taller (rising), <1 compresses (falling fast, pre-landing)

  if (pose === 'idle') {
    bodyBob = Math.sin(t * 2.4) * 1.1;
    armSwing = Math.sin(t * 1.8) * 0.06;
  } else if (pose === 'run') {
    const speed = 11;
    legSwing = Math.sin(t * speed);
    armSwing = -Math.sin(t * speed);
    bodyBob = Math.abs(Math.sin(t * speed)) * 1.8;
    leanX = 1.5;
  } else if (pose === 'jump') {
    // Distinct rise-phase silhouette: knees pulled up toward the body
    // (shortens legs, clearly reads as "airborne" rather than
    // "standing"), arms thrown up overhead, torso stretched taller.
    // Blend from a launch crouch (t=0) into a full tuck quickly.
    const launchT = Math.min(1, t / 0.08); // quick snap into the tucked pose
    legTuck = 0.75 * launchT;
    armsUp = 0.9 * launchT;
    stretchY = 1 + 0.08 * launchT;
    leanX = 1.5;
  } else if (pose === 'fall') {
    // Falling silhouette changes with fall speed: near the apex (low
    // |vy|) the body hangs loosely with legs tucked; as fall speed
    // increases toward landing, legs extend clearly DOWN/forward to
    // "brace" for impact and arms drop, telegraphing an incoming
    // landing rather than looking identical to the rising pose.
    const fallSpeed01 = Math.min(1, Math.abs(vy) / 400);
    legTuck = 0.5 * (1 - fallSpeed01); // apex: tucked; fast fall: fully extended
    legReach = -0.5 * fallSpeed01; // both legs angle forward together, reaching for the ground
    armsUp = 0.45 * (1 - fallSpeed01);
    stretchY = 1 - 0.06 * fallSpeed01;
    leanX = 1;
  } else if (pose === 'land') {
    squashX = 1 + squash * 0.22;
    squashY = 1 - squash * 0.28;
    legTuck = -0.1 * squash; // legs splay slightly on impact
  } else if (pose === 'dead') {
    tiltZ = Math.min(1, t / 0.3) * 1.4;
  } else if (pose === 'celebrate') {
    const b = Math.abs(Math.sin(t * 6));
    bodyBob = -b * 6;
    armSwing = -2.2;
    legSwing = Math.sin(t * 6) * 0.3;
  }

  ctx.rotate(tiltZ);
  ctx.scale(squashX, squashY * stretchY);
  ctx.translate(leanX, 0);

  const y0 = -bodyBob; // top-of-body reference shift

  // ================= LEGS =================
  // legTuck shortens the drawn leg length and rotates the knee up/back,
  // giving jump/fall a genuinely different silhouette height instead of
  // reusing the standing leg length with just a swing angle.
  const legLenBase = 12;
  const legLen = legLenBase * (1 - legTuck * 0.55);
  const legW = 5;
  const hipY = -12 + y0;
  const tuckAngle = legTuck * 0.9;

  drawLimb(ctx, -4, hipY, legLen, legW, legSwing * 0.5 - tuckAngle + legReach, PALETTE.jeans, PALETTE.jeansShade);
  drawLimb(ctx, 4, hipY, legLen, legW, -legSwing * 0.5 - tuckAngle + legReach, PALETTE.jeans, PALETTE.jeansShade);

  // shoes (drawn at end of each leg, follow the same swing/tuck)
  drawShoe(ctx, -4, hipY, legLen, legSwing * 0.5 - tuckAngle + legReach);
  drawShoe(ctx, 4, hipY, legLen, -legSwing * 0.5 - tuckAngle + legReach);

  // ================= TORSO =================
  const torsoW = 16, torsoH = 16;
  const torsoY = hipY - torsoH;
  ctx.fillStyle = PALETTE.shirt;
  roundRect(ctx, -torsoW / 2, torsoY, torsoW, torsoH, 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.shirtShade;
  roundRect(ctx, -torsoW / 2, torsoY + torsoH * 0.55, torsoW, torsoH * 0.45, 3);
  ctx.fill();

  // ================= ARMS =================
  // armsUp raises the arm origin/angle toward overhead (reads instantly
  // as "jumping"), separate from the run-cycle armSwing.
  const armY = torsoY + 3;
  const raiseAngle = armsUp * 2.3; // radians toward overhead
  drawLimb(ctx, -9, armY, 11, 4, -armSwing * 0.6 - raiseAngle, PALETTE.shirt, PALETTE.shirtShade, true);
  drawLimb(ctx, 9, armY, 11, 4, armSwing * 0.6 + raiseAngle, PALETTE.shirt, PALETTE.shirtShade, true);

  // ================= HEAD =================
  const headR = 9.5;
  const headCY = torsoY - headR + 1;

  // back hair (behind head, extends down slightly past the head only —
  // NOT down to shoulder/arm level, so arms stay visible)
  ctx.fillStyle = PALETTE.hair;
  roundRect(ctx, -headR - 1, headCY - headR + 2, (headR + 1) * 2, headR * 1.5, 6);
  ctx.fill();

  // neck (soft rounded shape, not a hard rectangle)
  ctx.fillStyle = PALETTE.skinShade;
  roundRect(ctx, -2.2, headCY + headR - 3.5, 4.4, 5, 1.5);
  ctx.fill();

  // head base (skin circle)
  ctx.fillStyle = PALETTE.skin;
  ctx.beginPath();
  ctx.arc(0, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // hair crown cap (top ~45% of head only, doesn't cover face)
  ctx.fillStyle = PALETTE.hair;
  ctx.beginPath();
  ctx.arc(0, headCY, headR + 0.6, Math.PI * 1.08, Math.PI * 1.92);
  ctx.fill();

  // side hair panels framing the face (like the reference bob cut) --
  // kept narrow and positioned above the shoulder line so they don't
  // swallow the arms.
  ctx.fillStyle = PALETTE.hair;
  roundRect(ctx, -headR - 0.5, headCY - 1, 2.6, headR + 1.5, 1.3);
  ctx.fill();
  roundRect(ctx, headR - 2.1, headCY - 1, 2.6, headR + 1.5, 1.3);
  ctx.fill();

  // small fringe over forehead
  ctx.fillStyle = PALETTE.hair;
  roundRect(ctx, -headR + 1.5, headCY - headR - 0.5, headR * 2 - 3, 3.4, 1.5);
  ctx.fill();

  drawFace(ctx, headCY, expression, t);

  ctx.restore();
}

function drawLimb(ctx, originX, originY, length, width, swing, color, shadeColor, isArm = false) {
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(swing * (isArm ? 0.9 : 0.7));
  ctx.fillStyle = color;
  roundRect(ctx, -width / 2, 0, width, length, width / 2.2);
  ctx.fill();
  ctx.restore();
}

function drawShoe(ctx, originX, originY, legLength, swing) {
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(swing * 0.7);
  ctx.fillStyle = PALETTE.shoe;
  roundRect(ctx, -3.6, legLength - 2, 7.2, 4.5, 1.8);
  ctx.fill();
  ctx.restore();
}

function drawFace(ctx, headCY, expression, t) {
  const eyeY = headCY - 0.5;
  const eyeSpacing = 3.6;

  if (expression === 'happy') {
    // curved happy eyes (^ ^ style)
    ctx.strokeStyle = PALETTE.hairShade;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    [-eyeSpacing, eyeSpacing].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, eyeY + 1, 1.9, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
    // smile
    ctx.beginPath();
    ctx.arc(0, headCY + 4, 3.2, 0.15, Math.PI - 0.15);
    ctx.stroke();
    return;
  }

  // --- sad/worried eyebrows ---
  ctx.strokeStyle = PALETTE.hairShade;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-eyeSpacing - 1.6, eyeY - 2.4);
  ctx.lineTo(-eyeSpacing + 1.6, eyeY - 3.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(eyeSpacing + 1.6, eyeY - 2.4);
  ctx.lineTo(eyeSpacing - 1.6, eyeY - 3.4);
  ctx.stroke();

  // --- eyes (white + iris + pupil) ---
  [-eyeSpacing, eyeSpacing].forEach((ex) => {
    ctx.fillStyle = '#fbf5ee';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 1.7, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3c2a1e';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 0.4, 1.05, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c0806';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 0.4, 0.5, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(ex - 0.5, eyeY - 0.2, 0.4, 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- tears ---
  ctx.fillStyle = PALETTE.tear;
  [-eyeSpacing - 0.3, eyeSpacing + 0.3].forEach((ex) => {
    const drip = (Math.sin(t * 3 + ex) * 0.5 + 0.5) * 1.2;
    ctx.beginPath();
    ctx.moveTo(ex, eyeY + 2.2);
    ctx.quadraticCurveTo(ex - 0.5, eyeY + 4 + drip, ex, eyeY + 5.5 + drip);
    ctx.quadraticCurveTo(ex + 0.5, eyeY + 4 + drip, ex, eyeY + 2.2);
    ctx.fill();
  });

  // --- small sad frown mouth ---
  ctx.strokeStyle = '#7a4a3c';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, headCY + 6.5, 2.6, Math.PI + 0.3, Math.PI * 2 - 0.3);
  ctx.stroke();
}

/**
 * Draw a small "Common Sense" collectible icon: glowing brain-orb with
 * a rotating ring, gently bobbing. Caller supplies world position and
 * animation phase.
 */
export function drawCollectible(ctx, x, y, t, collected) {
  if (collected) return;
  const bob = Math.sin(t * 2.6) * 3;
  const cy = y + bob;
  const spin = t * 2.2;

  ctx.save();
  ctx.translate(x, cy);

  // outer glow
  const glowR = 13 + Math.sin(t * 4) * 1.5;
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, glowR);
  grad.addColorStop(0, 'rgba(255,226,122,0.55)');
  grad.addColorStop(1, 'rgba(255,226,122,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();

  // ring
  ctx.strokeStyle = '#fff4cc';
  ctx.lineWidth = 1.6;
  ctx.save();
  ctx.rotate(spin);
  ctx.scale(1, 0.42);
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // core
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-1.8, -1.8, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Small burst particle effect drawn for pickups/deaths. Caller manages
 * particle state; this just draws one particle.
 */
export function drawParticle(ctx, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
