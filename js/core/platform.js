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
    P.canvas.style.background = '#0a1030';
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
      P.checkViewport();
    });
  }

  // 每帧自检视口：最大化、滚动条出现/消失、开发者工具开合等场景
  // 不一定触发 resize 事件（或延迟），靠轮询兜底，画布永远铺满窗口
  P.checkViewport = function () {
    if (P.isWx) return false;
    var w = window.innerWidth, h = window.innerHeight;
    if (w !== P.screenW || h !== P.screenH) {
      P.screenW = w;
      P.screenH = h;
      setup();
      if (G.game && G.game.onResize) G.game.onResize();
      return true;
    }
    return false;
  };

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

  // ---- 图片（武器贴图等）：两端同一套接口 ----
  P._imgCache = {};
  P.loadImage = function (src) {
    var rec = P._imgCache[src];
    if (rec) return rec;
    rec = { img: null, ready: false, failed: false };
    try {
      var img = P.isWx ? wx.createImage() : new Image();
      img.onload = function () { rec.ready = true; };
      img.onerror = function () { rec.failed = true; };
      img.src = src;
      rec.img = img;
      if (!P.isWx && img.complete && img.width) rec.ready = true;
    } catch (e) { rec.failed = true; }
    P._imgCache[src] = rec;
    return rec;
  };

  // ---- 文本输入（兑换码等）：web 用临时 DOM input，微信用小游戏键盘 ----
  P.askText = function (opts) {
    opts = opts || {};
    var finished = false;
    function finish(val) {
      if (finished) return;
      finished = true;
      if (opts.onDone) opts.onDone(val);
    }
    if (P.isWx) {
      try {
        var onConfirm = null, onComplete = null;
        function cleanup() {
          try {
            if (onConfirm) wx.offKeyboardConfirm(onConfirm);
            if (onComplete) wx.offKeyboardComplete(onComplete);
            wx.hideKeyboard({});
          } catch (e) { }
        }
        onConfirm = function (res) { cleanup(); finish(res.value || ''); };
        onComplete = function (res) { cleanup(); finish(res.value || ''); };
        wx.onKeyboardConfirm(onConfirm);
        wx.onKeyboardComplete(onComplete);
        wx.showKeyboard({
          defaultValue: opts.value || '', maxLength: opts.maxLength || 24,
          multiple: false, confirmHold: false, confirmType: 'done'
        });
      } catch (e) { finish(''); }
      return;
    }

    // Web：临时输入框浮在画布上
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = opts.value || '';
    inp.maxLength = opts.maxLength || 24;
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('spellcheck', 'false');
    inp.style.cssText = [
      'position:fixed', 'left:50%', 'top:46%', 'transform:translate(-50%,-50%)',
      'width:min(300px, 76vw)', 'padding:13px 16px', 'z-index:99999',
      'background:rgba(12,20,48,0.97)', 'color:#fff',
      'border:2px solid #7ef9ff', 'border-radius:12px',
      'font:bold 16px/1.2 sans-serif', 'text-align:center', 'letter-spacing:2px',
      'outline:none', 'box-shadow:0 0 24px rgba(126,249,255,0.35)'
    ].join(';');
    document.body.appendChild(inp);
    function close(val) {
      if (inp.parentNode) inp.parentNode.removeChild(inp);
      finish(val);
    }
    inp.addEventListener('input', function () { if (opts.onInput) opts.onInput(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); close(inp.value); }
      else if (e.key === 'Escape') { e.preventDefault(); close(opts.value || ''); }
    });
    inp.addEventListener('blur', function () { close(inp.value); });
    setTimeout(function () { try { inp.focus(); } catch (e) { } }, 30);
  };

  // ---- 背景音乐（真实音频文件；与 audio.js 的合成音效互不影响）----
  var bgm = null, bgmBase = 0.6;   // bgmBase：Boss 自带基准；实际音量 = bgmBase × Meta.bgmVol
  P.playBgm = function (src, vol) {
    P.stopBgm();
    try {
      bgmBase = vol || 0.6;
      var userV = (G.Meta && typeof G.Meta.bgmVol === 'number') ? G.Meta.bgmVol : 1;
      if (P.isWx) {
        bgm = wx.createInnerAudioContext();
        bgm.src = src;
        bgm.loop = true;
        bgm.volume = bgmBase * userV;
        bgm.play();
      } else if (typeof Audio !== 'undefined') {
        bgm = new Audio(encodeURI(src));
        bgm.loop = true;
        bgm.volume = bgmBase * userV;
        var pr = bgm.play();
        if (pr && pr.catch) pr.catch(function () { });   // 自动播放策略：失败则等下一次交互
      }
    } catch (e) { bgm = null; }
  };
  P.stopBgm = function () {
    if (!bgm) return;
    try {
      if (bgm.pause) bgm.pause();
      if (bgm.destroy) bgm.destroy();
      if (bgm.src && bgm.removeAttribute) bgm.removeAttribute('src');
    } catch (e) { }
    bgm = null;
  };
  // 设置里拖动「音乐大小」时实时调（保持 Boss 自带基准）
  P.setBgmVolume = function (userV) {
    if (bgm && bgm.volume !== undefined) {
      try { bgm.volume = bgmBase * userV; } catch (e) { }
    }
  };
  P.bgmAlive = function () { return !!bgm; };

  G.P = P;
})();
