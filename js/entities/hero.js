// 英雄（塔防单位）：招募 / 合成 / 直升 / 出售 / 全局强化，围绕基地自动布阵
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;

  var Hero = {
    list: [],          // 上阵英雄 {id, cls, lv, slotX, slotY(相对基地偏移), coolT, fxT}
    recruitCount: 0,   // 累计招募次数（抬价用）
    nextId: 1,

    reset: function () {
      Hero.list.length = 0;
      Hero.recruitCount = 0;
      Hero.nextId = 1;
    },

    // ---- 属性计算 ----
    dmgMult: function () { return 1 + G.Player.stats.allydmg * 0.15; },
    spdMult: function () { return Math.pow(0.9, G.Player.stats.allyspd); },

    statOf: function (h) {
      var c = D.HEROES[h.cls];
      var lv = h.lv - 1;
      var st = { dmg: 0, heal: 0, interval: 0, range: c.range, splash: c.splash || 0, bulletSpeed: c.bulletSpeed || 0 };
      if (c.heal) {
        st.heal = c.heal * Math.pow(c.healGrowth, lv);
      } else {
        st.dmg = c.dmg * Math.pow(D.HERO.DMG_GROWTH, lv);
      }
      st.interval = c.interval * Math.pow(c.intervalGrowth, lv);
      return st;
    },

    // ---- 招募 ----
    recruitCost: function () { return D.HERO.RECRUIT_BASE + D.HERO.RECRUIT_STEP * Hero.recruitCount; },
    canRecruit: function () { return Hero.list.length < D.HERO.MAX_COUNT; },

    recruit: function (game) {
      if (!Hero.canRecruit()) {
        G.FX.text(G.game.base.x, G.game.base.y - 70, '上阵已满(9)', '#ff9f43', 14);
        G.Audio.play('error');
        return false;
      }
      var cost = Hero.recruitCost();
      if (game.gold < cost) {
        G.FX.text(G.game.base.x, G.game.base.y - 70, '金币不足', '#ff6b6b', 14);
        G.Audio.play('error');
        return false;
      }
      game.gold -= cost;
      Hero.recruitCount++;
      // 随机职业（稀有职业权重低）
      var cls = U.weightedPick(Object.keys(D.HEROES), function (k) { return D.HEROES[k].rare ? 0.45 : 1; });
      Hero.add(cls, 1, game);
      G.Audio.play('recruit');
      return true;
    },

    add: function (cls, lv, game) {
      var b = game.base;
      var pos = Hero.findSlot(b);
      var h = { id: Hero.nextId++, cls: cls, lv: lv, x: b.x + pos.x, y: b.y + pos.y, coolT: U.rand(0, 0.5), fxT: 0 };
      Hero.list.push(h);
      G.FX.ring(h.x, h.y, D.HEROES[cls].color, 34, 0.4, 3);
      return h;
    },

    findSlot: function (b) {
      var n = Hero.list.length;
      var R = D.HERO.SLOT_DIST;
      // 环形布位：第0个在上方，依次绕圈
      if (n === 0) return { x: 0, y: -R * 0.6 };
      var ring = 1, cap = 8;
      var used = n, idx = n;
      if (n >= 1 && n < 4) { ring = 1; idx = n; cap = 3; }
      else if (n >= 4 && n < 9) { ring = 2; idx = n - 4; cap = 5; R *= 1.0; }
      else { ring = 2; idx = n - 4; cap = 5; R *= 1.0; }
      var ang = -Math.PI / 2 + (idx / cap) * Math.PI * 2;
      return { x: Math.cos(ang) * R * (ring === 1 ? 0.75 : 1.05), y: Math.sin(ang) * R * (ring === 1 ? 0.75 : 1.05) };
    },

    // ---- 合成：同类同级 → lv+1 ----
    canMerge: function (a, b) {
      return a !== b && a.cls === b.cls && a.lv === b.lv && a.lv < D.HERO.MAX_LEVEL;
    },
    merge: function (a, b, game) {
      b.lv += 1;
      var i = Hero.list.indexOf(a);
      if (i >= 0) Hero.list.splice(i, 1);
      // 被合并者空出的位置重排
      Hero.relayout(game);
      G.Audio.play('merge');
      G.FX.ring(b.x, b.y, '#ffd700', 60, 0.5, 4);
      G.FX.burst(b.x, b.y, 16, '#ffd700', 170, 0.6, 4);
      G.FX.text(b.x, b.y - 34, D.HEROES[b.cls].name + ' Lv' + b.lv + '!', '#ffd700', 16);
      if (b.lv >= D.HERO.MAX_LEVEL) {
        G.FX.text(b.x, b.y - 54, 'MAX!', '#ff9f43', 14);
      }
    },

    relayout: function (game) {
      var b = game.base;
      for (var j = 0; j < Hero.list.length; j++) {
        var pos = Hero.slotByIndex(j);
        Hero.list[j].x = b.x + pos.x;
        Hero.list[j].y = b.y + pos.y;
      }
    },

    slotByIndex: function (i) {
      var R = D.HERO.SLOT_DIST;
      if (i === 0) return { x: 0, y: -R * 0.6 };
      if (i < 4) {
        var a1 = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        return { x: Math.cos(a1) * R * 0.75, y: Math.sin(a1) * R * 0.75 };
      }
      var a2 = -Math.PI / 2 + ((i - 4) / 5) * Math.PI * 2;
      return { x: Math.cos(a2) * R * 1.05, y: Math.sin(a2) * R * 1.05 };
    },

    // ---- 直升 / 出售 ----
    upgradeCost: function (h) {
      return Math.round(D.HERO.UPGRADE_BASE * Math.pow(D.HERO.UPGRADE_GROWTH, h.lv - 1));
    },
    upgrade: function (h, game) {
      if (h.lv >= D.HERO.MAX_LEVEL) { G.Audio.play('error'); return false; }
      var cost = Hero.upgradeCost(h);
      if (game.gold < cost) {
        G.FX.text(h.x, h.y - 34, '金币不足', '#ff6b6b', 13);
        G.Audio.play('error');
        return false;
      }
      game.gold -= cost;
      h.lv++;
      G.Audio.play('upgrade');
      G.FX.ring(h.x, h.y, '#7ef9ff', 44, 0.4, 3);
      G.FX.text(h.x, h.y - 30, 'Lv' + h.lv, '#7ef9ff', 15);
      return true;
    },
    sellValue: function (h) { return D.HERO.SELL_VALUE * h.lv; },
    sell: function (h, game) {
      var i = Hero.list.indexOf(h);
      if (i >= 0) Hero.list.splice(i, 1);
      game.gold += Hero.sellValue(h);
      Hero.relayout(game);
      G.Audio.play('coin');
      G.FX.burst(h.x, h.y, 10, '#ffd700', 140, 0.5, 4);
      G.FX.text(h.x, h.y - 26, '+' + Hero.sellValue(h) + '金', '#ffd700', 14);
    },

    // ---- 更新（攻击/治疗） ----
    update: function (dt, game) {
      var b = game.base;
      for (var i = 0; i < Hero.list.length; i++) {
        var h = Hero.list[i];
        var c = D.HEROES[h.cls];
        h.fxT += dt;
        h.coolT -= dt;
        if (h.coolT > 0) continue;
        var st = Hero.statOf(h);
        var interval = st.interval / Hero.spdMult();

        if (c.heal) {
          // 牧师：治疗主角与基地（取受伤更重的目标表现）
          h.coolT = interval;
          var healed = false;
          var pl = G.Player;
          if (!pl.dead && pl.hp < pl.maxHp) {
            pl.heal(st.heal);
            healed = true;
            G.FX.ring(pl.x, pl.y, '#7bed9f', 26, 0.35, 2);
          }
          if (b.hp < b.maxHp && b.hp > 0) {
            game.healBase(st.heal);
            healed = true;
            G.FX.ring(b.x, b.y, '#7bed9f', 46, 0.4, 3);
          }
          if (healed) {
            G.Audio.play('heal');
            G.FX.ring(h.x, h.y, c.color, 30, 0.35, 2.5);
          } else {
            h.coolT = 0.4; // 满血时空转
          }
        } else {
          // 攻击英雄
          var target = game.findNearestEnemy(h.x, h.y, c.range);
          if (!target) { h.coolT = 0.08; continue; }
          h.coolT = interval;
          var ang = U.angle(h.x, h.y, target.x, target.y);
          var dmg = st.dmg * Hero.dmgMult();
          if (h.cls === 'sword') {
            // 近战环斩
            G.FX.ring(h.x, h.y, c.color, c.range, 0.22, 3);
            var near = game.grid.query(h.x, h.y, c.range + 30);
            var seen = {};
            for (var k = 0; k < near.length; k++) {
              var e = near[k];
              if (e.dead || seen[e.x + '_' + e.y]) continue;
              seen[e.x + '_' + e.y] = 1;
              if (U.dist2(h.x, h.y, e.x, e.y) <= (c.range + e.r) * (c.range + e.r)) {
                game.damageEnemy(e, dmg, h.x, h.y, false);
              }
            }
            G.Audio.play('hit');
          } else {
            G.Proj.spawn({
              x: h.x, y: h.y, ang: ang, speed: st.bulletSpeed || 400,
              dmg: dmg, size: h.cls === 'cannon' ? 8 : (h.cls === 'mage' ? 6 : 4),
              color: c.color, friendly: true,
              splash: st.splash, life: (c.range + 60) / (st.bulletSpeed || 400),
              kind: h.cls === 'cannon' ? 'cannonball' : (h.cls === 'mage' ? 'fireball' : 'bullet')
            });
            G.Audio.play(h.cls === 'archer' ? 'arrow' : 'shoot');
          }
        }
      }
    },

    // exclude：拖拽合成时要把被拖的那个排除掉，否则它正好停在指针下，永远命中自己
    hitTest: function (x, y, exclude) {
      var best = null, bestD = 1e9;
      for (var i = 0; i < Hero.list.length; i++) {
        var h = Hero.list[i];
        if (h === exclude) continue;
        var d = U.dist2(x, y, h.x, h.y);
        if (d < D.HERO.DRAG_R * D.HERO.DRAG_R && d < bestD) {
          best = h; bestD = d;
        }
      }
      return best;
    },

    draw: function (ctx, ox, oy) {
      var t = Date.now() / 1000;
      for (var i = 0; i < Hero.list.length; i++) {
        var h = Hero.list[i];
        var c = D.HEROES[h.cls];
        var sx = h.x - ox, sy = h.y - oy;
        var bob = Math.sin(t * 3 + i * 1.7) * 1.5;

        // 攻击范围淡圈（选中拖拽时才显眼，平时很淡）
        // 影子
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 13, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 已装备武器：握在右手边（画在身体前面，握把压住身体边缘）
        // 底座
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy + 8, 15, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // 职业图标（矢量绘制，不依赖 emoji 字体）
        Hero.drawIcon(ctx, h.cls, sx, sy + bob - 2);

        // 已装备武器：挎在右手边，箭头朝外（镜像）
        if (G.Weapon) {
          var eqw = G.Weapon.equipped(h.cls);
          if (eqw) G.Weapon.drawHeld(ctx, sx + 21, sy + bob + 2, 36, eqw, 0.25, true);
        }

        // 等级徽章
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(sx + 13, sy - 14 + bob, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(String(h.lv), sx + 13, sy - 10.5 + bob);
      }
    },

    // 职业矢量图标（中心 x,y，尺寸约 20px）
    drawIcon: function (ctx, cls, x, y, scale) {
      ctx.save();
      ctx.translate(x, y);
      if (scale) ctx.scale(scale, scale);
      ctx.lineCap = 'round';
      switch (cls) {
        case 'sword': // 剑：斜刃+护手
          ctx.strokeStyle = '#e8eef4';
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(6, -6); ctx.stroke();
          ctx.strokeStyle = '#c9a227';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-4.5, -1.5); ctx.lineTo(0.5, 3.5); ctx.stroke();
          ctx.strokeStyle = '#8d6e2f';
          ctx.beginPath(); ctx.moveTo(-7.5, 7.5); ctx.lineTo(-5, 5); ctx.stroke();
          break;
        case 'archer': // 弓：弓臂+弦+箭
          ctx.strokeStyle = '#d9b26a';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(-1, 0, 8, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(5, -7.2); ctx.lineTo(5, 7.2); ctx.stroke();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(8, 0); ctx.stroke();
          break;
        case 'mage': // 法球：发光宝珠
          var g = ctx.createRadialGradient(0, -1, 1, 0, -1, 7);
          g.addColorStop(0, '#e8d5ff');
          g.addColorStop(1, '#8e44ad');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, -1, 6.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(232,213,255,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, -1, 8.5, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'cannon': // 炮：炮管+火花
          ctx.fillStyle = '#3a3f4a';
          ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#20242c';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ffd166';
          ctx.beginPath(); ctx.arc(0, 1, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ff9f43';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(7, -8); ctx.stroke();
          break;
        case 'priest': // 十字
          ctx.fillStyle = '#fff8dc';
          ctx.fillRect(-1.8, -8, 3.6, 16);
          ctx.fillRect(-5.5, -3.5, 11, 3.6);
          break;
      }
      ctx.restore();
    },

    // 拖拽中的范围预览
    drawRange: function (ctx, ox, oy, h, color) {
      var c = D.HEROES[h.cls];
      if (!c.range || c.range > 900) return;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(h.x - ox, h.y - oy, c.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  };
  G.Hero = Hero;
})();
