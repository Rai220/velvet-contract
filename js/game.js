/* ==========================================================================
   VELVET CONTRACT — game loop, mission flow and interface wiring
   ========================================================================== */
(function () {
  'use strict';
  const VC = (window.VC = window.VC || {});
  const U = VC.Utils;
  const { clamp, lerp, dist, angleDiff, formatTime, roman, rgba, roundedRect, ellipse } = U;
  const T = VC.TILE;
  const $ = (id) => document.getElementById(id);

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.ambient = null;
    }
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
    beep(freq, dur, type, vol, slide, delay) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.03);
    }
    noise(dur, vol, filterFreq) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass';
      filt.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.08;
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start(t);
    }
    click() { this.beep(540, 0.045, 'triangle', 0.025); }
    pickup() { this.beep(420, 0.1, 'triangle', 0.05, 620); this.beep(640, 0.14, 'sine', 0.035, 780, 0.07); }
    outfit() { this.beep(310, 0.12, 'sine', 0.04, 440); this.beep(520, 0.16, 'triangle', 0.03, 610, 0.1); }
    poison() { this.beep(150, 0.32, 'sine', 0.06, 85); this.noise(0.16, 0.03, 420); }
    sabotage() { this.noise(0.12, 0.06, 2400); this.beep(180, 0.15, 'square', 0.03, 100); }
    knife() { this.noise(0.13, 0.12, 3600); this.beep(110, 0.12, 'sawtooth', 0.035, 70); }
    shoot() { this.noise(0.17, 0.14, 2400); this.beep(75, 0.2, 'sawtooth', 0.09, 40); }
    alert() {
      this.beep(380, 0.32, 'sawtooth', 0.055, 730);
      this.beep(560, 0.34, 'sawtooth', 0.04, 880, 0.18);
      this.beep(320, 0.42, 'square', 0.035, 210, 0.45);
    }
    hide() { this.noise(0.22, 0.045, 500); this.beep(95, 0.16, 'sine', 0.035, 60); }
    success() {
      [392, 494, 587, 784].forEach((f, i) => this.beep(f, 0.9, 'sine', 0.035, f, i * 0.14));
    }
    fail() {
      this.beep(196, 0.65, 'sawtooth', 0.045, 120);
      this.beep(147, 1.0, 'sine', 0.05, 90, 0.3);
    }
    startAmbient() {
      if (!this.ctx || this.ambient) return;
      const g = this.ctx.createGain(); g.gain.value = 0.016;
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 330;
      const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
      const o2 = this.ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 82.5;
      const g2 = this.ctx.createGain(); g2.gain.value = 0.4;
      o1.connect(filt); o2.connect(g2); g2.connect(filt); filt.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.ambient = { g, o1, o2 };
    }
    stopAmbient() {
      if (!this.ambient) return;
      try { this.ambient.o1.stop(); this.ambient.o2.stop(); } catch (e) {}
      this.ambient = null;
    }
  }

  class Input {
    constructor(game) {
      this.game = game;
      this.keys = {};
      window.addEventListener('keydown', (e) => {
        const el = document.activeElement;
        if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
          if (e.code === 'Escape') el.blur();
          return;
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
        if (!e.repeat) this.game.onKeyDown(e.code, e);
        this.keys[e.code] = true;
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
      window.addEventListener('blur', () => { this.keys = {}; });
    }
  }

  class Game {
    constructor() {
      this.canvas = $('game');
      this.ctx = this.canvas.getContext('2d');
      this.minimap = $('minimap');
      this.miniCtx = this.minimap.getContext('2d');
      this.bigMap = $('bigMap');
      this.bigMapCtx = this.bigMap.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.state = 'menu';
      this.mapOpen = false;
      this.level = null;
      this.player = null;
      this.npcs = [];
      this.bodies = [];
      this.particles = [];
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.userZoom = 1;
      this.baseZoom = 1;
      this.shake = 0;
      this.rng = new U.RNG('menu');
      this.audio = new AudioEngine();
      this.input = new Input(this);
      this.contractNo = 1;
      this.targetDead = false;
      this.alarm = false;
      this.dragHintShown = false;
      this.contextHtml = '';
      this.lastRoom = null;
      this.poisonTimer = 0;
      this.completeTimer = 0;
      this.stats = null;
      this.currentThemeId = null;
      this.currentSeed = null;
      this.theme = null;
      this.targetTitle = '';
      this.offscreenNotice = 0;
      this._toastTimer = null;
      this._bannerTimer = null;
      this._lastHud = {};
      this._lastTime = performance.now();
      this._acc = 0;
      this._fpsTime = 0;
      this._fpsFrames = 0;
      this.fps = 60;

      this.populateSettings();
      this.bindUI();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('wheel', (e) => {
        if (this.state !== 'playing' || this.mapOpen) return;
        e.preventDefault();
        this.userZoom = clamp(this.userZoom - Math.sign(e.deltaY) * 0.06, 0.78, 1.55);
      }, { passive: false });
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => this.resize());
      }

      this.updateDossier();
      this.showMenu();
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));

      window.addEventListener('error', (e) => {
        document.title = 'VELVET CONTRACT · ERROR';
        console.error('[Velvet Contract]', e.error || e.message);
      });

      // Debug / screenshot entry point.
      const params = new URLSearchParams(location.search);
      if (params.get('autostart') === '1') {
        setTimeout(() => {
          this.startMission(params.get('theme') || 'random', params.get('seed') || 'VELVET-DEMO');
          this.beginPlay();
        }, 60);
      }
      window.VC.game = this;
    }

    // ------------------------------------------------------------------- UI
    populateSettings() {
      const select = $('settingSelect');
      select.innerHTML = '<option value="random">Random assignment</option>' +
        VC.THEME_IDS.map(id => {
          const t = VC.THEMES[id];
          return `<option value="${id}">${t.name} — ${t.short}</option>`;
        }).join('');
    }

    updateDossier() {
      if (!this.theme || !this.currentThemeId) {
        const sel = $('settingSelect').value;
        const theme = VC.THEMES[sel] || null;
        $('dossierLines').innerHTML = `
          <div><span>Approach</span><b>Social infiltration</b></div>
          <div><span>Location</span><b>${theme ? theme.name : 'Broker\'s choice'}</b></div>
          <div><span>Rules</span><b>No witnesses. No traces.</b></div>`;
      }
    }

    bindUI() {
      $('settingSelect').addEventListener('change', () => { this.audio.init(); this.audio.click(); this.updateDossier(); });
      $('startBtn').addEventListener('click', () => {
        this.audio.init(); this.audio.click();
        const setting = $('settingSelect').value;
        const seed = $('seedInput').value.trim();
        this.contractNo = 1;
        this.startMission(setting, seed);
      });
      $('briefStartBtn').addEventListener('click', () => {
        this.audio.init(); this.audio.click(); this.beginPlay();
      });
      $('resumeBtn').addEventListener('click', () => { this.audio.click(); this.resume(); });
      $('restartBtn').addEventListener('click', () => { this.audio.click(); this.retryMission(); });
      $('abandonBtn').addEventListener('click', () => { this.audio.click(); this.showMenu(); });
      $('newContractBtn').addEventListener('click', () => {
        this.audio.click();
        this.contractNo++;
        this.startMission('random', '');
      });
      $('retryBtn').addEventListener('click', () => { this.audio.click(); this.retryMission(); });
      $('menuBtn').addEventListener('click', () => { this.audio.click(); this.showMenu(); });
      $('failRetryBtn').addEventListener('click', () => { this.audio.click(); this.retryMission(); });
      $('failMenuBtn').addEventListener('click', () => { this.audio.click(); this.showMenu(); });
      $('muteBtn').addEventListener('click', () => {
        this.audio.init();
        this.audio.setMuted(!this.audio.muted);
        $('muteIcon').textContent = this.audio.muted ? '◌' : '◉';
      });
      document.querySelector('.map-close').addEventListener('click', () => this.toggleMap());
      $('mapOverlay').addEventListener('click', (e) => { if (e.target === $('mapOverlay')) this.toggleMap(); });
    }

    screens(show) {
      const ids = ['menuScreen', 'briefingScreen', 'pauseScreen', 'resultScreen', 'failScreen'];
      for (const id of ids) {
        const el = $(id);
        if (id === show) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
      $('hud').classList.toggle('hidden', !(this.state === 'playing' || this.state === 'outro' || this.state === 'paused'));
      $('mapOverlay').classList.toggle('hidden', !this.mapOpen);
      if (this.state === 'menu') $('hud').classList.add('hidden');
    }

    showMenu() {
      this.state = 'menu';
      this.mapOpen = false;
      this.alarm = false;
      this.input.keys = {};
      this.level = null;
      this.player = null;
      this.theme = null;
      this.currentThemeId = null;
      this.currentSeed = null;
      this.npcs = [];
      this.bodies = [];
      this.particles = [];
      this.targetDead = false;
      this.audio.stopAmbient();
      $('vignette').classList.remove('alert');
      $('hud').classList.add('hidden');
      $('mapOverlay').classList.add('hidden');
      for (const id of ['briefingScreen', 'pauseScreen', 'resultScreen', 'failScreen']) $(id).classList.add('hidden');
      $('menuScreen').classList.remove('hidden');
      $('seedInput').value = '';
      this.updateDossier();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = '#07090d';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    startMission(themeId, seedInput) {
      this.audio.init();
      const chosenTheme = themeId === 'random' || !VC.THEMES[themeId]
        ? null
        : themeId;
      let seed = (seedInput || '').trim();
      if (!seed) seed = 'VC-' + Math.random().toString(36).slice(2, 7).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      this.currentSeed = seed;
      this.input.keys = {};
      const rng = new U.RNG(seed + '·contract');
      this.currentThemeId = chosenTheme || rng.pick(VC.THEME_IDS);
      this.theme = VC.THEMES[this.currentThemeId];
      this.rng = new U.RNG(seed + '·mission');
      this.level = new VC.Level(this.theme, seed);
      this.player = new VC.Player(this.level.playerSpawn.x, this.level.playerSpawn.y);
      this.bodies = [];
      this.particles = [];
      this.npcs = [];
      this.targetDead = false;
      this.alarm = false;
      this.mapOpen = false;
      this.poisonTimer = 0;
      this.completeTimer = 0;
      this.userZoom = 1;
      this.shake = 0;
      this.contextHtml = '';
      this.lastRoom = null;
      this.stats = {
        time: 0, alerts: 0, witnesses: 0, kills: 0, nonTargetKills: 0,
        bodiesHidden: 0, bodiesFound: 0, disguises: 0, accident: false,
        method: null, poisoned: false
      };
      this.witnessSet = new Set();
      this.outfitsWorn = new Set(['guest']);
      this.generateNPCs();
      this.camera = { x: this.player.x - this.width / 2, y: this.player.y - this.height / 2, zoom: 1 };
      this.updateCamera(1, true);
      this.state = 'briefing';
      this.screens('briefingScreen');
      $('hud').classList.add('hidden');
      $('vignette').classList.remove('alert');
      $('promptArea').innerHTML = '';
      $('banner').classList.remove('show');
      $('toast').classList.remove('show');
      $('briefNo').textContent = roman(this.contractNo);
      $('briefSetting').textContent = this.theme.short;
      $('briefTarget').textContent = 'Eliminate ' + this.target.name;
      $('briefFlavor').textContent = this.theme.flavor;
      $('briefTargetName').textContent = this.target.name;
      $('briefLocation').textContent = this.theme.name + ' · ' + this.theme.city;
      $('briefAccess').textContent = this.targetTitle + ' · guarded';
      $('briefTip').textContent = this.theme.tip;
      $('seedInput').value = seed;
      this.render();
    }

    beginPlay() {
      if (!this.level) return;
      this.audio.init();
      this.state = 'playing';
      this.screens(null);
      $('hud').classList.remove('hidden');
      $('briefingScreen').classList.add('hidden');
      $('menuScreen').classList.add('hidden');
      $('resultScreen').classList.add('hidden');
      $('failScreen').classList.add('hidden');
      $('pauseScreen').classList.add('hidden');
      $('vignette').classList.remove('alert');
      $('targetHudName').textContent = this.target.name;
      $('targetHudSub').textContent = this.targetTitle + ' · ' + this.level.targetHome.name;
      $('contractNo').textContent = roman(this.contractNo);
      this.audio.startAmbient();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      this.banner('FIND THE TARGET', 'Stay in character · ' + this.theme.short, 2800);
      this.toast('The target is marked in gold on your floor plan.');
      this.updateHUD();
    }

    retryMission() {
      if (!this.currentThemeId || !this.currentSeed) return this.showMenu();
      const themeId = this.currentThemeId, seed = this.currentSeed;
      $('resultScreen').classList.add('hidden');
      $('failScreen').classList.add('hidden');
      $('pauseScreen').classList.add('hidden');
      this.mapOpen = false;
      this.startMission(themeId, seed);
    }

    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        $('pauseScreen').classList.remove('hidden');
        $('hud').classList.add('hidden');
        this.input.keys = {};
      } else if (this.state === 'paused') {
        this.resume();
      }
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      $('pauseScreen').classList.add('hidden');
      $('hud').classList.remove('hidden');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      this.lastTime = performance.now();
    }

    toggleMap() {
      if (this.state !== 'playing' && !this.mapOpen) return;
      if (!this.mapOpen) {
        this.mapOpen = true;
        $('mapOverlay').classList.remove('hidden');
        this.drawBigMap();
        this.input.keys = {};
      } else {
        this.mapOpen = false;
        $('mapOverlay').classList.add('hidden');
        this.lastTime = performance.now();
      }
    }

    banner(text, sub, duration) {
      const el = $('banner');
      el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
      el.classList.add('show');
      clearTimeout(this._bannerTimer);
      this._bannerTimer = setTimeout(() => el.classList.remove('show'), duration || 2400);
    }

    toast(text, duration) {
      const el = $('toast');
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove('show'), duration || 2300);
    }

    hint(text) {
      const el = $('stealthHint');
      if (!text) { el.classList.remove('show'); return; }
      el.textContent = text;
      el.classList.add('show');
    }

    // ------------------------------------------------------------ generation
    generateNPCs() {
      const level = this.level;
      const rng = this.rng;
      const rooms = level.rooms;
      const usedNames = new Set();
      const usedOutfits = new Set();
      const name = () => {
        let n = '';
        for (let i = 0; i < 30; i++) {
          n = rng.pick(VC.NPC_NAMES.first) + ' ' + rng.pick(VC.NPC_NAMES.last);
          if (!usedNames.has(n)) break;
        }
        usedNames.add(n);
        return n;
      };
      const spot = (room, near, minPlayerDist) => {
        let best = null;
        for (let i = 0; i < 50; i++) {
          const p = level.randomFreePoint(room, rng, 16);
          if (minPlayerDist && dist(p.x, p.y, this.player.x, this.player.y) < minPlayerDist) continue;
          if (near && dist(p.x, p.y, near.x, near.y) > 125) continue;
          let clash = false;
          for (const n of this.npcs) if (dist(p.x, p.y, n.x, n.y) < 36) { clash = true; break; }
          if (!clash) { best = p; break; }
          if (!best) best = p;
        }
        return best || level.randomFreePoint(room, rng, 16);
      };

      // Target.
      const targetRoom = level.targetHome;
      const targetPos = level.randomFreePoint(targetRoom, rng, 18);
      const target = new VC.NPC({
        id: 0, name: rng.pick(this.theme.targetNames), role: 'target', outfitId: 'vip',
        x: targetPos.x, y: targetPos.y, homeRoom: targetRoom,
        routePoints: level.targetRoute, health: 100,
        skin: rng.pick(['#c89b78', '#a87655', '#e0b28b', '#8b5f45']),
        hair: rng.pick(['#221b17', '#4a3426', '#6d5945', '#161719'])
      });
      this.targetTitle = rng.pick(this.theme.targetTitles);
      this.target = target;
      this.npcs.push(target);

      // Two bodyguards close to the target.
      for (let i = 0; i < 2; i++) {
        const p = spot(targetRoom, target, 0);
        const bg = new VC.NPC({
          id: this.npcs.length, name: name(), role: 'bodyguard', outfitId: 'guard',
          x: p.x, y: p.y, homeRoom: targetRoom,
          followOffset: i === 0 ? { x: -48, y: 42 } : { x: 48, y: -42 },
          angle: Math.atan2(target.y - p.y, target.x - p.x)
        });
        this.npcs.push(bg);
      }

      // Security office staff.
      const securityRooms = rooms.filter(r => r.type === 'security' || r.type === 'bridge' || r.type === 'cockpit');
      for (const room of securityRooms.slice(0, 2)) {
        const p = spot(room, null, 430);
        this.npcs.push(new VC.NPC({
          id: this.npcs.length, name: name(), role: 'guard', outfitId: 'guard',
          x: p.x, y: p.y, homeRoom: room, patrolRooms: [room]
        }));
      }

      // Roaming guards.
      const guardCount = 4;
      for (let i = 0; i < guardCount; i++) {
        const room = rng.pick(rooms.filter(r => r.type !== 'bathroom'));
        const patrol = [room, rng.pick(rooms), rng.pick(rooms)];
        const p = spot(room, null, 500);
        this.npcs.push(new VC.NPC({
          id: this.npcs.length, name: name(), role: 'guard', outfitId: 'guard',
          x: p.x, y: p.y, homeRoom: room, patrolRooms: patrol
        }));
      }

      // Room occupants. Each one is dressed for the room's social logic.
      for (const room of rooms) {
        if (room === targetRoom) {
          if (rng.chance(0.55)) {
            const p = spot(room, null, 300);
            this.npcs.push(new VC.NPC({
              id: this.npcs.length, name: name(), role: 'civilian',
              outfitId: rng.chance(0.5) ? 'guest' : 'staff',
              x: p.x, y: p.y, homeRoom: room, patrolRooms: [room],
              tint: rng.pick(['#6b5140', '#4c5a5f', '#74545c', '#565049'])
            }));
          }
          continue;
        }
        if (!rng.chance(0.82)) continue;
        let outfit = 'guest';
        if (['kitchen', 'pantry'].includes(room.type)) outfit = 'chef';
        else if (['security', 'bridge', 'cockpit'].includes(room.type)) outfit = 'guard';
        else if (['engine', 'garage', 'cargo'].includes(room.type)) outfit = 'tech';
        else if (['storage', 'laundry', 'crew', 'winecellar', 'infirmary'].includes(room.type)) outfit = 'staff';
        else if (['suite', 'bedroom', 'office'].includes(room.type)) outfit = rng.chance(0.55) ? 'staff' : 'guest';
        else if (['conference'].includes(room.type)) outfit = 'guest';
        else if (['lobby', 'lounge', 'ballroom', 'dining', 'bar', 'garden', 'pool', 'spa', 'bathroom'].includes(room.type)) outfit = rng.chance(0.14) ? 'staff' : 'guest';
        const p = spot(room, null, 420);
        this.npcs.push(new VC.NPC({
          id: this.npcs.length, name: name(), role: 'civilian', outfitId: outfit,
          x: p.x, y: p.y, homeRoom: room,
          patrolRooms: outfit === 'guard' ? [room, rng.pick(rooms)] : [room],
          tint: outfit === 'guest' ? rng.pick(['#6b5140', '#4c5a5f', '#74545c', '#565049', '#6d5b3e', '#4a4d5e']) : null
        }));
      }

      // A couple of extra guests keep the social rooms lively.
      const social = rooms.filter(r => r.social && r.type !== 'bathroom');
      for (let i = 0; i < 2 && social.length; i++) {
        const room = rng.pick(social);
        const p = spot(room, null, 380);
        this.npcs.push(new VC.NPC({
          id: this.npcs.length, name: name(), role: 'civilian', outfitId: 'guest',
          x: p.x, y: p.y, homeRoom: room, patrolRooms: [room],
          tint: rng.pick(['#6b5140', '#4c5a5f', '#74545c', '#565049', '#6d5b3e'])
        }));
      }

      // Shuffle draw order-friendly; the drawing loop sorts by Y anyway.
      this.npcs.sort((a, b) => a.id - b.id);
    }

    getTarget() { return this.npcs.find(n => n.role === 'target' && n.alive) || this.npcs.find(n => n.role === 'target'); }

    // ---------------------------------------------------------------- input
    onKeyDown(code, e) {
      if (this.state === 'menu') {
        if (code === 'Enter') { $('startBtn').click(); }
        return;
      }
      if (this.state === 'briefing') {
        if (code === 'Enter' || code === 'Space') { this.beginPlay(); }
        if (code === 'Escape') this.showMenu();
        return;
      }
      if (this.mapOpen) {
        if (code === 'KeyM' || code === 'Escape') this.toggleMap();
        return;
      }
      if (code === 'Escape') {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        else if (this.state === 'results' || this.state === 'failed') this.showMenu();
        return;
      }
      if (this.state === 'results') {
        if (code === 'Enter') $('newContractBtn').click();
        return;
      }
      if (this.state === 'failed') {
        if (code === 'Enter') $('failRetryBtn').click();
        return;
      }
      if (this.state !== 'playing') return;
      if (code === 'KeyM') { this.toggleMap(); return; }
      if (code === 'KeyE') { this.interact(); return; }
      if (code === 'KeyF') { this.toggleDrag(); return; }
      if (code === 'Space') { this.attack(); return; }
    }

    // --------------------------------------------------------------- mission
    update(dt) {
      if (!this.level || this.state !== 'playing') return;
      this.stats.time += dt;
      this.player.update(dt, this, this.input);
      this.updateBlend();
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        this.updateNPCPerception(npc, dt);
        npc.update(dt, this);
      }
      this.updateBodyDiscovery(dt);
      this.updateMissionObjects(dt);
      this.updateParticles(dt);
      this.updateCamera(dt, false);
      this.updateContext();
      this.updateHUD();
    }

    updateOutro(dt) {
      this.completeTimer -= dt;
      this.updateParticles(dt);
      this.updateCamera(dt, false);
      for (const npc of this.npcs) if (npc.alive) npc.update(dt, this);
      if (this.completeTimer <= 0) this.showResults();
    }

    updateBlend() {
      const p = this.player;
      const room = this.level.roomAtWorld(p.x, p.y);
      const outfit = VC.OUTFITS[p.outfitId];
      let blend = false;
      if (room && !this.alarm && outfit.social && !p.dragBody && !p.moving && room.zone !== 'security') {
        for (const npc of this.npcs) {
          if (!npc.alive || npc.role === 'guard' || npc.role === 'bodyguard' || npc.role === 'target') continue;
          if (dist(p.x, p.y, npc.x, npc.y) < 105 && this.level.lineOfSight(p.x, p.y, npc.x, npc.y)) {
            blend = true; break;
          }
        }
      }
      p.blend = blend;
    }

    npcSeesPoint(npc, x, y, range, fov) {
      const d = dist(npc.x, npc.y, x, y);
      if (d > range) return false;
      const a = Math.atan2(y - npc.y, x - npc.x);
      if (Math.abs(angleDiff(a, npc.angle)) > fov / 2) return false;
      return true;
    }

    canSeePlayer(npc) {
      const p = this.player;
      let range = npc.visionRange;
      if (p.crouching) range *= 0.72;
      if (p.blend) range *= 0.5;
      if (p.sprinting) range *= 1.13;
      if (p.dragBody) range *= 1.15;
      if (!this.npcSeesPoint(npc, p.x, p.y, range, npc.fov)) return false;
      return this.level.lineOfSight(npc.x, npc.y, p.x, p.y);
    }

    playerTrespassing() {
      const room = this.level.roomAtWorld(this.player.x, this.player.y);
      if (!room) return false;
      return !this.player.hasAccess(room.zone);
    }

    updateNPCPerception(npc, dt) {
      if (!npc.alive) return;
      const p = this.player;
      if (npc.role === 'target') {
        // Targets do not police fashion; they do react to violence.
        if (npc.state === 'flee' || npc.cower) return;
        if (this.canSeePlayer(npc) && (p.attackTimer > 0 || p.dragBody)) {
          this.targetWitness(npc);
        }
        return;
      }
      if (npc.state === 'chase') { npc.awareness = 100; return; }
      const sees = this.canSeePlayer(npc);
      if (sees) {
        const room = this.level.roomAtWorld(p.x, p.y);
        const trespass = room ? !p.hasAccess(room.zone) : false;
        let rate = 0;
        let severe = false;
        if (p.attackTimer > 0) { severe = true; rate = 260; }
        if (p.dragBody) rate += npc.role === 'guard' ? 52 : 36;
        if (trespass) rate += npc.role === 'guard' ? (p.crouching ? 18 : 29) : 13;
        if (trespass && p.sprinting) rate += 10;
        // Standing over an undiscovered body is its own confession.
        for (const b of this.bodies) {
          if (b.hidden || b.discovered) continue;
          if (dist(p.x, p.y, b.x, b.y) < 85) { rate += 44; break; }
        }
        if (severe) {
          this.witnessCrime('kill', p.x, p.y, 600, npc);
          npc.awareness = 100;
          this.alertNPC(npc, p.x, p.y);
          return;
        }
        if (rate > 0) {
          npc.awareness = Math.min(100, npc.awareness + rate * dt);
          if (npc.awareness > 44 && (npc.state === 'patrol' || npc.state === 'suspicious')) {
            npc.state = 'suspicious';
            npc.scanBase = npc.angle;
            npc.waitTimer = 0.7;
          }
          if (npc.awareness >= 100) {
            this.alertNPC(npc, p.x, p.y);
          }
        } else {
          npc.awareness = Math.max(0, npc.awareness - 8 * dt);
        }
      } else {
        npc.awareness = Math.max(0, npc.awareness - 26 * dt);
        if (npc.state === 'suspicious' && npc.awareness < 7) npc.state = 'patrol';
      }
    }

    targetWitness(npc) {
      if (npc.state === 'flee') return;
      npc.state = 'flee';
      npc.lastSeen = { x: this.player.x, y: this.player.y };
      this.raiseAlarm('The target saw you.', this.player.x, this.player.y);
      this.witnessSet.add(npc.id);
      this.stats.witnesses = Math.max(this.stats.witnesses, this.witnessSet.size);
    }

    alertNPC(npc, x, y) {
      if (!npc.alive) return;
      if (npc.role === 'guard' || npc.role === 'bodyguard') {
        if (!npc.alerted) npc.alertPulse = 1;
        npc.alerted = true;
        npc.state = 'chase';
        npc.awareness = 100;
        npc.lastSeen = { x: x !== undefined ? x : this.player.x, y: y !== undefined ? y : this.player.y };
        npc.investigateTimer = 14;
        this.raiseAlarm('A guard is on to you.', npc.lastSeen.x, npc.lastSeen.y);
      } else {
        if (npc.state !== 'panic') {
          npc.state = 'panic';
          npc.panicTimer = 7 + Math.random() * 3;
          npc.panicTarget = null;
        }
        this.raiseAlarm('A guest raised the alarm.', npc.x, npc.y);
      }
    }

    raiseAlarm(reason, x, y) {
      if (!this.alarm) {
        this.alarm = true;
        this.stats.alerts++;
        this.audio.alert();
        this.banner('ALARM RAISED', reason || 'The floor knows.', 2600);
        $('vignette').classList.add('alert');
      }
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        if (npc.role === 'guard' || npc.role === 'bodyguard') {
          if (npc.state !== 'chase') {
            npc.state = 'investigate';
            npc.alerted = true;
            npc.awareness = Math.max(npc.awareness, 82);
            npc.lastSeen = { x: x !== undefined ? x : this.player.x, y: y !== undefined ? y : this.player.y };
            npc.investigateTimer = 14;
          }
        }
        if (npc.role === 'target' && !npc.cower) {
          npc.state = 'flee';
        }
      }
    }

    witnessCrime(kind, x, y, radius, primaryNpc) {
      radius = radius || 540;
      let seen = false;
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        if (primaryNpc && npc === primaryNpc) continue;
        if (npc.role === 'target') {
          if (npc.state === 'flee' || npc.cower) continue;
          if (this.npcSeesPoint(npc, x, y, Math.min(radius, npc.visionRange), npc.fov) && this.level.lineOfSight(npc.x, npc.y, x, y)) {
            this.targetWitness(npc); seen = true;
          }
          continue;
        }
        if (npc.state === 'panic' || npc.state === 'cower') { seen = true; continue; }
        const range = Math.min(radius, npc.visionRange * 1.15);
        if (this.npcSeesPoint(npc, x, y, range, npc.fov) && this.level.lineOfSight(npc.x, npc.y, x, y)) {
          this.witnessSet.add(npc.id);
          this.stats.witnesses = this.witnessSet.size;
          if (npc.role === 'guard' || npc.role === 'bodyguard') this.alertNPC(npc, x, y);
          else {
            npc.state = 'panic';
            npc.panicTimer = 7 + Math.random() * 4;
            this.raiseAlarm('A witness saw everything.', x, y);
          }
          seen = true;
        }
      }
      return seen;
    }

    updateBodyDiscovery(dt) {
      for (const body of this.bodies) {
        if (body.hidden || body.discovered) continue;
        for (const npc of this.npcs) {
          if (!npc.alive || npc.role === 'target') continue;
          const d = dist(npc.x, npc.y, body.x, body.y);
          if (d > npc.visionRange * 0.95) continue;
          if (!this.npcSeesPoint(npc, body.x, body.y, npc.visionRange, npc.fov)) continue;
          if (!this.level.lineOfSight(npc.x, npc.y, body.x, body.y)) continue;
          body.discovered = true;
          this.stats.bodiesFound++;
          if (npc.role === 'guard' || npc.role === 'bodyguard') {
            this.alertNPC(npc, body.x, body.y);
            this.toast('A body has been discovered.');
          } else {
            npc.state = 'panic';
            npc.panicTimer = 8 + Math.random() * 3;
            this.raiseAlarm('A body has been discovered.', body.x, body.y);
            this.toast('A guest found the body.');
          }
          break;
        }
      }
    }

    updateMissionObjects(dt) {
      const target = this.getTarget();
      // Poison progresses quietly, then takes the target.
      if (this.poisonTimer > 0) {
        this.poisonTimer -= dt;
        if (this.poisonTimer <= 0 && target && target.alive) {
          this.killNPC(target, 'poison', { silent: true });
        }
      }
      // Armed environmental traps trigger when the target enters the danger radius.
      for (const trap of this.level.traps) {
        if (!trap.armed || trap.triggered) continue;
        if (!target || !target.alive) continue;
        const sameRoom = this.level.roomAtWorld(target.x, target.y) === this.level.getRoomById(trap.roomId);
        if (sameRoom && dist(target.x, target.y, trap.x, trap.y) <= trap.radius) {
          trap.triggered = true;
          this.triggerTrap(trap, target);
        }
      }
    }

    triggerTrap(trap, target) {
      this.audio.sabotage();
      const colors = { chandelier: '#f0cf87', electrical: '#94d7e8', crate: '#c08b56', gas: '#e28259', steam: '#c9e4e9' };
      this.spawnSparks(trap.x, trap.y, colors[trap.type] || '#e2c17a', 32);
      this.spawnSparks(trap.x, trap.y, '#ffffff', 12);
      this.shake = Math.max(this.shake, 9);
      if (target) this.killNPC(target, 'trap', { silent: true, trap });
    }

    // -------------------------------------------------------------- combat
    attack() {
      if (this.state !== 'playing') return;
      const p = this.player;
      if (p.attackCooldown > 0) return;
      p.attackCooldown = 0.52;
      p.attackTimer = 0.26;
      this.audio.knife();
      let best = null, bestD = 999;
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        const d = dist(p.x, p.y, npc.x, npc.y);
        if (d > 64) continue;
        const a = Math.atan2(npc.y - p.y, npc.x - p.x);
        if (Math.abs(angleDiff(a, p.angle)) > 1.4) continue;
        if (!this.level.lineOfSight(p.x, p.y, npc.x, npc.y)) continue;
        if (d < bestD) { best = npc; bestD = d; }
      }
      if (best) {
        this.killNPC(best, 'blade');
      } else {
        this.spawnSparks(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#9aa2a4', 3);
      }
    }

    killNPC(npc, method, opts) {
      opts = opts || {};
      if (!npc.alive) return;
      npc.alive = false;
      const body = new VC.Body(npc);
      body.method = method;
      this.bodies.push(body);
      this.stats.kills++;
      if (method === 'blade') {
        this.spawnBlood(npc.x, npc.y, npc.angle);
      } else if (method === 'poison') {
        this.spawnSparks(npc.x, npc.y, '#86b68e', 8);
      }
      const target = npc.role === 'target';
      if (target) {
        this.targetDead = true;
        this.stats.method = method;
        this.stats.accident = method === 'poison' || method === 'trap';
        let title = 'TARGET ELIMINATED';
        let sub = method === 'blade' ? 'CONTRACT CLOSED · BLADE' : method === 'poison' ? 'CONTRACT CLOSED · POISON' : 'CONTRACT CLOSED · ACCIDENT';
        if (method === 'poison') { title = 'A QUIET DEATH'; sub = 'POISON · NO WITNESSES TO THE ACT'; }
        if (method === 'trap') { title = 'A TRAGIC ACCIDENT'; sub = (opts.trap && opts.trap.def ? opts.trap.def.verb : 'THE FLOOR DID THE WORK').toUpperCase(); }
        this.banner(title, sub, 3200);
        this.audio.success();
        this.completeTimer = 2.8;
        this.state = 'outro';
        this.updateHUD();
      } else {
        this.stats.nonTargetKills++;
        if (method === 'blade' && !opts.silent) {
          const seen = this.witnessCrime('kill', npc.x, npc.y, 540);
          if (!seen) this.toast('A silent kill. No one saw it.');
          else this.toast('Someone saw the strike.');
        }
      }
      if (method === 'blade' && !target) {
        // The body makes noise as it drops, but the victim is the only certainty.
        this.spawnSparks(npc.x, npc.y, '#7f2f2c', 7);
      }
    }

    guardShoot(npc) {
      if (!npc.alive || this.state !== 'playing') return;
      this.audio.shoot();
      const mx = npc.x + Math.cos(npc.angle) * 18;
      const my = npc.y + Math.sin(npc.angle) * 18;
      this.spawnMuzzle(mx, my, npc.angle);
      this.shake = Math.max(this.shake, 4);
      const d = dist(npc.x, npc.y, this.player.x, this.player.y);
      const hitChance = clamp(0.92 - d / 1200, 0.45, 0.9);
      if (Math.random() < hitChance) {
        this.player.hurt(8 + Math.random() * 11, this);
        this.spawnBlood(this.player.x, this.player.y, this.player.angle, 6);
      } else {
        this.toast('A shot tears past you.', 900);
      }
    }

    // ---------------------------------------------------------- interaction
    nearestBody(maxDist) {
      let best = null, bd = maxDist * maxDist;
      for (const b of this.bodies) {
        if (b.hidden) continue;
        const d = U.dist2(this.player.x, this.player.y, b.x, b.y);
        if (d < bd && this.level.lineOfSight(this.player.x, this.player.y, b.x, b.y)) { bd = d; best = b; }
      }
      return best;
    }

    nearestProp(kind, maxDist, predicate) {
      let best = null, bd = maxDist * maxDist;
      for (const prop of this.level.props) {
        if (prop.kind !== kind) continue;
        if (predicate && !predicate(prop)) continue;
        const d = U.dist2(this.player.x, this.player.y, prop.x, prop.y);
        if (d < bd && this.level.lineOfSight(this.player.x, this.player.y, prop.x, prop.y)) { bd = d; best = prop; }
      }
      return best;
    }

    updateContext() {
      const p = this.player;
      const actions = [];
      let fAction = null;
      if (p.dragBody) {
        const c = this.level.nearestContainerTo(p.x, p.y, 118);
        const room = this.level.roomAtWorld(p.x, p.y);
        if (c && room && room.id === c.piece.roomId) actions.push({
          kind: 'hide', key: 'E', label: 'Hide body in ' + (c.piece.containerName || 'container'), object: c.piece, distance: 1
        });
        fAction = { kind: 'drop', key: 'F', label: 'Drop body' };
      } else {
        const body = this.nearestBody(80);
        if (body && !body.looted && body.outfitId !== p.outfitId) {
          actions.push({
            kind: 'loot', key: 'E', label: 'Take ' + VC.OUTFITS[body.outfitId].label + ' uniform',
            object: body, priority: 5
          });
        }
        if (body) fAction = { kind: 'drag', key: 'F', label: 'Drag body', object: body };
      }
      const glass = this.nearestProp('glass', 108, g => !g.poisoned);
      if (glass && p.poison > 0) actions.push({ kind: 'poisonGlass', key: 'E', label: 'Poison the target\'s glass', object: glass, priority: 2 });
      const trap = this.nearestProp('trap', 78, t => !t.armed && !t.triggered);
      if (trap) actions.push({ kind: 'sabotage', key: 'E', label: trap.action, object: trap, priority: 3 });
      const poison = this.nearestProp('poison', 62, x => !x.used);
      if (poison) actions.push({ kind: 'takePoison', key: 'E', label: 'Pocket the ' + poison.name, object: poison, priority: 4 });
      const outfit = this.nearestProp('outfit', 62, x => !x.used);
      if (outfit && outfit.outfit !== p.outfitId) actions.push({ kind: 'outfit', key: 'E', label: 'Wear ' + VC.OUTFITS[outfit.outfit].label + ' uniform', object: outfit, priority: 4 });
      actions.sort((a, b) => (a.priority || 5) - (b.priority || 5));

      const eAction = actions.length ? actions[0] : null;
      const htmlParts = [];
      if (eAction) htmlParts.push(`<div class="prompt"><kbd>${eAction.key}</kbd><span>${eAction.label}</span></div>`);
      if (fAction) htmlParts.push(`<div class="prompt"><kbd>${fAction.key}</kbd><span>${fAction.label}</span></div>`);
      // A contextual attack prompt only when someone is within knife range.
      const close = this.npcs.find(n => n.alive && dist(p.x, p.y, n.x, n.y) < 64);
      if (close) htmlParts.push(`<div class="prompt"><kbd>SPACE</kbd><span>${close.role === 'target' ? '<em>Eliminate target</em>' : 'Blade'}</span></div>`);
      const html = htmlParts.join('');
      if (html !== this.contextHtml) {
        this.contextHtml = html;
        $('promptArea').innerHTML = html;
      }
      this._eAction = eAction;
      this._fAction = fAction;
    }

    interact() {
      if (!this._eAction) {
        // A subtle feedback for pressing E with nothing nearby.
        return;
      }
      const a = this._eAction;
      const p = this.player;
      if (a.kind === 'hide') {
        const body = p.dragBody;
        if (!body) return;
        body.hidden = true;
        body.beingDragged = false;
        p.dragBody = null;
        this.stats.bodiesHidden++;
        this.audio.hide();
        this.spawnSparks(a.object.x + a.object.w / 2, a.object.y + a.object.h / 2, '#c7b47d', 8);
        this.toast('Body concealed in the ' + (a.object.containerName || 'container') + '.');
      } else if (a.kind === 'loot') {
        const body = a.object;
        body.looted = true;
        this.setOutfit(body.outfitId, true);
        this.toast((VC.OUTFITS[body.outfitId].label) + ' uniform acquired.');
      } else if (a.kind === 'outfit') {
        a.object.used = true;
        this.setOutfit(a.object.outfit, true);
      } else if (a.kind === 'takePoison') {
        a.object.used = true;
        p.poison++;
        this.audio.pickup();
        this.toast('Poison acquired — find the target\'s glass.');
        $('poisonCount').textContent = p.poison + ' vial' + (p.poison > 1 ? 's' : '');
      } else if (a.kind === 'poisonGlass') {
        if (p.poison <= 0) return;
        p.poison--;
        a.object.poisoned = true;
        this.stats.poisoned = true;
        this.poisonTimer = 10 + this.rng.range(0, 6);
        this.audio.poison();
        const seen = this.witnessCrime('poison', a.object.x, a.object.y, 440);
        this.toast(seen ? 'The glass is poisoned — but someone noticed you.' : 'The glass is poisoned. Now wait.');
        $('poisonCount').textContent = p.poison ? p.poison + ' vial' : 'No poison';
      } else if (a.kind === 'sabotage') {
        a.object.armed = true;
        this.audio.sabotage();
        const seen = this.witnessCrime('sabotage', a.object.x, a.object.y, 420);
        this.toast(seen ? a.object.action + ' — a guard saw you.' : a.object.action + ' rigged. Lure the target close.');
      }
    }

    toggleDrag() {
      const p = this.player;
      if (p.dragBody) {
        p.dragBody.beingDragged = false;
        p.dragBody.x = p.x - Math.cos(p.angle) * 13;
        p.dragBody.y = p.y - Math.sin(p.angle) * 13;
        p.dragBody = null;
        this.toast('Body dropped.');
        return;
      }
      const body = this.nearestBody(92);
      if (body) {
        p.dragBody = body;
        body.beingDragged = true;
        this.audio.noise(0.12, 0.03, 290);
        this.toast('Dragging body. Move slowly — and find a container.');
      }
    }

    setOutfit(id, track) {
      if (!id || id === this.player.outfitId) return;
      this.player.outfitId = id;
      if (track) {
        if (!this.outfitsWorn.has(id)) {
          this.outfitsWorn.add(id);
          this.stats.disguises++;
        }
      }
      this.audio.outfit();
      const o = VC.OUTFITS[id];
      this.toast(o.label + ' · ' + o.desc, 3000);
      $('outfitName').textContent = o.label;
      $('outfitSwatch').style.background = o.color;
      this.updateHUD();
    }

    // --------------------------------------------------------------- failure
    fail(title, text) {
      if (this.state === 'results' || this.state === 'failed') return;
      this.state = 'failed';
      this.audio.fail();
      this.audio.stopAmbient();
      $('vignette').classList.remove('alert');
      $('failTitle').textContent = title || 'The operation failed';
      $('failText').textContent = text || 'The floor closed around you.';
      $('hud').classList.add('hidden');
      $('failScreen').classList.remove('hidden');
      $('targetHudSub').textContent = 'Contract compromised';
    }

    // --------------------------------------------------------------- results
    showResults() {
      if (this.state !== 'outro') return;
      this.state = 'results';
      this.audio.stopAmbient();
      $('vignette').classList.remove('alert');
      $('hud').classList.add('hidden');
      const method = this.stats.method;
      const accidental = method === 'poison' || method === 'trap';
      const time = Math.floor(this.stats.time);
      const lines = [];
      lines.push({ label: 'Target eliminated', value: 5000 });
      if (accidental) lines.push({ label: 'Accidental death', value: 2500 });
      if (this.stats.nonTargetKills === 0) lines.push({ label: 'No collateral kills', value: 2000 });
      else lines.push({ label: 'Collateral kills ×' + this.stats.nonTargetKills, value: -1000 * this.stats.nonTargetKills });
      if (this.stats.alerts === 0) lines.push({ label: 'No alarm raised', value: 3000 });
      else lines.push({ label: 'Alarms raised ×' + this.stats.alerts, value: -1000 * this.stats.alerts });
      if (this.stats.bodiesHidden) lines.push({ label: 'Bodies concealed', value: this.stats.bodiesHidden * 500 });
      if (this.stats.disguises) lines.push({ label: 'Disguise changes', value: Math.min(1000, this.stats.disguises * 250) });
      const timeBonus = Math.max(0, 2400 - time * 10);
      lines.push({ label: 'Time bonus', value: timeBonus });
      const total = Math.max(0, lines.reduce((s, l) => s + l.value, 0));
      let rank, stars;
      if (total >= 15000) { rank = 'SILENT ASSASSIN'; stars = 5; }
      else if (total >= 12500) { rank = 'GHOST'; stars = 4; }
      else if (total >= 10000) { rank = 'PROFESSIONAL'; stars = 4; }
      else if (total >= 7500) { rank = 'OPERATIVE'; stars = 3; }
      else if (total >= 5000) { rank = 'ROGUE'; stars = 2; }
      else { rank = 'MESSY'; stars = 1; }

      const titles = {
        poison: ['A Quiet Poisoning', 'No one saw the hand that tipped the glass.'],
        trap: ['A Tragic Accident', 'The room did the work. You were only a witness.'],
        blade: ['Target Eliminated', 'The contract is closed. The blade was close enough.']
      };
      const tt = titles[method] || titles.blade;
      $('resultTitle').textContent = tt[0];
      $('resultSubtitle').textContent = this.stats.alerts === 0
        ? 'The floor never knew your name.'
        : 'The floor knows your face. The contract is still closed.';
      $('rankName').textContent = rank;
      $('rankStars').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      $('scoreLines').innerHTML = lines.map(l => {
        const shown = l.value > 0 ? '+' + l.value.toLocaleString() : l.value < 0 ? '−' + Math.abs(l.value).toLocaleString() : '0';
        return `<div class="score-line"><span class="sl-left"><i class="sl-dot"></i>${l.label}</span><b class="${l.value < 0 ? 'neg' : ''}">${shown}</b></div>`;
      }).join('');
      $('statGrid').innerHTML = [
        ['Time', formatTime(this.stats.time)],
        ['Alerts', String(this.stats.alerts)],
        ['Witnesses', String(this.stats.witnesses)],
        ['Collateral', String(this.stats.nonTargetKills)],
        ['Concealed', String(this.stats.bodiesHidden)],
        ['Disguises', String(this.stats.disguises)]
      ].map(([a, b]) => `<div class="stat-item"><span>${a}</span><b>${b}</b></div>`).join('');
      $('resultSeed').textContent = `${this.theme.name} · ${this.theme.city} · SEED ${this.currentSeed}`;
      $('resultEyebrow').textContent = this.stats.alerts ? 'CONTRACT COMPLETE · COMPROMISED' : 'CONTRACT COMPLETE · CLEAN';
      this.animateScore(total);
      $('resultScreen').classList.remove('hidden');
      this.audio.success();
    }

    animateScore(total) {
      const el = $('scoreTotal');
      el.textContent = total.toLocaleString();
      el.classList.remove('score-pop');
      // Force a reflow so the reveal animation can retrigger between contracts.
      void el.offsetWidth;
      el.classList.add('score-pop');
    }

    // ---------------------------------------------------------------- camera
    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.minimap.width = 436;
      this.minimap.height = 290;
      this.baseZoom = clamp(Math.min(this.width / 1480, this.height / 880), 0.72, 1.12);
      if (this.level && this.player) this.updateCamera(1, true);
    }

    updateCamera(dt, snap) {
      if (!this.level || !this.player) return;
      const zoom = this.baseZoom * this.userZoom;
      const viewW = this.width / zoom, viewH = this.height / zoom;
      let tx = this.player.x - viewW / 2;
      let ty = this.player.y - viewH / 2;
      tx = clamp(tx, 0, Math.max(0, this.level.pxW - viewW));
      ty = clamp(ty, 0, Math.max(0, this.level.pxH - viewH));
      const k = snap ? 1 : 1 - Math.pow(0.0015, dt);
      this.camera.x = lerp(this.camera.x, tx, k);
      this.camera.y = lerp(this.camera.y, ty, k);
      this.camera.zoom = zoom;
      if (snap) { this.camera.x = tx; this.camera.y = ty; }
    }

    worldView() {
      const z = this.camera.zoom;
      return { x: this.camera.x, y: this.camera.y, w: this.width / z, h: this.height / z, z };
    }

    inView(x, y, margin) {
      margin = margin || 80;
      const v = this.worldView();
      return x > v.x - margin && x < v.x + v.w + margin && y > v.y - margin && y < v.y + v.h + margin;
    }

    // --------------------------------------------------------------- effects
    spawnDust(x, y, angle) {
      for (let i = 0; i < 2; i++) {
        this.particles.push(new VC.Particle({
          x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
          vx: -Math.cos(angle) * 15 + (Math.random() - 0.5) * 15,
          vy: -Math.sin(angle) * 15 + (Math.random() - 0.5) * 15,
          life: 0.35 + Math.random() * 0.18, size: 3 + Math.random() * 4,
          color: 'rgba(210,195,165,.25)', alpha: 0.38
        }));
      }
    }
    spawnBlood(x, y, angle, count) {
      count = count || 13;
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * 2.2;
        const sp = 35 + Math.random() * 120;
        this.particles.push(new VC.Particle({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.4 + Math.random() * 0.5, size: 1.5 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#7a171a' : '#a22a2e', gravity: 90, drag: 0.9
        }));
      }
    }
    spawnSparks(x, y, color, count) {
      for (let i = 0; i < (count || 10); i++) {
        const a = Math.random() * U.TAU, sp = 30 + Math.random() * 170;
        this.particles.push(new VC.Particle({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.25 + Math.random() * 0.45, size: 1 + Math.random() * 2.2,
          color: color || '#e6c172', gravity: 50, drag: 0.92
        }));
      }
    }
    spawnMuzzle(x, y, angle) {
      for (let i = 0; i < 6; i++) {
        const a = angle + (Math.random() - 0.5) * 0.35, sp = 350 + Math.random() * 250;
        this.particles.push(new VC.Particle({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.06 + Math.random() * 0.09, size: 2, color: '#ffd786',
          shape: 'line', alpha: 0.9
        }));
      }
      this.particles.push(new VC.Particle({ x, y, life: 0.08, size: 9, color: '#ffe2a1' }));
    }
    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        if (!this.particles[i].update(dt)) this.particles.splice(i, 1);
      }
      this.shake = Math.max(0, this.shake - dt * 24);
    }

    // --------------------------------------------------------------- render
    loop(now) {
      const dt = Math.min(0.05, Math.max(0, (now - this._lastTime) / 1000));
      this._lastTime = now;
      if (this.state === 'playing' && !this.mapOpen) {
        this.update(dt);
      } else if (this.state === 'outro' && !this.mapOpen) {
        this.updateOutro(dt);
      }
      if (this.level) this.render();
      if (this.state === 'playing' && !this.mapOpen) {
        this.drawMinimap();
      }
      requestAnimationFrame((t) => this.loop(t));
    }

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      if (!this.level) return;
      const z = this.camera.zoom;
      const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
      const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
      const view = this.worldView();
      ctx.save();
      ctx.translate(-this.camera.x * z + shakeX, -this.camera.y * z + shakeY);
      ctx.scale(z, z);
      ctx.imageSmoothingEnabled = true;
      const sx = clamp(Math.floor(view.x) - 48, 0, Math.max(0, this.level.pxW - 1));
      const sy = clamp(Math.floor(view.y) - 48, 0, Math.max(0, this.level.pxH - 1));
      const sw = clamp(Math.ceil(view.w) + 96, 1, this.level.pxW - sx);
      const sh = clamp(Math.ceil(view.h) + 96, 1, this.level.pxH - sy);
      ctx.drawImage(this.level.staticCanvas, sx, sy, sw, sh, sx, sy, sw, sh);

      const visible = (x, y, margin) => x > view.x - (margin || 100) && x < view.x + view.w + (margin || 100) && y > view.y - (margin || 100) && y < view.y + view.h + (margin || 100);

      // Vision cones lie beneath every actor.
      for (const npc of this.npcs) {
        if (npc.alive && visible(npc.x, npc.y, 260)) npc.drawVision(ctx, this, this.player);
      }

      // Props.
      for (const prop of this.level.props) this.drawProp(ctx, prop, visible);

      // Bodies.
      for (const body of this.bodies) if (!body.hidden && visible(body.x, body.y, 70)) body.draw(ctx, this);

      // Actors, sorted by Y so foreground actors overlap background actors.
      const actors = [];
      for (const npc of this.npcs) if (npc.alive && visible(npc.x, npc.y, 90)) actors.push(npc);
      actors.push(this.player);
      actors.sort((a, b) => a.y - b.y);
      for (const a of actors) {
        if (a === this.player) a.draw(ctx, this);
        else a.draw(ctx, this, this.player);
      }

      // Particles.
      for (const p of this.particles) if (visible(p.x, p.y, 60)) p.draw(ctx);

      ctx.restore();

      // Screen-space target direction marker.
      this.drawTargetIndicator(ctx);

      // A restrained grain/light overlay baked into the game view.
      const vg = ctx.createRadialGradient(this.width * 0.5, this.height * 0.48, Math.min(this.width, this.height) * 0.18, this.width * 0.5, this.height * 0.48, Math.max(this.width, this.height) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.7, 'rgba(0,0,0,.05)');
      vg.addColorStop(1, 'rgba(0,0,0,.34)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    drawProp(ctx, prop, visible) {
      if (prop.used) return;
      if (prop.kind === 'glass' && prop.poisoned) {
        // Poisoned glasses remain interactive-looking but no longer actionable.
      }
      if (!visible(prop.x, prop.y, 80)) return;
      const t = performance.now() / 1000;
      const pulse = 0.5 + Math.sin(t * 2.2 + prop.x) * 0.2;
      ctx.save();
      ctx.translate(prop.x, prop.y);
      if (prop.kind === 'outfit') {
        const o = VC.OUTFITS[prop.outfit];
        ctx.strokeStyle = `rgba(229,200,123,${0.18 + pulse * 0.12})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 20 + pulse * 4, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(8,10,14,.8)'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, U.TAU); ctx.fill();
        // Hanger + folded garment.
        ctx.strokeStyle = '#b9a36f'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -7, 4, Math.PI * 0.2, Math.PI * 1.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 1); ctx.stroke();
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(9, 2); ctx.lineTo(7, 11); ctx.lineTo(-7, 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = o.trim; ctx.fillRect(-1, 2, 2, 9);
        if (dist(this.player.x, this.player.y, prop.x, prop.y) < 160) {
          ctx.font = '600 8px "Avenir Next", sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(238,227,199,.85)';
          ctx.fillText(o.short + ' UNIFORM', 0, -27);
        }
      } else if (prop.kind === 'poison') {
        ctx.strokeStyle = `rgba(144,198,157,${0.2 + pulse * 0.22})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 18 + pulse * 3, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(8,10,14,.8)'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#7fb57f'; ctx.fillRect(-5, -7, 10, 16);
        ctx.fillStyle = '#d0dfc0'; ctx.fillRect(-5, -10, 10, 3);
        ctx.fillStyle = '#3c6a4e'; ctx.fillRect(-3, -3, 6, 9);
        ctx.fillStyle = '#b8d7a8'; ctx.fillRect(-2, -2, 2, 6);
        if (dist(this.player.x, this.player.y, prop.x, prop.y) < 150) {
          ctx.font = '600 8px "Avenir Next", sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(190,220,192,.9)'; ctx.fillText('POISON', 0, -25);
        }
      } else if (prop.kind === 'glass') {
        ctx.strokeStyle = prop.poisoned ? 'rgba(138,196,145,.75)' : `rgba(231,200,125,${0.24 + pulse * 0.22})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 18 + pulse * 2, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(8,10,14,.65)'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(230,224,203,.5)'; ctx.beginPath();
        ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(3, 7); ctx.lineTo(-3, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = prop.poisoned ? 'rgba(114,183,126,.85)' : 'rgba(205,152,61,.85)';
        ctx.fillRect(-3.4, 1, 6.8, 5);
        ctx.strokeStyle = 'rgba(235,229,211,.55)'; ctx.strokeRect(-4.5, -6, 9, 13);
        if (dist(this.player.x, this.player.y, prop.x, prop.y) < 165) {
          ctx.font = '600 8px "Avenir Next", sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = prop.poisoned ? 'rgba(164,214,169,.9)' : 'rgba(232,203,136,.8)';
          ctx.fillText(prop.poisoned ? 'GLASS · POISONED' : "TARGET'S GLASS", 0, -25);
        }
      } else if (prop.kind === 'trap') {
        const armed = prop.armed;
        const col = armed ? '226,109,75' : '211,183,113';
        ctx.strokeStyle = `rgba(${col},${armed ? 0.45 + pulse * 0.35 : 0.15 + pulse * 0.12})`;
        ctx.lineWidth = armed ? 2 : 1.2;
        ctx.beginPath(); ctx.arc(0, 0, armed ? 22 + pulse * 7 : 18, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(8,10,14,.7)'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, U.TAU); ctx.fill();
        drawTrapIcon(ctx, prop.type, armed);
        if (dist(this.player.x, this.player.y, prop.x, prop.y) < 180) {
          ctx.font = '600 8px "Avenir Next", sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = armed ? 'rgba(244,157,122,.95)' : 'rgba(224,205,156,.85)';
          ctx.fillText((armed ? 'ARMED · ' : '') + prop.label.toUpperCase(), 0, -27);
        }
      }
      ctx.restore();
    }

    drawTargetIndicator(ctx) {
      if (!this.level || !this.target || !this.target.alive) return;
      const z = this.camera.zoom;
      const sx = (this.target.x - this.camera.x) * z;
      const sy = (this.target.y - this.camera.y) * z;
      const pad = 54;
      if (sx > pad && sx < this.width - pad && sy > pad && sy < this.height - pad) return;
      const cx = this.width / 2, cy = this.height / 2;
      const angle = Math.atan2(sy - cy, sx - cx);
      const rx = this.width / 2 - pad, ry = this.height / 2 - pad;
      const scale = Math.min(
        Math.abs(rx / (Math.cos(angle) || 0.0001)),
        Math.abs(ry / (Math.sin(angle) || 0.0001))
      );
      const x = cx + Math.cos(angle) * scale;
      const y = cy + Math.sin(angle) * scale;
      const d = Math.round(dist(this.player.x, this.player.y, this.target.x, this.target.y) / 10);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(226,184,76,.8)';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 5); ctx.lineTo(0, 2); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.font = '8px "SFMono-Regular", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(235,214,156,.7)';
      ctx.fillText('TARGET · ' + d + 'm', x, y + 21);
      ctx.restore();
    }

    // --------------------------------------------------------------- minimap
    drawMinimap() {
      if (!this.level) return;
      const ctx = this.miniCtx;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 218, 145);
      ctx.fillStyle = '#080b10'; ctx.fillRect(0, 0, 218, 145);
      const scale = Math.min(204 / this.level.pxW, 131 / this.level.pxH);
      const ox = (218 - this.level.pxW * scale) / 2;
      const oy = (145 - this.level.pxH * scale) / 2;
      const tx = (x) => ox + x * scale;
      const ty = (y) => oy + y * scale;
      // Corridor.
      ctx.fillStyle = 'rgba(123,111,84,.32)';
      ctx.fillRect(tx((this.level.bx + 2) * T), ty(this.level.cy * T), (this.level.bw - 4) * T * scale, 3 * T * scale);
      // Rooms.
      for (const room of this.level.rooms) {
        const zone = VC.ZONES[room.zone];
        ctx.fillStyle = zone.color + '30';
        ctx.fillRect(tx(room.x * T), ty(room.y * T), room.w * T * scale, room.h * T * scale);
        ctx.strokeStyle = zone.color + '70'; ctx.lineWidth = 0.5;
        ctx.strokeRect(tx(room.x * T), ty(room.y * T), room.w * T * scale, room.h * T * scale);
      }
      // Doors.
      ctx.fillStyle = 'rgba(218,184,102,.4)';
      for (const d of this.level.doors) ctx.fillRect(tx(d.x * T), ty(d.y * T), 2 * T * scale, T * scale);
      // Viewport.
      const v = this.worldView();
      ctx.strokeStyle = 'rgba(240,228,194,.15)'; ctx.lineWidth = 0.6;
      ctx.strokeRect(tx(v.x), ty(v.y), v.w * scale, v.h * scale);
      // Nearby guards and target.
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        if (npc.role === 'target') {
          ctx.save(); ctx.translate(tx(npc.x), ty(npc.y)); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#e4b843'; ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
        } else if ((npc.role === 'guard' || npc.role === 'bodyguard') && (this.alarm || dist(this.player.x, this.player.y, npc.x, npc.y) < 650)) {
          ctx.fillStyle = npc.state === 'chase' ? '#ec6a5e' : '#b65c54';
          ctx.beginPath(); ctx.arc(tx(npc.x), ty(npc.y), 1.3, 0, U.TAU); ctx.fill();
        }
      }
      // Player triangle.
      const px = tx(this.player.x), py = ty(this.player.y);
      ctx.save(); ctx.translate(px, py); ctx.rotate(this.player.angle + Math.PI / 2);
      ctx.fillStyle = '#f2dfa4';
      ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(3, 3); ctx.lineTo(0, 1.5); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Frame.
      ctx.strokeStyle = 'rgba(215,182,106,.22)'; ctx.lineWidth = 0.8;
      ctx.strokeRect(0.5, 0.5, 217, 144);
    }

    drawBigMap() {
      const c = this.bigMap;
      const maxW = 1100, maxH = 650;
      const ar = this.level.pxW / this.level.pxH;
      let w = maxW, h = w / ar;
      if (h > maxH) { h = maxH; w = h * ar; }
      c.width = Math.round(w); c.height = Math.round(h);
      c.style.width = '100%';
      const ctx = this.bigMapCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#080b10'; ctx.fillRect(0, 0, w, h);
      const pad = 20;
      const scale = Math.min((w - pad * 2) / this.level.pxW, (h - pad * 2) / this.level.pxH);
      const ox = (w - this.level.pxW * scale) / 2;
      const oy = (h - this.level.pxH * scale) / 2;
      const tx = (x) => ox + x * scale;
      const ty = (y) => oy + y * scale;
      // Corridor.
      ctx.fillStyle = 'rgba(132,119,91,.4)';
      ctx.fillRect(tx((this.level.bx + 2) * T), ty(this.level.cy * T), (this.level.bw - 4) * T * scale, 3 * T * scale);
      // Rooms with names.
      for (const room of this.level.rooms) {
        const zone = VC.ZONES[room.zone];
        const x = tx(room.x * T), y = ty(room.y * T);
        const rw = room.w * T * scale, rh = room.h * T * scale;
        ctx.fillStyle = zone.color + '2c';
        ctx.fillRect(x, y, rw, rh);
        ctx.strokeStyle = zone.color + 'aa'; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, rw, rh);
        if (rw > 58 && rh > 34) {
          ctx.save();
          ctx.beginPath(); ctx.rect(x + 3, y + 3, rw - 6, rh - 6); ctx.clip();
          ctx.font = '600 11px "Avenir Next", sans-serif'; ctx.textAlign = 'center';
          try { ctx.letterSpacing = '1px'; } catch (e) {}
          ctx.fillStyle = 'rgba(235,226,205,.8)';
          ctx.fillText(room.name.toUpperCase(), x + rw / 2, y + rh / 2 - 2);
          ctx.font = '7px "SFMono-Regular", monospace';
          ctx.fillStyle = zone.color;
          ctx.fillText(zone.label, x + rw / 2, y + rh / 2 + 11);
          if (room.targetRoom) {
            ctx.save(); ctx.translate(x + rw - 15, y + 15); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#e4b843'; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
          }
          ctx.restore();
        }
      }
      // Doors.
      ctx.fillStyle = 'rgba(225,191,108,.6)';
      for (const d of this.level.doors) ctx.fillRect(tx(d.x * T), ty(d.y * T), 2 * T * scale, Math.max(1.5, T * scale));
      // NPCs: target always, guards only if close or alarm.
      for (const npc of this.npcs) {
        if (!npc.alive) continue;
        if (npc.role === 'target') {
          ctx.save(); ctx.translate(tx(npc.x), ty(npc.y)); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#f0c34f'; ctx.fillRect(-4, -4, 8, 8);
          ctx.strokeStyle = 'rgba(255,245,200,.75)'; ctx.strokeRect(-4, -4, 8, 8);
          ctx.restore();
        } else if ((npc.role === 'guard' || npc.role === 'bodyguard') && (this.alarm || dist(this.player.x, this.player.y, npc.x, npc.y) < 750)) {
          ctx.fillStyle = '#c75a53'; ctx.beginPath(); ctx.arc(tx(npc.x), ty(npc.y), 2.2, 0, U.TAU); ctx.fill();
        }
      }
      // Player.
      ctx.save(); ctx.translate(tx(this.player.x), ty(this.player.y)); ctx.rotate(this.player.angle + Math.PI / 2);
      ctx.fillStyle = '#f2dfa4'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(215,182,106,.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, this.level.pxW * scale, this.level.pxH * scale);
    }

    // ------------------------------------------------------------------- HUD
    updateHUD() {
      if (!this.level || !this.player) return;
      const p = this.player;
      const room = this.level.roomAtWorld(p.x, p.y);
      const badge = $('zoneBadge');
      let zoneName = 'MAIN HALL', zoneLabel = 'PUBLIC', allowed = true;
      if (room) {
        zoneName = room.name.toUpperCase();
        zoneLabel = VC.ZONES[room.zone].label;
        allowed = p.hasAccess(room.zone);
      }
      if (this._lastHud.zone !== zoneName + zoneLabel + allowed) {
        $('zoneText').textContent = zoneName;
        $('zoneAccess').textContent = allowed ? zoneLabel + ' · OK' : zoneLabel + ' · TRESPASSING';
        badge.classList.toggle('trespass', !allowed);
        this._lastHud.zone = zoneName + zoneLabel + allowed;
      }
      $('timer').textContent = formatTime(this.stats.time);
      $('healthNum').textContent = Math.ceil(p.health);
      $('staminaNum').textContent = Math.round(p.stamina);
      $('healthBar').style.width = p.health + '%';
      $('staminaBar').style.width = p.stamina + '%';
      const outfit = VC.OUTFITS[p.outfitId];
      $('outfitName').textContent = outfit.label;
      $('outfitSwatch').style.background = outfit.color;
      $('poisonCount').textContent = p.poison ? p.poison + ' vial' + (p.poison > 1 ? 's' : '') : 'No poison';
      const guardCount = this.npcs.filter(n => n.alive && (n.role === 'guard' || n.role === 'bodyguard') && (n.state === 'chase' || n.state === 'investigate')).length;
      const pipKey = guardCount;
      if (this._lastHud.pips !== pipKey) {
        let html = '';
        for (let i = 0; i < 7; i++) {
          const on = i < Math.min(7, guardCount);
          html += `<i class="${on ? 'on' : ''}"></i>`;
        }
        $('alertPips').innerHTML = html;
        this._lastHud.pips = pipKey;
      }
      if (p.blend) this.hint('BLENDING IN · low profile');
      else if (p.crouching) this.hint('CROUCHED · harder to notice');
      else if (!allowed) this.hint('TRESPASSING · find a better uniform');
      else this.hint('');
      if (room && this.lastRoom !== room.id) {
        this.lastRoom = room.id;
      }
    }
  }

  // Small vector icons used by world props and UI.
  function drawTrapIcon(ctx, type, armed) {
    ctx.save();
    if (type === 'chandelier') {
      ctx.strokeStyle = armed ? '#e8896d' : '#d8bf86'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, U.TAU); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * U.TAU;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(218,185,112,.5)'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, U.TAU); ctx.fill();
    } else if (type === 'electrical') {
      ctx.strokeStyle = armed ? '#91d4e4' : '#b9c1b8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(1, -8); ctx.lineTo(-4, 0); ctx.lineTo(1, 0); ctx.lineTo(-1, 8); ctx.lineTo(6, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.stroke();
    } else if (type === 'crate') {
      ctx.strokeStyle = armed ? '#d88b60' : '#b08a5d'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke();
    } else if (type === 'gas') {
      ctx.strokeStyle = armed ? '#ea8a66' : '#b9af99'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(-7, -4); ctx.lineTo(-2, -4); ctx.moveTo(3, 4); ctx.lineTo(7, 4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, U.TAU); ctx.stroke();
    } else if (type === 'steam') {
      ctx.strokeStyle = armed ? '#bfe0e8' : '#aeb8b6'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    }
    ctx.restore();
  }

  // Boot.
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.VC.game) new Game();
  });
  if (document.readyState !== 'loading' && !window.VC.game) new Game();
})();
