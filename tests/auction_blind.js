// 익명 경매: 방 만들기에서 🎭 익명 경매 → 매물은 '매물 A·B…'와 힌트(주라인·라인 점수 모양·최근 흐름·챔피언 성향·소통)만,
// 이름·OVR은 진행자·팀장·관전자 누구 화면에도 안 보임(팀 카드·기록·대기 매물·낙찰 배너도 별칭), 끝나면 정체 공개 카드. 일반 경매는 그대로
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  seed.auctions = [];
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const mk = async (n) => { const p = await client(b, be, 'WORK', n); await p.setViewportSize({ width: 1280, height: 900 }); await open(p, 'home', 500); return p; };
  const H = await mk('H');
  await H.evaluate(() => (location.hash = '#/auction')); await H.waitForTimeout(800);
  const ids = await H.evaluate(async () => (await import('/js/core.js')).S.st.list.slice(0, 5).map((s) => s.id));
  for (const id of ids.slice(0, 2)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="2"]`);
  for (const id of ids.slice(2, 5)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="1"]`);
  await H.waitForTimeout(300);
  ok(!!(await H.$('[data-c=auBlind]')), '방 만들기에 🎭 익명 경매 선택');
  await H.check('[data-c=auBlind]'); await H.uncheck('[data-c=auHide]');
  await H.fill('#auS', '20'); await H.selectOption('#auD', '5');
  await H.click('[data-a=auCreate]'); await H.waitForTimeout(1200);
  const rid = await H.evaluate(() => location.hash.split('/')[2]), R = () => be.db.auctions[rid];
  ok(R().cfg.blind === true && Object.keys(R().alias).length === 3 && R().alias[R().pool[0]] === 'A', '방에 익명 설정·별칭(경매 순서대로 매물 A·B·C)');
  const names = await H.evaluate(async (ids) => { const { S } = await import('/js/core.js'); return ids.map((id) => S.st.P[id].name); }, R().pool);
  const leak = (t) => names.filter((n) => new RegExp(n + '(?!\\d)').test(t));
  ok(/익명 경매/.test(await H.$eval('#main', (e) => e.innerText)), '대기실에 익명 경매 안내');
  const [t0, t1] = R().teams.map((t) => t.token);
  const C1 = await mk('C1'), C2 = await mk('C2'), V = await mk('V');
  for (const [p, h] of [[C1, `#/auction/${rid}/${t0}`], [C2, `#/auction/${rid}/${t1}`], [V, `#/auction/${rid}`]]) await p.evaluate((h) => (location.hash = h), h);
  await H.waitForTimeout(1500);
  ok(!leak(await V.$eval('#main', (e) => e.innerText)).length, '대기실: 대기 매물도 별칭으로(이름 안 보임)');
  // 챔피언 역할군(시험에서는 챔피언 목록을 못 받으므로 모두 마법사로 넣어 둠)
  for (const p of [H, C1, C2, V]) await p.evaluate(async () => { const { S } = await import('/js/core.js'); S.champBy = new Proxy({}, { get: () => ({ tags: ['Mage'] }) }); });
  await H.click('[data-a=auStart]'); await H.waitForTimeout(1200); await H.click('[data-a=auNow]'); await H.waitForTimeout(1200);
  const card = await V.$eval('.au-blind', (e) => ({ t: e.innerText.replace(/\s+/g, ' '), shape: e.querySelectorAll('.au-shape span').length }));
  ok(/매물 A/.test(card.t) && card.shape === 5 && /주라인/.test(card.t) && /최근/.test(card.t) && /소통/.test(card.t), '매물 카드: 매물 A + 주라인·라인 점수 모양(5칸)·최근·소통');
  ok(/마법사 위주 100%/.test(card.t), '챔피언 성향: 역할군만(마법사 위주), 챔피언 이름 없음');
  ok(!(await V.$('.au-scout')) && !/OVR \d|MMR/.test(card.t), 'OVR·MMR·모스트·칭호·궁합(스카우팅) 숨김');
  for (const [p, n] of [[H, '진행자'], [C1, '팀장'], [V, '관전자']]) ok(!leak(await p.$eval('#main', (e) => e.innerText)).length, `${n} 화면 어디에도 매물 이름 없음`);
  // 매물 A: C1 입찰 → C2 패스 → 바로 낙찰
  await C1.click('[data-a=auBid]:not([data-v=amt]):not([data-v=all])'); await C1.waitForTimeout(900);
  await C2.click('[data-a=auPass]'); await C2.waitForTimeout(400);
  const ban = await V.waitForSelector('.au-banner', { timeout: 4000 }).then((e) => e.innerText()).catch(() => '');
  ok(/매물 A/.test(ban) && !leak(ban).length, '낙찰 배너도 별칭: ' + ban.replace(/\s+/g, ' '));
  await V.waitForTimeout(900);
  const vt = await V.$eval('#main', (e) => e.innerText);
  ok(/매물 A/.test(await V.$eval('[data-k=team0]', (e) => e.innerText)) && !leak(vt).length, '팀 카드·기록에도 별칭(이름 안 보임)');
  ok(R().log.some((l) => /매물 A → .+ 낙찰/.test(l.s)) && !R().log.some((l) => leak(l.s).length), '저장된 기록 글도 별칭');
  // 나머지 두 매물: 바로 시작 → 둘 다 패스(유찰) … 재경매에서 C2 입찰 → 끝까지
  for (let k = 0; k < 6 && R().status !== 'done'; k++) {
    await H.click('[data-a=auNow]').catch(() => {}); await H.waitForTimeout(900);
    if (R().status === 'done') break;
    const team = R().cur?.team, b2 = k % 2 ? C2 : C1, other = k % 2 ? C1 : C2;
    await b2.click('[data-a=auBid]:not([data-v=amt]):not([data-v=all])').catch(() => {}); await b2.waitForTimeout(800);
    await other.click('[data-a=auPass]').catch(() => {}); await other.waitForTimeout(1200);
  }
  await H.waitForTimeout(1200);
  ok(R().status === 'done', '경매 끝까지 진행: ' + R().status);
  const rv = await V.$eval('.au-reveal', (e) => ({ n: e.querySelectorAll('.au-rvc').length, t: e.innerText })).catch(() => ({ n: 0, t: '' }));
  ok(rv.n === 3 && names.every((n) => rv.t.includes(n)) && /매물 A/.test(rv.t), '끝나면 정체 공개 카드(매물 A·B·C → 이름·팀·가격)');
  ok(names.every((n) => new RegExp(n + '(?!\\d)').test(rv.t)) && !!(await V.$('.au-reveal.anim')), '공개 카드 애니메이션');
  ok(leak(await V.$eval('[data-k=team0]', (e) => e.innerText)).length + leak(await V.$eval('[data-k=team1]', (e) => e.innerText)).length === 3, '끝나면 팀 카드에도 실제 이름');
  const errs = [...H.errs, ...C1.errs, ...C2.errs, ...V.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
