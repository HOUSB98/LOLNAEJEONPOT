// 오늘 내전 모집(라인 지원과 따로 셈): 오늘의 내전 위쪽 칸·홈 맨 위 띠. 시간을 정해 시작(내 이름 자동 선택), 참가는 '이름 골라 참가' 창에서
// 선수 이름을 눌러 참가 ↔ 취소(선수 기준이라 PC·휴대폰에서 같은 이름은 한 명), 다른 기기 실시간, 시간 바꿔도 명단 유지, 라인 지원을 열면
// 모집 참가자를 미리 골라 둠('모집 참가자 N명' 버튼), 휴대폰 버튼 배치, 6시간 뒤 끝. 카톡 카드엔 인원·이름 없음
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const P = Object.fromEntries(seed.players.map((p) => [p.id, p.name])), ids = seed.players.map((p) => p.id);
  const stub = () => { window.__kk = []; window.Kakao = { _i: false, isInitialized() { return this._i; }, init() { this._i = true; }, Share: { sendDefault(o) { window.__kk.push(o); } } }; };
  // PC 닉네임 = 첫 번째 선수 이름(내 이름 자동 선택), 휴대폰 닉네임은 선수와 무관
  const A = await client(b, be, 'WORK', P[ids[0]]); await A.addInitScript(stub);
  const M = await client(b, be, 'WORK', '영희폰', { ctx: await device(b, be, 'WORK', '영희폰', { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }) }); await M.addInitScript(stub);
  await open(A, 'home', 800); await open(M, 'today', 800);
  const R = () => be.db.meta.recruit, names = () => Object.values(R().list).map((x) => x.n).sort().join(',');
  ok(!(await A.$('#main .rc-home')), '모집 전: 홈에 모집 띠 없음');
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(600);
  ok(await A.$eval('#main .rc-bar', (e) => /시간을 정하고 카톡으로/.test(e.innerText)).catch(() => false), '모집 전: 오늘의 내전 위쪽에 얇은 안내 줄');
  // 시작: 21:30, 나도 참가 = 닉네임과 같은 선수가 자동 선택
  await A.click('#main .rc-bar [data-a=rcOpen]'); await A.waitForTimeout(300);
  ok(await A.$eval('#modal.on [data-c=rcMe]', (e) => e.value) === ids[0], `모집 창 '나도 참가': 닉네임과 같은 선수(${P[ids[0]]})가 자동 선택`);
  await A.fill('#modal.on [data-c=rcTimeIn]', '21:30'); await A.dispatchEvent('#modal.on [data-c=rcTimeIn]', 'change');
  await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  const w = new Date(R().when);
  ok(w.getHours() === 21 && w.getMinutes() === 30 && names() === P[ids[0]] && R().list[ids[0]]?.pid === ids[0], `저장: 오늘 21:30, ${P[ids[0]]}(선수 id로) 참가`);
  ok(!/지원:|명 지원/.test(await A.evaluate(() => window.__kk.at(-1)?.content.description || 'x')), '카톡 카드엔 인원·이름 없음');
  // 휴대폰: 이름 골라 참가 → 두 명(자기 + 친구 대신)
  await M.waitForTimeout(500);
  ok(await M.$eval('#main .rc-box .rc-n', (e) => e.innerText.replace(/\s/g, '')).catch(() => '') === '1/10', '다른 기기(휴대폰)에 바로 1/10');
  await M.tap('#main .rc-box [data-a=rcPick]'); await M.waitForTimeout(500);
  const chips = await M.$$eval('#modal.on .rc-chips button', (x) => x.map((e) => [e.dataset.id, e.classList.contains('on')]));
  ok(chips.length === ids.length && chips.find((c) => c[0] === ids[0])[1] === true, '이름 고르기 창: 모든 선수 이름, 이미 참가한 이름은 노란색');
  be.reset();
  await M.tap(`#modal.on [data-a=rcToggle][data-id="${ids[1]}"]`); await M.waitForTimeout(800);
  ok((be.byCol['reads:meta'] || 0) <= 4, `참가 한 번에 읽기 ${be.byCol['reads:meta'] || 0}번`);
  await M.tap(`#modal.on [data-a=rcToggle][data-id="${ids[2]}"]`); await M.waitForTimeout(800);
  ok(names() === [P[ids[0]], P[ids[1]], P[ids[2]]].sort().join(','), '이름을 누르면 바로 참가(친구 대신도): 3명');
  ok(await M.$eval(`#modal.on [data-a=rcToggle][data-id="${ids[1]}"]`, (e) => e.classList.contains('on')) && /3\/10/.test(await M.$eval('#modal.on .rc-pick', (e) => e.innerText)), '창 안에서도 바로 노란색·3/10');
  // 같은 사람이 PC에서 또 눌러도(같은 이름) 한 명: PC에서 ids[1]을 누르면 취소가 됨
  await A.click('#main .rc-box [data-a=rcPick]'); await A.waitForTimeout(400);
  ok(await A.$eval(`#modal.on [data-a=rcToggle][data-id="${ids[1]}"]`, (e) => e.classList.contains('on')), 'PC 창에도 휴대폰에서 고른 이름이 노란색(같은 이름은 한 명으로)');
  await A.click(`#modal.on [data-a=rcToggle][data-id="${ids[1]}"]`); await A.waitForTimeout(800);
  ok(names() === [P[ids[0]], P[ids[2]]].sort().join(','), '다시 누르면 참가 취소(두 번 세지 않음)');
  await A.click('#modal.on [data-a=close]'); await M.tap('#modal.on [data-a=close]'); await A.waitForTimeout(300);
  const pa = await A.$eval('#main .rc-box', (e) => ({ n: e.querySelector('.rc-n').innerText.replace(/\s/g, ''), ppl: [...e.querySelectorAll('.rc-p')].map((x) => [x.innerText, x.classList.contains('me')]) }));
  ok(pa.n === '2/10' && pa.ppl.length === 2 && pa.ppl.find((x) => x[0] === P[ids[0]])[1], '모집 칸 2/10 · 내 이름(닉네임과 같은 선수)은 노란 테두리');
  // 홈 띠
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(700);
  const hb = await A.$eval('#main .rc-home', (e) => ({ t: e.innerText.replace(/\s+/g, ' '), h: e.getAttribute('href'), first: e === document.querySelector('#main').firstElementChild })).catch(() => null);
  ok(hb && /오늘 오후 9:30 내전 모집 중/.test(hb.t) && /2\s*\/10/.test(hb.t) && /참가하기/.test(hb.t) && hb.h === '#/today' && hb.first, '홈 맨 위 띠: "오늘 오후 9:30 내전 모집 중 · 2/10 · 참가하기" → 오늘의 내전');
  await M.evaluate(() => (location.hash = '#/home')); await M.waitForTimeout(700);
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => ({ ...r, list: { ...r.list, [id]: { n: 'x', pid: id, by: 'c', at: Date.now() } } })); }, ids[3]); await A.waitForTimeout(800);
  ok(/3\s*\/10/.test(await M.$eval('#main .rc-home', (e) => e.innerText)) && await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 홈 띠도 바로 3/10, 가로 넘침 없음');
  await M.tap('#main .rc-home'); await M.waitForTimeout(700);
  ok(await M.evaluate(() => location.hash === '#/today' && !!document.querySelector('#main .rc-box')), '띠를 누르면 오늘의 내전 모집 칸으로');
  // 휴대폰 버튼 배치: 참가 버튼 넓게, 아래 줄에 시간 바꾸기·카톡 반씩
  const lay = await M.evaluate(() => { const j = document.querySelector('.rc-box .rc-join').getBoundingClientRect(), s = [...document.querySelectorAll('.rc-box .rc-sub .btn')].map((e) => e.getBoundingClientRect()), box = document.querySelector('.rc-box').getBoundingClientRect(); return { jw: j.width / box.width, two: s.length === 2 && Math.abs(s[0].top - s[1].top) < 2 && Math.abs(s[0].width - s[1].width) < 3 && s[0].top > j.bottom - 1 }; });
  ok(lay.jw > 0.85 && lay.two, '휴대폰: 참가 버튼은 한 줄 넓게, 아래 줄에 시간 바꾸기·카톡으로 모집이 반씩');
  // 라인 지원: 모집 참가자를 미리 골라 둠
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(600);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(600);
  const sel = await A.$$eval('#modal.on [data-a=bdSel].on', (x) => x.map((e) => e.dataset.id).sort());
  ok(JSON.stringify(sel) === JSON.stringify([ids[0], ids[2], ids[3]].sort()), '라인 지원 열기: 모집 참가자 3명이 미리 선택됨');
  ok(/모집 참가자 3명/.test(await A.$eval('#modal.on .ph', (e) => e.innerText)), "참가자 머리에 '모집 참가자 3명' 버튼");
  await A.click('#modal.on [data-a=bdNone]'); await A.waitForTimeout(200); await A.click('#modal.on [data-a=bdRecruit]'); await A.waitForTimeout(200);
  ok((await A.$$eval('#modal.on [data-a=bdSel].on', (x) => x.length)) === 3, "'모집 참가자' 버튼으로 다시 3명 선택");
  await A.click('#modal.on [data-a=close]'); await A.waitForTimeout(300);
  // 시간 바꾸기: 명단 유지
  await A.click('#main .rc-box [data-a=rcOpen]'); await A.waitForTimeout(300);
  await A.click('#modal.on [data-a=rcTime][data-v="22:00"]'); await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  ok(new Date(R().when).getHours() === 22 && Object.keys(R().list).length === 3, '시간을 22:00으로 바꿔도 참가자 3명 그대로');
  ok(await A.$$eval('#main .lrow', (x) => x.length) === 5 && !!(await A.$('#main [data-a=tSave]')), '라인업·결과 저장은 그대로');
  // 끝(시작 + 6시간)
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => ({ ...r, when: Date.now() - 7 * 3600e3 })); }); await A.waitForTimeout(800);
  ok(!!(await A.$('#main .rc-bar')) && !(await A.$('#main .rc-box')), '시작 + 6시간이 지나면 모집 끝 → 안내 줄');
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(500);
  ok(!(await A.$('#main .rc-home')), '홈 띠도 사라짐');
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(500);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500);
  ok(!(await A.$('#modal.on [data-a=bdRecruit]')), '끝난 모집은 라인 지원에 쓰지 않음');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
