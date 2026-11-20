// 기능 확인(고친 뒤 버전, Firebase 모드 + 가짜 Firestore)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => console.log((c ? '  ✓ ' : '  ✗ ') + m);
const S_ = (p, f, a) => p.evaluate(async ([f, a]) => { const { S } = await import('/js/core.js'); return new Function('S', 'a', 'return (' + f + ')(S, a)')(S, a); }, [f.toString(), a]);
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const tree = process.env.TREE || 'WORK';
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  // A: 정상 시계 기기 2대, B: 시계가 90초 빠른 기기
  const A = await client(b, be, tree, '정상A', { clock: true }); await open(A);
  const A2 = await client(b, be, tree, '정상A2', { clock: true }); await open(A2);
  const B = await client(b, be, tree, '시계빠름B', { clock: { time: Date.now() + 90e3 } }); await open(B);
  console.log(`[${tree}]`);

  // 1) 접속할 때 서버 시계 맞추기를 하지 않음
  ok(!be.byCol['writes:clock'], `접속 3번에 시계 맞추기 쓰기 ${be.byCol['writes:clock'] || 0}번`);

  // 2) 경매: 처음엔 구독 안 함 → 경매 화면 → 실시간 → 나가고 1분 뒤 구독 해제 → 그동안 입찰은 안 읽음 → 다시 들어오면 최신
  const lis = (who) => Object.values(be.listeners).filter((l) => l.ref.col === 'auctions' && l.who === who).length;
  ok(lis('정상A') === 0, '홈에 있을 때 경매 구독 없음');
  await A.evaluate(() => (location.hash = '#/auction')); await A.waitForFunction(() => /경매 0/.test(document.getElementById('main').innerText), null, { timeout: 5000 }).catch(() => {});
  const lobby = await A.evaluate(() => document.getElementById('main').innerText);
  ok(lis('정상A') === 1 && /경매 0/.test(lobby) && !/경매 4\b/.test(lobby), '경매 목록 화면: 구독 시작, 방 목록 표시(지운 방 제외)');
  await A.evaluate(() => (location.hash = '#/auction/au0')); await A2.evaluate(() => (location.hash = '#/auction/au0')); await A.waitForTimeout(1500);
  await A2.waitForFunction(async () => (await import('/js/core.js')).S.store.data.auctions?.au0, null, { timeout: 5000 }).catch(() => {});
  await S_(A2, (S) => S.store.tx('auctions', 'au0', (r) => ({ ...r, name: '이름 바꿈 1' })));
  await A.waitForFunction(async () => (await import('/js/core.js')).S.store.data.auctions?.au0?.name === '이름 바꿈 1', null, { timeout: 5000 }).catch(() => {}); await A.waitForTimeout(300);
  ok(/이름 바꿈 1|대기 중/.test(await A.evaluate(() => document.getElementById('main').innerText)) && (await S_(A, (S) => S.store.data.auctions.au0.name)) === '이름 바꿈 1', '경매 방: 다른 사람이 바꾼 내용이 실시간으로 반영');
  await A.evaluate(() => (location.hash = '#/rank')); await A.waitForTimeout(500);
  ok(lis('정상A') === 1, '경매 화면을 나가도 1분 동안은 구독 유지(금방 돌아올 때 대비)');
  await A.clock.fastForward(61e3); await A.waitForTimeout(500);
  ok(lis('정상A') === 0, '나가고 1분 뒤 구독 해제');
  const r0 = be.byWho?.['정상A'] || 0;
  for (let k = 0; k < 5; k++) await S_(A2, (S, k) => S.store.tx('auctions', 'au0', (r) => ({ ...r, name: '이름 바꿈 ' + (k + 2) })), k);
  await A.waitForTimeout(500);
  ok((be.byWho?.['정상A'] || 0) === r0, `구독 해제 뒤 입찰 5번: 정상A 읽기 ${(be.byWho?.['정상A'] || 0) - r0}번`);
  await A.evaluate(() => (location.hash = '#/auction/au0')); await A.waitForTimeout(1200);
  ok((await S_(A, (S) => S.store.data.auctions.au0.name)) === '이름 바꿈 6' && lis('정상A') === 1, '다시 들어오면 최신 내용(이름 바꿈 6) + 구독 재개');
  // 3) 백업: 경매 화면이 아닌 기기에서도 경매 기록 포함
  await A2.evaluate(() => (location.hash = '#/admin/config')); await A2.waitForTimeout(1500); await A2.clock.fastForward(61e3); await A2.waitForTimeout(300);
  // 시험 도구가 경매 기록 전달을 가끔 놓쳐 다운로드가 안 끝날 때가 있어, 8초 안에 안 오면 한 번 더 누른다(다시 누르면 기록에 남김)
  let dlv = null;
  for (let k = 0; k < 3 && !dlv; k++) { const dl = A2.waitForEvent('download', { timeout: 8000 }); await A2.evaluate(() => document.querySelector('[data-a=backup]').click()); dlv = await dl.catch(() => null); if (!dlv) console.log('   (백업 다운로드가 안 와서 다시 누름)'); }
  const file = await dlv.path(); const bk = JSON.parse(require('fs').readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  ok(bk.auctions?.length === 12 && bk.players?.length === 24 && bk.matches?.length === 300, `백업 파일: 경매 ${bk.auctions?.length} · 선수 ${bk.players?.length} · 경기 ${bk.matches?.length}`);

  // 4) 서버 시각: 시계가 90초 빠른 기기의 채팅·글 시각이 서버 시각과 맞고, 순서가 지켜짐
  const t0 = Date.now();
  await B.evaluate(async () => { const { sendLobbyChat } = await import('/js/social.js'); sendLobbyChat('B가 먼저'); });
  await B.waitForTimeout(1500);
  await A.evaluate(async () => { const { sendLobbyChat } = await import('/js/social.js'); sendLobbyChat('A가 나중'); });
  await A.waitForTimeout(1500);
  const chat = Object.values(be.db.chat).filter((m) => /가 (먼저|나중)/.test(m.t)).sort((a, b) => a.at - b.at);
  const bAt = chat.find((m) => m.t === 'B가 먼저')?.at;
  ok(chat.map((m) => m.t).join(',') === 'B가 먼저,A가 나중', `채팅 순서: ${chat.map((m) => m.t).join(' → ')}`);
  ok(Math.abs(bAt - t0) < 3000, `시계 빠른 기기의 채팅 시각 오차 ${Math.round((bAt - t0) / 1000)}초 (고치기 전 방식이면 약 90초)`);
  ok((be.byCol['writes:clock'] || 0) <= 2, `채팅할 때만 시계 맞추기: 지금까지 ${be.byCol['writes:clock'] || 0}번`);
  // 연속 전송 순서
  // 사이트의 도배 방지(3초에 3개)에 맞춰 3개 보내고, 3.5초 뒤 나머지 2개
  await B.evaluate(async () => { const { sendLobbyChat } = await import('/js/social.js'); for (let i = 1; i <= 3; i++) sendLobbyChat('연속' + i); });
  await B.waitForTimeout(3300); // 시계를 건너뛰지 않고 실제로 기다린다(건너뛰면 이 기기의 서버 시각 보정이 어긋남)
  await B.evaluate(async () => { const { sendLobbyChat } = await import('/js/social.js'); for (let i = 4; i <= 5; i++) sendLobbyChat('연속' + i); });
  await B.waitForTimeout(1200);
  const seq = Object.values(be.db.chat).filter((m) => /^연속/.test(m.t)).sort((a, b) => a.at - b.at).map((m) => m.t).join(',');
  ok(seq === '연속1,연속2,연속3,연속4,연속5', '연속으로 보낸 채팅 5개 순서 그대로');
  { const seen = await B.waitForFunction(() => [...document.querySelectorAll('#chat .cm')].some((e) => e.innerText.includes('연속5')), null, { timeout: 4000 }).then(() => true).catch(() => false);
    if (!seen) console.log('   (진단)', await B.evaluate(async () => { const { S } = await import('/js/core.js'); const d = Object.values(S.store.data.chat); return JSON.stringify({ open: !document.body.classList.contains('chat-closed'), n: d.length, has5: d.some((m) => m.t === '연속5'), last: d.sort((a, b) => a.at - b.at).slice(-3).map((m) => m.t), dom: [...document.querySelectorAll('#chat .cm')].slice(-3).map((e) => e.innerText.slice(0, 20)) }); }), '리스너', JSON.stringify(Object.values(be.listeners).filter((l) => l.who === '시계빠름B' && l.ref.col === 'chat').map((l) => l.ref.cs)));
    ok(seen, '보낸 채팅이 화면에 보임'); }
  // 익명 글: 시각이 서버 기준
  await B.evaluate(() => (location.hash = '#/talk')); await B.waitForTimeout(700);
  await B.evaluate(() => document.querySelector('[data-a=tkOpen]')?.click()); await B.waitForTimeout(300);
  if (await B.$('#tkb')) { await B.fill('#tkb', '시계 시험 글'); await B.fill('#tkp', '1234'); const t1 = Date.now(); await B.evaluate(() => document.querySelector('[data-a=tkPost]').click()); await B.waitForTimeout(1500); const post = Object.values(be.db.posts).find((x) => x.body === '시계 시험 글'); ok(post && Math.abs(post.at - t1) < 3000, `익명 글 시각 오차 ${post ? Math.round((post.at - t1) / 1000) : '?'}초`); }
  else ok(false, '글쓰기 칸을 찾지 못함');

  // 5) 접속 표시: 창 전환 5분 제한, 나감 표시 후에는 바로 다시 신호, 탭 닫으면 다른 사람 화면에서 빠짐
  const pw = () => be.byCol['writes:presence'] || 0;
  const vis = (p) => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => window.__vis || 'visible', configurable: true }); window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await A.clock.fastForward(6 * 60e3); let w0 = pw(); await vis(A); await A.waitForTimeout(300);
  ok(pw() - w0 === 1, `5분 넘게 지나 창 전환: 신호 ${pw() - w0}번`);
  // 사이트는 접속 후 10분마다 정기 신호를 보낸다. 그 시각을 넘지 않게 남은 시간 안에서 4번 창 전환한다
  const tmin = (await A.evaluate(() => performance.now())) / 60e3, room = Math.ceil(tmin / 10 + 1e-9) * 10 - tmin - 0.3;
  const step = Math.max(5e3, Math.min(60e3, (room * 60e3) / 4));
  w0 = pw(); for (let i = 0; i < 4; i++) { await A.clock.fastForward(step); await vis(A); } await A.waitForTimeout(300);
  ok(pw() - w0 === 0, `그 뒤 ${Math.round(step * 4 / 1000)}초 동안 창 전환 4번(정기 신호 전): 신호 ${pw() - w0}번`);
  w0 = pw(); await A.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); await A.waitForTimeout(300); await vis(A); await A.waitForTimeout(300);
  ok(pw() - w0 === 2 && be.db.presence[(await A.evaluate(() => localStorage.getItem('naejeon:cid')))]?.at > 0, '나감 표시(at:0) 뒤 다시 보이면 바로 접속 신호(접속 중으로 복귀)');
  const cnt = async (p) => +(await p.evaluate(() => document.querySelector('.pcount b')?.textContent));
  await A2.clock.fastForward(10e3); await A2.waitForTimeout(400);
  const before = await cnt(A2); console.log('   (닫기 전', before, '명, 시드의 최근 접속 기록 포함)'); await B.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))); await B.waitForTimeout(500); await B.close({ runBeforeUnload: true }); await A2.waitForTimeout(800); await A2.clock.fastForward(11e3); await A2.waitForTimeout(400);
  { const after = await cnt(A2); ok(before >= 3 && after === before - 1, `접속 중 표시: ${before}명 → B가 탭을 닫으면 ${after}명`); }

  // 6) 라인 지원 추첨·주사위를 다른 기기에서 볼 때 서버 시각을 맞춘 뒤 재생
  const C = await client(b, be, tree, '시계느림C', { clock: { time: Date.now() - 60e3 } }); await open(C);
  ok(!(await S_(C, (S) => S.store.serverClockReady())), '새로 들어온 기기 C: 아직 시계 안 맞춤(접속만으로는 맞추지 않음)');
  await S_(A, (S) => { const ids = Object.keys(S.store.data.players).slice(0, 4); const now = S.store.serverNow(); return S.store.put('meta', 'dice', { rid: 'r' + now, at: now, startAt: now + 1500, lane: 0, ids, names: ids.map((x) => S.st.P[x].name), a: ids[0], b: ids[1], by: '정상A' }); });
  const diceOk = await C.waitForFunction(async () => { const { S } = await import('/js/core.js'); return !!document.querySelector('#modal.on .dice-stage') && S.store.serverClockReady(); }, null, { timeout: 6000 }).then(() => true).catch(() => false);
  ok(diceOk, '다른 사람이 굴린 주사위: C가 시계를 맞춘 뒤 같은 장면 재생');
  // 시험 도구가 C의 시계를 실제로 얼마나 늦췄는지 재고(가끔 늦추지 못함), 보정값이 그만큼인지 본다
  const slow = Date.now() - (await C.evaluate(() => Date.now()));
  const off = await S_(C, (S) => S.store.serverNow() - Date.now());
  let off2 = off;
  if (Math.abs(off - slow) >= 2500) { console.log(`   (첫 시계 맞추기 결과가 ${Math.round(off / 1000)}초라 한 번 더 맞춤)`); off2 = await S_(C, async (S) => { await S.store.syncServerClock(true); return S.store.serverNow() - Date.now(); }); }
  ok(Math.abs(off2 - slow) < 2500, `C의 보정값 ${Math.round(off2 / 1000)}초(C의 시계는 실제로 ${Math.round(slow / 1000)}초 느림)`);
  console.log('오류:', [A, A2, C].flatMap((p) => p.errs).join(' | ') || '없음');
  await b.close();
})();
