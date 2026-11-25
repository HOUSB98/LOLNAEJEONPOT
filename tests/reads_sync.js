// 경기 기록·선수 전체 다시 받기 주기: 처음 접속은 전체, 그 뒤엔 바뀐 것만. 하루가 지나면 서버 문서 수만 세어(읽기 1) 같으면 전체를 받지 않고,
// 기기에 빠진 문서가 있으면(수가 다르면) 그 자리에서 전체를 다시 받아 채움. 7일이 지나면 전체(예전: 하루마다 전체)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  seed.players.forEach((p, i) => (p.upd = { __ts: Date.now() - 864e5 + i * 1000 })); // 실제처럼 문서마다 수정 시각이 다르게
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const nM = seed.matches.length, nP = seed.players.length;
  let A = await client(b, be, 'WORK', 'A');
  const reopen = async (t) => {
    if (t) await A.evaluate((d) => { for (const k of Object.keys(localStorage)) { if (/naejeon:(mfull|pfull):/.test(k)) localStorage.setItem(k, String(d.full)); if (/naejeon:(mcnt|pcnt):/.test(k)) localStorage.setItem(k, String(d.cnt)); } }, t);
    const ctx = A.ctx; await A.close(); await new Promise((r) => setTimeout(r, 300));
    A = await client(b, be, 'WORK', 'A', { ctx }); be.reset(); await open(A, 'home', 1500); await A.waitForTimeout(6500); // 문서 수 확인은 화면을 그리고 5초 뒤
    return { m: be.byCol['reads:matches'] || 0, p: be.byCol['reads:players'] || 0 };
  };
  const ago = (d) => Date.now() - d * 864e5;
  be.reset(); await open(A, 'home', 1500);
  ok((be.byCol['reads:matches'] || 0) >= nM && (be.byCol['reads:players'] || 0) >= nP, `처음 접속: 전체(경기 ${be.byCol['reads:matches']} · 선수 ${be.byCol['reads:players']})`);
  const r1 = await reopen();
  ok(r1.m < 10 && r1.p < 10, `바로 다시 접속: 바뀐 것만(경기 ${r1.m} · 선수 ${r1.p})`);
  const r2 = await reopen({ full: ago(2), cnt: ago(2) });
  ok(r2.m < 10 && r2.p < 10, `2일 뒤 접속: 문서 수만 확인하고 전체는 안 받음(경기 ${r2.m} · 선수 ${r2.p}, 예전엔 경기 ${nM}개 전부)`);
  const keys = await A.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => /naejeon:(mcnt|pcnt):/.test(k)).map((k) => [k, Date.now() - +localStorage.getItem(k)])));
  ok(Object.keys(keys).length === 2 && Object.values(keys).every((v) => v < 60e3), '문서 수 확인 시각을 기록(오늘은 다시 세지 않음)');
  // 기기 캐시에 빠진 문서: 서버에만 있는 예전 경기(수정 시각이 기기의 마지막 값보다 이른 문서 = '바뀐 것만'으로는 못 받음)
  const old = { ...seed.matches[0], id: 'missed1', at: seed.matches[0].at - 1, upd: { __ts: seed.matches[0].at - 1 } };
  be.db.matches.missed1 = old;
  const r3 = await reopen({ full: ago(2), cnt: ago(2) });
  const got = await A.evaluate(async () => { const { S } = await import('/js/core.js'); return [!!S.store.data.matches.missed1, Object.keys(S.store.data.matches).length, S.st.matches.length]; });
  ok(got[0] && got[1] === nM + 1 && got[2] === nM + 1, `빠진 문서가 있으면 그 자리에서 전체를 다시 받아 채움(경기 ${got[1]}개, 통계 ${got[2]}경기, 읽기 ${r3.m})`);
  const r4 = await reopen();
  ok(r4.m < 10, `그 다음 접속은 다시 바뀐 것만(경기 ${r4.m})`);
  const r5 = await reopen({ full: ago(8), cnt: ago(0.1) });
  ok(r5.m >= nM && r5.p >= nP, `7일이 지나면 전체 다시 받기(경기 ${r5.m} · 선수 ${r5.p})`);
  const r6 = await reopen();
  ok(r6.m < 10 && r6.p < 10, `그 뒤엔 다시 바뀐 것만(경기 ${r6.m} · 선수 ${r6.p})`);
  // 다른 기기에서 고친 기록은 그대로 바로 반영
  const B = await client(b, be, 'WORK', 'B'); await open(B, 'home', 800);
  await B.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.patch('players', 'p3', { memo: '바뀜2' }); });
  await A.waitForTimeout(800);
  ok(await A.evaluate(async () => (await import('/js/core.js')).S.store.data.players.p3.memo === '바뀜2'), '다른 기기에서 고친 선수 정보는 바로 반영');
  const errs = [...A.errs, ...B.errs].filter((e) => !/전체 다시 받기/.test(e));
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
