// 音频：WebAudio 程序化合成音效（零素材），微信下同样可用
var G = require('../boot.js');
(function () {
  var Audio = {
    ctx: null, enabled: true, lastPlay: {},
    ensure: function () {
      if (Audio.ctx || !Audio.enabled) return;
      try {
        var AC = (typeof wx !== 'undefined' && wx.createWebAudioContext)
          ? wx.createWebAudioContext()
          : (window.AudioContext || window.webkitAudioContext);
        if (!AC) { Audio.enabled = false; return; }
        Audio.ctx = new AC();
      } catch (e) { Audio.enabled = false; }
    },
    resume: function () {
      Audio.ensure();
      if (Audio.ctx && Audio.ctx.state === 'suspended') {
        try { Audio.ctx.resume(); } catch (e) { }
      }
    },
    // 基础音：振荡器 + 音量包络
    tone: function (freq, freqEnd, dur, vol, type, delay) {
      if (!Audio.enabled) return;
      Audio.ensure();
      if (!Audio.ctx) return;
      try {
        var c = Audio.ctx, t0 = c.currentTime + (delay || 0);
        var o = c.createOscillator(), g = c.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (freqEnd && freqEnd !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { }
    },
    noise: function (dur, vol, delay) {
      if (!Audio.enabled) return;
      Audio.ensure();
      if (!Audio.ctx) return;
      try {
        var c = Audio.ctx, t0 = c.currentTime + (delay || 0);
        var len = Math.max(1, Math.floor(c.sampleRate * dur));
        var buf = c.createBuffer(1, len, c.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = c.createBufferSource(); src.buffer = buf;
        var g = c.createGain(); g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(g); g.connect(c.destination);
        src.start(t0);
      } catch (e) { }
    },
    play: function (name) {
      if (!Audio.enabled) return;
      // 限制同类音效最小间隔，防止爆音
      var now = Date.now(), min = { shoot: 70, hit: 40, coin: 50, pick: 60, hurt: 150 }[name] || 60;
      if (Audio.lastPlay[name] && now - Audio.lastPlay[name] < min) return;
      Audio.lastPlay[name] = now;
      switch (name) {
        case 'shoot': Audio.tone(880, 660, 0.06, 0.06, 'square'); break;
        case 'arrow': Audio.tone(1300, 900, 0.05, 0.05, 'triangle'); break;
        case 'hit': Audio.tone(200, 120, 0.05, 0.07, 'sawtooth'); break;
        case 'kill': Audio.noise(0.1, 0.1); Audio.tone(300, 80, 0.12, 0.08, 'sawtooth'); break;
        case 'coin': Audio.tone(1200, 1800, 0.08, 0.06, 'sine'); break;
        case 'pick': Audio.tone(600, 900, 0.07, 0.05, 'sine'); break;
        case 'hurt': Audio.tone(160, 70, 0.18, 0.12, 'sawtooth'); break;
        case 'heal': Audio.tone(500, 800, 0.15, 0.06, 'sine'); Audio.tone(750, 1200, 0.15, 0.05, 'sine', 0.08); break;
        case 'recruit': Audio.tone(400, 800, 0.15, 0.08, 'triangle'); break;
        case 'merge': Audio.tone(500, 1000, 0.12, 0.08, 'sine'); Audio.tone(750, 1500, 0.18, 0.07, 'sine', 0.1); break;
        case 'upgrade': Audio.tone(600, 1200, 0.12, 0.07, 'sine'); break;
        case 'levelup': [523, 659, 784, 1047].forEach(function (f, i) { Audio.tone(f, f, 0.15, 0.08, 'sine', i * 0.09); }); break;
        case 'boss': [220, 185, 147].forEach(function (f, i) { Audio.tone(f, f * 0.8, 0.3, 0.12, 'sawtooth', i * 0.25); }); break;
        case 'wave': Audio.tone(440, 440, 0.1, 0.06, 'sine'); Audio.tone(660, 660, 0.12, 0.06, 'sine', 0.12); break;
        case 'boom': Audio.noise(0.4, 0.25); Audio.tone(120, 40, 0.4, 0.2, 'sawtooth'); break;
        case 'button': Audio.tone(700, 500, 0.05, 0.05, 'square'); break;
        case 'error': Audio.tone(200, 150, 0.12, 0.08, 'square'); break;
        case 'crystal': Audio.tone(900, 300, 0.25, 0.15, 'sawtooth'); break;
        case 'gameover': [400, 330, 262, 196].forEach(function (f, i) { Audio.tone(f, f * 0.9, 0.3, 0.1, 'sine', i * 0.22); }); break;
      }
    }
  };
  G.Audio = Audio;
})();
