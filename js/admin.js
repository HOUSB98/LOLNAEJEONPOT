// 관리: 내보내기/백업, 선수 관리, 시트 데이터 가져오기, 설정, 삭제 복구, 칭호 도감
import { S, page, act, esc, uid, col, settings, pname, refresh, fmtDT, toast, download, csv, modal, closeModal, mh, sha, needAdmin, isAdmin, history, ic, LANES, LANE_NAME, LANE_ICON } from './core.js';
import { TITLES, DEFAULTS, initMmr } from './stats.js';
import { exportMatches } from './app.js';
import { callWorker, hookOn, USAGE, loadUsage, won } from './hook.js';
import { WORKER_URL } from './config.js';
import { gachaAdminHTML } from './gacha.js';

// ---------- 연동 서버: Firebase 사용량 · 디스코드 테스트 · 라이엇 갱신 ----------
const UZ = { riot: null };
const fmtN = (v) => Math.round(+v || 0).toLocaleString('ko-KR');
function usageHTML() {
  if (!WORKER_URL) return `<p class="hint">연동 서버가 아직 설정되지 않았어요. <code>worker/README.md</code> 순서대로 Cloudflare Worker를 만들고, 주소를 <code>js/config.js</code>의 <code>WORKER_URL</code>에 넣으면 디스코드 알림·사용량·라이엇 자동 갱신이 켜집니다.</p>`;
  if (S.store.mode !== 'firebase') return '<p class="hint">체험 모드에서는 연동 기능을 쓰지 않습니다.</p>';
  const d = USAGE.d;
  const meter = (k, label) => { const v = +d.today[k] || 0, lim = d.limits[k], p = Math.min(100, (v / lim) * 100); return `<div class="uz-m ${p >= 90 ? 'bad' : p >= 60 ? 'warn' : ''}"><div class="uz-t"><b>${label}</b><span class="mono">${fmtN(v)} <small>/ ${fmtN(lim)}</small></span></div><div class="uz-bar"><i style="width:${p.toFixed(1)}%"></i></div><small class="mono">${p.toFixed(1)}% 사용</small></div>`; };
  const maxR = d ? Math.max(d.limits.read, ...d.days.map((x) => x.read)) : 1;
  const CONSOLE = 'https://console.firebase.google.com/project/lolnaejeonpot/firestore/usage';
  // Spark(무료) 요금제는 구글 사용량 API를 쓸 수 없다. 이 경우 콘솔 바로가기만 보여 준다(Blaze로 바꾸면 코드 수정 없이 아래 게이지가 나온다)
  if (!d && /billing/i.test(USAGE.err)) return `<p class="sm">무료(Spark) 요금제에서는 사이트 안에서 사용량을 불러올 수 없어요. 정확한 숫자는 Firebase 콘솔에서 확인해 주세요.</p>
    <div class="row wrapr"><a class="btn gold" href="${CONSOLE}" target="_blank" rel="noopener">${ic('bolt')}Firebase 콘솔에서 사용량 보기</a></div>
    <p class="hint">하루 무료 한도: 읽기 5만 · 쓰기 2만 · 삭제 2만 (미국 태평양 시간 자정, 한국 시간 오후 4~5시에 초기화). 나중에 Blaze 요금제로 바꾸면 이 칸에 게이지가 자동으로 나옵니다.</p>`;
  const cost = d && d.month ? `<div class="uz-cost">
      <div class="${d.today.usd > 0 ? 'bad' : ''}"><small>오늘 요금</small><b class="mono">${won(d.today.usd, d.krw)}</b><span class="mono">$${(+d.today.usd).toFixed(4)}</span></div>
      <div class="${d.month.usd > 0 ? 'warn' : ''}"><small>이번 달 누적 (${+d.month.key.slice(5)}월)</small><b class="mono">${won(d.month.usd, d.krw)}</b><span class="mono">$${(+d.month.usd).toFixed(4)}</span></div>
      <div><small>넘은 만큼 요금 (10만 건당)</small><span class="mono">읽기 $${d.rates.read} · 쓰기 $${d.rates.write} · 삭제 $${d.rates.delete}</span><span class="mono">환율 ₩${d.krw.toLocaleString('ko-KR')}/$</span></div></div>` : '';
  return `${USAGE.err ? `<p class="bad sm">${ic('alert')}${esc(USAGE.err)}</p>` : ''}
    ${d ? `<div class="uz">${meter('read', '읽기')}${meter('write', '쓰기')}${meter('delete', '삭제')}</div>${cost}
      <div class="uz-days" title="최근 8일 읽기 (점선 = 무료 한도 5만)"><div class="uz-in"><i class="uz-lim" style="bottom:${((d.limits.read / maxR) * 100).toFixed(1)}%"></i>${d.days.map((x, i) => `<div class="uz-day ${i === d.days.length - 1 ? 'now' : ''} ${x.read > d.limits.read ? 'over' : ''}" title="${x.date} · 읽기 ${fmtN(x.read)} · 쓰기 ${fmtN(x.write)} · 삭제 ${fmtN(x.delete)}${x.usd ? ` · ${won(x.usd, d.krw)}` : ''}"><i style="height:${Math.max(1, (x.read / maxR) * 100).toFixed(1)}%"></i><small class="mono">${x.date.slice(5).replace('-', '/')}</small><span class="mono">${x.read >= 1000 ? (x.read / 1000).toFixed(1) + 'k' : x.read}</span></div>`).join('')}</div></div>
      <p class="hint">오늘 = 미국 태평양 시간 기준(한국 시간 오후 4~5시에 0으로 초기화). 구글 집계라 몇 분 늦게 반영되고, 5분 동안은 같은 값을 보여 줍니다 · ${fmtDT(d.at)} 기준. 요금은 하루마다 무료 한도를 넘은 건수로 계산한 <b>예상 금액</b>이라 실제 청구서와 조금 다를 수 있어요. 단가·환율은 Worker 변수 <code>RATE_READ</code>·<code>RATE_WRITE</code>·<code>RATE_DELETE</code>·<code>USD_KRW</code>로 바꿀 수 있어요 · <a class="lnk" href="https://cloud.google.com/firestore/pricing" target="_blank" rel="noopener">가격표</a> · <a class="lnk" href="https://console.cloud.google.com/billing?project=lolnaejeonpot" target="_blank" rel="noopener">실제 청구 내역</a></p>` : `<p class="mut sm">${USAGE.busy ? '불러오는 중…' : '아직 불러오지 않았어요'}</p>`}`;
}
addEventListener('usage', () => { const el = document.getElementById('uzbox'); if (el) el.innerHTML = usageHTML(); });


