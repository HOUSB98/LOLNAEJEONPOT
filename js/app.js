// 시작점 + 홈 / 랭킹 / 경기 기록 / 챔피언 / 피어리스 화면
import { FIREBASE_CONFIG, MAINT } from './config.js';
import { createStore } from './store.js';
import { cardChamp, prefetchChamps, isAdmin, sha } from './core.js';
import { S, page, act, ddMenu, cho, esc, col, settings, pname, go, refresh, initShell, loadChamps, fmtDT, fmtDay, wr, wrClass, wrBar, dots, streak, laneTag, titleChips, champIcon, splashUrl, tileUrl, artUrl, sigChamp, toast, download, csv, needAdmin, history, flipSides, modal, closeModal, mh, ic, logo, countUp, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import { initSocial, renderChat, renderPresence, onMeta, chatStartsOpen } from './social.js';
import { duoRank, dayKey } from './stats.js';
import { watchDice } from './dice.js';
import { watchBoard } from './board.js';
import './players.js';
import './finder.js';
import './gacha.js';
import { lazyPage, swipeZone, swiping, recapSeason, recapYear, gname, gOf, gAt, gem, guildOn, GUILDS, ghref } from './core.js';
// 자주 안 쓰는 화면은 들어갈 때 받는다. 접속 후 한가할 때 미리 받아 두므로 보통은 기다림 없이 열린다.
const LAZY_GET = [
  lazyPage('replay', () => import('./replay.js'), ['matchReplay']),
  lazyPage('auction', () => import('./auction.js')),
  lazyPage('admin', () => import('./admin.js'), ['slOpen']),
  lazyPage('scores', () => import('./scores.js')),
  lazyPage('maker', () => import('./maker.js')),
  lazyPage('me', () => import('./me.js')),
  lazyPage('recap', () => import('./recap.js')),
  lazyPage('guild', () => import('./guild.js'), ['gJoin', 'gMove', 'gNotice']),
  lazyPage('jeongpa', () => import('./guild.js')),
  lazyPage('magyo', () => import('./guild.js')),
  lazyPage('guilds', () => import('./guildx.js')),
  lazyPage('gshop', () => import('./guildx.js')),
];
setTimeout(() => (window.requestIdleCallback || setTimeout)(() => LAZY_GET.forEach((g) => g().catch(() => {}))), 6000);
import { watchPosts, postsChanged } from './talk.js';
import { xmasOn, SEASON } from './season.js';
import { kakaoBtn } from './kakao.js'; // 카카오톡 공유 버튼(경기 상세)
import { mountRecruit, onRecruit, recruitHomeBar } from './recruit.js'; // 오늘 내전 모집(시간·참가 인원·카톡) // 크리스마스·새해 장식 코드는 시즌에만 받는다

const num = (v, cls = '') => `<td class="num ${cls}">${v}</td>`;
export function stat(icon, label, value, sub, tone = '') {
  const n = typeof value === 'number';
  return `<div class="stat ${tone}"><i class="st-ic">${ic(icon)}</i>${ic(icon, 'wm')}<small>${label}</small><b class="mono" ${n ? `data-count="${value}"` : ''}>${n ? value.toLocaleString() : value}</b><span>${sub || ''}</span></div>`;
}
function hofList() {
  const st = S.st, x = st.sum, names = (ids) => (ids.length > 2 ? `${pname(ids[0])} 외 ${ids.length - 1}명` : ids.map(pname).join(' · '));
  const tc = st.champs[0], firstOf = (ids) => st.P[ids[0]];
  return [
    ['flame', 'LONGEST WIN STREAK', '역대 최장 연승', x.hof.n ? names(x.hof.ids) : '—', x.hof.n ? `${x.hof.n}연승` : '아직 기록이 없습니다', 'gold', x.hof.n ? sigChamp(firstOf(x.hof.ids)) : ''],
    ['crown', 'HIGHEST WIN RATE', '최고 승률 (10판 이상)', x.best10 ? esc(x.best10.name) : '—', x.best10 ? `${x.best10.wr}% · ${x.best10.g}판` : '10판 이상 출전자가 없습니다', 'gold', x.best10 ? sigChamp(x.best10) : ''],
    ['shield', 'MOST GAMES', '최다 출전', x.maxG ? names(x.mostIds) : '—', `${x.maxG}판`, 'blue', x.maxG ? sigChamp(firstOf(x.mostIds)) : ''],
    ['bolt', 'ON FIRE', '현재 최다 연승', x.winStreak?.cur > 1 ? esc(x.winStreak.name) : '—', x.winStreak?.cur > 1 ? `${x.winStreak.cur}연승 진행 중` : '2연승부터 집계됩니다', 'teal', x.winStreak?.cur > 1 ? sigChamp(x.winStreak) : ''],
    ['alert', 'BIGGEST UPSET', '최대 업셋', x.maxUpset ? `예상 ${Math.round(x.maxUpset.p * 100)}% 팀의 반란` : '아직 업셋이 없습니다', x.maxUpset ? fmtDT(x.maxUpset.m.at) : `누적 업셋 ${x.upsets}회`, 'red', ''],
    ['star', 'MOST PICKED', '최다 픽 챔피언', tc ? esc(tc.name) : '—', tc ? `${tc.g}픽 · 승률 ${pct(tc.w, tc.g)}%` : '챔피언 기록이 없습니다', 'blue', tc ? tc.name : ''],
  ];
}

// ---------- 홈 ----------
// 최근 7일 안에 바뀐 라인 점수를 공지 맨 위에 보여 준다(같은 선수·라인은 처음 값 → 마지막 값으로 묶는다)
function scoreNotice(add) {
  const items = S.store.data.meta?.scorelog?.items || [], since = Date.now() - 7 * 864e5, by = new Map();
  for (const x of items) {
    if (!x || +x.at < since || !S.st.P[x.pid]) continue;
    const k = x.pid + ':' + x.lane, o = by.get(k);
    if (o) { o.to = x.to; o.at = x.at; } else by.set(k, { ...x });
  }
  const ch = [...by.values()].filter((x) => x.from !== x.to).sort((a, b) => b.at - a.at);
  if (!ch.length) return;
  const one = (x) => `${esc(pname(x.pid))} ${LANE_NAME[x.lane]} ${x.from}→${x.to}${x.to > x.from ? '▲' : '▼'}`;
  const ppl = new Set(ch.map((x) => x.pid)).size, last = new Date(ch[0].at);
  const when = `${last.getMonth() + 1}/${last.getDate()}`;
  add('UPDATE', 'gold', ch.length === 1 ? `라인 점수 변경 — ${one(ch[0])}` : `라인 점수 변경 — ${ppl}명 · ${ch.length}건`,
    `${ch.length > 1 ? `${ch.slice(0, 6).map(one).join(', ')}${ch.length > 6 ? ` 외 ${ch.length - 6}건` : ''}. ` : ''}${when}에 바뀌었고, 예상 승률과 팀 밸런스에 바로 반영됩니다.`);
}
function notices() {
  const st = S.st, x = st.sum, out = [], P = st.P;
  const add = (tag, tone, title, body) => out.push({ tag, tone, title, body });
  if (settings().notice) add('공지', 'gold', esc(settings().notice.split('\n')[0]), esc(settings().notice.split('\n').slice(1).join(' ')));
  scoreNotice(add);
  if (!x.n) { add('안내', 'blue', '첫 경기를 기록해 보세요', '팀 구성하기에서 라인업을 짜고 결과를 저장하면 통계가 자동으로 쌓입니다.'); return out; }
  const ws = x.winStreak, ls = x.loseStreak;
  if (ws?.cur >= 3) add('HOT', 'red', `${esc(ws.name)}, 파죽의 ${ws.cur}연승`, `막을 자가 없습니다. 현재 승률 ${ws.wr}% · MMR ${Math.round(ws.mmr)}. 다음 내전에서 이 기세를 꺾을 팀이 나올까요?`);
  if (ls?.cur <= -3) add('ALERT', 'purple', `${esc(ls.name)}, ${-ls.cur}연패의 늪`, `반등이 절실합니다. 최근 5판 ${ls.recent.filter(Boolean).length}승 ${ls.recent.length - ls.recent.filter(Boolean).length}패. 다음 판은 주라인 배정을 추천합니다.`);
  if (st.lastDay) {
    const mvp = [...st.list].filter((s) => s.today.g).sort((a, b) => b.today.w - a.today.w || a.today.g - b.today.g)[0];
    add('REPORT', 'blue', `${fmtDay(st.lastDay).slice(5)} 내전 결산 — ${x.lastDayN}경기`, mvp ? `최다 승리는 ${esc(mvp.name)} (${mvp.today.w}승 ${mvp.today.g - mvp.today.w}패). 누적 ${x.n}경기, 내전 ${x.days}일차입니다.` : '');
  }
  if (x.best10) add('RANK', 'gold', `승률 1위 ${esc(x.best10.name)} — ${x.best10.wr}%`, `10판 이상 출전자 기준. ${x.best10.g}판 ${x.best10.w}승 ${x.best10.g - x.best10.w}패로 리그 정상을 지키고 있습니다.`);
  const duo = duoRank(st, 5, 1).top[0];
  if (duo) { const [a, b] = duo.ids; duo.r = duo.w / duo.g; add('SYNERGY', 'teal', `최강 듀오 ${pname(a)} + ${pname(b)}`, `함께한 ${duo.g}판에서 승률 ${Math.round(duo.r * 100)}%. 같은 팀이 되면 경계 대상 1순위입니다.`); }
  const tc = st.champs[0];
  if (tc) { const safe = st.champs.filter((c) => c.g >= 3 && c.w === c.g)[0]; add('META', 'blue', `최다 픽 ${esc(tc.name)} (${tc.g}회)${safe ? ` · 불패 카드 ${esc(safe.name)}` : ''}`, safe ? `${esc(safe.name)}는 ${safe.g}전 전승. 피어리스에서 먼저 가져가는 팀이 유리합니다.` : `${esc(tc.name)}의 승률은 ${pct(tc.w, tc.g)}%입니다. 인기와 성적은 별개일 수 있습니다.`); }
  const bw = pct(x.blueW, x.n);
  if (x.n >= 8 && (bw >= 60 || bw <= 40)) add('META', 'blue', `${bw >= 60 ? '블루' : '레드'} 진영 강세 — 승률 ${bw >= 60 ? bw : 100 - bw}%`, `${x.n}경기 중 블루 ${x.blueW}승, 레드 ${x.redW}승. 진영 선택이 승부에 영향을 주고 있습니다.`);
  if (x.hit !== null) add('DATA', 'teal', `승부 예측 적중률 ${x.hit}%`, `라인 점수 기반 예상과 실제 결과를 비교한 수치입니다. 팀 밸런스 지수 ${x.balance}%, 업셋 ${x.upsets}회.`);
  const topM = [...st.list].filter((s) => s.g >= 5).sort((a, b) => b.mmr - a.mmr)[0];
  if (topM) add('RANK', 'gold', `내전 MMR 1위 ${esc(topM.name)} — ${Math.round(topM.mmr).toLocaleString()}`, `5판 이상 출전자 기준입니다. 시작 MMR ${topM.mmrInit}에서 ${topM.mmr >= topM.mmrInit ? '+' : ''}${Math.round(topM.mmr - topM.mmrInit)}.`);
  const rookies = st.list.filter((s) => s.g >= 1 && s.g <= 4), ghosts = st.list.filter((s) => !s.g);
  if (rookies.length || ghosts.length) add('ROSTER', 'purple', `신예 ${rookies.length}명 · 미데뷔 ${ghosts.length}명`, `${rookies.length ? `${rookies.slice(0, 4).map((s) => esc(s.name)).join(', ')} — 표본이 쌓이는 중입니다. ` : ''}${ghosts.length ? '아직 한 판도 뛰지 않은 소환사가 데뷔를 기다립니다.' : ''}`);
  return out;
}
const HM = { i: 0, t: 0, lane: 'top' };
// 공지 회전(맨 아래 공지가 맨 위로)과 배너 문구 타이핑 상태. 화면을 다시 그려도 이어지도록 모듈에 둔다.
const NT = { off: 0, t: 0 }, TY = { t0: 0, timer: 0 };
const typed = (s) => [...s].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
function typeTick() {
  const h = document.querySelector('.hero-h'), chs = h ? h.querySelectorAll('.ch') : [];
  if (S.page !== 'home' || !chs.length) { clearInterval(TY.timer); TY.timer = 0; return; }
  const n = Math.floor((performance.now() - TY.t0 - 1700) / 95); // 로고가 다 그려진 뒤(약 1.7초)부터 한 글자씩
  chs.forEach((c, i) => { c.classList.toggle('on', i < n); c.classList.toggle('cur', n > 0 && i === Math.min(n, chs.length) - 1); });
  if (n > chs.length + 16) { clearInterval(TY.timer); TY.timer = 0; h.classList.add('typed'); }
}
function noticeTick() {
  if (S.page !== 'home') return clearInterval(NT.t);
  const ol = document.querySelector('.notice ol');
  if (!ol || ol.children.length < 2 || ol.matches(':hover') || document.visibilityState !== 'visible') return;
  const last = ol.lastElementChild, h = last.offsetHeight;
  NT.off = (NT.off + 1) % ol.children.length;
  ol.prepend(last);
  [...ol.children].forEach((li) => li.animate([{ transform: `translateY(-${h}px)` }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.15,1)' }));
  last.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 900 });
}
// 홈 배너: 내전에 나온 챔피언(적으면 전체)의 일러스트를 순서를 섞어 차례로 보여 준다.
// 크리스마스 시즌(시즌 장식 ON)에는 겨울·크리스마스 스킨 일러스트로 바꾼다. 항목: { url, cap }
const HERO = { list: [], i: 0, t: 0, flip: 0, xm: false };
const HERO_KEY = 'naejeon:herofirst'; // 다음 접속 때 처음 보여 줄 배너 그림 { url, cap, xm } (index.html 이 미리 받는다)
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
// 크리스마스·겨울 스킨 목록(챔피언 id, 스킨 번호, 스킨 이름). 예전에는 시즌마다 후보 챔피언 50명의 패치 데이터를 하나씩 받아(요청 50번)
// 스킨 이름으로 찾았는데, 거의 바뀌지 않는 목록이라 미리 정리해 둔다(2026-11, 패치 16.23 기준. 크로마는 일러스트가 없어 뺌).
// 새 겨울 스킨이 나오면 여기에 한 줄 추가. 일러스트를 못 받는 항목은 heroNext가 알아서 건너뛴다
const XMAS_SKINS = [['Braum', 10, '산타 브라움'], ['Corki', 2, '얼음 썰매 코르키'], ['Draven', 12, '산타 드레이븐'], ['Gragas', 3, '산타 그라가스'], ['Heimerdinger', 4, '눈사람 하이머딩거'],
  ['Karma', 6, '겨울 동화 카르마'], ['Lulu', 4, '겨울 동화 룰루'], ['MasterYi', 17, '눈사람 마스터 이'], ['Neeko', 1, '겨울 동화 니코'], ['Nidalee', 1, '눈토끼 니달리'],
  ['Nunu', 2, '산타작업실 누누와 윌럼프'], ['Orianna', 5, '겨울 동화 오리아나'], ['Poppy', 14, '눈꽃사슴 뽀삐'], ['Shaco', 3, '호두까기 샤코'], ['Sivir', 6, '눈꽃 시비르'],
  ['Sona', 3, '고요한 밤 소나'], ['Soraka', 9, '겨울 동화 소라카'], ['Veigar', 7, '나쁜 산타 베이가'], ['Zilean', 1, '산타 질리언']];
const XM = { list: null, busy: false };
try { localStorage.removeItem('naejeon:xmasskins'); } catch {} // 예전 방식의 기기 저장 목록 정리
// 크리스마스 스킨 목록: 챔피언 목록(S.champs)에 있는 챔피언만 [챔피언 이름, id, 번호, 스킨 이름]으로. 받는 것 없음
async function xmasSkins() {
  if (XM.list || !S.champs.length) return XM.list;
  const byId = Object.fromEntries(S.champs.map((c) => [c.id, c.name]));
  const found = XMAS_SKINS.filter(([id]) => byId[id]).map(([id, num, name]) => [byId[id], id, num, name]);
  if (found.length >= 3) XM.list = found;
  return XM.list;
}
const xmasArt = (id, num) => `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${id === 'Fiddlesticks' ? 'FiddleSticks' : id}_${num}.jpg`;
// 배너 그림(장당 100~200KB)은 PC 20장(예전 40장 → 오래 켜 두면 수 MB), 휴대폰·가벼운 모드·데이터 절약 모드는 10장만 돌린다. 한 번 받은 그림은 브라우저에 남아 다시 받지 않는다.
const heroSmall = () => matchMedia('(max-width: 860px), (pointer: coarse)').matches || document.body.classList.contains('lite') || !!navigator.connection?.saveData;
const HERO_N = () => (heroSmall() ? 10 : 20), HERO_MS = () => (navigator.connection?.saveData ? 13000 : 6500);
function heroList() {
  const want = xmasOn() && !!XM.list;
  if (HERO.list.length && HERO.xm === want) return HERO.list;
  if (!S.champs.length) return HERO.list;
  HERO.xm = want; HERO.i = 0;
  if (want) HERO.list = shuffle(XM.list.map(([, id, num, name]) => ({ url: xmasArt(id, num), cap: name }))).slice(0, HERO_N());
  else {
    const played = S.st.champs.filter((c) => c.g && S.champBy[c.name]).map((c) => c.name);
    const pool = played.length >= 6 ? played : S.champs.map((c) => c.name);
    HERO.list = shuffle(pool).slice(0, HERO_N()).map((n) => ({ url: artUrl(n), cap: n }));
  }
  // 첫 배너: 지난 접속 때 골라 둔 그림(index.html 이 사이트를 여는 순간 미리 받기 시작함)을 맨 앞에 두고, 다음 접속용 그림을 하나 골라 둔다
  try {
    const r = JSON.parse(localStorage.getItem(HERO_KEY) || 'null');
    if (r?.url && r.xm === want && (want || S.champBy[r.cap])) { HERO.list = [{ url: r.url, cap: r.cap }, ...HERO.list.filter((x) => x.url !== r.url)]; }
    const nx = HERO.list[1 + Math.floor(Math.random() * Math.max(1, HERO.list.length - 1))] || HERO.list[0];
    if (nx) localStorage.setItem(HERO_KEY, JSON.stringify({ url: nx.url, cap: nx.cap, xm: want }));
  } catch {}
  return HERO.list;
}
function heroNext(tries = 0) {
  const list = HERO.list, bgs = document.querySelectorAll('.hero-bg'); if (list.length < 2 || bgs.length < 2) return;
  const it = list[(HERO.i + 1) % list.length], img = new Image();
  img.onload = () => {
    if (S.page !== 'home' || !document.body.contains(bgs[0])) return;
    HERO.i = (HERO.i + 1) % list.length; HERO.flip ^= 1;
    const show = bgs[HERO.flip], hide = bgs[HERO.flip ^ 1];
    show.style.setProperty('--img', `url('${it.url}')`); show.classList.add('on'); hide.classList.remove('on');
    const cap = document.getElementById('herocap');
    if (cap) { cap.classList.remove('sw'); void cap.offsetWidth; cap.querySelector('em').textContent = HERO.xm ? 'HOLIDAY SKIN' : 'CHAMPION'; cap.querySelector('b').textContent = it.cap; cap.classList.add('sw'); }
  };
  img.onerror = () => { HERO.list.splice((HERO.i + 1) % list.length, 1); if (tries < 5) heroNext(tries + 1); }; // 일러스트가 없는 스킨은 빼고 다음으로
  img.src = it.url;
}
// 라인별 챔피언 기록: 경기 기록의 챔피언 칸 순서(탑→서폿)로 라인을 나눈다
function laneChamps() {
  const by = Object.fromEntries(LANES.map((l) => [l, {}]));
  S.st.matches.forEach((m) => ['blue', 'red'].forEach((side) => (m.champs?.[side] || []).forEach((c, i) => {
    if (!c || !LANES[i]) return;
    const o = (by[LANES[i]][c] ||= { name: c, g: 0, w: 0 });
    o.g++; if (m.winner === side) o.w++;
  })));
  return by;
}
// 한 라인의 챔피언 목록에 티어와 표시(OP·꿀벌)를 붙인다.
//   OP  : 3픽 이상 + 1티어(보정 승률+선택 빈도 64점 이상) 중 점수 상위, 라인별 최대 3개
//   꿀벌: OP가 아닌 챔피언 중 2픽 이상 + 승률 50% 이상 + 3티어 이내, 점수 상위, 라인별 최대 5개 (무난하게 쓰기 좋은 픽)
function laneTierList(lane) {
  const list = Object.values(laneChamps()[lane]).sort((a, b) => b.g - a.g || b.w - a.w), maxG = Math.max(1, ...list.map((c) => c.g));
  list.forEach((c) => { c.tier = tierOf(c, maxG); c.v = tierVal(c, maxG); });
  const byV = [...list].sort((a, b) => b.v - a.v || b.g - a.g);
  byV.filter((c) => c.g >= 3 && c.tier === 1).slice(0, 3).forEach((c) => (c.mark = 'op'));
  byV.filter((c) => !c.mark && c.g >= 2 && c.w * 2 >= c.g && c.tier <= 3).slice(0, 5).forEach((c) => (c.mark = 'bee'));
  return list;
}
const BEE = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="8" cy="8" rx="4.6" ry="3" transform="rotate(-28 8 8)" fill="#eaf6ff" opacity=".92"/><ellipse cx="16" cy="8" rx="4.6" ry="3" transform="rotate(28 16 8)" fill="#eaf6ff" opacity=".92"/><ellipse cx="12" cy="14" rx="5.2" ry="6.4" fill="#ffc531"/><path d="M7.4 11.6h9.2M6.9 14.6h10.2M8 17.6h8" stroke="#2a1a05" stroke-width="1.9" stroke-linecap="round"/><circle cx="10.2" cy="9.6" r=".9" fill="#2a1a05"/><circle cx="13.8" cy="9.6" r=".9" fill="#2a1a05"/></svg>';
const markHtml = (c) => (c.mark === 'op' ? '<i class="mk op" title="OP · 내전에서 성능이 검증된 픽"><u>OP</u></i>' : c.mark === 'bee' ? `<i class="mk bee" title="꿀픽 · 무난하게 쓰기 좋은 픽">${BEE}</i>` : '');
function tierRows(list, { all = false, pctOn = false } = {}) {
  const rows = [1, 2, 3, 4, 5].map((t) => [t, list.filter((c) => c.tier === t)]).filter(([, cs]) => all || cs.length);
  return rows.map(([t, cs]) => `<div class="trow t${t}"><b><span>${t}</span><small>TIER</small></b><div>${cs.map((c) => `<span class="tc ${c.mark || ''}" title="${esc(c.name)} · ${c.g}픽 ${c.w}승 · ${pct(c.w, c.g)}%${c.mark === 'op' ? ' · OP' : c.mark === 'bee' ? ' · 꿀픽' : ''}"><span class="tcp">${champIcon(c.name)}${markHtml(c)}</span><small>${esc(c.name)}</small>${pctOn ? `<em class="mono">${pct(c.w, c.g)}%</em>` : ''}</span>`).join('') || '<em class="mut sm">해당 없음</em>'}</div></div>`).join('');
}
const today = () => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
const laneSeg = (cur, a, withAll) => `<div class="seg full lseg">${withAll ? `<button class="${cur === 'all' ? 'on' : ''}" data-a="${a}" data-l="all"><span>전체</span></button>` : ''}${LANES.map((l) => `<button class="${cur === l ? 'on' : ''}" data-a="${a}" data-l="${l}" title="${LANE_NAME[l]}">${LANE_ICON[l]}<span>${LANE_NAME[l]}</span></button>`).join('')}</div>`;
function laneTierPanel() {
  const list = laneTierList(HM.lane);
  return `<section class="panel ltier"><div class="sec-h"><h2>${ic('champs')}챔피언 티어</h2><span class="mut sm">${LANE_NAME[HM.lane]} · ${list.length}종</span><span class="grow"></span><a class="mut sm" href="#/champs">전체 보기 →</a></div>
    ${laneSeg(HM.lane, 'homeLane')}
    <div class="tiers mini">${tierRows(list, { pctOn: true }) || `<p class="mut sm center">${LANE_NAME[HM.lane]} 챔피언 기록이 아직 없습니다. 경기 입력 때 챔피언을 고르면 쌓입니다.</p>`}</div>
    <p class="hint">내전 기록 기준 · 보정 승률(표본 반영) + 선택 빈도 <span class="asof mono">기준 ${today()}</span></p></section>`;
}
// 진영 승률과 요즘 폼(최근 5판) — 홈 오른쪽 아래 칸
function formPanel() {
  const st = S.st, x = st.sum, bw = pct(x.blueW, x.n);
  const act5 = st.list.filter((s) => s.recent.length >= 3), score = (s) => s.recent.filter(Boolean).length / s.recent.length;
  const hot = [...act5].sort((a, b) => score(b) - score(a) || b.cur - a.cur || b.mmr - a.mmr).slice(0, 3);
  const cold = [...act5].sort((a, b) => score(a) - score(b) || a.cur - b.cur || a.mmr - b.mmr).filter((s) => !hot.includes(s)).slice(0, 3);
  const li = (s) => `<a class="fm" href="#/players/${s.id}">${champIcon(sigChamp(s), 'face')}<b>${gname(s.id, s.name)}</b>${streak(s.cur)}<span class="grow"></span>${dots(s.recent)}</a>`;
  return `<section class="panel formbox"><div class="sec-h"><h2>${ic('scale')}진영 · 요즘 폼</h2><span class="grow"></span><span class="mut sm">최근 5판 기준</span></div>
    <div class="sidebar2"><b class="blue mono">BLUE ${x.blueW}승 <small>${bw}%</small></b><b class="red mono"><small>${x.n ? 100 - bw : 0}%</small> ${x.redW}승 RED</b></div>
    <div class="prob"><i style="width:${x.n ? bw : 50}%"></i></div>
    <div class="fmg"><div><small class="fmh hot">${ic('flame')}상승세</small>${hot.map(li).join('') || '<p class="mut sm">3판 이상 뛴 선수가 없습니다.</p>'}</div>
      <div><small class="fmh cold">${ic('alert')}반등 필요</small>${cold.map(li).join('') || '<p class="mut sm">—</p>'}</div></div></section>`;
}
// 홈 연말 결산 띠: 11/20 ~ 1/31, 그해 경기가 있을 때만(누르면 #/recap)
const recapBar = (st) => { if (!recapSeason()) return ''; const y = recapYear(); if (!st.matches.some((m) => +dayKey(m.at).slice(0, 4) === y)) return ''; return `<a class="rcp-home" href="#/recap"><span class="rcp-hi">${ic('recap')}</span><span class="rcp-htx"><b>${y} 연말 결산</b><small>올해의 MVP · 개근상 · 베스트 듀오 · 내 결산</small></span><span class="grow"></span><span class="btn gold xs">보러 가기</span></a>`; };
// 문파 포고문(상점에서 산 24시간 공지): 모든 사람 홈 맨 위에
const bannerBar = () => { if (!guildOn()) return ''; const fx = S.store.data.meta.guild?.fx || {}; return ['j', 'm'].filter((g) => fx[g]?.banner?.t && +fx[g].banner.exp > Date.now()).map((g) => `<a class="gd-ban g-${g}" href="${ghref(g)}">${gem(g)}<small>${GUILDS[g].n} 포고문</small><b>${esc(fx[g].banner.t)}</b></a>`).join(''); };
// 홈 길드 띠: 내 문파의 이번 주 전적(창설 뒤, 경기 당시 소속) · 문파가 없으면 고르라는 안내. '나'는 내 페이지에서 고른 선수
const guildBar = (st) => {
  if (!guildOn()) return '';
  let me = ''; try { me = localStorage.getItem('naejeon:me:' + S.key) || localStorage.getItem('naejeon:bdme:' + S.key) || ''; } catch {}
  if (!st.P[me]) return '';
  const g = gOf(me);
  if (!g) return ''; // 무소속: 관리자가 배정하면 띠가 생김
  const t0 = +S.store.data.meta.guild.at, wk = (() => { const d = new Date(dayKey(Date.now()) + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime() + 6 * 3600e3); })();
  let w = 0, n = 0;
  for (let i = st.matches.length - 1; i >= 0; i--) { const m = st.matches[i]; if (m.at < t0 || dayKey(m.at) < wk) break; ['blue', 'red'].forEach((sd) => m[sd].forEach((id) => { if (gAt(id, m.at) === g) { n++; if (m.winner === sd) w++; } })); }
  return `<a class="gd-home g-${g}" href="${ghref(g)}">${gem(g)}<span><small>내 문파</small><b>${GUILDS[g].n}</b></span><span class="gh-k"><small>이번 주</small><b class="mono">${n ? `${w}승 ${n - w}패` : '아직 경기 없음'}</b></span><em>문파 보기 ›</em></a>`;
};
page('home', {
  keyed: 'auto', // 바뀐 구역만 다시 그림(core.js autoKeys)
  render() {
    const st = S.st, x = st.sum, now = new Date();
    const hl = heroList(), hero = hl.length ? hl[HERO.i % hl.length] : null;
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${'일월화수목금토'[now.getDay()]}요일`;
    const patch = S.ver ? S.ver.split('.').slice(0, 2).join('.') : '—';
    const hof = hofList(), top = st.list.filter((s) => s.g >= 3).sort((a, b) => b.ovr - a.ovr).slice(0, 3), nt0 = notices(), nt = nt0.map((_, i) => nt0[(i - (NT.off % nt0.length) + nt0.length) % nt0.length]);
    const last = [...st.matches].slice(-2).reverse();
    HERO.flip = 0;
    return `${recruitHomeBar()}${bannerBar()}${guildBar(st)}${recapBar(st)}
    <section class="hero">
      <div class="hero-bg on" style="--img:url('${hero?.url || ''}')"></div><div class="hero-bg alt"></div>
      <div class="hero-in">
        <div class="hero-logo">${logo(true, 92)}<div><div class="word"><span>NAEJEON</span><i>POT</i></div><p>${esc(settings().leagueName || '친구 내전 리그')} · IN-HOUSE LEAGUE</p></div></div>
        <h1 class="hero-h" aria-label="우리들의 협곡, 모든 기록이 여기에.">${typed('우리들의 협곡,')}<br><em>${typed('모든 기록이 여기에.')}</em></h1>
        <div class="hero-meta"><span>${ic('cal')}${date}</span><span class="patch">PATCH ${patch}</span><span>${ic('today')}누적 ${x.n}경기</span></div>
        <div class="hero-cta"><a class="btn pri" href="#/today">${ic('today')}팀 구성하기</a><a class="btn" href="#/rank">${ic('rank')}랭킹 보기</a></div>
      </div>
      ${hero ? `<span class="hero-cap" id="herocap"><em>${HERO.xm ? 'HOLIDAY SKIN' : 'CHAMPION'}</em> · <b>${esc(hero.cap)}</b></span>` : ''}
    </section>
    <div class="stats">
      ${stat('today', '총 경기', x.n, `내전 ${x.days}일`, 'gold')}
      ${stat('users', '참가 소환사', x.active, `등록 ${st.list.length}명`, 'teal')}
      ${stat('flame', '현재 최다 연승', x.winStreak?.cur > 1 ? `${x.winStreak.cur}연승` : '-', x.winStreak?.cur > 1 ? `${esc(x.winStreak.name)} · 진행 중` : '2연승부터 집계', 'red')}
      ${stat('target', '예측 적중률', x.hit === null ? '-' : x.hit + '%', `밸런스 지수 ${x.balance ?? '-'}%`, 'purple')}
    </div>
    <div class="home-grid">
      <div class="home-main"><section class="notice">
        <div class="sec-h"><h2>${ic('mega')}공지사항</h2><span class="tag gold">PATCH ${patch}</span><span class="mut sm">${date} 자동 갱신</span></div>
        <ol>${nt.map((n, i) => `<li class="${n.tone}" style="--d:${i}"><span class="ntag">${n.tag}</span><div><b>${n.title}</b><p>${n.body}</p></div></li>`).join('')}</ol>
      </section>
      ${x.n ? formPanel() : ''}</div>
      <div class="home-side">
        ${laneTierPanel()}
        <section class="car" id="car">
          <div class="sec-h"><h2>${ic('crown')}명예의 전당</h2><span class="grow"></span><button class="btn ghost xs" data-a="carGo" data-d="-1">‹</button><button class="btn ghost xs" data-a="carGo" data-d="1">›</button></div>
          <div class="car-view"><div class="car-track" style="transform:translateX(-${HM.i * 100}%)">${hof.map(([i, en, ko, a, b, tone, ch]) => `<article class="hslide ${tone}" style="--img:url('${artUrl(ch)}')"><div class="hs-ic">${ic(i)}</div><small>${en}</small><span>${ko}</span><b>${a}</b><em>${b}</em></article>`).join('')}</div></div>
          <div class="car-dots">${hof.map((_, i) => `<i class="${i === HM.i ? 'on' : ''}" data-a="carSet" data-i="${i}" title="${i + 1}번째 보기" aria-label="${i + 1}번째 보기"></i>`).join('')}</div>
        </section>
        <section class="panel podium"><div class="sec-h"><h2>${ic('rank')}POWER RANKING</h2><a class="mut sm" href="#/rank">전체 보기 →</a></div>
          ${top.map((s, i) => `<a class="pod p${i + 1}" href="#/players/${s.id}" style="--img:url('${artUrl(sigChamp(s))}')"><i class="mono">${i + 1}</i><div><b>${gname(s.id, s.name)}</b><small>${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · ${s.wr}% · ${s.g}판</small></div><em class="mono">${s.ovr}</em></a>`).join('') || '<p class="mut">3판 이상 출전한 선수가 생기면 표시됩니다.</p>'}
        </section>
      </div>
    </div>
    ${last.length ? `<div class="sec-h"><h2>${ic('matches')}최근 경기</h2><a class="mut sm" href="#/matches">전체 기록 →</a></div><div class="mlist">${last.map((m) => matchCard(m, false)).join('')}</div>` : ''}`;
  },
  after(entering) {
    if (entering) countUp(document.getElementById('main'));
    clearInterval(HM.t); clearInterval(HERO.t); clearInterval(NT.t);
    NT.t = setInterval(noticeTick, 5000);
    if (entering) { TY.t0 = performance.now(); clearInterval(TY.timer); TY.timer = setInterval(typeTick, 45); }
    else if (TY.timer) typeTick(); else document.querySelector('.hero-h')?.classList.add('typed');
    HM.t = setInterval(() => { if (S.page !== 'home') return clearInterval(HM.t); if (!document.querySelector('#car:hover') && !swiping() && Date.now() - (HM.sw || 0) > 4200) carMove(1); }, 4200);
    HERO.t = setInterval(() => { if (S.page !== 'home') return clearInterval(HERO.t); if (document.visibilityState === 'visible') heroNext(); }, HERO_MS());
    // 크리스마스 시즌: 겨울 스킨 목록을 (처음 한 번) 찾아오면 바로 스킨 일러스트로 넘긴다
    if (xmasOn() && !XM.list) xmasSkins().then((l) => { if (l && S.page === 'home' && xmasOn()) { heroList(); HERO.i = -1; heroNext(); } });
  },
});
act('homeLane', (d) => { HM.lane = d.l; refresh(); });
function carMove(d, abs) {
  const n = document.querySelectorAll('.hslide').length; if (!n) return;
  HM.i = abs !== undefined ? abs : (HM.i + d + n) % n;
  const tr = document.querySelector('.car-track'); if (tr) tr.style.transform = `translateX(-${HM.i * 100}%)`;
  document.querySelectorAll('.car-dots i').forEach((el, i) => el.classList.toggle('on', i === HM.i));
}
act('carGo', (d) => carMove(+d.d));
// 휴대폰: 명예의 전당을 손가락으로 좌우로 밀어 넘기기(손가락을 따라 움직이고, 처음·끝에서는 살짝만 끌림)
swipeZone('#car .car-view', {
  move(el, dx, w) {
    const tr = el.querySelector('.car-track'), n = el.querySelectorAll('.hslide').length; if (!tr || n < 2) return;
    const edge = (HM.i === 0 && dx > 0) || (HM.i === n - 1 && dx < 0);
    tr.style.transition = 'none'; tr.style.transform = `translateX(calc(-${HM.i * 100}% + ${edge ? dx / 3 : dx}px))`;
  },
  end(el, dir) {
    const tr = el.querySelector('.car-track'), n = el.querySelectorAll('.hslide').length; if (!tr) return;
    tr.style.transition = ''; HM.sw = Date.now();
    const to = HM.i + dir;
    carMove(0, dir && to >= 0 && to < n ? to : HM.i); // 처음·끝 너머로는 넘기지 않고 제자리로
  },
});
act('carSet', (d) => carMove(0, +d.i));

// ---------- 랭킹 ----------
const LB = { view: 'all', sort: 'ovr', dir: -1, min: 1 }; // 기본: 1판 이상 뛴 선수만
const COLS = {
  all: [
    ['g', '판', (s) => s.g, (s) => `<span class="mono">${s.g}</span>`],
    ['wr', '승률', (s) => (s.g ? s.wr : -1), (s) => wrBar(s.w, s.g)],
    ['recent', '최근 5판', (s) => s.recent.filter(Boolean).length, (s) => dots(s.recent)],
    ['cur', '연속', (s) => s.cur, (s) => streak(s.cur)],
    ['ovr', 'OVR', (s) => s.ovr, (s) => `<b class="ovr mono" data-live="ovr:${s.id}">${s.ovr}</b>`],
    ['mmr', 'MMR', (s) => s.mmr, (s) => `<span class="mono" data-live="mmr:${s.id}">${Math.round(s.mmr).toLocaleString()}</span> ${s.g ? `<small class="${s.mmrLast >= 0 ? 'good' : 'bad'}">${s.mmrLast >= 0 ? '▲' : '▼'}${Math.abs(Math.round(s.mmrLast))}</small>` : ''}`],
    ['main', '주라인', (s) => LANES.indexOf(s.mainLane), (s) => laneTag(s.mainLane)],
    ['cond', '폼', (s) => s.recent.filter(Boolean).length / (s.recent.length || 1), (s) => `<span class="cond c${'⬆️↗️➡️↘️⬇️➖'.indexOf(s.cond) / 2 | 0}">${{ '⬆️': '최상', '↗️': '좋음', '➡️': '보통', '↘️': '주춤', '⬇️': '부진', '➖': '—' }[s.cond]}</span>`],
  ],
  score: [...LANES.map((l) => [l, `${LANE_ICON[l]}${LANE_NAME[l]}`, (s) => +s.p.scores?.[l] || 0, (s) => `<span class="sc mono" style="--v:${(s.p.scores?.[l] || 0) * 5}%">${s.p.scores?.[l] ?? 0}</span>`]),
    ['avg', '평균', (s) => s.avg, (s) => `<b class="mono">${s.avg.toFixed(1)}</b>`]],
  lane: LANES.map((l) => [l, `${LANE_ICON[l]}${LANE_NAME[l]}`, (s) => (s.lanes[l].g ? s.lanes[l].w / s.lanes[l].g : -1), (s) => `<span class="mono ${wrClass(pct(s.lanes[l].w, s.lanes[l].g))}">${wr(s.lanes[l])}</span>`]),
};
page('rank', {
  keyed: 'auto', // 바뀐 구역만 다시 그림(core.js autoKeys)
  render() {
    const st = S.st, x = st.sum;
    const cols = COLS[LB.view], sortCol = cols.find((c) => c[0] === LB.sort) || cols[0];
    const sig = cardChamp; // 선수가 고른 대표 챔피언
    const rows = st.list.filter((s) => s.g >= LB.min).sort((a, b) => LB.dir * (sortCol[2](a) - sortCol[2](b)) || b.ovr - a.ovr);
    // 상단 TOP 3 카드: 지금 정렬 기준의 1~3위
    const medal = ['CHAMPION', 'RUNNER-UP', 'THIRD'];
    const spot = rows.slice(0, 3).map((s, i) => `<a class="spot s${i + 1}" href="#/players/${s.id}" style="--img:url('${artUrl(sig(s))}');--d:${i}">
      <span class="sp-rk mono">${i + 1}</span><small>${medal[i]}</small><b>${gname(s.id, s.name)}</b>
      <span class="sp-meta">${LANE_ICON[s.mainLane]}${LANE_NAME[s.mainLane]}<i></i>${s.g ? `${s.wr}% · ${s.g}판` : '출전 없음'}${s.titles[0] ? `<i></i>${s.titles[0].e} ${s.titles[0].n}` : ''}</span>
      <span class="sp-val"><em class="mono">${s.ovr}</em><small>OVR</small></span></a>`).join('');
    return `<div class="h2row"><h1>${ic('rank')}랭킹</h1><span class="tag gold">SEASON LADDER</span><span class="grow"></span>
      <div class="seg">${[['all', '종합'], ['score', '라인 점수'], ['lane', '라인별 승률']].map(([k, t]) => `<button class="${LB.view === k ? 'on' : ''}" data-a="lbView" data-v="${k}">${t}</button>`).join('')}</div>
      <label class="mini">최소 <input class="inp xs" type="number" min="0" value="${LB.min}" data-c="lbMin"> 판</label></div>
    <div class="stats">
      ${stat('today', '총 경기', x.n, `내전 ${x.days}일 · 참가 ${x.active}명`, 'gold')}
      ${stat('cal', '최근 내전', st.lastDay ? fmtDay(st.lastDay).slice(5) : '-', `${x.lastDayN}경기`, 'teal')}
      ${stat('scale', '팀 밸런스 지수', x.balance === null ? '-' : x.balance + '%', `평균 점수 차 ${x.avgGap.toFixed(1)}점`, 'purple')}
      ${stat('alert', '업셋', x.upsets, '예상 40% 미만 팀 승리', 'red')}
    </div>
    ${rows.length >= 3 ? `<div class="spots">${spot}</div>` : ''}
    <div class="tw lbw"><table class="tbl lb">
      <thead><tr><th>#</th><th class="l">소환사</th>${cols.map((c) => `<th data-a="lbSort" data-k="${c[0]}" class="s ${sortCol[0] === c[0] ? 'on' : ''}">${c[1]}${sortCol[0] === c[0] ? (LB.dir < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('')}${LB.view === 'all' ? '<th class="l">칭호</th>' : ''}<th class="art"></th></tr></thead>
      <tbody>${rows.map((s, i) => `<tr class="${i < 3 ? 'top t' + (i + 1) : ''}" data-a="goPlayer" data-id="${s.id}" style="--d:${Math.min(i, 14)}"><td class="rk mono"><span class="rkb r${i + 1}">${i + 1}</span></td><td class="l nm gtint">${gname(s.id, s.name)}</td>${cols.map((c) => num(c[3](s))).join('')}${LB.view === 'all' ? `<td class="l chips">${titleChips(s, 1)}</td>` : ''}<td class="art"><u class="rowfx"></u><i data-art="${artUrl(sig(s))}" title="${esc(sig(s))}"></i></td></tr>`).join('') || `<tr><td colspan="20" class="empty">조건에 맞는 선수가 없습니다.</td></tr>`}</tbody>
    </table></div>
    <p class="hint">머리글을 누르면 정렬됩니다. 행을 누르면 선수 카드가 열립니다. OVR = 내전 MMR 50% + 상위 3개 라인 점수 50%.</p>`;
  },
  after(entering) { if (entering) countUp(document.getElementById('main')); },
});
act('lbView', (d) => { LB.view = d.v; LB.sort = d.v === 'all' ? 'ovr' : d.v === 'score' ? 'avg' : 'top'; LB.dir = -1; refresh(); });
act('lbSort', (d) => { if (LB.sort === d.k) LB.dir *= -1; else { LB.sort = d.k; LB.dir = -1; } refresh(); });
act('lbMin', (d, el) => { LB.min = +el.value || 0; refresh(); });
act('goPlayer', (d) => go('#/players/' + d.id));
act('copyLink', async () => {
  const url = location.origin + location.pathname + location.search;
  try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했습니다'); } catch { prompt('이 링크를 복사하세요', url); }
});

// ---------- 경기 기록 ----------
// 새로 들어온 경기(이 화면을 연 뒤 저장된 경기)는 카드에 광택이 한 번 스친다. 처음 그릴 때 한 번만, 2시간 안의 경기만(읽기·쓰기 없음)
const MSEEN = { ids: null, fresh: new Set() };
function noteMatches() {
  const all = S.store?.data?.matches || {}, ids = Object.keys(all);
  if (!MSEEN.ids) { MSEEN.ids = new Set(ids); return; }
  for (const id of ids) if (!MSEEN.ids.has(id)) {
    MSEEN.ids.add(id);
    if (Date.now() - (+all[id]?.at || 0) < 2 * 3600e3) { MSEEN.fresh.add(id); if (MF.open && !all[id].deleted) MF.open.add(dayKey(+all[id].at)); } // 새 경기의 날짜는 펼쳐서 보이게
  }
}
const takeFresh = (id) => (MSEEN.fresh.delete(id) ? ' fresh' : '');
export function matchCard(m, tools = true) {
  if (!MSEEN.ids) noteMatches();
  const mi = S.st.MI[m.id];
  const team = (side) => `<div class="team ${side} ${m.winner === side ? 'win' : 'lose'}">
    <div class="th"><b>${side === 'blue' ? 'BLUE' : 'RED'}</b><em>${m.winner === side ? 'VICTORY' : 'DEFEAT'}</em><small class="mono">${mi.bs !== undefined ? (side === 'blue' ? mi.bs : mi.rs) : ''}</small></div>
    ${m[side].map((id, i) => { const k = m.kda?.[id]; return `<div class="pl">${LANE_ICON[LANES[i]]}${champIcon(m.champs?.[side]?.[i], 'sm')}<a href="#/players/${id}">${gname(id)}</a>${k ? `<small class="mono">${k.join('/')}</small>` : ''}</div>`; }).join('')}
    ${(m.bans?.[side] || []).some(Boolean) ? `<div class="bans">BAN ${m.bans[side].filter(Boolean).map((b) => champIcon(b, 'sm')).join('')}</div>` : ''}
  </div>`;
  return `<div class="mcard${takeFresh(m.id)}">
    <div class="mhd"><b class="mono">#${mi.no}</b><span>${fmtDT(m.at)}</span><span class="mut"><em class="m-hide">예상 </em>블루 ${Math.round(mi.pBlue * 100)}%</span>${mi.upset ? '<span class="tag bad">UPSET</span>' : ''}
      ${m.stats ? '<span class="tag gold">REPLAY</span>' : ''}<span class="grow"></span><button class="btn xs" data-a="matchDetail" data-id="${m.id}">상세</button>${tools && !m.stats ? `<button class="btn xs gold" data-a="matchReplay" data-id="${m.id}" title="이 경기의 .rofl 파일을 넣으면 상세 기록이 채워집니다">리플레이</button>` : ''}
      ${tools ? ddMenu(`<button data-a="editMatch" data-id="${m.id}">${ic('edit')}수정</button><button class="danger" data-a="delMatch" data-id="${m.id}">${ic('trash')}삭제</button>`, 'xs') : ''}</div>
    <div class="vs">${team('blue')}${team('red')}</div></div>`;
}
// 경기 기록: 날짜별로 접어 두고(가장 최근 날짜만 펼침), 선수 필터와 검색으로 원하는 경기만 본다.
// 페이지에 들어올 때마다 필터·검색·펼침 상태는 처음 상태로 돌아간다.
const MF = { sel: [], q: '', mode: 'all', open: null, chips: false, lim: 30, key: '' };
const MF_STEP = 30; // '더 보기' 한 번에 펼친 경기 카드 30개 · 날짜 15개씩
const resetMF = () => { MF.sel = []; MF.q = ''; MF.mode = 'all'; MF.open = null; MF.chips = false; MF.lim = MF_STEP; };
addEventListener('hashchange', () => { if (/^#\/matches\/?$/.test(location.hash)) resetMF(); });
const squash = (s) => String(s || '').replace(/\s/g, '').toLowerCase();
function matchHit(m) {
  const all = [...m.blue, ...m.red];
  if (MF.sel.length) {
    if (!MF.sel.every((id) => all.includes(id))) return false;
    if (MF.sel.length > 1 && MF.mode !== 'all') {
      const sides = MF.sel.map((id) => (m.blue.includes(id) ? 'b' : 'r'));
      const same = sides.every((x) => x === sides[0]);
      if (MF.mode === 'with' && !same) return false;
      if (MF.mode === 'vs' && same) return false;
    }
  }
  if (MF.q) {
    const q = squash(MF.q), qc = cho(q);
    const words = [...all.map((id) => S.st.P[id]?.name || ''), ...(m.champs?.blue || []), ...(m.champs?.red || []), '#' + (S.st.MI[m.id]?.no ?? '')].filter(Boolean).map(squash);
    if (!words.some((w) => w.includes(q) || cho(w).includes(qc))) return false;
  }
  return true;
}
page('matches', {
  render() {
    const st = S.st, days = [...st.days].reverse();
    if (!st.matches.length) return `<h1>${ic('matches')}경기 기록</h1><div class="panel empty">아직 기록된 경기가 없습니다.<br><a class="btn pri" href="#/today">첫 경기 기록하기</a></div>`;
    const filtering = MF.sel.length > 0 || !!MF.q.trim();
    if (!MF.open) MF.open = new Set(days.slice(0, 1)); // 처음에는 가장 최근 날짜만 펼친다
    const hits = filtering ? st.matches.filter(matchHit) : st.matches;
    const played = st.list.filter((s) => s.g > 0).sort((a, b) => b.g - a.g || a.name.localeCompare(b.name, 'ko'));
    const chip = (s) => `<button class="mf-chip ${MF.sel.includes(s.id) ? 'on' : ''}" data-a="mfSel" data-id="${s.id}">${esc(s.name)}<small>${s.g}</small></button>`;
    const shown = MF.chips ? played : played.slice(0, 12);
    const filters = `<div class="panel mf">
      <div class="mf-top"><label class="mf-q">${ic('target')}<input id="mfq" class="inp" placeholder="선수·챔피언·경기 번호 검색 (초성 가능)" value="${esc(MF.q)}" data-i="mfQ" autocomplete="off"></label>
        ${filtering ? `<span class="tag ok">${hits.length}경기 일치</span><button class="btn ghost xs" data-a="mfClear">${ic('x')}필터 해제</button>` : ''}</div>
      <div class="mf-chips">${shown.map(chip).join('')}${played.length > 12 ? `<button class="mf-more" data-a="mfChips">${MF.chips ? '접기' : `+${played.length - 12}명 더`}</button>` : ''}</div>
      ${MF.sel.length > 1 ? `<div class="seg mf-mode">${[['all', '모두 출전'], ['with', '같은 팀'], ['vs', '맞대결']].map(([k, t]) => `<button class="${MF.mode === k ? 'on' : ''}" data-a="mfMode" data-m="${k}">${t}</button>`).join('')}</div>` : ''}
    </div>`;
    const key = [MF.sel.join(','), MF.q.trim(), MF.mode].join('|');
    if (key !== MF.key) { MF.key = key; MF.lim = MF_STEP; } // 검색 조건이 바뀌면 처음 30개부터
    const byDay = {}; for (const m of hits) (byDay[st.MI[m.id].day] ||= []).push(m);
    // 한 번에 날짜 15개 · 펼친 경기 카드 30개까지만 그리고 맨 아래 '더 보기'를 단다(경기가 쌓여도 화면이 느려지지 않게)
    let left = MF.lim, dleft = MF.lim / 2, rest = 0, stop = false; const parts = [];
    for (const d of days) {
      const ms = byDay[d]; if (!ms) continue;
      const open = filtering || MF.open.has(d);
      if (stop || dleft <= 0 || (open && left <= 0)) { rest += ms.length; stop = true; continue; }
      const list = ms.slice().reverse(), cut = open ? list.slice(0, left) : [];
      dleft--;
      if (open) { left -= cut.length; if (cut.length < list.length) { rest += list.length - cut.length; stop = true; } }
      const bw = list.filter((m) => m.winner === 'blue').length;
      parts.push(`<h3 class="day mf-day ${open ? 'open' : ''}" data-a="mfDay" data-d="${d}"><span class="mono">${fmtDay(d)}</span><small>${list.length}경기 · 블루 ${bw}승 / 레드 ${list.length - bw}승</small><span class="grow"></span>${filtering ? '' : `<i class="mf-tg">${open ? '접기' : '펼치기'}${ic('down')}</i>`}</h3>
        ${open ? `<div class="mlist">${cut.map((m) => matchCard(m)).join('')}</div>` : ''}`);
    }
    const body = parts.join('') + (rest > 0 ? `<button class="btn block mf-lim" data-a="mfMore">더 보기 · 남은 ${rest}경기</button>` : '');
    return `<div class="h2row"><h1>${ic('matches')}경기 기록</h1><span class="tag">${st.matches.length}경기</span><span class="grow"></span>
      ${filtering ? '' : `<button class="btn ghost" data-a="mfAll">${MF.open.size >= days.length ? '모두 접기' : '모두 펼치기'}</button>`}<button class="btn" data-a="exportCsv">${ic('down')}CSV 내보내기</button></div>
    ${filters}
    ${body || '<div class="panel empty">조건에 맞는 경기가 없습니다.</div>'}`;
  },
});
act('mfSel', (d) => { MF.sel = MF.sel.includes(d.id) ? MF.sel.filter((x) => x !== d.id) : [...MF.sel, d.id]; if (MF.sel.length < 2) MF.mode = 'all'; refresh(); });
// 검색: 한글 조합 중에는 다시 그리지 않고(글자가 깨진다), 조합이 끝나거나 입력이 멈추면 반영한다
let mfT = 0;
act('mfQ', (d, el, e) => { MF.q = el.value; clearTimeout(mfT); if (e?.isComposing) return; mfT = setTimeout(refresh, 200); });
document.addEventListener('compositionend', (e) => { if (e.target.id === 'mfq') { MF.q = e.target.value; clearTimeout(mfT); mfT = setTimeout(refresh, 120); } });
act('mfMode', (d) => { MF.mode = d.m; refresh(); });
act('mfClear', () => { MF.sel = []; MF.q = ''; MF.mode = 'all'; refresh(); });
act('mfChips', () => { MF.chips = !MF.chips; refresh(); });
act('mfMore', () => { MF.lim += MF_STEP; refresh(); });
act('mfDay', (d, el, e) => { if (e.target.closest('button,a') && !e.target.closest('.mf-day > button')) return; MF.open.has(d.d) ? MF.open.delete(d.d) : MF.open.add(d.d); refresh(); });
act('mfAll', () => { const days = S.st.days; MF.open = MF.open.size >= days.length ? new Set() : new Set(days); refresh(); });
// 경기 상세: 리플레이로 입력한 경기는 피해량·골드·CS·시야·아이템까지, 손으로 입력한 경기는 라인업과 KDA만 보여 준다
act('matchDetail', (d) => {
  const m = S.store.data.matches[d.id], st = S.st, mi = st.MI[d.id]; if (!m || !mi) return;
  const has = !!m.stats, min = (m.dur || 0) / 60000, n = (v) => (+v || 0).toLocaleString('ko-KR');
  const all = [...m.blue, ...m.red].map((id) => m.stats?.[id] || {}), maxD = Math.max(1, ...all.map((x) => +x.dmg || 0)), maxT = Math.max(1, ...all.map((x) => +x.taken || 0));
  const item = (id) => (id && S.ver ? `<img class="it" src="https://ddragon.leagueoflegends.com/cdn/${S.ver}/img/item/${id}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="it"></span>');
  const team = (side) => {
    const sum = (k) => m[side].reduce((a, id) => a + (+m.stats?.[id]?.[k] || 0), 0), ks = m[side].reduce((a, id) => a.map((v, j) => v + (+m.kda?.[id]?.[j] || 0)), [0, 0, 0]);
    return `<div class="rteam ${side} ${m.winner === side ? 'win' : ''}"><div class="rth"><b>${side === 'blue' ? 'BLUE' : 'RED'}</b><em>${m.winner === side ? 'VICTORY' : 'DEFEAT'}</em><span class="mono">${Object.keys(m.kda || {}).length ? ks.join(' / ') : ''}${has ? ` · ${n(sum('gold'))}G · 피해 ${n(sum('dmg'))}` : ''}</span></div>
    <div class="tw"><table class="tbl rtbl"><thead><tr><th></th><th class="l">선수</th><th>KDA</th>${has ? '<th>CS</th><th>골드</th><th class="l">가한 피해 / 받은 피해</th><th>시야</th><th class="l">아이템</th>' : ''}</tr></thead><tbody>
    ${m[side].map((id, i) => { const k = m.kda?.[id], x = m.stats?.[id] || {}, ch = m.champs?.[side]?.[i];
      return `<tr><td>${LANE_ICON[LANES[i]]}</td><td class="l"><span class="rch">${champIcon(ch)}<span><b>${pname(id)}</b><small>${esc(ch || '챔피언 기록 없음')}${x.lvl ? ` · Lv${x.lvl}` : ''}</small></span></span></td>
        <td class="mono">${k ? `${k.join('/')}<small> ${((k[0] + k[2]) / Math.max(1, k[1])).toFixed(1)}</small>` : '—'}</td>
        ${has ? `<td class="mono">${n(x.cs)}<small> ${min ? ((+x.cs || 0) / min).toFixed(1) : ''}</small></td><td class="mono">${n(x.gold)}</td>
        <td class="l"><div class="dbar"><i class="d" style="width:${((+x.dmg || 0) / maxD) * 100}%"></i><span class="mono">${n(x.dmg)}</span></div><div class="dbar"><i class="t" style="width:${((+x.taken || 0) / maxT) * 100}%"></i><span class="mono">${n(x.taken)}</span></div></td>
        <td class="mono">${n(x.vis)}</td><td class="l items">${(x.items || []).map(item).join('')}</td>` : ''}</tr>`; }).join('')}
    </tbody></table></div></div>`;
  };
  modal(`${mh(`경기 #${mi.no} 상세`)}
    <div class="sub mdsub"><span class="mono">${fmtDT(m.at)}</span>${min ? `<span class="mono">${Math.floor(min)}분 ${String(Math.round((min % 1) * 60)).padStart(2, '0')}초</span>` : ''}<span>예상 블루 ${Math.round(mi.pBlue * 100)}%</span><span>점수 ${mi.bs} : ${mi.rs}</span>${mi.upset ? '<span class="tag bad">UPSET</span>' : ''}</div>
    ${team('blue')}${team('red')}
    <div class="row md-act"><span class="mut sm grow">${has ? '리플레이 기록이 적용된 경기입니다.' : '직접 입력한 기록이라 라인업과 KDA만 있습니다. 이 경기의 리플레이(.rofl)를 넣으면 CS·골드·피해량·시야·아이템이 채워집니다.'}</span>${kakaoBtn('match', m.id)}<button class="btn ghost" data-a="matchSwap" data-id="${m.id}" title="블루와 레드를 거꾸로 기록했을 때: 두 팀의 진영만 맞바꿔요(선수·챔피언·KDA·승패는 그대로)">${ic('swap')}진영 바꾸기</button><button class="btn ${has ? '' : 'gold'}" data-a="matchReplay" data-id="${m.id}">${has ? '리플레이 교체' : '리플레이 넣기'}</button></div>`, 'xwide');
});
// 진영 바꾸기: 블루/레드를 거꾸로 적은 경기를 바로잡는다. 두 팀이 통째로 자리를 바꿀 뿐 누가 누구와 한 팀이었는지, 누가 이겼는지는 그대로다.
// 바꾸는 값: 선수 목록·챔피언·밴·승리 진영·저장 당시 점수(bs↔rs, 블루 예상 승률 → 1-값). KDA·리플레이 기록(stats)은 선수 id 기준이라 그대로.
// 바꾸기 전 경기는 되돌리기 기록(history 'match-edit')에 남긴다. 다시 누르면 원래대로 돌아간다.
act('matchSwap', async (d) => {
  const m = S.store.data.matches[d.id]; if (!m || m.deleted) return;
  if (!confirm(`#${S.st.MI[m.id]?.no ?? ''} 경기의 블루와 레드를 맞바꿀까요?\n같은 팀 구성·승패·KDA는 그대로이고, 진영만 바뀝니다. 다시 누르면 원래대로 돌아가요.`)) return;
  const patch = flipSides(m);
  try {
    await history('match-edit', m);
    await S.store.patch('matches', m.id, patch);
    toast('진영을 바꿨어요'); closeModal();
  } catch (e) { toast('바꾸기 실패: ' + (e.code || e.message)); }
});
act('editMatch', (d) => go('#/today/edit/' + d.id));
act('delMatch', (d) => needAdmin(async () => {
  const m = S.store.data.matches[d.id];
  if (!m || !confirm(`#${S.st.MI[m.id].no} 경기를 삭제할까요? (관리 > 삭제된 경기에서 복구할 수 있습니다)`)) return;
  await history('match-delete', m);
  await S.store.patch('matches', m.id, { deleted: true });
  toast('삭제했습니다');
}));
export function exportMatches() {
  const st = S.st, L = LANES.map((l) => LANE_NAME[l]);
  const head = ['번호', '일시', '시리즈', '승리팀', ...L.map((l) => '블루 ' + l), ...L.map((l) => '레드 ' + l), ...L.map((l) => '블루챔프 ' + l), ...L.map((l) => '레드챔프 ' + l), '블루 밴', '레드 밴', '블루 점수', '레드 점수', '블루 예상승률', ...L.map((l) => '블루KDA ' + l), ...L.map((l) => '레드KDA ' + l)];
  const nm = (id) => st.P[id]?.name || S.store.data.players[id]?.name || id;
  const rows = st.matches.map((m) => {
    const mi = st.MI[m.id], d = new Date(m.at);
    const dt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const ch = (s) => LANES.map((_, i) => m.champs?.[s]?.[i] || ''), kd = (s) => m[s].map((id) => (m.kda?.[id] || []).join('/'));
    return [mi.no, dt, m.seriesId || '', m.winner === 'blue' ? '블루' : '레드', ...m.blue.map(nm), ...m.red.map(nm), ...ch('blue'), ...ch('red'), (m.bans?.blue || []).filter(Boolean).join(' '), (m.bans?.red || []).filter(Boolean).join(' '), mi.bs, mi.rs, Math.round(mi.pBlue * 100) + '%', ...kd('blue'), ...kd('red')];
  });
  download(`내전_경기기록_${new Date().toISOString().slice(0, 10)}.csv`, csv([head, ...rows]));
}
act('exportCsv', exportMatches);

// ---------- 챔피언 ----------
const CH = { sort: 'tier', dir: 1, q: '', lane: 'all', si: 0, t: 0 }; // 처음엔 전체 챔피언 티어
// 티어: 보정 승률(표본이 적을수록 50%에 가깝게) + 선택 빈도 가산점
const tierVal = (c, maxG) => ((c.w + 3) / (c.g + 6)) * 100 + (c.g / maxG) * 8;
function tierOf(c, maxG) {
  if (!c.g) return 0;
  const v = tierVal(c, maxG);
  return v >= 64 ? 1 : v >= 56 ? 2 : v >= 48 ? 3 : v >= 42 ? 4 : 5;
}
page('champs', {
  render() {
    const st = S.st, q = CH.q.replace(/\s/g, ''), maxG = Math.max(1, ...st.champs.map((c) => c.g));
    const all = st.champs.map((c) => ({ ...c, tier: tierOf(c, maxG) }));
    const picked = all.filter((c) => c.g), totalPicks = picked.reduce((a, c) => a + c.g, 0);
    if (!picked.length) return `<h1>${ic('champs')}챔피언 분석</h1><div class="panel empty">챔피언 기록이 없습니다. 경기 입력 때 챔피언을 고르면 이곳에 티어와 통계가 쌓입니다.</div>`;
    const val = { tier: (c) => c.tier || 9, g: (c) => c.g, w: (c) => c.w, wr: (c) => (c.g ? c.w / c.g : -1), ban: (c) => c.ban };
    CH.rows = all.map((c) => ({ name: c.name, key: c.name.replace(/\s/g, ''), tier: c.tier, g: c.g, w: c.w }));
    const rows = [...all].sort((a, b) => CH.dir * (val[CH.sort](a) - val[CH.sort](b)) || b.g - a.g || b.w - a.w);
    const th = (k, t) => `<th class="s ${CH.sort === k ? 'on' : ''}" data-a="chSort" data-k="${k}">${t}${CH.sort === k ? (CH.dir < 0 ? ' ▾' : ' ▴') : ''}</th>`;
    const q2 = picked.filter((c) => c.g >= 2), best = [...q2].sort((a, b) => b.w / b.g - a.w / a.g || b.g - a.g)[0], worst = [...q2].sort((a, b) => a.w / a.g - b.w / b.g || b.g - a.g)[0];
    const banned = [...all].sort((a, b) => b.ban - a.ban)[0];
    const wide = [...st.list].sort((a, b) => b.champKinds - a.champKinds)[0];
    // 선수별 시그니처(가장 많이 쓴 챔피언). 2판 이상인 선수가 있으면 그 선수들만, 없으면 전원
    let sigs = st.list.map((x) => { const e = Object.entries(x.champs).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w)[0]; return e ? { s: x, n: e[0], ...e[1] } : null; }).filter(Boolean).sort((a, b) => b.g - a.g || b.w - a.w);
    if (sigs.some((x) => x.g >= 2)) sigs = sigs.filter((x) => x.g >= 2);
    sigs = sigs.slice(0, 12);
    CH.si %= Math.max(1, sigs.length);
    const ins = (cap, title, name, sub, tone, cls = '') => `<div class="ins ${tone} ${cls}" style="--img:url('${tileUrl(name)}')"><small>${cap}</small><span>${title}</span><b>${esc(name || '—')}</b><em>${sub}</em></div>`;
    const topN = picked.slice(0, 7), topMax = topN[0].g;
    // "전체" 탭에서도 표시를 유지한다: 어느 한 라인에서라도 OP/꿀벌이면 붙인다(둘 다면 OP 우선)
    const marks = {};
    if (CH.lane === 'all') LANES.forEach((l) => laneTierList(l).forEach((c) => { if (c.mark && marks[c.name] !== 'op') marks[c.name] = c.mark; }));
    const tl = CH.lane === 'all' ? picked.map((c) => ({ ...c, mark: marks[c.name] })) : laneTierList(CH.lane);
    return `<div class="h2row"><h1>${ic('champs')}챔피언 분석</h1><span class="tag">${picked.length}종 · ${totalPicks}픽 · 다양성 ${Math.round((picked.length / totalPicks) * 100)}%</span><span class="grow"></span><span class="chq-w"><input id="chq" class="inp" placeholder="챔피언 검색" value="${esc(CH.q)}" data-i="chQ" autocomplete="off" aria-controls="chq-r"><span class="chq-r" id="chq-r" hidden></span></span></div>
    <div class="chtop">
      <div class="stat gold toprank"><small>MOST PICKED · 선택 순위 TOP ${topN.length}</small><div class="trk">${topN.map((c, i) => `<div class="trk-r r${i + 1}" style="--d:${i}"><i class="mono">${i + 1}</i>${champIcon(c.name, 'sm')}<span>${esc(c.name)}</span><u><s style="width:${(c.g / topMax) * 100}%"></s></u><b class="mono">${c.g}<small>픽</small></b><em class="mono ${wrClass(pct(c.w, c.g))}">${pct(c.w, c.g)}%</em></div>`).join('')}</div></div>
      ${best ? ins('HIGHEST WIN RATE', '최고 승률 (2픽 이상)', best.name, `${best.g}전 ${best.w}승 · ${pct(best.w, best.g)}%`, 'teal') : '<div></div>'}
      ${worst && worst !== best ? ins('LOWEST WIN RATE', '고전 중인 카드', worst.name, `${worst.g}전 ${worst.w}승 · ${pct(worst.w, worst.g)}%`, 'red') : '<div></div>'}
      ${ins('MOST PICKED', '최다 선택', picked[0].name, `${picked[0].g}픽 · 승률 ${pct(picked[0].w, picked[0].g)}%`, 'gold')}
      ${ins('MOST BANNED', '최다 밴', banned?.ban ? banned.name : '', banned?.ban ? `${banned.ban}회 밴` : '밴 기록 없음', 'red')}
      ${stat('users', '최다 챔피언 폭', wide?.champKinds ? esc(wide.name) : '-', wide?.champKinds ? `${wide.champKinds}종 사용` : '', 'blue')}
      <div class="sigrot" id="sigrot">${sigs.map((x, i) => ins('SIGNATURE PICK', `${esc(x.s.name)}의 시그니처`, x.n, `${x.g}판 · 승률 ${pct(x.w, x.g)}%`, 'blue', i === CH.si ? 'on' : '')).join('') || ins('SIGNATURE PICK', '시그니처', '', '기록 없음', 'blue', 'on')}${sigs.length > 1 ? `<div class="sigdots">${sigs.slice(0, 12).map((_, i) => `<i class="${i === CH.si ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>
    </div>
    <div class="sec-h"><h2>티어 리스트</h2><span class="mut sm">보정 승률(표본 반영) + 선택 빈도 기준 · 내전 데이터 한정</span><span class="grow"></span><span class="asof mono">기준 ${today()}</span></div>
    ${laneSeg(CH.lane, 'chLane', true)}
    <div class="tiers">${tierRows(tl, { all: true, pctOn: true })}</div>
    <div class="sec-h"><h2>전체 통계</h2></div>
    <div class="tw"><table class="tbl"><thead><tr>${th('tier', '티어')}<th class="l">챔피언</th>${th('g', '픽')}${th('w', '승')}${th('wr', '승률')}${th('ban', '밴')}<th class="l">주 사용자</th></tr></thead>
    <tbody id="chtb">${rows.map((c) => {
      const u = Object.entries(c.users).sort((a, b) => b[1] - a[1]), key = c.name.replace(/\s/g, '');
      return `<tr data-n="${esc(key)}" ${q && !key.includes(q) ? 'hidden' : ''}><td>${c.tier ? `<span class="tbadge t${c.tier}">${c.tier}</span>` : '<span class="mut">-</span>'}</td><td class="l nm">${champIcon(c.name, 'sm')} ${esc(c.name)}</td>${num(`<span class="mono">${c.g}</span>`)}${num(`<span class="mono">${c.w}</span>`)}${num(wrBar(c.w, c.g))}${num(`<span class="mono">${c.ban || '-'}</span>`)}<td class="l users">${u.slice(0, 5).map(([id, n]) => `<span>${pname(id)}<small class="mono">${n}</small></span>`).join('')}</td></tr>`;
    }).join('')}<tr class="ch-none" ${rows.some((c) => !q || c.name.replace(/\s/g, '').includes(q)) ? 'hidden' : ''}><td colspan="7" class="empty">검색 결과가 없습니다.</td></tr></tbody></table></div>`;
  },
  after() { // 시그니처 칸: 4초마다 다음 선수로
    clearInterval(CH.t);
    CH.t = setInterval(() => {
      if (S.page !== 'champs') return clearInterval(CH.t);
      const box = document.getElementById('sigrot'), cards = box ? box.querySelectorAll('.ins') : [];
      if (cards.length < 2 || box.matches(':hover') || document.visibilityState !== 'visible') return;
      CH.si = (CH.si + 1) % cards.length;
      cards.forEach((c, i) => c.classList.toggle('on', i === CH.si));
      box.querySelectorAll('.sigdots i').forEach((c, i) => c.classList.toggle('on', i === CH.si));
    }, 4000);
  },
});
act('chLane', (d) => { CH.lane = d.l; refresh(); });
act('chSort', (d) => { if (CH.sort === d.k) CH.dir *= -1; else { CH.sort = d.k; CH.dir = d.k === 'tier' ? 1 : -1; } refresh(); });
// 검색: 화면 전체를 다시 그리지 않고 표의 줄만 숨김/보임(입력칸이 바뀌지 않아 한글 조합이 끊기지 않음)
// + 검색창 바로 아래에 결과(최대 8개: 아이콘·티어·픽·승률)를 작게 띄우고, 누르면 아래 전체 통계 표의 그 줄로 이동해 반짝
function chSuggest() {
  const box = document.getElementById('chq-r'); if (!box) return;
  const q = CH.q.replace(/\s/g, '');
  if (!q) { box.hidden = true; box.innerHTML = ''; return; }
  const hit = (CH.rows || []).filter((c) => c.key.includes(q)).sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || b.g - a.g || a.name.localeCompare(b.name, 'ko'));
  box.innerHTML = hit.length ? hit.slice(0, 8).map((c) => `<button type="button" class="chq-i" data-a="chGo" data-n="${esc(c.key)}">${champIcon(c.name, 'sm')}<b>${esc(c.name)}</b>${c.tier ? `<span class="tbadge t${c.tier}">${c.tier}</span>` : ''}<small>${c.g ? `${c.g}픽 · 승률 ${pct(c.w, c.g)}%` : '기록 없음'}</small></button>`).join('') + (hit.length > 8 ? `<small class="chq-more">그 외 ${hit.length - 8}개는 아래 표에서</small>` : '')
    : '<small class="chq-more">검색 결과가 없어요</small>';
  box.hidden = false;
}
act('chQ', (d, el) => {
  CH.q = el.value; const q = CH.q.replace(/\s/g, ''), tb = document.getElementById('chtb'); if (!tb) return refresh();
  let any = false; tb.querySelectorAll('tr[data-n]').forEach((tr) => { const on = !q || tr.dataset.n.includes(q); tr.hidden = !on; any ||= on; });
  const none = tb.querySelector('.ch-none'); if (none) none.hidden = any;
  chSuggest();
});
act('chGo', (d) => {
  const box = document.getElementById('chq-r'); if (box) box.hidden = true;
  const tr = document.querySelector(`#chtb tr[data-n="${CSS.escape(d.n)}"]`); if (!tr) return;
  tr.hidden = false;
  tr.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  tr.classList.remove('ch-hit'); void tr.offsetWidth; tr.classList.add('ch-hit');
});
// 검색창을 다시 누르면 결과 다시 보이기, 바깥을 누르거나 Esc면 닫기(검색어·표 거르기는 그대로)
document.addEventListener('focusin', (e) => { if (e.target.id === 'chq' && CH.q.trim()) chSuggest(); });
document.addEventListener('pointerdown', (e) => { const box = document.getElementById('chq-r'); if (box && !box.hidden && !e.target.closest('.chq-w')) box.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || e.isComposing) return; const box = document.getElementById('chq-r'); if (box && !box.hidden) { box.hidden = true; e.stopPropagation(); } }, true);

// ---------- 피어리스 현황 ----------
export function seriesUsed(seriesId, exceptMatchId) {
  const used = {};
  (S.st.series.find((s) => s.id === seriesId)?.ms || []).forEach((m) => {
    if (m.id === exceptMatchId) return;
    ['blue', 'red'].forEach((side) => (m.champs?.[side] || []).forEach((c, i) => { if (c) used[c] = `${S.st.P[m[side][i]]?.name || '?'} · ${S.st.MI[m.id].no}번 경기`; }));
  });
  return used;
}
const FL = { id: null, left: false };
page('fearless', {
  render() {
    const st = S.st, list = [...st.series].reverse();
    if (!list.length) return `<h1>${ic('fearless')}피어리스 현황</h1><div class="panel empty">아직 시리즈가 없습니다. 경기를 기록하면 같은 팀으로 이어서 한 판들이 한 시리즈로 묶입니다.</div>`;
    const sr = list.find((s) => s.id === FL.id) || list[0];
    const used = seriesUsed(sr.id), first = sr.ms[0];
    const teams = [first.blue, first.red].map((roster, ti) => ({ roster, name: ti ? '레드로 시작한 팀' : '블루로 시작한 팀', side: ti ? 'red' : 'blue', wins: sr.ms.filter((m) => m[m.winner].includes(roster[0])).length }));
    const cell = (id, m) => { for (const side of ['blue', 'red']) { const i = m[side].indexOf(id); if (i >= 0) return `<td>${champIcon(m.champs?.[side]?.[i])}</td>`; } return '<td></td>'; };
    const pool = S.champs.filter((c) => !FL.left || !used[c.name]);
    return `<div class="h2row"><h1>${ic('fearless')}피어리스 현황</h1><span class="grow"></span>
      <select class="inp" data-c="flSel">${list.map((s) => `<option value="${s.id}" ${s.id === sr.id ? 'selected' : ''}>${fmtDay(s.day).slice(5)} · ${s.ms.map((m) => '#' + st.MI[m.id].no).join(' ')} (${s.ms.length}판)</option>`).join('')}</select></div>
    <p class="hint">한 시리즈(같은 두 팀이 이어서 하는 판들) 동안 한 번 나온 챔피언은 양 팀 모두 다시 쓸 수 없습니다. 밴은 다음 판으로 이어지지 않습니다.</p>
    <div class="grid2">${teams.map((t) => `<div class="panel side-${t.side}"><div class="ph"><b>${t.name}</b><span class="tag">${t.wins}승</span></div>
      <div class="tw"><table class="tbl fl"><thead><tr><th class="l">선수</th>${sr.ms.map((m) => `<th class="mono">#${st.MI[m.id].no}</th>`).join('')}</tr></thead>
      <tbody>${t.roster.map((id) => `<tr><td class="l nm">${gname(id)}</td>${sr.ms.map((m) => cell(id, m)).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}</div>
    <div class="h2row"><h2>챔피언 풀</h2><span class="tag bad">사용 ${Object.keys(used).length}</span><span class="tag ok">남음 ${Math.max(0, S.champs.length - Object.keys(used).length)}</span><span class="grow"></span>
      <label class="mini"><input type="checkbox" data-c="flLeft" ${FL.left ? 'checked' : ''}> 남은 챔피언만</label></div>
    ${S.champs.length ? `<div class="cpgrid static">${pool.map((c) => `<div class="cp ${used[c.name] ? 'used' : ''}" title="${esc(used[c.name] || '사용 가능')}"><img src="${c.img}" loading="lazy" alt=""><span>${esc(c.name)}</span>${used[c.name] ? `<em>${esc(used[c.name].split(' · ')[0])}</em>` : ''}</div>`).join('')}</div>`
      : `<div class="panel">사용된 챔피언: ${Object.keys(used).map(esc).join(', ') || '없음'}</div>`}`;
  },
});
act('flSel', (d, el) => { FL.id = el.value; refresh(); });
act('flLeft', (d, el) => { FL.left = el.checked; refresh(); });

// ---------- 부팅 ----------
// DB 변경 → 화면 갱신. 바뀐 내용과 지금 보고 있는 화면에 꼭 필요한 만큼만 다시 그린다.
//  · 통계 재계산(compute)은 선수·경기·설정이 바뀔 때만
//  · meta는 문서별로 무엇이 바뀌었는지 가려서 처리(라인업 초안은 오늘의 내전 화면에서만, 주사위·강퇴는 각자 처리)
const metaSig = {};
function metaDiff() {
  const m = S.store.data.meta || {}, ch = {};
  for (const k of new Set([...Object.keys(m), ...Object.keys(metaSig)])) { const v = JSON.stringify(m[k] ?? null); if (metaSig[k] !== v) { metaSig[k] = v; ch[k] = 1; } }
  return ch;
}
// 선수 문서 중 통계 계산에 쓰는 부분의 지문: 문파 소속(guild·glog)·수정 시각(upd)만 바뀌었으면 같다 → 통계 재계산 없이 화면만(바뀐 칸만) 다시 그림
let pSig = '';
function playersSig() {
  const sig = JSON.stringify(Object.values(S.store.data.players || {}).map(({ guild, glog, upd, ...rest }) => rest).sort((a, b) => (a.id < b.id ? -1 : 1)));
  const changed = sig !== pSig; pSig = sig; return changed;
}
function onStore(c) {
  if (c === 'chat') return renderChat();
  if (c === 'presence') return renderPresence();
  if (c === 'auctions') { if (S.page === 'auction') refresh(); return; }
  if (c === 'meta') {
    if (closedCheck()) return;
    const ch = metaDiff();
    if (ch.dice) watchDice();
    if (ch.board || ch.luck) watchBoard(); // 1지망 보정이 바뀌면 열려 있는 라인 지원 화면의 확률도 다시 그린다
    if (ch.luck && S.page === 'admin') refresh();
    if (ch.settings || ch.kicks) onMeta();
    if (ch.settings) refresh(true); else if (ch.todayDraft && S.page === 'today') refresh();
    if (ch.scorelog && (S.page === 'home' || S.page === 'scores')) refresh();
    if (ch.pause) checkPause();
    if (ch.recruit) onRecruit();
    if (ch.guild) refresh(); // 문파 창설·공지·문파장: 이름 옆 엠블럼과 문파 화면(통계 재계산은 필요 없음)
    return;
  }
  if (c === 'posts') { watchPosts(); postsChanged(); if (S.page === 'talk') refresh(); return; }
  if (c === 'matches') noteMatches();
  if (c === 'players') { S.pv = (S.pv || 0) + 1; return refresh(playersSig()); } // 문파 배정처럼 통계와 상관없는 변경이면 통계를 다시 계산하지 않음
  if (c === 'matches') refresh(true);
}
// ---------- 사용량 자동 쉬기 ----------
// 연동 서버(Worker)가 30분마다 사용량을 보고, 오늘 Firebase 무료 한도의 95%를 넘으면 meta/pause = { on, day(태평양 날짜), reason } 를 적는다.
// 사이트는 그날(구글 한도가 초기화되는 태평양 자정 = 한국 오후 4~5시 전까지) 화면을 덮고 meta 외 실시간 구독을 끊는다. 기록은 그대로.
// 관리자가 '지금 다시 열기'를 누르면 { on:false, resumeDay:오늘 } → 그날은 Worker가 다시 쉬게 하지 않는다.
const ptDay = (t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
export const pausedNow = () => { const x = S.store?.data?.meta?.pause; return !!(x && x.on && x.day === ptDay()); };
const PAUSE_KEY = () => 'naejeon:pause:' + S.key;
function nextReset() { // 다음 태평양 자정(한국 시각으로 보여 준다)
  const d0 = ptDay(); let t = Date.now() - (Date.now() % 60e3);
  while (ptDay(t) === d0 && t < Date.now() + 27 * 3600e3) t += 10 * 60e3;
  t -= 10 * 60e3; while (ptDay(t) === d0) t += 60e3;
  return t;
}
function pauseHTML() {
  const x = S.store.data.meta.pause, t = nextReset(), d = new Date(t), today = new Date().toDateString() === d.toDateString();
  return `<div class="pz-in">${logo(false, 64)}<b>잠시 쉬어요</b>
    <p>오늘 Firebase 무료 사용량이 95%를 넘어서, 요금이 나가지 않도록 사이트를 잠시 쉬게 했어요.<br>경기 기록·점수 같은 데이터는 모두 그대로예요.</p>
    ${x.reason ? `<p class="pz-why">${esc(x.reason)}</p>` : ''}
    <p class="pz-at">${today ? '오늘' : '내일'} <em>${d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</em>쯤 자동으로 다시 열려요</p>
    <button class="btn gold" data-a="pauseResume">관리자: 지금 다시 열기</button>
    <small>다시 열면 오늘 남은 시간은 쉬지 않고, 무료 한도를 넘은 만큼 요금이 붙을 수 있어요.</small></div>`;
}
function checkPause() {
  if (!S.store || document.getElementById('np-maint')) return; // 폐쇄 화면은 일부러 구독을 멈춘 것이라 '쉬기 끝 → 새로고침'을 하지 않는다(1분마다 새로고침되던 문제)
  const on = pausedNow();
  let el = document.getElementById('pause');
  if (on) {
    try { localStorage.setItem(PAUSE_KEY(), ptDay()); } catch {}
    if (!S.store.isPaused?.()) S.store.pause?.();
    if (!el) { el = document.createElement('div'); el.id = 'pause'; document.body.appendChild(el); }
    el.innerHTML = pauseHTML();
  } else {
    try { localStorage.removeItem(PAUSE_KEY()); } catch {}
    if (el) el.remove();
    if (S.store.isPaused?.()) location.reload(); // 쉬는 동안 끊은 구독을 처음부터 다시 시작
  }
}
setInterval(checkPause, 60e3); // 날짜가 바뀌면(한국 오후 4~5시) 자동으로 다시 연다
act('pauseResume', () => needAdmin(async () => {
  try { await S.store.put('meta', 'pause', { on: false, resumeDay: ptDay(), by: 'admin', at: Date.now() }); toast('사이트를 다시 열어요'); }
  catch (e) { toast('실패: ' + (e.code || e.message)); }
}));

// 쓰기 안전장치가 작동하면(store.js guard: 한 화면에서 1분에 저장 100번 초과) 화면 위에 알림을 띄운다. 보기는 계속 되고 저장만 멈춘 상태
function showFuse() {
  if (document.getElementById('fuse')) return;
  const el = document.createElement('div'); el.id = 'fuse'; el.setAttribute('role', 'alert');
  el.innerHTML = `${ic('alert')}<p><b>저장을 잠시 멈췄어요</b><small>이 화면에서 저장이 너무 많이 반복돼서, 사용량이 늘지 않도록 멈췄어요. 새로고침하면 다시 정상으로 돌아와요.</small></p><button class="btn gold" data-a="fuseReload">새로고침</button>`;
  document.body.appendChild(el);
}
act('fuseReload', () => location.reload());

window.NP_OK = 1; // index.html의 시작 확인(이 줄까지 왔다면 모든 JS 파일이 문제없이 이어진 것)
(async () => {
  // 잠깐 배포됐던 웹앱 알림용 서비스 워커가 남아 있으면 지운다(웹앱 기능은 쓰지 않기로 함)
  try { navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {}); } catch {}
  const qs = new URLSearchParams(location.search), key = qs.has('demo') ? 'local' : qs.get('k');
  const main = document.getElementById('main');
  if (FIREBASE_CONFIG && !key) {
    document.body.classList.add('bare');
    document.getElementById('splash').remove();
    main.innerHTML = `<div class="panel landing">${logo(true, 96)}<h1>NAEJEONPOT</h1><p>초대 링크로 접속해 주세요. 링크 끝의 <code>?k=…</code> 코드가 이 리그의 열쇠입니다.</p>
      <button class="btn pri" id="mk">새 리그 만들기</button><p class="hint">새 리그를 만들면 이 브라우저에서 임의의 코드가 생성됩니다. 만들어진 주소를 친구들에게 공유하세요.</p></div>`;
    main.classList.add('enter');
    document.getElementById('mk').onclick = () => {
      const a = crypto.getRandomValues(new Uint8Array(15));
      location.search = '?k=' + [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    };
    return;
  }
  S.key = key || 'local';
  let up = false;
  try {
    prefetchChamps().catch(() => {}); // 챔피언 목록(배너·챔피언 그림)은 DB 연결과 동시에 받기 시작한다
    S.store = await createStore(S.key, (c, err) => {
      if (c === 'error') return toast('DB 연결 오류: ' + (err?.code || err));
      if (c === 'fuse') return showFuse();
      if (!up) return;
      onStore(c);
    }, { chatOpen: chatStartsOpen() }); // 채팅창이 닫힌 채 시작하면 채팅은 최신 1개만 받는다
    await S.store.ready;
  } catch (e) { document.getElementById('splash')?.remove(); main.innerHTML = `<div class="panel landing"><h1>연결 실패</h1><p>${esc(e.message || e)}</p><p class="hint">js/config.js 의 Firebase 설정과 Firestore 규칙을 확인하세요.</p></div>`; return; }
  if (MAINT && !maintPass()) { maintWatch(); return maintGate(); }
  maintWatch(); // 열어 둔 화면도 폐쇄(MAINT)가 켜지면 스스로 막힌다(옛 화면·저장된 옛 페이지로 들어온 경우 대비)
  await SEASON.ready; // 시즌이 아니면 바로 끝난다. 시즌이면 시작 화면 장식 전에 받아 둔다(DB 연결과 동시에 받으므로 보통 기다리지 않는다)
  metaDiff(); up = true; watchDice(true); watchBoard(true); watchPosts(true); initShell(); mountRecruit(); initSocial(); SEASON.x?.initXmas(); SEASON.n?.initNewYear(); loadChamps();
  siteBg();
  checkPause(); closedCheck(); if (MAINT) maintBar(); noticePop();
})();
// 사이트 배경 그림: 첫 화면·DB 연결이 끝나 한가할 때 받는다(첫 화면에 쓰는 파일과 경쟁하지 않게). 다 받은 뒤 CSS 층(#sitebg)에 붙여 서서히 나타나게.
// CSS의 그림 주소와 같은 주소라 브라우저가 받은 것을 그대로 다시 씀(두 번 받지 않음). 화면을 돌리면 CSS가 알아서 다른 그림으로 바꾼다
function siteBg() {
  const el = document.getElementById('sitebg'); if (!el || el.classList.contains('on')) return;
  const url = matchMedia('(max-aspect-ratio:4/5)').matches ? 'img/bg-m.webp' : 'img/bg-pc.webp';
  const go = () => { const im = new Image(); im.decoding = 'async'; im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => el.classList.add('on')); im.src = url; };
  window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 1200);
}
// 초대 링크를 바꾼 뒤 옛 링크(meta/closed가 있는 리그)로 들어오면: 실시간 구독을 끊고 안내 화면만 보여 준다(새 링크는 알려 주지 않음)
// 링크를 바꾼 관리자 본인 화면은 결과 창을 보고 있어야 하므로 이번 접속에서는 띄우지 않는다(S.rotating)
function closedCheck() {
  const c = S.store?.data?.meta?.closed; if (!c?.at || S.rotating) return false;
  if (document.getElementById('np-closed')) return true;
  try { S.store.pause?.(); } catch {}
  document.body.insertAdjacentHTML('beforeend', `<div id="np-closed" class="np-closed" role="alertdialog" aria-modal="true"><div class="panel">${logo(true, 72)}<h1>이 초대 링크는 더 이상 쓰지 않아요</h1><p>관리자가 ${new Date(c.at).toLocaleDateString('ko-KR')}에 초대 링크를 새로 만들었어요.<br>단톡방이나 관리자에게 <b>새 초대 링크</b>를 받아 들어와 주세요.</p><p class="hint">기록은 모두 새 링크로 옮겨졌어요. 이 주소로는 더 이상 저장되지 않아요.</p></div></div>`);
  return true;
}
// 폐쇄 모드(config.js MAINT): 관리자 PIN을 넣은 기기만 들어온다. 다른 접속자는 실시간 구독을 멈추고(읽기 거의 0) '사이트 폐쇄' 화면만 본다.
// 한 번 통과한 기기는 PIN이 바뀌기 전까지 다시 묻지 않는다(localStorage에 PIN 해시)
const MAINT_K = () => 'naejeon:maint:' + S.key;
function maintPass() { const h = settings().pinHash; if (isAdmin()) return true; try { return !!h && localStorage.getItem(MAINT_K()) === h; } catch { return false; } }
function maintGate() {
  if (document.getElementById('np-maint')) return;
  document.getElementById('splash')?.remove();
  try { S.store.pause?.(); } catch {}
  try { closeModal(); } catch {}
  document.body.classList.add('bare');
  document.getElementById('main').innerHTML = '';
  document.getElementById('np-mbar')?.remove();
  document.title = '사이트 폐쇄 · NAEJEONPOT';
  document.body.insertAdjacentHTML('beforeend', `<div id="np-maint" class="np-closed np-maint" role="alertdialog" aria-modal="true" aria-labelledby="mt-h"><div class="panel">${logo(true, 72)}
    <span class="mt-tag">${ic('lock')}CLOSED</span><h1 id="mt-h">사이트가 폐쇄되었습니다</h1>
    <p>운영자의 사정으로 NAEJEONPOT 운영을 종료합니다.<br>그동안 이용해 주셔서 감사합니다.</p>
    <p class="hint">재개 여부는 운영자에게 문의해 주세요.</p>
    <details class="mt-adm"><summary>관리자 입장</summary><form id="mt-f" class="row"><input class="inp grow" id="mt-pin" type="password" inputmode="numeric" autocomplete="off" placeholder="관리자 PIN" aria-label="관리자 PIN"><button class="btn pri">입장</button></form></details></div></div>`);
  document.getElementById('mt-f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = document.getElementById('mt-pin').value.trim();
    if (v.length < 4) return toast('4자리 이상 입력하세요');
    const h = await sha(v), cur = settings().pinHash;
    if (!cur) await S.store.patch('meta', 'settings', { pinHash: h }); // PIN이 아직 없으면 관리 화면과 같이 지금 넣은 값이 관리자 PIN
    else if (h !== cur) return toast('PIN이 맞지 않습니다');
    try { localStorage.setItem(MAINT_K(), h); sessionStorage.setItem('naejeon:admin:' + S.key, h); } catch {}
    location.reload();
  });
}
// 열어 둔 화면 감시: 10분마다 + 다른 앱에 갔다가 돌아올 때(2분 넘게 지났으면) 최신 config.js를 받아(DB 읽기 아님, 작은 파일 하나)
// 폐쇄가 켜졌고 이 기기가 통과 기기가 아니면 바로 폐쇄 화면으로 바꾼다. 폐쇄 화면을 보는 중에 폐쇄가 풀리면 새로고침해서 다시 들어오게 한다
const MW = { at: Date.now(), busy: false };
async function maintCheck() {
  if (MW.busy || document.hidden) return;
  MW.busy = true; MW.at = Date.now();
  try {
    const t = await (await fetch('js/config.js?mc=' + Date.now(), { cache: 'no-store' })).text();
    const on = /export const MAINT = true/.test(t), off = /export const MAINT = false/.test(t);
    if (on && !maintPass()) maintGate();
    else if (off && document.getElementById('np-maint')) location.reload();
  } catch {} finally { MW.busy = false; }
}
function maintWatch() {
  if (MW.on) return; MW.on = 1;
  setInterval(maintCheck, 10 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - MW.at > 2 * 60e3) maintCheck(); });
}
// 관리자 화면에는 폐쇄 중이라는 작은 띠를 띄워 둔다(공개를 잊지 않게)
function maintBar() { if (document.getElementById('np-mbar')) return; document.body.insertAdjacentHTML('beforeend', '<div id="np-mbar" class="np-mbar" role="status">폐쇄 모드 · 관리자만 접속 중</div>'); }
// 공지 창(로딩 창이 끝나고 홈이 열릴 때 한 번): 길드 창설 안내. 창설 시각부터 3일 동안만, 접속(탭)마다 한 번, '다시 보지 않기'를 누르면 이 기기에서는 끝
// 저장·읽기 없음(문구는 코드에 있음). 다른 창이 떠 있으면 닫힐 때까지 기다린다
const POP = { id: 'guild-open2', days: 3 }; // 문구가 바뀌면 id를 바꿔 다시 보이게
function noticePop() {
  const gm = S.store.data.meta?.guild, k = 'naejeon:pop:' + POP.id;
  if (!guildOn() || !gm?.at || Date.now() > +gm.at + POP.days * 864e5) return;
  try { if (localStorage.getItem(k) || sessionStorage.getItem(k)) return; } catch { return; }
  let n = 0;
  const t = setInterval(() => {
    if (++n > 120) return clearInterval(t); // 1분 안에 홈이 안 열리면 이번 접속은 건너뜀
    if (document.getElementById('splash') || S.page !== 'home' || document.getElementById('modal').classList.contains('on') || document.getElementById('np-closed')) return;
    clearInterval(t);
    try { sessionStorage.setItem(k, '1'); } catch {}
    const mine = (() => { try { const id = localStorage.getItem('naejeon:me:' + S.key); return gOf(id); } catch { return ''; } })();
    const el = modal(`<div class="np-pop"><div class="npp-top">${gem('j')}<i>VS</i>${gem('m')}</div><small class="npp-k">NOTICE · 문파 창설</small>
      <h2>정파 · 마교, 두 문파가 열렸습니다</h2>
      <p>오늘부터 NAEJEONPOT에 두 개의 문파 <b class="npp-j">정파</b>와 <b class="npp-m">마교</b>가 창설되었어요.</p>
      <ul><li>관리자가 소환사를 문파에 배정하고, 이름 옆에 문파 엠블럼이 표시돼요.</li>
        <li>문파 페이지에서 문파 전적 · 정마대전 · 챔피언 활용 · 명예의 전당을 확인할 수 있어요.</li>
        <li><b>문파는 분기(3개월) 단위로 진행돼요.</b> 분기마다 전적·정마대전 승부를 새로 겨루고, 지난 분기 결과는 보관돼요. 문파 금고(냥)는 분기가 바뀌어도 이어져요.</li>
        <li>채팅창의 <b>정파 · 마교 탭</b>에서 문파원끼리만 대화할 수 있어요(문파 비밀번호).</li>
        <li>문파 페이지에는 문파원들이 함께 쓰는 게시판이 있어요.</li>
        <li>블루·레드 팀을 각각 한 문파로만 꾸리면 자동으로 '정마대전'으로 기록돼요.</li></ul>
      <p class="npp-s">내 문파는 홈의 '내 문파' 띠나 내 페이지에서 확인해 보세요.</p>
      <label class="mini"><input type="checkbox" id="npp-no"> 다시 보지 않기</label>
      <div class="row npp-b"><button class="btn" data-a="nppClose">닫기</button><button class="btn pri" data-a="nppGo" data-h="${ghref(mine || 'j')}">${mine ? '내 문파 보러 가기' : '문파 보러 가기'}</button></div></div>`, 'np-popw');
    el.querySelector('.btn.pri')?.focus({ preventScroll: true });
  }, 500);
}
const nppDone = () => { try { if (document.getElementById('npp-no')?.checked) localStorage.setItem('naejeon:pop:' + POP.id, '1'); } catch {} };
act('nppClose', () => { nppDone(); closeModal(); });
act('nppGo', (d) => { nppDone(); closeModal(); go(d.h); });
