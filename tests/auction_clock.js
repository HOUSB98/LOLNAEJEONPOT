// 경매 마감 시각: 시계를 맞출 때 연결이 느렸던 기기(서버 시각이 앞서 보임)가 팀장으로 있어도 매물을 마감 전에 넘기지 않는다.
// (예전: 그 기기가 남들보다 1~2초 먼저 낙찰·유찰 처리 → "예상보다 빨리 넘어감")
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const now0 = Date.now() + 2000, au = seed.auctions[0], pid = au.pool[0];
  Object.assign(au, { status: 'running', deleted: false, cfg: { ...au.cfg, sec: 14, ext: 6 }, pool: au.pool.slice(1), cur: { pid, bid: 0, team: -1, startsAt: now0 + 6000, endsAt: now0 + 6000 + 14000 } });
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const op = be.op.bind(be);
  be.op = async (page, who, o, a) => { if (who === 'SLOW' && o === 'set' && a.ref.col === 'clock') await new Promise((r) => setTimeout(r, 3000)); return op(page, who, o, a); };
  const W = await client(b, be, 'WORK', 'SLOW'), N = await client(b, be, 'WORK', 'OK');
  await open(W, 'home', 600); await open(N, 'home', 600);
  await W.evaluate(() => (location.hash = '#/auction/au0/tk0')); await N.evaluate(() => (location.hash = '#/auction/au0/tk1'));
  await W.waitForTimeout(4500);
  const err = await W.evaluate(async () => { const { S } = await import('/js/core.js'); return [Math.round(S.store.serverNow() - Date.now()), Math.round(S.store.serverClockErr?.() ?? 0)]; });
  ok(err[0] > 800 && err[1] >= err[0] - 50, `느린 기기: 시계가 ${err[0]}ms 앞서 보이지만 최대 오차 ${err[1]}ms로 알고 있음`);
  // 정상 기기(팀장1)가 마감 6초 전쯤 입찰 → 연장 규칙(남은 시간 6초 미만이면 6초로) 확인
  while (Date.now() < au.cur.endsAt - 7000) await new Promise((r) => setTimeout(r, 100));
  await N.evaluate(async () => { const { S } = await import('/js/core.js'); const r = S.store.data.auctions.au0; const v = r.cur.bid + r.cfg.unit; const b = document.querySelector('[data-a=auBid]:not([data-v=amt])'); if (b) b.click(); return v; });
  await N.waitForTimeout(1500);
  const c1 = be.db.auctions.au0.cur, ends = c1.endsAt;
  ok(c1.team === 1 && c1.bid > 0, `정상 기기 입찰 반영: ${c1.bid}P`);
  let doneAt = 0; const t0 = Date.now();
  while (Date.now() - t0 < 30000) { const c = be.db.auctions.au0.cur; if (!c || c.pid !== pid) { doneAt = Date.now(); break; } await new Promise((r) => setTimeout(r, 40)); }
  const finalEnds = Math.max(ends, c1.endsAt);
  ok(doneAt && doneAt >= finalEnds, `마감 전에 넘어가지 않음(마감보다 ${((doneAt - finalEnds) / 1000).toFixed(2)}초 뒤)`);
  ok(doneAt && doneAt - finalEnds < 3500, '마감 후 3.5초 안에 정상 처리');
  const r = be.db.auctions.au0, t = r.teams[1];
  ok(t.members.some((m) => m.pid === pid), '낙찰: 입찰한 팀으로');
  ok(r.cur && r.cur.endsAt - r.cur.startsAt === 14000, '다음 매물 시간 그대로(14초)');
  console.log('오류:', [...W.errs, ...N.errs].join(' | ') || '없음');
  await b.close();
})();
