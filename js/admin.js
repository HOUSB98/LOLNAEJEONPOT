// 관리: 내보내기/백업, 선수 관리, 시트 데이터 가져오기, 설정, 삭제 복구, 칭호 도감
import { S, page, act, esc, uid, col, settings, pname, refresh, fmtDT, toast, download, csv, modal, closeModal, needAdmin, isAdmin, history, ic, LANES, LANE_NAME, LANE_ICON } from './core.js';
import { TITLES, DEFAULTS, initMmr } from './stats.js';
import { exportMatches } from './app.js';

page('admin', {
  render() {
    const st = S.st, cfg = { ...DEFAULTS, ...settings() };
    const del = col('matches').filter((m) => m.deleted).sort((a, b) => b.at - a.at);
    const gone = col('players').filter((p) => p.deleted), adm = isAdmin();
    return `<h1>⚙️ 관리</h1>
    <div class="panel"><div class="ph"><b>💾 내보내기 · 백업</b></div>
      <div class="row wrapr"><button class="btn" data-a="exportCsv">⬇ 경기 기록 CSV</button><button class="btn" data-a="exportPlayers">⬇ 선수 CSV</button><button class="btn" data-a="backup">⬇ 전체 백업 (JSON)</button><button class="btn ghost" data-a="restore">⬆ 백업 복원</button></div>
      <p class="hint">${S.store.mode === 'local' ? '⚠️ 지금은 체험 모드라 데이터가 이 브라우저에만 저장됩니다. Firebase를 연결하면 친구들과 실시간으로 공유됩니다(README 참고).' : '데이터는 Firebase에 저장됩니다. Firestore 무료 요금제는 오래 안 써도 일시정지되지 않지만, 가끔 전체 백업을 내려받아 두세요.'}</p></div>

    <div class="panel"><div class="ph"><b>🧑‍🤝‍🧑 선수 관리</b><span class="tag">${st.list.length}명</span><span class="grow"></span><button class="btn pri xs" data-a="plEdit" data-id="">＋ 선수 추가</button></div>
      <div class="lockbar ${adm ? 'open' : ''}">${adm ? `${ic('shield')}<b>관리자 모드</b><span>점수와 주라인을 칸에서 바로 고치면 즉시 저장됩니다. 이 창을 닫기 전까지 유지됩니다.</span><button class="btn xs" data-a="admLock">잠그기</button>` : `${ic('shield')}<b>잠겨 있음</b><span>관리자 PIN을 한 번 입력하면 모든 선수의 점수를 바로 수정할 수 있습니다.</span><button class="btn gold xs" data-a="admUnlock">관리자 PIN 입력</button>`}</div>
      <div class="tw"><table class="tbl edit ${adm ? '' : 'locked'}"><thead><tr><th class="l">이름</th>${LANES.map((l) => `<th>${LANE_ICON[l]}${LANE_NAME[l]}</th>`).join('')}<th>평균</th><th>주라인</th><th class="l">솔랭 티어</th><th>시작 MMR</th><th></th></tr></thead>
      <tbody>${st.list.map((s) => `<tr><td class="l nm">${esc(s.name)}</td>${LANES.map((l) => `<td><input id="sc-${s.id}-${l}" class="inp cell mono" type="number" min="0" max="20" step="0.5" value="${s.p.scores?.[l] ?? 0}" data-c="plScore" data-id="${s.id}" data-l="${l}" ${adm ? '' : 'disabled'}></td>`).join('')}<td class="num mono">${s.avg.toFixed(1)}</td><td><select class="inp cell" data-c="plMain" data-id="${s.id}" ${adm ? '' : 'disabled'}>${LANES.map((l) => `<option value="${l}" ${s.mainLane === l ? 'selected' : ''}>${LANE_NAME[l]}</option>`).join('')}</select></td><td class="l">${esc(s.p.soloTier || '-')}</td><td class="num mono">${s.mmrInit}</td><td><button class="btn xs" data-a="plEdit" data-id="${s.id}">상세</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">선수가 없습니다.</td></tr>'}</tbody></table></div>
      ${gone.length ? `<p class="sm mut">숨긴 선수: ${gone.map((p) => `${esc(p.name)} <button class="btn xs ghost" data-a="plRestore" data-id="${p.id}">복구</button>`).join(' ')}</p>` : ''}</div>

    <div class="panel"><div class="ph"><b>📥 구글 시트 데이터 가져오기</b></div>
      <p class="sm">기존 "내전 팀짜기" 시트의 선수 27명(라인 점수·솔랭 분석)과 경기 17판(챔피언 포함)을 한 번에 넣습니다. <b>처음 한 번만</b> 실행하세요.</p>
      <button class="btn" data-a="seed">시트 데이터 가져오기</button> ${st.list.length || st.matches.length ? '<span class="tag warn">이미 데이터가 있습니다 — 같은 선수·경기는 덮어씁니다</span>' : ''}</div>

    <div class="panel"><div class="ph"><b>🛠 설정</b></div>
      <form id="cfgf" class="fgrid">
        <label class="fld"><span>리그 이름</span><input class="inp" name="leagueName" value="${esc(cfg.leagueName)}"></label>
        <label class="fld"><span>예상승률 스케일 <small class="mut">(작을수록 점수 차에 민감)</small></span><input class="inp" name="scale" type="number" step="0.5" value="${cfg.scale}"></label>
        <label class="fld"><span>MMR 변동폭 K</span><input class="inp" name="k" type="number" value="${cfg.k}"></label>
        <label class="fld wide"><span>홈 고정 공지 <small class="mut">(첫 줄은 제목, 비우면 표시 안 함)</small></span><textarea class="inp" name="notice" rows="3" placeholder="예: 이번 주 토요일 밤 9시 내전&#10;참가 가능한 사람은 채팅에 남겨 주세요.">${esc(cfg.notice || '')}</textarea></label>
        <label class="fld"><span>&nbsp;</span><button class="btn pri">설정 저장</button></label>
      </form>
      <p class="hint">예상승률 = 1 / (1 + 10^(−점수차/스케일)). 현재 10점 차 = ${Math.round(100 / (1 + Math.pow(10, -10 / cfg.scale)))}%. MMR은 솔랭 티어를 시작값으로 경기마다 Elo 방식으로 변합니다.</p>
      <div class="row wrapr"><button class="btn ghost" data-a="pinChange">🔒 관리자 PIN 변경</button><span class="mut sm">리그 코드: ${esc(S.key)}</span></div></div>

    ${del.length ? `<div class="panel"><div class="ph"><b>🗑 삭제된 경기</b></div>${del.map((m) => `<div class="kv"><span>${fmtDT(m.at)} · ${m.blue.map(pname).join(' ')} vs ${m.red.map(pname).join(' ')}</span><button class="btn xs" data-a="mRestore" data-id="${m.id}">복구</button></div>`).join('')}</div>` : ''}

    <div class="panel"><div class="ph"><b>📜 칭호 도감</b><small class="mut">${TITLES.length}종</small></div>
      <div class="dogam">${TITLES.map((t) => { const own = st.list.filter((s) => s.titles.includes(t)); return `<div><b>${t.e} ${t.n}</b><span>${esc(t.d)}</span><small>${own.length ? own.map((s) => esc(s.name)).join(', ') : '—'}</small></div>`; }).join('')}</div></div>`;
  },
  after() {
    const f = document.getElementById('cfgf');
    if (f) f.onsubmit = (e) => { e.preventDefault(); const d = new FormData(f); needAdmin(async () => { await S.store.patch('meta', 'settings', { leagueName: d.get('leagueName').trim() || DEFAULTS.leagueName, scale: Math.max(1, +d.get('scale') || DEFAULTS.scale), k: Math.max(0, +d.get('k') || DEFAULTS.k), notice: String(d.get('notice') || '').trim().slice(0, 300) }); toast('설정을 저장했습니다'); }); };
  },
});

act('exportPlayers', () => {
  const rows = S.st.list.map((s) => [s.name, ...LANES.map((l) => s.p.scores?.[l] ?? 0), LANE_NAME[s.mainLane], s.p.soloTier || '', s.p.riotId || '', s.g, s.w, s.g - s.w, s.g ? s.wr + '%' : '', s.mmrInit, Math.round(s.mmr), s.ovr, s.titles.map((t) => t.n).join(' ')]);
  download(`내전_선수_${new Date().toISOString().slice(0, 10)}.csv`, csv([['이름', ...LANES.map((l) => LANE_NAME[l]), '주라인', '솔랭 티어', '롤 닉네임', '판', '승', '패', '승률', '시작 MMR', '현재 MMR', 'OVR', '칭호'], ...rows]));
});
act('backup', () => download(`내전_백업_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ at: Date.now(), players: col('players'), matches: col('matches'), auctions: col('auctions'), meta: col('meta') }), 'application/json'));
act('restore', () => needAdmin(() => {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  inp.onchange = async () => {
    try {
      const o = JSON.parse((await inp.files[0].text()).replace(/^﻿/, ''));
      const n = (o.players?.length || 0) + (o.matches?.length || 0);
      if (!n || !confirm(`선수 ${o.players?.length || 0}명, 경기 ${o.matches?.length || 0}판을 복원합니다. 같은 항목은 덮어씁니다. 계속할까요?`)) return;
      for (const c of ['players', 'matches', 'auctions', 'meta']) for (const d of o[c] || []) await S.store.put(c, d.id, d);
      toast('복원했습니다');
    } catch (e) { toast('복원 실패: ' + e.message); }
  };
  inp.click();
}));

