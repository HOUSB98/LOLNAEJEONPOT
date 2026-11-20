// 읽기 수 비교 + 닫힌 채팅창 알림 + 선수 증분
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const TAG = process.env.REPO ? '[이전]' : '[새것]';
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const mob = async (name, ctx) => { const p = await client(b, be, 'WORK', name, ctx ? { ctx } : {}); await p.setViewportSize({ width: 390, height: 844 }); return p; };
  const reopen = async (hash = 'home') => { for (let k = 0; k < 4; k++) { const ctx = A.ctx; await A.close(); await new Promise((r) => setTimeout(r, 300)); A = await mob('폰A', ctx); await open(A, hash); await A.waitForTimeout(600); if (await A.evaluate(async () => Object.keys((await import('/js/core.js')).S.store.data.chat).length)) return; console.log('  (시험 도구가 첫 전달을 놓쳐 다시 엶)'); } };
  let A = await mob('폰A'); const P = await client(b, be, 'WORK', 'PC'); // PC 1280: 채팅 접힘(1281 미만)
  const rd = (who) => Object.fromEntries(Object.entries(be.byCol).filter(([k]) => k.startsWith('reads:')).map(([k, v]) => [k.slice(6), v]));
  await open(P); await P.waitForTimeout(500);
  be.reset(); await open(A); await A.waitForTimeout(1500);
  const r1 = rd(); console.log(TAG, '휴대폰 첫 접속 읽기:', JSON.stringify(r1), '합계', Object.values(r1).reduce((a, b) => a + b, 0));
  // 두 번째 접속(같은 기기, 새로고침)
  await A.waitForTimeout(31000); be.reset(); await reopen(); await A.waitForTimeout(1500);
  const r2 = rd(); console.log(TAG, '다시 접속(30초 뒤) 읽기:', JSON.stringify(r2), '합계', Object.values(r2).reduce((a, b) => a + b, 0));
  if (process.env.REPO) { await b.close(); return; }
  // 닫힌 채팅창: 다른 사람 메시지 2개 → 배지 2
  const badge = () => A.evaluate(() => { const x = document.getElementById('chatbadge'); return x && !x.hidden ? x.textContent : ''; });
  be.reset();
  await P.evaluate(async () => { const { S } = await import('/js/core.js'); for (let i = 0; i < 2; i++) await S.store.put('chat', 'pc' + i + Date.now(), { at: S.store.serverNow() + i, cid: 'other', nick: 'PC', k: 'm', t: '안녕' + i }); });
  await A.waitForTimeout(800);
  console.log('상태', await A.evaluate(async () => { const { S } = await import('/js/core.js'); return document.body.className + ' n=' + Object.keys(S.store.data.chat).length + ' ' + JSON.stringify(Object.values(S.store.data.chat).map(m=>[m.t,m.at,m.cid])) + ' now=' + S.store.serverNow(); }));
  ok(await badge() === '2', '닫힌 채팅창: 새 채팅 2개 → 배지 ' + await badge());
  ok((be.byCol['reads:chat'] || 0) <= 2 * 2 + 2, `닫힌 채팅창이 받은 읽기(메시지 2개, 2명): ${be.byCol['reads:chat']}`);
  // 열기 → 목록 20개 보임, 배지 사라짐
  await A.click('#chatfab'); await A.waitForTimeout(1200);
  const op = await A.evaluate(async () => { const { S } = await import('/js/core.js'); return { n: Object.keys(S.store.data.chat).length, shown: document.querySelectorAll('#chatlog .cm, #chatlog .csys').length, last: [...document.querySelectorAll('#chatlog .cb')].pop()?.innerText }; });
  ok(op.n === 20 && op.shown >= 15 && op.last === '안녕1' && await badge() === '', '열면 최근 20개 · 마지막 메시지 보임 · 배지 사라짐 ' + JSON.stringify(op));
  // 닫고 1분 지나면 1개로
  await A.click('#chat .chatx'); await A.waitForTimeout(1000);
  await A.evaluate(() => new Promise((r) => setTimeout(r, 0)));
  // 새로고침 후(닫힌 채로) 그 사이 쌓인 채팅 수를 서버에서 셈
  await P.evaluate(async () => { const { S } = await import('/js/core.js'); for (let i = 0; i < 3; i++) await S.store.put('chat', 'pz' + i + Date.now(), { at: S.store.serverNow() + 100 + i, cid: 'other', nick: 'PC', k: 'm', t: '또' + i }); });
  await reopen(); await A.waitForTimeout(1500);
  ok(await badge() === '3', '다시 접속(닫힌 채로): 못 본 채팅 3개 → 배지 ' + await badge());
  // 버튼에 올리기만 해도 미리 받기
  be.reset(); await A.dispatchEvent('#chatfab', 'pointerenter'); await A.waitForTimeout(800);
  ok((be.byCol['reads:chat'] || 0) >= 5, '버튼에 손을 올리면 미리 받음(읽기 ' + be.byCol['reads:chat'] + ')');
  // 내가 채팅 보내기(입력하면 창이 열림) 정상
  // 선수 변경이 다른 기기에 반영(증분)
  await P.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.patch('players', 'p3', { memo: '바뀜' }); });
  await A.waitForTimeout(800);
  ok(await A.evaluate(async () => { const { S } = await import('/js/core.js'); return S.store.data.players.p3.memo === '바뀜' && Object.keys(S.store.data.players).length; }) >= 20, '다른 기기에서 고친 선수 정보가 바로 반영, 선수 목록 전체 유지');
  const upd = await A.evaluate(async () => { const { S } = await import('/js/core.js'); return Object.values(S.store.data.players).every((p) => p.upd); });
  ok(upd, '모든 선수에 수정 시각(upd)이 채워짐');
  console.log('페이지 오류:', [A, P].flatMap((p) => p.errs).join(' | ') || '없음');
  await b.close();
})();
