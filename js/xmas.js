// 시즌 장식(크리스마스): 매년 11/16 ~ 12/26 에만 자동으로 켜진다. 인사말 같은 글자는 넣지 않는다.
//  - 화면 위 금빛 갈랜드(늘어진 전선 + 유리 전구), 눈송이(작은 눈 + 흐린 큰 눈), 모서리 서리, 로고 산타 모자, 반짝이 색
//  - 채팅창 뒤 고급 트리: 11/16부터 하루마다 장식이 하나씩 늘고 12/25에 별이 달려 완성된다(새 장식은 반짝임)
//  - 시작(로딩) 화면: 달이 뜬 눈 내리는 밤하늘을 루돌프와 산타 썰매가 금빛 가루를 흩뿌리며 가로지른다(동화풍 벡터 그림)
// 장식이 싫으면 사이드바(모바일은 더보기)의 '시즌 장식' 버튼으로 끈다(naejeon:xmas = '0').
import { act, toast, moreHooks } from './core.js';

const START = [11, 16], STAR_DAY = [12, 25], END = [12, 26];
const KEY = 'naejeon:xmas';
const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
export const inSeason = (d = new Date()) => md(d) >= START[0] * 100 + START[1] && md(d) <= END[0] * 100 + END[1];
export const xmasOn = () => inSeason() && localStorage.getItem(KEY) !== '0';
const calm = () => document.body.classList.contains('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;

function progress(now = new Date()) {
  const y = now.getFullYear(), day = 864e5;
  const s = new Date(y, START[0] - 1, START[1]), x = new Date(y, STAR_DAY[0] - 1, STAR_DAY[1]);
  const t = new Date(y, now.getMonth(), now.getDate());
  return { d: Math.max(0, Math.round((t - s) / day)), total: Math.round((x - s) / day) };
}

// 성능: 움직이지 않는 그림은 <img>(data URL SVG)로 넣어 브라우저가 한 번만 그려 두게 한다.
// SVG 안에서 무언가 움직이면 매 프레임 SVG 전체(필터 포함)를 다시 그려야 해서 저사양 PC에서 버벅인다.
// 반짝임·흔들림은 위에 얹은 작은 HTML 요소의 투명도·회전만 바꿔 그래픽 카드가 처리하게 한다.
const svgImg = (inner, vb, cls = '', extra = '') => `<img class="${cls}" alt="" aria-hidden="true" decoding="async" ${extra} src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`)}">`;

