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
        kind: o.kind || 'bullet', // bullet | fireball | cannonball | enemy | shadow
        hitSet: null,
        wx: o.wx || null,           // 武器特效参数（Weapon.stats）
        atk0: o.atk0 || o.dmg,      // 发射瞬间的攻击力（溅射/灼烧按它算）
        pierceInc: o.pierceInc || 0,// 每穿透一人伤害变化
        homing: o.homing || null,   // 追踪目标
        shadow: !!o.shadow,         // 暗影分裂箭（击杀返冷却）
        knock: o.knock || 0,        // 震荡弹头击退等级
        trailX: 1e9, trailY: 1e9
      });
    },
    update: function (dt, game) {
      var list = Proj.list;
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.t += dt;

        // 追踪：慢慢转向目标
        if (p.homing) {
          if (p.homing.dead) {
            p.homing = null;
          } else {
            var want = Math.atan2(p.homing.y - p.y, p.homing.x - p.x);
            var cur = Math.atan2(p.vy, p.vx);
            var diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
            var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
            var na = cur + U.clamp(diff, -10 * dt, 10 * dt);
            p.vx = Math.cos(na) * sp;
            p.vy = Math.sin(na) * sp;
          }
        }

        p.x += p.vx * dt; p.y += p.vy * dt;

        // 红色 3★+：飞行路径留火焰轨迹
        if (p.wx && p.wx.trail && G.WeaponFX) {
          var dx = p.x - p.trailX, dy = p.y - p.trailY;
          if (dx * dx + dy * dy > 400) {
            p.trailX = p.x; p.trailY = p.y;
            G.WeaponFX.addFire(p.x, p.y, p.atk0, p.wx);
          }
        }

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
          var res = game.damageEnemy(e, p.dmg, p.x, p.y, p.kind === 'cannonball');
          if (p.echo && G.Skills) G.Skills._echoOnHit(e, game, G.Skills.levelOf('echo'));
          // 武器命中特效（冰霜 / 分裂 / 炎爆）
          if (p.wx && G.WeaponFX) G.WeaponFX.onHit(p, e, game, res && res.crit);
          // 震荡弹头：普攻击退（沿弹道方向推开）
          if (p.knock > 0 && !e.isWorm) {
            var ksp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
            var kf = 150 + p.knock * 45;
            e.kbX += p.vx / ksp * kf;
            e.kbY += p.vy / ksp * kf;
          }
          // 暗影箭击杀 → 返还 0.1s 攻击冷却
          if (p.shadow && e.dead) G.Player.attackTimer -= 0.1;
          if (p.hitSet) p.hitSet.push(e);
          if (p.pierce > 0) {
            p.pierce--;
            if (p.pierceInc) p.dmg *= (1 + p.pierceInc);
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
          game.damageEnemy(e, p.dmg * k, e.x, e.y, true, { aoe: true });
        }
      }
    },
    draw: function (ctx, ox, oy) {
      var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
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
          continue;
        }

        var tier = p.wx ? p.wx.tier : -1;
        var flame = tier === 4;
        var shadow = p.kind === 'shadow';

        // 拖尾
        ctx.globalAlpha = (flame ? 0.6 : shadow ? 0.5 : 0.35) * Math.max(0.25, fa);
        ctx.strokeStyle = flame ? '#ff8c42' : p.color;
        ctx.lineWidth = p.size * (flame ? 1.9 : shadow ? 1.4 : 1);
        ctx.beginPath();
        ctx.moveTo(sx - p.vx * (flame ? 0.045 : 0.03), sy - p.vy * (flame ? 0.045 : 0.03));
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 箭头本体
        ctx.fillStyle = flame ? '#ffd166' : p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (flame ? 1.15 : 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flame ? '#fff3c4' : '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // 火焰 / 暗影装饰
        if (fa > 0.2) {
          if (flame) {
            ctx.globalAlpha = 0.75 * fa;
            ctx.fillStyle = '#ff6b3d';
            var t = p.t * 22;
            for (var k = 0; k < 3; k++) {
              var sp2 = Math.sin(t + k * 2.1) * p.size * 1.3;
              ctx.beginPath();
              ctx.arc(sx - p.vx * 0.012 * (k + 1) + sp2 * 0.35, sy - p.vy * 0.012 * (k + 1) + sp2 * 0.25,
                Math.max(1, p.size * (0.5 - k * 0.11)), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          } else if (shadow) {
            ctx.globalAlpha = 0.7 * fa;
            ctx.fillStyle = '#c07cf0';
            var t2 = p.t * 26;
            for (var m = 0; m < 2; m++) {
              ctx.beginPath();
              ctx.arc(sx + Math.sin(t2 + m * 3) * p.size, sy + Math.cos(t2 + m * 3) * p.size,
                Math.max(1, p.size * 0.32), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }
      }
    },
    clear: function () { Proj.list.length = 0; }
  };
  G.Proj = Proj;
})();
