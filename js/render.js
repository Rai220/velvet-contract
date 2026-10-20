/* ==========================================================================
   VELVET CONTRACT — static level renderer
   ========================================================================== */
(function () {
  'use strict';
  const VC = (window.VC = window.VC || {});
  const U = VC.Utils;
  const T = VC.TILE;
  const { roundedRect, ellipse, rgba, shade, clamp } = U;

  VC.Level.prototype.buildStatic = function () {
    const canvas = document.createElement('canvas');
    canvas.width = this.pxW;
    canvas.height = this.pxH;
    const ctx = canvas.getContext('2d');
    this.renderExterior(ctx);
    this.renderBuildingShell(ctx);

    // Dark wall base fills every non-floor tile.
    const pal = this.theme.palette;
    ctx.fillStyle = pal.wall;
    ctx.fillRect(this.bx * T, this.by * T, this.bw * T, this.bh * T);

    // Floors.
    for (const room of this.rooms) this.renderRoomFloor(ctx, room);
    this.renderCorridor(ctx);

    // Underlays (rugs) are part of furniture but render beneath lighting.
    const under = this.furniture.filter(f => f.under);
    const solid = this.furniture.filter(f => !f.under);
    for (const f of under) drawFurnitureItem(ctx, f, pal, this.theme);

    this.renderWallDetails(ctx);
    this.renderWindows(ctx);
    this.renderLights(ctx);
    for (const f of solid) drawFurnitureItem(ctx, f, pal, this.theme);
    this.renderDoors(ctx);
    this.renderRoomLabels(ctx);
    this.staticCanvas = canvas;
  };

  // --------------------------------------------------------------- exterior
  VC.Level.prototype.renderExterior = function (ctx) {
    const pal = this.theme.palette;
    const w = this.pxW, h = this.pxH;
    const id = this.theme.id;
    const rng = new U.RNG(this.seed + '·exterior');

    if (id === 'ship') {
      let g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#06131d'); g.addColorStop(0.55, '#0b2a3a'); g.addColorStop(1, '#071923');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 110; i++) {
        const x = rng.range(-100, w), y = rng.range(0, h);
        const len = rng.range(16, 90);
        ctx.strokeStyle = `rgba(138,196,213,${rng.range(0.025, 0.1)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5, y - rng.range(2, 7), x + len, y);
        ctx.stroke();
      }
      // Moonlight wash.
      const glow = ctx.createRadialGradient(w * 0.2, h * 0.08, 10, w * 0.2, h * 0.08, w * 0.7);
      glow.addColorStop(0, 'rgba(157,211,228,.12)'); glow.addColorStop(1, 'rgba(157,211,228,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    } else if (id === 'plane') {
      let g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#07142c'); g.addColorStop(0.48, '#112b4c'); g.addColorStop(1, '#0b1a30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(210,228,255,${rng.range(0.08, 0.42)})`;
        ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(0.6, 1.8), rng.range(0.6, 1.8));
      }
      for (let i = 0; i < 15; i++) {
        const x = rng.range(-200, w), y = rng.range(0, h), cw = rng.range(160, 500), ch = rng.range(20, 48);
        ctx.fillStyle = `rgba(140,174,205,${rng.range(0.02, 0.07)})`;
        ellipse(ctx, x, y, cw, ch); ctx.fill();
      }
      // Wing silhouettes visible around the fuselage.
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#18222e';
      ctx.beginPath();
      ctx.moveTo(w * 0.37, h * 0.1); ctx.lineTo(w * 0.25, h * 0.46); ctx.lineTo(w * 0.43, h * 0.42); ctx.lineTo(w * 0.54, h * 0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.59, h * 0.9); ctx.lineTo(w * 0.71, h * 0.54); ctx.lineTo(w * 0.54, h * 0.58); ctx.lineTo(w * 0.45, h * 0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(164,186,207,.16)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.31, h * 0.38); ctx.lineTo(w * 0.47, h * 0.14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.67, h * 0.62); ctx.lineTo(w * 0.51, h * 0.86); ctx.stroke();
      // Engine nacelles.
      ctx.fillStyle = '#1b2835';
      roundedRect(ctx, w * 0.405, h * 0.14, 92, 154, 40); ctx.fill();
      roundedRect(ctx, w * 0.551, h * 0.72, 92, 154, 40); ctx.fill();
      ctx.fillStyle = 'rgba(132,157,180,.35)';
      roundedRect(ctx, w * 0.414, h * 0.15, 72, 130, 32); ctx.fill();
      roundedRect(ctx, w * 0.56, h * 0.73, 72, 130, 32); ctx.fill();
      ctx.restore();
    } else if (id === 'villa') {
      let g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#132018'); g.addColorStop(0.6, '#1e3226'); g.addColorStop(1, '#122018');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // Garden texture.
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = `rgba(115,150,96,${rng.range(0.02, 0.08)})`;
        ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(2, 9), rng.range(2, 5));
      }
      // Stone terrace ring.
      ctx.fillStyle = '#3f3d35';
      roundedRect(ctx, this.bx * T - 88, this.by * T - 88, this.bw * T + 176, this.bh * T + 176, 24); ctx.fill();
      ctx.strokeStyle = 'rgba(207,188,146,.22)'; ctx.lineWidth = 2;
      for (let x = this.bx * T - 80; x < this.bx * T + this.bw * T + 80; x += 54) {
        ctx.beginPath(); ctx.moveTo(x, this.by * T - 86); ctx.lineTo(x, this.by * T - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, this.by * T + this.bh * T + 20); ctx.lineTo(x, this.by * T + this.bh * T + 86); ctx.stroke();
      }
      // Trees and path lights.
      for (let i = 0; i < 12; i++) {
        const side = rng.chance(0.5) ? 0 : 1;
        const x = rng.range(15, w - 15);
        const y = side ? rng.range(8, this.by * T - 100) : rng.range(this.by * T + this.bh * T + 100, h - 8);
        drawTree(ctx, x, y, rng.range(28, 54), '#1a2e22');
      }
      for (let i = 0; i < 8; i++) {
        const x = rng.range(30, w - 30);
        const y = rng.chance(0.5) ? rng.range(12, this.by * T - 80) : rng.range(this.by * T + this.bh * T + 80, h - 12);
        ctx.fillStyle = 'rgba(255,201,118,.6)'; ctx.beginPath(); ctx.arc(x, y, 3, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,201,118,.08)'; ctx.beginPath(); ctx.arc(x, y, 24, 0, U.TAU); ctx.fill();
      }
    } else if (id === 'hotel') {
      let g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0b0a10'); g.addColorStop(0.5, '#17131c'); g.addColorStop(1, '#09090d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // Wet asphalt reflections.
      for (let i = 0; i < 70; i++) {
        const x = rng.range(0, w), y = rng.range(0, h);
        const rw = rng.range(20, 150), rh = rng.range(1, 3);
        ctx.fillStyle = `rgba(195,166,111,${rng.range(0.01, 0.055)})`;
        ctx.fillRect(x, y, rw, rh);
      }
      // Sidewalk band.
      ctx.fillStyle = '#252129';
      ctx.fillRect(0, this.by * T - 76, w, 76);
      ctx.fillRect(0, this.by * T + this.bh * T, w, 76);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 68) {
        ctx.beginPath(); ctx.moveTo(x, this.by * T - 76); ctx.lineTo(x - 20, this.by * T); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, this.by * T + this.bh * T); ctx.lineTo(x - 20, this.by * T + this.bh * T + 76); ctx.stroke();
      }
      // Street lamps.
      for (let i = 0; i < 6; i++) {
        const x = 70 + i * (w - 140) / 5;
        const y = this.by * T - 40;
        ctx.fillStyle = 'rgba(245,201,135,.75)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, U.TAU); ctx.fill();
        const gl = ctx.createRadialGradient(x, y, 2, x, y, 75);
        gl.addColorStop(0, 'rgba(245,201,135,.22)'); gl.addColorStop(1, 'rgba(245,201,135,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 75, 0, U.TAU); ctx.fill();
      }
    } else {
      // Embassy: a rain-slick diplomatic street at midnight.
      let g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#10151c'); g.addColorStop(0.55, '#171d24'); g.addColorStop(1, '#0d1218');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#20262c';
      ctx.fillRect(0, this.by * T - 82, w, 82);
      ctx.fillRect(0, this.by * T + this.bh * T, w, 82);
      ctx.strokeStyle = 'rgba(208,185,137,.14)'; ctx.lineWidth = 1;
      for (let x = -40; x < w; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, this.by * T - 82); ctx.lineTo(x + 40, this.by * T); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, this.by * T + this.bh * T); ctx.lineTo(x + 40, this.by * T + this.bh * T + 82); ctx.stroke();
      }
      // Hedges and formal trees.
      for (let i = 0; i < 8; i++) {
        const x = 40 + i * (w - 80) / 7;
        drawTree(ctx, x, this.by * T - 112, 28, '#18241c');
        drawTree(ctx, x, this.by * T + this.bh * T + 112, 28, '#18241c');
      }
      // Distant city lights.
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = `rgba(224,195,132,${rng.range(0.03, 0.16)})`;
        ctx.fillRect(rng.range(0, w), rng.range(10, 70), 2, 2);
      }
    }

    // Roof silhouette shadow beneath the building, visible around its edge.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.72)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#050608';
    roundedRect(ctx, this.bx * T - 18, this.by * T - 18, this.bw * T + 36, this.bh * T + 36, id === 'plane' ? 100 : 8);
    ctx.fill();
    ctx.restore();
  };

  VC.Level.prototype.renderBuildingShell = function (ctx) {
    const id = this.theme.id, pal = this.theme.palette;
    const x = this.bx * T, y = this.by * T, w = this.bw * T, h = this.bh * T;
    if (id === 'ship') {
      ctx.fillStyle = '#263239'; ctx.strokeStyle = '#5b6d70'; ctx.lineWidth = 3;
      roundedRect(ctx, x - 46, y - 46, w + 92, h + 92, 72); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(207,225,226,.25)'; ctx.lineWidth = 1.5;
      roundedRect(ctx, x - 27, y - 27, w + 54, h + 54, 55); ctx.stroke();
      // Deck planks around the hull.
      ctx.strokeStyle = 'rgba(202,173,123,.18)';
      for (let i = 0; i < 9; i++) {
        const yy = y - 40 + i * (h + 80) / 8;
        ctx.beginPath(); ctx.moveTo(x - 40, yy); ctx.lineTo(x + w + 40, yy); ctx.stroke();
      }
    } else if (id === 'plane') {
      const grad = ctx.createLinearGradient(0, y - 50, 0, y + h + 50);
      grad.addColorStop(0, '#d6d8d5'); grad.addColorStop(0.35, '#adb1b1'); grad.addColorStop(0.62, '#878e91'); grad.addColorStop(1, '#5c666c');
      ctx.fillStyle = grad;
      roundedRect(ctx, x - 50, y - 38, w + 100, h + 76, 125); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
      roundedRect(ctx, x - 34, y - 25, w + 68, h + 50, 110); ctx.stroke();
      // Painted livery stripe.
      ctx.fillStyle = '#334b65';
      ctx.fillRect(x - 20, y + h + 4, w + 40, 9);
    } else if (id === 'villa') {
      ctx.fillStyle = '#4c4135';
      roundedRect(ctx, x - 22, y - 22, w + 44, h + 44, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(226,199,146,.25)'; ctx.lineWidth = 2;
      roundedRect(ctx, x - 10, y - 10, w + 20, h + 20, 6); ctx.stroke();
    } else if (id === 'hotel') {
      ctx.fillStyle = '#211d27';
      roundedRect(ctx, x - 20, y - 20, w + 40, h + 40, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(211,171,109,.32)'; ctx.lineWidth = 2;
      roundedRect(ctx, x - 9, y - 9, w + 18, h + 18, 3); ctx.stroke();
    } else {
      ctx.fillStyle = '#2c2924';
      roundedRect(ctx, x - 22, y - 22, w + 44, h + 44, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(215,182,106,.25)'; ctx.lineWidth = 2;
      roundedRect(ctx, x - 9, y - 9, w + 18, h + 18, 2); ctx.stroke();
    }
  };

  // ------------------------------------------------------------------ floors
  VC.Level.prototype.renderRoomFloor = function (ctx, room) {
    const pal = this.theme.palette;
    const x = room.x * T, y = room.y * T, w = room.w * T, h = room.h * T;
    const rng = new U.RNG(this.seed + '·floor' + room.id);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const style = room.floor;
    const baseMap = {
      marble: [pal.marble, pal.marbleAlt], wood: [pal.wood, pal.woodAlt],
      carpet: [pal.carpet, pal.carpetAlt], tile: [pal.tile, pal.tileAlt],
      concrete: [pal.concrete, shade(pal.concrete, -8)], metal: [pal.metal, shade(pal.metal, 9)],
      stone: [pal.stone, shade(pal.stone, -8)]
    };
    const [base, alt] = baseMap[style] || baseMap.concrete;
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    if (style === 'wood') {
      for (let yy = y; yy < y + h; yy += 26) {
        ctx.fillStyle = (Math.floor((yy - y) / 26) % 2) ? rgba(alt, 0.75) : 'rgba(0,0,0,.035)';
        ctx.fillRect(x, yy, w, 1.5);
        for (let xx = x + ((Math.floor((yy - y) / 26) % 2) ? 50 : 0); xx < x + w; xx += 210) {
          ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(xx, yy, 1, 26);
        }
      }
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = `rgba(255,235,195,${rng.range(0.02, 0.06)})`;
        const xx = rng.range(x, x + w), yy = rng.range(y, y + h);
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 18, yy + 1, xx + 38, yy - 1); ctx.stroke();
      }
    } else if (style === 'marble') {
      for (let xx = x; xx < x + w; xx += 72) {
        for (let yy = y; yy < y + h; yy += 72) {
          const tone = ((xx / 72 + yy / 72) % 2) ? 0.075 : 0;
          if (tone) { ctx.fillStyle = `rgba(255,255,255,${tone})`; ctx.fillRect(xx, yy, 72, 72); }
          ctx.strokeStyle = 'rgba(0,0,0,.075)'; ctx.strokeRect(xx, yy, 72, 72);
        }
      }
      ctx.strokeStyle = rgba(pal.marbleVein, 0.34); ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        let xx = rng.range(x, x + w), yy = rng.range(y, y + h);
        ctx.beginPath(); ctx.moveTo(xx, yy);
        for (let j = 0; j < 5; j++) { xx += rng.range(8, 28); yy += rng.range(-12, 12); ctx.lineTo(xx, yy); }
        ctx.stroke();
      }
    } else if (style === 'carpet') {
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rng.range(0.005, 0.022)})`;
        ctx.fillRect(rng.range(x, x + w), rng.range(y, y + h), rng.range(1, 3), rng.range(1, 3));
      }
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
      for (let yy = y + 22; yy < y + h; yy += 44) {
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      }
    } else if (style === 'tile') {
      const ts = 40;
      for (let yy = y; yy < y + h; yy += ts) {
        for (let xx = x; xx < x + w; xx += ts) {
          const odd = (Math.floor((xx - x) / ts) + Math.floor((yy - y) / ts)) % 2;
          if (odd) { ctx.fillStyle = rgba(alt, 0.8); ctx.fillRect(xx, yy, ts, ts); }
          ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.strokeRect(xx, yy, ts, ts);
        }
      }
    } else if (style === 'metal') {
      for (let yy = y; yy < y + h; yy += 64) {
        for (let xx = x; xx < x + w; xx += 64) {
          ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.strokeRect(xx, yy, 64, 64);
          ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(xx + 3, yy + 3, 58, 2);
          ctx.fillStyle = 'rgba(180,200,205,.22)';
          ctx.beginPath(); ctx.arc(xx + 8, yy + 8, 1.2, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(xx + 56, yy + 56, 1.2, 0, U.TAU); ctx.fill();
        }
      }
    } else if (style === 'stone') {
      for (let yy = y; yy < y + h; yy += 48) {
        const offset = (Math.floor((yy - y) / 48) % 2) * 26;
        for (let xx = x - offset; xx < x + w; xx += 52) {
          ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.strokeRect(xx, yy, 52, 48);
          ctx.fillStyle = `rgba(255,255,255,${rng.range(0.005, 0.025)})`;
          ctx.fillRect(xx + 2, yy + 2, 48, 44);
        }
      }
    } else {
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rng.range(0.01, 0.045)})`;
        ctx.fillRect(rng.range(x, x + w), rng.range(y, y + h), rng.range(1, 4), rng.range(1, 2));
      }
      ctx.strokeStyle = 'rgba(0,0,0,.12)';
      for (let i = 0; i < 3; i++) {
        let xx = rng.range(x, x + w), yy = rng.range(y, y + h);
        ctx.beginPath(); ctx.moveTo(xx, yy);
        for (let j = 0; j < 3; j++) { xx += rng.range(-16, 20); yy += rng.range(8, 22); ctx.lineTo(xx, yy); }
        ctx.stroke();
      }
    }

    // Room edge trim.
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = rgba(pal.accent, 0.07); ctx.lineWidth = 1;
    ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
    ctx.restore();
  };

  VC.Level.prototype.renderCorridor = function (ctx) {
    const pal = this.theme.palette;
    const x = (this.bx + 2) * T, y = this.cy * T;
    const w = (this.bw - 4) * T, h = T * 3;
    const rng = new U.RNG(this.seed + '·corridor');
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = pal.corridor; ctx.fillRect(x, y, w, h);
    if (this.theme.id === 'plane') {
      // A central champagne runner.
      ctx.fillStyle = 'rgba(111,72,68,.8)'; ctx.fillRect(x, y + 37, w, h - 74);
      ctx.strokeStyle = 'rgba(226,194,128,.25)';
      ctx.beginPath(); ctx.moveTo(x, y + 38); ctx.lineTo(x + w, y + 38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h - 38); ctx.lineTo(x + w, y + h - 38); ctx.stroke();
    } else {
      // Long polished planks with a faint runner.
      ctx.fillStyle = pal.corridorAlt;
      ctx.fillRect(x, y + 19, w, h - 38);
      ctx.strokeStyle = 'rgba(0,0,0,.14)';
      for (let xx = x; xx < x + w; xx += 118) {
        ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx - 18, y + h); ctx.stroke();
      }
      ctx.strokeStyle = rgba(pal.accent, 0.2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.lineTo(x + w, y + 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h - 15); ctx.lineTo(x + w, y + h - 15); ctx.stroke();
    }
    for (let i = 0; i < 55; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rng.range(0.004, 0.02)})`;
      ctx.fillRect(rng.range(x, x + w), rng.range(y, y + h), rng.range(1, 4), 1);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------------- walls
  VC.Level.prototype.renderWallDetails = function (ctx) {
    const pal = this.theme.palette;
    const rng = new U.RNG(this.seed + '·walls');
    for (let ty = this.by; ty < this.by + this.bh; ty++) {
      for (let tx = this.bx; tx < this.bx + this.bw; tx++) {
        if (this.tileAt(tx, ty) > 0) continue;
        const x = tx * T, y = ty * T;
        const up = this.isFloorTile(tx, ty - 1);
        const down = this.isFloorTile(tx, ty + 1);
        const left = this.isFloorTile(tx - 1, ty);
        const right = this.isFloorTile(tx + 1, ty);
        if (!up && !down && !left && !right) continue;
        // Wall body and subtle stone/panel texture.
        ctx.fillStyle = rng.chance(0.5) ? pal.wall : shade(pal.wall, 3);
        ctx.fillRect(x, y, T, T);
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        ctx.fillStyle = rgba(pal.wallTop, 0.5);
        if (down) ctx.fillRect(x, y + T - 4, T, 4);
        if (up) ctx.fillRect(x, y, T, 3);
        if (right) ctx.fillRect(x + T - 3, y, 3, T);
        if (left) ctx.fillRect(x, y, 3, T);
        // Soft shadow cast onto the adjacent floor.
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#000';
        if (down) ctx.fillRect(x, y + T, T, 7);
        if (up) ctx.fillRect(x, y - 7, T, 7);
        if (right) ctx.fillRect(x + T, y, 7, T);
        if (left) ctx.fillRect(x - 7, y, 7, T);
        ctx.restore();
      }
    }
    // Strong perimeter frame.
    ctx.strokeStyle = rgba(pal.trim, 0.5); ctx.lineWidth = 3;
    ctx.strokeRect(this.bx * T + 2, this.by * T + 2, this.bw * T - 4, this.bh * T - 4);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
    ctx.strokeRect(this.bx * T + 6, this.by * T + 6, this.bw * T - 12, this.bh * T - 12);
  };

  VC.Level.prototype.renderWindows = function (ctx) {
    const pal = this.theme.palette;
    const id = this.theme.id;
    const topY = this.by * T + 9;
    const botY = (this.by + this.bh - 1) * T + 9;
    for (let x = (this.bx + 2) * T + 28; x < (this.bx + this.bw - 2) * T - 20; x += 118) {
      if (id === 'ship') {
        ctx.fillStyle = 'rgba(113,176,196,.35)'; ctx.strokeStyle = 'rgba(225,233,226,.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, topY + 11, 8, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, botY + 11, 8, 0, U.TAU); ctx.fill(); ctx.stroke();
      } else if (id === 'plane') {
        ctx.fillStyle = 'rgba(145,191,219,.42)'; ctx.strokeStyle = 'rgba(240,240,233,.4)'; ctx.lineWidth = 1.5;
        ellipse(ctx, x, topY + 11, 13, 6); ctx.fill(); ctx.stroke();
        ellipse(ctx, x, botY + 11, 13, 6); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = id === 'hotel' ? 'rgba(242,194,113,.16)' : 'rgba(111,154,173,.26)';
        ctx.fillRect(x, topY, 58, 19);
        ctx.fillRect(x, botY, 58, 19);
        ctx.strokeStyle = rgba(pal.trim, 0.35); ctx.lineWidth = 1;
        ctx.strokeRect(x, topY, 58, 19);
        ctx.strokeRect(x, botY, 58, 19);
      }
    }
  };

  VC.Level.prototype.renderDoors = function (ctx) {
    const pal = this.theme.palette;
    for (const d of this.doors) {
      const x = d.x * T, y = d.y * T;
      ctx.save();
      // Door mat / threshold.
      const grad = ctx.createLinearGradient(x, y, x, y + T);
      grad.addColorStop(0, rgba(pal.accent, 0.45));
      grad.addColorStop(0.5, 'rgba(10,11,14,.9)');
      grad.addColorStop(1, rgba(pal.accent, 0.28));
      ctx.fillStyle = grad;
      ctx.fillRect(x + 3, y + 10, T * 2 - 6, T - 20);
      ctx.strokeStyle = rgba(pal.accent, 0.5); ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.5, y + 10.5, T * 2 - 7, T - 21);
      // Frame posts.
      ctx.fillStyle = pal.wallTop;
      ctx.fillRect(x - 3, y + 2, 6, T - 4);
      ctx.fillRect(x + T * 2 - 3, y + 2, 6, T - 4);
      ctx.fillStyle = rgba(pal.accent, 0.4);
      ctx.fillRect(x + 1, y + 7, 2, 26);
      ctx.fillRect(x + T * 2 - 3, y + 7, 2, 26);
      ctx.restore();
    }
  };

  VC.Level.prototype.renderLights = function (ctx) {
    const pal = this.theme.palette;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const room of this.rooms) {
      const radius = Math.min(room.w * T, room.h * T) * 0.48;
      const g = ctx.createRadialGradient(room.center.x, room.center.y, 4, room.center.x, room.center.y, radius);
      g.addColorStop(0, rgba(pal.ambient, room.type === 'security' ? 0.06 : 0.105));
      g.addColorStop(0.6, rgba(pal.ambient, 0.035));
      g.addColorStop(1, rgba(pal.ambient, 0));
      ctx.fillStyle = g;
      ctx.fillRect(room.x * T, room.y * T, room.w * T, room.h * T);
    }
    const total = (this.bw - 4) * T;
    for (let i = 0; i < 10; i++) {
      const x = (this.bx + 2) * T + (i + 0.5) * total / 10;
      const y = (this.cy + 1.5) * T;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 82);
      g.addColorStop(0, rgba(pal.ambient, 0.1)); g.addColorStop(1, rgba(pal.ambient, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 82, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
    // Fixtures.
    for (const room of this.rooms) {
      ctx.fillStyle = rgba(pal.ambient, 0.55);
      ctx.beginPath(); ctx.arc(room.center.x, room.y * T + 16, 2.5, 0, U.TAU); ctx.fill();
    }
  };

  VC.Level.prototype.renderRoomLabels = function (ctx) {
    const pal = this.theme.palette;
    for (const room of this.rooms) {
      const x = room.x * T, y = room.y * T, w = room.w * T;
      const zone = VC.ZONES[room.zone];
      const label = room.name.toUpperCase();
      const size = room.w < 10 ? 9 : 11;
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 6, y + 6, w - 12, 58); ctx.clip();
      ctx.font = `600 ${size}px "Avenir Next", "Segoe UI", sans-serif`;
      try { ctx.letterSpacing = '1.6px'; } catch (e) {}
      ctx.textAlign = 'center';
      const lx = x + w / 2, ly = y + 27;
      ctx.fillStyle = 'rgba(4,5,8,.52)';
      ctx.fillText(label, lx + 1, ly + 1);
      ctx.fillStyle = 'rgba(238,231,213,.62)';
      ctx.fillText(label, lx, ly);
      ctx.fillStyle = rgba(zone.color, 0.75);
      ctx.fillRect(lx - 18, ly + 6, 36, 1.4);
      ctx.font = '500 7px "SFMono-Regular", Menlo, monospace';
      try { ctx.letterSpacing = '1.3px'; } catch (e) {}
      ctx.fillStyle = rgba(zone.color, 0.64);
      ctx.fillText(zone.label, lx, ly + 16);
      if (room.targetRoom) {
        ctx.save();
        ctx.translate(x + w - 23, y + 22);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = pal.accent; ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
      ctx.restore();
    }
  };

  // --------------------------------------------------------------- furniture
  function furnitureShadow(ctx, f) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    roundedRect(ctx, f.x + 6, f.y + 8, f.w - 3, f.h, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    roundedRect(ctx, f.x + 3, f.y + 5, f.w - 2, f.h, 9);
    ctx.fill();
    ctx.restore();
  }

  function woodTop(ctx, w, h, pal, radius) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(pal.wood, 10)); g.addColorStop(1, pal.woodAlt);
    ctx.fillStyle = g; roundedRect(ctx, 0, 0, w, h, radius || 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,170,.08)'; ctx.lineWidth = 1;
    roundedRect(ctx, 3, 3, w - 6, h - 6, (radius || 4) * 0.6); ctx.stroke();
  }

  function drawChairs(ctx, w, h, count, pal) {
    const cw = 25, ch = 21;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = w * t - cw / 2;
      ctx.fillStyle = pal.woodAlt;
      roundedRect(ctx, x, -ch - 3, cw, ch, 4); ctx.fill();
      roundedRect(ctx, x, h + 3, cw, ch, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      roundedRect(ctx, x + 3, -ch + 1, cw - 6, 5, 2); ctx.fill();
      roundedRect(ctx, x + 3, h + 7, cw - 6, 5, 2); ctx.fill();
    }
  }

  function drawFurnitureItem(ctx, f, pal, theme) {
    if (f.type === 'rug') {
      ctx.save();
      ctx.fillStyle = f.tint || 'rgba(42,31,32,.65)';
      roundedRect(ctx, f.x, f.y, f.w, f.h, 10); ctx.fill();
      ctx.strokeStyle = rgba(pal.accent, 0.24); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
      roundedRect(ctx, f.x + 10, f.y + 10, f.w - 20, f.h - 20, 7); ctx.stroke();
      ctx.restore();
      return;
    }
    if (f.type === 'danceFloor') return;

    furnitureShadow(ctx, f);
    ctx.save();
    ctx.translate(f.x, f.y);
    const w = f.w, h = f.h;
    switch (f.type) {
      case 'diningTable': {
        drawChairs(ctx, w, h, Math.max(2, Math.round(w / 105)), pal);
        woodTop(ctx, w, h, pal, 12);
        ctx.fillStyle = 'rgba(255,229,184,.08)';
        roundedRect(ctx, 7, 7, w - 14, h - 14, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)';
        ctx.beginPath(); ctx.moveTo(8, h / 2); ctx.lineTo(w - 8, h / 2); ctx.stroke();
        break;
      }
      case 'table': {
        woodTop(ctx, w, h, pal, 7);
        ctx.fillStyle = 'rgba(255,255,255,.04)';
        roundedRect(ctx, 5, 5, w - 10, h - 10, 5); ctx.fill();
        break;
      }
      case 'coffeeTable': {
        ctx.fillStyle = '#211c1a'; roundedRect(ctx, 0, 0, w, h, 6); ctx.fill();
        ctx.strokeStyle = rgba(pal.accent, 0.25); ctx.stroke();
        ctx.fillStyle = 'rgba(95,130,143,.18)'; roundedRect(ctx, 7, 7, w - 14, h - 14, 4); ctx.fill();
        break;
      }
      case 'sofa': {
        ctx.fillStyle = shade(pal.woodAlt, 2);
        roundedRect(ctx, 0, 0, w, h, 12); ctx.fill();
        ctx.fillStyle = f.tint || '#4f4a45';
        roundedRect(ctx, 5, 10, w - 10, h - 16, 9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        roundedRect(ctx, 12, 17, w * 0.38 - 8, h - 30, 6); ctx.fill();
        roundedRect(ctx, w * 0.5 + 2, 17, w * 0.38 - 8, h - 30, 6); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(w / 2 - 1, 15, 2, h - 25);
        break;
      }
      case 'armchair': {
        ctx.fillStyle = '#37312e'; roundedRect(ctx, 0, 0, w, h, 10); ctx.fill();
        ctx.fillStyle = '#514b44'; roundedRect(ctx, 4, 9, w - 8, h - 13, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.06)'; roundedRect(ctx, 10, 15, w - 20, h - 28, 5); ctx.fill();
        break;
      }
      case 'chair':
      case 'officeChair': {
        ctx.fillStyle = '#2e2c2a'; roundedRect(ctx, 0, 0, w, h, 7); ctx.fill();
        ctx.fillStyle = '#4b4640'; roundedRect(ctx, 4, 4, w - 8, h - 12, 5); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(w / 2 - 2, h - 10, 4, 9);
        break;
      }
      case 'counter': {
        ctx.fillStyle = shade(pal.woodAlt, -8); ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#d2c9b2';
        roundedRect(ctx, 0, 0, w, h * 0.48, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        ctx.strokeStyle = 'rgba(0,0,0,.18)';
        for (let x = 42; x < w; x += 46) ctx.strokeRect(x, h * 0.53, 34, h * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        for (let x = 58; x < w; x += 46) ctx.fillRect(x, h * 0.68, 8, 2);
        break;
      }
      case 'island': {
        ctx.fillStyle = shade(pal.woodAlt, -10); roundedRect(ctx, 0, 0, w, h, 4); ctx.fill();
        ctx.fillStyle = '#d1c8b0'; roundedRect(ctx, -4, -3, w + 8, h + 6, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.24)'; ctx.fillRect(10, 4, w - 20, 3);
        break;
      }
      case 'stove': {
        ctx.fillStyle = '#26292a'; roundedRect(ctx, 0, 0, w, h, 4); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.stroke();
        ctx.fillStyle = '#151819';
        for (let i = 0; i < 4; i++) {
          const bx = 18 + (i % 2) * w * 0.46, by = 13 + Math.floor(i / 2) * h * 0.45;
          ctx.beginPath(); ctx.arc(bx, by, 8, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(195,115,82,.4)'; ctx.stroke();
        }
        break;
      }
      case 'sink': {
        ctx.fillStyle = '#c9c2b0'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.fillStyle = '#6d7b7c'; roundedRect(ctx, 8, 10, w - 16, h - 20, 7); ctx.fill();
        ctx.fillStyle = '#aab4b0'; ctx.fillRect(w / 2 - 2, 3, 4, 13);
        ctx.beginPath(); ctx.arc(w / 2, 16, 6, 0, U.TAU); ctx.strokeStyle = '#aab4b0'; ctx.stroke();
        break;
      }
      case 'fridge':
      case 'fridgeTall': {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#7e8787'); g.addColorStop(0.55, '#b3bbb8'); g.addColorStop(1, '#697270');
        ctx.fillStyle = g; roundedRect(ctx, 0, 0, w, h, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.22)';
        ctx.beginPath(); ctx.moveTo(0, h * 0.38); ctx.lineTo(w, h * 0.38); ctx.stroke();
        ctx.fillStyle = '#3e4645'; ctx.fillRect(w - 14, h * 0.16, 3, h * 0.16);
        ctx.fillRect(w - 14, h * 0.49, 3, h * 0.2);
        break;
      }
      case 'cabinet': {
        woodTop(ctx, w, h, pal, 3);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(w / 2, h - 4); ctx.stroke();
        ctx.fillStyle = rgba(pal.accent, 0.5);
        ctx.fillRect(w / 2 - 9, h / 2 - 1, 5, 2); ctx.fillRect(w / 2 + 4, h / 2 - 1, 5, 2);
        break;
      }
      case 'wardrobe': {
        ctx.fillStyle = shade(pal.woodAlt, -5); roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,165,.12)'; ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.moveTo(w / 2, 5); ctx.lineTo(w / 2, h - 5); ctx.stroke();
        ctx.fillStyle = rgba(pal.accent, 0.65);
        ctx.fillRect(w / 2 - 8, h / 2, 4, 2); ctx.fillRect(w / 2 + 4, h / 2, 4, 2);
        break;
      }
      case 'shelf':
      case 'barShelf': {
        ctx.fillStyle = shade(pal.woodAlt, -10); ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        const vertical = h > w;
        const n = Math.max(2, Math.floor((vertical ? h : w) / (vertical ? 44 : 22)));
        for (let i = 0; i < n; i++) {
          if (vertical) {
            ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(4, i * h / n, w - 8, 2);
            const bw = 7 + (i % 3) * 3;
            ctx.fillStyle = i % 2 ? '#8c6d48' : '#c3a76b';
            ctx.fillRect(9, i * h / n + 8, bw, h / n - 13);
            ctx.fillStyle = '#5b7a78'; ctx.fillRect(w - 17, i * h / n + 10, 6, h / n - 17);
          } else {
            ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(i * w / n, 4, 2, h - 8);
            ctx.fillStyle = i % 2 ? '#7e5f3f' : '#b79761';
            ctx.fillRect(i * w / n + 7, 9, w / n - 15, h - 18);
          }
        }
        break;
      }
      case 'wineRack': {
        ctx.fillStyle = '#2a211b'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        for (let yy = 8; yy < h - 8; yy += 22) {
          for (let xx = 7; xx < w - 7; xx += 17) {
            ctx.fillStyle = 'rgba(83,40,45,.85)'; ctx.beginPath(); ctx.arc(xx + 3, yy + 5, 3.5, 0, U.TAU); ctx.fill();
          }
        }
        break;
      }
      case 'desk': {
        woodTop(ctx, w, h, pal, 4);
        ctx.fillStyle = '#1e2224'; roundedRect(ctx, w * 0.2, 9, w * 0.34, h * 0.42, 2); ctx.fill();
        ctx.fillStyle = 'rgba(99,148,166,.3)'; roundedRect(ctx, w * 0.21, 11, w * 0.32, h * 0.3, 1); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(w * 0.37, h * 0.51, 5, 8);
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(w * 0.72, 9, 28, h - 20);
        break;
      }
      case 'monitorBank': {
        ctx.fillStyle = '#161b1f'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.strokeStyle = '#343d42'; ctx.stroke();
        const cols = Math.max(2, Math.floor(w / 60));
        for (let i = 0; i < cols; i++) {
          const sx = 8 + i * (w - 16) / cols;
          ctx.fillStyle = '#0a1519'; ctx.fillRect(sx, 10, (w - 16) / cols - 8, h - 26);
          ctx.fillStyle = 'rgba(92,164,184,.35)'; ctx.fillRect(sx + 4, 15, (w - 16) / cols - 16, h - 40);
          ctx.strokeStyle = 'rgba(109,190,206,.18)';
          for (let l = 0; l < 4; l++) {
            ctx.beginPath(); ctx.moveTo(sx + 5, 22 + l * 8); ctx.lineTo(sx + (w - 16) / cols - 12, 22 + l * 8); ctx.stroke();
          }
        }
        break;
      }
      case 'serverRack': {
        ctx.fillStyle = '#151a1d'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.strokeStyle = '#333d42'; ctx.stroke();
        for (let yy = 8; yy < h - 8; yy += 16) {
          ctx.fillStyle = '#242c30'; ctx.fillRect(6, yy, w - 12, 10);
          ctx.fillStyle = yy % 32 ? '#77b48e' : '#c7805c'; ctx.fillRect(w - 15, yy + 3, 2, 2);
          ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(9, yy + 3, w * 0.4, 2);
        }
        break;
      }
      case 'locker': {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#4b5658'); g.addColorStop(0.5, '#758083'); g.addColorStop(1, '#414b4d');
        ctx.fillStyle = g; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(w / 2, 4, 1, h - 8);
        ctx.fillStyle = 'rgba(0,0,0,.24)';
        for (let i = 0; i < 4; i++) ctx.fillRect(8, 10 + i * 5, w / 2 - 17, 2);
        for (let i = 0; i < 4; i++) ctx.fillRect(w / 2 + 9, 10 + i * 5, w / 2 - 17, 2);
        ctx.fillStyle = '#c9b98e'; ctx.fillRect(w / 2 - 7, h / 2, 3, 10); ctx.fillRect(w / 2 + 5, h / 2, 3, 10);
        break;
      }
      case 'bed':
      case 'bunk': {
        ctx.fillStyle = '#292522'; roundedRect(ctx, 0, 0, w, h, 6); ctx.fill();
        const vertical = h >= w;
        if (vertical) {
          ctx.fillStyle = '#d3cdbd'; roundedRect(ctx, 7, 11, w - 14, h - 18, 5); ctx.fill();
          ctx.fillStyle = '#b8ada1'; roundedRect(ctx, 9, 12, w - 18, 34, 4); ctx.fill();
          ctx.fillStyle = '#d9d2c2'; roundedRect(ctx, 14, 17, w * 0.36, 24, 6); ctx.fill();
          roundedRect(ctx, w * 0.53, 17, w * 0.32, 24, 6); ctx.fill();
          ctx.fillStyle = f.tint || '#4e5860'; roundedRect(ctx, 8, h * 0.4, w - 16, h * 0.55, 4); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.07)';
          for (let yy = h * 0.45; yy < h - 10; yy += 18) {
            ctx.beginPath(); ctx.moveTo(10, yy); ctx.lineTo(w - 10, yy); ctx.stroke();
          }
        } else {
          ctx.fillStyle = '#d3cdbd'; roundedRect(ctx, 8, 8, w - 16, h - 16, 5); ctx.fill();
          ctx.fillStyle = '#b8ada1'; roundedRect(ctx, 9, 9, 34, h - 18, 4); ctx.fill();
          ctx.fillStyle = '#d9d2c2'; roundedRect(ctx, 14, 15, 24, h * 0.33, 6); ctx.fill();
          roundedRect(ctx, 14, h * 0.53, 24, h * 0.32, 6); ctx.fill();
          ctx.fillStyle = f.tint || '#4e5860'; roundedRect(ctx, w * 0.4, 8, w * 0.56, h - 16, 4); ctx.fill();
        }
        break;
      }
      case 'nightstand': {
        woodTop(ctx, w, h, pal, 3);
        ctx.fillStyle = '#1e1c1b'; ctx.fillRect(8, h * 0.2, w - 16, 4);
        ctx.fillStyle = rgba(pal.accent, 0.6); ctx.beginPath(); ctx.arc(w / 2, h * 0.66, 2.4, 0, U.TAU); ctx.fill();
        break;
      }
      case 'dresser': {
        woodTop(ctx, w, h, pal, 3);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        ctx.fillStyle = rgba(pal.accent, 0.55);
        ctx.fillRect(w * 0.28, h * 0.24, 12, 2); ctx.fillRect(w * 0.62, h * 0.74, 12, 2);
        break;
      }
      case 'safe': {
        ctx.fillStyle = '#22272a'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.strokeStyle = '#4a5457'; ctx.stroke();
        ctx.strokeStyle = 'rgba(200,184,141,.5)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.19, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(200,184,141,.55)';
        ctx.fillRect(w / 2 - 2, h / 2 - 12, 4, 24); ctx.fillRect(w / 2 - 12, h / 2 - 2, 24, 4);
        break;
      }
      case 'crate': {
        ctx.fillStyle = f.tint || '#775334'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(42,28,17,.75)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(w - 4, h - 4); ctx.moveTo(w - 4, 4); ctx.lineTo(4, h - 4); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,160,.12)'; ctx.lineWidth = 1;
        for (let i = 12; i < h; i += 16) { ctx.beginPath(); ctx.moveTo(4, i); ctx.lineTo(w - 4, i); ctx.stroke(); }
        break;
      }
      case 'barrel': {
        ctx.fillStyle = '#5d422b'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#2d302f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.37, 0, U.TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(214,177,112,.22)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.25, 0, U.TAU); ctx.stroke();
        break;
      }
      case 'car': {
        const g = ctx.createLinearGradient(0, 0, w, h);
        const tc = f.tint || '#5c3531';
        g.addColorStop(0, shade(tc, 20)); g.addColorStop(0.5, tc); g.addColorStop(1, shade(tc, -18));
        ctx.fillStyle = g; roundedRect(ctx, 0, 0, w, h, 30); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#11181e'; roundedRect(ctx, 13, h * 0.19, w - 26, h * 0.15, 10); ctx.fill();
        ctx.fillStyle = 'rgba(80,110,125,.3)'; roundedRect(ctx, 17, h * 0.2, w - 34, h * 0.11, 8); ctx.fill();
        ctx.fillStyle = shade(tc, -12); roundedRect(ctx, 16, h * 0.38, w - 32, h * 0.25, 10); ctx.fill();
        ctx.fillStyle = '#151c22'; roundedRect(ctx, 14, h * 0.66, w - 28, h * 0.12, 9); ctx.fill();
        ctx.fillStyle = 'rgba(104,139,152,.22)'; roundedRect(ctx, 18, h * 0.67, w - 36, h * 0.075, 7); ctx.fill();
        ctx.fillStyle = '#f2d18c'; ctx.fillRect(16, 5, 24, 6); ctx.fillRect(w - 40, 5, 24, 6);
        ctx.fillStyle = '#b94b48'; ctx.fillRect(16, h - 11, 24, 6); ctx.fillRect(w - 40, h - 11, 24, 6);
        break;
      }
      case 'workbench': {
        woodTop(ctx, w, h, pal, 3);
        ctx.fillStyle = '#34312d'; ctx.fillRect(8, 8, w * 0.25, h - 16);
        ctx.fillStyle = '#a23f3d'; ctx.fillRect(w * 0.45, 11, 18, 7);
        ctx.fillStyle = '#b7a27a'; ctx.fillRect(w * 0.65, 11, 43, 3);
        ctx.fillStyle = '#8f9c9d'; ctx.fillRect(w * 0.68, 16, 26, 8);
        break;
      }
      case 'toolRack': {
        ctx.fillStyle = '#3b3530'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        ctx.strokeStyle = '#a9b2b1'; ctx.lineWidth = 2;
        for (let x = 14; x < w - 10; x += 27) {
          ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, h - 6); ctx.stroke();
          ctx.fillStyle = '#b7a45e'; ctx.fillRect(x - 4, 2, 8, 6);
        }
        break;
      }
      case 'washer': {
        ctx.fillStyle = '#c8cac4'; roundedRect(ctx, 0, 0, w, h, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.26)'; ctx.stroke();
        ctx.fillStyle = '#2b3438'; ctx.beginPath(); ctx.arc(w / 2, h * 0.58, w * 0.28, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(180,212,218,.4)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#7e8787'; ctx.fillRect(8, 8, w - 16, 8);
        break;
      }
      case 'toilet': {
        ctx.fillStyle = '#d8d5ca'; roundedRect(ctx, w * 0.2, 0, w * 0.6, h * 0.3, 3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.61, w * 0.3, h * 0.28, 0, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.stroke();
        break;
      }
      case 'stall': {
        ctx.fillStyle = '#8a9290'; ctx.fillRect(0, 0, 8, h);
        ctx.fillRect(w - 8, 0, 8, h);
        ctx.fillStyle = 'rgba(210,217,214,.35)'; ctx.fillRect(w * 0.5, 4, 3, h - 12);
        ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.strokeRect(0, 0, w, h);
        break;
      }
      case 'bathtub': {
        ctx.fillStyle = '#d6d3c9'; roundedRect(ctx, 0, 0, w, h, 16); ctx.fill();
        ctx.fillStyle = '#7e9ba1'; roundedRect(ctx, 9, 9, w - 18, h - 18, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(180,224,230,.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#b7b8b0'; ctx.fillRect(w - 19, 9, 5, 18);
        break;
      }
      case 'plant': {
        ctx.fillStyle = '#70513a'; roundedRect(ctx, w * 0.25, h * 0.6, w * 0.5, h * 0.35, 4); ctx.fill();
        const leaf = f.tint || '#497055';
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI * 0.5 + (i - 3) * 0.42;
          const lx = w / 2 + Math.cos(a) * w * 0.27;
          const ly = h * 0.55 + Math.sin(a) * h * 0.27;
          ellipse(ctx, lx, ly, w * 0.12, h * 0.055, a); ctx.fillStyle = leaf; ctx.fill();
        }
        ctx.fillStyle = shade(leaf, 18); ellipse(ctx, w / 2, h * 0.38, w * 0.13, h * 0.1); ctx.fill();
        break;
      }
      case 'planter': {
        ctx.fillStyle = '#5e4a38'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.fillStyle = '#3e604a'; roundedRect(ctx, 4, 3, w - 8, h - 6, 3); ctx.fill();
        for (let x = 10; x < w - 8; x += 15) {
          ctx.fillStyle = x % 30 ? '#51785a' : '#315440';
          ellipse(ctx, x, h * 0.45, 7, 11); ctx.fill();
        }
        break;
      }
      case 'bench': {
        woodTop(ctx, w, h, pal, 4);
        ctx.strokeStyle = 'rgba(0,0,0,.23)';
        for (let x = 12; x < w; x += 26) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, h - 4); ctx.stroke(); }
        break;
      }
      case 'fountain': {
        ctx.fillStyle = '#6b665a'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#4f7e8a'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(202,238,241,.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#878276'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.13, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(211,239,242,.5)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.07, 0, U.TAU); ctx.fill();
        break;
      }
      case 'tree': {
        drawTree(ctx, w / 2, h / 2, Math.min(w, h) * 0.48, '#315941');
        break;
      }
      case 'hedge': {
        ctx.fillStyle = '#294e39'; roundedRect(ctx, 0, 0, w, h, 10); ctx.fill();
        for (let x = 6; x < w - 4; x += 12) {
          ctx.fillStyle = x % 24 ? '#376248' : '#234632';
          ctx.beginPath(); ctx.arc(x, h / 2 + Math.sin(x) * 4, 9, 0, U.TAU); ctx.fill();
        }
        break;
      }
      case 'piano': {
        ctx.fillStyle = '#18191b';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(w * 0.7, 0); ctx.quadraticCurveTo(w, h * 0.15, w * 0.76, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2b2c2f'; roundedRect(ctx, 4, 4, w * 0.88, h - 8, 5); ctx.fill();
        ctx.fillStyle = '#d8d2c2'; ctx.fillRect(w * 0.15, h * 0.17, w * 0.47, 8);
        ctx.fillStyle = '#050505'; for (let x = w * 0.16; x < w * 0.61; x += 9) ctx.fillRect(x, h * 0.17, 3, 9);
        break;
      }
      case 'poolTable': {
        ctx.fillStyle = '#3b2b20'; roundedRect(ctx, 0, 0, w, h, 16); ctx.fill();
        ctx.fillStyle = '#236446'; roundedRect(ctx, 9, 9, w - 18, h - 18, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        ctx.fillStyle = '#e9e3d4';
        for (const [px, py] of [[13, 13], [w - 13, 13], [13, h - 13], [w - 13, h - 13], [w / 2, 11], [w / 2, h - 11]]) {
          ctx.beginPath(); ctx.arc(px, py, 4, 0, U.TAU); ctx.fill();
        }
        ctx.fillStyle = '#f1e9d1'; ctx.beginPath(); ctx.arc(w * 0.42, h * 0.5, 4.5, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#8c3c3a'; ctx.beginPath(); ctx.arc(w * 0.52, h * 0.44, 3.5, 0, U.TAU); ctx.fill();
        break;
      }
      case 'stage': {
        ctx.fillStyle = '#2a2023'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(216,184,112,.35)'; ctx.fillRect(0, h - 7, w, 7);
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        break;
      }
      case 'barCounter': {
        ctx.fillStyle = shade(pal.woodAlt, -12); roundedRect(ctx, 0, 0, w, h, 4); ctx.fill();
        ctx.fillStyle = '#bca67a'; roundedRect(ctx, -3, -4, w + 6, h * 0.42, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(8, 2, w - 16, 2);
        for (let x = 16; x < w - 8; x += 39) {
          ctx.fillStyle = '#33554a'; ctx.fillRect(x, 5, 5, 8);
          ctx.fillStyle = '#805348'; ctx.fillRect(x + 8, 6, 4, 7);
        }
        break;
      }
      case 'console': {
        ctx.fillStyle = '#22292d'; roundedRect(ctx, 0, 0, w, h, 4); ctx.fill();
        ctx.strokeStyle = '#4c5c61'; ctx.stroke();
        ctx.fillStyle = 'rgba(74,135,151,.35)'; ctx.fillRect(7, 7, w - 14, h - 14);
        ctx.strokeStyle = 'rgba(143,206,217,.26)';
        for (let x = 14; x < w - 8; x += 17) {
          ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, h - 10); ctx.stroke();
        }
        break;
      }
      case 'captainChair': {
        ctx.fillStyle = '#2d2725'; roundedRect(ctx, 0, 0, w, h, 10); ctx.fill();
        ctx.fillStyle = '#4a3934'; roundedRect(ctx, 6, 8, w - 12, h - 18, 8); ctx.fill();
        ctx.fillStyle = '#1b1918'; ctx.fillRect(w / 2 - 3, h - 11, 6, 9);
        break;
      }
      case 'engine': {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#3d4a4e'); g.addColorStop(0.5, '#58666a'); g.addColorStop(1, '#303b3f');
        ctx.fillStyle = g; roundedRect(ctx, 0, 0, w, h, 8); ctx.fill();
        ctx.strokeStyle = '#1f282b'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#252d30';
        for (let x = 18; x < w - 18; x += 44) {
          roundedRect(ctx, x, 14, 24, h - 28, 5); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(185,193,183,.2)';
        for (let y = 22; y < h - 18; y += 26) {
          ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(w - 8, y); ctx.stroke();
        }
        ctx.fillStyle = '#b2603b'; ctx.fillRect(w - 26, h * 0.3, 8, 22);
        break;
      }
      case 'pipes': {
        ctx.fillStyle = 'rgba(42,52,56,.8)'; ctx.fillRect(0, 0, w, h);
        for (let x = 12; x < w - 8; x += 24) {
          const g = ctx.createLinearGradient(x, 0, x + 10, 0);
          g.addColorStop(0, '#394a4e'); g.addColorStop(0.5, '#6d7b7d'); g.addColorStop(1, '#2d393c');
          ctx.fillStyle = g; ctx.fillRect(x, 0, 9, h);
          ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 11, 0, 3, h);
        }
        break;
      }
      case 'lounger': {
        ctx.fillStyle = '#c9c0ac'; roundedRect(ctx, 0, 0, w, h, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.2)';
        for (let y = 20; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke(); }
        ctx.fillStyle = '#c6b68f'; roundedRect(ctx, 5, 5, w - 10, 18, 5); ctx.fill();
        break;
      }
      case 'screen': {
        ctx.fillStyle = '#1b2024'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.fillStyle = 'rgba(86,145,158,.22)'; ctx.fillRect(5, 5, w - 10, h - 10);
        ctx.strokeStyle = 'rgba(194,220,219,.24)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        break;
      }
      case 'statue': {
        ctx.fillStyle = '#5e584d'; roundedRect(ctx, w * 0.18, h * 0.7, w * 0.64, h * 0.28, 2); ctx.fill();
        ctx.fillStyle = '#8b8373'; ellipse(ctx, w / 2, h * 0.4, w * 0.26, h * 0.3); ctx.fill();
        ctx.fillStyle = '#aaa18d'; ctx.beginPath(); ctx.arc(w / 2, h * 0.24, w * 0.13, 0, U.TAU); ctx.fill();
        break;
      }
      case 'tireStack': {
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = '#1d2224'; ctx.lineWidth = 13;
          ctx.beginPath(); ctx.arc(w / 2, h * 0.25 + i * h * 0.25, Math.min(w, h) * 0.25, 0, U.TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 2; ctx.stroke();
        }
        break;
      }
      case 'column': {
        ctx.fillStyle = '#a59b87'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, w * 0.22, h); ctx.fillRect(w * 0.78, 0, w * 0.22, h);
        ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(w * 0.35, 0, 3, h);
        break;
      }
      case 'vending': {
        ctx.fillStyle = '#252b2d'; roundedRect(ctx, 0, 0, w, h, 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,224,148,.22)'; ctx.fillRect(5, 5, w - 10, h * 0.56);
        for (let y = 14; y < h * 0.5; y += 18) {
          for (let x = 9; x < w - 8; x += 12) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, 6, 8); }
        }
        break;
      }
      default: {
        woodTop(ctx, w, h, pal, 5);
        ctx.fillStyle = 'rgba(255,255,255,.04)';
        roundedRect(ctx, 5, 5, w - 10, h - 10, 4); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTree(ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ellipse(ctx, x + 5, y + 8, r, r * 0.8); ctx.fill();
    ctx.fillStyle = '#3b2d20'; ctx.fillRect(x - r * 0.08, y, r * 0.16, r * 0.8);
    ctx.fillStyle = color || '#315941';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26;
      ellipse(ctx, x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.27, r * 0.62, r * 0.5); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.04)';
    ellipse(ctx, x - r * 0.2, y - r * 0.2, r * 0.3, r * 0.22); ctx.fill();
    ctx.restore();
  }

  VC.drawTree = drawTree;
  VC.drawFurnitureItem = drawFurnitureItem;
})();
