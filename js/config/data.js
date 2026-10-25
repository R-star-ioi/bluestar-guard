// ★ 全部数值配置表 —— 改平衡只改这里
var G = require('../boot.js');
(function () {
  var D = {};

  // 地图与相机
  D.MAP_W = 2200;
  D.MAP_H = 2200;

  // 玩家
  D.PLAYER = {
    HP: 100,
    SPEED: 190,          // px/s
    RADIUS: 14,
    ATTACK: 10,          // 基础攻击力
    INTERVAL: 0.5,       // 攻击间隔 s
    RANGE: 300,          // 射程
    PICK_RANGE: 70,      // 拾取范围
    REGEN: 0             // 每秒回血
  };

  // 基地水晶（塔防核心）
  D.BASE = {
    HP: 800,
    RADIUS: 34
  };

  // 敌人基础属性（会被波次成长系数放大）
  D.ENEMIES = {
    slime: { hp: 22, speed: 62, dmg: 8, radius: 13, coin: 2, gem: 1, color: '#e74c3c', name: '史莱姆' },
    fast: { hp: 14, speed: 108, dmg: 6, radius: 11, coin: 3, gem: 1, color: '#ff7f50', name: '疾行虫' },
    tank: { hp: 95, speed: 36, dmg: 16, radius: 20, coin: 6, gem: 2, color: '#9b59b6', name: '装甲胖' },
    shooter: { hp: 34, speed: 50, dmg: 10, radius: 14, coin: 5, gem: 2, color: '#2ecc71', name: '毒液射手', shootRange: 240, shootInterval: 2.2, bulletSpeed: 170 }
  };
  D.ENEMY_BULLET_SPEED = 170;

  // 波次成长
  D.WAVE = {
    START_INTERVAL: 3,     // 波与波之间的间歇
    HP_GROWTH: 1.13,       // 每波 HP ×1.13
    DMG_GROWTH: 1.05,      // 每波伤害 ×1.05
    DMG_CAP: 3,            // 伤害成长上限倍数
    ELITE_FROM: 5,         // 精英出现起始波
    ELITE_CHANCE: 0.12,    // 精英概率
    BOSS_EVERY: 5,         // 每 5 波 Boss
    BUDGET_BASE: 10,       // 敌人预算：10 + 6波 + 波^1.5
    MAX_ALIVE: 60,         // 同屏敌人上限
    GOLD_GROWTH: 0.06,     // 敌人金币/经验产出每波 +6%（高波次产出提升）
    ATK_PER_WAVE: 0.04,    // 每清一波 主角攻击 +4%（局内成长）
    ATK_BOSS_BONUS: 0.08   // Boss 波清算额外 +8%（共 +12%）
  };

  // 精英 / Boss 倍率
  D.ELITE = { HP: 9, SPEED: 0.9, SIZE: 1.7, COIN: 15, GEM: 8, RADIUS: 1.7 };
  D.BOSS = {
    HP: 700, HP_GROWTH: 1.35, SPEED: 34, DMG: 25, RADIUS: 44,
    COIN: 80, GEM: 40, SUMMON_INTERVAL: 6, SUMMON_N: 4
  };

  // 掉落
  D.DROPS = {
    COIN_VALUE: 1,
    HEAL_CHANCE: 0.02, HEAL_AMOUNT: 25,
    MAGNET_CHANCE: 0.008,
    BOMB_CHANCE: 0.008, BOMB_RADIUS: 260, BOMB_DMG: 60
  };

  // 英雄职业（塔防单位）
  D.HEROES = {
    sword: {
      name: '剑士', icon: '⚔', color: '#e67e22', rare: false,
      desc: '近战环斩',
      dmg: 18, interval: 1.1, range: 95, aoe: true,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    archer: {
      name: '弓手', icon: '🏹', color: '#27ae60', rare: false,
      desc: '单体远程',
      dmg: 11, interval: 0.55, range: 330, bulletSpeed: 520,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    mage: {
      name: '法师', icon: '🔮', color: '#8e44ad', rare: false,
      desc: '范围火球',
      dmg: 26, interval: 1.5, range: 300, bulletSpeed: 320, splash: 75,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    cannon: {
      name: '炮手', icon: '💣', color: '#c0392b', rare: true,
      desc: '大范围重炮',
      dmg: 55, interval: 2.4, range: 360, bulletSpeed: 260, splash: 110,
      costGrowth: 1.6, intervalGrowth: 0.96
    },
    priest: {
      name: '牧师', icon: '✚', color: '#f1c40f', rare: true,
      desc: '治疗脉冲',
      heal: 6, interval: 2.0, range: 9999, healGrowth: 1.5, intervalGrowth: 0.97
    }
  };
  D.HERO = {
    MAX_LEVEL: 6,
    MAX_COUNT: 9,
    RECRUIT_BASE: 25,      // 招募费用：25 + 8×已招募次数
    RECRUIT_STEP: 8,
    UPGRADE_BASE: 60,      // 直升费用：60 × 1.9^(lv-1)
    UPGRADE_GROWTH: 1.9,
    SELL_VALUE: 20,        // 出售返还 20 × 等级
    DMG_GROWTH: 1.6,       // 每 +1 级伤害 ×1.6
    SLOT_DIST: 120,        // 阵地半径（围绕基地）
    DRAG_R: 26             // 拖拽命中半径
  };

  // 升级三选一技能池
  D.SKILLS = [
    { id: 'atk', name: '攻击强化', icon: '🗡', max: 8, desc: lv => '主角伤害 +20%（当前 +' + (lv * 20) + '%）' },
    { id: 'aspeed', name: '疾速射击', icon: '⚡', max: 8, desc: lv => '攻击间隔 -8%（当前 -' + (lv * 8) + '%）' },
    { id: 'multi', name: '分裂箭矢', icon: '🔱', max: 4, desc: lv => '弹道 +' + lv + '（共 ' + (1 + lv) + ' 道）' },
    { id: 'pierce', name: '穿透之刃', icon: '🎯', max: 3, desc: lv => '子弹可穿透 +' + lv + ' 个敌人' },
    { id: 'crit', name: '致命打击', icon: '💥', max: 6, desc: lv => '暴击率 +' + (lv * 8) + '%（暴伤 ×2）' },
    { id: 'bigshot', name: '巨型弹药', icon: '🔵', max: 4, desc: lv => '弹体 +30%，伤害 +' + (lv * 8) + '%' },
    { id: 'hp', name: '生命之泉', icon: '❤', max: 8, desc: lv => '生命上限 +30 并回满该值' },
    { id: 'regen', name: '恢复光环', icon: '💚', max: 8, desc: lv => '每秒回复 ' + lv + ' 生命' },
    { id: 'leech', name: '鲜血汲取', icon: '🩸', max: 3, desc: lv => '造成伤害的 ' + (lv * 2) + '% 转化为生命' },
    { id: 'speed', name: '疾风之靴', icon: '👟', max: 3, desc: lv => '移动速度 +' + (lv * 10) + '%' },
    { id: 'magnet', name: '磁力手套', icon: '🧲', max: 3, desc: lv => '拾取范围 +' + (lv * 45) + '%' },
    { id: 'gold', name: '点金之手', icon: '💰', max: 3, desc: lv => '金币获取 +' + (lv * 25) + '%' },
    { id: 'allydmg', name: '战友强化', icon: '🤝', max: 3, desc: lv => '全英雄伤害 +' + (lv * 15) + '%' },
    { id: 'allyspd', name: '集结战鼓', icon: '🥁', max: 3, desc: lv => '全英雄攻速 +' + (lv * 10) + '%' }
  ];
  D.SKILL_FALLBACKS = [
    { id: 'healfull', name: '瞬间治愈', icon: '💖', desc: () => '立即回复 50% 生命' },
    { id: 'bounty', name: '天降赏金', icon: '💰', desc: () => '立即获得 120 金币' }
  ];

  // 经济
  D.ECONOMY = {
    START_GOLD: 50,
    REPAIR_COST: 80, REPAIR_PCT: 0.25,
    BUFF_COST: 100, BUFF_GROWTH: 1.6, BUFF_PCT: 0.15
  };

  // ★ 主角（局外可选英雄）：基础属性 + 升级属性
  D.PROTOS = {
    archer: {
      name: '弓手', cls: 'archer', color: '#4aa3ff',
      desc: '均衡远程 · 默认解锁',
      hp: 100, dmg: 10, interval: 0.5, speed: 190, range: 300, bulletSpeed: 560
    },
    sword: {
      name: '剑士', cls: 'sword', color: '#e67e22',
      desc: '高血近战 · 环形斩击',
      hp: 140, dmg: 20, interval: 0.75, speed: 210, range: 130, melee: true
    },
    mage: {
      name: '法师', cls: 'mage', color: '#a55eea',
      desc: '火球溅射 · 生存偏弱',
      hp: 90, dmg: 16, interval: 0.9, speed: 185, range: 320, bulletSpeed: 340, splash: 70
    },
    priest: {
      name: '牧师', cls: 'priest', color: '#f1c40f',
      desc: '圣光速射 · 自带回血',
      hp: 130, dmg: 8, interval: 0.4, speed: 180, range: 280, bulletSpeed: 620,
      regenBase: 0.5, regenPerLv: 0.25
    },
    cannon: {
      name: '炮手', cls: 'cannon', color: '#e74c3c',
      desc: '重炮清屏 · 攻速缓慢',
      hp: 115, dmg: 42, interval: 2.0, speed: 175, range: 360, bulletSpeed: 260, splash: 100
    }
  };
  D.META = {
    PROTO_ORDER: ['archer', 'sword', 'mage', 'priest', 'cannon'],
    UNLOCK: { archer: 0, sword: 600, mage: 1500, priest: 2500, cannon: 3500 },
    UPG_BASE: 100,        // 升1级费用：100 × 1.5^(lv-1)
    UPG_GROWTH: 1.5,
    MAX_LV: 10,
    // 每级升级属性加成
    BONUS: { hp: 0.08, dmg: 0.06, aspeed: 0.04, speed: 0.02 }
  };

  D.VERSION = 'v0.2.1';
  G.D = D;
})();
