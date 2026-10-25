// 平台适配层：统一微信小游戏 / 浏览器 的画布、触摸、存储、震动
var G = require('../boot.js');
(function () {
  var P = {};
  P.isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';

  if (P.isWx) {
    var info = wx.getSystemInfoSync();
    P.screenW = info.screenWidth || info.windowWidth || 375;
    P.screenH = info.screenHeight || info.windowHeight || 667;
    P.dpr = Math.min(info.pixelRatio || 1, 2);
    P.canvas = wx.createCanvas();
  } else {
    P.canvas = document.createElement('canvas');
    P.canvas.style.position = 'fixed';
    P.canvas.style.left = '0';
    P.canvas.style.top = '0';
    P.canvas.style.background = '#05070f';
    document.body.appendChild(P.canvas);
    P.dpr = Math.min(window.devicePixelRatio || 1, 2);
    P.screenW = window.innerWidth;
    P.screenH = window.innerHeight;
  }

  function setup() {
    P.canvas.width = Math.round(P.screenW * P.dpr);
    P.canvas.height = Math.round(P.screenH * P.dpr);
    if (P.canvas.style) {
      P.canvas.style.width = P.screenW + 'px';
      P.canvas.style.height = P.screenH + 'px';
    }
    P.ctx = P.canvas.getContext('2d');
    P.ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
  }
  setup();

  if (!P.isWx) {
    window.addEventListener('resize', function () {
      P.screenW = window.innerWidth;
      P.screenH = window.innerHeight;
      setup();
      if (G.game && G.game.onResize) G.game.onResize();
    });
  }

  // ---- 触摸 ----
  P.onTouch = null; // 由 Input 注入: function(type, id, x, y)
  function emit(type, id, x, y) {
    if (P.onTouch) {
      try { P.onTouch(type, id, x, y); } catch (e) { console.error(e); }
    }
  }

  if (P.isWx) {
    function each(e, type) {
      var list = e.changedTouches || e.touches || [];
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        var x = (t.x !== undefined && t.x !== null) ? t.x : t.clientX;
        var y = (t.y !== undefined && t.y !== null) ? t.y : t.clientY;
        if (x === undefined) continue;
        emit(type, 't' + t.identifier, x, y);
      }
    }
    wx.onTouchStart(function (e) { each(e, 'start'); });
    wx.onTouchMove(function (e) { each(e, 'move'); });
    wx.onTouchEnd(function (e) { each(e, 'end'); });
    wx.onTouchCancel(function (e) { each(e, 'end'); });
  } else {
    var opt = { passive: false };
    P.canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        emit('start', 't' + t.identifier, t.clientX, t.clientY);
      }
    }, opt);
    P.canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        emit('move', 't' + t.identifier, t.clientX, t.clientY);
      }
    }, opt);
    var endFn = function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        emit('end', 't' + t.identifier, t.clientX, t.clientY);
      }
    };
    P.canvas.addEventListener('touchend', endFn, opt);
    P.canvas.addEventListener('touchcancel', endFn, opt);

    // 鼠标兜底（桌面调试）
    var mouseDown = false;
    P.canvas.addEventListener('mousedown', function (e) {
      mouseDown = true;
      emit('start', 'mouse', e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', function (e) {
      if (mouseDown) emit('move', 'mouse', e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', function (e) {
      if (mouseDown) { mouseDown = false; emit('end', 'mouse', e.clientX, e.clientY); }
    });
  }

  // ---- 存储 ----
  P.storage = {
    get: function (k, d) {
      try {
        if (P.isWx) {
          var v = wx.getStorageSync(k);
          return (v === '' || v === undefined || v === null) ? d : v;
        }
        var s = localStorage.getItem(k);
        return s == null ? d : JSON.parse(s);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try {
        if (P.isWx) wx.setStorageSync(k, v);
        else localStorage.setItem(k, JSON.stringify(v));
      } catch (e) { }
    }
  };

  P.vibrate = function () {
    if (P.isWx && wx.vibrateShort) {
      try { wx.vibrateShort({ type: 'light' }); } catch (e) { }
    }
  };

  G.P = P;
})();
