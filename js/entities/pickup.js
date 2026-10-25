// 掉落物：金币 / 经验宝石 / 心 / 磁铁 / 炸弹
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Pickup = {
    list: [],
    // type: coin | gem | heart | magnet | bomb
    spawn: function (type, x, y, value) {
      if (Pickup.list.length > 150) Pickup.list.shift();
      var a = Math.random() * Math.PI * 2;
      var sp = U.rand(20, 70);
      Pickup.list.push({
        type: type, x: x, y: y, value: value || 1,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, magnet: false, born: 0.15
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
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.t += dt;
        if (p.born > 0) p.born -= dt;
        // 磁吸
        var d2 = U.dist2(p.x, p.y, pl.x, pl.y);
        var rr = p.magnet ? 99999 : pr;
        if (!pl.dead && p.born <= 0 && d2 < rr * rr) {
          var d = Math.sqrt(d2) || 1;
          var pull = p.magnet ? 620 : 340;
          p.vx += (pl.x - p.x) / d * pull * dt;
          p.vy += (pl.y - p.y) / d * pull * dt;
        }
        p.vx *= 0.92; p.vy *= 0.92;
        p.x += p.vx * dt; p.y += p.vy * dt;
        // 拾取
        if (!pl.dead && d2 < 24 * 24) {
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
