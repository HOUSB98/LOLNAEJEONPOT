// 시작점 + 리더보드 / 경기 기록 / 챔피언 / 피어리스 화면
import { FIREBASE_CONFIG } from './config.js';
import { createStore } from './store.js';
import { S, page, act, esc, col, pname, go, refresh, initShell, loadChamps, fmtDT, fmtDay, wr, wrClass, dots, streak, laneTag, titleChips, champIcon, toast, download, csv, needAdmin, history, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import './today.js';
import './players.js';
import './auction.js';
import './admin.js';

// ---------- 리더보드 ----------
const LB = { view: 'all', sort: 'ovr', dir: -1, min: 0 };
const num = (v, cls = '') => `<td class="num ${cls}">${v}</td>`;
const COLS = {
  all: [
    ['g', '판', (s) => s.g, (s) => s.g],
    ['wr', '승률', (s) => (s.g ? s.wr : -1), (s) => (s.g ? `<b class="${wrClass(s.wr)}">${s.wr}%</b>` : '-')],
    ['recent', '최근 5판', (s) => s.recent.filter(Boolean).length, (s) => dots(s.recent)],
    ['cur', '연속', (s) => s.cur, (s) => streak(s.cur)],
    ['ovr', 'OVR', (s) => s.ovr, (s) => `<b class="ovr">${s.ovr}</b>`],
    ['mmr', 'MMR', (s) => s.mmr, (s) => `${Math.round(s.mmr).toLocaleString()} ${s.g ? `<small class="${s.mmrLast >= 0 ? 'good' : 'bad'}">${s.mmrLast >= 0 ? '▲' : '▼'}${Math.abs(Math.round(s.mmrLast))}</small>` : ''}`],
    ['main', '주라인', (s) => LANES.indexOf(s.mainLane), (s) => laneTag(s.mainLane)],
    ['cond', '컨디션', (s) => s.recent.filter(Boolean).length / (s.recent.length || 1), (s) => s.cond],
    ['rel', '신뢰도', (s) => s.g, (s) => `${s.rel[0]} <small>${s.rel[1]}</small>`],
  ],
  score: [...LANES.map((l) => [l, `${LANE_ICON[l]} ${LANE_NAME[l]}`, (s) => +s.p.scores?.[l] || 0, (s) => `<span class="sc" style="--v:${(s.p.scores?.[l] || 0) * 5}%">${s.p.scores?.[l] ?? 0}</span>`]),
    ['avg', '📊 평균', (s) => s.avg, (s) => `<b>${s.avg.toFixed(1)}</b>`]],
  lane: LANES.map((l) => [l, `${LANE_ICON[l]} ${LANE_NAME[l]}`, (s) => (s.lanes[l].g ? s.lanes[l].w / s.lanes[l].g : -1), (s) => `<span class="${wrClass(pct(s.lanes[l].w, s.lanes[l].g))}">${wr(s.lanes[l])}</span>`]),
};
function card(label, value, sub, tone = '') {
  return `<div class="stat ${tone}"><small>${label}</small><b>${value}</b><span>${sub || ''}</span></div>`;
}
page('home', {
  render() {
    const st = S.st, x = st.sum, names = (ids) => (ids.length > 2 ? `${pname(ids[0])} 외 ${ids.length - 1}명` : ids.map(pname).join(', '));
    const topChamp = st.champs[0];
    const cols = COLS[LB.view], sortCol = cols.find((c) => c[0] === LB.sort) || cols[cols.length - (LB.view === 'lane' ? 5 : 1)];
    const rows = st.list.filter((s) => s.g >= LB.min).sort((a, b) => LB.dir * (sortCol[2](a) - sortCol[2](b)) || b.ovr - a.ovr);
    const hof = [
      ['🔥', '역대 최장 연승', x.hof.n ? names(x.hof.ids) : '-', x.hof.n ? `${x.hof.n}연승` : '아직 없어요', 'gold'],
      ['🎖️', '최다 출전', x.maxG ? names(x.mostIds) : '-', `${x.maxG}판`, 'blue'],
      ['👑', '최고 승률 (10판↑)', x.best10 ? esc(x.best10.name) : '-', x.best10 ? `${x.best10.wr}% (${x.best10.g}판)` : '10판 이상 출전자 없음', 'gold'],
      ['🚨', '최대 업셋', x.maxUpset ? `예상 ${Math.round(x.maxUpset.p * 100)}% 팀 승리` : '아직 업셋 없음', x.maxUpset ? fmtDT(x.maxUpset.m.at) : `업셋 ${x.upsets}회`, 'red'],
      ['🔥', '현재 최다 연승', x.winStreak?.cur > 1 ? esc(x.winStreak.name) : '-', x.winStreak?.cur > 1 ? `${x.winStreak.cur}연승 중` : '2연승부터 표시', 'gold'],
      ['🧊', '현재 최다 연패', x.loseStreak?.cur < -1 ? esc(x.loseStreak.name) : '-', x.loseStreak?.cur < -1 ? `${-x.loseStreak.cur}연패 중` : '2연패부터 표시', 'red'],
      ['🏆', '최다 픽 챔피언', topChamp ? esc(topChamp.name) : '-', topChamp ? `${topChamp.g}픽 · ${pct(topChamp.w, topChamp.g)}%` : '기록 없음', 'blue'],
    ];
    return `
    <div class="stats">
      ${card('🎮 총 경기', x.n, `내전 ${x.days}일 · 참가 ${x.active}명`, 'blue')}
      ${card('🔵 블루 승률', x.n ? pct(x.blueW, x.n) + '%' : '-', `블루 ${x.blueW}승 · 레드 ${x.redW}승`, 'blue')}
      ${card('🗓️ 최근 내전', st.lastDay ? fmtDay(st.lastDay).slice(5) : '-', `${x.lastDayN}경기`, 'green')}
      ${card('🎯 예상 적중률', x.hit === null ? '-' : x.hit + '%', '점수 예상 vs 실제', 'gold')}
      ${card('⚖️ 팀 밸런스 지수', x.balance === null ? '-' : x.balance + '%', `평균 점수 차 ${x.avgGap.toFixed(1)}점`, 'purple')}
      ${card('🚨 업셋', x.upsets + '회', '예상 40% 미만 팀 승리', 'red')}
    </div>
    <h2>🏛️ 명예의 전당</h2>
    <div class="hof">${hof.map(([e, t, a, b, tone]) => `<div class="hcard ${tone}"><div class="he">${e}</div><div><small>${t}</small><b>${a}</b><span>${b}</span></div></div>`).join('')}</div>
    <div class="h2row"><h2>리더보드</h2>
      <div class="seg">${[['all', '종합'], ['score', '라인 점수'], ['lane', '라인별 승률']].map(([k, t]) => `<button class="${LB.view === k ? 'on' : ''}" data-a="lbView" data-v="${k}">${t}</button>`).join('')}</div>
      <label class="mini">최소 <input class="inp xs" type="number" min="0" value="${LB.min}" data-c="lbMin"> 판</label>
    </div>
    <div class="tw"><table class="tbl">
      <thead><tr><th>#</th><th class="l">선수</th>${cols.map((c) => `<th data-a="lbSort" data-k="${c[0]}" class="s ${sortCol[0] === c[0] ? 'on' : ''}">${c[1]}${sortCol[0] === c[0] ? (LB.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('')}${LB.view === 'all' ? '<th class="l">칭호</th>' : ''}</tr></thead>
      <tbody>${rows.map((s, i) => `<tr data-a="goPlayer" data-id="${s.id}"><td class="rk r${i + 1}">${i + 1}</td><td class="l nm"><span class="tt">${s.titles[0]?.e || '·'}</span> ${esc(s.name)}</td>${cols.map((c) => num(c[3](s))).join('')}${LB.view === 'all' ? `<td class="l chips">${titleChips(s, 3)}</td>` : ''}</tr>`).join('') || `<tr><td colspan="20" class="empty">조건에 맞는 선수가 없습니다.</td></tr>`}</tbody>
    </table></div>
    <p class="hint">머리글을 누르면 정렬됩니다. 선수를 누르면 플레이어 카드가 열립니다. 칭호 설명은 관리 &gt; 칭호 도감.</p>`;
  },
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
    <div class="th">${side === 'blue' ? '🔵 블루' : '🔴 레드'} <b>${m.winner === side ? '승리' : '패배'}</b><small>${mi.bs !== undefined ? (side === 'blue' ? mi.bs : mi.rs) + '점' : ''}</small></div>
    ${m[side].map((id, i) => { const k = m.kda?.[id]; return `<div class="pl"><span class="li">${LANE_ICON[LANES[i]]}</span>${champIcon(m.champs?.[side]?.[i])}<a href="#/players/${id}">${pname(id)}</a>${k ? `<small>${k.join('/')}</small>` : ''}</div>`; }).join('')}
    ${(m.bans?.[side] || []).some(Boolean) ? `<div class="bans">밴 ${m.bans[side].filter(Boolean).map((b) => champIcon(b, 'sm')).join('')}</div>` : ''}
  </div>`;
  return `<div class="mcard">
    <div class="mhd"><b>#${mi.no}</b><span>${fmtDT(m.at)}</span><span class="mut">예상 블루 ${Math.round(mi.pBlue * 100)}%</span>${mi.upset ? '<span class="tag bad">🚨 업셋</span>' : ''}
      ${tools ? `<span class="grow"></span><button class="btn xs" data-a="editMatch" data-id="${m.id}">수정</button><button class="btn xs ghost" data-a="delMatch" data-id="${m.id}">삭제</button>` : ''}</div>
    <div class="vs">${team('blue')}${team('red')}</div></div>`;
}
page('matches', {
  render() {
    const st = S.st, days = [...st.days].reverse();
    if (!st.matches.length) return `<h1>📜 경기 기록</h1><div class="panel empty">아직 기록된 경기가 없습니다.<br><a class="btn pri" href="#/today">첫 경기 기록하기</a></div>`;
    return `<div class="h2row"><h1>📜 경기 기록</h1><span class="grow"></span><button class="btn" data-a="exportCsv">⬇ CSV 내보내기</button></div>
    ${days.map((d) => {
      const ms = st.matches.filter((m) => st.MI[m.id].day === d).reverse(), bw = ms.filter((m) => m.winner === 'blue').length;
      return `<h3 class="day">${fmtDay(d)} <small>${ms.length}경기 · 블루 ${bw}승 / 레드 ${ms.length - bw}승</small></h3><div class="mlist">${ms.map((m) => matchCard(m)).join('')}</div>`;
    }).join('')}`;
  },
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

// ---------- 챔피언 통계 ----------
const CH = { sort: 'g', dir: -1, q: '' };
page('champs', {
  render() {
    const st = S.st, q = CH.q.replace(/\s/g, '');
    const val = { g: (c) => c.g, w: (c) => c.w, wr: (c) => (c.g ? c.w / c.g : -1), ban: (c) => c.ban };
    const rows = st.champs.filter((c) => !q || c.name.replace(/\s/g, '').includes(q)).sort((a, b) => CH.dir * (val[CH.sort](a) - val[CH.sort](b)) || b.g - a.g);
    const th = (k, t) => `<th class="s ${CH.sort === k ? 'on' : ''}" data-a="chSort" data-k="${k}">${t}${CH.sort === k ? (CH.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`;
    const picked = st.champs.filter((c) => c.g).length;
    return `<div class="h2row"><h1>📈 챔피언 통계</h1><span class="grow"></span><input id="chq" class="inp" placeholder="챔피언 검색" value="${esc(CH.q)}" data-i="chQ"></div>
    <div class="stats">${card('🎭 등장 챔피언', picked + '종', S.champs.length ? `전체 ${S.champs.length}종 중` : '', 'blue')}${card('🏆 최다 픽', st.champs[0] ? esc(st.champs[0].name) : '-', st.champs[0] ? st.champs[0].g + '픽' : '', 'gold')}</div>
    <div class="tw"><table class="tbl"><thead><tr><th>#</th><th class="l">챔피언</th>${th('g', '픽')}${th('w', '승')}${th('wr', '승률')}${th('ban', '밴')}<th class="l">주 사용자</th></tr></thead>
    <tbody>${rows.map((c, i) => {
      const u = Object.entries(c.users).sort((a, b) => b[1] - a[1]);
      return `<tr><td class="rk">${i + 1}</td><td class="l nm">${champIcon(c.name, 'sm')} ${esc(c.name)}</td>${num(c.g)}${num(c.w)}${num(c.g ? `<b class="${wrClass(pct(c.w, c.g))}">${pct(c.w, c.g)}%</b>` : '-')}${num(c.ban || '-')}<td class="l">${u.slice(0, 3).map(([id, n]) => `${pname(id)}<small> ${n}</small>`).join(' · ')}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">챔피언 기록이 없습니다. 경기 입력 때 챔피언을 고르면 여기에 쌓입니다.</td></tr>'}</tbody></table></div>`;
  },
});
act('chSort', (d) => { if (CH.sort === d.k) CH.dir *= -1; else { CH.sort = d.k; CH.dir = -1; } refresh(); });
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
    if (!list.length) return `<h1>🚫 피어리스 현황</h1><div class="panel empty">아직 시리즈가 없습니다. 경기를 기록하면 같은 팀으로 이어서 한 판들이 한 시리즈로 묶입니다.</div>`;
    const sr = list.find((s) => s.id === FL.id) || list[0];
    const used = seriesUsed(sr.id), first = sr.ms[0];
    const teams = [first.blue, first.red].map((roster, ti) => ({ roster, name: ti ? '🔴 레드로 시작한 팀' : '🔵 블루로 시작한 팀', wins: sr.ms.filter((m) => m[m.winner].includes(roster[0])).length }));
    const cell = (id, m) => { for (const side of ['blue', 'red']) { const i = m[side].indexOf(id); if (i >= 0) return `<td>${champIcon(m.champs?.[side]?.[i])}<small>${LANE_ICON[LANES[i]]}</small></td>`; } return '<td></td>'; };
    const pool = S.champs.filter((c) => !FL.left || !used[c.name]);
    return `<div class="h2row"><h1>🚫 피어리스 현황</h1><span class="grow"></span>
      <select class="inp" data-c="flSel">${list.map((s) => `<option value="${s.id}" ${s.id === sr.id ? 'selected' : ''}>${fmtDay(s.day).slice(5)} · ${s.ms.map((m) => '#' + st.MI[m.id].no).join(' ')} (${s.ms.length}판)</option>`).join('')}</select></div>
    <p class="hint">한 시리즈(같은 두 팀이 이어서 하는 판들) 동안 한 번 나온 챔피언은 양 팀 모두 다시 쓸 수 없습니다. 밴은 다음 판으로 이어지지 않습니다.</p>
    <div class="grid2">${teams.map((t) => `<div class="panel"><div class="ph"><b>${t.name}</b><span class="tag">${t.wins}승</span></div>
      <div class="tw"><table class="tbl fl"><thead><tr><th class="l">선수</th>${sr.ms.map((m) => `<th>#${st.MI[m.id].no}</th>`).join('')}</tr></thead>
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
(async () => {
  const key = new URLSearchParams(location.search).get('k');
  const main = document.getElementById('main');
  if (FIREBASE_CONFIG && !key) {
    document.getElementById('side').hidden = true;
    main.innerHTML = `<div class="panel landing"><h1>🏆 내전 기록실</h1><p>초대 링크로 접속해 주세요. 링크 끝의 <code>?k=…</code> 코드가 이 리그의 열쇠입니다.</p>
      <button class="btn pri" id="mk">새 리그 만들기</button><p class="hint">새 리그를 만들면 이 브라우저에서 임의의 코드가 생성됩니다. 만들어진 주소를 친구들에게 공유하세요.</p></div>`;
    document.getElementById('mk').onclick = () => {
      const a = crypto.getRandomValues(new Uint8Array(15));
      location.search = '?k=' + [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    };
    return;
  }
  S.key = key || 'local';
  let up = false;
  try {
    S.store = await createStore(S.key, (c, err) => { if (c === 'error') toast('DB 연결 오류: ' + (err?.code || err)); else if (up) refresh(true); });
    await S.store.ready;
  } catch (e) { main.innerHTML = `<div class="panel landing"><h1>연결 실패</h1><p>${esc(e.message || e)}</p><p class="hint">js/config.js 의 Firebase 설정과 Firestore 규칙을 확인하세요.</p></div>`; return; }
  up = true; initShell(); loadChamps();
})();
