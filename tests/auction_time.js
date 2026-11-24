// 경매 시간 배분: 방 만들기 화면의 예상 소요 시간(설정·인원에 따라 바로 바뀜), 연장 추천값(경매 시간의 1/4, 직접 고치기 전엔 따라감, '적용'),
// 만든 방 대기실에도 예상 소요 시간 표시. 계산식 확인(대기 15 + 경매 20 + 정산 0.5 = 매물당 35.5초)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const H = await client(b, be, 'WORK', 'H'); await H.setViewportSize({ width: 1280, height: 1000 }); await open(H, 'home', 600);
  // 계산식
  const e = await H.evaluate(async () => { const m = await import('/js/auction.js'); return [m.auEstimate({ sec: 20, ext: 8, delay: 15, size: 5 }, 8, 2), m.auEstimate({ sec: 20, ext: 5, delay: 15, size: 5 }, 12, 2), m.auEstimate({ sec: 20, ext: 5, delay: 15, size: 5 }, 8, 1), [10, 20, 30, 60].map(m.recExt)]; });
  ok(Math.round(e[0].low) === 284 && e[0].n === 8, `2팀·8명·대기15·경매20: 빠르면 ${e[0].low}초(= 8 × 35.5)`);
  ok(e[1].n === 8, '참가자가 팀 자리보다 많아도 경매는 팀장 수 × 4번까지(나머지는 예비)');
  ok(e[2] === null, '팀장 1명이면 계산 안 함');
  ok(JSON.stringify(e[3]) === '[3,5,8,10]', '연장 추천: 10초→3, 20초→5, 30초→8, 60초→10(최대): ' + e[3]);
  await H.evaluate(() => (location.hash = '#/auction')); await H.waitForTimeout(800);
  const est = () => H.$eval('#au-est', (x) => x.innerText.replace(/\s+/g, ' '));
  ok(/팀장 2명 이상/.test(await est()), '아직 안 고르면 안내 문구');
  const ids = await H.evaluate(async () => (await import('/js/core.js')).S.st.list.slice(0, 10).map((s) => s.id));
  for (const id of ids.slice(0, 2)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="2"]`);
  for (const id of ids.slice(2, 10)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="1"]`);
  await H.waitForTimeout(400);
  ok(/약 5분 24초/.test(await est()) && /경매 8번/.test(await est()), '2팀·8명 기본값 예상: ' + await est());
  ok(await H.inputValue('#auE') === '5' && /추천값/.test(await H.$eval('#au-rec', (x) => x.innerText)), '연장 기본 = 추천값 5초');
  await H.click('#auS', { clickCount: 3 }); await H.keyboard.type('30'); await H.waitForTimeout(200);
  ok(await H.inputValue('#auE') === '8' && /약 7분/.test(await est()), '경매 시간 30초로 바꾸면 연장 8초로 따라가고 예상 시간도 바로 갱신');
  ok(await H.evaluate(() => document.activeElement.id) === 'auS', '입력 중 커서 유지(화면 전체를 다시 그리지 않음)');
  await H.click('#auE', { clickCount: 3 }); await H.keyboard.type('12'); await H.waitForTimeout(200);
  ok(/추천 8초/.test(await H.$eval('#au-rec', (x) => x.innerText)), '직접 고치면 추천값 안내 + 적용 버튼');
  await H.click('#auS', { clickCount: 3 }); await H.keyboard.type('20'); await H.waitForTimeout(200);
  ok(await H.inputValue('#auE') === '12', '직접 고친 뒤에는 경매 시간을 바꿔도 연장 그대로');
  await H.click('[data-a=auExtRec]'); await H.waitForTimeout(200);
  ok(await H.inputValue('#auE') === '5', "'적용' → 추천값 5초");
  await H.selectOption('#auD', '5'); await H.waitForTimeout(200);
  ok(/약 4분 4초/.test(await est()), '대기 5초로 바꾸면 바로 갱신: ' + await est());
  await H.click('[data-a=auCreate]'); await H.waitForTimeout(1200);
  const lob = await H.$eval('.stage .au-est', (x) => x.innerText.replace(/\s+/g, ' ')).catch(() => '');
  ok(/약 4분 4초/.test(lob) && /대기 5초 \+ 경매 20초/.test(lob) && /마감 5초 전에 입찰하면 5초로 연장/.test(lob), '대기실에도 예상 시간·시간 규칙: ' + lob);
  const rid = await H.evaluate(() => location.hash.split('/')[2]);
  ok(be.db.auctions[rid].cfg.ext === 5, '방 설정에 연장 5초 저장');
  console.log('오류:', H.errs.join(' | ') || '없음'); ok(!H.errs.length, '페이지 오류 없음');
  await b.close();
})();
