// 강조 효과: 경기 기록(승리 팀 빛·새 경기 광택), 경매(최고 입찰·금액 오르면 반짝·마감 5초 전 맥동), 값이 바뀌면 한 번 반짝, 점수 변동 24시간 NEW.
// 모두 이미 받은 데이터로만 그려서 읽기·쓰기가 늘지 않는지도 확인한다.
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const now = Date.now(), P = Object.fromEntries(seed.players.map((p) => [p.id, p]));
  seed.meta.find((m) => m.id === 'scorelog').items = [
    { at: now - 3 * 864e5, pid: 'p1', name: P.p1.name, lane: 'top', from: P.p1.scores.top - 2, to: P.p1.scores.top },
    { at: now - 3600e3, pid: 'p2', name: P.p2.name, lane: 'mid', from: P.p2.scores.mid + 1, to: P.p2.scores.mid }];
  const au = seed.auctions[0];
  Object.assign(au, { status: 'running', deleted: false, cfg: { ...au.cfg, sec: 9, ext: 3 }, pool: au.pool.slice(1), cur: { pid: au.pool[0], bid: 0, team: -1, startsAt: now + 3000, endsAt: now + 3000 + 9000 } });
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'), B = await client(b, be, 'WORK', 'B');
  for (const p of [A, B]) await p.addInitScript(() => localStorage.setItem('naejeon:lite', '0'));

  // 1) 경매(먼저: 마감 시각이 정해져 있음)
  await open(A, 'home', 500); await open(B, 'home', 500); await A.evaluate(() => (location.hash = '#/auction/au0/tk0')); await A.waitForTimeout(3500);
  ok(!(await A.$('.bidnow.lead')), '입찰 전: 최고 입찰 강조 없음');
  await A.click('.bids [data-a=auBid]'); await A.waitForTimeout(700);
  ok(!!(await A.$('.bidnow.lead')), '입찰 후: 최고 입찰 금빛 테두리');
  await B.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.syncServerClock(true); await S.store.tx('auctions', 'au0', (r) => { r.cur.bid += 20; r.cur.team = 1; return r; }); });
  await A.waitForTimeout(500);
  ok(!!(await A.$('.bidnow.bump')), '다른 팀이 금액을 올리면 한 번 반짝(bump)');
  const endAt = be.db.auctions.au0.cur.endsAt; while (Date.now() < endAt - 3000) await A.waitForTimeout(100);
  ok(await A.$eval('#au-timer', (e) => e.classList.contains('hot')) && !!(await A.$('.stage.hot')), '마감 5초 전: 타이머·경매판 빨간 맥동');
  while (Date.now() < endAt + 1500) await A.waitForTimeout(100);
  ok(!(await A.$('.stage.hot')), '다음 매물로 넘어가면 맥동 꺼짐');

  // 2) 경기 기록: 승리 팀 빛, 새 경기 광택(한 번만)
  await A.evaluate(() => (location.hash = '#/matches')); await A.waitForTimeout(1200);
  ok(await A.$$eval('.mcard .team.win', (x) => x.length) > 0 && !(await A.$('.mcard.fresh')), '승리 팀 빛 표시, 처음 열 때는 광택 없음');
  const m0 = Object.values(be.db.matches).sort((a, c) => c.at - a.at)[0];
  await B.evaluate(async (m) => { const { S } = await import('/js/core.js'); await S.store.put('matches', 'new1', { ...m, id: 'new1', at: Date.now(), seq: 9999 }); }, m0);
  await A.waitForFunction(() => !!document.querySelector('.mcard.fresh'), null, { timeout: 5000 }).catch(() => {});
  ok(await A.$$eval('.mcard.fresh', (x) => x.length) === 1, '다른 기기에서 저장한 새 경기 1개만 광택');
  await A.evaluate(async () => (await import('/js/core.js')).refresh()); await A.waitForTimeout(300);
  ok(!(await A.$('.mcard.fresh')), '다시 그리면 광택은 다시 나오지 않음(한 번만)');

  // 3) 값이 바뀌면 한 번 반짝: 랭킹 OVR / 점수 변동 칸
  await A.evaluate(() => (location.hash = '#/scores')); await A.waitForTimeout(1200);
  ok(await A.$$eval('.sv-c.new24 .sv-new', (x) => x.length) === 1 && await A.$$eval('.sv-c.up:not(.new24), .sv-c.dn:not(.new24)', (x) => x.length) >= 1, '점수 변동: 24시간 안 변경만 NEW');
  ok(!(await A.$('.lv-tick')), '처음 열 때는 반짝 없음');
  await B.evaluate(async () => { const { S } = await import('/js/core.js'); const p = S.store.data.players.p2; await S.store.patch('players', 'p2', { scores: { ...p.scores, jg: p.scores.jg + 3 } }); });
  await A.waitForFunction(() => !!document.querySelector('.lv-tick'), null, { timeout: 4000 }).catch(() => {});
  ok(await A.$$eval('.lv-tick', (x) => x.map((e) => e.dataset.live)).then((k) => k.length === 1 && k[0] === 'sv:p2:jg'), '다른 기기가 바꾼 칸(선수2 정글)만 한 번 반짝');
  await A.waitForTimeout(1000); ok(!(await A.$('.lv-tick')), '0.8초 뒤 효과 클래스 제거');
  await A.evaluate(() => document.body.classList.add('lite'));
  await B.evaluate(async () => { const { S } = await import('/js/core.js'); const p = S.store.data.players.p6; await S.store.patch('players', 'p6', { scores: { ...p.scores, top: p.scores.top + 1 } }); });
  await A.waitForTimeout(1200); ok(!(await A.$('.lv-tick')), '가벼운 모드: 반짝 없음');
  console.log('오류:', [...A.errs, ...B.errs].join(' | ') || '없음'); ok(!A.errs.length, '페이지 오류 없음');
  await b.close();
})();
