// 오늘의 내전: 라인업 보드(점수·예상승률·해설) + 경기 결과 입력/수정
import { S, page, act, esc, uid, pname, go, refresh, fmtDT, champIcon, toast, pickChamp, pickPlayer, history, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import { evalLineup, commentary, bestDuo } from './stats.js';
import { seriesUsed, matchCard } from './app.js';

const five = () => ['', '', '', '', ''];
const blank = () => ({ blue: five(), red: five(), winner: '', champs: { blue: five(), red: five() }, bans: { blue: five(), red: five() }, kda: {}, newSeries: false, at: '', more: false });
const dkey = () => 'naejeon:draft:' + S.key;
let draft = null, edit = null, lastSaved = null;
function D() {
  if (S.arg[0] === 'edit') {
    const m = S.store.data.matches[S.arg[1]];
    if (m && edit?.id !== m.id) edit = { ...blank(), ...JSON.parse(JSON.stringify(m)), champs: { blue: five(), red: five(), ...m.champs }, bans: { blue: five(), red: five(), ...m.bans }, kda: Object.fromEntries(Object.entries(m.kda || {}).map(([k, v]) => [k, v.join('/')])), at: toLocal(m.at), more: true };
    if (m) return edit;
  }
  edit = null;
  if (!draft) { try { draft = { ...blank(), ...JSON.parse(localStorage.getItem(dkey())) }; } catch { draft = blank(); } }
  return draft;
}
const keep = () => { if (!edit) localStorage.setItem(dkey(), JSON.stringify(draft)); refresh(); };
const toLocal = (at) => { const d = new Date(at - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
export function setDraftTeams(blue, red) {
  D(); draft = { ...blank(), blue: [...blue, ...five()].slice(0, 5), red: [...red, ...five()].slice(0, 5) };
  localStorage.setItem(dkey(), JSON.stringify(draft));
}
const sameRoster = (m, d) => { const k = (a) => [...a].sort().join(); const a = k(m.blue), b = k(m.red), x = k(d.blue), y = k(d.red); return (a === x && b === y) || (a === y && b === x); };
function seriesFor(d) {
  if (edit) return edit.seriesId || edit.id;
  const last = S.st.matches[S.st.matches.length - 1];
  const at = d.at ? new Date(d.at).getTime() : Date.now();
  if (!d.newSeries && last && d.blue.every(Boolean) && d.red.every(Boolean) && sameRoster(last, d) && Math.abs(at - last.at) < 8 * 3600e3) return last.seriesId || last.id;
  return null;
}

page('today', {
  render() {
    const d = D(), st = S.st, ev = evalLineup(d.blue, d.red, st);
    const sid = seriesFor(d), sr = sid && st.series.find((s) => s.id === sid);
    const pb = Math.round(ev.pBlue * 100);
    const slot = (side, i) => {
      const id = d[side][i], l = LANES[i];
      return `<button class="slot ${side} ${id ? '' : 'emp'}" data-a="tSlot" data-s="${side}" data-i="${i}">${id ? `<b>${pname(id)}</b><small>${(+st.P[id]?.p.scores?.[l] || 0).toFixed(1)}</small>` : '<span>선수 선택</span>'}</button>`;
    };
    const champ = (side, i) => `<button class="cbtn" data-a="tChamp" data-s="${side}" data-i="${i}" title="챔피언 선택">${d.champs[side][i] ? champIcon(d.champs[side][i]) : '<span class="ci plus">＋</span>'}</button>`;
    const duo = (side) => { const b = bestDuo(d[side], st); return b ? `${side === 'blue' ? '🔵' : '🔴'} ${pname(b.a)} + ${pname(b.b)} · ${pct(b.w, b.g)}% (${b.g}판)` : `${side === 'blue' ? '🔵' : '🔴'} 아직 함께한 기록이 적어요`; };
    return `<div class="h2row"><h1>${edit ? `✏️ 경기 수정 #${st.MI[edit.id]?.no ?? ''}` : '⚔️ 오늘의 내전'}</h1><span class="grow"></span>
      ${edit ? '<a class="btn" href="#/matches">취소</a>' : '<button class="btn xs" data-a="tSwap">🔀 진영 바꾸기</button><button class="btn xs ghost" data-a="tClear">비우기</button>'}</div>
    <div class="panel talk">${esc(commentary(ev, st))}</div>
    <div class="panel board">
      <div class="brow head"><span></span><span class="blue">🔵 블루</span><span>격차</span><span class="red">🔴 레드</span><span></span></div>
      ${ev.lanes.map((x, i) => { const g = x.bs - x.rs; return `<div class="brow">${champ('blue', i)}${slot('blue', i)}
        <span class="gap"><i>${LANE_ICON[x.lane]}</i><small class="${g > 0 ? 'blue' : g < 0 ? 'red' : ''}">${x.b && x.r ? (g === 0 ? '0' : (g > 0 ? '블 +' : '레 +') + Math.abs(g).toFixed(1)) : LANE_NAME[x.lane]}</small></span>
        ${slot('red', i)}${champ('red', i)}</div>`; }).join('')}
      <div class="brow sum"><span></span><b class="blue">${ev.bs.toFixed(1)}</b><span class="gap"><small>합계</small></span><b class="red">${ev.rs.toFixed(1)}</b><span></span></div>
      <div class="prob"><div class="pb" style="width:${pb}%">블루 ${pb}%</div><div class="pr">${100 - pb}% 레드</div></div>
      <div class="sub"><span>⚖️ 평균 MMR ${ev.mmrB ? Math.round(ev.mmrB) : '-'} vs ${ev.mmrR ? Math.round(ev.mmrR) : '-'}</span><span>🔥 시너지 ${duo('blue')} <b>VS</b> ${duo('red')}</span></div>
    </div>
    <p class="hint">자리를 눌러 선수를 고르세요. 이미 배치된 선수를 고르면 두 자리가 서로 바뀝니다. ＋는 챔피언(선택)입니다.</p>

    <h2>🏆 경기 결과 기록</h2>
    <div class="panel">
      <div class="sub">${edit ? '' : sr ? `<span class="tag ok">시리즈 ${sr.ms.length + 1}번째 판</span><span>피어리스: 이 시리즈에서 쓴 챔피언 ${Object.keys(seriesUsed(sid)).length}개 잠김</span><label class="mini"><input type="checkbox" data-c="tNew" ${d.newSeries ? 'checked' : ''}> 새 시리즈로 시작</label>` : '<span class="tag">새 시리즈 1번째 판</span><span class="mut">같은 두 팀으로 이어서 기록하면 자동으로 한 시리즈로 묶입니다.</span>'}</div>
      <div class="winrow"><button class="wbtn blue ${d.winner === 'blue' ? 'on' : ''}" data-a="tWin" data-w="blue">🔵 블루 승리</button><button class="wbtn red ${d.winner === 'red' ? 'on' : ''}" data-a="tWin" data-w="red">🔴 레드 승리</button></div>
      <button class="btn block ghost" data-a="tMore">${d.more ? '▲ 밴·KDA·시간 접기' : '▼ 밴 · KDA · 경기 시간 입력 (선택)'}</button>
      ${d.more ? `<div class="more">
        ${['blue', 'red'].map((s) => `<div class="banrow"><small>${s === 'blue' ? '🔵 밴' : '🔴 밴'}</small>${d.bans[s].map((b, i) => `<button class="cbtn" data-a="tBan" data-s="${s}" data-i="${i}">${b ? champIcon(b) : '<span class="ci plus">＋</span>'}</button>`).join('')}</div>`).join('')}
        <div class="kda">${['blue', 'red'].map((s) => `<div>${d[s].map((id, i) => (id ? `<label><span>${LANE_ICON[LANES[i]]} ${pname(id)}</span><input class="inp xs2" id="kda-${id}" inputmode="numeric" placeholder="K/D/A" value="${esc(d.kda[id] || '')}" data-c="tKda" data-id="${id}"></label>` : '')).join('')}</div>`).join('')}</div>
        <label class="mini">경기 시간 <input class="inp" type="datetime-local" value="${esc(d.at)}" data-c="tAt"> <span class="mut">비우면 지금 시각</span></label>
      </div>` : ''}
      <button class="btn pri block big" data-a="tSave">${edit ? '수정 내용 저장' : '경기 결과 저장'}</button>
    </div>
    ${lastSaved && !edit && S.st.MI[lastSaved] ?`<h2>방금 기록한 경기</h2>${matchCard(S.store.data.matches[lastSaved])}` : ''}`;
  },
});

act('tSlot', (d) => {
  const dr = D(), i = +d.i;
  pickPlayer({
    title: `${d.s === 'blue' ? '🔵 블루' : '🔴 레드'} ${LANE_NAME[LANES[i]]}`, lane: LANES[i], allowClear: !!dr[d.s][i],
    onPick(id) {
      if (id) for (const s of ['blue', 'red']) { const j = dr[s].indexOf(id); if (j >= 0) dr[s][j] = dr[d.s][i]; }
      dr[d.s][i] = id; keep();
    },
  });
});
function usedNow(dr, skip) {
  const used = seriesUsed(seriesFor(dr), edit?.id);
  ['blue', 'red'].forEach((s) => {
    dr.champs[s].forEach((c, i) => { if (c && skip !== `c${s}${i}`) used[c] = '이번 판에서 선택됨'; });
    dr.bans[s].forEach((c, i) => { if (c && skip !== `b${s}${i}`) used[c] = '이번 판 밴'; });
  });
  return used;
}
act('tChamp', (d) => {
  const dr = D(), i = +d.i, id = dr[d.s][i];
  pickChamp({ title: `${id ? pname(id) : LANE_NAME[LANES[i]]} 챔피언`, used: usedNow(dr, `c${d.s}${i}`), current: dr.champs[d.s][i], onPick(n) { dr.champs[d.s][i] = n; keep(); } });
});
act('tBan', (d) => {
  const dr = D(), i = +d.i;
  pickChamp({ title: `${d.s === 'blue' ? '블루' : '레드'} 밴 ${i + 1}`, used: usedNow(dr, `b${d.s}${i}`), current: dr.bans[d.s][i], onPick(n) { dr.bans[d.s][i] = n; keep(); } });
});
act('tWin', (d) => { const dr = D(); dr.winner = dr.winner === d.w ? '' : d.w; keep(); });
act('tMore', () => { D().more = !D().more; keep(); });
act('tNew', (d, el) => { D().newSeries = el.checked; keep(); });
act('tAt', (d, el) => { D().at = el.value; keep(); });
act('tKda', (d, el) => { D().kda[d.id] = el.value.trim(); if (!edit) localStorage.setItem(dkey(), JSON.stringify(draft)); });
act('tSwap', () => { const dr = D(); [dr.blue, dr.red] = [dr.red, dr.blue]; [dr.champs.blue, dr.champs.red] = [dr.champs.red, dr.champs.blue]; [dr.bans.blue, dr.bans.red] = [dr.bans.red, dr.bans.blue]; if (dr.winner) dr.winner = dr.winner === 'blue' ? 'red' : 'blue'; keep(); });
act('tClear', () => { if (confirm('라인업과 입력 내용을 모두 비울까요?')) { draft = blank(); keep(); } });
act('tSave', async (d, btn) => {
  const dr = D(), all = [...dr.blue, ...dr.red];
  if (!all.every(Boolean) || new Set(all).size !== 10) return toast('양 팀 10명을 모두 배치해 주세요');
  if (!dr.winner) return toast('승리팀을 선택해 주세요');
  const kda = {};
  for (const id of all) {
    const v = (dr.kda[id] || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    if (v.length === 3) kda[id] = v; else if (v.length) return toast(`${S.st.P[id].name} KDA는 3/2/10 형식으로 입력해 주세요`);
  }
  const ev = evalLineup(dr.blue, dr.red, S.st), old = edit && S.store.data.matches[edit.id];
  const sameLine = old && old.blue.join() === dr.blue.join() && old.red.join() === dr.red.join();
  const at = dr.at ? new Date(dr.at).getTime() : Date.now(), id = old?.id || uid();
  const m = {
    id, at, seq: old?.seq || 0, seriesId: seriesFor(dr) || id, blue: [...dr.blue], red: [...dr.red], winner: dr.winner,
    champs: { blue: [...dr.champs.blue], red: [...dr.champs.red] }, bans: { blue: dr.bans.blue.filter(Boolean), red: dr.bans.red.filter(Boolean) }, kda,
    snap: sameLine && old.snap ? old.snap : { bs: ev.bs, rs: ev.rs, pBlue: +ev.pBlue.toFixed(4) },
  };
  btn.disabled = true;
  try {
    if (old) await history('match-edit', old);
    await S.store.put('matches', id, m);
  } catch (e) { btn.disabled = false; return toast('저장 실패: ' + (e.code || e.message)); }
  toast(old ? '수정했습니다' : `저장했습니다 · ${dr.winner === 'blue' ? '블루' : '레드'} 승리`);
  if (old) { edit = null; return go('#/matches'); }
  lastSaved = id;
  draft = { ...blank(), blue: dr.blue, red: dr.red }; // 같은 팀으로 다음 판을 바로 기록할 수 있게 라인업은 유지
  keep(); window.scrollTo(0, 0);
});
