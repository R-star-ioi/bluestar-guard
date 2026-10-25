// 浏览器预览打包脚本：把 js/ 下全部模块打包成 web/bundle.js（CommonJS 微型加载器）
// 用法：node tools/build_web.js
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var FILES = [
  'js/boot.js',
  'js/core/platform.js',
  'js/core/util.js',
  'js/core/input.js',
  'js/core/camera.js',
  'js/core/audio.js',
  'js/config/data.js',
  'js/core/meta.js',
  'js/core/bg.js',
  'js/entities/fx.js',
  'js/entities/pickup.js',
  'js/entities/projectile.js',
  'js/entities/player.js',
  'js/entities/enemy.js',
  'js/entities/hero.js',
  'js/systems/waves.js',
  'js/ui/ui.js',
  'js/main.js'
];

var out = [];
out.push('/* 自动生成：node tools/build_web.js —— 修改 js/ 后请重新运行 */');
out.push('var __m = {};');
out.push('function __def(id, fn) { __m[id] = fn; }');
out.push('function __dirname(id) { var i = id.lastIndexOf("/"); return i < 0 ? "" : id.slice(0, i); }');
out.push('function __resolve(from, p) {');
out.push('  var dir = __dirname(from);');
out.push('  var base = dir ? dir.split("/") : [];');
out.push('  var parts = p.split("/");');
out.push('  for (var i = 0; i < parts.length; i++) {');
out.push('    var s = parts[i];');
out.push('    if (s === "." || s === "") continue;');
out.push('    if (s === "..") base.pop();');
out.push('    else base.push(s);');
out.push('  }');
out.push('  return base.join("/");');
out.push('}');
out.push('var __cache = {};');
out.push('function __req(fromId, p) {');
out.push('  var id = __resolve(fromId, p);');
out.push('  if (__cache[id]) return __cache[id].exports;');
out.push('  var fn = __m[id];');
out.push('  if (!fn) throw new Error("module not found: " + id);');
out.push('  var module = { exports: {} };');
out.push('  __cache[id] = module;');
out.push('  fn(module, module.exports, function (rel) { return __req(id, rel); });');
out.push('  return module.exports;');
out.push('}');

for (var i = 0; i < FILES.length; i++) {
  var f = FILES[i];
  var src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  out.push('__def(' + JSON.stringify(f.replace(/\\/g, '/')) + ', function (module, exports, require) {\n' + src + '\n});');
}

out.push('try {');
for (var m = 0; m < FILES.length; m++) {
  out.push('  __req("", "./' + FILES[m] + '");');
}
out.push('  window.G.game.init();');
out.push('} catch (e) { window.__bootErr = (e && e.stack) ? e.stack : String(e); try { console.error("BOOT FAIL", e); } catch (_) {} }');

if (!fs.existsSync(path.join(ROOT, 'web'))) fs.mkdirSync(path.join(ROOT, 'web'));
fs.writeFileSync(path.join(ROOT, 'web', 'bundle.js'), out.join('\n'), 'utf8');
console.log('OK -> web/bundle.js (' + FILES.length + ' modules)');
