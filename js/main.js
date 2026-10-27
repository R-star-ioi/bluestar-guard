// 主控制器：状态机 / 主循环 / 触摸路由 / 经济与升级
var G = require('./boot.js');
(function () {
  var U = G.U, D = G.D;

  var Game = {
    state: 'menu',       // menu | playing | levelup | paused | gameover
    gold: 0, level: 1, xp: 0, xpNext: 5,
    kills: 0, playTime: 0,
    buffLevel: 0,
    base: null,
    panelHero: null,
    levelUpOptions: [],
    msg: null,
    drag: null,          // {hero, id, moved, sx, sy}
    joyId: null,
    best: { wave: 0, kills: 0 },
    baseDead: false,
    viewOx: 0, viewOy: 0,
    pendingLevels: 0,
    levelUpPhase: 'stat',
    skillPickOptions: [],
    currentLevel: 1,
    victory: null,

    init: function () {
      G.Input.init();
      G.Meta.load();
      Game.best = G.P.storage.get('lx_best', { lv: 1, wv: 0 });
      if (Game.best.wave !== undefined) { Game.best = { lv: 1, wv: 0 }; }
      var snd = G.P.storage.get('lx_sound', 1);
      G.Audio.enabled = !!snd;
      Game.setState('menu');
      Game.lastT = Date.now();
      var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
      var loop = function () {
        Game.tick();
        if (raf) raf(loop);
        else setTimeout(loop, 1000 / 60);
      };
      if (raf) raf(loop); else setTimeout(loop, 1000 / 60);
    },

    setState: function (s) {
      Game.state = s;
      if (s !== 'playing') {
        Game.panelHero = null;
        if (s !== 'levelup') { G.Input.joyReset(); Game.joyId = null; }
      }
    },

    // ============ 开局 ============
    startRun: function (level) {
      var D2 = D;
      level = level || G.Meta.selectedLevel || 1;
      // 关卡锁：必须先通关上一关
      if (level > G.Meta.maxLevel) {
        Game.showMsg('请先通关第 ' + G.Meta.maxLevel + ' 关', '#ff6b6b', 1.6);
        G.Audio.play('error');
        return;
      }
      Game.currentLevel = level;
      G.Meta.selectedLevel = level;
      G.Meta.save();
      Game.gold = D2.ECONOMY.START_GOLD;
      Game.level = 1; Game.xp = 0; Game.xpNext = 5;
      Game.kills = 0; Game.playTime = 0;
      Game.buffLevel = 0;
      Game.panelHero = null;
      Game.baseDead = false;
      Game.msg = null;
      Game.metaEarned = 0;
      Game.pendingLevels = 0;
      Game.victory = null;
      G.Skills.reset();
      G.FX.clear(); G.Proj.clear(); G.Pickup.clear(); G.Enemy.reset(); G.Hero.reset();
      G.Waves.reset(level);
      G.Player.reset();
      G.Player.stats = { atk: 0, aspeed: 0, multi: 0, pierce: 0, crit: 0, bigshot: 0, regen: 0, leech: 0, speed: 0, magnet: 0, gold: 0, allydmg: 0, allyspd: 0, waveAtk: 0 };
      Game.base = {
        x: D2.MAP_W / 2, y: D2.MAP_H / 2,
        hp: D2.BASE.HP, maxHp: D2.BASE.HP, r: D2.BASE.RADIUS
      };
      G.Camera.init(D2.MAP_W, D2.MAP_H);
      G.Camera.snapTo(G.Player.x, G.Player.y);
      // 开局送一个剑士
      G.Hero.add('sword', 1, Game);
      Game.setState('playing');
      Game.showMsg('守住水晶！', '#8fd3ff', 2);
      G.Audio.resume();
    },

    showMsg: function (text, color, life) {
      Game.msg = { text: text, color: color || '#ffd166', t: life || 2, life: life || 2 };
    },

    toast: function (text) {
      Game.showMsg(text, '#7bed9f', 1.4);
      G.Audio.play('button');
    },

    // ============ 经济 ============
    addGold: function (n) {
      Game.gold += n;
      // 局内金币同步累积为局外「升级金币」（1:1）
      Game.metaEarned = (Game.metaEarned || 0) + n;
      G.Meta.earn(n);
    },
    buffCost: function () { return Math.round(D.ECONOMY.BUFF_COST * Math.pow(D.ECONOMY.BUFF_GROWTH, Game.buffLevel)); },
    buyBuff: function () {
      var cost = Game.buffCost();
      if (Game.gold < cost) { G.Audio.play('error'); return; }
      Game.gold -= cost;
      Game.buffLevel++;
      G.Audio.play('upgrade');
      Game.showMsg('全体英雄伤害 +' + Math.round(Game.buffLevel * 15) + '%', '#bb8fce', 1.6);
      var b = Game.base;
      for (var i = 0; i < G.Hero.list.length; i++) {
        G.FX.ring(G.Hero.list[i].x, G.Hero.list[i].y, '#bb8fce', 30, 0.4, 2);
      }
    },
    repairBase: function () {
      if (Game.base.hp >= Game.base.maxHp || Game.gold < D.ECONOMY.REPAIR_COST) { G.Audio.play('error'); return; }
      Game.gold -= D.ECONOMY.REPAIR_COST;
      var v = Game.base.maxHp * D.ECONOMY.REPAIR_PCT;
      Game.base.hp = Math.min(Game.base.maxHp, Game.base.hp + v);
      G.Audio.play('heal');
      G.FX.ring(Game.base.x, Game.base.y, '#7bed9f', 70, 0.5, 4);
      G.FX.text(Game.base.x, Game.base.y - 60, '+' + Math.round(v), '#7bed9f', 16);
    },
    damageBase: function (dmg) {
      var b = Game.base;
      if (!b || b.hp <= 0) return;
      b.hp -= dmg;
      G.Audio.play('crystal');
      G.Camera.shake(3, 0.15);
      if (b.hp <= 0) {
        b.hp = 0;
        Game.baseDead = true;
        Game.gameOver();
      }
    },
    healBase: function (v) {
      var b = Game.base;
      if (!b || b.hp <= 0) return;
      b.hp = Math.min(b.maxHp, b.hp + v);
    },

    // ============ 经验与升级 ============
    addXp: function (n) {
      Game.xp += n;
      while (Game.xp >= Game.xpNext) {
        Game.xp -= Game.xpNext;
        Game.level++;
        Game.xpNext = Math.round(5 * Math.pow(1.28, Game.level - 1));
        Game.pendingLevels++;
      }
      if (Game.pendingLevels > 0 && Game.state === 'playing') {
        Game.openLevelUp();
      }
    },

    // 两阶段升级：先选属性强化，再选附加技能
    openLevelUp: function () {
      // 从未满级技能中随机3个
      var pool = [];
      var st = G.Player.stats;
      for (var i = 0; i < D.SKILLS.length; i++) {
        var s = D.SKILLS[i];
        if ((st[s.id] || 0) < s.max) pool.push(s);
      }
      var opts = [];
      var used = {};
      while (opts.length < 3 && pool.length > 0) {
        var idx = Math.floor(Math.random() * pool.length);
        var pick = pool.splice(idx, 1)[0];
        if (used[pick.id]) continue;
        used[pick.id] = 1;
        opts.push({
          id: pick.id, name: pick.name, icon: pick.icon,
          desc: pick.desc((st[pick.id] || 0) + 1), isFallback: false
        });
      }
      // 保底选项
      while (opts.length < 3) {
        var fb = D.SKILL_FALLBACKS[opts.length % D.SKILL_FALLBACKS.length];
        opts.push({ id: fb.id, name: fb.name, icon: fb.icon, desc: fb.desc(), isFallback: true });
      }
      Game.levelUpOptions = opts;
      Game.levelUpPhase = 'stat';
      Game.setState('levelup');
      G.Audio.play('levelup');
    },

    applyLevelUp: function (opt) {
      var st = G.Player.stats;
      switch (opt.id) {
        case 'healfull': G.Player.heal(G.Player.maxHp * 0.5); break;
        case 'bounty': Game.addGold(120); break;
        case 'hp':
          st.hp = (st.hp || 0) + 1;
          G.Player.maxHp += 30;
          G.Player.hp = Math.min(G.Player.maxHp, G.Player.hp + 30);
          break;
        default: st[opt.id] = (st[opt.id] || 0) + 1;
      }
      G.Audio.play('upgrade');
      G.FX.ring(G.Player.x, G.Player.y, '#ffd700', 50, 0.45, 3);
      // 进入附加技能选择阶段
      Game.skillPickOptions = G.Skills.options();
      if (Game.skillPickOptions.length === 0) {
        Game.finishLevelUp();
        return;
      }
      Game.levelUpPhase = 'skill';
    },

    chooseSkill: function (id) {
      G.Skills.choose(id);
      Game.finishLevelUp();
    },

    finishLevelUp: function () {
      Game.pendingLevels--;
      if (Game.pendingLevels > 0) {
        Game.openLevelUp(); // 还有待处理的升级
      } else {
        Game.setState('playing');
      }
    },

    // ============ 战斗辅助 ============
    findNearestEnemy: function (x, y, range) {
      var list = G.Enemy.list;
      var best = null, bestD = range * range;
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.dead) continue;
        var d = U.dist2(x, y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      return best;
    },

    damageEnemy: function (e, dmg, hx, hy, big) {
      // 暴击
      var crit = Math.random() < (G.Player.stats.crit * 0.08);
      if (crit) dmg *= 2;
      G.Enemy.damage(Game, e, dmg, hx, hy, big || crit);
      // 吸血
      var leech = G.Player.stats.leech * 0.02;
      if (leech > 0) G.Player.heal(dmg * leech * 0.5);
      if (crit) G.FX.ring(e.x, e.y, '#ffd700', 22, 0.25, 2);
    },

    onKill: function (e) {
      Game.kills++;
      G.Skills.onKill(e, Game);
      if (e.boss) {
        Game.showMsg('BOSS 击败！', '#ffd700', 2);
        G.Camera.shake(8, 0.4);
      }
    },

    onWaveStart: function (level, w, boss) {
      Game.showMsg(boss ? '⚠ 第 ' + w + '/' + D.LEVELS.WAVES + ' 波 · BOSS 来袭' : '第 ' + w + '/' + D.LEVELS.WAVES + ' 波来袭', boss ? '#ff6b6b' : '#ffd166', 2);
      if (boss) G.Camera.shake(5, 0.4);
    },

    onWaveClear: function (w) {
      // 波次清算：主角攻击成长（普通波 +4%，Boss 波 +12%）
      var gain = D.WAVE.ATK_PER_WAVE + (w % D.WAVE.BOSS_EVERY === 0 ? D.WAVE.ATK_BOSS_BONUS : 0);
      G.Player.stats.waveAtk += gain;
      var pct = Math.round(G.Player.stats.waveAtk * 100);
      Game.showMsg('第 ' + w + ' 波 已肃清 ✓  主角攻击 +' + Math.round(gain * 100) + '%', '#7bed9f', 1.6);
      G.FX.text(G.Player.x, G.Player.y - 30, '攻击 +' + Math.round(gain * 100) + '%', '#ff9f43', 15);
      G.FX.ring(G.Player.x, G.Player.y, '#ff9f43', 40, 0.4, 3);
      // 波奖励
      Game.addGold(5 + w);
      G.FX.text(Game.base.x, Game.base.y - 70, '波次奖励 +' + (5 + w) + '💰', '#ffd700', 15);
      G.Meta.save(); // 波次结束存档升级金币
    },

    // 通关：第20波清空（宝箱放回主界面领取）
    onLevelClear: function () {
      var pct = Game.base.hp / Game.base.maxHp;
      var boxes = [true, pct >= 0.7, pct >= 0.999];   // 保底1箱 / ≥70% / 满血
      Game.victory = { pct: pct, boxes: boxes, claimed: [false, false, false] };
      G.Meta.setChests(Game.currentLevel, boxes);   // 主界面领取
      G.Meta.unlockLevel(Game.currentLevel + 1);    // 通关即可解锁下一关（不论血量）
      G.Meta.save();
      G.Audio.play('levelup');
      G.Camera.shake(5, 0.4);
      Game.setState('victory');
    },

    // 主界面领取宝箱
    claimChest: function (i) {
      var amt = G.Meta.claimChest(i);
      if (!amt) { G.Audio.play('error'); return; }
      G.Audio.play('coin');
      Game.showMsg('+' + amt + ' 钻石', '#7ef9ff', 1.2);
      G.FX.text(G.Player.x, G.Player.y - 30, '+' + amt + ' 钻石', '#7ef9ff', 15);
    },

    nextLevel: function () {
      if (Game.currentLevel >= D.LEVELS.TOTAL) { Game.showMsg('已是最终关！', '#ffd166', 2); return; }
      Game.startRun(Game.currentLevel + 1);
    },

    gameOver: function () {
      // 更新纪录（关卡进度）
      if (Game.currentLevel > Game.best.lv || (Game.currentLevel === Game.best.lv && G.Waves.wave > (Game.best.wv || 0))) {
        Game.best = { lv: Game.currentLevel, wv: G.Waves.wave };
        G.P.storage.set('lx_best', Game.best);
      }
      G.Meta.save(); // 结算存档升级金币
      G.Audio.play('gameover');
      Game.setState('gameover');
    },

    // ============ 触摸路由 ============
    onWorldTouch: function (id, x, y) {
      if (Game.state === 'levelup' || Game.state === 'menu' || Game.state === 'heroes' || Game.state === 'changelog' || Game.state === 'gameover' || Game.state === 'paused') return;
      // 去重：部分环境同一指针的 start 会双发，80ms 内忽略重复
      var now = Date.now();
      if (!Game._tapAt) Game._tapAt = {};
      if (Game._tapAt[id] && now - Game._tapAt[id] < 150) return;
      Game._tapAt[id] = now;
      // 英雄面板打开时，点面板外关闭
      if (Game.panelHero) {
        Game.panelHero = null;
        return;
      }
      var wx = x + Game.viewOx, wy = y + Game.viewOy;
      // 优先英雄拖拽
      var h = G.Hero.hitTest(wx, wy);
      if (h) {
        Game.drag = { hero: h, id: id, moved: false, sx: x, sy: y };
        return;
      }
      // 摇杆（第一个空闲触摸）
      if (Game.joyId === null) {
        var j = G.Input.joystick;
        Game.joyId = id;
        j.active = true; j.id = id;
        j.bx = x; j.by = y;
        j.dx = 0; j.dy = 0; j.mag = 0;
      }
    },

    onWorldMove: function (id, x, y) {
      if (Game.state !== 'playing') return;
      // 摇杆
      if (Game.joyId === id) {
        var j = G.Input.joystick;
        var dx = x - j.bx, dy = y - j.by;
        var d = Math.sqrt(dx * dx + dy * dy);
        var R = 52;
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        j.dx = dx / R; j.dy = dy / R; j.mag = Math.min(1, d / R);
        return;
      }
      // 英雄拖拽
      if (Game.drag && Game.drag.id === id) {
        var wx = x + Game.viewOx, wy = y + Game.viewOy;
        if (U.dist2(x, y, Game.drag.sx, Game.drag.sy) > 14 * 14) Game.drag.moved = true;
        if (Game.drag.moved) {
          Game.drag.hero.x = wx;
          Game.drag.hero.y = wy;
        }
      }
    },

    onWorldEnd: function (id, x, y) {
      if (Game.joyId === id) {
        Game.joyId = null;
        G.Input.joyReset();
      }
      if (Game.drag && Game.drag.id === id) {
        var drag = Game.drag;
        Game.drag = null;
        if (Game.state !== 'playing') return;
        if (!drag.moved) {
          // 点按 → 信息面板
          Game.panelHero = drag.hero;
          G.Audio.play('button');
        } else {
          // 尝试合成
          var wx = x + Game.viewOx, wy = y + Game.viewOy;
          var other = G.Hero.hitTest(wx, wy);
          if (other && other !== drag.hero && G.Hero.canMerge(drag.hero, other)) {
            G.Hero.merge(drag.hero, other, Game);
          } else {
            // 归位
            G.Hero.relayout(Game);
          }
        }
      }
    },

    onResize: function () {
      if (Game.base) G.Camera.init(D.MAP_W, D.MAP_H);
    },

    // ============ 主循环 ============
    tick: function () {
      var now = Date.now();
      var dt = Math.min(0.05, (now - Game.lastT) / 1000);
      Game.lastT = now;

      // 单帧异常不终止循环（记录首个错误便于诊断）
      try {
        if (Game.state === 'playing') Game.update(dt);
      } catch (e) {
        Game.errCount = (Game.errCount || 0) + 1;
        if (Game.errCount <= 3) { console.error('[update]', e); if (typeof window !== 'undefined') window.__lastErr = e && e.stack; }
      }
      try {
        Game.render();
      } catch (e) {
        Game.errCount = (Game.errCount || 0) + 1;
        if (Game.errCount <= 3) { console.error('[render]', e); if (typeof window !== 'undefined') window.__lastErr = e && e.stack; }
      }
    },

    update: function (dt) {
      Game.playTime += dt;
      if (Game.msg) { Game.msg.t -= dt; if (Game.msg.t <= 0) Game.msg = null; }

      G.Player.update(dt, Game);
      G.Waves.update(dt, Game);
      G.Enemy.update(dt, Game);
      G.Hero.update(dt, Game);
      G.Proj.update(dt, Game);
      G.Pickup.update(dt, Game);
      G.Skills.update(dt, Game);
      G.FX.update(dt);
      G.Camera.update(dt, G.Player.x, G.Player.y);

      if (G.Player.dead) Game.gameOver();
    },

    render: function () {
      var ctx = G.P.ctx;
      var W = G.P.screenW, H = G.P.screenH;
      var ox, oy;
      if (Game.state === 'menu') {
        ox = 0; oy = 0;
      } else {
        ox = G.Camera.ox(); oy = G.Camera.oy();
      }
      Game.viewOx = ox; Game.viewOy = oy;

      ctx.setTransform(G.P.dpr, 0, 0, G.P.dpr, 0, 0);
      if (Game.state === 'menu' || Game.state === 'gameover' || Game.state === 'heroes' || Game.state === 'changelog' || Game.state === 'victory') {
        // 菜单/英雄/结算只画背景层
        if (Game.state === 'gameover' || Game.state === 'victory') {
          G.Bg.draw(ctx, ox, oy);
          G.Bg.drawBase(ctx, Game.base, ox, oy);
          G.Hero.draw(ctx, ox, oy);
        }
        G.UI.draw(ctx, Game);
        return;
      }

      // 世界层
      G.Bg.draw(ctx, ox, oy);
      G.Bg.drawBase(ctx, Game.base, ox, oy);
      G.Pickup.draw(ctx, ox, oy);
      G.Hero.draw(ctx, ox, oy);
      G.Enemy.draw(ctx, ox, oy);
      G.Player.draw(ctx, ox, oy);
      G.Skills.draw(ctx, ox, oy);
      G.Proj.draw(ctx, ox, oy);
      G.FX.draw(ctx, ox, oy);
      // 拖拽合成预览
      if (Game.drag && Game.drag.moved && Game.state === 'playing') {
        var dh = Game.drag.hero;
        G.Hero.drawRange(ctx, ox, oy, dh, D.HEROES[dh.cls].color);
        var other = G.Hero.hitTest(dh.x, dh.y);
        if (other && other !== dh && G.Hero.canMerge(dh, other)) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(other.x - ox, other.y - oy, 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffd700';
          ctx.fillText('合成 Lv' + (dh.lv + 1) + '!', other.x - ox, other.y - oy - 34);
        }
      }
      G.FX.drawTexts(ctx, ox, oy);

      // 经验条（屏幕最底部细条）
      var xpR = Math.min(1, Game.xp / Game.xpNext);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, H - 4, W, 4);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0, H - 4, W * xpR, 4);

      // UI 层
      G.UI.draw(ctx, Game);

      // 低血量红晕
      var hpr = G.Player.hp / G.Player.maxHp;
      if (Game.state === 'playing' && hpr < 0.3) {
        ctx.fillStyle = 'rgba(255,0,0,' + (0.12 + 0.08 * Math.sin(Date.now() / 200)) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }
  };

  G.game = Game;
  Game.grid = G.Grid; // 空间网格（enemy.js 已创建）
  if (typeof module !== 'undefined') module.exports = Game;
})();