page('admin', {
  render() {
    const st = S.st, cfg = { ...DEFAULTS, ...settings() };
    const del = col('matches').filter((m) => m.deleted).sort((a, b) => b.at - a.at);
    const gone = col('players').filter((p) => p.deleted), adm = isAdmin();
    return `<h1>${ic('admin')}관리</h1>
    <div class="panel"><div class="ph"><b>${ic('save')}내보내기 · 백업</b></div>
      <div class="row wrapr"><button class="btn" data-a="exportCsv">⬇ 경기 기록 CSV</button><button class="btn" data-a="exportPlayers">⬇ 선수 CSV</button><button class="btn" data-a="backup">⬇ 전체 백업 (JSON)</button><button class="btn ghost" data-a="restore">⬆ 백업 복원</button></div>
      <div class="row wrapr"><span class="mut sm">로고 내려받기</span><a class="btn xs" href="brand/naejeonpot-logo-1024.png" download>⬇ PNG 1024</a><a class="btn xs" href="brand/naejeonpot-logo-512.png" download>⬇ PNG 512</a><a class="btn xs" href="brand/naejeonpot-icon-512.png" download title="아래 MAISON 글씨 없는 아이콘">⬇ 아이콘 PNG</a><a class="btn xs ghost" href="brand/naejeonpot-logo.svg" download title="확대해도 깨지지 않는 벡터 파일">⬇ SVG</a></div>
      <p class="hint">${S.store.mode === 'local' ? `${ic('alert')}` + ' 지금은 체험 모드라 데이터가 이 브라우저에만 저장됩니다. Firebase를 연결하면 친구들과 실시간으로 공유됩니다(README 참고).' : '데이터는 Firebase에 저장됩니다. Firestore 무료 요금제는 오래 안 써도 일시정지되지 않지만, 가끔 전체 백업을 내려받아 두세요.'}</p></div>

    <div class="panel"><div class="ph"><b>${ic('bolt')}Firebase 사용량</b><small class="mut">무료 한도 대비 오늘 사용량</small><span class="grow"></span>${hookOn() && !/billing/i.test(USAGE.err) ? '<button class="btn xs" data-a="uzLoad">새로고침</button>' : ''}</div>
      <div id="uzbox">${usageHTML()}</div>
      ${hookOn() ? `<div class="ph"><b>연동</b><small class="mut">디스코드 알림 · 라이엇 솔랭 자동 갱신(매일 새벽 4시)</small></div>
      <div class="row wrapr"><button class="btn" data-a="hkTest">디스코드 테스트 알림</button><button class="btn" data-a="hkRiot">라이엇 전적 지금 갱신</button><button class="btn" data-a="hkWeekly" title="매주 금요일 저녁 8시에 자동으로 올라가는 결산을 지금 미리 보내 봅니다">주간 결산 지금 보내기</button></div>
      ${UZ.riot ? `<p class="sm">${esc(UZ.riot)}</p>` : ''}<p class="hint">라인 지원이 열릴 때와 경기 결과를 저장할 때 디스코드 채널에 알림이 올라갑니다. 라이엇 갱신은 선수의 라이엇 ID(이름#태그)로 솔랭 티어·전적을 채우며, 한 사람은 하루 한 번만 갱신됩니다.</p>` : ''}</div>

    <div class="panel"><div class="ph"><b>${ic('users')}선수 관리</b><span class="tag">${st.list.length}명</span><span class="grow"></span><button class="btn pri xs" data-a="plEdit" data-id="">＋ 선수 추가</button></div>
      <div class="lockbar ${adm ? 'open' : ''}">${adm ? `${ic('shield')}<b>관리자 모드</b><span>점수와 주라인을 칸에서 바로 고치면 즉시 저장됩니다. 이 창을 닫기 전까지 유지됩니다.</span><button class="btn xs" data-a="admLock">잠그기</button>` : `${ic('shield')}<b>잠겨 있음</b><span>관리자 PIN을 한 번 입력하면 모든 선수의 점수를 바로 수정할 수 있습니다.</span><button class="btn gold xs" data-a="admUnlock">관리자 PIN 입력</button>`}</div>
      <div class="tw scw"><table class="tbl edit score ${adm ? '' : 'locked'}"><thead><tr><th class="no">#</th><th class="l">이름</th>${LANES.map((l) => `<th class="lh l-${l}">${LANE_ICON[l]}${LANE_NAME[l]}</th>`).join('')}<th>평균</th><th>주라인</th><th class="l">솔랭 티어</th><th>시작 MMR</th><th></th></tr></thead>
      <tbody>${st.list.map((s, i) => `<tr><td class="no mono">${i + 1}</td><td class="l nm"><span class="nmc">${LANE_ICON[s.mainLane]}${esc(s.name)}</span></td>${LANES.map((l) => `<td class="scd l-${l} ${s.mainLane === l ? 'main' : ''}" style="--v:${Math.min(100, (+s.p.scores?.[l] || 0) * 5)}%"><input id="sc-${s.id}-${l}" class="inp cell mono" type="number" min="0" max="20" step="0.5" value="${s.p.scores?.[l] ?? 0}" data-c="plScore" data-id="${s.id}" data-l="${l}" ${adm ? '' : 'disabled'}></td>`).join('')}<td class="num mono avg"><b>${s.avg.toFixed(1)}</b></td><td><select class="inp cell" data-c="plMain" data-id="${s.id}" ${adm ? '' : 'disabled'}>${LANES.map((l) => `<option value="${l}" ${s.mainLane === l ? 'selected' : ''}>${LANE_NAME[l]}</option>`).join('')}</select></td><td class="l tier">${esc(s.p.soloTier || '-')}</td><td class="num mono">${s.mmrInit}</td><td><button class="btn xs" data-a="plEdit" data-id="${s.id}">상세</button></td></tr>`).join('') || '<tr><td colspan="11" class="empty">선수가 없습니다.</td></tr>'}</tbody></table></div>
      ${gone.length ? `<p class="sm mut">숨긴 선수: ${gone.map((p) => `${esc(p.name)} <button class="btn xs ghost" data-a="plRestore" data-id="${p.id}">복구</button>`).join(' ')}</p>` : ''}</div>

    ${gachaAdminHTML()}

    <div class="panel"><div class="ph"><b>${ic('admin')}설정</b></div>
      <form id="cfgf" class="fgrid">
        <label class="fld"><span>리그 이름</span><input class="inp" name="leagueName" value="${esc(cfg.leagueName)}"></label>
        <label class="fld"><span>예상승률 스케일 <small class="mut">(작을수록 점수 차에 민감)</small></span><input class="inp" name="scale" type="number" step="0.5" value="${cfg.scale}"></label>
        <label class="fld"><span>MMR 변동폭 K</span><input class="inp" name="k" type="number" value="${cfg.k}"></label>
        <label class="fld wide"><span>홈 고정 공지 <small class="mut">(첫 줄은 제목, 비우면 표시 안 함)</small></span><textarea class="inp" name="notice" rows="3" placeholder="예: 이번 주 토요일 밤 9시 내전&#10;참가 가능한 사람은 채팅에 남겨 주세요.">${esc(cfg.notice || '')}</textarea></label>
        <label class="fld"><span>&nbsp;</span><button class="btn pri">설정 저장</button></label>
      </form>
      <p class="hint">예상승률 = 1 / (1 + 10^(−점수차/스케일)). 현재 10점 차 = ${Math.round(100 / (1 + Math.pow(10, -10 / cfg.scale)))}%. MMR은 솔랭 티어를 시작값으로 경기마다 Elo 방식으로 변합니다.</p>
      <div class="row wrapr"><button class="btn ghost" data-a="pinChange">${ic('lock')}관리자 PIN 변경</button><span class="mut sm">리그 코드: ${esc(S.key)}</span></div></div>

    ${del.length ? `<div class="panel"><div class="ph"><b>${ic('trash')}삭제된 경기</b></div>${del.map((m) => `<div class="kv"><span>${fmtDT(m.at)} · ${m.blue.map(pname).join(' ')} vs ${m.red.map(pname).join(' ')}</span><button class="btn xs" data-a="mRestore" data-id="${m.id}">복구</button></div>`).join('')}</div>` : ''}

    <div class="panel"><div class="ph"><b>${ic('scroll')}칭호 도감</b><small class="mut">${TITLES.length}종</small></div>
      <div class="dogam">${TITLES.map((t) => { const own = st.list.filter((s) => s.titles.includes(t)); return `<div><b>${t.e} ${t.n}</b><span>${esc(t.d)}</span><small>${own.length ? own.map((s) => esc(s.name)).join(', ') : '—'}</small></div>`; }).join('')}</div></div>`;
  },
  after() {
    loadUsage(false);
    const f = document.getElementById('cfgf');
    if (f) f.onsubmit = (e) => { e.preventDefault(); const d = new FormData(f); needAdmin(async () => { await S.store.patch('meta', 'settings', { leagueName: d.get('leagueName').trim() || DEFAULTS.leagueName, scale: Math.max(1, +d.get('scale') || DEFAULTS.scale), k: Math.max(0, +d.get('k') || DEFAULTS.k), notice: String(d.get('notice') || '').trim().slice(0, 300) }); toast('설정을 저장했습니다'); }); };
  },
});

act('uzLoad', () => { loadUsage(true); const el = document.getElementById('uzbox'); if (el) el.innerHTML = usageHTML(); });
act('hkTest', async (d, btn) => { btn.disabled = true; const r = await callWorker('/test'); btn.disabled = false; toast(r.error ? '실패: ' + r.error : '디스코드에 테스트 알림을 보냈어요'); });
act('hkWeekly', (d, btn) => needAdmin(async () => { btn.disabled = true; const r = await callWorker('/weekly'); btn.disabled = false; toast(r.error ? '실패: ' + r.error : '디스코드에 주간 결산을 보냈어요'); }));
act('hkRiot', (d, btn) => needAdmin(async () => {
  btn.disabled = true; toast('라이엇 전적을 불러오는 중…');
  const r = await callWorker('/riot'); btn.disabled = false;
  if (r.error) { UZ.riot = '실패: ' + r.error; return refresh(); }
  UZ.riot = `갱신 ${r.updated.length}명${r.failed.length ? ` · 실패 ${r.failed.length}명 (${r.failed.join(' / ')})` : ''}${r.left ? ` · 남은 ${r.left}명은 다음 실행에서 이어서` : ''}${!r.updated.length && !r.failed.length && !r.left ? ' · 오늘 이미 모두 갱신됐어요(한 사람은 하루 한 번)' : ''}`;
  toast(`라이엇 갱신 ${r.updated.length}명 완료`); refresh();
}));
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
    const scores = Object.fromEntries(LANES.map((l) => [l, Math.max(0, Math.min(20, +f.get('s_' + l) || 0))]));
    if (p.id) await logScores(LANES.filter((l) => (+p.scores?.[l] || 0) !== scores[l]).map((l) => ({ pid: id, name: g('name'), lane: l, from: +p.scores?.[l] || 0, to: scores[l] })));
    await S.store.put('players', id, { ...p, id, name: g('name'), scores, mainLane: g('mainLane'), soloTier: g('soloTier'), riotId: g('riotId'), mmrInit: +g('mmrInit') || 0, solo: { ...o, record: g('record'), peak: g('peak'), pos: g('pos'), most: g('most'), comment: g('comment') }, deleted: false });
    closeModal(); toast('저장했습니다');
  };
  const hide = el.querySelector('#plHide');
  if (hide) hide.onclick = async () => {
    if (!confirm(`${p.name} 선수를 명단에서 숨길까요? 과거 경기 기록은 그대로 남고, 언제든 복구할 수 있습니다.`)) return;
    await S.store.patch('players', p.id, { deleted: true }); closeModal(); toast('숨겼습니다');
  };
}));
// 라인 점수 변경 기록(홈 공지에 쓴다): meta/scorelog.items 에 최근 80건만 남긴다
async function logScores(list) {
  if (!list.length) return;
  const at = S.store.serverNow?.() || Date.now();
  try { await S.store.tx('meta', 'scorelog', (r) => ({ items: [...(r?.items || []), ...list.map((x) => ({ ...x, at }))].slice(-80) })); } catch (e) { console.warn('[scorelog]', e); }
}
// 표에서 바로 수정: 값이 바뀌면 즉시 저장
act('plScore', async (d, el) => {
  const p = S.store.data.players[d.id]; if (!p || !isAdmin()) return refresh();
  const v = Math.max(0, Math.min(20, Math.round((+el.value || 0) * 2) / 2));
  const from = +p.scores?.[d.l] || 0;
  await S.store.patch('players', d.id, { scores: { ...p.scores, [d.l]: v } }); toast(`${p.name} ${LANE_NAME[d.l]} ${v}점 저장`);
  if (from !== v) logScores([{ pid: d.id, name: p.name, lane: d.l, from, to: v }]);
});
act('plMain', async (d, el) => {
  const p = S.store.data.players[d.id]; if (!p || !isAdmin()) return refresh();
  await S.store.patch('players', d.id, { mainLane: el.value }); toast(`${p.name} 주라인 ${LANE_NAME[el.value]} 저장`);
});
act('admUnlock', () => needAdmin(() => { toast('관리자 모드가 켜졌습니다'); refresh(); }));
act('admLock', () => { S.admin = false; sessionStorage.removeItem('naejeon:admin:' + S.key); toast('잠갔습니다'); refresh(); });
act('plRestore',(d) => needAdmin(() => S.store.patch('players', d.id, { deleted: false })));
act('mRestore', (d) => needAdmin(() => S.store.patch('matches', d.id, { deleted: false }).then(() => toast('복구했습니다'))));
// 관리자 PIN 변경: 이미 관리자 상태여도 현재 PIN을 다시 적어야 하고, 새 PIN은 두 번 입력받는다. 바꾼 사람의 브라우저는 관리자 상태가 유지된다.
act('pinChange', () => {
  const has = !!settings().pinHash;
  const el = modal(`${mh('관리자 PIN 변경')}
    <p class="mut">${has ? '현재 PIN을 입력한 뒤 새 PIN을 두 번 입력해 주세요.' : '아직 관리자 PIN이 없습니다. 새 PIN을 두 번 입력해 주세요.'} (4자리 이상) 바꾼 뒤에는 다른 기기에서 새 PIN으로 다시 확인해야 합니다.</p>
    <form id="pinc" class="col">${has ? '<input class="inp" id="pin0" type="password" inputmode="numeric" autocomplete="off" placeholder="현재 PIN">' : ''}
      <input class="inp" id="pin1" type="password" inputmode="numeric" autocomplete="off" placeholder="새 PIN">
      <input class="inp" id="pin2" type="password" inputmode="numeric" autocomplete="off" placeholder="새 PIN 다시 입력">
      <div class="row"><span class="grow"></span><button type="button" class="btn ghost" data-a="close">취소</button><button class="btn pri">변경</button></div></form>`);
  el.querySelector(has ? '#pin0' : '#pin1').focus();
  el.querySelector('#pinc').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cur = has ? el.querySelector('#pin0').value.trim() : '', a = el.querySelector('#pin1').value.trim(), b = el.querySelector('#pin2').value.trim();
    try {
      if (has && (!cur || (await sha(cur)) !== settings().pinHash)) return toast('현재 PIN이 맞지 않습니다');
      if (a.length < 4) return toast('새 PIN은 4자리 이상 입력하세요');
      if (a !== b) return toast('두 번 입력한 새 PIN이 서로 다릅니다');
      const h = await sha(a);
      if (h === settings().pinHash) return toast('지금 쓰는 PIN과 같습니다');
      await S.store.patch('meta', 'settings', { pinHash: h });
      S.admin = true; sessionStorage.setItem('naejeon:admin:' + S.key, h);
      closeModal(); toast('관리자 PIN을 변경했습니다');
    } catch (err) { toast('변경 실패: ' + (err.code || err.message)); }
  });
});

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
