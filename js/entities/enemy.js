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
      // 血量 = 基础值（小怪基准 500 × 类型系数）× 波次/关卡倍率
      var baseHp = D.ENEMY_HP_BASE * (base.hpRatio || 1) * hpMult;
      var e = {
        type: type, x: x, y: y,
        hp: baseHp, maxHp: baseHp,
        speed: base.speed, dmg: base.dmg * dmgG,
        r: base.radius, coin: Math.ceil(base.coin * lootG), gem: Math.ceil(base.gem * lootG),
        color: base.color, wave: wave, level: level, hpMult: hpMult,
        dead: false, hitT: 0,
        elite: false, boss: false,
        atkT: U.rand(0.3, 1.0), // 攻击计时
        shootT: 0,
        vx: 0, vy: 0, wobT: Math.random() * 10,
        stunT: 0, slowT: 0, orbT: 0, kbX: 0, kbY: 0,
        freezeT: 0, chillT: 0, chillSlow: 0.4, chillAspd: 0.2,
        burnT: 0, burnN: 0, burnDps: 0, burnFx: 0
      };
      if (opts.elite) {
        e.elite = true;
        e.hp = D.ELITE.HP_BASE * Math.pow(hpMult, 0.85);   // 精英基础 3500，成长略缓于小怪
        e.maxHp = e.hp;
        e.speed *= D.ELITE.SPEED; e.r *= D.ELITE.RADIUS;
        e.coin = Math.ceil(D.ELITE.COIN * lootG); e.gem = Math.ceil(D.ELITE.GEM * lootG);
        e.dmg *= 1.5;
      }
      if (opts.boss) {
        e.boss = true;
        e.hp = D.BOSS.HP_BASE * Math.pow(hpMult, 0.7);     // Boss 基础 15000，成长更缓（否则第 20 波要打一分半）
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
        if (e.freezeT > 0) e.freezeT -= dt;
        if (e.chillT > 0) e.chillT -= dt;

        // 灼烧（武器火焰效果）：持续掉血，可被烧死
        if (e.burnT > 0) {
          e.burnT -= dt;
          var bd = (e.burnN || 0) * (e.burnDps || 0) * dt;
          if (bd > 0) e.hp -= bd;
          e.burnFx = (e.burnFx || 0) + dt;
          if (e.burnFx > 0.5) {
            e.burnFx = 0;
            var tickDmg = (e.burnN || 0) * (e.burnDps || 0) * 0.5;
            if (tickDmg >= 1) G.FX.text(e.x + U.rand(-7, 7), e.y - e.r - 3, String(Math.round(tickDmg)), '#ff9f43', 10);
          }
          if (e.hp <= 0) {
            e.hp = 0;
            Enemy.damage(game, e, 0, e.x, e.y, false, false, true);
          }
          if (e.dead) continue;
        }
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

        // 寒霜：移速降低；冻结/眩晕：完全不能动
        var chilled = e.chillT > 0;
        var frozen = e.freezeT > 0 || e.stunT > 0;
        var sp = e.speed * (e.slowT > 0 ? 0.55 : 1) * (chilled ? (1 - (e.chillSlow || 0.4)) : 1);
        if (!frozen) {
          if (d > stopDist) {
            e.x += (dx / d * sp + sepX) * dt;
            e.y += (dy / d * sp + sepY) * dt;
          } else if (sepX || sepY) {
            e.x += sepX * dt; e.y += sepY * dt;
          }
        }

        // 攻击（眩晕/冻结时不攻击；寒霜降低攻击频率）
        e.atkT -= dt * (chilled ? (1 - (e.chillAspd || 0.2)) : 1);
        if (e.atkT <= 0 && !frozen) {
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
        if (sh && sh.shootRange && !pl.dead && !frozen) {
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

    damage: function (game, e, dmg, hx, hy, big, crit, silent) {
      if (e.dead) return;
      // 暴击判定在调用方处理，这里直接扣血
      e.hp -= dmg;
      e.hitT = 0.12;
      if (!silent) {
        // 伤害飘字：暴击更大更红，重击（炮/爆）稍大
        var txtSize = big ? 15 : 12;
        var txtColor = '#fff';
        if (crit) { txtSize = big ? 21 : 19; txtColor = '#ff4d4d'; }
        G.FX.text(e.x, e.y - e.r - 6, String(Math.round(dmg)), txtColor, txtSize, !!crit);
        G.FX.spray(e.x, e.y, Math.atan2(e.y - (hy || e.y), e.x - (hx || e.x)) + Math.PI, big ? 6 : 3, e.color, 130, 0.35, 3);
      }
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

        // 冻结 / 寒霜（冰霜武器）
        if (e.freezeT > 0) {
          ctx.fillStyle = 'rgba(200,240,255,0.26)';
          ctx.beginPath(); ctx.arc(sx, sy, e.r + 2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(170,235,255,0.95)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx, sy, e.r + 3, 0, Math.PI * 2); ctx.stroke();
        } else if (e.chillT > 0) {
          ctx.strokeStyle = 'rgba(143,216,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(sx, sy, e.r + 2.5, 0, Math.PI * 2); ctx.stroke();
        }

        // 灼烧火苗（火焰武器）
        if (e.burnT > 0 && e.burnN > 0) {
          var ffa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
          ctx.globalAlpha = 0.8 * ffa;
          var bn = Math.min(3, e.burnN);
          for (var bi = 0; bi < bn; bi++) {
            var bx2 = sx + Math.sin(t * 9 + bi * 2.1) * e.r * 0.55;
            var by2 = sy - e.r - 3 - ((t * 26 + bi * 11) % 14);
            ctx.fillStyle = bi % 2 ? '#ffb347' : '#ff6b3d';
            ctx.beginPath();
            ctx.arc(bx2, by2, 2.4 - bi * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // 眩晕标记
        if (e.stunT > 0 && e.freezeT <= 0) {
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
