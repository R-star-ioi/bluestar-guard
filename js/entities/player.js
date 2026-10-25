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
      Player.stats = { atk: 0, aspeed: 0, multi: 0, pierce: 0, crit: 0, bigshot: 0, regen: 0, leech: 0, speed: 0, magnet: 0, gold: 0, allydmg: 0, allyspd: 0 };
    },

    // ---- 派生属性：主角基础 × 局内三选一加成 ----
    attack: function () { return Player.proto.dmg * (1 + Player.stats.atk * 0.2) * (1 + Player.stats.bigshot * 0.08); },
    interval: function () { return Player.proto.interval * Math.pow(0.92, Player.stats.aspeed); },
    speed: function () { return Player.proto.speed * (1 + Player.stats.speed * 0.1); },
    pickRange: function () { return D.PLAYER.PICK_RANGE * (1 + Player.stats.magnet * 0.45); },

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
