// 武器战斗效果中枢：穿透由 Proj 处理，这里负责命中特效、灼烧、地面效果
// 数据来源：Weapon.stats(w)（见 core/weapon.js）
var G = require('../boot.js');
(function () {
  var U = G.U;

  var WeaponFX = {
    fields: [],      // 地面效果：{ type:'fire'|'totem', x,y,r,t,life,tick,... }
    pending: [],     // 延时爆炸：{ t,x,y,r,dmg,ws,atk }
    active: null,    // 本帧生效的武器属性（开局/换装后由 refresh 同步）
    rainKill: 0,     // 焚天箭雨累计击杀
    rainReady: false,

    reset: function () {
      WeaponFX.fields.length = 0;
      WeaponFX.pending.length = 0;
      WeaponFX.rainKill = 0;
      WeaponFX.rainReady = false;
      WeaponFX.refresh();
    },

    // 从主角面板同步当前武器（protoStats 里带了 weapon 字段）
    refresh: function () {
      var p = G.Player;
      WeaponFX.active = (p && p.proto && p.proto.weapon) || null;
      return WeaponFX.active;
    },

    // ============ 弹丸命中 ============
    onHit: function (p, e, game, crit) {
      var ws = p.wx || WeaponFX.active;
      if (!ws) return;
      var atk = p.atk0 || p.dmg;

      // —— 蓝：冰霜溅射 + 冻结 / 寒霜 ——
      if (ws.frostSplash) {
        var fr = ws.frostR || 72;
        G.FX.ring(e.x, e.y, '#8fd8ff', fr, 0.26, 2.5);
        G.FX.burst(e.x, e.y, 6, '#bfe9ff', 120, 0.35, 3);
        WeaponFX.aoe(game, e.x, e.y, fr, atk * ws.frostSplash, '#8fd8ff');
        if (Math.random() < (ws.freezeChance || 0)) {
          e.freezeT = Math.max(e.freezeT || 0, ws.freezeDur || 0.8);
          G.FX.ring(e.x, e.y, '#d6f2ff', e.r + 12, 0.3, 2);
          G.FX.text(e.x, e.y - e.r - 18, '冻结', '#9fe6ff', 12);
          G.Audio.play('crystal');
        } else {
          e.chillT = ws.chillDur || 2;
          e.chillSlow = ws.chillSlow || 0.4;
          e.chillAspd = ws.chillAspd || 0.2;
        }
      }

      // —— 紫：暴击 → 暗影分裂 ——
      if (ws.shadowSplit && crit) WeaponFX.shadowSplit(game, e, atk, ws);

      // —— 红：炎爆 ——
      if (ws.burstR) WeaponFX.flameBurst(game, e, atk, ws, crit);
    },

    // 范围伤害（不再递归触发武器特效）
    aoe: function (game, x, y, r, dmg, color) {
      var near = game.grid.query(x, y, r + 24);
      var hit = false;
      for (var i = 0; i < near.length; i++) {
        var e = near[i];
        if (e.dead) continue;
        if (U.dist2(x, y, e.x, e.y) <= (r + e.r) * (r + e.r)) {
          game.damageEnemy(e, dmg, x, y, false);
          hit = true;
        }
      }
      return hit;
    },

    // ============ 炎爆 / 灼烧 ============
    flameBurst: function (game, e, atk, ws, crit) {
      var ratio = ws.burstRatio || 1;
      if (crit && ws.burstBonus) ratio += ws.burstBonus;
      var r = ws.burstR || 150;
      WeaponFX.burst(game, e.x, e.y, r, atk * ratio, ws, atk);
      // 4★：暴击双重炎爆（第二发更大更痛）
      if (crit && ws.doubleBurst) {
        WeaponFX.pending.push({
          t: 0.14, x: e.x, y: e.y, r: r * 1.35,
          dmg: atk * ratio * 1.5, ws: ws, atk: atk
        });
      }
      // 4★：火焰图腾
      if (ws.totemChance && Math.random() < ws.totemChance) {
        WeaponFX.fields.push({
          type: 'totem', x: e.x, y: e.y, r: 70, t: 2.5, life: 2.5,
          tick: 0, dps: atk * 0.8
        });
        G.Audio.play('rare');
      }
    },

    burst: function (game, x, y, r, dmg, ws, atk) {
      var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
      G.FX.ring(x, y, '#ff8c42', r, 0.35, 6);
      G.FX.burst(x, y, Math.round(10 + 8 * fa), '#ffb347', 240, 0.5, 5);
      G.FX.burst(x, y, Math.round(6 + 4 * fa), '#ff5722', 170, 0.4, 4);
      G.Audio.play('boom');
      G.Camera.shake(2.5, 0.12);
      var near = game.grid.query(x, y, r + 24);
      for (var i = 0; i < near.length; i++) {
        var e2 = near[i];
        if (e2.dead) continue;
        if (U.dist2(x, y, e2.x, e2.y) <= (r + e2.r) * (r + e2.r)) {
          game.damageEnemy(e2, dmg, x, y, true);
          WeaponFX.applyBurn(e2, ws, atk);
        }
      }
    },

    // 灼烧：层数决定每秒伤害，统一刷新持续时间
    applyBurn: function (e, ws, atk) {
      if (!ws || !ws.burnStack || !atk) return;
      var cur = (e.burnT > 0 ? (e.burnN || 0) : 0);
      e.burnN = Math.min(ws.burnStack, cur + 1);
      e.burnT = ws.burnDur || 3;
      e.burnLife = ws.burnDur || 3;
      e.burnDps = atk * (ws.burnDps || 0.25);
      e.burnMax = ws.burnStack;
    },

    // 灼烧易伤（3★+）：对被点燃目标的伤害加成
    vulnMult: function (e) {
      var ws = WeaponFX.active;
      if (!ws || !ws.vuln) return 1;
      return (e && e.burnT > 0 && e.burnN > 0) ? (1 + ws.vuln) : 1;
    },

    // ============ 紫色：暗影分裂 ============
    nearest: function (game, x, y, range, n, skip) {
      var list = G.Enemy.list, best = [];
      var r2 = range * range;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.dead || e === skip) continue;
        var d = U.dist2(x, y, e.x, e.y);
        if (d > r2) continue;
        best.push({ e: e, d: d });
      }
      best.sort(function (a, b) { return a.d - b.d; });
      var out = [];
      for (var j = 0; j < best.length && out.length < n; j++) out.push(best[j].e);
      return out;
    },

    shadowSplit: function (game, e, atk, ws) {
      var n = ws.shadowSplit || 2;
      var targets = WeaponFX.nearest(game, e.x, e.y, 280, n, e);
      if (!targets.length) targets.push(e);
      var dmg = atk * (ws.shadowSplitRatio || 0.6);
      for (var i = 0; i < n; i++) {
        var t = targets[i % targets.length];
        G.Proj.spawn({
          x: e.x, y: e.y,
          ang: U.angle(e.x, e.y, t.x, t.y),
          speed: 780, dmg: dmg, size: 5, color: '#a55eea',
          friendly: true, life: 1.4, kind: 'shadow',
          homing: t, shadow: true
        });
      }
      G.FX.ring(e.x, e.y, '#a55eea', 42, 0.28, 3);
      G.Audio.play('crystal');
    },

    // ============ 地面火焰（3★ 轨迹）============
    addFire: function (x, y, atk, ws) {
      var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
      if (fa < 0.15) return;    // 特效关掉时少生成一些，省性能
      WeaponFX.fields.push({
        type: 'fire', x: x, y: y, r: 24, t: 1.0, life: 1.0, tick: 0.34,
        dmg: atk * 0.30, ws: ws, atk: atk
      });
    },

    // ============ 5★ 焚天箭雨 ============
    consumeRain: function () {
      if (!WeaponFX.rainReady) return false;
      WeaponFX.rainReady = false;
      WeaponFX.rainKill = 0;
      return true;
    },
    castRain: function (game, target, ws, atk) {
      for (var i = 0; i < 7; i++) {
        var a = Math.random() * Math.PI * 2;
        var rr = 14 + Math.random() * 84;
        WeaponFX.pending.push({
          t: 0.055 * i,
          x: target.x + Math.cos(a) * rr,
          y: target.y + Math.sin(a) * rr,
          r: (ws.burstR || 150) * 0.7,
          dmg: atk * (ws.burstRatio || 1),
          ws: ws, atk: atk
        });
      }
      G.Audio.play('rarebig');
      G.FX.text(target.x, target.y - 40, '焚天箭雨', '#ff6b3d', 18);
    },

    // ============ 击杀回调 ============
    onKill: function (e, game) {
      var ws = WeaponFX.active;
      if (!ws) return;
      var burning = (e.burnT > 0 && e.burnN > 0);
      // 2★：击杀灼烧目标回血
      if (ws.killHeal && burning && G.Player && G.Player.heal) G.Player.heal(ws.killHeal);
      // 5★：灼烧传染（传递一半层数）
      if (ws.burnSpread && burning) {
        var half = Math.max(1, Math.ceil(e.burnN / 2));
        var near = game.grid.query(e.x, e.y, 120);
        var spread = false;
        for (var i = 0; i < near.length; i++) {
          var o = near[i];
          if (o === e || o.dead) continue;
          if (U.dist2(e.x, e.y, o.x, o.y) > 120 * 120) continue;
          var cur = (o.burnT > 0 ? (o.burnN || 0) : 0);
          o.burnN = Math.min(ws.burnStack, cur + half);
          o.burnT = ws.burnDur || 3;
          o.burnLife = ws.burnDur || 3;
          o.burnDps = e.burnDps || 1;
          o.burnMax = ws.burnStack;
          spread = true;
        }
        if (spread) G.FX.ring(e.x, e.y, '#ff8c42', 110, 0.35, 3);
      }
      // 5★：焚天箭雨蓄能
      if (ws.rainEvery) {
        WeaponFX.rainKill++;
        if (WeaponFX.rainKill >= ws.rainEvery) WeaponFX.rainReady = true;
      }
    },

    // ============ 每帧推进 ============
    update: function (dt, game) {
      var i, j;
      // 延时爆炸
      for (i = WeaponFX.pending.length - 1; i >= 0; i--) {
        var q = WeaponFX.pending[i];
        q.t -= dt;
        if (q.t <= 0) {
          WeaponFX.burst(game, q.x, q.y, q.r, q.dmg, q.ws, q.atk);
          WeaponFX.pending.splice(i, 1);
        }
      }
      // 地面效果
      var fs = WeaponFX.fields;
      for (j = fs.length - 1; j >= 0; j--) {
        var f = fs[j];
        f.t -= dt;
        f.tick += dt;
        if (f.type === 'fire') {
          if (f.tick >= 0.34) {
            f.tick = 0;
            var near = game.grid.query(f.x, f.y, f.r + 20);
            for (i = 0; i < near.length; i++) {
              var e2 = near[i];
              if (e2.dead) continue;
              if (U.dist2(f.x, f.y, e2.x, e2.y) <= (f.r + e2.r) * (f.r + e2.r)) {
                game.damageEnemy(e2, f.dmg, f.x, f.y, false);
                WeaponFX.applyBurn(e2, f.ws, f.atk);
              }
            }
          }
        } else if (f.type === 'totem') {
          if (f.tick >= 0.5) {
            f.tick = 0;
            WeaponFX.aoe(game, f.x, f.y, f.r, f.dps * 0.5, '#ff8c42');
          }
        }
        if (f.t <= 0) fs.splice(j, 1);
      }
    },

    draw: function (ctx, ox, oy) {
      var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
      if (fa <= 0.02) return;
      var fs = WeaponFX.fields;
      for (var i = 0; i < fs.length; i++) {
        var f = fs[i];
        var a = Math.max(0, f.t / f.life);
        var sx = f.x - ox, sy = f.y - oy;
        if (f.type === 'fire') {
          var g = ctx.createRadialGradient(sx, sy, 1, sx, sy, f.r);
          g.addColorStop(0, 'rgba(255,214,120,' + (0.55 * a * fa) + ')');
          g.addColorStop(0.55, 'rgba(255,120,40,' + (0.34 * a * fa) + ')');
          g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, Math.PI * 2); ctx.fill();
        } else if (f.type === 'totem') {
          var k = f.t / f.life;
          var pulse = 0.6 + 0.4 * Math.sin(Date.now() / 160);
          ctx.globalAlpha = (0.35 + 0.45 * pulse) * Math.min(1, k * 2) * fa;
          var g2 = ctx.createRadialGradient(sx, sy, 4, sx, sy, f.r);
          g2.addColorStop(0, 'rgba(255,190,90,0.95)');
          g2.addColorStop(0.5, 'rgba(255,110,30,0.6)');
          g2.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, Math.PI * 2); ctx.fill();
          // 图腾柱
          ctx.globalAlpha = Math.min(1, k * 2) * fa;
          ctx.fillStyle = '#ffb347';
          ctx.beginPath();
          ctx.moveTo(sx, sy - 26);
          ctx.lineTo(sx + 7, sy + 2);
          ctx.lineTo(sx - 7, sy + 2);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // 待落下的箭雨：画瞄准圈
      for (var j = 0; j < WeaponFX.pending.length; j++) {
        var q = WeaponFX.pending[j];
        ctx.globalAlpha = 0.55 * fa;
        ctx.strokeStyle = '#ff8c42';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x - ox, q.y - oy, q.r * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  };

  G.WeaponFX = WeaponFX;
})();
