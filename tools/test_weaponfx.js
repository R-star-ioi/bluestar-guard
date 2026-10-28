// 武器战斗效果回归测试（纯 Node，不依赖浏览器）
// 跑法：node tools/test_weaponfx.js
var G = require('../js/boot.js');

// ---- 环境桩 ----
var fxLog = [];
G.P = { storage: { get: function (k, d) { return d; }, set: function () { } }, screenW: 514, screenH: 875, isWx: false };
G.Audio = { play: function () { } };
G.Camera = { shake: function () { } };
G.FX = {
  text: function (x, y, s, c, z, crit) { fxLog.push({ t: 'text', s: s, c: c }); },
  burst: function () { }, ring: function () { }, spray: function () { },
  alpha: function () { return 1; }
};

require('../js/config/data.js');
require('../js/core/util.js');
require('../js/core/meta.js');
require('../js/core/weapon.js');
require('../js/entities/projectile.js');
require('../js/systems/weaponfx.js');

var W = G.Weapon, WFX = G.WeaponFX;

// ---- 假的 game / 敌人 ----
var enemies = [];
function mkEnemy(x, y, hp) {
  return { x: x, y: y, r: 13, hp: hp, maxHp: hp, dead: false, speed: 60, color: '#f00', burnT: 0, burnN: 0 };
}
function mkGame() {
  return {
    grid: {
      query: function (x, y, r) {
        return enemies.filter(function (e) {
          var dx = e.x - x, dy = e.y - y;
          return !e.dead && dx * dx + dy * dy <= (r + e.r) * (r + e.r);
        });
      }
    },
    damageEnemy: function (e, dmg, hx, hy, big) {
      if (e.dead) return { crit: false, dmg: 0 };
      e.hp -= dmg;
      if (e.hp <= 0) { e.hp = 0; e.dead = true; }
      return { crit: false, dmg: dmg };
    }
  };
}
G.Enemy = { list: enemies };
G.Player = { heal: function () { }, attackTimer: 0, proto: null, stats: {} };

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

// ============ 1. 品质基线 ============
console.log('[1] 品质基线');
var s0 = W.stats({ tier: 0, star: 1 }), s1 = W.stats({ tier: 1, star: 1 }), s2 = W.stats({ tier: 2, star: 1 }), s3 = W.stats({ tier: 3, star: 1 });
ok('白 攻击+4% 攻速+4% 无暴击', Math.abs(s0.atk - 0.04) < 1e-9 && Math.abs(s0.aspd - 0.04) < 1e-9 && s0.crit === 0);
ok('绿 穿透1 且穿透后 -10%', s1.pierce === 1 && Math.abs(s1.pierceInc + 0.10) < 1e-9);
ok('蓝 穿透2 每穿+5%', s2.pierce === 2 && Math.abs(s2.pierceInc - 0.05) < 1e-9);
ok('蓝 暴击率+8% 暴伤+15%', Math.abs(s2.crit - 0.08) < 1e-9 && Math.abs(s2.critDmg - 0.15) < 1e-9);
ok('紫 射程115%', Math.abs(s3.range - 1.15) < 1e-9);
ok('紫 穿透所有', s3.pierce >= 99 && s3.pierceAll);
ok('紫 全伤害+40% 无视护甲15%', Math.abs(s3.alldmg - 0.40) < 1e-9 && Math.abs(s3.ignoreArmor - 0.15) < 1e-9);

// ============ 2. 红色星级成长 ============
console.log('[2] 红色星级');
var r1 = W.stats({ tier: 4, star: 1 }), r5 = W.stats({ tier: 4, star: 5 });
ok('红1★ 炎爆 150', r1.burstR === 150);
ok('红2★ 炎爆 220 + 灼烧5层35%', W.stats({ tier: 4, star: 2 }).burstR === 220 && W.stats({ tier: 4, star: 2 }).burnStack === 5 && Math.abs(W.stats({ tier: 4, star: 2 }).burnDps - 0.35) < 1e-9);
ok('红3★ 火焰轨迹 + 易伤15%', W.stats({ tier: 4, star: 3 }).trail === true && Math.abs(W.stats({ tier: 4, star: 3 }).vuln - 0.15) < 1e-9);
ok('红4★ 双重炎爆 + 图腾30%', W.stats({ tier: 4, star: 4 }).doubleBurst === true && Math.abs(W.stats({ tier: 4, star: 4 }).totemChance - 0.30) < 1e-9);
ok('红5★ 焚天箭雨 3 杀 + 龙炎 + 传染', r5.rainEvery === 3 && r5.dragon === true && r5.burnSpread === true);
ok('红5★ 攻击高于红1★', r5.atk > r1.atk, r1.atk + ' vs ' + r5.atk);

