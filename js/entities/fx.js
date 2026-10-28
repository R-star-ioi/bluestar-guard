// 特效：粒子池、伤害飘字、光圈波纹
var G = require('../boot.js');
(function () {
  var U = G.U;
  var FX = {
    parts: [], texts: [], rings: [],
    MAX: 420,

    burst: function (x, y, n, color, speed, life, size) {
      for (var i = 0; i < n; i++) {
        if (FX.parts.length >= FX.MAX) FX.parts.shift();
        var a = Math.random() * Math.PI * 2;
        var sp = U.rand(0.3, 1) * (speed || 120);
        FX.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: U.rand(0.5, 1) * (life || 0.5), t: 0,
          size: U.rand(0.6, 1.3) * (size || 3.5),
          color: color, drag: 0.9
        });
      }
    },
    // 定向喷溅（受击方向）
    spray: function (x, y, ang, n, color, speed, life, size) {
      for (var i = 0; i < n; i++) {
        if (FX.parts.length >= FX.MAX) FX.parts.shift();
        var a = ang + U.rand(-0.7, 0.7);
        var sp = U.rand(0.4, 1) * (speed || 140);
        FX.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: U.rand(0.5, 1) * (life || 0.4), t: 0,
          size: U.rand(0.6, 1.2) * (size || 3), color: color, drag: 0.88
        });
      }
    },
    text: function (x, y, str, color, size, crit) {
      if (FX.texts.length > 40) FX.texts.shift();
      FX.texts.push({
        x: x + U.rand(-8, 8), y: y, str: str, t: 0,
        life: crit ? 0.9 : 0.6, color: color || '#fff',
        size: size || 13, crit: !!crit
      });
    },
    ring: function (x, y, color, maxR, life, width) {
      FX.rings.push({ x: x, y: y, t: 0, life: life || 0.35, maxR: maxR || 60, color: color || '#fff', width: width || 3 });
    },

    update: function (dt) {
      var i;
      for (i = FX.parts.length - 1; i >= 0; i--) {
        var p = FX.parts[i];
        p.t += dt;
        if (p.t >= p.life) { FX.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= p.drag; p.vy *= p.drag;
      }
      for (i = FX.texts.length - 1; i >= 0; i--) {
        var tx = FX.texts[i];
        tx.t += dt;
        if (tx.t >= tx.life) { FX.texts.splice(i, 1); continue; }
        tx.y -= 42 * dt;
      }
      for (i = FX.rings.length - 1; i >= 0; i--) {
        FX.rings[i].t += dt;
        if (FX.rings[i].t >= FX.rings[i].life) FX.rings.splice(i, 1);
      }
    },

    // 特效强度（设置里可调 0~1），只影响粒子/光圈/震屏，不影响伤害飘字
    alpha: function () {
      var v = (G.Meta && typeof G.Meta.fx === 'number') ? G.Meta.fx : 1;
      return v < 0 ? 0 : (v > 1 ? 1 : v);
    },

    draw: function (ctx, ox, oy) {
      var fa = FX.alpha();
      if (fa <= 0.02) return;
      var i, a;
      for (i = 0; i < FX.parts.length; i++) {
        var p = FX.parts[i];
        a = 1 - p.t / p.life;
        ctx.globalAlpha = a * fa;
        ctx.fillStyle = p.color;
        var s = p.size * (0.4 + 0.6 * a);
        ctx.fillRect(p.x - ox - s / 2, p.y - oy - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      for (i = 0; i < FX.rings.length; i++) {
        var r = FX.rings[i];
        var k = r.t / r.life;
        ctx.globalAlpha = (1 - k) * fa;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x - ox, r.y - oy, 6 + (r.maxR - 6) * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },

    drawTexts: function (ctx, ox, oy) {
      for (var i = 0; i < FX.texts.length; i++) {
        var t = FX.texts[i];
        var k = t.t / t.life;
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : (1 - (k - 0.15) / 0.85);
        // 暴击：冒出来时先放大再回落
        var pop = (t.crit && t.t < 0.12) ? 1.28 - (t.t / 0.12) * 0.28 : 1;
        ctx.font = 'bold ' + Math.round(t.size * pop) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = t.crit ? 'rgba(60,0,0,0.85)' : 'rgba(0,0,0,0.7)';
        ctx.lineWidth = t.crit ? 4.5 : 3;
        var sx = t.x - ox, sy = t.y - oy;
        ctx.strokeText(t.str, sx, sy);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, sx, sy);
      }
      ctx.globalAlpha = 1;
    },

    clear: function () {
      FX.parts.length = 0;
      FX.texts.length = 0;
      FX.rings.length = 0;
    }
  };
  G.FX = FX;
})();
