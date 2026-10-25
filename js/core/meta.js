// 局外成长（Meta）：主角选择、升级金币、英雄解锁与升级
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Meta = {
    gold: 0,                          // 升级金币（局外钱包）
    unlocked: { archer: true },
    levels: { archer: 1 },
    selected: 'archer',

    load: function () {
      var m = G.P.storage.get('lx_meta', null);
      if (m) {
        Meta.gold = m.gold || 0;
        Meta.unlocked = m.unlocked || { archer: true };
        Meta.levels = m.levels || { archer: 1 };
        Meta.selected = (m.selected && Meta.unlocked[m.selected]) ? m.selected : 'archer';
      }
    },
    save: function () {
      G.P.storage.set('lx_meta', {
        gold: Meta.gold, unlocked: Meta.unlocked,
        levels: Meta.levels, selected: Meta.selected
      });
    },

    // 对局金币 → 升级金币（1:1 即时累积）
    earn: function (n) {
      Meta.gold += n;
    },

    unlockCost: function (cls) { return D.META.UNLOCK[cls]; },
    upgradeCost: function (cls) {
      var lv = Meta.levels[cls] || 1;
      return Math.round(D.META.UPG_BASE * Math.pow(D.META.UPG_GROWTH, lv - 1));
    },
    levelOf: function (cls) { return Meta.levels[cls] || 1; },

    unlock: function (cls) {
      if (Meta.unlocked[cls]) return false;
      var c = D.META.UNLOCK[cls];
      if (Meta.gold < c) { G.Audio.play('error'); return false; }
      Meta.gold -= c;
      Meta.unlocked[cls] = true;
      Meta.levels[cls] = 1;
      Meta.selected = cls;
      Meta.save();
      G.Audio.play('recruit');
      return true;
    },
    upgrade: function (cls) {
      var lv = Meta.levelOf(cls);
      if (lv >= D.META.MAX_LV) { G.Audio.play('error'); return false; }
      var c = Meta.upgradeCost(cls);
      if (Meta.gold < c) { G.Audio.play('error'); return false; }
      Meta.gold -= c;
      Meta.levels[cls] = lv + 1;
      Meta.save();
      G.Audio.play('upgrade');
      return true;
    },
    select: function (cls) {
      if (!Meta.unlocked[cls]) return false;
      Meta.selected = cls;
      Meta.save();
      G.Audio.play('button');
      return true;
    },

    // 主角总属性 = 基础属性 × 升级加成
    protoStats: function (cls) {
      var p = D.PROTOS[cls];
      var lv = Meta.levelOf(cls);
      var k = lv - 1;
      var B = D.META.BONUS;
      var st = {
        cls: cls, name: p.name, color: p.color, desc: p.desc, level: lv,
        maxHp: Math.round(p.hp * (1 + B.hp * k)),
        dmg: p.dmg * (1 + B.dmg * k),
        interval: p.interval * (1 - B.aspeed * k),
        speed: p.speed * (1 + B.speed * k),
        range: p.range, bulletSpeed: p.bulletSpeed || 0,
        splash: p.splash || 0, melee: !!p.melee,
        regen: p.regenBase ? p.regenBase + p.regenPerLv * k : 0
      };
      return st;
    }
  };
  G.Meta = Meta;
})();
