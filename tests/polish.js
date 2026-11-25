// 다듬기(2026-11-25): 새 버전 알림 띠 · 진단 정보 복사 · 오늘의 내전 바뀐 구역만 다시 그리기 · 시즌 CSS 분리(시즌에만 받음)
// · 크리스마스 스킨 목록(라이엇 서버에 요청 안 함) · 화면 이모지 → 선 아이콘 · 휴대폰 관리 탭 높이·작은 글씨
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const errs = [];
  // 1) 새 버전 알림 띠
  const A = await client(b, be, 'WORK', 'A', { ctx: await device(b, be, 'WORK', 'A', { permissions: ['clipboard-read', 'clipboard-write'] }) });
  let served = null;
  await A.route(/\?vc=\d+/, async (r) => { let t = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8'); if (served) t = t.replace(/var V = '[^']+'/, `var V = '${served}'`); r.fulfill({ status: 200, body: t, headers: { 'Content-Type': 'text/html' } }); });
  await open(A, 'home', 800);
  const vis = () => A.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await vis(); await A.waitForTimeout(600);
  ok(!(await A.$('#verbar')), '버전이 같으면 띠 없음');
  served = 'zz-new';
  await A.evaluate(() => { const t = Date.now; // 다시 확인 간격(2분)을 시험에서는 시계를 앞당겨 넘김
    Date.now = () => t() + 3 * 60e3; });
  await vis(); await A.waitForTimeout(600);
  const bar = await A.$eval('#verbar', (e) => ({ t: e.innerText, r: e.getBoundingClientRect() })).catch(() => null);
  ok(bar && /새 버전/.test(bar.t) && bar.r.top >= 0 && bar.r.top < 80, '새 버전이 올라오면 위쪽에 "새 버전이 나왔어요" 띠');
  await A.click('#verbar [data-a=verClose]'); await A.waitForTimeout(200);
  await A.evaluate(() => { const t = Date.now; Date.now = () => t() + 3 * 60e3; }); await vis(); await A.waitForTimeout(600);
  ok(!(await A.$('#verbar')), '닫으면 같은 버전으로는 다시 안 뜸');
  served = 'zz-new2'; await A.evaluate(() => { const t = Date.now; Date.now = () => t() + 3 * 60e3; }); await vis(); await A.waitForTimeout(600);
  ok(!!(await A.$('#verbar')), '그다음 새 버전이면 다시 뜸');
  const nav = A.waitForNavigation({ timeout: 8000 }).then(() => true).catch(() => false);
  await A.click('#verbar [data-a=verReload]');
  ok(await nav, '새로고침을 누르면 사이트를 다시 엶');
  await A.waitForTimeout(1500);
  // 2) 진단 정보 복사(사이드바)
  ok(!!(await A.$('.sidefoot [data-a=diagCopy]')), '사이드바에 진단 복사 버튼');
  await A.click('.sidefoot [data-a=diagCopy]'); await A.waitForTimeout(2900);
  const clip = await A.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/NAEJEONPOT 진단 정보/.test(clip) && /프레임: 실제 \d+fps · 모니터 약 \d+Hz/.test(clip) && /화면: \d+×\d+/.test(clip) && /그래픽/.test(clip) && !/A\b.*닉네임/.test(clip), '진단 정보 복사: 프레임·주사율·화면·그래픽카드: ' + clip.split('\n').slice(2, 4).join(' / '));
  ok(!clip.includes('test') || !/k=test/.test(clip), '주소(리그 코드)는 넣지 않음');
  errs.push(...A.errs);
  // 3) 오늘의 내전: 바뀐 구역만 다시 그림
  await open(A, 'today', 800);
  const ids = await A.evaluate(async () => (await import('/js/core.js')).S.st.list.slice(0, 10).map((s) => s.id));
  await A.evaluate(async (ids) => { const t = await import('/js/today.js'); t.setDraftTeams(ids.slice(0, 5), ids.slice(5, 10)); (await import('/js/core.js')).refresh(); }, ids);
  await A.waitForTimeout(700);
  await A.evaluate(() => { window.__k = Object.fromEntries([...document.querySelectorAll('#main [data-k]')].map((e) => [e.dataset.k, e])); });
  // 레드 서폿만 바꿈
  await A.evaluate(async (ids) => { const t = await import('/js/today.js'); const { S } = await import('/js/core.js'); const other = S.st.list.find((s) => !ids.includes(s.id)).id; t.setDraftTeams(ids.slice(0, 5), [...ids.slice(5, 9), other]); (await import('/js/core.js')).refresh(); }, ids);
  await A.waitForTimeout(700);
  const same = await A.evaluate(() => Object.fromEntries(Object.entries(window.__k).map(([k, e]) => [k, document.querySelector(`#main [data-k="${k}"]`) === e])));
  ok(same.l0 && same.l1 && same.l2 && same.l3 && same.rh && !same.l4, '레드 서폿만 바꾸면 서폿 줄만 새로 그림(나머지 줄·결과 칸은 그대로): ' + JSON.stringify(same));
  ok(await A.evaluate(() => document.querySelectorAll('#main .lrow').length === 5 && document.querySelectorAll('#main .slot:not(.emp)').length === 10), '라인업 10명 그대로 보임');
  await A.evaluate(() => (location.hash = '#/rank')); await A.waitForTimeout(500); await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(700);
  ok(await A.evaluate(() => document.querySelectorAll('#main .lrow').length === 5 && !!document.querySelector('#main .scorebar')), '다른 화면에 다녀와도 정상');
  // 화면 이모지 대신 선 아이콘: 소통 합 마이크
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.patch('players', id, { talk: 3 }); }, ids[0]); await A.waitForTimeout(900);
  ok(await A.evaluate(() => { const e = document.querySelector('.scorebar .sb-tk'); return !!e && !!e.querySelector('svg.ic') && !/🎙/.test(e.textContent); }), '점수판 소통 합: 이모지 대신 선 아이콘');
  // 라인 지원 창: 자물쇠 아이콘
  await A.evaluate(async () => { const t = await import('/js/today.js'); t.setDraftTeams([null, null, null, null, null], [null, null, null, null, null]); (await import('/js/core.js')).refresh(); }); await A.waitForTimeout(400);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500);
  await A.click('#modal.on [data-a=bdNone]').catch(() => {}); await A.waitForTimeout(200);
  for (const id of ids) await A.click(`#modal.on [data-a=bdSel][data-id="${id}"]`);
  await A.click('#modal.on [data-a=bdOpen]'); await A.waitForTimeout(1200);
  await A.click(`#modal.on [data-a=bdMe][data-id="${ids[0]}"]`); await A.waitForTimeout(500);
  const md = await A.$eval('#modal.on', (e) => ({ h: e.innerHTML, fix: !!e.querySelector('[data-a=bdFixOpen] svg.ic') }));
  ok(md.fix && !md.h.includes('${') && !/[🔒🔓]/u.test(md.h), '라인 지원 창: 라인 고정 버튼에 자물쇠 선 아이콘(이모지·깨진 글자 없음)');
  await A.click('#modal.on [data-a=bdFixOpen]'); await A.waitForTimeout(400);
  ok(await A.$eval('#modal.on', (e) => !!e.querySelector('.lp-fxq svg.ic') && !e.innerHTML.includes('${')), '고정할 라인 고르기에도 선 아이콘');
  errs.push(...A.errs);
  // 4) 시즌 CSS: 시즌(11월 말)에는 받고, 시즌이 아니면(2월) 안 받음 — 사이트는 그대로
  ok(await A.evaluate(() => !!document.querySelector('link[href*="css/season.css"]') && getComputedStyle(document.body).getPropertyValue('--x') !== null), '시즌 기간: season.css 받음');
  ok(await A.evaluate(() => document.body.classList.contains('xmas') && !!document.querySelector('#xlights, .xhat')), '크리스마스 장식 그대로 보임');
  const F = await client(b, be, 'WORK', 'F', { clock: { time: new Date('2027-02-03T12:00:00') } });
  const cssReq = []; F.on('request', (r) => { if (/\.css/.test(r.url())) cssReq.push(r.url().replace(/^https:\/\/site\.test\//, '')); });
  await open(F, 'home', 800);
  ok(!cssReq.some((u) => /season\.css/.test(u)) && cssReq.some((u) => /style\.css/.test(u)), '시즌이 아니면 season.css를 받지 않음: ' + cssReq.join(', '));
  const off = await F.evaluate(() => [document.body.classList.contains('xmas'), getComputedStyle(document.querySelector('.brand')).position, document.querySelectorAll('#main .panel, #main section').length, new Date().getMonth()]);
  ok(!off[0] && off[1] === 'relative' && off[2] > 3, '시즌이 아니어도 화면 정상(장식 없음): ' + JSON.stringify(off));
  errs.push(...F.errs); await F.context().close();
  // 5) 크리스마스 스킨: 라이엇 서버에 챔피언별 자료를 요청하지 않음
  const X = await client(b, be, 'WORK', 'X');
  const CH = ['Braum', 'Corki', 'Draven', 'Gragas', 'Garen', 'Ahri'];
  await X.addInitScript((CH) => { if (location.origin !== 'https://site.test') return; localStorage.setItem('naejeon:lite', '0'); localStorage.setItem('naejeon:champs4', JSON.stringify({ ver: '16.23.1', at: Date.now(), list: CH.map((id, i) => ({ id, key: i + 1, name: id + '한', img: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' })) })); }, CH);
  const dd = []; X.on('request', (r) => { if (/ddragon/.test(r.url())) dd.push(r.url()); });
  await open(X, 'home', 2500);
  ok(!dd.some((u) => /\/data\/ko_KR\/champion\/\w+\.json/.test(u)), `챔피언별 자료 요청 0번(예전 50번): ddragon 요청 ${dd.length}개`);
  const hf = await X.evaluate(() => JSON.parse(localStorage.getItem('naejeon:herofirst') || 'null'));
  ok(dd.some((u) => /centered\/(Braum_10|Corki_2|Draven_12|Gragas_3)\.jpg/.test(u)) && hf?.xm === true, '배너는 크리스마스 스킨 일러스트 그대로(시험에선 그림을 못 받아 요청만 확인): ' + (hf?.cap || ''));
  errs.push(...X.errs); await X.context().close();
  // 6) 휴대폰: 관리 탭 높이, 작은 글씨
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  await open(M, 'admin', 800);
  ok(await M.$$eval('.adm-tabs button', (x) => x.length > 2 && x.every((e) => e.getBoundingClientRect().height >= 40)), '휴대폰 관리 탭 높이 40px 이상');
  await open(M, 'home', 800);
  ok(await M.$$eval('.fm .dots i', (x) => x.length && x.every((e) => parseFloat(getComputedStyle(e).fontSize) >= 11)), '홈 요즘 폼 승패 글씨 11px 이상');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 가로 넘침 없음');
  errs.push(...M.errs);
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
