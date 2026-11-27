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
  await open(A, 'home', 800); await open(M, 'recruit', 800);
  const R = () => be.db.meta.recruit, names = () => Object.values(R().list).map((x) => x.n).sort().join(',');
  ok(!(await A.$('#main .rc-home')), '모집 전: 홈에 모집 띠 없음');
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(600);
  ok(!(await A.$('#main .rc-box, #main .rc-empty, #main .rc-bar')), '오늘의 내전 화면에는 모집 칸이 없음(따로 만든 내전 모집 화면으로 옮김)');
  await A.click('#rail .rl-q.kk'); await A.waitForTimeout(600);
  ok(await A.evaluate(() => location.hash === '#/recruit' && document.title === '내전 모집 · NAEJEONPOT'), "왼쪽 위 '내전 모집' → 내전 모집 화면(탭 제목 '내전 모집')");
  ok(await A.$eval('#main .rc-empty', (e) => /진행 중인 모집이 없어요/.test(e.innerText)).catch(() => false) && !!(await A.$('#main .rc-how')), '모집 전: 빈 칸(시간 정하고 모집 시작) + 사용법');
  // 시작: 21:30, 나도 참가 = 닉네임과 같은 선수가 자동 선택
  await A.click('#main .rc-empty [data-a=rcOpen]'); await A.waitForTimeout(300);
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
  const gp = await M.evaluate(() => { const g = (q) => document.querySelector('#modal.on ' + q).getBoundingClientRect(); const c = g('.rc-chips'), i = g('.rc-guest'), x = g('.rc-pick>.btn.block'); return { a: Math.round(i.top - c.bottom), b: Math.round(x.top - i.bottom) }; });
  ok(gp.a >= 10 && gp.b >= 10, '휴대폰 이름 고르기 창: 이름 칩 · 이름 입력 · 닫기 사이 간격(붙지 않음): ' + JSON.stringify(gp));
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
  // 목록에 없는 사람(이름 입력)
  await M.tap('#main .rc-box [data-a=rcPick]'); await M.waitForTimeout(400);
  await M.fill('#rc-gname', '손님 민지'); await M.tap('#modal.on [data-a=rcGuest]'); await M.waitForTimeout(800);
  ok(Object.values(R().list).some((x) => x.g && x.n === '손님 민지') && await M.$eval('#modal.on', (e) => /목록에 없는 사람/.test(e.innerText) && /손님 민지/.test(e.innerText)), '목록에 없는 사람: 이름을 적어 참가(손님 민지)');
  await M.fill('#rc-gname', '손님 민지'); await M.tap('#modal.on [data-a=rcGuest]'); await M.waitForTimeout(600);
  ok(Object.values(R().list).filter((x) => x.n === '손님 민지').length === 1, '같은 이름은 한 번만');
  await M.tap('#modal.on [data-a=rcGuestOff]'); await M.waitForTimeout(700);
  ok(!Object.values(R().list).some((x) => x.g), '손님 이름을 누르면 참가 취소');
  await M.tap('#modal.on [data-a=close]'); await M.waitForTimeout(300);
  // 카톡 카드 링크(#/recruit/join)로 들어오면 이름 고르기 창이 바로 열림
  const J = await client(b, be, 'WORK', 'J'); await J.addInitScript(stub); await open(J, 'recruit/join', 900);
  ok(await J.evaluate(() => !!document.querySelector('#modal.on .rc-pick') && location.hash === '#/recruit'), "카톡 '참가하러 가기'(#/recruit/join)로 오면 이름 고르기 창이 바로 열림(주소는 #/recruit로)");
  await J.close();
  // 홈 띠
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(700);
  const hb = await A.$eval('#main .rc-home', (e) => ({ t: e.innerText.replace(/\s+/g, ' '), h: e.getAttribute('href'), first: e === document.querySelector('#main').firstElementChild })).catch(() => null);
  ok(hb && /오늘 오후 9:30 내전 모집 중/.test(hb.t) && /2\s*\/10/.test(hb.t) && /참가하기/.test(hb.t) && hb.h === '#/recruit' && hb.first, '홈 맨 위 띠: "오늘 오후 9:30 내전 모집 중 · 2/10 · 참가하기" → 내전 모집 화면');
  await M.evaluate(() => (location.hash = '#/home')); await M.waitForTimeout(700);
  await M.evaluate(() => { window.__hero = document.querySelector('#main .hero'); window.__bg = document.querySelector('#main .hero-bg.on'); });
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => ({ ...r, list: { ...r.list, [id]: { n: 'x', pid: id, by: 'c', at: Date.now() } } })); }, ids[3]); await A.waitForTimeout(800);
  ok(/3\s*\/10/.test(await M.$eval('#main .rc-home', (e) => e.innerText)) && await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 홈 띠도 바로 3/10, 가로 넘침 없음');
  ok(await M.evaluate(() => window.__hero === document.querySelector('#main .hero') && window.__bg === document.querySelector('#main .hero-bg.on')), '누가 참가해도 홈은 띠만 바뀜(배너는 다시 그리지 않음)');
  ok(await M.$eval('#main .rc-home .rc-ht b', (e) => e.getBoundingClientRect().height < 24 && getComputedStyle(e).whiteSpace === 'nowrap'), '휴대폰 홈 띠 제목은 한 줄');
  await M.tap('#main .rc-home'); await M.waitForTimeout(700);
  ok(await M.evaluate(() => location.hash === '#/recruit' && !!document.querySelector('#main .rc-box')), '띠를 누르면 내전 모집 화면으로');
  // 휴대폰 버튼 배치: 참가 버튼 넓게, 아래 줄에 시간 바꾸기·카톡 반씩
  const lay = await M.evaluate(() => { const j = document.querySelector('.rc-box .rc-join').getBoundingClientRect(), s = [...document.querySelectorAll('.rc-box .rc-sub .btn')].map((e) => e.getBoundingClientRect()), box = document.querySelector('.rc-box').getBoundingClientRect(); return { jw: j.width / box.width, two: s.length === 2 && Math.abs(s[0].top - s[1].top) < 2 && Math.abs(s[0].width - s[1].width) < 3 && s[0].top > j.bottom - 1 }; });
  ok(lay.jw > 0.85 && lay.two, '휴대폰: 참가 버튼은 한 줄 넓게, 아래 줄에 시간 바꾸기·카톡으로 모집이 반씩');
  // 라인 지원(오늘의 내전): 모집 참가자를 미리 골라 둠
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(600);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(600);
  const sel = await A.$$eval('#modal.on [data-a=bdSel].on', (x) => x.map((e) => e.dataset.id).sort());
  ok(JSON.stringify(sel) === JSON.stringify([ids[0], ids[2], ids[3]].sort()), '라인 지원 열기: 모집 참가자 3명이 미리 선택됨');
  ok(/모집 참가자 3명/.test(await A.$eval('#modal.on .ph', (e) => e.innerText)), "참가자 머리에 '모집 참가자 3명' 버튼");
  await A.click('#modal.on [data-a=bdNone]'); await A.waitForTimeout(200); await A.click('#modal.on [data-a=bdRecruit]'); await A.waitForTimeout(200);
  ok((await A.$$eval('#modal.on [data-a=bdSel].on', (x) => x.length)) === 3, "'모집 참가자' 버튼으로 다시 3명 선택");
  await A.click('#modal.on [data-a=close]'); await A.waitForTimeout(300);
  // 시간 바꾸기: 명단 유지
  await A.evaluate(() => (location.hash = '#/recruit')); await A.waitForTimeout(600);
  await A.click('#main .rc-box [data-a=rcOpen]'); await A.waitForTimeout(300);
  // 참가자가 있으면 시간 바꾸기 전에 확인 창: 취소하면 그대로, 확인하면 바뀜
  const before = R().when; let dmsg = '';
  A.once('dialog', (dg) => { dmsg = dg.message(); dg.dismiss(); });
  await A.click('#modal.on [data-a=rcTime][data-v="22:00"]'); await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(700);
  ok(/이미 3명이 참가했어요/.test(dmsg) && /오후 10:00/.test(dmsg) && /명단은 그대로/.test(dmsg) && R().when === before && !!(await A.$('#modal.on .rc-m')), '시간 바꾸기 확인 창(참가 3명·바뀔 시간 안내) → 취소하면 시간 그대로·창 유지: ' + JSON.stringify(dmsg));
  A.once('dialog', (dg) => dg.accept());
  await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  ok(new Date(R().when).getHours() === 22 && Object.keys(R().list).length === 3, '확인하면 22:00으로 바뀌고 참가자 3명 그대로');
  // 같은 시간으로 다시 저장하면 묻지 않음
  let asked = false; const onD = (dg) => { asked = true; dg.dismiss(); }; A.on('dialog', onD);
  await A.click('#main .rc-box [data-a=rcOpen]'); await A.waitForTimeout(300); await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(700);
  A.off('dialog', onD); ok(!asked, '시간을 안 바꾸고 저장하면 확인 창 없음');
  // 대기자: 10명이 차면 11번째부터 대기, 참가자가 빠지면 대기 1번이 자동 참가
  await A.evaluate(async (ids) => { const { S } = await import('/js/core.js'); const t = Date.now(); await S.store.tx('meta', 'recruit', (r) => { const list = {}; ids.slice(0, 12).forEach((id, i) => (list[id] = { n: S.st.P[id].name, pid: id, by: 'x', at: t - 60000 + i * 1000 })); return { ...r, list }; }); }, ids);
  await A.waitForTimeout(700);
  const wv = await A.$eval('#main .rc-box', (e) => ({ n: e.querySelector('.rc-n').innerText.replace(/\s/g, ''), wt: e.querySelector('.rc-wt')?.innerText, main: e.querySelectorAll('.rc-ppl:not(.rc-wait) .rc-p').length, wait: [...e.querySelectorAll('.rc-wait .rc-p')].map((x) => x.innerText.replace(/\s/g, '')) }));
  ok(wv.n === '10/10' && wv.wt === '대기 2' && wv.main === 10 && wv.wait.join(',') === `1${P[ids[10]]},2${P[ids[11]]}`, '12명: 참가 10/10 + 대기 2(누른 순서대로 11·12번째): ' + JSON.stringify(wv));
  ok(await A.evaluate(async () => (await import('/js/recruit.js')).recruitIds().length) === 10, '라인 지원 미리 고르기는 참가 10명만(대기 제외)');
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(500);
  ok(await A.$eval('#main .rc-home', (e) => /10\/10/.test(e.innerText.replace(/\s/g, '')) && /대기2/.test(e.innerText.replace(/\s/g, '')) && /대기 신청/.test(e.innerText)).catch(() => false), "홈 띠: 10/10 · 대기 2 · '대기 신청'");
  await A.evaluate(() => (location.hash = '#/recruit')); await A.waitForTimeout(500);
  await A.click('#main .rc-box [data-a=rcPick]'); await A.waitForTimeout(400);
  const pk = await A.evaluate((id) => { const b = document.querySelector(`#modal.on [data-a=rcToggle][data-id="${id}"]`); return { wait: b.classList.contains('wait'), w: b.dataset.w, full: !!document.querySelector('#modal.on .rc-full'), wt: document.querySelector('#modal.on .ph .rc-wt')?.innerText }; }, ids[10]);
  ok(pk.wait && pk.w === '대기1' && pk.full && pk.wt === '대기 2', "이름 고르기 창: 대기자는 점선 + '대기1', 다 찼다는 안내: " + JSON.stringify(pk));
  await A.click(`#modal.on [data-a=rcToggle][data-id="${ids[12]}"]`); await A.waitForTimeout(800);
  ok(/대기 3번으로 신청/.test(await A.$eval('#toast', (e) => e.textContent).catch(() => '')) && Object.keys(R().list).length === 13, '13번째로 누르면 "대기 3번으로 신청" 안내');
  await A.click(`#modal.on [data-a=rcToggle][data-id="${ids[12]}"]`); await A.waitForTimeout(600);
  await A.click('#modal.on [data-a=close]'); await A.waitForTimeout(300);
  await M.evaluate(() => (location.hash = '#/recruit')); await M.waitForTimeout(600);
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => { const list = { ...r.list }; delete list[id]; return { ...r, list }; }); }, ids[3]);
  await A.waitForTimeout(800);
  const pr = await M.evaluate(() => ({ t: document.getElementById('toast')?.textContent || '', n: document.querySelector('#main .rc-n')?.innerText.replace(/\s/g, ''), wt: document.querySelector('#main .rc-box .rc-wt')?.innerText || '' }));
  ok(pr.n === '10/10' && pr.wt === '대기 1' && new RegExp(`${P[ids[10]]}님이 대기에서 참가로`).test(pr.t), '참가자 1명이 빠지면 대기 1번이 자동 참가(다른 기기에도 안내): ' + JSON.stringify(pr));
  await A.evaluate(async (ids) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => { const list = {}; for (const id of [ids[0], ids[2], ids[1]]) list[id] = r.list[id] || { n: S.st.P[id].name, pid: id, by: 'x', at: Date.now() }; return { ...r, list }; }); }, ids);
  await A.waitForTimeout(600);
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(500);
  ok(await A.$$eval('#main .lrow', (x) => x.length) === 5 && !!(await A.$('#main [data-a=tSave]')), '오늘의 내전 라인업·결과 저장은 그대로');
  await A.evaluate(() => (location.hash = '#/recruit')); await A.waitForTimeout(500);
  // 끝(시작 + 6시간)
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'recruit', (r) => ({ ...r, when: Date.now() - 7 * 3600e3 })); }); await A.waitForTimeout(800);
  ok(!!(await A.$('#main .rc-empty')) && !(await A.$('#main .rc-box')), '시작 + 6시간이 지나면 모집 끝 → 빈 칸');
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(500);
  ok(!(await A.$('#main .rc-home')), '홈 띠도 사라짐');
  await A.evaluate(() => (location.hash = '#/today')); await A.waitForTimeout(500);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500);
  ok(!(await A.$('#modal.on [data-a=bdRecruit]')), '끝난 모집은 라인 지원에 쓰지 않음');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
