// 相机：跟随玩家，限制在地图范围内，支持震屏与视距缩放
var G = require('../boot.js');
(function () {
  var Camera = {
    x: 0, y: 0, // 视口左上角（世界坐标）
    zoom: 1,    // 视距倍率：1 = 标准，<1 看得更远（苍穹视界强化）
    shakeT: 0, shakePower: 0,
    init: function (mapW, mapH) {
      Camera.mapW = mapW; Camera.mapH = mapH;
      Camera.zoom = 1;
      Camera.x = (mapW - G.P.screenW) / 2;
      Camera.y = (mapH - G.P.screenH) / 2;
    },
    setZoom: function (z) {
      Camera.zoom = G.U.clamp(z, 0.6, 1);
      Camera.clampPos();
    },
    // 视口实际覆盖的世界尺寸（随 zoom 变大）
    viewW: function () { return G.P.screenW / Camera.zoom; },
    viewH: function () { return G.P.screenH / Camera.zoom; },
    snapTo: function (x, y) {
      Camera.x = x - Camera.viewW() / 2;
      Camera.y = y - Camera.viewH() / 2;
      Camera.clampPos();
    },
    update: function (dt, tx, ty) {
      // 平滑跟随
      var gx = tx - Camera.viewW() / 2;
      var gy = ty - Camera.viewH() / 2;
      Camera.x += (gx - Camera.x) * Math.min(1, dt * 6);
      Camera.y += (gy - Camera.y) * Math.min(1, dt * 6);
      Camera.clampPos();
      if (Camera.shakeT > 0) Camera.shakeT -= dt;
    },
    clampPos: function () {
      Camera.x = G.U.clamp(Camera.x, 0, Math.max(0, Camera.mapW - Camera.viewW()));
      Camera.y = G.U.clamp(Camera.y, 0, Math.max(0, Camera.mapH - Camera.viewH()));
    },
    shake: function (power, time) {
      Camera.shakePower = Math.max(Camera.shakePower * 0.5, power);
      Camera.shakeT = Math.max(Camera.shakeT, time);
    },
    // 渲染偏移（含震屏；震屏幅度跟随特效强度设置）
    shakeK: function () {
      var v = (G.Meta && typeof G.Meta.fx === 'number') ? G.Meta.fx : 1;
      if (v < 0) v = 0; if (v > 1) v = 1;
      return 0.25 + 0.75 * v;
    },
    ox: function () {
      var s = Camera.shakeT > 0 ? Camera.shakePower * (Camera.shakeT / 0.35) * Camera.shakeK() : 0;
      return Camera.x + (Math.random() - 0.5) * s * 2;
    },
    oy: function () {
      var s = Camera.shakeT > 0 ? Camera.shakePower * (Camera.shakeT / 0.35) * Camera.shakeK() : 0;
      return Camera.y + (Math.random() - 0.5) * s * 2;
    }
  };
  G.Camera = Camera;
})();
