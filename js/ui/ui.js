// UI：立即模式按钮注册 + 全部界面绘制（HUD/三选一/英雄面板/菜单/结算/暂停）
var G = require('../boot.js');
(function () {
  var U = G.U, D = G.D;
  var UI = {
    buttons: [],   // 每帧重建 {id,x,y,w,h,onTap}
    frame: 0,

    begin: function () {
      UI.buttons.length = 0;
      UI.frame++;
    },
    reg: function (id, x, y, w, h, onTap) {
      UI.buttons.push({ id: id, x: x, y: y, w: w, h: h, onTap: onTap });
    },
    hitTest: function (x, y) {
      // 后注册的在上层，倒序命中
      for (var i = UI.buttons.length - 1; i >= 0; i--) {
        var b = UI.buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },

    // ---- 通用绘制 ----
    pill: function (ctx, x, y, w, h, bg, r) {
      ctx.fillStyle = bg || 'rgba(10,16,40,0.72)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r !== undefined ? r : h / 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
    },
    button: function (ctx, id, x, y, w, h, label, sub, color, onTap, disabled) {
      var a = disabled ? 0.45 : 1;
      ctx.globalAlpha = a;
      // 底
      var grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      UI.pill(ctx, x, y, w, h, 'rgba(12,20,48,0.9)', 12);
      ctx.fillStyle = grad;
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 10); ctx.fill();
      } else ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 11); ctx.stroke(); }
      // 文字
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      if (sub) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(label, x + w / 2, y + 20);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = sub.indexOf('金') >= 0 ? '#ffe082' : 'rgba(255,255,255,0.85)';
        ctx.fillText(sub, x + w / 2, y + 37);
      } else {
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(label, x + w / 2, y + h / 2 + 5);
      }
      ctx.globalAlpha = 1;
      if (!disabled) UI.reg(id, x, y, w, h, onTap);
    },

    // ================= 主界面 HUD =================
    drawHud: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var pl = G.Player;

      // 顶栏底
      UI.pill(ctx, 8, 8, W - 16, 58, 'rgba(8,12,32,0.62)', 14);

      // 玩家血条
      var hpw = Math.min(150, (W - 90) * 0.42);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(20, 18, hpw, 14, 7); ctx.fill(); }
      else ctx.fillRect(20, 18, hpw, 14);
      var hpr = Math.max(0, pl.hp / pl.maxHp);
      ctx.fillStyle = hpr > 0.5 ? '#2ecc71' : (hpr > 0.25 ? '#e67e22' : '#e74c3c');
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(21, 19, (hpw - 2) * hpr, 12, 6); ctx.fill(); }
      else ctx.fillRect(21, 19, (hpw - 2) * hpr, 12);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(pl.hp) + '/' + Math.round(pl.maxHp), 20 + hpw / 2, 28.5);

      // 击杀 / 时间
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textAlign = 'left';
      var wAtk = G.Player.stats && G.Player.stats.waveAtk ? Math.round(G.Player.stats.waveAtk * 100) : 0;
      ctx.fillText('☠ ' + game.kills + '   ⏱ ' + U.fmtTime(game.playTime) + '   ⚔ +' + wAtk + '%', 22, 48);
      ctx.fillText('👥 ' + G.Hero.list.length + '/' + D.HERO.MAX_COUNT, 110, 48);

      // 关卡与波次（中）
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('第 ' + game.currentLevel + ' 关 · ' + Math.max(1, G.Waves.wave) + '/' + D.LEVELS.WAVES + ' 波', W / 2, 30);
      var lbl = G.Waves.label();
      if (lbl) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = lbl.boss ? '#ff6b6b' : 'rgba(255,255,255,0.7)';
        ctx.fillText(lbl.boss ? '⚠ BOSS 波即将来袭' : lbl.txt, W / 2, 47);
      }

      // 右上资源栏：钻石 + 局内金币
      UI.pill(ctx, W - 192, 18, 62, 24, 'rgba(0,0,0,0.45)', 12);
      UI.drawDiamond(ctx, W - 180, 30, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.textAlign = 'center';
      ctx.fillText(String(G.Meta.diamonds), W - 150, 34);
      UI.pill(ctx, W - 126, 18, 62, 24, 'rgba(0,0,0,0.45)', 12);
      UI.drawCoin(ctx, W - 114, 30, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(String(game.gold), W - 84, 34);

      // 暂停按钮
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏸', W - 32, 38);
      UI.reg('pause', W - 54, 14, 44, 40, function () {
        G.Audio.play('button');
        game.setState('paused');
      });

      // Boss 血条
      var boss = null;
      for (var i = 0; i < G.Enemy.list.length; i++) if (G.Enemy.list[i].boss) { boss = G.Enemy.list[i]; break; }
      if (boss) {
        var bw = Math.min(320, W - 100);
        var bx = (W - bw) / 2, by = 74;
        UI.pill(ctx, bx - 6, by - 4, bw + 12, 22, 'rgba(40,0,0,0.7)', 10);
        ctx.fillStyle = '#3d0a0a';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill(); } else ctx.fillRect(bx, by, bw, 14);
        ctx.fillStyle = '#ff4757';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, (bw - 2) * Math.max(0, boss.hp / boss.maxHp), 12, 6); ctx.fill(); }
        else ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, boss.hp / boss.maxHp), 12);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('👑 星球掠夺者', W / 2, by + 11);
      }

      // 底部按钮排
      var bh = 50, gap = 8;
      var bw3 = Math.min(118, (W - 40 - gap * 2) / 3);
      var totalW = bw3 * 3 + gap * 2;
      var bx0 = (W - totalW) / 2;
      var by0 = H - bh - 14;
      var rc = G.Hero.recruitCost();
      UI.button(ctx, 'recruit', bx0, by0, bw3, bh, '招募英雄', '💰' + rc + (G.Hero.canRecruit() ? '' : ' 已满'), '#2d6cdf', function () {
        G.Hero.recruit(game);
      }, !G.Hero.canRecruit() || game.gold < rc);
      var buffCost = game.buffCost();
      UI.button(ctx, 'buff', bx0 + bw3 + gap, by0, bw3, bh, '全体强化', '💰' + buffCost + ' 伤+' + Math.round(game.buffLevel * 15 + 15) + '%', '#8e44ad', function () {
        game.buyBuff();
      }, game.gold < buffCost);
      var repairCost = D.ECONOMY.REPAIR_COST;
      var needRepair = game.base.hp < game.base.maxHp;
      UI.button(ctx, 'repair', bx0 + (bw3 + gap) * 2, by0, bw3, bh, '修复基地', needRepair ? '💰' + repairCost + ' +25%' : '完好', '#27ae60', function () {
        game.repairBase();
      }, !needRepair || game.gold < repairCost);

      // 附加技能栏
      var owned = Object.keys(G.Skills.owned);
      for (var si = 0; si < owned.length; si++) {
        var sid = owned[si];
        var sui = UI.SKILL_UI[sid];
        var slv = G.Skills.owned[sid];
        var px0 = 10 + si * 66, py0 = H - bh - 34;
        UI.pill(ctx, px0, py0, 62, 20, 'rgba(10,16,40,0.8)', 10);
        ctx.strokeStyle = sui.color;
        ctx.lineWidth = 1;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px0 + 0.5, py0 + 0.5, 61, 19, 10); ctx.stroke(); }
        ctx.fillStyle = sui.color;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sui.ch + ' ' + slv + (slv >= 5 ? '★' : ''), px0 + 31, py0 + 14);
      }

      // 摇杆
      var j = G.Input.joystick;
      if (j.active) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#8fd9ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(j.bx, j.by, 52, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#8fd9ff';
        ctx.beginPath(); ctx.arc(j.bx + j.dx * 40, j.by + j.dy * 40, 22, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },

    // 波次开场横幅 / 消息
    drawAnnounce: function (ctx, game) {
      if (!game.msg || game.msg.t <= 0) return;
      var W = G.P.screenW;
      var k = game.msg.t / game.msg.life;
      var a = k > 0.8 ? (1 - k) / 0.2 : Math.min(1, k / 0.15 + 0.2);
      ctx.globalAlpha = Math.min(1, a);
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 5;
      ctx.strokeText(game.msg.text, W / 2, G.P.screenH * 0.32);
      ctx.fillStyle = game.msg.color || '#ffd166';
      ctx.fillText(game.msg.text, W / 2, G.P.screenH * 0.32);
      ctx.globalAlpha = 1;
    },

    // ================= 升级三选一 =================
    drawLevelUp: function (ctx, game) {
      if (game.levelUpPhase === 'skill') { UI.drawSkillPick(ctx, game); return; }
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,8,24,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('⭐ 升级！', W / 2, H * 0.16);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('选择一项强化（Lv ' + game.level + '）', W / 2, H * 0.16 + 26);

      var opts = game.levelUpOptions || [];
      var cw = Math.min(340, W - 44), ch = 88;
      var cy = H * 0.24;
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i];
        var y = cy + i * (ch + 14);
        // 卡片
        var grad = ctx.createLinearGradient(0, y, 0, y + ch);
        grad.addColorStop(0, 'rgba(46,64,128,0.95)');
        grad.addColorStop(1, 'rgba(20,30,70,0.95)');
        ctx.fillStyle = grad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 14); ctx.fill(); }
        else ctx.fillRect((W - cw) / 2, y, cw, ch);
        ctx.strokeStyle = o.isFallback ? 'rgba(255,200,100,0.6)' : 'rgba(130,170,255,0.6)';
        ctx.lineWidth = 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 14); ctx.stroke(); }
        // 图标
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(o.icon, (W - cw) / 2 + 40, y + ch / 2 + 10);
        // 名称与描述
        ctx.textAlign = 'left';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(o.name, (W - cw) / 2 + 76, y + 34);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText(o.desc, (W - cw) / 2 + 76, y + 58);
        // 等级点
        if (!o.isFallback) {
          var lv = G.Player.stats[o.id] || 0;
          ctx.textAlign = 'right';
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#8fd9ff';
          ctx.fillText('Lv' + lv + '→' + (lv + 1), (W - cw) / 2 + cw - 14, y + 24);
        }
        (function (opt) {
          UI.reg('lu_' + opt.id, (W - cw) / 2, y, cw, ch, function () {
            game.applyLevelUp(opt);
          });
        })(o);
      }
    },

    // ================= 更新公告 =================
    drawChangelog: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      UI.button(ctx, 'cl_back', 12, 12, 88, 40, '‹ 返回', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('menu');
      });
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('更新公告', W / 2, 40);

      var y = 72;
      for (var i = 0; i < D.CHANGELOG.length; i++) {
        var c = D.CHANGELOG[i];
        if (y > H - 60) break;
        // 版本行
        ctx.textAlign = 'left';
        UI.pill(ctx, 14, y, 64, 20, 'rgba(0,0,0,0.4)', 10);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffd166';
        ctx.fillText(c.ver, 20, y + 14);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#8fd3ff';
        ctx.fillText(c.title, 90, y + 14);
        y += 26;
        for (var li = 0; li < c.lines.length; li++) {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.72)';
          ctx.fillText('· ' + c.lines[li], 24, y + 14);
          y += 18;
        }
        y += 10;
      }
      ctx.textAlign = 'center';
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('完整更新日志见 GitHub Releases 页', W / 2, H - 24);
    },

    // ================= 附加技能选择 =================
    SKILL_UI: {
      star: { color: '#8fd9ff', ch: '星' },
      echo: { color: '#a55eea', ch: '影' },
      shield: { color: '#7ef9ff', ch: '盾' },
      magnet: { color: '#ffd166', ch: '磁' },
      bomb: { color: '#ff9f43', ch: '爆' }
    },
    drawSkillPick: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(30,16,52,0.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#bb8fce';
      ctx.fillText('✦ 附加技能', W / 2, H * 0.15);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      var hint = G.Skills.count() >= D.ASKILL_MAX_COUNT ? '已持有 3 个技能，只能升级已有技能' : '与属性强化独立选择 · 最多持有 3 个';
      ctx.fillText(hint, W / 2, H * 0.15 + 26);

      var opts = game.skillPickOptions || [];
      var cw = Math.min(340, W - 44), ch = 80;
      var cy = H * 0.21;
      for (var i = 0; i < opts.length; i++) {
        var id = opts[i];
        var a = D.ASKILLS[id];
        var ui = UI.SKILL_UI[id];
        var cur = G.Skills.levelOf(id);
        var y = cy + i * (ch + 12);
        var grad = ctx.createLinearGradient(0, y, 0, y + ch);
        grad.addColorStop(0, 'rgba(64,48,110,0.95)');
        grad.addColorStop(1, 'rgba(30,22,58,0.95)');
        ctx.fillStyle = grad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 13); ctx.fill(); }
        else ctx.fillRect((W - cw) / 2, y, cw, ch);
        ctx.strokeStyle = ui.color;
        ctx.lineWidth = 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - cw) / 2, y, cw, ch, 13); ctx.stroke(); }
        // 图标
        ctx.fillStyle = ui.color;
        ctx.beginPath();
        ctx.arc((W - cw) / 2 + 36, y + ch / 2, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0a1e';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(ui.ch, (W - cw) / 2 + 36, y + ch / 2 + 6);
        // 名称与等级
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(a.name, (W - cw) / 2 + 68, y + 30);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = ui.color;
        ctx.fillText(cur === 0 ? 'NEW · 学得 Lv1' : 'Lv' + cur + ' → Lv' + (cur + 1) + (cur + 1 === a.max ? ' 【质变】' : ''), (W - cw) / 2 + 68, y + 48);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.fillText(a.desc(Math.min(cur + 1, a.max)), (W - cw) / 2 + 68, y + 66);
        (function (sid) {
          UI.reg('sk_' + sid, (W - cw) / 2, y, cw, ch, function () {
            game.chooseSkill(sid);
          });
        })(id);
      }
    },

    // ================= 英雄信息面板 =================
    drawHeroPanel: function (ctx, game) {
      var h = game.panelHero;
      if (!h) return;
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,8,24,0.6)';
      ctx.fillRect(0, 0, W, H);

      var pw = Math.min(320, W - 40), ph = 210;
      var px = (W - pw) / 2, py = H - ph - 90;
      ctx.fillStyle = 'rgba(14,22,52,0.97)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill(); }
      else ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(130,170,255,0.5)';
      ctx.lineWidth = 2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke(); }

      var c = D.HEROES[h.cls];
      var st = G.Hero.statOf(h);
      ctx.textAlign = 'left';
      G.Hero.drawIcon(ctx, h.cls, px + 34, py + 36, 1.5);
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(c.name + '  Lv' + h.lv + (h.lv >= D.HERO.MAX_LEVEL ? ' (MAX)' : ''), px + 60, py + 34);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(c.desc + (c.rare ? ' · 稀有' : ''), px + 60, py + 52);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (c.heal) {
        ctx.fillText('治疗：' + st.heal.toFixed(1) + ' / 次    间隔：' + st.interval.toFixed(2) + 's', px + 20, py + 84);
      } else {
        var dm = st.dmg * G.Hero.dmgMult();
        ctx.fillText('伤害：' + dm.toFixed(1) + ' / 发    间隔：' + (st.interval / G.Hero.spdMult()).toFixed(2) + 's', px + 20, py + 84);
        if (st.splash) ctx.fillText('溅射半径：' + st.splash, px + 20, py + 102);
      }
      // 同类合成提示
      var partner = null;
      for (var i = 0; i < G.Hero.list.length; i++) {
        var o = G.Hero.list[i];
        if (o !== h && G.Hero.canMerge(h, o)) { partner = o; break; }
      }
      ctx.font = '11px sans-serif';
      ctx.fillStyle = partner ? '#7bed9f' : 'rgba(255,255,255,0.5)';
      ctx.fillText(partner ? '💡 场上存在同名同级英雄，拖到它身上可合成 Lv' + (h.lv + 1) : '拖到同名同级英雄上可合成升级', px + 20, py + 122);

      var bw = (pw - 52) / 2;
      var upCost = G.Hero.upgradeCost(h);
      UI.button(ctx, 'hp_up', px + 18, py + 138, bw, 46, '升级', h.lv < D.HERO.MAX_LEVEL ? '💰' + upCost : '已满级', '#2d6cdf', function () {
        G.Hero.upgrade(h, game);
        if (h.lv >= D.HERO.MAX_LEVEL) game.panelHero = null;
      }, h.lv >= D.HERO.MAX_LEVEL || game.gold < upCost);
      UI.button(ctx, 'hp_sell', px + 34 + bw, py + 138, bw, 46, '出售', '+💰' + G.Hero.sellValue(h), '#c0392b', function () {
        G.Hero.sell(h, game);
        game.panelHero = null;
      });
      UI.reg('hp_close', px, py - 10, pw, 10, function () { game.panelHero = null; });
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('点此处关闭', W / 2, py - 16);
    },

    // ================= 主菜单 =================
    drawMenu: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var t = Date.now() / 1000;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // 装饰星星
      for (var i = 0; i < 40; i++) {
        var sx = U.seededRand(i * 3.1) * W, sy = U.seededRand(i * 5.7) * H;
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;

      // 左上角公告入口
      UI.button(ctx, 'changelog', 14, 14, 78, 34, '📢 公告', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('changelog');
      });

      // 右上角资源栏（钻石 / 升级金币）
      var rrx = W - 158, rry = 16;
      UI.pill(ctx, rrx, rry, 74, 26, 'rgba(0,0,0,0.45)', 13);
      UI.drawDiamond(ctx, rrx + 14, rry + 13, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.textAlign = 'center';
      ctx.fillText(String(G.Meta.diamonds), rrx + 42, rry + 18);
      UI.pill(ctx, rrx + 78, rry, 74, 26, 'rgba(0,0,0,0.45)', 13);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(rrx + 92, rry + 13, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(String(G.Meta.gold), rrx + 120, rry + 18);

      // ---- 标题区（logo 锁版）：标题 → 副标题 → 水晶徽记，自成一块，
      //      下方关卡卡片按这一块的高度定位，不再压住徽记 ----
      var ty = Math.max(92, H * 0.163);
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#8fd3ff';
      ctx.fillText('蓝星守卫', W / 2, ty);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('割草 × 塔防 × 英雄合成', W / 2, ty + 28);
      // 水晶徽记（矢量绘制，避免 emoji 缺字）
      UI.drawCrest(ctx, W / 2, ty + 51 + Math.sin(t * 1.6) * 1.5, W < 420 ? 9 : 11, t);

      // ---- 关卡选择 ----
      var lv = G.Meta.selectedLevel;
      var lvName = D.LEVELS.nameOf(lv);
      var y0 = ty + 75;
      UI.button(ctx, 'lv_prev', W / 2 - 178, y0, 52, 56, '◀', null, 'rgba(90,100,140,1)', function () {
        if (G.Meta.selectedLevel > 1) { G.Meta.selectedLevel--; G.Meta.save(); G.Audio.play('button'); }
        else G.Audio.play('error');
      }, G.Meta.selectedLevel <= 1);
      UI.pill(ctx, W / 2 - 118, y0, 236, 56, 'rgba(12,20,48,0.9)', 14);
      ctx.strokeStyle = 'rgba(130,170,255,0.5)';
      ctx.lineWidth = 2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W / 2 - 116.5, y0 + 1.5, 233, 53, 13); ctx.stroke(); }
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#8fd3ff';
      ctx.fillText('第 ' + lv + ' 关', W / 2, y0 + 24);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('· ' + lvName + ' ·', W / 2, y0 + 44);
      UI.button(ctx, 'lv_next', W / 2 + 126, y0, 52, 56, '▶', null, 'rgba(90,100,140,1)', function () {
        if (G.Meta.selectedLevel < D.LEVELS.TOTAL) { G.Meta.selectedLevel++; G.Meta.save(); G.Audio.play('button'); }
        else G.Audio.play('error');
      }, G.Meta.selectedLevel >= D.LEVELS.TOTAL);
      // 锁定提示 + 解锁进度
      var locked = lv > G.Meta.maxLevel;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = locked ? '#ff8b8b' : 'rgba(255,255,255,0.5)';
      ctx.fillText(locked ? ('🔒 未解锁 · 请先通关第 ' + G.Meta.maxLevel + ' 关') : ('已解锁 ' + G.Meta.maxLevel + '/' + D.LEVELS.TOTAL + ' 关'), W / 2, y0 + 70);

      // 通关宝箱（主界面领取）：只显示【当前选中关卡】自己的那一份
      var bx0 = W / 2 - 110, by0 = y0 + 80;
      var boxCols = ['#cd9a3c', '#8fa8d9', '#b56ce0'];
      var boxReqs = ['任意通关', '≥70%血量', '满血通关'];
      var ch = G.Meta.chestOf(lv);
      var hasChests = !!ch;
      // 其他关卡还有没领的，给个提示（宝箱是按关记的，换关才领得到）
      var pendOther = 0;
      for (var ck in G.Meta.chests) {
        if (G.Meta.chests.hasOwnProperty(ck) && parseInt(ck, 10) !== lv) pendOther += G.Meta.pendingChests(parseInt(ck, 10));
      }
      for (var bi = 0; bi < 3; bi++) {
        var bcx = bx0 + bi * 76 + 30;
        var got = hasChests && ch.boxes[bi];
        var claimed = hasChests && ch.claimed[bi];
        var st = !hasChests ? 'locked' : (claimed ? 'opened' : (got ? null : 'locked'));
        var bob = got && !claimed ? Math.sin(Date.now() / 300 + bi * 2) * 1.5 : 0;
        UI.drawChest(ctx, bcx - 17, by0 + bob, 34, 28, boxCols[bi], st);
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px sans-serif';
        if (!hasChests) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillText('通关后开启', bcx, by0 + 40);
        } else if (claimed) {
          ctx.fillStyle = '#7bed9f';
          ctx.fillText('✓ 已领取', bcx, by0 + 40);
        } else if (got) {
          ctx.fillStyle = '#7ef9ff';
          ctx.fillText('+' + D.LEVELS.BOX_REWARDS[bi] + '钻', bcx, by0 + 40);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillText('需' + boxReqs[bi], bcx, by0 + 40);
        }
        ctx.font = '9px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(!hasChests ? '' : (claimed ? '已开启' : (got ? '点击领取' : boxReqs[bi])), bcx, by0 + 52);
        // 可领取的箱子可点击（按关卡领取）
        if (got && !claimed) {
          UI.reg('chest_' + bi, bcx - 30, by0 - 6, 60, 62, (function (idx, l) {
            return function () { game.claimChest(l, idx); };
          })(bi, lv));
        }
      }
      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      if (hasChests) {
        ctx.fillText('第 ' + lv + ' 关宝箱' + (pendOther ? '　·　其他关待领 ' + pendOther + ' 个' : ''), W / 2, by0 + 66);
      } else if (pendOther) {
        ctx.fillStyle = '#ffd166';
        ctx.fillText('本关暂无宝箱　·　其他关待领 ' + pendOther + ' 个', W / 2, by0 + 66);
      }

      // 开始挑战（未解锁前一关则不可点击）
      // 按钮位置跟随上方内容下沿，避免矮屏上宝箱与按钮重叠
      var startY = Math.max(H * 0.425, by0 + 90);
      // 矮屏压缩下半段行距，保证说明文字不会顶到底部版本号
      var gs = Math.min(1, (H - 46 - startY) / 271);
      if (gs < 0.7) gs = 0.7;
      UI.button(ctx, 'start', W / 2 - 100, startY, 200, 56, locked ? '🔒 未解锁' : '▶ 开始挑战', locked ? '先通关第 ' + G.Meta.maxLevel + ' 关' : ('第 ' + lv + ' 关 · ' + lvName), '#2d6cdf', function () {
        game.startRun(G.Meta.selectedLevel);
      }, locked);
      // 英雄按钮（局外成长）
      UI.button(ctx, 'heroes', W / 2 - 100, startY + 66 * gs, 200, 50, '🦸 英雄', '选择与升级主角', '#8e44ad', function () {
        G.Audio.play('button');
        game.setState('heroes');
      });
      // 当前主角 + 升级金币 + 纪录（合并两行，避免与说明重叠）
      var sel = G.Meta.protoStats(G.Meta.selected);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('当前主角：' + sel.name + ' Lv' + sel.level + '　·　升级金币 ' + G.Meta.gold, W / 2, startY + 148 * gs);
      var best = game.best;
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,215,0,0.85)';
      ctx.fillText('👑 最佳纪录：第 ' + (best.lv || 1) + ' 关 · 第 ' + (best.wv || 0) + ' 波', W / 2, startY + 192 * gs);

      // 玩法说明
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      var lines = [
        '拖动屏幕移动，自动攻击',
        '金币招募英雄守卫水晶 · 同名同级英雄拖拽合成',
        '升级三选一随机技能 · 第10/20波BOSS守关',
        '捡到的金币可在「英雄」页升级主角属性'
      ];
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], W / 2, startY + (220 + li * 17) * gs);
      }
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(D.VERSION + ' · 浏览器预览版（微信小游戏同源代码）', W / 2, H - 18);
    },

    // ================= 英雄选择与升级（局外成长） =================
    drawHeroes: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 顶栏
      UI.button(ctx, 'back', 12, 12, 88, 40, '‹ 返回', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('menu');
      });
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('英雄', W / 2, 42);
      UI.pill(ctx, W - 128, 16, 116, 30, 'rgba(0,0,0,0.45)', 15);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('升级金币 ' + G.Meta.gold, W - 70, 35);

      var B = D.META.BONUS;
      var ch = 126, gap = 8;
      var y0 = 64;
      for (var i = 0; i < D.META.PROTO_ORDER.length; i++) {
        var cls = D.META.PROTO_ORDER[i];
        var p = D.PROTOS[cls];
        var unlocked = !!G.Meta.unlocked[cls];
        var lv = G.Meta.levelOf(cls);
        var st = G.Meta.protoStats(cls);
        var selected = G.Meta.selected === cls;
        var y = y0 + i * (ch + gap);
        var cw = W - 24, x = 12;

        // 卡片底
        var cardGrad = ctx.createLinearGradient(0, y, 0, y + ch);
        if (selected) {
          cardGrad.addColorStop(0, 'rgba(64,84,158,0.97)');
          cardGrad.addColorStop(1, 'rgba(28,40,86,0.97)');
        } else {
          cardGrad.addColorStop(0, 'rgba(40,52,96,0.95)');
          cardGrad.addColorStop(1, 'rgba(18,26,58,0.95)');
        }
        ctx.fillStyle = cardGrad;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 14); ctx.fill(); }
        else ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = selected ? 'rgba(255,209,102,0.9)' : 'rgba(130,170,255,0.4)';
        ctx.lineWidth = selected ? 2.5 : 1.5;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 14); ctx.stroke(); }
        if (!unlocked) {
          ctx.fillStyle = 'rgba(4,8,24,0.55)';
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 14); ctx.fill(); }
          else ctx.fillRect(x, y, cw, ch);
        }

        // 图标 + 名称
        ctx.globalAlpha = unlocked ? 1 : 0.35;
        G.Hero.drawIcon(ctx, cls, x + 34, y + 38, 1.5);
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, x + 62, y + 30);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(p.desc, x + 62, y + 48);
        // 属性（基础+升级合成）
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        var aps = (1 / st.interval).toFixed(1);
        ctx.fillText('生命 ' + st.maxHp + '   攻击 ' + st.dmg.toFixed(1) + '   攻速 ' + aps + '/s', x + 62, y + 70);
        if (unlocked) {
          var k = lv - 1;
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#7bed9f';
          ctx.fillText(k > 0 ? ('Lv' + lv + ' · 生命+' + Math.round(B.hp * k * 100) + '% 攻击+' + Math.round(B.dmg * k * 100) + '% 攻速+' + Math.round(B.aspeed * k * 100) + '%') : 'Lv1 · 基础形态', x + 62, y + 90);
        } else {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#ffd166';
          ctx.fillText('🔒 未解锁', x + 62, y + 90);
        }
        ctx.globalAlpha = 1;

        // 按钮
        var bw = 96, bh = 40;
        var by = y + ch - bh - 10;
        if (!unlocked) {
          var uc = G.Meta.unlockCost(cls);
          UI.button(ctx, 'unl_' + cls, x + cw - bw - 14, y + (ch - bh) / 2, bw, bh, '解锁', '💰' + uc, '#8e44ad', (function (c) {
            return function () {
              if (G.Meta.unlock(c)) game.toast('已解锁 ' + D.PROTOS[c].name + '！');
              else game.toast('升级金币不足');
            };
          })(cls), G.Meta.gold < uc);
        } else {
          // 选择
          if (selected) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#ffd166';
            ctx.fillText('✓ 使用中', x + cw - bw - 14 + bw / 2, by + bh / 2 + 4);
          } else {
            UI.button(ctx, 'sel_' + cls, x + cw - bw - 14, by, bw, bh, '选择', null, '#2d6cdf', (function (c) {
              return function () { G.Meta.select(c); };
            })(cls));
          }
          // 升级
          var maxed = lv >= D.META.MAX_LV;
          var upCost = G.Meta.upgradeCost(cls);
          UI.button(ctx, 'mup_' + cls, x + cw - bw * 2 - 24, by, bw, bh, '升级',
            maxed ? '已满级' : '💰' + upCost, '#27ae60',
            (function (c) {
              return function () {
                if (G.Meta.upgrade(c)) game.toast(D.PROTOS[c].name + ' 升到 Lv' + G.Meta.levelOf(c) + '！');
                else game.toast('升级金币不足');
              };
            })(cls), maxed || G.Meta.gold < upCost);
        }
      }
    },

    // 宝箱矢量绘制（左上角x,y，宽w高h）；state: null | 'opened' | 'locked'
    drawChest: function (ctx, x, y, w, h, color, state) {
      var opened = state === 'opened';
      var lidY = opened ? y - h * 0.22 : y;   // 已打开：盖子向上掀起
      // 箱体
      ctx.fillStyle = opened ? 'rgba(60,44,20,0.95)' : color;
      ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y + h * 0.35, w, h * 0.12);
      // 描边
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y + h * 0.35, w, h * 0.65);
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.35); ctx.lineTo(x + w, y + h * 0.35);
      ctx.stroke();
      // 已打开：内部光芒
      if (opened) {
        var g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 1, x + w / 2, y + h * 0.4, w * 0.6);
        g.addColorStop(0, 'rgba(255,240,160,0.85)');
        g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h * 0.4, w * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // 飞出的钻石
        UI.drawDiamond(ctx, x + w / 2, y + h * 0.42, w * 0.18, '#7ef9ff');
      }
      // 箱盖
      ctx.fillStyle = opened ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, lidY, w, h * 0.3);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeRect(x, lidY, w, h * 0.3);
      // 锁扣
      if (!opened) {
        ctx.fillStyle = state === 'locked' ? 'rgba(200,205,220,0.6)' : '#ffe082';
        ctx.fillRect(x + w / 2 - 3, y + h * 0.3, 6, 8);
      }
      if (state === 'locked') {
        ctx.fillStyle = 'rgba(10,14,30,0.5)';
        ctx.fillRect(x, y, w, h);
      }
    },

    // 主菜单 logo 徽记：光晕 + 水晶 + 两侧渐隐纹线（主菜单标题区专用）
    drawCrest: function (ctx, cx, cy, r, t) {
      // 光晕
      var halo = ctx.createRadialGradient(cx, cy, 1, cx, cy, r * 3.4);
      halo.addColorStop(0, 'rgba(126,249,255,0.28)');
      halo.addColorStop(0.5, 'rgba(90,160,255,0.10)');
      halo.addColorStop(1, 'rgba(90,160,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3.4, 0, Math.PI * 2);
      ctx.fill();
      // 两侧渐隐纹线
      var lw = r * 6;
      for (var s = -1; s <= 1; s += 2) {
        var lx = cx + s * (r * 1.7);
        var lg = ctx.createLinearGradient(lx, 0, lx + s * lw, 0);
        lg.addColorStop(0, 'rgba(143,211,255,0.55)');
        lg.addColorStop(1, 'rgba(143,211,255,0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, cy);
        ctx.lineTo(lx + s * lw, cy);
        ctx.stroke();
      }
      // 水晶本体（呼吸光晕）
      ctx.save();
      ctx.shadowColor = 'rgba(126,249,255,0.85)';
      ctx.shadowBlur = 10 + 4 * Math.sin(t * 2);
      UI.drawDiamond(ctx, cx, cy, r, '#a9e8ff');
      ctx.restore();
      // 侧翼小晶体
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2 + 1);
      UI.drawDiamond(ctx, cx - r * 2.6, cy, r * 0.36, '#7ecbff');
      UI.drawDiamond(ctx, cx + r * 2.6, cy, r * 0.36, '#7ecbff');
      ctx.globalAlpha = 1;
    },

    // 资源图标（矢量）
    drawDiamond: function (ctx, x, y, r, color) {
      ctx.fillStyle = color || '#7ef9ff';
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.72, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.72, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.72, y);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
    },
    drawCoin: function (ctx, x, y, r) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#fff59d';
      ctx.fillRect(x - 1, y - r * 0.5, 2, r);
    },

    // ================= 通关结算 =================
    drawVictory: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var v = game.victory;
      if (!v) return;
      ctx.fillStyle = 'rgba(6,10,28,0.88)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🏆 第 ' + game.currentLevel + ' 关 通关！', W / 2, H * 0.11);

      // 基地血量条
      var bw = Math.min(280, W - 80), bx = (W - bw) / 2, by = H * 0.16;
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('基地剩余血量 ' + Math.ceil(v.pct * 100) + '%', W / 2, by - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill(); }
      else ctx.fillRect(bx, by, bw, 14);
      var hpCol = v.pct >= 0.999 ? '#ffd700' : (v.pct >= 0.7 ? '#2ecc71' : (v.pct >= 0.3 ? '#e67e22' : '#e74c3c'));
      ctx.fillStyle = hpCol;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, (bw - 2) * Math.max(0, v.pct), 12, 6); ctx.fill(); }
      else ctx.fillRect(bx + 1, by + 1, (bw - 2) * Math.max(0, v.pct), 12);

      // 通关宝箱提示（回到主界面领取）
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('通关宝箱已放回主界面', W / 2, by + 56);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('可领取 ' + v.boxes.filter(function (b) { return b; }).length + ' 个宝箱 · 满血最高 ' + (D.LEVELS.BOX_REWARDS[0] + D.LEVELS.BOX_REWARDS[1] + D.LEVELS.BOX_REWARDS[2]) + ' 钻石', W / 2, by + 78);

      // 钻石余额
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.fillText('💎 钻石 ' + G.Meta.diamonds, W / 2, by + 116);

      // 按钮
      var by0 = by + 150;
      var hasNext = game.currentLevel < D.LEVELS.TOTAL;
      UI.button(ctx, 'v_next', W / 2 - 110, by0, 220, 52, hasNext ? '▶ 下一关（第 ' + (game.currentLevel + 1) + ' 关）' : '已是最终关', null, '#2d6cdf', function () {
        game.nextLevel();
      }, !hasNext);
      UI.button(ctx, 'v_home', W / 2 - 110, by0 + 64, 220, 46, '🏠 回到主页领宝箱', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
      UI.button(ctx, 'v_retry', W / 2 - 110, by0 + 122, 220, 46, '↻ 重打本关', null, 'rgba(90,100,140,1)', function () {
        game.startRun(game.currentLevel);
      });
    },

    // ================= 结算 =================
    drawGameOver: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,6,18,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText(game.baseDead ? '🏰 基地陷落' : '💀 你倒下了', W / 2, H * 0.2);

      var pw = Math.min(320, W - 60), px = (W - pw) / 2, py = H * 0.26;
      ctx.fillStyle = 'rgba(14,22,52,0.95)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, 225, 16); ctx.fill(); }
      else ctx.fillRect(px, py, pw, 225);

      var rows = [
        ['关卡进度', '第 ' + game.currentLevel + ' 关 · ' + G.Waves.wave + '/' + D.LEVELS.WAVES + ' 波'],
        ['击杀敌人', String(game.kills)],
        ['存活时间', U.fmtTime(game.playTime)],
        ['英雄等级', String(game.level)],
        ['升级金币', '+' + (game.metaEarned || 0)]
      ];
      for (var i = 0; i < rows.length; i++) {
        var ry = py + 34 + i * 34;
        ctx.textAlign = 'left';
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(rows[i][0], px + 30, ry);
        ctx.textAlign = 'right';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = rows[i][0] === '升级金币' ? '#7bed9f' : '#ffd166';
        ctx.fillText(rows[i][1], px + pw - 30, ry);
      }
      var isBest = G.Waves.wave >= game.best.wave && game.kills >= game.best.kills && game.kills > 0;
      if (isBest) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('🎉 新纪录！', W / 2, py + 205);
      }

      UI.button(ctx, 'retry', W / 2 - 110, py + 250, 220, 52, '↻ 再来一局', null, '#2d6cdf', function () {
        game.startRun();
      });
      UI.button(ctx, 'toheroes', W / 2 - 110, py + 314, 220, 46, '🦸 升级英雄', '+' + (game.metaEarned || 0) + ' 升级金币', '#8e44ad', function () {
        game.setState('heroes');
      });
      UI.button(ctx, 'home', W / 2 - 110, py + 372, 220, 46, '🏠 回到主页', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
    },

    // ================= 暂停 =================
    drawPaused: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(4,8,24,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('⏸ 已暂停', W / 2, H * 0.24);

      UI.button(ctx, 'resume', W / 2 - 100, H * 0.34, 200, 52, '▶ 继续游戏', null, '#2d6cdf', function () {
        game.setState('playing');
      });
      UI.button(ctx, 'sound', W / 2 - 100, H * 0.34 + 64, 200, 46, G.Audio.enabled ? '🔊 音效：开' : '🔇 音效：关', null, 'rgba(90,100,140,1)', function () {
        G.Audio.enabled = !G.Audio.enabled;
        if (G.Audio.enabled) G.Audio.resume();
        G.P.storage.set('lx_sound', G.Audio.enabled ? 1 : 0);
      });
      UI.button(ctx, 'restart', W / 2 - 100, H * 0.34 + 122, 200, 46, '↻ 重新开始', null, '#8e44ad', function () {
        game.startRun();
      });
      UI.button(ctx, 'quit', W / 2 - 100, H * 0.34 + 180, 200, 46, '🏠 回到主页', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
    },

    // ================= 总绘制入口 =================
    draw: function (ctx, game) {
      UI.begin();
      switch (game.state) {
        case 'menu': UI.drawMenu(ctx, game); break;
        case 'heroes': UI.drawHeroes(ctx, game); break;
        case 'changelog': UI.drawChangelog(ctx, game); break;
        case 'playing':
          UI.drawHud(ctx, game);
          if (game.panelHero) UI.drawHeroPanel(ctx, game);
          UI.drawAnnounce(ctx, game);
          break;
        case 'levelup':
          UI.drawHud(ctx, game);
          UI.drawLevelUp(ctx, game);
          break;
        case 'paused': UI.drawHud(ctx, game); UI.drawPaused(ctx, game); break;
        case 'gameover': UI.drawGameOver(ctx, game); break;
        case 'victory': UI.drawVictory(ctx, game); break;
      }
    }
  };
  G.UI = UI;
})();
