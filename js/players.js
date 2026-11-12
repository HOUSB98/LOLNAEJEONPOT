// 선수 카드(홀로 카드) / 솔랭 분석 / 케미 분석
import { S, page, act, esc, pname, go, refresh, fmtDT, wrClass, wrBar, dots, streak, titleChips, champIcon, splashUrl, tileUrl, sigChamp, ic, LANES, LANE_NAME, LANE_ICON, LANE_COLOR, pct } from './core.js';
import { chem, playerLine } from './stats.js';

const PV = { view: 'card' };
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
  return `<div class="h2row"><h1>${ic('players')}선수 카드</h1><span class="tag">${n}명</span><span class="grow"></span>${seg}</div>
  <div class="pgrid">${st.byOvr.map((s, i) => { const r = rarity(s, n); return `<a class="pcard ${r[2]}" href="#/players/${s.id}" style="--tc:${LANE_COLOR[s.mainLane]};--img:url('${tileUrl(sigChamp(s))}');--d:${Math.min(i, 16)}">
    <div class="pc-art"></div>
    <div class="pc-top"><span class="pc-type">${LANE_ICON[s.mainLane]}</span><b>${esc(s.name)}</b><span class="pc-ovr mono"><small>OVR</small>${s.ovr}</span></div>
    <div class="pc-bot"><span class="mono">${s.g ? `${s.wr}% · ${s.g}판` : '출전 없음'}</span><span class="pc-rar">${r[0]}</span></div>
    <div class="pc-title">${s.titles[0] ? `${s.titles[0].e} ${s.titles[0].n}` : '&nbsp;'}</div></a>`; }).join('')}</div>`;
}

function holo(s, n) {
  const p = s.p, r = rarity(s, n), sc = LANES.map((l) => [l, +p.scores?.[l] || 0]).sort((a, b) => b[1] - a[1]);
  const weak = sc[4][0], sig = sigChamp(s), line = playerLine(s, S.st).split('. ')[0].replace(/\.$/, '') + '.';
  const move = ([l, v]) => `<div class="hc-move"><span class="en">${LANE_ICON[l].repeat(v >= 15 ? 3 : v >= 9 ? 2 : 1)}</span><div><b>${MOVE[l]}</b><small>${LANE_NAME[l]} 승률 ${s.lanes[l].g ? `${pct(s.lanes[l].w, s.lanes[l].g)}% (${s.lanes[l].g}판)` : '기록 없음'}</small></div><em class="mono">${Math.round(v * 10)}</em></div>`;
  return `<div class="holo-wrap"><div class="holo ${r[2]}" style="--tc:${LANE_COLOR[s.mainLane]}">
    <div class="hc-in">
      <div class="hc-head"><span class="hc-stage">${r[1]}</span><b>${esc(s.name)}</b><span class="hc-hp mono"><small>OVR</small>${s.ovr}</span><span class="hc-type">${LANE_ICON[s.mainLane]}</span></div>
      <div class="hc-art" style="--img:url('${splashUrl(sig)}')">${sig ? `<span>SIGNATURE · ${esc(sig)}</span>` : `<i>${LANE_ICON[s.mainLane]}</i>`}</div>
      <div class="hc-strip">No.${String(s.ovrRank).padStart(3, '0')} · ${LANE_NAME[s.mainLane]} 타입 · ${s.g ? `${s.g}전 ${s.w}승 ${s.g - s.w}패` : '미데뷔'} · MMR ${Math.round(s.mmr)}</div>
      ${move(sc[0])}${move(sc[1])}
      <div class="hc-foot"><div><small>약점</small>${LANE_ICON[weak]}<b class="mono">${sc[4][1]}</b></div><div><small>폼</small><b>${{ '⬆️': '최상', '↗️': '좋음', '➡️': '보통', '↘️': '주춤', '⬇️': '부진', '➖': '—' }[s.cond]}</b></div><div><small>통산 승률</small><b class="mono">${s.g ? s.wr + '%' : '—'}</b></div></div>
      <p class="hc-flavor">${esc(line)}</p>
      <div class="hc-bottom"><span>${r[0]}</span><span>NAEJEONPOT · ${new Date().getFullYear()}</span><span class="mono">${String(s.ovrRank).padStart(3, '0')}/${String(n).padStart(3, '0')}</span></div>
    </div><div class="hc-shine"></div><div class="hc-glare"></div>
  </div><small class="mut">카드 위에서 마우스를 움직여 보세요</small></div>`;
}