act('plEdit', (d) => needAdmin(() => {
  const p = S.store.data.players[d.id] || { scores: {}, solo: {} }, o = p.solo || {};
  const el = modal(`<div class="mh"><b>${p.id ? '선수 수정' : '선수 추가'}</b><button class="btn ghost" data-a="close">닫기</button></div>
  <form id="plf">
    <label class="fld"><span>이름</span><input class="inp" name="name" required value="${esc(p.name || '')}"></label>
    <div class="ph"><b>라인 점수 (0~20)</b></div>
    <div class="fgrid five">${LANES.map((l) => `<label class="fld"><span>${LANE_ICON[l]} ${LANE_NAME[l]}</span><input class="inp" name="s_${l}" type="number" min="0" max="20" step="0.5" value="${p.scores?.[l] ?? 10}"></label>`).join('')}</div>
    <div class="fgrid">
      <label class="fld"><span>주라인</span><select class="inp" name="mainLane">${LANES.map((l) => `<option value="${l}" ${p.mainLane === l ? 'selected' : ''}>${LANE_NAME[l]}</option>`).join('')}</select></label>
      <label class="fld"><span>솔랭 티어 <small class="mut">예: 에메랄드 2 · 33LP</small></span><input class="inp" name="soloTier" value="${esc(p.soloTier || '')}"></label>
      <label class="fld"><span>롤 닉네임 (이름#태그)</span><input class="inp" name="riotId" value="${esc(p.riotId || '')}"></label>
      <label class="fld"><span>시작 MMR 수동 보정 <small class="mut">비우면 자동</small></span><input class="inp" name="mmrInit" type="number" value="${p.mmrInit || ''}" placeholder="${p.id ? initMmr({ ...p, mmrInit: 0 }) : '자동'}"></label>
      <label class="fld"><span>솔랭 전적</span><input class="inp" name="record" value="${esc(o.record || '')}"></label>
      <label class="fld"><span>최고 티어</span><input class="inp" name="peak" value="${esc(o.peak || '')}"></label>
      <label class="fld"><span>솔랭 주 포지션</span><input class="inp" name="pos" value="${esc(o.pos || '')}"></label>
      <label class="fld"><span>모스트 3</span><input class="inp" name="most" value="${esc(o.most || '')}"></label>
    </div>
    <label class="fld"><span>솔랭 한줄평</span><textarea class="inp" name="comment" rows="3">${esc(o.comment || '')}</textarea></label>
    <div class="row">${p.id ? '<button type="button" class="btn ghost" id="plHide">명단에서 숨기기</button>' : ''}<span class="grow"></span><button class="btn pri">저장</button></div>
  </form>`, 'tall');
  el.querySelector('#plf').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), g = (k) => String(f.get(k) || '').trim(), id = p.id || 'p_' + uid();
    if (!p.id && col('players').some((x) => !x.deleted && x.name === g('name'))) return toast('같은 이름의 선수가 이미 있습니다');
    if (p.id) await history('player-edit', p);
    await S.store.put('players', id, { ...p, id, name: g('name'), scores: Object.fromEntries(LANES.map((l) => [l, Math.max(0, Math.min(20, +f.get('s_' + l) || 0))])), mainLane: g('mainLane'), soloTier: g('soloTier'), riotId: g('riotId'), mmrInit: +g('mmrInit') || 0, solo: { ...o, record: g('record'), peak: g('peak'), pos: g('pos'), most: g('most'), comment: g('comment') }, deleted: false });
    closeModal(); toast('저장했습니다');
  };
  const hide = el.querySelector('#plHide');
  if (hide) hide.onclick = async () => {
    if (!confirm(`${p.name} 선수를 명단에서 숨길까요? 과거 경기 기록은 그대로 남고, 언제든 복구할 수 있습니다.`)) return;
    await S.store.patch('players', p.id, { deleted: true }); closeModal(); toast('숨겼습니다');
  };
}));
// 표에서 바로 수정: 값이 바뀌면 즉시 저장
act('plScore', async (d, el) => {
  const p = S.store.data.players[d.id]; if (!p || !isAdmin()) return refresh();
  const v = Math.max(0, Math.min(20, Math.round((+el.value || 0) * 2) / 2));
  await S.store.patch('players', d.id, { scores: { ...p.scores, [d.l]: v } }); toast(`${p.name} ${LANE_NAME[d.l]} ${v}점 저장`);
});
act('plMain', async (d, el) => {
  const p = S.store.data.players[d.id]; if (!p || !isAdmin()) return refresh();
  await S.store.patch('players', d.id, { mainLane: el.value }); toast(`${p.name} 주라인 ${LANE_NAME[el.value]} 저장`);
});
act('admUnlock', () => needAdmin(() => { toast('관리자 모드가 켜졌습니다'); refresh(); }));
act('admLock', () => { S.admin = false; sessionStorage.removeItem('naejeon:admin:' + S.key); toast('잠갔습니다'); refresh(); });
act('plRestore',(d) => needAdmin(() => S.store.patch('players', d.id, { deleted: false })));
act('mRestore', (d) => needAdmin(() => S.store.patch('matches', d.id, { deleted: false }).then(() => toast('복구했습니다'))));
act('pinChange', () => needAdmin(async () => {
  if (!confirm('관리자 PIN을 초기화할까요? 초기화 후 다음 관리자 작업 때 새 PIN을 정하게 됩니다.')) return;
  await S.store.patch('meta', 'settings', { pinHash: '' }); S.admin = false; sessionStorage.removeItem('naejeon:admin:' + S.key); toast('초기화했습니다');
}));

