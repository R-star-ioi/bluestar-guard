// 输入系统：UI 命中优先，其余交给 Game（摇杆 / 英雄拖拽）
var G = require('../boot.js');
(function () {
  var Input = {
    joystick: { active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0, mag: 0 },
    uiTouches: {}, // touchId -> 按钮id（被 UI 消费的触摸）
    init: function () {
      G.P.onTouch = function (type, id, x, y) {
        var game = G.game;
        if (!game) return;
        if (type === 'start') {
          // 设置页：音量滑条优先于普通按钮（滑条区域被全屏 set_block 按钮盖住，走不了按钮路由）
          if (game.state === 'settings' && G.UI && G.UI.sliderHit) {
            var tid = G.UI.sliderHit(x, y);
            if (tid) {
              Input.uiTouches[id] = 'slider:' + tid;
              if (!game.sliderDrag) game.sliderDrag = { id: id, tid: tid };
              G.UI.setSliderFromX(tid, x);
              return;
            }
          }
          var btn = G.UI ? G.UI.hitTest(x, y) : null;
          if (btn && btn.onTap) {
            Input.uiTouches[id] = btn.id;
            btn.onTap();
            return;
          }
          game.onWorldTouch(id, x, y);
        } else if (type === 'move') {
          var t = Input.uiTouches[id];
          if (t !== undefined) {
            // 设置页滑条：按住滑动实时调整音量
            if (typeof t === 'string' && t.indexOf('slider:') === 0 &&
                game.sliderDrag && game.sliderDrag.id === id && game.sliderDrag.tid === t.slice(7)) {
              G.UI.setSliderFromX(game.sliderDrag.tid, x);
            }
            return;
          }
          game.onWorldMove(id, x, y);
        } else {
          if (Input.uiTouches[id] !== undefined) {
            delete Input.uiTouches[id];
            // 设置页滑条：松手落盘
            if (game.state === 'settings' && game.sliderDrag) {
              game.sliderDrag = null;
              if (G.Meta) G.Meta.save();
            }
            return;
          }
          game.onWorldEnd(id, x, y);
        }
      };
    },
    joyReset: function () {
      var j = Input.joystick;
      j.active = false; j.id = null; j.dx = 0; j.dy = 0; j.mag = 0;
    }
  };

  G.Input = Input;
})();
