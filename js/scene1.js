/*
 * Scene I — "The Fall"
 *
 * A stickman falls through black nothing, lands on the solid white
 * floor of a cube with transparent walls, and then — every second —
 * the walls slam inward until there is nowhere left to stand.
 * Fade to black. End of scene.
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

    // World layout: the stickman starts at y=0 and falls FALL_DIST
    // down to the cube floor.
    this.fallDist = Math.max(h * 2.6, 1400);

    this.stick = {
      x: this.canvas.width / 2,
      y: 0,              // hip position, world coords
      vy: 0,
      facing: 1,
      moving: false,
      scale: 1.15,
    };

    this.cam = -h * 0.42;
    this.shake = 0;

    // Wall collapse state
    this.slams = 0;
    this.totalSlams = 8;
    this.endHalfGap = 26;
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

  cubeW()   { return Math.min(this.canvas.width * 0.62, 680); }
  cubeH()   { return Math.min(this.canvas.height * 0.5, 440); }
  floorY()  { return this.fallDist; }
  centerX() { return this.canvas.width / 2; }

  camMax()  { return this.fallDist - this.canvas.height * 0.72; }

  // Target half-width of the gap between the walls after `slams` slams.
  halfGapTarget() {
    const k = this.slams / this.totalSlams;
    return (this.cubeW() / 2) * (1 - k) + this.endHalfGap * k;
  }

  spawnSpecks() {
    // Ambient motes in the fall column; drawn with motion blur so the
    // descent reads as speed even against a featureless background.
    this.specks = [];
    for (let i = 0; i < 42; i++) {
      this.specks.push({
        x: Math.random() * this.canvas.width,
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
    const left = keys['ArrowLeft'] || keys['a'];
    const right = keys['ArrowRight'] || keys['d'];
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    switch (this.phase) {
      case 'falling': {
        s.vy = Math.min(s.vy + 1500 * dt, 950);
        s.y += s.vy * dt;
        s.x += dir * 140 * dt; // slight air control
        const standH = MH.Stickman.hipHeight(0.1, s.scale);
        if (s.y >= this.floorY() - standH) {
          s.y = this.floorY() - standH;
          s.vy = 0;
          this.phase = 'landing';
          this.t = 0;
          this.shake = 1;
          MH.Audio.land();
          this.burstDust(s.x, this.floorY(), 20, 160);
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
        this.walk(dt, dir);
        if (this.t > 1.1) { this.phase = 'walls'; this.t = 0; this.slamTimer = 0; }
        break;
      }

      case 'walls': {
        this.walk(dt, dir);
        this.slamTimer += dt;
        if (this.slamTimer >= 1.0) {
          this.slamTimer -= 1.0;
          this.slams++;
          this.shake = 0.6;
          MH.Audio.slam();
          const hg = this.halfGapTarget();
          this.burstDust(this.centerX() - hg, this.floorY(), 5, 60);
          this.burstDust(this.centerX() + hg, this.floorY(), 5, 60);
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
      s.x = Math.max(this.centerX() - limit, Math.min(this.centerX() + limit, s.x));
    }

    // The ambient motes belong to the fall; once grounded they dissolve.
    if (this.phase !== 'falling') {
      this.speckAlpha = Math.max(0, this.speckAlpha - dt * 1.2);
    }

    // dust particles
    for (const p of this.dust) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.life -= dt;
    }
    this.dust = this.dust.filter(p => p.life > 0);
  }

  walk(dt, dir) {
    const s = this.stick;
    s.moving = dir !== 0;
    if (dir !== 0) {
      s.facing = dir;
      s.x += dir * 240 * dt;
    }
    s.y = this.floorY() - MH.Stickman.hipHeight(s.moving ? 0.12 : 0.06, s.scale);
  }

  burstDust(x, y, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.dust.push({
        x, y,
        vx: Math.cos(a) * v * (Math.random() < 0.5 ? 1 : -1),
        vy: -Math.sin(a) * v * 0.5,
        life: 0.4 + Math.random() * 0.4,
      });
    }
  }

  // ---- draw -----------------------------------------------------------

  draw(ctx) {
    const w = this.canvas.width, h = this.canvas.height;
    const P = MH.Palette;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const shakeX = (Math.random() - 0.5) * 14 * this.shake;
    const shakeY = (Math.random() - 0.5) * 10 * this.shake;

    ctx.save();
    ctx.translate(shakeX, -this.cam + shakeY);

    this.drawSpecks(ctx);
    this.drawCube(ctx);
    this.drawStick(ctx);
    this.drawDust(ctx);

    ctx.restore();

    this.drawTitle(ctx, w, h);
    this.drawEnd(ctx, w, h);
  }

  drawSpecks(ctx) {
    if (this.speckAlpha <= 0.01) return;
    const vy = this.stick.vy;
    ctx.globalAlpha = this.speckAlpha;
    ctx.strokeStyle = MH.Palette.get('wind');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const sp of this.specks) {
      const blur = Math.max(2, vy * 0.035);
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x, sp.y - blur);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawCube(ctx) {
    const P = MH.Palette;
    const cx = this.centerX();
    const fy = this.floorY();
    const cw = this.cubeW(), ch = this.cubeH();
    const hg = this.halfGapDisplay === null ? cw / 2 : this.halfGapDisplay;
    const wallT = 10;

    // Solid white floor — the one dependable thing in the scene.
    ctx.fillStyle = P.get('floor');
    ctx.fillRect(cx - cw / 2 - wallT, fy, cw + wallT * 2, 12);

    // Transparent walls, sliding inward over the floor.
    const top = fy - ch;
    for (const side of [-1, 1]) {
      const inner = cx + side * hg;
      const x = side === -1 ? inner - wallT : inner;
      ctx.fillStyle = P.get('wall');
      ctx.fillRect(x, top, wallT, ch);
      ctx.strokeStyle = P.get('wallEdge');
      ctx.lineWidth = 2;
      ctx.strokeRect(x, top, wallT, ch);
    }

    // Faint ceiling edge spanning the shrinking opening.
    ctx.strokeStyle = P.get('wall');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - hg - wallT, top);
    ctx.lineTo(cx + hg + wallT, top);
    ctx.stroke();
  }

  drawStick(ctx) {
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
          pose = S.poseRun(this.elapsed, s.facing);
        } else {
          pose = S.poseIdle(this.elapsed);
        }
      }
    }

    pose.x = s.x;
    pose.y = s.y;
    pose.scale = s.scale;
    S.draw(ctx, pose, MH.Palette.get('figure'), 3);
  }

  drawDust(ctx) {
    ctx.fillStyle = MH.Palette.get('dust');
    for (const p of this.dust) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
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
