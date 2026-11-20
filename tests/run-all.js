// 시험 전체 실행: node tests/run-all.js  (하나만: node tests/run-all.js reads)
// 각 시험의 ✓/✗ 개수를 모아 보여 준다. 브라우저 시험은 하나에 1~4분 걸린다.
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const ALL = ['worker_live.mjs', 'worker_report.mjs', 'worker_upd.mjs', 'write_fuse.js', 'error_report.js', 'chat_posts_limit.js', 'chat_pc_open.js', 'reads.js', 'swap_and_edit.js', 'replay_flip.js', 'me_account.js', 'multi_device.js'];
const pick = process.argv.slice(2), list = pick.length ? ALL.filter((f) => pick.some((p) => f.startsWith(p))) : ALL;
let bad = 0;
for (const f of list) {
  const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 6 * 60e3 });
  const out = (r.stdout || '') + (r.stderr || ''), pass = (out.match(/✓/g) || []).length, fail = (out.match(/✗/g) || []).length;
  const crash = r.status !== 0 && !fail;
  if (fail || crash) bad++;
  console.log(`${fail || crash ? '✗' : '✓'} ${f.padEnd(22)} 통과 ${pass} · 실패 ${fail}${crash ? ' · 중간에 멈춤' : ''} · ${Math.round((Date.now() - t0) / 1000)}초`);
  if (fail || crash) console.log(out.split('\n').filter((l) => /✗|Error|진단|다시/.test(l)).slice(0, 6).map((l) => '    ' + l.trim()).join('\n'));
}
console.log(bad ? `\n실패한 시험 ${bad}개` : '\n모두 통과');
process.exitCode = bad ? 1 : 0;
