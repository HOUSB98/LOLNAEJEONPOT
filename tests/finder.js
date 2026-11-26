// 빠른 이동(js/finder.js): Ctrl+K 또는 / 로 열고, 선수·페이지 이름(초성 가능)으로 찾아 Enter/클릭으로 이동.
// 입력칸에서 / 를 치면 열리지 않음, 다른 창이 열려 있으면 열리지 않음, Esc로 닫힘. + 홈 캐러셀 점 터치 영역
const { chromium, devices } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const SHOT = process.env.SHOT;
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'); await A.setViewportSize({ width: 1440, height: 900 });
  await open(A, 'home', 1200);
  const isOpen = () => A.$('#modal.on .finder').then(Boolean);
  ok(await A.$('#side .fd-btn') !== null, 'PC 왼쪽 메뉴에 빠른 이동 버튼');
  await A.keyboard.press('Control+k'); await A.waitForTimeout(200);
  ok(await isOpen(), 'Ctrl+K로 열림');
  ok(await A.evaluate(() => document.activeElement?.id === 'fd-q'), '검색칸에 바로 입력 가능(포커스)');
  const navN = await A.evaluate(async () => (await import('/js/core.js')).NAV_ALL.filter((n) => n[0]).length);
  ok(await A.$$eval('.fd-it', (x) => x.length) === navN, `처음엔 모든 페이지 ${navN}개 목록(왼쪽 메뉴 + 맨 아래 관리·제작자)`);
  await A.keyboard.type('선수1'); await A.waitForTimeout(150);
  let names = await A.$$eval('.fd-it b', (x) => x.map((e) => e.textContent));
  ok(names[0] === '선수1' && names.includes('선수10'), '이름으로 찾기(앞부분 일치 먼저): ' + names.slice(0, 4).join(','));
  await A.keyboard.press('Enter'); await A.waitForTimeout(500);
  ok(!(await isOpen()) && /#\/players\/p1$/.test(await A.evaluate(() => location.hash)), 'Enter → 선수1 카드로 이동: ' + await A.evaluate(() => location.hash));
  // 초성 + 화살표
  await A.keyboard.press('/'); await A.waitForTimeout(200); ok(await isOpen(), '/ 로 열림');
  await A.keyboard.type('ㄱㅁ'); await A.waitForTimeout(150);
  names = await A.$$eval('.fd-it b', (x) => x.map((e) => e.textContent));
  ok(names.includes('팀 경매'), '초성(ㄱㅁ)으로 페이지 찾기: ' + names.join(','));
  await A.fill('#fd-q', '랭'); await A.waitForTimeout(150);
  await A.keyboard.press('ArrowDown'); await A.keyboard.press('ArrowUp'); await A.keyboard.press('Enter'); await A.waitForTimeout(500);
  ok(await A.evaluate(() => location.hash) === '#/rank', '화살표·Enter로 랭킹 이동');
  await A.keyboard.press('Control+k'); await A.waitForTimeout(150); await A.fill('#fd-q', 'zzzz'); await A.waitForTimeout(100);
  ok(await A.$('.fd-none') !== null, '결과 없음 안내');
  await A.keyboard.press('Escape'); await A.waitForTimeout(150); ok(!(await isOpen()), 'Esc로 닫힘');
  // 클릭 이동
  await A.click('#side .fd-btn'); await A.waitForTimeout(150); await A.fill('#fd-q', '팀 구성'); await A.waitForTimeout(100);
  await A.click('.fd-it'); await A.waitForTimeout(500);
  ok(await A.evaluate(() => location.hash) === '#/today', '버튼으로 열고 클릭해서 팀 구성하기 이동');
  // 입력칸에서 / 는 그냥 글자(챔피언 화면 검색칸)
  await A.evaluate(() => (location.hash = '#/champs')); await A.waitForTimeout(500);
  const qs = '#main input[data-i=chQ]';
  await A.click(qs); await A.keyboard.type('a/b'); await A.waitForTimeout(150);
  ok(!(await isOpen()) && (await A.inputValue(qs)) === 'a/b', '입력칸에서 / 는 그냥 글자: ' + await A.inputValue(qs));
  await A.fill(qs, ''); await A.evaluate(() => document.activeElement.blur());
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(500);
  // 다른 창이 열려 있으면 안 열림
  await A.click('[data-a=tChamp][data-s=blue][data-i="0"]'); await A.waitForTimeout(200);
  await A.keyboard.press('Control+k'); await A.waitForTimeout(150);
  ok(!(await isOpen()) && !!(await A.$('#modal.on #cpq')), '챔피언 창이 열려 있으면 빠른 이동이 끼어들지 않음');
  await A.evaluate(() => import('/js/core.js').then((m) => m.closeModal()));
  // 읽기·쓰기 없음
  await A.waitForTimeout(1500); be.reset();
  await A.keyboard.press('Control+k'); await A.keyboard.type('선수'); await A.keyboard.press('ArrowDown'); await A.keyboard.press('Escape'); await A.waitForTimeout(500);
  ok(be.reads === 0 && be.writes === 0, `열고 찾아도 읽기·쓰기 0 (읽기 ${be.reads}, 쓰기 ${be.writes})`);
  if (SHOT) { await A.keyboard.press('Control+k'); await A.keyboard.type('선수'); await A.waitForTimeout(200); await A.screenshot({ path: SHOT + '/finder_pc.png' }); await A.keyboard.press('Escape'); }

  // 휴대폰: 더보기 창에서 열기 + 캐러셀 점 터치 영역
  const { device } = require('./harness');
  const ctx = await device(b, be, 'WORK', 'M', { ...devices['iPhone 13'] });
  const M = await client(b, be, 'WORK', 'M', { ctx }); await open(M, 'home', 1500);
  await M.click('[data-a=tabMore]'); await M.waitForTimeout(300);
  await M.click('#modal.on [data-a=fdOpen]'); await M.waitForTimeout(300);
  ok(!!(await M.$('#modal.on .finder')), '휴대폰: 더보기 창 → 빠른 이동 열림');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰: 가로 넘침 없음');
  if (SHOT) await M.screenshot({ path: SHOT + '/finder_m.png' });
  await M.evaluate(() => import('/js/core.js').then((m) => m.closeModal()));
  const hit = await M.evaluate(() => { const d = [...document.querySelectorAll('.car-dots i')]; if (d.length < 2) return null;
    return d.map((e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e, '::before'); return { w: r.width - parseFloat(s.left) - parseFloat(s.right), h: r.height - parseFloat(s.top) - parseFloat(s.bottom), x: r.left + parseFloat(s.left), x2: r.right - parseFloat(s.right) }; }); });
  if (hit) {
    ok(hit.every((h) => h.w >= 18 && h.h >= 34), '캐러셀 점 터치 영역 18×34 이상: ' + hit.map((h) => `${h.w}×${h.h}`).join(' '));
    ok(hit.every((h, i) => !i || h.x >= hit[i - 1].x2 - 0.5), '점끼리 터치 영역이 겹치지 않음');
    const vis = await M.$$eval('.car-dots i', (d) => d.map((e) => e.getBoundingClientRect().height)); ok(vis.every((v) => v === 6), '보이는 점 크기는 그대로(높이 6px)');
    // 점 사이 빈 곳(예전엔 안 눌리던 곳)을 눌러도 그 점으로 이동
    const L = M.locator('.car-dots i').nth(1); await L.scrollIntoViewIfNeeded(); await M.waitForTimeout(300); // 부드러운 스크롤이라 브라우저 스크롤 대신 Playwright로
    const bb = await L.boundingBox(), tgt = { x: bb.x + bb.width / 2, y: bb.y - 10 };
    await M.touchscreen.tap(tgt.x, tgt.y); await M.waitForTimeout(500);
    ok(await M.$eval('.car-dots i:nth-child(2)', (e) => e.classList.contains('on')), '점 위쪽 10px을 눌러도 두 번째 점으로 이동');
  } else console.log('  - 캐러셀 점이 2개 미만이라 터치 영역 시험 생략');
  await ctx.close();
  console.log('오류:', [...A.errs, ...M.errs].join(' | ') || '없음'); ok(!A.errs.length && !M.errs.length, '페이지 오류 없음');
  await b.close();
})();
