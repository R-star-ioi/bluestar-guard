// 宝箱逻辑回归测试（纯 Node，不需要浏览器/微信环境）
// 跑法：node tools/test_chests.js
var path = require('path');
var G = require(path.join(__dirname, '..', 'js', 'boot.js'));

var store = {};
G.P = {
  storage: {
    get: function (k, d) { return (k in store) ? store[k] : d; },
    set: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); }
  }
};
G.Audio = { play: function () { } };

require(path.join(__dirname, '..', 'js', 'config', 'data.js'));
require(path.join(__dirname, '..', 'js', 'core', 'meta.js'));
var M = G.Meta, D = G.D;

var fails = 0, checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { fails++; console.log('  ✗ ' + msg); }
  else console.log('  ✓ ' + msg);
}
function reset() {
  M.chests = {};
  M.diamonds = 0;
  M.maxLevel = 1;
}

console.log('1. 通关第1关(满血)：三箱全可领');
reset();
M.setChests(1, [true, true, true]);
ok(M.pendingChests(1) === 3, '第1关待领 3 箱');
ok(M.claimChest(1, 0) === D.LEVELS.BOX_REWARDS[0], '领第1箱得 ' + D.LEVELS.BOX_REWARDS[0] + ' 钻');
ok(M.claimChest(1, 1) === D.LEVELS.BOX_REWARDS[1], '领第2箱得 ' + D.LEVELS.BOX_REWARDS[1] + ' 钻');
ok(M.claimChest(1, 2) === D.LEVELS.BOX_REWARDS[2], '领第3箱得 ' + D.LEVELS.BOX_REWARDS[2] + ' 钻');
ok(M.pendingChests(1) === 0, '第1关已全部领完');
ok(M.claimChest(1, 0) === 0, '重复领取返回 0（不可刷）');

console.log('2. 通关第2关(70%)：不受第1关影响');
M.setChests(2, [true, true, false]);
ok(M.chestOf(2) !== null, '第2关有自己的记录');
ok(M.chestOf(2).claimed[0] === false, '第2关第1箱未领取（没被第1关污染）');
ok(M.pendingChests(2) === 2, '第2关待领 2 箱');
ok(M.claimChest(2, 2) === 0, '未达成的档位领不到');
ok(M.claimChest(2, 1) === D.LEVELS.BOX_REWARDS[1], '第2关领第2箱');
ok(M.chestOf(1).claimed[0] === true && M.chestOf(1).claimed[2] === true, '第1关记录保持已领取');

console.log('3. 没通关过的关卡 = 没有宝箱');
ok(M.chestOf(3) === null, '第3关无记录');
ok(M.pendingChests(3) === 0, '第3关待领 0');

console.log('4. 重打同一关：只增不减，已领不复活');
M.setChests(2, [true, false, false]);   // 打得比上次差
ok(M.chestOf(2).boxes[1] === true, '上次达成的第2档没被取消');
ok(M.claimChest(2, 0) === D.LEVELS.BOX_REWARDS[0], '没领过的第1档仍可领');
M.setChests(1, [true, true, true]);     // 满血重打
ok(M.chestOf(1).claimed[0] === true, '已领取的不会因为重打变回未领');

console.log('5. 存档往返：再 load 回来还是各关独立');
var before = JSON.stringify(M.chests);
M.chests = {};
M.load();
ok(JSON.stringify(M.chests) === before, 'load 后结构与内存一致（' + Object.keys(M.chests).join(',') + ' 关有记录）');

console.log('6. 旧存档迁移：单条 {level,boxes,claimed} → 按关卡归档');
store = {
  lx_meta: { gold: 0, diamonds: 120, maxLevel: 2, selectedLevel: 2,
    chests: { level: 2, boxes: [true, true, false], claimed: [true, false, false] } }
};
M.chests = {}; M.diamonds = 0; M.maxLevel = 1;
M.load();
ok(M.chestOf(2) !== null, '旧记录归到第2关');
ok(M.chestOf(1) === null, '不会给第1关凭空生成记录');
ok(M.chestOf(2).claimed[0] === true && M.chestOf(2).claimed[1] === false, '已领状态保留');
ok(M.pendingChests(2) === 1, '第2关待领 1 箱');

console.log('');
console.log(fails === 0 ? ('ALL PASS (' + checks + ' checks)') : (fails + '/' + checks + ' FAILED'));
process.exit(fails === 0 ? 0 : 1);
