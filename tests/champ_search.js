// 챔피언 분석 화면 검색: 글자를 칠 때마다 화면 전체를 다시 그리지 않고 표 줄만 숨김/보임 → 입력칸이 그대로라 한글 조합(IME)이 끊기지 않음
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'); await open(A, 'champs', 800);
  const all = await A.$$eval('#chtb tr[data-n]', (x) => x.map((e) => e.dataset.n));
  ok(all.length > 3, `전체 통계 표: 챔피언 ${all.length}개`);
  const target = all.find((n) => /^[가-힣]{2,}/.test(n)) || all[0];
  await A.evaluate(() => { window.__inp = document.getElementById('chq'); window.__tb = document.getElementById('chtb'); });
  // 한글 조합 흉내(IME): 조합 중 글자 → 확정
  await A.click('#chq');
  const cdp = await A.context().newCDPSession(A);
  // 가렌: ㄱ → 가 → 갈(조합 중) → 가 확정, ㄹ → 레 → 렌(조합 중) → 렌 확정
  const steps = [['ㄱ'], ['가'], ['갈'], ['가', 'ㄹ'], ['가', '레'], ['가', '렌'], ['가렌']];
  for (const [i, st] of steps.entries()) {
    if (st.length === 2) { if (steps[i - 1].length === 1) await cdp.send('Input.insertText', { text: '가' }); await cdp.send('Input.imeSetComposition', { text: st[1], selectionStart: 1, selectionEnd: 1 }); }
    else if (i === steps.length - 1) await cdp.send('Input.insertText', { text: '렌' });
    else await cdp.send('Input.imeSetComposition', { text: st[0], selectionStart: 1, selectionEnd: 1 });
    await A.waitForTimeout(80);
  }
  await A.waitForTimeout(400);
  const st = await A.evaluate(() => ({ v: document.getElementById('chq').value, same: window.__inp === document.getElementById('chq'), focus: document.activeElement?.id }));
  ok(st.v === '가렌', `한글 조합 입력이 그대로 들어감("${st.v}", 기대 "가렌")`);
  ok(st.same && st.focus === 'chq', '입력하는 동안 입력칸을 새로 그리지 않음(커서 유지)');
  const word = target.slice(0, 2);
  await A.fill('#chq', word); await A.waitForTimeout(300);
  ok(await A.evaluate(() => window.__tb === document.getElementById('chtb')), '검색해도 표를 새로 그리지 않고 줄만 숨김');
  const shown = await A.$$eval('#chtb tr[data-n]:not([hidden])', (x) => x.map((e) => e.dataset.n));
  ok(shown.length >= 1 && shown.every((n) => n.includes(word)) && shown.includes(target), `검색 결과만 보임(${shown.length}개)`);
  // 검색창 아래 결과 목록
  const sg = await A.$$eval('#chq-r .chq-i', (x) => x.map((e) => ({ n: e.dataset.n, t: e.innerText.replace(/\s+/g, ' ') })));
  ok(!(await A.$eval('#chq-r', (e) => e.hidden)) && sg.length === shown.length && sg.every((x) => x.n.includes(word)) && sg.every((x) => /픽 · 승률 \d+%|기록 없음/.test(x.t)), `검색창 아래 결과 ${sg.length}개(이름·픽·승률): ` + sg.map((x) => x.t).join(' / '));
  ok(await A.evaluate(() => document.getElementById('chq') === window.__inp), '결과 목록을 띄워도 입력칸은 그대로');
  await A.evaluate(() => window.scrollTo(0, 0)); await A.waitForTimeout(200);
  await A.click(`#chq-r .chq-i[data-n="${sg[0].n}"]`); await A.waitForTimeout(900);
  const go = await A.evaluate((n) => { const tr = document.querySelector(`#chtb tr[data-n="${n}"]`), r = tr.getBoundingClientRect(); return { inView: r.top >= 0 && r.bottom <= innerHeight, hit: tr.classList.contains('ch-hit'), closed: document.getElementById('chq-r').hidden }; }, sg[0].n);
  ok(go.inView && go.hit && go.closed, '결과를 누르면 아래 표의 그 줄로 이동해 반짝, 목록은 닫힘');
  await A.focus('#chq'); await A.waitForTimeout(200);
  ok(!(await A.$eval('#chq-r', (e) => e.hidden)), '검색창을 다시 누르면 결과 다시 보임');
  await A.keyboard.press('Escape'); await A.waitForTimeout(150);
  ok(await A.$eval('#chq-r', (e) => e.hidden) && await A.inputValue('#chq') === word, 'Esc면 목록만 닫힘(검색어 그대로)');
  await A.focus('#chq'); await A.waitForTimeout(150); await A.mouse.click(5, 400); await A.waitForTimeout(150);
  ok(await A.$eval('#chq-r', (e) => e.hidden), '바깥을 누르면 목록 닫힘');
  await A.fill('#chq', '없는챔피언이름'); await A.waitForTimeout(200);
  ok(/검색 결과가 없어요/.test(await A.$eval('#chq-r', (e) => e.innerText)), '결과 없으면 목록에도 안내');
  ok(await A.$eval('#chtb .ch-none', (e) => !e.hidden) && (await A.$$eval('#chtb tr[data-n]:not([hidden])', (x) => x.length)) === 0, '결과 없으면 "검색 결과가 없습니다"');
  await A.fill('#chq', ''); await A.waitForTimeout(200);
  ok(await A.$eval('#chq-r', (e) => e.hidden), '검색어를 지우면 목록 닫힘');
  ok((await A.$$eval('#chtb tr[data-n]:not([hidden])', (x) => x.length)) === all.length && await A.$eval('#chtb .ch-none', (e) => e.hidden), '지우면 전체 다시 보임');
  // 검색어를 둔 채 정렬하거나 다른 화면에 다녀와도 검색 유지
  await A.fill('#chq', word); await A.waitForTimeout(200);
  await A.click('[data-a=chSort][data-k=g]'); await A.waitForTimeout(400);
  ok((await A.$$eval('#chtb tr[data-n]:not([hidden])', (x) => x.map((e) => e.dataset.n))).every((n) => n.includes(word)) && await A.inputValue('#chq') === word, '정렬해도 검색어·결과 유지');
  console.log('오류:', A.errs.join(' | ') || '없음'); ok(!A.errs.length, '페이지 오류 없음');
  await b.close();
})();
