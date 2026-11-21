// 라인 지원 참가자 고르기: 처음 열 때만 최근 참가자로 채우고, 모두 해제하면 빈 채로 유지
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'); await open(A, 'today', 1200);
  const on = () => A.$$eval('#modal.on .chipsel button.on', (x) => x.length);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(600);
  ok(await on() === 10, '처음 열면 최근 내전 참가자 10명으로 채움: ' + await on());
  await A.click('#modal.on [data-a=bdNone]'); await A.waitForTimeout(300);
  ok(await on() === 0, '모두 해제 → 0명 유지: ' + await on());
  ok(await A.$eval('#modal.on [data-a=bdOpen]', (e) => e.disabled), '열기 버튼 꺼짐');
  const first = await A.$('#modal.on .chipsel button'); await first.click(); await A.waitForTimeout(200);
  ok(await on() === 1, '한 명 고르면 1명');
  await (await A.$('#modal.on .chipsel button.on')).click(); await A.waitForTimeout(200);
  ok(await on() === 0, '그 한 명도 해제 → 0명 유지(다시 채워지지 않음): ' + await on());
  await A.click('#modal.on [data-a=bdRecent]'); await A.waitForTimeout(200);
  ok(await on() === 10, "'최근 내전 참가자' 버튼은 그대로 10명");
  console.log('오류:', A.errs.join(' | ') || '없음'); ok(!A.errs.length, '페이지 오류 없음');
  await b.close();
})();
