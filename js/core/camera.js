// 相机：跟随玩家，限制在地图范围内，支持震屏
var G = require('../boot.js');
(function () {
  var Camera = {
    x: 0, y: 0, // 视口左上角（世界坐标）
    shakeT: 0, shakePower: 0,
    init: function (mapW, mapH) {
      Camera.mapW = mapW; Camera.mapH = mapH;
      Camera.x = (mapW - G.P.screenW) / 2;
      Camera.y = (mapH - G.P.screenH) / 2;
    },
    snapTo: function (x, y) {
      Camera.x = x - G.P.screenW / 2;
      Camera.y = y - G.P.screenH / 2;
      Camera.clampPos();
    },
    update: function (dt, tx, ty) {
      // 平滑跟随
      var gx = tx - G.P.screenW / 2;
      var gy = ty - G.P.screenH / 2;
      Camera.x += (gx - Camera.x) * Math.min(1, dt * 6);
      Camera.y += (gy - Camera.y) * Math.min(1, dt * 6);
      Camera.clampPos();
      if (Camera.shakeT > 0) Camera.shakeT -= dt;
    },
    clampPos: function () {
      Camera.x = G.U.clamp(Camera.x, 0, Math.max(0, Camera.mapW - G.P.screenW));
      Camera.y = G.U.clamp(Camera.y, 0, Math.max(0, Camera.mapH - G.P.screenH));
    },
    shake: function (power, time) {
      Camera.shakePower = Math.max(Camera.shakePower * 0.5, power);
      Camera.shakeT = Math.max(Camera.shakeT, time);
    },
    // 渲染偏移（含震屏）
    ox: function () {
      var s = Camera.shakeT > 0 ? Camera.shakePower * (Camera.shakeT / 0.35) : 0;
      return Camera.x + (Math.random() - 0.5) * s * 2;
    },
    oy: function () {
      var s = Camera.shakeT > 0 ? Camera.shakePower * (Camera.shakeT / 0.35) : 0;
      return Camera.y + (Math.random() - 0.5) * s * 2;
    }
  };
  G.Camera = Camera;
})();
