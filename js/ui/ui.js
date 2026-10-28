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
        if (h >= 44) {
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(label, x + w / 2, y + 20);
          ctx.font = '11px sans-serif';
          ctx.fillStyle = sub.indexOf('金') >= 0 ? '#ffe082' : 'rgba(255,255,255,0.85)';
          ctx.fillText(sub, x + w / 2, y + 37);
        } else {
          // 紧凑按钮（34px 高，英雄页三连按钮用）
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(label, x + w / 2, y + 14);
          ctx.font = '9px sans-serif';
          ctx.fillStyle = sub.indexOf('金') >= 0 ? '#ffe082' : 'rgba(255,255,255,0.85)';
          ctx.fillText(sub, x + w / 2, y + 27);
        }
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

      // 击杀 / 时间 / 加成 / 英雄（图标各占固定槽位，数字左缘对齐，不再忽宽忽窄挤在一起）
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      var wAtk = G.Player.stats && G.Player.stats.waveAtk ? Math.round(G.Player.stats.waveAtk * 100) : 0;
      var segs = [
        { icon: '☠', val: String(game.kills), color: 'rgba(255,255,255,0.78)' },
        { icon: '⏱', val: U.fmtTime(game.playTime), color: 'rgba(255,255,255,0.78)' },
        { icon: '⚔', val: '+' + wAtk + '%', color: 'rgba(255,255,255,0.78)' },
        { icon: '👥', val: G.Hero.list.length + '/' + D.HERO.MAX_COUNT, color: 'rgba(180,190,230,0.85)' }
      ];
      var segGap = 12, segX = 22;
      for (var sg = 0; sg < segs.length; sg++) {
        ctx.textAlign = 'center';
        ctx.fillStyle = segs[sg].color;
        ctx.fillText(segs[sg].icon, segX + 7, 48);       // 图标居中在 14px 槽里
        ctx.textAlign = 'left';
        ctx.fillText(segs[sg].val, segX + 17, 48);       // 数字固定从槽后开始
        segX += 17 + ctx.measureText(segs[sg].val).width + segGap;
      }

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

      // 右上资源栏：只显示局内金币（钻石是局外资源，回主界面才展示）
      var gw = 74;
      var gx = W - 60 - gw;
      UI.pill(ctx, gx, 18, gw, 24, 'rgba(0,0,0,0.45)', 12);
      UI.drawCoin(ctx, gx + 15, 30, 7);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText(String(game.gold), gx + gw / 2 + 8, 34);

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

      // 附加技能栏（整体居中）
      var owned = Object.keys(G.Skills.owned);
      if (owned.length) {
        var spw = 62, sgap = 4;
        var sTotal = owned.length * spw + (owned.length - 1) * sgap;
        var sx0 = (W - sTotal) / 2;
        for (var si = 0; si < owned.length; si++) {
          var sid = owned[si];
          var sui = UI.SKILL_UI[sid];
          var slv = G.Skills.owned[sid];
          var px0 = sx0 + si * (spw + sgap), py0 = H - bh - 34;
          UI.pill(ctx, px0, py0, spw, 20, 'rgba(10,16,40,0.8)', 10);
          ctx.strokeStyle = sui.color;
          ctx.lineWidth = 1;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px0 + 0.5, py0 + 0.5, spw - 1, 19, 10); ctx.stroke(); }
          ctx.fillStyle = sui.color;
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sui.ch + ' ' + slv + (slv >= 5 ? '★' : ''), px0 + spw / 2, py0 + 14);
        }
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

    // 波次开场横幅 / 消息（支持 '\n' 换行，多行时整体居中）
    drawAnnounce: function (ctx, game, yPct) {
      if (!game.msg || game.msg.t <= 0) return;
      var W = G.P.screenW, H = G.P.screenH;
      var k = game.msg.t / game.msg.life;
      var a = k > 0.8 ? (1 - k) / 0.2 : Math.min(1, k / 0.15 + 0.2);
      ctx.globalAlpha = Math.min(1, a);
      ctx.textAlign = 'center';
      var lines = String(game.msg.text).split('\n');
      var lh = lines.length > 1 ? 32 : 0;
      var baseY = H * (yPct || 0.32);
      var startY = baseY - (lines.length - 1) * lh / 2;
      for (var i = 0; i < lines.length; i++) {
        var isTitle = i === 0;
        ctx.font = isTitle ? 'bold 26px sans-serif' : 'bold 19px sans-serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = isTitle ? 5 : 4;
        ctx.strokeText(lines[i], W / 2, startY + i * lh);
        ctx.fillStyle = game.msg.color || '#ffd166';
        ctx.fillText(lines[i], W / 2, startY + i * lh);
      }
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
      // 英雄 / 背包 / 抽武器（三连，等宽不越界）
      var mgap = 8;
      var mw = Math.min(118, (W - 40 - mgap * 2) / 3);
      var mtotal = mw * 3 + mgap * 2;
      var mx0 = (W - mtotal) / 2;
      var mrowY = startY + 66 * gs;
      UI.button(ctx, 'heroes', mx0, mrowY, mw, 50, '🦸 英雄', '选择/升级', '#8e44ad', function () {
        G.Audio.play('button');
        game.setState('heroes');
      });
      UI.button(ctx, 'bag', mx0 + mw + mgap, mrowY, mw, 50, '📦 背包', '武器', 'rgba(90,100,140,1)', function () {
        game.openBag();
      });
      UI.button(ctx, 'gacha', mx0 + (mw + mgap) * 2, mrowY, mw, 50, '🎁 抽武器', '60钻/抽', '#c0392b', function () {
        game.openGacha();
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
      // 右下角设置入口
      var gR = 21, gcx = W - 30 - gR, gcy = H - 62;
      UI.pill(ctx, gcx - gR, gcy - gR, gR * 2, gR * 2, 'rgba(20,32,72,0.95)', gR);
      ctx.strokeStyle = 'rgba(150,190,255,0.65)';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(gcx - gR + 1, gcy - gR + 1, gR * 2 - 2, gR * 2 - 2, gR); ctx.stroke(); }
      ctx.textAlign = 'center';
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#eaf2ff';
      ctx.fillText('⚙️', gcx, gcy + 8);
      UI.reg('settings', gcx - gR, gcy - gR, gR * 2, gR * 2, function () {
        G.Audio.play('button');
        game.settingsBack = 'menu';
        game.setState('settings');
      });

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
      var list = D.META.PROTO_ORDER;
      var ch = 140, gap = 10, y0 = 64;
      var viewTop = 58;
      var contentH = y0 + list.length * (ch + gap);
      var maxScroll = Math.max(0, contentH - H + 16);
      var sy = Math.min(Math.max(0, game.heroScroll || 0), maxScroll);
      game.heroScroll = sy;

      // 列表区：可上下拖动滚动
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, viewTop, W, H - viewTop);
      ctx.clip();

      for (var i = 0; i < list.length; i++) {
        var cls = list[i];
        var p = D.PROTOS[cls];
        var unlocked = !!G.Meta.unlocked[cls];
        var lv = G.Meta.levelOf(cls);
        var st = G.Meta.protoStats(cls);
        var selected = G.Meta.selected === cls;
        var y = y0 + i * (ch + gap) - sy;
        if (y + ch < viewTop || y > H) continue;   // 完全滚出视野：不画也不注册按钮
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

        // 右侧操作列（升级 / 武器 / 选择，竖排三连，全部落在卡片内）
        var bw2 = 92, bh2 = 34;
        var bx2 = x + cw - bw2 - 14;
        var txW = Math.max(80, bx2 - (x + 62) - 12);

        // 图标 + 名称 + 简介
        ctx.globalAlpha = unlocked ? 1 : 0.35;
        G.Hero.drawIcon(ctx, cls, x + 34, y + 40, 1.5);
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, x + 62, y + 30);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(p.desc, x + 62, y + 48, txW);
        // 属性（基础+升级合成）
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText('生命 ' + st.maxHp + '   攻击 ' + st.dmg.toFixed(1) + '   攻速 ' + (1 / st.interval).toFixed(1) + '/s', x + 62, y + 72, txW);
        // 等级与加成（拆两行，宽度受限自动压缩，不会伸到按钮下面）
        if (unlocked) {
          var k = lv - 1;
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#7bed9f';
          if (k > 0) {
            ctx.fillText('Lv' + lv + ' · 生命+' + Math.round(B.hp * k * 100) + '%   攻击+' + Math.round(B.dmg * k * 100) + '%', x + 62, y + 92, txW);
            ctx.font = '10px sans-serif';
            ctx.fillText('攻速+' + Math.round(B.aspeed * k * 100) + '%   移速+' + Math.round(B.speed * k * 100) + '%', x + 62, y + 110, txW);
          } else {
            ctx.fillText('Lv1 · 基础形态', x + 62, y + 92);
          }
        } else {
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#ffd166';
          ctx.fillText('🔒 未解锁', x + 62, y + 92);
        }
        ctx.globalAlpha = 1;

        // 按钮
        if (!unlocked) {
          var uc = G.Meta.unlockCost(cls);
          UI.button(ctx, 'unl_' + cls, bx2, y + (ch - bh2) / 2, bw2, bh2, '解锁', '💰' + uc, '#8e44ad', (function (c) {
            return function () {
              if (G.Meta.unlock(c)) game.toast('已解锁 ' + D.PROTOS[c].name + '！');
              else game.toast('升级金币不足');
            };
          })(cls), G.Meta.gold < uc);
        } else {
          // 升级
          var maxed = lv >= D.META.MAX_LV;
          var upCost = G.Meta.upgradeCost(cls);
          UI.button(ctx, 'mup_' + cls, bx2, y + 12, bw2, bh2, '升级',
            maxed ? '已满级' : '💰' + upCost, '#27ae60',
            (function (c) {
              return function () {
                if (G.Meta.upgrade(c)) game.toast(D.PROTOS[c].name + ' 升到 Lv' + G.Meta.levelOf(c) + '！');
                else game.toast('升级金币不足');
              };
            })(cls), maxed || G.Meta.gold < upCost);
          // 武器（升级与选择中间）
          var eqw = G.Weapon ? G.Weapon.equipped(cls) : null;
          UI.button(ctx, 'wep_' + cls, bx2, y + 52, bw2, bh2, '武器',
            eqw ? G.Weapon.label(eqw) : '未装备', '#8e5bd0',
            (function (c) {
              return function () { game.openWeapons(c); };
            })(cls));
          // 选择 / 使用中
          if (selected) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#ffd166';
            ctx.fillText('✓ 使用中', bx2 + bw2 / 2, y + 92 + bh2 / 2 + 4);
          } else {
            UI.button(ctx, 'sel_' + cls, bx2, y + 92, bw2, bh2, '选择', null, '#2d6cdf', (function (c) {
              return function () { G.Meta.select(c); };
            })(cls));
          }
        }
      }
      ctx.restore();

      // 滚动条（内容超出才显示）
      if (maxScroll > 0) {
        var trackY = viewTop + 4, trackH = H - trackY - 10;
        var thumbH = Math.max(30, trackH * (H - viewTop) / contentH);
        var thumbY = trackY + (trackH - thumbH) * (sy / maxScroll);
        UI.pill(ctx, W - 5, thumbY, 3, thumbH, 'rgba(130,170,255,0.45)', 2);
      }
    },

    // ================= 武器：卡面 / 列表 / 抽卡 =================
    drawStar: function (ctx, cx, cy, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rad = (i % 2 === 0) ? r : r * 0.45;
        var px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    },

    // 卡背（抽卡未翻开时）
    drawCardBack: function (ctx, x, y, w, h) {
      var r = Math.min(14, w * 0.16);
      var g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#2a3a6e');
      g.addColorStop(0.5, '#16204a');
      g.addColorStop(1, '#2a3a6e');
      ctx.fillStyle = g;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
      else ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(143,211,255,0.75)';
      ctx.lineWidth = 2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r); ctx.stroke(); }
      // 中央菱形纹
      ctx.strokeStyle = 'rgba(143,211,255,0.45)';
      ctx.lineWidth = 1.5;
      var cx = x + w / 2, cy = y + h / 2, d = Math.min(w, h) * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d * 0.7, cy);
      ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d * 0.7, cy);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, d * 1.5, 0, Math.PI * 2); ctx.stroke();
    },

    // 武器卡：品质底 + 图 + 边框 + 星级
    drawWeaponCard: function (ctx, x, y, w, h, cls, tier, star, opts) {
      opts = opts || {};
      var T = G.Weapon.TIERS[tier] || G.Weapon.TIERS[0];
      var r = Math.min(14, w * 0.16);
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, T.deep);
      g.addColorStop(0.5, 'rgba(12,18,40,0.94)');
      g.addColorStop(1, 'rgba(6,10,22,0.97)');
      ctx.fillStyle = g;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
      else ctx.fillRect(x, y, w, h);

      var pad = Math.max(4, w * 0.07);
      var starsH = 14;
      var iw = w - pad * 2, ih = h - pad * 2 - starsH;
      var side = Math.max(18, Math.min(iw, ih));
      var ix = x + (w - side) / 2, iy = y + pad + (ih - side) / 2;
      var rec = G.Weapon.img(cls, tier);
      ctx.save();
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(ix, iy, side, side, Math.max(4, r * 0.55)); ctx.clip(); }
      if (rec && rec.ready && rec.img) {
        ctx.drawImage(rec.img, ix, iy, side, side);
      } else {
        ctx.fillStyle = T.color;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(ix, iy, side, side);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      ctx.strokeStyle = T.color;
      ctx.lineWidth = opts.bold ? 3 : 2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r); ctx.stroke(); }

      // 星级（红色 2 星以上才有意义，其余都是一星）
      var sy = y + h - 9;
      var gapS = 9, startX = x + w / 2 - ((star - 1) * gapS) / 2;
      for (var s = 0; s < star; s++) UI.drawStar(ctx, startX + s * gapS, sy, 4, '#ffd166');
    },

    // 武器列表（cls 为空 = 全部，即背包）
    drawWeapons: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a1030');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      var cls = game.weaponCls || null;
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(cls ? (D.PROTOS[cls].name + '武器') : '武器背包', W / 2, 42);
      UI.button(ctx, 'wback', 12, 12, 88, 40, '‹ 返回', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState(game.weaponBack || 'menu');
      });
      UI.pill(ctx, W - 128, 16, 116, 30, 'rgba(0,0,0,0.45)', 15);
      UI.drawDiamond(ctx, W - 112, 31, 8);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.textAlign = 'center';
      ctx.fillText(String(G.Meta.diamonds), W - 68, 36);

      // 已装备条
      var barCls = cls || G.Meta.selected;
      var eq = G.Weapon.equipped(barCls);
      var barY = 62;
      UI.pill(ctx, 12, barY, W - 24, 46, 'rgba(12,20,48,0.88)', 12);
      ctx.textAlign = 'left';
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('已装备', 24, barY + 19);
      if (eq) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = G.Weapon.tierOf(eq).color;
        ctx.fillText(G.Weapon.label(eq), 24, barY + 36);
        ctx.textAlign = 'right';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#7bed9f';
        ctx.fillText('攻击 +' + Math.round((G.Weapon.bonus(eq) - 1) * 100) + '%', W - 24, barY + 29);
      } else {
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('空 · 点下面的武器再按「装备」', 24, barY + 34);
      }

      var list = G.Weapon.listOf(cls);
      var top = 132, bottomBar = 76;
      ctx.textAlign = 'left';
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('全部武器 · 共 ' + list.length + ' 件', 14, top - 10);

      if (!list.length) {
        ctx.textAlign = 'center';
        ctx.font = '13px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText('还没有武器', W / 2, H * 0.4);
        UI.button(ctx, 'goto_gacha', W / 2 - 90, H * 0.46, 180, 48, '🎁 去抽取', '60 钻/抽', '#c0392b', function () {
          game.openGacha();
        });
        return;
      }

      // 网格（超出可上下拖动）
      var cols = Math.max(4, Math.min(5, Math.floor((W - 24 + 10) / 86)));
      var gap = 10;
      var cw = (W - 24 - gap * (cols - 1)) / cols;
      var chh = cw * 1.2;
      var rows = Math.ceil(list.length / cols);
      var contentH = rows * (chh + gap) - gap;
      var viewH = H - top - bottomBar;
      var maxScroll = Math.max(0, contentH - viewH);
      var sy = Math.min(Math.max(0, game.weaponScroll || 0), maxScroll);
      game.weaponScroll = sy;
      UI._wgrid = { top: top, viewH: viewH, maxScroll: maxScroll };

      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, W, viewH); ctx.clip();
      for (var i = 0; i < list.length; i++) {
        var w = list[i];
        var gx = 12 + (i % cols) * (cw + gap);
        var gy = top + Math.floor(i / cols) * (chh + gap) - sy;
        if (gy + chh < top - 2 || gy > H - bottomBar + 2) continue;
        var isEq = eq && eq.uid === w.uid;
        var sel = game.weaponSel === w.uid;
        UI.drawWeaponCard(ctx, gx, gy, cw, chh, w.cls, w.tier, w.star, { bold: isEq || sel });
        if (isEq) {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath(); ctx.arc(gx + cw - 9, gy + 9, 5, 0, Math.PI * 2); ctx.fill();
        }
        if (sel) {
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 3;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(gx + 1.5, gy + 1.5, cw - 3, chh - 3, Math.min(14, cw * 0.16)); ctx.stroke(); }
        }
        // 命中区裁到可见范围内：滚动到顶栏下面（被裁掉）的部分不再可点
        var vy0 = Math.max(gy, top);
        var vy1 = Math.min(gy + chh, H - bottomBar);
        if (vy1 - vy0 > 10) {
          UI.reg('wsel_' + w.uid, gx, vy0, cw, vy1 - vy0, (function (uid) {
            return function () { game.selectWeapon(uid); };
          })(w.uid));
        }
      }
      ctx.restore();

      if (maxScroll > 0) {
        var trackH = viewH - 8;
        var thumbH = Math.max(28, trackH * viewH / contentH);
        var thumbY = top + 4 + (trackH - thumbH) * (sy / maxScroll);
        UI.pill(ctx, W - 5, thumbY, 3, thumbH, 'rgba(130,170,255,0.45)', 2);
      }

      // 底部操作条
      var bw = Math.min(160, (W - 36) / 2), bh = 46, by = H - bh - 14;
      var selW = game.weaponSel ? G.Weapon.find(game.weaponSel) : null;
      var isSelEq = selW && eq && selW.uid === eq.uid;
      if (selW && !isSelEq) {
        UI.button(ctx, 'wequip', 12, by, bw, bh, '装备', G.Weapon.label(selW), '#2d6cdf', function () {
          game.equipWeapon(selW);
        });
      } else if (selW && isSelEq) {
        UI.button(ctx, 'wunequip', 12, by, bw, bh, '卸下', '当前已装备', 'rgba(90,100,140,1)', function () {
          game.unequipWeapon(selW.cls);
        });
      } else {
        UI.button(ctx, 'wequip', 12, by, bw, bh, '装备', '先选一件', '#2d6cdf', function () { }, true);
      }
      var canMerge = G.Weapon.mergeable();
      UI.button(ctx, 'wmerge', W - 12 - bw, by, bw, bh, '一键合成',
        canMerge > 0 ? ('可合 ' + canMerge + ' 组') : '三合一 / 红2升星', '#8e44ad', function () {
          game.mergeWeapons();
        }, canMerge <= 0);
    },

    // 抽卡页
    drawGacha: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#120b2c');
      grad.addColorStop(1, '#1a1440');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('武器获取', W / 2, 42);
      UI.button(ctx, 'gback', 12, 12, 88, 40, '‹ 返回', null, 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.setState('menu');
      });
      UI.pill(ctx, W - 128, 16, 116, 30, 'rgba(0,0,0,0.45)', 15);
      UI.drawDiamond(ctx, W - 112, 31, 8);
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#7ef9ff';
      ctx.textAlign = 'center';
      ctx.fillText(String(G.Meta.diamonds), W - 68, 36);

      // 卡池横幅
      var bx = 12, by = 66, bw2 = W - 24, bh2 = Math.min(252, H * 0.30);
      var bg2 = ctx.createLinearGradient(bx, by, bx + bw2, by + bh2);
      bg2.addColorStop(0, 'rgba(90,40,160,0.55)');
      bg2.addColorStop(0.6, 'rgba(30,24,80,0.9)');
      bg2.addColorStop(1, 'rgba(12,18,40,0.95)');
      ctx.fillStyle = bg2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw2, bh2, 16); ctx.fill(); }
      else ctx.fillRect(bx, by, bw2, bh2);
      ctx.strokeStyle = 'rgba(181,108,224,0.55)';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, bw2 - 2, bh2 - 2, 16); ctx.stroke(); }

      var cardH = Math.min(200, bh2 - 34), cardW = cardH * 0.78;
      UI.drawWeaponCard(ctx, bx + 18, by + (bh2 - cardH) / 2, cardW, cardH, 'archer', 4, 3, { bold: true });

      var tx0 = bx + cardW + 34;
      ctx.textAlign = 'left';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('弓手武器卡池', tx0, by + 46);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('当前仅开放弓手武器', tx0, by + 66);

      // 概率：固定两行（白绿蓝 / 紫红），任何宽度都不会顶出卡片
      var rateRows = [
        [[0, '白', 80], [1, '绿', 10], [2, '蓝', 6]],
        [[3, '紫', 3], [4, '红', 1]]
      ];
      var ryy = by + 94;
      ctx.font = '10px sans-serif';
      for (var r = 0; r < rateRows.length; r++) {
        var rx = tx0;
        for (var i = 0; i < rateRows[r].length; i++) {
          var item = rateRows[r][i];
          var T = G.Weapon.TIERS[item[0]];
          var lbl = item[1] + item[2] + '%';
          ctx.fillStyle = T.color;
          ctx.beginPath(); ctx.arc(rx + 4, ryy - 3.5, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText(lbl, rx + 11, ryy);
          rx += 11 + ctx.measureText(lbl).width + 14;
        }
        ryy += 18;
      }
      var hintY = ryy + 2;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('紫 / 红品质抽到时会有光晕', tx0, hintY);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('1 抽 60 钻 · 10 抽 600 钻', tx0, hintY + 18);

      // 规则说明
      var ry = by + bh2 + 14;
      UI.pill(ctx, 12, ry, W - 24, 100, 'rgba(14,22,50,0.92)', 12);
      ctx.strokeStyle = 'rgba(130,170,255,0.25)';
      ctx.lineWidth = 1;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(12.5, ry + 0.5, W - 25, 99, 12); ctx.stroke(); }
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText('合成规则', 26, ry + 24);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.fillText('3 个同品质 → 高一阶（白→绿→蓝→紫→红）', 26, ry + 47);
      ctx.fillText('2 个同星级红色 → 高一星（红色最高 5★）', 26, ry + 67);
      ctx.fillText('装备后提升该职业攻击：每阶 +6%，每星 +4%', 26, ry + 87);

      // 抽卡按钮（贴底，拇指好按）
      var btnW = Math.min(200, (W - 40) / 2), btnH = 62, btnY = H - btnH - 54;
      var cost1 = 60, cost10 = 600;
      // 中间放个背包入口，顺手填掉空白
      UI.button(ctx, 'gbag', W / 2 - 110, btnY - 96, 220, 44, '📦 我的武器背包',
        '已有 ' + G.Meta.weapons.length + ' 件', 'rgba(80,90,130,1)', function () {
          game.openBag();
        });
      UI.button(ctx, 'draw1', W / 2 - btnW - 8, btnY, btnW, btnH, '1 抽', '💎' + cost1, '#2d6cdf', function () {
        game.doGacha(1);
      }, G.Meta.diamonds < cost1);
      UI.button(ctx, 'draw10', W / 2 + 8, btnY, btnW, btnH, '10 抽', '💎' + cost10, '#8e44ad', function () {
        game.doGacha(10);
      }, G.Meta.diamonds < cost10);

      ctx.textAlign = 'center';
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('钻石来自通关宝箱', W / 2, btnY - 14);

      if (game.gacha) UI.drawGachaResult(ctx, game);
    },

    // 抽卡结果动画：飞出 → 停留 → 翻面 → 品质光晕（紫/红）
    drawGachaResult: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      var now = Date.now();
      var t = (now - game.gacha.start) / 1000;
      ctx.fillStyle = 'rgba(4,6,18,0.97)';
      ctx.fillRect(0, 0, W, H);

      var cards = game.gacha.cards;
      var n = cards.length;
      var cols = n > 1 ? 5 : 1;
      var rows = n > 1 ? 2 : 1;
      var gap = n > 1 ? 9 : 0;
      var cw = n > 1 ? Math.min(88, (W - 44 - gap * 4) / 5) : 172;
      var chh = cw * 1.34;
      var gridW = cols * cw + (cols - 1) * gap;
      var x0 = (W - gridW) / 2;
      var gridH = rows * chh + (rows - 1) * gap;
      var y0 = H * 0.46 - gridH / 2;

      var FLY = 0.36;
      var allDone = true;

      for (var i = 0; i < n; i++) {
        var w = cards[i];
        var delay = n > 1 ? i * 0.075 : 0;
        var ct = t - delay;
        if (ct < 0) { allDone = false; continue; }

        // 稀有（紫/红）翻牌慢放 + 音效，其余品质正常速度
        var isRare = w.tier >= 3;
        var HOLD_END = isRare ? 0.62 : 0.5;
        var FLIP = isRare ? 0.8 : 0.22;

        var cx = x0 + (i % cols) * (cw + gap) + cw / 2;
        var cy = y0 + Math.floor(i / cols) * (chh + gap) + chh / 2;

        var px = cx, py = cy, sc = 1, rot = 0;
        if (ct < FLY) {
          var k = ct / FLY;
          var e = 1 - Math.pow(1 - k, 3);          // easeOutCubic
          px = W / 2 + (cx - W / 2) * e;
          py = (H + 180) + (cy - H - 180) * e;
          sc = 0.5 + 0.5 * e;
          rot = (1 - e) * (i % 2 ? 0.6 : -0.6);
        } else if (ct < HOLD_END) {
          var b = (ct - FLY) / (HOLD_END - FLY);
          sc = 1 + 0.07 * Math.sin(b * Math.PI);   // 落定微弹
        }

        // 翻牌音效：稀有在起手时给一记长音，普通是轻脆的一声
        if (ct >= HOLD_END && game.gacha.sfx && !game.gacha.sfx[i]) {
          game.gacha.sfx[i] = 1;
          G.Audio.play(isRare ? (w.tier >= 4 ? 'rarebig' : 'rare') : 'flip');
        }

        var revealed = ct >= HOLD_END + FLIP;
        var flipK = 1;
        if (ct >= HOLD_END && ct < HOLD_END + FLIP) {
          var fp = (ct - HOLD_END) / FLIP;
          flipK = Math.abs(Math.cos(Math.PI * fp));
        } else if (ct >= HOLD_END + FLIP) {
          flipK = 1;
        } else {
          flipK = 1;
          allDone = false;
        }

        var T = G.Weapon.tierOf(w);
        // 稀有品质光晕（紫/红）：翻牌过程中逐渐亮起，翻完常亮脉冲
        if (w.tier >= 3 && ct >= HOLD_END) {
          var gk = Math.min(1, (ct - HOLD_END) / (FLIP * 0.85));
          var pulse = 0.6 + 0.4 * Math.sin(now / 280 + i * 0.7);
          var rg = ctx.createRadialGradient(px, py, cw * 0.22, px, py, cw * 1.35);
          rg.addColorStop(0, T.glow);
          rg.addColorStop(0.4, T.glow.replace(/[\d.]+\)$/, '0.32)'));
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = (0.2 + 0.65 * gk) * (0.65 + 0.35 * pulse);
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.arc(px, py, cw * 1.35, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.scale(sc * (revealed ? 1 : flipK), sc);
        if (revealed) {
          UI.drawWeaponCard(ctx, -cw / 2, -chh / 2, cw, chh, w.cls, w.tier, w.star, { bold: true });
        } else {
          UI.drawCardBack(ctx, -cw / 2, -chh / 2, cw, chh);
        }
        ctx.restore();

        // 翻开后写品质名
        if (revealed && n === 1) {
          ctx.textAlign = 'center';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillStyle = T.color;
          ctx.fillText(T.name + '品质 · ' + w.star + '★', cx, cy + chh / 2 + 34);
          ctx.font = '11px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillText('已放入背包', cx, cy + chh / 2 + 54);
        }
      }

      var ready = allDone && t > 0.9;
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = ready ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)';
      ctx.fillText(ready ? '点击任意处继续 · 武器已入库' : '点击可加速', W / 2, H * 0.9);

      UI.reg('gacha_any', 0, 0, W, H, function () {
        if (!ready) { game.skipGacha(); return; }
        game.closeGacha();
      });
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
      UI.button(ctx, 'settings', W / 2 - 100, H * 0.34 + 122, 200, 46, '⚙️ 设置', '特效强度', 'rgba(90,100,140,1)', function () {
        G.Audio.play('button');
        game.settingsBack = 'paused';
        game.setState('settings');
      });
      UI.button(ctx, 'restart', W / 2 - 100, H * 0.34 + 180, 200, 46, '↻ 重新开始', null, '#8e44ad', function () {
        game.startRun();
      });
      UI.button(ctx, 'quit', W / 2 - 100, H * 0.34 + 238, 200, 46, '🏠 回到主页', null, 'rgba(90,100,140,1)', function () {
        game.setState('menu');
      });
    },

    // ================= 设置 =================
    sliderRect: function () { return UI._slider || null; },
    setFx: function (v) {
      v = Math.max(0, Math.min(1, v));
      G.Meta.fx = v;
    },
    setFxFromX: function (x) {
      var s = UI._slider;
      if (!s) return;
      UI.setFx((x - s.x) / s.w);
    },

    drawSettings: function (ctx, game) {
      var W = G.P.screenW, H = G.P.screenH;
      ctx.fillStyle = 'rgba(5,8,22,0.94)';
      ctx.fillRect(0, 0, W, H);
      UI.reg('set_block', 0, 0, W, H, function () { });   // 吞掉点到面板外的点击

      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('⚙️ 设置', W / 2, H * 0.16);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('拖动滑块调整；越低越安静，越高越炸裂', W / 2, H * 0.16 + 24);

      var pw = Math.min(330, W - 40), px = (W - pw) / 2;
      var py = H * 0.26, ph = 272;
      ctx.fillStyle = 'rgba(20,28,60,0.92)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.fill(); }
      else ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(130,170,255,0.35)';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 16); ctx.stroke(); }

      var v = (G.Meta && typeof G.Meta.fx === 'number') ? G.Meta.fx : 1;
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#cfe3ff';
      ctx.fillText('特效强度', px + 24, py + 34);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7ef9ff';
      ctx.fillText(Math.round(v * 100) + '%', px + pw - 24, py + 34);

      // 滑轨 + 旋钮
      var tx = px + 24, tw = pw - 48, ty = py + 68, th = 10;
      UI.pill(ctx, tx, ty, tw, th, 'rgba(0,0,0,0.5)', 5);
      var fw = Math.max(3, tw * v);
      var grad2 = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      grad2.addColorStop(0, '#3b6ea5');
      grad2.addColorStop(1, '#7ef9ff');
      ctx.fillStyle = grad2;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(tx, ty, fw, th, 5); ctx.fill(); }
      else ctx.fillRect(tx, ty, fw, th);
      var kx = tx + tw * v;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(kx, ty + th / 2, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7ef9ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(kx, ty + th / 2, 11, 0, Math.PI * 2); ctx.stroke();
      UI._slider = { x: tx, y: ty, w: tw, h: th };

      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'left';
      ctx.fillText('0% 关', tx, ty + 32);
      ctx.textAlign = 'right';
      ctx.fillText('100% 满', tx + tw, ty + 32);

      // 快捷档位
      var presets = [['关', 0], ['弱', 0.35], ['中', 0.65], ['满', 1]];
      var bw = (pw - 48 - 24) / 4;
      for (var i = 0; i < presets.length; i++) {
        (function (val, label, idx) {
          var on = Math.abs(v - val) < 0.03;
          UI.button(ctx, 'fxp_' + idx, px + 24 + idx * (bw + 8), py + 116, bw, 34, label, null,
            on ? '#2d6cdf' : 'rgba(90,100,140,1)', function () {
              UI.setFx(val);
              G.Meta.save();
              G.Audio.play('button');
            });
        })(presets[i][1], presets[i][0], i);
      }

      // 兑换码
      var redY = py + 180;
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#cfe3ff';
      ctx.fillText('兑换码', px + 24, redY);

      var inW = pw - 48 - 92;
      UI.pill(ctx, px + 24, redY + 10, inW, 40, 'rgba(0,0,0,0.45)', 10);
      ctx.strokeStyle = 'rgba(130,170,255,0.35)';
      ctx.lineWidth = 1;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(px + 24.5, redY + 10.5, inW - 1, 39, 10); ctx.stroke(); }
      ctx.font = '13px sans-serif';
      ctx.fillStyle = game.redeemText ? '#fff' : 'rgba(255,255,255,0.32)';
      ctx.fillText(game.redeemText || '点击输入', px + 36, redY + 35);
      UI.reg('redeem_input', px + 24, redY + 10, inW, 40, function () {
        G.P.askText({
          value: game.redeemText || '',
          maxLength: 24,
          onInput: function (v) { game.setRedeemText(v); },
          onDone: function (v) { game.setRedeemText(v); }
        });
      });
      UI.button(ctx, 'redeem_btn', px + pw - 24 - 84, redY + 10, 84, 40, '兑换', null, '#c0392b', function () {
        game.redeemCode();
      });
      if (game.redeemMsg && Date.now() - game.redeemMsg.t < 4500) {
        ctx.textAlign = 'center';
        ctx.font = '11px sans-serif';
        ctx.fillStyle = game.redeemMsg.color;
        ctx.fillText(game.redeemMsg.text, px + pw / 2, redY + 72);
      }

      UI.button(ctx, 'set_back', W / 2 - 90, py + ph + 26, 180, 48, '‹ 返回', null, '#2d6cdf', function () {
        G.Meta.save();
        G.Audio.play('button');
        game.setState(game.settingsBack || 'menu');
      });
    },

    // ================= 总绘制入口 =================
    draw: function (ctx, game) {
      UI.begin();
      UI._slider = null;
      switch (game.state) {
        case 'menu': UI.drawMenu(ctx, game); UI.drawAnnounce(ctx, game, 0.84); break;
        case 'heroes': UI.drawHeroes(ctx, game); UI.drawAnnounce(ctx, game, 0.88); break;
        case 'changelog': UI.drawChangelog(ctx, game); break;
        case 'weapons':
        case 'bag': UI.drawWeapons(ctx, game); UI.drawAnnounce(ctx, game, 0.82); break;
        case 'gacha': UI.drawGacha(ctx, game); break;
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
        case 'settings': UI.drawSettings(ctx, game); break;
        case 'gameover': UI.drawGameOver(ctx, game); break;
        case 'victory': UI.drawVictory(ctx, game); break;
      }
    }
  };
  G.UI = UI;
})();
