// 선수 목록 / 플레이어 카드 / 솔랭 분석 / 케미 분석
import { S, page, act, esc, pname, go, refresh, fmtDT, wr, wrClass, dots, streak, laneTag, titleChips, champIcon, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import { chem, playerLine } from './stats.js';

const PV = { view: 'card' };
const opgg = (rid) => (rid && rid.includes('#') ? `https://op.gg/ko/lol/summoners/kr/${encodeURIComponent(rid.replace('#', '-'))}` : '');
const rarity = (s, n) => { const r = s.ovrRank / n; return r <= 0.1 ? ['★★★', '레전드', 'gold'] : r <= 0.35 ? ['★★☆', '레어', 'blue'] : ['★☆☆', '노말', '']; };

function listView() {
  const st = S.st, n = st.list.length;
  const seg = `<div class="seg">${[['card', '카드'], ['solo', '솔랭 분석']].map(([k, t]) => `<button class="${PV.view === k ? 'on' : ''}" data-a="pvView" data-v="${k}">${t}</button>`).join('')}</div>`;
  if (!n) return `<h1>🪪 선수</h1><div class="panel empty">등록된 선수가 없습니다.<br><a class="btn pri" href="#/admin">관리에서 선수 추가 / 시트 데이터 가져오기</a></div>`;
  if (PV.view === 'solo') {
    return `<div class="h2row"><h1>🎯 솔랭 분석</h1><span class="grow"></span>${seg}</div>
    <p class="hint">솔랭 티어는 내전 MMR 초기값으로 쓰입니다. 내용은 관리 &gt; 선수 수정에서 고칠 수 있습니다.</p>
    <div class="solo">${st.list.map((s) => { const p = s.p, o = p.solo || {}; return `<div class="panel"><div class="ph"><a href="#/players/${s.id}"><b>${esc(s.name)}</b></a><span class="tag">${esc(p.soloTier || '티어 정보 없음')}</span>${o.pos ? `<span class="tag">${esc(o.pos)}</span>` : ''}<span class="grow"></span>${opgg(p.riotId) ? `<a class="btn xs" href="${opgg(p.riotId)}" target="_blank" rel="noopener">🔗 op.gg</a>` : ''}</div>
      ${p.riotId ? `<div class="mut sm">${esc(p.riotId)} · 전적 ${esc(o.record || '-')} · 최고 ${esc(o.peak || '-')}</div>` : ''}
      ${o.most ? `<div class="sm">모스트 3 · ${esc(o.most)}</div>` : ''}${o.comment ? `<p>${esc(o.comment)}</p>` : '<p class="mut">솔랭 분석 정보가 없습니다.</p>'}</div>`; }).join('')}</div>`;
  }
  return `<div class="h2row"><h1>🪪 선수</h1><span class="tag">${n}명</span><span class="grow"></span>${seg}</div>
  <div class="pgrid">${st.byOvr.map((s) => { const r = rarity(s, n); return `<a class="pcard ${r[2]}" href="#/players/${s.id}">
    <div class="ov"><b>${s.ovr}</b><small>OVR</small></div>
    <div class="pi"><b>${esc(s.name)}</b><small>${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · ${r[0]}</small>
    <span>${s.g ? `${s.wr}% · ${s.g}판` : '출전 없음'} · MMR ${Math.round(s.mmr)}</span><div class="chips">${titleChips(s, 2)}</div></div></a>`; }).join('')}</div>`;
}

function cardView(id) {
  const st = S.st, s = st.P[id];
  if (!s) return `<div class="panel empty">선수를 찾을 수 없습니다. <a href="#/players">목록으로</a></div>`;
  const n = st.list.length, r = rarity(s, n), p = s.p, o = p.solo || {}, c = chem(st, id, 3);
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const who = (x, f) => (x ? `${pname(x.id)} · ${f(x)}` : '<span class="mut">아직 차이 없음 (3판 이상 기준)</span>');
  const duoF = (x) => `${x.wr}% (${x.g}판)`, vsF = (x) => `${x.w}승 ${x.g - x.w}패`;
  const lv = st.laneVs[id] || {};
  const laneOpp = (l) => { const e = Object.entries(lv).filter(([k]) => k.startsWith(l + '|')).sort((a, b) => b[1].g - a[1].g)[0]; return e ? `vs ${pname(e[0].split('|')[1])} ${e[1].w}승 ${e[1].g - e[1].w}패` : '—'; };
  const champs = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g);
  const games = st.matches.filter((m) => m.blue.includes(id) || m.red.includes(id)).slice(-8).reverse();
  const strong = LANES.reduce((a, l) => ((p.scores?.[l] || 0) > (p.scores?.[a] || 0) ? l : a), 'top'), weak = LANES.reduce((a, l) => ((p.scores?.[l] || 0) < (p.scores?.[a] || 0) ? l : a), 'top');
  const kda = s.kdaG ? `${(s.kda[0] / s.kdaG).toFixed(1)} / ${(s.kda[1] / s.kdaG).toFixed(1)} / ${(s.kda[2] / s.kdaG).toFixed(1)} <small>(${s.kdaG}판)</small>` : '<span class="mut">기록 없음</span>';
  return `<div class="h2row"><a class="btn xs" href="#/players">← 목록</a><span class="grow"></span>
    <select class="inp" data-c="pcSel">${st.list.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
  <div class="pc ${r[2]}">
    <div class="pchead"><div class="ov big"><b>${s.ovr}</b><small>OVR</small></div>
      <div><h1>${esc(s.name)}</h1><div class="mut">${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} 타입 · ${r[0]} ${r[1]} · OVR ${n}명 중 ${s.ovrRank}위</div><div class="chips">${titleChips(s) || '<span class="mut sm">아직 칭호 없음</span>'}</div></div></div>
    <div class="lanes5">${LANES.map((l) => `<div class="${l === s.mainLane ? 'main' : ''}"><small>${LANE_ICON[l]} ${LANE_NAME[l]}</small><b>${p.scores?.[l] ?? 0}</b><span class="${wrClass(pct(s.lanes[l].w, s.lanes[l].g))}">${s.lanes[l].g ? `${pct(s.lanes[l].w, s.lanes[l].g)}% (${s.lanes[l].g})` : '-'}</span></div>`).join('')}
      <div class="tot"><small>🏆 통산</small><b>${s.g ? s.wr + '%' : '-'}</b><span>${s.g}판</span></div></div>
    <div class="talk">“ ${esc(playerLine(s, st))} ”</div>
    <div class="grid2">
      <div class="panel"><div class="ph"><b>📋 기록</b></div>
        ${row('🏁 전적', `${s.g}판 ${s.w}승 ${s.g - s.w}패`)}${row('🕹️ 최근 5판', dots(s.recent))}${row('🔥 연속 기록', streak(s.cur) || '-')}
        ${row('😇 희생 지수', s.g ? `${s.off.g}/${s.g}판 주라인 밖 · ${pct(s.off.g, s.g)}%` : '-')}
        ${row('⚔️ 진영 전적', `🔵 ${s.side.blue.w}승 ${s.side.blue.g - s.side.blue.w}패 · 🔴 ${s.side.red.w}승 ${s.side.red.g - s.side.red.w}패`)}
        ${row('⚖️ 내전 MMR', `${Math.round(s.mmr).toLocaleString()} <small class="${s.mmrLast >= 0 ? 'good' : 'bad'}">${s.g ? (s.mmrLast >= 0 ? '▲' : '▼') + Math.abs(Math.round(s.mmrLast)) : ''}</small> <small>시작 ${s.mmrInit} · ${s.rel[0]} ${s.rel[1]}</small>`)}
        ${row('💪 컨디션', s.cond)}${row('⚔️ 평균 KDA', kda)}${row('📅 마지막 출전', s.lastAt ? `${fmtDT(s.lastAt)} (${Math.floor((Date.now() - s.lastAt) / 864e5)}일 전)` : '-')}
        ${row('💪 강점 / 💢 약점', `${LANE_ICON[strong]} ${LANE_NAME[strong]} ${p.scores?.[strong] ?? 0} / ${LANE_ICON[weak]} ${LANE_NAME[weak]} ${p.scores?.[weak] ?? 0}`)}</div>
      <div class="panel"><div class="ph"><b>📊 라인 파워 분석</b><small class="mut">선수 vs 리그 평균 (20점 만점)</small></div>
        ${LANES.map((l) => { const v = +p.scores?.[l] || 0, a = st.laneAvg[l], rk = st.laneRank[id][l]; return `<div class="pw"><span>${LANE_ICON[l]} ${LANE_NAME[l]}</span><div class="bar"><i style="width:${v * 5}%"></i><u style="left:${a * 5}%"></u></div><b>${v}</b><small class="${v >= a ? 'good' : 'bad'}">${v >= a ? '▲' : '▼'}${Math.abs(v - a).toFixed(1)}</small><small>${rk}위</small></div>`; }).join('')}
        <p class="hint">세로선 = 리그 평균</p></div>
      <div class="panel"><div class="ph"><b>🤝 케미</b><a class="btn xs" href="#/chem/${id}">자세히</a></div>
        ${row('🤝 베스트 듀오', who(c.best, duoF))}${row('💔 상극 듀오', who(c.worst, duoF))}${row('😈 천적', who(c.nemesis, vsF))}${row('🍖 밥', who(c.prey, vsF))}
        <div class="ph"><b>⚔️ 맞라인 전적</b></div>${LANES.map((l) => row(`${LANE_ICON[l]} ${LANE_NAME[l]}`, laneOpp(l))).join('')}</div>
      <div class="panel"><div class="ph"><b>🎯 솔랭 분석</b><span class="tag">${esc(p.soloTier || '정보 없음')}</span><span class="grow"></span>${opgg(p.riotId) ? `<a class="btn xs" href="${opgg(p.riotId)}" target="_blank" rel="noopener">🔗 op.gg</a>` : ''}</div>
        ${row('전적', esc(o.record || '-'))}${row('⭐ 최고 티어', esc(o.peak || '-'))}${row('주 포지션', esc(o.pos || '-') + (o.pos && o.pos.includes(LANE_NAME[s.mainLane].slice(0, 2)) ? ' ✅ 일치' : ''))}${row('모스트 3', esc(o.most || '-'))}
        ${o.comment ? `<p>${esc(o.comment)}</p>` : ''}</div>
    </div>
    <div class="panel"><div class="ph"><b>🎭 내전 챔피언</b><small class="mut">${s.champG}판 ${s.champKinds}종</small></div>
      <div class="chlist">${champs.map(([nm, v]) => `<div>${champIcon(nm)}<span>${esc(nm)}</span><small class="${wrClass(pct(v.w, v.g))}">${v.g}판 ${pct(v.w, v.g)}%</small></div>`).join('') || '<span class="mut">챔피언 기록이 없습니다.</span>'}</div></div>
    <div class="panel"><div class="ph"><b>🕹️ 최근 경기</b></div>
      ${games.map((m) => { const side = m.blue.includes(id) ? 'blue' : 'red', i = m[side].indexOf(id), win = m.winner === side; return `<div class="gm ${win ? 'w' : 'l'}"><b>${win ? '승' : '패'}</b><span>#${st.MI[m.id].no} · ${fmtDT(m.at)}</span><span>${side === 'blue' ? '🔵' : '🔴'} ${LANE_ICON[LANES[i]]} ${LANE_NAME[LANES[i]]}</span>${champIcon(m.champs?.[side]?.[i], 'sm')}<span class="mut">${esc(m.champs?.[side]?.[i] || '')}</span>${m.kda?.[id] ? `<small>${m.kda[id].join('/')}</small>` : ''}</div>`; }).join('') || '<span class="mut">출전 기록이 없습니다.</span>'}</div>
  </div>`;
}
page('players', { render: (id) => (id ? cardView(id) : listView()) });
act('pvView', (d) => { PV.view = d.v; refresh(); });
act('pcSel', (d, el) => go('#/players/' + el.value));

// ---------- 케미 분석 ----------
const CM = { min: 5, mode: 'duo' };
page('chem', {
  render(id) {
    const st = S.st, act_ = st.list.filter((s) => s.g).sort((a, b) => b.g - a.g);
    if (!act_.length) return `<h1>💞 케미 분석</h1><div class="panel empty">경기 기록이 쌓이면 듀오 시너지와 천적 관계가 표시됩니다.</div>`;
    const cur = st.P[id]?.g ? id : act_[0].id, c = chem(st, cur, CM.min);
    const box = (t, x, f, tone) => `<div class="hcard ${tone}"><div><small>${t}</small><b>${x ? pname(x.id) : '-'}</b><span>${x ? f(x) : `${CM.min}판 이상 기록 없음`}</span></div></div>`;
    const duoF = (x) => `${x.wr}% (${x.g}판)`, vsF = (x) => `${x.wr}% · ${x.w}승 ${x.g - x.w}패`;
    const cell = (a, b) => {
      if (a === b) return '<td class="self">—</td>';
      const v = CM.mode === 'duo' ? st.together[a < b ? a + '|' + b : b + '|' + a] : st.versus[a + '>' + b];
      if (!v || !v.g) return '<td></td>';
      const w = pct(v.w, v.g), dim = v.g < CM.min;
      return `<td class="${dim ? 'dim' : ''}" style="background:${w >= 50 ? `rgba(59,130,246,${((w - 50) / 50) * 0.55})` : `rgba(229,72,77,${((50 - w) / 50) * 0.55})`}" title="${st.P[a].name} ${CM.mode === 'duo' ? '+' : 'vs'} ${st.P[b].name}: ${v.w}승 ${v.g - v.w}패">${w}%<small>${v.g}</small></td>`;
    };
    const list = (arr, f) => [...arr].sort((x, y) => y.wr - x.wr || y.g - x.g).map((x) => `<div class="kv"><span>${pname(x.id)}</span><b class="${wrClass(x.wr)}">${f(x)}</b></div>`).join('') || `<p class="mut">${CM.min}판 이상 기록이 없습니다.</p>`;
    return `<div class="h2row"><h1>💞 케미 분석</h1><span class="grow"></span>
      <select class="inp" data-c="cmSel">${act_.map((s) => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <label class="mini">최소 <input class="inp xs" type="number" min="1" value="${CM.min}" data-c="cmMin"> 판</label></div>
    <div class="hof wrap">${box('🤝 베스트 듀오', c.best, duoF, 'blue')}${box('💔 상극 듀오', c.worst, duoF, 'red')}${box('😈 천적', c.nemesis, vsF, 'red')}${box('🍖 밥', c.prey, vsF, 'gold')}</div>
    <div class="grid2"><div class="panel"><div class="ph"><b>🤝 ${pname(cur)}의 듀오 승률</b><small class="mut">같은 팀일 때</small></div>${list(c.duo, duoF)}</div>
      <div class="panel"><div class="ph"><b>⚔️ ${pname(cur)}의 상대 전적</b><small class="mut">맞붙었을 때</small></div>${list(c.vs, vsF)}</div></div>
    <div class="h2row"><h2>${CM.mode === 'duo' ? '🤝 듀오 시너지 — 세로 선수가 가로 선수와 같은 팀일 때의 승률' : '⚔️ 라이벌 — 세로 선수가 가로 선수를 상대했을 때의 승률'}</h2><span class="grow"></span>
      <div class="seg"><button class="${CM.mode === 'duo' ? 'on' : ''}" data-a="cmMode" data-v="duo">듀오</button><button class="${CM.mode === 'vs' ? 'on' : ''}" data-a="cmMode" data-v="vs">상대</button></div></div>
    <div class="tw"><table class="tbl mx"><thead><tr><th class="l">선수</th>${act_.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
      <tbody>${act_.map((a) => `<tr><td class="l nm">${esc(a.name)}</td>${act_.map((b) => cell(a.id, b.id)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="hint">작은 숫자는 판수입니다. 최소 판수에 못 미치는 칸은 흐리게 표시됩니다.</p>`;
  },
});
act('cmSel', (d, el) => go('#/chem/' + el.value));
act('cmMin', (d, el) => { CM.min = Math.max(1, +el.value || 1); refresh(); });
act('cmMode', (d) => { CM.mode = d.v; refresh(); });
