// 시즌제 점검: 3개월(문파 분기와 같은 기간, 새벽 6시 기준) · 2026년 4분기 = 시즌 0(프리시즌) · 시즌 경계 · MMR은 시즌이 바뀌어도 이어짐(통산과 같은 값)
// · 시즌 순위(최다 출전의 2/3 이상 중 승률 → 판수 → MMR) · 랭킹 기본 = 이번 시즌(기준 문구) ↔ 통산(OVR 순) · 홈 시즌 띠(남은 날 / 종료 n일 전 / 지난 시즌 1위)
// · 새 시즌 첫날(빈 시즌) · 끝난 시즌 1~3위 배지 · 선수 상세 시즌 기록 · 휴대폰 가로 넘침 없음
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const errs = [];
  const go = async (name, when, vp = { width: 1440, height: 900 }) => {
    const ctx = await device(b, be, 'WORK', name, { viewport: vp, ...(vp.width < 900 ? { isMobile: true, hasTouch: true } : {}) });
    const p = await client(b, be, 'WORK', name, { ctx, clock: { time: new Date(when) } });
    await p.addInitScript(() => { localStorage.setItem('naejeon:pop:guild-open2', '1'); localStorage.setItem('naejeon:xmas', '0'); });
    await open(p, 'home', 0); await p.clock.runFor(2500); await p.evaluate(() => document.querySelector('#modal.on [data-a=nppClose]')?.click());
    return p;
  };
  // 1) 기간 계산(시계와 상관없는 순수 계산)
  const A = await go('A', '2026-11-27T20:00:00');
  const k = await A.evaluate(async () => {
    const s = await import('/js/stats.js'), t = (x) => new Date(x).getTime();
    return { cur: s.szCur(), name: s.szName('2026Q4'), s1: s.szName('2027Q1'), sh: s.szShort('2027Q2'), list: s.szList(t('2027-04-02T12:00:00')),
      edge: [s.szKey(t('2027-01-01T05:59:00')), s.szKey(t('2027-01-01T06:00:00'))], range: s.szRange('2026Q4').map((x) => new Date(x).toString().slice(4, 21)), months: s.szMonths('2027Q1') };
  });
  ok(k.cur === '2026Q4' && k.name === '시즌 0 · 프리시즌' && k.s1 === '시즌 1' && k.sh === 'S2', '2026년 4분기 = 시즌 0(프리시즌), 다음은 시즌 1·2…: ' + JSON.stringify([k.cur, k.name, k.s1, k.sh]));
  ok(JSON.stringify(k.list) === '["2027Q2","2027Q1","2026Q4"]', '시즌 목록은 시즌 0부터 지금 시즌까지(최신 먼저): ' + k.list);
  ok(k.edge[0] === '2026Q4' && k.edge[1] === '2027Q1', '1/1 새벽 6시 전 경기는 지난 시즌(내전 날짜 기준과 같음): ' + k.edge);
  ok(/Oct 01 2026 06:00/.test(k.range[0]) && /Jan 01 2027 06:00/.test(k.range[1]) && k.months === '2027년 1~3월', '시즌 0 기간 10/1 06:00 ~ 1/1 06:00: ' + k.range.join(' ~ '));
  // 2) 시즌 통계: MMR 이어짐 · 순위 규칙
  const r = await A.evaluate(async () => {
    const { S, szStats } = await import('/js/core.js'); const ss = szStats('2026Q4');
    const [a, bb] = [ss.a, ss.b], inSz = S.st.matches.filter((m) => m.at >= a && m.at < bb).length;
    const mmrSame = ss.st.list.every((s) => Math.abs(s.mmr - S.st.P[s.id].mmr) < 1e-9);
    const gSame = ss.st.list.every((s) => s.g === S.st.matches.filter((m) => m.at >= a && m.at < bb && (m.blue.includes(s.id) || m.red.includes(s.id))).length);
    const need = Math.ceil(ss.max * 2 / 3), elig = ss.st.list.filter((s) => s.g >= need && s.g > 0);
    const sorted = ss.ranked.every((s, i, x) => i === 0 || x[i - 1].w / x[i - 1].g > s.w / s.g || (x[i - 1].w / x[i - 1].g === s.w / s.g && (x[i - 1].g > s.g || (x[i - 1].g === s.g && x[i - 1].mmr >= s.mmr))));
    return { n: ss.n, inSz, mmrSame, gSame, need: ss.need === need, elig: elig.length === ss.ranked.length, sorted, srk: ss.ranked.every((s, i) => s.srk === i + 1) && ss.st.list.filter((s) => !s.srk).every((s) => s.g < need) };
  });
  ok(r.n === r.inSz && r.gSame, `시즌 0 경기만 집계(${r.n}경기, 선수별 판수 일치)`);
  ok(r.mmrSame, 'MMR은 시즌이 바뀌어도 이어짐: 시즌 MMR = 통산 MMR');
  ok(r.need && r.elig && r.sorted && r.srk, '시즌 순위: 최다 출전 2/3(올림) 이상만, 승률 → 판수 → MMR 순, 미달은 순위 없음');
  // 3) 랭킹 화면: 기본 이번 시즌 + 기준 문구, 통산으로 바꾸면 OVR 순
  await open(A, 'rank', 0); await A.clock.runFor(1200);
  const rk = await A.evaluate(() => ({ tag: document.querySelector('.h2row .tag.gold')?.innerText, on: document.querySelector('.sz-seg button.on')?.innerText.replace(/\s+/g, ' '), rule: document.querySelector('.sz-rule')?.innerText, first: document.querySelector('.tbl.lb tbody tr .rkb')?.innerText, unr: document.querySelectorAll('.tbl.lb tbody tr.unr').length }));
  const want = await A.evaluate(async () => { const { szStats } = await import('/js/core.js'); const ss = szStats('2026Q4'); return { top: ss.ranked[0].name, need: ss.need, max: ss.max, unr: ss.st.list.filter((s) => s.g > 0 && !s.srk).length }; });
  ok(rk.tag === 'SEASON 0' && /S0/.test(rk.on) && /진행 중/.test(rk.on), '랭킹 기본은 이번 시즌(S0 진행 중)');
  ok(rk.rule.includes(`최다 출전 ${want.max}판의 2/3인 ${want.need}판 이상`) && rk.rule.includes('승률 순'), '순위 기준 문구(작게): ' + rk.rule);
  ok(rk.first === '1' && rk.unr === want.unr && (await A.$eval('.spot.s1 b', (e) => e.innerText)) === want.top, `시즌 1위가 맨 위·TOP 카드, 기준 미달 ${want.unr}명은 순위 없이 아래`);
  await A.click('.sz-seg button[data-v=all]'); await A.clock.runFor(600);
  const all = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const ovr = [...document.querySelectorAll('.tbl.lb tbody tr')].map((t) => +t.querySelector('.ovr')?.innerText); return { tag: document.querySelector('.h2row .tag.gold').innerText, sorted: ovr.every((v, i) => i === 0 || ovr[i - 1] >= v), n: ovr.length, total: S.st.list.filter((s) => s.g >= 1).length }; });
  ok(all.tag === 'ALL-TIME' && all.sorted && all.n === all.total, '통산으로 바꾸면 예전처럼 OVR 순(전체 기간)');
  await A.click('[data-a=lbView][data-v=score]'); await A.clock.runFor(500);
  ok(!(await A.$('.sz-bar')), '라인 점수 탭은 시즌과 상관없어 시즌 고르기 없음');
  // 4) 홈 시즌 띠
  await open(A, 'home', 0); await A.clock.runFor(1200);
  const h1 = await A.$eval('.sz-home', (e) => e.innerText.replace(/\s+/g, ' '));
  ok(/시즌 0 · 프리시즌/.test(h1) && /남은 35일/.test(h1) && new RegExp(`현재 1위 ${want.top}`).test(h1), '홈: 시즌 이름 · 남은 날 · 현재 1위: ' + h1);
  await A.click('.sz-home'); await A.clock.runFor(800);
  ok((await A.evaluate(() => location.hash)) === '#/rank' && /S0/.test(await A.$eval('.sz-seg button.on', (e) => e.innerText)), '홈 띠를 누르면 이번 시즌 순위로');
  errs.push(...A.errs);
  const E = await go('E', '2026-12-28T20:00:00');
  ok(/종료 4일 전/.test(await E.$eval('.sz-home', (e) => e.innerText)) && !!(await E.$('.sz-home.end')), '시즌 마지막 주: 홈 띠에 "종료 n일 전" 강조');
  errs.push(...E.errs);
  // 5) 새 시즌(1월): 빈 시즌 · 지난 시즌 1위 알림 · 배지
  const J = await go('J', '2027-01-03T20:00:00', { width: 390, height: 844 });
  const hj = await J.$eval('.sz-home', (e) => e.innerText.replace(/\s+/g, ' '));
  ok(/시즌 1/.test(hj) && new RegExp(`지난 시즌 1위 ${want.top}`).test(hj), '새 시즌 첫 주: 홈 띠에 지난 시즌 1위(휴대폰에서도 보임): ' + hj);
  await open(J, 'rank', 0); await J.clock.runFor(1200);
  const rj = await J.evaluate(() => ({ seg: [...document.querySelectorAll('.sz-seg button')].map((e) => e.innerText.replace(/\s+/g, ' ')), empty: document.querySelector('.tbl.lb .empty')?.innerText, w: document.documentElement.scrollWidth - innerWidth }));
  ok(rj.seg.length === 3 && /S1/.test(rj.seg[0]) && /진행 중/.test(rj.seg[0]) && rj.seg[1] === 'S0' && rj.seg[2] === '통산' && /아직 없어요/.test(rj.empty || ''), '새 시즌 첫날: S1(진행 중)·S0·통산, 빈 시즌 안내: ' + JSON.stringify(rj.seg));
  await J.click('.sz-seg button[data-v="2026Q4"]'); await J.clock.runFor(600);
  ok(/종료/.test(await J.$eval('.sz-info', (e) => e.innerText)) && /시즌 1위/.test(await J.$eval('.sz-rec', (e) => e.innerText)), '지난 시즌(S0) 보기: 종료 · 시즌 1위 기록');
  const top = await J.evaluate(async () => { const { szStats } = await import('/js/core.js'); return szStats('2026Q4').ranked.slice(0, 4).map((s) => s.id); });
  await open(J, 'players/' + top[0], 0); await J.clock.runFor(1500);
  const pd = await J.evaluate(() => ({ b: [...document.querySelectorAll('.chip.szb')].map((e) => e.innerText), sz: document.querySelector('.szp')?.innerText.replace(/\s+/g, ' '), w: document.documentElement.scrollWidth - innerWidth }));
  ok(pd.b.length === 1 && /🥇 S0 1위/.test(pd.b[0]) && /S0 \d+판 \d+승 \d+패/.test(pd.sz) && /시즌 1위/.test(pd.sz), '끝난 시즌 1위: 선수 상세에 🥇 S0 1위 배지 + 시즌 기록: ' + pd.b.join(','));
  await open(J, 'players/' + top[3], 0); await J.clock.runFor(1200);
  ok(!(await J.$('.chip.szb')), '4위 이하는 배지 없음');
  ok(rj.w <= 0 && pd.w <= 0, '휴대폰 랭킹·선수 상세 가로 넘침 없음');
  errs.push(...J.errs);
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
