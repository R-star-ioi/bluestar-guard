// 局外成长（Meta）：主角选择、升级金币、英雄解锁与升级
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  // 存档兼容：旧版只有一条 {level, boxes, claimed}，按它记录的关卡归档进新结构
  function normalizeChests(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    function put(lv, rec) {
      lv = parseInt(lv, 10);
      if (!lv || lv < 1) return;
      var boxes = [false, false, false], claimed = [false, false, false];
      for (var i = 0; i < 3; i++) {
        boxes[i] = !!(rec && rec.boxes && rec.boxes[i]);
        claimed[i] = boxes[i] && !!(rec && rec.claimed && rec.claimed[i]);
      }
      out[lv] = { boxes: boxes, claimed: claimed };
    }
    if (raw.level !== undefined) {
      put(raw.level, raw);                       // 旧格式：单条记录
    } else {
      for (var k in raw) {
        if (raw.hasOwnProperty(k) && isFinite(k)) put(k, raw[k]);
      }
    }
    return out;
  }

  var Meta = {
    gold: 0,                          // 升级金币（局外钱包）
    unlocked: { archer: true },
    levels: { archer: 1 },
    selected: 'archer',
    diamonds: 0,                      // 钻石（通关宝箱奖励）
    fx: 1,                            // 特效强度 0~1（粒子/光圈/震屏，设置里可调）
    maxLevel: 1,                      // 最高已解锁关卡
    selectedLevel: 1,                 // 当前选中关卡
    // 每关独立的宝箱记录：{ '关卡号': { boxes:[bool×3], claimed:[bool×3] } }
    // boxes[i]=该档是否达成；claimed[i]=该档是否已领取。重打同一关只增不减，已领取不复活。
    chests: {},
    weapons: [],                      // 武器背包 [{ uid, cls, tier, star }]
    equip: {},                        // 各职业已装备武器：{ archer: uid }
    nextWuid: 1,                      // 武器自增 id
    redeemed: {},                     // 已使用的兑换码 { lxsw666: true }

    load: function () {
      var m = G.P.storage.get('lx_meta', null);
      if (m) {
        Meta.gold = m.gold || 0;
        Meta.unlocked = m.unlocked || { archer: true };
        Meta.levels = m.levels || { archer: 1 };
        Meta.selected = (m.selected && Meta.unlocked[m.selected]) ? m.selected : 'archer';
        Meta.diamonds = m.diamonds || 0;
        Meta.fx = (typeof m.fx === 'number' && isFinite(m.fx)) ? Math.max(0, Math.min(1, m.fx)) : 1;
        Meta.maxLevel = m.maxLevel || 1;
        Meta.selectedLevel = m.selectedLevel || 1;
        Meta.chests = normalizeChests(m.chests);
        Meta.weapons = (m.weapons && m.weapons.length !== undefined) ? m.weapons : [];
        Meta.equip = m.equip || {};
        Meta.nextWuid = m.nextWuid || 1;
        Meta.redeemed = m.redeemed || {};
        // 兼容旧存档：缺 uid 的武器补一个，nextWuid 保证不撞号
        for (var wi = 0; wi < Meta.weapons.length; wi++) {
          var wv = Meta.weapons[wi];
          if (!wv.uid) wv.uid = Meta.nextWuid++;
          if (wv.uid >= Meta.nextWuid) Meta.nextWuid = wv.uid + 1;
        }
      }
    },
    save: function () {
      G.P.storage.set('lx_meta', {
        gold: Meta.gold, unlocked: Meta.unlocked,
        levels: Meta.levels, selected: Meta.selected,
        diamonds: Meta.diamonds, maxLevel: Meta.maxLevel,
        fx: Meta.fx,
        weapons: Meta.weapons, equip: Meta.equip, nextWuid: Meta.nextWuid,
        redeemed: Meta.redeemed,
        selectedLevel: Meta.selectedLevel, chests: Meta.chests
      });
    },

    addDiamonds: function (n) {
      Meta.diamonds += n;
      Meta.save();
    },

    // 兑换码：返回 { ok, amount, reason: empty|invalid|used|ingame }；dev 码可重复使用
    redeem: function (code) {
      code = String(code || '').trim().toLowerCase();
      if (!code) return { ok: false, reason: 'empty' };
      var table = (D && D.CODES) || {};
      var c = table[code];
      if (!c) return { ok: false, reason: 'invalid' };
      // 开发者码：不占一次性名额，仅在局内（暂停中）生效
      if (c.dev) {
        var g = G.game;
        var inRun = g && (g.state === 'paused' || (g.state === 'settings' && g.settingsBack === 'paused'));
        if (!inRun) return { ok: false, reason: 'ingame' };
        g.devJumpWave();
        return { ok: true, dev: true, msg: c.note || '开发者指令已执行' };
      }
      if (Meta.redeemed[code]) return { ok: false, reason: 'used' };
      var amt = c.diamonds || 0;
      Meta.redeemed[code] = true;
      Meta.diamonds += amt;
      Meta.save();
      return { ok: true, amount: amt };
    },

    // 通关后把宝箱放回主界面待领（每关各一份，互不影响）
    setChests: function (level, boxes) {
      var rec = Meta.chests[level];
      if (!rec) {
        rec = { boxes: [false, false, false], claimed: [false, false, false] };
        Meta.chests[level] = rec;
      }
      // 重打本关只增不减：这次打得差不会取消已达成档位，已领取的也不会复活
      for (var i = 0; i < 3; i++) if (boxes[i]) rec.boxes[i] = true;
      Meta.save();
    },
    // 某关的宝箱记录（没通关过返回 null）
    chestOf: function (level) {
      return Meta.chests[level] || null;
    },
    // 某关还没领的宝箱数量
    pendingChests: function (level) {
      var c = Meta.chests[level];
      if (!c) return 0;
      var n = 0;
      for (var i = 0; i < 3; i++) if (c.boxes[i] && !c.claimed[i]) n++;
      return n;
    },
    // 领取某关的某个宝箱，返回钻石（0=不可领）
    claimChest: function (level, i) {
      var c = Meta.chests[level];
      if (!c || !c.boxes[i] || c.claimed[i]) return 0;
      c.claimed[i] = true;
      var amt = D.LEVELS.BOX_REWARDS[i];
      Meta.diamonds += amt;
      Meta.save();
      return amt;
    },
    // 通关后解锁下一关
    unlockLevel: function (lv) {
      if (lv > Meta.maxLevel) {
        Meta.maxLevel = Math.min(lv, D.LEVELS.TOTAL);
        Meta.save();
      }
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
      var ws = (G.Weapon ? G.Weapon.statsOf(cls) : null);   // 已装备武器的战斗属性
      var wAtk = ws ? (1 + ws.atk) * (1 + (ws.alldmg || 0)) : 1;
      var wAspd = ws ? (1 + ws.aspd) : 1;
      var wRange = ws ? (ws.range || 1) : 1;
      var st = {
        cls: cls, name: p.name, color: p.color, desc: p.desc, level: lv,
        maxHp: Math.round(p.hp * (1 + B.hp * k)),
        dmg: p.dmg * (1 + B.dmg * k) * wAtk,
        interval: p.interval * (1 - B.aspeed * k) / wAspd,
        speed: p.speed * (1 + B.speed * k),
        range: p.range * wRange, bulletSpeed: p.bulletSpeed || 0,
        splash: p.splash || 0, melee: !!p.melee,
        regen: p.regenBase ? p.regenBase + p.regenPerLv * k : 0,
        weapon: ws,
        wcrit: ws ? (ws.crit || 0) : 0,
        wcritDmg: ws ? (ws.critDmg || 0) : 0
      };
      return st;
    }
  };
  G.Meta = Meta;
})();
