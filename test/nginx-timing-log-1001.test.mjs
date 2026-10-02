// test/nginx-timing-log-1001.test.mjs
// 批 CY-㊴ 之十九（2026-10-01）：nginx 耗时日志。
//
// 为什么必须由**部署脚本**管：
//   `log_format` 只能在 http 上下文声明，而部署脚本原来只管
//   /etc/nginx/sites-available/shuimg.cn（server 上下文）。所以它天然落在版本管理之外 ——
//   手工加一次，下次部署没人知道它存在，nginx.conf 被覆盖时就悄悄没了。
//   「查性能 → 临时加一行 → 过几个月忘了它」是所有可观测性缺失的同一种死法。
//
// 解法：nginx.conf 的 http 块里已经有 `include /etc/nginx/conf.d/*.conf;`，
// 于是把 log_format 放进 conf.d —— 由仓库管理、由脚本安装、随脚本回滚。
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const deploy = read('scripts/deploy-production.ps1');
const siteConf = read('scripts/nginx/shuimg.cn.conf');

const TIMING_FILE = 'scripts/nginx/00-shubao-log-format.conf';
const hasTimingFile = existsSync(new URL('../' + TIMING_FILE, import.meta.url));

test('① log_format 必须落在一个会被 include 的 http 层目录里，而不是 nginx.conf', () => {
  assert.ok(hasTimingFile, TIMING_FILE + ' 必须存在（它是被版本管理的那一份）');
  const conf = read(TIMING_FILE);

  assert.match(conf, /^\s*log_format\s+shubao_timing\b/m,
    '必须定义 log_format shubao_timing');
  /* 这几个字段是"能定位慢在哪一段"的关键：
       request_time          总耗时
       upstream_response_time 后端耗时 —— 两者相减就是 nginx/网络的开销
       upstream_connect_time 连后端耗时
       bytes_sent            压缩后实际下发字节数（可以验证 gzip 到底生效没） */
  for (const field of ['$request_time', '$upstream_response_time', '$upstream_connect_time', '$bytes_sent']) {
    assert.ok(conf.includes(field), '日志格式必须包含 ' + field);
  }
  assert.match(conf, /access_log\s+\S+\s+shubao_timing;/,
    '必须真的启用（只定义不启用等于没做）');

  /* 必须是 http 上下文能用的指令 —— 一旦写进 server 块就会 nginx -t 失败。
     conf.d 被 nginx.conf 的 http 块 include，所以这里的指令是合法的。 */
  assert.doesNotMatch(conf, /^\s*(server|location)\s*\{/m,
    '这个文件里不许出现 server/location 块 —— 它会被放进 http 上下文');
});

test('② 文件名必须排在 glob 里字母类文件之前（log_format 要先于使用它）', () => {
  const name = TIMING_FILE.split('/').pop();
  assert.match(name, /^\d/, 'conf.d 是按字典序展开的，log_format 必须先于 access_log 生效');
});

test('③ 部署脚本必须安装它（否则这段配置永远到不了线上）', () => {
  assert.match(deploy, /nginxTimingConfig\s*=\s*Join-Path[^\n]*00-shubao-log-format\.conf/,
    '必须声明本地路径');
  assert.match(deploy, /remoteNginxTimingConfig\s*=\s*"\/etc\/nginx\/conf\.d\/00-shubao-log-format\.conf"/,
    '必须声明远端路径（落在已被 include 的 conf.d 里）');
  assert.match(deploy, /Test-Path -LiteralPath \$nginxTimingConfig/,
    '必须在部署前检查文件存在（跟站点配置一样的 fail-fast）');
  /* 打包清单里必须带上它，否则远端 tar 解出来没有这个文件 */
  assert.match(deploy, /scripts\/nginx\/00-shubao-log-format\.conf/,
    '必须出现在发布归档的文件清单里');
  /* 安装命令 */
  assert.match(deploy, /sudo cp '\$RemoteDir\/scripts\/nginx\/00-shubao-log-format\.conf' '\$remoteNginxTimingConfig'/,
    '远端必须真的把它装到 conf.d');
  /* nginx -t 必须在它之后 —— 语法错了要当场失败而不是 reload 之后才发现 */
  const installIndex = deploy.indexOf("00-shubao-log-format.conf' '$remoteNginxTimingConfig'");
  const testIndex = deploy.indexOf('sudo nginx -t', installIndex);
  assert.ok(installIndex > 0 && testIndex > installIndex,
    'nginx -t 必须发生在安装之后（否则语法错会被 reload 掩盖）');
});

test('④ 回滚必须把**两份** nginx 配置都还原', () => {
  /* 只还原站点配置、漏了耗时日志 ⇒ 回滚后 nginx 与线上实际状态不一致，
     而 nginx -t 只会说"语法没问题"，不会提醒你少还原了一份。 */
  const needle = "sudo cp $remoteBackup/nginx-config '$remoteNginxConfig';";
  const points = deploy.split(needle).length - 1;
  assert.equal(points, 2, '预期两条回滚路径（PM2 / 旧版）都还原 nginx 配置');

  const backup = deploy.match(/nginx-timing-config/g) || [];
  assert.ok(backup.length >= 3,
    '备份 + 两条回滚都要提到 nginx-timing-config（实际 ' + backup.length + ' 处）');
  assert.match(deploy, /if \[ -f \$remoteBackup\/nginx-timing-config \]; then/,
    '回滚必须处理"之前没有这个文件"的情况（那时应当删掉，不能 cp 一个不存在的文件）');
});

test('⑤ 站点配置仍然只允许有一处 client_max_body_size（不要把两件事混在一个文件里）', () => {
  const count = (siteConf.match(/client_max_body_size/g) || []).length;
  assert.equal(count, 1,
    '站点配置里只许有一处 client_max_body_size（两处各写一个数字，迟早只改一处）');
});