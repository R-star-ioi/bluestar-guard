// 世界吞噬者：第 20 波关底 Boss。多体节蠕虫，击杀任意体节即分裂，
// 击败所有独立蠕虫才算击杀。活着时循环播放专属 BGM（60% 音量）。
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;

  var Devourer = {
    worms: [],      // { segs:[node], spacing, level, dashCd, dashT, dashing, dashDir, dashHit, spitT }
    spits: [],      // 魔唾液弹 { x,y,vx,vy,r,t,life }
    pools: [],      // 唾液落地的酸液 { x,y,r,t,life,tick }
    touchCd: 0,
    active: false,
    level: 1,

    reset: function () {
      Devourer.worms.length = 0;
      Devourer.spits.length = 0;
      Devourer.pools.length = 0;
      Devourer.active = false;
      Devourer.touchCd = 0;
      if (G.P.stopBgm) G.P.stopBgm();
    },

    hpOf: function (lv) { return D.DEVOURER.hpOf(lv); },

    // ============ 生成 ============
    spawn: function (game, level) {
      Devourer.reset();
      Devourer.active = true;
      Devourer.level = level;

      var n = D.DEVOURER.SEG_COUNT;
      var total = D.DEVOURER.hpOf(level);
      var unit = total / (n - 1 + 2.5);          // 头按 2.5 节计
      var spacing = D.DEVOURER.SEG_SPACING;
      var pl = G.Player;
      var a = Math.random() * Math.PI * 2;
      var hx = U.clamp(pl.x + Math.cos(a) * 620, 80, D.MAP_W - 80);
      var hy = U.clamp(pl.y + Math.sin(a) * 620, 80, D.MAP_H - 80);

      // 沿圆弧排布（72×40=2880px，直线会伸出地图；弧线让身体自然盘在图内）
      var segs = [];
      var cx = hx, cy = hy, dir = a + Math.PI;
      for (var i = 0; i < n; i++) {
        var hp = unit * (i === 0 ? 2.5 : 1);
        var r = i === 0 ? D.DEVOURER.SEG_R * 1.4 : (i === n - 1 ? D.DEVOURER.SEG_R * 0.78 : D.DEVOURER.SEG_R);
        var e = {
          isWorm: true,
          type: 'worm',
          x: U.clamp(cx, 20, D.MAP_W - 20), y: U.clamp(cy, 20, D.MAP_H - 20),
          hp: hp, maxHp: hp,
          r: r, speed: 0, dmg: 0,
          color: '#c9a3c9', wave: D.LEVELS.WAVES, level: level,
          dead: false, hitT: 0,
          elite: false, boss: false,
          coin: 12, gem: 2,
          atkT: 0, shootT: 0, vx: 0, vy: 0, wobT: Math.random() * 10,
          stunT: 0, slowT: 0, orbT: 0, kbX: 0, kbY: 0,
          freezeT: 0, chillT: 0, chillSlow: 0.4, chillAspd: 0.2,
          burnT: 0, burnN: 0, burnDps: 0, burnFx: 0
        };
        G.Enemy.list.push(e);
        segs.push(e);
        dir += 0.06;                            // 每节转向，形成弧（弧径 ≈667px，整体盘在图内）
        cx += Math.cos(dir) * spacing;
        cy += Math.sin(dir) * spacing;      }
      Devourer.worms.push(Devourer.makeWorm(segs, level, spacing));
      if (G.P.playBgm) G.P.playBgm('Music/世界吞噬者.mp3', 0.6);
    },

    makeWorm: function (segs, level, spacing) {
      return {
        segs: segs, level: level, spacing: spacing,
        dashCd: U.rand(4, 7), dashT: 0, dashing: 0, dashDir: null, dashHit: false,
        spitT: U.rand(1.2, 2.6)
      };
    },

    // ============ 体节被击杀 → 分裂 ============
    onSegDead: function (e) {
      for (var wi = Devourer.worms.length - 1; wi >= 0; wi--) {
        var w = Devourer.worms[wi];
        var idx = w.segs.indexOf(e);
        if (idx < 0) continue;
        var segs = w.segs.slice();
        segs.splice(idx, 1);
        Devourer.worms.splice(wi, 1);
        // 断成两截，每截都是一条独立蠕虫（各自有头有尾；单节也算一只）
        var before = segs.slice(0, idx);
        var after = segs.slice(idx);
        G.FX.burst(e.x, e.y, 10, '#8a5f8a', 150, 0.5, 4);
        if (before.length) Devourer.worms.push(Devourer.makeWorm(before, w.level, w.spacing));
        if (after.length) Devourer.worms.push(Devourer.makeWorm(after, w.level, w.spacing));
        var alive = 0;
        for (var k = 0; k < Devourer.worms.length; k++) alive += Devourer.worms[k].segs.length;
        if (alive === 0) Devourer.onDefeated(w.level);
        return;
      }
    },

    onDefeated: function (level) {
      Devourer.active = false;
      if (G.P.stopBgm) G.P.stopBgm();
      G.Audio.play('boss');
      G.Camera.shake(10, 0.8);
      var pl = G.Player;
      G.FX.text(pl.x, pl.y - 46, '世界吞噬者 已被击败！', '#ffd700', 20);
      var game = G.game;
      if (game) {
        var bonus = 300 + 150 * level;
        game.gold += bonus;
        game.showMsg('击杀奖励 +' + bonus + ' 金币', '#ffd700', 2.2);
      }
    },

    // ============ 每帧 ============
    update: function (dt, game) {
      if (!Devourer.active) {
        Devourer.updateFx(dt, game);
        return;
      }
      var pl = G.Player, b = game.base;
      var baseSpeed = pl.speed() * D.DEVOURER.SPEED_RATIO;

      for (var wi = Devourer.worms.length - 1; wi >= 0; wi--) {
        var w = Devourer.worms[wi];
        if (!w.segs.length) { Devourer.worms.splice(wi, 1); continue; }
        var head = w.segs[0];

        // 目标：优先玩家，其次基地
        var tx, ty, targetPlayer = false;
        if (!pl.dead && U.dist2(head.x, head.y, pl.x, pl.y) < 900 * 900) {
          tx = pl.x; ty = pl.y; targetPlayer = true;
        } else if (b && b.hp > 0) { tx = b.x; ty = b.y; }
        else { tx = pl.x; ty = pl.y; }

        // ---- 冲撞状态机 ----
        w.dashCd -= dt;
        if (w.dashCd <= 0 && !w.dashT && !w.dashing && targetPlayer && w.segs.length >= 3) {
          w.dashT = 0.85;                      // 蓄力（可走位躲避）
          w.dashAim = { x: pl.x, y: pl.y };
          G.FX.text(head.x, head.y - head.r - 18, '!', '#ff6b6b', 20);
        }
        var spd = baseSpeed;

        if (w.dashT > 0) {
          w.dashT -= dt;
          spd = baseSpeed * 0.25;
          if (w.dashT <= 0) {
            var da = U.angle(head.x, head.y, w.dashAim.x, w.dashAim.y);
            w.dashDir = { x: Math.cos(da), y: Math.sin(da) };
            w.dashing = 1.15;
            w.dashHit = false;
            G.Audio.play('boss');
            G.Camera.shake(4, 0.25);
          }
        }

        if (w.dashing > 0) {
          w.dashing -= dt;
          spd = pl.speed() * D.DEVOURER.DASH_SPEED_RATIO;   // 冲撞：玩家速度的 90%
          head.x += w.dashDir.x * spd * dt;
          head.y += w.dashDir.y * spd * dt;
          head.x = U.clamp(head.x, 10, D.MAP_W - 10);
          head.y = U.clamp(head.y, 10, D.MAP_H - 10);
          if (!w.dashHit && !pl.dead &&
              U.dist2(head.x, head.y, pl.x, pl.y) < (head.r + pl.r + 4) * (head.r + pl.r + 4)) {
            w.dashHit = true;
            pl.damage(D.DEVOURER.DASH_DMG, game);
            pl.applyWormDebuff();
            G.Camera.shake(7, 0.3);
            w.dashing = 0;
            w.dashCd = D.DEVOURER.DASH_CD;
          }
          if (w.dashing <= 0) w.dashCd = D.DEVOURER.DASH_CD;
          Devourer.followBody(w);
          continue;                            // 冲撞期间不射击
        }

        // ---- 普通移动（蛇形摆动）----
        var ang = U.angle(head.x, head.y, tx, ty) + Math.sin(Date.now() / 450 + wi * 1.7) * 0.55;
        head.x = U.clamp(head.x + Math.cos(ang) * spd * dt, 10, D.MAP_W - 10);
        head.y = U.clamp(head.y + Math.sin(ang) * spd * dt, 10, D.MAP_H - 10);
        Devourer.followBody(w);

        // ---- 魔唾液 ----
        w.spitT -= dt;
        if (w.spitT <= 0) {
          var headK = head.hp / head.maxHp;
          w.spitT = (headK < 0.4 ? D.DEVOURER.SPIT_T_LOW : D.DEVOURER.SPIT_T) * U.rand(0.85, 1.2);   // 头血低 → 射更频繁
          var seg;
          if (w.segs.length === 1 || Math.random() < 0.4) seg = head;
          else seg = w.segs[1 + Math.floor(Math.random() * (w.segs.length - 1))];
          var sa = U.angle(seg.x, seg.y, pl.x, pl.y) + U.rand(-0.16, 0.16);
          Devourer.spits.push({
            x: seg.x, y: seg.y,
            vx: Math.cos(sa) * 175, vy: Math.sin(sa) * 175,
            r: 7, t: 0, life: 3.2
          });
          G.Audio.play('shoot');
        }
      }

      Devourer.updateFx(dt, game);
      Devourer.touchDamage(dt, game);
    },

    // 身体逐节跟随前一节，保持固定间距（经典蠕虫跟随）
    followBody: function (w) {
      for (var i = 1; i < w.segs.length; i++) {
        var prev = w.segs[i - 1], cur = w.segs[i];
        var dx = prev.x - cur.x, dy = prev.y - cur.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > w.spacing) {
          var k = (d - w.spacing) / d;
          cur.x += dx * k;
          cur.y += dy * k;
        }
      }
    },

    // 唾液弹 / 酸液池 / 玩家弹丸拦截唾液
    updateFx: function (dt, game) {
      var pl = G.Player, i, j;
      for (i = Devourer.spits.length - 1; i >= 0; i--) {
        var s = Devourer.spits[i];
        s.t += dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        var dead = s.t >= s.life;
        if (!dead) {
          var projs = G.Proj.list;
          for (j = 0; j < projs.length; j++) {
            var pj = projs[j];
            if (!pj.friendly) continue;
            if (U.dist2(pj.x, pj.y, s.x, s.y) < (pj.size + s.r) * (pj.size + s.r)) {
              dead = true;
              G.FX.burst(s.x, s.y, 5, '#b6e34a', 90, 0.3, 3);
              break;
            }
          }
        }
        if (!dead && !pl.dead && U.dist2(pl.x, pl.y, s.x, s.y) < (pl.r + s.r) * (pl.r + s.r)) {
          pl.damage(D.DEVOURER.SPIT_DMG, game);
          pl.applyWormDebuff();
          dead = true;
        }
        if (dead) {
          Devourer.pools.push({ x: s.x, y: s.y, r: 20, t: 2.4, life: 2.4, tick: 0 });
          Devourer.spits.splice(i, 1);
        }
      }
      for (var k = Devourer.pools.length - 1; k >= 0; k--) {
        var p = Devourer.pools[k];
        p.t -= dt; p.tick += dt;
        if (!pl.dead && p.tick >= 0.6 &&
            U.dist2(pl.x, pl.y, p.x, p.y) < (pl.r + p.r) * (pl.r + p.r)) {
          p.tick = 0;
          pl.damage(D.DEVOURER.POOL_DMG, game);
        }
        if (p.t <= 0) Devourer.pools.splice(k, 1);
      }
    },

    // 碰到身体：5 伤（不触发减益）
    touchDamage: function (dt, game) {
      Devourer.touchCd -= dt;
      if (Devourer.touchCd > 0) return;
      var pl = G.Player;
      if (pl.dead) return;
      for (var wi = 0; wi < Devourer.worms.length; wi++) {
        var segs = Devourer.worms[wi].segs;
        for (var i = 0; i < segs.length; i++) {
          var s = segs[i];
          if (U.dist2(s.x, s.y, pl.x, pl.y) < (s.r + pl.r) * (s.r + pl.r)) {
            pl.damage(D.DEVOURER.TOUCH_DMG, game);
            Devourer.touchCd = 0.5;
            return;
          }
        }
      }
    },

    // 当前总血量（HUD 血条用）
    hpInfo: function () {
      var cur = 0, max = 0, worms = 0;
      for (var i = 0; i < Devourer.worms.length; i++) {
        var segs = Devourer.worms[i].segs;
        worms++;
        for (var j = 0; j < segs.length; j++) {
          cur += segs[j].hp;
          max += segs[j].maxHp;
        }
      }
      return { cur: cur, max: max, worms: worms };
    },

    // ============ 绘制 ============
    draw: function (ctx, ox, oy) {
      var t = Date.now() / 1000;
      var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
      var i, wi;

      // 酸液池（画在最底层）
      for (i = 0; i < Devourer.pools.length; i++) {
        var p = Devourer.pools[i];
        var a = Math.max(0, p.t / p.life);
        ctx.globalAlpha = (0.4 + 0.2 * Math.sin(t * 5)) * a * fa;
        ctx.fillStyle = '#7fae3f';
        ctx.beginPath();
        ctx.ellipse(p.x - ox, p.y - oy, p.r, p.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 体节（从尾到头，头压在最上面）
      for (wi = 0; wi < Devourer.worms.length; wi++) {
        var segs = Devourer.worms[wi].segs;
        for (i = segs.length - 1; i >= 0; i--) {
          var s = segs[i];
          var sx = s.x - ox, sy = s.y - oy;
          if (sx < -50 || sy < -50 || sx > G.P.screenW + 50 || sy > G.P.screenH + 50) continue;
          var isHead = i === 0;
          var isTail = i === segs.length - 1;
          var flash = s.hitT > 0;
          var r = s.r * (1 + Math.sin(t * 6 + i * 0.55) * 0.05);   // 蠕动起伏

          // 影子
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.beginPath();
          ctx.ellipse(sx, sy + s.r * 0.8, r * 0.9, r * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();

          // 身体（受击闪用淡白，避免高攻速下整条长期发白）
          ctx.fillStyle = flash ? '#ecdcec' : '#c9a3c9';
          ctx.strokeStyle = '#7d5678';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // 背脊暗纹（上缘一道深色，立体感）
          ctx.strokeStyle = 'rgba(93,55,90,0.5)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 0.62, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();

          // 绿斑（每节固定 2 个，位置随索引变化，对齐参考图）
          if (!isHead && !isTail) {
            ctx.fillStyle = flash ? '#e4eccb' : '#b9d24b';
            var o1 = (i * 37) % 10 / 10, o2 = (i * 61) % 10 / 10;
            ctx.beginPath();
            ctx.ellipse(sx + (o1 - 0.5) * r, sy + (o2 - 0.4) * r * 0.8, r * 0.16, r * 0.11, o1 * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(sx + (o2 - 0.5) * r * 0.8, sy + (o1 - 0.5) * r * 0.7, r * 0.12, r * 0.09, o2 * 3, 0, Math.PI * 2);
            ctx.fill();
          }

          if (isHead) Devourer.drawHead(ctx, sx, sy, segs, r, flash, t, fa, ox, oy);
          if (isTail && segs.length > 1) {
            // 尾尖
            var pv = segs[i - 1];
            var ta = Math.atan2(sy - (pv.y - oy), sx - (pv.x - ox));
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(ta);
            ctx.fillStyle = flash ? '#fff' : '#8a5f8a';
            ctx.beginPath();
            ctx.moveTo(r * 1.35, 0);
            ctx.lineTo(0, -r * 0.55);
            ctx.lineTo(0, r * 0.55);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // 冻结 / 寒霜（冰武器效果）
          if (s.freezeT > 0) {
            ctx.strokeStyle = 'rgba(170,235,255,0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx, sy, r + 3, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }

      // 魔唾液弹
      for (i = 0; i < Devourer.spits.length; i++) {
        var sp = Devourer.spits[i];
        var px = sp.x - ox, py = sp.y - oy;
        ctx.globalAlpha = 0.5 * fa;
        ctx.strokeStyle = '#b6e34a';
        ctx.lineWidth = sp.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(px - sp.vx * 0.05, py - sp.vy * 0.05);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.globalAlpha = fa;
        ctx.fillStyle = '#9dc93c';
        ctx.beginPath();
        ctx.arc(px, py, sp.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d7ef8a';
        ctx.beginPath();
        ctx.arc(px - sp.r * 0.25, py - sp.r * 0.25, sp.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    },

    // 头部：大眼 + 獠牙 + 角（朝向 = 远离第二节的行进方向）
    drawHead: function (ctx, sx, sy, segs, r, flash, t, fa, ox, oy) {
      var neck = segs.length > 1 ? segs[1] : null;
      var ang = neck ? Math.atan2(sy + oy - neck.y, sx + ox - neck.x) : 0;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      var body = flash ? '#ecdcec' : '#c9a3c9';
      var dark = flash ? '#ddd0dd' : '#4a2b47';
      var gold = flash ? '#ffeeaa' : '#d4b106';
      // 角（头顶两根，向后弯）
      ctx.fillStyle = gold;
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.15, sgn * r * 0.55);
        ctx.quadraticCurveTo(-r * 0.9, sgn * r * 1.05, -r * 1.25, sgn * r * 0.7);
        ctx.quadraticCurveTo(-r * 0.7, sgn * r * 0.72, -r * 0.3, sgn * r * 0.35);
        ctx.closePath();
        ctx.fill();
      }
      // 嘴（前端张开的一道深色裂口）
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(r * 0.62, 0, r * 0.34, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 獠牙（上下各两颗）
      ctx.fillStyle = gold;
      for (var k = 0; k < 2; k++) {
        for (var sgn2 = -1; sgn2 <= 1; sgn2 += 2) {
          var fx = r * (0.55 + k * 0.3);
          ctx.beginPath();
          ctx.moveTo(fx, sgn2 * r * 0.28);
          ctx.lineTo(fx + r * 0.22, sgn2 * r * (0.42 + k * 0.16));
          ctx.lineTo(fx + r * 0.34, sgn2 * r * 0.18);
          ctx.closePath();
          ctx.fill();
        }
      }
      // 大眼（一只，位于前部）
      ctx.fillStyle = '#f5f0e8';
      ctx.beginPath();
      ctx.arc(r * 0.1, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1020';
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(r * 0.26, -r * 0.08, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  G.Devourer = Devourer;
})();
