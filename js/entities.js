/* ==========================================================================
   VELVET CONTRACT — actors, bodies and particles
   ========================================================================== */
(function () {
  'use strict';
  const VC = (window.VC = window.VC || {});
  const U = VC.Utils;
  const { clamp, lerp, dist, angleDiff, angleLerp, roundedRect, ellipse, rgba, shade } = U;

  class Player {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.radius = 13;
      this.angle = 0;
      this.outfitId = 'guest';
      this.health = 100;
      this.stamina = 100;
      this.crouching = false;
      this.sprinting = false;
      this.moving = false;
      this.speed = 0;
      this.attackTimer = 0;
      this.attackCooldown = 0;
      this.hurtTimer = 0;
      this.invuln = 0;
      this.dragBody = null;
      this.poison = 0;
      this.anim = 0;
      this.stepTimer = 0;
      this.blend = false;
      this.lastMoveAngle = 0;
    }

    hasAccess(zone) {
      if (!zone) return true;
      const o = VC.OUTFITS[this.outfitId];
      return !!o && o.clearance.includes(zone);
    }

    update(dt, game, input) {
      const keys = input.keys;
      this.anim += dt;
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      this.hurtTimer = Math.max(0, this.hurtTimer - dt);
      this.invuln = Math.max(0, this.invuln - dt);

      if (this.dragBody) {
        this.dragBody.x = this.x - Math.cos(this.angle) * 20;
        this.dragBody.y = this.y - Math.sin(this.angle) * 20;
        this.dragBody.angle = this.angle;
      }

      let dx = 0, dy = 0;
      if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
      const len = Math.hypot(dx, dy);
      this.moving = len > 0;
      this.crouching = !!(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']);
      const wantsSprint = !!(keys['ShiftLeft'] || keys['ShiftRight']) && !this.crouching && !this.dragBody;
      this.sprinting = wantsSprint && this.stamina > 2 && this.moving;

      let speed = this.crouching ? 92 : 164;
      if (this.sprinting) speed = 252;
      if (this.dragBody) speed *= 0.62;
      this.speed = speed;

      if (this.sprinting) this.stamina = Math.max(0, this.stamina - 22 * dt);
      else this.stamina = Math.min(100, this.stamina + 14 * dt);

      if (this.moving) {
        dx /= len; dy /= len;
        const move = speed * dt;
        const ox = this.x, oy = this.y;
        game.level.moveCircle(this, dx * move, dy * move, this.radius);
        this.lastMoveAngle = Math.atan2(dy, dx);
        this.angle = angleLerp(this.angle, this.lastMoveAngle, 1 - Math.pow(0.0001, dt));
        if (this.sprinting && (this.x !== ox || this.y !== oy)) {
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) {
            this.stepTimer = 0.15;
            game.spawnDust(this.x, this.y, this.angle);
          }
        }
      }

      // Body drag details: the body trails behind and cannot be left inside walls.
      if (this.dragBody && !game.level.canStand(this.dragBody.x, this.dragBody.y, 7)) {
        this.dragBody.x = this.x;
        this.dragBody.y = this.y;
      }
    }

    hurt(amount, game) {
      if (this.invuln > 0) return;
      this.health = Math.max(0, this.health - amount);
      this.hurtTimer = 0.35;
      this.invuln = 0.42;
      game.shake = Math.max(game.shake, 7);
      game.spawnSparks(this.x, this.y, '#b33f3a', 8);
      if (this.health <= 0) game.fail('You were shot down.', 'The floor closed around you.');
    }

    draw(ctx, game) {
      const o = VC.OUTFITS[this.outfitId];
      const bob = this.moving ? Math.sin(this.anim * (this.sprinting ? 18 : 11)) * 1.6 : 0;
      const crouchScale = this.crouching ? 0.82 : 1;
      const blink = this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0;
      ctx.save();
      ctx.translate(this.x, this.y + 5);
      ellipse(ctx, 0, 5, 17, 9); ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.fill();
      ctx.translate(0, bob);
      ctx.rotate(this.angle);
      ctx.scale(crouchScale, crouchScale);
      // Feet
      ctx.fillStyle = '#17181b';
      roundedRect(ctx, -8, -8, 11, 6, 3); ctx.fill();
      roundedRect(ctx, -8, 2, 11, 6, 3); ctx.fill();
      // Torso
      const bodyGrad = ctx.createLinearGradient(-15, 0, 14, 0);
      bodyGrad.addColorStop(0, shade(o.color, -20)); bodyGrad.addColorStop(0.55, o.color); bodyGrad.addColorStop(1, shade(o.color, 14));
      ctx.fillStyle = bodyGrad;
      roundedRect(ctx, -13, -10, 25, 20, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
      // Uniform trim / badge
      ctx.fillStyle = o.trim;
      ctx.fillRect(-3, -11, 7, 2);
      if (this.outfitId === 'guard') {
        ctx.fillStyle = '#1a2028'; ctx.fillRect(-6, -8, 10, 16);
        ctx.fillStyle = '#c8a865'; ctx.fillRect(1, -2, 2, 2);
      } else if (this.outfitId === 'chef') {
        ctx.fillStyle = '#f0eee8'; ctx.fillRect(-6, -3, 8, 3);
      }
      // Arms
      ctx.fillStyle = shade(o.color, 8);
      roundedRect(ctx, 0, -15, 9, 6, 3); ctx.fill();
      roundedRect(ctx, 0, 9, 9, 6, 3); ctx.fill();
      // Head
      ctx.fillStyle = '#c59a76';
      ctx.beginPath(); ctx.arc(9, 0, 7.3, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#2b211c';
      ctx.beginPath(); ctx.arc(8.3, -2.2, 4.6, Math.PI * 0.85, Math.PI * 1.9); ctx.fill();
      // Knife during attack
      if (this.attackTimer > 0) {
        const extend = 1 - this.attackTimer / 0.26;
        ctx.save();
        ctx.translate(14, 4 + Math.sin(extend * Math.PI) * 5);
        ctx.rotate(-0.25 + extend * 0.7);
        ctx.fillStyle = '#d9dde0'; ctx.fillRect(0, -1, 15, 2);
        ctx.fillStyle = '#3b2a21'; ctx.fillRect(-4, -1.5, 5, 3);
        ctx.restore();
      } else {
        ctx.fillStyle = '#9da5a8'; ctx.fillRect(10, 7, 9, 1.4);
      }
      // Subtle gold identity ring.
      ctx.strokeStyle = 'rgba(235,210,150,.34)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, U.TAU); ctx.stroke();
      ctx.restore();

      if (blink) {
        ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff';
        ellipse(ctx, this.x, this.y, 20, 20); ctx.fill(); ctx.restore();
      }
      if (this.crouching) {
        ctx.save();
        ctx.fillStyle = 'rgba(215,182,106,.55)'; ctx.font = '7px "SFMono-Regular", monospace';
        ctx.textAlign = 'center'; ctx.fillText('CROUCH', this.x, this.y - 25);
        ctx.restore();
      }
    }
  }

  class NPC {
    constructor(opts) {
      this.id = opts.id;
      this.name = opts.name || 'Unknown';
      this.role = opts.role || 'civilian';
      this.outfitId = opts.outfitId || 'guest';
      this.x = opts.x; this.y = opts.y;
      this.angle = opts.angle !== undefined ? opts.angle : Math.random() * U.TAU;
      this.radius = 12;
      this.homeRoom = opts.homeRoom || null;
      this.patrolRooms = opts.patrolRooms || (this.homeRoom ? [this.homeRoom] : []);
      this.health = opts.health || 100;
      this.alive = true;
      this.state = 'patrol';
      this.awareness = 0;
      this.alerted = false;
      this.lastSeen = null;
      this.path = null;
      this.pathIndex = 0;
      this.pathGoal = null;
      this.waitTimer = Math.random() * 2;
      this.lookTimer = 0;
      this.scanBase = this.angle;
      this.patrolWait = 0;
      this.anim = Math.random() * 10;
      this.speed = this.role === 'target' ? 52 : this.role === 'bodyguard' ? 96 : 68;
      this.baseSpeed = this.speed;
      this.visionRange = this.role === 'guard' || this.role === 'bodyguard' ? 330 : this.role === 'target' ? 250 : 225;
      this.fov = this.role === 'guard' || this.role === 'bodyguard' ? 1.72 : this.role === 'target' ? 1.5 : 1.4;
      this.panicTimer = 0;
      this.shootTimer = 0.8 + Math.random() * 0.6;
      this.drinkTimer = 0;
      this.arrived = false;
      this.routeIndex = 0;
      this.routePoints = opts.routePoints || [];
      this.followOffset = opts.followOffset || { x: -55, y: 45 };
      this.skin = opts.skin || ['#c89b78', '#a87655', '#e0b28b', '#8b5f45', '#d3a17f'][Math.floor(Math.random() * 5)];
      this.hair = opts.hair || ['#221b17', '#4a3426', '#6d5945', '#161719'][Math.floor(Math.random() * 4)];
      this.tint = opts.tint || null;
      this.panicTarget = null;
      this.investigateTimer = 0;
      this.stuckTimer = 0;
      this.lastPos = { x: this.x, y: this.y };
      this.target = null;
      this.isTarget = this.role === 'target';
      this.cower = false;
      this.escaped = false;
      this.alertPulse = 0;
      this.footstep = 0;
      this.poisoned = false;
    }

    face(x, y, dt, instant) {
      const a = Math.atan2(y - this.y, x - this.x);
      this.angle = instant ? a : angleLerp(this.angle, a, 1 - Math.pow(0.002, dt));
    }

    setPath(path, goal) {
      this.path = path;
      this.pathIndex = 0;
      this.pathGoal = goal ? { x: goal.x, y: goal.y } : null;
    }

    requestPath(game, goal, force) {
      if (!goal) return false;
      if (!force && this.path && this.pathGoal && U.dist(this.pathGoal.x, this.pathGoal.y, goal.x, goal.y) < 50) return true;
      if (!force && this.path && this.pathIndex < this.path.length) return true;
      const path = game.level.findPathWorld(this.x, this.y, goal.x, goal.y);
      if (!path) return false;
      this.setPath(path, goal);
      return true;
    }

    followPath(dt, speed) {
      if (!this.path || this.pathIndex >= this.path.length) return true;
      const p = this.path[this.pathIndex];
      const d = U.dist(this.x, this.y, p.x, p.y);
      const step = speed * dt;
      if (d <= Math.max(7, step)) {
        this.x = p.x; this.y = p.y;
        this.pathIndex++;
        if (this.pathIndex >= this.path.length) { this.path = null; this.arrived = true; return true; }
      } else {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.x += Math.cos(a) * step;
        this.y += Math.sin(a) * step;
        this.face(p.x, p.y, dt);
      }
      return false;
    }

    choosePatrolGoal(game) {
      const rooms = this.patrolRooms.length ? this.patrolRooms : (this.homeRoom ? [this.homeRoom] : []);
      const room = rooms.length ? game.rng.pick(rooms) : null;
      if (room) return game.level.randomFreePoint(room, game.rng, 16);
      return { x: this.x, y: this.y };
    }

    update(dt, game) {
      if (!this.alive) return;
      this.anim += dt;
      this.shootTimer = Math.max(0, this.shootTimer - dt);
      this.waitTimer = Math.max(0, this.waitTimer - dt);
      this.investigateTimer = Math.max(0, this.investigateTimer - dt);
      this.alertPulse = Math.max(0, this.alertPulse - dt);

      // Alerted guards pursue rather than patrol.
      if (this.role === 'guard' || this.role === 'bodyguard') {
        if (this.state === 'chase') {
          const target = game.player;
          const canSee = game.npcSeesPoint(this, target.x, target.y, this.visionRange * 1.18, this.fov * 1.3) && game.level.lineOfSight(this.x, this.y, target.x, target.y);
          if (canSee) {
            this.lastSeen = { x: target.x, y: target.y };
            this.investigateTimer = 9;
          }
          if (this.lastSeen) {
            const p = this.lastSeen;
            const d = U.dist(this.x, this.y, p.x, p.y);
            if (d > 55) {
              if (!this.path || this.waitTimer <= 0) {
                if (this.requestPath(game, p, false)) this.waitTimer = 0.65;
              }
              this.followPath(dt, this.speed * 1.45);
            } else {
              this.face(p.x, p.y, dt);
            }
            if (canSee && d < 285) {
              if (this.shootTimer <= 0) {
                this.shootTimer = 1.05 + Math.random() * 0.55;
                game.guardShoot(this);
              }
            }
          }
          if (this.investigateTimer <= 0) {
            this.state = 'patrol'; this.alerted = false; this.lastSeen = null;
          }
          return;
        }
        if (this.state === 'investigate') {
          if (this.lastSeen) {
            if (this.requestPath(game, this.lastSeen, false)) this.followPath(dt, this.speed * 1.2);
          }
          if (this.investigateTimer <= 0) {
            this.state = 'patrol'; this.alerted = false; this.lastSeen = null; this.awareness = Math.min(this.awareness, 20);
          }
          return;
        }
        if (this.state === 'suspicious') {
          if (game.player) this.face(game.player.x, game.player.y, dt);
          // A suspicious guard closes in slowly, which gives the player a
          // chance to break line of sight or blend into a crowd.
          if (this.awareness > 70 && this.waitTimer <= 0) {
            if (this.requestPath(game, { x: game.player.x, y: game.player.y }, false)) this.waitTimer = 1.2;
            this.followPath(dt, this.speed * 0.7);
          }
          if (this.awareness < 8) this.state = 'patrol';
          return;
        }
      }

      if (this.role === 'target') {
        if (this.cower) {
          // Cowering target looks around nervously.
          this.angle += Math.sin(this.anim * 1.4) * dt * 0.5;
          return;
        }
        if (game.alarm && !this.cower && this.state !== 'flee') {
          this.state = 'flee';
          const safe = game.level.targetSafePoint;
          if (safe) this.requestPath(game, { x: safe.x, y: safe.y }, true);
        }
        if (this.state === 'flee') {
          if (this.path) this.followPath(dt, this.speed * 1.5);
          else {
            this.cower = true;
            game.toast('The target has taken cover.');
          }
          return;
        }
        this.updateWander(dt, game, true);
        return;
      }

      if (this.state === 'panic') {
        this.panicTimer = Math.max(0, this.panicTimer - dt);
        if (!this.panicTarget || U.dist(this.x, this.y, this.panicTarget.x, this.panicTarget.y) < 35) {
          const room = this.homeRoom || game.level.rooms[0];
          this.panicTarget = game.level.randomFreePoint(room, game.rng, 15);
        }
        if (this.panicTarget) {
          if (this.requestPath(game, this.panicTarget, false)) this.followPath(dt, this.speed * 1.55);
        }
        if (this.panicTimer <= 0) {
          this.state = 'cower';
          this.cower = true;
        }
        return;
      }
      if (this.state === 'cower') {
        this.angle += Math.sin(this.anim * 2.2) * dt * 0.8;
        return;
      }

      if (this.role === 'bodyguard') {
        this.followTarget(dt, game);
        return;
      }

      this.updateWander(dt, game, false);
    }

    followTarget(dt, game) {
      const target = game.getTarget();
      if (!target || !target.alive) {
        this.updateWander(dt, game, false);
        return;
      }
      const goal = { x: target.x + this.followOffset.x, y: target.y + this.followOffset.y };
      if (!game.level.canStand(goal.x, goal.y, 10)) {
        goal.x = target.x; goal.y = target.y;
      }
      const d = U.dist(this.x, this.y, goal.x, goal.y);
      if (d > 75) {
        if (this.requestPath(game, goal, false)) this.followPath(dt, this.speed * 1.25);
      } else {
        this.face(target.x, target.y, dt);
      }
    }

    updateWander(dt, game, isTarget) {
      if (this.path && this.pathIndex < this.path.length) {
        this.followPath(dt, this.speed * (isTarget ? 1 : 0.9));
        return;
      }
      if (this.arrived) {
        this.arrived = false;
        this.waitTimer = isTarget ? 3.2 + Math.random() * 4.5 : 0.9 + Math.random() * 2.4;
        this.scanBase = this.angle;
        return;
      }
      if (this.waitTimer > 0) {
        // Idle scan: sweep the gaze across the room.
        this.angle = this.scanBase + Math.sin(this.anim * 0.6) * 0.5;
        return;
      }
      if (isTarget && this.routePoints.length) {
        const point = this.routePoints[this.routeIndex % this.routePoints.length];
        this.routeIndex++;
        if (this.requestPath(game, point, true)) {
          this.waitTimer = 0;
        } else {
          this.waitTimer = 2;
        }
        this.scanBase = this.angle;
        return;
      }
      const goal = this.choosePatrolGoal(game);
      if (this.requestPath(game, goal, true)) {
        this.waitTimer = 0;
      } else {
        this.waitTimer = 1.2 + Math.random() * 2;
      }
      this.scanBase = this.angle;
    }

    getStateLabel() {
      if (!this.alive) return null;
      if (this.state === 'chase') return { text: '!', color: '#e46a61' };
      if (this.state === 'panic') return { text: '!', color: '#e4a45e' };
      if (this.state === 'suspicious') return { text: '?', color: '#e3c069' };
      if (this.state === 'investigate') return { text: '?', color: '#d6b45f' };
      return null;
    }

    drawVision(ctx, game, player) {
      if (!this.alive) return;
      if (!['guard', 'bodyguard', 'target'].includes(this.role)) return;
      if (U.dist(this.x, this.y, player.x, player.y) > 1250) return;
      const alert = this.state === 'chase';
      const suspicious = this.state === 'suspicious' || this.state === 'investigate';
      const range = this.role === 'guard' || this.role === 'bodyguard' ? this.visionRange * (alert ? 1.12 : 1) : 145;
      const fov = this.role === 'target' ? 1.2 : this.fov;
      const rays = alert ? 27 : 21;
      const pts = [];
      for (let i = 0; i <= rays; i++) {
        const a = this.angle - fov / 2 + fov * (i / rays);
        const d = game.level.raycast(this.x, this.y, a, range);
        pts.push([this.x + Math.cos(a) * d, this.y + Math.sin(a) * d]);
      }
      ctx.save();
      const color = alert ? '212,80,75' : suspicious ? '220,178,89' : '214,196,153';
      const grad = ctx.createRadialGradient(this.x, this.y, 12, this.x, this.y, range);
      grad.addColorStop(0, `rgba(${color},${alert ? 0.18 : suspicious ? 0.14 : 0.085})`);
      grad.addColorStop(0.65, `rgba(${color},${alert ? 0.08 : 0.045})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${color},${alert ? 0.34 : 0.17})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(pts[0][0], pts[0][1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); ctx.stroke();
      ctx.restore();
    }

    draw(ctx, game, player) {
      if (!this.alive) return;
      const o = VC.OUTFITS[this.outfitId];
      const moving = !!this.path;
      const bob = moving ? Math.sin(this.anim * 10) * 1.4 : 0;
      const targetRing = this.role === 'target';
      ctx.save();
      ctx.translate(this.x, this.y + 5);
      ellipse(ctx, 0, 5, 16, 8.5); ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fill();
      if (targetRing) {
        ctx.strokeStyle = 'rgba(231,187,80,.45)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 2, 20, 0, U.TAU); ctx.stroke();
      }
      ctx.translate(0, bob);
      ctx.rotate(this.angle);
      // Legs
      ctx.fillStyle = '#1a1b1e';
      roundedRect(ctx, -8, -7, 10, 5, 2); ctx.fill();
      roundedRect(ctx, -8, 2, 10, 5, 2); ctx.fill();
      // Body
      const g = ctx.createLinearGradient(-12, 0, 12, 0);
      g.addColorStop(0, shade(o.color, -18)); g.addColorStop(0.5, o.color); g.addColorStop(1, shade(o.color, 10));
      ctx.fillStyle = g;
      roundedRect(ctx, -12, -9, 23, 18, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = o.trim;
      if (this.role === 'guard' || this.role === 'bodyguard') {
        ctx.fillStyle = '#171d24'; ctx.fillRect(-5, -7, 9, 14);
        ctx.fillStyle = '#c4a05d'; ctx.fillRect(1, -1, 2, 2);
      } else if (this.role === 'chef') {
        ctx.fillStyle = '#f6f2e7'; ctx.fillRect(-5, -2, 8, 3);
      } else if (this.role === 'target') {
        ctx.fillStyle = '#d7a6bb'; ctx.fillRect(-4, -8, 5, 16);
      } else {
        ctx.fillRect(-3, -9, 6, 2);
      }
      // Arms
      ctx.fillStyle = shade(o.color, 5);
      roundedRect(ctx, 0, -14, 8, 5, 2); ctx.fill();
      roundedRect(ctx, 0, 9, 8, 5, 2); ctx.fill();
      // Head
      ctx.fillStyle = this.skin;
      ctx.beginPath(); ctx.arc(8, 0, 6.6, 0, U.TAU); ctx.fill();
      ctx.fillStyle = this.hair;
      ctx.beginPath(); ctx.arc(7.6, -2, 4.2, Math.PI * 0.8, Math.PI * 1.95); ctx.fill();
      if (this.role === 'guard' || this.role === 'bodyguard') {
        ctx.fillStyle = '#1c232a'; ctx.beginPath(); ctx.arc(8, 0, 7, Math.PI * 0.7, Math.PI * 1.9); ctx.fill();
        ctx.fillStyle = '#c5a35e'; ctx.fillRect(4, -7, 7, 1.2);
      }
      if (this.state === 'chase' || this.role === 'guard' || this.role === 'bodyguard') {
        ctx.fillStyle = '#252a2d'; ctx.fillRect(7, 6, 10, 2.2);
        ctx.fillStyle = '#778082'; ctx.fillRect(15, 6, 3, 2.2);
      }
      ctx.restore();
      // Alert marker.
      const st = this.getStateLabel();
      if (st) {
        ctx.save();
        ctx.font = 'bold 14px "SFMono-Regular", monospace';
        ctx.textAlign = 'center';
        const pulse = 1 + Math.sin(this.anim * 7) * 0.08;
        ctx.translate(this.x, this.y - 29 - pulse * 2);
        ctx.fillStyle = 'rgba(7,8,11,.82)'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, U.TAU); ctx.fill();
        ctx.fillStyle = st.color; ctx.fillText(st.text, 0, 5);
        ctx.restore();
      }
      if (this.role === 'target') {
        ctx.save();
        ctx.translate(this.x, this.y - 43);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#e2b84c'; ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeStyle = 'rgba(255,240,190,.8)'; ctx.lineWidth = 1; ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();
        ctx.save();
        ctx.font = '600 9px "Avenir Next", sans-serif';
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(245,231,193,.8)';
        ctx.fillText(this.name, this.x, this.y - 54);
        ctx.restore();
      }
      // Awareness bar for guards/civilians about to raise the alarm.
      if (this.awareness > 3 && this.state !== 'chase') {
        const w = 30;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(this.x - w / 2, this.y - 23, w, 3);
        ctx.fillStyle = this.awareness > 65 ? '#d86457' : '#d6b45f';
        ctx.fillRect(this.x - w / 2, this.y - 23, w * clamp(this.awareness / 100, 0, 1), 3);
      }
    }
  }

  class Body {
    constructor(npc) {
      this.x = npc.x; this.y = npc.y;
      this.angle = npc.angle;
      this.outfitId = npc.outfitId;
      this.name = npc.name;
      this.role = npc.role;
      this.isTarget = npc.role === 'target';
      this.looted = false;
      this.discovered = false;
      this.hidden = false;
      this.beingDragged = false;
      this.bloodSeed = Math.random() * 1000;
      this.blood = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * U.TAU, d = Math.random() * 22;
        this.blood.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 4 + Math.random() * 11 });
      }
    }

    draw(ctx, game) {
      if (this.hidden) return;
      const o = VC.OUTFITS[this.outfitId];
      ctx.save();
      ctx.translate(this.x, this.y);
      // Blood pool.
      for (const b of this.blood) {
        ctx.fillStyle = 'rgba(85,12,16,.48)';
        ellipse(ctx, b.x, b.y + 4, b.r, b.r * 0.55); ctx.fill();
      }
      ctx.rotate(this.angle);
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ellipse(ctx, 0, 5, 22, 9); ctx.fill();
      // Limbs and torso.
      ctx.fillStyle = shade(o.color, -14);
      roundedRect(ctx, -17, -6, 14, 12, 5); ctx.fill();
      roundedRect(ctx, 13, 7, 12, 4, 2); ctx.fill();
      roundedRect(ctx, 13, -11, 12, 4, 2); ctx.fill();
      ctx.fillStyle = o.color;
      roundedRect(ctx, -7, -9, 23, 18, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
      ctx.fillStyle = o.trim; ctx.fillRect(3, -8, 5, 2);
      ctx.fillStyle = '#b88c6a';
      ctx.beginPath(); ctx.arc(19, 0, 6.8, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#241c18';
      ctx.beginPath(); ctx.arc(19, -1, 4.5, Math.PI * 0.7, Math.PI * 1.7); ctx.fill();
      ctx.restore();

      if (this.isTarget) {
        ctx.save();
        ctx.translate(this.x, this.y - 27); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#d4a93d'; ctx.fillRect(-3.5, -3.5, 7, 7);
        ctx.restore();
      }
      if (!this.looted && game && game.player && game.player.outfitId !== this.outfitId) {
        ctx.save();
        ctx.font = '7px "SFMono-Regular", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(235,226,204,.52)';
        ctx.fillText('E · SEARCH', this.x, this.y + 31);
        ctx.restore();
      }
      if (this.discovered) {
        ctx.save();
        ctx.strokeStyle = 'rgba(215,92,82,.45)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, 27, 0, U.TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }

  class Particle {
    constructor(opts) {
      Object.assign(this, {
        x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1, size: 2,
        color: '#fff', gravity: 0, drag: 0.96, shape: 'circle', rot: 0, vrot: 0, alpha: 1
      }, opts);
      this.maxLife = this.life;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) return false;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.gravity * dt;
      this.vx *= Math.pow(this.drag, dt * 60);
      this.vy *= Math.pow(this.drag, dt * 60);
      this.rot += this.vrot * dt;
      return true;
    }
    draw(ctx) {
      const t = clamp(this.life / this.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = t * this.alpha;
      ctx.fillStyle = this.color;
      if (this.shape === 'line') {
        ctx.strokeStyle = this.color; ctx.lineWidth = this.size;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02); ctx.stroke();
      } else if (this.shape === 'square') {
        ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      } else {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (0.6 + 0.4 * t), 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  VC.Player = Player;
  VC.NPC = NPC;
  VC.Body = Body;
  VC.Particle = Particle;
})();
