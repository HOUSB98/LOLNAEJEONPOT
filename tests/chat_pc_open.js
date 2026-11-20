const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
(async () => { const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'PC'); await A.setViewportSize({ width: 1440, height: 900 }); await A.addInitScript(() => localStorage.setItem('naejeon:chatclosed', '0')); await open(A); await A.waitForTimeout(800);
  console.log(await A.evaluate(async () => { const { S } = await import('/js/core.js'); return JSON.stringify({ open: !document.body.classList.contains('chat-closed'), n: Object.keys(S.store.data.chat).length, shown: document.querySelectorAll('#chatlog .cm,#chatlog .csys').length }); }), 'reads', JSON.stringify(be.byCol['reads:chat']), A.errs.join('|') || '오류 없음');
  await b.close(); })();