// ---------- 트리 (그리는 순서 = 하루에 하나씩 나타나는 순서) ----------
const DEFS = `<defs>
  <radialGradient id="xtHalo" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".6"/><stop offset=".55" stop-color="#ffb86b" stop-opacity=".14"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  <linearGradient id="xtLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc07c"/><stop offset=".45" stop-color="#1f8a50"/><stop offset="1" stop-color="#0b4a2a"/></linearGradient>
  <linearGradient id="xtLeafHi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8f0cc" stop-opacity=".6"/><stop offset=".35" stop-color="#b8f0cc" stop-opacity="0"/></linearGradient>
  <linearGradient id="xtGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d2"/><stop offset=".35" stop-color="#f0c55a"/><stop offset=".65" stop-color="#b9821f"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
  <linearGradient id="xtSatin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7b72"/><stop offset=".5" stop-color="#c81e2b"/><stop offset="1" stop-color="#7d0c16"/></linearGradient>
  <linearGradient id="xtTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a2c15"/><stop offset=".5" stop-color="#8a5629"/><stop offset="1" stop-color="#3a210f"/></linearGradient>
  <radialGradient id="xbRed" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffb0a6"/><stop offset=".35" stop-color="#df2f35"/><stop offset="1" stop-color="#6e0d12"/></radialGradient>
  <radialGradient id="xbGold" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fffbe2"/><stop offset=".35" stop-color="#ecbd45"/><stop offset="1" stop-color="#7a5310"/></radialGradient>
  <radialGradient id="xbBlue" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#cfe1ff"/><stop offset=".35" stop-color="#3a6ae0"/><stop offset="1" stop-color="#0f2257"/></radialGradient>
  <radialGradient id="xbPearl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#efe8de"/><stop offset="1" stop-color="#a39886"/></radialGradient>
  <radialGradient id="xbPurple" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#f0d6ff"/><stop offset=".35" stop-color="#9b4fd8"/><stop offset="1" stop-color="#3b1561"/></radialGradient>
  <radialGradient id="xtStarG" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#ffe17a"/><stop offset="1" stop-color="#e09b1c"/></radialGradient>
  <linearGradient id="xtRay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient>
  <filter id="xtGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="xtSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.200"/></filter>
  <filter id="xtBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <linearGradient id="xgRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8483f"/><stop offset="1" stop-color="#8e1717"/></linearGradient>
  <linearGradient id="xgGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34a866"/><stop offset="1" stop-color="#115230"/></linearGradient>
  <linearGradient id="xgNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4466c4"/><stop offset="1" stop-color="#16285e"/></linearGradient>
  <linearGradient id="xgPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a65fe0"/><stop offset="1" stop-color="#4a1a78"/></linearGradient>
  <pattern id="xtCane" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="6" height="6" fill="#fff"/><rect width="3" height="6" fill="#e0262f"/></pattern>
</defs>`;
// 가지 한 단: 아래쪽이 물결 모양으로 늘어진 삼각형 + 왼쪽 하이라이트 + 가지 끝에 쌓인 눈
const tier = (top, bot, half) => {
  const l = 120 - half, r = 120 + half, n = 6, w = (r - l) / n;
  let wave = '', snow = '';
  for (let i = 0; i < n; i++) { const x1 = r - w * i, x2 = r - w * (i + 1), mx = (x1 + x2) / 2; wave += ` Q${mx} ${bot + 10} ${x2} ${bot}`; snow += `<path d="M${x1 - 1} ${bot - 1} Q${mx} ${bot + 7} ${x2 + 1} ${bot - 1} Q${mx} ${bot + 2} ${x1 - 1} ${bot - 1}z" fill="#f4f8ff" opacity=".85"/>`; }
  const d = `M120 ${top} L${r} ${bot}${wave} Z`;
  return `<path d="${d}" fill="url(#xtLeaf)"/><path d="${d}" fill="url(#xtLeafHi)"/><path d="M120 ${top} L${l + 6} ${bot - 2}" stroke="#c9f5d8" stroke-opacity=".3" stroke-width="1.200"/>${snow}`;
};
const bauble = (x, y, g, r = 7) => `<g><path d="M${x - 2} ${y - r - 2.500}h4v3.500h-4z" fill="url(#xtGold)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/><path d="M${x - r} ${y}q${r} ${r * 0.5} ${r * 2} 0" stroke="#fff3c4" stroke-opacity=".55" stroke-width=".9" fill="none"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.38}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity=".8" transform="rotate(-30 ${x - r * 0.35} ${y - r * 0.38})"/></g>`;
const bulbs = (pts) => `<g class="xt-lights">${pts.map(([x, y, c], i) => `<g style="--i:${i}"><circle cx="${x}" cy="${y}" r="4.500" fill="${c}" opacity=".35"/><circle cx="${x}" cy="${y}" r="2.200" fill="#fffbe8"/><path d="M${x} ${y - 5}v10M${x - 5} ${y}h10" stroke="#fffbe8" stroke-width=".8" opacity=".7"/></g>`).join('')}</g>`;
const gift = (x, y, w, h, g, rib) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.500" fill="url(#${g})"/><rect x="${x}" y="${y}" width="${w}" height="${h * 0.22}" fill="#fff" opacity=".12"/><rect x="${x + w / 2 - 2.500}" y="${y}" width="5" height="${h}" fill="${rib}"/><rect x="${x}" y="${y + h / 2 - 2}" width="${w}" height="4" fill="${rib}" opacity=".9"/><path d="M${x + w / 2} ${y}c-10-11-19-3-10 0zM${x + w / 2} ${y}c10-11 19-3 10 0z" fill="${rib}" stroke="#00000030"/><circle cx="${x + w / 2}" cy="${y}" r="2.400" fill="${rib}"/></g>`;
const cane = (x, y, flip = 1) => `<path d="M${x} ${y + 16} V${y + 4} q0 -6 ${5 * flip} -6 q${5 * flip} 0 ${5 * flip} 5" stroke="url(#xtCane)" stroke-width="3.400" fill="none" stroke-linecap="round"/>`;
const bell = (x, y) => `<g><path d="M${x - 6} ${y + 6} q0 -11 6 -11 q6 0 6 11 l2 2 h-16z" fill="url(#xtGold)"/><circle cx="${x}" cy="${y + 9}" r="2" fill="#b9821f"/><path d="M${x - 3} ${y - 6} q3 -4 6 0" stroke="#c81e2b" stroke-width="2" fill="none"/></g>`;
const starOrn = (x, y, s = 1) => `<path d="M${x} ${y - 7 * s} ${x + 2 * s} ${y - 2 * s} ${x + 7 * s} ${y - 2 * s} ${x + 3 * s} ${y + 1.500 * s} ${x + 4.500 * s} ${y + 7 * s} ${x} ${y + 4 * s} ${x - 4.500 * s} ${y + 7 * s} ${x - 3 * s} ${y + 1.500 * s} ${x - 7 * s} ${y - 2 * s} ${x - 2 * s} ${y - 2 * s}z" fill="url(#xtGold)" stroke="#fff6d2" stroke-width=".6"/>`;
function treeParts() {
  const P = []; P.lights = {};
  P.push(`<path d="M106 286h28l4 30h-36z" fill="url(#xtTrunk)"/><path d="M40 314 q80 -22 160 0 q-6 14 -80 14 q-74 0 -80 -14z" fill="url(#xtSatin)"/><path d="M40 314 q80 -22 160 0" stroke="url(#xtGold)" stroke-width="2.500" fill="none"/>`); // 줄기 + 트리 치마
  P.push(tier(200, 292, 104));
  P.push(tier(148, 238, 84));
  P.push(tier(100, 184, 64));
  P.push(tier(58, 128, 44));
  // 공단 리본(사선으로 감기는 금빛 띠, 아래부터)
  P.push(`<path d="M46 284 C92 302 150 302 198 268" stroke="url(#xtGold)" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M46 282 C92 300 150 300 198 266" stroke="#fff6d2" stroke-opacity=".5" stroke-width="1.400" fill="none"/>`);
  P.push(`<path d="M60 228 C100 244 152 242 184 214" stroke="url(#xtGold)" stroke-width="6.500" fill="none" stroke-linecap="round"/><path d="M60 226 C100 242 152 240 184 212" stroke="#fff6d2" stroke-opacity=".5" stroke-width="1.200" fill="none"/>`);
  P.push(`<path d="M74 174 C104 188 142 186 166 162" stroke="url(#xtGold)" stroke-width="6" fill="none" stroke-linecap="round"/>`);
  P.push(`<path d="M90 122 C110 131 134 130 150 114" stroke="url(#xtGold)" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  // 장식 공
  const B = [[70, 270, 'xbRed', 8.500], [170, 262, 'xbGold', 8.500], [118, 294, 'xbBlue', 8], [96, 252, 'xbPearl', 7.500], [146, 288, 'xbPurple', 7.500], [188, 286, 'xbPearl', 7], [52, 292, 'xbGold', 7],
    [88, 214, 'xbGold', 8], [152, 206, 'xbRed', 8], [118, 232, 'xbPurple', 7.500], [70, 232, 'xbBlue', 7], [174, 234, 'xbBlue', 7], [104, 196, 'xbRed', 6.500],
    [100, 160, 'xbBlue', 7.500], [142, 154, 'xbGold', 7.500], [122, 176, 'xbRed', 7], [84, 176, 'xbPurple', 6.500], [160, 178, 'xbPearl', 6.500],
    [112, 108, 'xbGold', 6.500], [132, 118, 'xbRed', 6], [100, 126, 'xbPearl', 6], [124, 90, 'xbPurple', 5.500]];
  B.forEach(([x, y, g, r]) => P.push(bauble(x, y, g, r)));
  // 지팡이 사탕·금종·별 장식
  P.push(cane(58, 240)); P.push(cane(176, 250, -1)); P.push(cane(132, 192));
  P.push(bell(80, 286)); P.push(bell(158, 222)); P.push(bell(112, 140));
  P.push(starOrn(136, 268)); P.push(starOrn(64, 196, 0.9)); P.push(starOrn(150, 128, 0.8)); P.push(starOrn(92, 98, 0.7));
  // 요정 전구(십자 반짝임)
  P.lights[P.length] = [[56, 262, '#ffcf6b'], [78, 278, '#ff8a7a'], [102, 286, '#ffcf6b'], [128, 284, '#a8d8ff'], [154, 276, '#ffcf6b'], [180, 260, '#ff8a7a'], [196, 276, '#c8a8ff']]; P.push(bulbs(P.lights[P.length]));
  P.lights[P.length] = [[70, 208, '#a8d8ff'], [92, 222, '#ffcf6b'], [118, 226, '#ff8a7a'], [146, 220, '#ffcf6b'], [170, 202, '#c8a8ff']]; P.push(bulbs(P.lights[P.length]));
  P.lights[P.length] = [[84, 156, '#ffcf6b'], [106, 170, '#ff8a7a'], [132, 168, '#ffcf6b'], [156, 152, '#a8d8ff'], [96, 108, '#ffcf6b'], [118, 116, '#c8a8ff'], [140, 104, '#ff8a7a'], [110, 80, '#ffcf6b']]; P.push(bulbs(P.lights[P.length]));
  // 선물 상자
  P.push(gift(26, 300, 36, 26, 'xgRed', '#f2cf7a'));
  P.push(gift(172, 292, 42, 34, 'xgGreen', '#f4efe6'));
  P.push(gift(138, 306, 30, 20, 'xgNavy', '#f2cf7a'));
  P.push(gift(64, 308, 26, 18, 'xgPurple', '#ffd6f0'));
  P.push(gift(98, 312, 22, 14, 'xgRed', '#f4efe6'));
  // 리본 나비매듭(별 바로 아래)
  P.push(`<g><path d="M120 66 c-14 -12 -26 -4 -16 4 c-8 6 4 12 16 -4z" fill="url(#xtSatin)"/><path d="M120 66 c14 -12 26 -4 16 4 c8 6 -4 12 -16 -4z" fill="url(#xtSatin)"/><path d="M118 66 l-8 22 6 -3 2 6zM122 66 l8 22 -6 -3 -2 6z" fill="#a8121e"/><circle cx="120" cy="66" r="4" fill="#ff6b62"/></g>`);
  // 별(크리스마스 당일): 회전하는 빛살 + 큰 빛무리
  P.push(`<g class="xt-star"><g class="xt-rays">${Array.from({ length: 12 }, (_, i) => `<path d="M120 40 l-3 -46 h6z" fill="url(#xtRay)" transform="rotate(${i * 30} 120 40)"/>`).join('')}</g><circle cx="120" cy="40" r="30" fill="#ffd76a" opacity=".55" filter="url(#xtGlow)"/><path d="M120 8 128.500 30 152 31 134 45 140 68 120 55 100 68 106 45 88 31 111.500 30z" fill="url(#xtStarG)" stroke="#fff8dc" stroke-width="1.600"/><circle cx="114" cy="30" r="3" fill="#fff" opacity=".9"/></g>`);
  return P;
}
const TVB = '-10 -14 260 352', SWIRL = 'M60 300 C150 290 200 260 170 240 C120 210 50 230 78 200 C100 176 170 186 160 156 C150 132 86 150 98 120 C108 96 150 106 142 80 C136 62 118 58 120 40';
const tpos = (x, y) => `left:${(((x + 10) / 260) * 100).toFixed(2)}%;top:${(((y + 14) / 352) * 100).toFixed(2)}%`;
function treeHTML() {
  const parts = treeParts(), { d, total } = progress();
  const n = d >= total ? parts.length : Math.min(parts.length - 1, 1 + Math.floor((d / total) * (parts.length - 1)));
  const key = 'naejeon:xtree2', seen = +localStorage.getItem(key) || 0;
  try { localStorage.setItem(key, String(n)); } catch {}
  const old = seen && seen < n ? seen : n;
  // 항상 보이는 배경: 은은한 빛무리, 뒤쪽 빛살, 트리를 휘감아 오르는 금빛 마법 소용돌이(정지 그림)
  const aura = `<ellipse cx="120" cy="196" rx="124" ry="150" fill="url(#xtHalo)"/><g opacity=".22" filter="url(#xtBlur)">${Array.from({ length: 11 }, (_, i) => `<path d="M120 180 l-4 -200 h8z" fill="url(#xtRay)" transform="rotate(${-70 + i * 14} 120 180)"/>`).join('')}</g>`;
  const swirl = `<path d="${SWIRL}" fill="none" stroke="#ffe7a3" stroke-width="2.600" stroke-linecap="round" stroke-dasharray="6 18" opacity=".75" filter="url(#xtSoft)"/>`;
  const base = svgImg(DEFS + aura + parts.slice(0, old).join('') + swirl, TVB, 'xt-img');
  const fresh = old < n ? svgImg(DEFS + parts.slice(old, n).join(''), TVB, 'xt-img xt-new') : ''; // 오늘 새로 생긴 장식만 깜빡
  const pts = Object.entries(parts.lights).filter(([i]) => +i < n).flatMap(([, v]) => v);
  const tw = [0, 1, 2].map((g) => `<div class="xt-tw g${g}">${pts.filter((_, i) => i % 3 === g).map(([x, y, c]) => `<i style="${tpos(x, y)};--c:${c}"></i>`).join('')}</div>`).join('');
  const star = n === parts.length ? `<i class="xt-glow" style="${tpos(120, 40)}"></i>` : '';
  const dots = Array.from({ length: 7 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  return `${base}${fresh}${tw}<div class="xt-tw">${star}</div><div class="xt-orbit" style="--p:path('${SWIRL.replace(/(-?\d+) (-?\d+)/g, (m, a, b) => `${+a + 10} ${+b + 14}`)}')">${dots}</div>`;
}
function fitOrbit(t) { const o = t.querySelector('.xt-orbit'); if (o) o.style.setProperty('--k', String(t.clientWidth / 260)); }

// ---------- 눈(작은 눈 + 가끔 흐린 큰 눈) ----------
let snowStop = null;
// 그림자 흐림(shadowBlur)은 매번 계산이라 무겁다. 빛 번짐이 들어간 작은 그림을 한 번 만들어 두고 찍어 쓴다.
const SPR = {};
function sprite(rgb, star) {
  const k = rgb + (star ? '*' : ''); if (SPR[k]) return SPR[k];
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(star ? 0.12 : 0.28, `rgba(${rgb},.9)`); gr.addColorStop(0.5, `rgba(${rgb},.22)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  if (star) { g.fillStyle = `rgba(${rgb},1)`; g.beginPath(); g.moveTo(16, 1); g.quadraticCurveTo(16, 16, 31, 16); g.quadraticCurveTo(16, 16, 16, 31); g.quadraticCurveTo(16, 16, 1, 16); g.quadraticCurveTo(16, 16, 16, 1); g.fill(); }
  return (SPR[k] = c);
}
function snowCanvas(cv, opts = {}) {
  const g = cv.getContext('2d'); let W = 0, H = 0, flakes = [], last = 0, raf = 0;
  const host = opts.host || window, count = opts.count || 80; let glints = [];
  const size = () => (host === window ? [innerWidth, innerHeight] : [host.clientWidth, host.clientHeight]);
  const mk = (any) => { const big = Math.random() < 0.08; return { x: Math.random() * W, y: any ? Math.random() * H : -10, r: big ? 3 + Math.random() * 3 : 0.7 + Math.random() * 1.8, v: big ? 0.6 + Math.random() * 0.6 : 0.25 + Math.random() * 0.7, w: Math.random() * 6.28, a: big ? 0.25 : 0.4 + Math.random() * 0.5, big }; };
  const mkG = () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6.28, s: 0.6 + Math.random() * 0.9, r: 2 + Math.random() * 3.500, vy: 0.1 + Math.random() * 0.25, c: Math.random() < 0.6 ? '255,226,140' : '255,255,255' });
  const Q = opts.full ? 1 : 0.5; // 눈은 원래 부드러운 모양이라 절반 해상도로 그리고 늘려도 티가 안 난다(그릴 픽셀 1/4)
  const fit = () => { [W, H] = size(); cv.width = Math.round(W * Q); cv.height = Math.round(H * Q); g.setTransform(Q, 0, 0, Q, 0, 0); flakes = Array.from({ length: Math.round(Math.min(count, W / 18)) }, () => mk(true)); glints = opts.glint ? Array.from({ length: Math.round(Math.min(opts.glint, W / 60)) }, mkG) : []; };
  fit(); addEventListener('resize', fit);
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; last = t;
    if (!opts.always && (document.body.classList.contains('lite') || document.body.classList.contains('idle') || document.hidden)) { g.clearRect(0, 0, W, H); return; }
    g.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.v; f.w += 0.02; f.x += Math.sin(f.w) * 0.4;
      if (f.y > H + 8) Object.assign(f, mk(false));
      g.globalAlpha = f.a;
      if (f.big) { const r = f.r * 2.6; g.drawImage(sprite('255,255,255'), f.x - r, f.y - r, r * 2, r * 2); }
      else { g.fillStyle = '#fff'; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.283); g.fill(); }
    }
    // 요정 가루: 네 갈래 반짝임이 천천히 떠다니며 깜빡인다
    for (const k of glints) {
      k.y -= k.vy; k.p += 0.05 * k.s; if (k.y < -10) Object.assign(k, mkG(), { y: H + 10 });
      const a = Math.max(0, Math.sin(k.p)); if (a < 0.05) continue;
      const r = k.r * (0.6 + 0.4 * a) * 2.4; g.globalAlpha = a; g.drawImage(sprite(k.c, true), k.x - r, k.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
}

// ---------- 갈랜드: 동화풍 전나무 가랜드 + 벨벳 리본 + 매달린 장식 공 ----------
const BULB = ['#ffe9a8', '#ffd36a', '#fff6d8', '#ffc56b'];
const BALL = ['xgB1', 'xgB2', 'xgB3', 'xgB4'];
function garland() {
  let el = document.getElementById('xlights');
  if (!el) { el = document.createElement('div'); el.id = 'xlights'; document.body.appendChild(el); }
  const W = innerWidth, small = innerWidth < 860, seg = small ? 84 : 128, n = Math.ceil(W / seg) + 1, H = small ? 36 : 46, k = small ? 0.72 : 1;
  const top = 3 * k, sag = 20 * k;
  const swag = Array.from({ length: n }, (_, i) => `${i ? '' : `M0 ${top} `}Q${i * seg + seg / 2} ${top + sag * 2} ${(i + 1) * seg} ${top}`).join(' ');
  const at = (i, t) => { const x0 = i * seg, x1 = x0 + seg, cx = x0 + seg / 2, cy = top + sag * 2; return [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * top + 2 * (1 - t) * t * cy + t * t * top]; };
  const lights = [], cores = [], balls = [], bows = [];
  const GR = { xgB1: ['#ff8f8f', '#d11d34', '#5e0612'], xgB2: ['#fff4c9', '#e2ad3c', '#7a520f'], xgB3: ['#bcd6ff', '#2f62d6', '#0f2263'], xgB4: ['#e7c9ff', '#8a45d6', '#3a1468'] };
  for (let i = 0; i < n; i++) {
    [0.2, 0.38, 0.62, 0.8].forEach((t, j) => { const [x, y] = at(i, t), yy = y + 1.5 * k; cores.push(`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${1.6 * k}" fill="#fffdf0"/>`); lights.push([(i + j) % 4, `<i style="left:${x.toFixed(1)}px;top:${yy.toFixed(1)}px;--c:${BULB[(i + j) % 4]}"></i>`]); });
    const [mx, my] = at(i, 0.5), len = (i % 2 ? 6 : 11) * k, [g0, g1, g2] = GR[BALL[i % 4]], r = (i % 2 ? 5.2 : 6.4) * k, w = r * 2 + 2, cx = w / 2, by = len + r, h = by + r + 1;
    const ball = `<defs><radialGradient id="b" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${g0}"/><stop offset=".5" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></radialGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c2"/><stop offset="1" stop-color="#a8761c"/></linearGradient></defs><path d="M${cx} 0V${by - r}" stroke="#e9c46a" stroke-width=".8"/><rect x="${cx - 2 * k}" y="${by - r - 2.4 * k}" width="${4 * k}" height="${3 * k}" rx=".8" fill="url(#g)"/><circle cx="${cx}" cy="${by}" r="${r}" fill="url(#b)"/><path d="M${cx - r} ${by}q${r} ${r * 0.55} ${r * 2} 0" stroke="#fff3c4" stroke-opacity=".6" stroke-width=".7" fill="none"/><ellipse cx="${cx - r * 0.35}" cy="${by - r * 0.4}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity=".85" transform="rotate(-30 ${cx - r * 0.35} ${by - r * 0.4})"/>`;
    balls.push(`<i class="xg-ball" style="left:${(mx - cx).toFixed(1)}px;top:${my.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;--d:${((i * 0.7) % 3).toFixed(2)}s">${svgImg(ball, `0 0 ${w.toFixed(2)} ${h.toFixed(2)}`)}</i>`);
    const x = i * seg, s2 = k;
    bows.push(`<g transform="translate(${x} ${top + 3 * k}) scale(${s2})"><path d="M-2 2 -7 17 -3.5 15.5 -2 19 1 4zM2 2 7 17 3.5 15.5 2 19-1 4z" fill="url(#xgRed)" stroke="#f3cf73" stroke-width=".7"/><path d="M0 1C-4-7-15-6-13 1c1 4 8 3 13 0zM0 1C4-7 15-6 13 1c-1 4-8 3-13 0z" fill="url(#xgRed)" stroke="#f3cf73" stroke-width=".9"/><path d="M-10-1c3-2 6-1 8 1M10-1c-3-2-6-1-8 1" stroke="#ff9a9a" stroke-opacity=".5" stroke-width="1" fill="none"/><ellipse cx="0" cy="1" rx="3.2" ry="3" fill="url(#xgRed)" stroke="#f3cf73" stroke-width=".9"/></g>`);
  }
  hang();
  const art = `<defs>
      <linearGradient id="xgGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c2"/><stop offset=".45" stop-color="#e6b74e"/><stop offset="1" stop-color="#a8761c"/></linearGradient>
      <radialGradient id="xgRed" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ff6a6a"/><stop offset=".55" stop-color="#c4142b"/><stop offset="1" stop-color="#6e0815"/></radialGradient>
    </defs>
    <path d="${swag}" stroke="#03130a" stroke-opacity=".55" stroke-width="${14 * k}" fill="none" stroke-linecap="round" transform="translate(0 ${2 * k})"/>
    <path d="${swag}" stroke="#0c3d24" stroke-width="${13 * k}" fill="none" stroke-linecap="round"/>
    <path d="${swag}" stroke="#16603a" stroke-width="${10 * k}" fill="none" stroke-linecap="round" stroke-dasharray="0.1 ${5.5 * k}"/>
    <path d="${swag}" stroke="#2b8a4e" stroke-width="${6.5 * k}" fill="none" stroke-linecap="round" stroke-dasharray="0.1 ${7 * k}" stroke-dashoffset="3" transform="translate(0 ${-2 * k})"/>
    <path d="${swag}" stroke="#eaf5ff" stroke-opacity=".75" stroke-width="${3.4 * k}" fill="none" stroke-linecap="round" stroke-dasharray="0.1 ${11 * k}" stroke-dashoffset="5" transform="translate(0 ${-4.5 * k})"/>
    <path d="${swag}" stroke="url(#xgGold)" stroke-width="${2.6 * k}" fill="none" stroke-dasharray="${9 * k} ${7 * k}" transform="translate(0 ${1 * k})"/>
    ${cores.join('')}${bows.join('')}`;
  el.innerHTML = `<div class="xg-in" style="width:${n * seg}px;height:${H}px">${balls.join('')}${svgImg(art, `0 0 ${n * seg} ${H}`, 'xg-art', `width="${n * seg}" height="${H}"`)}${[0, 1, 2, 3].map((g) => `<div class="xg-lt g${g}">${lights.filter((l) => l[0] === g).map((l) => l[1]).join('')}</div>`).join('')}</div>`;
}

// 모바일에서는 위쪽 헤더(로고·접속자)를 가리지 않도록 헤더 아래쪽 끝에 매단다
let hangObs = null;
function hang() {
  const el = document.getElementById('xlights'), side = document.getElementById('side'); if (!el || !side) return;
  el.style.top = innerWidth <= 860 ? Math.round(side.getBoundingClientRect().height) - 2 + 'px' : '';
  if (!hangObs && window.ResizeObserver) { hangObs = new ResizeObserver(() => hang()); hangObs.observe(side); }
}

// 반짝이는 별: 별마다 애니메이션을 따로 돌리지 않고, 박스 그림자로 찍은 별 묶음 3겹의 투명도만 번갈아 바꾼다
function starLayers(count, W, H, cls = 'xst') {
  const L = [[], [], []];
  for (let i = 0; i < count; i++) { const x = Math.round(((i * 47.3) % 100) / 100 * W), y = Math.round(((i * 29.7) % 100) / 100 * H), s = i % 3 ? 0 : 0.6; L[i % 3].push(`${x}px ${y}px 0 ${s}px rgba(255,255,255,.9)`); }
  return L.map((l, i) => `<i class="${cls} s${i}" style="box-shadow:${l.join(',')}"></i>`).join('');
}

// ---------- 배경: 오로라 밤하늘 + 멀리 보이는 눈 덮인 동화 마을 ----------
function aura() {
  if (document.getElementById('xaura')) return;
  const el = document.createElement('div'); el.id = 'xaura'; el.setAttribute('aria-hidden', 'true');
  const stars = starLayers(46, Math.max(screen.width, innerWidth), Math.max(screen.height, innerHeight) * 0.58);
  const win = (x, y) => `<rect class="xa-win" x="${x}" y="${y}" width="3" height="4" rx="1.4" fill="#ffd27a"/>`;
  const pine = (x, y, h) => `<path d="M${x} ${y - h}l${h * 0.28} ${h * 0.42}h${-h * 0.1}l${h * 0.24} ${h * 0.34}h${-h * 0.12}l${h * 0.24} ${h * 0.24}h${-h * 1.28}l${h * 0.24} ${-h * 0.24}h${-h * 0.12}l${h * 0.24} ${-h * 0.34}h${-h * 0.1}z" fill="#0d1a33"/><path d="M${x} ${y - h}l${h * 0.16} ${h * 0.24}q${-h * 0.16} ${h * 0.06} ${-h * 0.32} 0z" fill="#e9f2ff" opacity=".85"/>`;
  const castle = `<g transform="translate(700 92)"><path d="M0 60V22h10V8l6-14 6 14v14h12V-6l8-20 8 20v28h12V8l6-14 6 14v14h10v38z" fill="#121f3e"/><path d="M10 8l6-14 6 14zM34-6l8-20 8 20zM62 8l6-14 6 14z" fill="#d9e6ff" opacity=".9"/><path d="M42-26v-12l9 4-9 4" fill="#e9c46a"/>${win(14, 30)}${win(39, 10)}${win(45, 10)}${win(40, 32)}${win(66, 30)}<path d="M36 60v-12a6 6 0 0 1 12 0v12z" fill="#ffd27a" opacity=".85"/></g>`;
  const house = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 18V7l9-7 9 7v11z" fill="#13213f"/><path d="M-2 8 9-1l11 9-2 1-9-7-9 7z" fill="#eef5ff"/>${win(4, 10)}${win(11, 10)}</g>`;
  el.innerHTML = `<i class="xa-au a"></i><i class="xa-au b"></i><i class="xa-au c"></i>${stars}
    ${svgImg(`<defs><linearGradient id="xaSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfdcf5"/><stop offset="1" stop-color="#5f6f9c"/></linearGradient><linearGradient id="xaFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a6e"/><stop offset="1" stop-color="#121c3a"/></linearGradient></defs>
      <path d="M0 120C140 80 260 96 380 104S640 70 760 88s300 10 440-12V170H0z" fill="url(#xaFar)"/>${castle}
      ${house(250, 92)}${house(285, 98)}${house(930, 86)}${house(965, 92)}
      ${[60, 120, 170, 450, 500, 560, 860, 1050, 1110, 1160].map((x, i) => pine(x, 128 - (i % 3) * 4, 26 + (i % 4) * 6)).join('')}
      <path d="M0 150C200 120 400 140 600 132s420-20 600 6V170H0z" fill="url(#xaSnow)" opacity=".9"/>
      <path d="M0 150C200 120 400 140 600 132s420-20 600 6" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none"/>`, '0 0 1200 170', 'xa-town')}`;
  document.body.prepend(el);
}

// ---------- 패널 장식: 눈 쌓인 윗면 + 홀리 잎 + 히어로 반짝임 ----------
// 화면이 다시 그려지면 새로 생긴 패널에만 장식을 붙인다(이미 붙은 곳은 건너뜀).
const HOLLY = `<svg viewBox="0 0 44 30" aria-hidden="true"><defs><linearGradient id="xhL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fa45f"/><stop offset="1" stop-color="#0d4a27"/></linearGradient><radialGradient id="xhB" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff9a9a"/><stop offset=".5" stop-color="#d4142c"/><stop offset="1" stop-color="#6a0612"/></radialGradient></defs><path d="M22 16C17 9 9 7 2 9l3 2-2 3 4 0-1 4 4-2 1 4 3-3 2 3 2-4 3 2z" fill="url(#xhL)" stroke="#0a3a1e" stroke-width=".6"/><path d="M22 16c5-7 13-9 20-7l-3 2 2 3h-4l1 4-4-2-1 4-3-3-2 3-2-4-3 2z" fill="url(#xhL)" stroke="#0a3a1e" stroke-width=".6"/><path d="M21 15 6 11M23 15l15-4" stroke="#9fe0b0" stroke-opacity=".5" stroke-width=".7"/><circle cx="18.5" cy="17.5" r="3.6" fill="url(#xhB)"/><circle cx="25.5" cy="17.5" r="3.6" fill="url(#xhB)"/><circle cx="22" cy="22.5" r="3.6" fill="url(#xhB)"/><circle cx="17.4" cy="16.4" r="1" fill="#fff" opacity=".8"/><circle cx="24.4" cy="16.4" r="1" fill="#fff" opacity=".8"/><circle cx="20.9" cy="21.4" r="1" fill="#fff" opacity=".8"/></svg>`;
let decoObs = null, decoRaf = 0;
function decorate() {
  decoRaf = 0;
  const main = document.getElementById('main'); if (!main || !xmasOn()) return;
  main.querySelectorAll('.panel, .stat, .hero, .notice').forEach((p) => {
    if (p.querySelector(':scope > .xcap') || p.closest('#modal') || p.offsetWidth < 120) return;
    p.insertAdjacentHTML('beforeend', '<i class="xcap" aria-hidden="true"></i>');
    if (p.classList.contains('hero')) p.insertAdjacentHTML('beforeend', `<i class="xholly r" aria-hidden="true">${HOLLY}</i><div class="xhero-sp" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="left:${4 + ((i * 37) % 52)}%;top:${10 + ((i * 53) % 70)}%;--d:${((i * 0.47) % 3).toFixed(2)}s"></i>`).join('')}</div>`);
    else if (p.querySelector(':scope > .sec-h')) p.insertAdjacentHTML('beforeend', `<i class="xholly" aria-hidden="true">${HOLLY}</i>`);
  });
}
function deco(on) {
  if (!on) { decoObs?.disconnect(); decoObs = null; document.querySelectorAll('.xcap, .xholly, .xhero-sp').forEach((e) => e.remove()); return; }
  decorate();
  if (decoObs) return;
  const main = document.getElementById('main'); if (!main) return;
  decoObs = new MutationObserver(() => { if (!decoRaf) decoRaf = requestAnimationFrame(decorate); });
  decoObs.observe(main, { childList: true, subtree: true });
}

// ---------- 마우스를 따라 흩날리는 요정 가루(마우스가 있는 PC에서만) ----------
let dustOff = null;
function pixie() {
  if (dustOff || !matchMedia('(pointer: fine)').matches) return;
  const cv = document.createElement('canvas'); cv.id = 'xdust'; document.body.appendChild(cv);
  const g = cv.getContext('2d'); let ps = [], raf = 0, lx = 0, ly = 0; cv.style.display = 'none';
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit();
  const loop = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    ps = ps.filter((p) => (p.l -= 0.022) > 0);
    g.globalCompositeOperation = 'lighter';
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.03; g.globalAlpha = p.l * (0.6 + 0.4 * Math.sin(p.l * 20)); const r = (p.st ? p.r * p.l * 2.4 : p.r * 1.3); g.drawImage(sprite(p.c, p.st), p.x - r, p.y - r, r * 2, r * 2); }
    g.globalAlpha = 1;
    raf = ps.length ? requestAnimationFrame(loop) : 0;
    if (!raf) cv.style.display = 'none'; // 가루가 없을 땐 화면 전체 크기 캔버스를 합성 대상에서 뺀다
  };
  const move = (e) => {
    const b = document.body.classList; if (b.contains('lite') || e.pointerType !== 'mouse') return;
    const d = Math.hypot(e.clientX - lx, e.clientY - ly); if (d < 6) return; lx = e.clientX; ly = e.clientY;
    for (let i = 0; i < Math.min(3, 1 + d / 18); i++) ps.push({ x: e.clientX + (Math.random() - 0.5) * 6, y: e.clientY + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 0.8, vy: Math.random() * 0.4, l: 1, r: 1.5 + Math.random() * 2.2, st: Math.random() < 0.45, c: Math.random() < 0.7 ? '255,224,138' : Math.random() < 0.5 ? '255,255,255' : '191,225,255' });
    if (ps.length > 140) ps.splice(0, ps.length - 140);
    if (!raf) { cv.style.display = ''; raf = requestAnimationFrame(loop); }
  };
  addEventListener('pointermove', move, { passive: true }); addEventListener('resize', fit);
  dustOff = () => { removeEventListener('pointermove', move); removeEventListener('resize', fit); cancelAnimationFrame(raf); cv.remove(); dustOff = null; };
}

// ---------- 시작(로딩) 화면: 동화풍 밤하늘 ----------
const REINDEER = `<symbol id="xsRd" viewBox="0 0 64 44"><path d="M8 24c2-7 20-9 30-6l6-7c2-4 6-5 9-3l4 1-2 3h-4l-3 8c-1 5-5 8-11 8H20c-5 0-10-1-12-4z"/><path d="M38 27l11 7 2-2-10-6zM33 28l9 9 2-2-8-8zM12 27 2 33l-1-2 9-6zM17 28l-8 9-2-1 7-9z"/><path d="M8 23l-6-3 1-2 6 3z"/><path d="M52 9l-3-7M52 6l-5-2M55 9l3-7M57 5l4-1" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" fill="none"/></symbol>`;
const SLEIGH = `<symbol id="xsSl" viewBox="0 0 110 60"><path d="M6 50c10 6 70 6 92-2l4-6c-2 7-6 10-14 12-24 4-62 4-84-2z"/><path d="M14 48l2-6M40 50v-6M66 50v-6M88 47l-1-5" stroke="currentColor" stroke-width="2"/><path d="M10 42c0-12 6-20 18-20h40c10 0 16-6 22-12l4 3c-5 9-10 16-14 23-3 4-8 6-14 6z"/><circle cx="52" cy="14" r="7"/><path d="M45 12c2-10 12-12 18-6l6 6-3 1c-3-4-8-5-12-2z"/><circle cx="71" cy="13" r="2.400"/><path d="M42 32c-2-10 2-16 10-16s12 6 10 16z"/><path d="M58 20l12-8 2 2-11 9z"/><path d="M20 26c-6-10 2-20 12-18 4 1 6 4 6 8l-2 10z"/></symbol>`;
function sleighSVG() {
  return `<svg class="xs-sleigh" viewBox="0 0 420 110" aria-hidden="true"><defs>${REINDEER}${SLEIGH}<radialGradient id="xsNose"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ff4b3e"/><stop offset="1" stop-color="#ff4b3e" stop-opacity="0"/></radialGradient></defs>
    <g fill="#16203a" color="#16203a">
      <path d="M104 62 C170 50 250 44 372 34" stroke="#2a3552" stroke-width="1.200" fill="none"/><path d="M104 66 C180 58 250 52 372 40" stroke="#2a3552" stroke-width="1.200" fill="none"/>
      <use href="#xsSl" x="0" y="34" width="120" height="66"/>
      <g class="xs-rd a"><use href="#xsRd" x="150" y="38" width="56" height="38"/><use href="#xsRd" x="164" y="50" width="56" height="38"/></g>
      <g class="xs-rd b"><use href="#xsRd" x="222" y="30" width="56" height="38"/><use href="#xsRd" x="236" y="42" width="56" height="38"/></g>
      <g class="xs-rd c"><use href="#xsRd" x="294" y="22" width="56" height="38"/><use href="#xsRd" x="308" y="34" width="56" height="38"/></g>
      <g class="xs-rd d"><use href="#xsRd" x="352" y="12" width="60" height="40"/></g>
    </g>
    <circle class="xs-nose" cx="408" cy="21" r="9" fill="url(#xsNose)"/></svg>`;
}
function hillsSVG() {
  const tree = (x, y, s) => `<path d="M${x} ${y - 46 * s}l${-14 * s} ${22 * s}h${6 * s}l${-10 * s} ${14 * s}h${7 * s}l${-11 * s} ${12 * s}h${44 * s}l${-11 * s} ${-12 * s}h${7 * s}l${-10 * s} ${-14 * s}h${6 * s}z" fill="#0b1830"/><path d="M${x} ${y - 46 * s}l${-6 * s} ${10 * s}h${12 * s}z" fill="#e8f0ff" opacity=".85"/>`;
  const house = (x, y) => `<g><path d="M${x} ${y}v-18l12-10 12 10v18z" fill="#101d36"/><path d="M${x - 3} ${y - 17}l15-13 15 13" stroke="#e8f0ff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="${x + 5}" y="${y - 12}" width="6" height="6" fill="#ffcf6b" class="xs-win"/><rect x="${x + 14}" y="${y - 12}" width="5" height="6" fill="#ffb84a" class="xs-win"/></g>`;
  return `<svg class="xs-hills" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
      <linearGradient id="xsH1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfdcf5"/><stop offset="1" stop-color="#7f93c4"/></linearGradient>
      <linearGradient id="xsH2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset="1" stop-color="#a9bbe2"/></linearGradient></defs>
    <path d="M0 190 C180 140 330 160 480 176 S820 130 1000 160 1200 150 1200 150V300H0z" fill="url(#xsH1)" opacity=".75"/>
    ${[90, 140, 420, 470, 760, 1080, 1130].map((x, i) => tree(x, 186 - (i % 2) * 6, 0.9)).join('')}
    ${house(560, 186)}${house(600, 180)}${house(880, 166)}
    <path d="M0 236 C220 200 420 226 640 230 S1000 196 1200 214V300H0z" fill="url(#xsH2)"/>
    ${[40, 300, 980, 1160].map((x) => tree(x, 238, 1.3)).join('')}</svg>`;
}
export function splashScene(splash) {
  if (!xmasOn()) return;
  splash.classList.add('xs');
  const sc = document.createElement('div'); sc.className = 'xs-scene';
  sc.innerHTML = `<canvas class="xs-stars"></canvas><div class="xs-moon"><i></i><i></i><i></i><i></i></div>
    <div class="xs-fly">${sleighSVG()}</div>${hillsSVG()}<canvas class="xs-dust"></canvas><canvas class="xs-snow"></canvas>`;
  splash.prepend(sc);
  if (calm()) return;
  const stops = [];
  // 반짝이는 별 + 가끔 별똥별
  (() => {
    const cv = sc.querySelector('.xs-stars'), g = cv.getContext('2d'); let W, H, stars = [], raf, shoot = null;
    const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; stars = Array.from({ length: Math.round(W * H / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.72, r: Math.random() * 1.3 + 0.2, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.6 })); };
    fit();
    const loop = (t) => {
      raf = requestAnimationFrame(loop); g.clearRect(0, 0, W, H);
      for (const s of stars) { g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t / 1000 * s.s)); g.fillStyle = '#fff'; g.fillRect(s.x, s.y, s.r, s.r); }
      if (!shoot && Math.random() < 0.006) shoot = { x: Math.random() * W * 0.6, y: Math.random() * H * 0.3, l: 1 };
      if (shoot) { g.globalAlpha = shoot.l; const gr = g.createLinearGradient(shoot.x, shoot.y, shoot.x - 120, shoot.y - 40); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = gr; g.lineWidth = 2; g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - 120, shoot.y - 40); g.stroke(); shoot.x += 14; shoot.y += 4.6; shoot.l -= 0.03; if (shoot.l <= 0) shoot = null; }
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop); stops.push(() => cancelAnimationFrame(raf));
  })();
  // 썰매 뒤로 흩날리는 금빛 가루
  (() => {
    const cv = sc.querySelector('.xs-dust'), g = cv.getContext('2d'), fly = sc.querySelector('.xs-sleigh'); let raf, ps = [];
    cv.width = innerWidth; cv.height = innerHeight;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const r = fly.getBoundingClientRect();
      if (r.right > 0 && r.left < innerWidth) for (let k = 0; k < 4; k++) ps.push({ x: r.left + r.width * (0.05 + Math.random() * 0.25), y: r.top + r.height * (0.55 + Math.random() * 0.35), vx: -0.6 - Math.random(), vy: 0.3 + Math.random() * 0.8, l: 1, s: 0.8 + Math.random() * 2.2, c: Math.random() < 0.7 ? '255,226,140' : '255,255,255' });
      g.clearRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'lighter';
      ps = ps.filter((p) => (p.l -= 0.012) > 0);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.004; g.globalAlpha = p.l; g.fillStyle = `rgb(${p.c})`; g.beginPath(); g.arc(p.x, p.y, p.s * (0.6 + 0.4 * Math.sin(p.l * 20)), 0, 6.283); g.fill(); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop); stops.push(() => cancelAnimationFrame(raf));
  })();
  stops.push(snowCanvas(sc.querySelector('.xs-snow'), { always: true, full: true, count: 120, glint: 24 }));
  const gone = new MutationObserver(() => { if (!document.body.contains(splash)) { stops.forEach((f) => f()); gone.disconnect(); } });
  gone.observe(document.body, { childList: true });
}

