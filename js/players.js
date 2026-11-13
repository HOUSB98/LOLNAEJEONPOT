// 선수 카드(홀로 카드) / 솔랭 분석 / 케미 분석
import { S, page, act, esc, pname, go, refresh, fmtDT, wrClass, wrBar, dots, streak, titleChips, champIcon, splashUrl, tileUrl, artUrl, sigChamp, skinList, skinBad, baseChamp, needAdmin, isAdmin, modal, closeModal, mh, toast, ic, logo, countUp, burst, LANES, LANE_NAME, LANE_ICON, LANE_COLOR, pct } from './core.js';
import { chem, playerLine, duoRank, CHEM_RULE } from './stats.js';

const PV = { view: 'card', dl: 'all' };
const LANE_EN = { top: 'TOP LANE', jg: 'JUNGLE', mid: 'MID LANE', adc: 'BOT CARRY', sup: 'SUPPORT' };
const opgg = (rid) => (rid && rid.includes('#') ? `https://op.gg/ko/lol/summoners/kr/${encodeURIComponent(rid.replace('#', '-'))}` : '');
const rarity = (s, n) => { const r = s.ovrRank / n; return r <= 0.12 ? ['★★★', 'LEGEND', 'legend'] : r <= 0.4 ? ['★★', 'RARE', 'rare'] : ['★', 'COMMON', 'common']; };
const MOVE = { top: '탑 솔로킬', jg: '정글 장악', mid: '미드 로밍', adc: '원딜 캐리', sup: '서폿 이니시' };

function listView() {
  const st = S.st, n = st.list.length;
  const seg = `<div class="seg">${[['card', '카드'], ['solo', '솔랭 분석']].map(([k, t]) => `<button class="${PV.view === k ? 'on' : ''}" data-a="pvView" data-v="${k}">${t}</button>`).join('')}</div>`;
  if (!n) return `<h1>${ic('players')}선수 카드</h1><div class="panel empty">등록된 선수가 없습니다.<br><a class="btn pri" href="#/admin">관리에서 선수 추가 / 시트 데이터 가져오기</a></div>`;
  if (PV.view === 'solo') {
    return `<div class="h2row"><h1>${ic('target')}솔랭 분석</h1><span class="grow"></span>${seg}</div>
    <p class="hint">솔랭 티어는 내전 MMR 초기값으로 쓰입니다. 내용은 관리 &gt; 선수 상세 수정에서 고칠 수 있습니다.</p>
    <div class="solo">${st.list.map((s) => { const p = s.p, o = p.solo || {}; return `<div class="panel"><div class="ph"><a href="#/players/${s.id}"><b>${esc(s.name)}</b></a><span class="tag gold">${esc(p.soloTier || '티어 정보 없음')}</span>${o.pos ? `<span class="tag">${esc(o.pos)}</span>` : ''}<span class="grow"></span>${opgg(p.riotId) ? `<a class="btn xs" href="${opgg(p.riotId)}" target="_blank" rel="noopener">op.gg</a>` : ''}</div>
      ${p.riotId ? `<div class="mut sm">${esc(p.riotId)} · 전적 ${esc(o.record || '-')} · 최고 ${esc(o.peak || '-')}</div>` : ''}
      ${o.most ? `<div class="sm">모스트 3 · ${esc(o.most)}</div>` : ''}${o.comment ? `<p>${esc(o.comment)}</p>` : '<p class="mut">솔랭 분석 정보가 없습니다.</p>'}</div>`; }).join('')}</div>`;
  }
  // 주라인별로 묶고, 묶음 안에서는 오버롤 높은 순
  const card = (s, i) => { const r = rarity(s, n); return `<a class="pcard ${r[2]}" href="#/players/${s.id}" style="--tc:${LANE_COLOR[s.mainLane]};--img:url('${tileUrl(sigChamp(s))}');--d:${Math.min(i, 16)}">
    <div class="pc-art"></div><i class="pc-no mono">${i + 1}</i>
    <div class="pc-top"><span class="pc-type">${LANE_ICON[s.mainLane]}</span><b>${esc(s.name)}</b><span class="pc-ovr mono"><small>OVR</small>${s.ovr}</span></div>
    <div class="pc-bot"><span class="mono">${s.g ? `${s.wr}% · ${s.g}판` : '출전 없음'}</span><span class="pc-rar">${r[0]}</span></div>
    <div class="pc-title">${s.titles[0] ? `${s.titles[0].e} ${s.titles[0].n}` : '&nbsp;'}</div></a>`; };
  let k = 0;
  return `<div class="h2row"><h1>${ic('players')}선수 카드</h1><span class="tag">${n}명</span><span class="mut sm">주라인별 · 오버롤 순</span><span class="grow"></span>${seg}</div>
  ${LANES.map((l) => { const g = st.byOvr.filter((s) => s.mainLane === l); if (!g.length) return ''; const base = k; k += g.length;
    return `<section class="lgroup" style="--tc:${LANE_COLOR[l]}"><header><span class="lg-ic">${LANE_ICON[l]}</span><div class="lg-t"><small>${LANE_EN[l]}</small><h2>${LANE_NAME[l]}</h2></div><i class="lg-line"></i><span class="lg-best"><small>BEST</small><b>${esc(g[0].name)}</b><em class="mono">${g[0].ovr}</em></span><span class="lg-n mono">${g.length}<small>명</small></span></header>
      <div class="pgrid">${g.map((s, i) => card(s, i).replace(/--d:\d+/, `--d:${Math.min(base + i, 16)}`)).join('')}</div></section>`; }).join('')}`;
}

