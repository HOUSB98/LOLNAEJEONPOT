// 점수 변동: 관리자가 바꾼 라인 점수를 전체 선수 × 라인 표로 한눈에 본다(메뉴 기록·분석 > 점수 변동, 처음 들어갈 때 받음).
// 기록은 meta/scorelog.items {at, pid, name, lane, from, to}(관리 화면이 남김, 최근 300건). 이미 실시간으로 받고 있는 문서라 DB 읽기가 늘지 않는다.
// 한 라인을 기간 안에 여러 번 바꿨으면 기간 첫 점수 → 지금 점수로 묶고, 결국 그대로면 '변화 없음'으로 본다.
// 탭: 최근 변동 · 직전 변동(변동 1회 = 10분 안에 이어서 바꾼 묶음, 전체 선수 명단에 그 변동 전 → 후) · 기간별 모아보기
import { S, page, act, esc, ic, refresh, fmtDT, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';

const V = { tab: 'b0', days: 7, all: false, sort: 'recent', more: false, bsort: 'big', only: false };
const TABS = [['b0', '최근 변동'], ['b1', '직전 변동'], ['period', '기간별 모아보기']];
const BSORTS = [['big', '변화 큰 순'], ['name', '이름순']];
const GAP = 10 * 60e3; // 이 시간 안에 이어서 바꾼 것은 한 번의 변동으로 본다(관리 화면은 칸마다 따로 저장하므로)
const PERIODS = [[7, '최근 7일'], [30, '최근 30일'], [0, '남은 기록 전체']];
const SORTS = [['recent', '최근 변경순'], ['big', '변화 큰 순'], ['name', '이름순']];
const LOG_MAX = 300; // admin.js 의 logScores 와 같은 값
const num = (v) => String(Math.round(v * 10) / 10);
const md = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
const signed = (d) => (d > 0 ? '+' : '') + num(d);

function collect() {
  const P = S.st.P, now = Date.now(), since = V.days ? now - V.days * 864e5 : 0;
  const all = S.store.data.meta?.scorelog?.items || [];
  const items = all.filter((x) => x && +x.at >= since && P[x.pid] && LANES.includes(x.lane)).sort((a, b) => a.at - b.at);
  const cell = new Map(); // pid|lane → { from, at }
  for (const x of items) { const k = x.pid + '|' + x.lane, c = cell.get(k); if (c) c.at = +x.at; else cell.set(k, { from: +x.from || 0, at: +x.at }); }
  const rows = new Map();
  for (const [k, c] of cell) {
    const [pid, lane] = k.split('|'), to = +P[pid].p.scores?.[lane] || 0;
    if (to === c.from) continue;
    const r = rows.get(pid) || rows.set(pid, { pid, lanes: {}, sum: 0, abs: 0, at: 0 }).get(pid);
    r.lanes[lane] = { from: c.from, to, d: to - c.from, at: c.at }; r.sum += to - c.from; r.abs += Math.abs(to - c.from); r.at = Math.max(r.at, c.at);
  }
  let list = [...rows.values()];
  if (V.all) for (const s of S.st.list) if (!rows.has(s.id)) list.push({ pid: s.id, lanes: {}, sum: 0, abs: 0, at: 0 });
  const nm = (a, b) => P[a.pid].name.localeCompare(P[b.pid].name, 'ko', { numeric: true });
  list.sort(V.sort === 'name' ? nm : V.sort === 'big' ? (a, b) => b.abs - a.abs || nm(a, b) : (a, b) => b.at - a.at || nm(a, b));
  const ch = [...rows.values()].flatMap((r) => Object.values(r.lanes));
  return { list, items, changed: rows.size, n: ch.length, up: ch.filter((c) => c.d > 0).length, since: items[0]?.at, cut: all.length >= LOG_MAX && +all[0]?.at >= since ? +all[0].at : 0 };
}

// 변동 묶음: 기록을 시간순으로 10분 간격 안이면 한 묶음. 지금 점수에서 거꾸로 되짚어 각 묶음의 '전'·'후' 전체 점수표를 만든다.
// (가장 최근 묶음의 '후' = 지금 점수, '전' = 그 묶음 기록의 from. 그 앞 묶음의 '후' = 다음 묶음의 '전' …) 최근 2번만 계산한다.
function batches(n = 2) {
  const P = S.st.P, all = (S.store.data.meta?.scorelog?.items || []).filter((x) => x && P[x.pid] && LANES.includes(x.lane)).sort((a, b) => a.at - b.at);
  const groups = [];
  for (const x of all) { const g = groups[groups.length - 1]; if (g && +x.at - g.end <= GAP) { g.items.push(x); g.end = +x.at; } else groups.push({ start: +x.at, end: +x.at, items: [x] }); }
  const state = Object.fromEntries(Object.values(P).map((s) => [s.id, Object.fromEntries(LANES.map((l) => [l, +s.p.scores?.[l] || 0]))]));
  const clone = () => Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { ...v }]));
  const out = [];
  for (let i = groups.length - 1; i >= 0 && out.length < n; i--) {
    const g = groups[i], after = clone();
    for (let j = g.items.length - 1; j >= 0; j--) { const x = g.items[j]; state[x.pid][x.lane] = +x.from || 0; }
    const before = clone(), cells = [];
    for (const pid of Object.keys(after)) for (const l of LANES) if (after[pid][l] !== before[pid][l]) cells.push({ pid, l, d: after[pid][l] - before[pid][l] });
    out.push({ ...g, after, before, cells });
  }
  return { list: out, total: groups.length };
}
function batchView(b, idx, total) {
  const P = S.st.P;
  if (!b) return `<div class="panel empty">${idx ? '직전 변동 기록이 없어요. 점수를 두 번 이상 바꾸면 여기에 나와요.' : '아직 점수 변동 기록이 없어요.'}</div>`;
  const ppl = new Set(b.cells.map((c) => c.pid)), up = b.cells.filter((c) => c.d > 0).length;
  const when = fmtDT(b.start) + (b.end - b.start >= 60e3 ? ` ~ ${fmtDT(b.end).split(' ')[1]}` : '');
  const rows = Object.values(P).map((s) => {
    const ch = b.cells.filter((c) => c.pid === s.id), sum = ch.reduce((a, c) => a + c.d, 0), abs = ch.reduce((a, c) => a + Math.abs(c.d), 0);
    return { s, ch, sum, abs };
  }).filter((r) => !V.only || r.ch.length)
    .sort((a, b2) => (V.bsort === 'big' ? b2.abs - a.abs : 0) || a.s.name.localeCompare(b2.s.name, 'ko', { numeric: true }));
  const cell = (s, l) => {
    const a = b.after[s.id][l], f = b.before[s.id][l], d = a - f;
    if (!d) return `<div class="sv-c same" data-l="${LANE_NAME[l]}"><b>${num(a)}</b></div>`;
    return `<div class="sv-c ${d > 0 ? 'up' : 'dn'}" data-l="${LANE_NAME[l]}" title="${num(f)} → ${num(a)}"><b data-live="svb${idx}:${s.id}:${l}">${num(a)}</b><em>${d > 0 ? '▲' : '▼'}${num(Math.abs(d))}</em><small>${num(f)}→${num(a)}</small></div>`;
  };
  return `<div class="sv-bh"><div><small>${idx ? '직전 변동' : '최근 변동'}${total > 1 ? ` · 전체 ${total}번 중 ${idx ? '두 번째' : '가장 최근'}` : ''}</small><b class="mono">${when}</b></div>
      <div class="sv-sum"><span><b class="mono">${ppl.size}</b>명</span><span><b class="mono">${b.cells.length}</b>칸</span><span class="up">▲ <b class="mono">${up}</b></span><span class="dn">▼ <b class="mono">${b.cells.length - up}</b></span></div></div>
    <div class="sv-ctl">${seg(BSORTS, V.bsort, 'svBSort')}<label class="sv-all"><input type="checkbox" data-a="svOnly" ${V.only ? 'checked' : ''}>바뀐 선수만 보기</label></div>
    <div class="panel sv-tbl"><div class="sv-row sv-h"><span>선수</span>${LANES.map((l) => `<span style="--lc:${LANE_COLOR[l]}">${LANE_ICON[l]}${LANE_NAME[l]}</span>`).join('')}<span>합계</span></div>
      ${rows.map(({ s, ch, sum, abs }) => `<div class="sv-row ${abs ? '' : 'none'}"><a class="sv-nm" href="#/players/${esc(s.id)}"><i style="--lc:${LANE_COLOR[s.mainLane]}">${LANE_ICON[s.mainLane]}</i><b>${esc(s.name)}</b></a>
        ${LANES.map((l) => cell(s, l)).join('')}
        <div class="sv-tot ${sum > 0 ? 'up' : sum < 0 ? 'dn' : ''}">${abs ? `<b class="mono">${sum ? signed(sum) : '±0'}</b><small>${ch.length}칸</small>` : '<small>—</small>'}</div></div>`).join('')}</div>
    <p class="hint">큰 숫자는 이 변동 뒤의 점수, 작은 글씨는 이 변동 전 → 후예요. 10분 안에 이어서 바꾼 점수는 한 번의 변동으로 묶어요.${idx ? ' 이 변동 뒤에 다시 바뀐 칸은 최근 변동 탭에서 볼 수 있어요.' : ''}</p>`;
}
const seg = (arr, cur, a) => `<div class="seg">${arr.map(([v, t]) => `<button class="${cur === v ? 'on' : ''}" data-a="${a}" data-v="${v}">${t}</button>`).join('')}</div>`;

