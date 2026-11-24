// 디테일: Esc로 창 닫기, 휴대폰 뒤로 가기는 창부터 닫기(창을 버튼으로 닫으면 기록 정리), 창 안 링크 이동, 뒤로 가면 보던 스크롤 위치,
// 페이지별 탭 제목, 좁은 휴대폰(320px)에서 경기 카드·가챠 표 안 잘림
const { chromium, devices } = require('playwright'); const { makeSeed, client, open, Backend, device } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'); await A.setViewportSize({ width: 1440, height: 900 });
  await open(A, 'today', 1200);
  const on = () => A.$('#modal.on').then(Boolean), hash = () => A.evaluate(() => location.hash), len = () => A.evaluate(() => history.length);
  // Esc
  await A.click('[data-a=tChamp][data-s=blue][data-i="0"]'); await A.waitForTimeout(200); ok(await on(), '챔피언 창 열림');
  await A.keyboard.press('Escape'); await A.waitForTimeout(300); ok(!(await on()), 'Esc로 창 닫힘');
  // 입력칸에서도 Esc(한글 조합 중 아님)
  await A.click('[data-a=tSlot][data-s=red][data-i="1"]'); await A.waitForTimeout(200); await A.keyboard.press('Escape'); await A.waitForTimeout(300); ok(!(await on()), '선수 창도 Esc로 닫힘');
  // 뒤로 가기: 창부터 닫고 페이지는 그대로
  await open(A, 'rank', 800); await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(600);
  const L0 = await len();
  await A.click('[data-a=tChamp][data-s=blue][data-i="1"]'); await A.waitForTimeout(200);
  await A.evaluate(() => history.back()); await A.waitForTimeout(500);
  ok(!(await on()) && (await hash()) === '#/today', '뒤로 가기 → 창만 닫히고 오늘의 내전 그대로: ' + await hash());
  await A.evaluate(() => history.back()); await A.waitForTimeout(600);
  ok((await hash()) === '#/rank', '한 번 더 뒤로 가기 → 이전 페이지(랭킹): ' + await hash());
  await A.evaluate(() => history.forward()); await A.waitForTimeout(600);
  // 버튼으로 닫으면 기록 정리 → 뒤로 가기 한 번에 이전 페이지
  await A.click('[data-a=tChamp][data-s=blue][data-i="2"]'); await A.waitForTimeout(200);
  await A.click('#modal.on [data-a=close]'); await A.waitForTimeout(500);
  ok(!(await on()) && (await hash()) === '#/today', 'X 버튼으로 닫음');
  await A.evaluate(() => history.back()); await A.waitForTimeout(600);
  ok((await hash()) === '#/rank', 'X로 닫은 뒤 뒤로 가기 한 번에 이전 페이지(헛돌지 않음): ' + await hash());
  // 창 안 링크로 이동(더보기 메뉴 대신 빠른 이동 창 → 선택) 후 뒤로 가기
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(600);
  await A.keyboard.press('Control+k'); await A.waitForTimeout(200); await A.fill('#fd-q', '케미'); await A.keyboard.press('Enter'); await A.waitForTimeout(700);
  ok((await hash()) === '#/chem' && !(await on()), '빠른 이동으로 케미 이동: ' + await hash());
  await A.evaluate(() => history.back()); await A.waitForTimeout(600);
  ok((await hash()) === '#/today', '뒤로 가기 → 오늘의 내전(중간 기록 없음): ' + await hash());
  // 바깥 눌러 닫기 → 기록 정리
  await A.click('[data-a=tChamp][data-s=blue][data-i="3"]'); await A.waitForTimeout(200); await A.mouse.click(5, 450); await A.waitForTimeout(500);
  ok(!(await on()), '바깥 눌러 닫힘');
  ok(await A.evaluate(() => !history.state?.npModal), '닫은 뒤 창 기록이 남지 않음');
  // 창 연 채 새로고침 → 남은 기록 정리
  await A.click('[data-a=tChamp][data-s=blue][data-i="3"]'); await A.waitForTimeout(200);
  await A.reload(); await A.waitForFunction(() => window.NP_OK, null, { timeout: 15000 }); await A.waitForTimeout(800);
  ok(await A.evaluate(() => !history.state?.npModal) && (await hash()) === '#/today', '창 연 채 새로고침해도 기록 정리, 같은 페이지');
  // 스크롤 위치
  await A.evaluate(() => (location.hash = '#/rank')); await A.waitForTimeout(800);
  await A.evaluate(() => window.scrollTo(0, 700)); await A.waitForTimeout(200); const y0 = await A.evaluate(() => scrollY);
  await A.evaluate(() => (location.hash = '#/players/p1')); await A.waitForTimeout(800);
  ok(await A.evaluate(() => scrollY) === 0, '새 화면은 맨 위');
  await A.evaluate(() => history.back()); await A.waitForTimeout(900);
  const y1 = await A.evaluate(() => scrollY);
  ok(y0 > 300 && Math.abs(y1 - y0) < 5, `뒤로 가면 보던 위치(${y0} → ${y1})`);
  await A.click('#nav a[data-p=home]'); await A.waitForTimeout(600); await A.click('#nav a[data-p=rank]'); await A.waitForTimeout(800);
  ok(await A.evaluate(() => scrollY) === 0, '메뉴로 다시 들어가면 맨 위(새 방문)');
  // 탭 제목
  const title = () => A.evaluate(() => document.title);
  ok(await title() === '랭킹 · NAEJEONPOT', '탭 제목: ' + await title());
  await A.evaluate(() => (location.hash = '#/players/p1')); await A.waitForTimeout(500);
  ok(await title() === '선수1 · 선수 카드 · NAEJEONPOT', '선수 카드 제목: ' + await title());
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(500);
  ok(await title() === 'NAEJEONPOT · 내전 기록실', '홈 제목: ' + await title());
  console.log('오류:', A.errs.join(' | ') || '없음'); ok(!A.errs.length, 'PC 페이지 오류 없음');

  // 휴대폰: 더보기 메뉴 링크 이동 후 뒤로 가기, 좁은 화면
  const ctx = await device(b, be, 'WORK', 'M', { ...devices['iPhone SE'] }); const M = await client(b, be, 'WORK', 'M', { ctx });
  await open(M, 'home', 1500);
  await M.tap('[data-a=tabMore]'); await M.waitForTimeout(300); await M.tap('#modal.on a[href="#/chem"]'); await M.waitForTimeout(800);
  ok(await M.evaluate(() => location.hash) === '#/chem' && !(await M.$('#modal.on')), '휴대폰 더보기 → 케미 이동, 창 닫힘');
  await M.evaluate(() => history.back()); await M.waitForTimeout(700);
  ok(await M.evaluate(() => location.hash) === '#/home', '뒤로 가기 → 홈(더보기 창 기록 없음)');
  await M.tap('[data-a=tabMore]'); await M.waitForTimeout(300);
  await M.evaluate(() => history.back()); await M.waitForTimeout(500);
  ok(!(await M.$('#modal.on')) && await M.evaluate(() => location.hash) === '#/home', '휴대폰 뒤로 가기 → 더보기 창만 닫힘');
  const fit = await M.evaluate(() => [...document.querySelectorAll('.mlist .mcard')].every((c) => c.getBoundingClientRect().right <= innerWidth + 1));
  ok(fit, '320px: 최근 경기 카드가 화면 안');
  await M.evaluate(() => (location.hash = '#/gacha')); await M.waitForTimeout(900);
  ok(await M.evaluate(() => [...document.querySelectorAll('.gc-tbl')].every((t) => t.getBoundingClientRect().right <= innerWidth + 1)), '320px: 가챠 확률표가 화면 안');
  console.log('오류:', M.errs.join(' | ') || '없음'); ok(!M.errs.length, '휴대폰 페이지 오류 없음');
  await b.close();
})();
