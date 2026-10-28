// 网络故障备用通道：github.com:443 被重置、但 api.github.com 通时，用它把【本地已有的 commit】推上去。
//
// 做法：用 Git Data API 逐层重建本地对象 ——
//   1) 用 `git diff-tree` 找出本 commit 相对父提交改动的文件，把这些 blob 按原始字节上传
//   2) 以父提交的 tree 为 base_tree 建 tree，sha 与本地 tree 相同（内容寻址，确定性）
//   3) 建 commit 时 tree / parents / message / author / committer 全部照抄本地对象
//   => API 返回的 commit sha 与本地完全相同，直接 PATCH refs/heads/main。
//      远端历史与本地一模一样，不会产生内容重复的第二条轨，下次 git push 也不会被拒。
//
// 旧实现（不管父提交，把工作区文件重新拼 tree）会在远端造出内容重复但 sha 不同的提交，
// 并且上传的是 LF 换行 blob、本地是 CRLF，merge 时整文件冲突。那段代码已废弃，别改回去。
//
// 用法：GH_TOKEN=ghp_xxx node tools/push_via_api.js [tag] [tagMessage] [commitSha]
//   兼容老用法：第一个参数若是 7~40 位十六进制 sha（旧版的“远端 commit”），自动忽略。
//   第三个参数可指定要推的本地提交（默认 HEAD）；补推长提交链时从老到新逐个调用。
// 前置：父提交必须已在远端（远端 main 是本地祖先，或先把 tag 推上去）。
var cp = require('child_process');
var https = require('https');

var TOKEN = process.env.GH_TOKEN;
var REPO = 'R-star-ioi/bluestar-guard';

var args = process.argv.slice(2);
if (args.length && /^[0-9a-f]{7,40}$/i.test(args[0])) {
  console.log('ignore legacy arg:', args.shift());
}
var TAG = args[0] || null;
var TAG_MSG = args[1] || (TAG ? TAG + ' 发布' : null);
var TARGET = args[2] || 'HEAD';   // 要推送的本地提交

function git(a, raw) {
  return cp.execFileSync('git', a, { maxBuffer: 256 * 1024 * 1024, encoding: raw ? 'buffer' : 'utf8' });
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
  var m = line.match(/^(.*) <(.*)> (\d+\s+[+-]\d{4})$/);
  if (!m) throw new Error('bad ident: ' + line);
  return { name: m[1], email: m[2], date: isoDate(m[3]) };
}

function parseCommit(sha) {
  var raw = git(['cat-file', '-p', sha], true);
  var sep = raw.indexOf('\n\n');
  var out = { tree: null, parents: [], message: raw.slice(sep + 2).toString() };
  raw.slice(0, sep).toString().split('\n').forEach(function (line) {
    var i = line.indexOf(' ');
    var k = line.slice(0, i), v = line.slice(i + 1);
    if (k === 'tree') out.tree = v;
    else if (k === 'parent') out.parents.push(v);
    else if (k === 'author') out.author = who(v);
    else if (k === 'committer') out.committer = who(v);
  });
  return out;
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
    req.setTimeout(60000, function () { req.destroy(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// 本 commit 相对父提交的改动（-z 输出，避免中文路径被转义）
function changedEntries(parent, sha) {
  var out = git(['diff-tree', '-r', '-z', '--no-renames', '--raw', parent, sha], true);
  var tok = out.toString('utf8').split('\u0000');
  var list = [];
  for (var i = 0; i < tok.length; i++) {
    var t = tok[i];
    if (t.charAt(0) !== ':') continue;
    var p = t.slice(1).split(' ');
    var newSha = p[3], status = p[4], path = tok[i + 1];
    i++;
    list.push({ mode: p[1], sha: newSha, status: status, path: path });
  }
  return list;
}

function run() {
  var sha = git(['rev-parse', TARGET]).trim();
  var c = parseCommit(sha);
  var parent = c.parents[0];
  if (!parent) throw new Error('根提交不支持，请先手动推一次');

  console.log('local commit', sha);
  console.log('tree', c.tree, '| parent', parent);

  return api('GET', 'git/commits/' + parent).then(function () {
    var changes = changedEntries(parent, sha).filter(function (f) {
      return f.sha !== '0000000000000000000000000000000000000000';
    });
    console.log('changed files:', changes.length);

    var chain = Promise.resolve([]);
    changes.forEach(function (f) {
      chain = chain.then(function (entries) {
        var blob = git(['cat-file', 'blob', f.sha], true);
        return api('POST', 'git/blobs', { content: blob.toString('base64'), encoding: 'base64' })
          .then(function (b) {
            if (b.sha !== f.sha) throw new Error('blob 校验失败: ' + f.path);
            entries.push({ path: f.path, mode: f.mode, type: 'blob', sha: b.sha });
            return entries;
          });
      });
    });

    return chain.then(function (entries) {
      // 删除的文件用 sha:null 从 base tree 中移除
      changedEntries(parent, sha).forEach(function (f) {
        if (f.sha === '0000000000000000000000000000000000000000') {
          entries.push({ path: f.path, mode: f.mode, type: 'blob', sha: null });
        }
      });
      return api('POST', 'git/trees', { base_tree: git(['rev-parse', parent + '^{tree}']).trim(), tree: entries });
    });
  }).then(function (tree) {
    console.log('tree', tree.sha, '| match =', tree.sha === c.tree);
    if (tree.sha !== c.tree) throw new Error('tree sha 不一致，检查 diff-tree 结果');
    return api('POST', 'git/commits', {
      message: c.message, tree: tree.sha, parents: c.parents,
      author: c.author, committer: c.committer
    });
  }).then(function (rc) {
    console.log('remote commit', rc.sha, '| match =', rc.sha === sha);
    if (rc.sha !== sha) throw new Error('commit sha 不一致：author/committer/message 有出入');
    return api('PATCH', 'git/refs/heads/main', { sha: rc.sha, force: true });
  }).then(function (ref) {
    console.log('main ->', ref.object.sha);
    if (!TAG) return null;
    return api('POST', 'git/tags', { tag: TAG, message: TAG_MSG, object: ref.object.sha, type: 'commit' })
      .then(function (t) {
        return api('PATCH', 'git/refs/tags/' + TAG, { sha: t.sha, force: true }).catch(function () {
          return api('POST', 'git/refs', { ref: 'refs/tags/' + TAG, sha: t.sha });
        });
      }).then(function (r) { console.log('tag', TAG, '->', r.object.sha); });
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
