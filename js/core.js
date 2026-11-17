// 공통: 상태, 라우터, 이벤트 위임, 아이콘·로고, 모달, 챔피언/선수 선택창, 관리자 PIN, 이펙트
import { compute, LANES, LANE_NAME, pct } from './stats.js';

export const S = { store: null, key: 'local', st: null, dirty: true, page: 'home', arg: [], admin: false, champs: [], champBy: {}, ver: '' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const col = (name) => Object.values(S.store.data[name] || {});
export const settings = () => S.store.data.meta?.settings || {};
export const pname = (id) => esc(S.st?.P[id]?.name || S.store.data.players?.[id]?.name || '?');

// ---------- 아이콘 (선형 SVG) ----------
const I = {
  home: '<path d="M3 10.5 12 3l9 7.500V21h-6v-6H9v6H3z"/>',
  rank: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  today: '<path d="M14.500 17.500 3 6V3h3l11.500 11.500M13 19l6-6M16 16l4 4M14.500 6.500 18 3h3v3l-3.500 3.500M5 14l4 4M7 17l-3 3"/>',
  matches: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  players: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.500 1.700-2 3-2s2.400.5 3 2M15 10h3M15 14h3"/>',
  chem: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  champs: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  fearless: '<circle cx="12" cy="12" r="9"/><path d="m5.600 5.600 12.800 12.800"/>',
  auction: '<circle cx="12" cy="8.500" r="6.500"/><path d="M10.800 15v5.500a1.200 1.200 0 0 0 2.400 0V15M10.600 7l1.700-1.300v5.800M10.600 11.500h3.200"/>',
  maker: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.500 4l-3 16"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900 7 7M17 17l2.100 2.100M4.900 19.100 7 17M17 7l2.100-2.100"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.500 7.200L4 20l1-4.500A8 8 0 1 1 21 12z"/>',
  send: '<path d="m3 11 18-8-8 18-2-8z"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.5-3.500 3-5.500 6.500-5.500s6 2 6.500 5.500M16 5a3.500 3.500 0 0 1 0 6.500M18 14.800c2 .7 3.200 2.400 3.500 5.200"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-9 0 4-4 6-4 12 0 5 3 8 7 8z"/>',
  crown: '<path d="m3 7 4.500 4L12 4l4.500 7L21 7l-2 12H5z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.500 3.500 0 0 0 6 0zM19 7l-3 7a3.500 3.500 0 0 0 6 0z"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.500 8 8 9 4.500-1 8-4 8-9V6z"/>',
  down: '<path d="M12 4v12M6 12l6 6 6-6M5 21h14"/>',
  edit: '<path d="m4 20 1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.700 5.800 6.300.8-4.600 4.400 1.200 6.300L12 17.200 6.400 20.300l1.200-6.300L3 9.600l6.300-.8z"/>',
  mega: '<path d="M4 10v4h3l8 5V5L7 10zM18 9a4 4 0 0 1 0 6"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.500 4l-3 16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  kick: '<circle cx="10" cy="8" r="3.500"/><path d="M3.500 20c.5-3.500 3-5.500 6.500-5.500 1.200 0 2.300.2 3.200.7M16 14l5 5M21 14l-5 5"/>',
  fold: '<path d="M8 6l6 6-6 6M19 4v16"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 0 4h-2M7 4a2 2 0 0 0-2 2 2 2 0 0 0 2 2h9v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M9 12h5M9 16h5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.500 2h-15zM10 20.500a2 2 0 0 0 4 0"/>',
  save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9.500l5 5M22 9.500l-5 5"/>',
  talk: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.500h5"/>',
  gacha: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.600"/><path d="M9.500 6.500a6 6 0 0 1 3-.900" opacity=".5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.500 21c.8-4.200 3.800-7 7.500-7s6.700 2.800 7.500 7"/>',
  more: '<circle cx="5" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="19" cy="12" r="1.300" fill="currentColor"/>',
  replay: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 4l2 4M12 4l2 4M17 4l2 4M10 11.500v5l4.500-2.500z"/>',
};
// "⋯" 펼침 메뉴: 자주 안 쓰는 버튼(수정·삭제·비우기 등)을 접어 둔다. 항목은 원래 data-a를 그대로 쓴다.
export const ddMenu = (items, cls = '') => `<span class="dd ${cls}"><button class="btn ddb ${cls.includes('xs') ? 'xs' : ''}" data-a="dd" aria-label="더보기" title="더보기">${ic('more')}</button><span class="ddm">${items}</span></span>`;
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-a="dd"]'), keep = t?.parentElement;
  document.querySelectorAll('.dd.open').forEach((d) => d !== keep && d.classList.remove('open'));
  if (t) keep.classList.toggle('open');
});
export const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
const L = {
  top: '<path d="M3 3h15l-3.500 3.500H6.500v8L3 18z"/><path d="M21 6v15H6l3.500-3.500h8v-8z" opacity=".28"/><rect x="10" y="10" width="4" height="4" opacity=".28"/>',
  adc: '<path d="M21 21H6l3.500-3.500h8v-8L21 6z"/><path d="M3 18V3h15l-3.500 3.500h-8v8z" opacity=".28"/><rect x="10" y="10" width="4" height="4" opacity=".28"/>',
  mid: '<path d="M17 3h4v4L7 21H3v-4z"/><path d="M3 13V3h10L9.500 6.500h-3v3zM21 11v10H11l3.500-3.500h3v-3z" opacity=".28"/>',
  jg: '<path d="M12 22c-.8-3.200-2.600-5.800-6.500-8.500.9 2.600 1.300 4.300 3.300 7zM12 22c.8-3.200 2.600-5.800 6.500-8.500-.9 2.600-1.300 4.300-3.300 7zM12 17.500C11.200 12.500 10 8 7.500 2.500c3 2.700 4.500 6 4.500 9 0-3 1.500-6.300 4.500-9C14 8 12.800 12.500 12 17.500z"/>',
  sup: '<path d="M12 9.500 14 12l-2 10-2-10zM9 4.500h6l1 2-4 2.500-4-2.500zM1.500 6.500h6L10 10l-3.500 2.500L4 9.500H2.500zM22.500 6.500h-6L14 10l3.500 2.500L20 9.500h1.500z"/>',
};
export const LANE_ICON = Object.fromEntries(LANES.map((l) => [l, `<svg class="lic l-${l}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${L[l]}</svg>`]));
export const LANE_COLOR = { top: '#f08a4b', jg: '#4fd08b', mid: '#9b8cff', adc: '#ff6b81', sup: '#3fd0e0' };
// 로고: 메종 모노그램(가죽 바탕 + 금박 N·P). 글자는 글꼴 없이도 똑같이 보이도록 도형(path)으로 넣었다(Playfair Display·Cinzel에서 추출).
// anim=true 이면 시작 화면에서 테두리·P가 그려지고 N·무늬가 떠오른다. 90px 이상일 때만 아래 작은 글씨(MAISON · MMXXVI)를 넣는다.
const LG_N = 'M59.34 80.31L57.97 80.31L42.23 45.84Q42.23 45.84 42.23 45.34Q42.23 44.85 42.20 44.26Q42.16 43.67 42.13 43.17Q42.10 42.68 42.10 42.68L42.10 42.68Q42.60 40.38 42.44 39.30Q42.29 38.21 41.20 37.81Q40.12 37.41 37.70 37.34L37.70 37.34L38.01 36.10Q39.00 36.17 40.46 36.23Q41.92 36.29 43.53 36.29L43.53 36.29Q46.44 36.29 48.55 36.10L48.55 36.10L61.70 66.24Q61.70 66.24 61.51 67.26Q61.32 68.28 61.04 69.86Q60.77 71.44 60.52 73.27Q60.27 75.10 59.99 76.68Q59.71 78.26 59.53 79.29Q59.34 80.31 59.34 80.31L59.34 80.31ZM77.01 34.43L77.01 34.43Q75.40 34.43 74.09 35.36Q72.79 36.29 71.80 37.72L71.80 37.72Q68.95 41.93 65.97 52.53Q63.00 63.14 59.34 80.31L59.34 80.31L58.47 78.57Q59.40 74.42 60.45 69.61Q61.51 64.81 62.72 59.97Q63.93 55.14 65.20 50.74Q66.47 46.33 67.86 42.83Q69.26 39.33 70.69 37.22L70.69 37.22Q71.86 35.55 73.47 34.40Q75.09 33.25 77.38 33.25L77.38 33.25Q80.23 33.25 81.75 34.80Q83.27 36.35 83.27 38.52L83.27 38.52Q83.27 40.88 81.69 42.52Q80.11 44.16 77.63 44.16L77.63 44.16Q75.58 44.16 74.47 43.14Q73.35 42.12 73.35 40.51L73.35 40.51Q73.35 38.40 74.72 36.82Q76.08 35.24 78.00 34.68L78.00 34.68Q77.88 34.55 77.60 34.49Q77.32 34.43 77.01 34.43ZM26.73 83.41L26.73 83.41Q28.40 83.41 29.70 82.51Q31.01 81.61 31.94 80.06L31.94 80.06Q33.73 77.21 35.56 71.13Q37.39 65.06 39.28 56.44Q41.17 47.82 43.09 37.53L43.09 37.53L44.15 38.83Q43.16 43.92 42.07 49.16Q40.99 54.39 39.87 59.39Q38.76 64.38 37.58 68.65Q36.40 72.93 35.22 76.06Q34.04 79.19 32.93 80.68L32.93 80.68Q31.81 82.17 30.29 83.38Q28.77 84.59 26.29 84.59L26.29 84.59Q23.50 84.59 21.98 83.04Q20.46 81.49 20.46 79.32L20.46 79.32Q20.46 76.90 22.08 75.29Q23.69 73.68 26.11 73.68L26.11 73.68Q28.21 73.68 29.30 74.70Q30.39 75.72 30.39 77.33L30.39 77.33Q30.39 79.44 29.02 80.99Q27.66 82.54 25.67 83.16L25.67 83.16Q25.86 83.29 26.11 83.35Q26.36 83.41 26.73 83.41Z';
const LG_P = 'M56.82 54.35L56.82 53.43Q57.97 53.48 59.93 53.52Q61.88 53.57 63.81 53.57L63.81 53.57Q66.02 53.57 68.09 53.52Q70.16 53.48 71.03 53.48L71.03 53.48Q77.43 53.48 80.60 56.01Q83.78 58.54 83.78 62.54L83.78 62.54Q83.78 64.20 83.13 66.01Q82.49 67.83 80.95 69.37Q79.41 70.91 76.74 71.88Q74.07 72.84 70.02 72.84L70.02 72.84L65.33 72.84L65.33 71.92L69.56 71.92Q72.28 71.92 73.68 70.68Q75.08 69.44 75.61 67.42Q76.14 65.39 76.14 63.05L76.14 63.05Q76.14 58.68 74.85 56.51Q73.56 54.35 70.44 54.35L70.44 54.35Q68.64 54.35 68.11 55.13Q67.58 55.92 67.58 58.31L67.58 58.31L67.58 80.85Q67.58 82.64 67.95 83.52Q68.32 84.39 69.38 84.67Q70.44 84.94 72.51 84.99L72.51 84.99L72.51 86Q71.08 85.95 68.83 85.91Q66.57 85.86 64.09 85.86L64.09 85.86Q62.11 85.86 60.22 85.91Q58.34 85.95 56.82 86L56.82 86L56.82 85.08Q58.29 84.99 59.03 84.71Q59.77 84.44 60.02 83.61Q60.27 82.78 60.27 81.12L60.27 81.12L60.27 58.31Q60.27 56.61 60.02 55.80Q59.77 55.00 59.01 54.70Q58.25 54.40 56.82 54.35L56.82 54.35Z';
const LG_M = 'M21.92 102.56L24.33 98.72L24.37 99.45L22.50 102.45Q22.50 102.45 22.44 102.56Q22.38 102.66 22.32 102.82Q22.26 102.98 22.26 103.13L22.26 103.13L22.21 103.13L21.92 102.56ZM20.01 102.56L20.14 102.56L20.14 103L19.47 103L19.47 102.94Q19.48 102.94 19.52 102.94Q19.57 102.94 19.57 102.94L19.57 102.94Q19.73 102.94 19.86 102.84Q19.98 102.74 20.01 102.56L20.01 102.56ZM20.39 102.66L20.43 102.66Q20.43 102.66 20.43 102.67Q20.43 102.68 20.43 102.69L20.43 102.69Q20.43 102.78 20.50 102.86Q20.57 102.95 20.67 102.95L20.67 102.95L20.76 102.95L20.76 103L20.39 103L20.39 102.66ZM19.95 103L20.52 98.72L20.57 98.72L20.82 99.40L20.39 103L19.95 103ZM20.41 100.38L20.57 98.72L22.61 101.77L22.21 103.13L20.41 100.38ZM24.33 98.72L24.38 98.72L24.97 103L23.85 103L23.55 100.53L24.33 98.72ZM24.78 103L24.78 102.56L24.91 102.56Q24.94 102.74 25.07 102.84Q25.19 102.94 25.35 102.94L25.35 102.94Q25.35 102.94 25.40 102.94Q25.44 102.94 25.45 102.94L25.45 102.94L25.45 103L24.78 103ZM23.81 102.66L23.81 102.66L23.85 102.66L23.85 103L23.48 103L23.48 102.95L23.58 102.95Q23.67 102.95 23.74 102.86Q23.81 102.78 23.81 102.69L23.81 102.69Q23.81 102.68 23.81 102.67Q23.81 102.66 23.81 102.66ZM28.61 100.01L29.06 98.67L31.07 102.96L29.81 102.96L28.61 100.01ZM27.32 102.56L27.77 102.56Q27.71 102.68 27.74 102.77Q27.77 102.85 27.85 102.89Q27.92 102.94 28.00 102.94L28.00 102.94L28.05 102.94L28.05 103L26.74 103L26.74 102.94Q26.74 102.94 26.76 102.94Q26.79 102.94 26.79 102.94L26.79 102.94Q26.93 102.94 27.07 102.85Q27.22 102.77 27.32 102.56L27.32 102.56ZM29.00 98.67L29.06 98.67L29.06 99.50L27.58 102.98L27.12 102.98L28.68 99.51Q28.71 99.47 28.75 99.36Q28.80 99.24 28.86 99.11Q28.91 98.98 28.96 98.86Q29.00 98.74 29.00 98.67L29.00 98.67ZM27.88 101.64L29.62 101.64L29.62 101.91L27.88 101.91L27.88 101.64ZM29.65 102.56L29.65 102.56L30.88 102.56Q30.98 102.77 31.13 102.85Q31.27 102.94 31.41 102.94L31.41 102.94Q31.41 102.94 31.43 102.94Q31.46 102.94 31.46 102.94L31.46 102.94L31.46 103L29.36 103L29.36 102.94L29.42 102.94Q29.54 102.94 29.63 102.84Q29.72 102.74 29.65 102.56ZM33.53 98.80L34.59 98.80L34.59 103L33.53 103L33.53 98.80ZM33.53 102.56L33.54 102.56L33.54 103L33.06 103L33.06 102.94Q33.06 102.94 33.10 102.94Q33.14 102.94 33.14 102.94L33.14 102.94Q33.30 102.94 33.41 102.83Q33.52 102.72 33.53 102.56L33.53 102.56ZM33.54 98.80L33.54 99.24L33.53 99.24Q33.52 99.08 33.41 98.97Q33.30 98.86 33.14 98.86L33.14 98.86Q33.14 98.86 33.10 98.86Q33.06 98.86 33.06 98.86L33.06 98.86L33.06 98.80L33.54 98.80ZM34.57 103L34.57 102.56L34.59 102.56Q34.59 102.72 34.70 102.83Q34.82 102.94 34.97 102.94L34.97 102.94Q34.97 102.94 35.01 102.94Q35.04 102.94 35.05 102.94L35.05 102.94L35.05 103L34.57 103ZM34.59 99.24L34.57 99.24L34.57 98.80L35.05 98.80L35.05 98.86Q35.04 98.86 35.01 98.86Q34.97 98.86 34.97 98.86L34.97 98.86Q34.82 98.86 34.70 98.97Q34.59 99.08 34.59 99.24L34.59 99.24ZM38.58 98.72L38.58 98.72Q38.70 98.72 38.90 98.73Q39.10 98.74 39.31 98.76Q39.52 98.78 39.69 98.80Q39.85 98.82 39.90 98.85L39.90 98.85L39.81 99.71L39.75 99.71Q39.75 99.39 39.50 99.19Q39.26 98.99 38.85 98.99L38.85 98.99Q38.49 98.99 38.27 99.14Q38.06 99.30 38.05 99.53L38.05 99.53Q38.03 99.73 38.17 99.86Q38.32 99.98 38.52 100.09L38.52 100.09L39.66 100.73Q39.96 100.88 40.13 101.15Q40.29 101.42 40.27 101.80L40.27 101.80Q40.24 102.42 39.78 102.75Q39.32 103.08 38.53 103.08L38.53 103.08Q38.23 103.08 37.96 103.04Q37.70 102.99 37.50 102.90Q37.30 102.81 37.19 102.71L37.19 102.71Q37.14 102.57 37.14 102.36Q37.15 102.16 37.21 101.96Q37.27 101.76 37.36 101.63L37.36 101.63L37.41 101.63Q37.39 101.94 37.53 102.21Q37.68 102.48 37.96 102.65Q38.24 102.81 38.63 102.81L38.63 102.81Q39.04 102.80 39.26 102.62Q39.47 102.43 39.47 102.18L39.47 102.18Q39.47 101.99 39.34 101.83Q39.21 101.68 38.91 101.54L38.91 101.54L37.90 100.96Q37.53 100.77 37.37 100.47Q37.20 100.16 37.24 99.78L37.24 99.78Q37.27 99.45 37.44 99.21Q37.61 98.97 37.90 98.84Q38.19 98.72 38.58 98.72ZM39.11 98.78L39.91 98.78L39.90 98.90L39.11 98.90L39.11 98.78ZM44.81 98.72L44.81 98.72Q45.56 98.72 46.10 98.98Q46.65 99.24 46.94 99.73Q47.24 100.22 47.24 100.90L47.24 100.90Q47.24 101.58 46.94 102.07Q46.65 102.56 46.10 102.82Q45.56 103.08 44.81 103.08L44.81 103.08Q44.06 103.08 43.52 102.82Q42.97 102.56 42.68 102.07Q42.38 101.58 42.38 100.90L42.38 100.90Q42.38 100.22 42.68 99.73Q42.97 99.24 43.52 98.98Q44.06 98.72 44.81 98.72ZM44.81 102.81L44.81 102.81Q45.20 102.81 45.49 102.58Q45.77 102.35 45.93 101.92Q46.08 101.49 46.08 100.90L46.08 100.90Q46.08 100.31 45.93 99.88Q45.77 99.45 45.49 99.22Q45.20 98.99 44.81 98.99L44.81 98.99Q44.41 98.99 44.13 99.22Q43.85 99.45 43.70 99.88Q43.54 100.31 43.54 100.90L43.54 100.90Q43.54 101.49 43.70 101.92Q43.85 102.35 44.13 102.58Q44.41 102.81 44.81 102.81ZM49.77 99.47L49.70 98.71L53.64 102.33L53.71 103.08L49.77 99.47ZM49.71 102.57L49.73 102.57L49.73 103L49.23 103L49.23 102.94Q49.23 102.94 49.29 102.94Q49.34 102.94 49.35 102.94L49.35 102.94Q49.50 102.94 49.61 102.83Q49.71 102.72 49.71 102.57L49.71 102.57ZM50.74 102.57L50.76 102.57Q50.76 102.72 50.87 102.83Q50.97 102.94 51.12 102.94L51.12 102.94Q51.13 102.94 51.18 102.94Q51.24 102.94 51.24 102.94L51.24 102.94L51.24 103L50.74 103L50.74 102.57ZM49.64 98.71L49.70 98.71L50.75 99.82L50.76 103L49.71 103L49.71 99.46Q49.71 99.12 49.68 98.91Q49.64 98.71 49.64 98.71L49.64 98.71ZM52.65 98.80L53.69 98.80L53.69 102.32Q53.69 102.55 53.71 102.72Q53.73 102.90 53.75 102.99Q53.76 103.08 53.76 103.08L53.76 103.08L53.71 103.08L52.65 101.90L52.65 98.80ZM53.67 98.80L54.17 98.80L54.17 98.86Q54.17 98.86 54.12 98.86Q54.06 98.86 54.06 98.86L54.06 98.86Q53.91 98.86 53.81 98.97Q53.70 99.07 53.69 99.23L53.69 99.23L53.67 99.23L53.67 98.80ZM52.17 98.86L52.17 98.80L52.67 98.80L52.67 99.23L52.65 99.23Q52.65 99.07 52.54 98.97Q52.44 98.86 52.28 98.86L52.28 98.86Q52.28 98.86 52.23 98.86Q52.17 98.86 52.17 98.86L52.17 98.86ZM59.72 101.36L59.72 101.36Q59.53 101.36 59.38 101.22Q59.24 101.07 59.24 100.88L59.24 100.88Q59.24 100.67 59.38 100.53Q59.53 100.39 59.72 100.39L59.72 100.39Q59.93 100.39 60.07 100.53Q60.21 100.67 60.21 100.88L60.21 100.88Q60.21 101.07 60.07 101.22Q59.93 101.36 59.72 101.36ZM67.47 102.56L69.88 98.72L69.93 99.45L68.05 102.45Q68.05 102.45 67.99 102.56Q67.93 102.66 67.87 102.82Q67.81 102.98 67.81 103.13L67.81 103.13L67.76 103.13L67.47 102.56ZM65.56 102.56L65.69 102.56L65.69 103L65.02 103L65.02 102.94Q65.03 102.94 65.07 102.94Q65.12 102.94 65.12 102.94L65.12 102.94Q65.28 102.94 65.41 102.84Q65.53 102.74 65.56 102.56L65.56 102.56ZM65.94 102.66L65.98 102.66Q65.98 102.66 65.98 102.67Q65.98 102.68 65.98 102.69L65.98 102.69Q65.98 102.78 66.05 102.86Q66.12 102.95 66.22 102.95L66.22 102.95L66.31 102.95L66.31 103L65.94 103L65.94 102.66ZM65.50 103L66.07 98.72L66.12 98.72L66.37 99.40L65.94 103L65.50 103ZM65.96 100.38L66.12 98.72L68.16 101.77L67.76 103.13L65.96 100.38ZM69.88 98.72L69.93 98.72L70.52 103L69.40 103L69.10 100.53L69.88 98.72ZM70.33 103L70.33 102.56L70.47 102.56Q70.50 102.74 70.62 102.84Q70.74 102.94 70.90 102.94L70.90 102.94Q70.90 102.94 70.95 102.94Q70.99 102.94 71.00 102.94L71.00 102.94L71.00 103L70.33 103ZM69.36 102.66L69.36 102.66L69.40 102.66L69.40 103L69.03 103L69.03 102.95L69.13 102.95Q69.22 102.95 69.29 102.86Q69.36 102.78 69.36 102.69L69.36 102.69Q69.36 102.68 69.36 102.67Q69.36 102.66 69.36 102.66ZM74.84 102.56L77.24 98.72L77.29 99.45L75.42 102.45Q75.42 102.45 75.36 102.56Q75.30 102.66 75.24 102.82Q75.18 102.98 75.18 103.13L75.18 103.13L75.13 103.13L74.84 102.56ZM72.92 102.56L73.06 102.56L73.06 103L72.39 103L72.39 102.94Q72.40 102.94 72.44 102.94Q72.49 102.94 72.49 102.94L72.49 102.94Q72.65 102.94 72.77 102.84Q72.90 102.74 72.92 102.56L72.92 102.56ZM73.31 102.66L73.35 102.66Q73.35 102.66 73.35 102.67Q73.35 102.68 73.35 102.69L73.35 102.69Q73.35 102.78 73.42 102.86Q73.49 102.95 73.58 102.95L73.58 102.95L73.68 102.95L73.68 103L73.31 103L73.31 102.66ZM72.86 103L73.43 98.72L73.49 98.72L73.73 99.40L73.31 103L72.86 103ZM73.33 100.38L73.49 98.72L75.53 101.77L75.13 103.13L73.33 100.38ZM77.24 98.72L77.30 98.72L77.89 103L76.76 103L76.47 100.53L77.24 98.72ZM77.70 103L77.70 102.56L77.83 102.56Q77.86 102.74 77.98 102.84Q78.11 102.94 78.27 102.94L78.27 102.94Q78.27 102.94 78.31 102.94Q78.36 102.94 78.37 102.94L78.37 102.94L78.37 103L77.70 103ZM76.73 102.66L76.73 102.66L76.77 102.66L76.77 103L76.40 103L76.40 102.95L76.49 102.95Q76.59 102.95 76.66 102.86Q76.73 102.78 76.73 102.69L76.73 102.69Q76.73 102.68 76.73 102.67Q76.73 102.66 76.73 102.66ZM80.16 98.80L81.39 98.80L84.13 102.99L82.88 102.99L80.16 98.80ZM80.37 102.59L80.92 102.57Q80.87 102.65 80.89 102.74Q80.91 102.83 80.98 102.88Q81.05 102.94 81.13 102.94L81.13 102.94Q81.13 102.94 81.17 102.94Q81.21 102.94 81.21 102.94L81.21 102.94L81.21 103L79.69 103L79.69 102.94L79.77 102.94Q79.97 102.94 80.12 102.83Q80.27 102.72 80.37 102.59L80.37 102.59ZM80.08 103L81.63 100.85L81.96 101.06L80.62 103L80.08 103ZM82.61 102.57L82.61 102.57L83.87 102.59Q83.96 102.73 84.12 102.83Q84.29 102.94 84.47 102.94L84.47 102.94L84.56 102.94L84.56 103L82.32 103L82.32 102.94Q82.32 102.94 82.36 102.94Q82.40 102.94 82.40 102.94L82.40 102.94Q82.52 102.94 82.60 102.82Q82.68 102.70 82.61 102.57ZM79.74 98.80L81.96 98.80L81.96 98.86Q81.96 98.86 81.92 98.86Q81.89 98.86 81.89 98.86L81.89 98.86Q81.80 98.86 81.74 98.92Q81.67 98.97 81.65 99.06Q81.63 99.15 81.68 99.23L81.68 99.23L80.43 99.21Q80.33 99.08 80.17 98.97Q80.01 98.86 79.82 98.86L79.82 98.86L79.74 98.86L79.74 98.80ZM83.39 98.80L83.93 98.80L82.47 100.98L82.21 100.64L83.39 98.80ZM82.82 98.80L84.33 98.80L84.33 98.86L84.25 98.86Q84.06 98.86 83.91 98.97Q83.75 99.08 83.65 99.21L83.65 99.21L83.11 99.23Q83.16 99.15 83.14 99.06Q83.12 98.97 83.05 98.92Q82.98 98.86 82.90 98.86L82.90 98.86Q82.90 98.86 82.86 98.86Q82.83 98.86 82.83 98.86L82.83 98.86L82.82 98.80ZM86.26 98.80L87.50 98.80L90.24 102.99L88.98 102.99L86.26 98.80ZM86.48 102.59L87.03 102.57Q86.97 102.65 86.99 102.74Q87.01 102.83 87.09 102.88Q87.16 102.94 87.24 102.94L87.24 102.94Q87.24 102.94 87.27 102.94Q87.31 102.94 87.31 102.94L87.31 102.94L87.31 103L85.80 103L85.80 102.94L85.88 102.94Q86.07 102.94 86.22 102.83Q86.37 102.72 86.48 102.59L86.48 102.59ZM86.19 103L87.73 100.85L88.07 101.06L86.73 103L86.19 103ZM88.71 102.57L88.71 102.57L89.97 102.59Q90.06 102.73 90.23 102.83Q90.39 102.94 90.58 102.94L90.58 102.94L90.66 102.94L90.66 103L88.43 103L88.43 102.94Q88.43 102.94 88.47 102.94Q88.50 102.94 88.50 102.94L88.50 102.94Q88.63 102.94 88.71 102.82Q88.79 102.70 88.71 102.57ZM85.84 98.80L88.06 98.80L88.06 98.86Q88.06 98.86 88.03 98.86Q87.99 98.86 87.99 98.86L87.99 98.86Q87.91 98.86 87.84 98.92Q87.78 98.97 87.75 99.06Q87.73 99.15 87.79 99.23L87.79 99.23L86.53 99.21Q86.44 99.08 86.28 98.97Q86.12 98.86 85.93 98.86L85.93 98.86L85.84 98.86L85.84 98.80ZM89.49 98.80L90.03 98.80L88.57 100.98L88.32 100.64L89.49 98.80ZM88.93 98.80L90.44 98.80L90.44 98.86L90.36 98.86Q90.17 98.86 90.01 98.97Q89.86 99.08 89.76 99.21L89.76 99.21L89.22 99.23Q89.27 99.15 89.25 99.06Q89.22 98.97 89.16 98.92Q89.09 98.86 89.01 98.86L89.01 98.86Q89.01 98.86 88.97 98.86Q88.93 98.86 88.93 98.86L88.93 98.86L88.93 98.80ZM94.73 101.79L94.28 103.13L92.25 98.84L93.51 98.84L94.73 101.79ZM94.34 103.13L94.28 103.13L94.27 102.30L95.77 98.82L96.23 98.82L94.66 102.29Q94.63 102.33 94.58 102.44Q94.54 102.56 94.48 102.69Q94.43 102.82 94.39 102.94Q94.34 103.06 94.34 103.13L94.34 103.13ZM96.04 99.24L95.59 99.24Q95.67 99.06 95.57 98.96Q95.48 98.86 95.36 98.86L95.36 98.86L95.30 98.86L95.30 98.80L96.62 98.80L96.62 98.86Q96.62 98.86 96.59 98.86Q96.56 98.86 96.56 98.86L96.56 98.86Q96.43 98.86 96.28 98.95Q96.14 99.03 96.04 99.24L96.04 99.24ZM93.68 99.24L93.68 99.24L92.44 99.24Q92.35 99.03 92.20 98.95Q92.05 98.86 91.91 98.86L91.91 98.86Q91.91 98.86 91.89 98.86Q91.87 98.86 91.87 98.86L91.87 98.86L91.87 98.80L93.96 98.80L93.96 98.86L93.91 98.86Q93.79 98.86 93.70 98.96Q93.62 99.06 93.68 99.24ZM98.69 98.80L99.75 98.80L99.75 103L98.69 103L98.69 98.80ZM98.69 102.56L98.71 102.56L98.71 103L98.23 103L98.23 102.94Q98.23 102.94 98.27 102.94Q98.31 102.94 98.31 102.94L98.31 102.94Q98.46 102.94 98.57 102.83Q98.69 102.72 98.69 102.56L98.69 102.56ZM98.71 98.80L98.71 99.24L98.69 99.24Q98.69 99.08 98.57 98.97Q98.46 98.86 98.31 98.86L98.31 98.86Q98.31 98.86 98.27 98.86Q98.23 98.86 98.23 98.86L98.23 98.86L98.23 98.80L98.71 98.80ZM99.74 103L99.74 102.56L99.75 102.56Q99.76 102.72 99.87 102.83Q99.98 102.94 100.14 102.94L100.14 102.94Q100.14 102.94 100.17 102.94Q100.21 102.94 100.22 102.94L100.22 102.94L100.22 103L99.74 103ZM99.75 99.24L99.74 99.24L99.74 98.80L100.22 98.80L100.22 98.86Q100.21 98.86 100.17 98.86Q100.14 98.86 100.14 98.86L100.14 98.86Q99.98 98.86 99.87 98.97Q99.76 99.08 99.75 99.24L99.75 99.24Z';
export function logo(anim = false, size = 44) {
  return `<svg class="logo maison ${anim ? 'draw' : ''}" width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" aria-label="NAEJEONPOT">
    <defs><linearGradient id="lg-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4f2d"/><stop offset=".55" stop-color="#4f311b"/><stop offset="1" stop-color="#2e1c0f"/></linearGradient>
      <linearGradient id="lg-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbeec8"/><stop offset=".55" stop-color="#e2be78"/><stop offset="1" stop-color="#b8863f"/></linearGradient>
      <pattern id="lg-pt" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M10 6l1.2 2.8L14 10l-2.8 1.2L10 14l-1.2-2.8L6 10l2.8-1.2z" fill="#e2c07c" opacity=".2"/><circle r="1.3" fill="#e2c07c" opacity=".16"/><circle cx="20" cy="20" r="1.3" fill="#e2c07c" opacity=".16"/></pattern></defs>
    <rect x="6" y="6" width="108" height="108" rx="22" fill="url(#lg-l)"/><rect class="lg-gem lg-pat" x="6" y="6" width="108" height="108" rx="22" fill="url(#lg-pt)"/>
    <path class="lg-hex" pathLength="1" d="M28 7H92A21 21 0 0 1 113 28V92A21 21 0 0 1 92 113H28A21 21 0 0 1 7 92V28A21 21 0 0 1 28 7Z" stroke="url(#lg-g)" stroke-width="1.6" stroke-opacity=".75"/>
    <rect class="lg-gem lg-st" x="12" y="12" width="96" height="96" rx="17" stroke="url(#lg-g)" stroke-width="1.5" stroke-dasharray="3 2.4"/>
    <path class="lg-gem lg-mn" d="${LG_N}" fill="url(#lg-g)"/>
    <path class="lg-n lg-mp" pathLength="1" d="${LG_P}" stroke="url(#lg-g)" stroke-width="2"/>
    ${size >= 90 ? `<path class="lg-gem lg-mt" d="${LG_M}" fill="#ecd29a"/>` : ''}
  </svg>`;
}

