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
