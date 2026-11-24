// 라인 지원 보완: 연 사람이 진행 중 참가자 추가·제외(빠진 사람 지망 삭제, 남은 사람이 모두 완료면 바로 추첨),
// 다른 기기에서 이미 지원 중인 이름을 누르면 확인, 남은 사람 부르기(공용 채팅·30초 제한)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'), B = await client(b, be, 'WORK', 'B');
  await open(A, 'today', 1000); await open(B, 'today', 1000);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500); await A.click('#modal.on [data-a=bdOpen]'); await A.waitForTimeout(1200);
  const D = () => be.db.meta.board;
  ok(D()?.status === 'open' && D().ids.length === 10, '라인 지원 열림(10명)');
  const ids = D().ids, outsider = (await A.evaluate(async () => (await import('/js/core.js')).S.st.list.map((s) => s.id))).find((id) => !ids.includes(id));
  // B: 첫 사람 이름으로 탑 지원
  await B.waitForSelector('#modal.on .lp', { timeout: 8000 });
  await B.click(`#modal.on [data-a=bdMe][data-id="${ids[0]}"]`); await B.waitForTimeout(300);
  await B.click('#modal.on [data-a=bdPick][data-o="top"]'); await B.waitForTimeout(800);
  ok(D().picks?.[ids[0]]?.[0] === 'top' && !!D().who?.[ids[0]], 'B가 지원하면 어느 기기가 고르는지 기록');
  // A가 같은 이름을 누르면 확인 → 취소하면 그대로
  let asked = '';
  A.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await A.click(`#modal.on [data-a=bdMe][data-id="${ids[0]}"]`); await A.waitForTimeout(400);
  ok(/다른 기기에서 이미 지원 중/.test(asked), '다른 기기에서 지원 중인 이름 → 확인 창');
  ok(!(await A.$(`#modal.on .lp-mem.me[data-id="${ids[0]}"]`)), '취소하면 그 이름으로 바뀌지 않음');
  // A 자기 이름(아무도 안 고른 이름)은 확인 없이
  asked = ''; A.once('dialog', (d) => { asked = d.message(); d.accept(); });
  await A.click(`#modal.on [data-a=bdMe][data-id="${ids[1]}"]`); await A.waitForTimeout(400);
  const nm1 = await A.evaluate(async (id) => (await import('/js/core.js')).S.st.P[id].name, ids[1]);
  ok(!asked && new RegExp(nm1 + '\\s*\\(으\\)로 지원 중').test(await A.$eval('#modal.on .lp', (e) => e.innerText)), '아무도 안 고른 이름은 확인 없이 선택');
  A.removeAllListeners('dialog');
  // 참가자 편집: 추가
  await A.click('#modal.on [data-a=bdEditOpen]'); await A.waitForTimeout(300);
  ok(!!(await A.$('#modal.on .lp-edit')), '연 사람에게 참가자 편집');
  ok(!(await B.$('#modal.on [data-a=bdEditOpen]')), '다른 사람에게는 편집 버튼 없음');
  await A.click(`#modal.on .lp-edit [data-a=bdEdit][data-id="${outsider}"]`); await A.waitForTimeout(900);
  ok(D().ids.length === 11 && D().ids.includes(outsider), '진행 중 참가자 추가(11명)');
  ok(/\/\s*11/.test(await B.$eval('#modal.on .lp-count', (e) => e.innerText)), 'B 화면에도 바로 반영(완료 0 / 11)');
  // 제외: 지망 고른 사람 → 확인 후 지망까지 삭제
  A.once('dialog', (d) => d.accept());
  await A.click(`#modal.on .lp-edit [data-a=bdEdit][data-id="${ids[0]}"]`); await A.waitForTimeout(900);
  ok(!D().ids.includes(ids[0]) && !D().picks?.[ids[0]] && !D().who?.[ids[0]], '제외하면 그 사람 지망·기록도 삭제');
  // 남은 사람 부르기
  const chat0 = Object.keys(be.db.chat || {}).length;
  await A.click('#modal.on [data-a=bdNudge]').catch(() => {}); await A.waitForTimeout(800);
  const msgs = Object.values(be.db.chat || {}).filter((m) => /선택을 기다리고/.test(m.t || ''));
  ok(msgs.length === 1 && Object.keys(be.db.chat || {}).length === chat0 + 1, '남은 사람 부르기 → 공용 채팅 1건: ' + (msgs[0]?.t || '').slice(0, 50));
  await A.click('#modal.on [data-a=bdNudge]').catch(() => {}); await A.waitForTimeout(500);
  ok(Object.values(be.db.chat || {}).filter((m) => /선택을 기다리고/.test(m.t || '')).length === 1, '30초 안에 다시 누르면 보내지 않음');
  // 한 명 빼고 모두 완료 → 그 한 명을 빼면 바로 추첨
  const last = D().ids[D().ids.length - 1];
  await A.evaluate(async (last) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (r) => { const picks = { ...r.picks }, done = {}; r.ids.forEach((id) => { if (id !== last) { picks[id] = picks[id] || ['any']; done[id] = true; } }); return { ...r, picks, done }; }); }, last);
  await A.waitForTimeout(800);
  A.once('dialog', (d) => d.accept());
  await A.click(`#modal.on .lp-edit [data-a=bdEdit][data-id="${last}"]`); await A.waitForTimeout(1500);
  ok(D().status === 'play' && D().result && !D().ids.includes(last), '남은 한 명을 빼서 모두 완료 → 바로 추첨');
  const placed = Object.values(D().result).flat();
  ok(placed.length === D().ids.length && new Set(placed).size === placed.length, `추첨 결과 ${placed.length}명 모두 배치(중복 없음)`);
  console.log('오류:', [...A.errs, ...B.errs].join(' | ') || '없음'); ok(!A.errs.length && !B.errs.length, '페이지 오류 없음');
  await b.close();
})();