// 리플레이로 쌓인 상세 지표. 여러 라인을 도는 선수가 불리하지 않도록 "맞라인 대비"와 "라인 평균=100 지수"를 함께 보여 준다
function detailPanel(s) {
  const x = s.dx;
  if (!x) return `<div class="panel"><div class="ph"><b>상세 지표</b><span class="tag">리플레이 0판</span></div><p class="mut sm">리플레이 분석으로 입력한 경기가 생기면 분당 CS·피해량·시야와 라인 보정 지수가 표시됩니다.</p></div>`;
  const n = (v, d = 0) => v.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const sign = (v, d = 0) => (v === null ? '—' : `<span class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : '−'}${n(Math.abs(v), d)}</span>`);
  const cell = (label, val, sub) => `<div class="dcell"><small>${label}</small><b class="mono">${val}</b><span>${sub || ''}</span></div>`;
  const gauge = (label, v) => `<div class="ixrow"><span>${label}</span><div class="ixbar"><i class="${v >= 100 ? 'up' : 'dn'}" style="${v >= 100 ? `left:50%;width:${Math.min(50, (v - 100) / 2)}%` : `right:50%;width:${Math.min(50, (100 - v) / 2)}%`}"></i><u></u></div><b class="mono ${v >= 105 ? 'good' : v <= 95 ? 'bad' : ''}">${v}</b></div>`;
  return `<div class="panel"><div class="ph"><b>상세 지표</b><span class="tag gold">리플레이 ${x.g}판</span><span class="grow"></span><span class="tag ${x.score >= 105 ? 'ok' : x.score <= 95 ? 'bad' : ''}">라인 보정 종합 ${x.score}</span></div>
    <div class="dgrid">
      ${cell('분당 CS', n(x.cspm, 1), `맞라인 대비 ${sign(x.csd, 1)}`)}
      ${cell('분당 골드', n(x.gpm), `맞라인 대비 ${sign(x.gd)}`)}
      ${cell('분당 피해량', n(x.dpm), `팀 내 비중 ${n(x.share * 100)}%`)}
      ${cell('분당 시야', n(x.vpm, 2), `평균 받은 피해 ${n(x.taken)}`)}
    </div>
    <div class="ph"><b>라인 보정 지수</b><small class="mut">그 경기에서 맡은 라인의 리그 평균을 100으로 환산 · 100보다 크면 평균 이상</small></div>
    ${gauge('골드', x.idx.gold)}${gauge('피해량', x.idx.dmg)}${gauge('시야', x.idx.vis)}${gauge('CS', x.idx.cs)}
    <p class="hint">서폿을 맡은 판은 서폿 평균과, 원딜을 맡은 판은 원딜 평균과 비교하므로 여러 라인을 도는 선수도 공정하게 비교됩니다. 표본이 적을 때는 참고용으로만 보세요.</p></div>`;
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
        ${row('베스트 듀오', who(c.best, duoF))}${row('상극 듀오', who(c.worst, duoF))}${row('천적', who(c.nemesis, vsF))}${row('밥', who(c.prey, vsF))}
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
  after() { // 홀로 카드: 마우스 위치에 따라 기울기와 빛 반사를 바꾼다
    const w = document.querySelector('.holo-wrap'), h = w?.querySelector('.holo'); if (!h) return;
    w.onpointermove = (e) => {
      const r = h.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      h.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); h.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      h.style.setProperty('--rx', ((0.5 - y) * 22).toFixed(1) + 'deg'); h.style.setProperty('--ry', ((x - 0.5) * 26).toFixed(1) + 'deg');
      h.classList.add('live');
    };
    w.onpointerleave = () => { h.classList.remove('live'); h.style.setProperty('--rx', '0deg'); h.style.setProperty('--ry', '0deg'); };
  },
});
act('pvView', (d) => { PV.view = d.v; refresh(); });
act('pcSel', (d, el) => go('#/players/' + el.value));

