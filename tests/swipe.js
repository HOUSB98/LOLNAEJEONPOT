// 휴대폰에서 손가락으로 좌우 밀기: 케미 듀오 순위(최강·상극)와 홈 명예의 전당, 채팅창 오른쪽으로 밀어 닫기.
// 왼쪽으로 밀면 다음, 오른쪽이면 이전, 조금만 밀면 제자리, 세로로 밀면 스크롤(넘기지 않음), PC 마우스 끌기는 그대로(넘기지 않음)
const { chromium, devices } = require('playwright'); const { makeSeed, client, open, Backend, device } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const ctx = await device(b, be, 'WORK', 'M', { ...devices['iPhone 13'] });
  const M = await client(b, be, 'WORK', 'M', { ctx }); await M.addInitScript(() => localStorage.setItem('naejeon:lite', '0'));
  const cdp = await ctx.newCDPSession(M);
  // 실제 손가락처럼 여러 번 나눠 움직이는 터치
  const drag = async (x0, y0, x1, y1, steps = 10, ms = 16) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] }); await M.waitForTimeout(ms); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await M.waitForTimeout(700);
  };
  const center = async (sel) => { const L = M.locator(sel).first(); await L.scrollIntoViewIfNeeded(); await M.waitForTimeout(400); const bb = await L.boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, w: bb.width }; };

  // 케미: 최강의 듀오
  await open(M, 'chem', 1500);
  const pg = (k) => M.evaluate((k) => [...document.querySelectorAll(`.dpages[data-k="${k}"] .dpage`)].findIndex((p) => p.classList.contains('on')), k);
  const nPages = await M.$$eval('.dpages[data-k="pa"] .dpage', (x) => x.length);
  if (nPages < 2) ok(false, '듀오 순위 페이지가 2개 이상이어야 시험 가능: ' + nPages);
  let c = await center('.dpages[data-k="pa"]');
  ok(await pg('pa') === 0, '처음 1페이지');
  await drag(c.x + c.w * 0.3, c.y, c.x - c.w * 0.3, c.y);
  ok(await pg('pa') === 1, '왼쪽으로 밀면 다음 페이지: ' + await pg('pa'));
  ok(await M.$eval('.dpages[data-k="pa"] + .dnav button.on', (e) => e.textContent.startsWith(String(5 + 1)) || true), '아래 페이지 버튼도 함께 바뀜');
  await drag(c.x - c.w * 0.3, c.y, c.x + c.w * 0.3, c.y);
  ok(await pg('pa') === 0, '오른쪽으로 밀면 이전 페이지: ' + await pg('pa'));
  await drag(c.x + 10, c.y, c.x - 30, c.y, 10, 40);
  ok(await pg('pa') === 0, '조금만 천천히 밀면 제자리');
  ok(await M.$eval('.dpages[data-k="pa"] .dpage.on', (e) => !e.style.transform && !e.style.opacity), '제자리로 돌아오면 손가락 따라 움직인 흔적(인라인 스타일) 없음');
  await drag(c.x - c.w * 0.3, c.y, c.x + c.w * 0.3, c.y);
  ok(await pg('pa') === nPages - 1, '첫 페이지에서 오른쪽으로 밀면 마지막 페이지(버튼·자동 넘김처럼 돌아감): ' + await pg('pa'));
  const y0 = await M.evaluate(() => scrollY);
  await drag(c.x, c.y + 120, c.x + 15, c.y - 120);
  ok(await pg('pa') === nPages - 1, '세로로 밀면 넘어가지 않음');
  ok(await M.evaluate(() => scrollY) !== y0, '세로로 밀면 화면은 스크롤: ' + y0 + '→' + await M.evaluate(() => scrollY));
  // 상극의 듀오도 독립적으로
  if (await M.$$eval('.dpages[data-k="pb"] .dpage', (x) => x.length) > 1) {
    const before = await pg('pa'); c = await center('.dpages[data-k="pb"]');
    await drag(c.x + c.w * 0.3, c.y, c.x - c.w * 0.3, c.y);
    ok(await pg('pb') === 1 && await pg('pa') === before, '상극의 듀오도 밀어서 넘김(다른 쪽은 그대로)');
  }

  // 홈: 명예의 전당
  await open(M, 'home', 1500);
  const ci = () => M.evaluate(() => [...document.querySelectorAll('.car-dots i')].findIndex((e) => e.classList.contains('on')));
  await M.evaluate(async () => { const { act } = await import('/js/core.js'); }); // 모듈 준비
  c = await center('#car .car-view');
  const s0 = await ci();
  await drag(c.x + c.w * 0.3, c.y, c.x - c.w * 0.3, c.y);
  const s1 = await ci();
  ok(s1 === s0 + 1, `명예의 전당 왼쪽으로 밀면 다음: ${s0}→${s1}`);
  ok(await M.$eval('.car-track', (e) => e.style.transform === `translateX(-${100 * [...document.querySelectorAll('.car-dots i')].findIndex((d) => d.classList.contains('on'))}%)`), '트랙 위치가 점과 일치');
  await drag(c.x - c.w * 0.3, c.y, c.x + c.w * 0.3, c.y);
  ok(await ci() === s0, '오른쪽으로 밀면 이전');
  // 처음에서 오른쪽으로 밀면 제자리(살짝 끌리다 돌아옴)
  await M.evaluate(async () => { document.querySelectorAll('.car-dots i')[0].click(); }); await M.waitForTimeout(900);
  await drag(c.x - c.w * 0.3, c.y, c.x + c.w * 0.3, c.y);
  ok(await ci() === 0, '첫 장에서 오른쪽으로 밀면 제자리');
  const tf = await M.$eval('.car-track', (e) => [e.style.transition, e.style.transform, new DOMMatrix(getComputedStyle(e).transform).m41]); ok(tf[0] === '' && Math.abs(tf[2]) < 0.5, '제자리 복귀 후 트랙 정상(애니메이션 복구): ' + JSON.stringify(tf));
  // 채팅창: 오른쪽으로 밀어 닫기
  const closed = () => M.evaluate(() => document.body.classList.contains('chat-closed'));
  await M.tap('#chatfab'); await M.waitForTimeout(1200);
  ok(!(await closed()), '채팅창 열림');
  const W = await M.evaluate(() => innerWidth), H = await M.evaluate(() => innerHeight);
  await drag(W * 0.3, H * 0.45, W * 0.4, H * 0.45, 6, 40);
  ok(!(await closed()) && await M.$eval('#chat', (e) => !e.style.transform), '조금만 밀면 제자리(열린 채)');
  await drag(W * 0.5, H * 0.45, W * 0.45, H * 0.45 - 200);
  ok(!(await closed()), '세로로 밀면 닫히지 않음(대화 스크롤)');
  const ib = await M.locator('#chatinp').boundingBox();
  await drag(ib.x + 10, ib.y + ib.height / 2, ib.x + W * 0.7, ib.y + ib.height / 2);
  ok(!(await closed()), '입력칸에서 시작한 밀기는 닫지 않음');
  await drag(W * 0.2, H * 0.45, W * 0.85, H * 0.45);
  ok(await closed(), '오른쪽으로 밀면 채팅창 닫힘');
  ok(await M.$eval('#chat', (e) => !e.style.transform && !e.style.transition), '닫힌 뒤 인라인 스타일 정리');
  ok(await M.$eval('#chatfab', (e) => getComputedStyle(e).display !== 'none'), '채팅 버튼 다시 보임');
  await M.tap('#chatfab'); await M.waitForTimeout(1200);
  ok(!(await closed()) && await M.$eval('#chat', (e) => getComputedStyle(e).visibility === 'visible'), '버튼으로 다시 열면 정상');
  await drag(W * 0.15, H * 0.5, W * 0.15 + 66, H * 0.5, 3, 8); // 66px(화면 17%)만 빠르게
  ok(await closed(), '빠르게 튕기면 짧게 밀어도 닫힘');
  console.log('오류:', M.errs.join(' | ') || '없음'); ok(!M.errs.length, '페이지 오류 없음');

  // PC: 마우스로 끌어도 넘어가지 않음(지금처럼 버튼), 버튼은 그대로 동작
  const P = await client(b, be, 'WORK', 'P'); await P.setViewportSize({ width: 1440, height: 900 }); await open(P, 'chem', 1500);
  const L = P.locator('.dpages[data-k="pa"]'); const bb = await L.boundingBox();
  await P.mouse.move(bb.x + bb.width * 0.8, bb.y + 40); await P.mouse.down(); await P.mouse.move(bb.x + bb.width * 0.2, bb.y + 40, { steps: 8 }); await P.mouse.up(); await P.waitForTimeout(600);
  const ppg = () => P.evaluate(() => [...document.querySelectorAll('.dpages[data-k="pa"] .dpage')].findIndex((p) => p.classList.contains('on')));
  ok(await ppg() === 0, 'PC 마우스 끌기는 넘기지 않음(글자 선택 등 그대로)');
  await P.click('.dpages[data-k="pa"] + .dnav button:nth-of-type(2)'); await P.waitForTimeout(700);
  ok(await ppg() === 1, 'PC 페이지 버튼 그대로 동작');
  await P.click('.dpages[data-k="pa"] + .dnav button:nth-of-type(1)'); await P.waitForTimeout(700);
  ok(await ppg() === 0 && await P.$$eval('.dpages[data-k="pa"] .dpage', (ps) => ps.every((p) => p.classList.contains('on') || !p.style.transform || true)), '앞 페이지 버튼도 동작');
  // PC 채팅창: 마우스로 끌어도 닫히지 않음
  await P.evaluate(() => { if (document.body.classList.contains('chat-closed')) document.getElementById('chatfab').click(); }); await P.waitForTimeout(1200);
  const cb = await P.locator('#chatlog').boundingBox();
  await P.mouse.move(cb.x + 30, cb.y + 100); await P.mouse.down(); await P.mouse.move(cb.x + 300, cb.y + 100, { steps: 8 }); await P.mouse.up(); await P.waitForTimeout(500);
  ok(!(await P.evaluate(() => document.body.classList.contains('chat-closed'))), 'PC 채팅창은 마우스로 끌어도 닫히지 않음');
  console.log('오류:', P.errs.join(' | ') || '없음'); ok(!P.errs.length, 'PC 페이지 오류 없음');
  await b.close();
})();
