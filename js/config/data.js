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
    slime: { hp: 22, hpRatio: 1.0, speed: 62, dmg: 8, radius: 13, coin: 2, gem: 1, color: '#e74c3c', name: '史莱姆' },
    fast: { hp: 14, hpRatio: 0.64, speed: 108, dmg: 6, radius: 11, coin: 3, gem: 1, color: '#ff7f50', name: '疾行虫' },
    tank: { hp: 95, hpRatio: 4.3, speed: 36, dmg: 16, radius: 20, coin: 6, gem: 2, color: '#9b59b6', name: '装甲胖' },
    shooter: { hp: 34, hpRatio: 1.5, speed: 50, dmg: 10, radius: 14, coin: 5, gem: 2, color: '#2ecc71', name: '毒液射手', shootRange: 240, shootInterval: 2.2, bulletSpeed: 170 }
  };
  // ★ 怪物基础血量（v0.5.14）：小怪基准 500，按 hpRatio 保留类型差异；精英/Boss 用绝对值
  D.ENEMY_HP_BASE = 500;
  D.ENEMY_BULLET_SPEED = 170;

  // 波次成长
  D.WAVE = {
    START_INTERVAL: 5,     // 波与波之间的间歇
    HP_GROWTH: 1.13,       // 前期每波 HP ×1.13（13波起按阶梯加速，见 HP_GROWTH_TIERS）
    HP_GROWTH_TIERS: [     // 血量阶梯式成长：对标玩家输出曲线，后期压迫感增强
      { from: 1, rate: 1.13 },
      { from: 13, rate: 1.20 },
      { from: 25, rate: 1.30 },
      { from: 40, rate: 1.40 }
    ],
    DMG_GROWTH: 1.05,      // 每波伤害 ×1.05
    DMG_CAP: 3,            // 伤害成长上限倍数
    ELITE_FROM: 5,         // 精英出现起始波
    ELITE_CHANCE: 0.10,    // 精英基础概率（随波次升至0.30封顶）
    BOSS_EVERY: 5,         // 每 5 波 Boss
    BUDGET_BASE: 12,       // 敌人预算：12 + 7波 + 波^1.55（数量温和上升，同屏上限60不变）
    MAX_ALIVE: 75,         // 同屏敌人上限
    COUNT_MULT_TIERS: [    // 刷怪数量分阶段：前期少，10波起×3
      { from: 1, mult: 1 },
      { from: 5, mult: 1.5 },
      { from: 10, mult: 3 }
    ],
    GOLD_GROWTH: 0.06,     // 敌人金币/经验产出每波 +6%（高波次产出提升）
    ATK_PER_WAVE: 0.04,    // 每清一波 主角攻击 +4%（局内成长）
    ATK_BOSS_BONUS: 0.08   // Boss 波清算额外 +8%（共 +12%）
  };

  // 精英 / Boss 倍率（血量改为绝对值基线 × 波次/关卡倍率，不再按主角 DPS 定价）
  D.ELITE = { HP_BASE: 3500, SPEED: 0.9, SIZE: 1.7, COIN: 15, GEM: 8, RADIUS: 1.7 };
  D.BOSS = {
    HP_BASE: 15000, SPEED: 34, DMG: 25, RADIUS: 44,
    COIN: 80, GEM: 40, SUMMON_INTERVAL: 6, SUMMON_N: 4
  };

  // ★ 世界吞噬者（每关第 20 波关底蠕虫 Boss，v0.5.15）
  D.DEVOURER = {
    SEG_COUNT: 72,         // 体节数
    SEG_R: 32,             // 体节半径（≈基地大小，玩家 r14 的 5 倍直径量级）
    SEG_SPACING: 40,       // 节间距（轻微重叠，视觉连贯）
    SPEED_RATIO: 0.5,      // 普通移动 = 玩家速度 × 0.5
    DASH_SPEED_RATIO: 0.9, // 冲撞时 = 玩家速度 × 0.9
    DASH_CD: 3.5,          // 冲撞冷却（秒）
    SPIT_T: 1.6,           // 魔唾液射击间隔（秒）
    SPIT_T_LOW: 0.75,      // 头部低血量时的射击间隔
    DASH_DMG: 55,          // 冲撞
    SPIT_DMG: 15,          // 魔唾液命中
    POOL_DMG: 10,          // 魔唾液落地的酸液
    TOUCH_DMG: 5,          // 碰到身体
    RESIST: 0.20,          // 全伤害减免 20%
    AOE_RESIST: 0.80,      // 爆炸/范围类伤害额外减免 80%
    SPIT_SPEED: 175,
    // 基础总血量：L1 50万 / L2 500万 / L3 5000万 / L4 5500万，L5 起每关 ×1.5
    HP_BASE: [500000, 5000000, 50000000, 55000000],
    HP_GROW: 1.5,
    hpOf: function (lv) {
      var t = D.DEVOURER.HP_BASE;
      if (lv <= t.length) return t[lv - 1];
      return t[t.length - 1] * Math.pow(D.DEVOURER.HP_GROW, lv - t.length);
    },
    BGM: 'Music/世界吞噬者.mp3',
    BGM_VOL: 0.6
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
    { id: 'allyspd', name: '集结战鼓', icon: '🥁', max: 3, desc: lv => '全英雄攻速 +' + (lv * 10) + '%' },
    { id: 'eagle', name: '鹰眼', icon: '🔭', max: 5, desc: lv => '攻击射程 +' + (lv * 5) + '%' },
    { id: 'vision', name: '苍穹视界', icon: '👁', max: 3, desc: lv => '视野扩大 ' + (lv * 10) + '%，看得更远' },
    { id: 'knock', name: '震荡弹头', icon: '🔨', max: 5, desc: lv => lv === 1 ? '普攻可击退敌人' : '击退力度提升 ' + ((lv - 1) * 30) + '%' }
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

  // ★ 附加技能（吸血鬼幸存者式独立被动）：升级时独立二选，最多持有3个，每技能满5级质变
  D.ASKILL_MAX_COUNT = 3;
  D.ASKILLS = {
    star: { id: 'star', name: '星环脉冲', max: 5, desc: lv => [
        '环绕能量环 清怪输出', '尺寸+25% 旋转加快 伤害提升', '双层星环 独立旋转',
        '伤害大幅提升 命中更频繁', '耀星环：三层高速环绕 击中留灼烧地带'][lv - 1] },
    echo: { id: 'echo', name: '时空残影', max: 5, desc: lv => [
        '周期生成残影 模仿你攻击一次', '残影冷却缩短 伤害+20%', '同时存在 2 个残影',
        '残影跟随你移动 攻击附带减速', '万影随行：3残影 伤害等同本体'][lv - 1] },
    shield: { id: 'shield', name: '晶盾回响', max: 5, desc: lv => [
        '受伤后生成临时护盾', '护盾更厚 冷却更短', '护盾期间移速小幅提升',
        '护盾破碎爆发冲击波 击退伤害', '晶爆神盾：高频刷新 巨型冲击波并回血'][lv - 1] },
    magnet: { id: 'magnet', name: '贪婪磁核', max: 5, desc: lv => [
        '吸取范围+30%', '范围+60% 拾取经验短暂增伤', '范围+100% 拾取经验短暂加速',
        '击杀概率直接生成经验球', '引力漩涡：巨吸圈 圈内烧怪 拾取永久叠伤'][lv - 1] },
    bomb: { id: 'bomb', name: '崩解爆弹', max: 5, desc: lv => [
        '每击杀12次 自动引爆（冷却6秒）', '击杀9次触发 伤害提升（冷却8秒）', '爆炸可连锁（冷却11秒）',
        '爆炸附带眩晕（冷却15秒）', '连环崩解：4杀引爆 无限连锁（冷却20秒）'][lv - 1] }
  };
  D.ASKILL_ORDER = ['star', 'echo', 'shield', 'magnet', 'bomb'];
  // ★ 更新公告（主菜单展示）
  D.CHANGELOG = [
    { ver: 'v0.5.22', title: '属性面板 + 新强化 + 拉怪距离', lines: ['DPS 旁新增「?」按钮，点开查看主角全部属性（攻击/攻速/暴击/武器加成/局内强化）', '金币左侧显示当前主角等级 Lv', '升级三选一新强化：鹰眼（射程+5%×5）、苍穹视界（视野+10%×3）、震荡弹头（普攻击退，力度随等级）', '崩解爆弹对 Boss 单次伤害硬上限 15%（暴击也压不住，彻底无法秒 Boss）', '吞噬者移速回到玩家 50%，冲撞冷却 3.5s、唾液 1.6s（低血 0.75s）', '怪物仇恨距离 190 → 260，站得离基地远一点也能把怪拉过来'] },
    { ver: 'v0.5.21', title: '爆弹连锁性能优化', lines: ['修复：崩解爆弹连锁打到世界吞噬者的 72 个体节时指数级增殖，卡成幻灯片甚至死机', '体节不再作为连锁跳板；连锁爆弹并发上限 24；每帧最多引爆 2 个；同帧多爆只播一次音效/震屏'] },
    { ver: 'v0.5.20', title: '吞噬者战基地无敌', lines: ['世界吞噬者存活期间基地被保护罩罩住：完全无敌（青色能量罩可视化），Boss 战专心走位'] },
    { ver: 'v0.5.19', title: '吞噬者战保护基地', lines: ['世界吞噬者存活期间，基地每次受击只扣 1hp，安心走位躲 Boss'] },
    { ver: 'v0.5.18', title: '爆弹防秒杀 + 吞噬者再减速', lines: ['崩解爆弹对 Boss / 世界吞噬者：单次爆炸伤害不超过其最大血量的 15%，无法再被连环秒杀', '吞噬者普通移速降为玩家的 35%，冲撞时为玩家的 90%'] },
    { ver: 'v0.5.17', title: '吞噬者减速', lines: ['世界吞噬者移速降为玩家速度的 50%，走位空间更大'] },
    { ver: 'v0.5.16', title: '吞噬者调优 + 开发者码', lines: ['吞噬者体型加大到接近基地大小（体节半径 32，约为玩家 5 倍身位）', '新增开发者兑换码：游戏中暂停后输入可跳到第 19 波（可重复使用）', '受击闪白改为淡色，不再整条发白'] },
    { ver: 'v0.5.15', title: '世界吞噬者', lines: ['第 20 波关底 Boss 换成蠕虫「世界吞噬者」：72 体节，打碎一节就分裂成多条', '它存活期间循环播放专属 BGM（60% 音量）', '会冲撞与喷吐魔唾液，命中会禁疗 / 减速 / 易伤', '受到的所有伤害 -20%，爆炸类再 -80%，请别指望炎爆速刷'] },
    { ver: 'v0.5.14', title: '怪物血量重做', lines: ['小怪基础 500 / 精英 3500 / Boss 15000，不再一箭秒', '精英与 Boss 血量改为固定基线，不再随你的装备浮动', '波内与关间成长重新标定，后期压迫感更强'] },
    { ver: 'v0.5.13', title: 'HUD 调整', lines: ['波次倒计时移到屏幕上方，字号放大一倍，不再挡住左上战绩', '波次间隔改为 5 秒', '左上角新增当前主角 DPS 秒伤'] },
    { ver: 'v0.5.12', title: '武器战斗效果', lines: ['五档品质各有独立效果：穿透、冰霜冻结、暗影分裂、炎爆灼烧', '红色按星级进阶：2★灼烧强化 3★火焰轨迹 4★双重炎爆+图腾 5★焚天箭雨', '武器属性改为真实加成（攻击/攻速/暴击率/暴击伤害/射程）'] },
    { ver: 'v0.5.11', title: '英雄不再持械', lines: ['招募来的英雄只显示职业图标，不再跟着拿当前装备的武器', '装备的武器只显示在玩家操控的主角身上'] },
    { ver: 'v0.5.10', title: '抽卡与背包手感', lines: ['卡池概率改成两行显示，不再顶出卡片', '抽到紫/红品质时翻牌慢放 + 音效', '武器列表滚动后，顶栏区域不再误点到下面的武器'] },
    { ver: 'v0.5.9', title: '武器朝向修复', lines: ['主角朝右时武器没有镜像，弓箭方向是反的', '现在朝哪边就镜像到哪边；英雄的弓也统一朝外'] },
    { ver: 'v0.5.8', title: '武器外观', lines: ['装备的武器会显示在角色手上（按品质取图，紫/红带光晕）', '武器图新增透明底版本，游戏内用抠图、卡面用带背景版'] },
    { ver: 'v0.5.6', title: '武器与抽卡', lines: ['英雄页新增「武器」按钮，可装备/卸下（目前开放弓手）', '主界面新增「背包」与「抽武器」', '品质白→绿→蓝→紫→红，三个同阶合一阶，两个同星红合高一星', '抽卡 60 钻/次：白80% 绿10% 蓝6% 紫3% 红1%，带翻卡动画'] },
    { ver: 'v0.5.5', title: '战斗手感与设置', lines: ['暴击伤害数字更大更红', '17-20 波敌人更硬，关卡之间落差更明显', '清波提示分两行显示', '修复拖拽同名同级英雄无法合成', '新增设置：特效强度滑条（主界面右下角 ⚙️ / 暂停菜单）'] },
    { ver: 'v0.5.4', title: '界面排版整理', lines: ['英雄页：升级/选择改为右侧上下排列，不再压住 Lv 加成说明', '英雄页支持上下拖动滚动，矮屏也能看到全部主角', '局内顶栏去掉钻石（回主界面看），只留局内金币；左侧战绩与英雄数不再重叠', '附加技能栏改为居中显示'] },
    { ver: 'v0.5.3', title: '宝箱按关卡独立', lines: ['每关的宝箱各自记录，通关别关不再串状态', '重打本关只增不减，已领取的不会复活', '切换关卡时显示该关自己的宝箱'] },
    { ver: 'v0.5.2', title: '主菜单排版修复', lines: ['标题区独立排版，水晶徽记不再被选关卡片遮挡', '徽记改为矢量绘制，不依赖 emoji', '矮屏下按钮与说明文字自动收紧，不再重叠'] },
    { ver: 'v0.5.1', title: '宝箱与资源展示优化', lines: ['通关宝箱改为回主界面领取 领取后显示已打开状态', '钻石与金币移至右上角资源栏', '1-50关均可预览 未通关前关则开始按钮锁定'] },
    { ver: 'v0.5.0', title: '关卡系统上线', lines: ['50个关卡，每关20波，通关开宝箱', '主界面左右箭头选关，逐关解锁', '新增钻石：满血通关300钻/≥70%150钻/保底50钻'] },
    { ver: 'v0.4.2', title: '崩解爆弹冷却制', lines: ['满级连环崩解改为20秒冷却', '低等级冷却6~15秒，冷却期击杀不计数'] },
    { ver: 'v0.4.1', title: '拾取贴身修复', lines: ['金币经验飞到身上才消失，不再半空蒸发'] },
    { ver: 'v0.4.0', title: 'Boss/精英DPS定价', lines: ['Boss血量=主角DPS×15，精英=×7', '10波起小怪数量×3，同屏上限75'] },
    { ver: 'v0.3.3', title: '血量阶梯成长', lines: ['13/25/40波起血量成长逐步加速，后期更有压迫感'] },
    { ver: 'v0.3.2', title: '掉落修复+磁吸加速', lines: ['金币经验超量不再丢失', '磁吸速度约2倍，飞到身上才收'] },
    { ver: 'v0.3.0', title: '附加技能系统', lines: ['星环/残影/晶盾/磁核/爆弹 5种被动', '最多持有3个，5级满级质变'] },
    { ver: 'v0.2.x', title: '局外成长与节奏优化', lines: ['主页可选5主角并升级属性', '波次攻击成长+高波次产出提升'] },
    { ver: 'v0.1.0', title: '首次发布', lines: ['割草 × 塔防 × 英雄合成'] }
  ];

  // ★ 关卡系统：50关 × 每关20波
  D.LEVELS = {
    TOTAL: 50,
    WAVES: 20,             // 每关波次
    // 波内血量成长：需求是"每波 +50%"，但 1.5^19 = 2217，第 1 关第 20 波就是 110 万血，
    // 红 5★ 要打近一小时一只。实测改为 1.12（20 波 ≈ 8.6 倍），配合基础值 500 已经比旧版厚 22 倍
    HP_WAVE: 1.12,
    BUDGET_WAVE: 1.13,     // 波内数量预算：每波×1.13
    LATE_FROM: 15,         // 尾段陡增起始波：15~20 波额外加速（体感"最后一波很硬"）
    LATE_RATE: 1.05,       // 尾段每波额外 ×1.05（15→20 共 ×1.34）
    // 关间难度：需求是"每关 2 倍"，但 2^49 是 5.6e14 倍，50 关不可能；取 1.40（每关 +40%，10 关 20 倍）
    DIFF: 1.40,
    DIFF_BUDGET_POW: 0.62, // 数量预算随关间难度的缩放指数（防爆屏）
    BOSS_WAVES: [10, 20],  // 关内Boss波（20=关底Boss）
    BOX_REWARDS: [50, 100, 150], // 三档宝箱钻石：30%档/70%档/满血档
    NAMES: ['静谧草原', '荆棘丛林', '沉默森林', '风语荒漠', '霜冻苔原',
            '幽暗洞穴', '熔岩裂谷', '浮空遗迹', '深渊裂隙', '星陨之巅'],
    nameOf: function (lv) { return D.LEVELS.NAMES[(lv - 1) % D.LEVELS.NAMES.length]; }
  };

  D.VERSION = 'v0.5.22';

  // ★ 兑换码（key 一律小写，输入时会自动转小写）；每个码每台设备只能用一次
  D.CODES = {
    lxsw666: { diamonds: 99999, note: '新手福利' },
    kfz001: { dev: true, note: '已跳到第 19 波（倒计时结束后打世界吞噬者）' }   // 开发者调试码，可重复使用
  };
  G.D = D;
})();
