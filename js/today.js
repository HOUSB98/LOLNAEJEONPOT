// 오늘의 내전: 라인업 보드(점수·예상승률·해설) + 경기 결과 입력/수정
import { S, page, act, esc, uid, pname, go, refresh, champIcon, artUrl, toast, pickChamp, pickPlayer, history, ic, dots, burst, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import { evalLineup, commentary, bestDuo } from './stats.js';
import { seriesUsed, matchCard } from './app.js';
import { sysChat, nick } from './social.js';
import { mascot, reveal } from './reveal.js';

const five = () => ['', '', '', '', ''];
const blank = () => ({ blue: five(), red: five(), winner: '', champs: { blue: five(), red: five() }, bans: { blue: five(), red: five() }, kda: {}, newSeries: false, at: '', more: false });
const remoteDraft = () => S.store?.data?.meta?.todayDraft || null;
let draftUpdatedAt = 0;
let draftBase = null;

function draftState(d) {
  return JSON.stringify({
    blue: d.blue, red: d.red, winner: d.winner || '',
    champs: d.champs, bans: d.bans, kda: d.kda || {},
    newSeries: !!d.newSeries, at: d.at || '', more: !!d.more
  });
}

const cloneDraft = (d) => JSON.parse(JSON.stringify(d));

function mergeDraftChanges(base, local, remote) {
  const next = cloneDraft(remote || blank());
  const arr = (key, side) => {
    const b = base?.[key]?.[side] || five();
    const l = local?.[key]?.[side] || five();
    const r = remote?.[key]?.[side] || five();
    next[key] ||= {};
    next[key][side] = r.map((v, i) => (l[i] !== b[i] ? l[i] : v));
  };
  ['blue', 'red'].forEach((side) => {
    const b = base?.[side] || five(), l = local?.[side] || five(), r = remote?.[side] || five();
    next[side] = r.map((v, i) => (l[i] !== b[i] ? l[i] : v));
    arr('champs', side);
    arr('bans', side);
  });

  const scalars = ['winner', 'newSeries', 'at', 'more'];
  scalars.forEach((k) => {
    const b = base?.[k], l = local?.[k], r = remote?.[k];
    if (l !== b) next[k] = l;
    else next[k] = r;
  });

  next.kda = { ...(remote?.kda || {}) };
  const keys = new Set([...Object.keys(base?.kda || {}), ...Object.keys(local?.kda || {}), ...Object.keys(remote?.kda || {})]);
  keys.forEach((k) => {
    if ((local?.kda || {})[k] !== (base?.kda || {})[k]) next.kda[k] = (local?.kda || {})[k] || '';
  });
  next.updatedAt = Date.now();
  return next;
}

// 라인업 초안 동기화(meta/todayDraft). 연속 입력은 한 번으로 묶고(120ms), 전송은 한 번에 하나만 보낸다.
// 보내는 동안 또 바뀌면 끝난 뒤 최신 상태로 한 번 더 보낸다. 다른 사람의 변경과는 칸 단위로 합친다(mergeDraftChanges).
let syncTimer = 0, syncBusy = false, syncAgain = false, appliedAt = -1;
function syncDraft() {
  if (edit || S.store?.mode !== 'firebase' || !draft) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(pushDraft, 120);
}
async function pushDraft() {
  syncTimer = 0;
  if (syncBusy) { syncAgain = true; return; }
  if (edit || !draft) return;
  syncBusy = true;
  const local = cloneDraft(draft), base = cloneDraft(draftBase || remoteDraft() || blank());
  try {
    const merged = await S.store.tx('meta', 'todayDraft', (remote) => mergeDraftChanges(base, local, remote || blank()));
    if (merged) {
      const changedMeanwhile = draftState(draft) !== draftState(local); // 전송 중에 내가 또 고쳤으면 그 내용은 다음 전송에서 합친다
      draftBase = cloneDraft(merged); appliedAt = Number(merged.updatedAt) || 0;
      if (!changedMeanwhile) {
        const same = draftState(merged) === draftState(draft);
        draft = merged; draftUpdatedAt = appliedAt || Date.now();
        localStorage.setItem(dkey(), JSON.stringify(draft));
        if (!same) refresh();
      } else syncAgain = true;
    }
  } catch (e) {
    toast('팀 동기화 실패: ' + (e.code || e.message));
  }
  syncBusy = false;
  if (syncAgain) { syncAgain = false; pushDraft(); }
}

function applyRemoteDraft() {
  if (edit || S.store?.mode !== 'firebase') return;
  const r = remoteDraft();
  if (!r) return;
  const at = Number(r.updatedAt) || 0;
  if (draft && at === appliedAt) return; // 이미 반영한 버전: 화면을 그릴 때마다 다시 비교하지 않는다
  if (syncBusy) return; // 내 변경을 보내는 중이면 응답에서 합쳐진다
  appliedAt = at;
  const pad = (a) => [...(a || []), '', '', '', '', ''].slice(0, 5);
  const remote = {
    ...blank(), ...r, blue: pad(r.blue), red: pad(r.red),
    champs: { blue: pad(r.champs?.blue), red: pad(r.champs?.red) }, bans: { blue: pad(r.bans?.blue), red: pad(r.bans?.red) }, kda: { ...(r.kda || {}) },
  };
  if (!draft || draftState(remote) !== draftState(draft)) {
    // 아직 보내지 않은 내 변경이 있으면 원격 내용 위에 내 변경을 얹는다
    draft = draft && draftBase && syncTimer && draftState(draft) !== draftState(draftBase) ? mergeDraftChanges(draftBase, draft, remote) : remote;
    draftUpdatedAt = at || Date.now();
    localStorage.setItem(dkey(), JSON.stringify(draft));
  }
  draftBase = cloneDraft(remote);
}
const dkey = () => 'naejeon:draft:' + S.key;
let draft = null, edit = null, lastSaved = null;
// 팀 확정 질문: 10명이 다 찬 "그 라인업"에 대해 한 번만 묻는다. 한 명이라도 바뀌면 다시 묻는다.
const TQ = { shown: '', no: '', done: '' };
const lineKey = (d) => d.blue.join() + '|' + d.red.join();
const isFull = (d) => { const all = [...d.blue, ...d.red]; return all.every(Boolean) && new Set(all).size === 10; };
function D() {
  if (S.page === 'today' && S.arg[0] === 'edit') {
    const m = S.store.data.matches[S.arg[1]];
    if (m && edit?.id !== m.id) edit = { ...blank(), ...JSON.parse(JSON.stringify(m)), champs: { blue: five(), red: five(), ...m.champs }, bans: { blue: [...(m.bans?.blue || []), ...five()].slice(0, 5), red: [...(m.bans?.red || []), ...five()].slice(0, 5) }, kda: Object.fromEntries(Object.entries(m.kda || {}).map(([k, v]) => [k, v.join('/')])), at: toLocal(m.at), more: true };
    if (m) return edit;
  }
  edit = null;
  if (!draft) {
    try {
      const local = JSON.parse(localStorage.getItem(dkey()));
      draft = { ...blank(), ...(local || {}) };
      draftUpdatedAt = Number(local?.updatedAt) || 0;
    } catch {
      draft = blank();
      draftUpdatedAt = 0;
    }
  }
  applyRemoteDraft();
  return draft;
}
const keep = () => {
  if (!edit) {
    draftUpdatedAt = Date.now();
    draft.updatedAt = draftUpdatedAt;
    localStorage.setItem(dkey(), JSON.stringify(draft));
    syncDraft();
  }
  refresh();
};
const toLocal = (at) => { const d = new Date(at - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
export function setDraftTeams(blue, red) {
  D(); draft = { ...blank(), blue: [...blue, ...five()].slice(0, 5), red: [...red, ...five()].slice(0, 5) };
  draftUpdatedAt = Date.now(); draft.updatedAt = draftUpdatedAt;
  localStorage.setItem(dkey(), JSON.stringify(draft)); syncDraft();
}
// 리플레이 분석 결과를 입력 화면에 채운다(저장은 사용자가 확인 후 직접)
export function importDraft(x) {
  D(); draft = { ...blank(), ...x, more: true };
  localStorage.setItem(dkey(), JSON.stringify(draft));
}
// 주사위 결과 반영: 해당 라인의 블루/레드 자리에 두 사람을 넣는다
export function assignLane(i, blueId, redId) {
  const d = D();
  for (const s of ['blue', 'red']) d[s] = d[s].map((id) => (id === blueId || id === redId ? '' : id));
  d.blue[i] = blueId; d.red[i] = redId; keep();
}
export const placedIds = () => { const d = D(); return [...d.blue, ...d.red].filter(Boolean); };
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
    const any = d.blue.some(Boolean) || d.red.some(Boolean), pb = any ? Math.round(ev.pBlue * 100) : 50;
    const filled = [...d.blue, ...d.red].filter(Boolean).length;
    const full = isFull(d), key = lineKey(d), ask = full && !edit && TQ.no !== key && TQ.done !== key;
    const slot = (side, i) => {
      const id = d[side][i], l = LANES[i], s = st.P[id];
      const ch = d.champs[side][i], art = ch && artUrl(ch) ? ` art" style="--img:url('${artUrl(ch)}')` : '';
      const champ = `<button class="sl-champ" data-a="tChamp" data-s="${side}" data-i="${i}" title="챔피언 선택 (선택 사항)">${ch ? champIcon(ch) : `<span class="ci plus">${ic('plus')}</span>`}</button>`;
      if (!s) return `<div class="slot ${side} emp${art}">${champ}<button class="sl-body" data-a="tSlot" data-s="${side}" data-i="${i}"><span>${ic('plus')}${LANE_NAME[l]} 선수 선택</span></button></div>`;
      const ln = s.lanes[l], off = s.mainLane !== l;
      return `<div class="slot ${side}${art}">${champ}<button class="sl-body" data-a="tSlot" data-s="${side}" data-i="${i}">
        <span class="sl-top"><b>${esc(s.name)}</b>${off ? `<i class="off" title="주라인은 ${LANE_NAME[s.mainLane]}">${LANE_ICON[s.mainLane]}오프</i>` : '<i class="main">주라인</i>'}</span>
        <span class="sl-meta"><span>${LANE_NAME[l]} ${ln.g ? `${pct(ln.w, ln.g)}% · ${ln.g}판` : '기록 없음'}</span><span class="mono">MMR ${Math.round(s.mmr)}</span>${dots(s.recent)}</span>
      </button><span class="sl-score mono">${(+s.p.scores?.[l] || 0).toFixed(1)}</span></div>`;
    };
    const duo = (side) => { const b = bestDuo(d[side], st); return b ? `<span class="${side}">${pname(b.a)} + ${pname(b.b)} <b class="mono">${pct(b.w, b.g)}%</b> <small>${b.g}판</small></span>` : `<span class="mut">${side === 'blue' ? '블루' : '레드'} — 함께한 기록 부족</span>`; };
    return `<div class="h2row"><h1>${ic('today')}${edit ? `경기 수정 <span class="mono">#${st.MI[edit.id]?.no ?? ''}</span>` : '오늘의 내전'}</h1><span class="tag ${full ? 'ok' : ''}">${filled}/10 배치</span>${full && !edit ? `<button class="btn xs gold" data-a="tqYes">${ic('bolt')}승률 공개</button>` : ''}<span class="grow"></span>
      ${edit ? '<a class="btn" href="#/matches">취소</a>' : `<button class="btn gold" data-a="tDice">${ic('dice')}라인 주사위</button><button class="btn" data-a="tSwap">${ic('swap')}진영 교체</button><button class="btn ghost" data-a="tClear">비우기</button>`}</div>
    <section class="arena">
      <div class="scorebar"><div class="sb blue"><small>BLUE TEAM</small><b class="mono">${ev.bs.toFixed(1)}</b><span>평균 MMR ${ev.mmrB ? Math.round(ev.mmrB) : '—'}</span></div>
        <div class="sb-mid"><div class="ring" style="--p:${pb}"><b class="mono">${pb}<small>%</small></b><span>블루 예상 승률</span></div></div>
        <div class="sb red"><small>RED TEAM</small><b class="mono">${ev.rs.toFixed(1)}</b><span>평균 MMR ${ev.mmrR ? Math.round(ev.mmrR) : '—'}</span></div></div>
      <div class="prob"><i style="width:${pb}%"></i></div>
      ${ev.lanes.map((x, i) => { const g = x.bs - x.rs, both = x.b && x.r; return `<div class="lrow" style="--d:${i}">${slot('blue', i)}
        <div class="lmid">${LANE_ICON[x.lane]}<small class="${both ? (g > 0 ? 'blue' : g < 0 ? 'red' : '') : ''} mono">${both ? (g === 0 ? 'EVEN' : (g > 0 ? '◀ ' : '') + Math.abs(g).toFixed(1) + (g < 0 ? ' ▶' : '')) : LANE_NAME[x.lane]}</small></div>
        ${slot('red', i)}</div>`; }).join('')}
      <div class="talk">${ic('mega')}<p>${esc(commentary(ev, st).replace('🎙️ ', ''))}</p></div>
      <div class="syn"><small>SYNERGY</small>${duo('blue')}<i>VS</i>${duo('red')}</div>
    </section>

    <div class="sec-h"><h2>${ic('rank')}경기 결과 기록</h2>${edit ? '' : sr ? `<span class="tag ok">시리즈 ${sr.ms.length + 1}번째 판</span><span class="mut sm">피어리스: 사용된 챔피언 ${Object.keys(seriesUsed(sid)).length}개 잠김</span><label class="mini"><input type="checkbox" data-c="tNew" ${d.newSeries ? 'checked' : ''}> 새 시리즈로 시작</label>` : '<span class="tag">새 시리즈 1번째 판</span>'}</div>
    <div class="panel">
      <div class="winrow"><button class="wbtn blue ${d.winner === 'blue' ? 'on' : ''}" data-a="tWin" data-w="blue"><small>BLUE</small>블루 승리</button><button class="wbtn red ${d.winner === 'red' ? 'on' : ''}" data-a="tWin" data-w="red"><small>RED</small>레드 승리</button></div>
      <button class="btn block ghost" data-a="tMore">${d.more ? '밴 · KDA · 시간 접기' : '밴 · KDA · 경기 시간 입력 (선택)'}</button>
      ${d.more ? `<div class="more">
        ${['blue', 'red'].map((s) => `<div class="banrow"><small>${s === 'blue' ? 'BLUE BAN' : 'RED BAN'}</small>${d.bans[s].map((b, i) => `<button class="sl-champ" data-a="tBan" data-s="${s}" data-i="${i}">${b ? champIcon(b) : `<span class="ci plus">${ic('plus')}</span>`}</button>`).join('')}</div>`).join('')}
        <div class="kda">${['blue', 'red'].map((s) => `<div>${d[s].map((id, i) => (id ? `<label><span>${LANE_ICON[LANES[i]]} ${pname(id)}</span><input class="inp xs2 mono" id="kda-${id}" inputmode="numeric" placeholder="K/D/A" value="${esc(d.kda[id] || '')}" data-c="tKda" data-id="${id}"></label>` : '')).join('')}</div>`).join('')}</div>
        <label class="mini">경기 시간 <input class="inp" type="datetime-local" value="${esc(d.at)}" data-c="tAt"> <span class="mut">비우면 지금 시각</span></label>
      </div>` : ''}
      <button class="btn pri block big" data-a="tSave">${edit ? '수정 내용 저장' : '경기 결과 저장'}</button>
    </div>
    ${lastSaved && !edit && S.st.MI[lastSaved] ? `<div class="sec-h"><h2>방금 기록한 경기</h2></div>${matchCard(S.store.data.matches[lastSaved])}` : ''}
    ${ask ? `<div class="ask ${TQ.shown === key ? '' : 'in'}" role="dialog" aria-label="팀 확정 확인">${mascot()}<div class="ask-b"><b>팀을 정하셨나요?</b><span>다 정했으면 예상 승률을 공개할게요!</span><div class="row"><button class="btn pri" data-a="tqYes">정했어!</button><button class="btn ghost" data-a="tqNo">아직이야</button></div></div></div>` : ''}`;
  },
  after() { const d = D(); TQ.shown = isFull(d) && !edit ? lineKey(d) : ''; }, // 같은 라인업으로 화면만 다시 그릴 때는 등장 모션을 반복하지 않는다
});

act('tSlot', (d) => {
  const dr = D(), i = +d.i;
  pickPlayer({
    title: `${d.s === 'blue' ? '블루' : '레드'} ${LANE_NAME[LANES[i]]}`, lane: LANES[i], allowClear: !!dr[d.s][i],
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
  pickChamp({ title: `${id ? S.st.P[id]?.name : LANE_NAME[LANES[i]]} 챔피언`, used: usedNow(dr, `c${d.s}${i}`), current: dr.champs[d.s][i], onPick(n) { dr.champs[d.s][i] = n; keep(); } });
});
act('tBan', (d) => {
  const dr = D(), i = +d.i;
  pickChamp({ title: `${d.s === 'blue' ? '블루' : '레드'} 밴 ${i + 1}`, used: usedNow(dr, `b${d.s}${i}`), current: dr.bans[d.s][i], onPick(n) { dr.bans[d.s][i] = n; keep(); } });
});
act('tWin', (d) => { const dr = D(); dr.winner = dr.winner === d.w ? '' : d.w; keep(); });
act('tMore', () => { D().more = !D().more; keep(); });
act('tNew', (d, el) => { D().newSeries = el.checked; keep(); });
act('tAt', (d, el) => { D().at = el.value; keep(); });
act('tKda', (d, el) => {
  D().kda[d.id] = el.value.trim();
  if (!edit) keep();
});
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
    ...(dr.stats || old?.stats ? { stats: dr.stats || old.stats } : {}), ...(dr.dur || old?.dur ? { dur: dr.dur || old.dur } : {}), // 리플레이에서 읽은 상세 기록
  };
  btn.disabled = true;
  try {
    if (old) await history('match-edit', old);
    await S.store.put('matches', id, m);
  } catch (e) { btn.disabled = false; return toast('저장 실패: ' + (e.code || e.message)); }
  toast(old ? '수정했습니다' : `저장했습니다 · ${dr.winner === 'blue' ? '블루' : '레드'} 승리`);
  if (old) { edit = null; return go('#/matches'); }
  burst(innerWidth / 2, innerHeight / 3);
  sysChat(`경기 기록 · ${dr.winner === 'blue' ? '블루' : '레드'} 승리 (${m[dr.winner].map((p) => S.st.P[p]?.name).join(', ')})`);
  lastSaved = id;
  draft = { ...blank(), blue: dr.blue, red: dr.red }; // 같은 팀으로 다음 판을 바로 기록할 수 있게 라인업은 유지
  keep(); window.scrollTo(0, 0); document.getElementById('main').scrollTop = 0;
});

// ---------- 팀 확정 → 예상 승률 공개 ----------
// 누군가 "정했어!"를 누르면 meta/reveal 문서에 적고, 접속한 모든 사람의 화면에서 같은 연출이 재생된다(주사위와 같은 방식).
// 누군가 "정했어!"를 누르면 reveals 컬렉션에 이벤트 문서를 하나 만들고, 접속한 모든 사람의 화면에서 같은 연출이 재생된다.
// 시작 시각(startAt)은 서버 시각 기준이라 각자 시계가 달라도 같은 순간에 맞춰진다.
const rvSeen = new Set();
let rvWatch = false;
const playReveal = (d, mine = false) => {
  try {
    reveal({
      pb: Number(d.pb) || 50, blue: Array.isArray(d.blue) ? d.blue : [], red: Array.isArray(d.red) ? d.red : [], by: mine ? '' : (d.by || ''),
      startAt: Number(d.startAt) || Number(d.at) || Date.now(), now: S.store.serverNow(),
      from: S.page === 'today' ? document.querySelector('.arena .ring') : null,
    });
  } catch (e) { console.error('[reveal]', e); }
};
export function watchReveal() {
  if (rvWatch || !S.store?.watchCollection) return;
  rvWatch = true;
  let primed = false;
  S.store.watchCollection('reveals', (snap) => {
    const changes = typeof snap?.docChanges === 'function' ? snap.docChanges() : snap.changes();
    const docs = changes.filter((c) => c.type === 'added').map((c) => (c.doc?.data ? { ...c.doc.data(), id: c.doc.id } : c.doc)).filter((d) => d?.id);
    // 첫 응답은 이미 지나간 이벤트 목록이다: 재생하지 않고 "본 것"으로만 표시한다(새로고침 때 다시 나오지 않게)
    if (!primed) { primed = true; docs.forEach((d) => rvSeen.add(d.id)); return; }
    for (const d of docs) {
      if (rvSeen.has(d.id)) continue;
      rvSeen.add(d.id);
      if (S.store.serverNow() - (Number(d.at) || 0) < 20000) playReveal(d, false); // 너무 늦게 도착한 이벤트(오프라인 복귀 등)는 건너뛴다
    }
  }, (err) => console.error('[reveal] listener', err));
}

act('tqNo', () => { TQ.no = lineKey(D()); refresh(); });
act('tqYes', async () => {
  const d = D(); if (!isFull(d)) return toast('양 팀 10명을 모두 배치해 주세요');
  const nm = (ids) => ids.map((id) => S.st.P[id]?.name || '?');
  try {
    await S.store.syncServerClock?.();
    const now = S.store.serverNow();
    const r = { id: uid(), at: now, startAt: now + 1800, pb: Math.round(evalLineup(d.blue, d.red, S.st).pBlue * 100), blue: nm(d.blue), red: nm(d.red), by: nick() || '익명' };
    TQ.done = lineKey(d);
    rvSeen.add(r.id); // 내 화면은 응답을 기다리지 않고 바로 재생하고, 내 이벤트가 돌아와도 두 번 재생하지 않는다
    playReveal(r, true);
    refresh();
    await S.store.put('reveals', r.id, r);
    sysChat('팀 확정 · 예상 승률 블루 ' + r.pb + '% : 레드 ' + (100 - r.pb) + '%');
  } catch (e) { toast('중계 전송 실패: ' + (e.code || e.message)); }
});
