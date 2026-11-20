const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'), B = await client(b, be, 'WORK', 'B');
  for (const p of [A, B]) p.on('dialog', (d) => d.accept());
  await open(A, 'today'); await open(B, 'matches');
  await A.waitForFunction(async () => (await import('/js/core.js')).S.st?.matches?.length > 0, null, { timeout: 15000 }); // 경기 기록이 다 올 때까지
  ok(!(await A.$('[data-a=tLive],[data-a=tLiveStop]')) && !!(await A.$('[data-a=tAi]')), '오늘의 내전: 밴픽 시작 버튼 없음, AI 추천 그대로');
  // ---- 진영 바꾸기
  const snap = (p) => p.evaluate(async () => { const { S } = await import('/js/core.js'); return { list: S.st.list.map((s) => [s.id, s.g, s.w, Math.round(s.mmr * 1000), s.ovr]).sort().join(';'), ms: Object.values(S.store.data.matches).filter(m=>!m.deleted).length }; });
  const ms = Object.values(be.db?.matches || {}).length;
  const mid = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const L = S.st.matches, w = L.filter((m) => m.snap && (m.bans?.blue||[]).length); const m = w[w.length-1] || L.filter((m) => m.snap).pop() || L[L.length - 1]; return m.id; });
  const before = await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); return JSON.parse(JSON.stringify(S.store.data.matches[id])); }, mid);
  const s0 = await snap(A);
  await A.evaluate(() => (location.hash = '#/matches')); await A.waitForTimeout(800);
  await A.click(`[data-a=matchDetail][data-id="${mid}"]`); await A.waitForTimeout(400);
  ok(!!(await A.$('[data-a=matchSwap]')), '상세 창에 진영 바꾸기 버튼');
  await A.click('[data-a=matchSwap]'); await A.waitForTimeout(1000);
  const after = await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); return JSON.parse(JSON.stringify(S.store.data.matches[id])); }, mid);
  const sw = (o) => JSON.stringify({ blue: o?.red, red: o?.blue });
  ok(JSON.stringify(after.blue) === JSON.stringify(before.red) && JSON.stringify(after.red) === JSON.stringify(before.blue) && JSON.stringify(after.champs) === sw(before.champs) && JSON.stringify(after.bans) === sw(before.bans) && after.winner !== before.winner, '선수·챔피언·밴·승리 진영이 함께 바뀜');
  ok(JSON.stringify(after.kda) === JSON.stringify(before.kda) && JSON.stringify(after.stats) === JSON.stringify(before.stats) && after.at === before.at && after.seriesId === before.seriesId, 'KDA·리플레이·시각·시리즈 그대로');
  ok(!before.snap || (after.snap.bs === before.snap.rs && after.snap.rs === before.snap.bs && Math.abs(after.snap.pBlue + before.snap.pBlue - 1) < 1e-3), '저장 당시 점수·예상 승률도 진영 따라 바뀜 ' + JSON.stringify([before.snap, after.snap]));
  const s1 = await snap(A);
  ok(s0.list === s1.list && s0.ms === s1.ms, '모든 선수 판수·승·MMR·OVR 그대로, 경기 수 그대로');
  await B.waitForTimeout(600); const bAfter = await B.evaluate(async (id) => { const { S } = await import('/js/core.js'); return S.store.data.matches[id].winner; }, mid);
  ok(bAfter === after.winner, '다른 기기에도 반영');
  ok(be.log.some((l) => l.op === 'write' && l.col === 'history'), '바꾸기 전 경기를 되돌리기 기록에 남김');
  await A.click(`[data-a=matchDetail][data-id="${mid}"]`); await A.waitForTimeout(300); await A.click('[data-a=matchSwap]'); await A.waitForTimeout(800);
  const back = await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); const { id: _, ...m } = JSON.parse(JSON.stringify(S.store.data.matches[id])); return m; }, mid);
  const { id: __, ...b0 } = before;
  // upd(저장 시각)는 저장할 때마다 바뀌므로 빼고, 소수점 끝자리 차이는 무시하고 비교
  const rp = (o) => typeof o === 'number' ? Math.round(o * 1e9) / 1e9 : Array.isArray(o) ? o.map(rp) : o && typeof o === 'object' ? Object.keys(o).filter((k) => k !== 'upd').sort().map((k) => [k, rp(o[k])]) : o;
  ok(JSON.stringify(rp(back)) === JSON.stringify(rp(b0)), '한 번 더 누르면 원래 기록과 완전히 같음(저장 시각 제외)');
  // ---- 게시판 수정
  await A.evaluate(() => (location.hash = '#/talk')); await A.waitForTimeout(600);
  await A.click('[data-a=tkOpen]'); await A.fill('#tkt', '원래 제목'); await A.fill('#tkb', '원래 내용'); await A.fill('#tkp', '1234'); await A.click('[data-a=tkPost]'); await A.waitForTimeout(800);
  await A.click('[data-a=tkEdit]'); await A.fill('#tket', '고친 제목'); await A.fill('#tkeb', '고친 내용'); await A.fill('#tkep', '9999'); await A.click('#tkef button'); await A.waitForTimeout(400);
  const tst = () => A.evaluate(() => [...document.querySelectorAll('.toast,#toast')].map((e) => e.innerText).join('|'));
  ok(/비밀번호가 맞지 않아요/.test(await tst()), '글 수정: 틀린 비밀번호 거절');
  await A.fill('#tkep', '1234'); await A.click('#tkef button'); await A.waitForTimeout(800);
  const pv = await A.evaluate(() => { const a = document.querySelector('.tk-post'); return a.querySelector('h3')?.innerText + '|' + a.querySelector('.tk-text').innerText + '|' + a.querySelector('header small').innerText; });
  ok(/^고친 제목\|고친 내용\|.*수정됨/.test(pv), '글 수정됨: ' + pv);
  await B.evaluate(() => (location.hash = '#/talk')); await B.waitForTimeout(800);
  ok(/고친 내용/.test(await B.evaluate(() => document.querySelector('.tk-text')?.innerText)), '다른 기기에도 고친 글');
  // 댓글
  await A.click('[data-a=cmToggle]'); await A.waitForTimeout(600);
  await A.fill('textarea[data-i=cmT]', '원래 댓글'); await A.fill('input[data-i=cmP]', 'abcd'); await A.click('[data-a=cmPost]'); await A.waitForTimeout(800);
  await A.click('[data-a=cmEdit]'); await A.fill('#cmeb', '고친 댓글'); await A.fill('#cmep', 'abcd'); await A.click('#cmef button'); await A.waitForTimeout(800);
  const cv = await A.evaluate(() => { const c = document.querySelector('.tk-c'); return c.querySelector('p').innerText + '|' + c.querySelector('small').innerText; });
  ok(/^고친 댓글\|.*수정됨/.test(cv), '댓글 수정됨: ' + cv);
  const docC = Object.values(be.data?.comments || {});
  const cdoc = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const r = await S.store.byField('comments', 'pid', Object.keys(S.store.data.posts)[0], '', 5); return r.map((x) => [x.body, !!x.edited, !!x.pw]); });
  ok(cdoc.some(([b, e, p]) => b === '고친 댓글' && e && p), 'DB 댓글: 내용·수정 시각 저장, 비밀번호 해시 유지 ' + JSON.stringify(cdoc));
  console.log('페이지 오류:', [A, B].flatMap((p) => p.errs).join(' | ') || '없음');
  await b.close();
})();
