// 예측 보정(관리 > 설정): 가상 경기(정답 스케일을 아는 데이터)로 추천 스케일이 정답을 찾는지, 적중률은 스케일과 무관한지,
// 30판 미만이면 추천하지 않는지, 관리 화면 표·추천 적용(확인 창 → settings.scale 저장), 휴대폰 가로 넘침. 홈 명예의 전당 점 버튼 누르는 칸(24px 이상)
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const path = require('path'), url = require('url');
(async () => {
  const { compute, calibrate, winProb } = await import(url.pathToFileURL(path.join(__dirname, '../js/stats.js')).href);
  const L = ['top', 'jg', 'mid', 'adc', 'sup'];
  let z = 11; const rnd = () => (z = (z * 16807) % 2147483647) / 2147483647;
  const players = Array.from({ length: 20 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, scores: Object.fromEntries(L.map((l) => [l, Math.round(rnd() * 20)])) }));
  const sim = (TRUE, n) => Array.from({ length: n }, (_, k) => {
    const ids = players.map((p) => p.id).sort(() => rnd() - 0.5), blue = ids.slice(0, 5), red = ids.slice(5, 10);
    const sc = (a) => a.reduce((s, id, i) => s + players.find((p) => p.id === id).scores[L[i]], 0);
    return { id: 'm' + k, at: 1.7e12 + k * 1e6, blue, red, winner: rnd() < winProb(sc(blue) - sc(red), TRUE) ? 'blue' : 'red' };
  });
  for (const T of [12, 40]) {
    const c = calibrate(compute(players, sim(T, 3000), { scale: 23.5 }));
    ok(Math.abs(c.best - T) <= 1.5 && c.rec.loss <= c.cur.loss, `정답 스케일 ${T} → 추천 ${c.best}(로그 손실 ${c.cur.loss.toFixed(3)} → ${c.rec.loss.toFixed(3)})`);
    const fit = c.rec.bins.filter((x) => x.n >= 100).every((x) => Math.abs(x.real - x.pred) < 0.06);
    ok(fit, `추천 스케일의 구간별 실제 승률이 예상과 맞음(±6%p): ` + JSON.stringify(c.rec.bins.map((x) => [x.n, x.pred && +x.pred.toFixed(2), x.real && +x.real.toFixed(2)])));
  }
  const ms = sim(20, 400), a = calibrate(compute(players, ms, { scale: 23.5 }), 10), b2 = calibrate(compute(players, ms, { scale: 50 }), 50);
  ok(a.hitScore.pct === b2.hitScore.pct && a.best === b2.best, `적중률·추천값은 지금 스케일과 무관(${a.hitScore.pct}% · 추천 ${a.best})`);
  ok(calibrate(compute(players, sim(20, 20), { scale: 23.5 })).n < 30, '20판이면 표본 부족(30판 미만)');

  // 관리 화면: 시드 경기의 기록 당시 점수 차를 정답 스케일 12로 다시 만든 데이터
  const b = await chromium.launch(); const seed = await makeSeed(b);
  let q = 3; const r = () => (q = (q * 16807) % 2147483647) / 2147483647;
  seed.matches.forEach((m) => { const bs = 40 + Math.round(r() * 20), rs = 40 + Math.round(r() * 20); m.snap = { bs, rs, pBlue: winProb(bs - rs, 23.5) }; m.winner = r() < winProb(bs - rs, 12) ? 'blue' : 'red'; });
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A');
  await open(A, 'admin', 900); await A.evaluate(async () => { const { S } = await import('/js/core.js'); S.admin = true; document.querySelector('[data-a=admTab][data-t=config]')?.click(); }); await A.waitForTimeout(600);
  const v = await A.evaluate(() => { const p = document.querySelector('.panel.cal'); return p && { k: [...p.querySelectorAll('.cal-k b')].map((e) => e.innerText), msg: p.querySelector('.cal-msg').innerText, rows: p.querySelectorAll('.cal-t tbody tr').length, btn: p.querySelector('[data-a=calApply]')?.dataset.v }; });
  ok(v && /추천 스케일 \d/.test(v.msg) && v.rows === 10 && +v.btn >= 9 && +v.btn <= 16, '관리 > 설정 예측 보정: 적중률 3칸 · 지금/추천 표 · 추천값(정답 12 근처) 적용 버튼: ' + JSON.stringify(v));
  A.once('dialog', (d) => d.dismiss()); await A.click('[data-a=calApply]'); await A.waitForTimeout(500);
  ok(!be.db.meta.settings?.scale, '확인 창에서 취소하면 저장 안 함');
  A.once('dialog', (d) => d.accept()); await A.click('[data-a=calApply]'); await A.waitForTimeout(800);
  ok(+be.db.meta.settings?.scale === +v.btn, `확인하면 스케일 ${v.btn} 저장`);
  await A.waitForTimeout(400);
  ok(await A.evaluate(() => /지금 스케일 <b class="mono">[\d.]+<\/b>이 실제 결과와 잘 맞아요|잘 맞아요/.test(document.querySelector('.cal-msg')?.innerHTML || '')), '적용 뒤에는 "지금 스케일이 잘 맞아요"(같은 추천을 또 하지 않음)');
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  await open(M, 'admin', 900); await M.evaluate(() => document.querySelector('[data-a=admTab][data-t=config]')?.click()); await M.waitForTimeout(500);
  ok(await M.evaluate(() => !!document.querySelector('.panel.cal') && document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 관리 화면 예측 보정: 가로 넘침 없음');
  // 홈 명예의 전당 점 버튼: 휴대폰에서 누르는 칸 24px 이상, 이웃 칸과 겹치지 않음, 눌러서 넘어감
  await open(M, 'home', 900);
  const dt = await M.evaluate(() => { const d = [...document.querySelectorAll('.car-dots i')]; const r = d.map((e) => { const a = e.getBoundingClientRect(), s = getComputedStyle(e, '::before'); return { l: a.left + parseFloat(s.left), r: a.right - parseFloat(s.right), h: a.height - parseFloat(s.top) - parseFloat(s.bottom) }; }); return { n: d.length, w: Math.min(...r.map((x) => x.r - x.l)), h: Math.min(...r.map((x) => x.h)), gap: Math.min(...r.slice(1).map((x, i) => x.l - r[i].r)), vis: d[1].getBoundingClientRect().width }; });
  ok(dt.n > 1 && dt.w >= 24 && dt.h >= 30 && dt.gap >= -0.5 && dt.vis === 6, '점 버튼 누르는 칸 24px 이상·겹침 없음(보이는 점은 그대로 6px): ' + JSON.stringify(dt));
  await M.evaluate(() => document.querySelector('#car').scrollIntoView({ block: 'center', behavior: 'instant' })); await M.waitForTimeout(700);
  const d2 = await M.$('.car-dots i:nth-child(3)'); const bb = await d2.boundingBox();
  await M.touchscreen.tap(bb.x + bb.width / 2, bb.y - 9); await M.waitForTimeout(500); // 점 바로 위(보이는 점 밖)를 눌러도
  ok(await M.evaluate(() => document.querySelectorAll('.car-dots i')[2].classList.contains('on')), '점 바로 위를 눌러도 그 칸으로 넘어감');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