// ---------- 케미 분석 ----------
const CM = { min: 5, mode: 'duo' };
page('chem', {
  render(id) {
    const st = S.st, on = st.list.filter((s) => s.g).sort((a, b) => b.g - a.g);
    if (!on.length) return `<h1>${ic('chem')}케미 분석</h1><div class="panel empty">경기 기록이 쌓이면 듀오 시너지와 천적 관계가 표시됩니다.</div>`;
    const cur = st.P[id]?.g ? id : on[0].id, c = chem(st, cur, CM.min);
    const pairs = Object.entries(st.together).filter(([, v]) => v.g >= CM.min).map(([k, v]) => ({ ids: k.split('|'), ...v, wr: pct(v.w, v.g) }));
    const topDuo = [...pairs].sort((a, b) => b.wr - a.wr || b.g - a.g).slice(0, 5), lowDuo = [...pairs].sort((a, b) => a.wr - b.wr || b.g - a.g).slice(0, 5);
    const face = (pid) => { const ch = sigChamp(st.P[pid]); return ch ? champIcon(ch, 'face') : `<span class="ci face txt">${pname(pid).slice(0, 1)}</span>`; };
    const lvl = (w) => (w >= 60 ? 'hi' : w >= 45 ? 'mid' : 'lo');
    const rank = (arr, tone) => arr.map((x, i) => `<div class="duo ${tone}" style="--img:url('${tileUrl(sigChamp(st.P[x.ids[i % 2]]))}');--d:${i}">
      <i class="drk mono">${i + 1}</i><span class="faces">${face(x.ids[0])}${face(x.ids[1])}</span>
      <span class="dnm"><b>${pname(x.ids[0])}</b><em>&amp;</em><b>${pname(x.ids[1])}</b><small class="mono">${x.g}판 · ${x.w}승 ${x.g - x.w}패</small></span>
      <span class="dwr"><b class="mono ${tone}">${x.wr}<small>%</small></b><span class="wrb"><i style="width:${x.wr}%" class="${lvl(x.wr)}"></i></span></span></div>`).join('') || `<p class="mut">${CM.min}판 이상 함께한 조합이 없습니다.</p>`;
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
      <div class="cbox good"><div class="cbh"><small>SYNERGY · TOP 5</small><h2>${ic('chem')}최강의 듀오</h2><span>같은 팀일 때 가장 잘 이기는 조합</span></div>${rank(topDuo, 'good')}</div>
      <div class="cbox bad"><div class="cbh"><small>ANTI-SYNERGY · TOP 5</small><h2>${ic('alert')}상극의 듀오</h2><span>같은 팀일 때 가장 고전하는 조합</span></div>${rank(lowDuo, 'bad')}</div>
    </div>
    <div class="sec-h"><h2>${ic('users')}선수별 관계도</h2><span class="mut sm">선수를 누르면 그 선수 기준으로 바뀝니다</span></div>
    <div class="pchips">${on.map((s) => `<a class="${s.id === cur ? 'on' : ''}" href="#/chem/${s.id}">${face(s.id)}<span>${esc(s.name)}</span></a>`).join('')}</div>
    <div class="focus" style="--img:url('${splashUrl(sigChamp(st.P[cur]))}')"><div class="fc-in">${face(cur)}<div><small>FOCUS</small><b>${pname(cur)}</b><span class="mono">${st.P[cur].g}판 · 승률 ${st.P[cur].wr}% · MMR ${Math.round(st.P[cur].mmr)}</span></div></div></div>
    <div class="insg">${hi('BEST PARTNER', '베스트 듀오', c.best, duoF, 'teal')}${hi('WORST PARTNER', '상극 듀오', c.worst, duoF, 'purple')}${hi('NEMESIS', '천적', c.nemesis, vsF, 'red')}${hi('FAVORITE PREY', '밥', c.prey, vsF, 'gold')}</div>
    <div class="grid2"><div class="cbox"><div class="cbh"><small>TEAMMATE</small><h2>${pname(cur)}와 같은 팀일 때</h2><span>듀오 승률 · 높은 순</span></div>${bars(c.duo)}</div>
      <div class="cbox"><div class="cbh"><small>RIVALRY</small><h2>${pname(cur)}가 상대했을 때</h2><span>상대 전적 · 높은 순</span></div>${bars(c.vs)}</div></div>
    <details class="panel"><summary><b>전체 매트릭스 펼치기</b><small class="mut"> 세로 선수 기준 · 큰 숫자는 승률(%), 작은 숫자는 판수</small></summary>
      <div class="row"><div class="seg"><button class="${CM.mode === 'duo' ? 'on' : ''}" data-a="cmMode" data-v="duo">같은 팀(듀오)</button><button class="${CM.mode === 'vs' ? 'on' : ''}" data-a="cmMode" data-v="vs">상대 전적</button></div></div>
      <div class="tw"><table class="tbl mx"><thead><tr><th class="l">선수</th>${on.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
      <tbody>${on.map((a) => `<tr><td class="l nm">${esc(a.name)}</td>${on.map((b) => cell(a.id, b.id)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  },
  after() { const d = document.querySelector('details.panel'); if (d) { d.open = !!CM.open; d.ontoggle = () => (CM.open = d.open); } },
});
act('cmMin', (d, el) => { CM.min = Math.max(1, +el.value || 1); refresh(); });
act('cmMode', (d) => { CM.mode = d.v; refresh(); });
