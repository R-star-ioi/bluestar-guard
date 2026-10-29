// 本地预览服务器：node tools/serve.js [port]（默认 8437，服务项目根目录）
var http = require('http');
var fs = require('fs');
var path = require('path');

var port = parseInt(process.argv[2], 10) || 8437;
var root = path.resolve(__dirname, '..');

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json'
};

http.createServer(function (req, res) {
  var u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  var p = path.join(root, u);
  if (p.indexOf(root) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(p, function (e, d) {
    if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(port, '127.0.0.1', function () {
  console.log('serve http://127.0.0.1:' + port);
});