const pages = {}, acts = {};
export const page = (id, def) => (pages[id] = def);
export const act = (name, fn) => (acts[name] = fn);
export const NAV = [
  ['', 'LEAGUE'], ['home', '홈'], ['rank', '랭킹'], ['matches', '경기 기록'], ['players', '선수 카드'],
  ['', 'ANALYSIS'], ['champs', '챔피언'], ['chem', '케미'],
  ['', 'PLAY'], ['today', '오늘의 내전'], ['gacha', '가챠'], ['auction', '팀 경매'], ['replay', '리플레이 분석'], ['admin', '관리'],
  ['', 'COMMUNITY'], ['talk', '익명 게시판'],
  ['', 'CREDITS'], ['maker', '제작자'],
];
export function go(hash) { location.hash = hash; }
function parseHash() {
  const [p, ...arg] = location.hash.replace(/^#\/?/, '').split('/');
  S.page = pages[p] ? p : 'home'; S.arg = arg.map(decodeURIComponent);
}
let raf = 0, lastRoute = '';
export function refresh(dataChanged) {
  if (dataChanged) S.dirty = true;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
}
export function render() {
  if (S.dirty) { S.st = compute(col('players'), col('matches'), settings()); S.dirty = false; }
  const main = document.getElementById('main');
  const f = document.activeElement, fid = f && main.contains(f) ? f.id : '', sel = fid && f.selectionStart;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.p === S.page));
  document.querySelectorAll('#tabbar [data-p]').forEach((a) => a.classList.toggle('on', a.dataset.p === S.page || (a.dataset.p === 'more' && !TABS.includes(S.page))));
  document.getElementById('league').textContent = settings().leagueName || '친구 내전 리그';
  const route = S.page + '/' + S.arg.join('/'), entering = route !== lastRoute;
  lastRoute = route;
  main.innerHTML = pages[S.page].render(...S.arg);
  if (entering) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); clearTimeout(render.t); render.t = setTimeout(() => main.classList.remove('enter'), 900); }
  lazyArt(main);
  pages[S.page].after?.(entering);
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(sel, sel); } catch {} } }
}
// 모바일 하단 탭바: 자주 쓰는 4개 + 더보기(나머지 메뉴를 아래에서 올라오는 창으로)
const TABS = ['home', 'rank', 'today', 'matches'];
const MORE_IC = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
function tabbar() {
  const nm = Object.fromEntries(NAV.filter((n) => n[0]).map(([p, t]) => [p, t]));
  const short = { matches: '기록', today: '내전' };
  const el = document.createElement('nav'); el.id = 'tabbar';
  el.innerHTML = TABS.map((p) => `<a href="#/${p}" data-p="${p}" class="${p === 'today' ? 'tb-main' : ''}"><i>${ic(p)}</i><span>${short[p] || nm[p]}</span></a>`).join('') + `<button data-p="more" data-a="tabMore"><i>${MORE_IC}</i><span>더보기</span></button>`;
  document.body.appendChild(el);
}
export const moreHooks = []; // 더보기 창 아래쪽 버튼을 다른 모듈이 덧붙일 때 쓴다
act('tabMore', () => {
  let grp = '';
  const body = NAV.map(([p, t]) => (p ? `<a class="mm-it ${p === S.page ? 'on' : ''}" href="#/${p}" data-a="close">${ic(p)}<span>${t}</span></a>` : `${grp ? '</div>' : ''}<h6>${(grp = t)}</h6><div class="mm-g">`)).join('') + '</div>';
  modal(`${mh('메뉴')}<div class="mm">${body}</div><div class="row mm-foot">${liteBtn()}${moreHooks.map((f) => f()).join('')}<button class="btn" data-a="copyLink">초대 링크 복사</button></div>`, 'more-sheet');
});
// ---------- 가벼운 모드 (PC방·저사양·게임과 같이 켜 둘 때) ----------
// 장식용 반복 애니메이션·흐림 효과·배경 캔버스를 끈다. 저장된 선택이 없으면 기기 사양과 처음 몇 초의 프레임으로 자동 결정한다.
// 창이 비활성(게임 화면을 보는 중)이면 본문 장식 애니메이션을 멈춘다. 게시판·주사위 같은 중계 연출(#modal)은 계속 돈다.
const LITE_KEY = 'naejeon:lite';
export const calm = () => document.body.classList.contains('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;
export function setLite(on, save = true) {
  document.body.classList.toggle('lite', on);
  if (save) localStorage.setItem(LITE_KEY, on ? '1' : '0');
  document.querySelectorAll('[data-a="liteToggle"]').forEach((b) => { b.classList.toggle('on', on); b.querySelector('u') && (b.querySelector('u').textContent = on ? 'ON' : 'OFF'); });
}
function initPerf() {
  const pref = localStorage.getItem(LITE_KEY);
  if (pref) setLite(pref === '1', false);
  else if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) setLite(true, false);
  else { // 프레임이 자주 끊기면 자동으로 가볍게: 접속 4초 뒤 한 번, 그 뒤에도 30초마다 2초씩 확인(롤을 켜서 느려진 경우 등)
    const check = () => {
      if (document.body.classList.contains('lite') || localStorage.getItem(LITE_KEY)) return clearInterval(timer);
      if (document.hidden || !document.hasFocus()) return; // 다른 창(게임)을 보고 있으면 애니메이션이 멈춰 있으니 재지 않는다
      let n = 0, slow = 0, last = performance.now();
      requestAnimationFrame(function f(t) {
        if (n++ && t - last > 40) slow++;
        last = t;
        if (n < 120) return requestAnimationFrame(f);
        if (slow > 18 && !document.hidden && !document.body.classList.contains('lite') && !localStorage.getItem(LITE_KEY)) { setLite(true, false); clearInterval(timer); toast('화면이 버벅여서 가벼운 모드로 바꿨어요'); }
      });
    };
    setTimeout(check, 4000);
    const timer = setInterval(check, 30e3);
  }
  const idle = () => document.body.classList.toggle('idle', document.hidden || !document.hasFocus());
  addEventListener('blur', idle); addEventListener('focus', idle); document.addEventListener('visibilitychange', idle);
}
act('liteToggle', () => { const on = !document.body.classList.contains('lite'); setLite(on); toast(on ? '가벼운 모드: 장식 효과를 줄였어요' : '가벼운 모드를 껐어요'); });
const liteBtn = () => `<button class="btn ghost xs lite-btn ${document.body.classList.contains('lite') ? 'on' : ''}" data-a="liteToggle" title="장식 효과를 줄여 PC방·저사양 PC·게임과 함께 켜 둘 때 가볍게">${ic('bolt')}가벼운 모드 <u>${document.body.classList.contains('lite') ? 'ON' : 'OFF'}</u></button>`;
const navFold = () => { try { return JSON.parse(localStorage.getItem('naejeon:navfold')) || []; } catch { return []; } };
act('navGrp', (d) => {
  const f = navFold(), on = !f.includes(d.g), next = on ? [...f, d.g] : f.filter((x) => x !== d.g);
  try { localStorage.setItem('naejeon:navfold', JSON.stringify(next)); } catch {}
  document.querySelectorAll(`#nav [data-g="${d.g}"]`).forEach((el) => el.classList.toggle('fold', on));
  document.querySelector(`#nav .nav-h[data-g="${d.g}"]`)?.setAttribute('aria-expanded', String(!on));
});
export function initShell() {
  document.getElementById('brandlogo').innerHTML = logo(false, 40);
  initPerf();
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', liteBtn());
  tabbar();
  // 왼쪽 메뉴: 큰 분류(LEAGUE·ANALYSIS…) 제목을 누르면 접고 편다. 접은 분류도 지금 보고 있는 메뉴 하나는 보여 준다. 접은 상태는 이 브라우저에 기억
  const fold = navFold();
  let grp = '';
  document.getElementById('nav').innerHTML = NAV.map(([p, t, soon]) => (p ? `<a href="#/${p}" data-p="${p}">${ic(p)}<span>${t}</span>${soon ? `<em>${soon}</em>` : ''}</a>`
    : `${grp ? '</div>' : ''}<button type="button" class="nav-h ${fold.includes(t) ? 'fold' : ''}" data-a="navGrp" data-g="${(grp = t)}" aria-expanded="${!fold.includes(t)}"><h6>${t}</h6><i class="nav-chev"></i></button><div class="nav-g ${fold.includes(t) ? 'fold' : ''}" data-g="${t}">`)).join('') + '</div>';
  document.getElementById('mode').innerHTML = S.store.mode === 'local' ? '<span class="tag warn" title="이 브라우저에만 저장됩니다">체험 모드</span>' : ''; // 실제 리그에서는 표시하지 않는다(사이드바 공간 절약)
  const on = (type, attr) => document.addEventListener(type, (e) => {
    const el = e.target.closest?.(`[${attr}]`);
    if (el && acts[el.getAttribute(attr)]) acts[el.getAttribute(attr)](el.dataset, el, e);
  });
  on('click', 'data-a'); on('change', 'data-c'); on('input', 'data-i');
  window.addEventListener('hashchange', () => { parseHash(); window.scrollTo(0, 0); document.getElementById('main').scrollTop = 0; render(); });
  parseHash(); render();
}