// ---------- 가끔 화면 위쪽을 지나가는 산타 썰매(금빛 가루와 함께) ----------
function flyBy() {
  const b = document.body.classList;
  if (!xmasOn() || b.contains('lite') || b.contains('idle') || document.hidden || document.getElementById('xflyby') || document.querySelector('#modal.on')) return;
  const el = document.createElement('div'); el.id = 'xflyby';
  el.innerHTML = `<div class="xf-fly">${sleighSVG()}</div><canvas></canvas>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), fly = el.querySelector('.xs-sleigh'); cv.width = innerWidth; cv.height = 220;
  let ps = [], raf; const t0 = performance.now();
  const loop = (t) => {
    const r = fly.getBoundingClientRect();
    if (r.right > 0 && r.left < innerWidth) for (let k = 0; k < 3; k++) ps.push({ x: r.left + r.width * (0.05 + Math.random() * 0.2), y: r.top + r.height * (0.55 + Math.random() * 0.3), vx: -0.5 - Math.random(), vy: 0.2 + Math.random() * 0.6, l: 1, s: 0.7 + Math.random() * 1.8 });
    g.clearRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'lighter';
    ps = ps.filter((p) => (p.l -= 0.014) > 0);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; g.globalAlpha = p.l; g.fillStyle = Math.random() < 0.8 ? '#ffe28c' : '#fff'; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.283); g.fill(); }
    if (t - t0 < 9500) raf = requestAnimationFrame(loop); else el.remove();
  };
  raf = requestAnimationFrame(loop);
}

// ---------- 켜기·끄기 ----------
function place() {
  const chat = document.getElementById('chat');
  if (chat && !chat.querySelector('#xsky')) {
    const k = document.createElement('div'); k.id = 'xsky';
    k.innerHTML = `<i class="xk-moon"></i>${starLayers(22, chat.clientWidth || 340, (chat.clientHeight || 800) * 0.62)}`;
    chat.prepend(k);
  }
  if (chat && !chat.querySelector('#xtree')) {
    const t = document.createElement('div'); t.id = 'xtree';
    t.innerHTML = treeHTML() + `<div class="xt-magic">${Array.from({ length: 12 }, (_, i) => `<i style="left:${12 + ((i * 29) % 76)}%;top:${6 + ((i * 41) % 80)}%;--d:${(i * 0.53) % 3.200}s"></i>`).join('')}</div>`;
    chat.querySelector('#xsky').after(t);
    fitOrbit(t); if (window.ResizeObserver) new ResizeObserver(() => fitOrbit(t)).observe(t);
  }
  if (!document.getElementById('xlights')) garland();
  aura(); deco(true); pixie();
  const brand = document.querySelector('#side .brand');
  if (brand && !brand.querySelector('.xhat')) brand.insertAdjacentHTML('afterbegin', `<svg class="xhat" viewBox="0 0 44 34" aria-hidden="true"><defs><linearGradient id="xhR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5b4f"/><stop offset="1" stop-color="#9e1414"/></linearGradient></defs><path d="M5 26C10 12 18 4 30 4c5 0 8 3 9 9-7-3-12 1-14 7l-4 8z" fill="url(#xhR)"/><path d="M12 20c4-6 9-10 15-11" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none"/><rect x="2" y="22" width="28" height="9" rx="4.500" fill="#fbfbfb"/><rect x="2" y="22" width="28" height="3" rx="1.500" fill="#fff"/><circle cx="39" cy="13" r="4.500" fill="#fff"/></svg>`);
  if (!snowStop) { const cv = document.createElement('canvas'); cv.id = 'xsnow'; document.body.appendChild(cv); const stop = snowCanvas(cv, { glint: 18 }); snowStop = () => { stop(); cv.remove(); snowStop = null; }; }
}
function clear() {
  ['xtree', 'xsky', 'xlights', 'xfrost', 'xflyby', 'xaura'].forEach((id) => document.getElementById(id)?.remove());
  deco(false); dustOff?.();
  document.querySelector('#side .xhat')?.remove();
  snowStop?.();
}
function apply() {
  const on = xmasOn();
  document.body.classList.toggle('xmas', on);
  if (on) place(); else clear();
  dispatchEvent(new Event('xmaschange')); // 접속자 얼굴(산타·루돌프)을 바로 바꾼다
  document.querySelectorAll('[data-a="xmasToggle"]').forEach((b) => { b.classList.toggle('on', on); const u = b.querySelector('u'); if (u) u.textContent = on ? 'ON' : 'OFF'; });
}
export const xmasBtn = () => (inSeason() ? `<button class="btn ghost xs xmas-btn ${xmasOn() ? 'on' : ''}" data-a="xmasToggle" title="눈·갈랜드·트리 같은 시즌 장식 켜기/끄기">❄ 시즌 장식 <u>${xmasOn() ? 'ON' : 'OFF'}</u></button>` : '');
act('xmasToggle', () => { localStorage.setItem(KEY, xmasOn() ? '0' : '1'); apply(); toast(xmasOn() ? '시즌 장식을 켰어요' : '시즌 장식을 껐어요'); });
export function initXmas() {
  if (!inSeason()) return;
  moreHooks.push(xmasBtn);
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', xmasBtn());
  apply();
  let w = innerWidth; addEventListener('resize', () => { if (Math.abs(innerWidth - w) > 40 && document.getElementById('xlights')) { w = innerWidth; garland(); } });
  setTimeout(flyBy, 12e3); setInterval(flyBy, 90e3); // 접속 12초 뒤 한 번, 그 뒤 1분 30초마다
  let day = new Date().getDate();
  setInterval(() => {
    if (!xmasOn()) return;
    const now = new Date().getDate();
    if (now !== day) { day = now; document.getElementById('xtree')?.remove(); }
    if (!inSeason()) return apply();
    place();
  }, 60e3);
}

