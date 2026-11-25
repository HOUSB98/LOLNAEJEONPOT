// 라인 지원 인원 숨기기(2026-11-25): 라인 카드에 1·2·3지망 인원·몰림 상태·막대·당첨 확률(N명 중) 없음, 라인 고정 인원은 모두에게 보임(고정 n/2),
// 카드에 내 라인 기록(승률·판수·라인 점수·최근 10판 중 횟수, 상관없음 카드는 최근 5판 라인), 누르면 바로 반영(저장 전),
// 누르는 사이에 다른 사람 지원으로 화면이 바뀌어도 클릭이 사라지지 않음, 바뀐 게 없으면 다시 그리지 않음
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'), B = await client(b, be, 'WORK', 'B');
  await open(A, 'today', 1000); await open(B, 'today', 1000);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500); await A.click('#modal.on [data-a=bdOpen]'); await A.waitForTimeout(1200);
  const D = () => be.db.meta.board, ids = D().ids;
  await B.waitForSelector('#modal.on .lp', { timeout: 8000 });
  await A.click(`#modal.on [data-a=bdMe][data-id="${ids[0]}"]`); await B.click(`#modal.on [data-a=bdMe][data-id="${ids[1]}"]`); await A.waitForTimeout(400);
  // 다른 사람(A, 그리고 몇 명 대리)이 탑에 몰려도 B 화면에는 인원이 안 보임
  await A.click('#modal.on [data-a=bdPick][data-o="top"]'); await A.waitForTimeout(700);
  await A.evaluate(async (ids) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, picks: { ...r.picks, [ids[2]]: ['top'], [ids[3]]: ['top', 'mid'] } })); }, ids); await B.waitForTimeout(900);
  const txt = await B.$eval('#modal.on .lp-grid', (e) => e.innerText);
  ok(D().picks[ids[0]][0] === 'top' && !(await B.$('#modal.on .lp-cnt, #modal.on .lp-sub, #modal.on .lp-bar, #modal.on .lp-st.hot, #modal.on .lp-st.ok, #modal.on .lp-st.low')) && !/1지망\s*\d|2지망|3지망|초과|딱 맞음|자리 남음|\d+명 중/.test(txt), '탑에 3명이 몰려도 다른 사람 화면에 라인별 지원 인원·상태가 없음');
  // 내 1지망 칸: 확률·경쟁 인원 대신 보정 단계만
  await B.click('#modal.on [data-a=bdPick][data-o="top"]'); await B.waitForTimeout(800);
  const ch = await B.$eval('#modal.on .lp-chance', (e) => e.innerText).catch(() => '');
  ok(/보정/.test(ch) && !/%|명 중|확률/.test(ch), '내 1지망 칸: 당첨 확률·"N명 중" 없이 보정 단계만: ' + JSON.stringify(ch));
  // 고정 인원은 모두에게 보임
  const fx0 = await B.$eval('#modal.on [data-a=bdPick][data-o="jg"] .lp-fx', (e) => e.innerText.trim());
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, fixed: { ...(r.fixed || {}), [id]: 'jg' } })); }, ids[4]); await B.waitForTimeout(900);
  const fx1 = await B.$eval('#modal.on [data-a=bdPick][data-o="jg"] .lp-fx', (e) => ({ t: e.innerText.trim(), on: e.classList.contains('on') }));
  ok(fx0 === '고정 0/2' && fx1.t === '고정 1/2' && fx1.on, `라인 고정 인원은 모두에게 보임: ${fx0} → ${fx1.t}`);
  // 카드 안 내 라인 기록(B = ids[1])
  const want = await B.evaluate(async (id) => { const { S } = await import('/js/core.js'); const s = S.st.P[id], v = s.lanes.mid; let n = 0, k = 0; for (let i = S.st.matches.length - 1; i >= 0 && k < 10; i--) { const m = S.st.matches[i], b2 = m.blue.indexOf(id), r = m.red.indexOf(id); if (b2 < 0 && r < 0) continue; k++; if ((b2 >= 0 ? b2 : r) === 2) n++; } return { wr: v.g ? Math.round((v.w / v.g) * 100) + '%' : '—', g: v.g, sc: +s.p.scores?.mid || 0, n }; }, ids[1]);
  const got = await B.$eval('#modal.on [data-a=bdPick][data-o="mid"] .lp-mine', (e) => ({ wr: e.querySelector('.lp-rec b').innerText, t: e.innerText }));
  ok(got.wr === want.wr && got.t.includes(`${want.g}판`) && got.t.includes(`${want.sc}점`) && got.t.includes(`최근 10판 중 ${want.n}번`), '미드 카드에 내 미드 승률·판수·라인 점수·최근 10판 중 횟수: ' + JSON.stringify(got.t));
  ok(await B.$$eval('#modal.on [data-a=bdPick][data-o="any"] .lp-seq i', (x) => x.length) === 5, "'상관없음' 카드에 최근 5판 라인");
  // 바로 반영: 저장이 끝나기 전에 노란 테두리(내 지망)가 먼저 켜짐
  await B.evaluate(() => { const f = window.__fs; window.__fsOrig = f; window.__fs = async (op, a) => { if (op === 'txCommit' || op === 'txGet') await new Promise((r) => setTimeout(r, 600)); return f(op, a); }; });
  const t0 = Date.now(); await B.click('#modal.on [data-a=bdPick][data-o="sup"]');
  const fast = await B.evaluate(() => document.querySelector('#modal.on [data-a=bdPick][data-o="sup"]').classList.contains('mine'));
  await B.waitForTimeout(1200); await B.evaluate(() => { window.__fs = window.__fsOrig; });
  ok(fast && Date.now() - t0 < 5000 && D().picks[ids[1]].includes('sup'), '누르면 저장을 기다리지 않고 바로 내 지망으로 표시 → 저장도 됨');
  // 누르는 사이(누름 ~ 뗌)에 다른 사람 지원으로 화면이 바뀌어도 클릭이 사라지지 않음
  const box = await B.$eval('#modal.on [data-a=bdPick][data-o="adc"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await B.mouse.move(box.x, box.y); await B.mouse.down();
  await A.evaluate(async (ids) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => ({ ...r, picks: { ...r.picks, [ids[5]]: ['adc'] } })); }, ids); await B.waitForTimeout(700);
  await B.mouse.up(); await B.waitForTimeout(900);
  ok(D().picks[ids[1]].includes('adc'), '누르는 도중 다른 사람이 지원해 화면이 바뀌어도 한 번 클릭으로 지원됨');
  ok(await B.$eval('#modal.on [data-a=bdPick][data-o="adc"]', (e) => e.classList.contains('mine')), '뗀 뒤 미뤄 둔 화면 갱신도 반영');
  // 바뀐 게 없으면(다른 meta 문서만 바뀜) 다시 그리지 않음
  await B.evaluate(() => { window.__mark = document.querySelector('#modal.on .lp-grid'); });
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'settings', { notice: 'x' + Date.now() }); }); await B.waitForTimeout(800);
  ok(await B.evaluate(() => window.__mark === document.querySelector('#modal.on .lp-grid')), '라인 지원과 상관없는 변경에는 카드를 다시 그리지 않음');
  const errs = [...A.errs, ...B.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
