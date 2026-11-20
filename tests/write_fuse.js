// 쓰기 안전장치 + 채팅 도배 막기 시험(가짜 Firestore)
const { chromium } = require('playwright'); const { makeSeed, device, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const S_ = (p, f, a) => p.evaluate(async ([f, a]) => { const { S } = await import('/js/core.js'); return new Function('S', 'a', 'return (' + f + ')(S, a)')(S, a); }, [f.toString(), a]);
const SHOT = process.env.SHOT;
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', '기기A', { clock: true }); await open(A);
  const B = await client(b, be, 'WORK', '기기B', { clock: true }); await open(B);
  const wcol = (c) => be.log.filter((l) => l.op === 'write' && l.col === c).length;

  // 1) 평소 속도(사람이 누르는 정도): 1분 동안 90번 저장해도 멈추지 않음, 1분 지나면 다시 셈
  let r = await S_(A, async (S) => { let bad = 0; for (let i = 0; i < 90; i++) await S.store.patch('history', 'h_norm', { n: i }).catch(() => bad++); return bad; });
  ok(r === 0 && !(await A.$('#fuse')), `1분 안에 저장 90번: 실패 ${r}번, 알림 ${(await A.$('#fuse')) ? '뜸' : '없음'}`);
  await A.clock.fastForward(61e3);
  r = await S_(A, async (S) => { let bad = 0; for (let i = 0; i < 90; i++) await S.store.patch('history', 'h_norm', { n: i }).catch(() => bad++); return bad; });
  ok(r === 0 && !(await A.$('#fuse')), `1분 뒤 다시 90번: 실패 ${r}번(지난 1분 기록은 지워짐)`);
  await A.clock.fastForward(61e3);

  // 2) bulk(관리자 복원 등): 150번 써도 세지 않음
  const w0 = wcol('history');
  r = await S_(A, async (S) => { let bad = 0; await S.store.bulk(async () => { for (let i = 0; i < 150; i++) await S.store.put('history', 'hb' + i, { i }).catch(() => bad++); }); return bad; });
  ok(r === 0 && wcol('history') - w0 === 150 && !(await A.$('#fuse')), `bulk 안에서 150번: 실패 ${r} · 서버 저장 ${wcol('history') - w0}`);

  // 2-1) 아무것도 안 쓰고 끝나는 거래(경매 타이머 정산 확인) 150번: 세지 않음
  r = await S_(A, async (S) => { let bad = 0; for (let i = 0; i < 150; i++) await S.store.tx('meta', 'luck', () => null).catch(() => bad++); return bad; });
  ok(r === 0 && !(await A.$('#fuse')), `저장 없이 끝나는 거래 150번: 실패 ${r}번, 알림 없음`);
  await A.clock.fastForward(61e3);
  // 3) 고장 난 반복 저장(put·tx 섞어서): 101번째부터 막힘, 서버에는 100번만, 알림 표시
  const w1 = wcol('history');
  r = await S_(A, async (S) => { const out = []; for (let i = 0; i < 300; i++) { try { if (i % 2) await S.store.tx('history', 'h_loop', (x) => ({ ...(x || {}), n: i })); else await S.store.patch('history', 'h_loop', { n: i }); out.push(1); } catch (e) { out.push(e.message); } } return { okN: out.filter((x) => x === 1).length, msg: out.find((x) => x !== 1) }; });
  await A.waitForTimeout(300);
  ok(r.okN === 100 && wcol('history') - w1 === 100, `반복 저장 300번 시도: 성공 ${r.okN}번 · 서버 저장 ${wcol('history') - w1}번`);
  ok(/잠시 멈췄어요/.test(r.msg || ''), '막힌 저장의 오류 문구: ' + r.msg);
  const fuseTxt = await A.evaluate(() => document.getElementById('fuse')?.innerText.replace(/\s+/g, ' '));
  ok(/저장을 잠시 멈췄어요/.test(fuseTxt || '') && /새로고침/.test(fuseTxt), '알림: ' + fuseTxt);
  // 그 뒤 모든 저장(tx·접속 신호·채팅)도 서버로 안 감
  const w2 = be.log.filter((l) => l.op === 'write').length;
  await A.clock.fastForward(5 * 60e3);
  r = await S_(A, async (S) => { const e = []; await S.store.tx('meta', 'luck', (x) => x).catch((x) => e.push('tx')); await S.store.put('presence', 'zz', { at: 1 }).catch(() => e.push('put')); return e.join(','); });
  await A.evaluate(async () => { const { sendLobbyChat } = await import('/js/social.js'); sendLobbyChat('멈춘 뒤 채팅'); });
  await A.waitForTimeout(1500);
  ok(be.log.filter((l) => l.op === 'write').length === w2 && r === 'tx,put', `멈춘 뒤 5분: 서버 저장 ${be.log.filter((l) => l.op === 'write').length - w2}번 (tx·put 모두 거절: ${r})`);
  // 읽기(실시간 반영)는 계속: B의 채팅이 A에 보임
  await B.evaluate(async () => { const { sendLobbyChat } = await import('/js/social.js'); sendLobbyChat('B가 보낸 말'); });
  const seenB = await A.waitForFunction(async () => Object.values((await import('/js/core.js')).S.store.data.chat).some((m) => m.t === 'B가 보낸 말'), null, { timeout: 4000 }).then(() => true).catch(() => false);
  ok(seenB, '멈춘 뒤에도 다른 사람 채팅은 실시간으로 보임');
  ok(!(await B.$('#fuse')), '다른 기기(B)는 영향 없음');
  if (SHOT) { await A.screenshot({ path: SHOT + '/fuse_pc.png' }); }
  // 새로고침 버튼 → 정상
  await Promise.all([A.waitForNavigation(), A.evaluate(() => document.querySelector('[data-a=fuseReload]').click())]);
  await A.waitForFunction(() => window.NP_OK && (document.getElementById('main').innerText || '').length > 80, null, { timeout: 15000 });
  await A.waitForTimeout(1500);
  r = await S_(A, async (S) => { try { await S.store.patch('history', 'h_after', { n: 1 }); return 'ok'; } catch (e) { return e.message; } });
  ok(r === 'ok' && !(await A.$('#fuse')), '새로고침 뒤 저장 정상: ' + r);

  // 4) 채팅 도배 막기
  const C = await client(b, be, 'WORK', '기기C', { clock: true }); await open(C);
  const sent = () => Object.values(be.db.chat).filter((m) => /^도배/.test(m.t)).length;
  const toastTxt = () => C.evaluate(() => document.getElementById('toast')?.innerText);
  await C.evaluate(() => document.getElementById('chat-closed') || null);
  const form = async (t) => C.evaluate((t) => { const i = document.getElementById('chatinp'); i.value = t; document.getElementById('chatform').requestSubmit(); return i.value; }, t);
  const left = [];
  for (let i = 1; i <= 5; i++) left.push(await form('도배' + i));
  await C.waitForTimeout(1500);
  const tt = await toastTxt();
  ok(sent() === 3, `연속 5번 전송: 보내짐 ${sent()}개`);
  ok(left.slice(0, 3).every((v) => v === '') && left[3] === '도배4' && left[4] === '도배5', `막힌 글은 입력칸에 그대로: ${JSON.stringify(left)}`);
  ok(/채팅이 너무 빨라요\. \d초 뒤에/.test(tt || ''), '안내: ' + tt);
  await C.clock.fastForward(3100);
  await form('도배6'); await C.waitForTimeout(1200);
  ok(sent() === 4, `3초 뒤 다시 보내기: 보내짐 ${sent()}개`);
  // 1분에 20개: 1.1초 간격으로 계속 → 20번째까지 되고 21번째는 막힘
  for (let i = 7; i <= 30; i++) { await C.clock.fastForward(1100); await form('도배' + i); }
  await C.waitForTimeout(1500);
  ok(sent() === 20, `1.1초 간격으로 계속 보내기: 1분 안에 ${sent()}개까지`);
  // 스티커·주사위도 같이 셈
  await C.clock.fastForward(61e3);
  const n0 = Object.values(be.db.chat).length;
  await C.evaluate(async () => { for (let i = 0; i < 5; i++) document.querySelector('[data-a=chatRoll]').click(); });
  await C.waitForTimeout(1500);
  ok(Object.values(be.db.chat).length - n0 === 3, `주사위 버튼 5번 연타: ${Object.values(be.db.chat).length - n0}개`);
  // 자동 알림(sysChat)은 제한 없음
  await C.clock.fastForward(61e3);
  const s0 = Object.values(be.db.chat).filter((m) => m.k === 'sys').length;
  await C.evaluate(async () => { const { sysChat } = await import('/js/social.js'); for (let i = 0; i < 6; i++) sysChat('알림' + i); });
  await C.waitForTimeout(1500);
  ok(Object.values(be.db.chat).filter((m) => m.k === 'sys').length - s0 === 6, '자동 알림 6개는 모두 보내짐');
  // 화면에 보이는 채팅 순서
  console.log('오류:', [A, B, C].flatMap((p) => p.errs).join(' | ') || '없음');
  await b.close();
})();
