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

    // 怪物血量总倍率 = 关间难度 × 波内陡坡 × 尾段冲刺（15~20 波）
    hpMult: function (level, wave) {
      var late = 1;
      if (wave >= D.LEVELS.LATE_FROM) late = Math.pow(D.LEVELS.LATE_RATE, wave - D.LEVELS.LATE_FROM + 1);
      return Waves.diffBase(level) * Math.pow(D.LEVELS.HP_WAVE, wave - 1) * late;
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
        if (Waves.wave === D.LEVELS.WAVES && G.Devourer) {
          // 关底 Boss：世界吞噬者（多体节蠕虫）
          G.Devourer.spawn(game, Waves.level);
          game.showMsg('⚠ 世界吞噬者来袭', '#ff6b6b', 2.5);
          G.Camera.shake(9, 0.8);
        } else {
          var p = Waves.spawnPoint(game);
          G.Enemy.spawn(game, 'slime', p.x, p.y, { level: Waves.level, wave: Waves.wave, boss: true });
          G.Camera.shake(6, 0.5);
        }
        G.Audio.play('boss');
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