// ============ 3. 蓝色：冰霜溅射 / 冻结 ============
console.log('[3] 蓝色冰霜');
enemies.length = 0;
var main = mkEnemy(100, 100, 1000);
var side = mkEnemy(140, 100, 1000);
enemies.push(main, side);
var game = mkGame();
var ws2 = W.stats({ tier: 2, star: 1 });
var p2 = { wx: ws2, atk0: 100, dmg: 100, x: 100, y: 100 };
Math.random = function () { return 0.99; };   // 不触发冻结
WFX.onHit(p2, main, game, false);
ok('冰霜溅射打到旁边敌人 30 点(30% 攻击力)', Math.abs((1000 - side.hp) - 30) < 0.5, '实际 ' + (1000 - side.hp).toFixed(1));
ok('未冻结 → 施加寒霜', main.chillT === 2 && Math.abs(main.chillSlow - 0.4) < 1e-9);

enemies.length = 0;
var m2 = mkEnemy(100, 100, 1000); enemies.push(m2);
Math.random = function () { return 0.01; };   // 触发冻结
WFX.onHit(p2, m2, game, false);
ok('35% 判定触发 → 冻结 0.8s', Math.abs(m2.freezeT - 0.8) < 1e-9, 'freezeT=' + m2.freezeT);

// ============ 4. 绿色穿透衰减 / 紫色增伤 ============
console.log('[4] 穿透公式');
Math.random = function () { return 0.5; };
var pv = { wx: s1, atk0: 100, dmg: 100, pierce: s1.pierce, pierceInc: s1.pierceInc, size: 4, x: 100, y: 100 };
enemies.length = 0;
var e1 = mkEnemy(100, 100, 1000); enemies.push(e1);
var still = G.Proj.hitEnemies(pv, game);
ok('绿色命中第 1 人后仍存活（可穿 1 人）', still === false && pv.pierce === 0);
ok('穿透后伤害 -10% → 90', Math.abs(pv.dmg - 90) < 1e-9, 'dmg=' + pv.dmg);

var pv2 = { wx: s3, atk0: 100, dmg: 100, pierce: s3.pierce, pierceInc: s3.pierceInc, size: 4, x: 100, y: 100 };
enemies.length = 0;
var e2 = mkEnemy(100, 100, 1000); enemies.push(e2);
var still2 = G.Proj.hitEnemies(pv2, game);
ok('紫色穿透后仍存活', still2 === false);
ok('穿透后伤害 +12% → 112', Math.abs(pv2.dmg - 112) < 1e-9, 'dmg=' + pv2.dmg);

// ============ 5. 紫色：暴击分裂 ============
console.log('[5] 暗影分裂');
G.Proj.clear();
enemies.length = 0;
var c1 = mkEnemy(100, 100, 5000);
enemies.push(c1);
var t1 = mkEnemy(160, 100, 5000), t2 = mkEnemy(100, 170, 5000);
enemies.push(t1, t2);
var p3 = { wx: s3, atk0: 200, dmg: 200, x: 100, y: 100 };
WFX.onHit(p3, c1, game, true);
ok('暴击命中分裂出 2 枚暗影箭', G.Proj.list.length === 2, '实际 ' + G.Proj.list.length);
ok('分裂箭伤害 = 60% 攻击力', Math.abs(G.Proj.list[0].dmg - 120) < 1e-9, 'dmg=' + G.Proj.list[0].dmg);
ok('分裂箭带追踪目标', !!G.Proj.list[0].homing);
WFX.onHit(p3, c1, game, false);
ok('非暴击不分裂', G.Proj.list.length === 2);

// ============ 6. 红色：炎爆 + 灼烧 ============
console.log('[6] 炎爆 / 灼烧');
G.Proj.clear();
WFX.fields.length = 0;
WFX.pending.length = 0;
enemies.length = 0;
var rc = mkEnemy(100, 100, 100000);
var rnear = mkEnemy(100, 220, 100000);   // 距离 120，在 150 半径内
var rfar = mkEnemy(100, 400, 100000);    // 距离 300，打不到
enemies.push(rc, rnear, rfar);
var wsRed = W.stats({ tier: 4, star: 1 });
var pr = { wx: wsRed, atk0: 1000, dmg: 1000, x: 100, y: 100 };
WFX.onHit(pr, rc, game, false);
ok('炎爆命中范围内敌人（100% 攻击力）', Math.abs((100000 - rnear.hp) - 1000) < 1, '扣血 ' + (100000 - rnear.hp).toFixed(0));
ok('范围外不受影响', rfar.hp === 100000);
ok('爆炸给范围内敌人挂灼烧', rnear.burnT > 0 && rnear.burnN >= 1, 'burnN=' + rnear.burnN);
ok('灼烧每秒 = 25% 攻击力', Math.abs(rnear.burnDps - 250) < 1e-9, 'burnDps=' + rnear.burnDps);
ok('1★ 没有图腾（4★ 才解锁）', !wsRed.totemChance);

