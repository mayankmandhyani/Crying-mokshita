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
  } else if (pose === 'cryfit') {
    // Exaggerated cartoonish crying fit: stomping feet, shaking fists,
    // fast bobbing -- distinct from the quiet default sad idle, used
    // for the intro cutscene's "increasingly annoyed -> comedic
    // meltdown" beat.
    const stomp = Math.abs(Math.sin(t * 9));
    bodyBob = stomp * 3;
    legSwing = Math.sin(t * 9) * 0.7;
    armsUp = 0.6;
    armSwing = Math.sin(t * 11) * 0.5;
    leanX = Math.sin(t * 5) * 1.2;
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

  const isAngryCry = expression === 'angry-cry';

  // --- eyebrows: angled steeper/furrowed for the angry-cry variant ---
  ctx.strokeStyle = PALETTE.hairShade;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  const browDrop = isAngryCry ? 1.2 : 0;
  ctx.beginPath();
  ctx.moveTo(-eyeSpacing - 1.6, eyeY - 2.4 + browDrop);
  ctx.lineTo(-eyeSpacing + 1.6, eyeY - 3.4 + browDrop * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(eyeSpacing + 1.6, eyeY - 2.4 + browDrop);
  ctx.lineTo(eyeSpacing - 1.6, eyeY - 3.4 + browDrop * 0.3);
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

  // --- tears: much bigger, faster, and doubled-up for angry-cry ---
  ctx.fillStyle = PALETTE.tear;
  const tearScale = isAngryCry ? 2.0 : 1.0;
  const tearSpeed = isAngryCry ? 8 : 3;
  [-eyeSpacing - 0.3, eyeSpacing + 0.3].forEach((ex) => {
    const drip = (Math.sin(t * tearSpeed + ex) * 0.5 + 0.5) * 1.2 * tearScale;
    ctx.beginPath();
    ctx.moveTo(ex, eyeY + 2.2);
    ctx.quadraticCurveTo(ex - 0.5 * tearScale, eyeY + (4 + drip) * tearScale * 0.6 + 2, ex, eyeY + (5.5 + drip) * tearScale * 0.6 + 2);
    ctx.quadraticCurveTo(ex + 0.5 * tearScale, eyeY + (4 + drip) * tearScale * 0.6 + 2, ex, eyeY + 2.2);
    ctx.fill();
  });
  if (isAngryCry) {
    // extra streaming tear arcs flung outward (comedic "waterworks" burst)
    ctx.strokeStyle = PALETTE.tear;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.7;
    [-1, 1].forEach((side) => {
      const flingT = (Math.sin(t * 10 + side) * 0.5 + 0.5);
      ctx.beginPath();
      ctx.moveTo(side * (eyeSpacing + 1), eyeY + 1);
      ctx.quadraticCurveTo(side * (eyeSpacing + 5 + flingT * 3), eyeY - 1, side * (eyeSpacing + 8 + flingT * 4), eyeY - 3 - flingT * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // --- mouth: small sad frown normally, wide wobbly wail for angry-cry ---
  ctx.strokeStyle = '#7a4a3c';
  ctx.lineWidth = 1.1;
  if (isAngryCry) {
    ctx.fillStyle = '#5c2e22';
    ctx.beginPath();
    const wobble = Math.sin(t * 12) * 0.4;
    ctx.ellipse(0, headCY + 7 + wobble, 2.8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, headCY + 6.5, 2.6, Math.PI + 0.3, Math.PI * 2 - 0.3);
    ctx.stroke();
  }
}

// ============================================================
// BROTHER (intro-cutscene-only character)
// Matches the supplied reference sheet: black messy-swoop hair,
// heavier/rounder build, light-blue "BEAR" sweatshirt, gold chain,
// dark pants, gray sneakers, small earring, smug/confident
// expressions. Drawn procedurally in the same style as the main
// character so it fits visually without needing image assets.
// ============================================================

const BRO_PALETTE = {
  hair: '#1c1613',
  hairShade: '#110d0b',
  skin: '#e0a877',
  skinShade: '#cd9265',
  shirt: '#a9d3e8',
  shirtShade: '#8ec0da',
  shirtText: '#eef8fc',
  pants: '#232733',
  pantsShade: '#1a1d26',
  shoe: '#8a8f98',
  shoeSole: '#e8e8ec',
  chain: '#e8c25a',
};

/**
 * Draw the brother character (intro cutscene only).
 * @param opts { facing, pose: 'smug'|'point'|'laugh'|'shrug'|'wave', t, leanX }
 */
export function drawBrother(ctx, feetX, feetY, opts) {
  const { facing = 1, pose = 'smug', t = 0 } = opts;

  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.scale(facing, 1);

  let bodyBob = Math.sin(t * 2.0) * 1.0;
  let armSwingL = 0, armSwingR = 0;
  let pointArm = 0; // 0..1, right arm extends forward/up to point
  let legStance = 6; // half-distance between feet, wide confident stance
  let headTilt = 0;
  let laughShake = 0;

  if (pose === 'smug') {
    // arms crossed -- drawn as a static shape below, limbs still swing subtly
    armSwingL = Math.sin(t * 1.4) * 0.04;
    armSwingR = -Math.sin(t * 1.4) * 0.04;
  } else if (pose === 'point') {
    pointArm = Math.min(1, t / 0.25);
    armSwingL = -0.15;
    headTilt = 0.06;
  } else if (pose === 'laugh') {
    laughShake = Math.sin(t * 14) * 0.05;
    bodyBob = Math.abs(Math.sin(t * 7)) * 1.6;
    armSwingL = Math.sin(t * 7) * 0.2 - 0.3;
    armSwingR = -Math.sin(t * 7) * 0.2 - 0.3;
    headTilt = laughShake;
  } else if (pose === 'shrug') {
    const s = Math.min(1, t / 0.3);
    armSwingL = -0.9 * s;
    armSwingR = 0.9 * s;
    headTilt = -0.05 * s;
  } else if (pose === 'wave') {
    armSwingR = -1.6 + Math.sin(t * 8) * 0.3;
    armSwingL = 0.05;
    legStance = 5;
  }

  const y0 = -bodyBob;
  ctx.rotate(headTilt);

  // ================= LEGS (wide, confident stance) =================
  const legLen = 13;
  const legW = 6.5;
  const hipY = -13 + y0;
  drawLimb(ctx, -legStance, hipY, legLen, legW, 0, BRO_PALETTE.pants, BRO_PALETTE.pantsShade);
  drawLimb(ctx, legStance, hipY, legLen, legW, 0, BRO_PALETTE.pants, BRO_PALETTE.pantsShade);
  broShoe(ctx, -legStance, hipY, legLen);
  broShoe(ctx, legStance, hipY, legLen);

  // ================= TORSO (broader/rounder than main character) =================
  const torsoW = 20, torsoH = 17;
  const torsoY = hipY - torsoH;
  ctx.fillStyle = BRO_PALETTE.shirt;
  roundRect(ctx, -torsoW / 2, torsoY, torsoW, torsoH, 6);
  ctx.fill();
  ctx.fillStyle = BRO_PALETTE.shirtShade;
  roundRect(ctx, -torsoW / 2, torsoY + torsoH * 0.6, torsoW, torsoH * 0.4, 4);
  ctx.fill();
  // "BEAR" text hint -- drawn with a local counter-flip so it never
  // mirrors backward when the character faces left (facing=-1); text
  // must always read correctly regardless of character orientation.
  ctx.save();
  ctx.scale(facing, 1);
  ctx.fillStyle = BRO_PALETTE.shirtText;
  ctx.globalAlpha = 0.85;
  ctx.font = 'bold 4px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BEAR', 0, torsoY + torsoH * 0.42);
  ctx.globalAlpha = 1;
  ctx.restore();

  // gold chain
  ctx.strokeStyle = BRO_PALETTE.chain;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, torsoY + 2.5, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // ================= ARMS =================
  const armY = torsoY + 3;
  if (pose === 'smug') {
    // crossed-arms shape (matches reference top-left pose) instead of two swinging limbs
    ctx.fillStyle = BRO_PALETTE.shirt;
    roundRect(ctx, -11, armY + 2, 22, 6.5, 3.2);
    ctx.fill();
    ctx.fillStyle = BRO_PALETTE.shirtShade;
    roundRect(ctx, -11, armY + 6, 22, 3, 2);
    ctx.fill();
  } else {
    drawLimb(ctx, -10, armY, 12, 5, -armSwingL * 0.6, BRO_PALETTE.shirt, BRO_PALETTE.shirtShade, true);
    if (pose === 'point') {
      // extended pointing arm: rotates from down-at-side up to a forward point
      const angle = -0.2 - pointArm * 1.5;
      ctx.save();
      ctx.translate(10, armY);
      ctx.rotate(angle);
      ctx.fillStyle = BRO_PALETTE.shirt;
      roundRect(ctx, -2.5, 0, 5, 13, 2.4);
      ctx.fill();
      // pointing hand/finger accent
      ctx.fillStyle = BRO_PALETTE.skin;
      ctx.beginPath();
      ctx.ellipse(0, 14, 2.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      drawLimb(ctx, 10, armY, 12, 5, armSwingR * 0.6, BRO_PALETTE.shirt, BRO_PALETTE.shirtShade, true);
    }
  }

  // ================= HEAD (rounder, bigger than main character) =================
  const headR = 11;
  const headCY = torsoY - headR + 1.5;

  // back hair
  ctx.fillStyle = BRO_PALETTE.hair;
  roundRect(ctx, -headR - 1, headCY - headR + 2, (headR + 1) * 2, headR * 1.5, 6);
  ctx.fill();

  // neck
  ctx.fillStyle = BRO_PALETTE.skinShade;
  roundRect(ctx, -3, headCY + headR - 4, 6, 6, 2);
  ctx.fill();

  // head base
  ctx.fillStyle = BRO_PALETTE.skin;
  ctx.beginPath();
  ctx.arc(0, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // messy swoop hair (bigger volume than main character's bob)
  ctx.fillStyle = BRO_PALETTE.hair;
  ctx.beginPath();
  ctx.arc(0, headCY, headR + 1.2, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  // a couple of spiky tufts for the "swoop" look
  ctx.beginPath();
  ctx.moveTo(-headR + 1, headCY - headR + 1);
  ctx.lineTo(-headR - 2, headCY - headR - 4);
  ctx.lineTo(-headR + 4, headCY - headR + 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headR - 3, headCY - headR + 0.5);
  ctx.lineTo(headR + 3, headCY - headR - 3.5);
  ctx.lineTo(headR - 1, headCY - headR + 3);
  ctx.closePath();
  ctx.fill();

  // small earring (matches reference)
  ctx.fillStyle = '#dcdcdc';
  ctx.beginPath();
  ctx.arc(-headR + 1, headCY + 3, 0.9, 0, Math.PI * 2);
  ctx.fill();

  drawBroFace(ctx, headCY, pose, t);

  ctx.restore();
}

function broShoe(ctx, originX, originY, legLength) {
  ctx.save();
  ctx.translate(originX, originY);
  ctx.fillStyle = BRO_PALETTE.shoe;
  roundRect(ctx, -4.2, legLength - 2.2, 8.4, 5, 2);
  ctx.fill();
  ctx.fillStyle = BRO_PALETTE.shoeSole;
  roundRect(ctx, -4.2, legLength + 1.4, 8.4, 1.6, 1);
  ctx.fill();
  ctx.restore();
}

function drawBroFace(ctx, headCY, pose, t) {
  const eyeY = headCY - 0.5;
  const eyeSpacing = 4.0;

  if (pose === 'laugh') {
    // eyes squeezed shut, open-mouth laugh
    ctx.strokeStyle = BRO_PALETTE.hairShade;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    [-eyeSpacing, eyeSpacing].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.5, 2.0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
    ctx.fillStyle = '#3a1c14';
    ctx.beginPath();
    ctx.ellipse(0, headCY + 5, 3.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    roundRect(ctx, -2.6, headCY + 3.2, 5.2, 1.6, 0.6);
    ctx.fill();
    return;
  }

  // smug eyebrows (angled up-and-out, one slightly raised for a smirk feel)
  ctx.strokeStyle = BRO_PALETTE.hairShade;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-eyeSpacing - 2, eyeY - 3.6);
  ctx.lineTo(-eyeSpacing + 1.6, eyeY - 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(eyeSpacing + 2, eyeY - 4.2);
  ctx.lineTo(eyeSpacing - 1.6, eyeY - 2.6);
  ctx.stroke();

  // eyes -- slightly narrowed/confident
  [-eyeSpacing, eyeSpacing].forEach((ex) => {
    ctx.fillStyle = '#fbf5ee';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 1.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241812';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 0.2, 1.0, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(ex - 0.4, eyeY - 0.2, 0.35, 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // smug lopsided grin
  ctx.strokeStyle = '#7a3f2c';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.4, headCY + 5.6);
  ctx.quadraticCurveTo(0.5, headCY + 8.2, 4.6, headCY + 5.0);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-2.6, headCY + 6.0);
  ctx.quadraticCurveTo(0.5, headCY + 7.8, 3.8, headCY + 5.4);
  ctx.quadraticCurveTo(0.5, headCY + 6.6, -2.6, headCY + 6.0);
  ctx.closePath();
  ctx.fill();
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
