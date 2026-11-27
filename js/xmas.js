// 시즌 장식(크리스마스): 매년 11/16 ~ 12/26 에만 자동으로 켜진다. 인사말 같은 글자는 넣지 않는다.
//  - 화면 위 금빛 갈랜드(늘어진 전선 + 유리 전구), 눈송이(작은 눈 + 흐린 큰 눈), 모서리 서리, 로고 산타 모자, 반짝이 색
//  - 채팅창 뒤 고급 트리: 11/16부터 하루마다 장식이 하나씩 늘고 12/25에 별이 달려 완성된다(새 장식은 반짝임)
//  - 클릭(터치)하면 그 자리에서 반짝이가 터진다
//  - 시작(로딩) 화면: 달이 뜬 눈 내리는 밤하늘을 루돌프와 산타 썰매가 금빛 가루를 흩뿌리며 가로지른다(동화풍 벡터 그림)
// 장식이 싫으면 사이드바(모바일은 더보기)의 '시즌 장식' 버튼으로 끈다(naejeon:xmas = '0').
import { act, toast, moreHooks } from './core.js';

import { inSeason, xmasOn, xchatOn } from './season.js';
export { inSeason, xmasOn };

// 기간 판단은 season.js(크리스마스 11/16 ~ 12/26, 채팅창 배경·말풍선은 12/25까지)
const KEY = 'naejeon:xmas';
const calm = () => document.body.classList.contains('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// 성능: 움직이지 않는 그림은 <img>(data URL SVG)로 넣어 브라우저가 한 번만 그려 두게 한다.
// SVG 안에서 무언가 움직이면 매 프레임 SVG 전체(필터 포함)를 다시 그려야 해서 저사양 PC에서 버벅인다.
// 반짝임·흔들림은 위에 얹은 작은 HTML 요소의 투명도·회전만 바꿔 그래픽 카드가 처리하게 한다.
const svgImg = (inner, vb, cls = '', extra = '') => `<img class="${cls}" alt="" aria-hidden="true" decoding="async" ${extra} src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`)}">`;

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
    if (t - last < (opts.step || 33)) return; last = t;
    if (!opts.always && (document.body.classList.contains('lite') || document.body.classList.contains('idle') || document.body.classList.contains('bd-open') || document.hidden)) { g.clearRect(0, 0, W, H); return; }
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
  el.innerHTML = `<div class="xg-in" style="width:${n * seg}px;height:${H}px">${balls.join('')}${svgImg(`<filter id="xgSh" x="-5%" y="-20%" width="110%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="1.5" flood-color="#000" flood-opacity=".5"/></filter><g filter="url(#xgSh)">${art}</g>`, `0 0 ${n * seg} ${H + 6}`, 'xg-art', `width="${n * seg}" height="${H + 6}"`)}${[0, 1, 2, 3].map((g) => `<div class="xg-lt g${g}">${lights.filter((l) => l[0] === g).map((l) => l[1]).join('')}</div>`).join('')}</div>`;
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
  el.innerHTML = `<i class="xa-au a"></i>${stars}
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

// ---------- 클릭(터치)한 자리에서 반짝이가 톡 터진다 ----------
// 평소에는 아무것도 그리지 않고, 터진 반짝이가 사라지면 캔버스를 다시 숨긴다.
let dustOff = null;
function pixie() {
  if (dustOff) return;
  const cv = document.createElement('canvas'); cv.id = 'xdust'; document.body.appendChild(cv);
  const g = cv.getContext('2d'); let ps = [], raf = 0; cv.style.display = 'none';
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit();
  const loop = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    ps = ps.filter((p) => (p.l -= 0.025) > 0);
    g.globalCompositeOperation = 'lighter';
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.06; g.globalAlpha = Math.min(1, p.l * 1.6) * (0.7 + 0.3 * Math.sin(p.l * 24)); const r = p.st ? p.r * (0.5 + p.l) * 2 : p.r * 1.3; g.drawImage(sprite(p.c, p.st), p.x - r, p.y - r, r * 2, r * 2); }
    g.globalAlpha = 1;
    raf = ps.length ? requestAnimationFrame(loop) : 0;
    if (!raf) cv.style.display = 'none';
  };
  const burst = (e) => {
    if (document.body.classList.contains('lite') || e.button > 0) return;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random() * 0.4, v = 2 + Math.random() * 3.2;
      ps.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, l: 0.8 + Math.random() * 0.3, r: 1.6 + Math.random() * 2.4, st: i % 2 === 0, c: Math.random() < 0.65 ? '255,224,138' : Math.random() < 0.5 ? '255,255,255' : '191,225,255' });
    }
    if (ps.length > 120) ps.splice(0, ps.length - 120);
    if (!raf) { cv.style.display = ''; raf = requestAnimationFrame(loop); }
  };
  addEventListener('pointerdown', burst, { passive: true }); addEventListener('resize', fit);
  dustOff = () => { removeEventListener('pointerdown', burst); removeEventListener('resize', fit); cancelAnimationFrame(raf); cv.remove(); dustOff = null; };
}

// ---------- 산타 썰매(시작 화면·가끔 지나가는 썰매가 함께 씀) ----------
const REINDEER = `<symbol id="xsRd" viewBox="0 0 64 44"><path d="M8 24c2-7 20-9 30-6l6-7c2-4 6-5 9-3l4 1-2 3h-4l-3 8c-1 5-5 8-11 8H20c-5 0-10-1-12-4z"/><path d="M38 27l11 7 2-2-10-6zM33 28l9 9 2-2-8-8zM12 27 2 33l-1-2 9-6zM17 28l-8 9-2-1 7-9z"/><path d="M8 23l-6-3 1-2 6 3z"/><path d="M52 9l-3-7M52 6l-5-2M55 9l3-7M57 5l4-1" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" fill="none"/></symbol>`;
const SLEIGH = `<symbol id="xsSl" viewBox="0 0 110 60"><path d="M6 50c10 6 70 6 92-2l4-6c-2 7-6 10-14 12-24 4-62 4-84-2z"/><path d="M14 48l2-6M40 50v-6M66 50v-6M88 47l-1-5" stroke="currentColor" stroke-width="2"/><path d="M10 42c0-12 6-20 18-20h40c10 0 16-6 22-12l4 3c-5 9-10 16-14 23-3 4-8 6-14 6z"/><circle cx="52" cy="14" r="7"/><path d="M45 12c2-10 12-12 18-6l6 6-3 1c-3-4-8-5-12-2z"/><circle cx="71" cy="13" r="2.400"/><path d="M42 32c-2-10 2-16 10-16s12 6 10 16z"/><path d="M58 20l12-8 2 2-11 9z"/><path d="M20 26c-6-10 2-20 12-18 4 1 6 4 6 8l-2 10z"/></symbol>`;
function sleighSVG(c = '#16203a', rein = '#2a3552') {
  return `<svg class="xs-sleigh" viewBox="0 0 420 110" aria-hidden="true"><defs>${REINDEER}${SLEIGH}<radialGradient id="xsNose"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ff4b3e"/><stop offset="1" stop-color="#ff4b3e" stop-opacity="0"/></radialGradient></defs>
    <g fill="${c}" color="${c}">
      <path d="M104 62 C170 50 250 44 372 34" stroke="${rein}" stroke-width="1.200" fill="none"/><path d="M104 66 C180 58 250 52 372 40" stroke="${rein}" stroke-width="1.200" fill="none"/>
      <use href="#xsSl" x="0" y="34" width="120" height="66"/>
      <g class="xs-rd a"><use href="#xsRd" x="150" y="38" width="56" height="38"/><use href="#xsRd" x="164" y="50" width="56" height="38"/></g>
      <g class="xs-rd b"><use href="#xsRd" x="222" y="30" width="56" height="38"/><use href="#xsRd" x="236" y="42" width="56" height="38"/></g>
      <g class="xs-rd c"><use href="#xsRd" x="294" y="22" width="56" height="38"/><use href="#xsRd" x="308" y="34" width="56" height="38"/></g>
      <g class="xs-rd d"><use href="#xsRd" x="352" y="12" width="60" height="40"/></g>
    </g>
    <circle class="xs-nose" cx="408" cy="21" r="9" fill="url(#xsNose)"/></svg>`;
}
// ---------- 시작(로딩) 화면: 평소 배경 그림 위로 금빛 썰매만 ----------
// 성능 원칙: 금빛 꼬리는 처음 한 번만 캔버스에 그리고, 그 뒤 움직임은 전부 CSS의 투명도·위치(transform)만 바꾼다.
// 매 프레임 돌아가는 JS가 하나도 없어서, 사이트가 DB 연결·화면 준비로 바쁜 순간에도 그래픽 카드가 움직임을 끊김 없이 이어 간다.
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // 같은 씨앗 → 늘 같은 모양
const DPR = () => Math.min(2, devicePixelRatio || 1);
function paintTrail(fly) {
  const w = fly.offsetWidth * 0.95, h = fly.offsetWidth * 0.34, d = DPR(), r = rng(41);
  fly.querySelectorAll('.sk-trail').forEach((cv, half) => {
    cv.width = Math.round(w * d); cv.height = Math.round(h * d); const g = cv.getContext('2d'); g.scale(d, d); g.globalCompositeOperation = 'lighter';
    for (let i = half; i < 260; i += 2) {
      const t = Math.pow(r(), 0.7), x = w * t, y = h * (0.15 + (1 - t) * 0.55 + (r() - 0.5) * (0.12 + (1 - t) * 0.5)), rad = (0.5 + r() * 1.6) * (0.5 + t * 0.7);
      const c = r() < 0.7 ? '255,224,140' : '255,255,255', a = (0.15 + t * 0.85) * (0.5 + r() * 0.5);
      const q = g.createRadialGradient(x, y, 0, x, y, rad * 3); q.addColorStop(0, `rgba(${c},${a})`); q.addColorStop(0.35, `rgba(${c},${a * 0.45})`); q.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = q; g.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
    }
  });
}
// 반짝이(별 모양): 썰매 둘레에서 커졌다 작아지며 깜빡인다(투명도·크기만 바뀌어 가볍다)
const sparkles = (n) => { const r = rng(11); return Array.from({ length: n }, () => `<i class="xs-spk" style="left:${(r() * 100).toFixed(0)}%;top:${(r() * 90 - 10).toFixed(0)}%;--s:${(8 + r() * 10).toFixed(0)}px;--t:${(1.1 + r() * 1.2).toFixed(2)}s;--d:${(-r() * 2).toFixed(2)}s"></i>`).join(''); };
export function splashScene(splash) {
  if (!xmasOn()) return;
  splash.classList.add('xs'); // 배경은 평소 시작 화면 그림 그대로, 산타 썰매·루돌프만 금빛으로 반짝이며 날아간다
  const sc = document.createElement('div'); sc.className = 'xs-scene';
  sc.innerHTML = `<div class="xs-fly"><canvas class="sk-trail a"></canvas><canvas class="sk-trail b"></canvas>${sleighSVG('#1b1030', '#3a2a55')}${sparkles(9)}</div>`;
  splash.prepend(sc);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) paintTrail(sc.querySelector('.xs-fly')); // 가벼운 모드에서도 썰매는 날아간다(반짝임만 멈춤, css)
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

