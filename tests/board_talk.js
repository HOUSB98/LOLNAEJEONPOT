// 오늘 소통(1~5): 라인 지원 창에서 본인이 고름(다시 누르면 지움, 완료 뒤·추첨 결과 화면에서도 바꿀 수 있음, 팀 짜기에는 안 씀),
// 오늘의 내전 라인업 칸에 마이크 + 막대 표시(다른 기기에도 바로), 16시간이 지난 라인 지원의 표시는 안 보임, 휴대폰에서도 보임
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A');
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }) });
  await open(A, 'today', 1000); await open(M, 'today', 1000);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500); await A.click('#modal.on [data-a=bdOpen]'); await A.waitForTimeout(1200);
  const D = () => be.db.meta.board, ids = D().ids;
  ok(!(await A.$('#modal.on .lp-talk')), '이름을 고르기 전에는 소통 선택 없음');
  await A.click(`#modal.on [data-a=bdMe][data-id="${ids[0]}"]`); await A.waitForTimeout(400);
  ok(await A.$$eval('#modal.on [data-a=bdTalk]', (x) => x.length) === 5, '내 이름을 고르면 오늘 소통 5단계 버튼');
  await A.click('#modal.on [data-a=bdTalk][data-n="4"]'); await A.waitForTimeout(800);
  ok(D().talk?.[ids[0]] === 4, '소통 4(수다) 저장');
  ok(await A.$eval('#modal.on [data-a=bdTalk][data-n="4"]', (e) => e.classList.contains('on')), '고른 단계 강조');
  ok(!D().picks?.[ids[0]] && !D().done?.[ids[0]], '라인 지망·완료와는 따로(선택 사항)');
  // 다른 사람(휴대폰)도 자기 소통 선택
  await M.waitForSelector('#modal.on .lp');
  await M.tap(`#modal.on [data-a=bdMe][data-id="${ids[5]}"]`); await M.waitForTimeout(400);
  await M.tap('#modal.on [data-a=bdTalk][data-n="1"]'); await M.waitForTimeout(800);
  ok(D().talk?.[ids[5]] === 1, '휴대폰에서도 선택(1 과묵)');
  // 완료 뒤에도 바꿀 수 있음, 다시 누르면 지움
  await A.click('#modal.on [data-a=bdPick][data-o="top"]'); await A.waitForTimeout(500); await A.click('#modal.on [data-a=bdDone]'); await A.waitForTimeout(800);
  await A.click('#modal.on [data-a=bdTalk][data-n="5"]'); await A.waitForTimeout(800);
  ok(D().talk?.[ids[0]] === 5 && D().done?.[ids[0]], '선택 완료 뒤에도 소통은 바꿀 수 있음(5 샷콜러)');
  await M.tap('#modal.on [data-a=bdTalk][data-n="1"]'); await M.waitForTimeout(800);
  ok(D().talk?.[ids[5]] === undefined, '같은 단계를 다시 누르면 지움');
  await M.tap('#modal.on [data-a=bdTalk][data-n="2"]'); await M.waitForTimeout(800);
  // 라인업에 배치(추첨 결과가 들어간 상황) → 칸에 표시
  await A.click('#modal.on [data-a=bdHide]').catch(() => {}); await M.tap('#modal.on [data-a=bdHide]').catch(() => {}); await A.waitForTimeout(500);
  await A.evaluate(async (ids) => { const t = await import('/js/today.js'); t.setDraftTeams(ids.slice(0, 5), ids.slice(5, 10)); (await import('/js/core.js')).refresh(); }, ids);
  await A.waitForTimeout(700);
  const icA = await A.$$eval('.arena .slot .sl-talk', (x) => x.map((e) => e.className + '|' + e.title));
  ok(icA.length === 2 && icA.some((t) => /tkl5/.test(t) && /샷콜러/.test(t)) && icA.some((t) => /tkl2/.test(t) && /조용/.test(t)), '라인업 칸에 소통 아이콘(고른 2명만): ' + icA.join(', '));
  ok(await A.$$eval('.arena .slot.blue .sl-talk .tb u.on', (x) => x.length) === 5, '막대 칸 수 = 단계(5)');
  // 다른 기기의 라인업에도 바로 반영(소통만 바꿔도)
  await M.evaluate(async (ids) => { const t = await import('/js/today.js'); t.setDraftTeams(ids.slice(0, 5), ids.slice(5, 10)); (await import('/js/core.js')).refresh(); }, ids);
  await M.waitForTimeout(500);
  ok(await M.$eval('.arena .slot.red .sl-talk', (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 10).catch(() => false), '휴대폰 라인업 칸에도 보임');
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, talk: { ...r.talk, [id]: 3 } })); }, ids[1]);
  await M.waitForTimeout(900);
  ok(await M.$$eval('.arena .slot .sl-talk', (x) => x.length) === 3, '누가 소통을 고르면 다른 기기 라인업에도 바로 표시');
  // 16시간 지난 라인 지원이면 표시 안 함
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, at: r.at - 17 * 3600e3, upd: r.at - 17 * 3600e3 })); (await import('/js/core.js')).refresh(); });
  await A.waitForTimeout(700);
  ok(await A.$$eval('.arena .slot .sl-talk', (x) => x.length) === 0, '16시간 지난 라인 지원의 소통 표시는 안 보임(다음 날 새로)');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
