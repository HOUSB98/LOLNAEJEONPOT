// 소통(1~4: 과묵·조용·수다·샷콜러): 관리 화면 선수 관리에서 고정값(표 칸·상세 창), 라인 지원 창에서 기본값으로 적용되고 본인이 오늘만 변경
// (다시 누르면 오늘은 표시 안 함, '기본으로'), 고정값 없는 사람은 고른 것만, 지망·완료와 따로, 오늘의 내전 라인업 칸에 마이크 + 막대
// (PC·휴대폰, 다른 기기에도 바로), 16시간이 지나면 그날 바꾼 값은 끝나고 고정값으로. 팀 짜기에는 안 씀
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A');
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }) });
  await open(A, 'admin', 1000); await open(M, 'today', 1000);
  // 1) 관리 화면: 선수 관리 표의 소통 칸(잠겨 있으면 못 바꿈) → 관리자 모드에서 저장
  await A.evaluate(() => { const t = document.querySelector('[data-a=admTab][data-t=players],[data-a=admTab][data-tab=players]'); t?.click(); }); await A.waitForTimeout(500);
  const sel = await A.$$eval('select[data-c=plTalk]', (x) => x.map((e) => [e.disabled, [...e.options].map((o) => o.textContent).join(',')]));
  ok(sel.length > 10 && sel[0][1] === '—,과묵,조용,수다,샷콜러', '선수 관리 표에 소통 칸(—·과묵·조용·수다·샷콜러, 보통 없음)');
  ok(sel[0][0] === true, '잠겨 있으면 소통 칸도 잠김');
  await A.click('[data-a=admUnlock]'); await A.waitForSelector('#pin'); await A.fill('#pin', '1234'); await A.press('#pin', 'Enter'); await A.waitForTimeout(800);
  const pids = await A.$$eval('select[data-c=plTalk]', (x) => x.map((e) => e.dataset.id));
  // 첫 번째 선수: 표에서 샷콜러(4) 고정
  await A.selectOption(`select[data-c=plTalk][data-id="${pids[0]}"]`, '4'); await A.waitForTimeout(700);
  ok(be.db.players[pids[0]].talk === 4, '표 칸에서 고정값 저장(샷콜러 = 4)');
  // 두 번째 선수: 상세 창에서 과묵(1)
  await A.click(`[data-a=plEdit][data-id="${pids[1]}"]`); await A.waitForSelector('#plf select[name=talk]');
  await A.selectOption('#plf select[name=talk]', '1'); await A.click('#plf .btn.pri'); await A.waitForTimeout(800);
  ok(be.db.players[pids[1]].talk === 1 && be.db.players[pids[1]].scores, '상세 창에서도 고정값 저장(과묵 = 1, 다른 정보 그대로)');
  await A.selectOption(`select[data-c=plTalk][data-id="${pids[2]}"]`, '3'); await A.waitForTimeout(500);
  await A.selectOption(`select[data-c=plTalk][data-id="${pids[2]}"]`, '0'); await A.waitForTimeout(700);
  ok(be.db.players[pids[2]].talk === 0, "'—'로 고정값 지우기");
  // 2) 라인 지원: 고정값이 기본으로
  await open(A, 'today', 800);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500);
  await A.click('#modal.on [data-a=bdNone]'); await A.waitForTimeout(200);
  const all = await A.$$eval('#modal.on [data-a=bdSel]', (x) => x.map((e) => e.dataset.id));
  const want = [pids[0], pids[1], ...all.filter((id) => id !== pids[0] && id !== pids[1]).slice(0, 8)];
  for (const id of want) await A.click(`#modal.on [data-a=bdSel][data-id="${id}"]`);
  await A.click('#modal.on [data-a=bdOpen]'); await A.waitForTimeout(1200);
  const D = () => be.db.meta.board, ids = D().ids;
  ok(ids.length === 10 && ids.includes(pids[0]) && ids.includes(pids[1]), `라인 지원 열림(${ids.length}명, 고정값 있는 두 사람 포함)`);
  await A.click(`#modal.on [data-a=bdMe][data-id="${pids[0]}"]`); await A.waitForTimeout(400);
  ok(await A.$$eval('#modal.on [data-a=bdTalk]:not([data-n=fx])', (x) => x.length) === 4, '소통 버튼 4개');
  ok(await A.$eval('#modal.on [data-a=bdTalk][data-n="4"]', (e) => e.classList.contains('on')) && /기본값 샷콜러/.test(await A.$eval('#modal.on .lp-talk', (e) => e.innerText)), '고정값(샷콜러)이 기본으로 선택돼 있음');
  ok(!D().tk, '기본값은 따로 저장하지 않음(쓰기 없음)');
  // 오늘만 변경 → '기본으로'
  await A.click('#modal.on [data-a=bdTalk][data-n="2"]'); await A.waitForTimeout(800);
  ok(D().tk?.[pids[0]] === 2 && /오늘만 변경/.test(await A.$eval('#modal.on .lp-talk', (e) => e.innerText)), '오늘만 조용(2)으로 변경 · 안내');
  ok(be.db.players[pids[0]].talk === 4, '고정값은 그대로(샷콜러)');
  await A.click('#modal.on [data-a=bdTalk][data-n=fx]'); await A.waitForTimeout(800);
  ok(D().tk && !(pids[0] in D().tk) && await A.$eval('#modal.on [data-a=bdTalk][data-n="4"]', (e) => e.classList.contains('on')), "'기본으로' → 다시 샷콜러");
  await A.click('#modal.on [data-a=bdTalk][data-n="4"]'); await A.waitForTimeout(800);
  ok(D().tk?.[pids[0]] === 0 && !(await A.$('#modal.on [data-a=bdTalk].on')), '지금 단계를 다시 누르면 오늘은 표시 안 함');
  await A.click('#modal.on [data-a=bdTalk][data-n=fx]'); await A.waitForTimeout(800);
  // 고정값 없는 사람(휴대폰): 고른 것만, 다시 누르면 지움
  const free = ids.find((id) => id !== pids[0] && id !== pids[1]);
  await M.waitForSelector('#modal.on .lp');
  await M.tap(`#modal.on [data-a=bdMe][data-id="${free}"]`); await M.waitForTimeout(400);
  ok(!(await M.$('#modal.on [data-a=bdTalk].on')), '고정값 없는 사람은 선택 없음으로 시작');
  await M.tap('#modal.on [data-a=bdTalk][data-n="3"]'); await M.waitForTimeout(800);
  ok(D().tk?.[free] === 3 && !D().picks?.[free] && !D().done?.[free], '휴대폰에서 수다(3) 선택(지망·완료와 따로)');
  await M.tap('#modal.on [data-a=bdTalk][data-n="3"]'); await M.waitForTimeout(800);
  ok(!(free in D().tk), '다시 누르면 지움');
  await M.tap('#modal.on [data-a=bdTalk][data-n="3"]'); await M.waitForTimeout(800);
  // 3) 라인업 칸 표시
  await A.click('#modal.on [data-a=bdHide]').catch(() => {}); await M.tap('#modal.on [data-a=bdHide]').catch(() => {}); await A.waitForTimeout(500);
  const blue = [pids[0], free, ...ids.filter((id) => id !== pids[0] && id !== free && id !== pids[1]).slice(0, 3)], red = [pids[1], ...ids.filter((id) => !blue.includes(id) && id !== pids[1]).slice(0, 4)];
  for (const P of [A, M]) await P.evaluate(async ([bl, rd]) => { const t = await import('/js/today.js'); t.setDraftTeams(bl, rd); (await import('/js/core.js')).refresh(); }, [blue, red]);
  await A.waitForTimeout(700);
  const ic = await A.$$eval('.arena .slot .sl-talk', (x) => x.map((e) => e.className + '|' + e.title + '|' + e.querySelectorAll('u.on').length));
  ok(ic.length === 3 && ic.some((t) => /tkl4/.test(t) && /샷콜러/.test(t) && /\|4$/.test(t)) && ic.some((t) => /tkl3/.test(t) && /수다/.test(t)) && ic.some((t) => /tkl1/.test(t) && /과묵/.test(t) && /\|1$/.test(t)), '라인업 칸: 고정값(샷콜러·과묵)·오늘 고른 값(수다), 막대 = 단계: ' + ic.join(', '));
  ok(await M.$eval('.arena .slot .sl-talk', (e) => e.getBoundingClientRect().width > 10).catch(() => false) && await M.$eval('.arena .slot.blue .sl-top b', (e) => e.getBoundingClientRect().width > 20), '휴대폰 라인업에도 보이고 이름도 가려지지 않음');
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, tk: { ...r.tk, [id]: 2 } })); }, pids[1]);
  await M.waitForTimeout(900);
  ok(await M.$$eval('.arena .slot .sl-talk.tkl2', (x) => x.length) === 1, '누가 오늘 값을 바꾸면 다른 기기 라인업에도 바로');
  // 4) 16시간 지나면 그날 값은 끝 → 고정값만
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, at: r.at - 17 * 3600e3, upd: r.at - 17 * 3600e3 })); (await import('/js/core.js')).refresh(); });
  await A.waitForTimeout(700);
  const ic2 = await A.$$eval('.arena .slot .sl-talk', (x) => x.map((e) => e.className));
  ok(ic2.length === 2 && ic2.some((c) => /tkl4/.test(c)) && ic2.some((c) => /tkl1/.test(c)), '16시간 지나면 오늘 바꾼 값은 끝나고 고정값만 표시');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
