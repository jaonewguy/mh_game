/*
 * Scene I — "The Fall" (isometric)
 *
 * A stickman falls through black nothing, lands on the solid white
 * floor of a cube with transparent walls, and then — every second —
 * the four walls slam inward until there is nowhere left to stand.
 * Fade to black. End of scene.
 *
 * The world is genuinely 3D (x/z ground plane, y down) rendered
 * through the 2:1 isometric projection in iso.js with painter's
 * ordering: floor, shadow, far walls, figure, dust, near walls.
 *
 * Phases: falling -> landing -> settle -> walls -> end
 */
window.MH = window.MH || {};

MH.Scene1 = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }

  reset() {
    const h = this.canvas.height;

    this.phase = 'falling';
    this.t = 0;          // time in current phase
    this.elapsed = 0;    // time since scene start

    // The stickman starts at y=0 above the cube's center and falls
    // fallDist down to the floor plane.
    this.fallDist = Math.max(h * 2.2, 1200);

    this.stick = {
      x: 0, z: 0,        // ground-plane position (cube center = origin)
      y: 0,              // hip height, world coords (y down)
      vy: 0,
      yaw: -Math.PI / 2, // facing the camera-ish
      moving: false,
      scale: 1.15,
    };

    this.cam = -h * 0.42;
    this.shake = 0;

    // Wall collapse state — the square footprint shrinks on all sides.
    this.slams = 0;
    this.totalSlams = 8;
    this.endHalfGap = 30;
    this.slamTimer = 0;
    this.halfGapDisplay = null; // animated, initialized on first frame

    this.crouchK = 0;
    this.endFade = 0;
    this.dust = [];
    this.specks = [];
    this.speckAlpha = 1;
    this.spawnSpecks();
  }

  // ---- geometry (derived from live canvas size so resize is safe) ----

  // Half-extent of the cube footprint. Screen width of the floor
  // diamond is 4x this value.
  cubeHalf() { return Math.min(this.canvas.width * 0.16, 155); }
  wallH()    { return Math.min(this.canvas.height * 0.34, 260); }
  floorY()   { return this.fallDist; }

  camMax()   { return this.fallDist - this.canvas.height * 0.62; }

  // Target half-width of the shrinking footprint after `slams` slams.
  halfGapTarget() {
    const k = this.slams / this.totalSlams;
    return this.cubeHalf() * (1 - k) + this.endHalfGap * k;
  }

  proj() {
    const cam = { ox: this.canvas.width / 2, oy: 0, y: this.cam };
    return (p) => MH.Iso.project(p, cam);
  }

  spawnSpecks() {
    // Ambient motes in the fall column; drawn with motion blur so the
    // descent reads as speed even against a featureless background.
    this.specks = [];
    for (let i = 0; i < 48; i++) {
      this.specks.push({
        x: (Math.random() - 0.5) * 700,
        z: (Math.random() - 0.5) * 700,
        y: Math.random() * this.fallDist * 1.1,
      });
    }
  }

  // ---- update ---------------------------------------------------------

  update(dt, keys) {
    this.t += dt;
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 30);

    const s = this.stick;

    // Screen-relative input mapped onto the isometric ground plane:
    // right on screen is world (1,-1)/sqrt2, up on screen is (-1,-1)/sqrt2.
    const R = (keys['ArrowRight'] || keys['d'] ? 1 : 0) - (keys['ArrowLeft'] || keys['a'] ? 1 : 0);
    const U = (keys['ArrowUp'] || keys['w'] ? 1 : 0) - (keys['ArrowDown'] || keys['s'] ? 1 : 0);
    const k = 1 / Math.SQRT2;
    let mx = (R - U) * k, mz = (-R - U) * k;
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1) { mx /= mLen; mz /= mLen; }

    switch (this.phase) {
      case 'falling': {
        s.vy = Math.min(s.vy + 1500 * dt, 950);
        s.y += s.vy * dt;
        s.x += mx * 120 * dt; // slight air control
        s.z += mz * 120 * dt;
        s.yaw = -Math.PI / 2 + Math.sin(this.elapsed * 0.9) * 0.6; // slow tumble-turn
        const standH = MH.Stickman.hipHeight(0.1, s.scale);
        if (s.y >= this.floorY() - standH) {
          s.y = this.floorY() - standH;
          s.vy = 0;
          s.yaw = -Math.PI / 2;
          this.phase = 'landing';
          this.t = 0;
          this.shake = 1;
          MH.Audio.land();
          this.burstDust(s.x, this.floorY(), s.z, 22, 170);
        }
        break;
      }

      case 'landing': {
        // Quick drop into the crouch, slower rise out of it.
        this.crouchK = this.t < 0.12
          ? this.t / 0.12
          : Math.max(0, 1 - (this.t - 0.12) / 0.5);
        s.y = this.floorY() - MH.Stickman.hipHeight(this.crouchK, s.scale);
        if (this.t > 0.62) { this.phase = 'settle'; this.t = 0; }
        break;
      }

      case 'settle': {
        this.walk(dt, mx, mz);
        if (this.t > 1.1) { this.phase = 'walls'; this.t = 0; this.slamTimer = 0; }
        break;
      }

      case 'walls': {
        this.walk(dt, mx, mz);
        this.slamTimer += dt;
        if (this.slamTimer >= 1.0) {
          this.slamTimer -= 1.0;
          this.slams++;
          this.shake = 0.6;
          MH.Audio.slam();
          const hg = this.halfGapTarget();
          const fy = this.floorY();
          this.burstDust( hg, fy, 0, 4, 60);
          this.burstDust(-hg, fy, 0, 4, 60);
          this.burstDust(0, fy,  hg, 4, 60);
          this.burstDust(0, fy, -hg, 4, 60);
          if (this.slams >= this.totalSlams) {
            this.phase = 'end';
            this.t = 0;
          }
        }
        break;
      }

      case 'end': {
        // A last beat with the walls at the figure's shoulders,
        // then the scene fades out.
        this.endFade = Math.min(1, Math.max(0, (this.t - 0.9) / 1.6));
        break;
      }
    }

    // Camera: follow the fall, stop just above the cube so the figure
    // drops the last stretch into frame.
    this.cam = Math.min(s.y - this.canvas.height * 0.42, this.camMax());

    // Animate walls toward their post-slam position (fast ease = slam feel).
    const target = this.halfGapTarget();
    if (this.halfGapDisplay === null) this.halfGapDisplay = target;
    this.halfGapDisplay += (target - this.halfGapDisplay) * Math.min(1, dt * 16);

    // Keep the figure inside the walls (the walls also shove them).
    if (this.phase !== 'falling') {
      const limit = Math.max(0, this.halfGapDisplay - 14);
      s.x = Math.max(-limit, Math.min(limit, s.x));
      s.z = Math.max(-limit, Math.min(limit, s.z));
    }

    // The ambient motes belong to the fall; once grounded they dissolve.
    if (this.phase !== 'falling') {
      this.speckAlpha = Math.max(0, this.speckAlpha - dt * 1.2);
    }

    // dust particles
    for (const p of this.dust) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy += 60 * dt; // settle back toward the floor (y is down)
      p.life -= dt;
    }
    this.dust = this.dust.filter(p => p.life > 0);
  }

  walk(dt, mx, mz) {
    const s = this.stick;
    s.moving = mx !== 0 || mz !== 0;
    if (s.moving) {
      s.yaw = Math.atan2(mz, mx);
      s.x += mx * 240 * dt;
      s.z += mz * 240 * dt;
    }
    s.y = this.floorY() - MH.Stickman.hipHeight(s.moving ? 0.12 : 0.06, s.scale);
  }

  burstDust(x, y, z, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.dust.push({
        x, y, z,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: -speed * (0.2 + Math.random() * 0.4),
        life: 0.4 + Math.random() * 0.4,
      });
    }
  }

  // ---- draw -----------------------------------------------------------

  draw(ctx) {
    const w = this.canvas.width, h = this.canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const shakeX = (Math.random() - 0.5) * 14 * this.shake;
    const shakeY = (Math.random() - 0.5) * 10 * this.shake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    const pr = this.proj();

    this.drawSpecks(ctx, pr);
    this.drawFloor(ctx, pr);
    this.drawShadow(ctx, pr);
    this.drawWalls(ctx, pr, 'far');
    this.drawStick(ctx, pr);
    this.drawDust(ctx, pr);
    this.drawWalls(ctx, pr, 'near');

    ctx.restore();

    this.drawTitle(ctx, w, h);
    this.drawEnd(ctx, w, h);
  }

  drawSpecks(ctx, pr) {
    if (this.speckAlpha <= 0.01) return;
    const vy = this.stick.vy;
    ctx.globalAlpha = this.speckAlpha;
    ctx.strokeStyle = MH.Palette.get('wind');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const sp of this.specks) {
      const blur = Math.max(2, vy * 0.035);
      const a = pr(sp);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, a.y - blur);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  quad(ctx, pr, corners) {
    const pts = corners.map(pr);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  drawFloor(ctx, pr) {
    // Solid white floor — the one dependable thing in the scene.
    // It keeps its full size; only the walls creep inward across it.
    const C = this.cubeHalf(), fy = this.floorY();
    this.quad(ctx, pr, [
      { x: -C, y: fy, z: -C }, { x: C, y: fy, z: -C },
      { x:  C, y: fy, z:  C }, { x: -C, y: fy, z: C },
    ]);
    ctx.fillStyle = MH.Palette.get('floor');
    ctx.fill();
    // A thin face on the two visible sides gives the slab thickness.
    this.quad(ctx, pr, [
      { x: -C, y: fy, z: C }, { x: C, y: fy, z: C },
      { x:  C, y: fy + 10, z: C }, { x: -C, y: fy + 10, z: C },
    ]);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    this.quad(ctx, pr, [
      { x: C, y: fy, z: C }, { x: C, y: fy, z: -C },
      { x: C, y: fy + 10, z: -C }, { x: C, y: fy + 10, z: C },
    ]);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }

  drawShadow(ctx, pr) {
    // Contact shadow under the figure — the main depth cue during the
    // fall: it grows and darkens as the ground gets closer.
    const s = this.stick;
    const dist = Math.max(0, this.floorY() - s.y);
    const near = Math.max(0.12, 1 - dist / 1100);
    const p = pr({ x: s.x, y: this.floorY(), z: s.z });
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 26 * near + 6, (26 * near + 6) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.38 * near})`;
    ctx.fill();
  }

  // The four transparent walls of the cube. Far walls (behind the
  // figure) are drawn before it, near walls after — so the figure
  // shows through the glass.
  drawWalls(ctx, pr, which) {
    const hg = this.halfGapDisplay === null ? this.cubeHalf() : this.halfGapDisplay;
    const fy = this.floorY(), top = fy - this.wallH();
    const P = MH.Palette;

    // Depth = x+z of the wall center; negative is far from the viewer.
    const walls = [
      { d: -hg, c: [{ x: -hg, y: fy, z: -hg }, { x: -hg, y: fy, z: hg }] },  // x = -hg
      { d: -hg, c: [{ x: -hg, y: fy, z: -hg }, { x: hg, y: fy, z: -hg }] },  // z = -hg
      { d:  hg, c: [{ x:  hg, y: fy, z: -hg }, { x: hg, y: fy, z: hg }] },   // x = +hg
      { d:  hg, c: [{ x: -hg, y: fy, z:  hg }, { x: hg, y: fy, z: hg }] },   // z = +hg
    ];

    for (const wall of walls) {
      if (which === 'far' ? wall.d > 0 : wall.d <= 0) continue;
      const [a, b] = wall.c;
      this.quad(ctx, pr, [
        a, b,
        { x: b.x, y: top, z: b.z },
        { x: a.x, y: top, z: a.z },
      ]);
      // Two glaze layers so the glass reads everywhere: the dark one
      // shows over the white floor, the light one over the black void.
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fill();
      ctx.fillStyle = P.get('wall');
      ctx.fill();
      // Halo-stroked edges stay visible on both black and white.
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = P.get('wallEdge');
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  drawStick(ctx, pr) {
    const S = MH.Stickman;
    const s = this.stick;
    let pose;

    switch (this.phase) {
      case 'falling':
        pose = S.poseFall(this.elapsed);
        break;
      case 'landing':
        pose = S.poseCrouch(this.crouchK);
        break;
      case 'end': {
        // Bracing: crouched, arms straight out against the closing walls.
        pose = S.poseCrouch(0.35);
        pose.armL = [-1.5, -1.55];
        pose.armR = [1.5, 1.55];
        break;
      }
      default: {
        const nearWalls = this.halfGapDisplay !== null && this.halfGapDisplay < 70;
        if (nearWalls) {
          pose = S.poseCrouch(0.25);
          pose.armL = [-1.5, -1.55];
          pose.armR = [1.5, 1.55];
        } else if (s.moving) {
          pose = S.poseRun(this.elapsed);
        } else {
          pose = S.poseIdle(this.elapsed);
        }
      }
    }

    pose.x = s.x;
    pose.y = s.y;
    pose.z = s.z;
    pose.yaw = s.yaw;
    pose.scale = s.scale;
    S.draw(ctx, pr, pose, MH.Palette.get('figure'), 3);
  }

  drawDust(ctx, pr) {
    for (const p of this.dust) {
      const a = pr(p);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(a.x - 2.5, a.y - 2.5, 5, 5);
      ctx.fillStyle = MH.Palette.get('dust');
      ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  drawTitle(ctx, w, h) {
    if (this.phase !== 'falling') return;
    const a = Math.min(this.t / 0.8, 1) * Math.max(0, Math.min(1, (3.0 - this.t) / 0.8));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = MH.Palette.get('text');
    ctx.font = '300 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('S C E N E  I', w / 2, h * 0.2);
    ctx.font = '300 16px "Courier New", monospace';
    ctx.fillStyle = MH.Palette.get('textFaint');
    ctx.fillText('t h e   f a l l', w / 2, h * 0.2 + 30);
    ctx.globalAlpha = 1;
  }

  drawEnd(ctx, w, h) {
    if (this.endFade <= 0) return;
    ctx.fillStyle = `rgba(0,0,0,${this.endFade})`;
    ctx.fillRect(0, 0, w, h);

    const textA = Math.max(0, (this.endFade - 0.7) / 0.3);
    if (textA <= 0) return;
    ctx.globalAlpha = textA;
    ctx.textAlign = 'center';
    ctx.fillStyle = MH.Palette.get('text');
    ctx.font = '300 24px "Courier New", monospace';
    ctx.fillText('the walls closed in.', w / 2, h * 0.44);
    ctx.fillStyle = MH.Palette.get('textFaint');
    ctx.font = '300 15px "Courier New", monospace';
    ctx.fillText('end of scene one', w / 2, h * 0.44 + 36);
    ctx.fillText(`${MH.Palette.unlockedCount()} / ${MH.Palette.slots.length} colors found`, w / 2, h * 0.44 + 60);
    ctx.fillText('press R to fall again', w / 2, h * 0.44 + 96);
    ctx.globalAlpha = 1;
  }
};
