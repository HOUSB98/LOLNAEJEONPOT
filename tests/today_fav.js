// 오늘의 내전: 점수 합이 더 높은 팀(= 예상 승률 높은 팀) 강조. 10명이 다 차고 점수가 다를 때만, 차이가 클수록 진하게
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  // 같은 점수 팀을 만들 수 있게 점수가 모두 10인 선수 10명(q0~q9)을 더한다
  for (let i = 0; i < 10; i++) seed.players.push({ id: 'q' + i, name: '고정' + i, scores: { top: 10, jg: 10, mid: 10, adc: 10, sup: 10 }, mainLane: 'top' });
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'); await A.addInitScript(() => localStorage.setItem('naejeon:lite', '0'));
  await open(A, 'today', 1200);
  const set = (blue, red) => A.evaluate(async ([bl, rd]) => { const { refresh } = await import('/js/core.js'); const { setDraftTeams } = await import('/js/today.js'); setDraftTeams(bl, rd); refresh(); }, [blue, red]).then(() => A.waitForTimeout(500));
  const st = () => A.evaluate(() => ({ fav: [...document.querySelectorAll('.sb.fav')].map((e) => e.classList.contains('blue') ? 'blue' : 'red'), ring: !!document.querySelector('.sb-ring'), glow: !!document.querySelector('.wr-glow'), sp: document.querySelectorAll('.wr-sp').length, wi: +getComputedStyle(document.querySelector('.scorebar')).getPropertyValue('--wi') }));
  await set(['q0', 'q1', 'q2', 'q3'], ['q5', 'q6', 'q7', 'q8', 'q9']);
  let s = await st(); ok(!s.fav.length && !s.glow, '9명만 배치: 강조 없음');
  await set(['q0', 'q1', 'q2', 'q3', 'q4'], ['q5', 'q6', 'q7', 'q8', 'q9']);
  s = await st(); ok(!s.fav.length && !s.glow && !s.sp, '10명·점수 같음(완전 팽팽): 강조 없음');
  const ids = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const L = ['top', 'jg', 'mid', 'adc', 'sup']; return L.map((l) => Object.values(S.st.P).filter((p) => !p.id.startsWith('q')).sort((a, c) => (c.p.scores[l] || 0) - (a.p.scores[l] || 0))); });
  const used = new Set(), hi = [], lo = [];
  ids.forEach((arr) => { const a = arr.filter((x) => !used.has(x.id)); hi.push(a[0].id); lo.push(a[a.length - 1].id); used.add(a[0].id); used.add(a[a.length - 1].id); });
  await set(lo, hi);
  s = await st(); ok(s.fav.join() === 'red' && s.ring && s.glow && s.sp === 3, '레드가 점수 높음: 레드 점수판 강조(테두리 빛·호 빛·별빛)');
  const big = s.wi;
  await set(['q0', 'q1', 'q2', 'q3', hi[4]], ['q5', 'q6', 'q7', 'q8', 'q9']);
  s = await st(); ok(s.fav.join() === 'blue' && s.wi < big, `차이가 작으면 더 은은하게(--wi ${s.wi} < ${big})`);
  await A.evaluate(() => document.body.classList.add('lite'));
  ok(await A.evaluate(() => getComputedStyle(document.querySelector('.sb-ring')).display === 'none' && getComputedStyle(document.querySelector('.wr-sp')).display === 'none'), '가벼운 모드: 움직이는 빛·별빛 숨김');
  console.log('오류:', A.errs.join(' | ') || '없음'); ok(!A.errs.length, '페이지 오류 없음');
  await b.close();
})();