// ---------- 접속자 얼굴: 시즌 동안 산타 / 루돌프 ----------
// 닉네임마다 정해진 쪽(산타 또는 루돌프)이 항상 같게 나온다. 그라데이션 id 충돌을 피하려고 단색 도형만 쓴다.
const SANTA = `<svg viewBox="0 0 32 32" class="xf"><path d="M6 15c1-8 7-12 14-11 4 1 7 4 7 8l-1 3z" fill="#d6283b"/><path d="M20 4c4 1 7 4 7 8" fill="none" stroke="#a5172a" stroke-width="1.4"/><circle cx="27.5" cy="13.5" r="2.6" fill="#fff"/><ellipse cx="16" cy="20" rx="8.6" ry="7.4" fill="#f6c8a8"/><path d="M6.5 21c0 6 4 9.5 9.5 9.5s9.5-3.5 9.5-9.5c-2 2.4-5 3-9.5 3s-7.5-.6-9.5-3z" fill="#fff"/><path d="M11.6 24.4c1.6-1.4 3-1.2 4.4-.2 1.4-1 2.8-1.2 4.4.2-1.6.6-3 .3-4.4-.3-1.4.6-2.8.9-4.4.3z" fill="#eef3f8"/><rect x="4.6" y="13.4" width="22.8" height="4.6" rx="2.3" fill="#fff"/><ellipse cx="12.6" cy="20.6" rx="1.2" ry="1.5" fill="#2a1a14"/><ellipse cx="19.4" cy="20.6" rx="1.2" ry="1.5" fill="#2a1a14"/><circle cx="13" cy="20.1" r=".45" fill="#fff"/><circle cx="19.8" cy="20.1" r=".45" fill="#fff"/><circle cx="10.4" cy="23" r="1.5" fill="#f0909a" opacity=".7"/><circle cx="21.6" cy="23" r="1.5" fill="#f0909a" opacity=".7"/><circle cx="16" cy="22.6" r="1.6" fill="#ec9a86"/></svg>`;
const RUDOLPH = `<svg viewBox="0 0 32 32" class="xf"><path d="M9 11C6 8 5 5 6 2M7 6 4 5M7.6 8.4 5 9M23 11c3-3 4-6 3-9M25 6l3-1M24.4 8.4 27 9" fill="none" stroke="#c99a5b" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="6.4" cy="15" rx="3.6" ry="2" fill="#9a5f33" transform="rotate(-25 6.4 15)"/><ellipse cx="25.6" cy="15" rx="3.6" ry="2" fill="#9a5f33" transform="rotate(25 25.6 15)"/><path d="M16 8c6 0 9 4 9 9.5S21.5 30 16 30 7 23 7 17.5 10 8 16 8z" fill="#a8693a"/><ellipse cx="16" cy="24.6" rx="5.4" ry="4.4" fill="#e3b98c"/><ellipse cx="12.6" cy="17.2" rx="1.9" ry="2.4" fill="#fff"/><ellipse cx="19.4" cy="17.2" rx="1.9" ry="2.4" fill="#fff"/><ellipse cx="12.9" cy="17.7" rx="1.2" ry="1.6" fill="#24150d"/><ellipse cx="19.1" cy="17.7" rx="1.2" ry="1.6" fill="#24150d"/><circle cx="13.3" cy="17.1" r=".45" fill="#fff"/><circle cx="19.5" cy="17.1" r=".45" fill="#fff"/><circle cx="16" cy="22.2" r="3.4" fill="#ff3b4a" opacity=".35" class="xf-glow"/><circle cx="16" cy="22.2" r="2.5" fill="#e8202f"/><circle cx="15.2" cy="21.4" r=".8" fill="#ffb3b9"/><path d="M14 26.4q2 1.4 4 0" fill="none" stroke="#7a4524" stroke-width=".9" stroke-linecap="round"/></svg>`;
export function xmasFace(nick, title = '') {
  let h = 0; for (const c of String(nick)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const santa = h % 2 === 0;
  return `<i class="face xface ${santa ? 'santa' : 'rudolph'}" title="${title || (santa ? '산타' : '루돌프')}">${santa ? SANTA : RUDOLPH}</i>`;
}
