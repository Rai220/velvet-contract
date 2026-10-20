/* ==========================================================================
   VELVET CONTRACT — utility helpers
   ========================================================================== */
(function () {
  'use strict';
  const VC = (window.VC = window.VC || {});

  const TAU = Math.PI * 2;

  function hashString(str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class RNG {
    constructor(seed) {
      this.seed = String(seed);
      this._next = mulberry32(hashString(this.seed));
    }
    next() { return this._next(); }
    range(a, b) { return a + this._next() * (b - a); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this._next() * arr.length)]; }
    chance(p) { return this._next() < p; }
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this._next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
    weighted(items) {
      let total = 0;
      for (const item of items) total += item.weight || 1;
      let r = this._next() * total;
      for (const item of items) {
        r -= item.weight || 1;
        if (r <= 0) return item;
      }
      return items[items.length - 1];
    }
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
  const normAngle = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const angleDiff = (a, b) => normAngle(a - b);
  const angleLerp = (a, b, t) => a + angleDiff(b, a) * clamp(t, 0, 1);

  function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    return dist2(cx, cy, nx, ny) <= r * r;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function roman(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, c] of map) while (n >= v) { out += c; n -= v; }
    return out || 'I';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  function shade(hex, amount) {
    const c = hexToRgb(hex);
    const f = (v) => clamp(Math.round(v + amount), 0, 255);
    return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
  }

  function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return dist(px, py, ax, ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = clamp(t, 0, 1);
    return dist(px, py, ax + t * dx, ay + t * dy);
  }

  function bresenham(x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      if (fn(x0, y0) === false) return;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  class MinHeap {
    constructor() { this.a = []; }
    push(node) {
      const a = this.a;
      a.push(node);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.a;
      if (!a.length) return null;
      const root = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        while (true) {
          let l = i * 2 + 1, r = l + 1, m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return root;
    }
    get size() { return this.a.length; }
  }

  /**
   * A* over a boolean walkability grid.
   * Returns an array of {x, y} tile coordinates (excluding start), or null.
   */
  function findPath(walkable, cols, rows, sx, sy, gx, gy, maxNodes) {
    sx = clamp(sx | 0, 0, cols - 1); sy = clamp(sy | 0, 0, rows - 1);
    gx = clamp(gx | 0, 0, cols - 1); gy = clamp(gy | 0, 0, rows - 1);
    if (!walkable[sy * cols + sx] || !walkable[gy * cols + gx]) return null;
    if (sx === gx && sy === gy) return [];

    const total = cols * rows;
    const open = new MinHeap();
    const gScore = new Float32Array(total);
    const fScore = new Float32Array(total);
    const came = new Int32Array(total);
    const closed = new Uint8Array(total);
    gScore.fill(Infinity); fScore.fill(Infinity); came.fill(-1);

    const start = sy * cols + sx;
    const goal = gy * cols + gx;
    gScore[start] = 0;
    fScore[start] = Math.abs(gx - sx) + Math.abs(gy - sy);
    open.push({ i: start, x: sx, y: sy, f: fScore[start] });
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let expanded = 0;
    const limit = maxNodes || 5000;

    while (open.size) {
      const cur = open.pop();
      const ci = cur.i;
      if (closed[ci]) continue;
      if (ci === goal) {
        const path = [];
        let c = ci;
        while (c !== start) {
          path.push({ x: c % cols, y: Math.floor(c / cols) });
          c = came[c];
          if (c < 0) return null;
        }
        path.reverse();
        return path;
      }
      closed[ci] = 1;
      if (++expanded > limit) return null;
      const cx = ci % cols, cy = Math.floor(ci / cols);
      for (const [dx, dy, cost] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (!walkable[ni] || closed[ni]) continue;
        // Do not cut diagonal corners.
        if (dx && dy) {
          if (!walkable[cy * cols + nx] || !walkable[ny * cols + cx]) continue;
        }
        const tentative = gScore[ci] + cost;
        if (tentative < gScore[ni]) {
          came[ni] = ci;
          gScore[ni] = tentative;
          fScore[ni] = tentative + Math.abs(gx - nx) + Math.abs(gy - ny);
          open.push({ i: ni, x: nx, y: ny, f: fScore[ni] });
        }
      }
    }
    return null;
  }

  VC.Utils = {
    TAU, hashString, mulberry32, RNG, clamp, lerp, dist, dist2,
    normAngle, angleDiff, angleLerp, pointInRect, circleRect, rectsOverlap,
    formatTime, roman, pad2, hexToRgb, rgba, shade, roundedRect, ellipse,
    pointToSegmentDist, bresenham, MinHeap, findPath
  };
})();
