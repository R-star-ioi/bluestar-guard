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
      Player.noHealT = 0; Player.slowDebuffT = 0; Player.vulnT = 0;   // 吞噬者减益
      Player.r = Player.proto.melee ? 16 : D.PLAYER.RADIUS;
      Player.stats = { atk: 0, aspeed: 0, multi: 0, pierce: 0, crit: 0, bigshot: 0, regen: 0, leech: 0, speed: 0, magnet: 0, gold: 0, allydmg: 0, allyspd: 0, waveAtk: 0 };
      // 武器战斗状态（灼烧/场效果/箭雨蓄能）
      if (G.WeaponFX) G.WeaponFX.reset();
    },

    // ---- 派生属性：主角基础 × 局内三选一加成 ----
    attack: function () {
      var a = Player.proto.dmg * (1 + Player.stats.atk * 0.2) * (1 + Player.stats.bigshot * 0.08) * (1 + Player.stats.waveAtk) * (G.Skills ? G.Skills.dmgMult() : 1);
      // 红色 5★【龙炎怒心】：生命每高于 10%，攻击力 +3%，最高 +30%
      var ws = Player.proto.weapon;
      if (ws && ws.dragon && Player.maxHp > 0) {
        var over = (Player.hp / Player.maxHp - 0.1) / 0.9;
        a *= 1 + Math.min(0.30, Math.max(0, over) * 0.30);
      }
      return a;
    },
    interval: function () { return Player.proto.interval * Math.pow(0.92, Player.stats.aspeed) * (G.Skills ? G.Skills.aspdMult() : 1); },
    speed: function () { return Player.proto.speed * (1 + Player.stats.speed * 0.1) * (Player.slowDebuffT > 0 ? 0.9 : 1) + (G.Skills ? Player.proto.speed * G.Skills.speedBonus() : 0); },
    // 暴击率：局内技能（每点 8%）+ 武器暴击率
    critRate: function () {
      var ws = Player.proto.weapon;
      return U.clamp((Player.stats.crit || 0) * 0.08 + (ws ? (ws.crit || 0) : 0), 0, 0.85);
    },
    // 暴击倍率：基础 2 倍 + 武器暴击伤害加成
    critMult: function () {
      var ws = Player.proto.weapon;
      return 2 * (1 + (ws ? (ws.critDmg || 0) : 0));
    },
    // 主角面板 DPS（含暴击期望，不含多弹道），Boss/精英血量定价基准
    dps: function () {
      return Player.attack() * (1 + (Player.stats.crit || 0) * 0.08) / Player.interval();
    },
    // HUD 显示用的真实秒伤：含武器暴击率与暴击伤害
    dpsShow: function () {
      var cr = Player.critRate(), cm = Player.critMult();
      return Player.attack() * (1 + cr * (cm - 1)) / Player.interval();
    },
    pickRange: function () { return D.PLAYER.PICK_RANGE * (1 + Player.stats.magnet * 0.45) * (1 + (G.Skills ? G.Skills.pickBonus() : 0)); },

    update: function (dt, game) {
      if (Player.dead) return;
      // 吞噬者减益倒计时（互相独立）
      if (Player.noHealT > 0) Player.noHealT -= dt;
      if (Player.slowDebuffT > 0) Player.slowDebuffT -= dt;
      if (Player.vulnT > 0) Player.vulnT -= dt;
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
      var ws = Player.proto.weapon;
      var atk = Player.attack();
      var fake = ws ? { wx: ws, atk0: atk, dmg: atk } : null;
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
          var res = game.damageEnemy(e, atk, e.x, e.y, false);
          if (fake && G.WeaponFX) G.WeaponFX.onHit(fake, e, game, res && res.crit);
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
      var p = Player.proto;
      var ws = p.weapon || null;
      var atk = Player.attack();

      // 红色 5★：蓄满 3 杀 → 这一发变成【焚天箭雨】
      if (ws && ws.rainEvery && G.WeaponFX && G.WeaponFX.consumeRain()) {
        Player.face = target.x >= Player.x ? 1 : -1;
        G.WeaponFX.castRain(game, target, ws, atk);
        return;
      }

      var n = 1 + Player.stats.multi;
      var baseAng = U.angle(Player.x, Player.y, target.x, target.y);
      var spread = 0.14;
      var kind = 'bullet', color = p.color;
      if (Player.cls === 'mage') kind = 'fireball';
      else if (Player.cls === 'cannon') kind = 'cannonball';
      else if (Player.cls === 'priest') color = '#ffeaa7';
      else if (ws && ws.tier >= 3) color = ws.tier === 4 ? '#ffb347' : '#a55eea';
      var size = 4 * (1 + Player.stats.bigshot * 0.3);
      if (kind === 'fireball') size += 2;
      if (kind === 'cannonball') size += 4;
      for (var i = 0; i < n; i++) {
        var ang = baseAng + (i - (n - 1) / 2) * spread;
        G.Proj.spawn({
          x: Player.x, y: Player.y - 6,
          ang: ang,
          speed: p.bulletSpeed || 560,
          dmg: atk,
          pierce: Player.stats.pierce + (ws ? (ws.pierce || 0) : 0),
          pierceInc: ws ? (ws.pierceInc || 0) : 0,
          size: size,
          color: color,
          friendly: true,
          splash: p.splash,
          life: (p.range + 60) / (p.bulletSpeed || 560),
          kind: kind,
          wx: ws,
          atk0: atk
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
      if (Player.vulnT > 0) dmg *= 1.2;   // 吞噬者减益：受到的伤害更疼
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
      // 吞噬者减益：无法治疗
      if (Player.noHealT > 0) {
        G.FX.text(Player.x, Player.y - 26, '无法治疗', '#ff6b6b', 11);
        return;
      }
      var real = Math.min(Player.maxHp - Player.hp, v);
      if (real > 0.5) {
        G.FX.text(Player.x, Player.y - 24, '+' + Math.round(real), '#7bed9f', 12);
      }
      Player.hp = Math.min(Player.maxHp, Player.hp + v);
    },

    // 世界吞噬者的攻击命中后施加三个独立减益
    applyWormDebuff: function () {
      Player.noHealT = 10;        // 无法治疗 10s
      Player.slowDebuffT = 5;     // 移速 -10% 5s
      Player.vulnT = 5;           // 受到的伤害 +20% 5s
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
      // 武器：装了武器就画武器图（朝哪边就镜像到哪边），没装就画职业默认的矢量武器
      var eqw = (G.Weapon ? G.Weapon.equipped(Player.cls) : null);
      var drewEq = eqw ? G.Weapon.drawHeld(ctx, sx + Player.face * 14, sy + bob, 46, eqw, 0.12, Player.face > 0) : false;
      if (!drewEq) {
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
    }
  };
  G.Player = Player;
})();