// ---------- 표시 도우미 ----------
export const fmtDT = (at) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const fmtDay = (k) => { const [y, m, d] = k.split('-'); return `${y}.${m}.${d}`; };
export const wr = (o) => (o && o.g ? `${pct(o.w, o.g)}% <small>(${o.g})</small>` : '<span class="mut">-</span>');
export const wrClass = (v) => (v === null || v === undefined ? '' : v >= 60 ? 'good' : v <= 40 ? 'bad' : '');
export const wrBar = (w, g) => { const v = pct(w, g); return g ? `<span class="wrb"><i style="width:${v}%" class="${v >= 60 ? 'hi' : v >= 45 ? 'mid' : 'lo'}"></i></span><b class="mono ${wrClass(v)}">${v}%</b>` : '<span class="mut">-</span>'; };
export const dots = (arr) => `<span class="dots">${[...Array(5 - arr.length).fill(null), ...arr].map((r) => `<i class="${r === null ? '' : r ? 'w' : 'l'}">${r === null ? '' : r ? 'W' : 'L'}</i>`).join('')}</span>`;
export const streak = (n) => (n >= 2 ? `<span class="stk w">${ic('flame')}${n}연승</span>` : n <= -2 ? `<span class="stk l">${-n}연패</span>` : '');
export const laneTag = (l) => `<span class="lane">${LANE_ICON[l]}${LANE_NAME[l]}</span>`;
export const titleChips = (s, max = 99) => s.titles.slice(0, max).map((t) => `<span class="chip" title="${esc(t.d)}">${t.e} ${t.n}</span>`).join('') + (s.titles.length > max ? `<span class="chip mut">+${s.titles.length - max}</span>` : '');
export function champIcon(name, cls = '') {
  if (!name) return `<span class="ci empty ${cls}"></span>`;
  const c = S.champBy[name];
  return c ? `<img class="ci ${cls}" src="${c.img}" alt="${esc(name)}" title="${esc(name)}" loading="lazy">` : `<span class="ci txt ${cls}" title="${esc(name)}">${esc(name.slice(0, 2))}</span>`;
}
// 챔피언 이미지 3종. 파일 이름이 목록의 id와 다른 챔피언은 IMG_ID에서 바로잡는다.
//   artUrl   : 챔피언이 한가운데 오도록 맞춘 가로 일러스트(1280x720). 얼굴이 항상 가로 중앙·위에서 22% 근처라서
//              가로로 긴 칸(랭킹 행, 라인업 칸, 듀오, 배너)에 쓴다. CSS도 `center 22%` 기준으로 맞춰 둔다.
//   tileUrl  : 얼굴 중심 정사각. 세로로 길거나 정사각에 가까운 카드에 쓴다.
//   splashUrl: 원본 일러스트(구도가 제각각이라 큰 배경에만).
const IMG_ID = { Fiddlesticks: 'FiddleSticks' };
const imgId = (name) => { const id = S.champBy[name]?.id; return id ? IMG_ID[id] || id : ''; };
const cimg = (kind) => (name) => (imgId(name) ? `https://ddragon.leagueoflegends.com/cdn/img/champion/${kind}/${imgId(name)}_${S.champBy[name].skin || 0}.jpg` : '');
export const splashUrl = cimg('splash');
export const tileUrl = cimg('tiles');
export const artUrl = cimg('centered');
// ---------- 선수 카드 스킨 ----------
// 선수의 대표 챔피언은 스킨 일러스트로 보여 준다(얼굴 중심 이미지라 누구인지 알아볼 수 있다).
//   1) 선수 문서의 skin{champ,num,name} (선수 카드의 "스킨 변경"에서 고른 것, num 0 = 기본 일러스트)
//   2) SKIN_PREF에 적어 둔 지정 스킨   3) 그 챔피언의 스킨 중 선수마다 정해지는 하나(자동)
// 스킨 목록은 패치 데이터에서 챔피언별로 한 번만 받아 브라우저에 저장한다. 받기 전에는 기본 일러스트가 보인다.
const SKIN_PREF = [{ player: '혜나', champ: '유미', kw: ['불꽃놀이', '폭죽'], num: 70 }];
const skinDB = (() => { try { return JSON.parse(localStorage.getItem('naejeon:skins2')) || {}; } catch { return {}; } })();
const skinWait = new Set(); let skinTimer = 0;
export const baseChamp = (name) => S.champBy[name]?.base || name;
export function skinList(name) {
  const c = S.champBy[name]; if (!c || c.base || !S.ver) return null;
  if (skinDB.ver !== S.ver) { skinDB.ver = S.ver; skinDB.by = {}; skinDB.bad = {}; }
  if (skinDB.by[c.id]) { const bad = skinDB.bad?.[c.id]; return bad ? skinDB.by[c.id].filter((x) => !bad.includes(x[0])) : skinDB.by[c.id]; }
  if (skinWait.has(c.id)) return null;
  skinWait.add(c.id);
  fetch(`https://ddragon.leagueoflegends.com/cdn/${S.ver}/data/ko_KR/champion/${c.id}.json`).then((r) => r.json()).then((d) => {
    skinDB.by[c.id] = d.data[c.id].skins.filter((x) => x.num > 0).map((x) => [x.num, x.name]);
    try { localStorage.setItem('naejeon:skins2', JSON.stringify(skinDB)); } catch {}
    clearTimeout(skinTimer); skinTimer = setTimeout(() => refresh(), 200); // 여러 챔피언이 한꺼번에 도착해도 화면은 한 번만 다시 그린다
  }).catch(() => {});
  return null;
}
// 일러스트가 아직 제공되지 않는 스킨(이미지 서버에 파일이 없음)은 "쓸 수 없는 스킨"으로 기록해 선택지와 자동 지정에서 뺀다.
// 실제로 화면에 쓰려는 스킨만 한 번씩 확인한다(전체를 미리 받아 보지 않는다).
const skinChecked = new Set();
const skinUrl = (c, kind, num) => `https://ddragon.leagueoflegends.com/cdn/img/champion/${kind}/${IMG_ID[c.id] || c.id}_${num}.jpg`;
export function skinBad(name, num) {
  const c = S.champBy[baseChamp(name)]; if (!c || !num || !navigator.onLine) return; // 인터넷이 끊겨서 실패한 경우는 기록하지 않는다
  const list = ((skinDB.bad ||= {})[c.id] ||= []);
  if (list.includes(num)) return;
  list.push(num);
  try { localStorage.setItem('naejeon:skins2', JSON.stringify(skinDB)); } catch {}
  clearTimeout(skinTimer); skinTimer = setTimeout(() => refresh(), 200);
}
function skinProbe(name, num) {
  const c = S.champBy[name], k = c && c.id + '_' + num; if (!c || !num || skinChecked.has(k)) return;
  skinChecked.add(k);
  for (const kind of ['tiles', 'centered']) { const im = new Image(); im.onerror = () => skinBad(name, num); im.src = skinUrl(c, kind, num); }
}
const isBad = (name, num) => !!skinDB.bad?.[S.champBy[name]?.id]?.includes(num);
function skinAlias(name, num, sname) {
  const c = S.champBy[name]; if (!c || !num) return name;
  skinProbe(name, num);
  const key = sname || `${name} 스킨 ${num}`;
  S.champBy[key] ||= { id: c.id, name: key, base: name, skin: num, img: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${IMG_ID[c.id] || c.id}_${num}.jpg` };
  return key;
}
function skinFor(s, name) {
  if (!S.champBy[name]) return name;
  const own = s.p.skin;
  if (own && !own.pick && own.champ === name && !isBad(name, +own.num)) return skinAlias(name, +own.num || 0, own.name); // 가챠로 고른 것(pick)은 여기서 쓰지 않는다
  const pref = SKIN_PREF.find((x) => x.champ === name && s.name.includes(x.player)), list = skinList(name);
  if (!list) return pref && !isBad(name, pref.num) ? skinAlias(name, pref.num, `${pref.kw[0]} ${name}`) : name;
  const hit = pref && list.find((x) => pref.kw.some((k) => x[1].includes(k)));
  if (hit) return skinAlias(name, hit[0], hit[1]);
  if (!list.length) return name;
  let h = 0; for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = list[h % list.length];
  return skinAlias(name, pick[0], pick[1]);
}
// 화면에 보일 때만 배경 이미지를 받는다: <i data-art="주소"> → 보이면 style="--img:url(주소)"
let artIO = null;
export function lazyArt(root = document) {
  const els = root.querySelectorAll('[data-art]');
  if (!els.length) return;
  const show = (el) => { if (el.dataset.art) el.style.setProperty('--img', `url('${el.dataset.art}')`); el.removeAttribute('data-art'); };
  if (!('IntersectionObserver' in window)) return els.forEach(show);
  artIO ||= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { artIO.unobserve(e.target); show(e.target); } }), { rootMargin: '300px' });
  els.forEach((el) => artIO.observe(el));
}
// 선수의 대표 챔피언(랭킹·선수 카드·케미 등 모든 화면 공통):
// 주라인에서 가장 많이 쓴 챔피언 → (기록이 없으면) 솔랭 모스트 → 내전 모스트
const SIG_CHAMP_PREF = { 승정: '진' };
const sigCache = new WeakMap();
// 대표 챔피언: 선수마다 직접 고른 챔피언(players/{id}.champ, 기본 일러스트)을 선수 관련 모든 화면에 쓴다.
// 아직 고르지 않았으면 DEFAULT_CHAMP. 예외 선수(FREE_SIG)만 예전처럼 경기 기록·지정 스킨으로 정한다.
export const DEFAULT_CHAMP = '가렌';
export const FREE_SIG = ['혜나'];
export const canPickChamp = (s) => !!s && !FREE_SIG.some((n) => s.name?.includes(n));
export const cardChamp = (s) => sigChamp(s); // 예전 이름 호환
// players/{id}.skin = {champ, num, name}: 관리자가 "카드 수정"에서 고른 스킨. 그 챔피언이 대표일 때만 쓴다(선수가 직접 고르면 기본 스킨으로 초기화)
const chosenSkin = (s, name) => { const k = s.p?.skin; return k && k.champ === name && +k.num && !isBad(name, +k.num) ? skinAlias(name, +k.num, k.name) : name; };
export function sigChamp(s) {
  if (S.champBy[s.p?.champ]) return chosenSkin(s, s.p.champ); // 선수(가챠 페이지)나 관리자가 고른 챔피언 — 혜나도 관리자가 정하면 따른다
  if (canPickChamp(s)) return DEFAULT_CHAMP;
  const preferred = SIG_CHAMP_PREF[s.name];
  if (preferred && S.champBy[preferred]) return skinFor(s, preferred);
  const st = S.st; let cnt = sigCache.get(st);
  if (!cnt) {
    cnt = {};
    st.matches.forEach((m) => ['blue', 'red'].forEach((side) => m[side].forEach((id, i) => {
      const c = m.champs?.[side]?.[i]; if (!c || st.P[id]?.mainLane !== LANES[i]) return;
      ((cnt[id] ||= {})[c] ||= { g: 0, w: 0 }).g++; if (m.winner === side) cnt[id][c].w++;
    })));
    sigCache.set(st, cnt);
  }
  const top = Object.entries(cnt[s.id] || {}).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w)[0];
  if (top) return skinFor(s, top[0]);
  const most = s.p.solo?.most || '';
  const solo = S.champs.map((c) => c.name).filter((n) => most.includes(n)).sort((a, b) => most.indexOf(a) - most.indexOf(b))[0];
  if (solo) return skinFor(s, solo);
  const own = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w)[0];
  return own ? skinFor(s, own[0]) : '';
}
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400);
}
export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: type + ';charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
// 숫자 카운트업: <b data-count="17">
export function countUp(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString() + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
// 축포 이펙트 (화면 전체 캔버스)
export function burst(x = innerWidth / 2, y = innerHeight / 2, n = 140) {
  if (calm()) return;
  const c = document.createElement('canvas');
  c.className = 'fx'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), colors = document.body.classList.contains('xmas') ? ['#ffffff', '#e2463c', '#2fa35f', '#f2cf7a', '#dfe9ff', '#ffffff'] : document.body.classList.contains('newyear') ? ['#ffd36a', '#fff3c4', '#ff8fb0', '#f7c9a6', '#c8a8ff', '#ffffff'] : ['#f6e3a8', '#d9a441', '#3fd0e0', '#ffffff', '#5b8cff', '#ff6b81'];
  const ps = Array.from({ length: n }, () => { const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 11; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: 2 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, life: 1 }; });
  const t0 = performance.now();
  (function loop(t) {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += 0.2; p.life -= 0.011; g.save(); g.globalAlpha = Math.max(0, p.life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
    if (t - t0 < 2200) requestAnimationFrame(loop); else c.remove();
  })(t0);
}

// ---------- 모달 ----------
export function modal(html, cls = '') {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.classList.add('on');
  return m.firstElementChild;
}
export function closeModal() { const m = document.getElementById('modal'); m.classList.remove('on'); m.innerHTML = ''; }
act('close', closeModal);
document.addEventListener('click', (e) => { if (e.target.id === 'modal' && !e.target.querySelector('.lock')) closeModal(); });
const mh = (title) => `<div class="mh"><b>${title}</b><button class="btn ghost xs" data-a="close">${ic('x')}</button></div>`;
export { mh };

// ---------- 챔피언 ----------
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export const cho = (s) => [...s].map((c) => { const n = c.charCodeAt(0) - 0xac00; return n >= 0 && n < 11172 ? CHO[Math.floor(n / 588)] : c; }).join('');
export async function loadChamps() {
  const KEY = 'naejeon:champs3';
  const set = (o) => { S.ver = o.ver; S.champs = o.list; S.champBy = Object.fromEntries(o.list.map((c) => [c.name, c])); };
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (cached) { set(cached); refresh(); } // 저장해 둔 목록을 적용한 뒤 화면을 다시 그려야 첫 화면의 이미지가 비지 않는다
    if (cached && Date.now() - cached.at < 12 * 3600e3) return; // 패치 버전은 반나절마다 다시 확인
    const ver = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
    const data = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/ko_KR/champion.json`)).json()).data;
    const list = Object.values(data).map((c) => ({ id: c.id, key: +c.key, name: c.name, img: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.image.full}` })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const o = { ver, list, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(o)); set(o); refresh();
  } catch (e) { console.warn('챔피언 목록을 불러오지 못했습니다', e); }
}
let pickCb = null;
export function pickChamp({ title, used = {}, current = '', onPick, noClear = false, note = '' }) {
  pickCb = onPick;
  const grid = S.champs.map((c) => `<button class="cp ${used[c.name] ? 'used' : ''} ${c.name === current ? 'cur' : ''}" data-a="cp" data-n="${esc(c.name)}" data-k="${esc(c.name.replace(/\s/g, '') + ' ' + cho(c.name.replace(/\s/g, '')))}" ${used[c.name] ? `disabled title="${esc(used[c.name])}"` : ''}><img src="${c.img}" loading="lazy" alt=""><span>${esc(c.name)}</span></button>`).join('');
  const el = modal(`${mh(esc(title))}
    <div class="row"><input id="cpq" class="inp grow" placeholder="챔피언 검색 (초성 가능: ㅇㄹ)" data-i="cpq" autocomplete="off">
    ${noClear ? '' : '<button class="btn" data-a="cp" data-n="">비우기</button>'}</div>${note ? `<p class="mut sm">${note}</p>` : ''}
    ${S.champs.length ? `<div class="cpgrid" id="cpgrid">${grid}</div><p class="cp-empty mut" id="cp-empty" hidden>검색 결과가 없습니다.</p>` : `<p class="mut">챔피언 목록을 불러오지 못했습니다. 이름을 직접 입력하고 Enter를 누르세요.</p>`}`, 'tall cp-picker');
  const q = el.querySelector('#cpq');
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = el.querySelector('.cp:not([hidden]):not([disabled])');
    if (first) first.click(); else if (!S.champs.length && q.value.trim()) { closeModal(); pickCb(q.value.trim()); }
  });
  if (matchMedia('(min-width: 800px)').matches) q.focus();
}
act('cpq', (d, el) => {
  const q = el.value.replace(/\s/g, '');
  const buttons = document.querySelectorAll('#cpgrid .cp');
  let visible = 0;
  buttons.forEach((b) => { b.hidden = !!q && !b.dataset.k.includes(q); if (!b.hidden) visible++; });
  const empty = document.getElementById('cp-empty');
  if (empty) empty.hidden = visible > 0;
});
act('cp', (d) => { closeModal(); pickCb?.(d.n); });

// ---------- 선수 선택 ----------
let pickPCb = null;
export function pickPlayer({ title, exclude = [], lane, onPick, allowClear }) {
  pickPCb = onPick;
  const groups = Object.fromEntries(LANES.map((l) => [l, []]));
  S.st.list.filter((s) => !exclude.includes(s.id)).forEach((s) => (groups[s.mainLane] || (groups[s.mainLane] = [])).push(s));
  const laneOrder = lane && LANES.includes(lane) ? [lane, ...LANES.filter((l) => l !== lane)] : LANES;
  const playerButton = (s) => `<button class="pp" data-a="pp" data-id="${s.id}"><b>${esc(s.name)}</b><small>${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} 주라인${lane ? ` · ${LANE_NAME[lane]} ${s.p.scores?.[lane] ?? 0}점` : ` · 평균 ${s.avg.toFixed(1)}점`}</small></button>`;
  const grouped = laneOrder.map((l) => {
    const players = groups[l].sort((a, b) => (lane ? (b.p.scores?.[lane] || 0) - (a.p.scores?.[lane] || 0) : b.avg - a.avg) || a.name.localeCompare(b.name, 'ko'));
    if (!players.length) return '';
    return `<section class="ppgroup ${lane === l ? 'is-focus' : ''}" style="--lc:${LANE_COLOR[l]}"><header><span>${LANE_ICON[l]}</span><b>${LANE_NAME[l]} 주라인</b>${lane === l ? '<small>배정할 라인</small>' : ''}<em>${players.length}명</em></header><div class="ppgroup-grid">${players.map(playerButton).join('')}</div></section>`;
  }).join('');
  modal(`${mh(title)}
    ${allowClear ? '<button class="btn block" data-a="pp" data-id="">자리 비우기</button>' : ''}
    <div class="pplist">${grouped || '<p class="mut">선택할 선수가 없습니다.</p>'}</div>`, 'tall');
}
act('pp', (d) => { closeModal(); pickPCb?.(d.id); });

// ---------- 관리자 PIN (가벼운 잠금: 실수·장난 방지용) ----------
export async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('naejeon:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const isAdmin = () => S.admin || (!!settings().pinHash && sessionStorage.getItem('naejeon:admin:' + S.key) === settings().pinHash);
export function needAdmin(fn) {
  if (isAdmin()) { S.admin = true; return fn(); }
  const has = !!settings().pinHash;
  const el = modal(`${mh('관리자 확인')}
    <p class="mut">${has ? '점수 수정·경기 삭제 같은 작업은 관리자 PIN이 필요합니다.' : '아직 관리자 PIN이 없습니다. 지금 정하는 PIN이 관리자 PIN이 됩니다. (4자리 이상)'}</p>
    <form class="row" id="pinf"><input class="inp grow" id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN"><button class="btn pri">확인</button></form>`);
  el.querySelector('#pin').focus();
  el.querySelector('#pinf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = el.querySelector('#pin').value.trim();
    if (v.length < 4) return toast('4자리 이상 입력하세요');
    const hsh = await sha(v);
    if (!has) await S.store.patch('meta', 'settings', { pinHash: hsh });
    else if (hsh !== settings().pinHash) return toast('PIN이 맞지 않습니다');
    S.admin = true; sessionStorage.setItem('naejeon:admin:' + S.key, hsh);
    closeModal(); fn();
  });
}
export const history = (type, before) => S.store.put('history', uid(), { type, at: Date.now(), before });
export { LANES, LANE_NAME, pct };