function holo(s, n) {
  const p = s.p, r = rarity(s, n), sc = LANES.map((l) => [l, +p.scores?.[l] || 0]).sort((a, b) => b[1] - a[1]);
  const weak = sc[4][0], sig = sigChamp(s), line = playerLine(s, S.st).split('. ')[0].replace(/\.$/, '') + '.';
  const move = ([l, v]) => `<div class="hc-move"><span class="en">${LANE_ICON[l].repeat(v >= 15 ? 3 : v >= 9 ? 2 : 1)}</span><div><b>${MOVE[l]}</b><small>${LANE_NAME[l]} 승률 ${s.lanes[l].g ? `${pct(s.lanes[l].w, s.lanes[l].g)}% (${s.lanes[l].g}판)` : '기록 없음'}</small></div><em class="mono">${Math.round(v * 10)}</em></div>`;
  return `<div class="holo-wrap ${r[2]}" style="--tc:${LANE_COLOR[s.mainLane]}">
    <div class="holo-tilt"><div class="holo ${r[2]}">
    <div class="hc-in">
      <div class="hc-head"><span class="hc-stage">${r[1]}</span><b>${esc(s.name)}</b><span class="hc-hp mono"><small>OVR</small>${s.ovr}</span><span class="hc-type">${LANE_ICON[s.mainLane]}</span></div>
      <div class="hc-art" style="--img:url('${artUrl(sig)}')">${sig ? `<span>SIGNATURE · ${esc(sig)}</span>` : `<i>${LANE_ICON[s.mainLane]}</i>`}</div>
      <div class="hc-strip">No.${String(s.ovrRank).padStart(3, '0')} · ${LANE_NAME[s.mainLane]} 타입 · ${s.g ? `${s.g}전 ${s.w}승 ${s.g - s.w}패` : '미데뷔'} · MMR ${Math.round(s.mmr)}</div>
      ${move(sc[0])}${move(sc[1])}
      <div class="hc-foot"><div><small>약점</small>${LANE_ICON[weak]}<b class="mono">${sc[4][1]}</b></div><div><small>폼</small><b>${{ '⬆️': '최상', '↗️': '좋음', '➡️': '보통', '↘️': '주춤', '⬇️': '부진', '➖': '—' }[s.cond]}</b></div><div><small>통산 승률</small><b class="mono">${s.g ? s.wr + '%' : '—'}</b></div></div>
      <p class="hc-flavor">${esc(line)}</p>
      <div class="hc-bottom"><span>${r[0]}</span><span>NAEJEONPOT · ${new Date().getFullYear()}</span><span class="mono">${String(s.ovrRank).padStart(3, '0')}/${String(n).padStart(3, '0')}</span></div>
    </div><div class="hc-shine"></div><div class="hc-glare"></div><div class="hc-sweep"></div>
  </div><div class="holo-back ${r[2]}">${logo(false, 120)}<b>NAEJEON<i>POT</i></b></div></div>
  <div class="gdeck" aria-hidden="true"><i class="gd-halo"></i><i class="gd-beam"></i><i class="gd-core"></i>${Array.from({ length: 14 }, (_, i) => `<u style="--i:${i}"></u>`).join('')}
    <div class="gd-con"><span class="jc l"><i class="stick"></i><i class="dpad"></i></span><span class="scr"><i class="scr-card"></i><i class="scr-scan"></i></span><span class="jc r"><i class="btns"></i><i class="stick"></i></span></div>
    <i class="gd-ring r1"></i><i class="gd-ring r2"></i><i class="gd-shadow"></i></div>
  <small class="mut">카드 위에서 마우스를 움직여 보세요 · <button class="lnk" data-a="pcReplay">다시 소환</button>${sig ? ` · <button class="lnk" data-a="skinPick" data-id="${s.id}" title="관리자 PIN 필요">스킨 변경</button>` : ''}</small></div>`;
}

