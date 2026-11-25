// 오늘 내전 모집(라인 지원과 따로): 오늘의 내전 화면 위쪽 칸. 모집 전엔 얇은 안내 줄, 시간을 정해 시작하면 'N/10' 칸·지원자 이름·참가/취소.
// 다른 기기에 바로 반영, 시간을 바꿔도 지원자는 그대로, 시작 시각 + 6시간이 지나면 끝(다시 안내 줄). 읽기는 참가 1번에 접속자마다 1
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const stub = () => { window.__kk = []; window.Kakao = { _i: false, isInitialized() { return this._i; }, init() { this._i = true; }, Share: { sendDefault(o) { window.__kk.push(o); } } }; };
  const A = await client(b, be, 'WORK', '철수'); await A.addInitScript(stub);
  const M = await client(b, be, 'WORK', '영희', { ctx: await device(b, be, 'WORK', '영희', { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }) }); await M.addInitScript(stub);
  await open(A, 'today', 800); await open(M, 'today', 800);
  const R = () => be.db.meta.recruit;
  ok(await A.$eval('#main .rc-bar', (e) => /시간을 정하고 카톡으로/.test(e.innerText)).catch(() => false) && !(await A.$('#main .rc-box')), '모집 전: 오늘의 내전 위쪽에 얇은 안내 줄만');
  // 시작: 21:00, 나도 참가
  await A.click('#main .rc-bar [data-a=rcOpen]'); await A.waitForTimeout(300);
  ok(await A.$$eval('#modal.on [data-a=rcTime]', (x) => x.map((e) => e.innerText).join(',')) === '오후 8:00,오후 9:00,오후 10:00,오후 11:00', '모집 창: 시간 고르기(오후 8~11시 + 직접 입력)·오늘/내일');
  await A.click('#modal.on [data-a=rcDay][data-v="0"]'); await A.fill('#modal.on [data-c=rcTimeIn]', '21:30'); await A.dispatchEvent('#modal.on [data-c=rcTimeIn]', 'change');
  await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  const d1 = R(), w = new Date(d1?.when || 0);
  ok(d1 && w.getHours() === 21 && w.getMinutes() === 30 && Object.values(d1.list).map((x) => x.n).join() === '철수' && d1.by === '철수', '저장: 오늘 21:30, 시작한 사람 = 철수, 철수 참가');
  ok(!(await A.$('#modal.on')), '저장하고 창 닫힘');
  const pa = await A.$eval('#main .rc-box', (e) => ({ t: e.innerText.replace(/\s+/g, ' '), n: e.querySelector('.rc-n').innerText.replace(/\s/g, ''), on: e.querySelectorAll('.rc-slots i.on').length })).catch(() => null);
  ok(pa && /오늘 오후 9:30 내전 모집/.test(pa.t) && pa.n === '1/10' && pa.on === 1 && /철수/.test(pa.t) && /참가 취소/.test(pa.t), '모집 칸: "오늘 오후 9:30 내전 모집" · 1/10 · 칸 1개 · 철수 · 참가 취소: ' + (pa && pa.n));
  // 다른 기기(휴대폰)에 바로 보이고 참가
  await M.waitForTimeout(600);
  ok(await M.$eval('#main .rc-box .rc-n', (e) => e.innerText.replace(/\s/g, '')).catch(() => '') === '1/10', '다른 기기(휴대폰)에도 바로 1/10');
  be.reset();
  await M.tap('#main .rc-box [data-a=rcJoin]'); await M.waitForTimeout(900);
  ok(Object.values(R().list).map((x) => x.n).sort().join() === '영희,철수', '휴대폰에서 참가 → 저장(철수·영희)');
  ok((be.byCol['reads:meta'] || 0) <= 4, `참가 한 번에 읽기 ${be.byCol['reads:meta'] || 0}번(접속자마다 1 + 저장 확인)`);
  const pa2 = await A.$eval('#main .rc-box', (e) => ({ n: e.querySelector('.rc-n').innerText.replace(/\s/g, ''), ppl: [...e.querySelectorAll('.rc-p')].map((x) => x.innerText) }));
  ok(pa2.n === '2/10' && pa2.ppl.join() === '철수,영희', 'PC 화면도 바로 2/10 · 철수, 영희(지원 순서)');
  ok(await M.$eval('#main .rc-box .rc-p.me', (e) => e.innerText).catch(() => '') === '영희', '내 이름은 노란 테두리로 표시');
  // 카드에 지금 인원
  await A.click('#main .rc-box [data-a=rcShare]'); await A.waitForTimeout(700);
  ok(/지금 2명 지원 · 8명 더 필요해요/.test(await A.evaluate(() => window.__kk.at(-1)?.content.description || '')), '다시 보내면 카드에 지금 인원(2명 · 8명 더)');
  // 시간 바꾸기: 지원자 유지
  await A.click('#main .rc-box [data-a=rcOpen]'); await A.waitForTimeout(300);
  await A.click('#modal.on [data-a=rcTime][data-v="22:00"]'); await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  ok(new Date(R().when).getHours() === 22 && Object.keys(R().list).length === 2 && R().by === '철수', '시간을 22:00으로 바꿔도 지원자 2명 그대로');
  await M.waitForTimeout(500);
  ok(/오늘 오후 10:00 내전 모집/.test(await M.$eval('#main .rc-box', (e) => e.innerText)), '휴대폰에도 바뀐 시간');
  // 참가 취소
  await M.tap('#main .rc-box [data-a=rcJoin]'); await M.waitForTimeout(900);
  ok(Object.values(R().list).map((x) => x.n).join() === '철수' && await A.$eval('#main .rc-box .rc-n', (e) => e.innerText.replace(/\s/g, '')) === '1/10', '참가 취소 → 1/10');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await M.$eval('#main .rc-box [data-a=rcJoin]', (e) => e.getBoundingClientRect().height >= 36), '휴대폰: 가로 넘침 없음, 참가 버튼 크기 충분');
  // 라인 지원·경기 입력은 그대로
  ok(await A.$$eval('#main .lrow', (x) => x.length) === 5 && !!(await A.$('#main [data-a=tBoard]')) && !!(await A.$('#main [data-a=tSave]')), '라인업·라인 지원·결과 저장은 그대로');
  // 끝난 모집(시작 + 6시간 지남) → 안내 줄로
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => ({ ...r, when: Date.now() - 7 * 3600e3 })); }); await A.waitForTimeout(800);
  ok(!!(await A.$('#main .rc-bar')) && !(await A.$('#main .rc-box')), '시작 시각 + 6시간이 지나면 모집 끝 → 안내 줄');
  await A.click('#main .rc-bar [data-a=rcOpen]'); await A.waitForTimeout(300); await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  ok(Object.values(R().list).map((x) => x.n).join() === '철수' && R().when > Date.now() - 3600e3, '새로 시작하면 지원자 새로(지난 모집 명단은 비움)');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
