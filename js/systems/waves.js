// 波次系统：预算刷怪 / 每5波Boss / 波间歇
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Waves = {
    wave: 0,            // 当前波（0=未开始）
    state: 'rest',      // rest(间歇) | active(进行中)
    timer: 2.5,         // 状态剩余时间
    spawnQueue: 0,      // 剩余预算
    spawnT: 0,
    announced: false,

    reset: function () {
      Waves.wave = 0;
      Waves.state = 'rest';
      Waves.timer = 2.5;
      Waves.spawnQueue = 0;
      Waves.announced = false;
    },

    budget: function (w) {
      var base = D.WAVE.BUDGET_BASE + 7 * w + Math.pow(w, 1.55);
      var mult = 1;
      for (var t = 0; t < D.WAVE.COUNT_MULT_TIERS.length; t++) {
        if (w >= D.WAVE.COUNT_MULT_TIERS[t].from) mult = D.WAVE.COUNT_MULT_TIERS[t].mult;
      }
      return base * mult;
    },

    // 血量阶梯成长：1-12波 ×1.13，13-24 ×1.20，25-39 ×1.30，40+ ×1.40
    hpGrowth: function (w) {
      var tiers = D.WAVE.HP_GROWTH_TIERS;
      var g = 1;
      for (var v = 2; v <= w; v++) {
        var rate = tiers[0].rate;
        for (var t = 0; t < tiers.length; t++) {
          if (v >= tiers[t].from) rate = tiers[t].rate;
        }
        g *= rate;
      }
      return g;
    },

    // 刷怪点：屏幕外环带（以屏幕中心为参考）
    spawnPoint: function (game) {
      var cam = G.Camera;
      var cx = cam.x + G.P.screenW / 2, cy = cam.y + G.P.screenH / 2;
      var rad = Math.max(G.P.screenW, G.P.screenH) * 0.62 + 60;
      var a = Math.random() * Math.PI * 2;
      var x = U.clamp(cx + Math.cos(a) * rad, 30, D.MAP_W - 30);
      var y = U.clamp(cy + Math.sin(a) * rad, 30, D.MAP_H - 30);
      return { x: x, y: y };
    },

    pickEnemyType: function (w) {
      var pool = ['slime'];
      if (w >= 3) pool.push('fast', 'fast');
      if (w >= 4) pool.push('tank');
      if (w >= 6) pool.push('shooter', 'shooter');
      return U.choice(pool);
    },

    update: function (dt, game) {
      if (Waves.state === 'rest') {
        Waves.timer -= dt;
        if (Waves.timer <= 0) Waves.startNext(game);
      } else {
        // 进行中：按预算持续刷怪
        if (Waves.spawnQueue > 0 && G.Enemy.list.length < D.WAVE.MAX_ALIVE) {
          Waves.spawnT -= dt;
          if (Waves.spawnT <= 0) {
            Waves.spawnT = U.rand(0.3, 0.7);
            Waves.spawnOne(game, Waves.wave);
          }
        } else if (Waves.spawnQueue <= 0 && G.Enemy.list.length === 0) {
          // 波清空
          Waves.state = 'rest';
          Waves.timer = D.WAVE.START_INTERVAL;
          game.onWaveClear(Waves.wave);
        }
      }
    },

    startNext: function (game) {
      Waves.wave++;
      Waves.state = 'active';
      Waves.spawnQueue = Waves.budget(Waves.wave);
      Waves.spawnT = 0.5;
      G.Audio.play('wave');
      game.onWaveStart(Waves.wave);
      // Boss 波
      if (Waves.wave % D.WAVE.BOSS_EVERY === 0) {
        var p = Waves.spawnPoint(game);
        G.Enemy.spawn(game, 'slime', p.x, p.y, Waves.wave, { boss: true });
        G.Audio.play('boss');
        G.Camera.shake(6, 0.5);
      }
    },

    spawnOne: function (game, w) {
      var cost = { slime: 2, fast: 3, tank: 6, shooter: 5 };
      var type = Waves.pickEnemyType(w);
      var n = Math.max(1, Math.min(6, Math.floor(Waves.spawnQueue / cost[type] / 2)));
      for (var i = 0; i < n && Waves.spawnQueue > 0; i++) {
        var p = Waves.spawnPoint(game);
        var opts = {};
        var eliteChance = Math.min(0.30, D.WAVE.ELITE_CHANCE + w * 0.006);
        if (w >= D.WAVE.ELITE_FROM && Math.random() < eliteChance) opts.elite = true;
        G.Enemy.spawn(game, type, p.x, p.y, w, opts);
        Waves.spawnQueue -= cost[type];
      }
    },

    label: function () {
      if (Waves.state === 'rest' && Waves.wave > 0) {
        return { txt: '第 ' + (Waves.wave + 1) + ' 波来袭 ' + Math.ceil(Waves.timer) + 's', boss: (Waves.wave + 1) % D.WAVE.BOSS_EVERY === 0 };
      }
      return null;
    }
  };
  G.Waves = Waves;
})();
