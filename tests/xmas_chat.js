// 채팅창 크리스마스 배경(트리 없음, 갈랜드·빛망울)과 크리스마스 말풍선은 12/25까지만. 12/26(장식 기간 마지막 날)엔 원래 채팅창·말풍선.
// 12/25 → 12/26 자정을 넘기면 켜 둔 화면에서도 1분 안에 원래대로
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const at = (s) => new Date(s).getTime();
  seed.chat = [['c1', '민수', '안녕'], ['me', 'A', '하이']].map(([cid, nick, t], i) => ({ id: 'x' + i, cid, nick, t, k: 'm', at: at('2026-12-10T20:00:00') + i * 1000 }));
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const look = (p) => p.evaluate(() => {
    const cb = document.querySelector('.cm:not(.me) .cb'), mine = document.querySelector('.cm.me .cb');
    return { xmas: document.body.classList.contains('xmas'), xchat: document.body.classList.contains('xchat'), tree: !!document.getElementById('xtree'), sky: !!document.getElementById('xsky'), swag: !!document.querySelector('#chat header .xswag img'),
      other: cb && getComputedStyle(cb).backgroundImage, mine: mine && getComputedStyle(mine).backgroundImage };
  });
  const run = async (name, time, fn) => {
    const p = await client(b, be, 'WORK', name, { clock: { time: at(time) } });
    await p.addInitScript(() => { localStorage.setItem('naejeon:chatclosed', '0'); localStorage.setItem('naejeon:cid', 'me'); });
    await p.setViewportSize({ width: 1440, height: 900 }); await open(p, 'home', 0); await p.clock.runFor(3000);
    await fn(p); ok(!p.errs.length, name + ': 페이지 오류 없음 ' + p.errs.join('|')); await p.close();
  };
  await run('A', '2026-12-10T20:00:00', async (p) => {
    const x = await look(p);
    ok(x.xmas && x.xchat, '12/10: 크리스마스 채팅 켜짐');
    ok(!x.tree, '트리 없음');
    ok(x.sky && x.swag, '고급 배경(빛망울) + 머리 아래 갈랜드');
    ok(/22, 58, 43|22,58,43/.test(x.other || '') || /rgb\(22, 58, 43\)/.test(x.other || ''), '남 말풍선 = 상록수 벨벳');
    ok(/125, 20, 38/.test(x.mine || ''), '내 말풍선 = 크랜베리 벨벳');
  });
  await run('B', '2026-12-25T23:59:20', async (p) => {
    let x = await look(p); ok(x.xchat && x.swag, '12/25 23:59: 아직 켜짐');
    await p.clock.runFor(90e3); await p.waitForTimeout(200); x = await look(p);
    ok(x.xmas && !x.xchat, '자정 넘기면 1분 안에 크리스마스 채팅만 꺼짐(다른 장식은 12/26까지)');
    ok(!x.sky && !x.swag && !x.tree, '배경·갈랜드 사라짐');
    ok(!/125, 20, 38/.test(x.mine || '') && !/22, 58, 43/.test(x.other || ''), '말풍선 원래대로');
  });
  await run('C', '2026-12-26T12:00:00', async (p) => {
    const x = await look(p); ok(x.xmas && !x.xchat && !x.sky && !x.swag, '12/26: 장식은 켜져 있어도 채팅은 원래대로');
  });
  await run('D', '2026-12-20T12:00:00', async (p) => {
    await p.evaluate(() => document.querySelector('[data-a="xmasToggle"]')?.click()); await p.waitForTimeout(300);
    const x = await look(p); ok(!x.xmas && !x.xchat && !x.sky && !x.swag, '시즌 장식을 끄면 채팅 배경·말풍선도 원래대로');
    await p.evaluate(() => document.querySelector('[data-a="xmasToggle"]')?.click()); await p.clock.runFor(2000); await p.waitForTimeout(300);
    const y = await look(p); ok(y.xchat && y.sky && y.swag, '다시 켜면 다시 나타남');
  });
  // 사이트 배경 그림(아주 은은하게): 크리스마스에도 예전 오로라 밤하늘 대신 배경 그림, 눈·갈랜드 효과는 그대로. 2월(시즌 아님)에도 같은 배경
  for (const [nm, t, xm] of [['E', '2026-12-10T20:00:00', true], ['F', '2027-02-10T20:00:00', false]]) await run(nm, t, async (p) => {
    await p.clock.runFor(4000); await p.waitForTimeout(600);
    const g = await p.evaluate(() => { const e = document.getElementById('sitebg'), cs = getComputedStyle(e); return { on: e.classList.contains('on'), op: +cs.opacity, img: cs.backgroundImage, pos: cs.position, z: cs.zIndex, aura: !!document.getElementById('xaura'), snow: !!document.getElementById('xsnow'), lights: !!document.getElementById('xlights') }; });
    ok(g.on && g.op <= 0.2 && /bg-pc\.webp/.test(g.img) && g.pos === 'fixed' && g.z === '-1', `${nm}: 배경 그림 깔림(고정 층·투명도 ${g.op})`);
    ok(!g.aura && (xm ? g.snow && g.lights : !g.snow && !g.lights), xm ? '크리스마스: 오로라 밤하늘 없음 · 눈·갈랜드는 그대로' : '시즌 아님: 장식 없이 배경 그림만');
  });
  await b.close();
})();
