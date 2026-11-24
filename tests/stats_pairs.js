// 통계 계산 최적화 확인: 듀오·상대 칭호(의형제·흡성대법·숙적있음)를 선수별 묶음으로 빠르게 찾게 바꾼 뒤에도,
// 예전 방식(기록 전체를 훑기)과 결과가 똑같은지. 시험 데이터 + 경기를 늘린 변형으로 칭호가 실제로 걸리게 한다.
const { chromium } = require('playwright'); const { makeSeed } = require('./harness'); const path = require('path'); const { pathToFileURL } = require('url');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b); await b.close();
  const { compute } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'stats.js')).href);
  // 예전 방식 그대로(기준)
  const naive = (s, map, self, min, okf) => Object.entries(map).some(([k, v]) => {
    if (v.g < min) return false;
    if (self) { if (!k.startsWith(s.id + '>')) return false; } else if (!k.split('|').includes(s.id)) return false;
    return okf((v.w / v.g) * 100);
  });
  const REF = { 의형제: (s, c) => naive(s, c.together, false, 10, (w) => w >= 75), 흡성대법: (s, c) => naive(s, c.versus, true, 10, (w) => w >= 75), 숙적있음: (s, c) => naive(s, c.versus, true, 10, (w) => w <= 25) };
  const cfg = (seed.meta.find((m) => m.id === 'settings') || {});
  const sets = [['시험 데이터', seed.matches], ...[2, 4].map((k) => [`경기 ×${k}`, Array.from({ length: k }, (_, j) => seed.matches.map((m) => ({ ...m, id: m.id + '_' + j, at: m.at + j * 864e5 * 60 }))).flat()])];
  for (const [nm, ms] of sets) {
    const st = compute(seed.players, ms, cfg); let diff = 0, hits = 0;
    for (const s of st.list) for (const [t, f] of Object.entries(REF)) { const want = f(s, st), got = s.titles.some((x) => x.n === t); if (want) hits++; if (want !== got) diff++; }
    ok(diff === 0 && hits > 0, `${nm}: 예전 방식과 같음 (칭호 ${hits}건 걸림, 다른 곳 ${diff})`);
  }
  // 같은 선수 목록으로 다시 계산해도 이전 결과의 묶음을 잘못 재사용하지 않음(계산마다 새 기록)
  const a = compute(seed.players, seed.matches, cfg), c2 = compute(seed.players, seed.matches.slice(0, 40), cfg);
  const t = (st) => st.list.map((s) => s.titles.filter((x) => REF[x.n]).map((x) => x.n).join('+')).join('|');
  const want2 = c2.list.map((s) => Object.keys(REF).filter((k) => REF[k](s, c2)).join('+')).join('|');
  ok(t(c2) === want2, '경기 수가 바뀐 다시 계산도 정확(묶음 재사용 없음)');
})();
