# 蓝星守卫 · 微信小游戏

割草生存 × 塔防布阵 × 英雄合成（玩法参考《永远的蔚蓝星球》）。纯 Canvas 2D 原生实现，零引擎、零美术素材、零第三方依赖。

[![在线试玩](https://img.shields.io/badge/-%E5%9C%A8%E7%BA%BF%E8%AF%95%E7%8E%A9-blue?style=for-the-badge)](https://r-star-ioi.github.io/bluestar-guard/) [![版本](https://img.shields.io/badge/版本-v0.3.1-green)](https://github.com/R-star-ioi/bluestar-guard/releases)

> 🎮 **点这里直接玩**：<https://r-star-ioi.github.io/bluestar-guard/>（电脑/手机浏览器均可，无需安装）

**v0.2.0 新增 · 局外成长**：主页「英雄」页可选 5 位主角（弓手/剑士/法师/牧师/炮手，攻击方式各异），对局中每捡 1 金币 = 1 升级金币，用于解锁新主角与升级属性（每级 生命+8% 攻击+6% 攻速+4% 移速+2%，满级 Lv10）。

**v0.3.0 新增 · 附加技能**：升级时双重选择——先选 1 个属性强化，再选 1 个附加技能（最多持有 3 个，每个 5 级满级质变）：星环脉冲（环绕清怪→耀星环灼烧）/ 时空残影（万影随行）/ 晶盾回响（晶爆神盾）/ 贪婪磁核（引力漩涡）/ 崩解爆弹（连环崩解）。

![玩法](docs/开发计划.md)

## 核心玩法

- **割草**：左下角虚拟摇杆（按住屏幕任意处拖动即可）移动，自动攻击索敌。
- **塔防**：敌人一波波冲击中央的**基地水晶**，守住它；玩家靠近敌人可以拉仇恨保护基地。
- **招募英雄**：击杀掉金币，底部「招募英雄」随机召唤 剑士/弓手/法师/炮手/牧师 环绕基地布阵（牧师会治疗你和基地）。
- **合成**：**拖拽两个同名同级英雄叠在一起 → 合成升 1 级**（最高 Lv6），也可以点英雄直接花金币升级或出售。
- **Rogue 成长**：吃经验宝石升级，**三选一随机技能**（分裂箭矢、穿透、暴击、吸血、磁力、全英雄强化…）。
- **波次**：每 5 波一个会召唤小怪的 **BOSS**；精英怪金光描边、高倍掉落。
- 死亡或基地被摧毁 → 结算，自动记录最佳纪录（本地存储）。

## 目录结构

```
├─ game.js / game.json / project.config.json   # 微信小游戏入口与配置
├─ index.html + web/bundle.js                  # 浏览器预览版（bundle 由脚本生成）
├─ js/
│  ├─ boot.js                # 全局命名空间 G（双平台共享）
│  ├─ core/                  # platform(画布/触摸/存储) util input camera audio(合成音效) bg
│  ├─ config/data.js         # ★ 全部数值配置（改平衡只改这里）
│  ├─ entities/              # player enemy hero projectile pickup fx
│  ├─ systems/waves.js       # 波次与Boss编排
│  ├─ ui/ui.js               # HUD/三选一/英雄面板/菜单/结算/暂停
│  └─ main.js                # Game 主类（状态机/主循环/触摸路由）
├─ tools/build_web.js        # 浏览器预览打包脚本
└─ docs/开发计划.md           # 开发规划与数值设计
```

## 本地试玩（浏览器预览版）

```bash
# 1) 改过 js/ 下任何文件后重新打包
node tools/build_web.js

# 2) 起个静态服务器（任选其一）
python -m http.server 8437

# 3) 打开 http://127.0.0.1:8437/index.html
```

桌面端支持鼠标拖动（模拟摇杆/拖英雄）。音效为 WebAudio 程序化合成，首次点击后自动开启。

## 导入微信开发者工具

1. 打开「微信开发者工具」→ 小程序/小游戏项目 → **导入项目**。
2. 目录选择本文件夹（含 `game.json` 的根目录），AppID 填自己的小游戏 AppID（没有可选「测试号」，`project.config.json` 当前为 `touristappid`）。
3. 编译运行即可。`project.config.json` 已配置 `packOptions.ignore` 打包时排除 `docs/ web/ index.html README.md` 等预览专用文件。
4. 真机预览：工具栏「预览」扫码即可（竖屏游戏）。

> 代码使用 ES5 语法 + CommonJS `require`，与微信小游戏运行时完全兼容，无需构建转换。

## 数值调平衡

所有数值集中在 [js/config/data.js](js/config/data.js)：玩家/敌人/英雄属性、波次成长曲线、技能池、经济与掉落概率。浏览器版改完 → `node tools/build_web.js` → 刷新即测。

## 后续路线（见 docs/开发计划.md）

- 微信能力：好友排行榜（开放数据域）、分享、激励视频广告（复活/双倍金币）
- 英雄稀有度与图鉴、局外永久强化、每日任务
- 云开发排行榜、订阅消息召回
