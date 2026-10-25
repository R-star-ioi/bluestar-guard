// 通用工具函数
var G = require('../boot.js');
(function () {
  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.choice = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.dist2 = function (ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  U.len = function (x, y) { return Math.sqrt(x * x + y * y); };
  U.angle = function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); };
  U.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };

  U.weightedPick = function (items, wFn) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += wFn(items[i]);
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= wFn(items[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  // 伪随机种子（背景星星用，保证每帧一致）
  U.seededRand = function (seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  G.U = U;
})();
