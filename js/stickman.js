/*
 * Stickman — a procedurally animated stick figure.
 *
 * The figure is defined by joint angles rather than sprites, so poses
 * (falling, landing, idle, running) blend smoothly and stay crisp at
 * any resolution.
 *
 * Angle convention: limb angles are measured from "straight down",
 * positive angles swing toward +x (screen right). The torso angle is
 * measured from "straight up".
 */
window.MH = window.MH || {};

MH.Stickman = (function () {
  const H = 64; // base height in px, scaled per instance

  // Proportions relative to H
  const TORSO = 0.34, ARM = 0.17, LEG = 0.24, HEAD_R = 0.115;

  function seg(from, angle, len) {
    return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
  }

  /*
   * pose = {
   *   x, y        : hip position
   *   scale       : size multiplier
   *   torso       : lean angle from vertical
   *   armL, armR  : [shoulderAngle, elbowAngle]  (absolute, from straight-down)
   *   legL, legR  : [hipAngle, kneeAngle]        (absolute, from straight-down)
   * }
   */
  function draw(ctx, pose, color, lineWidth) {
    const s = (pose.scale || 1) * H;
    const hip = { x: pose.x, y: pose.y };
    const t = pose.torso || 0;

    const neck = { x: hip.x + Math.sin(t) * TORSO * s, y: hip.y - Math.cos(t) * TORSO * s };
    const headC = { x: neck.x + Math.sin(t) * HEAD_R * 1.3 * s, y: neck.y - Math.cos(t) * HEAD_R * 1.3 * s };
    const shoulder = { x: hip.x + (neck.x - hip.x) * 0.92, y: hip.y + (neck.y - hip.y) * 0.92 };

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    // torso
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(neck.x, neck.y);
    // arms
    for (const arm of [pose.armL, pose.armR]) {
      const elbow = seg(shoulder, arm[0], ARM * s);
      const hand = seg(elbow, arm[1], ARM * s);
      ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(hand.x, hand.y);
    }
    // legs
    for (const leg of [pose.legL, pose.legR]) {
      const knee = seg(hip, leg[0], LEG * s);
      const foot = seg(knee, leg[1], LEG * s);
      ctx.moveTo(hip.x, hip.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(foot.x, foot.y);
    }
    ctx.stroke();

    // head
    ctx.beginPath();
    ctx.arc(headC.x, headC.y, HEAD_R * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- Pose generators ------------------------------------------------

  // Flailing freefall. t is elapsed time in seconds.
  function poseFall(t) {
    const w = t * 9;
    return {
      torso: Math.sin(t * 3.1) * 0.14,
      armL: [-2.1 + Math.sin(w) * 0.35, -2.7 + Math.cos(w * 0.8) * 0.4],
      armR: [ 2.1 + Math.cos(w * 1.1) * 0.35, 2.7 + Math.sin(w * 0.9) * 0.4],
      legL: [-0.6 + Math.sin(w * 0.7) * 0.25, -0.25 + Math.sin(w * 0.7) * 0.3],
      legR: [ 0.6 + Math.cos(w * 0.8) * 0.25,  0.25 + Math.cos(w * 0.8) * 0.3],
    };
  }

  // Impact crouch. k in [0,1] is how deep the crouch is.
  function poseCrouch(k) {
    const a = 0.15 + 0.85 * k;
    return {
      torso: 0.35 * k,
      armL: [-0.9 * k - 0.15, -1.6 * k - 0.2],
      armR: [ 0.9 * k + 0.15,  1.6 * k + 0.2],
      legL: [ a, -a],
      legR: [-a,  a],
    };
  }

  // Quiet standing, with a slow breath.
  function poseIdle(t) {
    const b = Math.sin(t * 1.6) * 0.04;
    return {
      torso: b * 0.5,
      armL: [-0.35 + b, -0.45 + b],
      armR: [ 0.35 - b,  0.45 - b],
      legL: [ 0.2,  0.2],
      legR: [-0.2, -0.2],
    };
  }

  // Running. t drives the stride, dir is -1 (left) or 1 (right).
  function poseRun(t, dir) {
    const p = t * 11;
    const s1 = Math.sin(p), s2 = Math.sin(p + Math.PI);
    return {
      torso: 0.22 * dir,
      armL: [dir * (0.6 * s2), dir * (0.6 * s2 - 0.5)],
      armR: [dir * (0.6 * s1), dir * (0.6 * s1 - 0.5)],
      legL: [dir * (0.65 * s1), dir * (0.65 * s1 - 0.45)],
      legR: [dir * (0.65 * s2), dir * (0.65 * s2 - 0.45)],
    };
  }

  // Hip height above the feet for a symmetric stance/crouch,
  // so the figure can be planted exactly on the floor.
  function hipHeight(k, scale) {
    const a = 0.15 + 0.85 * (k || 0);
    return 2 * LEG * H * (scale || 1) * Math.cos(a);
  }

  return { draw, poseFall, poseCrouch, poseIdle, poseRun, hipHeight, H };
})();
