// 길드 화면 그림(정파: 매화 핀 화산 문파 궁궐 · 마교: 귀화가 피어오르는 마교 성채와 천마의 그림자).
// 배경은 SVG를 한 번 만들어 CSS 배경 그림(data URL)으로 넣는다 → 화면에 그림 요소가 수백 개 생기지 않고, 브라우저가 한 장의 그림으로 한 번만 그린다.
// 파일을 받지 않으므로 네트워크 부담도 없다. 움직이는 것은 꽃잎·불티 8개(transform만, 가벼운 모드·동작 줄이기에서는 멈춤)뿐
const rng = (seed) => { let z = seed; return () => (z = (z * 16807) % 2147483647) / 2147483647; };
const f1 = (v) => v.toFixed(1);

// ---------- 정파 ----------
function sceneJ() {
  const r = rng(11), P = ['#f7b6cf', '#f39cc0', '#ffd3e3', '#e985ad', '#fde7ef', '#f6a6c6'];
  const bloom = (x, y, R, n, ry = 0.75) => Array.from({ length: n }, () => { const a = r() * 6.283, d = Math.sqrt(r()) * R, s = 2.6 + r() * 5.5; return `<circle cx="${f1(x + Math.cos(a) * d)}" cy="${f1(y + Math.sin(a) * d * ry)}" r="${f1(s)}" fill="${P[Math.floor(r() * P.length)]}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`; }).join('');
  // 처마가 위로 휜 기와지붕
  const roof = (cx, y, w, h, c = '#241a2e') => `<path d="M${f1(cx - w / 2 - 16)} ${f1(y + h - 4)} Q${f1(cx - w / 2 + 2)} ${f1(y + h + 2)} ${f1(cx - w / 2 + 12)} ${f1(y + h * 0.5)} L${f1(cx - w * 0.2)} ${f1(y)} L${f1(cx + w * 0.2)} ${f1(y)} L${f1(cx + w / 2 - 12)} ${f1(y + h * 0.5)} Q${f1(cx + w / 2 - 2)} ${f1(y + h + 2)} ${f1(cx + w / 2 + 16)} ${f1(y + h - 4)} Q${cx} ${f1(y + h * 0.82)} ${f1(cx - w / 2 - 16)} ${f1(y + h - 4)}Z" fill="${c}"/><path d="M${f1(cx - w * 0.2)} ${f1(y)}H${f1(cx + w * 0.2)}" stroke="#e2b25a" stroke-width="2.2" stroke-linecap="round"/><path d="M${f1(cx - w / 2 - 6)} ${f1(y + h - 3)} Q${cx} ${f1(y + h * 0.86)} ${f1(cx + w / 2 + 6)} ${f1(y + h - 3)}" stroke="#7a3b55" stroke-width="1.6" fill="none"/>`;
  // 전각(층마다 몸체 + 지붕): 붉은 기둥, 따뜻한 창빛
  const hall = (cx, base, w, tiers, bh = 24) => {
    let out = `<rect x="${f1(cx - w / 2 - 10)}" y="${base}" width="${w + 20}" height="9" fill="#2c2233"/><rect x="${f1(cx - w / 2 - 18)}" y="${base + 9}" width="${w + 36}" height="7" fill="#231b2b"/>`;
    let y = base;
    for (let t = 0; t < tiers; t++) {
      const ww = w * (1 - 0.2 * t), h = t ? bh * 0.8 : bh;
      y -= h;
      out += `<rect x="${f1(cx - ww / 2)}" y="${f1(y)}" width="${f1(ww)}" height="${f1(h)}" fill="#3a2433"/>`;
      const n = Math.max(3, Math.round(ww / 22));
      for (let k = 0; k <= n; k++) out += `<rect x="${f1(cx - ww / 2 + (ww * k) / n - 1.5)}" y="${f1(y)}" width="3" height="${f1(h)}" fill="#9b2f45"/>`;
      for (let k = 0; k < n; k++) out += `<rect x="${f1(cx - ww / 2 + (ww * k) / n + 4)}" y="${f1(y + 5)}" width="${f1(ww / n - 8)}" height="${f1(h - 9)}" fill="#ffcf8a" opacity="${(0.14 + r() * 0.22).toFixed(2)}"/>`;
      const rh = t ? 16 : 20; y -= rh - 4;
      out += roof(cx, y, ww + 18, rh);
    }
    return out;
  };
  const stairs = (cx, top, w, n, step) => Array.from({ length: n }, (_, i) => `<rect x="${f1(cx - w / 2 - i * 2)}" y="${top + i * step}" width="${w + i * 4}" height="${step}" fill="${i % 2 ? '#2a2131' : '#30263a'}"/>`).join('');
  const pagoda = (cx, base, w, n) => { let y = base, out = ''; for (let i = 0; i < n; i++) { const ww = w * (1 - i * 0.12); y -= 14; out += `<rect x="${f1(cx - ww / 2 + 4)}" y="${y}" width="${f1(ww - 8)}" height="14" fill="#3a2433"/><rect x="${f1(cx - 3)}" y="${y + 3}" width="6" height="8" fill="#ffcf8a" opacity=".45"/>`; y -= 8; out += roof(cx, y, ww + 6, 10); } return out + `<path d="M${cx} ${y - 18}V${y}" stroke="#e2b25a" stroke-width="2"/>`; };
  const branch = (d, w) => `<path d="${d}" stroke="#2a1720" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const petals = Array.from({ length: 70 }, () => { const x = f1(r() * 1200), y = f1(40 + r() * 300); return `<ellipse cx="${x}" cy="${y}" rx="${f1(2 + r() * 3)}" ry="${f1(1.2 + r() * 1.6)}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})" fill="${P[Math.floor(r() * P.length)]}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 380" preserveAspectRatio="xMidYMax slice">
  <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1430"/><stop offset=".45" stop-color="#4a2c4f"/><stop offset=".8" stop-color="#b9708a"/><stop offset="1" stop-color="#e3a7a8"/></linearGradient>
  <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9e4" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc2c8" stop-opacity=".45"/><stop offset="1" stop-color="#ffc2c8" stop-opacity="0"/></radialGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dbe6" stop-opacity="0"/><stop offset=".6" stop-color="#f6dbe6" stop-opacity=".28"/><stop offset="1" stop-color="#f6dbe6" stop-opacity="0"/></linearGradient>
  <linearGradient id="fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140c16" stop-opacity="0"/><stop offset="1" stop-color="#140c16"/></linearGradient></defs>
  <rect width="1200" height="380" fill="url(#sk)"/><circle cx="860" cy="150" r="170" fill="url(#sun)"/><circle cx="860" cy="150" r="46" fill="#fff1ec" opacity=".75"/>
  <path d="M0 230 60 170 110 200 180 120 240 175 300 140 360 190 430 100 500 160 560 120 640 175 700 110 780 170 850 130 930 185 1000 120 1080 175 1140 140 1200 165V380H0z" fill="#5a3a5c" opacity=".55"/>
  <rect x="0" y="170" width="1200" height="70" fill="url(#mist)"/>
  <path d="M0 270 80 200 150 240 240 170 320 230 420 150 520 220 600 160 690 220 780 165 880 235 960 180 1060 240 1140 200 1200 220V380H0z" fill="#3b2741" opacity=".85"/>
  <rect x="0" y="230" width="1200" height="60" fill="url(#mist)"/>
  ${pagoda(1090, 250, 42, 5)}
  ${hall(545, 262, 120, 2)}${hall(925, 262, 120, 2)}
  <path d="M560 300 650 250H810L900 300z" fill="#2b2233"/>${stairs(730, 262, 60, 6, 6)}
  ${hall(730, 250, 220, 3, 26)}
  <path d="M0 330 140 290 300 310 460 296 600 312 760 294 920 312 1060 292 1200 310V380H0z" fill="#22182a"/>
  ${branch('M-10 120C60 150 110 190 150 260M40 140C70 120 110 110 150 118M90 200C130 190 170 196 210 214M60 160C40 200 30 240 40 290', 9)}${branch('M150 118C175 110 200 112 228 122M210 214C240 222 262 238 280 262', 5)}
  ${bloom(80, 135, 70, 70)}${bloom(170, 120, 55, 50)}${bloom(210, 210, 60, 55)}${bloom(60, 230, 60, 50)}${bloom(255, 250, 40, 30)}
  ${branch('M1215 100C1140 140 1090 190 1060 270M1160 130C1130 110 1090 104 1050 112M1110 200C1070 192 1030 200 990 220', 9)}${branch('M1050 112C1020 106 995 112 970 124M990 220C965 232 948 248 935 270', 5)}
  ${bloom(1120, 125, 70, 70)}${bloom(1030, 115, 55, 50)}${bloom(995, 215, 58, 52)}${bloom(1150, 230, 60, 50)}${bloom(945, 255, 38, 28)}
  ${bloom(470, 300, 46, 34)}${bloom(735, 300, 46, 34)}
  ${petals}
  <rect x="0" y="250" width="1200" height="130" fill="url(#fd)"/></svg>`;
}

// ---------- 마교 ----------
function sceneM() {
  const r = rng(5);
  const tower = (x, base, w, h, rh) => `<rect x="${x - w / 2}" y="${base - h}" width="${w}" height="${h}" fill="#050907"/><path d="M${x - w / 2 - 8} ${base - h} L${x} ${base - h - rh} L${x + w / 2 + 8} ${base - h}Z" fill="#030504"/><path d="M${x} ${base - h - rh} V${base - h - rh - 14}" stroke="#0c1610" stroke-width="2"/>` +
    Array.from({ length: Math.max(1, Math.floor(h / 30)) }, (_, i) => `<rect x="${x - 2.5}" y="${base - h + 12 + i * 30}" width="5" height="9" fill="#ff3348" opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`).join('');
  const wall = (x1, x2, top) => { let d = `M${x1} ${top}`; for (let x = x1; x < x2; x += 16) d += `h8v-7h8v7`; return `<path d="${d}V380H${x1}Z" fill="#040705"/>`; };
  const swords = Array.from({ length: 9 }, (_, i) => { const a = (-150 + i * 15) * Math.PI / 180, x0 = 600 + Math.cos(a) * 120, y0 = 205 + Math.sin(a) * 60, x1 = 600 + Math.cos(a) * 250, y1 = 205 + Math.sin(a) * 170; return `<path d="M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}" stroke="#1b2a20" stroke-width="5" stroke-linecap="square"/><path d="M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}" stroke="#7dffb0" stroke-opacity=".18" stroke-width="1"/>`; }).join('');
  const embers = Array.from({ length: 60 }, () => `<circle cx="${f1(r() * 1200)}" cy="${f1(120 + r() * 250)}" r="${f1(0.8 + r() * 2.2)}" fill="${r() < 0.85 ? '#6dffa8' : '#ff4458'}" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`).join('');
  const fire = Array.from({ length: 7 }, (_, i) => `<ellipse cx="${100 + i * 170 + r() * 40}" cy="${330 + r() * 20}" rx="${90 + r() * 60}" ry="${36 + r() * 20}" fill="url(#gf)"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 380" preserveAspectRatio="xMidYMax slice">
  <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#010302"/><stop offset=".55" stop-color="#07140c"/><stop offset="1" stop-color="#0f2a19"/></linearGradient>
  <radialGradient id="mn" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d8f5e0" stop-opacity=".8"/><stop offset=".3" stop-color="#5fd890" stop-opacity=".25"/><stop offset="1" stop-color="#5fd890" stop-opacity="0"/></radialGradient>
  <radialGradient id="gf" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5dff9e" stop-opacity=".5"/><stop offset=".5" stop-color="#1fbf63" stop-opacity=".18"/><stop offset="1" stop-color="#1fbf63" stop-opacity="0"/></radialGradient>
  <radialGradient id="au" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="#2bbf6a" stop-opacity=".42"/><stop offset=".55" stop-color="#14703c" stop-opacity=".16"/><stop offset="1" stop-color="#14703c" stop-opacity="0"/></radialGradient><radialGradient id="ey" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff5a68"/><stop offset=".35" stop-color="#ff2238" stop-opacity=".75"/><stop offset="1" stop-color="#ff2238" stop-opacity="0"/></radialGradient>
  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8ffd0" stop-opacity="0"/><stop offset=".5" stop-color="#a8ffd0" stop-opacity=".08"/><stop offset="1" stop-color="#a8ffd0" stop-opacity="0"/></linearGradient>
  <linearGradient id="fd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030604" stop-opacity="0"/><stop offset="1" stop-color="#030604"/></linearGradient></defs>
  <rect width="1200" height="380" fill="url(#sk)"/>
  <circle cx="925" cy="100" r="190" fill="url(#mn)"/><circle cx="925" cy="100" r="56" fill="#e6fbe9" opacity=".8"/><ellipse cx="900" cy="96" rx="110" ry="7" fill="#020403" opacity=".5"/><ellipse cx="950" cy="126" rx="140" ry="9" fill="#020403" opacity=".45"/><ellipse cx="300" cy="70" rx="220" ry="14" fill="#0c1a12" opacity=".6"/><ellipse cx="600" cy="175" rx="290" ry="200" fill="url(#au)"/>
  <g transform="translate(-150 -46) scale(1.25)">
  <path d="M470 380V250C470 200 520 168 555 160C540 140 545 110 560 92C575 70 625 70 640 92C655 110 660 140 645 160C680 168 730 200 730 250V380Z" fill="#010201" opacity=".92"/>
  <path d="M556 92C530 120 520 170 500 220M644 92C670 120 680 170 700 220" stroke="#010201" stroke-width="14" fill="none" stroke-linecap="round" opacity=".9"/>
  <circle cx="584" cy="118" r="16" fill="url(#ey)"/><circle cx="616" cy="118" r="16" fill="url(#ey)"/><path d="M576 118l14-3M624 118l-14-3" stroke="#ffd0d4" stroke-width="2.2" stroke-linecap="round"/>
  ${swords}</g>
  <rect x="0" y="150" width="1200" height="90" fill="url(#fg)"/>
  <path d="M0 260 50 210 80 230 130 150 170 205 210 180 250 230 300 170 340 200 380 150 420 220V380H0zM780 220 830 150 870 200 910 160 960 220 1010 140 1060 200 1100 170 1150 220 1200 190V380H780z" fill="#020403"/>
  ${wall(330, 870, 262)}
  ${tower(360, 262, 34, 70, 46)}${tower(450, 262, 26, 96, 54)}${tower(520, 262, 30, 60, 40)}${tower(680, 262, 30, 60, 40)}${tower(750, 262, 26, 96, 54)}${tower(840, 262, 34, 70, 46)}
  ${tower(600, 262, 46, 120, 70)}
  <path d="M520 262h160l-20 -20h-120z" fill="#030504"/>
  ${fire}
  <rect x="0" y="250" width="1200" height="80" fill="url(#fg)"/>
  ${embers}
  <path d="M0 330 120 300 260 322 420 296 600 318 780 294 960 320 1100 298 1200 316V380H0z" fill="#020402"/>
  <rect x="0" y="260" width="1200" height="120" fill="url(#fd)"/></svg>`;
}

const url = (svg) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s{2,}/g, ' '))}")`;
// 정파 칸 모서리 매화(작은 그림)
const PLUM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${f1(12 + 5.4 * Math.sin(a * Math.PI / 180))}" cy="${f1(12 - 5.4 * Math.cos(a * Math.PI / 180))}" r="4.6" fill="#f59ac2" opacity=".9"/>`).join('')}<circle cx="12" cy="12" r="2.6" fill="#ffd66e"/></svg>`;
let done = false;
// 처음 한 번: 배경 그림을 CSS로 넣는다(문서에 style 하나)
export function ensureArt() {
  if (done) return; done = true;
  const st = document.createElement('style'); st.id = 'gd-art';
  st.textContent = `.gd-j .gd-hero{background-image:linear-gradient(90deg,rgba(20,12,22,.92) 0,rgba(20,12,22,.55) 38%,rgba(20,12,22,.08) 70%),${url(sceneJ())}}
.gd-m .gd-hero{background-image:linear-gradient(90deg,rgba(3,6,4,.94) 0,rgba(3,6,4,.6) 38%,rgba(3,6,4,.1) 70%),${url(sceneM())}}
.gd-j .gp::before{background-image:${url(PLUM)}}`;
  document.head.appendChild(st);
}
// 히어로에 떠다니는 꽃잎(정파)·불티(마교) 8개
export const drift = (g) => `<span class="gd-drift" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i style="--x:${(i * 13 + 7) % 100}%;--d:${(i * 1.7) % 9}s;--t:${11 + (i % 4) * 3}s"></i>`).join('')}</span>`;

// 큰 엠블럼: 정파 = 매화(화산의 매화 문양), 마교 = 천마의 눈과 귀화
export function seal(g, lv = 0) {
  const stars = Array.from({ length: lv }, (_, i) => { const a = (-90 + (i - (lv - 1) / 2) * 17) * Math.PI / 180; return `<circle cx="${f1(60 + 55 * Math.cos(a))}" cy="${f1(60 + 55 * Math.sin(a))}" r="3.2" class="gs-star"/>`; }).join('');
  if (g === 'j') {
    const pet = [0, 72, 144, 216, 288].map((a) => { const x = 60 + 19 * Math.sin(a * Math.PI / 180), y = 60 - 19 * Math.cos(a * Math.PI / 180); return `<circle cx="${f1(x)}" cy="${f1(y)}" r="17" fill="url(#pj)" stroke="#fff1f6" stroke-opacity=".55" stroke-width="1"/>`; }).join('');
    const stam = Array.from({ length: 10 }, (_, i) => { const a = (i * 36) * Math.PI / 180; return `<path d="M60 60L${f1(60 + 13 * Math.cos(a))} ${f1(60 + 13 * Math.sin(a))}" stroke="#c9774a" stroke-width="1"/><circle cx="${f1(60 + 13 * Math.cos(a))}" cy="${f1(60 + 13 * Math.sin(a))}" r="1.8" fill="#ffd66e"/>`; }).join('');
    return `<svg class="gd-sealsvg" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="pj" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff3f7"/><stop offset=".55" stop-color="#f7a9c9"/><stop offset="1" stop-color="#d9578f"/></radialGradient><radialGradient id="pb" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#3c1f36"/><stop offset="1" stop-color="#140a14"/></radialGradient><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0c4"/><stop offset=".5" stop-color="#e2b25a"/><stop offset="1" stop-color="#8a5a1c"/></linearGradient></defs>
      <circle cx="60" cy="60" r="52" fill="url(#pb)" stroke="url(#pg)" stroke-width="2.4"/><circle cx="60" cy="60" r="45" fill="none" stroke="#f59ac2" stroke-opacity=".4" stroke-dasharray="1.5 3"/>${pet}<circle cx="60" cy="60" r="8" fill="#ffe08a"/>${stam}${stars}</svg>`;
  }
  return `<svg class="gd-sealsvg" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="mb" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#0f2a1a"/><stop offset="1" stop-color="#010302"/></radialGradient><linearGradient id="me" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8f5d2"/><stop offset=".5" stop-color="#2bbf6a"/><stop offset="1" stop-color="#0b3a20"/></linearGradient><linearGradient id="mf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f8f48"/><stop offset=".55" stop-color="#4fe08f"/><stop offset="1" stop-color="#d6ffe6"/></linearGradient></defs>
    <path d="M60 6 74 22 96 16 98 38 114 52 104 70 112 92 90 98 78 114 60 106 42 114 30 98 8 92 16 70 6 52 22 38 24 16 46 22z" fill="url(#mb)" stroke="url(#me)" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M60 22c11 13 18 22 18 35a18 18 0 0 1-36 0c0-9 4-15 10-19 1 6 4 9 7 10-2-9-1-17 1-26z" fill="url(#mf)" opacity=".95"/>
    <path d="M40 72c6-4 13-5 18-2M80 72c-6-4-13-5-18-2" stroke="#010302" stroke-width="7" stroke-linecap="round"/><path d="M42 71l13-1M78 71l-13-1" stroke="#ff2238" stroke-width="3" stroke-linecap="round"/><path d="M42 71l13-1M78 71l-13-1" stroke="#ffd0d4" stroke-width="1" stroke-linecap="round"/>${stars}</svg>`;
}