act('seed', () => needAdmin(async () => {
  if (!confirm('구글 시트 데이터를 가져올까요? (선수 27명, 경기 17판)')) return;
  const { SEED_PLAYERS, SEED_MATCHES } = await import('../data/seed.js');
  const ids = {};
  toast('가져오는 중…');
  try {
    for (const [i, r] of SEED_PLAYERS.entries()) {
      const [name, top, jg, mid, adc, sup, mainLane, soloTier, riotId, record, peak, most, pos, comment] = r;
      const id = (ids[name] = 'p' + String(i + 1).padStart(2, '0'));
      await S.store.put('players', id, { id, name, scores: { top, jg, mid, adc, sup }, mainLane, soloTier, riotId, mmrInit: 0, solo: { record, peak, most, pos, comment, asOf: '2026.11.03' }, order: i, deleted: false });
    }
    let prev = null, sid = '';
    for (const [i, r] of SEED_MATCHES.entries()) {
      const [dt, line, bs, rs, p, winner, bc, rc] = r, id = 'm' + String(i + 1).padStart(3, '0');
      const [blue, red] = line.split('|').map((t) => t.split(',').map((n) => ids[n]));
      const day = dt.slice(0, 10);
      if (!prev || prev.line !== line || new Date(dt) - new Date(prev.dt) > 8 * 3600e3) sid = id;
      prev = { line, dt, day };
      const ch = (s) => (s ? s.split(',') : ['', '', '', '', '']);
      await S.store.put('matches', id, { id, at: new Date(dt).getTime(), seq: i + 1, seriesId: sid, blue, red, winner, champs: { blue: ch(bc), red: ch(rc) }, bans: { blue: [], red: [] }, kda: {}, snap: { bs, rs, pBlue: p / 100 }, deleted: false });
    }
    toast('가져오기 완료!');
  } catch (e) { toast('가져오기 실패: ' + (e.code || e.message)); }
}));