// 리플레이로 쌓인 상세 지표. 여러 라인을 도는 선수가 불리하지 않도록 "맞라인 대비"와 "라인 평균=100 지수"를 함께 보여 준다
function detailPanel(s) {
  if (!s.dx) return `<div class="panel"><div class="ph"><b>리플레이 상세 지표</b><span class="tag">리플레이 0판</span></div><p class="mut sm">경기 기록에서 리플레이를 넣은 경기가 생기면 분당 CS·피해량·시야와 라인 보정 지수가 라인별로 표시됩니다.</p></div>`;
  const tabs = LANES.filter((l) => s.dxl[l]), cur = PV.dl !== 'all' && s.dxl[PV.dl] ? PV.dl : 'all', x = cur === 'all' ? s.dx : s.dxl[cur];
  const n = (v, d = 0) => (+v || 0).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const sign = (v, d = 0) => (v === null ? '—' : `<span class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : '−'}${n(Math.abs(v), d)}</span>`);
  const cell = (label, val, sub, hot) => `<div class="dcell ${hot ? 'hot' : ''}"><small>${label}</small><b class="mono">${val}</b><span>${sub || ''}</span></div>`;
  const gauge = (label, v) => `<div class="ixrow"><span>${label}</span><div class="ixbar"><i class="${v >= 100 ? 'up' : 'dn'}" style="${v >= 100 ? `left:50%;width:${Math.min(50, (v - 100) / 2)}%` : `right:50%;width:${Math.min(50, (100 - v) / 2)}%`}"></i><u></u></div><b class="mono ${v >= 105 ? 'good' : v <= 95 ? 'bad' : ''}">${v}</b></div>`;
  const e = x.x, per = (k, d = 0) => n(e[k] / x.xg, d), dsum = e ? e.pd + e.md + e.td : 0, share = (v) => (dsum ? Math.round((v / dsum) * 100) : 0);
  const ext = e ? `<div class="ph"><b>세부 지표</b><small class="mut">판당 평균 · 리플레이 ${x.xg}판 기준</small></div>
    ${dsum ? `<div class="dmix"><span>피해 구성</span><div class="dmixbar"><i class="pd" style="width:${share(e.pd)}%"></i><i class="md" style="width:${share(e.md)}%"></i><i class="td" style="width:${share(e.td)}%"></i></div><small><b class="pd">물리 ${share(e.pd)}%</b><b class="md">마법 ${share(e.md)}%</b><b class="td">고정 ${share(e.td)}%</b></small></div>` : ''}
    <div class="dgrid six">
      ${cell('오브젝트 피해', per('obj'), `분당 ${n(e.obj / Math.max(1, x.xmin))}`)}${cell('포탑 피해', per('tur'), `포탑 파괴 ${per('tw', 1)}개`)}
      ${cell('치유량', per('heal'), `아군 치유 ${per('healT')}`)}${cell('아군 보호막', per('shT'), '보호막으로 막아 준 피해')}
      ${cell('피해 경감', per('mit'), `받은 피해 ${n(x.taken)}`)}${cell('CC 시간', per('cc', 1) + '초', '상대를 묶어 둔 시간')}
      ${cell('와드 제거', per('wk', 1), `설치 ${n(x.wards, 1)}개`)}${cell('제어 와드', per('cw', 1), '구매 수')}
      ${cell('정글 CS 비중', (e.mk + e.jk ? Math.round((e.jk / (e.mk + e.jk)) * 100) : 0) + '%', `미니언 ${per('mk')} · 정글 ${per('jk')}`)}${cell('사망 시간', per('dead') + '초', '회색 화면으로 보낸 시간')}
      ${cell('멀티킬', `${e.dk}<small> 더블</small>`, `트리플 ${e.tk} · 쿼드라 ${e.qk} · 펜타 ${e.pk}`, e.pk > 0)}${cell('최대 치명타', n(e.critMax), `최대 연속 킬 평균 ${per('spree', 1)}`)}
    </div>` : '';
  return `<div class="panel dxp"><div class="ph"><b>리플레이 상세 지표</b><span class="tag gold">리플레이 ${x.g}판</span><span class="tag">${x.w}승 ${x.g - x.w}패</span><span class="grow"></span><span class="tag ${x.score >= 105 ? 'ok' : x.score <= 95 ? 'bad' : ''}">라인 보정 종합 ${x.score}</span></div>
    <div class="seg full lseg dxseg"><button class="${cur === 'all' ? 'on' : ''}" data-a="pvLane" data-l="all"><span>전체</span><small class="mono">${s.dx.g}</small></button>${tabs.map((l) => `<button class="${cur === l ? 'on' : ''}" data-a="pvLane" data-l="${l}">${LANE_ICON[l]}<span>${LANE_NAME[l]}</span><small class="mono">${s.dxl[l].g}</small></button>`).join('')}</div>
    <div class="dgrid">
      ${cell('분당 CS', n(x.cspm, 1), `맞라인 대비 ${sign(x.csd, 1)}`)}
      ${cell('분당 골드', n(x.gpm), `맞라인 대비 ${sign(x.gd)}`)}
      ${cell('분당 피해량', n(x.dpm), `팀 내 비중 ${n(x.share * 100)}%`, x.share >= 0.28)}
      ${cell('분당 시야', n(x.vpm, 2), `와드 설치 ${n(x.wards, 1)}개`)}
      ${cell('평균 KDA', x.kda ? `${n(x.kda[0], 1)}/${n(x.kda[1], 1)}/${n(x.kda[2], 1)}` : '—', x.kda ? `평점 ${n((x.kda[0] + x.kda[2]) / Math.max(1, x.kda[1]), 2)}` : '')}
      ${cell('킬 관여율', x.kp === null ? '—' : Math.round(x.kp * 100) + '%', '팀 킬 중 킬+어시')}
      ${cell('받은 피해', n(x.taken), '판당 평균')}
      ${cell('최대 멀티킬', x.multi || '—', ['', '', '더블킬', '트리플킬', '쿼드라킬', '펜타킬'][x.multi] || '', x.multi >= 4)}
    </div>
    <div class="ph"><b>라인 보정 지수</b><small class="mut">${cur === 'all' ? '그 경기에서 맡은 라인의' : LANE_NAME[cur] + ' 라인'} 리그 평균을 100으로 환산 · 100보다 크면 평균 이상</small></div>
    ${gauge('골드', x.idx.gold)}${gauge('피해량', x.idx.dmg)}${gauge('시야', x.idx.vis)}${gauge('CS', x.idx.cs)}
    ${ext}
    <p class="hint">${x.xg < x.g ? `세부 지표(피해 구성·치유·CC 등)는 새 형식으로 넣은 리플레이 ${x.xg}판만 집계됩니다. 예전에 넣은 경기는 경기 상세의 "리플레이 교체"로 다시 넣으면 채워집니다. ` : ''}라인을 고르면 그 라인으로 뛴 판만 따로 봅니다. 표본이 적을 때는 참고용으로만 보세요.</p></div>`;
}

