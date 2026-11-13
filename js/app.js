// 시작점 + 홈 / 랭킹 / 경기 기록 / 챔피언 / 피어리스 화면
import { FIREBASE_CONFIG } from './config.js';
import { createStore } from './store.js';
import { S, page, act, esc, col, settings, pname, go, refresh, initShell, loadChamps, fmtDT, fmtDay, wr, wrClass, wrBar, dots, streak, laneTag, titleChips, champIcon, splashUrl, tileUrl, artUrl, sigChamp, toast, download, csv, needAdmin, history, modal, mh, ic, logo, countUp, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import { initSocial, renderChat, renderPresence, onMeta } from './social.js';
import { watchReveal } from './today.js';
import { duoRank } from './stats.js';
import { watchDice } from './dice.js';
import './replay.js';
import './players.js';
import './auction.js';
import './admin.js';
import './maker.js';

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
function notices() {
  const st = S.st, x = st.sum, out = [], P = st.P;
  const add = (tag, tone, title, body) => out.push({ tag, tone, title, body });
  if (settings().notice) add('공지', 'gold', esc(settings().notice.split('\n')[0]), esc(settings().notice.split('\n').slice(1).join(' ')));
  if (!x.n) { add('안내', 'blue', '첫 경기를 기록해 보세요', '오늘의 내전에서 라인업을 짜고 결과를 저장하면 통계가 자동으로 쌓입니다.'); return out; }
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
// 홈 배너: 내전에 나온 챔피언(적으면 전체)의 일러스트를 순서를 섞어 차례로 보여 준다
const HERO = { list: [], i: 0, t: 0, flip: 0 };
function heroList() {
  if (HERO.list.length || !S.champs.length) return HERO.list;
  const played = S.st.champs.filter((c) => c.g && S.champBy[c.name]).map((c) => c.name);
  const pool = played.length >= 6 ? played : S.champs.map((c) => c.name);
  HERO.list = pool.map((n) => [Math.random(), n]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, 40);
  return HERO.list;
}
function heroNext() {
  const list = HERO.list, bgs = document.querySelectorAll('.hero-bg'); if (list.length < 2 || bgs.length < 2) return;
  const name = list[(HERO.i + 1) % list.length], url = artUrl(name), img = new Image();
  img.onload = () => {
    if (S.page !== 'home' || !document.body.contains(bgs[0])) return;
    HERO.i = (HERO.i + 1) % list.length; HERO.flip ^= 1;
    const show = bgs[HERO.flip], hide = bgs[HERO.flip ^ 1];
    show.style.setProperty('--img', `url('${url}')`); show.classList.add('on'); hide.classList.remove('on');
    const cap = document.getElementById('herocap');
    if (cap) { cap.classList.remove('sw'); void cap.offsetWidth; cap.querySelector('b').textContent = name; cap.classList.add('sw'); }
  };
  img.src = url;
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
const tierLegend = '<span class="tlegend"><span><i class="mk op"><u>OP</u></i>성능 검증 · 라인별 최대 3</span><span><i class="mk bee">' + BEE + '</i>쓰기 좋은 꿀픽 · 최대 5</span></span>';
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
  const li = (s) => `<a class="fm" href="#/players/${s.id}">${champIcon(sigChamp(s), 'face')}<b>${esc(s.name)}</b>${streak(s.cur)}<span class="grow"></span>${dots(s.recent)}</a>`;
  return `<section class="panel formbox"><div class="sec-h"><h2>${ic('scale')}진영 · 요즘 폼</h2><span class="grow"></span><span class="mut sm">최근 5판 기준</span></div>
    <div class="sidebar2"><b class="blue mono">BLUE ${x.blueW}승 <small>${bw}%</small></b><b class="red mono"><small>${x.n ? 100 - bw : 0}%</small> ${x.redW}승 RED</b></div>
    <div class="prob"><i style="width:${x.n ? bw : 50}%"></i></div>
    <div class="fmg"><div><small class="fmh hot">${ic('flame')}상승세</small>${hot.map(li).join('') || '<p class="mut sm">3판 이상 뛴 선수가 없습니다.</p>'}</div>
      <div><small class="fmh cold">${ic('alert')}반등 필요</small>${cold.map(li).join('') || '<p class="mut sm">—</p>'}</div></div></section>`;
}
page('home', {
  render() {
    const st = S.st, x = st.sum, now = new Date();
    const hl = heroList(), hero = hl.length ? hl[HERO.i % hl.length] : '';
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${'일월화수목금토'[now.getDay()]}요일`;
    const patch = S.ver ? S.ver.split('.').slice(0, 2).join('.') : '—';
    const hof = hofList(), top = st.list.filter((s) => s.g >= 3).sort((a, b) => b.ovr - a.ovr).slice(0, 3), nt0 = notices(), nt = nt0.map((_, i) => nt0[(i - (NT.off % nt0.length) + nt0.length) % nt0.length]);
    const last = [...st.matches].slice(-2).reverse();
    HERO.flip = 0;
    return `
    <section class="hero">
      <div class="hero-bg on" style="--img:url('${artUrl(hero)}')"></div><div class="hero-bg alt"></div>
      <div class="hero-in">
        <div class="hero-logo">${logo(true, 92)}<div><div class="word"><span>NAEJEON</span><i>POT</i></div><p>${esc(settings().leagueName || '친구 내전 리그')} · IN-HOUSE LEAGUE</p></div></div>
        <h1 class="hero-h" aria-label="우리들의 협곡, 모든 기록이 여기에.">${typed('우리들의 협곡,')}<br><em>${typed('모든 기록이 여기에.')}</em></h1>
        <div class="hero-meta"><span>${ic('cal')}${date}</span><span class="patch">PATCH ${patch}</span><span>${ic('today')}누적 ${x.n}경기</span></div>
        <div class="hero-cta"><a class="btn pri" href="#/today">${ic('today')}오늘의 내전 시작</a><a class="btn" href="#/rank">${ic('rank')}랭킹 보기</a></div>
      </div>
      ${hero ? `<span class="hero-cap" id="herocap">CHAMPION · <b>${esc(hero)}</b></span>` : ''}
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
          <div class="car-dots">${hof.map((_, i) => `<i class="${i === HM.i ? 'on' : ''}" data-a="carSet" data-i="${i}"></i>`).join('')}</div>
        </section>
        <section class="panel podium"><div class="sec-h"><h2>${ic('rank')}POWER RANKING</h2><a class="mut sm" href="#/rank">전체 보기 →</a></div>
          ${top.map((s, i) => `<a class="pod p${i + 1}" href="#/players/${s.id}" style="--img:url('${artUrl(sigChamp(s))}')"><i class="mono">${i + 1}</i><div><b>${esc(s.name)}</b><small>${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · ${s.wr}% · ${s.g}판</small></div><em class="mono">${s.ovr}</em></a>`).join('') || '<p class="mut">3판 이상 출전한 선수가 생기면 표시됩니다.</p>'}
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
    HM.t = setInterval(() => { if (S.page !== 'home') return clearInterval(HM.t); if (!document.querySelector('#car:hover')) carMove(1); }, 4200);
    HERO.t = setInterval(() => { if (S.page !== 'home') return clearInterval(HERO.t); if (document.visibilityState === 'visible') heroNext(); }, 6500);
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
act('carSet', (d) => carMove(0, +d.i));

// ---------- 랭킹 ----------
const LB = { view: 'all', sort: 'ovr', dir: -1, min: 5 };
const COLS = {
  all: [
    ['g', '판', (s) => s.g, (s) => `<span class="mono">${s.g}</span>`],
    ['wr', '승률', (s) => (s.g ? s.wr : -1), (s) => wrBar(s.w, s.g)],
    ['recent', '최근 5판', (s) => s.recent.filter(Boolean).length, (s) => dots(s.recent)],
    ['cur', '연속', (s) => s.cur, (s) => streak(s.cur)],
    ['ovr', 'OVR', (s) => s.ovr, (s) => `<b class="ovr mono">${s.ovr}</b>`],
    ['mmr', 'MMR', (s) => s.mmr, (s) => `<span class="mono">${Math.round(s.mmr).toLocaleString()}</span> ${s.g ? `<small class="${s.mmrLast >= 0 ? 'good' : 'bad'}">${s.mmrLast >= 0 ? '▲' : '▼'}${Math.abs(Math.round(s.mmrLast))}</small>` : ''}`],
    ['main', '주라인', (s) => LANES.indexOf(s.mainLane), (s) => laneTag(s.mainLane)],
    ['cond', '폼', (s) => s.recent.filter(Boolean).length / (s.recent.length || 1), (s) => `<span class="cond c${'⬆️↗️➡️↘️⬇️➖'.indexOf(s.cond) / 2 | 0}">${{ '⬆️': '최상', '↗️': '좋음', '➡️': '보통', '↘️': '주춤', '⬇️': '부진', '➖': '—' }[s.cond]}</span>`],
  ],
  score: [...LANES.map((l) => [l, `${LANE_ICON[l]}${LANE_NAME[l]}`, (s) => +s.p.scores?.[l] || 0, (s) => `<span class="sc mono" style="--v:${(s.p.scores?.[l] || 0) * 5}%">${s.p.scores?.[l] ?? 0}</span>`]),
    ['avg', '평균', (s) => s.avg, (s) => `<b class="mono">${s.avg.toFixed(1)}</b>`]],
  lane: LANES.map((l) => [l, `${LANE_ICON[l]}${LANE_NAME[l]}`, (s) => (s.lanes[l].g ? s.lanes[l].w / s.lanes[l].g : -1), (s) => `<span class="mono ${wrClass(pct(s.lanes[l].w, s.lanes[l].g))}">${wr(s.lanes[l])}</span>`]),
};
page('rank', {
  render() {
    const st = S.st, x = st.sum;
    const cols = COLS[LB.view], sortCol = cols.find((c) => c[0] === LB.sort) || cols[0];
    const sig = sigChamp;
    const rows = st.list.filter((s) => s.g >= LB.min).sort((a, b) => LB.dir * (sortCol[2](a) - sortCol[2](b)) || b.ovr - a.ovr);
    // 상단 TOP 3 카드: 지금 정렬 기준의 1~3위
    const medal = ['CHAMPION', 'RUNNER-UP', 'THIRD'];
    const spot = rows.slice(0, 3).map((s, i) => `<a class="spot s${i + 1}" href="#/players/${s.id}" style="--img:url('${artUrl(sig(s))}');--d:${i}">
      <span class="sp-rk mono">${i + 1}</span><small>${medal[i]}</small><b>${esc(s.name)}</b>
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
      <tbody>${rows.map((s, i) => `<tr class="${i < 3 ? 'top t' + (i + 1) : ''}" data-a="goPlayer" data-id="${s.id}" style="--d:${Math.min(i, 14)}"><td class="rk mono"><span class="rkb r${i + 1}">${i + 1}</span></td><td class="l nm">${esc(s.name)}</td>${cols.map((c) => num(c[3](s))).join('')}${LB.view === 'all' ? `<td class="l chips">${titleChips(s, 1)}</td>` : ''}<td class="art"><u class="rowfx"></u><i data-art="${artUrl(sig(s))}" title="${esc(sig(s))}"></i></td></tr>`).join('') || `<tr><td colspan="20" class="empty">조건에 맞는 선수가 없습니다.</td></tr>`}</tbody>
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
export function matchCard(m, tools = true) {
  const mi = S.st.MI[m.id];
  const team = (side) => `<div class="team ${side} ${m.winner === side ? 'win' : 'lose'}">
    <div class="th"><b>${side === 'blue' ? 'BLUE' : 'RED'}</b><em>${m.winner === side ? 'VICTORY' : 'DEFEAT'}</em><small class="mono">${mi.bs !== undefined ? (side === 'blue' ? mi.bs : mi.rs) : ''}</small></div>
    ${m[side].map((id, i) => { const k = m.kda?.[id]; return `<div class="pl">${LANE_ICON[LANES[i]]}${champIcon(m.champs?.[side]?.[i], 'sm')}<a href="#/players/${id}">${pname(id)}</a>${k ? `<small class="mono">${k.join('/')}</small>` : ''}</div>`; }).join('')}
    ${(m.bans?.[side] || []).some(Boolean) ? `<div class="bans">BAN ${m.bans[side].filter(Boolean).map((b) => champIcon(b, 'sm')).join('')}</div>` : ''}
  </div>`;
  return `<div class="mcard">
    <div class="mhd"><b class="mono">#${mi.no}</b><span>${fmtDT(m.at)}</span><span class="mut">예상 블루 ${Math.round(mi.pBlue * 100)}%</span>${mi.upset ? '<span class="tag bad">UPSET</span>' : ''}
      ${m.stats ? '<span class="tag gold">REPLAY</span>' : ''}<span class="grow"></span><button class="btn xs" data-a="matchDetail" data-id="${m.id}">상세</button>${tools && !m.stats ? `<button class="btn xs gold" data-a="matchReplay" data-id="${m.id}" title="이 경기의 .rofl 파일을 넣으면 상세 기록이 채워집니다">리플레이</button>` : ''}
      ${tools ? `<button class="btn xs" data-a="editMatch" data-id="${m.id}">수정</button><button class="btn xs ghost" data-a="delMatch" data-id="${m.id}">삭제</button>` : ''}</div>
    <div class="vs">${team('blue')}${team('red')}</div></div>`;
}
page('matches', {
  render() {
    const st = S.st, days = [...st.days].reverse();
    if (!st.matches.length) return `<h1>${ic('matches')}경기 기록</h1><div class="panel empty">아직 기록된 경기가 없습니다.<br><a class="btn pri" href="#/today">첫 경기 기록하기</a></div>`;
    return `<div class="h2row"><h1>${ic('matches')}경기 기록</h1><span class="tag">${st.matches.length}경기</span><span class="grow"></span><button class="btn" data-a="exportCsv">${ic('down')}CSV 내보내기</button></div>
    ${days.map((d) => {
      const ms = st.matches.filter((m) => st.MI[m.id].day === d).reverse(), bw = ms.filter((m) => m.winner === 'blue').length;
      return `<h3 class="day"><span class="mono">${fmtDay(d)}</span><small>${ms.length}경기 · 블루 ${bw}승 / 레드 ${ms.length - bw}승</small></h3><div class="mlist">${ms.map((m) => matchCard(m)).join('')}</div>`;
    }).join('')}`;
  },
});
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
    <div class="row"><span class="mut sm grow">${has ? '리플레이 기록이 적용된 경기입니다.' : '직접 입력한 기록이라 라인업과 KDA만 있습니다. 이 경기의 리플레이(.rofl)를 넣으면 CS·골드·피해량·시야·아이템이 채워집니다.'}</span><button class="btn ${has ? '' : 'gold'}" data-a="matchReplay" data-id="${m.id}">${has ? '리플레이 교체' : '리플레이 넣기'}</button></div>`, 'xwide');
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
const CH = { sort: 'tier', dir: 1, q: '', lane: 'top', si: 0, t: 0 };
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
    const rows = all.filter((c) => !q || c.name.replace(/\s/g, '').includes(q)).sort((a, b) => CH.dir * (val[CH.sort](a) - val[CH.sort](b)) || b.g - a.g || b.w - a.w);
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
    const tl = CH.lane === 'all' ? picked : laneTierList(CH.lane);
    return `<div class="h2row"><h1>${ic('champs')}챔피언 분석</h1><span class="tag">${picked.length}종 · ${totalPicks}픽 · 다양성 ${Math.round((picked.length / totalPicks) * 100)}%</span><span class="grow"></span><input id="chq" class="inp" placeholder="챔피언 검색" value="${esc(CH.q)}" data-i="chQ"></div>
    <div class="chtop">
      <div class="stat gold toprank"><small>MOST PICKED · 선택 순위 TOP ${topN.length}</small><div class="trk">${topN.map((c, i) => `<div class="trk-r r${i + 1}" style="--d:${i}"><i class="mono">${i + 1}</i>${champIcon(c.name, 'sm')}<span>${esc(c.name)}</span><u><s style="width:${(c.g / topMax) * 100}%"></s></u><b class="mono">${c.g}<small>픽</small></b><em class="mono ${wrClass(pct(c.w, c.g))}">${pct(c.w, c.g)}%</em></div>`).join('')}</div></div>
      ${best ? ins('HIGHEST WIN RATE', '최고 승률 (2픽 이상)', best.name, `${best.g}전 ${best.w}승 · ${pct(best.w, best.g)}%`, 'teal') : '<div></div>'}
      ${worst && worst !== best ? ins('LOWEST WIN RATE', '고전 중인 카드', worst.name, `${worst.g}전 ${worst.w}승 · ${pct(worst.w, worst.g)}%`, 'red') : '<div></div>'}
      ${ins('MOST PICKED', '최다 선택', picked[0].name, `${picked[0].g}픽 · 승률 ${pct(picked[0].w, picked[0].g)}%`, 'gold')}
      ${ins('MOST BANNED', '최다 밴', banned?.ban ? banned.name : '', banned?.ban ? `${banned.ban}회 밴` : '밴 기록 없음', 'red')}
      ${stat('users', '최다 챔피언 폭', wide?.champKinds ? esc(wide.name) : '-', wide?.champKinds ? `${wide.champKinds}종 사용` : '', 'blue')}
      <div class="sigrot" id="sigrot">${sigs.map((x, i) => ins('SIGNATURE PICK', `${esc(x.s.name)}의 시그니처`, x.n, `${x.g}판 · 승률 ${pct(x.w, x.g)}%`, 'blue', i === CH.si ? 'on' : '')).join('') || ins('SIGNATURE PICK', '시그니처', '', '기록 없음', 'blue', 'on')}${sigs.length > 1 ? `<div class="sigdots">${sigs.slice(0, 12).map((_, i) => `<i class="${i === CH.si ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>
    </div>
    <div class="sec-h"><h2>티어 리스트</h2><span class="mut sm">보정 승률(표본 반영) + 선택 빈도 기준 · 내전 데이터 한정</span><span class="grow"></span>${tierLegend}<span class="asof mono">기준 ${today()}</span></div>
    ${laneSeg(CH.lane, 'chLane', true)}
    <div class="tiers">${tierRows(tl, { all: true, pctOn: true })}</div>
    <div class="sec-h"><h2>전체 통계</h2></div>
    <div class="tw"><table class="tbl"><thead><tr>${th('tier', '티어')}<th class="l">챔피언</th>${th('g', '픽')}${th('w', '승')}${th('wr', '승률')}${th('ban', '밴')}<th class="l">주 사용자</th></tr></thead>
    <tbody>${rows.map((c) => {
      const u = Object.entries(c.users).sort((a, b) => b[1] - a[1]);
      return `<tr><td>${c.tier ? `<span class="tbadge t${c.tier}">${c.tier}</span>` : '<span class="mut">-</span>'}</td><td class="l nm">${champIcon(c.name, 'sm')} ${esc(c.name)}</td>${num(`<span class="mono">${c.g}</span>`)}${num(`<span class="mono">${c.w}</span>`)}${num(wrBar(c.w, c.g))}${num(`<span class="mono">${c.ban || '-'}</span>`)}<td class="l users">${u.slice(0, 5).map(([id, n]) => `<span>${pname(id)}<small class="mono">${n}</small></span>`).join('')}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">검색 결과가 없습니다.</td></tr>'}</tbody></table></div>`;
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
act('chQ', (d, el) => { CH.q = el.value; refresh(); });

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
      <tbody>${t.roster.map((id) => `<tr><td class="l nm">${pname(id)}</td>${sr.ms.map((m) => cell(id, m)).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}</div>
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
function onStore(c) {
  if (c === 'chat') return renderChat();
  if (c === 'presence') return renderPresence();
  if (c === 'auctions') { if (S.page === 'auction') refresh(); return; }
  if (c === 'meta') {
    const ch = metaDiff();
    if (ch.dice) watchDice();
    if (ch.settings || ch.kicks) onMeta();
    if (ch.settings) refresh(true); else if (ch.todayDraft && S.page === 'today') refresh();
    return;
  }
  if (c === 'players' || c === 'matches') refresh(true);
}
(async () => {
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
    S.store = await createStore(S.key, (c, err) => {
      if (c === 'error') return toast('DB 연결 오류: ' + (err?.code || err));
      if (!up) return;
      onStore(c);
    });
    await S.store.ready;
  } catch (e) { main.innerHTML = `<div class="panel landing"><h1>연결 실패</h1><p>${esc(e.message || e)}</p><p class="hint">js/config.js 의 Firebase 설정과 Firestore 규칙을 확인하세요.</p></div>`; return; }
  metaDiff(); up = true; watchDice(true); watchReveal(true); initShell(); initSocial(); loadChamps();
})();
