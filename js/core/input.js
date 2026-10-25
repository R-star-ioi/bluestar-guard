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
          var btn = G.UI ? G.UI.hitTest(x, y) : null;
          if (btn && btn.onTap) {
            Input.uiTouches[id] = btn.id;
            btn.onTap();
            return;
          }
          game.onWorldTouch(id, x, y);
        } else if (type === 'move') {
          if (Input.uiTouches[id] !== undefined) return;
          game.onWorldMove(id, x, y);
        } else {
          if (Input.uiTouches[id] !== undefined) {
            delete Input.uiTouches[id];
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
