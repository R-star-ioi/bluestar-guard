// 验证兑换码
var G = require('../js/boot.js');
var store = {};
G.P = {
  storage: { get: function (k, d) { return (k in store) ? store[k] : d; }, set: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); } },
  loadImage: function () { return { ready: false }; }, screenW: 514, screenH: 875, isWx: false
};
G.Audio = { play: function () { } };
require('../js/config/data.js');
require('../js/core/util.js');
require('../js/core/meta.js');

var M = G.Meta, fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); }

M.diamonds = 0; M.redeemed = {};
var r1 = M.redeem('lxsw666');
ok(r1.ok && r1.amount === 99999, 'lxsw666 兑换成功 +99999');
ok(M.diamonds === 99999, '钻石余额 99999');

var r2 = M.redeem('LXSW666 ');
ok(!r2.ok && r2.reason === 'used', '空格/大写也能识别，且只能用一次（reason=' + r2.reason + '）');
ok(M.diamonds === 99999, '重复兑换不加钻');

var r3 = M.redeem('nope123');
ok(!r3.ok && r3.reason === 'invalid', '错误码 → invalid');
var r4 = M.redeem('   ');
ok(!r4.ok && r4.reason === 'empty', '空输入 → empty');

M.save();
var d = M.diamonds;
M.diamonds = 0; M.redeemed = {};
M.load();
ok(M.diamonds === d && M.redeemed.lxsw666 === true, '兑换记录写进存档');

console.log(fails ? (fails + ' FAILED') : 'ALL PASS');
process.exit(fails ? 1 : 0);