function cardView(id) {
  const st = S.st, s = st.P[id];
  if (!s) return `<div class="panel empty">선수를 찾을 수 없습니다. <a href="#/players">목록으로</a></div>`;
  const n = st.list.length, p = s.p, o = p.solo || {}, c = chem(st, id, 3);
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const who = (x, f) => (x ? `${pname(x.id)} · ${f(x)}` : '<span class="mut">아직 차이 없음</span>');
  const duoF = (x) => `${x.wr}% (${x.g}판)`, vsF = (x) => `${x.w}승 ${x.g - x.w}패`;
  const lv = st.laneVs[id] || {};
  const laneOpp = (l) => { const e = Object.entries(lv).filter(([k]) => k.startsWith(l + '|')).sort((a, b) => b[1].g - a[1].g)[0]; return e ? `vs ${pname(e[0].split('|')[1])} ${e[1].w}승 ${e[1].g - e[1].w}패` : '—'; };
  const champs = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g);
  const games = st.matches.filter((m) => m.blue.includes(id) || m.red.includes(id)).slice(-8).reverse();
  const kda = s.kdaG ? `${(s.kda[0] / s.kdaG).toFixed(1)} / ${(s.kda[1] / s.kdaG).toFixed(1)} / ${(s.kda[2] / s.kdaG).toFixed(1)} <small>(${s.kdaG}판)</small>` : '<span class="mut">기록 없음</span>';
  return `<div class="h2row"><a class="btn xs" href="#/players">← 목록</a><span class="grow"></span>
    <select class="inp" data-c="pcSel">${st.list.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
  <div class="pdetail">${holo(s, n)}
   <div class="pd-info">
    <div class="kstats">
      <div class="ks ovr"><small>OVERALL</small><b class="mono" data-count="${s.ovr}">${s.ovr}</b><span>리그 <em>${s.ovrRank}위</em> / ${n}명</span></div>
      <div class="ks wr ${s.g ? (s.wr >= 55 ? 'up' : s.wr <= 45 ? 'dn' : '') : ''}"><small>WIN RATE</small><b class="mono" ${s.g ? `data-count="${s.wr}" data-suf="%"` : ''}>${s.g ? s.wr + '%' : '—'}</b><span>${s.g}판 ${s.w}승 ${s.g - s.w}패</span><i class="ksbar"><u style="width:${s.g ? s.wr : 0}%"></u></i></div>
      <div class="ks mmr"><small>IN-HOUSE MMR</small><b class="mono" data-count="${Math.round(s.mmr)}">${Math.round(s.mmr).toLocaleString()}</b><span>${s.g ? `<em class="${s.mmrLast >= 0 ? 'good' : 'bad'}">${s.mmrLast >= 0 ? '▲' : '▼'}${Math.abs(Math.round(s.mmrLast))}</em> 최근 경기 · ` : ''}시작 ${s.mmrInit}</span></div>
      <div class="ks form"><small>RECENT FORM</small><b>${dots(s.recent)}</b><span>${streak(s.cur) || (s.g ? '연속 기록 없음' : '출전 기록 없음')}</span></div>
    </div>
    <div class="chips big">${titleChips(s) || '<span class="mut sm">아직 칭호 없음</span>'}</div>
    <div class="panel"><div class="ph"><b>라인 파워</b><small class="mut">점수(20점 만점) · 세로선은 리그 평균 · 오른쪽은 라인 승률</small></div>
      ${LANES.map((l) => { const v = +p.scores?.[l] || 0, a = st.laneAvg[l], rk = st.laneRank[id][l]; return `<div class="pw">${LANE_ICON[l]}<span>${LANE_NAME[l]}</span><div class="bar"><i style="width:${v * 5}%;background:${LANE_COLOR[l]}"></i><u style="left:${a * 5}%"></u></div><b class="mono">${v}</b><small class="mono">${rk}위</small><small class="mono ${wrClass(pct(s.lanes[l].w, s.lanes[l].g))}">${s.lanes[l].g ? `${pct(s.lanes[l].w, s.lanes[l].g)}% (${s.lanes[l].g})` : '—'}</small></div>`; }).join('')}</div>
    <div class="grid2">
      <div class="panel"><div class="ph"><b>기록</b></div>
        ${row('전적', `${s.g}판 ${s.w}승 ${s.g - s.w}패`)}${row('최근 5판', dots(s.recent))}${row('연속 기록', streak(s.cur) || '—')}
        ${row('희생 지수', s.g ? `${s.off.g}/${s.g}판 주라인 밖 · ${pct(s.off.g, s.g)}%` : '—')}
        ${row('진영 전적', `<span class="blue">${s.side.blue.w}승 ${s.side.blue.g - s.side.blue.w}패</span> · <span class="red">${s.side.red.w}승 ${s.side.red.g - s.side.red.w}패</span>`)}
        ${row('내전 MMR', `<span class="mono">${Math.round(s.mmr).toLocaleString()}</span> <small class="${s.mmrLast >= 0 ? 'good' : 'bad'}">${s.g ? (s.mmrLast >= 0 ? '▲' : '▼') + Math.abs(Math.round(s.mmrLast)) : ''}</small> <small>시작 ${s.mmrInit} · 신뢰도 ${s.rel[1]}</small>`)}
        ${row('평균 KDA', kda)}${row('마지막 출전', s.lastAt ? `${fmtDT(s.lastAt)} (${Math.floor((Date.now() - s.lastAt) / 864e5)}일 전)` : '—')}</div>
      <div class="panel"><div class="ph"><b>케미</b><a class="btn xs" href="#/chem/${id}">자세히</a></div>
        ${row('베스트 듀오', who(c.best, duoF))}${row('상극 듀오', who(c.worst, duoF))}${row('천적 (내가 약한 상대)', who(c.nemesis, vsF))}${row('내가 강한 상대', who(c.prey, vsF))}
        <div class="ph"><b>맞라인 전적</b></div>${LANES.map((l) => row(`${LANE_ICON[l]} ${LANE_NAME[l]}`, laneOpp(l))).join('')}</div>
    </div>
    ${detailPanel(s)}
    <div class="panel"><div class="ph"><b>솔랭 분석</b><span class="tag gold">${esc(p.soloTier || '정보 없음')}</span><span class="grow"></span>${opgg(p.riotId) ? `<a class="btn xs" href="${opgg(p.riotId)}" target="_blank" rel="noopener">op.gg</a>` : ''}</div>
      <div class="grid2 tight"><div>${row('전적', esc(o.record || '—'))}${row('최고 티어', esc(o.peak || '—'))}</div><div>${row('주 포지션', esc(o.pos || '—'))}${row('모스트 3', esc(o.most || '—'))}</div></div>
      ${o.comment ? `<p class="quote">${esc(o.comment)}</p>` : ''}</div>
    <div class="panel"><div class="ph"><b>내전 챔피언</b><small class="mut">${s.champG}판 ${s.champKinds}종</small></div>
      <div class="chlist">${champs.map(([nm, v]) => `<div>${champIcon(nm)}<span>${esc(nm)}</span><small class="mono ${wrClass(pct(v.w, v.g))}">${v.g}판 ${pct(v.w, v.g)}%</small></div>`).join('') || '<span class="mut">챔피언 기록이 없습니다.</span>'}</div></div>
    <div class="panel"><div class="ph"><b>최근 경기</b></div>
      ${games.map((m) => { const side = m.blue.includes(id) ? 'blue' : 'red', i = m[side].indexOf(id), win = m.winner === side; return `<div class="gm ${win ? 'w' : 'l'}"><b>${win ? 'WIN' : 'LOSE'}</b><span class="mono">#${st.MI[m.id].no} · ${fmtDT(m.at)}</span><span class="${side}">${side === 'blue' ? 'BLUE' : 'RED'}</span><span>${LANE_ICON[LANES[i]]} ${LANE_NAME[LANES[i]]}</span>${champIcon(m.champs?.[side]?.[i], 'sm')}<span class="mut">${esc(m.champs?.[side]?.[i] || '')}</span>${m.kda?.[id] ? `<small class="mono">${m.kda[id].join('/')}</small>` : ''}</div>`; }).join('') || '<span class="mut">출전 기록이 없습니다.</span>'}</div>
   </div></div>`;
}
page('players', {
  render: (id) => (id ? cardView(id) : listView()),
  after(entering) { // 홀로 카드: 등장할 때 빙글 돌며 정면으로 멈추고, 그 뒤에는 마우스 위치에 따라 기울기와 빛 반사를 바꾼다
    const w = document.querySelector('.holo-wrap'), h = w?.querySelector('.holo-tilt'); if (!h) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (entering) countUp(document.querySelector('.kstats') || document.createElement('i'));
    // 등장: 바닥에 누운 게임기 화면에서 작은 카드가 빛기둥을 타고 솟아올라, 회전하면서 커져 정면으로 멈춘다.
    // 앞·뒷면 전환은 각도를 보고 직접 바꾼다(브라우저의 3D 뒷면 처리에 기대지 않아 카드가 사라지는 일이 없다)
    const summon = () => {
      const T = 3000, A0 = -1260, t0 = performance.now(), deck = w.querySelector('.gdeck');
      const D = h.offsetHeight / 2 + (deck ? deck.offsetHeight * 0.52 : 90); // 카드 중심 → 게임기 화면까지 거리
      w.classList.add('intro'); w.classList.remove('lit'); h.classList.remove('live');
      const settle = () => {
        if (!w.classList.contains('intro')) return;
        h.style.transform = ''; h.style.opacity = ''; h.style.filter = ''; h.classList.remove('flip'); w.classList.remove('intro'); w.classList.add('lit');
        if (document.visibilityState === 'visible' && document.body.contains(h)) { const r = h.getBoundingClientRect(); burst(r.left + r.width / 2, r.bottom - 30, 70); }
      };
      (function spin(now) {
        if (!document.body.contains(h)) return;
        const u = Math.min(1, (now - t0) / T), e = 1 - (1 - u) ** 4, rise = 1 - (1 - Math.min(1, u / 0.62)) ** 3, grow = u < 0.12 ? 0 : ((u - 0.12) / 0.88) ** 1.6;
        const a = A0 * (1 - e), n = ((a % 360) + 360) % 360, sc = 0.07 + 0.93 * (1 - (1 - grow) ** 2.2);
        h.classList.toggle('flip', n > 90 && n < 270);
        h.style.transform = `translateY(${((1 - rise) * D).toFixed(1)}px) rotateY(${a.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        h.style.opacity = Math.min(1, u * 9);
        h.style.filter = u < 0.5 ? `brightness(${(2.6 - u * 3.2).toFixed(2)})` : '';
        if (u < 1) return requestAnimationFrame(spin);
        settle();
      })(t0);
      // 탭이 뒤에 있어 화면 갱신이 멈춘 경우에도 카드가 안 보이는 채로 남지 않게, 시간이 지나면 정면 상태로 확정한다
      setTimeout(settle, T + 400);
    };
    w.summon = summon;
    if (entering && !reduce) summon(); else w.classList.add('lit');
    if (matchMedia('(hover: none)').matches || reduce) return;
    // 기준 좌표는 기울지 않는 바깥 틀(w)에서 잡고, 화면 주사율에 맞춰 한 번씩만 갱신한다(떨림 방지)
    let raf = 0, px = 0, py = 0;
    const paint = () => {
      raf = 0;
      const r = w.getBoundingClientRect(), x = Math.min(1, Math.max(0, (px - r.left) / r.width)), y = Math.min(1, Math.max(0, (py - r.top) / h.offsetHeight));
      h.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); h.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      h.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg'); h.style.setProperty('--ry', ((x - 0.5) * 12).toFixed(2) + 'deg');
    };
    h.onpointermove = (e) => { if (w.classList.contains('intro')) return; px = e.clientX; py = e.clientY; h.classList.add('live'); if (!raf) raf = requestAnimationFrame(paint); };
    h.onpointerleave = () => { cancelAnimationFrame(raf); raf = 0; h.classList.remove('live'); h.style.setProperty('--rx', '0deg'); h.style.setProperty('--ry', '0deg'); };
  },
});
act('pvView', (d) => { PV.view = d.v; refresh(); });
// 선수 카드 스킨 고르기: 대표 챔피언의 스킨 목록에서 하나를 골라 선수 문서에 저장한다(모든 사람 화면에 반영)
// 관리자 PIN을 확인한 뒤에만 열린다
act('skinPick', (d) => needAdmin(() => {
  const s = S.st.P[d.id]; if (!s) return;
  const cur = sigChamp(s), base = baseChamp(cur), list = skinList(base), c = S.champBy[base];
  if (!c) return;
  if (!list) return toast('스킨 목록을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요');
  const url = (n) => `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${c.id === 'Fiddlesticks' ? 'FiddleSticks' : c.id}_${n}.jpg`;
  const curNum = S.champBy[cur]?.skin || 0;
  modal(`${mh(`${esc(s.name)} · ${esc(base)} 스킨 선택`)}
    <p class="mut sm">선수 카드·랭킹·케미 등 이 선수의 대표 일러스트가 고른 스킨으로 바뀝니다. 대표 챔피언이 바뀌면 그 챔피언의 스킨이 자동으로 정해집니다.</p>
    <div class="skgrid">${[[0, '기본'], ...list].map(([n, nm]) => `<button class="skp ${n === curNum ? 'on' : ''}" data-a="skinSet" data-id="${s.id}" data-n="${n}" data-c="${esc(base)}" data-nm="${esc(nm)}"><img src="${url(n)}" alt=""><span>${esc(nm)}</span></button>`).join('')}</div>`, 'tall').querySelectorAll('.skp img').forEach((im) => {
    // 일러스트가 없는(아직 쓸 수 없는) 스킨은 선택지에서 빼고, 다음부터도 나오지 않게 기록한다
    const b = im.closest('.skp'), drop = () => { b.remove(); skinBad(base, +b.dataset.n); };
    if (+b.dataset.n) { im.onerror = drop; if (im.complete && !im.naturalWidth) drop(); }
  });
}));
act('skinSet', async (d) => {
  if (!isAdmin()) return toast('관리자만 스킨을 바꿀 수 있습니다');
  try { await S.store.patch('players', d.id, { skin: { champ: d.c, num: +d.n, name: +d.n ? d.nm : '' } }); closeModal(); toast('스킨을 바꿨습니다'); }
  catch (e) { toast('저장 실패: ' + (e.code || e.message)); }
});
act('pvLane', (d) => { PV.dl = d.l; refresh(); });
act('pcReplay', () => { const w = document.querySelector('.holo-wrap'); if (w?.summon && !w.classList.contains('intro')) w.summon(); });
act('pcSel', (d, el) => go('#/players/' + el.value));

