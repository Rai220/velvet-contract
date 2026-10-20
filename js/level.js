/* ==========================================================================
   VELVET CONTRACT — procedural level generation
   ========================================================================== */
(function () {
  'use strict';
  const VC = (window.VC = window.VC || {});
  const U = VC.Utils;
  const T = 40;

  const FLOOR_PIECE = {
    rug: false, pool: true, stage: true, fountain: true, planter: true, plant: true,
    diningTable: true, table: true, coffeeTable: true, sofa: true, armchair: true, chair: true,
    counter: true, island: true, stove: true, sink: true, fridge: true, cabinet: true,
    wardrobe: true, shelf: true, wineRack: true, desk: true, monitorBank: true, serverRack: true,
    officeChair: true, sideboard: true, freezer: true, trunk: true,
    locker: true, bed: true, nightstand: true, dresser: true, safe: true, crate: true,
    barrel: true, car: true, workbench: true, toolRack: true, washer: true, toilet: true,
    stall: true, bathtub: true, bench: true, piano: true, poolTable: true, barCounter: true,
    console: true, captainChair: true, engine: true, pipes: true, tree: true, hedge: true,
    column: true, lounger: true, screen: true, statue: true, bunk: true, tireStack: true,
    couch: true, loveseat: true,
    cargoNet: false, danceFloor: false, barShelf: true, fridgeTall: true, vending: true
  };
  const TALL_PIECE = new Set([
    'wardrobe', 'shelf', 'wineRack', 'locker', 'serverRack', 'toolRack', 'car', 'engine',
    'crate', 'fridge', 'fridgeTall', 'cabinet', 'barShelf', 'screen', 'column', 'tree',
    'hedge', 'pipes', 'statue', 'bunk', 'stall', 'vending'
  ]);
  const CONTAINER_PIECE = {
    wardrobe: 'Wardrobe', locker: 'Locker', freezer: 'Freezer', fridgeTall: 'Cold locker',
    crate: 'Crate', cabinet: 'Cabinet', trunk: 'Trunk'
  };

  class Level {
    constructor(theme, seed) {
      this.theme = theme;
      this.seed = seed;
      this.rng = new U.RNG(seed);
      this.W = theme.size.w;
      this.H = theme.size.h;
      this.pxW = this.W * T;
      this.pxH = this.H * T;
      this.T = T;
      this.margin = 3;
      this.bx = this.margin;
      this.by = this.margin;
      this.bw = this.W - this.margin * 2;
      this.bh = this.H - this.margin * 2;
      this.tiles = new Uint8Array(this.W * this.H);
      this.roomMap = new Int16Array(this.W * this.H);
      this.roomMap.fill(-1);
      this.rooms = [];
      this.furniture = [];
      this.solidFurniture = [];
      this.containers = [];
      this.props = [];
      this.traps = [];
      this.doors = [];
      this.nav = null;
      this.sight = null;
      this.targetHome = null;
      this.targetVisitRooms = [];
      this.playerSpawn = null;
      this.generate();
    }

    // ---------------------------------------------------------------- helpers
    inBuilding(tx, ty) {
      return tx >= this.bx && ty >= this.by && tx < this.bx + this.bw && ty < this.by + this.bh;
    }
    idx(tx, ty) { return ty * this.W + tx; }
    tileAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return 0;
      return this.tiles[ty * this.W + tx];
    }
    setTile(tx, ty, v) {
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return;
      this.tiles[ty * this.W + tx] = v;
    }
    roomAtWorld(x, y) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return null;
      const id = this.roomMap[ty * this.W + tx];
      return id >= 0 ? this.rooms[id] : null;
    }
    isFloorTile(tx, ty) { return this.tileAt(tx, ty) > 0; }
    isWallWorld(x, y) {
      return !this.isFloorTile(Math.floor(x / T), Math.floor(y / T));
    }

    // ---------------------------------------------------------------- layout
    generate() {
      const rng = this.rng;
      const { bx, by, bw, bh } = this;
      // Hallway height is three tiles. The room bands vary a little by theme.
      this.cy = by + Math.round((bh - 2) / 2);
      this.corridorTop = this.cy;
      this.corridorBottom = this.cy + 2;
      const topY = by + 2;
      const topH = this.cy - by - 3;
      const bottomY = this.cy + 4;
      const bottomH = by + bh - this.cy - 5;
      this.topY = topY; this.topH = topH;
      this.bottomY = bottomY; this.bottomH = bottomH;

      // Carve the central corridor.
      for (let y = this.cy; y <= this.cy + 2; y++) {
        for (let x = bx + 2; x <= bx + bw - 3; x++) this.setTile(x, y, 2);
      }

      // Split each band into rooms with one-tile dividing walls.
      const splitBand = (y, h, side) => {
        const slots = [];
        let x = bx + 2;
        const maxX = bx + bw - 3;
        while (x <= maxX - 7) {
          const remaining = maxX - x + 1;
          let w;
          if (remaining <= 9) {
            w = remaining;
          } else if (rng.chance(0.15) && remaining >= 14) {
            w = rng.int(13, Math.min(18, remaining - 2));
          } else {
            w = rng.int(8, Math.min(14, remaining - 2));
          }
          if (remaining - w <= 8) w = remaining;
          w = Math.min(w, remaining);
          if (w < 7) break;
          slots.push({ x, y, w, h, side });
          x += w + 1;
          if (remaining - w < 8) break;
        }
        return slots;
      };

      const topSlots = splitBand(topY, topH, 'top');
      const bottomSlots = splitBand(bottomY, bottomH, 'bottom');
      const allSlots = topSlots.concat(bottomSlots);

      // Carve room floors.
      for (const s of allSlots) {
        for (let y = s.y; y < s.y + s.h; y++) {
          for (let x = s.x; x < s.x + s.w; x++) this.setTile(x, y, 1);
        }
      }

      // Choose room functions. Required rooms first so every contract has
      // kitchens, security, storage, bathrooms and at least one social room.
      const availableTypes = Object.keys(this.theme.rooms).filter(t => VC.ROOM_TYPES[t]);
      // These rooms are the contract's skeleton: a kitchen, a secure room,
      // storage, a bathroom, at least one social space and one private suite.
      const essential = [];
      const addEssential = (t) => { if (t && availableTypes.includes(t) && !essential.includes(t)) essential.push(t); };
      for (const t of ['kitchen', 'security', 'storage', 'bathroom']) addEssential(t);
      const socialSmall = ['lounge', 'lobby', 'bar', 'garden', 'spa'].filter(t => availableTypes.includes(t));
      const socialBig = ['ballroom', 'dining', 'pool'].filter(t => availableTypes.includes(t));
      const socialCandidates = socialSmall.length ? socialSmall : socialBig;
      if (socialCandidates.length) addEssential(rng.pick(socialCandidates));
      const privateSmall = ['suite', 'bedroom', 'office'].filter(t => availableTypes.includes(t));
      const privateBig = ['conference'].filter(t => availableTypes.includes(t));
      const privateCandidates = privateSmall.length ? privateSmall : privateBig;
      if (privateCandidates.length) addEssential(rng.pick(privateCandidates));
      const serviceCandidates = ['garage', 'engine', 'cargo', 'bridge', 'cockpit'].filter(t => availableTypes.includes(t));
      if (serviceCandidates.length) addEssential(rng.pick(serviceCandidates));

      // Only after the required rooms are reserved do we add flavour rooms.
      const optional = availableTypes.filter(t => !essential.includes(t));
      const typeDeck = essential.slice(0, allSlots.length);
      const extraDeck = rng.shuffle(optional);
      while (typeDeck.length < allSlots.length && extraDeck.length) typeDeck.push(extraDeck.shift());
      const validTypes = availableTypes.filter(t => t !== 'none');
      const usedNames = new Set();
      const nameFor = (type) => {
        const names = this.theme.rooms[type] || ['Unnamed Room'];
        const unused = names.filter(n => !usedNames.has(n));
        const name = rng.pick(unused.length ? unused : names);
        usedNames.add(name);
        return name;
      };

      for (let i = 0; i < allSlots.length; i++) {
        const slot = allSlots[i];
        let type = null;
        while (typeDeck.length) {
          const t = typeDeck.shift();
          if (slot.w >= 11 || !['ballroom', 'dining', 'garage', 'pool', 'engine', 'cargo', 'conference'].includes(t)) {
            type = t; break;
          }
        }
        if (!type) {
          type = rng.pick(validTypes);
          if (slot.w < 10 && ['ballroom', 'dining', 'garage', 'pool', 'engine', 'cargo'].includes(type)) {
            type = rng.pick(['storage', 'pantry', 'bathroom', 'bedroom', 'crew', 'office', 'laundry'].filter(t => validTypes.includes(t)));
          }
        }
        if (!type) type = validTypes[0];
        const def = VC.ROOM_TYPES[type];
        const room = {
          id: i,
          type,
          name: nameFor(type),
          zone: def.zone,
          floor: def.floor,
          layout: def.layout,
          social: def.social,
          targetable: def.targetable,
          x: slot.x, y: slot.y, w: slot.w, h: slot.h,
          side: slot.side,
          door: null,
          center: { x: (slot.x + slot.w / 2) * T, y: (slot.y + slot.h / 2) * T }
        };
        this.rooms.push(room);
      }

      // Ensure there is a targetable room.
      if (!this.rooms.some(r => r.targetable)) {
        const fallback = this.rooms.find(r => r.zone === 'public' || r.zone === 'private');
        if (fallback) {
          fallback.targetable = true;
          fallback.type = optionalTargetType(availableTypes, rng);
          fallback.name = nameFor(fallback.type);
          fallback.zone = VC.ROOM_TYPES[fallback.type].zone;
          fallback.layout = VC.ROOM_TYPES[fallback.type].layout;
          fallback.floor = VC.ROOM_TYPES[fallback.type].floor;
        }
      }

      // Mark room tiles and carve doors into the corridor.
      for (const room of this.rooms) {
        for (let y = room.y; y < room.y + room.h; y++) {
          for (let x = room.x; x < room.x + room.w; x++) {
            this.roomMap[y * this.W + x] = room.id;
          }
        }
        const doorX = rng.int(room.x + 2, Math.max(room.x + 2, room.x + room.w - 3));
        const doorY = room.side === 'top' ? this.cy - 1 : this.cy + 3;
        this.setTile(doorX, doorY, 3);
        this.setTile(doorX + 1, doorY, 3);
        room.door = { x: doorX, y: doorY, w: 2, side: room.side === 'top' ? 'bottom' : 'top' };
        this.doors.push(room.door);
      }

      // Select the target room and its social circuit.
      const targetCandidates = this.rooms.filter(r => r.targetable && r.w >= 9);
      const preferred = targetCandidates.filter(r => ['suite', 'ballroom', 'dining', 'lounge', 'office', 'conference', 'bar', 'bedroom'].includes(r.type));
      this.targetHome = rng.pick(preferred.length ? preferred : (targetCandidates.length ? targetCandidates : this.rooms));
      this.targetHome.targetRoom = true;
      const visitPool = this.rooms.filter(r => r !== this.targetHome && (r.targetable || r.social) && r.w >= 8);
      this.targetVisitRooms = [this.targetHome].concat(rng.shuffle(visitPool).slice(0, 2));

      // Decorative outer walls: ring stays solid. No tiles outside the building
      // are walkable, which gives the exterior art a clean silhouette.
      this.playerSpawn = { x: (bx + 4.5) * T, y: (this.cy + 1.5) * T };

      this.makeFurniture();
      this.makeNavigation();
      this.makeProps();
      this.buildStatic();
    }

    // ------------------------------------------------------------- furniture
    makeFurniture() {
      const rng = this.rng;
      for (const room of this.rooms) {
        const ox = room.x * T, oy = room.y * T;
        const cw = room.w * T, ch = room.h * T;
        const inset = 10;
        const door = room.door;
        const doorWorld = {
          x: door.x * T - 20,
          y: (door.y * T),
          w: door.w * T + 40,
          h: T
        };
        // Keep a clear approach corridor into the room from its door.
        const approach = {
          x: doorWorld.x - 15,
          y: door.side === 'bottom' ? doorWorld.y - 70 : doorWorld.y + T - 8,
          w: doorWorld.w + 30,
          h: door.side === 'bottom' ? T + 70 : T + 70
        };
        const pieces = [];
        const test = (x, y, w, h, solid, ignore) => {
          if (x < ox + 5 || y < oy + 5 || x + w > ox + cw - 5 || y + h > oy + ch - 5) return false;
          const r = { x, y, w, h };
          if (!ignore && U.rectsOverlap(r, approach)) return false;
          if (solid) {
            for (const p of pieces) {
              if (p.solid && U.rectsOverlap(r, p)) return false;
            }
          }
          return true;
        };
        const put = (type, rx, ry, rw, rh, opts = {}) => {
          const solid = opts.solid !== undefined ? opts.solid : !!FLOOR_PIECE[type];
          const x = Math.round(ox + rx), y = Math.round(oy + ry);
          const w = Math.round(rw), h = Math.round(rh);
          if (!test(x, y, w, h, solid, opts.under)) return null;
          const piece = {
            type, x, y, w, h, solid, under: !!opts.under, roomId: room.id,
            tall: TALL_PIECE.has(type), container: !!CONTAINER_PIECE[type],
            containerName: CONTAINER_PIECE[type] || null,
            tint: opts.tint || null, dir: opts.dir || null,
            label: opts.label || null
          };
          pieces.push(piece);
          this.furniture.push(piece);
          if (solid) this.solidFurniture.push(piece);
          if (piece.container) this.containers.push(piece);
          return piece;
        };
        this.layoutRoom(room, cw, ch, put, rng, test, ox, oy);
        // Every room gets a hiding place. It is a gameplay guarantee, not just decor.
        if (!pieces.some(p => p.container)) {
          const side = rng.chance(0.5) ? 12 : cw - 100;
          put('locker', side, ch - (room.side === 'bottom' ? 95 : 105), 78, 86);
        }
      }
    }

    layoutRoom(room, cw, ch, put, rng, test, ox, oy) {
      const layout = room.layout;
      const w = cw, h = ch;
      const cx = w / 2, cy = h / 2;
      const small = w < 430 || h < 330;

      // Rugs and dance floors are underlays: they do not collide.
      const rug = (x, y, ww, hh, tint) => put('rug', x, y, ww, hh, { solid: false, under: true, tint });

      switch (layout) {
        case 'lobby': {
          rug(cx - w * 0.22, cy - h * 0.16, w * 0.44, h * 0.34);
          put('desk', cx - 105, 36, 210, 68);
          put('sofa', 26, cy + 5, Math.min(185, w * 0.34), 72);
          put('sofa', w - Math.min(185, w * 0.34) - 26, cy + 5, Math.min(185, w * 0.34), 72);
          put('coffeeTable', cx - 55, cy + 95, 110, 66);
          put('plant', 20, 22, 45, 45);
          put('plant', w - 65, 22, 45, 45);
          put('column', cx - 170, h - 100, 34, 72);
          put('column', cx + 136, h - 100, 34, 72);
          break;
        }
        case 'lounge': {
          rug(cx - w * 0.25, cy - h * 0.17, w * 0.5, h * 0.38);
          put('sofa', cx - 105, 44, 210, 76);
          put('coffeeTable', cx - 62, cy + 18, 124, 62);
          put('armchair', cx - 190, cy + 12, 66, 66);
          put('armchair', cx + 124, cy + 12, 66, 66);
          put('shelf', 16, 40, 41, Math.min(170, h * 0.42));
          put('shelf', w - 57, 40, 41, Math.min(170, h * 0.42));
          put('plant', 18, h - 76, 48, 48);
          put('plant', w - 68, h - 76, 48, 48);
          if (!small) {
            put('piano', w * 0.54, h - 130, 220, 92);
          }
          break;
        }
        case 'ballroom': {
          put('stage', w * 0.29, 31, w * 0.42, 80, { solid: true });
          rug(cx - w * 0.23, cy - h * 0.08, w * 0.46, h * 0.38, '#2f2529');
          put('table', 32, cy - 50, 118, 58);
          put('table', w - 150, cy - 50, 118, 58);
          put('table', 32, h - 118, 118, 58);
          put('table', w - 150, h - 118, 118, 58);
          put('sofa', cx - 100, h - 94, 200, 68);
          put('plant', 20, 20, 44, 44);
          put('plant', w - 64, 20, 44, 44);
          break;
        }
        case 'dining': {
          rug(cx - w * 0.31, cy - h * 0.25, w * 0.62, h * 0.5);
          put('diningTable', cx - Math.min(230, w * 0.34), cy - 66, Math.min(460, w * 0.68), 132);
          put('sideboard', w * 0.18, 28, 190, 52);
          put('cabinet', w - 160, 28, 128, 66);
          put('plant', 18, h - 74, 45, 45);
          put('plant', w - 63, h - 74, 45, 45);
          break;
        }
        case 'bar': {
          put('barCounter', 30, cy - 75, Math.min(270, w * 0.5), 68);
          put('barShelf', 36, 34, Math.min(250, w * 0.46), 34);
          put('rug', w * 0.54, cy - 25, w * 0.3, h * 0.34, { solid: false, under: true });
          put('table', w * 0.57, cy + 40, 110, 60);
          put('sofa', w - 222, h - 100, 190, 70);
          put('barrel', 26, h - 92, 54, 54);
          put('plant', w - 64, 20, 44, 44);
          break;
        }
        case 'kitchen': {
          const counterW = w - 190;
          put('counter', 30, 30, Math.max(120, counterW), 54);
          put('stove', 30 + Math.max(120, counterW) * 0.52, 31, 76, 52);
          put('sink', 30 + Math.max(120, counterW) * 0.22, 31, 68, 50);
          put('fridgeTall', w - 102, 28, 72, 94);
          put('island', cx - Math.min(155, w * 0.22), cy - 32, Math.min(310, w * 0.44), 74);
          put('shelf', 16, cy + 25, 40, Math.min(140, h * 0.3));
          put('cabinet', w - 105, h - 100, 82, 72);
          break;
        }
        case 'pantry': {
          put('shelf', 24, 30, 42, h - 110);
          put('shelf', w - 66, 30, 42, h - 110);
          put('crate', cx - 70, cy - 30, 70, 70);
          put('crate', cx + 14, cy + 18, 58, 58, { tint: '#7b5637' });
          put('cabinet', cx - 38, 34, 84, 64);
          put('barrel', 28, h - 78, 48, 48);
          break;
        }
        case 'storage': {
          put('shelf', 24, 28, Math.min(230, w * 0.46), 38);
          put('shelf', 24, 78, Math.min(230, w * 0.46), 38);
          put('crate', cx - 92, cy - 20, 86, 86);
          put('crate', cx + 12, cy + 20, 64, 64, { tint: '#866143' });
          put('locker', w - 95, 30, 72, 86);
          put('barrel', w - 74, h - 82, 52, 52);
          put('toolRack', 22, h - 64, 145, 32);
          break;
        }
        case 'laundry': {
          put('washer', 30, 30, 72, 72);
          put('washer', 112, 30, 72, 72);
          put('washer', 194, 30, 72, 72);
          put('shelf', 24, 120, 260, 38);
          put('table', cx - 90, cy + 38, 180, 72);
          put('locker', w - 94, 32, 70, 82);
          put('plant', w - 66, h - 76, 46, 46);
          break;
        }
        case 'security': {
          put('monitorBank', 28, 28, Math.min(310, w * 0.55), 68);
          put('desk', cx - 105, cy - 5, 210, 72);
          put('serverRack', w - 96, 30, 68, 92);
          put('locker', 24, h - 112, 72, 84);
          put('screen', w * 0.44, h - 54, 150, 26);
          put('column', cx - 175, 20, 30, 60);
          break;
        }
        case 'office': {
          rug(cx - w * 0.22, cy - h * 0.19, w * 0.44, h * 0.38);
          put('desk', cx - 100, 45, 200, 72);
          put('officeChair', cx - 30, 128, 60, 48);
          put('shelf', 22, 32, 42, Math.min(210, h * 0.52));
          put('shelf', w - 64, 32, 42, Math.min(210, h * 0.52));
          put('safe', w - 100, h - 104, 64, 68);
          put('cabinet', cx - 65, h - 80, 130, 48);
          break;
        }
        case 'bedroom': {
          // The bed sits against the back wall, with the headboard against the outer wall.
          const bedX = cx - 100;
          const bedY = room.side === 'top' ? 44 : h - 166;
          put('bed', bedX, bedY, 200, 132, { dir: 'up' });
          put('nightstand', bedX - 58, bedY + 18, 42, 42);
          put('nightstand', bedX + 216, bedY + 18, 42, 42);
          rug(cx - w * 0.23, cy + h * 0.1, w * 0.46, h * 0.28);
          put('wardrobe', w - 98, 40, 72, 104);
          put('dresser', 24, h - 88, 122, 54);
          put('armchair', w - 130, h - 100, 62, 62);
          put('plant', 20, 22, 44, 44);
          break;
        }
        case 'garage': {
          put('car', cx - 80, cy - 132, 160, 270, { tint: room.tint || '#623d38' });
          put('workbench', 28, 30, Math.min(250, w * 0.42), 58);
          put('toolRack', 28, 98, Math.min(210, w * 0.36), 32);
          put('tireStack', w - 100, 34, 70, 100);
          put('barrel', w - 76, h - 86, 52, 52);
          put('crate', 30, h - 100, 74, 74);
          break;
        }
        case 'cargo': {
          rug(cx - w * 0.25, cy - h * 0.19, w * 0.5, h * 0.38, '#293438');
          put('crate', 30, 28, 90, 90);
          put('crate', 132, 36, 68, 68, { tint: '#7c5c3f' });
          put('crate', 30, h - 120, 78, 78, { tint: '#755337' });
          put('crate', w - 130, cy - 30, 90, 90);
          put('barrel', w - 86, sy(cy + 80), 52, 52);
          put('barrel', w - 142, cy + 94, 44, 44);
          put('toolRack', 24, h - 58, 140, 26);
          break;
        }
        case 'engine': {
          put('engine', cx - 128, cy - 88, 256, 176);
          put('console', 30, 30, 170, 50);
          put('pipes', w - 122, 30, 92, h - 80);
          put('barrel', 30, h - 96, 54, 54);
          put('barrel', 94, h - 86, 44, 44);
          put('toolRack', 26, 98, 140, 28);
          break;
        }
        case 'bridge': {
          put('console', cx - 170, 35, 340, 68);
          put('captainChair', cx - 38, cy - 6, 76, 66);
          put('console', 26, cy + 52, 108, 48);
          put('console', w - 134, cy + 52, 108, 48);
          put('safe', w - 100, h - 99, 56, 60);
          break;
        }
        case 'bathroom': {
          put('stall', 26, 28, 48, Math.min(150, h * 0.4));
          put('stall', 80, 28, 48, Math.min(150, h * 0.4));
          put('sink', 26, h - 82, 160, 42);
          put('bathtub', w - 126, h - 120, 100, 84);
          put('plant', w - 64, 24, 42, 42);
          break;
        }
        case 'infirmary': {
          put('bed', 28, 34, 150, 96, { dir: 'left' });
          put('bed', 28, 152, 150, 96, { dir: 'left' });
          put('cabinet', w - 118, 30, 90, 66);
          put('desk', cx - 50, h - 96, 180, 60);
          put('shelf', w - 86, cy + 15, 38, Math.min(150, h * 0.34));
          break;
        }
        case 'garden': {
          patchFountain(this, room);
          put('fountain', cx - 67, cy - 67, 134, 134);
          put('planter', 26, 28, Math.min(190, w * 0.32), 42);
          put('planter', w - Math.min(190, w * 0.32) - 26, 28, Math.min(190, w * 0.32), 42);
          put('bench', 30, h - 94, 160, 46);
          put('bench', w - 190, h - 94, 160, 46);
          put('tree', 30, 100, 80, 80);
          put('tree', w - 110, 100, 80, 80);
          put('hedge', cx - 120, h - 64, 240, 34);
          break;
        }
        case 'pool': {
          put('pool', cx - Math.min(260, w * 0.37), cy - Math.min(135, h * 0.28), Math.min(520, w * 0.74), Math.min(270, h * 0.56));
          put('lounger', 42, 36, 64, 126);
          put('lounger', 120, 36, 64, 126);
          put('lounger', w - 184, 36, 64, 126);
          put('lounger', w - 106, 36, 64, 126);
          put('bench', cx - 90, h - 75, 180, 42);
          put('plant', 22, h - 92, 46, 46);
          put('plant', w - 68, h - 92, 46, 46);
          break;
        }
        case 'spa': {
          put('pool', cx - Math.min(175, w * 0.25), cy - 90, Math.min(350, w * 0.5), 180);
          put('bench', 30, 36, 150, 45);
          put('bench', w - 180, 36, 150, 45);
          put('planter', 24, h - 80, 140, 36);
          put('plant', w - 70, 100, 46, 46);
          break;
        }
        case 'conference': {
          rug(cx - w * 0.27, cy - h * 0.2, w * 0.54, h * 0.42);
          put('diningTable', cx - Math.min(210, w * 0.32), cy - 58, Math.min(420, w * 0.64), 116);
          put('screen', w * 0.35, 27, w * 0.3, 28);
          put('cabinet', 24, h - 84, 150, 48);
          put('plant', w - 66, h - 76, 46, 46);
          break;
        }
        case 'winecellar': {
          put('wineRack', 24, 28, 44, h - 110);
          put('wineRack', w - 68, 28, 44, h - 110);
          put('barrel', cx - 80, 46, 55, 55);
          put('barrel', cx - 15, 46, 55, 55);
          put('table', cx - 75, cy + 20, 150, 68);
          put('crate', 30, h - 92, 64, 64);
          break;
        }
        case 'crew': {
          put('bunk', 26, 30, 90, 168);
          put('bunk', 126, 30, 90, 168);
          put('locker', w - 94, 30, 70, 86);
          put('table', cx - 80, h - 100, 160, 66);
          put('plant', w - 62, h - 72, 42, 42);
          break;
        }
        default: {
          rug(cx - w * 0.2, cy - h * 0.16, w * 0.4, h * 0.32);
          put('table', cx - 70, cy - 30, 140, 60);
          put('plant', 24, 24, 44, 44);
          put('plant', w - 68, 24, 44, 44);
        }
      }

      // Add a little breathing-room decor in large, sparse rooms.
      if (!small && (layout === 'dining' || layout === 'ballroom' || layout === 'lounge')) {
        put('plant', w - 126, h - 78, 42, 42);
      }
    }

    // ---------------------------------------------------------------- pathing
    makeNavigation() {
      const n = this.W * this.H;
      this.nav = new Uint8Array(n);
      this.sight = new Uint8Array(n);
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const i = y * this.W + x;
          const t = this.tiles[i];
          this.nav[i] = t > 0 ? 1 : 0;
          this.sight[i] = t > 0 ? 1 : 0;
        }
      }
      for (const f of this.solidFurniture) {
        const x0 = Math.floor(f.x / T), y0 = Math.floor(f.y / T);
        const x1 = Math.floor((f.x + f.w - 1) / T), y1 = Math.floor((f.y + f.h - 1) / T);
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
            const px = (x + 0.5) * T, py = (y + 0.5) * T;
            if (U.pointInRect(px, py, f.x, f.y, f.w, f.h)) this.nav[y * this.W + x] = 0;
            if (f.tall && U.pointInRect(px, py, f.x, f.y, f.w, f.h)) this.sight[y * this.W + x] = 0;
          }
        }
      }
      // Cache room walkable cells for NPC spawning and interaction placement.
      for (const room of this.rooms) {
        room.walkTiles = [];
        for (let y = room.y; y < room.y + room.h; y++) {
          for (let x = room.x; x < room.x + room.w; x++) {
            if (this.nav[y * this.W + x]) room.walkTiles.push({ x, y });
          }
        }
      }
    }

    tileWalkable(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return false;
      return !!this.nav[ty * this.W + tx];
    }

    nearestWalkable(tx, ty) {
      if (this.tileWalkable(tx, ty)) return { x: tx, y: ty };
      for (let r = 1; r <= 8; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            if (this.tileWalkable(tx + dx, ty + dy)) return { x: tx + dx, y: ty + dy };
          }
        }
      }
      return null;
    }

    findPathWorld(sx, sy, gx, gy) {
      const s = this.nearestWalkable(Math.floor(sx / T), Math.floor(sy / T));
      const g = this.nearestWalkable(Math.floor(gx / T), Math.floor(gy / T));
      if (!s || !g) return null;
      const path = U.findPath(this.nav, this.W, this.H, s.x, s.y, g.x, g.y, this.W * this.H);
      if (!path) return null;
      return path.map(p => ({ x: (p.x + 0.5) * T, y: (p.y + 0.5) * T }));
    }

    circleHitsWall(x, y, r) {
      const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
      const y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (!this.isFloorTile(tx, ty)) {
            if (U.circleRect(x, y, r, tx * T, ty * T, T, T)) return true;
          }
        }
      }
      return false;
    }

    circleHitsFurniture(x, y, r) {
      for (const f of this.solidFurniture) {
        if (U.circleRect(x, y, r, f.x, f.y, f.w, f.h)) return true;
      }
      return false;
    }

    canStand(x, y, r) {
      return !this.circleHitsWall(x, y, r) && !this.circleHitsFurniture(x, y, r);
    }

    moveCircle(entity, dx, dy, r) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 12));
      const sx = dx / steps, sy = dy / steps;
      for (let i = 0; i < steps; i++) {
        if (sx && this.canStand(entity.x + sx, entity.y, r)) entity.x += sx;
        if (sy && this.canStand(entity.x, entity.y + sy, r)) entity.y += sy;
      }
    }

    lineOfSight(x1, y1, x2, y2) {
      const d = U.dist(x1, y1, x2, y2);
      const steps = Math.max(1, Math.ceil(d / 14));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        const tx = Math.floor(x / T), ty = Math.floor(y / T);
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return false;
        if (!this.sight[ty * this.W + tx]) return false;
      }
      return true;
    }

    raycast(x, y, angle, maxDist) {
      const step = 9;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      for (let d = 0; d <= maxDist; d += step) {
        const px = x + cos * d, py = y + sin * d;
        const tx = Math.floor(px / T), ty = Math.floor(py / T);
        if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return d;
        if (!this.sight[ty * this.W + tx]) return d;
      }
      return maxDist;
    }

    randomRoomPoint(room, rng, awayFromDoor) {
      if (!room.walkTiles || !room.walkTiles.length) return { x: room.center.x, y: room.center.y };
      const doorX = room.door ? (room.door.x + 1) * T : -9999;
      const doorY = room.door ? (room.door.y + 0.5) * T : -9999;
      const tiles = room.walkTiles.filter(t => {
        if (!awayFromDoor) return true;
        return U.dist((t.x + 0.5) * T, (t.y + 0.5) * T, doorX, doorY) > 135;
      });
      const t = rng.pick(tiles.length ? tiles : room.walkTiles);
      return { x: (t.x + 0.5) * T, y: (t.y + 0.5) * T };
    }

    randomFreePoint(room, rng, radius) {
      radius = radius || 18;
      for (let i = 0; i < 80; i++) {
        const p = this.randomRoomPoint(room, rng, true);
        if (this.canStand(p.x, p.y, radius)) return p;
      }
      return { x: room.center.x, y: room.center.y };
    }

    // ------------------------------------------------------------------ props
    makeProps() {
      const rng = this.rng;
      const findRoom = (types) => this.rooms.filter(r => types.includes(r.type));
      const staffRooms = findRoom(['storage', 'laundry', 'pantry', 'crew', 'winecellar']);
      const kitchenRooms = findRoom(['kitchen', 'pantry']);
      const securityRooms = findRoom(['security', 'bridge']);
      const techRooms = findRoom(['engine', 'garage', 'cargo']);
      const targetRoom = this.targetHome;

      const addOutfit = (outfit, rooms) => {
        if (!rooms.length) return;
        const room = rng.pick(rooms);
        const p = this.randomFreePoint(room, rng, 20);
        this.props.push({
          kind: 'outfit', outfit, x: p.x, y: p.y, roomId: room.id, used: false,
          label: VC.OUTFITS[outfit].label + ' uniform',
          sub: VC.OUTFITS[outfit].short + ' · press E to wear'
        });
      };
      addOutfit('staff', staffRooms.length ? staffRooms : this.rooms);
      addOutfit('chef', kitchenRooms.length ? kitchenRooms : this.rooms);
      addOutfit('guard', securityRooms.length ? securityRooms : this.rooms);
      addOutfit('tech', techRooms.length ? techRooms : this.rooms);

      // A second safety uniform, somewhere service-like, makes bad seeds fair.
      if (staffRooms.length > 1 && rng.chance(0.55)) addOutfit('staff', staffRooms);

      const poisonRoom = kitchenRooms.length ? rng.pick(kitchenRooms) : (staffRooms.length ? rng.pick(staffRooms) : rng.pick(this.rooms));
      const pp = this.randomFreePoint(poisonRoom, rng, 18);
      this.props.push({
        kind: 'poison', x: pp.x, y: pp.y, roomId: poisonRoom.id, used: false,
        name: rng.pick(VC.POISON_NAMES), label: 'Poison vial', sub: 'Press E to pocket'
      });

      // The target's glass is in their room, positioned on or near a table.
      let glassPoint = { x: targetRoom.center.x, y: targetRoom.center.y };
      const tablePiece = this.furniture.find(f => f.roomId === targetRoom.id && ['diningTable', 'table', 'coffeeTable', 'desk', 'barCounter', 'counter'].includes(f.type));
      if (tablePiece) {
        glassPoint = { x: tablePiece.x + tablePiece.w * 0.72, y: tablePiece.y + tablePiece.h * 0.5 };
      } else {
        glassPoint = this.randomFreePoint(targetRoom, rng, 16);
      }
      this.props.push({
        kind: 'glass', x: glassPoint.x, y: glassPoint.y, roomId: targetRoom.id,
        poisoned: false, poisonedBy: null, label: "Target's glass", sub: 'Press E to poison'
      });

      // One or two environmental accidents. They sit in spaces the target
      // visits, and are armed by the player before the target passes.
      const trapKeys = trapPoolFor(this.theme.id);
      const trapRoomChoices = [targetRoom].concat(this.targetVisitRooms.filter(r => r !== targetRoom && r.social));
      const trapCount = rng.chance(0.65) ? 2 : 1;
      for (let i = 0; i < trapCount; i++) {
        const room = trapRoomChoices[i % trapRoomChoices.length] || targetRoom;
        const pos = this.randomFreePoint(room, rng, 22);
        const def = VC.TRAP_DEFS[trapKeys[i % trapKeys.length]];
        const trap = {
          kind: 'trap', type: trapKeys[i % trapKeys.length], x: pos.x, y: pos.y, roomId: room.id,
          armed: false, triggered: false, radius: 115, label: def.label, action: def.action,
          color: def.color, def
        };
        this.props.push(trap);
        this.traps.push(trap);
      }

      // Target patrol circuit: the home room, a public room, and the glass.
      const route = [];
      route.push({ x: glassPoint.x, y: glassPoint.y });
      for (const r of this.targetVisitRooms) {
        if (r === targetRoom) continue;
        route.push(this.randomRoomPoint(r, rng, false));
      }
      route.push(this.randomRoomPoint(targetRoom, rng, false));
      const trap = this.traps.find(t => t.roomId === targetRoom.id) || this.traps[0];
      if (trap) route.push({ x: trap.x, y: trap.y });
      this.targetRoute = route;

      // Distress/escape point for the target when everything goes wrong.
      const safeRoom = this.rooms.find(r => r.type === 'security') || this.rooms.find(r => r.type === 'bridge') || targetRoom;
      this.targetSafePoint = { x: safeRoom.center.x, y: safeRoom.center.y, room: safeRoom };
    }

    get nearestContainer() {
      return null;
    }

    nearestContainerTo(x, y, maxDist) {
      let best = null, bd = maxDist * maxDist;
      for (const c of this.containers) {
        const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
        const d = U.dist2(x, y, cx, cy);
        if (d < bd) { bd = d; best = { piece: c, x: cx, y: cy }; }
      }
      return best;
    }

    getRoomById(id) { return this.rooms[id] || null; }
  }

  function sy(v) { return Math.max(0, v); }

  function optionalTargetType(available, rng) {
    const opts = ['suite', 'lounge', 'ballroom', 'dining', 'office', 'bedroom', 'conference', 'bar'].filter(t => available.includes(t));
    return rng.pick(opts.length ? opts : available);
  }

  function trapPoolFor(themeId) {
    if (themeId === 'ship') return ['steam', 'electrical', 'crate'];
    if (themeId === 'plane') return ['electrical', 'gas', 'crate'];
    if (themeId === 'villa') return ['chandelier', 'electrical', 'gas'];
    if (themeId === 'hotel') return ['chandelier', 'gas', 'electrical'];
    return ['chandelier', 'gas', 'electrical', 'crate'];
  }

  // A hook for adding a small visual patch under gardens without making the
  // furniture system know about outdoor textures.
  function patchFountain(level, room) {
    room.outdoorPatch = true;
  }

  VC.Level = Level;
  VC.TILE = T;
  VC.FLOOR_PIECE = FLOOR_PIECE;
})();
