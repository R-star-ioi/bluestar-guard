// 微信小游戏入口
require('./js/boot.js');
require('./js/core/platform.js');
require('./js/core/util.js');
require('./js/core/input.js');
require('./js/core/camera.js');
require('./js/core/audio.js');
require('./js/config/data.js');
require('./js/core/meta.js');
require('./js/core/bg.js');
require('./js/entities/fx.js');
require('./js/entities/pickup.js');
require('./js/entities/projectile.js');
require('./js/entities/player.js');
require('./js/entities/skills.js');
require('./js/entities/enemy.js');
require('./js/entities/hero.js');
require('./js/systems/waves.js');
require('./js/ui/ui.js');
require('./js/main.js');

GameGlobal.G.game.init();