// ---------- 채팅창 배경: 고급스러운 크리스마스(12/25까지) ----------
// 어두운 미드나잇 바탕 + 가장자리 촛불빛·크랜베리 빛망울(CSS 정지 그림), 머리 아래로 늘어진 전나무 갈랜드(금 구슬 줄·작은 전구·크랜베리 리본·매달린 장식 공).
// 말풍선이 돋보이도록 가운데는 비우고 어둡게 둔다. 갈랜드는 정지 그림(<img>) 한 장, 반짝임은 작은 점 몇 개의 투명도만
function swagSVG() {
  const W = 400, r = rng(25), out = [], P = (x0, y0, cx, cy, x1, y1, t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  const segs = [[-20, 2, 90, 52, 200, 4], [200, 4, 310, 52, 420, 2]], G = ['#0d2419', '#123323', '#18402c', '#215238', '#2c6446'];
  for (const [x0, y0, cx, cy, x1, y1] of segs) {
    for (let i = 0; i <= 70; i++) { // 전나무 잎: 곡선을 따라 짧은 잎을 여러 방향으로
      const [x, y] = P(x0, y0, cx, cy, x1, y1, i / 70);
      for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2, l = 5 + r() * 7; out.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l * 0.8).toFixed(1)}" stroke="${G[Math.floor(r() * G.length)]}" stroke-width="${(1 + r() * 0.8).toFixed(2)}" stroke-linecap="round"/>`); }
    }
    for (let i = 0; i <= 46; i++) { const [x, y] = P(x0, y0 + 6, cx, cy + 12, x1, y1 + 6, i / 46); out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.25" fill="url(#xsGold)"/>`); } // 금 구슬 줄
    for (let i = 1; i < 9; i++) { const [x, y] = P(x0, y0, cx, cy, x1, y1, i / 9 + (r() - 0.5) * 0.03); out.push(`<circle cx="${x.toFixed(1)}" cy="${(y + 2).toFixed(1)}" r="5" fill="url(#xsGlow)"/><circle cx="${x.toFixed(1)}" cy="${(y + 2).toFixed(1)}" r="1.5" fill="#fff4cf"/>`); } // 작은 전구
  }
  const ball = (x, y, len, g) => `<path d="M${x} ${y}v${len}" stroke="#c9a14f" stroke-width=".7"/><rect x="${x - 2}" y="${y + len - 1}" width="4" height="3" rx=".6" fill="url(#xsGold)"/><circle cx="${x}" cy="${y + len + 8}" r="7.5" fill="url(#${g})"/><ellipse cx="${x - 2.4}" cy="${y + len + 5.2}" rx="2.4" ry="1.5" fill="#fff" opacity=".45"/>`;
  out.push(ball(92, 48, 12, 'xsRed'), ball(308, 48, 18, 'xsGb'), ball(128, 42, 22, 'xsGb'), ball(272, 42, 9, 'xsRed'));
  const bow = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 0C-6-9-17-8-16-1c1 6 10 4 16 1zM0 0c6-9 17-8 16-1-1 6-10 4-16 1z" fill="url(#xsRed)" stroke="#d9b25e" stroke-width=".7"/><path d="M-2 1l-6 15 4-1 2 4 3-17zM2 1l6 15-4-1-2 4-3-17z" fill="url(#xsRed)" stroke="#d9b25e" stroke-width=".7"/><circle r="3.2" fill="url(#xsRed)" stroke="#e7c470" stroke-width=".8"/></g>`;
  out.push(bow(200, 6));
  const defs = `<defs><radialGradient id="xsGlow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <linearGradient id="xsGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#7a5414"/></linearGradient>
    <radialGradient id="xsRed" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#c8344c"/><stop offset=".6" stop-color="#7d1426"/><stop offset="1" stop-color="#3c0610"/></radialGradient>
    <radialGradient id="xsGb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff1c4"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#5e4413"/></radialGradient></defs>`;
  return svgImg(defs + out.join(''), `0 0 ${W} 82`, 'xs-img', 'width="400" height="82"');
}
function chatLux() {
  const chat = document.getElementById('chat'), on = xchatOn(), hd = chat?.querySelector('header');
  document.body.classList.toggle('xchat', on);
  if (!on) { document.getElementById('xsky')?.remove(); hd?.querySelector('.xswag')?.remove(); return; }
  if (chat && !chat.querySelector('#xsky')) {
    const k = document.createElement('div'); k.id = 'xsky';
    k.innerHTML = Array.from({ length: 7 }, (_, i) => `<b style="left:${8 + ((i * 37) % 84)}%;top:${14 + ((i * 53) % 74)}%;--d:${((i * 0.9) % 4).toFixed(1)}s"></b>`).join(''); // 아주 작은 금빛 반짝임
    chat.prepend(k);
  }
  if (hd && !hd.querySelector('.xswag')) hd.insertAdjacentHTML('beforeend', `<div class="xswag" aria-hidden="true">${swagSVG()}</div>`);
}

// ---------- 켜기·끄기 ----------
function place() {
  const chat = document.getElementById('chat');
  chatLux();
  if (!document.getElementById('xlights')) garland();
  aura(); deco(true); pixie();
  const brand = document.querySelector('#side .brand');
  if (brand && !brand.querySelector('.xhat')) brand.insertAdjacentHTML('afterbegin', `<svg class="xhat" viewBox="0 0 44 34" aria-hidden="true"><defs><linearGradient id="xhR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5b4f"/><stop offset="1" stop-color="#9e1414"/></linearGradient></defs><path d="M5 26C10 12 18 4 30 4c5 0 8 3 9 9-7-3-12 1-14 7l-4 8z" fill="url(#xhR)"/><path d="M12 20c4-6 9-10 15-11" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none"/><rect x="2" y="22" width="28" height="9" rx="4.500" fill="#fbfbfb"/><rect x="2" y="22" width="28" height="3" rx="1.500" fill="#fff"/><circle cx="39" cy="13" r="4.500" fill="#fff"/></svg>`);
  if (!snowStop) { const cv = document.createElement('canvas'); cv.id = 'xsnow'; document.body.appendChild(cv); const stop = snowCanvas(cv, { count: 45, step: 50 }); snowStop = () => { stop(); cv.remove(); snowStop = null; }; }
}
function clear() {
  ['xsky', 'xlights', 'xfrost', 'xflyby', 'xaura'].forEach((id) => document.getElementById(id)?.remove());
  document.querySelector('#chat .xswag')?.remove(); document.body.classList.remove('xchat');
  deco(false); dustOff?.();
  document.querySelector('#side .xhat')?.remove();
  snowStop?.();
}
// later: 접속 직후에는 장식(트리·별·갈랜드·눈)을 첫 화면이 그려진 다음에 붙인다(첫 화면이 멈칫하지 않게). 색 등 xmas 표시는 바로
const after1st = (f) => requestAnimationFrame(() => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 800 }) : f()), 0));
function apply(later) {
  const on = xmasOn();
  document.body.classList.toggle('xmas', on);
  if (on) (later ? after1st(() => xmasOn() && place()) : place()); else clear();
  dispatchEvent(new Event('xmaschange')); // 접속자 얼굴(산타·루돌프)을 바로 바꾼다
  document.querySelectorAll('[data-a="xmasToggle"]').forEach((b) => { b.classList.toggle('on', on); const u = b.querySelector('u'); if (u) u.textContent = on ? 'ON' : 'OFF'; });
}
export const xmasBtn = () => (inSeason() ? `<button class="btn ghost xs xmas-btn ${xmasOn() ? 'on' : ''}" data-a="xmasToggle" title="눈·갈랜드·트리 같은 시즌 장식 켜기/끄기">❄ 시즌 장식 <u>${xmasOn() ? 'ON' : 'OFF'}</u></button>` : '');
act('xmasToggle', () => { localStorage.setItem(KEY, xmasOn() ? '0' : '1'); apply(); toast(xmasOn() ? '시즌 장식을 켰어요' : '시즌 장식을 껐어요'); });
export function initXmas() {
  if (!inSeason()) return;
  moreHooks.push(xmasBtn);
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', xmasBtn());
  apply(true);
  let w = innerWidth; addEventListener('resize', () => { if (Math.abs(innerWidth - w) > 40 && document.getElementById('xlights')) { w = innerWidth; garland(); } });
  setTimeout(flyBy, 12e3); setInterval(flyBy, 90e3); // 접속 12초 뒤 한 번, 그 뒤 1분 30초마다
  setInterval(() => {
    if (!xmasOn()) return;
    if (!inSeason()) return apply();
    place(); // 12/25가 지나면 채팅창 배경·말풍선도 여기서 원래대로(chatLux)
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
