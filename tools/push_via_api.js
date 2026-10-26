// 网络故障备用通道：通过 GitHub Git Data API 推送本地 commit（等价于 git push）
// 用法：node tools/push_via_api.js <fromCommit> <tag> <tagMessage>
var fs = require('fs');
var https = require('https');

var TOKEN = process.env.GH_TOKEN;
var REPO = 'R-star-ioi/bluestar-guard';
var FROM = process.argv[2];   // 远端当前所在 commit
var TAG = process.argv[3];
var TAG_MSG = process.argv[4];
var MSG = fs.readFileSync('.git/COMMIT_MSG_TMP', 'utf8');

function api(method, path, data) {
  return new Promise(function (resolve, reject) {
    var body = data ? JSON.stringify(data) : null;
    var req = https.request({
      hostname: 'api.github.com', path: '/repos/' + REPO + '/' + path, method: method,
      headers: {
        'Authorization': 'token ' + TOKEN, 'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body || ''),
        'User-Agent': 'push-script'
      }
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var out = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(out)); } catch (e) { resolve(out); }
        } else reject(new Error(res.statusCode + ' ' + out.slice(0, 300)));
      });
    });
    req.on('error', reject);
    req.setTimeout(40000, function () { req.destroy(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function run() {
  var files = fs.readFileSync('.git/PUSH_FILES_TMP', 'utf8').split('\n').filter(Boolean);
  api('GET', 'git/ref/heads/main').then(function (ref) {
    var mainSha = ref.object.sha;
    console.log('remote main =', mainSha);
    return api('GET', 'git/commits/' + mainSha).then(function (c) {
      var baseTree = c.tree.sha;
      var chain = Promise.resolve([]);
      files.forEach(function (f) {
        chain = chain.then(function (acc) {
          var content = fs.readFileSync(f);
          return api('POST', 'git/blobs', {
            content: content.toString('base64'), encoding: 'base64'
          }).then(function (blob) {
            console.log('blob ok:', f);
            acc.push({ path: f.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: blob.sha });
            return acc;
          });
        });
      });
      return chain.then(function (entries) {
        return api('POST', 'git/trees', { base_tree: baseTree, tree: entries });
      }).then(function (tree) {
        return api('POST', 'git/commits', { message: MSG, tree: tree.sha, parents: [mainSha] });
      }).then(function (nc) {
        console.log('commit ok:', nc.sha);
        return api('PATCH', 'git/refs/heads/main', { sha: nc.sha, force: false }).then(function () {
          return nc.sha;
        });
      }).then(function (commitSha) {
        console.log('main updated ->', commitSha);
        return api('POST', 'git/tags', { tag: TAG, message: TAG_MSG, object: commitSha, type: 'commit' }).then(function (t) {
          return api('POST', 'git/refs', { ref: 'refs/tags/' + TAG, sha: t.sha });
        }).then(function () {
          console.log('tag ok:', TAG);
        });
      });
    });
  }).then(function () {
    console.log('ALL DONE');
  }).catch(function (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  });
}
run();
