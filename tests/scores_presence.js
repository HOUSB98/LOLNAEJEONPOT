// 점수 변동 화면(js/scores.js) + 왼쪽 아래 접속자(얼굴 5개 겹침 · 누르면 위로 작은 창)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const SHOT = process.env.SHOT; // 폴더를 주면 화면을 찍어 둔다
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const now = Date.now(), P = Object.fromEntries(seed.players.map((p) => [p.id, p])), items = [];
  const log = (pid, lane, from, to, ago) => items.push({ at: now - ago, pid, name: P[pid].name, lane, from, to });
  // 최근 7일: 6명 바뀜(p0은 두 라인, p1은 같은 라인 두 번 → 처음→지금으로 묶임)
  log('p0', 'top', P.p0.scores.top - 3, P.p0.scores.top, 3600e3); log('p0', 'mid', P.p0.scores.mid + 2, P.p0.scores.mid, 7200e3);
  log('p1', 'jg', P.p1.scores.jg - 5, P.p1.scores.jg - 2, 5 * 864e5); log('p1', 'jg', P.p1.scores.jg - 2, P.p1.scores.jg, 864e5);
  for (const id of ['p2', 'p3', 'p4', 'p5']) log(id, 'sup', P[id].scores.sup - 1, P[id].scores.sup, 2 * 864e5);
  log('p6', 'adc', P.p6.scores.adc - 4, P.p6.scores.adc, 20 * 864e5); // 30일에만 보임
  log('p7', 'top', P.p7.scores.top, P.p7.scores.top + 2, 3 * 864e5); log('p7', 'top', P.p7.scores.top + 2, P.p7.scores.top, 2 * 864e5); // 결국 그대로 → 빠짐
  items.sort((a, b) => a.at - b.at);
  seed.meta.find((m) => m.id === 'scorelog').items = items;
  seed.presence.push(...Array.from({ length: 9 }, (_, i) => ({ id: 'on' + i, nick: '접속자' + 'ㅎㄱㄴㄷㄹㅁㅂㅅㅇ'[i], at: now })));
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);

  const A = await client(b, be, 'WORK', 'A'); await A.setViewportSize({ width: 1440, height: 900 });
  await open(A, 'scores', 1500);
  // 변동 탭(기본): 10분 안에 이어서 바꾼 것 = 한 번의 변동. 전체 선수 명단 + 그 변동 전 → 후
  const bRows = () => A.$$eval('.sv-row:not(.sv-h)', (rs) => rs.length);
  const changed = () => A.$$eval('.sv-c.up, .sv-c.dn', (cs) => cs.map((c) => c.closest('.sv-row').querySelector('.sv-nm b').textContent + ':' + c.dataset.l + ':' + c.querySelector('small').textContent));
  ok(await A.$eval('.sv-tabs .on', (e) => e.textContent) === '최근 변동', '기본 탭 = 최근 변동');
  ok(await bRows() === 24, '최근 변동: 전체 선수 24명 명단: ' + await bRows());
  let ch = await changed();
  ok(ch.length === 1 && ch[0] === `선수0:탑:${P.p0.scores.top - 3}→${P.p0.scores.top}`, '최근 변동 = 1시간 전 선수0 탑 (전→후): ' + ch.join(','));
  await A.click('[data-a=svTab][data-v=b1]'); await A.waitForTimeout(300);
  ch = await changed();
  ok(ch.length === 1 && ch[0] === `선수0:미드:${P.p0.scores.mid + 2}→${P.p0.scores.mid}`, '직전 변동 = 2시간 전 선수0 미드: ' + ch.join(','));
  const topInB1 = await A.evaluate(() => [...document.querySelectorAll('.sv-row')].find((r) => r.querySelector('.sv-nm b')?.textContent === '선수0').querySelectorAll('.sv-c')[0].querySelector('b').textContent);
  ok(+topInB1 === P.p0.scores.top - 3, `직전 변동 시점의 선수0 탑 = 최근 변동 전 점수(${topInB1})`);
  await A.click('[data-a=svOnly]'); await A.waitForTimeout(300);
  ok(await bRows() === 1, '바뀐 선수만 보기: 1명');
  await A.click('[data-a=svOnly]'); await A.click('[data-a=svTab][data-v=period]'); await A.waitForTimeout(300);
  const rows = () => A.$$eval('.sv-row:not(.sv-h)', (rs) => rs.map((r) => r.querySelector('.sv-nm b').textContent));
  let r = await rows();
  ok(r.length === 6 && !r.includes('선수7') && !r.includes('선수6'), `최근 7일: 바뀐 6명만(되돌린 선수7·20일 전 선수6 제외): ${r.join(',')}`);
  ok(r[0] === '선수0', '최근 변경순 맨 위 = 선수0');
  const p1 = await A.$eval('.sv-row:nth-child(n) .sv-c.up[title*="→"]', () => true).catch(() => false);
  const p1cell = await A.evaluate(() => [...document.querySelectorAll('.sv-row')].find((x) => x.textContent.includes('선수1'))?.querySelector('.sv-c.up em')?.textContent);
  ok(p1 && p1cell === '▲5', '같은 라인 두 번 바꾼 선수1 정글 = 처음→지금 묶음 ▲5: ' + p1cell);
  const sum = await A.$eval('.sv-sum', (e) => e.innerText.replace(/\s+/g, ' '));
  ok(/6\s*명/.test(sum) && /7\s*건/.test(sum), '요약: ' + sum);
  ok(await A.$('.sv-tl .sv-ev') !== null, '날짜별 기록 표시');
  if (SHOT) await A.screenshot({ path: SHOT + '/scores_pc.png' });
  await A.click('[data-a=svDays][data-v="30"]'); await A.waitForTimeout(300); r = await rows();
  ok(r.includes('선수6') && r.length === 7, '30일: 선수6 추가 → 7명');
  await A.click('[data-a=svSort][data-v=big]'); await A.waitForTimeout(300); r = await rows();
  ok(r[0] === '선수0' && r[1] === '선수1' && r[2] === '선수6', '변화 큰 순: 5점 둘(선수0·1, 같으면 이름순) → 4점 선수6: ' + r.slice(0, 3).join(','));
  await A.click('[data-a=svAll]'); await A.waitForTimeout(300); r = await rows();
  ok(r.length === 24, '바뀌지 않은 선수도 보기: 24명 ' + r.length);
  await A.click('[data-a=svAll]'); await A.waitForTimeout(200);
  await A.click('[data-a=slOpen]'); await A.waitForTimeout(1200);
  ok(/라인 점수 변경 내역 복사/.test(await A.evaluate(() => document.querySelector('#modal.on')?.innerText || '')), '변경 내역 복사 창 열림(관리 코드는 누를 때 받음)');
  await A.keyboard.press('Escape'); await A.evaluate(() => import('/js/core.js').then((m) => m.closeModal()));

  // 다른 사람이 점수를 바꾸면 열려 있는 화면에 바로 반영(기간별 탭) + 변동 탭이 한 칸씩 밀림
  const B = await client(b, be, 'WORK', 'B'); await open(B, 'home', 600);
  await B.evaluate(async () => { const { S } = await import('/js/core.js'); const p = S.store.data.players.p9; const to = p.scores.mid + 7;
    await S.store.patch('players', 'p9', { scores: { ...p.scores, mid: to } });
    await S.store.tx('meta', 'scorelog', (x) => ({ items: [...(x?.items || []), { at: Date.now(), pid: 'p9', name: p.name, lane: 'mid', from: p.scores.mid, to }] })); });
  await A.waitForTimeout(1500);
  const p9 = await A.evaluate(() => [...document.querySelectorAll('.sv-row')].find((x) => x.querySelector('.sv-nm b')?.textContent === '선수9')?.querySelector('.sv-c.up em')?.textContent);
  ok(p9 === '▲7', '다른 기기에서 바꾼 점수가 실시간 반영: ' + p9);
  await A.click('[data-a=svTab][data-v=b0]'); await A.waitForTimeout(300);
  ch = await changed(); ok(ch.length === 1 && /^선수9:미드:/.test(ch[0]), '새 변동이 최근 변동으로: ' + ch.join(','));
  await A.click('[data-a=svTab][data-v=b1]'); await A.waitForTimeout(300);
  ch = await changed(); ok(ch.length === 1 && /^선수0:탑:/.test(ch[0]), '이전 최근 변동은 직전 변동으로 밀림: ' + ch.join(','));
  await A.click('[data-a=svTab][data-v=period]'); await A.waitForTimeout(300);

  // 접속자: 얼굴 5개 + '+N', 누르면 위로 작은 창(나 먼저, 가나다순), 바깥 누르거나 Esc로 닫힘
  const faces = await A.$$eval('#presence .prs i.face', (x) => x.length), more = await A.$eval('#presence .pmore', (e) => e.textContent).catch(() => '');
  const total = await A.$eval('#presence .pcount b', (e) => +e.textContent);
  ok(faces === 5 && more === '+' + (total - 5), `얼굴 5개 겹침 + ${more} (접속 ${total}명)`);
  ok(await A.$eval('#presence', (e) => e.scrollHeight <= e.clientHeight + 1), '접속자 칸에 스크롤 없음');
  await A.click('#presence .prf'); await A.waitForTimeout(300);
  const pop = await A.$$eval('.prpop-l button', (bs) => bs.map((x) => x.querySelector('span').textContent));
  ok(pop.length === total && pop[0] === 'A', `작은 창: ${pop.length}명, 나(A) 맨 위`);
  const rest = pop.slice(1), sorted = [...rest].sort((a, c) => a.localeCompare(c, 'ko', { numeric: true }));
  ok(JSON.stringify(rest) === JSON.stringify(sorted), '나머지 가나다순');
  const box = await A.$eval('.prpop', (e) => { const r = e.getBoundingClientRect(), q = document.getElementById('presence').getBoundingClientRect(); return r.bottom <= q.top && r.top >= 0; });
  ok(box, '창이 접속자 칸 위쪽, 화면 안');
  if (SHOT) await A.screenshot({ path: SHOT + '/presence_pc.png' });
  await A.mouse.click(800, 400); await A.waitForTimeout(200);
  ok(!(await A.$('.prpop')), '바깥을 누르면 닫힘');
  await A.click('#presence .prf'); await A.waitForTimeout(200); await A.keyboard.press('Escape'); await A.waitForTimeout(200);
  ok(!(await A.$('.prpop')), 'Esc로 닫힘');
  await A.click('#presence .prf'); await A.waitForTimeout(200);
  await B.close(); await A.waitForTimeout(1500);
  ok(!!(await A.$('.prpop')), '접속자가 바뀌어도 열린 창 유지');

  // 휴대폰: 표가 화면 밖으로 넘치지 않음
  const M = await client(b, be, 'WORK', 'M'); await M.setViewportSize({ width: 390, height: 844 });
  await open(M, 'scores', 1500);
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 변동 탭: 가로 넘침 없음');
  if (SHOT) await M.screenshot({ path: SHOT + '/scores_m_batch.png' });
  await M.click('[data-a=svTab][data-v=period]'); await M.waitForTimeout(300);
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰: 가로 넘침 없음');
  if (SHOT) await M.screenshot({ path: SHOT + '/scores_m.png', fullPage: false });
  console.log('오류:', [...A.errs, ...M.errs].join(' | ') || '없음');
  ok(!A.errs.length && !M.errs.length, '페이지 오류 없음');
  await b.close();
})();