// ---------- 케미 분석 ----------
const CM = { min: 5, mode: 'duo', pa: 0, pb: 0, t: 0 };
const PER = 5; // 듀오 순위 한 장에 5팀, 최대 3장(15팀)이 자동으로 넘어간다
page('chem', {
  render(id) {
    const st = S.st, on = st.list.filter((s) => s.g).sort((a, b) => b.g - a.g);
    if (!on.length) return `<h1>${ic('chem')}케미 분석</h1><div class="panel empty">경기 기록이 쌓이면 듀오 시너지와 천적 관계가 표시됩니다.</div>`;
    const cur = st.P[id]?.g ? id : on[0].id, c = chem(st, cur, CM.min);
    const { top: topDuo, low: lowDuo } = duoRank(st, CM.min, PER * 3);
    const face = (pid) => { const ch = sigChamp(st.P[pid]); return ch ? champIcon(ch, 'face') : `<span class="ci face txt">${pname(pid).slice(0, 1)}</span>`; };
    const lvl = (w) => (w >= 60 ? 'hi' : w >= 45 ? 'mid' : 'lo');
    const row = (tone) => (x, i) => `<div class="duo ${tone}" style="--img:url('${artUrl(sigChamp(st.P[x.ids[i % 2]]))}');--d:${i % PER}">
      <i class="drk mono">${i + 1}</i><span class="faces">${face(x.ids[0])}${face(x.ids[1])}</span>
      <span class="dnm"><b>${pname(x.ids[0])}</b><em>&amp;</em><b>${pname(x.ids[1])}</b><small class="mono">${x.g}판 · ${x.w}승 ${x.g - x.w}패</small></span>
      <span class="dwr"><b class="mono ${tone}">${x.wr}<small>%</small></b><span class="wrb"><i style="width:${x.wr}%" class="${lvl(x.wr)}"></i></span></span></div>`;
    const rank = (arr, tone, key) => {
      if (!arr.length) return `<p class="mut">${CM.min}판 이상 함께한 조합 중 해당하는 듀오가 없습니다.</p>`;
      const pages = Math.ceil(arr.length / PER); CM[key] %= pages;
      return `<div class="dpages" data-k="${key}" style="--rows:${Math.min(PER, arr.length)}">${Array.from({ length: pages }, (_, pi) => `<div class="dpage ${pi === CM[key] ? 'on' : ''}">${arr.slice(pi * PER, pi * PER + PER).map((x, j) => row(tone)(x, pi * PER + j)).join('')}</div>`).join('')}</div>
        ${pages > 1 ? `<div class="dnav"><span class="dprog"><i></i></span>${Array.from({ length: pages }, (_, pi) => `<button class="${pi === CM[key] ? 'on' : ''}" data-a="cmPage" data-k="${key}" data-i="${pi}">${pi * PER + 1}–${Math.min(arr.length, pi * PER + PER)}</button>`).join('')}</div>` : ''}`;
    };
    const hi = (cap, t, x, f, tone) => `<div class="ins ${tone}" style="--img:url('${x ? tileUrl(sigChamp(st.P[x.id])) : ''}')"><small>${cap}</small><span>${t}</span><b>${x ? pname(x.id) : '—'}</b><em>${x ? f(x) : `${CM.min}판 이상 기록 없음`}</em></div>`;
    const duoF = (x) => `함께 ${x.g}판 · 승률 ${x.wr}%`, vsF = (x) => `${x.g}번 대결 · ${x.w}승 ${x.g - x.w}패`;
    const bars = (arr) => [...arr].sort((x, y) => y.wr - x.wr || y.g - x.g).map((x, i) => `<a class="rel" href="#/chem/${x.id}" style="--d:${i}">${face(x.id)}<span class="rnm"><b>${pname(x.id)}</b><small class="mono">${x.g}판 · ${x.w}승 ${x.g - x.w}패</small></span><span class="wrb"><i style="width:${x.wr}%" class="${lvl(x.wr)}"></i></span><b class="mono ${wrClass(x.wr)}">${x.wr}%</b></a>`).join('') || `<p class="mut">${CM.min}판 이상 기록이 없습니다.</p>`;
    const cell = (a, b) => {
      if (a === b) return '<td class="self">—</td>';
      const v = CM.mode === 'duo' ? st.together[a < b ? a + '|' + b : b + '|' + a] : st.versus[a + '>' + b];
      if (!v || !v.g) return '<td></td>';
      const w = pct(v.w, v.g), dim = v.g < CM.min;
      return `<td class="mono ${dim ? 'dim' : ''}" style="background:${w >= 50 ? `rgba(63,208,224,${((w - 50) / 50) * 0.5})` : `rgba(240,80,110,${((50 - w) / 50) * 0.5})`}" title="${st.P[a].name} ${CM.mode === 'duo' ? '+' : 'vs'} ${st.P[b].name}: ${v.w}승 ${v.g - v.w}패">${w}<small>${v.g}</small></td>`;
    };
    return `<div class="h2row"><h1>${ic('chem')}케미 분석</h1><span class="grow"></span><label class="mini">최소 <input class="inp xs" type="number" min="1" value="${CM.min}" data-c="cmMin"> 판 이상만 집계</label></div>
    <div class="grid2">
      <div class="cbox good"><div class="cbh"><small>SYNERGY · TOP ${topDuo.length || PER}</small><h2>${ic('chem')}최강의 듀오</h2><span>같은 팀일 때 가장 잘 이기는 조합 · 승률 50% 초과</span></div>${rank(topDuo, 'good', 'pa')}</div>
      <div class="cbox bad"><div class="cbh"><small>ANTI-SYNERGY · TOP ${lowDuo.length || PER}</small><h2>${ic('alert')}상극의 듀오</h2><span>같은 팀일 때 가장 고전하는 조합 · 승률 50% 미만</span></div>${rank(lowDuo, 'bad', 'pb')}</div>
    </div>
    <div class="sec-h"><h2>${ic('users')}선수별 관계도</h2><span class="mut sm">선수를 누르면 그 선수 기준으로 바뀝니다</span></div>
    <div class="psel">${LANES.map((l) => { const g = on.filter((s) => s.mainLane === l).sort((a, b) => b.ovr - a.ovr); return g.length ? `<div class="psel-r" style="--tc:${LANE_COLOR[l]}"><span class="psel-l">${LANE_ICON[l]}<b>${LANE_NAME[l]}</b></span><div>${g.map((s) => `<a class="${s.id === cur ? 'on' : ''}" href="#/chem/${s.id}" title="${s.g}판 · 승률 ${s.wr}%">${face(s.id)}<span>${esc(s.name)}</span><small class="mono">${s.g}</small></a>`).join('')}</div></div>` : ''; }).join('')}</div>
    <div class="focus" style="--img:url('${artUrl(sigChamp(st.P[cur]))}')"><div class="fc-in">${face(cur)}<div><small>FOCUS</small><b>${pname(cur)}</b><span class="mono">${st.P[cur].g}판 · 승률 ${st.P[cur].wr}% · MMR ${Math.round(st.P[cur].mmr)}</span></div></div></div>
    <div class="insg">${hi('BEST PARTNER', '베스트 듀오', c.best, duoF, 'teal')}${hi('WORST PARTNER', '상극 듀오', c.worst, duoF, 'purple')}${hi('NEMESIS', '천적 (내가 약한 상대)', c.nemesis, vsF, 'red')}${hi('STRONG AGAINST', '내가 강한 상대', c.prey, vsF, 'gold')}</div>
    <p class="hint">선정 기준 · ${CHEM_RULE} · 최소 ${CM.min}판</p>
    <div class="grid2"><div class="cbox"><div class="cbh"><small>TEAMMATE</small><h2>${pname(cur)}와 같은 팀일 때</h2><span>듀오 승률 · 높은 순</span></div>${bars(c.duo)}</div>
      <div class="cbox"><div class="cbh"><small>RIVALRY</small><h2>${pname(cur)}가 상대했을 때</h2><span>상대 전적 · 높은 순</span></div>${bars(c.vs)}</div></div>
    <details class="panel"><summary><b>전체 매트릭스 펼치기</b><small class="mut"> 세로 선수 기준 · 큰 숫자는 승률(%), 작은 숫자는 판수</small></summary>
      <div class="row"><div class="seg"><button class="${CM.mode === 'duo' ? 'on' : ''}" data-a="cmMode" data-v="duo">같은 팀(듀오)</button><button class="${CM.mode === 'vs' ? 'on' : ''}" data-a="cmMode" data-v="vs">상대 전적</button></div></div>
      <div class="tw"><table class="tbl mx"><thead><tr><th class="l">선수</th>${on.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
      <tbody>${on.map((a) => `<tr><td class="l nm">${esc(a.name)}</td>${on.map((b) => cell(a.id, b.id)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  },
  after() {
    const d = document.querySelector('details.panel'); if (d) { d.open = !!CM.open; d.ontoggle = () => (CM.open = d.open); }
    clearInterval(CM.t); // 듀오 순위 자동 넘김(6초). 마우스를 올려 두면 멈춘다
    CM.t = setInterval(() => {
      if (S.page !== 'chem') return clearInterval(CM.t);
      if (document.visibilityState !== 'visible') return;
      document.querySelectorAll('.dpages').forEach((box) => { const n = box.children.length; if (n > 1 && !box.closest('.cbox').matches(':hover')) chemPage(box.dataset.k, (CM[box.dataset.k] + 1) % n); });
    }, 6000);
  },
});
function chemPage(key, i) {
  CM[key] = i;
  const box = document.querySelector(`.dpages[data-k="${key}"]`); if (!box) return;
  [...box.children].forEach((p, j) => p.classList.toggle('on', j === i));
  const nav = box.nextElementSibling;
  if (nav?.classList.contains('dnav')) { nav.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i)); const pr = nav.querySelector('.dprog i'); if (pr) { pr.style.animation = 'none'; void pr.offsetWidth; pr.style.animation = ''; } }
}
act('cmPage', (d) => chemPage(d.k, +d.i));
act('cmMin', (d, el) => { CM.min = Math.max(1, +el.value || 1); CM.pa = CM.pb = 0; refresh(); });
act('cmMode', (d) => { CM.mode = d.v; refresh(); });
