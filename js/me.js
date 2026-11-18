// 내 페이지: 처음에 '나'를 한 번 고르면 내 순위·변화, 전적, MMR 흐름, 최근 경기, 라인별 기록, 케미, 1지망 보정,
// 라인 지원 상태, 뽑기권, 내가 쓴 익명 글의 새 댓글을 한 화면에 모은다.
// 숫자는 모두 다른 화면과 같은 계산을 그대로 쓴다(랭킹 = 1판 이상·OVR 순, 뽑기권 = 가챠 화면 계산, 보정 = 라인 지원 계산).
// 무거운 계산은 통계(S.st)가 바뀔 때만 다시 하고, DB 읽기는 가챠 문서 1건(2분 캐시)과 실시간 목록에 없는 내 글뿐이다.
import { S, page, act, esc, ic, refresh, modal, closeModal, mh, champIcon, artUrl, cardChamp, fmtDT, fmtDay, dots, titleChips, countUp, LANES, LANE_NAME, LANE_ICON, LANE_COLOR, pct } from './core.js';
import { chem, dayKey, ovrOf } from './stats.js';
import { missOf, weightOf, LUCK_MAX, boardLive } from './board.js';
import { ticketInfo } from './gacha.js';
import { myPostAlerts } from './talk.js';

const meKey = () => 'naejeon:me:' + S.key;
// 저장한 '나'가 없으면 라인 지원·가챠에서 고른 선수를 이어받는다
function myId() {
  let id = '';
  try { id = localStorage.getItem(meKey()) || localStorage.getItem('naejeon:bdme:' + S.key) || JSON.parse(localStorage.getItem('naejeon:gme:' + S.key) || 'null')?.pid || ''; } catch {}
  return S.st.P[id] ? id : '';
}
const FORM = { '⬆️': '최상', '↗️': '좋음', '➡️': '보통', '↘️': '주춤', '⬇️': '부진', '➖': '—' };
const later = () => { if (S.page === 'me') refresh(); };

// ---------- 순위(랭킹 화면 기본 정렬과 같음: 1판 이상, OVR 높은 순) + 지난 내전 전 순위 ----------
// 지난 내전 전 = 마지막 내전 날 경기를 빼고 본 MMR. 라인 점수는 지금 값을 쓴다(점수 변경 기록은 따로 없음).
const MEMO = new WeakMap();
function derived(st) {
  let d = MEMO.get(st);
  if (d) return d;
  const now = st.list.filter((s) => s.g >= 1).sort((a, b) => b.ovr - a.ovr);
  const rank = Object.fromEntries(now.map((s, i) => [s.id, i + 1]));
  let prev = null;
  if (st.days.length >= 2) {
    const last = st.lastDay, rows = [];
    for (const s of st.list) {
      let g = 0; while (g < s.hist.length && dayKey(s.hist[g].at) < last) g++;
      if (g) rows.push({ id: s.id, ovr: ovrOf(s.p, s.hist[g - 1].mmr) });
    }
    rows.sort((a, b) => b.ovr - a.ovr);
    prev = Object.fromEntries(rows.map((r, i) => [r.id, i + 1]));
  }
  d = { rank, n: now.length, prev, mine: {} };
  MEMO.set(st, d);
  return d;
}
// 내 경기 목록: hist는 내가 뛴 경기마다 한 칸씩 같은 순서로 쌓이므로 k번째 경기의 MMR 변화 = hist[k] - hist[k-1]
function myGames(st, id) {
  const d = derived(st);
  if (d.mine[id]) return d.mine[id];
  const s = st.P[id], out = [];
  let k = 0;
  for (const m of st.matches) {
    const side = m.blue.includes(id) ? 'blue' : m.red.includes(id) ? 'red' : '';
    if (!side) continue;
    const h = s.hist[k], before = k ? s.hist[k - 1].mmr : s.mmrInit, i = m[side].indexOf(id);
    out.push({ m, side, lane: LANES[i], champ: m.champs?.[side]?.[i] || '', kda: m.kda?.[id] || null, win: m.winner === side, dm: h ? h.mmr - before : 0 });
    k++;
  }
  return (d.mine[id] = out);
}

