// 网络故障备用通道：github.com:443 被重置、但 api.github.com 通时，用它把【本地已有的 commit】推上去。
//
// 做法：用 Git Data API 原样重建本地 commit —— tree / parents / message / author / committer
//       全部照抄本地对象，所以 API 返回的 sha 与本地完全相同，直接 PATCH refs/heads/main。
//       => 远端历史与本地一模一样，不会产生内容重复的第二条轨。
//
// 旧实现（把工作区文件重新做成 blob + tree 再建 commit）会在远端产生新 sha，下次 git push
// 必被拒绝，还得再 merge 一次；而且它上传的是 LF 换行的 blob，而本地是 CRLF，merge 时整文件
// 冲突。该实现已废弃，别再改回去。
//
// 用法：GH_TOKEN=ghp_xxx node tools/push_via_api.js [tag] [tagMessage]
//   兼容老用法：第一个参数若是 7~40 位十六进制 sha（旧版的“远端 commit”），自动忽略。
// 前置：目标 commit 依赖的 tree 与 parent 必须已在远端。若 main 被拒但 tag 能推，先把 tag 推上去
//       就能把对象传全：git push origin refs/tags/vX.Y.Z
var cp = require('child_process');
var https = require('https');

var TOKEN = process.env.GH_TOKEN;
var REPO = 'R-star-ioi/bluestar-guard';

// ---- 参数（吃掉旧版的 <远端commit> 位置参数） ----
var args = process.argv.slice(2);
if (args.length && /^[0-9a-f]{7,40}$/i.test(args[0])) {
  console.log('ignore legacy arg:', args.shift());
}
var TAG = args[0] || null;
var TAG_MSG = args[1] || (TAG ? TAG + ' 发布' : null);

function git(a) {
  return cp.execFileSync('git', a, { maxBuffer: 64 * 1024 * 1024 });
}

function isoDate(v) {
  // "1793128338 +0800" -> "2026-10-28T03:12:18+08:00"
  var m = v.match(/^(\d+)\s+([+-])(\d{2})(\d{2})$/);
  if (!m) throw new Error('bad date: ' + v);
  var sign = m[2] === '+' ? 1 : -1;
  var off = sign * (parseInt(m[3], 10) * 3600 + parseInt(m[4], 10) * 60);
  var d = new Date((parseInt(m[1], 10) + off) * 1000);
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T' +
    p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) +
    m[2] + m[3] + ':' + m[4];
}

function who(line) {
  // "Name <mail@x> 1793128338 +0800"
  var m = line.match(/^(.*) <(.*)> (\d+\s+[+-]\d{4})$/);
  if (!m) throw new Error('bad ident: ' + line);
  return { name: m[1], email: m[2], date: isoDate(m[3]) };
}

function api(method, path, data) {
  return new Promise(function (resolve, reject) {
    var body = data ? JSON.stringify(data) : null;
    var req = https.request({
      hostname: 'api.github.com',
      path: '/repos/' + REPO + '/' + path,
      method: method,
      headers: {
        'Authorization': 'token ' + TOKEN,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body || ''),
        'User-Agent': 'push-exact'
      }
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var out = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(out)); } catch (e) { resolve(out); }
        } else reject(new Error(res.statusCode + ' ' + out.slice(0, 400)));
      });
    });
    req.on('error', reject);
    req.setTimeout(40000, function () { req.destroy(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function run() {
  var sha = git(['rev-parse', 'HEAD']).toString().trim();
  var raw = git(['cat-file', '-p', sha]);
  var sep = raw.indexOf('\n\n');
  var head = raw.slice(0, sep).toString();
  var message = raw.slice(sep + 2).toString();

  var tree = null, parents = [], author = null, committer = null;
  head.split('\n').forEach(function (line) {
    var i = line.indexOf(' ');
    var k = line.slice(0, i), v = line.slice(i + 1);
    if (k === 'tree') tree = v;
    else if (k === 'parent') parents.push(v);
    else if (k === 'author') author = who(v);
    else if (k === 'committer') committer = who(v);
  });

  console.log('local commit', sha);
  console.log('tree', tree, '| parents', parents.join(' '));
  var payload = { message: message, tree: tree, parents: parents, author: author, committer: committer };

  return api('POST', 'git/commits', payload).then(function (c) {
    console.log('remote commit', c.sha, '| match =', c.sha === sha);
    if (c.sha !== sha) {
      throw new Error('sha 不一致：本 commit 依赖的 tree/commit 对象不在远端。\n' +
        '  先把对象传上去（例如 git push origin refs/tags/<tag>），再重跑本脚本。');
    }
    return api('PATCH', 'git/refs/heads/main', { sha: c.sha, force: true });
  }).then(function (ref) {
    console.log('main ->', ref.object.sha);
    if (!TAG) return null;
    return api('POST', 'git/tags', { tag: TAG, message: TAG_MSG, object: ref.object.sha, type: 'commit' })
      .then(function (t) {
        return api('PATCH', 'git/refs/tags/' + TAG, { sha: t.sha, force: true }).catch(function () {
          return api('POST', 'git/refs', { ref: 'refs/tags/' + TAG, sha: t.sha });
        });
      }).then(function (r) {
        console.log('tag', TAG, '->', r.object.sha);
      });
  }).then(function () {
    console.log('ALL DONE');
  }).catch(function (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  });
}

if (!TOKEN) {
  console.error('缺少 GH_TOKEN 环境变量');
  process.exit(1);
}
run();
