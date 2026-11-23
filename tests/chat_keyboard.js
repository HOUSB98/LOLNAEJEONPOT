// 휴대폰 채팅: 전송 버튼을 눌러도 입력칸 포커스(키보드)가 유지돼 연달아 보낼 수 있다
const { chromium } = require('playwright'); const { makeSeed, device, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const ctx = await device(b, be, 'WORK', 'M', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const M = await client(b, be, 'WORK', 'M', { ctx }); await open(M, 'home', 1200);
  await M.tap('#chatfab'); await M.waitForTimeout(700);
  const focused = () => M.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const sent = () => Object.values(be.db.chat || {}).filter((m) => m.nick === 'M').map((m) => m.t);
  await M.tap('#chatinp'); await M.keyboard.type('첫번째');
  await M.tap('#chatform .go'); await M.waitForTimeout(600);
  ok(await focused() === 'chatinp', '전송 버튼을 누른 뒤에도 입력칸에 포커스(키보드 유지): ' + await focused());
  ok(await M.inputValue('#chatinp') === '', '입력칸 비워짐');
  await M.waitForTimeout(3300); // 도배 방지(3초) 지나서
  await M.keyboard.type('두번째'); await M.tap('#chatform .go'); await M.waitForTimeout(800);
  ok(await focused() === 'chatinp', '다시 누르지 않고 바로 두 번째 입력·전송 후에도 포커스 유지');
  ok(JSON.stringify(sent().sort()) === JSON.stringify(['두번째', '첫번째'].sort()), '두 메시지 모두 전송: ' + sent().join(','));
  await M.waitForTimeout(3300);
  await M.keyboard.type('엔터'); await M.keyboard.press('Enter'); await M.waitForTimeout(800);
  ok(await focused() === 'chatinp' && sent().includes('엔터'), '키보드의 전송(Enter)도 포커스 유지');
  // 입력칸을 누르지 않은 상태(키보드 닫힘)에서 빈 칸 전송 버튼은 키보드를 띄우지 않음
  await M.evaluate(() => document.activeElement.blur()); await M.tap('#chatform .go'); await M.waitForTimeout(300);
  ok(await focused() !== 'chatinp', '키보드가 닫힌 상태에서 전송 버튼만 누르면 키보드를 새로 띄우지 않음');
  console.log('오류:', M.errs.join(' | ') || '없음'); ok(!M.errs.length, '페이지 오류 없음');
  await b.close();
})();
