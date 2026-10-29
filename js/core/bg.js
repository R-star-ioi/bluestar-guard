// 地图背景：深空渐变 + 网格地面 + 星尘 + 基地平台
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var Bg = {
    draw: function (ctx, ox, oy) {
      // 视距缩放（苍穹视界）下世界层整体被缩放绘制，
      // 背景必须覆盖缩放后的可见世界范围，否则屏幕右/下边缘残留旧帧
      var W = (G.Camera && G.Camera.viewW) ? G.Camera.viewW() : G.P.screenW;
      var H = (G.Camera && G.Camera.viewH) ? G.Camera.viewH() : G.P.screenH;
      // 深空底色
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#141b3d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 星尘（固定世界坐标，视差滚动）
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < 60; i++) {
        var sx = U.seededRand(i * 3.7) * D.MAP_W;
        var sy = U.seededRand(i * 7.3) * D.MAP_H;
        var px = sx - ox * 0.5, py = sy - oy * 0.5;
        px = ((px % W) + W) % W;
        py = ((py % H) + H) % H;
        var tw = 0.25 + 0.2 * Math.sin(Date.now() / 700 + i);
        ctx.globalAlpha = tw * 0.6;
        var s = (i % 5 === 0) ? 2 : 1.2;
        ctx.fillRect(px, py, s, s);
      }
      ctx.globalAlpha = 1;

      // 地面网格（限制在地图范围内）
      var step = 100;
      var x0 = Math.max(0, Math.floor(ox / step) * step);
      var y0 = Math.max(0, Math.floor(oy / step) * step);
      var x1 = Math.min(D.MAP_W, ox + W);
      var y1 = Math.min(D.MAP_H, oy + H);
      ctx.strokeStyle = 'rgba(122,146,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = x0; gx <= x1; gx += step) {
        ctx.moveTo(gx - ox, 0); ctx.lineTo(gx - ox, H);
      }
      for (var gy = y0; gy <= y1; gy += step) {
        ctx.moveTo(0, gy - oy); ctx.lineTo(W, gy - oy);
      }
      ctx.stroke();

      // 地图边界警示
      ctx.strokeStyle = 'rgba(255,107,107,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(-ox, -oy, D.MAP_W, D.MAP_H);
      ctx.setLineDash([]);

      // 地图外的暗化
      ctx.fillStyle = 'rgba(3,5,12,0.55)';
      if (ox < 0) ctx.fillRect(0, 0, -ox, H);
      if (oy < 0) ctx.fillRect(0, 0, W, -oy);
      if (ox + W > D.MAP_W) ctx.fillRect(D.MAP_W - ox, 0, ox + W - D.MAP_W, H);
      if (oy + H > D.MAP_H) ctx.fillRect(0, D.MAP_H - oy, W, oy + H - D.MAP_H);
    },

    // 基地水晶单独绘制（含血条）
    drawBase: function (ctx, base, ox, oy) {
      if (!base) return;
      var sx = base.x - ox, sy = base.y - oy;
      var t = Date.now() / 1000;

      // 基地平台
      ctx.fillStyle = 'rgba(90,140,255,0.10)';
      ctx.beginPath();
      ctx.arc(sx, sy, base.r + 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(122,170,255,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(sx, sy, base.r + 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 水晶光影
      var pulse = 1 + Math.sin(t * 2.2) * 0.05;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(t * 0.6) * 0.1);
      ctx.scale(pulse, pulse);
      var g = ctx.createLinearGradient(0, -34, 0, 34);
      var hpk = base.hp / base.maxHp;
      g.addColorStop(0, hpk > 0.4 ? '#8fd3ff' : '#ff9f9f');
      g.addColorStop(1, hpk > 0.4 ? '#2d6cdf' : '#c0392b');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -base.r * 1.25);
      ctx.lineTo(base.r * 0.75, 0);
      ctx.lineTo(0, base.r * 1.25);
      ctx.lineTo(-base.r * 0.75, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 内芯
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -base.r * 0.45);
      ctx.lineTo(base.r * 0.28, 0);
      ctx.lineTo(0, base.r * 0.45);
      ctx.lineTo(-base.r * 0.28, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 血条（受创后显示）
      if (base.hp < base.maxHp) {
        var w = 90, y0 = sy - base.r - 26;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(sx - w / 2, y0, w, 7);
        ctx.fillStyle = base.hp / base.maxHp > 0.4 ? '#4aa3ff' : '#ff4757';
        ctx.fillRect(sx - w / 2 + 1, y0 + 1, (w - 2) * Math.max(0, base.hp / base.maxHp), 5);
      }

      // 世界吞噬者战：基地保护罩（无敌，青色能量穹顶）
      var dv = G.Devourer;
      if (dv && dv.active) {
        var fa = (G.FX && G.FX.alpha) ? G.FX.alpha() : 1;
        var pr = base.r + 30 + Math.sin(t * 3) * 3;
        var sg = ctx.createRadialGradient(sx, sy, pr * 0.35, sx, sy, pr);
        sg.addColorStop(0, 'rgba(126,249,255,0)');
        sg.addColorStop(0.75, 'rgba(126,249,255,' + (0.10 * fa) + ')');
        sg.addColorStop(1, 'rgba(126,249,255,' + (0.34 * fa) + ')');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(126,249,255,' + (0.55 + 0.25 * Math.sin(t * 4)) * fa + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.stroke();
        // 罩顶标记
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(126,249,255,0.9)';
        ctx.fillText('护盾中', sx, sy - pr - 8);
      }
    }
  };
  G.Bg = Bg;
})();
