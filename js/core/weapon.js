// 武器系统：品质 / 星级 / 装备 / 合成 / 抽卡
// 品质 0..4 = 白、绿、蓝、紫、红；红色最高 5 星
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;

  var TIERS = [
    { key: 'white', name: '白', color: '#e8eef4', deep: '#8c95a6', glow: 'rgba(232,238,244,0.55)' },
    { key: 'green', name: '绿', color: '#6fe06f', deep: '#2f8f3f', glow: 'rgba(95,211,95,0.6)' },
    { key: 'blue', name: '蓝', color: '#5bb0ff', deep: '#1f5fa8', glow: 'rgba(74,163,255,0.65)' },
    { key: 'purple', name: '紫', color: '#c07cf0', deep: '#6b2f9c', glow: 'rgba(181,108,224,0.8)' },
    { key: 'red', name: '红', color: '#ff5a5a', deep: '#8e1010', glow: 'rgba(255,77,77,0.85)' }
  ];
  // 抽卡概率：白 80% / 绿 10% / 蓝 6% / 紫 3% / 红 1%
  var RATES = [0.80, 0.10, 0.06, 0.03, 0.01];

  // ★ 品质基线属性（白/绿/蓝/紫）。红色单独按星级成长，见 RED_BASE / RED_GROW
  //   atk/aspd/crit/critDmg/alldmg 都是比率；range 是倍率；pierceInc 可负（绿色穿透后衰减）
  var BASE_T = [
    { tier: 0, atk: 0.04, aspd: 0.04, crit: 0, critDmg: 0, range: 1, alldmg: 0,
      pierce: 0, pierceInc: 0 },
    { tier: 1, atk: 0.06, aspd: 0.06, crit: 0, critDmg: 0, range: 1, alldmg: 0,
      pierce: 1, pierceInc: -0.10 },
    { tier: 2, atk: 0.12, aspd: 0.12, crit: 0.08, critDmg: 0.15, range: 1, alldmg: 0,
      pierce: 2, pierceInc: 0.05,
      frostSplash: 0.30,        // 命中触发冰霜溅射：周围 30% 攻击力
      frostR: 72,
      freezeChance: 0.35, freezeDur: 0.8,
      chillSlow: 0.40, chillAspd: 0.20, chillDur: 2 },
    { tier: 3, atk: 0.18, aspd: 0.18, crit: 0.12, critDmg: 0.30, range: 1.15, alldmg: 0.40,
      pierce: 99, pierceInc: 0.12, pierceAll: true,
      ignoreArmor: 0.15,        // 折算为对带甲目标的额外穿透
      shadowSplit: 2, shadowSplitRatio: 0.60, shadowCd: 0.1 }
  ];

  // 红色 1★ 基线；每星：攻击 +30%、攻速 +5%、暴击率 +3%、暴伤 +10%
  var RED_BASE = {
    atk: 0.25, aspd: 0.22, crit: 0.15, critDmg: 0.40, range: 1.18, alldmg: 0.80,
    pierce: 99, pierceInc: 0.20, pierceAll: true,
    burstR: 150, burstRatio: 1.0,      // 炎爆
    burnStack: 3, burnDps: 0.25, burnDur: 3,
    ignoreFireRes: 0.25
  };

  var Weapon = {
    TIERS: TIERS,
    RATES: RATES,
    MAX_TIER: 4,
    MAX_STAR: 5,
    MERGE_NEED: 3,        // 三个同阶同星 → 高一阶
    RED_MERGE_NEED: 2,    // 两个同星红 → 升一星

    tierOf: function (w) { return TIERS[w && w.tier ? w.tier : 0]; },

    img: function (cls, tier) {
      return G.P.loadImage('assets/weapons/' + cls + '_' + TIERS[tier].key + '.png');
    },
    // 抠掉背景的武器本体（游戏里手持用）
    heldImg: function (cls, tier) {
      return G.P.loadImage('assets/weapons/' + cls + '_' + TIERS[tier].key + '_cut.png');
    },

    // 在角色身上画手持武器；h = 显示高度（px）
    // flip=true 时水平镜像（角色朝右时用，弓/箭方向才不会反）
    drawHeld: function (ctx, cx, cy, h, w, rot, flip) {
      if (!w) return false;
      var rec = Weapon.heldImg(w.cls, w.tier);
      if (!rec || !rec.ready || !rec.img) return false;
      var img = rec.img;
      var iw = img.width || h, ih = img.height || h;
      // 以长边归一化：竖图（弓）按高度、横图（炮/枪）按宽度缩放，显示面积一致
      var side = Math.max(iw, ih) || h;
      var scale = h / side;
      var dw = iw * scale, dh = ih * scale;
      ctx.save();
      ctx.translate(cx, cy);
      if (flip) ctx.scale(-1, 1);
      if (rot) ctx.rotate(rot);
      // 紫/红品质带一点光晕，跟着特效强度走
      if (w.tier >= 3) {
        var T = TIERS[w.tier];
        var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
        var pulse = 0.55 + 0.35 * Math.sin(Date.now() / 320);
        var rr = Math.max(dw, dh) * 0.62;
        var g = ctx.createRadialGradient(0, 0, 1, 0, 0, rr);
        g.addColorStop(0, T.glow);
        g.addColorStop(0.55, T.glow.replace(/[\d.]+\)$/, '0.22)'));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = pulse * (h < 36 ? 0.35 : 0.55) * fa;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      return true;
    },

    label: function (w) {
      if (!w) return '未装备';
      return TIERS[w.tier].name + ' ' + w.star + '★';
    },

    listOf: function (cls) {
      var out = [];
      var all = G.Meta.weapons || [];
      for (var i = 0; i < all.length; i++) {
        if (!cls || all[i].cls === cls) out.push(all[i]);
      }
      out.sort(function (a, b) {
        return (b.tier - a.tier) || (b.star - a.star) || (a.uid - b.uid);
      });
      return out;
    },

    find: function (uid) {
      var all = G.Meta.weapons || [];
      for (var i = 0; i < all.length; i++) if (all[i].uid === uid) return all[i];
      return null;
    },

    equipped: function (cls) {
      var uid = (G.Meta.equip || {})[cls];
      if (!uid) return null;
      var w = Weapon.find(uid);
      return (w && w.cls === cls) ? w : null;
    },

    equip: function (w) {
      if (!w) return false;
      G.Meta.equip[w.cls] = w.uid;
      G.Meta.save();
      return true;
    },
    unequip: function (cls) {
      G.Meta.equip[cls] = 0;
      G.Meta.save();
    },

    add: function (cls, tier, star) {
      var w = { uid: G.Meta.nextWuid++, cls: cls, tier: tier, star: star || 1 };
      G.Meta.weapons.push(w);
      return w;
    },

    remove: function (w) {
      var all = G.Meta.weapons;
      var i = all.indexOf(w);
      if (i < 0) return;
      all.splice(i, 1);
      if (G.Meta.equip[w.cls] === w.uid) G.Meta.equip[w.cls] = 0;
    },

    // ★ 武器的完整战斗属性（红色按星级成长）。返回 null = 没有武器
    stats: function (w) {
      if (!w) return null;
      var star = w.star || 1;
      var g = star - 1;
      var k;
      if (w.tier < 4) {
        var b = BASE_T[w.tier] || BASE_T[0];
        var o = {};
        for (k in b) o[k] = b[k];
        o.tier = w.tier; o.star = star;
        return o;
      }
      var atk = RED_BASE.atk * (1 + 0.30 * g);
      if (star >= 3) atk += 0.40;                 // 3★ 起基础攻击额外 +40%
      return {
        tier: 4, star: star,
        atk: atk,
        aspd: RED_BASE.aspd + 0.05 * g,
        crit: RED_BASE.crit + 0.03 * g,
        critDmg: RED_BASE.critDmg + 0.10 * g,
        range: RED_BASE.range,
        alldmg: RED_BASE.alldmg,
        pierce: 99, pierceInc: 0.20, pierceAll: true,
        ignoreArmor: RED_BASE.ignoreFireRes,
        // —— 炎爆 / 灼烧 ——
        burstR: star >= 2 ? 220 : RED_BASE.burstR,
        burstRatio: 1.0,
        burnStack: star >= 2 ? 5 : 3,
        burnDps: star >= 2 ? 0.35 : 0.25,
        burnDur: RED_BASE.burnDur,
        killHeal: star >= 2 ? 8 : 0,               // 击杀灼烧目标回血
        trail: star >= 3,                          // 火焰轨迹
        vuln: star >= 3 ? 0.15 : 0,                // 灼烧目标全局易伤
        doubleBurst: star >= 4,                    // 暴击双重炎爆
        burstBonus: star >= 4 ? 1.0 : 0,           // 暴击时炎爆伤害 +100%
        totemChance: star >= 4 ? 0.30 : 0,         // 火焰图腾
        rainEvery: star >= 5 ? 3 : 0,              // 每 3 杀 → 焚天箭雨
        dragon: star >= 5,                         // 龙炎怒心
        burnSpread: star >= 5                      // 灼烧传染
      };
    },
    // 当前装备武器的战斗属性（没有就 null）
    statsOf: function (cls) { return Weapon.stats(Weapon.equipped(cls)); },

    // 装备加成：每阶 +6%，每星 +4%（白1★ = 1.00，红5★ = 1.40）
    bonus: function (w) {
      if (!w) return 1;
      return 1 + 0.06 * w.tier + 0.04 * (w.star - 1);
    },
    attackBonus: function (cls) { return Weapon.bonus(Weapon.equipped(cls)); },

    // 可合成的组数（给 UI 显示提示用）
    mergeable: function () {
      var cnt = 0;
      for (var t = 0; t <= Weapon.MAX_TIER; t++) {
        var need = (t === Weapon.MAX_TIER) ? Weapon.RED_MERGE_NEED : Weapon.MERGE_NEED;
        var groups = {};
        var all = G.Meta.weapons || [];
        for (var i = 0; i < all.length; i++) {
          var w = all[i];
          if (w.tier !== t) continue;
          if (t === Weapon.MAX_TIER && w.star >= Weapon.MAX_STAR) continue;
          var k = w.cls + '|' + w.star;
          groups[k] = (groups[k] || 0) + 1;
        }
        for (var k2 in groups) cnt += Math.floor(groups[k2] / need);
      }
      return cnt;
    },

    // 一键合成：白→绿→蓝→紫→红，红再 2 合 1 升星；返回这次的结果列表
    mergeAll: function () {
      var results = [];
      var guard = 0;
      while (guard++ < 400) {
        var did = false;
        for (var t = 0; t <= Weapon.MAX_TIER && !did; t++) {
          var need = (t === Weapon.MAX_TIER) ? Weapon.RED_MERGE_NEED : Weapon.MERGE_NEED;
          var groups = {};
          var all = G.Meta.weapons;
          for (var i = 0; i < all.length; i++) {
            var w = all[i];
            if (w.tier !== t) continue;
            if (t === Weapon.MAX_TIER && w.star >= Weapon.MAX_STAR) continue;
            var k = w.cls + '|' + w.star;
            (groups[k] || (groups[k] = [])).push(w);
          }
          for (var key in groups) {
            var g = groups[key];
            if (g.length < need) continue;
            var base = g[0];
            for (var u = 0; u < need; u++) Weapon.remove(g[u]);
            var made = Weapon.add(base.cls, t === Weapon.MAX_TIER ? base.tier : t + 1,
              t === Weapon.MAX_TIER ? base.star + 1 : 1);
            results.push({
              cls: base.cls,
              fromTier: t, fromStar: base.star,
              toTier: made.tier, toStar: made.star
            });
            did = true;
            break;
          }
        }
        if (!did) break;
      }
      if (results.length) G.Meta.save();
      return results;
    },

    rollTier: function () {
      var r = Math.random(), acc = 0;
      for (var i = 0; i < RATES.length; i++) {
        acc += RATES[i];
        if (r < acc) return i;
      }
      return 0;
    },

    // 抽 n 次（直接入库），返回抽到的武器数组
    draw: function (n, cls) {
      var out = [];
      cls = cls || 'archer';
      for (var i = 0; i < n; i++) out.push(Weapon.add(cls, Weapon.rollTier(), 1));
      G.Meta.save();
      return out;
    }
  };

  G.Weapon = Weapon;
})();
