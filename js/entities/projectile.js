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