function cellHTML(s, l, c) {
  const cur = +s.p.scores?.[l] || 0;
  if (!c) return `<div class="sv-c same" data-l="${LANE_NAME[l]}"><b data-live="sv:${s.id}:${l}">${num(cur)}</b></div>`;
  const nw = Date.now() - c.at < 864e5; // 최근 24시간 안에 바뀐 칸은 테두리를 더 밝게 + NEW 표시(움직이지 않음)
  return `<div class="sv-c ${c.d > 0 ? 'up' : 'dn'}${nw ? ' new24' : ''}" data-l="${LANE_NAME[l]}" title="${md(c.at)} 변경${nw ? ' (최근 24시간)' : ''} · ${num(c.from)} → ${num(c.to)}">${nw ? '<i class="sv-new">NEW</i>' : ''}<b data-live="sv:${s.id}:${l}">${num(cur)}</b><em>${c.d > 0 ? '▲' : '▼'}${num(Math.abs(c.d))}</em><small>${num(c.from)}→${num(c.to)}</small></div>`;
}

function timeline(items) {
  const rev = [...items].reverse(), shown = V.more ? rev : rev.slice(0, 40), by = new Map();
  for (const x of shown) { const k = fmtDT(+x.at).split(' ')[0]; (by.get(k) || by.set(k, []).get(k)).push(x); }
  const P = S.st.P;
  return [...by.entries()].map(([day, xs]) => `<div class="sv-day"><h4>${esc(day)}<small>${xs.length}건</small></h4>${xs.map((x) => {
    const d = (+x.to || 0) - (+x.from || 0);
    return `<div class="sv-ev"><span class="mono">${fmtDT(+x.at).split(' ')[1] || ''}</span><b>${esc(P[x.pid]?.name || x.name || '')}</b><i style="--lc:${LANE_COLOR[x.lane]}">${LANE_ICON[x.lane]}${LANE_NAME[x.lane]}</i><span class="mono">${num(+x.from || 0)} → ${num(+x.to || 0)}</span><em class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d ? signed(d) : '±0'}</em></div>`;
  }).join('')}</div>`).join('') + (rev.length > shown.length ? `<button class="btn ghost block sv-more" data-a="svMore">이전 기록 ${rev.length - shown.length}건 더 보기</button>` : '');
}

