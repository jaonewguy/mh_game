/*
 * Stickman — a procedurally animated stick figure living in 3D.
 *
 * The skeleton is defined by joint angles inside a vertical plane that
 * faces the figure's yaw (movement direction); joints are computed as
 * 3D points and projected through the isometric camera.
 *
 * Angle convention: limb angles are measured from "straight down",
 * positive angles swing toward the facing direction. The torso angle
 * is measured from "straight up". World y points down.
 *
 * Every stroke is drawn twice — a thick black halo, then the line
 * color — so the figure stays readable when it overlaps the solid
 * white floor.
 */
export const H = 64; // base height in px, scaled per instance

// Proportions relative to H
const TORSO = 0.34, ARM = 0.17, LEG = 0.24, HEAD_R = 0.115;

/*
 * pose = {
 *   x, y, z     : hip position (world, y down)
 *   yaw         : facing direction on the ground plane
 *   scale       : size multiplier
 *   torso       : lean angle from vertical
 *   armL, armR  : [shoulderAngle, elbowAngle]  (absolute, from straight-down)
 *   legL, legR  : [hipAngle, kneeAngle]        (absolute, from straight-down)
 *   breathe     : optional 0..1 chest swell (calm mechanic)
 * }
 */
export function draw(ctx, project, pose, color, lineWidth) {
  const s = (pose.scale || 1) * H * (1 + (pose.breathe || 0) * 0.04);
  const yaw = pose.yaw || 0;
  const f = { x: Math.cos(yaw), z: Math.sin(yaw) }; // facing on ground plane

  const seg = (from, angle, len) => ({
    x: from.x + f.x * Math.sin(angle) * len,
    y: from.y + Math.cos(angle) * len,
    z: from.z + f.z * Math.sin(angle) * len,
  });

  const hip = { x: pose.x, y: pose.y, z: pose.z };
  const t = pose.torso || 0;
  const neck = {
    x: hip.x + f.x * Math.sin(t) * TORSO * s,
    y: hip.y - Math.cos(t) * TORSO * s,
    z: hip.z + f.z * Math.sin(t) * TORSO * s,
  };
  const headC = {
    x: neck.x + f.x * Math.sin(t) * HEAD_R * 1.3 * s,
    y: neck.y - Math.cos(t) * HEAD_R * 1.3 * s,
    z: neck.z + f.z * Math.sin(t) * HEAD_R * 1.3 * s,
  };
  const shoulder = {
    x: hip.x + (neck.x - hip.x) * 0.92,
    y: hip.y + (neck.y - hip.y) * 0.92,
    z: hip.z + (neck.z - hip.z) * 0.92,
  };

  // Collect polylines in 3D, project once, stroke twice (halo + line).
  const lines = [[hip, neck]];
  for (const arm of [pose.armL, pose.armR]) {
    const elbow = seg(shoulder, arm[0], ARM * s);
    lines.push([shoulder, elbow, seg(elbow, arm[1], ARM * s)]);
  }
  for (const leg of [pose.legL, pose.legR]) {
    const knee = seg(hip, leg[0], LEG * s);
    lines.push([hip, knee, seg(knee, leg[1], LEG * s)]);
  }
  const projected = lines.map(line => line.map(project));
  const head = project(headC);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [strokeColor, lw] of [['#000', lineWidth * 2.4], [color, lineWidth]]) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const line of projected) {
      ctx.moveTo(line[0].x, line[0].y);
      for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, HEAD_R * s, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---- Pose generators ---------------------------------------------------

// Flailing freefall. t is elapsed time in seconds.
export function poseFall(t) {
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
export function poseCrouch(k) {
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
export function poseIdle(t) {
  const b = Math.sin(t * 1.6) * 0.04;
  return {
    torso: b * 0.5,
    armL: [-0.35 + b, -0.45 + b],
    armR: [ 0.35 - b,  0.45 - b],
    legL: [ 0.2,  0.2],
    legR: [-0.2, -0.2],
  };
}

// Deliberate breathing: k in [-1,1], inhale positive. Arms rise with
// the breath, torso straightens — used by the calm mechanic.
export function poseBreathe(k) {
  const lift = 0.35 + Math.max(0, k) * 0.9; // arms float up on the inhale
  return {
    torso: -0.04 * k,
    breathe: Math.max(0, k),
    armL: [-lift, -lift - 0.25],
    armR: [ lift,  lift + 0.25],
    legL: [ 0.18,  0.18],
    legR: [-0.18, -0.18],
  };
}

// Bracing against the walls: crouched, arms straight out.
export function poseBrace(k = 0.3) {
  const p = poseCrouch(k);
  p.armL = [-1.5, -1.55];
  p.armR = [1.5, 1.55];
  return p;
}

// Running. t drives the stride; direction comes from the pose yaw.
export function poseRun(t) {
  const p = t * 11;
  const s1 = Math.sin(p), s2 = Math.sin(p + Math.PI);
  return {
    torso: 0.22,
    armL: [0.6 * s2, 0.6 * s2 - 0.5],
    armR: [0.6 * s1, 0.6 * s1 - 0.5],
    legL: [0.65 * s1, 0.65 * s1 - 0.45],
    legR: [0.65 * s2, 0.65 * s2 - 0.45],
  };
}

// Hip height above the feet for a symmetric stance/crouch,
// so the figure can be planted exactly on the floor.
export function hipHeight(k, scale) {
  const a = 0.15 + 0.85 * (k || 0);
  return 2 * LEG * H * (scale || 1) * Math.cos(a);
}
