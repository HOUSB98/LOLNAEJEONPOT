// 제작자 화면: 코드 편집기처럼 꾸민 크레딧 페이지 (배경에 수식·기호가 흘러내린다)
import { S, page, esc, ic } from './core.js';

const MAKER = '이승근';
const CODE = `import { 열정, 커피, 밤샘 } from "life";

/** NAEJEONPOT — in-house league engine */
const 제작자 = "${MAKER}";
const stack = ["HTML", "CSS", "JavaScript", "Firebase"];

// 예상 승률: 점수 차를 로지스틱 곡선에 통과시킨다
const P = (Δ, s = 23.5) => 1 / (1 + 10 ** (-Δ / s));

// 내전 MMR: Elo, 팀 평균 기준
function elo(R, E, S, K = 12) {
  return R + K * (S - E);
}

// 보정 승률(표본이 적을수록 50%로 수축) → 챔피언 티어
const tier = ({ w, g }, maxG) => ((w + 3) / (g + 6)) * 100 + (g / maxG) * 8;

const softmax = (z) => z.map((x) => Math.exp(x) / z.reduce((a, b) => a + Math.exp(b), 0));
const sigmoid = (x) => 1 / (1 + Math.E ** -x);
const fft = (x) => (x.length < 2 ? x : merge(fft(even(x)), fft(odd(x)))); // O(n log n)

for await (const game of league.matches()) {
  const { blue, red } = game.lineup;
  balance(blue, red) ?? reroll("주사위");
}

export default class NaejeonPot extends League {
  creator = 제작자; // → "${MAKER}"
  build = () => 열정 * 커피 ** 밤샘;
}`;
const RE = /(\/\/.*$|\/\*\*.*\*\/)|("[^"]*")|\b(import|from|export|default|const|let|function|return|for|await|of|class|extends|new)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$가-힣Δ][\w$가-힣]*)(?=\()|([{}()[\];,.=+\-*/<>!&|?:]+)/gm;
const hl = (s) => { let out = '', last = 0; for (const m of s.matchAll(RE)) { out += esc(s.slice(last, m.index)) + `<span class="${m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : m[5] ? 'f' : 'o'}">${esc(m[0])}</span>`; last = m.index + m[0].length; } return out + esc(s.slice(last)); };

page('maker', {
  render() {
    const lines = CODE.split('\n');
    return `<canvas id="mkcv"></canvas>
    <section class="mk">
      <div class="mk-top"><small>// CREDITS · WHO BUILT THIS</small>
        <h1 class="mk-decl"><span class="mk-type"><span class="k">const</span> <span class="v">제작자</span> <span class="o">=</span> <span class="s">"${MAKER}"</span><span class="o">;</span></span><i class="mk-caret"></i></h1>
        <p><span class="c">/* NAEJEONPOT — designed &amp; coded by</span> <b>${MAKER}</b> <span class="c">*/</span></p></div>
      <div class="mk-grid">
        <div class="mk-win"><div class="mk-bar"><i></i><i></i><i></i><span>${ic('maker')}naejeonpot / creator.ts</span><em>TypeScript</em></div>
          <pre class="mk-code">${lines.map((l, i) => `<div style="--d:${i}"><u>${i + 1}</u><span>${hl(l) || ' '}</span></div>`).join('')}</pre></div>
        <div class="mk-side">
          <div class="mk-term"><div class="mk-bar"><i></i><i></i><i></i><span>terminal</span></div>
            <pre><span class="p">$</span> git log --author=<span class="s">"${MAKER}"</span> --oneline
<span class="n">cd60f36</span> 초상화 정렬 통일, 승률 공개 연출
<span class="n">804489a</span> 경기 카드 윗줄 버튼 정렬
<span class="n">8efce57</span> 경기별 리플레이 넣기
<span class="p">$</span> whoami
<span class="g">${MAKER}</span> <span class="c"># creator · maintainer</span>
<span class="p">$</span> npm run build
<span class="g">✓</span> compiled <span class="n">0</span> errors · <span class="n">0</span> warnings
<span class="p">$</span> <i class="mk-caret sm"></i></pre></div>
          <div class="mk-eq"><b>P<sub>win</sub> = 1 / (1 + 10<sup>−Δ/s</sup>)</b><b>R′ = R + K·(S − E)</b><b>e<sup>iπ</sup> + 1 = 0</b><b>∇·E = ρ/ε₀</b><b>Σ<sub>k=1..n</sub> k = n(n+1)/2</b></div>
        </div>
      </div>
    </section>`;
  },
  after() { rain(document.getElementById('mkcv')); },
});

// 배경: 여러 색의 기호·수식이 세로로 흘러내린다. 다른 화면으로 가면 스스로 멈춘다.
const GLYPH = '01∑∫∂√πλθΔ∞≈≠≤≥{}[]()<>=+-*/%&|!?;:#$λσμαβγ';
const TONE = ['246,227,168', '63,208,224', '155,140,255', '255,107,129', '79,208,139', '91,140,255', '240,138,75'];
const FORM = ['P = 1/(1+10^(-Δ/s))', "R' = R + K(S - E)", 'e^(iπ) + 1 = 0', 'O(n log n)', '∇·E = ρ/ε₀', 'f(x) = Σ aₙxⁿ', 'λx.x', 'det(A - λI) = 0', '∫ e^(-x²) dx = √π', 'softmax(z)ᵢ'];
function rain(cv) {
  if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const g = cv.getContext('2d'), F = 16;
  let cols = [], floats = [], last = 0;
  const fit = () => {
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    cols = Array.from({ length: Math.ceil(cv.width / F) }, () => ({ y: Math.random() * -60, v: 0.45 + Math.random() * 0.9, c: TONE[(Math.random() * TONE.length) | 0] }));
    floats = Array.from({ length: 9 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, v: 0.15 + Math.random() * 0.3, t: FORM[(Math.random() * FORM.length) | 0], c: TONE[(Math.random() * TONE.length) | 0], s: 15 + Math.random() * 16 }));
  };
  fit(); addEventListener('resize', fit);
  (function loop(t) {
    if (S.page !== 'maker' || !document.body.contains(cv)) return removeEventListener('resize', fit);
    requestAnimationFrame(loop);
    if (t - last < 45) return; last = t;
    g.fillStyle = 'rgba(5,7,13,.1)'; g.fillRect(0, 0, cv.width, cv.height);
    g.font = `600 ${F - 2}px Rajdhani, monospace`;
    cols.forEach((c, i) => {
      const y = Math.floor(c.y) * F;
      g.fillStyle = `rgba(${c.c},.9)`; g.fillText(GLYPH[(Math.random() * GLYPH.length) | 0], i * F, y);
      g.fillStyle = `rgba(${c.c},.35)`; g.fillText(GLYPH[(Math.random() * GLYPH.length) | 0], i * F, y - F);
      c.y += c.v;
      if (y > cv.height && Math.random() > 0.96) { c.y = Math.random() * -20; c.c = TONE[(Math.random() * TONE.length) | 0]; }
    });
    floats.forEach((f) => {
      g.font = `600 ${f.s}px Rajdhani, monospace`; g.fillStyle = `rgba(${f.c},.2)`; g.fillText(f.t, f.x, f.y);
      f.y -= f.v * 3; if (f.y < -20) { f.y = cv.height + 20; f.x = Math.random() * cv.width * 0.9; f.t = FORM[(Math.random() * FORM.length) | 0]; }
    });
  })(0);
}
