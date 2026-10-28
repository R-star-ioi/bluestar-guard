// 验证武器系统（合成 / 装备 / 抽卡概率 / 存档迁移）
var G = require('../js/boot.js');
var store = {};
G.P = {
  storage: { get: function (k, d) { return (k in store) ? store[k] : d; }, set: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); } },
  loadImage: function () { return { ready: false }; },
  screenW: 514, screenH: 875, isWx: false
};
G.Audio = { play: function () { } };
require('../js/config/data.js');
require('../js/core/util.js');
require('../js/core/meta.js');
require('../js/core/weapon.js');

var M = G.Meta, W = G.Weapon;
var fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); }

M.weapons = []; M.equip = {}; M.nextWuid = 1;

console.log('1. 三个白色合成一个绿色');
var a = W.add('archer', 0), b = W.add('archer', 0), c = W.add('archer', 0);
var res = W.mergeAll();
ok(res.length === 1, '合了 1 次');
ok(M.weapons.length === 1, '剩 1 件');
ok(M.weapons[0].tier === 1 && M.weapons[0].star === 1, '变成绿 1★');

console.log('2. 九个白 → 一蓝（两轮）');
M.weapons = []; M.nextWuid = 1;
for (var i = 0; i < 9; i++) W.add('archer', 0);
W.mergeAll();
ok(M.weapons.length === 1 && M.weapons[0].tier === 2, '九个白 → 一个蓝（当前 ' + M.weapons.length + ' 件 tier ' + M.weapons[0].tier + '）');

console.log('3. 红色 2 合 1 升星，封顶 5 星');
M.weapons = []; M.nextWuid = 1;
W.add('archer', 4, 1); W.add('archer', 4, 1);
W.mergeAll();
ok(M.weapons.length === 1 && M.weapons[0].star === 2, '2 个红1★ → 红2★');
M.weapons = []; M.nextWuid = 1;
for (var s = 0; s < 16; s++) W.add('archer', 4, 5);   // 16 个红5★
W.mergeAll();
ok(M.weapons.every(function (w) { return w.star <= 5; }), '红5★ 不会再往上合');

console.log('4. 装备 / 卸下 / 加成');
M.weapons = []; M.nextWuid = 1;
var w1 = W.add('archer', 3, 2);   // 紫 2★
W.equip(w1);
ok(W.equipped('archer') === w1, '已装备紫2★');
ok(Math.abs(W.bonus(w1) - 1.22) < 1e-9, '紫2★ 加成 ' + W.bonus(w1).toFixed(2) + '（应为 1.22）');
W.unequip('archer');
ok(W.equipped('archer') === null, '已卸下');

console.log('5. 合成会吃掉已装备的那件时自动卸下');
M.weapons = []; M.nextWuid = 1; M.equip = {};
var e1 = W.add('archer', 1), e2 = W.add('archer', 1), e3 = W.add('archer', 1);
W.equip(e1);
W.mergeAll();
ok(M.equip.archer === 0, '装备位已清空（原装备被合成消耗）');

console.log('6. 抽卡概率（20000 次抽样）');
var cnt = [0, 0, 0, 0, 0];
for (var k = 0; k < 20000; k++) cnt[W.rollTier()]++;
var pct = cnt.map(function (v) { return (v / 200).toFixed(1) + '%'; });
console.log('   抽样:', pct.join(' / '), '（目标 80/10/6/3/1）');
ok(Math.abs(cnt[0] / 200 - 80) < 2.5, '白色约 80%');
ok(Math.abs(cnt[4] / 200 - 1) < 0.8, '红色约 1%');

console.log('7. 旧存档迁移（没有 weapons 字段）');
store = { lx_meta: { gold: 100, diamonds: 60 } };
M.weapons = []; M.nextWuid = 1; M.equip = {};
M.load();
ok(Array.isArray(M.weapons) && M.weapons.length === 0, '空背包不报错');

console.log('8. 存档往返');
M.weapons = []; M.nextWuid = 1; M.equip = {};
var w2 = W.add('archer', 2, 1);
W.equip(w2);
M.save(); M.load();
ok(M.weapons.length === 1 && M.weapons[0].tier === 2, '武器保留');
ok(W.equipped('archer') && W.equipped('archer').uid === w2.uid, '装备关系保留');

console.log('');
console.log(fails === 0 ? 'ALL PASS' : (fails + ' FAILED'));
process.exit(fails ? 1 : 0);
