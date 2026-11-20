const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; }; const { makeSeed, client, open, Backend } = require('./harness');
(async () => { const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'PC'); await A.setViewportSize({ width: 1440, height: 900 }); await A.addInitScript(() => localStorage.setItem('naejeon:chatclosed', '0')); await open(A); await A.waitForTimeout(800);
  const x = await A.evaluate(async () => { const { S } = await import('/js/core.js'); return { open: !document.body.classList.contains('chat-closed'), n: Object.keys(S.store.data.chat).length, shown: document.querySelectorAll('#chatlog .cm,#chatlog .csys').length }; });
  ok(x.open && x.n === 20 && x.shown === 20, '넓은 PC·채팅창 열림: 처음부터 채팅 20개 ' + JSON.stringify(x) + ' · 읽기 ' + be.byCol['reads:chat']);
  ok(!A.errs.length, '페이지 오류: ' + (A.errs.join('|') || '없음'));
  await b.close(); })();