page('scores', {
  render() {
    const st = S.st, head = `<div class="sv-top"><h1>${ic('scores')}점수 변동</h1><button class="btn ghost sm" data-a="slOpen">${ic('copy')}<span class="sv-cp-t">변경 </span>내역 복사</button></div>`;
    if (!st.list.length) return `${head}<div class="panel empty">등록된 선수가 없어요.</div>`;
    const tabs = `<div class="seg sv-tabs">${TABS.map(([v, t]) => `<button class="${V.tab === v ? 'on' : ''}" data-a="svTab" data-v="${v}">${t}</button>`).join('')}</div>`;
    if (V.tab !== 'period') { const bs = batches(2), i = V.tab === 'b1' ? 1 : 0; return `${head}${tabs}${batchView(bs.list[i], i, bs.total)}`; }
    const c = collect(), P = st.P;
    const sum = c.n ? `<div class="sv-sum"><span><b class="mono">${c.changed}</b>명</span><span><b class="mono">${c.n}</b>건</span><span class="up">▲ <b class="mono">${c.up}</b></span><span class="dn">▼ <b class="mono">${c.n - c.up}</b></span><small>${c.since ? `${md(c.since)} ~ ${md(Date.now())}` : ''}</small></div>` : '';
    const rows = c.list.map((r) => {
      const s = P[r.pid];
      return `<div class="sv-row ${r.abs ? '' : 'none'}"><a class="sv-nm" href="#/players/${esc(r.pid)}"><i style="--lc:${LANE_COLOR[s.mainLane]}">${LANE_ICON[s.mainLane]}</i><b>${esc(s.name)}</b></a>
        ${LANES.map((l) => cellHTML(s, l, r.lanes[l])).join('')}
        <div class="sv-tot ${r.sum > 0 ? 'up' : r.sum < 0 ? 'dn' : ''}">${r.abs ? `<b class="mono">${r.sum ? signed(r.sum) : '±0'}</b><small>${md(r.at)}</small>` : '<small>—</small>'}</div></div>`;
    }).join('');
    return `${head}${tabs}
      <p class="mut sv-sub">관리 화면에서 바꾼 라인 점수를 모았어요. 큰 숫자가 지금 점수, 옆이 기간 안의 변화예요. 한 라인을 여러 번 바꿨으면 처음 점수 → 지금 점수로 묶어요. <span class="sv-new">NEW</span> 표시는 최근 24시간 안에 바뀐 칸이에요.</p>
      <div class="sv-ctl">${seg(PERIODS, V.days, 'svDays')}${seg(SORTS, V.sort, 'svSort')}<label class="sv-all"><input type="checkbox" data-a="svAll" ${V.all ? 'checked' : ''}>바뀌지 않은 선수도 보기</label></div>
      ${sum}
      ${c.list.length ? `<div class="panel sv-tbl"><div class="sv-row sv-h"><span>선수</span>${LANES.map((l) => `<span style="--lc:${LANE_COLOR[l]}">${LANE_ICON[l]}${LANE_NAME[l]}</span>`).join('')}<span>합계</span></div>${rows}</div>`
        : '<div class="panel empty">이 기간에는 바뀐 라인 점수가 없어요.</div>'}
      ${c.cut ? `<p class="hint">점수 변경 기록은 최근 ${LOG_MAX}건까지만 남아서, ${fmtDT(c.cut)} 이전 변경은 빠져 있을 수 있어요.</p>` : ''}
      ${c.items.length ? `<h2 class="sv-h2">${ic('scroll')}날짜별 기록</h2><div class="panel sv-tl">${timeline(c.items)}</div>` : ''}`;
  },
});
act('svDays', (d) => { V.days = +d.v; V.more = false; refresh(); });
act('svSort', (d) => { V.sort = d.v; refresh(); });
act('svAll', (d, el) => { V.all = !!el.checked; refresh(); });
act('svMore', () => { V.more = true; refresh(); });
act('svTab', (d) => { V.tab = d.v; refresh(); });
act('svBSort', (d) => { V.bsort = d.v; refresh(); });
act('svOnly', (d, el) => { V.only = !!el.checked; refresh(); });
