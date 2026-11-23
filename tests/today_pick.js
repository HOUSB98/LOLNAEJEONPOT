// 오늘의 내전: 챔피언·밴·선수 고르는 창을 연 동안 다른 사람이 라인업을 바꿔도, 고른 값이 사라지지 않고 입력된다
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'), B = await client(b, be, 'WORK', 'B');
  await open(A, 'today', 1200); await open(B, 'today', 1200);
  const draft = () => A.evaluate(async () => (await import('/js/core.js')).S.store.data.meta.todayDraft || {});
  // B가 바꾸게 한다(다른 칸)
  const bEdit = (side, i, id) => B.evaluate(async ([s, k, v]) => { const { S, refresh } = await import('/js/core.js'); location.hash = '#/today'; await new Promise((r) => setTimeout(r, 100));
    document.querySelector(`[data-a=tSlot][data-s=${s}][data-i="${k}"]`).click(); await new Promise((r) => setTimeout(r, 200));
    document.querySelector(`#modal.on [data-a=pp][data-id=${v}]`).click(); }, [side, i, id]).then(() => B.waitForTimeout(1200));
  // 시험 환경은 챔피언 목록(외부)을 못 받으므로 '이름 직접 입력 + Enter'로 고른다. 목록이 있으면 첫 칸을 누른다
  let seq = 0;
  const pickFirst = async () => { await A.waitForSelector('#modal.on #cpq');
    if (await A.$('#modal.on .cp:not([disabled])')) { const n = await A.$eval('#modal.on .cp:not([disabled])', (e) => e.dataset.n); await A.click(`#modal.on .cp[data-n="${n}"]`); return n; }
    const n = ['아리', '가렌', '럭스', '징크스'][seq++]; await A.fill('#modal.on #cpq', n); await A.press('#modal.on #cpq', 'Enter'); return n; };

  // 1) 챔피언
  await A.click('[data-a=tChamp][data-s=blue][data-i="0"]'); await A.waitForTimeout(300);
  await bEdit('red', 4, 'p4'); // 창이 열린 동안 B가 레드 서폿을 바꿈 → A 화면에 반영됨
  const c1 = await pickFirst(); await A.waitForTimeout(1500);
  let d = await draft();
  ok(d.champs?.blue?.[0] === c1, `챔피언 창을 연 동안 다른 사람이 바꿔도 고른 챔피언 입력: ${d.champs?.blue?.[0]} (기대 ${c1})`);
  ok(d.red?.[4] === 'p4', '다른 사람의 변경도 유지: ' + d.red?.[4]);
  ok(await A.$eval('[data-a=tChamp][data-s=blue][data-i="0"]', (e) => !e.querySelector('.plus')), 'A 화면에도 챔피언 표시');
  ok(await A.$('#modal.on') === null, '창이 닫힘');
  // 2) 밴
  await A.click('#tMoreBtn, [data-a=tMore]').catch(() => {}); await A.waitForTimeout(300);
  if (await A.$('[data-a=tBan][data-s=red][data-i="1"]')) {
    await A.click('[data-a=tBan][data-s=red][data-i="1"]'); await A.waitForTimeout(300);
    await bEdit('red', 3, 'p3');
    const c2 = await pickFirst(); await A.waitForTimeout(1500); d = await draft();
    ok(d.bans?.red?.[1] === c2, `밴 창도 같은 상황에서 입력: ${d.bans?.red?.[1]} (기대 ${c2})`);
  } else ok(false, '밴 칸을 찾지 못함');
  // 3) 선수
  await A.click('[data-a=tSlot][data-s=blue][data-i="2"]'); await A.waitForTimeout(300);
  await bEdit('red', 2, 'p2');
  await A.click('#modal.on [data-a=pp][data-id=p9]'); await A.waitForTimeout(1500); d = await draft();
  ok(d.blue?.[2] === 'p9' && d.red?.[2] === 'p2', `선수 창도 같은 상황에서 입력: 블루미드 ${d.blue?.[2]}, 레드미드 ${d.red?.[2]}`);
  // 4) 평소(혼자 입력)도 그대로
  await A.click('[data-a=tChamp][data-s=red][data-i="0"]'); await A.waitForTimeout(300);
  const c3 = await pickFirst(); await A.waitForTimeout(1200); d = await draft();
  ok(d.champs?.red?.[0] === c3, '혼자 고를 때도 입력: ' + d.champs?.red?.[0]);
  console.log('오류:', [...A.errs, ...B.errs].join(' | ') || '없음'); ok(!A.errs.length && !B.errs.length, '페이지 오류 없음');
  await b.close();
})();
