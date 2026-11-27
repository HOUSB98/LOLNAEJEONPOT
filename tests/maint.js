// 폐쇄(점검) 모드(config.js MAINT = true): 일반 접속자는 '사이트 폐쇄' 화면만(메뉴·채팅 없음, 실시간 구독 멈춤, 접속 기록 쓰기 없음),
// 관리자 PIN을 넣으면 들어가고(틀리면 거절), 같은 기기는 다시 열어도 바로 들어감 + '점검 모드' 띠, 휴대폰 가로 넘침 없음
const { chromium } = require('playwright'); const { makeSeed, client, device, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const sha = require('crypto').createHash('sha256').update('naejeon:4321').digest('hex');
  seed.meta.find((x) => x.id === 'settings').pinHash = sha;
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A', { ctx: await device(b, be, 'WORK', 'A', { maint: true }) });
  await A.goto('https://site.test/?k=test#/home'); await A.waitForSelector('#np-maint', { timeout: 15000 }); await A.waitForTimeout(800);
  be.reset();
  const v = await A.evaluate(() => ({ h: document.querySelector('#np-maint h1')?.innerText, nav: document.querySelectorAll('#nav a').length, main: document.getElementById('main').innerText.trim().length, chat: document.getElementById('chat').innerText.trim().length, sp: !!document.getElementById('splash') }));
  ok(v.h === '사이트가 폐쇄되었습니다' && !v.nav && !v.main && !v.chat && !v.sp, '일반 접속자: 사이트 폐쇄 화면만(메뉴·본문·채팅 없음): ' + JSON.stringify(v));
  await A.waitForTimeout(1500);
  ok(!Object.keys(be.byCol).some((k) => k.startsWith('writes')), '점검 화면에서는 아무것도 쓰지 않음(접속 기록 포함): ' + JSON.stringify(be.byCol));
  await A.click('.mt-adm summary'); await A.fill('#mt-pin', '1111'); await A.click('#mt-f .btn'); await A.waitForTimeout(500);
  ok(!!(await A.$('#np-maint')), '틀린 PIN은 거절');
  await A.fill('#mt-pin', '4321'); await Promise.all([A.waitForNavigation(), A.click('#mt-f .btn')]);
  await A.waitForFunction(() => document.querySelector('#presence .prh') && document.getElementById('main').innerText.length > 50, null, { timeout: 15000 });
  ok(!(await A.$('#np-maint')) && !!(await A.$('#np-mbar')) && (await A.$$('#nav a')).length > 5, '관리자 PIN → 사이트 들어감 + 폐쇄 모드 띠');
  await A.goto('https://site.test/?k=test#/rank'); await A.waitForFunction(() => document.getElementById('main').innerText.length > 50, null, { timeout: 15000 });
  ok(!(await A.$('#np-maint')), '같은 기기는 다시 열어도 바로 들어감');
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { maint: true, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  await M.goto('https://site.test/?k=test#/home'); await M.waitForSelector('#np-maint', { timeout: 15000 });
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 점검 화면 가로 넘침 없음');
  // 페이지 주소를 붙여 들어와도 폐쇄 화면
  for (const h of ['rank', 'auction', 'guilds', 'players']) { await M.goto('https://site.test/?k=test#/' + h); await M.waitForSelector('#np-maint', { timeout: 15000 }); }
  ok(!(await M.$$('#nav a')).length && !(await M.evaluate(() => document.getElementById('main').innerText.trim().length)), '페이지 주소(#/rank·auction·guilds·players)로 들어와도 폐쇄 화면만');
  // 폐쇄 화면을 띄워 둬도 1분마다 새로고침되지 않음(가짜 시계로 3분 넘김)
  const C = await client(b, be, 'WORK', 'C', { ctx: await device(b, be, 'WORK', 'C', { maint: true }), clock: true });
  await C.goto('https://site.test/?k=test#/home'); await C.waitForSelector('#np-maint', { timeout: 15000 });
  await C.evaluate(() => (window.__stay = 1)); await C.clock.runFor(185e3); await C.waitForTimeout(500);
  ok(await C.evaluate(() => window.__stay === 1 && !!document.getElementById('np-maint')), '폐쇄 화면은 시간이 지나도 저절로 새로고침되지 않음');
  // 폐쇄 전부터 열어 둔 화면: 폐쇄가 켜지면 10분 안에 스스로 폐쇄 화면으로
  const O = await client(b, be, 'WORK', 'O', { ctx: await device(b, be, 'WORK', 'O'), clock: true });
  await O.goto('https://site.test/?k=test#/rank'); await O.waitForFunction(() => document.getElementById('main').innerText.length > 50, null, { timeout: 15000 });
  ok(!(await O.$('#np-maint')), '폐쇄 전: 평소 화면');
  await O.ctx.route(/\/js\/config\.js\?mc=/, async (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export const MAINT = true;' }));
  await O.clock.runFor(10 * 60e3 + 1000); await O.waitForTimeout(800);
  ok(!!(await O.$('#np-maint')) && /폐쇄/.test(await O.title()), '열어 둔 화면도 폐쇄가 켜지면 10분 안에 폐쇄 화면으로 바뀜');
  const errs = [...A.errs, ...M.errs, ...C.errs, ...O.errs]; console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