// 4★ 暴击 → 双重炎爆
WFX.pending.length = 0;
var wsRed4 = W.stats({ tier: 4, star: 4 });
var pr4 = { wx: wsRed4, atk0: 1000, dmg: 1000, x: 100, y: 100 };
enemies.length = 0;
var e4 = mkEnemy(100, 100, 100000); enemies.push(e4);
Math.random = function () { return 0.99; };   // 不触发图腾
WFX.onHit(pr4, e4, game, true);
ok('4★ 暴击排入第二次炎爆', WFX.pending.length === 1, 'pending=' + WFX.pending.length);
ok('暴击炎爆伤害 +100%', Math.abs((100000 - e4.hp) - 2000) < 1, '扣血 ' + (100000 - e4.hp).toFixed(0));

// ============ 7. 灼烧易伤 / 传染 / 击杀回血 ============
console.log('[7] 灼烧联动');
WFX.active = wsRed;
WFX.refresh = function () { };
WFX.active = wsRed;
var ve = mkEnemy(0, 0, 1000);
ve.burnT = 2; ve.burnN = 2;
ok('灼烧目标易伤 ×1（1★ 无易伤）', WFX.vulnMult(ve) === 1);
WFX.active = W.stats({ tier: 4, star: 3 });
ok('3★ 灼烧目标受到伤害 ×1.15', Math.abs(WFX.vulnMult(ve) - 1.15) < 1e-9);
ok('未灼烧目标无易伤', WFX.vulnMult(mkEnemy(9, 9, 10)) === 1);

// 5★ 传染
enemies.length = 0;
var src = mkEnemy(0, 0, 1);
src.burnT = 2; src.burnN = 4; src.burnDps = 50; src.dead = true;
var nb = mkEnemy(40, 0, 1000);
enemies.push(src, nb);
WFX.active = W.stats({ tier: 4, star: 5 });
WFX.rainKill = 0; WFX.rainReady = false;
WFX.onKill(src, game);
ok('5★ 死亡传递一半层数（4 → 2）', nb.burnN === 2, 'burnN=' + nb.burnN);

// 2★ 击杀回血
WFX.active = W.stats({ tier: 4, star: 2 });
var healed = 0;
G.Player = { heal: function (v) { healed += v; }, attackTimer: 0 };
enemies.length = 0;
var bk = mkEnemy(0, 0, 1);
bk.burnT = 1; bk.burnN = 2; bk.dead = true;
enemies.push(bk);
WFX.onKill(bk, game);
ok('2★ 击杀灼烧目标回 8 血', healed === 8, 'healed=' + healed);

// 5★ 箭雨蓄能
WFX.active = W.stats({ tier: 4, star: 5 });
WFX.rainKill = 0; WFX.rainReady = false;
for (var i = 0; i < 3; i++) {
  var kk = mkEnemy(0, 0, 1); kk.dead = true; enemies.push(kk);
  WFX.onKill(kk, game);
}
ok('5★ 每 3 杀蓄满焚天箭雨', WFX.rainReady === true);
ok('consumeRain 返回 true 且清空计数', WFX.consumeRain() === true && WFX.rainKill === 0);
ok('再次 consumeRain 返回 false', WFX.consumeRain() === false);

// 焚天箭雨生成 7 枚
WFX.pending.length = 0;
enemies.length = 0;
var tgt = mkEnemy(100, 100, 1000); enemies.push(tgt);
WFX.castRain(game, tgt, W.stats({ tier: 4, star: 5 }), 500);
ok('焚天箭雨 = 7 枚烈焰箭', WFX.pending.length === 7, '实际 ' + WFX.pending.length);

// ============ 8. 火焰轨迹 ============
console.log('[8] 火焰轨迹');
WFX.fields.length = 0;
WFX.addFire(10, 10, 1000, W.stats({ tier: 4, star: 3 }));
ok('addFire 生成 1 个火焰区域', WFX.fields.length === 1 && WFX.fields[0].type === 'fire');

// ============ 汇总 ============
console.log('');
console.log('通过 ' + pass + ' / ' + (pass + fail));
if (fail) process.exit(1);
