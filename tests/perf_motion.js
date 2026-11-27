// 움직임·성능: ① 윈도 '애니메이션 효과'를 끈 PC(움직임 줄이기)에서 무한 반복 장식이 0.01ms로 덜덜 떨지 않고 멈춤
// ② 화면 밖 구역의 반복 장식은 멈추고(oos), 스크롤해서 들어오면 다시 돎 ③ 자동 가벼운 모드: 꾸준히 버벅이면 켜지고, 부드러우면 안 켜짐
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const infinite = () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity && a.playState === 'running').length;
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const mk = async (name, opts = {}, init) => {
    const P = await client(b, be, 'WORK', name, { ctx: await device(b, be, 'WORK', name, opts) });
    await P.addInitScript(init || (() => localStorage.setItem('naejeon:lite', '0')));
    return P;
  };
  // ① 움직임 줄이기
  const R = await mk('R', { reducedMotion: 'reduce' }); await open(R, 'home', 1200);
  ok(await R.evaluate(infinite) === 0, '움직임 줄이기: 계속 도는 반복 애니메이션 0개(예전: 약 40개가 0.01ms로 반복)');
  const tf = await R.evaluate(() => new Promise((res) => { const el = document.querySelector('.hero-bg.on'), v = []; (function f() { v.push(getComputedStyle(el).transform); if (v.length < 8) setTimeout(f, 30 + Math.random() * 40); else res(v); })(); }));
  ok(new Set(tf).size === 1, '움직임 줄이기: 홈 초상화가 떨리지 않고 한 자리에 고정: ' + tf[0]);
  await R.context().close();
  // ② 화면 밖 장식 멈춤
  const A = await mk('A'); await open(A, 'home', 1200);
  const before = await A.evaluate(infinite);
  const st = await A.evaluate(() => { const list = [...new Set([...document.getElementById('main').children, ...document.querySelectorAll('#main .panel')])]; return list.map((e) => { const r = e.getBoundingClientRect(); return { far: r.top > innerHeight + 300 || r.bottom < -300, oos: e.classList.contains('oos') }; }); });
  ok(st.some((x) => x.far) && st.every((x) => x.far === x.oos), `화면 밖 구역에만 oos(${st.filter((x) => x.oos).length}/${st.length}개)`);
  const paused = await A.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.('.oos') && a.effect.getComputedTiming().iterations === Infinity).map((a) => a.playState));
  ok(paused.length === 0 || paused.every((p) => p === 'paused'), `화면 밖 반복 장식은 멈춤(${paused.length}개)`);
  await A.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await A.waitForTimeout(500);
  const hero = await A.evaluate(() => ({ oos: document.querySelector('.hero').classList.contains('oos'), bg: document.querySelector('.hero-bg.on').getAnimations()[0]?.playState }));
  ok(hero.oos && hero.bg === 'paused', '아래로 내리면 맨 위 배너가 멈춤');
  await A.evaluate(() => window.scrollTo(0, 0)); await A.waitForTimeout(500);
  ok(await A.evaluate(() => !document.querySelector('.hero').classList.contains('oos') && document.querySelector('.hero-bg.on').getAnimations()[0]?.playState === 'running'), '다시 올라오면 배너가 이어서 돎');
  ok(await A.evaluate(infinite) >= before - 1, '보이는 장식은 그대로 돎(디자인 그대로)');
  await A.evaluate(() => (location.hash = '#/rank')); await A.waitForTimeout(700);
  await A.evaluate(() => (location.hash = '#/home')); await A.waitForTimeout(700);
  ok(await A.evaluate(() => !document.querySelector('.hero').classList.contains('oos')), '다른 화면에 다녀와도 정상');
  const errs = [...A.errs]; await A.context().close();
  // ③ 자동 가벼운 모드(저장된 선택 없음, 코어 8개인 PC로 흉내)
  const auto = () => { localStorage.removeItem('naejeon:lite'); Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); };
  const F = await mk('F', {}, auto); await open(F, 'home', 0);
  await F.waitForTimeout(9000);
  ok(!(await F.evaluate(() => document.body.classList.contains('lite'))), '부드러운 PC: 가벼운 모드가 저절로 켜지지 않음');
  errs.push(...F.errs); await F.context().close();
  const J = await mk('J', {}, auto); await open(J, 'home', 0);
  // 꾸준히 30fps 근처로 덜컥거리는 PC 흉내: 매 프레임 20~24ms 동안 일을 시킨다(예전 기준 40ms를 넘지 않는 끊김)
  await J.evaluate(() => { const spin = () => { const t = performance.now() + 20 + Math.random() * 4; while (performance.now() < t); requestAnimationFrame(spin); }; requestAnimationFrame(spin); });
  await J.waitForTimeout(15000); // 4초 뒤 재기 시작, 120프레임씩 두 번(끊기는 PC에서는 한 번에 약 4초)
  ok(await J.evaluate(() => document.body.classList.contains('lite')), '꾸준히 30~40fps로 끊기는 PC: 가벼운 모드가 저절로 켜짐(예전 기준으로는 못 잡던 경우)');
  ok(!(await J.evaluate(() => localStorage.getItem('naejeon:lite'))), '자동으로 켠 것은 저장하지 않음(나중에 다시 판단)');
  errs.push(...J.errs);
  // 화면 밖 애니메이션 쉬기(app.js offPause): 홈 맨 아래로 내리면 배너·통계 카드의 반복 애니메이션이 멈추고, 다시 올리면 이어서 움직임
  const O = await client(b, be, 'WORK', 'O'); await O.addInitScript(() => localStorage.setItem('naejeon:lite', '0'));
  await O.setViewportSize({ width: 1440, height: 900 }); await open(O, 'home', 2500);
  const loopSt = () => O.evaluate(() => { const L = document.getElementById('main').getAnimations({ subtree: true }).filter((a) => a.effect.getTiming().iterations === Infinity && a.effect.target.closest('.hero,.stats')); return { n: L.length, run: L.filter((a) => a.playState === 'running').length }; });
  const o0 = await loopSt();
  await O.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.documentElement.scrollHeight); }); await O.waitForTimeout(700); const o1 = await loopSt();
  await O.evaluate(() => scrollTo(0, 0)); await O.waitForTimeout(700); const o2 = await loopSt();
  ok(o0.n > 0 && o0.run === o0.n && o1.run === 0 && o2.run === o2.n, `화면 밖 배너·통계 카드 애니메이션 멈춤 → 다시 보이면 움직임: ${JSON.stringify([o0, o1, o2])}`);
  errs.push(...O.errs);
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
