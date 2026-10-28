/* 自动生成：node tools/build_web.js —— 修改 js/ 后请重新运行 */
var __m = {};
function __def(id, fn) { __m[id] = fn; }
function __dirname(id) { var i = id.lastIndexOf("/"); return i < 0 ? "" : id.slice(0, i); }
function __resolve(from, p) {
  var dir = __dirname(from);
  var base = dir ? dir.split("/") : [];
  var parts = p.split("/");
  for (var i = 0; i < parts.length; i++) {
    var s = parts[i];
    if (s === "." || s === "") continue;
    if (s === "..") base.pop();
    else base.push(s);
  }
  return base.join("/");
}
var __cache = {};
function __req(fromId, p) {
  var id = __resolve(fromId, p);
  if (__cache[id]) return __cache[id].exports;
  var fn = __m[id];
  if (!fn) throw new Error("module not found: " + id);
  var module = { exports: {} };
  __cache[id] = module;
  fn(module, module.exports, function (rel) { return __req(id, rel); });
  return module.exports;
}
__def("js/boot.js", function (module, exports, require) {
// 全局命名空间桥：微信小游戏里通过 require 共享，浏览器里挂在 window 上
var G = {};
if (typeof module !== 'undefined' && module.exports !== undefined) { module.exports = G; }
if (typeof window !== 'undefined') { window.G = G; }
if (typeof GameGlobal !== 'undefined') { GameGlobal.G = G; }

});
__def("js/core/platform.js", function (module, exports, require) {
// 平台适配层：统一微信小游戏 / 浏览器 的画布、触摸、存储、震动
var G = require('../boot.js');
(function () {
  var P = {};
  P.isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';

  if (P.isWx) {
    var info = wx.getSystemInfoSync();
    P.screenW = info.screenWidth || info.windowWidth || 375;
    P.screenH = info.screenHeight || info.windowHeight || 667;
    P.dpr = Math.min(info.pixelRatio || 1, 2);
    P.canvas = wx.createCanvas();
  } else {
    P.canvas = document.createElement('canvas');
    P.canvas.style.position = 'fixed';
    P.canvas.style.left = '0';
    P.canvas.style.top = '0';
    P.canvas.style.background = '#05070f';
    document.body.appendChild(P.canvas);
    P.dpr = Math.min(window.devicePixelRatio || 1, 2);
    P.screenW = window.innerWidth;
    P.screenH = window.innerHeight;
  }

  function setup() {
    P.canvas.width = Math.round(P.screenW * P.dpr);
    P.canvas.height = Math.round(P.screenH * P.dpr);
    if (P.canvas.style) {
      P.canvas.style.width = P.screenW + 'px';
      P.canvas.style.height = P.screenH + 'px';
    }
    P.ctx = P.canvas.getContext('2d');
    P.ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
  }
  setup();

  if (!P.isWx) {
    window.addEventListener('resize', function () {
      P.screenW = window.innerWidth;
      P.screenH = window.innerHeight;
      setup();
      if (G.game && G.game.onResize) G.game.onResize();
    });
  }

  // ---- 触摸 ----
  P.onTouch = null; // 由 Input 注入: function(type, id, x, y)
  function emit(type, id, x, y) {
    if (P.onTouch) {
      try { P.onTouch(type, id, x, y); } catch (e) { console.error(e); }
    }
  }

  if (P.isWx) {
    function each(e, type) {
      var list = e.changedTouches || e.touches || [];
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        var x = (t.x !== undefined && t.x !== null) ? t.x : t.clientX;
        var y = (t.y !== undefined && t.y !== null) ? t.y : t.clientY;
        if (x === undefined) continue;
        emit(type, 't' + t.identifier, x, y);
      }
    }
    wx.onTouchStart(function (e) { each(e, 'start'); });
    wx.onTouchMove(function (e) { each(e, 'move'); });
    wx.onTouchEnd(function (e) { each(e, 'end'); });
    wx.onTouchCancel(function (e) { each(e, 'end'); });
  } else {
    var opt = { passive: false };
    P.canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        emit('start', 't' + t.identifier, t.clientX, t.clientY);
      }
    }, opt);
    P.canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        emit('move', 't' + t.identifier, t.clientX, t.clientY);
      }
    }, opt);
    var endFn = function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        emit('end', 't' + t.identifier, t.clientX, t.clientY);
      }
    };
    P.canvas.addEventListener('touchend', endFn, opt);
    P.canvas.addEventListener('touchcancel', endFn, opt);

    // 鼠标兜底（桌面调试）
    var mouseDown = false;
    P.canvas.addEventListener('mousedown', function (e) {
      mouseDown = true;
      emit('start', 'mouse', e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', function (e) {
      if (mouseDown) emit('move', 'mouse', e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function (e) {
      if (mouseDown) { mouseDown = false; emit('end', 'mouse', e.clientX, e.clientY); }
    });
  }

  // ---- 存储 ----
  P.storage = {
    get: function (k, d) {
      try {
        if (P.isWx) {
          var v = wx.getStorageSync(k);
          return (v === '' || v === undefined || v === null) ? d : v;
        }
        var s = localStorage.getItem(k);
        return s == null ? d : JSON.parse(s);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try {
        if (P.isWx) wx.setStorageSync(k, v);
        else localStorage.setItem(k, JSON.stringify(v));
      } catch (e) { }
    }
  };

  P.vibrate = function () {
    if (P.isWx && wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'light' }); } catch (e) { }
    }
  };

  G.P = P;
})();

});
__def("js/core/util.js", function (module, exports, require) {
// 通用工具函数
var G = require('../boot.js');
(function () {
  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.choice = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.dist2 = function (ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  U.len = function (x, y) { return Math.sqrt(x * x + y * y); };
  U.angle = function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); };
  U.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };

  U.weightedPick = function (items, wFn) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += wFn(items[i]);
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= wFn(items[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  // 伪随机种子（背景星星用，保证每帧一致）
  U.seededRand = function (seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  G.U = U;
})();

});
__def("js/core/input.js", function (module, exports, require) {
// 输入系统：UI 命中优先，其余交给 Game（摇杆 / 英雄拖拽）
var G = require('../boot.js');
(function () {
  var Input = {
    joystick: { active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0, mag: 0 },
    uiTouches: {}, // touchId -> 按钮id（被 UI 消费的触摸）
    init: function () {
      G.P.onTouch = function (type, id, x, y) {
        var game = G.game;
        if (!game) return;
        if (type === 'start') {
          var btn = G.UI ? G.UI.hitTest(x, y) : null;
          if (btn && btn.onTap) {
            Input.uiTouches[id] = btn.id;
            btn.onTap();
            return;
          }
          game.onWorldTouch(id, x, y);
        } else if (type === 'move') {
          if (Input.uiTouches[id] !== undefined) return;
          game.onWorldMove(id, x, y);
        } else {
          if (Input.uiTouches[id] !== undefined) {
            delete Input.uiTouches[id];
            return;
          }
          game.onWorldEnd(id, x, y);
        }
      };
    },
    joyReset: function () {
      var j = Input.joystick;
      j.active = false; j.id = null; j.dx = 0; j.dy = 0; j.mag = 0;
    }
  };

  G.Input = Input;
})();

});
__def("js/core/camera.js", function (module, exports, require) {
// 相机：跟随玩家，限制在地图范围内，支持震屏
var G = require('../boot.js');
(function () {
  var Camera = {
    x: 0, y: 0, // 视口左上角（世界坐标）
    shakeT: 0, shakePower: 0,
    init: function (mapW, mapH) {
      Camera.mapW = mapW; Camera.mapH = mapH;
      Camera.x = (mapW - G.P.screenW) / 2;
      Camera.y = (mapH - G.P.screenH) / 2;
    },
    snapTo: function (x, y) {
      Camera.x = x - G.P.screenW / 2;
      Camera.y = y - G.P.screenH / 2;
      Camera.clampPos();
    },
    update: function (dt, tx, ty) {
      // 平滑跟随
      var gx = tx - G.P.screenW / 2;
      var gy = ty - G.P.screenH / 2;
      Camera.x += (gx - Camera.x) * Math.min(1, dt * 6);
      Camera.y += (gy - Camera.y) * Math.min(1, dt * 6);
      Camera.clampPos();
      if (Camera.shakeT > 0) Camera.shakeT -= dt;
    },
    clampPos: function () {
      Camera.x = G.U.clamp(Camera.x, 0, Math.max(0, Camera.mapW - G.P.screenW));
      Camera.y = G.U.clamp(Camera.y, 0, Math.max(0, Camera.mapH - G.P.screenH));
    },
    shake: function (power, time) {
      Camera.shakePower = Math.max(Camera.shakePower * 0.5, power);
      Camera.shakeT = Math.max(Camera.shakeT, time);
    },
    // 渲染偏移（含震屏）
    ox: function () {
      var s = Camera.shakeT > 0 ? Camera.shakePower * (Camera.shakeT / 0.35) : 0;
      return Camera.x + (Math.random() - 0.5) * s * 2;
    },
    oy: function () {
      var s = Camera.shakeT > 0 ? Camera.shakePower * (Camera.shakeT / 0.35) : 0;
      return Camera.y + (Math.random() - 0.5) * s * 2;
    }
  };
  G.Camera = Camera;
})();

});
__def("js/core/audio.js", function (module, exports, require) {
// 音频：WebAudio 程序化合成音效（零素材），微信下同样可用
var G = require('../boot.js');
(function () {
  var Audio = {
    ctx: null, enabled: true, lastPlay: {},
    ensure: function () {
      if (Audio.ctx || !Audio.enabled) return;
      try {
        var AC = (typeof wx !== 'undefined' && wx.createWebAudioContext)
          ? wx.createWebAudioContext()
          : (window.AudioContext || window.webkitAudioContext);
        if (!AC) { Audio.enabled = false; return; }
        Audio.ctx = new AC();
      } catch (e) { Audio.enabled = false; }
    },
    resume: function () {
      Audio.ensure();
      if (Audio.ctx && Audio.ctx.state === 'suspended') {
        try { Audio.ctx.resume(); } catch (e) { }
      }
    },
    // 基础音：振荡器 + 音量包络
    tone: function (freq, freqEnd, dur, vol, type, delay) {
      if (!Audio.enabled) return;
      Audio.ensure();
      if (!Audio.ctx) return;
      try {
        var c = Audio.ctx, t0 = c.currentTime + (delay || 0);
        var o = c.createOscillator(), g = c.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (freqEnd && freqEnd !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { }
    },
    noise: function (dur, vol, delay) {
      if (!Audio.enabled) return;
      Audio.ensure();
      if (!Audio.ctx) return;
      try {
        var c = Audio.ctx, t0 = c.currentTime + (delay || 0);
        var len = Math.max(1, Math.floor(c.sampleRate * dur));
        var buf = c.createBuffer(1, len, c.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = c.createBufferSource(); src.buffer = buf;
        var g = c.createGain(); g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(g); g.connect(c.destination);
        src.start(t0);
      } catch (e) { }
    },
    play: function (name) {
      if (!Audio.enabled) return;
      // 限制同类音效最小间隔，防止爆音
      var now = Date.now(), min = { shoot: 70, hit: 40, coin: 50, pick: 60, hurt: 150 }[name] || 60;
      if (Audio.lastPlay[name] && now - Audio.lastPlay[name] < min) return;
      Audio.lastPlay[name] = now;
      switch (name) {
        case 'shoot': Audio.tone(880, 660, 0.06, 0.06, 'square'); break;
        case 'arrow': Audio.tone(1300, 900, 0.05, 0.05, 'triangle'); break;
        case 'hit': Audio.tone(200, 120, 0.05, 0.07, 'sawtooth'); break;
        case 'kill': Audio.noise(0.1, 0.1); Audio.tone(300, 80, 0.12, 0.08, 'sawtooth'); break;
        case 'coin': Audio.tone(1200, 1800, 0.08, 0.06, 'sine'); break;
        case 'pick': Audio.tone(600, 900, 0.07, 0.05, 'sine'); break;
        case 'hurt': Audio.tone(160, 70, 0.18, 0.12, 'sawtooth'); break;
        case 'heal': Audio.tone(500, 800, 0.15, 0.06, 'sine'); Audio.tone(750, 1200, 0.15, 0.05, 'sine', 0.08); break;
        case 'recruit': Audio.tone(400, 800, 0.15, 0.08, 'triangle'); break;
        case 'merge': Audio.tone(500, 1000, 0.12, 0.08, 'sine'); Audio.tone(750, 1500, 0.18, 0.07, 'sine', 0.1); break;
        case 'upgrade': Audio.tone(600, 1200, 0.12, 0.07, 'sine'); break;
        case 'levelup': [523, 659, 784, 1047].forEach(function (f, i) { Audio.tone(f, f, 0.15, 0.08, 'sine', i * 0.09); }); break;
        case 'boss': [220, 185, 147].forEach(function (f, i) { Audio.tone(f, f * 0.8, 0.3, 0.12, 'sawtooth', i * 0.25); }); break;
        case 'wave': Audio.tone(440, 440, 0.1, 0.06, 'sine'); Audio.tone(660, 660, 0.12, 0.06, 'sine', 0.12); break;
        case 'boom': Audio.noise(0.4, 0.25); Audio.tone(120, 40, 0.4, 0.2, 'sawtooth'); break;
        case 'button': Audio.tone(700, 500, 0.05, 0.05, 'square'); break;
        case 'error': Audio.tone(200, 150, 0.12, 0.08, 'square'); break;
        case 'crystal': Audio.tone(900, 300, 0.25, 0.15, 'sawtooth'); break;
        case 'gameover': [400, 330, 262, 196].forEach(function (f, i) { Audio.tone(f, f * 0.9, 0.3, 0.1, 'sine', i * 0.22); }); break;
      }
    }
  };
  G.Audio = Audio;
})();

});
__def("js/config/data.js", function (module, exports, require) {
// ★ 全部数值配置表 —— 改平衡只改这里
var G = require('../boot.js');
(function () {
  var D = {};

  // 地图与相机
  D.MAP_W = 2200;
  D.MAP_H = 2200;

  // 玩家
  D.PLAYER = {
    HP: 100,
    SPEED: 190,          // px/s
    RADIUS: 14,
    ATTACK: 10,          // 基础攻击力
    INTERVAL: 0.5,       // 攻击间隔 s
    RANGE: 300,          // 射程
    PICK_RANGE: 70,      // 拾取范围
    REGEN: 0             // 每秒回血
  };

  // 基地水晶（塔防核心）
  D.BASE = {
    HP: 800,
    RADIUS: 34
  };

  // 敌人基础属性（会被波次成长系数放大）
  D.ENEMIES = {
    slime: { hp: 22, speed: 62, dmg: 8, radius: 13, coin: 2, gem: 1, color: '#e74c3c', name: '史莱姆' },
    fast: { hp: 14, speed: 108, dmg: 6, radius: 11, coin: 3, gem: 1, color: '#ff7f50', name: '疾行虫' },
    tank: { hp: 95, speed: 36, dmg: 16, radius: 20, coin: 6, gem: 2, color: '#9b59b6', name: '装甲胖' },
    shooter: { hp: 34, speed: 50, dmg: 10, radius: 14, coin: 5, gem: 2, color: '#2ecc71', name: '毒液射手', shootRange: 240, shootInterval: 2.2, bulletSpeed: 170 }
  };
  D.ENEMY_BULLET_SPEED = 170;

  // 波次成长
  D.WAVE = {
    START_INTERVAL: 3,     // 波与波之间的间歇
    HP_GROWTH: 1.13,       // 前期每波 HP ×1.13（13波起按阶梯加速，见 HP_GROWTH_TIERS）
    HP_GROWTH_TIERS: [     // 血量阶梯式成长：对标玩家输出曲线，后期压迫感增强
      { from: 1, rate: 1.13 },
      { from: 13, rate: 1.20 },
      { from: 25, rate: 1.30 },
      { from: 40, rate: 1.40 }
    ],
    DMG_GROWTH: 1.05,      // 每波伤害 ×1.05
    DMG_CAP: 3,            // 伤害成长上限倍数
    ELITE_FROM: 5,         // 精英出现起始波
    ELITE_CHANCE: 0.10,    // 精英基础概率（随波次升至0.30封顶）
    BOSS_EVERY: 5,         // 每 5 波 Boss
    BUDGET_BASE: 12,       // 敌人预算：12 + 7波 + 波^1.55（数量温和上升，同屏上限60不变）
    MAX_ALIVE: 75,         // 同屏敌人上限
    COUNT_MULT_TIERS: [    // 刷怪数量分阶段：前期少，10波起×3
      { from: 1, mult: 1 },
      { from: 5, mult: 1.5 },
      { from: 10, mult: 3 }
    ],
    GOLD_GROWTH: 0.06,     // 敌人金币/经验产出每波 +6%（高波次产出提升）
    ATK_PER_WAVE: 0.04,    // 每清一波 主角攻击 +4%（局内成长）
    ATK_BOSS_BONUS: 0.08   // Boss 波清算额外 +8%（共 +12%）
  };

  // 精英 / Boss 倍率
  D.ELITE = { DPS_MULT: 7, SPEED: 0.9, SIZE: 1.7, COIN: 15, GEM: 8, RADIUS: 1.7 }; // 血量=主角DPS×7
  D.BOSS = {
    DPS_MULT: 15, SPEED: 34, DMG: 25, RADIUS: 44, // 血量=主角DPS×15
    COIN: 80, GEM: 40, SUMMON_INTERVAL: 6, SUMMON_N: 4
  };

  // 掉落
  D.DROPS = {
    COIN_VALUE: 1,
    HEAL_CHANCE: 0.02, HEAL_AMOUNT: 25,
    MAGNET_CHANCE: 0.008,
    BOMB_CHANCE: 0.008, BOMB_RADIUS: 260, BOMB_DMG: 60
  };

  // 英雄职业（塔防单位）
  D.HEROES = {
    sword: {
      name: '剑士', icon: '⚔', color: '#e67e22', rare: false,
      desc: '近战环斩',
      dmg: 18, interval: 1.1, range: 95, aoe: true,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    archer: {
      name: '弓手', icon: '🏹', color: '#27ae60', rare: false,
      desc: '单体远程',
      dmg: 11, interval: 0.55, range: 330, bulletSpeed: 520,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    mage: {
      name: '法师', icon: '🔮', color: '#8e44ad', rare: false,
      desc: '范围火球',
      dmg: 26, interval: 1.5, range: 300, bulletSpeed: 320, splash: 75,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    cannon: {
      name: '炮手', icon: '💣', color: '#c0392b', rare: true,
      desc: '大范围重炮',
      dmg: 55, interval: 2.4, range: 360, bulletSpeed: 260, splash: 110,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    priest: {
      name: '牧师', icon: '✚', color: '#f1c40f', rare: true,
      desc: '治疗脉冲',
      heal: 6, interval: 2.0, range: 9999, healGrowth: 1.5, intervalGrowth: 0.97
    }
  };
  D.HERO = {
    MAX_LEVEL: 6,
    MAX_COUNT: 9,
    RECRUIT_BASE: 25,      // 招募费用：25 + 8×已招募次数
    RECRUIT_STEP: 8,
    UPGRADE_BASE: 60,      // 直升费用：60 × 1.9^(lv-1)
    UPGRADE_GROWTH: 1.9,
    SELL_VALUE: 20,        // 出售返还 20 × 等级
    DMG_GROWTH: 1.6,       // 每 +1 级伤害 ×1.6
    SLOT_DIST: 120,        // 阵地半径（围绕基地）
    DRAG_R: 26             // 拖拽命中半径
  };

  // 升级三选一技能池
  D.SKILLS = [
    { id: 'atk', name: '攻击强化', icon: '🗡', max: 8, desc: lv => '主角伤害 +20%（当前 +' + (lv * 20) + '%）' },
    { id: 'aspeed', name: '疾速射击', icon: '⚡', max: 8, desc: lv => '攻击间隔 -8%（当前 -' + (lv * 8) + '%）' },
    { id: 'multi', name: '分裂箭矢', icon: '🔱', max: 4, desc: lv => '弹道 +' + lv + '（共 ' + (1 + lv) + ' 道）' },
    { id: 'pierce', name: '穿透之刃', icon: '🎯', max: 3, desc: lv => '子弹可穿透 +' + lv + ' 个敌人' },
    { id: 'crit', name: '致命打击', icon: '💥', max: 6, desc: lv => '暴击率 +' + (lv * 8) + '%（暴伤 ×2）' },
    { id: 'bigshot', name: '巨型弹药', icon: '🔵', max: 4, desc: lv => '弹体 +30%，伤害 +' + (lv * 8) + '%' },
    { id: 'hp', name: '生命之泉', icon: '❤', max: 8, desc: lv => '生命上限 +30 并回满该值' },
    { id: 'regen', name: '恢复光环', icon: '💚', max: 8, desc: lv => '每秒回复 ' + lv + ' 生命' },
    { id: 'leech', name: '鲜血汲取', icon: '🩸', max: 3, desc: lv => '造成伤害的 ' + (lv * 2) + '% 转化为生命' },
    { id: 'speed', name: '疾风之靴', icon: '👟', max: 3, desc: lv => '移动速度 +' + (lv * 10) + '%' },
    { id: 'magnet', name: '磁力手套', icon: '🧲', max: 3, desc: lv => '拾取范围 +' + (lv * 45) + '%' },
    { id: 'gold', name: '点金之手', icon: '💰', max: 3, desc: lv => '金币获取 +' + (lv * 25) + '%' },
    { id: 'allydmg', name: '战友强化', icon: '🤝', max: 3, desc: lv => '全英雄伤害 +' + (lv * 15) + '%' },
    { id: 'allyspd', name: '集结战鼓', icon: '🥁', max: 3, desc: lv => '全英雄攻速 +' + (lv * 10) + '%' }
  ];
  D.SKILL_FALLBACKS = [
    { id: 'healfull', name: '瞬间治愈', icon: '💖', desc: () => '立即回复 50% 生命' },
    { id: 'bounty', name: '天降赏金', icon: '💰', desc: () => '立即获得 120 金币' }
  ];

  // 经济
  D.ECONOMY = {
    START_GOLD: 50,
    REPAIR_COST: 80, REPAIR_PCT: 0.25,
    BUFF_COST: 100, BUFF_GROWTH: 1.6, BUFF_PCT: 0.15
  };

  // ★ 主角（局外可选英雄）：基础属性 + 升级属性
  D.PROTOS = {
    archer: {
      name: '弓手', cls: 'archer', color: '#4aa3ff',
      desc: '均衡远程 · 默认解锁',
      hp: 100, dmg: 10, interval: 0.5, speed: 190, range: 300, bulletSpeed: 560
    },
    sword: {
      name: '剑士', cls: 'sword', color: '#e67e22',
      desc: '高血近战 · 环形斩击',
      hp: 140, dmg: 20, interval: 0.75, speed: 210, range: 130, melee: true
    },
    mage: {
      name: '法师', cls: 'mage', color: '#a55eea',
      desc: '火球溅射 · 生存偏弱',
      hp: 90, dmg: 16, interval: 0.9, speed: 185, range: 320, bulletSpeed: 340, splash: 70
    },
    priest: {
      name: '牧师', cls: 'priest', color: '#f1c40f',
      desc: '圣光速射 · 自带回血',
      hp: 130, dmg: 8, interval: 0.4, speed: 180, range: 280, bulletSpeed: 620,
      regenBase: 0.5, regenPerLv: 0.25
    },
    cannon: {
      name: '炮手', cls: 'cannon', color: '#e74c3c',
      desc: '重炮清屏 · 攻速缓慢',
      hp: 115, dmg: 42, interval: 2.0, speed: 175, range: 360, bulletSpeed: 260, splash: 100
    }
  };
  D.META = {
    PROTO_ORDER: ['archer', 'sword', 'mage', 'priest', 'cannon'],
    UNLOCK: { archer: 0, sword: 600, mage: 1500, priest: 2500, cannon: 3500 },
    UPG_BASE: 100,        // 升1级费用：100 × 1.5^(lv-1)
    UPG_GROWTH: 1.5,
    MAX_LV: 10,
    // 每级升级属性加成
    BONUS: { hp: 0.08, dmg: 0.06, aspeed: 0.04, speed: 0.02 }
  };

  // ★ 附加技能（吸血鬼幸存者式独立被动）：升级时独立二选，最多持有3个，每技能满5级质变
  D.ASKILL_MAX_COUNT = 3;
  D.ASKILLS = {
    star: { id: 'star', name: '星环脉冲', max: 5, desc: lv => [
        '环绕能量环 清怪输出', '尺寸+25% 旋转加快 伤害提升', '双层星环 独立旋转',
        '伤害大幅提升 命中更频繁', '耀星环：三层高速环绕 击中留灼烧地带'][lv - 1] },
    echo: { id: 'echo', name: '时空残影', max: 5, desc: lv => [
        '周期生成残影 模仿你攻击一次', '残影冷却缩短 伤害+20%', '同时存在 2 个残影',
        '残影跟随你移动 攻击附带减速', '万影随行：3残影 伤害等同本体'][lv - 1] },
    shield: { id: 'shield', name: '晶盾回响', max: 5, desc: lv => [
        '受伤后生成临时护盾', '护盾更厚 冷却更短', '护盾期间移速小幅提升',
        '护盾破碎爆发冲击波 击退伤害', '晶爆神盾：高频刷新 巨型冲击波并回血'][lv - 1] },
    magnet: { id: 'magnet', name: '贪婪磁核', max: 5, desc: lv => [
        '吸取范围+30%', '范围+60% 拾取经验短暂增伤', '范围+100% 拾取经验短暂加速',
        '击杀概率直接生成经验球', '引力漩涡：巨吸圈 圈内烧怪 拾取永久叠伤'][lv - 1] },
    bomb: { id: 'bomb', name: '崩解爆弹', max: 5, desc: lv => [
        '每击杀12次 自动引爆（冷却6秒）', '击杀9次触发 伤害提升（冷却8秒）', '爆炸可连锁（冷却11秒）',
        '爆炸附带眩晕（冷却15秒）', '连环崩解：4杀引爆 无限连锁（冷却20秒）'][lv - 1] }
  };
  D.ASKILL_ORDER = ['star', 'echo', 'shield', 'magnet', 'bomb'];
  // ★ 更新公告（主菜单展示）
  D.CHANGELOG = [
    { ver: 'v0.5.2', title: '主菜单排版修复', lines: ['标题区独立排版，水晶徽记不再被选关卡片遮挡', '徽记改为矢量绘制，不依赖 emoji', '矮屏下按钮与说明文字自动收紧，不再重叠'] },
    { ver: 'v0.5.1', title: '宝箱与资源展示优化', lines: ['通关宝箱改为回主界面领取 领取后显示已打开状态', '钻石与金币移至右上角资源栏', '1-50关均可预览 未通关前关则开始按钮锁定'] },
    { ver: 'v0.5.0', title: '关卡系统上线', lines: ['50个关卡，每关20波，通关开宝箱', '主界面左右箭头选关，逐关解锁', '新增钻石：满血通关300钻/≥70%150钻/保底50钻'] },
    { ver: 'v0.4.2', title: '崩解爆弹冷却制', lines: ['满级连环崩解改为20秒冷却', '低等级冷却6~15秒，冷却期击杀不计数'] },
    { ver: 'v0.4.1', title: '拾取贴身修复', lines: ['金币经验飞到身上才消失，不再半空蒸发'] },
    { ver: 'v0.4.0', title: 'Boss/精英DPS定价', lines: ['Boss血量=主角DPS×15，精英=×7', '10波起小怪数量×3，同屏上限75'] },
    { ver: 'v0.3.3', title: '血量阶梯成长', lines: ['13/25/40波起血量成长逐步加速，后期更有压迫感'] },
    { ver: 'v0.3.2', title: '掉落修复+磁吸加速', lines: ['金币经验超量不再丢失', '磁吸速度约2倍，飞到身上才收'] },
    { ver: 'v0.3.0', title: '附加技能系统', lines: ['星环/残影/晶盾/磁核/爆弹 5种被动', '最多持有3个，5级满级质变'] },
    { ver: 'v0.2.x', title: '局外成长与节奏优化', lines: ['主页可选5主角并升级属性', '波次攻击成长+高波次产出提升'] },
    { ver: 'v0.1.0', title: '首次发布', lines: ['割草 × 塔防 × 英雄合成'] }
  ];

  // ★ 关卡系统：50关 × 每关20波
  D.LEVELS = {
    TOTAL: 50,
    WAVES: 20,             // 每关波次
    HP_WAVE: 1.12,         // 波内血量：每波×1.12（第20波≈开局8.6倍）
    BUDGET_WAVE: 1.13,     // 波内数量预算：每波×1.13
    DIFF: 1.15,            // 关间难度基数（血量）：每关×1.15，50关≈1074倍
    DIFF_BUDGET_POW: 0.6,  // 数量预算随关间难度的缩放指数（防爆屏）
    BOSS_WAVES: [10, 20],  // 关内Boss波（20=关底Boss）
    BOX_REWARDS: [50, 100, 150], // 三档宝箱钻石：30%档/70%档/满血档
    NAMES: ['静谧草原', '荆棘丛林', '沉默森林', '风语荒漠', '霜冻苔原',
            '幽暗洞穴', '熔岩裂谷', '浮空遗迹', '深渊裂隙', '星陨之巅'],
    nameOf: function (lv) { return D.LEVELS.NAMES[(lv - 1) % D.LEVELS.NAMES.length]; }
  };

  D.VERSION = 'v0.5.2';
  G.D = D;
})();

});
__def("js/core/meta.js", function (module, exports, require) {
// 局外成长（Meta）：主角选择、升级金币、英雄解锁与升级
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Meta = {
    gold: 0,                          // 升级金币（局外钱包）
    unlocked: { archer: true },
    levels: { archer: 1 },
    selected: 'archer',
    diamonds: 0,                      // 钻石（通关宝箱奖励）
    maxLevel: 1,                      // 最高已解锁关卡
    selectedLevel: 1,                 // 当前选中关卡
    chests: { level: 0, boxes: [false, false, false], claimed: [false, false, false] }, // 主界面领取的宝箱

    load: function () {
      var m = G.P.storage.get('lx_meta', null);
      if (m) {
        Meta.gold = m.gold || 0;
        Meta.unlocked = m.unlocked || { archer: true };
        Meta.levels = m.levels || { archer: 1 };
        Meta.selected = (m.selected && Meta.unlocked[m.selected]) ? m.selected : 'archer';
        Meta.diamonds = m.diamonds || 0;
        Meta.maxLevel = m.maxLevel || 1;
        Meta.selectedLevel = m.selectedLevel || 1;
        if (m.chests) Meta.chests = m.chests;
      }
    },
    save: function () {
      G.P.storage.set('lx_meta', {
        gold: Meta.gold, unlocked: Meta.unlocked,
        levels: Meta.levels, selected: Meta.selected,
        diamonds: Meta.diamonds, maxLevel: Meta.maxLevel,
        selectedLevel: Meta.selectedLevel, chests: Meta.chests
      });
    },

    addDiamonds: function (n) {
      Meta.diamonds += n;
      Meta.save();
    },

    // 通关后把宝箱放回主界面待领
    setChests: function (level, boxes) {
      Meta.chests = { level: level, boxes: boxes, claimed: [false, false, false] };
      Meta.save();
    },
    // 在主界面领取宝箱，返回获得的钻石（0=不可领）
    claimChest: function (i) {
      var c = Meta.chests;
      if (!c || !c.boxes[i] || c.claimed[i]) return 0;
      c.claimed[i] = true;
      var amt = D.LEVELS.BOX_REWARDS[i];
      Meta.diamonds += amt;
      Meta.save();
      return amt;
    },
    // 通关后解锁下一关
    unlockLevel: function (lv) {
      if (lv > Meta.maxLevel) {
        Meta.maxLevel = Math.min(lv, D.LEVELS.TOTAL);
        Meta.save();
      }
    },

    // 对局金币 → 升级金币（1:1 即时累积）
    earn: function (n) {
      Meta.gold += n;
    },

    unlockCost: function (cls) { return D.META.UNLOCK[cls]; },
    upgradeCost: function (cls) {
      var lv = Meta.levels[cls] || 1;
      return Math.round(D.META.UPG_BASE * Math.pow(D.META.UPG_GROWTH, lv - 1));
    },
    levelOf: function (cls) { return Meta.levels[cls] || 1; },

    unlock: function (cls) {
      if (Meta.unlocked[cls]) return false;
      var c = D.META.UNLOCK[cls];
      if (Meta.gold < c) { G.Audio.play('error'); return false; }
      Meta.gold -= c;
      Meta.unlocked[cls] = true;
      Meta.levels[cls] = 1;
      Meta.selected = cls;
      Meta.save();
      G.Audio.play('recruit');
      return true;
    },
    upgrade: function (cls) {
      var lv = Meta.levelOf(cls);
      if (lv >= D.META.MAX_LV) { G.Audio.play('error'); return false; }
      var c = Meta.upgradeCost(cls);
      if (Meta.gold < c) { G.Audio.play('error'); return false; }
      Meta.gold -= c;
      Meta.levels[cls] = lv + 1;
      Meta.save();
      G.Audio.play('upgrade');
      return true;
    },
    select: function (cls) {
      if (!Meta.unlocked[cls]) return false;
      Meta.selected = cls;
      Meta.save();
      G.Audio.play('button');
      return true;
    },

    // 主角总属性 = 基础属性 × 升级加成
    protoStats: function (cls) {
      var p = D.PROTOS[cls];
      var lv = Meta.levelOf(cls);
      var k = lv - 1;
      var B = D.META.BONUS;
      var st = {
        cls: cls, name: p.name, color: p.color, desc: p.desc, level: lv,
        maxHp: Math.round(p.hp * (1 + B.hp * k)),
        dmg: p.dmg * (1 + B.dmg * k),
        interval: p.interval * (1 - B.aspeed * k),
        speed: p.speed * (1 + B.speed * k),
        range: p.range, bulletSpeed: p.bulletSpeed || 0,
        splash: p.splash || 0, melee: !!p.melee,
        regen: p.regenBase ? p.regenBase + p.regenPerLv * k : 0
      };
      return st;
    }
  };
  G.Meta = Meta;
})();

});
__def("js/core/bg.js", function (module, exports, require) {
// 地图背景：深空渐变 + 网格地面 + 星尘 + 基地平台
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Bg = {
    draw: function (ctx, ox, oy) {
      var W = G.P.screenW, H = G.P.screenH;
      // 深空底色
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#141b3d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 星尘（固定世界坐标，视差滚动）
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < 60; i++) {
        var sx = U.seededRand(i * 3.7) * D.MAP_W;
        var sy = U.seededRand(i * 7.3) * D.MAP_H;
        var px = sx - ox * 0.5, py = sy - oy * 0.5;
        px = ((px % W) + W) % W;
        py = ((py % H) + H) % H;
        var tw = 0.25 + 0.2 * Math.sin(Date.now() / 700 + i);
        ctx.globalAlpha = tw * 0.6;
        var s = (i % 5 === 0) ? 2 : 1.2;
        ctx.fillRect(px, py, s, s);
      }
      ctx.globalAlpha = 1;

      // 地面网格（限制在地图范围内）
      var step = 100;
      var x0 = Math.max(0, Math.floor(ox / step) * step);
      var y0 = Math.max(0, Math.floor(oy / step) * step);
      var x1 = Math.min(D.MAP_W, ox + W);
      var y1 = Math.min(D.MAP_H, oy + H);
      ctx.strokeStyle = 'rgba(122,146,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = x0; gx <= x1; gx += step) {
        ctx.moveTo(gx - ox, 0); ctx.lineTo(gx - ox, H);
      }
      for (var gy = y0; gy <= y1; gy += step) {
        ctx.moveTo(0, gy - oy); ctx.lineTo(W, gy - oy);
      }
      ctx.stroke();

      // 地图边界警示
      ctx.strokeStyle = 'rgba(255,107,107,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(-ox, -oy, D.MAP_W, D.MAP_H);
      ctx.setLineDash([]);

      // 地图外的暗化
      ctx.fillStyle = 'rgba(3,5,12,0.55)';
      if (ox < 0) ctx.fillRect(0, 0, -ox, H);
      if (oy < 0) ctx.fillRect(0, 0, W, -oy);
      if (ox + W > D.MAP_W) ctx.fillRect(D.MAP_W - ox, 0, ox + W - D.MAP_W, H);
      if (oy + H > D.MAP_H) ctx.fillRect(0, D.MAP_H - oy, W, oy + H - D.MAP_H);
    },

    // 基地水晶单独绘制（含血条）
    drawBase: function (ctx, base, ox, oy) {
      if (!base) return;
      var sx = base.x - ox, sy = base.y - oy;
      var t = Date.now() / 1000;

      // 基地平台
      ctx.fillStyle = 'rgba(90,140,255,0.10)';
      ctx.beginPath();
      ctx.arc(sx, sy, base.r + 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(122,170,255,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(sx, sy, base.r + 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 水晶光影
      var pulse = 1 + Math.sin(t * 2.2) * 0.05;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(t * 0.6) * 0.1);
      ctx.scale(pulse, pulse);
      var g = ctx.createLinearGradient(0, -34, 0, 34);
      var hpk = base.hp / base.maxHp;
      g.addColorStop(0, hpk > 0.4 ? '#8fd3ff' : '#ff9f9f');
      g.addColorStop(1, hpk > 0.4 ? '#2d6cdf' : '#c0392b');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -base.r * 1.25);
      ctx.lineTo(base.r * 0.75, 0);
      ctx.lineTo(0, base.r * 1.25);
      ctx.lineTo(-base.r * 0.75, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 内芯
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -base.r * 0.45);
      ctx.lineTo(base.r * 0.28, 0);
      ctx.lineTo(0, base.r * 0.45);
      ctx.lineTo(-base.r * 0.28, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 血条（受创后显示）
      if (base.hp < base.maxHp) {
        var w = 90, y0 = sy - base.r - 26;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(sx - w / 2, y0, w, 7);
        ctx.fillStyle = base.hp / base.maxHp > 0.4 ? '#4aa3ff' : '#ff4757';
        ctx.fillRect(sx - w / 2 + 1, y0 + 1, (w - 2) * Math.max(0, base.hp / base.maxHp), 5);
      }
    }
  };
  G.Bg = Bg;
})();

});
__def("js/entities/fx.js", function (module, exports, require) {
// 特效：粒子池、伤害飘字、光圈波纹
var G = require('../boot.js');
(function () {
  var U = G.U;
  var FX = {
    parts: [], texts: [], rings: [],
    MAX: 420,

    burst: function (x, y, n, color, speed, life, size) {
      for (var i = 0; i < n; i++) {
        if (FX.parts.length >= FX.MAX) FX.parts.shift();
        var a = Math.random() * Math.PI * 2;
        var sp = U.rand(0.3, 1) * (speed || 120);
        FX.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: U.rand(0.5, 1) * (life || 0.5), t: 0,
          size: U.rand(0.6, 1.3) * (size || 3.5),
          color: color, drag: 0.9
        });
      }
    },
    // 定向喷溅（受击方向）
    spray: function (x, y, ang, n, color, speed, life, size) {
      for (var i = 0; i < n; i++) {
        if (FX.parts.length >= FX.MAX) FX.parts.shift();
        var a = ang + U.rand(-0.7, 0.7);
        var sp = U.rand(0.4, 1) * (speed || 140);
        FX.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: U.rand(0.5, 1) * (life || 0.4), t: 0,
          size: U.rand(0.6, 1.2) * (size || 3), color: color, drag: 0.88
        });
      }
    },
    text: function (x, y, str, color, size, crit) {
      if (FX.texts.length > 40) FX.texts.shift();
      FX.texts.push({
        x: x + U.rand(-8, 8), y: y, str: str, t: 0,
        life: crit ? 0.85 : 0.6, color: color || '#fff',
        size: (size || 13) * (crit ? 1.45 : 1), crit: !!crit
      });
    },
    ring: function (x, y, color, maxR, life, width) {
      FX.rings.push({ x: x, y: y, t: 0, life: life || 0.35, maxR: maxR || 60, color: color || '#fff', width: width || 3 });
    },

    update: function (dt) {
      var i;
      for (i = FX.parts.length - 1; i >= 0; i--) {
        var p = FX.parts[i];
        p.t += dt;
        if (p.t >= p.life) { FX.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= p.drag; p.vy *= p.drag;
      }
      for (i = FX.texts.length - 1; i >= 0; i--) {
        var tx = FX.texts[i];
        tx.t += dt;
        if (tx.t >= tx.life) { FX.texts.splice(i, 1); continue; }
        tx.y -= 42 * dt;
      }
      for (i = FX.rings.length - 1; i >= 0; i--) {
        FX.rings[i].t += dt;
        if (FX.rings[i].t >= FX.rings[i].life) FX.rings.splice(i, 1);
      }
    },

    draw: function (ctx, ox, oy) {
      var i, a;
      for (i = 0; i < FX.parts.length; i++) {
        var p = FX.parts[i];
        a = 1 - p.t / p.life;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        var s = p.size * (0.4 + 0.6 * a);
        ctx.fillRect(p.x - ox - s / 2, p.y - oy - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      for (i = 0; i < FX.rings.length; i++) {
        var r = FX.rings[i];
        var k = r.t / r.life;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x - ox, r.y - oy, 6 + (r.maxR - 6) * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },

    drawTexts: function (ctx, ox, oy) {
      for (var i = 0; i < FX.texts.length; i++) {
        var t = FX.texts[i];
        var k = t.t / t.life;
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85);
        ctx.font = 'bold ' + t.size + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 3;
        var sx = t.x - ox, sy = t.y - oy;
        if (t.crit) {
          ctx.strokeText(t.str, sx, sy);
        }
        ctx.strokeText(t.str, sx, sy);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, sx, sy);
      }
      ctx.globalAlpha = 1;
    },

    clear: function () {
      FX.parts.length = 0;
      FX.texts.length = 0;
      FX.rings.length = 0;
    }
  };
  G.FX = FX;
})();

});
__def("js/entities/pickup.js", function (module, exports, require) {
// 掉落物：金币 / 经验宝石 / 心 / 磁铁 / 炸弹
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Pickup = {
    list: [],
    // type: coin | gem | heart | magnet | bomb
    spawn: function (type, x, y, value) {
      x = U.clamp(x, 15, D.MAP_W - 15);
      y = U.clamp(y, 15, D.MAP_H - 15);
      var a = Math.random() * Math.PI * 2;
      var sp = U.rand(20, 70);
      Pickup.list.push({
        type: type, x: x, y: y, value: value || 1,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, magnet: false, born: 0.05
      });
    },
    spawnLoot: function (x, y, coin, gem) {
      for (var i = 0; i < coin; i++) Pickup.spawn('coin', x, y, 1);
      for (var j = 0; j < gem; j++) Pickup.spawn('gem', x, y, 1);
      var r = Math.random();
      if (r < D.DROPS.HEAL_CHANCE) Pickup.spawn('heart', x, y);
      else if (r < D.DROPS.HEAL_CHANCE + D.DROPS.MAGNET_CHANCE) Pickup.spawn('magnet', x, y);
      else if (r < D.DROPS.HEAL_CHANCE + D.DROPS.MAGNET_CHANCE + D.DROPS.BOMB_CHANCE) Pickup.spawn('bomb', x, y);
    },
    magnetAll: function () {
      for (var i = 0; i < Pickup.list.length; i++) Pickup.list[i].magnet = true;
    },
    bomb: function (game) {
      var pl = G.Player;
      G.FX.ring(pl.x, pl.y, '#ffd166', D.DROPS.BOMB_RADIUS, 0.5, 6);
      G.FX.burst(pl.x, pl.y, 30, '#ffd166', 300, 0.7, 5);
      G.Camera.shake(9, 0.4);
      G.Audio.play('boom');
      var near = game.grid.query(pl.x, pl.y, D.DROPS.BOMB_RADIUS + 30);
      for (var i = 0; i < near.length; i++) {
        var e = near[i];
        if (!e.dead && U.dist2(pl.x, pl.y, e.x, e.y) <= (D.DROPS.BOMB_RADIUS + e.r) * (D.DROPS.BOMB_RADIUS + e.r)) {
          game.damageEnemy(e, D.DROPS.BOMB_DMG, e.x, e.y, true);
        }
      }
    },
    update: function (dt, game) {
      var pl = G.Player;
      var pr = pl.pickRange();
      var list = Pickup.list;

      // 上限策略：不删除掉落物，先强制磁吸；极端爆量才自动入账（数值零丢失）
      if (list.length > 240) {
        var forced = 0;
        for (var fi = 0; fi < list.length && forced < 60; fi++) {
          if (!list[fi].magnet) { list[fi].magnet = true; forced++; }
        }
      }
      while (list.length > 300) {
        var old = list.shift();
        if (old.type !== 'bomb') Pickup.collect(old, game); // 自动入账（炸弹直接丢弃，避免在玩家身边乱炸）
      }

      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.t += dt;
        if (p.born > 0) p.born -= dt;
        var d2 = U.dist2(p.x, p.y, pl.x, pl.y);
        var rr = p.magnet ? 99999 : pr;
        var pulling = !pl.dead && p.born <= 0 && (p.magnet || d2 < rr * rr);
        if (pulling) {
          // 磁吸：匀速直飞（约为旧有效速度的2倍）
          var d = Math.sqrt(d2) || 1;
          var fly = (p.magnet ? 360 : 260) * dt;
          if (fly >= d) {
            p.x = pl.x; p.y = pl.y;
          } else {
            p.x += (pl.x - p.x) / d * fly;
            p.y += (pl.y - p.y) / d * fly;
          }
          p.vx = 0; p.vy = 0;
        } else {
          p.vx *= Math.pow(0.004, dt); p.vy *= Math.pow(0.004, dt);
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        // 拾取（碰到主角身体边缘才算，避免消失在半空）
        var pickR = pl.r + 3;
        if (!pl.dead && U.dist2(p.x, p.y, pl.x, pl.y) < pickR * pickR) {
          Pickup.collect(p, game);
          list.splice(i, 1);
        }
      }
    },
    collect: function (p, game) {
      var pl = G.Player;
      switch (p.type) {
        case 'coin':
          game.addGold(Math.ceil(p.value * (1 + pl.stats.gold * 0.25)));
          G.Audio.play('coin');
          break;
        case 'gem':
          game.addXp(p.value);
          if (G.Skills) G.Skills.onGemPickup(game);
          G.Audio.play('pick');
          break;
        case 'heart':
          pl.heal(D.DROPS.HEAL_AMOUNT);
          G.Audio.play('heal');
          break;
        case 'magnet':
          Pickup.magnetAll();
          G.Audio.play('heal');
          G.FX.text(pl.x, pl.y - 30, '磁力全收!', '#7ef9ff', 14);
          break;
        case 'bomb':
          Pickup.bomb(game);
          break;
      }
    },
    draw: function (ctx, ox, oy) {
      var t = Date.now() / 1000;
      for (var i = 0; i < Pickup.list.length; i++) {
        var p = Pickup.list[i];
        var sx = p.x - ox, sy = p.y - oy + Math.sin(t * 4 + i) * 2;
        var s = 7;
        switch (p.type) {
          case 'coin':
            ctx.fillStyle = '#ffd700';
            ctx.strokeStyle = '#b8860b';
            ctx.beginPath(); ctx.arc(sx, sy, s * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff59d';
            ctx.fillRect(sx - 1, sy - 3.4, 2, 6.8);
            break;
          case 'gem':
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.moveTo(sx, sy - s * 0.8); ctx.lineTo(sx + s * 0.6, sy);
            ctx.lineTo(sx, sy + s * 0.8); ctx.lineTo(sx - s * 0.6, sy);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(sx - 1, sy - 3, 1.6, 5);
            break;
          case 'heart':
            ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('❤', sx, sy + 4);
            break;
          case 'magnet':
            ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('🧲', sx, sy + 4);
            break;
          case 'bomb':
            ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('💣', sx, sy + 4);
            break;
        }
      }
    },
    clear: function () { Pickup.list.length = 0; }
  };
  G.Pickup = Pickup;
})();

});
__def("js/entities/projectile.js", function (module, exports, require) {
// 弹幕：玩家子弹 / 英雄子弹 / 敌方子弹
var G = require('../boot.js');
(function () {
  var U = G.U;
  var Proj = {
    list: [],
    spawn: function (o) {
      Proj.list.push({
        x: o.x, y: o.y,
        vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed,
        dmg: o.dmg, pierce: o.pierce || 0, size: o.size || 4,
        color: o.color || '#fff', friendly: !!o.friendly,
        life: o.life || 2, t: 0,
        splash: o.splash || 0,
        kind: o.kind || 'bullet', // bullet | fireball | cannonball | enemy
        hitSet: null
      });
    },
    update: function (dt, game) {
      var list = Proj.list;
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.t += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var dead = p.t >= p.life
          || p.x < -30 || p.y < -30 || p.x > G.D.MAP_W + 30 || p.y > G.D.MAP_H + 30;
        if (!dead) {
          if (p.friendly) dead = Proj.hitEnemies(p, game);
          else dead = Proj.hitFriendlies(p, game);
        }
        if (dead) {
          if (p.splash > 0) Proj.explode(p, game);
          list.splice(i, 1);
        }
      }
    },
    hitEnemies: function (p, game) {
      var near = game.grid.query(p.x, p.y, p.size + 30);
      for (var i = 0; i < near.length; i++) {
        var e = near[i];
        if (e.dead) continue;
        if (p.hitSet && p.hitSet.indexOf(e) >= 0) continue;
        var rr = e.r + p.size;
        if (U.dist2(p.x, p.y, e.x, e.y) <= rr * rr) {
          game.damageEnemy(e, p.dmg, p.x, p.y, p.kind === 'cannonball');
          if (p.echo && G.Skills) G.Skills._echoOnHit(e, game, G.Skills.levelOf('echo'));
          if (p.hitSet) p.hitSet.push(e);
          if (p.pierce > 0) {
            p.pierce--;
            return false;
          }
          return true;
        }
      }
      return false;
    },
    hitFriendlies: function (p, game) {
      // 打玩家
      var pl = G.Player;
      if (!pl.dead) {
        var rr = pl.r + p.size;
        if (U.dist2(p.x, p.y, pl.x, pl.y) <= rr * rr) {
          pl.damage(p.dmg, game);
          return true;
        }
      }
      // 打基地
      var b = game.base;
      if (b && b.hp > 0) {
        var br = b.r + p.size;
        if (U.dist2(p.x, p.y, b.x, b.y) <= br * br) {
          game.damageBase(p.dmg);
          return true;
        }
      }
      return false;
    },
    explode: function (p, game) {
      var col = p.kind === 'cannonball' ? '#ffd166' : '#ff9f43';
      G.FX.ring(p.x, p.y, col, p.splash, 0.3, 4);
      G.FX.burst(p.x, p.y, 12, col, 180, 0.5, 4);
      G.Audio.play('boom');
      if (!p.friendly) return;
      var near = game.grid.query(p.x, p.y, p.splash + 20);
      for (var i = 0; i < near.length; i++) {
        var e = near[i];
        if (e.dead) continue;
        var d = Math.sqrt(U.dist2(p.x, p.y, e.x, e.y));
        if (d <= p.splash + e.r) {
          var k = 1 - Math.min(1, d / (p.splash + e.r)) * 0.5;
          game.damageEnemy(e, p.dmg * k, e.x, e.y, true);
        }
      }
    },
    draw: function (ctx, ox, oy) {
      for (var i = 0; i < Proj.list.length; i++) {
        var p = Proj.list[i];
        var sx = p.x - ox, sy = p.y - oy;
        if (p.kind === 'enemy') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(sx - p.size * 0.3, sy - p.size * 0.3, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 拖尾
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(sx - p.vx * 0.03, sy - p.vy * 0.03);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(sx, sy, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    clear: function () { Proj.list.length = 0; }
  };
  G.Proj = Proj;
})();

});
__def("js/entities/player.js", function (module, exports, require) {
// 玩家：可选主角（局外英雄）+ 移动 / 自动攻击 / 属性成长（局内技能加成）
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Player = {
    x: 0, y: 0, r: D.PLAYER.RADIUS,
    hp: D.PLAYER.HP, maxHp: D.PLAYER.HP,
    cls: 'archer', proto: null,   // 当前主角与其总属性
    face: 1, // 朝向 1右 -1左
    attackTimer: 0,
    moving: false, walkT: 0,
    dead: false,

    // 三选一加成
    stats: null,

    reset: function () {
      // 读取所选主角（局外成长）属性
      Player.cls = G.Meta.selected;
      Player.proto = G.Meta.protoStats(Player.cls);
      Player.x = D.MAP_W / 2 + 150;
      Player.y = D.MAP_H / 2 + 120;
      Player.maxHp = Player.proto.maxHp;
      Player.hp = Player.maxHp;
      Player.dead = false;
      Player.attackTimer = 0;
      Player.face = 1;
      Player.r = Player.proto.melee ? 16 : D.PLAYER.RADIUS;
      Player.stats = { atk: 0, aspeed: 0, multi: 0, pierce: 0, crit: 0, bigshot: 0, regen: 0, leech: 0, speed: 0, magnet: 0, gold: 0, allydmg: 0, allyspd: 0, waveAtk: 0 };
    },

    // ---- 派生属性：主角基础 × 局内三选一加成 ----
    attack: function () { return Player.proto.dmg * (1 + Player.stats.atk * 0.2) * (1 + Player.stats.bigshot * 0.08) * (1 + Player.stats.waveAtk) * (G.Skills ? G.Skills.dmgMult() : 1); },
    interval: function () { return Player.proto.interval * Math.pow(0.92, Player.stats.aspeed) * (G.Skills ? G.Skills.aspdMult() : 1); },
    speed: function () { return Player.proto.speed * (1 + Player.stats.speed * 0.1) + (G.Skills ? Player.proto.speed * G.Skills.speedBonus() : 0); },
    // 主角面板 DPS（含暴击期望，不含多弹道），Boss/精英血量定价基准
    dps: function () {
      return Player.attack() * (1 + (Player.stats.crit || 0) * 0.08) / Player.interval();
    },
    pickRange: function () { return D.PLAYER.PICK_RANGE * (1 + Player.stats.magnet * 0.45) * (1 + (G.Skills ? G.Skills.pickBonus() : 0)); },

    update: function (dt, game) {
      if (Player.dead) return;
      // 移动（摇杆）
      var j = G.Input.joystick;
      var vx = 0, vy = 0;
      if (j.active && j.mag > 0.12) {
        vx = j.dx * j.mag; vy = j.dy * j.mag;
        Player.moving = true;
        Player.walkT += dt * 10;
      } else {
        Player.moving = false;
      }
      var sp = Player.speed();
      Player.x += vx * sp * dt;
      Player.y += vy * sp * dt;
      Player.x = U.clamp(Player.x, 20, D.MAP_W - 20);
      Player.y = U.clamp(Player.y, 20, D.MAP_H - 20);
      if (vx !== 0) Player.face = vx > 0 ? 1 : -1;

      // 回血（牧师天赋 + 恢复光环技能）
      var regen = (Player.proto.regen || 0) + Player.stats.regen;
      if (regen > 0 && Player.hp < Player.maxHp) {
        Player.hp = Math.min(Player.maxHp, Player.hp + regen * dt);
      }

      // 自动攻击：找射程内最近敌人
      Player.attackTimer -= dt;
      if (Player.attackTimer <= 0) {
        var target = game.findNearestEnemy(Player.x, Player.y, Player.proto.range);
        if (target) {
          Player.attackTimer = Player.interval();
          if (Player.proto.melee) Player.melee(game, target);
          else Player.shoot(game, target);
        } else {
          Player.attackTimer = 0.05; // 空窗快速轮询
        }
      }
    },

    // 近战环斩（剑士）
    melee: function (game, target) {
      var range = Player.proto.range;
      G.FX.ring(Player.x, Player.y, Player.proto.color, range, 0.22, 3);
      var near = game.grid.query(Player.x, Player.y, range + 30);
      var seen = {};
      var hitAny = false;
      for (var k = 0; k < near.length; k++) {
        var e = near[k];
        if (e.dead || seen[e.x + '_' + e.y]) continue;
        seen[e.x + '_' + e.y] = 1;
        if (U.dist2(Player.x, Player.y, e.x, e.y) <= (range + e.r) * (range + e.r)) {
          var ang = U.angle(Player.x, Player.y, e.x, e.y);
          game.damageEnemy(e, Player.attack(), e.x, e.y, false);
          G.FX.spray(e.x, e.y, ang, 3, '#ffd9a0', 130, 0.3, 3);
          hitAny = true;
        }
      }
      // 面向最近目标
      Player.face = target.x >= Player.x ? 1 : -1;
      if (hitAny) G.Audio.play('hit');
      else G.Audio.play('shoot');
    },

    // 远程射击（弓手/法师/牧师/炮手）
    shoot: function (game, target) {
      var n = 1 + Player.stats.multi;
      var baseAng = U.angle(Player.x, Player.y, target.x, target.y);
      var spread = 0.14;
      var p = Player.proto;
      var kind = 'bullet', color = p.color;
      if (Player.cls === 'mage') kind = 'fireball';
      else if (Player.cls === 'cannon') kind = 'cannonball';
      else if (Player.cls === 'priest') color = '#ffeaa7';
      var size = 4 * (1 + Player.stats.bigshot * 0.3);
      if (kind === 'fireball') size += 2;
      if (kind === 'cannonball') size += 4;
      for (var i = 0; i < n; i++) {
        var ang = baseAng + (i - (n - 1) / 2) * spread;
        G.Proj.spawn({
          x: Player.x, y: Player.y - 6,
          ang: ang,
          speed: p.bulletSpeed || 560,
          dmg: Player.attack(),
          pierce: Player.stats.pierce,
          size: size,
          color: color,
          friendly: true,
          splash: p.splash,
          life: (p.range + 60) / (p.bulletSpeed || 560),
          kind: kind
        });
      }
      Player.face = baseAng >= -Math.PI / 2 && baseAng <= Math.PI / 2 ? 1 : -1;
      G.Audio.play('shoot');
      G.FX.spray(Player.x + Math.cos(baseAng) * 14, Player.y - 6 + Math.sin(baseAng) * 14, baseAng, 2, color, 90, 0.25, 2.5);
    },

    damage: function (dmg, game) {
      if (Player.dead) return;
      // 晶盾回响：先结算护盾吸收
      if (G.Skills) {
        dmg = G.Skills.absorbDamage(dmg, game);
        if (dmg <= 0.01) return;
      }
      Player.hp -= dmg;
      G.FX.text(Player.x, Player.y - 22, '-' + Math.round(dmg), '#ff6b6b', 13);
      G.FX.burst(Player.x, Player.y, 4, '#ff5252', 100, 0.35, 3);
      G.Audio.play('hurt');
      G.Camera.shake(4, 0.2);
      if (Player.hp <= 0) {
        Player.hp = 0;
        Player.dead = true;
      }
    },

    heal: function (v) {
      if (Player.dead) return;
      var real = Math.min(Player.maxHp - Player.hp, v);
      if (real > 0.5) {
        G.FX.text(Player.x, Player.y - 24, '+' + Math.round(real), '#7bed9f', 12);
      }
      Player.hp = Math.min(Player.maxHp, Player.hp + v);
    },

    draw: function (ctx, ox, oy) {
      if (Player.dead) return;
      var sx = Player.x - ox, sy = Player.y - oy;
      var col = Player.proto ? Player.proto.color : '#4aa3ff';
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + Player.r * 0.85, Player.r * 0.9, Player.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      var bob = Player.moving ? Math.sin(Player.walkT) * 2 : 0;
      // 身体（颜色随主角）
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, Player.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // 面甲
      ctx.fillStyle = '#e8f4ff';
      ctx.fillRect(sx - Player.r * 0.55 + (Player.face > 0 ? 3 : -3), sy - 5 + bob, Player.r * 1.1, 4.5);
      // 眼睛
      ctx.fillStyle = '#0a2540';
      var ex = sx + Player.face * 4;
      ctx.fillRect(ex - 3.5, sy - 4 + bob, 3, 3.5);
      ctx.fillRect(ex + 1.5, sy - 4 + bob, 3, 3.5);
      // 武器
      if (Player.proto && Player.proto.melee) {
        // 剑
        ctx.strokeStyle = '#e8eef4';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx + Player.face * 8, sy + 4 + bob);
        ctx.lineTo(sx + Player.face * 22, sy - 10 + bob);
        ctx.stroke();
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx + Player.face * 6, sy + 1 + bob);
        ctx.lineTo(sx + Player.face * 13, sy - 6 + bob);
        ctx.stroke();
      } else {
        // 枪/法杖
        ctx.strokeStyle = Player.cls === 'mage' ? '#8e44ad' : (Player.cls === 'priest' ? '#d4b106' : '#cfd8dc');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(sx + Player.face * 6, sy + bob);
        ctx.lineTo(sx + Player.face * 17, sy - 2 + bob);
        ctx.stroke();
      }
    }
  };
  G.Player = Player;
})();

});
__def("js/entities/skills.js", function (module, exports, require) {
// 附加技能系统：吸血鬼幸存者式独立被动，最多持有3个，每技能5级满级质变
// 星环脉冲 / 时空残影 / 晶盾回响 / 贪婪磁核 / 崩解爆弹
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Skills = {
    owned: {},            // id -> lv (1..5)
    burns: [],            // 灼烧地带（星环Lv5）
    booms: [],            // 待引爆队列（崩解爆弹连锁）
    killCount: 0,         // 爆弹击杀计数
    bombCd: 0,            // 爆弹触发冷却
    shield: { pool: 0, dur: 0, cd: 0 },          // 晶盾
    echo: { arr: [], spawnT: 0, trail: [] },     // 残影
    orbAng: 0,            // 星环角度
    gemStack: 0,          // 磁核Lv5 永久叠伤（本局）
    dmgBuffT: 0, aspdBuffT: 0,                   // 磁核拾取增益

    reset: function () {
      Skills.owned = {};
      Skills.burns.length = 0;
      Skills.booms.length = 0;
      Skills.killCount = 0;
      Skills.bombCd = 0;
      Skills.shield = { pool: 0, dur: 0, cd: 0 };
      Skills.echo = { arr: [], spawnT: 0, trail: [] };
      Skills.orbAng = 0;
      Skills.gemStack = 0;
      Skills.dmgBuffT = 0; Skills.aspdBuffT = 0;
    },

    levelOf: function (id) { return Skills.owned[id] || 0; },
    count: function () { return Object.keys(Skills.owned).length; },

    // 升级弹窗的附加技能选项：已持有的（未满级）+ 未持满3个时的全新技能
    options: function () {
      var pool = [];
      var ids = Object.keys(Skills.owned);
      var i;
      for (i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (Skills.owned[id] < D.ASKILLS[id].max) pool.push(id);
      }
      if (Skills.count() < D.ASKILL_MAX_COUNT) {
        for (i = 0; i < D.ASKILL_ORDER.length; i++) {
          if (!Skills.owned[D.ASKILL_ORDER[i]]) pool.push(D.ASKILL_ORDER[i]);
        }
      }
      // 随机抽最多3个
      var out = [];
      while (out.length < 3 && pool.length > 0) {
        var idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0]);
      }
      return out;
    },

    choose: function (id) {
      Skills.owned[id] = Skills.levelOf(id) + 1;
      G.Audio.play('upgrade');
      var pl = G.Player;
      G.FX.ring(pl.x, pl.y, '#bb8fce', 46, 0.45, 3);
      G.FX.text(pl.x, pl.y - 34, D.ASKILLS[id].name + ' Lv' + Skills.owned[id], '#bb8fce', 14);
      // 晶盾首次获取立即给一层
      if (id === 'shield' && Skills.owned[id] === 1) {
        Skills.shield.cd = 0;
      }
    },

    // ---- 对外数值钩子 ----
    pickBonus: function () {
      var lv = Skills.levelOf('magnet');
      return [0, 0.3, 0.6, 1.0, 1.0, 1.6][lv];
    },
    dmgMult: function () {
      var m = 1 + Skills.gemStack;
      if (Skills.dmgBuffT > 0) m *= 1.1;
      return m;
    },
    aspdMult: function () { return Skills.aspdBuffT > 0 ? 0.85 : 1; },
    speedBonus: function () {
      var lv = Skills.levelOf('shield');
      if (lv >= 3 && Skills.shield.pool > 0) return lv >= 5 ? 0.15 : 0.10;
      return 0;
    },

    // 受伤结算：先吃护盾，再触发新护盾
    absorbDamage: function (dmg, game) {
      var sh = Skills.shield;
      var lv = Skills.levelOf('shield');
      if (lv > 0 && sh.pool > 0) {
        var absorbed = Math.min(sh.pool, dmg);
        sh.pool -= absorbed;
        dmg -= absorbed;
        G.FX.text(G.Player.x, G.Player.y - 26, '盾 -' + Math.round(absorbed), '#7ef9ff', 12);
        if (sh.pool <= 0) Skills.breakShield(game);
      }
      // 受伤后触发新护盾
      if (lv > 0 && sh.pool <= 0 && sh.dur <= 0 && sh.cd <= 0) {
        var cfg = Skills._shieldCfg(lv);
        sh.pool = G.Player.maxHp * cfg.pool;
        sh.dur = cfg.dur;
        sh.cd = cfg.cd + cfg.dur;
        G.FX.ring(G.Player.x, G.Player.y, '#7ef9ff', 40, 0.4, 3);
        G.Audio.play('heal');
      }
      return dmg;
    },
    _shieldCfg: function (lv) {
      return {
        pool: [0, 0.20, 0.30, 0.30, 0.35, 0.40][lv],
        dur: [0, 3.0, 3.5, 3.5, 4.0, 4.0][lv],
        cd: [0, 9, 7, 7, 6, 3.5][lv]
      };
    },
    breakShield: function (game) {
      var sh = Skills.shield;
      var lv = Skills.levelOf('shield');
      sh.pool = 0; sh.dur = 0;
      if (lv >= 4) {
        var r = lv >= 5 ? 220 : 140;
        var dmg = G.Player.attack() * (lv >= 5 ? 3 : 2);
        Skills.explode(G.Player.x, G.Player.y, r, dmg, game, lv >= 5 ? 0 : 1, true);
        if (lv >= 5) {
          // 冲击波命中回血在explode内统计后回调
          G.Player.heal(Skills._shockHeal);
        }
      }
    },
    _shockHeal: 0,

    // 通用爆炸（爆弹技能 + 盾破碎共用）
    explode: function (x, y, r, dmg, game, depth, isShield) {
      var lv = Skills.levelOf('bomb');
      G.FX.ring(x, y, '#ffb142', r, 0.35, 5);
      G.FX.burst(x, y, 14, '#ffb142', 220, 0.5, 5);
      G.Camera.shake(4, 0.2);
      G.Audio.play('boom');
      var chainChance = isShield ? 0 : [0, 0, 0, 0.25, 0.25, 0.5][lv];
      var chainCap = isShield ? 0 : [0, 0, 0, 2, 4, 999][lv];
      var stun = isShield ? 0 : [0, 0, 0, 0, 0.8, 1.0][lv];
      var near = game.grid.query(x, y, r + 40);
      var seen = {};
      Skills._shockHeal = 0;
      for (var k = 0; k < near.length; k++) {
        var e = near[k];
        if (e.dead || seen[e.x + '_' + e.y]) continue;
        seen[e.x + '_' + e.y] = 1;
        var rr = r + e.r;
        if (U.dist2(x, y, e.x, e.y) <= rr * rr) {
          game.damageEnemy(e, dmg, x, y, true);
          if (isShield && !e.dead) {
            var kd = Math.sqrt(U.dist2(x, y, e.x, e.y)) || 1;
            e.kbX = (e.x - x) / kd * 260;
            e.kbY = (e.y - y) / kd * 260;
          }
          if (stun > 0 && !e.dead) e.stunT = Math.max(e.stunT || 0, stun);
          if (isShield && lv >= 5) Skills._shockHeal += 3;
          if (chainChance > 0 && depth < chainCap && !e.dead && Math.random() < chainChance) {
            Skills.booms.push({ x: e.x, y: e.y, delay: 0.15, depth: depth + 1 });
          }
        }
      }
    },

    // ---- 击杀 / 拾取钩子 ----
    onKill: function (e, game) {
      var lv = Skills.levelOf('bomb');
      if (lv > 0 && Skills.bombCd <= 0) {
        Skills.killCount++;
        var need = [0, 12, 9, 7, 6, 4][lv];
        if (Skills.killCount >= need) {
          Skills.killCount = 0;
      Skills.bombCd = 0;
          Skills.bombCd = [0, 6, 8, 11, 15, 20][lv]; // 触发冷却，满级20秒
          Skills.booms.push({ x: e.x, y: e.y, delay: 0, depth: 0 });
        }
      }
      var mlv = Skills.levelOf('magnet');
      if (mlv >= 4 && Math.random() < 0.15) {
        G.Pickup.spawn('gem', e.x, e.y, 1);
      }
    },
    onGemPickup: function (game) {
      var lv = Skills.levelOf('magnet');
      if (lv >= 2) Skills.dmgBuffT = 4;
      if (lv >= 3) Skills.aspdBuffT = 4;
      if (lv >= 5) Skills.gemStack += 0.004;
    },

    // ---- 帧更新 ----
    update: function (dt, game) {
      var pl = G.Player;
      if (pl.dead) return;
      var i, k;

      if (Skills.dmgBuffT > 0) Skills.dmgBuffT -= dt;
      if (Skills.aspdBuffT > 0) Skills.aspdBuffT -= dt;
      if (Skills.bombCd > 0) Skills.bombCd -= dt;

      // 晶盾计时
      var sh = Skills.shield;
      if (sh.dur > 0) {
        sh.dur -= dt;
        if (sh.dur <= 0 && sh.pool > 0) { sh.pool = 0; } // 到期静默消散
      }
      if (sh.cd > 0) sh.cd -= dt;

      // 灼烧地带
      for (i = Skills.burns.length - 1; i >= 0; i--) {
        var b = Skills.burns[i];
        b.t -= dt; b.tick -= dt;
        if (b.t <= 0) { Skills.burns.splice(i, 1); continue; }
        if (b.tick <= 0) {
          b.tick = 0.4;
          var bn = game.grid.query(b.x, b.y, b.r + 30);
          var bs = {};
          for (k = 0; k < bn.length; k++) {
            var be = bn[k];
            if (be.dead || bs[be.x + '_' + be.y]) continue;
            bs[be.x + '_' + be.y] = 1;
            if (U.dist2(b.x, b.y, be.x, be.y) <= (b.r + be.r) * (b.r + be.r)) {
              game.damageEnemy(be, b.dps * 0.4, be.x, be.y, false);
            }
          }
        }
      }

      // 星环脉冲
      var slv = Skills.levelOf('star');
      if (slv > 0) {
        var cfg = Skills._starCfg(slv);
        Skills.orbAng += cfg.speed * dt;
        // 每层每球判定
        for (i = 0; i < cfg.layers.length; i++) {
          var L = cfg.layers[i];
          var ang0 = Skills.orbAng * (i % 2 === 0 ? 1 : -1.3) + i * 2.1;
          for (k = 0; k < L.orbs; k++) {
            var a = ang0 + (k / L.orbs) * Math.PI * 2;
            var ox = pl.x + Math.cos(a) * L.r;
            var oy = pl.y + Math.sin(a) * L.r;
            var near = game.grid.query(ox, oy, 24);
            var seen = {};
            for (var q = 0; q < near.length; q++) {
              var e = near[q];
              if (e.dead || seen[e.x + '_' + e.y]) continue;
              seen[e.x + '_' + e.y] = 1;
              if ((e.orbT || 0) > 0) continue;
              var rr = 9 + e.r;
              if (U.dist2(ox, oy, e.x, e.y) <= rr * rr) {
                e.orbT = cfg.hitCd;
                game.damageEnemy(e, cfg.dmgM * pl.attack(), ox, oy, false);
                G.FX.spray(e.x, e.y, a, 2, '#8fd9ff', 110, 0.25, 2.5);
                // 耀星环：灼烧地带
                if (slv >= 5 && Skills.burns.length < 24) {
                  Skills.burns.push({ x: e.x, y: e.y, r: 42, t: 2.5, tick: 0.4, dps: 0.5 * pl.attack() });
                }
              }
            }
          }
        }
      }

      // 时空残影
      var elv = Skills.levelOf('echo');
      if (elv > 0) {
        var ecfg = Skills._echoCfg(elv);
        // 轨迹记录（跟随用）
        Skills.echo.trail.unshift({ x: pl.x, y: pl.y });
        if (Skills.echo.trail.length > 130) Skills.echo.trail.pop();
        // 数量调整
        while (Skills.echo.arr.length < ecfg.count) Skills.echo.arr.push({ x: pl.x, y: pl.y, atkT: U.rand(0.5, 1.5) });
        while (Skills.echo.arr.length > ecfg.count) Skills.echo.arr.pop();
        // 位置
        for (i = 0; i < Skills.echo.arr.length; i++) {
          var eh = Skills.echo.arr[i];
          if (elv >= 4) {
            var idx = Math.min(Skills.echo.trail.length - 1, Math.floor((i + 1) * 45));
            var tp = Skills.echo.trail[idx];
            if (tp) { eh.x = tp.x; eh.y = tp.y; }
          }
          eh.atkT -= dt;
          if (eh.atkT <= 0) {
            eh.atkT = ecfg.interval;
            Skills._echoAttack(eh, pl, game, ecfg, elv);
          }
        }
      }

      // 引力漩涡（磁核Lv5）
      var mlv = Skills.levelOf('magnet');
      if (mlv >= 5) {
        var vr = 160 + pl.pickRange();
        Skills.vacuum = { x: pl.x, y: pl.y, r: vr };
        // 圈内持续伤害（0.5s一次，统一在此处理）
        Skills._vacTick = (Skills._vacTick || 0) - dt;
        if (Skills._vacTick <= 0) {
          Skills._vacTick = 0.5;
          var vn = game.grid.query(pl.x, pl.y, vr + 30);
          var vs = {};
          for (i = 0; i < vn.length; i++) {
            var ve = vn[i];
            if (ve.dead || vs[ve.x + '_' + ve.y]) continue;
            vs[ve.x + '_' + ve.y] = 1;
            if (U.dist2(pl.x, pl.y, ve.x, ve.y) <= (vr + ve.r) * (vr + ve.r)) {
              game.damageEnemy(ve, pl.attack() * 0.4 * 0.5, pl.x, pl.y, false);
            }
          }
        }
      } else {
        Skills.vacuum = null;
      }

      // 崩解爆弹队列
      for (i = Skills.booms.length - 1; i >= 0; i--) {
        var bm = Skills.booms[i];
        bm.delay -= dt;
        if (bm.delay <= 0) {
          Skills.booms.splice(i, 1);
          var blv = Skills.levelOf('bomb');
          if (blv > 0) {
            var br = [0, 90, 105, 120, 135, 150][blv];
            var bdmg = pl.attack() * [0, 1.5, 2, 2.5, 3, 3.5][blv];
            Skills.explode(bm.x, bm.y, br, bdmg, game, bm.depth, false);
          }
        }
      }
    },

    _starCfg: function (lv) {
      var layers;
      switch (lv) {
        case 1: layers = [{ r: 58, orbs: 3 }]; break;
        case 2: layers = [{ r: 72, orbs: 3 }]; break;
        case 3: layers = [{ r: 66, orbs: 3 }, { r: 96, orbs: 3 }]; break;
        case 4: layers = [{ r: 66, orbs: 3 }, { r: 96, orbs: 4 }]; break;
        default: layers = [{ r: 58, orbs: 4 }, { r: 88, orbs: 4 }, { r: 118, orbs: 4 }]; break;
      }
      var speed = [0, 1.6, 2.0, 2.0, 2.4, 2.8][lv];
      var dmgM = [0, 0.5, 0.6, 0.65, 0.8, 0.9][lv];
      var hitCd = lv >= 4 ? 0.3 : 0.55;
      return { layers: layers, speed: speed, dmgM: dmgM, hitCd: hitCd };
    },
    _echoCfg: function (lv) {
      return {
        count: lv >= 5 ? 3 : (lv >= 3 ? 2 : 1),
        interval: [0, 3.0, 2.4, 2.4, 2.0, 1.6][lv],
        dmgMult: [0, 0.6, 0.8, 0.8, 0.9, 1.0][lv]
      };
    },

    // 残影攻击：模仿当前武器（近战→环斩；远程→弹道）
    _echoAttack: function (eh, pl, game, cfg, elv) {
      var target = game.findNearestEnemy(eh.x, eh.y, pl.proto.range);
      if (!target) return;
      var dmg = pl.attack() * cfg.dmgMult;
      if (pl.proto.melee) {
        G.FX.ring(eh.x, eh.y, 'rgba(142,220,255,0.9)', pl.proto.range * 0.8, 0.22, 2.5);
        var near = game.grid.query(eh.x, eh.y, pl.proto.range + 30);
        var seen = {};
        for (var k = 0; k < near.length; k++) {
          var e = near[k];
          if (e.dead || seen[e.x + '_' + e.y]) continue;
          seen[e.x + '_' + e.y] = 1;
          var rr = pl.proto.range * 0.8 + e.r;
          if (U.dist2(eh.x, eh.y, e.x, e.y) <= rr * rr) {
            game.damageEnemy(e, dmg, eh.x, eh.y, false);
            Skills._echoOnHit(e, game, elv);
          }
        }
      } else {
        var ang = U.angle(eh.x, eh.y, target.x, target.y);
        G.Proj.spawn({
          x: eh.x, y: eh.y, ang: ang,
          speed: pl.proto.bulletSpeed || 560,
          dmg: dmg, size: 4, color: 'rgba(142,220,255,0.95)',
          friendly: true, splash: pl.proto.splash,
          life: (pl.proto.range + 60) / (pl.proto.bulletSpeed || 560),
          kind: 'bullet', echo: true
        });
      }
      G.Audio.play('shoot');
    },
    // 残影命中附加效果：减速（Lv4+）、灼烧（星环Lv5联动）
    _echoOnHit: function (e, game, elv) {
      if (elv >= 4 && !e.dead) e.slowT = 1.2;
      if (elv >= 5 && Skills.levelOf('star') >= 5 && !e.dead && Skills.burns.length < 24) {
        Skills.burns.push({ x: e.x, y: e.y, r: 42, t: 2.5, tick: 0.4, dps: 0.5 * G.Player.attack() });
      }
    },

    // ---- 绘制（世界层） ----
    draw: function (ctx, ox, oy) {
      var pl = G.Player;
      if (pl.dead) return;
      var i, k;
      // 灼烧地带
      for (i = 0; i < Skills.burns.length; i++) {
        var b = Skills.burns[i];
        var a = Math.min(1, b.t / 0.8) * 0.35;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath();
        ctx.arc(b.x - ox, b.y - oy, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a + 0.2;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 引力漩涡
      if (Skills.vacuum) {
        ctx.globalAlpha = 0.10 + 0.04 * Math.sin(Date.now() / 180);
        ctx.fillStyle = '#7ef9ff';
        ctx.beginPath();
        ctx.arc(pl.x - ox, pl.y - oy, Skills.vacuum.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#7ef9ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 星环
      var slv = Skills.levelOf('star');
      if (slv > 0) {
        var cfg = Skills._starCfg(slv);
        for (i = 0; i < cfg.layers.length; i++) {
          var L = cfg.layers[i];
          var ang0 = Skills.orbAng * (i % 2 === 0 ? 1 : -1.3) + i * 2.1;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = slv >= 5 ? '#ffe082' : '#8fd9ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pl.x - ox, pl.y - oy, L.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          for (k = 0; k < L.orbs; k++) {
            var a = ang0 + (k / L.orbs) * Math.PI * 2;
            var ox2 = pl.x + Math.cos(a) * L.r - ox;
            var oy2 = pl.y + Math.sin(a) * L.r - oy;
            ctx.fillStyle = slv >= 5 ? '#ffe082' : '#e8f6ff';
            ctx.beginPath();
            ctx.arc(ox2, oy2, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(ox2, oy2, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 残影
      for (i = 0; i < Skills.echo.arr.length; i++) {
        var eh = Skills.echo.arr[i];
        var ex = eh.x - ox, ey = eh.y - oy;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#5db9ff';
        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#8fd9ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(ex, ey, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 晶盾
      if (Skills.shield.pool > 0) {
        var shk = 1 + Math.sin(Date.now() / 150) * 0.06;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#7ef9ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pl.x - ox, pl.y - oy, 22 * shk, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#7ef9ff';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  };
  G.Skills = Skills;
})();

});
__def("js/entities/enemy.js", function (module, exports, require) {
// 敌人：四类小怪 + 精英 + Boss，含空间哈希网格与仇恨AI
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;

  // ---- 空间哈希网格（碰撞/索敌加速） ----
  var Grid = {
    cell: 100, map: {},
    clear: function () { Grid.map = {}; },
    key: function (cx, cy) { return cx + ',' + cy; },
    insert: function (e) {
      var cx = Math.floor(e.x / Grid.cell), cy = Math.floor(e.y / Grid.cell);
      var k = Grid.key(cx, cy);
      (Grid.map[k] || (Grid.map[k] = [])).push(e);
    },
    // 查询 (x,y) 半径 r 内的敌人（结果可能重复，碰撞判断无碍；索敌时调用方可自行判重）
    query: function (x, y, r) {
      var out = [];
      var c0 = Math.floor((x - r) / Grid.cell), c1 = Math.floor((x + r) / Grid.cell);
      var r0 = Math.floor((y - r) / Grid.cell), r1 = Math.floor((y + r) / Grid.cell);
      for (var cx = c0; cx <= c1; cx++) {
        for (var cy = r0; cy <= r1; cy++) {
          var arr = Grid.map[Grid.key(cx, cy)];
          if (arr) for (var i = 0; i < arr.length; i++) out.push(arr[i]);
        }
      }
      return out;
    }
  };
  G.Grid = Grid;

  var Enemy = {
    list: [],
    reset: function () { Enemy.list.length = 0; Grid.clear(); },

    // 关卡制 spawn：opts = { level, wave, elite, boss }
    spawn: function (game, type, x, y, opts) {
      opts = opts || {};
      var base = D.ENEMIES[type];
      var level = opts.level || 1;
      var wave = opts.wave || 1;
      var diff = G.Waves.diffBase(level);
      var hpMult = G.Waves.hpMult(level, wave);
      var dmgG = (1 + 0.10 * (level - 1)) * Math.pow(1.04, wave - 1);
      // 产出随波次与关卡难度成长
      var lootG = (1 + D.WAVE.GOLD_GROWTH * wave) * Math.pow(diff, 0.5);
      var e = {
        type: type, x: x, y: y,
        hp: base.hp * hpMult, maxHp: base.hp * hpMult,
        speed: base.speed, dmg: base.dmg * dmgG,
        r: base.radius, coin: Math.ceil(base.coin * lootG), gem: Math.ceil(base.gem * lootG),
        color: base.color, wave: wave, level: level, hpMult: hpMult,
        dead: false, hitT: 0,
        elite: false, boss: false,
        atkT: U.rand(0.3, 1.0), // 攻击计时
        shootT: 0,
        vx: 0, vy: 0, wobT: Math.random() * 10,
        stunT: 0, slowT: 0, orbT: 0, kbX: 0, kbY: 0
      };
      if (opts.elite) {
        e.elite = true;
        e.hp = Math.max(60, G.Player.dps() * D.ELITE.DPS_MULT); // 精英=主角DPS×7
        e.maxHp = e.hp;
        e.speed *= D.ELITE.SPEED; e.r *= D.ELITE.RADIUS;
        e.coin = Math.ceil(D.ELITE.COIN * lootG); e.gem = Math.ceil(D.ELITE.GEM * lootG);
        e.dmg *= 1.5;
      }
      if (opts.boss) {
        e.boss = true;
        e.hp = Math.max(300, G.Player.dps() * D.BOSS.DPS_MULT); // Boss=主角DPS×15
        e.maxHp = e.hp;
        e.speed = D.BOSS.SPEED; e.dmg = D.BOSS.DMG; e.r = D.BOSS.RADIUS;
        e.coin = Math.ceil(D.BOSS.COIN * lootG); e.gem = Math.ceil(D.BOSS.GEM * lootG);
        e.color = '#c0392b';
        e.summonT = D.BOSS.SUMMON_INTERVAL;
      }
      Enemy.list.push(e);
      return e;
    },

    // ---- 仇恨AI：玩家在仇恨半径内则追玩家，否则冲基地 ----
    aggroRange: 190,
    update: function (dt, game) {
      var pl = G.Player, b = game.base;
      var list = Enemy.list;
      Grid.clear();
      var i, e;
      for (i = 0; i < list.length; i++) Grid.insert(list[i]);

      for (i = list.length - 1; i >= 0; i--) {
        e = list[i];
        if (e.dead) { list.splice(i, 1); continue; }
        if (e.hitT > 0) e.hitT -= dt;
        e.wobT += dt;
        if (e.orbT > 0) e.orbT -= dt;
        if (e.slowT > 0) e.slowT -= dt;
        if (e.stunT > 0) e.stunT -= dt;
        // 击退
        if (e.kbX || e.kbY) {
          e.x += (e.kbX || 0) * dt;
          e.y += (e.kbY || 0) * dt;
          var kdec = Math.pow(0.01, dt);
          e.kbX *= kdec; e.kbY *= kdec;
          if (Math.abs(e.kbX) < 2) e.kbX = 0;
          if (Math.abs(e.kbY) < 2) e.kbY = 0;
        }

        // 目标选择
        var tx, ty, targetingPlayer = false;
        var dPlayer = U.dist2(e.x, e.y, pl.x, pl.y);
        if (!pl.dead && dPlayer < Enemy.aggroRange * Enemy.aggroRange) {
          targetingPlayer = true;
          tx = pl.x; ty = pl.y;
        } else if (b && b.hp > 0) {
          tx = b.x; ty = b.y;
        } else if (!pl.dead) {
          tx = pl.x; ty = pl.y;
        } else {
          tx = e.x; ty = e.y;
        }

        var dx = tx - e.x, dy = ty - e.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var targetR = targetingPlayer ? (pl.r + e.r) : (b ? b.r + e.r : 0);

        // 远程敌人：射程外才前进
        var sh = D.ENEMIES[e.type];
        var stopDist = targetR;
        if (sh && sh.shootRange) {
          stopDist = Math.min(sh.shootRange * 0.8, targetR + sh.shootRange * 0.5);
          if (targetingPlayer) stopDist = targetR; // 追玩家时贴脸
        }

        var sepX = 0, sepY = 0;
        if (e.wobT < 99) {
          // 同类分离（只查邻近网格）
          var near = Grid.query(e.x, e.y, e.r + 26);
          for (var k = 0; k < near.length; k++) {
            var o = near[k];
            if (o === e || o.dead) continue;
            var ddx = e.x - o.x, ddy = e.y - o.y;
            var dd = ddx * ddx + ddy * ddy;
            var minD = e.r + o.r;
            if (dd < minD * minD && dd > 0.01) {
              var dl = Math.sqrt(dd);
              sepX += ddx / dl * (minD - dl) * 2.2;
              sepY += ddy / dl * (minD - dl) * 2.2;
            }
          }
        }

        var sp = e.speed * (e.slowT > 0 ? 0.55 : 1);
        if (e.stunT <= 0) {
          if (d > stopDist) {
            e.x += (dx / d * sp + sepX) * dt;
            e.y += (dy / d * sp + sepY) * dt;
          } else if (sepX || sepY) {
            e.x += sepX * dt; e.y += sepY * dt;
          }
        }

        // 攻击（眩晕时不攻击）
        e.atkT -= dt;
        if (e.atkT <= 0 && e.stunT <= 0) {
          if (targetingPlayer && d <= targetR + 6) {
            e.atkT = 1.0;
            pl.damage(e.dmg, game);
            G.FX.spray(pl.x, pl.y, Math.atan2(e.y - pl.y, e.x - pl.x), 5, '#ff6b6b', 120, 0.3, 3);
          } else if (!targetingPlayer && b && b.hp > 0 && d <= targetR + 6) {
            e.atkT = 1.0;
            game.damageBase(e.dmg);
            G.FX.burst(b.x, b.y + 10, 6, '#ff7675', 110, 0.4, 3);
          } else {
            e.atkT = 0.2;
          }
        }

        // 远程敌人射击
        if (sh && sh.shootRange && !pl.dead && e.stunT <= 0) {
          e.shootT -= dt;
          if (e.shootT <= 0 && dPlayer < sh.shootRange * sh.shootRange) {
            e.shootT = sh.shootInterval;
            var ang = U.angle(e.x, e.y, pl.x, pl.y);
            G.Proj.spawn({
              x: e.x, y: e.y, ang: ang, speed: sh.bulletSpeed,
              dmg: e.dmg, size: 5, color: '#7bed9f', friendly: false,
              life: 3, kind: 'enemy'
            });
          }
        }

        // Boss 召唤
        if (e.boss) {
          e.summonT -= dt;
          if (e.summonT <= 0) {
            e.summonT = D.BOSS.SUMMON_INTERVAL;
            for (var s = 0; s < D.BOSS.SUMMON_N; s++) {
              var a = Math.random() * Math.PI * 2;
              var se = Enemy.spawn(game, 'slime', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, { level: e.level, wave: e.wave, hpMult: e.hpMult });
              G.FX.ring(se.x, se.y, '#c0392b', 30, 0.3, 2);
            }
            G.FX.text(e.x, e.y - e.r - 14, '召唤!', '#ff9f43', 14);
            G.Audio.play('boss');
          }
        }
      }
    },

    damage: function (game, e, dmg, hx, hy, big) {
      if (e.dead) return;
      // 暴击判定在调用方处理，这里直接扣血
      e.hp -= dmg;
      e.hitT = 0.12;
      G.FX.text(e.x, e.y - e.r - 6, String(Math.round(dmg)), '#fff', big ? 14 : 12);
      G.FX.spray(e.x, e.y, Math.atan2(e.y - (hy || e.y), e.x - (hx || e.x)) + Math.PI, big ? 6 : 3, e.color, 130, 0.35, 3);
      if (e.hp <= 0) {
        e.dead = true;
        G.Audio.play('kill');
        G.FX.burst(e.x, e.y, e.boss ? 40 : (e.elite ? 18 : 8), e.color, e.boss ? 280 : 160, 0.6, e.boss ? 6 : 4);
        G.Pickup.spawnLoot(e.x, e.y, e.coin, e.gem);
        game.onKill(e);
      }
    },

    draw: function (ctx, ox, oy) {
      var t = Date.now() / 1000;
      for (var i = 0; i < Enemy.list.length; i++) {
        var e = Enemy.list[i];
        var sx = e.x - ox, sy = e.y - oy;
        if (sx < -60 || sy < -60 || sx > G.P.screenW + 60 || sy > G.P.screenH + 60) continue;
        var wob = Math.sin(e.wobT * 6) * 0.08;

        // 影子
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + e.r * 0.8, e.r * 0.85, e.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // 身体
        var flash = e.hitT > 0;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(wob);
        ctx.fillStyle = flash ? '#ffffff' : e.color;
        if (e.type === 'slime' || e.type === 'fast' || e.boss) {
          ctx.beginPath();
          ctx.arc(0, 0, e.r, 0, Math.PI * 2);
          ctx.fill();
          // 高光
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath();
          ctx.arc(-e.r * 0.3, -e.r * 0.35, e.r * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.type === 'tank') {
          ctx.fillStyle = flash ? '#ffffff' : e.color;
          ctx.fillRect(-e.r * 0.9, -e.r * 0.8, e.r * 1.8, e.r * 1.6);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 3;
          ctx.strokeRect(-e.r * 0.9, -e.r * 0.8, e.r * 1.8, e.r * 1.6);
        } else { // shooter
          ctx.beginPath();
          ctx.moveTo(0, -e.r * 1.15);
          ctx.lineTo(e.r * 0.95, e.r * 0.75);
          ctx.lineTo(-e.r * 0.95, e.r * 0.75);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // 眼睛
        ctx.fillStyle = '#0a0a0a';
        var eg = e.r * 0.32;
        ctx.beginPath();
        ctx.arc(sx - eg, sy - eg * 0.4, e.r * 0.14, 0, Math.PI * 2);
        ctx.arc(sx + eg, sy - eg * 0.4, e.r * 0.14, 0, Math.PI * 2);
        ctx.fill();

        // 精英描边
        if (e.elite) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.7 + Math.sin(t * 6) * 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy, e.r + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // Boss 皇冠
        if (e.boss) {
          ctx.font = Math.floor(e.r * 0.8) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👑', sx, sy - e.r - 6);
        }

        // 眩晕标记
        if (e.stunT > 0) {
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✦', sx, sy - e.r - 12);
        }

        // 血条
        if (e.hp < e.maxHp) {
          var w = e.r * 2.2, h = 4, y0 = sy - e.r - 10;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(sx - w / 2, y0, w, h);
          ctx.fillStyle = e.boss ? '#ff4757' : (e.hp / e.maxHp > 0.5 ? '#2ecc71' : '#e67e22');
          ctx.fillRect(sx - w / 2, y0, w * Math.max(0, e.hp / e.maxHp), h);
        }
      }
    }
  };
  G.Enemy = Enemy;
})();

});
__def("js/entities/hero.js", function (module, exports, require) {
// 英雄（塔防单位）：招募 / 合成 / 直升 / 出售 / 全局强化，围绕基地自动布阵
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;

  var Hero = {
    list: [],          // 上阵英雄 {id, cls, lv, slotX, slotY(相对基地偏移), coolT, fxT}
    recruitCount: 0,   // 累计招募次数（抬价用）
    nextId: 1,

    reset: function () {
      Hero.list.length = 0;
      Hero.recruitCount = 0;
      Hero.nextId = 1;
    },

    // ---- 属性计算 ----
    dmgMult: function () { return 1 + G.Player.stats.allydmg * 0.15; },
    spdMult: function () { return Math.pow(0.9, G.Player.stats.allyspd); },

    statOf: function (h) {
      var c = D.HEROES[h.cls];
      var lv = h.lv - 1;
      var st = { dmg: 0, heal: 0, interval: 0, range: c.range, splash: c.splash || 0, bulletSpeed: c.bulletSpeed || 0 };
      if (c.heal) {
        st.heal = c.heal * Math.pow(c.healGrowth, lv);
      } else {
        st.dmg = c.dmg * Math.pow(D.HERO.DMG_GROWTH, lv);
      }
      st.interval = c.interval * Math.pow(c.intervalGrowth, lv);
      return st;
    },

    // ---- 招募 ----
    recruitCost: function () { return D.HERO.RECRUIT_BASE + D.HERO.RECRUIT_STEP * Hero.recruitCount; },
    canRecruit: function () { return Hero.list.length < D.HERO.MAX_COUNT; },

    recruit: function (game) {
      if (!Hero.canRecruit()) {
        G.FX.text(G.game.base.x, G.game.base.y - 70, '上阵已满(9)', '#ff9f43', 14);
        G.Audio.play('error');
        return false;
      }
      var cost = Hero.recruitCost();
      if (game.gold < cost) {
        G.FX.text(G.game.base.x, G.game.base.y - 70, '金币不足', '#ff6b6b', 14);
        G.Audio.play('error');
        return false;
      }
      game.gold -= cost;
      Hero.recruitCount++;
      // 随机职业（稀有职业权重低）
      var cls = U.weightedPick(Object.keys(D.HEROES), function (k) { return D.HEROES[k].rare ? 0.45 : 1; });
      Hero.add(cls, 1, game);
      G.Audio.play('recruit');
      return true;
    },

    add: function (cls, lv, game) {
      var b = game.base;
      var pos = Hero.findSlot(b);
      var h = { id: Hero.nextId++, cls: cls, lv: lv, x: b.x + pos.x, y: b.y + pos.y, coolT: U.rand(0, 0.5), fxT: 0 };
      Hero.list.push(h);
      G.FX.ring(h.x, h.y, D.HEROES[cls].color, 34, 0.4, 3);
      return h;
    },

    findSlot: function (b) {
      var n = Hero.list.length;
      var R = D.HERO.SLOT_DIST;
      // 环形布位：第0个在上方，依次绕圈
      if (n === 0) return { x: 0, y: -R * 0.6 };
      var ring = 1, cap = 8;
      var used = n, idx = n;
      if (n >= 1 && n < 4) { ring = 1; idx = n; cap = 3; }
      else if (n >= 4 && n < 9) { ring = 2; idx = n - 4; cap = 5; R *= 1.0; }
      else { ring = 2; idx = n - 4; cap = 5; R *= 1.0; }
      var ang = -Math.PI / 2 + (idx / cap) * Math.PI * 2;
      return { x: Math.cos(ang) * R * (ring === 1 ? 0.75 : 1.05), y: Math.sin(ang) * R * (ring === 1 ? 0.75 : 1.05) };
    },

    // ---- 合成：同类同级 → lv+1 ----
    canMerge: function (a, b) {
      return a !== b && a.cls === b.cls && a.lv === b.lv && a.lv < D.HERO.MAX_LEVEL;
    },
    merge: function (a, b, game) {
      b.lv += 1;
      var i = Hero.list.indexOf(a);
      if (i >= 0) Hero.list.splice(i, 1);
      // 被合并者空出的位置重排
      Hero.relayout(game);
      G.Audio.play('merge');
      G.FX.ring(b.x, b.y, '#ffd700', 60, 0.5, 4);
      G.FX.burst(b.x, b.y, 16, '#ffd700', 170, 0.6, 4);
      G.FX.text(b.x, b.y - 34, D.HEROES[b.cls].name + ' Lv' + b.lv + '!', '#ffd700', 16);
      if (b.lv >= D.HERO.MAX_LEVEL) {
        G.FX.text(b.x, b.y - 54, 'MAX!', '#ff9f43', 14);
      }
    },

    relayout: function (game) {
      var b = game.base;
      for (var j = 0; j < Hero.list.length; j++) {
        var pos = Hero.slotByIndex(j);
        Hero.list[j].x = b.x + pos.x;
        Hero.list[j].y = b.y + pos.y;
      }
    },

    slotByIndex: function (i) {
      var R = D.HERO.SLOT_DIST;
      if (i === 0) return { x: 0, y: -R * 0.6 };
      if (i < 4) {
        var a1 = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        return { x: Math.cos(a1) * R * 0.75, y: Math.sin(a1) * R * 0.75 };
      }
      var a2 = -Math.PI / 2 + ((i - 4) / 5) * Math.PI * 2;
      return { x: Math.cos(a2) * R * 1.05, y: Math.sin(a2) * R * 1.05 };
    },

    // ---- 直升 / 出售 ----
    upgradeCost: function (h) {
      return Math.round(D.HERO.UPGRADE_BASE * Math.pow(D.HERO.UPGRADE_GROWTH, h.lv - 1));
    },
    upgrade: function (h, game) {
      if (h.lv >= D.HERO.MAX_LEVEL) { G.Audio.play('error'); return false; }
      var cost = Hero.upgradeCost(h);
      if (game.gold < cost) {
        G.FX.text(h.x, h.y - 34, '金币不足', '#ff6b6b', 13);
        G.Audio.play('error');
        return false;
      }
      game.gold -= cost;
      h.lv++;
      G.Audio.play('upgrade');
      G.FX.ring(h.x, h.y, '#7ef9ff', 44, 0.4, 3);
      G.FX.text(h.x, h.y - 30, 'Lv' + h.lv, '#7ef9ff', 15);
      return true;
    },
    sellValue: function (h) { return D.HERO.SELL_VALUE * h.lv; },
    sell: function (h, game) {
      var i = Hero.list.indexOf(h);
      if (i >= 0) Hero.list.splice(i, 1);
      game.gold += Hero.sellValue(h);
      Hero.relayout(game);
      G.Audio.play('coin');
      G.FX.burst(h.x, h.y, 10, '#ffd700', 140, 0.5, 4);
      G.FX.text(h.x, h.y - 26, '+' + Hero.sellValue(h) + '金', '#ffd700', 14);
    },

    // ---- 更新（攻击/治疗） ----
    update: function (dt, game) {
      var b = game.base;
      for (var i = 0; i < Hero.list.length; i++) {
        var h = Hero.list[i];
        var c = D.HEROES[h.cls];
        h.fxT += dt;
        h.coolT -= dt;
        if (h.coolT > 0) continue;
        var st = Hero.statOf(h);
        var interval = st.interval / Hero.spdMult();

        if (c.heal) {
          // 牧师：治疗主角与基地（取受伤更重的目标表现）
          h.coolT = interval;
          var healed = false;
          var pl = G.Player;
          if (!pl.dead && pl.hp < pl.maxHp) {
            pl.heal(st.heal);
            healed = true;
            G.FX.ring(pl.x, pl.y, '#7bed9f', 26, 0.35, 2);
          }
          if (b.hp < b.maxHp && b.hp > 0) {
            game.healBase(st.heal);
            healed = true;
            G.FX.ring(b.x, b.y, '#7bed9f', 46, 0.4, 3);
          }
          if (healed) {
            G.Audio.play('heal');
            G.FX.ring(h.x, h.y, c.color, 30, 0.35, 2.5);
          } else {
            h.coolT = 0.4; // 满血时空转
          }
        } else {
          // 攻击英雄
          var target = game.findNearestEnemy(h.x, h.y, c.range);
          if (!target) { h.coolT = 0.08; continue; }
          h.coolT = interval;
          var ang = U.angle(h.x, h.y, target.x, target.y);
          var dmg = st.dmg * Hero.dmgMult();
          if (h.cls === 'sword') {
            // 近战环斩
            G.FX.ring(h.x, h.y, c.color, c.range, 0.22, 3);
            var near = game.grid.query(h.x, h.y, c.range + 30);
            var seen = {};
            for (var k = 0; k < near.length; k++) {
              var e = near[k];
              if (e.dead || seen[e.x + '_' + e.y]) continue;
              seen[e.x + '_' + e.y] = 1;
              if (U.dist2(h.x, h.y, e.x, e.y) <= (c.range + e.r) * (c.range + e.r)) {
                game.damageEnemy(e, dmg, h.x, h.y, false);
              }
            }
            G.Audio.play('hit');
          } else {
            G.Proj.spawn({
              x: h.x, y: h.y, ang: ang, speed: st.bulletSpeed || 400,
              dmg: dmg, size: h.cls === 'cannon' ? 8 : (h.cls === 'mage' ? 6 : 4),
              color: c.color, friendly: true,
              splash: st.splash, life: (c.range + 60) / (st.bulletSpeed || 400),
              kind: h.cls === 'cannon' ? 'cannonball' : (h.cls === 'mage' ? 'fireball' : 'bullet')
            });
            G.Audio.play(h.cls === 'archer' ? 'arrow' : 'shoot');
          }
        }
      }
    },

    hitTest: function (x, y) {
      var best = null, bestD = 1e9;
      for (var i = 0; i < Hero.list.length; i++) {
        var h = Hero.list[i];
        var d = U.dist2(x, y, h.x, h.y);
        if (d < D.HERO.DRAG_R * D.HERO.DRAG_R && d < bestD) {
          best = h; bestD = d;
        }
      }
      return best;
    },

    draw: function (ctx, ox, oy) {
      var t = Date.now() / 1000;
      for (var i = 0; i < Hero.list.length; i++) {
        var h = Hero.list[i];
        var c = D.HEROES[h.cls];
        var sx = h.x - ox, sy = h.y - oy;
        var bob = Math.sin(t * 3 + i * 1.7) * 1.5;

        // 攻击范围淡圈（选中拖拽时才显眼，平时很淡）
        // 影子
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 13, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 底座
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy + 8, 15, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // 职业图标（矢量绘制，不依赖 emoji 字体）
        Hero.drawIcon(ctx, h.cls, sx, sy + bob - 2);

        // 等级徽章
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(sx + 13, sy - 14 + bob, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(String(h.lv), sx + 13, sy - 10.5 + bob);
      }
    },

    // 职业矢量图标（中心 x,y，尺寸约 20px）
    drawIcon: function (ctx, cls, x, y, scale) {
      ctx.save();
      ctx.translate(x, y);
      if (scale) ctx.scale(scale, scale);
      ctx.lineCap = 'round';
      switch (cls) {
        case 'sword': // 剑：斜刃+护手
          ctx.strokeStyle = '#e8eef4';
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, -6); ctx.stroke();
          ctx.strokeStyle = '#c9a227';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-4.5, -1.5); ctx.lineTo(0.5, 3.5); ctx.stroke();
          ctx.strokeStyle = '#8d6e2f';
          ctx.beginPath(); ctx.moveTo(-7.5, 7.5); ctx.lineTo(-5, 5); ctx.stroke();
          break;
        case 'archer': // 弓：弓臂+弦+箭
          ctx.strokeStyle = '#d9b26a';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(-1, 0, 8, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(5, -7.2); ctx.lineTo(5, 7.2); ctx.stroke();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(8, 0); ctx.stroke();
          break;
        case 'mage': // 法球：发光宝珠
          var g = ctx.createRadialGradient(0, -1, 1, 0, -1, 7);
          g.addColorStop(0, '#e8d5ff');
          g.addColorStop(1, '#8e44ad');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, -1, 6.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(232,213,255,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, -1, 8.5, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'cannon': // 炮：炮管+火花
          ctx.fillStyle = '#3a3f4a';
          ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#20242c';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ffd166';
          ctx.beginPath(); ctx.arc(0, 1, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ff9f43';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(7, -8); ctx.stroke();
          break;
        case 'priest': // 十字
          ctx.fillStyle = '#fff8dc';
          ctx.fillRect(-1.8, -8, 3.6, 16);
          ctx.fillRect(-5.5, -3.5, 11, 3.6);
          break;
      }
      ctx.restore();
    },

    // 拖拽中的范围预览
    drawRange: function (ctx, ox, oy, h, color) {
      var c = D.HEROES[h.cls];
      if (!c.range || c.range > 900) return;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(h.x - ox, h.y - oy, c.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  };
  G.Hero = Hero;
})();

});
__def("js/systems/waves.js", function (module, exports, require) {
// 波次系统（关卡制）：每关20波，波内陡坡成长，通关检测
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Waves = {
    level: 1,           // 当前关卡
    wave: 0,            // 关内波号 1..20
    state: 'rest',      // rest | active
    timer: 2.5,
    spawnQueue: 0,
    spawnT: 0,

    reset: function (level) {
      Waves.level = level || 1;
      Waves.wave = 0;
      Waves.state = 'rest';
      Waves.timer = 2.5;
      Waves.spawnQueue = 0;
      Waves.spawnT = 0;
    },

    totalWaves: function () { return D.LEVELS.WAVES; },

    // 关间难度基数：1.15^(level-1)
    diffBase: function (level) { return Math.pow(D.LEVELS.DIFF, level - 1); },

    // 怪物血量总倍率 = 关间难度 × 波内陡坡
    hpMult: function (level, wave) {
      return Waves.diffBase(level) * Math.pow(D.LEVELS.HP_WAVE, wave - 1);
    },

    // 数量预算 = 基础(随关卡) × 关间^0.6 × 波内陡坡
    budget: function (level, wave) {
      var base = 14 + 6 * level + Math.pow(level, 1.3);
      return base * Math.pow(Waves.diffBase(level), D.LEVELS.DIFF_BUDGET_POW) * Math.pow(D.LEVELS.BUDGET_WAVE, wave - 1);
    },

    // 刷怪点：屏幕外环带
    spawnPoint: function (game) {
      var cam = G.Camera;
      var cx = cam.x + G.P.screenW / 2, cy = cam.y + G.P.screenH / 2;
      var rad = Math.max(G.P.screenW, G.P.screenH) * 0.62 + 60;
      var a = Math.random() * Math.PI * 2;
      var x = U.clamp(cx + Math.cos(a) * rad, 30, D.MAP_W - 30);
      var y = U.clamp(cy + Math.sin(a) * rad, 30, D.MAP_H - 30);
      return { x: x, y: y };
    },

    pickEnemyType: function (lv) {
      var pool = ['slime'];
      if (lv >= 2) pool.push('fast', 'fast');
      if (lv >= 3) pool.push('tank');
      if (lv >= 4) pool.push('shooter', 'shooter');
      return U.choice(pool);
    },

    isBossWave: function (w) { return D.LEVELS.BOSS_WAVES.indexOf(w) >= 0; },

    update: function (dt, game) {
      if (Waves.state === 'rest') {
        Waves.timer -= dt;
        if (Waves.timer <= 0) Waves.startNext(game);
      } else {
        if (Waves.spawnQueue > 0 && G.Enemy.list.length < D.WAVE.MAX_ALIVE) {
          Waves.spawnT -= dt;
          if (Waves.spawnT <= 0) {
            Waves.spawnT = U.rand(0.3, 0.7);
            Waves.spawnOne(game);
          }
        } else if (Waves.spawnQueue <= 0 && G.Enemy.list.length === 0) {
          if (Waves.wave >= D.LEVELS.WAVES) {
            // 本关全部波次清空 → 通关
            game.onLevelClear();
          } else {
            Waves.state = 'rest';
            Waves.timer = D.WAVE.START_INTERVAL;
            game.onWaveClear(Waves.wave);
          }
        }
      }
    },

    startNext: function (game) {
      Waves.wave++;
      Waves.state = 'active';
      Waves.spawnQueue = Waves.budget(Waves.level, Waves.wave);
      Waves.spawnT = 0.5;
      G.Audio.play('wave');
      var boss = Waves.isBossWave(Waves.wave);
      game.onWaveStart(Waves.level, Waves.wave, boss);
      if (boss) {
        var p = Waves.spawnPoint(game);
        G.Enemy.spawn(game, 'slime', p.x, p.y, { level: Waves.level, wave: Waves.wave, boss: true });
        G.Audio.play('boss');
        G.Camera.shake(6, 0.5);
      }
    },

    spawnOne: function (game) {
      var cost = { slime: 2, fast: 3, tank: 6, shooter: 5 };
      var type = Waves.pickEnemyType(Waves.level);
      var n = Math.max(1, Math.min(6, Math.floor(Waves.spawnQueue / cost[type] / 2)));
      for (var i = 0; i < n && Waves.spawnQueue > 0; i++) {
        var p = Waves.spawnPoint(game);
        var opts = { level: Waves.level, wave: Waves.wave };
        var eliteChance = Math.min(0.30, D.WAVE.ELITE_CHANCE + Waves.wave * 0.006 + Waves.level * 0.004);
        if (Waves.wave >= D.WAVE.ELITE_FROM && Math.random() < eliteChance) opts.elite = true;
        G.Enemy.spawn(game, type, p.x, p.y, opts);
        Waves.spawnQueue -= cost[type];
      }
    },

    label: function () {
      if (Waves.state === 'rest' && Waves.wave > 0 && Waves.wave < D.LEVELS.WAVES) {
        var next = Waves.wave + 1;
        return { txt: '第 ' + next + '/' + D.LEVELS.WAVES + ' 波 ' + Math.ceil(Waves.timer) + 's', boss: Waves.isBossWave(next) };
      }
      return null;
    }
  };
  G.Waves = Waves;
})();

});
__def("js/ui/ui.js", function (module, exports, require) {
// UI：立即模式按钮注册 + 全部界面绘制（HUD/三选一/英雄面板/菜单/结算/暂停）
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var UI = {
    buttons: [],   // 每帧重建 {id,x,y,w,h,onTap}
    frame: 0,

    begin: function () {
      UI.buttons.length = 0;
      UI.frame++;
    },
    reg: function (id, x, y, w, h, onTap) {
      UI.buttons.push({ id: id, x: x, y: y, w: w, h: h, onTap: onTap });
    },
    hitTest: function (x, y) {
      // 后注册的在上层，倒序命中
      for (var i = UI.buttons.length - 1; i >= 0; i--) {
        var b = UI.buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },

    // ---- 通用绘制 ----
    pill: function (ctx, x, y, w, h, bg, r) {
      ctx.fillStyle = bg || 'rgba(10,16,40,0.72)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r !== undefined ? r : h / 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
    },
    button: function (ctx, id, x, y, w, h, label, sub, color, onTap, disabled) {
      var a = disabled ? 0.45 : 1;
      ctx.globalAlpha = a;
      // 底
      var grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      UI.pill(ctx, x, y, w, h, 'rgba(12,20,48,0.9)', 12);
      ctx.fillStyle = grad;
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 10); ctx.fill();
      } else ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 11); ctx.stroke(); }
      // 文字
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      if (sub) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(label, x + w / 2, y + 20);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = sub.indexOf('金') >= 0 ? '#ffe082' : 'rgba(255,255,255,0.85)';
        ctx.fillText(sub, x + w / 2, y + 37);
      } else {
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(label, x + w / 2, y + h / 2 + 5);
      }
      ctx.globalAlpha = 1;
      if (!disabled) UI.reg(id, x, y, w, h, onTap);
    },

    // ================= 主界面 HUD =================
    drawHud: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var pl = G.Player;

      // 顶栏底
      UI.pill(ctx, 8, 8, W - 16, 58, 'rgba(8,12,32,0.62)', 14);

      // 玩家血条
      var hpw = Math.min(150, (W - 90) * 0.42);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(20, 18, hpw, 14, 7); ctx.fill(); }
      else ctx.fillRect(20, 18, hpw, 14);
      var hpr = Math.max(0, pl.hp / pl.maxHp);
      ctx.fillStyle = hpr > 0.5 ? '#2ecc71' : (hpr > 0.25 ? '#e67e22' : '#e74c3c');
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(21, 19, (hpw - 2) * hpr, 12, 6); ctx.fill(); }
      else ctx.fillRect(21, 19, (hpw - 2) * hpr, 12);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(pl.hp) + '/' + Math.round(pl.maxHp), 20 + hpw / 2, 28.5);

      // 击杀 / 时间
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textAlign = 'left';
      var wAtk = G.Player.stats && G.Player.stats.waveAtk ? Math.round(G.Player.stats.waveAtk * 100) : 0;
      ctx.fillText('☠ ' + game.kills + '   ⏱ ' + U.fmtTime(game.playTime) + '   ⚔ +' + wAtk + '%', 22, 48);
      ctx.fillText('👥 ' + G.Hero.list.length + '/' + D.HERO.MAX_COUNT, 110, 48);

      // 关卡与波次（中）
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('第 ' + game.currentLevel + ' 关 · ' + Math.max(1, G.Waves.wave) + '/' + D.LEVELS.WAVES + ' 波', W / 2, 30);
      var lbl = G.Waves.label();
      if (lbl) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = lbl.boss ? '#ff6b6b' : 'rgba(255,255,255,0.7)';
        ctx.fillText(lbl.boss ? '⚠ BOSS 波即将来袭' : lbl.txt, W / 2, 47);
      }

      // 右上资源栏：钻石 + 局内金币
      UI.pill(ctx, W - 192, 18, 62, 24, 'rgba(0,0,0,0.45)', 12);
      UI.drawDiamond(ctx, W - 180, 30, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.textAlign = 'center';
      ctx.fillText(String(G.Meta.diamonds), W - 150, 34);
      UI.pill(ctx, W - 126, 18, 62, 24, 'rgba(0,0,0,0.45)', 12);
      UI.drawCoin(ctx, W - 114, 30, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(String(game.gold), W - 84, 34);

      // 暂停按钮
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏸', W - 32, 38);
      UI.reg('pause', W - 54, 14, 44, 40, function () {
        G.Audio.play('button');
        game.setState('paused');
      });

      // Boss 血条
      var boss = null;
      for (var i = 0; i < G.Enemy.list.length; i++) if (G.Enemy.list[i].boss) { boss = G.Enemy.list[i]; break; }
      if (boss) {
        var bw = Math.min(320, W - 100);
        var bx = (W - bw) / 2, by = 74;
        UI.pill(ctx, bx - 6, by - 4, bw + 12, 22, 'rgba(40,0,0,0.7)', 10);
        ctx.fillStyle = '#3d0a0a';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill(); } else ctx.fillRect(bx, by, bw, 14);
        ctx.fillStyle = '#ff4757';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, (bw - 2) * Math.max(0, boss.hp / boss.maxHp), 12, 6); ctx.fill(); }
        else ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, boss.hp / boss.maxHp), 12);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('👑 星球掠夺者', W / 2, by + 11);
      }

      // 底部按钮排
      var bh = 50, gap = 8;
      var bw3 = Math.min(118, (W - 40 - gap * 2) / 3);
      var totalW = bw3 * 3 + gap * 2;
      var bx0 = (W - totalW) / 2;
      var by0 = H - bh - 14;
      var rc = G.Hero.recruitCost();
      UI.button(ctx, 'recruit', bx0, by0, bw3, bh, '招募英雄', '💰' + rc + (G.Hero.canRecruit() ? '' : ' 已满'), '#2d6cdf', function () {
        G.Hero.recruit(game);
      }, !G.Hero.canRecruit() || game.gold < rc);
      var buffCost = game.buffCost();
      UI.button(ctx, 'buff', bx0 + bw3 + gap, by0, bw3, bh, '全体强化', '💰' + buffCost + ' 伤+' + Math.round(game.buffLevel * 15 + 15) + '%', '#8e44ad', function () {
        game.buyBuff();
      }, game.gold < buffCost);
      var repairCost = D.ECONOMY.REPAIR_COST;
      var needRepair = game.base.hp < game.base.maxHp;
      UI.button(ctx, 'repair', bx0 + (bw3 + gap) * 2, by0, bw3, bh, '修复基地', needRepair ? '💰' + repairCost + ' +25%' : '完好', '#27ae60', function () {
        game.repairBase();
      }, !needRepair || game.gold < repairCost);

      // 附加技能栏
      var owned = Object.keys(G.Skills.owned);
      for (var si = 0; si < owned.length; si++) {
        var sid = owned[si];
        var sui = UI.SKILL_UI[sid];
        var slv = G.Skills.owned[sid];
        var px0 = 10 + si * 66, py0 = H - bh - 34;
        UI.pill(ctx, px0, py0, 62, 20, 'rgba(10,16,40,0.8)', 10);
        ctx.strokeStyle = sui.color;
        ctx.lineWidth = 1;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px0 + 0.5, py0 + 0.5, 61, 19, 10); ctx.stroke(); }
        ctx.fillStyle = sui.color;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sui.ch + ' ' + slv + (slv >= 5 ? '★' : ''), px0 + 31, py0 + 14);
      }

      // 摇杆
      var j = G.Input.joystick;
      if (j.active) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#8fd9ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(j.bx, j.by, 52, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#8fd9ff';
        ctx.beginPath(); ctx.arc(j.bx + j.dx * 40, j.by + j.dy * 40, 22, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },

    // 波次开场横幅 / 消息
    drawAnnounce: function (ctx, game) {
      if (!game.msg || game.msg.t <= 0) return;
      var W = G.P.screenW;
      var k = game.msg.t / game.msg.life;
      var a = k > 0.8 ? (1 - k) / 0.2 : Math.min(1, k / 0.15 + 0.2);
      ctx.globalAlpha = Math.min(1, a);
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 5;
      ctx.strokeText(game.msg.text, W / 2, G.P.screenH * 0.32);
      ctx.fillStyle = game.msg.color || '#ffd166';
      ctx.fillText(game.msg.text, W / 2, G.P.screenH * 0.32);
      ctx.globalAlpha = 1;
    },

    // ================= 升级三选一 =================
    drawLevelUp: function (ctx, game) {
      if (game.levelUpPhase === 'skill') { UI.drawSkillPick(ctx, game); return; }
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,8,24,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('⭐ 升级！', W / 2, H * 0.16);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('选择一项强化（Lv ' + game.level + '）', W / 2, H * 0.16 + 26);

      var opts = game.levelUpOptions || [];
      var cw = Math.min(340, W - 44), ch = 88;
      var cy = H * 0.24;
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i];
        var y = cy + i * (ch + 14);
        // 卡片
        var grad = ctx.createLinearGradient(0, y, 0, y + ch);
        grad.addColorStop(0, 'rgba(46,64,128,0.95)');
        grad.addColorStop(1, 'rgba(20,30,70,0.95)');
        ctx.fillStyle = grad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 14); ctx.fill(); }
        else ctx.fillRect((W - cw) / 2, y, cw, ch);
        ctx.strokeStyle = o.isFallback ? 'rgba(255,200,100,0.6)' : 'rgba(130,170,255,0.6)';
        ctx.lineWidth = 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 14); ctx.stroke(); }
        // 图标
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(o.icon, (W - cw) / 2 + 40, y + ch / 2 + 10);
        // 名称与描述
        ctx.textAlign = 'left';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(o.name, (W - cw) / 2 + 76, y + 34);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText(o.desc, (W - cw) / 2 + 76, y + 58);
        // 等级点
        if (!o.isFallback) {
          var lv = G.Player.stats[o.id] || 0;
          ctx.textAlign = 'right';
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#8fd9ff';
          ctx.fillText('Lv' + lv + '→' + (lv + 1), (W - cw) / 2 + cw - 14, y + 24);
        }
        (function (opt) {
          UI.reg('lu_' + opt.id, (W - cw) / 2, y, cw, ch, function () {
            game.applyLevelUp(opt);
          });
        })(o);
      }
    },

    // ================= 更新公告 =================
    drawChangelog: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      UI.button(ctx, 'cl_back', 12, 12, 88, 40, '‹ 返回', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('menu');
      });
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('更新公告', W / 2, 40);

      var y = 72;
      for (var i = 0; i < D.CHANGELOG.length; i++) {
        var c = D.CHANGELOG[i];
        if (y > H - 60) break;
        // 版本行
        ctx.textAlign = 'left';
        UI.pill(ctx, 14, y, 64, 20, 'rgba(0,0,0,0.4)', 10);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffd166';
        ctx.fillText(c.ver, 20, y + 14);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#8fd3ff';
        ctx.fillText(c.title, 90, y + 14);
        y += 26;
        for (var li = 0; li < c.lines.length; li++) {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.72)';
          ctx.fillText('· ' + c.lines[li], 24, y + 14);
          y += 18;
        }
        y += 10;
      }
      ctx.textAlign = 'center';
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('完整更新日志见 GitHub Releases 页', W / 2, H - 24);
    },

    // ================= 附加技能选择 =================
    SKILL_UI: {
      star: { color: '#8fd9ff', ch: '星' },
      echo: { color: '#a55eea', ch: '影' },
      shield: { color: '#7ef9ff', ch: '盾' },
      magnet: { color: '#ffd166', ch: '磁' },
      bomb: { color: '#ff9f43', ch: '爆' }
    },
    drawSkillPick: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(30,16,52,0.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#bb8fce';
      ctx.fillText('✦ 附加技能', W / 2, H * 0.15);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      var hint = G.Skills.count() >= D.ASKILL_MAX_COUNT ? '已持有 3 个技能，只能升级已有技能' : '与属性强化独立选择 · 最多持有 3 个';
      ctx.fillText(hint, W / 2, H * 0.15 + 26);

      var opts = game.skillPickOptions || [];
      var cw = Math.min(340, W - 44), ch = 80;
      var cy = H * 0.21;
      for (var i = 0; i < opts.length; i++) {
        var id = opts[i];
        var a = D.ASKILLS[id];
        var ui = UI.SKILL_UI[id];
        var cur = G.Skills.levelOf(id);
        var y = cy + i * (ch + 12);
        var grad = ctx.createLinearGradient(0, y, 0, y + ch);
        grad.addColorStop(0, 'rgba(64,48,110,0.95)');
        grad.addColorStop(1, 'rgba(30,22,58,0.95)');
        ctx.fillStyle = grad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 13); ctx.fill(); }
        else ctx.fillRect((W - cw) / 2, y, cw, ch);
        ctx.strokeStyle = ui.color;
        ctx.lineWidth = 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 13); ctx.stroke(); }
        // 图标
        ctx.fillStyle = ui.color;
        ctx.beginPath();
        ctx.arc((W - cw) / 2 + 36, y + ch / 2, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0a1e';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(ui.ch, (W - cw) / 2 + 36, y + ch / 2 + 6);
        // 名称与等级
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(a.name, (W - cw) / 2 + 68, y + 30);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ui.color;
        ctx.fillText(cur === 0 ? 'NEW · 学得 Lv1' : 'Lv' + cur + ' → Lv' + (cur + 1) + (cur + 1 === a.max ? ' 【质变】' : ''), (W - cw) / 2 + 68, y + 48);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText(a.desc(Math.min(cur + 1, a.max)), (W - cw) / 2 + 68, y + 66);
        (function (sid) {
          UI.reg('sk_' + sid, (W - cw) / 2, y, cw, ch, function () {
            game.chooseSkill(sid);
          });
        })(id);
      }
    },

    // ================= 英雄信息面板 =================
    drawHeroPanel: function (ctx, game) {
      var h = game.panelHero;
      if (!h) return;
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,8,24,0.6)';
      ctx.fillRect(0, 0, W, H);

      var pw = Math.min(320, W - 40), ph = 210;
      var px = (W - pw) / 2, py = H - ph - 90;
      ctx.fillStyle = 'rgba(14,22,52,0.97)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill(); }
      else ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(130,170,255,0.5)';
      ctx.lineWidth = 2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke(); }

      var c = D.HEROES[h.cls];
      var st = G.Hero.statOf(h);
      ctx.textAlign = 'left';
      G.Hero.drawIcon(ctx, h.cls, px + 34, py + 36, 1.5);
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(c.name + '  Lv' + h.lv + (h.lv >= D.HERO.MAX_LEVEL ? ' (MAX)' : ''), px + 60, py + 34);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(c.desc + (c.rare ? ' · 稀有' : ''), px + 60, py + 52);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (c.heal) {
        ctx.fillText('治疗：' + st.heal.toFixed(1) + ' / 次    间隔：' + st.interval.toFixed(2) + 's', px + 20, py + 84);
      } else {
        var dm = st.dmg * G.Hero.dmgMult();
        ctx.fillText('伤害：' + dm.toFixed(1) + ' / 发    间隔：' + (st.interval / G.Hero.spdMult()).toFixed(2) + 's', px + 20, py + 84);
        if (st.splash) ctx.fillText('溅射半径：' + st.splash, px + 20, py + 102);
      }
      // 同类合成提示
      var partner = null;
      for (var i = 0; i < G.Hero.list.length; i++) {
        var o = G.Hero.list[i];
        if (o !== h && G.Hero.canMerge(h, o)) { partner = o; break; }
      }
      ctx.font = '11px sans-serif';
      ctx.fillStyle = partner ? '#7bed9f' : 'rgba(255,255,255,0.5)';
      ctx.fillText(partner ? '💡 场上存在同名同级英雄，拖到它身上可合成 Lv' + (h.lv + 1) : '拖到同名同级英雄上可合成升级', px + 20, py + 122);

      var bw = (pw - 52) / 2;
      var upCost = G.Hero.upgradeCost(h);
      UI.button(ctx, 'hp_up', px + 18, py + 138, bw, 46, '升级', h.lv < D.HERO.MAX_LEVEL ? '💰' + upCost : '已满级', '#2d6cdf', function () {
        G.Hero.upgrade(h, game);
        if (h.lv >= D.HERO.MAX_LEVEL) game.panelHero = null;
      }, h.lv >= D.HERO.MAX_LEVEL || game.gold < upCost);
      UI.button(ctx, 'hp_sell', px + 34 + bw, py + 138, bw, 46, '出售', '+💰' + G.Hero.sellValue(h), '#c0392b', function () {
        G.Hero.sell(h, game);
        game.panelHero = null;
      });
      UI.reg('hp_close', px, py - 10, pw, 10, function () { game.panelHero = null; });
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('点此处关闭', W / 2, py - 16);
    },

    // ================= 主菜单 =================
    drawMenu: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var t = Date.now() / 1000;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // 装饰星星
      for (var i = 0; i < 40; i++) {
        var sx = U.seededRand(i * 3.1) * W, sy = U.seededRand(i * 5.7) * H;
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;

      // 左上角公告入口
      UI.button(ctx, 'changelog', 14, 14, 78, 34, '📢 公告', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('changelog');
      });

      // 右上角资源栏（钻石 / 升级金币）
      var rrx = W - 158, rry = 16;
      UI.pill(ctx, rrx, rry, 74, 26, 'rgba(0,0,0,0.45)', 13);
      UI.drawDiamond(ctx, rrx + 14, rry + 13, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.textAlign = 'center';
      ctx.fillText(String(G.Meta.diamonds), rrx + 42, rry + 18);
      UI.pill(ctx, rrx + 78, rry, 74, 26, 'rgba(0,0,0,0.45)', 13);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(rrx + 92, rry + 13, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(String(G.Meta.gold), rrx + 120, rry + 18);

      // ---- 标题区（logo 锁版）：标题 → 副标题 → 水晶徽记，自成一块，
      //      下方关卡卡片按这一块的高度定位，不再压住徽记 ----
      var ty = Math.max(92, H * 0.163);
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#8fd3ff';
      ctx.fillText('蓝星守卫', W / 2, ty);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('割草 × 塔防 × 英雄合成', W / 2, ty + 28);
      // 水晶徽记（矢量绘制，避免 emoji 缺字）
      UI.drawCrest(ctx, W / 2, ty + 51 + Math.sin(t * 1.6) * 1.5, W < 420 ? 9 : 11, t);

      // ---- 关卡选择 ----
      var lv = G.Meta.selectedLevel;
      var lvName = D.LEVELS.nameOf(lv);
      var y0 = ty + 75;
      UI.button(ctx, 'lv_prev', W / 2 - 178, y0, 52, 56, '◀', null, 'rgba(90,100,140,1)', function () {
        if (G.Meta.selectedLevel > 1) { G.Meta.selectedLevel--; G.Meta.save(); G.Audio.play('button'); }
        else G.Audio.play('error');
      }, G.Meta.selectedLevel <= 1);
      UI.pill(ctx, W / 2 - 118, y0, 236, 56, 'rgba(12,20,48,0.9)', 14);
      ctx.strokeStyle = 'rgba(130,170,255,0.5)';
      ctx.lineWidth = 2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W / 2 - 116.5, y0 + 1.5, 233, 53, 13); ctx.stroke(); }
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#8fd3ff';
      ctx.fillText('第 ' + lv + ' 关', W / 2, y0 + 24);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('· ' + lvName + ' ·', W / 2, y0 + 44);
      UI.button(ctx, 'lv_next', W / 2 + 126, y0, 52, 56, '▶', null, 'rgba(90,100,140,1)', function () {
        if (G.Meta.selectedLevel < D.LEVELS.TOTAL) { G.Meta.selectedLevel++; G.Meta.save(); G.Audio.play('button'); }
        else G.Audio.play('error');
      }, G.Meta.selectedLevel >= D.LEVELS.TOTAL);
      // 锁定提示 + 解锁进度
      var locked = lv > G.Meta.maxLevel;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = locked ? '#ff8b8b' : 'rgba(255,255,255,0.5)';
      ctx.fillText(locked ? ('🔒 未解锁 · 请先通关第 ' + G.Meta.maxLevel + ' 关') : ('已解锁 ' + G.Meta.maxLevel + '/' + D.LEVELS.TOTAL + ' 关'), W / 2, y0 + 70);

      // 通关宝箱（主界面领取）
      var bx0 = W / 2 - 110, by0 = y0 + 80;
      var boxCols = ['#cd9a3c', '#8fa8d9', '#b56ce0'];
      var boxReqs = ['任意通关', '≥70%血量', '满血通关'];
      var ch = G.Meta.chests;
      var hasChests = ch && ch.level > 0;
      for (var bi = 0; bi < 3; bi++) {
        var bcx = bx0 + bi * 76 + 30;
        var got = hasChests && ch.boxes[bi];
        var claimed = hasChests && ch.claimed[bi];
        var st = !hasChests ? 'locked' : (claimed ? 'opened' : (got ? null : 'locked'));
        var bob = got && !claimed ? Math.sin(Date.now() / 300 + bi * 2) * 1.5 : 0;
        UI.drawChest(ctx, bcx - 17, by0 + bob, 34, 28, boxCols[bi], st);
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px sans-serif';
        if (!hasChests) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillText('通关后开启', bcx, by0 + 40);
        } else if (claimed) {
          ctx.fillStyle = '#7bed9f';
          ctx.fillText('✓ 已领取', bcx, by0 + 40);
        } else if (got) {
          ctx.fillStyle = '#7ef9ff';
          ctx.fillText('+' + D.LEVELS.BOX_REWARDS[bi] + '钻', bcx, by0 + 40);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillText('需' + boxReqs[bi], bcx, by0 + 40);
        }
        ctx.font = '9px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(!hasChests ? '' : (claimed ? '已开启' : (got ? '点击领取' : boxReqs[bi])), bcx, by0 + 52);
        // 可领取的箱子可点击
        if (got && !claimed) {
          UI.reg('chest_' + bi, bcx - 30, by0 - 6, 60, 62, (function (idx) {
            return function () { game.claimChest(idx); };
          })(bi));
        }
      }
      if (hasChests) {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText('第 ' + ch.level + ' 关宝箱', W / 2, by0 + 66);
      }

      // 开始挑战（未解锁前一关则不可点击）
      // 按钮位置跟随上方内容下沿，避免矮屏上宝箱与按钮重叠
      var startY = Math.max(H * 0.425, by0 + 90);
      // 矮屏压缩下半段行距，保证说明文字不会顶到底部版本号
      var gs = Math.min(1, (H - 46 - startY) / 271);
      if (gs < 0.7) gs = 0.7;
      UI.button(ctx, 'start', W / 2 - 100, startY, 200, 56, locked ? '🔒 未解锁' : '▶ 开始挑战', locked ? '先通关第 ' + G.Meta.maxLevel + ' 关' : ('第 ' + lv + ' 关 · ' + lvName), '#2d6cdf', function () {
        game.startRun(G.Meta.selectedLevel);
      }, locked);
      // 英雄按钮（局外成长）
      UI.button(ctx, 'heroes', W / 2 - 100, startY + 66 * gs, 200, 50, '🦸 英雄', '选择与升级主角', '#8e44ad', function () {
        G.Audio.play('button');
        game.setState('heroes');
      });
      // 当前主角 + 升级金币 + 纪录（合并两行，避免与说明重叠）
      var sel = G.Meta.protoStats(G.Meta.selected);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('当前主角：' + sel.name + ' Lv' + sel.level + '　·　升级金币 ' + G.Meta.gold, W / 2, startY + 148 * gs);
      var best = game.best;
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,215,0,0.85)';
      ctx.fillText('👑 最佳纪录：第 ' + (best.lv || 1) + ' 关 · 第 ' + (best.wv || 0) + ' 波', W / 2, startY + 192 * gs);

      // 玩法说明
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      var lines = [
        '拖动屏幕移动，自动攻击',
        '金币招募英雄守卫水晶 · 同名同级英雄拖拽合成',
        '升级三选一随机技能 · 第10/20波BOSS守关',
        '捡到的金币可在「英雄」页升级主角属性'
      ];
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], W / 2, startY + (220 + li * 17) * gs);
      }
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(D.VERSION + ' · 浏览器预览版（微信小游戏同源代码）', W / 2, H - 18);
    },

    // ================= 英雄选择与升级（局外成长） =================
    drawHeroes: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 顶栏
      UI.button(ctx, 'back', 12, 12, 88, 40, '‹ 返回', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('menu');
      });
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('英雄', W / 2, 42);
      UI.pill(ctx, W - 128, 16, 116, 30, 'rgba(0,0,0,0.45)', 15);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('升级金币 ' + G.Meta.gold, W - 70, 35);

      var B = D.META.BONUS;
      var ch = 126, gap = 8;
      var y0 = 64;
      for (var i = 0; i < D.META.PROTO_ORDER.length; i++) {
        var cls = D.META.PROTO_ORDER[i];
        var p = D.PROTOS[cls];
        var unlocked = !!G.Meta.unlocked[cls];
        var lv = G.Meta.levelOf(cls);
        var st = G.Meta.protoStats(cls);
        var selected = G.Meta.selected === cls;
        var y = y0 + i * (ch + gap);
        var cw = W - 24, x = 12;

        // 卡片底
        var cardGrad = ctx.createLinearGradient(0, y, 0, y + ch);
        if (selected) {
          cardGrad.addColorStop(0, 'rgba(64,84,158,0.97)');
          cardGrad.addColorStop(1, 'rgba(28,40,86,0.97)');
        } else {
          cardGrad.addColorStop(0, 'rgba(40,52,96,0.95)');
          cardGrad.addColorStop(1, 'rgba(18,26,58,0.95)');
        }
        ctx.fillStyle = cardGrad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 14); ctx.fill(); }
        else ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = selected ? 'rgba(255,209,102,0.9)' : 'rgba(130,170,255,0.4)';
        ctx.lineWidth = selected ? 2.5 : 1.5;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 14); ctx.stroke(); }
        if (!unlocked) {
          ctx.fillStyle = 'rgba(4,8,24,0.55)';
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 14); ctx.fill(); }
          else ctx.fillRect(x, y, cw, ch);
        }

        // 图标 + 名称
        ctx.globalAlpha = unlocked ? 1 : 0.35;
        G.Hero.drawIcon(ctx, cls, x + 34, y + 38, 1.5);
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, x + 62, y + 30);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(p.desc, x + 62, y + 48);
        // 属性（基础+升级合成）
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        var aps = (1 / st.interval).toFixed(1);
        ctx.fillText('生命 ' + st.maxHp + '   攻击 ' + st.dmg.toFixed(1) + '   攻速 ' + aps + '/s', x + 62, y + 70);
        if (unlocked) {
          var k = lv - 1;
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#7bed9f';
          ctx.fillText(k > 0 ? ('Lv' + lv + ' · 生命+' + Math.round(B.hp * k * 100) + '% 攻击+' + Math.round(B.dmg * k * 100) + '% 攻速+' + Math.round(B.aspeed * k * 100) + '%') : 'Lv1 · 基础形态', x + 62, y + 90);
        } else {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#ffd166';
          ctx.fillText('🔒 未解锁', x + 62, y + 90);
        }
        ctx.globalAlpha = 1;

        // 按钮
        var bw = 96, bh = 40;
        var by = y + ch - bh - 10;
        if (!unlocked) {
          var uc = G.Meta.unlockCost(cls);
          UI.button(ctx, 'unl_' + cls, x + cw - bw - 14, y + (ch - bh) / 2, bw, bh, '解锁', '💰' + uc, '#8e44ad', (function (c) {
            return function () {
              if (G.Meta.unlock(c)) game.toast('已解锁 ' + D.PROTOS[c].name + '！');
              else game.toast('升级金币不足');
            };
          })(cls), G.Meta.gold < uc);
        } else {
          // 选择
          if (selected) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#ffd166';
            ctx.fillText('✓ 使用中', x + cw - bw - 14 + bw / 2, by + bh / 2 + 4);
          } else {
            UI.button(ctx, 'sel_' + cls, x + cw - bw - 14, by, bw, bh, '选择', null, '#2d6cdf', (function (c) {
              return function () { G.Meta.select(c); };
            })(cls));
          }
          // 升级
          var maxed = lv >= D.META.MAX_LV;
          var upCost = G.Meta.upgradeCost(cls);
          UI.button(ctx, 'mup_' + cls, x + cw - bw * 2 - 24, by, bw, bh, '升级',
            maxed ? '已满级' : '💰' + upCost, '#27ae60',
            (function (c) {
              return function () {
                if (G.Meta.upgrade(c)) game.toast(D.PROTOS[c].name + ' 升到 Lv' + G.Meta.levelOf(c) + '！');
                else game.toast('升级金币不足');
              };
            })(cls), maxed || G.Meta.gold < upCost);
        }
      }
    },

    // 宝箱矢量绘制（左上角x,y，宽w高h）；state: null | 'opened' | 'locked'
    drawChest: function (ctx, x, y, w, h, color, state) {
      var opened = state === 'opened';
      var lidY = opened ? y - h * 0.22 : y;   // 已打开：盖子向上掀起
      // 箱体
      ctx.fillStyle = opened ? 'rgba(60,44,20,0.95)' : color;
      ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y + h * 0.35, w, h * 0.12);
      // 描边
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y + h * 0.35, w, h * 0.65);
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.35); ctx.lineTo(x + w, y + h * 0.35);
      ctx.stroke();
      // 已打开：内部光芒
      if (opened) {
        var g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 1, x + w / 2, y + h * 0.4, w * 0.6);
        g.addColorStop(0, 'rgba(255,240,160,0.85)');
        g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h * 0.4, w * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // 飞出的钻石
        UI.drawDiamond(ctx, x + w / 2, y + h * 0.42, w * 0.18, '#7ef9ff');
      }
      // 箱盖
      ctx.fillStyle = opened ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, lidY, w, h * 0.3);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeRect(x, lidY, w, h * 0.3);
      // 锁扣
      if (!opened) {
        ctx.fillStyle = state === 'locked' ? 'rgba(200,205,220,0.6)' : '#ffe082';
        ctx.fillRect(x + w / 2 - 3, y + h * 0.3, 6, 8);
      }
      if (state === 'locked') {
        ctx.fillStyle = 'rgba(10,14,30,0.5)';
        ctx.fillRect(x, y, w, h);
      }
    },

    // 主菜单 logo 徽记：光晕 + 水晶 + 两侧渐隐纹线（主菜单标题区专用）
    drawCrest: function (ctx, cx, cy, r, t) {
      // 光晕
      var halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 3.4);
      halo.addColorStop(0, 'rgba(126,249,255,0.28)');
      halo.addColorStop(0.5, 'rgba(90,160,255,0.10)');
      halo.addColorStop(1, 'rgba(90,160,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3.4, 0, Math.PI * 2);
      ctx.fill();
      // 两侧渐隐纹线
      var lw = r * 6;
      for (var s = -1; s <= 1; s += 2) {
        var lx = cx + s * (r * 1.7);
        var lg = ctx.createLinearGradient(lx, 0, lx + s * lw, 0);
        lg.addColorStop(0, 'rgba(143,211,255,0.55)');
        lg.addColorStop(1, 'rgba(143,211,255,0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, cy);
        ctx.lineTo(lx + s * lw, cy);
        ctx.stroke();
      }
      // 水晶本体（呼吸光晕）
      ctx.save();
      ctx.shadowColor = 'rgba(126,249,255,0.85)';
      ctx.shadowBlur = 10 + 4 * Math.sin(t * 2);
      UI.drawDiamond(ctx, cx, cy, r, '#a9e8ff');
      ctx.restore();
      // 侧翼小晶体
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2 + 1);
      UI.drawDiamond(ctx, cx - r * 2.6, cy, r * 0.36, '#7ecbff');
      UI.drawDiamond(ctx, cx + r * 2.6, cy, r * 0.36, '#7ecbff');
      ctx.globalAlpha = 1;
    },

    // 资源图标（矢量）
    drawDiamond: function (ctx, x, y, r, color) {
      ctx.fillStyle = color || '#7ef9ff';
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.72, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.72, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.72, y);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    },
    drawCoin: function (ctx, x, y, r) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#fff59d';
      ctx.fillRect(x - 1, y - r * 0.5, 2, r);
    },

    // ================= 通关结算 =================
    drawVictory: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var v = game.victory;
      if (!v) return;
      ctx.fillStyle = 'rgba(6,10,28,0.88)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🏆 第 ' + game.currentLevel + ' 关 通关！', W / 2, H * 0.11);

      // 基地血量条
      var bw = Math.min(280, W - 80), bx = (W - bw) / 2, by = H * 0.16;
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('基地剩余血量 ' + Math.ceil(v.pct * 100) + '%', W / 2, by - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill(); }
      else ctx.fillRect(bx, by, bw, 14);
      var hpCol = v.pct >= 0.999 ? '#ffd700' : (v.pct >= 0.7 ? '#2ecc71' : (v.pct >= 0.3 ? '#e67e22' : '#e74c3c'));
      ctx.fillStyle = hpCol;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, (bw - 2) * Math.max(0, v.pct), 12, 6); ctx.fill(); }
      else ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, v.pct), 12);

      // 通关宝箱提示（回到主界面领取）
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('通关宝箱已放回主界面', W / 2, by + 56);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('可领取 ' + v.boxes.filter(function (b) { return b; }).length + ' 个宝箱 · 满血最高 ' + (D.LEVELS.BOX_REWARDS[0] + D.LEVELS.BOX_REWARDS[1] + D.LEVELS.BOX_REWARDS[2]) + ' 钻石', W / 2, by + 78);

      // 钻石余额
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.fillText('💎 钻石 ' + G.Meta.diamonds, W / 2, by + 116);

      // 按钮
      var by0 = by + 150;
      var hasNext = game.currentLevel < D.LEVELS.TOTAL;
      UI.button(ctx, 'v_next', W / 2 - 110, by0, 220, 52, hasNext ? '▶ 下一关（第 ' + (game.currentLevel + 1) + ' 关）' : '已是最终关', null, '#2d6cdf', function () {
        game.nextLevel();
      }, !hasNext);
      UI.button(ctx, 'v_home', W / 2 - 110, by0 + 64, 220, 46, '🏠 回到主页领宝箱', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
      UI.button(ctx, 'v_retry', W / 2 - 110, by0 + 122, 220, 46, '↻ 重打本关', null, 'rgba(90,100,140,1)', function () {
        game.startRun(game.currentLevel);
      });
    },

    // ================= 结算 =================
    drawGameOver: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,6,18,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText(game.baseDead ? '🏰 基地陷落' : '💀 你倒下了', W / 2, H * 0.2);

      var pw = Math.min(320, W - 60), px = (W - pw) / 2, py = H * 0.26;
      ctx.fillStyle = 'rgba(14,22,52,0.95)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, 225, 16); ctx.fill(); }
      else ctx.fillRect(px, py, pw, 225);

      var rows = [
        ['关卡进度', '第 ' + game.currentLevel + ' 关 · ' + G.Waves.wave + '/' + D.LEVELS.WAVES + ' 波'],
        ['击杀敌人', String(game.kills)],
        ['存活时间', U.fmtTime(game.playTime)],
        ['英雄等级', String(game.level)],
        ['升级金币', '+' + (game.metaEarned || 0)]
      ];
      for (var i = 0; i < rows.length; i++) {
        var ry = py + 34 + i * 34;
        ctx.textAlign = 'left';
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(rows[i][0], px + 30, ry);
        ctx.textAlign = 'right';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = rows[i][0] === '升级金币' ? '#7bed9f' : '#ffd166';
        ctx.fillText(rows[i][1], px + pw - 30, ry);
      }
      var isBest = G.Waves.wave >= game.best.wave && game.kills >= game.best.kills && game.kills > 0;
      if (isBest) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('🎉 新纪录！', W / 2, py + 205);
      }

      UI.button(ctx, 'retry', W / 2 - 110, py + 250, 220, 52, '↻ 再来一局', null, '#2d6cdf', function () {
        game.startRun();
      });
      UI.button(ctx, 'toheroes', W / 2 - 110, py + 314, 220, 46, '🦸 升级英雄', '+' + (game.metaEarned || 0) + ' 升级金币', '#8e44ad', function () {
        game.setState('heroes');
      });
      UI.button(ctx, 'home', W / 2 - 110, py + 372, 220, 46, '🏠 回到主页', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
    },

    // ================= 暂停 =================
    drawPaused: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,8,24,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('⏸ 已暂停', W / 2, H * 0.24);

      UI.button(ctx, 'resume', W / 2 - 100, H * 0.34, 200, 52, '▶ 继续游戏', null, '#2d6cdf', function () {
        game.setState('playing');
      });
      UI.button(ctx, 'sound', W / 2 - 100, H * 0.34 + 64, 200, 46, G.Audio.enabled ? '🔊 音效：开' : '🔇 音效：关', null, 'rgba(90,100,140,1)', function () {
        G.Audio.enabled = !G.Audio.enabled;
        if (G.Audio.enabled) G.Audio.resume();
        G.P.storage.set('lx_sound', G.Audio.enabled ? 1 : 0);
      });
      UI.button(ctx, 'restart', W / 2 - 100, H * 0.34 + 122, 200, 46, '↻ 重新开始', null, '#8e44ad', function () {
        game.startRun();
      });
      UI.button(ctx, 'quit', W / 2 - 100, H * 0.34 + 180, 200, 46, '🏠 回到主页', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
    },

    // ================= 总绘制入口 =================
    draw: function (ctx, game) {
      UI.begin();
      switch (game.state) {
        case 'menu': UI.drawMenu(ctx, game); break;
        case 'heroes': UI.drawHeroes(ctx, game); break;
        case 'changelog': UI.drawChangelog(ctx, game); break;
        case 'playing':
          UI.drawHud(ctx, game);
          if (game.panelHero) UI.drawHeroPanel(ctx, game);
          UI.drawAnnounce(ctx, game);
          break;
        case 'levelup':
          UI.drawHud(ctx, game);
          UI.drawLevelUp(ctx, game);
          break;
        case 'paused': UI.drawHud(ctx, game); UI.drawPaused(ctx, game); break;
        case 'gameover': UI.drawGameOver(ctx, game); break;
        case 'victory': UI.drawVictory(ctx, game); break;
      }
    }
  };
  G.UI = UI;
})();

});
__def("js/main.js", function (module, exports, require) {
// 主控制器：状态机 / 主循环 / 触摸路由 / 经济与升级
var G = require('./boot.js');
(function () {
  var U = G.U, D = G.D;

  var Game = {
    state: 'menu',       // menu | playing | levelup | paused | gameover
    gold: 0, level: 1, xp: 0, xpNext: 5,
    kills: 0, playTime: 0,
    buffLevel: 0,
    base: null,
    panelHero: null,
    levelUpOptions: [],
    msg: null,
    drag: null,          // {hero, id, moved, sx, sy}
    joyId: null,
    best: { wave: 0, kills: 0 },
    baseDead: false,
    viewOx: 0, viewOy: 0,
    pendingLevels: 0,
    levelUpPhase: 'stat',
    skillPickOptions: [],
    currentLevel: 1,
    victory: null,

    init: function () {
      G.Input.init();
      G.Meta.load();
      Game.best = G.P.storage.get('lx_best', { lv: 1, wv: 0 });
      if (Game.best.wave !== undefined) { Game.best = { lv: 1, wv: 0 }; }
      var snd = G.P.storage.get('lx_sound', 1);
      G.Audio.enabled = !!snd;
      Game.setState('menu');
      Game.lastT = Date.now();
      var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
      var loop = function () {
        Game.tick();
        if (raf) raf(loop);
        else setTimeout(loop, 1000 / 60);
      };
      if (raf) raf(loop); else setTimeout(loop, 1000 / 60);
    },

    setState: function (s) {
      Game.state = s;
      if (s !== 'playing') {
        Game.panelHero = null;
        if (s !== 'levelup') { G.Input.joyReset(); Game.joyId = null; }
      }
    },

    // ============ 开局 ============
    startRun: function (level) {
      var D2 = D;
      level = level || G.Meta.selectedLevel || 1;
      // 关卡锁：必须先通关上一关
      if (level > G.Meta.maxLevel) {
        Game.showMsg('请先通关第 ' + G.Meta.maxLevel + ' 关', '#ff6b6b', 1.6);
        G.Audio.play('error');
        return;
      }
      Game.currentLevel = level;
      G.Meta.selectedLevel = level;
      G.Meta.save();
      Game.gold = D2.ECONOMY.START_GOLD;
      Game.level = 1; Game.xp = 0; Game.xpNext = 5;
      Game.kills = 0; Game.playTime = 0;
      Game.buffLevel = 0;
      Game.panelHero = null;
      Game.baseDead = false;
      Game.msg = null;
      Game.metaEarned = 0;
      Game.pendingLevels = 0;
      Game.victory = null;
      G.Skills.reset();
      G.FX.clear(); G.Proj.clear(); G.Pickup.clear(); G.Enemy.reset(); G.Hero.reset();
      G.Waves.reset(level);
      G.Player.reset();
      G.Player.stats = { atk: 0, aspeed: 0, multi: 0, pierce: 0, crit: 0, bigshot: 0, regen: 0, leech: 0, speed: 0, magnet: 0, gold: 0, allydmg: 0, allyspd: 0, waveAtk: 0 };
      Game.base = {
        x: D2.MAP_W / 2, y: D2.MAP_H / 2,
        hp: D2.BASE.HP, maxHp: D2.BASE.HP, r: D2.BASE.RADIUS
      };
      G.Camera.init(D2.MAP_W, D2.MAP_H);
      G.Camera.snapTo(G.Player.x, G.Player.y);
      // 开局送一个剑士
      G.Hero.add('sword', 1, Game);
      Game.setState('playing');
      Game.showMsg('守住水晶！', '#8fd3ff', 2);
      G.Audio.resume();
    },

    showMsg: function (text, color, life) {
      Game.msg = { text: text, color: color || '#ffd166', t: life || 2, life: life || 2 };
    },

    toast: function (text) {
      Game.showMsg(text, '#7bed9f', 1.4);
      G.Audio.play('button');
    },

    // ============ 经济 ============
    addGold: function (n) {
      Game.gold += n;
      // 局内金币同步累积为局外「升级金币」（1:1）
      Game.metaEarned = (Game.metaEarned || 0) + n;
      G.Meta.earn(n);
    },
    buffCost: function () { return Math.round(D.ECONOMY.BUFF_COST * Math.pow(D.ECONOMY.BUFF_GROWTH, Game.buffLevel)); },
    buyBuff: function () {
      var cost = Game.buffCost();
      if (Game.gold < cost) { G.Audio.play('error'); return; }
      Game.gold -= cost;
      Game.buffLevel++;
      G.Audio.play('upgrade');
      Game.showMsg('全体英雄伤害 +' + Math.round(Game.buffLevel * 15) + '%', '#bb8fce', 1.6);
      var b = Game.base;
      for (var i = 0; i < G.Hero.list.length; i++) {
        G.FX.ring(G.Hero.list[i].x, G.Hero.list[i].y, '#bb8fce', 30, 0.4, 2);
      }
    },
    repairBase: function () {
      if (Game.base.hp >= Game.base.maxHp || Game.gold < D.ECONOMY.REPAIR_COST) { G.Audio.play('error'); return; }
      Game.gold -= D.ECONOMY.REPAIR_COST;
      var v = Game.base.maxHp * D.ECONOMY.REPAIR_PCT;
      Game.base.hp = Math.min(Game.base.maxHp, Game.base.hp + v);
      G.Audio.play('heal');
      G.FX.ring(Game.base.x, Game.base.y, '#7bed9f', 70, 0.5, 4);
      G.FX.text(Game.base.x, Game.base.y - 60, '+' + Math.round(v), '#7bed9f', 16);
    },
    damageBase: function (dmg) {
      var b = Game.base;
      if (!b || b.hp <= 0) return;
      b.hp -= dmg;
      G.Audio.play('crystal');
      G.Camera.shake(3, 0.15);
      if (b.hp <= 0) {
        b.hp = 0;
        Game.baseDead = true;
        Game.gameOver();
      }
    },
    healBase: function (v) {
      var b = Game.base;
      if (!b || b.hp <= 0) return;
      b.hp = Math.min(b.maxHp, b.hp + v);
    },

    // ============ 经验与升级 ============
    addXp: function (n) {
      Game.xp += n;
      while (Game.xp >= Game.xpNext) {
        Game.xp -= Game.xpNext;
        Game.level++;
        Game.xpNext = Math.round(5 * Math.pow(1.28, Game.level - 1));
        Game.pendingLevels++;
      }
      if (Game.pendingLevels > 0 && Game.state === 'playing') {
        Game.openLevelUp();
      }
    },

    // 两阶段升级：先选属性强化，再选附加技能
    openLevelUp: function () {
      // 从未满级技能中随机3个
      var pool = [];
      var st = G.Player.stats;
      for (var i = 0; i < D.SKILLS.length; i++) {
        var s = D.SKILLS[i];
        if ((st[s.id] || 0) < s.max) pool.push(s);
      }
      var opts = [];
      var used = {};
      while (opts.length < 3 && pool.length > 0) {
        var idx = Math.floor(Math.random() * pool.length);
        var pick = pool.splice(idx, 1)[0];
        if (used[pick.id]) continue;
        used[pick.id] = 1;
        opts.push({
          id: pick.id, name: pick.name, icon: pick.icon,
          desc: pick.desc((st[pick.id] || 0) + 1), isFallback: false
        });
      }
      // 保底选项
      while (opts.length < 3) {
        var fb = D.SKILL_FALLBACKS[opts.length % D.SKILL_FALLBACKS.length];
        opts.push({ id: fb.id, name: fb.name, icon: fb.icon, desc: fb.desc(), isFallback: true });
      }
      Game.levelUpOptions = opts;
      Game.levelUpPhase = 'stat';
      Game.setState('levelup');
      G.Audio.play('levelup');
    },

    applyLevelUp: function (opt) {
      var st = G.Player.stats;
      switch (opt.id) {
        case 'healfull': G.Player.heal(G.Player.maxHp * 0.5); break;
        case 'bounty': Game.addGold(120); break;
        case 'hp':
          st.hp = (st.hp || 0) + 1;
          G.Player.maxHp += 30;
          G.Player.hp = Math.min(G.Player.maxHp, G.Player.hp + 30);
          break;
        default: st[opt.id] = (st[opt.id] || 0) + 1;
      }
      G.Audio.play('upgrade');
      G.FX.ring(G.Player.x, G.Player.y, '#ffd700', 50, 0.45, 3);
      // 进入附加技能选择阶段
      Game.skillPickOptions = G.Skills.options();
      if (Game.skillPickOptions.length === 0) {
        Game.finishLevelUp();
        return;
      }
      Game.levelUpPhase = 'skill';
    },

    chooseSkill: function (id) {
      G.Skills.choose(id);
      Game.finishLevelUp();
    },

    finishLevelUp: function () {
      Game.pendingLevels--;
      if (Game.pendingLevels > 0) {
        Game.openLevelUp(); // 还有待处理的升级
      } else {
        Game.setState('playing');
      }
    },

    // ============ 战斗辅助 ============
    findNearestEnemy: function (x, y, range) {
      var list = G.Enemy.list;
      var best = null, bestD = range * range;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.dead) continue;
        var d = U.dist2(x, y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    },

    damageEnemy: function (e, dmg, hx, hy, big) {
      // 暴击
      var crit = Math.random() < (G.Player.stats.crit * 0.08);
      if (crit) dmg *= 2;
      G.Enemy.damage(Game, e, dmg, hx, hy, big || crit);
      // 吸血
      var leech = G.Player.stats.leech * 0.02;
      if (leech > 0) G.Player.heal(dmg * leech * 0.5);
      if (crit) G.FX.ring(e.x, e.y, '#ffd700', 22, 0.25, 2);
    },

    onKill: function (e) {
      Game.kills++;
      G.Skills.onKill(e, Game);
      if (e.boss) {
        Game.showMsg('BOSS 击败！', '#ffd700', 2);
        G.Camera.shake(8, 0.4);
      }
    },

    onWaveStart: function (level, w, boss) {
      Game.showMsg(boss ? '⚠ 第 ' + w + '/' + D.LEVELS.WAVES + ' 波 · BOSS 来袭' : '第 ' + w + '/' + D.LEVELS.WAVES + ' 波来袭', boss ? '#ff6b6b' : '#ffd166', 2);
      if (boss) G.Camera.shake(5, 0.4);
    },

    onWaveClear: function (w) {
      // 波次清算：主角攻击成长（普通波 +4%，Boss 波 +12%）
      var gain = D.WAVE.ATK_PER_WAVE + (w % D.WAVE.BOSS_EVERY === 0 ? D.WAVE.ATK_BOSS_BONUS : 0);
      G.Player.stats.waveAtk += gain;
      var pct = Math.round(G.Player.stats.waveAtk * 100);
      Game.showMsg('第 ' + w + ' 波 已肃清 ✓  主角攻击 +' + Math.round(gain * 100) + '%', '#7bed9f', 1.6);
      G.FX.text(G.Player.x, G.Player.y - 30, '攻击 +' + Math.round(gain * 100) + '%', '#ff9f43', 15);
      G.FX.ring(G.Player.x, G.Player.y, '#ff9f43', 40, 0.4, 3);
      // 波奖励
      Game.addGold(5 + w);
      G.FX.text(Game.base.x, Game.base.y - 70, '波次奖励 +' + (5 + w) + '💰', '#ffd700', 15);
      G.Meta.save(); // 波次结束存档升级金币
    },

    // 通关：第20波清空（宝箱放回主界面领取）
    onLevelClear: function () {
      var pct = Game.base.hp / Game.base.maxHp;
      var boxes = [true, pct >= 0.7, pct >= 0.999];   // 保底1箱 / ≥70% / 满血
      Game.victory = { pct: pct, boxes: boxes, claimed: [false, false, false] };
      G.Meta.setChests(Game.currentLevel, boxes);   // 主界面领取
      G.Meta.unlockLevel(Game.currentLevel + 1);    // 通关即可解锁下一关（不论血量）
      G.Meta.save();
      G.Audio.play('levelup');
      G.Camera.shake(5, 0.4);
      Game.setState('victory');
    },

    // 主界面领取宝箱
    claimChest: function (i) {
      var amt = G.Meta.claimChest(i);
      if (!amt) { G.Audio.play('error'); return; }
      G.Audio.play('coin');
      Game.showMsg('+' + amt + ' 钻石', '#7ef9ff', 1.2);
      G.FX.text(G.Player.x, G.Player.y - 30, '+' + amt + ' 钻石', '#7ef9ff', 15);
    },

    nextLevel: function () {
      if (Game.currentLevel >= D.LEVELS.TOTAL) { Game.showMsg('已是最终关！', '#ffd166', 2); return; }
      Game.startRun(Game.currentLevel + 1);
    },

    gameOver: function () {
      // 更新纪录（关卡进度）
      if (Game.currentLevel > Game.best.lv || (Game.currentLevel === Game.best.lv && G.Waves.wave > (Game.best.wv || 0))) {
        Game.best = { lv: Game.currentLevel, wv: G.Waves.wave };
        G.P.storage.set('lx_best', Game.best);
      }
      G.Meta.save(); // 结算存档升级金币
      G.Audio.play('gameover');
      Game.setState('gameover');
    },

    // ============ 触摸路由 ============
    onWorldTouch: function (id, x, y) {
      if (Game.state === 'levelup' || Game.state === 'menu' || Game.state === 'heroes' || Game.state === 'changelog' || Game.state === 'gameover' || Game.state === 'paused') return;
      // 去重：部分环境同一指针的 start 会双发，80ms 内忽略重复
      var now = Date.now();
      if (!Game._tapAt) Game._tapAt = {};
      if (Game._tapAt[id] && now - Game._tapAt[id] < 150) return;
      Game._tapAt[id] = now;
      // 英雄面板打开时，点面板外关闭
      if (Game.panelHero) {
        Game.panelHero = null;
        return;
      }
      var wx = x + Game.viewOx, wy = y + Game.viewOy;
      // 优先英雄拖拽
      var h = G.Hero.hitTest(wx, wy);
      if (h) {
        Game.drag = { hero: h, id: id, moved: false, sx: x, sy: y };
        return;
      }
      // 摇杆（第一个空闲触摸）
      if (Game.joyId === null) {
        var j = G.Input.joystick;
        Game.joyId = id;
        j.active = true; j.id = id;
        j.bx = x; j.by = y;
        j.dx = 0; j.dy = 0; j.mag = 0;
      }
    },

    onWorldMove: function (id, x, y) {
      if (Game.state !== 'playing') return;
      // 摇杆
      if (Game.joyId === id) {
        var j = G.Input.joystick;
        var dx = x - j.bx, dy = y - j.by;
        var d = Math.sqrt(dx * dx + dy * dy);
        var R = 52;
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        j.dx = dx / R; j.dy = dy / R; j.mag = Math.min(1, d / R);
        return;
      }
      // 英雄拖拽
      if (Game.drag && Game.drag.id === id) {
        var wx = x + Game.viewOx, wy = y + Game.viewOy;
        if (U.dist2(x, y, Game.drag.sx, Game.drag.sy) > 14 * 14) Game.drag.moved = true;
        if (Game.drag.moved) {
          Game.drag.hero.x = wx;
          Game.drag.hero.y = wy;
        }
      }
    },

    onWorldEnd: function (id, x, y) {
      if (Game.joyId === id) {
        Game.joyId = null;
        G.Input.joyReset();
      }
      if (Game.drag && Game.drag.id === id) {
        var drag = Game.drag;
        Game.drag = null;
        if (Game.state !== 'playing') return;
        if (!drag.moved) {
          // 点按 → 信息面板
          Game.panelHero = drag.hero;
          G.Audio.play('button');
        } else {
          // 尝试合成
          var wx = x + Game.viewOx, wy = y + Game.viewOy;
          var other = G.Hero.hitTest(wx, wy);
          if (other && other !== drag.hero && G.Hero.canMerge(drag.hero, other)) {
            G.Hero.merge(drag.hero, other, Game);
          } else {
            // 归位
            G.Hero.relayout(Game);
          }
        }
      }
    },

    onResize: function () {
      if (Game.base) G.Camera.init(D.MAP_W, D.MAP_H);
    },

    // ============ 主循环 ============
    tick: function () {
      var now = Date.now();
      var dt = Math.min(0.05, (now - Game.lastT) / 1000);
      Game.lastT = now;

      // 单帧异常不终止循环（记录首个错误便于诊断）
      try {
        if (Game.state === 'playing') Game.update(dt);
      } catch (e) {
        Game.errCount = (Game.errCount || 0) + 1;
        if (Game.errCount <= 3) { console.error('[update]', e); if (typeof window !== 'undefined') window.__lastErr = e && e.stack; }
      }
      try {
        Game.render();
      } catch (e) {
        Game.errCount = (Game.errCount || 0) + 1;
        if (Game.errCount <= 3) { console.error('[render]', e); if (typeof window !== 'undefined') window.__lastErr = e && e.stack; }
      }
    },

    update: function (dt) {
      Game.playTime += dt;
      if (Game.msg) { Game.msg.t -= dt; if (Game.msg.t <= 0) Game.msg = null; }

      G.Player.update(dt, Game);
      G.Waves.update(dt, Game);
      G.Enemy.update(dt, Game);
      G.Hero.update(dt, Game);
      G.Proj.update(dt, Game);
      G.Pickup.update(dt, Game);
      G.Skills.update(dt, Game);
      G.FX.update(dt);
      G.Camera.update(dt, G.Player.x, G.Player.y);

      if (G.Player.dead) Game.gameOver();
    },

    render: function () {
      var ctx = G.P.ctx;
      var W = G.P.screenW, H = G.P.screenH;
      var ox, oy;
      if (Game.state === 'menu') {
        ox = 0; oy = 0;
      } else {
        ox = G.Camera.ox(); oy = G.Camera.oy();
      }
      Game.viewOx = ox; Game.viewOy = oy;

      ctx.setTransform(G.P.dpr, 0, 0, G.P.dpr, 0, 0);
      if (Game.state === 'menu' || Game.state === 'gameover' || Game.state === 'heroes' || Game.state === 'changelog' || Game.state === 'victory') {
        // 菜单/英雄/结算只画背景层
        if (Game.state === 'gameover' || Game.state === 'victory') {
          G.Bg.draw(ctx, ox, oy);
          G.Bg.drawBase(ctx, Game.base, ox, oy);
          G.Hero.draw(ctx, ox, oy);
        }
        G.UI.draw(ctx, Game);
        return;
      }

      // 世界层
      G.Bg.draw(ctx, ox, oy);
      G.Bg.drawBase(ctx, Game.base, ox, oy);
      G.Pickup.draw(ctx, ox, oy);
      G.Hero.draw(ctx, ox, oy);
      G.Enemy.draw(ctx, ox, oy);
      G.Player.draw(ctx, ox, oy);
      G.Skills.draw(ctx, ox, oy);
      G.Proj.draw(ctx, ox, oy);
      G.FX.draw(ctx, ox, oy);
      // 拖拽合成预览
      if (Game.drag && Game.drag.moved && Game.state === 'playing') {
        var dh = Game.drag.hero;
        G.Hero.drawRange(ctx, ox, oy, dh, D.HEROES[dh.cls].color);
        var other = G.Hero.hitTest(dh.x, dh.y);
        if (other && other !== dh && G.Hero.canMerge(dh, other)) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(other.x - ox, other.y - oy, 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffd700';
          ctx.fillText('合成 Lv' + (dh.lv + 1) + '!', other.x - ox, other.y - oy - 34);
        }
      }
      G.FX.drawTexts(ctx, ox, oy);

      // 经验条（屏幕最底部细条）
      var xpR = Math.min(1, Game.xp / Game.xpNext);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0, H - 4, W * xpR, 4);

      // UI 层
      G.UI.draw(ctx, Game);

      // 低血量红晕
      var hpr = G.Player.hp / G.Player.maxHp;
      if (Game.state === 'playing' && hpr < 0.3) {
        ctx.fillStyle = 'rgba(255,0,0,' + (0.12 + 0.08 * Math.sin(Date.now() / 200)) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }
  };

  G.game = Game;
  Game.grid = G.Grid; // 空间网格（enemy.js 已创建）
  if (typeof module !== 'undefined') module.exports = Game;
})();

});
try {
  __req("", "./js/boot.js");
  __req("", "./js/core/platform.js");
  __req("", "./js/core/util.js");
  __req("", "./js/core/input.js");
  __req("", "./js/core/camera.js");
  __req("", "./js/core/audio.js");
  __req("", "./js/config/data.js");
  __req("", "./js/core/meta.js");
  __req("", "./js/core/bg.js");
  __req("", "./js/entities/fx.js");
  __req("", "./js/entities/pickup.js");
  __req("", "./js/entities/projectile.js");
  __req("", "./js/entities/player.js");
  __req("", "./js/entities/skills.js");
  __req("", "./js/entities/enemy.js");
  __req("", "./js/entities/hero.js");
  __req("", "./js/systems/waves.js");
  __req("", "./js/ui/ui.js");
  __req("", "./js/main.js");
  window.G.game.init();
} catch (e) { window.__bootErr = (e && e.stack) ? e.stack : String(e); try { console.error("BOOT FAIL", e); } catch (_) {} }