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
        // 拾取
        if (!pl.dead && U.dist2(p.x, p.y, pl.x, pl.y) < 30 * 30) {
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
