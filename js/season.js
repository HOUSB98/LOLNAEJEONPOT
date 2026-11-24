// 시즌 장식 날짜 판단만 모아 둔 작은 파일. 장식 코드(xmas.js·newyear.js)는 시즌 기간에만 내려받는다(평소 첫 접속 용량 절약).
const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
export const inSeason = (d = new Date()) => md(d) >= 1116 && md(d) <= 1226; // 크리스마스 11/16 ~ 12/26
export const xmasOn = () => inSeason() && localStorage.getItem('naejeon:xmas') !== '0';
// 채팅창 크리스마스 배경·말풍선은 크리스마스 당일(12/25)까지만
export const xchatOn = (d = new Date()) => xmasOn() && md(d) <= 1225;
export const nySeason = (d = new Date()) => d.getMonth() === 0 && d.getDate() <= 15; // 새해 1/1 ~ 1/15
export const nyOn = () => nySeason() && localStorage.getItem('naejeon:newyear') !== '0';
// 받은 장식 모듈(시즌이 아니면 null). ready 가 끝난 뒤에 쓴다.
export const SEASON = { x: null, n: null };
SEASON.ready = Promise.all([
  inSeason() ? import('./xmas.js').then((m) => (SEASON.x = m)) : null,
  nySeason() ? import('./newyear.js').then((m) => (SEASON.n = m)) : null,
]).catch((e) => console.warn('[season]', e));