// ---------- 조각 ----------
const sgn = (v, f = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(f);
function rankPill(id, d) {
  if (!d.prev || !d.rank[id]) return '';
  const was = d.prev[id], now = d.rank[id], day = fmtDay(S.st.lastDay).slice(5);
  if (!was) return `<span class="me-pill new" title="${day} 내전에서 첫 순위">NEW</span>`;
  const v = was - now;
  return `<span class="me-pill ${v > 0 ? 'up' : v < 0 ? 'down' : ''}" title="${day} 내전 전 ${was}위 → 지금 ${now}위">${v > 0 ? `▲ ${v}` : v < 0 ? `▼ ${-v}` : '― 유지'}</span>`;
}
function kpi(label, value, sub, cls = '', count) {
  return `<div class="me-k ${cls}"><small>${label}</small><b class="mono"${count !== undefined ? ` data-count="${count}"` : ''}>${value}</b><span>${sub}</span></div>`;
}
const card = (cls, icon, title, body, more = '') => `<section class="me-c ${cls}"><header>${ic(icon)}<h2>${title}</h2><span class="grow"></span>${more}</header>${body}</section>`;

// MMR 흐름: 최근 30경기(그 전 값 포함). 선은 화면 크기와 상관없이 같은 굵기
function spark(s, games) {
  const pts = s.hist.slice(-30).map((h) => h.mmr);
  const first = s.hist.length > 30 ? s.hist[s.hist.length - 31].mmr : s.mmrInit;
  const v = [first, ...pts];
  if (v.length < 2) return '<p class="me-empty">경기를 하면 MMR 흐름이 그려져요.</p>';
  const lo = Math.min(...v), hi = Math.max(...v), pad = Math.max(4, (hi - lo) * 0.12), a = lo - pad, b = hi + pad;
  const X = (i) => (i / (v.length - 1)) * 300, Y = (y) => 86 - ((y - a) / (b - a)) * 80;
  const line = v.map((y, i) => `${X(i).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  const last = v[v.length - 1], peak = Math.max(...s.hist.map((h) => h.mmr), s.mmrInit), diff = last - first, n = v.length - 1;
  const wins = games.slice(-n).filter((g) => g.win).length;
  return `<div class="me-spark"><svg viewBox="0 0 300 90" preserveAspectRatio="none" aria-label="최근 ${n}경기 MMR 흐름">
      <defs><linearGradient id="me-ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--tc)" stop-opacity=".32"/><stop offset="1" stop-color="var(--tc)" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="300" y1="${Y(first).toFixed(1)}" y2="${Y(first).toFixed(1)}" class="me-base"/>
      <polygon points="0,90 ${line} 300,90" fill="url(#me-ar)"/>
      <polyline points="${line}" class="me-ln" pathLength="1"/>
    </svg><i class="me-dot" style="top:${((Y(last) / 90) * 100).toFixed(1)}%"></i></div>
    <div class="me-sp-f"><span>최근 <b class="mono">${n}</b>경기 <b class="mono ${diff >= 0 ? 'good' : 'bad'}">${sgn(Math.round(diff))}</b></span><span>${wins}승 ${n - wins}패</span><span>최고 <b class="mono">${Math.round(peak).toLocaleString()}</b></span></div>`;
}
function recentHTML(games) {
  if (!games.length) return '<p class="me-empty">아직 출전한 경기가 없어요.</p>';
  return `<div class="me-ms">${games.slice(-5).reverse().map((g) => `<button class="me-m ${g.win ? 'w' : 'l'}" data-a="matchDetail" data-id="${g.m.id}">
      <span class="me-res">${g.win ? '승' : '패'}</span>${champIcon(g.champ, 'sm')}
      <span class="me-mt"><b>${g.champ ? esc(g.champ) : '챔피언 기록 없음'}</b><small>${LANE_ICON[g.lane]}${LANE_NAME[g.lane]} · ${g.side === 'blue' ? '블루' : '레드'} · ${fmtDT(g.m.at)}</small></span>
      <span class="me-kda mono">${g.kda ? g.kda.join('/') : ''}</span>
      <span class="me-dm mono ${g.dm >= 0 ? 'good' : 'bad'}" title="이 경기 MMR 변화">${sgn(g.dm, 1)}</span></button>`).join('')}</div>`;
}
function prepHTML(id) {
  const rows = [];
  // 라인 지원
  const d = S.store.data.meta?.board, on = boardLive() && d?.ids?.includes(id);
  rows.push(`<div class="me-pr"><span class="me-pi">${ic('users')}</span><div><b>라인 지원</b><small>${on ? (d.status === 'play' ? '추첨 중이에요' : d.done?.[id] ? '선택 완료 · 다른 사람을 기다리는 중' : '아직 선택하지 않았어요') : boardLive() ? '진행 중인 지원에 내 이름이 없어요' : '열린 라인 지원이 없어요'}</small></div>${boardLive() ? `<button class="btn xs ${on && !d.done?.[id] && d.status !== 'play' ? 'pri' : ''}" data-a="tBoard">${on ? '열기' : '보기'}</button>` : ''}</div>`);
  // 1지망 보정
  const n = missOf(id), w = weightOf(n);
  rows.push(`<div class="me-pr"><span class="me-pi">${ic('target')}</span><div><b>1지망 보정 <em class="mono">×${+w.toFixed(1)}</em></b><small>${n ? `1지망 추첨에서 ${n}번 떨어졌어요${n >= LUCK_MAX ? ' (최대)' : ''}` : '보정 없음 · 1지망 추첨에서 떨어지면 다음부터 확률이 올라가요'}</small></div><span class="me-meter" aria-label="${n}/${LUCK_MAX}">${Array.from({ length: LUCK_MAX }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span></div>`);
  // 뽑기권
  const t = ticketInfo(id, later);
  rows.push(`<a class="me-pr" href="#/gacha"><span class="me-pi">${ic('gacha')}</span><div><b>뽑기권</b><small>${t ? `다음 챔피언권까지 ${t.next.champ}판 · 스킨권까지 ${t.next.skin}판` : '불러오는 중…'}</small></div>${t ? `<span class="me-tk"><span><b class="mono">${t.left.champ}</b><small>챔피언</small></span><span><b class="mono">${t.left.skin}</b><small>스킨</small></span></span>` : ''}</a>`);
  return `<div class="me-prs">${rows.join('')}</div>`;
}
function laneHTML(s) {
  return `<div class="me-ls">${LANES.map((l) => {
    const v = +s.p.scores?.[l] || 0, o = s.lanes[l], r = pct(o.w, o.g);
    return `<div class="me-l ${l === s.mainLane ? 'main' : ''}" style="--lc:${LANE_COLOR[l]}"><span class="me-ln-n">${LANE_ICON[l]}${LANE_NAME[l]}${l === s.mainLane ? '<em>주</em>' : ''}</span>
      <span class="me-bar"><i style="transform:scaleX(${Math.min(1, v / 20).toFixed(3)})"></i></span><b class="mono">${v}</b>
      <span class="me-lw mono">${o.g ? `<b class="${r >= 60 ? 'good' : r <= 40 ? 'bad' : ''}">${r}%</b> ${o.g}판` : '<span class="mut">기록 없음</span>'}</span></div>`;
  }).join('')}</div>`;
}
function chemHTML(id) {
  const c = chem(S.st, id, 3), P = S.st.P;
  const tile = (x, label, tone) => `<a class="me-ch ${tone}" ${x ? `href="#/players/${x.id}"` : ''}><small>${label}</small>${x ? `<b>${esc(P[x.id]?.name || '?')}</b><span class="mono">${x.wr}% · ${x.g}판</span>` : '<b class="mut">—</b><span>3판 이상부터</span>'}</a>`;
  return `<div class="me-chs">${tile(c.best, '베스트 듀오', 'pos')}${tile(c.worst, '상극 듀오', 'neg')}${tile(c.prey, '내가 강한 상대', 'pos')}${tile(c.nemesis, '천적', 'neg')}</div>`;
}
function champHTML(s) {
  const top = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w).slice(0, 3);
  if (!top.length) return '<p class="me-empty">챔피언 기록이 아직 없어요.</p>';
  return `<div class="me-cps">${top.map(([n, o], i) => `<div class="me-cp"><i class="mono">${i + 1}</i>${champIcon(n)}<span><b>${esc(n)}</b><small>${o.g}판 · 승률 <span class="${pct(o.w, o.g) >= 60 ? 'good' : pct(o.w, o.g) <= 40 ? 'bad' : ''}">${pct(o.w, o.g)}%</span></small></span></div>`).join('')}</div>
    <p class="me-foot">지금까지 챔피언 <b class="mono">${s.champKinds}</b>종</p>`;
}
function postHTML() {
  const list = myPostAlerts(later);
  if (!list.length) return '';
  const fresh = list.reduce((a, p) => a + p.fresh, 0);
  return card('posts', 'talk', '내가 쓴 익명 글', `<div class="me-ps">${list.map((p) => `<a class="me-p" href="#/talk"><b>${esc(p.title)}</b><span class="mono">댓글 ${p.cn}</span>${p.fresh ? `<em>새 댓글 ${p.fresh}</em>` : ''}</a>`).join('')}</div>
    <p class="me-foot">이 기기에서 쓴 글만 보여요. 게시판에서 댓글을 펼치면 '새 댓글' 표시가 사라져요.</p>`, fresh ? `<span class="me-badge">${fresh}</span>` : '');
}

// ---------- 화면 ----------
function picker(cur) {
  const list = [...S.st.list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return `<div class="me-pick">${list.map((s) => `<button class="${s.id === cur ? 'on' : ''}" data-a="meSet" data-id="${s.id}" style="--lc:${LANE_COLOR[s.mainLane]}">${LANE_ICON[s.mainLane]}<span>${esc(s.name)}</span></button>`).join('')}</div>`;
}
page('me', {
  render() {
    const st = S.st;
    if (!st.list.length) return `<h1>${ic('user')}내 페이지</h1><div class="panel empty">등록된 선수가 없어요.</div>`;
    const id = myId();
    if (!id) return `<div class="me-hello"><h1>${ic('user')}내 페이지</h1><p>누구신가요? 이름을 한 번 고르면 이 기기에서 기억해요.<br><small>다른 사람의 페이지도 언제든 바꿔 볼 수 있어요. 아무것도 저장되지 않아요.</small></p>${picker('')}</div>`;
    const s = st.P[id], d = derived(st), games = myGames(st, id), r = d.rank[id];
    const sig = cardChamp(s), l = s.g - s.w, last = games[games.length - 1];
    const streakTxt = s.cur >= 2 ? `${s.cur}연승` : s.cur <= -2 ? `${-s.cur}연패` : FORM[s.cond];
    return `<div class="me-pg" style="--tc:${LANE_COLOR[s.mainLane]}">
    <section class="me-hero" style="--img:url('${artUrl(sig)}')">
      <div class="me-id"><span class="me-lane">${LANE_ICON[s.mainLane]}</span>
        <div class="me-nm"><small>MY PAGE · 주라인 ${LANE_NAME[s.mainLane]}${sig ? ` · ${esc(sig)}` : ''}</small><h1>${esc(s.name)}</h1></div>
        <button class="btn ghost xs me-sw" data-a="meSwitch" aria-label="선수 바꾸기">${ic('swap')}<span>선수 바꾸기</span></button></div>
      <div class="me-rk">
        <div class="me-rank"><small>랭킹</small>${r ? `<b class="mono">${r}<i>위</i></b><span class="mono">/ ${d.n}명</span>${rankPill(id, d)}` : '<b class="me-na">1판부터 집계</b>'}</div>
        <div class="me-ovr"><small>OVR</small><b class="mono">${s.ovr}</b></div>
      </div>
      ${s.titles.length ? `<div class="me-ttl">${titleChips(s, 4)}</div>` : ''}
    </section>
    <div class="me-ks">
      ${kpi('전적', `${s.g}<i>판</i>`, `${s.w}승 ${l}패`, '', undefined)}
      ${kpi('승률', s.g ? `${s.wr}<i>%</i>` : '—', s.recent.length ? dots(s.recent) : '최근 경기 없음', s.g ? (s.wr >= 60 ? 'pos' : s.wr <= 40 ? 'neg' : '') : '')}
      ${kpi('내전 MMR', Math.round(s.mmr).toLocaleString(), last ? `지난 경기 <b class="${last.dm >= 0 ? 'good' : 'bad'}">${sgn(last.dm, 1)}</b>` : '시작 값', '', Math.round(s.mmr))}
      ${kpi('흐름', streakTxt, `최다 연승 ${s.maxStreak}`, s.cur >= 2 ? 'pos' : s.cur <= -2 ? 'neg' : '')}
    </div>
    <div class="me-grid"><div class="me-col">
      ${card('recent', 'matches', '최근 경기', recentHTML(games), games.length ? '<a class="lnk sm" href="#/matches">전체 기록</a>' : '')}
      ${card('prep', 'today', '다음 내전 준비', prepHTML(id))}
      ${card('chem', 'chem', '케미', chemHTML(id), `<a class="lnk sm" href="#/chem/${id}">자세히</a>`)}
    </div><div class="me-col">
      ${card('flow', 'rank', 'MMR 흐름', spark(s, games))}
      ${card('lanes', 'scale', '라인별 점수 · 승률', laneHTML(s))}
      ${card('champs', 'champs', '많이 쓴 챔피언', champHTML(s))}
      ${postHTML()}
    </div></div>
    <p class="hint">랭킹은 1판 이상 뛴 선수의 OVR 순(랭킹 화면 기본 정렬과 같음)이에요. ▲▼는 마지막 내전 날 경기 전과 비교한 값이고, 라인 점수는 지금 값으로 계산해요. <a class="lnk" href="#/players/${id}">내 선수 카드 보기</a></p>
    </div>`;
  },
  after(entering) { if (entering) countUp(document.getElementById('main')); },
});
act('meSet', (d) => { try { localStorage.setItem(meKey(), d.id); } catch {} closeModal(); window.scrollTo(0, 0); refresh(); });
act('meSwitch', () => modal(`${mh('누구의 페이지를 볼까요?')}<p class="mut sm">고른 사람은 이 기기에서 기억해요.</p>${picker(myId())}`, 'me-sheet'));
