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
  const keys = await V.$$eval('.au-blind .au-hk', (x) => x.map((e) => e.firstChild.textContent.trim()));
  ok(/매물 A/.test(card.t) && card.shape === 5 && /최근/.test(card.t) && /소통/.test(card.t), '매물 카드: 매물 A + 라인 점수(5칸)·최근·소통');
  ok(!keys.includes('주라인') && !keys.includes('챔피언 성향') && !/마법사/.test(card.t) && !(await V.$('.au-shape .main')), '주라인·챔피언 성향은 안 보임(라인 점수 칸의 주라인 강조도 없음): ' + keys.join(','));
  const lt = await V.evaluate(async (pid) => { const { S } = await import('/js/core.js'), s = S.st.P[pid], ss = ['top', 'jg', 'mid', 'adc', 'sup'].map((l) => +s.p.scores?.[l] || 0).sort((a, b) => b - a); return ss[0] - ss[1] >= 4 ? '한 라인 특화' : ss[0] - ss[4] <= 3 ? '올라운더' : ss[1] - ss[2] >= 2 ? '두 라인형' : '여러 라인 가능'; }, R().cur.pid);
  ok(keys.includes('라인 유형') && card.t.includes('라인 유형 ' + lt), '라인 유형: ' + lt);
  const w10 = await V.evaluate(async (pid) => { const { S } = await import('/js/core.js'), r = S.st.P[pid].results.slice(-10), w = (r.filter(Boolean).length / r.length) * 100; return [r.length, w < 45 ? '평균 이하' : w > 55 ? '평균 이상' : '평균']; }, R().cur.pid);
  ok(new RegExp(`최근 ${w10[0]}판 승률\\s*${w10[1]}`).test(card.t), `최근 ${w10[0]}판 승률 등급: ${w10[1]}`);
  // 라인 점수: 게이지 없이 평균 이하·평균·평균 이상(라인별 전체 평균 ±1점 = 평균)
  const lv = await V.evaluate(async (pid) => {
    const { S } = await import('/js/core.js'), st = S.st, L = ['top', 'jg', 'mid', 'adc', 'sup'], s = st.P[pid];
    const want = L.map((l) => { const avg = st.list.reduce((a, x) => a + (+x.p.scores?.[l] || 0), 0) / st.list.length, d = (+s.p.scores?.[l] || 0) - avg; return d < -1 ? '평균 이하' : d > 1 ? '평균 이상' : '평균'; });
    const got = [...document.querySelectorAll('.au-shape span small')].map((e) => e.textContent);
    return { want, got, gauge: document.querySelectorAll('.au-shape u, .au-shape em[style]').length };
  }, R().cur.pid);
  ok(lv.gauge === 0 && JSON.stringify(lv.want) === JSON.stringify(lv.got), '라인 점수: 게이지 없이 평균 이하·평균·평균 이상(평균 ±1점): ' + lv.got.join(','));
  ok(/부라인/.test(card.t) && /주라인 실전 승률/.test(card.t) && /(평균 이하|평균|평균 이상|기록 적음)/.test(card.t), '추가 힌트: 부라인·주라인 실전 승률 등급');
  ok(/플레이 스타일/.test(card.t) && /(킬을 많이 내는 편|어시스트형|잘 안 죽는 편|과감한 편|무난한 편|KDA 기록 적음)/.test(card.t), '추가 힌트: 플레이 스타일(KDA 성향)');
  const sub = await V.evaluate(async (pid) => { const { S } = await import('/js/core.js'), s = S.st.P[pid], L = ['top', 'jg', 'mid', 'adc', 'sup']; return L.filter((l) => l !== s.mainLane).sort((a, b) => (+s.p.scores?.[b] || 0) - (+s.p.scores?.[a] || 0))[0]; }, R().cur.pid);
  const subName = { top: '탑', jg: '정글', mid: '미드', adc: '원딜', sup: '서폿' }[sub];
  ok(new RegExp('부라인\\s*' + subName).test(card.t), '부라인 = 주라인 빼고 점수가 가장 높은 라인(' + subName + ')');
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
  ok(!(await V.$('[data-k=team0] .au-lanes')) && !(await V.$eval('[data-k=team0]', (e) => e.innerHTML)).includes('class="lic') && /자리당/.test(await V.$eval('[data-k=team0]', (e) => e.innerText)), '익명 중 팀 카드: 주라인 아이콘·라인 구성 숨김(자리당 포인트는 그대로)');
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
  ok(rv.n === 3 && names.every((n) => rv.t.includes(n)) && /매물 A/.test(rv.t), '끝나면 전체 선수 공개 카드(매물 A·B·C → 이름·팀·가격)');
  const delays = await V.$$eval('.au-reveal .au-rvc', (x) => [...new Set(x.map((e) => getComputedStyle(e).animationDelay))]);
  ok(/전체 선수 공개/.test(rv.t) && delays.length === 1 && delays[0] === '0s', '모든 매물을 한 번에 공개(차례 없이 동시에): ' + delays.join(','));
  ok(leak(await V.$eval('[data-k=team0]', (e) => e.innerText)).length + leak(await V.$eval('[data-k=team1]', (e) => e.innerText)).length === 3, '끝나면 팀 카드에도 실제 이름');
  const errs = [...H.errs, ...C1.errs, ...C2.errs, ...V.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
