// 시험 전체 실행: node tests/run-all.js  (하나만: node tests/run-all.js reads)
// 각 시험의 ✓/✗ 개수를 모아 보여 준다. 브라우저 시험은 하나에 1~4분 걸린다.
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const ALL = ['worker_live.mjs', 'worker_report.mjs', 'worker_upd.mjs', 'write_fuse.js', 'error_report.js', 'chat_posts_limit.js', 'chat_pc_open.js', 'chat_keyboard.js', 'reads.js', 'swap_and_edit.js', 'replay_flip.js', 'me_account.js', 'scores_presence.js', 'board_select.js', 'today_fav.js', 'today_pick.js', 'finder.js', 'stats_pairs.js', 'swipe.js', 'xmas_chat.js', 'nav_detail.js', 'auction_flow.js', 'auction_more.js', 'board_more.js', 'highlights.js', 'auction_clock.js', 'multi_device.js'];
const pick = process.argv.slice(2), list = pick.length ? ALL.filter((f) => pick.some((p) => f.startsWith(p))) : ALL;
let bad = 0;
// 가짜 Firestore 의 타이밍 때문에 가끔 실패할 수 있어서, 실패하면 한 번 더 돌린다(다시 돌려서 통과하면 그렇게 표시한다)
const runOnce = (f) => { const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 6 * 60e3 });
  const out = (r.stdout || '') + (r.stderr || ''), pass = (out.match(/✓/g) || []).length, fail = (out.match(/✗/g) || []).length;
  return { out, pass, fail, crash: r.status !== 0 && !fail, sec: Math.round((Date.now() - t0) / 1000) }; };
for (const f of list) {
  let x = runOnce(f), retried = false;
  if (x.fail || x.crash) { const first = x; x = runOnce(f); retried = true; if (x.fail || x.crash) x.first = first; }
  const ng = x.fail || x.crash;
  if (ng) bad++;
  console.log(`${ng ? '✗' : '✓'} ${f.padEnd(22)} 통과 ${x.pass} · 실패 ${x.fail}${x.crash ? ' · 중간에 멈춤' : ''} · ${x.sec}초${retried ? (ng ? ' · 두 번 모두 실패' : ' · 처음엔 실패, 다시 돌려서 통과') : ''}`);
  if (ng) console.log(x.out.split('\n').filter((l) => /✗|Error|진단|다시/.test(l)).slice(0, 6).map((l) => '    ' + l.trim()).join('\n'));
}
console.log(bad ? `\n실패한 시험 ${bad}개` : '\n모두 통과');
process.exitCode = bad ? 1 : 0;
