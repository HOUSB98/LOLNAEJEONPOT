// 천하정세(#/guilds, 정파·마교 비교)와 문파 상점(#/gshop). 둘 다 길드 메뉴(맨 위·맨 아래). 처음 들어갈 때 받는다.
// 천하정세: 구역마다 왼쪽 정파 · 오른쪽 마교로 나눠 한눈에 비교(가운데는 비교 막대·VS). 숫자는 모두 길드 화면과 같은 계산(경기 기록에서)
// 상점: 문파 금고(냥)로 효과를 산다. 살 수 있는 사람 = 관리자, 각 문파의 무림맹주·천마(본인 PIN). 지출·효과는 meta/guild(spent·fx), 구매 기록은 gshop
import { S, page, act, esc, ic, refresh, toast, modal, closeModal, mh, isAdmin, needAdmin, champIcon, fmtDay, uid, LANES, LANE_NAME, LANE_ICON, pct, GUILDS, GK, guildMeta, guildOn, gOf, gem, gname, ghref } from './core.js';
import { dayKey } from './stats.js';
import { sysChat } from './social.js';
import { curQ, ledger, qName, gData, realm, rwins, RANKS, rankOf, counts, meId, treasury, econ, money, CUR, fxOf, fxOn, pill, FAVOR, loadAssets, leadOf, introOf, myPin, other, assetsOk } from './guild.js';
import { seal, ensureArt } from './guildart.js';

const N = (g) => GUILDS[g].n;
const wr = (v) => (v.g ? v.w / v.g : 0);
const live = () => Object.values(S.store.data.players || {}).filter((p) => !p.deleted);
const wait = (id) => { loadAssets().then(() => { if (S.page === id) refresh(); }); return '<div class="panel empty lazy-wait">불러오는 중…</div>'; };
const notYet = () => `<div class="panel empty gd-wait">${gem('j')}${gem('m')}<h2>정파 · 마교</h2><p>관리자가 문파를 창설하면 열려요.</p></div>`;
// 비교 막대(가운데): 정파 몫 %
const bar = (a, b, fmt = (v) => v) => { const t = Math.abs(a) + Math.abs(b), p = t ? Math.round((Math.abs(a) / t) * 100) : 50; return `<div class="wl-bar"><b class="j">${fmt(a)}</b><i style="--p:${p}%"></i><b class="m">${fmt(b)}</b></div>`; };
const sec = (k, t, hj, j, m, mid = '') => `<section class="wl-row" data-k="${k}"><div class="wl-h gd-j"><span class="wl-gem">${gem('j')}</span>${j}</div><div class="wl-mid"><i class="wl-hj">${hj}</i><b>${t}</b>${mid}</div><div class="wl-h gd-m"><span class="wl-gem">${gem('m')}</span>${m}</div></section>`;

// ---------- 천하정세 ----------
page('guilds', {
  keyed: true, title: '천하정세',
  render() {
    if (!assetsOk()) return wait('guilds');
    if (!guildOn()) return notYet();
    ensureArt();
    const all = gData('all'), q = gData('q'), car = gData('car'), T = treasury(), c = counts();
    const mem = (g) => live().filter((p) => p.guild === g).map((p) => p.id);
    const avg = (g, f) => { const ids = mem(g).map((id) => S.st.P[id]).filter(Boolean); return ids.length ? ids.reduce((a, s) => a + f(s), 0) / ids.length : 0; };
    const kda = (d) => (d.kdaG ? (d.kda[0] + d.kda[2]) / Math.max(1, d.kda[1]) : 0);
    const top3 = (d) => Object.values(d.champs).sort((a, b) => b.g - a.g).slice(0, 3);
    const lane = (d) => LANES.filter((l) => d.lanes[l].g >= 5).sort((a, b) => wr(d.lanes[b]) - wr(d.lanes[a]))[0];
    const head = (g) => { const rl = realm(rwins(g)), ld = leadOf(g); return `<a class="wl-hero" href="${ghref(g)}"><span class="wl-seal">${seal(g, rl.lv)}</span><span class="wl-id"><small>${GUILDS[g].en}</small><b>${GUILDS[g].h} ${N(g)}</b><em>${esc(introOf(g))}</em><span class="wl-meta">${GUILDS[g].lead} <u>${ld ? gname(ld) : '미정'}</u> · ${GUILDS[g].mem} ${c[g]}명 · 경지 <u>${rl.n}</u></span></span><span class="wl-go">${N(g)} 가기 ›</span></a>`; };
    const rec = (d) => `<div class="wl-big"><b class="mono">${d.w}</b><small>승</small><b class="mono">${d.g - d.w}</b><small>패</small></div><span class="wl-sub">${d.g ? `승률 ${(wr(d) * 100).toFixed(1)}%` : '아직 경기 없음'}</span>`;
    const ranks = (g) => { const ids = mem(g), rs = ids.map((id) => rankOf(g, id).n); return `<div class="wl-rk">${[GUILDS[g].lead, ...[...RANKS[g]].reverse().map((x) => x[1])].map((n) => { const k = rs.filter((x) => x === n).length; return k ? `<span>${esc(n)} <b>${k}</b></span>` : ''; }).join('')}</div>`; };
    const champs = (d) => { const t = top3(d); return t.length ? `<div class="wl-ch">${t.map((x) => `<span>${champIcon(x.name, 'sm')}<b>${esc(x.name)}</b><small>${x.g}판 · ${pct(x.w, x.g)}%</small></span>`).join('')}</div>` : '<span class="wl-sub">아직 기록 없음</span>'; };
    const wars = all.wars.slice(0, 6);
    // 보유 아이템(상점 효과): 지금 걸려 있는 것과 남은 시간, 영약 개수, 지금까지 산 횟수
    const left = (exp) => { const h = Math.max(0, Math.round((+exp - Date.now()) / 3600e3)); return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`; };
    const items = (g) => { const f = fxOf(g), out = [];
      if (fxOn(g, 'feast')) out.push(['🏮', '연회', `${left(f.feast.exp)} 남음`]);
      if (fxOn(g, 'banner')) out.push(['📯', '포고문', `${esc(f.banner.t || '')} · ${left(f.banner.exp)}`]);
      if (fxOn(g, 'favor')) out.push(['🎖️', '총애 하사', `${esc(S.st.P[f.favor.id]?.name || '?')} · ${left(f.favor.exp)}`]);
      if (fxOn(g, 'chal')) out.push(['⚔️', '도전장', `${left(f.chal.exp)} 남음`]);
      if (pill(g)) out.push(['💊', '영약', `${pill(g)}개 · 경지 +${pill(g) * 10}승`]);
      return out.length ? `<ul class="wl-it">${out.map(([e, n, d]) => `<li><span>${e}</span><b>${n}</b><small>${d}</small></li>`).join('')}</ul>` : '<span class="wl-sub">보유한 아이템 없음</span>'; };
    const warList = (g) => { const w = wars.filter((x) => x.wg === g); return w.length ? `<ul class="wl-wl">${w.slice(0, 3).map((x) => `<li><em>정마대전</em><span>${fmtDay(dayKey(x.m.at)).slice(5)} 승리</span></li>`).join('')}</ul>` : '<span class="wl-sub">최근 승리 없음</span>'; };
    return `<div class="wl">
      <div class="h2row" data-k="h"><h1>${ic('guilds')}천하정세</h1><span class="tag">정파 vs 마교</span><span class="grow"></span><small class="mut">왼쪽 정파 · 오른쪽 마교</small></div>
      <section class="wl-row wl-top" data-k="top"><div class="wl-h gd-j wl-scene">${head('j')}</div><div class="wl-mid wl-vs"><b>VS</b></div><div class="wl-h gd-m wl-scene">${head('m')}</div></section>
      ${sec('gold', '문파 금고', '庫', `<div class="wl-big"><b class="mono">${money(T.j.bal)}</b></div><span class="wl-sub">이번 주 ${T.j.week >= 0 ? '+' : ''}${money(T.j.week)}</span>`, `<div class="wl-big"><b class="mono">${money(T.m.bal)}</b></div><span class="wl-sub">이번 주 ${T.m.week >= 0 ? '+' : ''}${money(T.m.week)}</span>`, bar(T.j.bal, T.m.bal, (v) => money(v)) + '<a class="lnk sm" href="#/gshop">상점 가기</a>')}
      ${sec('it', '보유 아이템', '寶', items('j'), items('m'), '<a class="lnk sm" href="#/gshop">상점에서 사기</a>')}
      ${sec('war', '정마대전', '爭', `<div class="wl-big"><b class="mono">${q.j.war.w}</b><small>승</small></div><span class="wl-sub">이번 분기 · 창설 이후 ${all.j.war.w}승</span>${warList('j')}`, `<div class="wl-big"><b class="mono">${q.m.war.w}</b><small>승</small></div><span class="wl-sub">이번 분기 · 창설 이후 ${all.m.war.w}승</span>${warList('m')}`, bar(q.j.war.w, q.m.war.w) + GK.filter((G) => fxOn(G, 'chal')).map((G) => `<em class="wl-chal">⚔️ ${N(G)} 도전장</em>`).join(''))}
      ${sec('q', '이번 분기 전적', '勢', rec(q.j), rec(q.m), bar(Math.round(wr(q.j) * 1000) / 10, Math.round(wr(q.m) * 1000) / 10, (v) => v + '%'))}
      ${sec('all', '창설 이후 전적', '史', rec(all.j), rec(all.m), bar(all.j.w, all.m.w, (v) => v + '승'))}
      ${sec('pw', '전력', '力', `<dl class="wl-dl"><div><dt>평균 MMR</dt><dd class="mono">${Math.round(avg('j', (s) => s.mmr)) || '—'}</dd></div><div><dt>통산 KDA</dt><dd class="mono">${kda(car.j).toFixed(2)}</dd></div><div><dt>통산 승률</dt><dd class="mono">${(wr(car.j) * 100).toFixed(1)}%</dd></div></dl>`, `<dl class="wl-dl"><div><dt>평균 MMR</dt><dd class="mono">${Math.round(avg('m', (s) => s.mmr)) || '—'}</dd></div><div><dt>통산 KDA</dt><dd class="mono">${kda(car.m).toFixed(2)}</dd></div><div><dt>통산 승률</dt><dd class="mono">${(wr(car.m) * 100).toFixed(1)}%</dd></div></dl>`, bar(Math.round(avg('j', (s) => s.mmr)), Math.round(avg('m', (s) => s.mmr))))}
      ${sec('rk', '문파 직위', '門', ranks('j'), ranks('m'), `<small class="mut">직위 = 내전 통산 판수</small>`)}
      ${sec('ch', '대표 챔피언', '兵', champs(car.j), champs(car.m), '<small class="mut">문도·교도 통산 많이 쓴 순</small>')}
      ${sec('ln', '강세 라인', '陣', (() => { const l = lane(car.j); return l ? `<div class="wl-big"><b>${LANE_ICON[l]} ${LANE_NAME[l]}</b></div><span class="wl-sub">승률 ${pct(car.j.lanes[l].w, car.j.lanes[l].g)}% · ${car.j.lanes[l].g}판</span>` : '<span class="wl-sub">기록 부족</span>'; })(), (() => { const l = lane(car.m); return l ? `<div class="wl-big"><b>${LANE_ICON[l]} ${LANE_NAME[l]}</b></div><span class="wl-sub">승률 ${pct(car.m.lanes[l].w, car.m.lanes[l].g)}% · ${car.m.lanes[l].g}판</span>` : '<span class="wl-sub">기록 부족</span>'; })(), '<small class="mut">통산 5판 이상 라인 중 승률 1위</small>')}
    </div>`;
  },
});

// ---------- 문파 상점 ----------
// 효과는 모두 화면 표시만 바꾼다(경기 기록·점수·팀 짜기에는 영향 없음)
export const SHOP = [
  { id: 'post', n: '전서구', p: 3000, e: '📜', d: '사이트 채팅에 우리 문파 이름으로 공지 한 줄을 띄워요.', ask: '채팅에 띄울 한 줄' },
  { id: 'feast', n: '연회', p: 6000, e: '🏮', d: '24시간 동안 문파 화면 현판에 연회 장식(정파 매화 등불 · 마교 혈등)이 걸려요.', hours: 24 },
  { id: 'favor', n: '총애 하사', p: 10000, e: '🎖️', d: '문도·교도 한 명에게 7일 동안 특별 칭호(맹주의 총애 · 천마의 총애)를 내려요.', pick: true, hours: 168 },
  { id: 'chal', n: '도전장', p: 15000, e: '⚔️', d: '상대 문파에 정마대전 도전장을 보내요. 채팅 공지 + 24시간 동안 천하정세·상대 문파 화면에 도전장 표시.', hours: 24 },
  { id: 'banner', n: '포고문', p: 20000, e: '📯', d: '24시간 동안 모든 사람의 홈 화면 맨 위에 우리 문파 포고문 한 줄이 걸려요.', ask: '포고문 내용', hours: 24 },
  { id: 'pill', n: '영약', p: 50000, e: '💊', d: '문파 경지 게이지에 10승을 영구히 더해요(엠블럼 별이 빨리 늘어나요).' },
];
const canBuy = (g) => isAdmin() || (!!leadOf(g) && leadOf(g) === meId());
const SH = { logs: [], un: null };
function shWatch() { if (SH.un) return; SH.un = S.store.watchRecent('gshop', 20, (docs) => { SH.logs = docs; if (S.page === 'gshop') refresh(); }, () => {}); }
addEventListener('hashchange', () => setTimeout(() => { if (S.page !== 'gshop' && SH.un) { SH.un(); SH.un = null; } }, 0));
page('gshop', {
  keyed: true, title: '문파 상점',
  render() {
    if (!assetsOk()) return wait('gshop');
    if (!guildOn()) return notYet();
    ensureArt(); shWatch();
    const T = treasury(), e = econ();
    const vault = (g) => { const t = T[g], fx = []; if (fxOn(g, 'feast')) fx.push('🏮 연회 중'); if (fxOn(g, 'banner')) fx.push('📯 포고문 게시 중'); if (fxOn(g, 'chal')) fx.push('⚔️ 도전장 발송'); if (fxOn(g, 'favor')) fx.push(`🎖️ ${esc(S.st.P[fxOf(g).favor.id]?.name || '?')} 총애`); if (pill(g)) fx.push(`💊 영약 ${pill(g)}개`);
      return `<div class="wl-h gd-${g} gs-v"><span class="wl-gem">${gem(g)}</span><small>${N(g)} 금고</small><div class="wl-big"><b class="mono">${money(t.bal)}</b></div>
        <dl class="gs-dl"><div><dt>일반 내전 승리</dt><dd>+${money(t.win)}</dd></div><div><dt>일반 내전 패배</dt><dd>−${money(t.lose)}</dd></div><div><dt>정마대전</dt><dd>+${money(t.gwWin)} / −${money(t.gwLose)}</dd></div><div><dt>상점 지출</dt><dd>−${money(t.spent)}</dd></div>${t.adj ? `<div><dt>관리자 조정</dt><dd>${t.adj > 0 ? '+' : '−'}${money(Math.abs(t.adj))}</dd></div>` : ''}</dl>
        <span class="wl-sub">${fx.length ? fx.join(' · ') : '진행 중인 효과 없음'}</span><span class="gs-who">${canBuy(g) ? '구매 가능' : `구매: 관리자 · ${GUILDS[g].lead}`}</span></div>`; };
    return `<div class="wl gs">
      <div class="h2row" data-k="h"><h1>${ic('gshop')}문파 상점</h1><span class="tag">단위 ${CUR}</span><span class="grow"></span></div>
      <section class="wl-row" data-k="v">${vault('j')}<div class="wl-mid"><i class="wl-hj">庫</i><b>금고</b>${bar(T.j.bal, T.m.bal, (v) => money(v))}</div>${vault('m')}</section>
      <p class="hint gs-rule" data-k="r">${ic('coin')} 버는 법: 일반 내전에서 문도·교도가 이기면 한 사람당 <b>+${e.win}${CUR}</b>, 지면 <b>−${e.lose}${CUR}</b>. 정마대전(블루·레드가 각각 한 문파로만 구성된 경기)은 이긴 문파 <b>+${e.gwWin}${CUR}</b>, 진 문파 <b>−${e.gwLose}${CUR}</b>. 소속이 3명 이상이 된 문파부터 쌓이고, 금고는 분기가 바뀌어도 그대로 이어져요. 기준은 관리자가 바꿀 수 있어요.</p>
      <section class="gs-items" data-k="it">${SHOP.map((it) => `<div class="gs-it"><span class="gs-e">${it.e}</span><b>${it.n}</b><em class="mono">${money(it.p)}</em><p>${it.d}</p><div class="row">${GK.map((g) => `<button class="btn xs gs-b g-${g}" data-a="gsBuy" data-i="${it.id}" data-g="${g}" ${canBuy(g) && T[g].bal >= it.p ? '' : 'disabled'} title="${canBuy(g) ? (T[g].bal >= it.p ? `${N(g)} 금고로 구매` : '금고가 부족해요') : `관리자 · ${GUILDS[g].lead}만 살 수 있어요`}">${gem(g)}${N(g)}</button>`).join('')}</div></div>`).join('')}</section>
      <section class="gp gs-log" data-k="lg"><div class="gp-h"><i class="gp-hj" aria-hidden="true">帳</i><b>구매 기록</b></div>${SH.logs.length ? `<ul class="gs-ul">${SH.logs.map((x) => `<li>${gem(x.g)}<b>${esc(SHOP.find((i) => i.id === x.item)?.n || x.item)}</b><span>${esc(x.note || '')}</span><small>${money(x.p)} · ${esc(x.by || '')} · ${fmtDay(dayKey(x.at)).slice(5)}</small></li>`).join('')}</ul>` : '<p class="gp-none"><span>아직 구매 기록이 없어요.</span></p>'}</section>
    </div>`;
  },
});
act('gsBuy', async (d) => {
  const g = d.g, it = SHOP.find((x) => x.id === d.i); if (!it || !GUILDS[g]) return;
  if (!canBuy(g)) return toast(`관리자 · ${GUILDS[g].lead}만 살 수 있어요`);
  if (treasury()[g].bal < it.p) return toast('금고가 부족해요');
  let note = '', target = '';
  if (it.ask) { note = await askText(`${it.e} ${it.n}`, `${it.ask} (60자까지)`); if (!note) return; }
  if (it.pick) {
    const ids = live().filter((p) => p.guild === g);
    const el = modal(`${mh(`${it.n} · 받을 사람`)}<div class="gs-pick">${ids.map((p) => `<button class="btn" data-a="gsPick" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`);
    target = await new Promise((res) => { SH.pick = res; new MutationObserver((_, ob) => { if (!el.isConnected || !document.querySelector('.gs-pick')) { ob.disconnect(); res(''); } }).observe(document.getElementById('modal'), { childList: true }); });
    if (!target) return;
    note = S.store.data.players[target]?.name || '';
  }
  if (!confirm(`${N(g)} 금고 ${money(it.p)}로 '${it.n}'을(를) 살까요?${note ? `\n${note}` : ''}`)) return;
  if (!isAdmin() && !(await myPin(meId(), `${GUILDS[g].lead}만 문파 금고를 쓸 수 있어요.`))) return;
  const now = Date.now(), fx = {};
  if (it.hours) fx[it.id] = it.id === 'favor' ? { id: target, exp: now + it.hours * 3600e3 } : it.id === 'banner' ? { t: note, exp: now + it.hours * 3600e3 } : { exp: now + it.hours * 3600e3 };
  try {
    await S.store.tx('meta', 'guild', (r) => {
      if (!r) return null;
      const q = curQ(), sq = { ...(r.sq || {}) }; sq[q] = { ...(sq[q] || {}) }; sq[q][g] = (+sq[q][g] || 0) + it.p; // 이번 분기 지출(금고는 분기마다 새로 시작)
      const cur = { ...((r.fx || {})[g] || {}) };
      if (it.id === 'pill') cur.pill = (+cur.pill || 0) + 1; else Object.assign(cur, fx);
      return { ...r, sq, fx: { ...(r.fx || {}), [g]: cur } };
    });
    const by = isAdmin() ? '관리자' : S.store.data.players[meId()]?.name || '';
    await S.store.put('gshop', uid(), { at: now, g, item: it.id, p: it.p, by, note, deleted: false });
    if (it.id === 'post') sysChat(`📜 [${N(g)} 전서구] ${note}`);
    if (it.id === 'chal') sysChat(`⚔️ ${N(g)}이(가) ${N(other(g))}에 정마대전 도전장을 보냈습니다!`);
    if (it.id === 'banner') sysChat(`📯 ${N(g)} 포고문: ${note}`);
    if (it.id === 'favor') sysChat(`🎖️ ${note}님이 ${FAVOR[g]}을(를) 받았어요`);
    toast(`'${it.n}'을(를) 샀어요`);
  } catch (e) { toast('실패: ' + (e.code || e.message)); }
});
// 한 줄 입력 창(전서구·포고문): 브라우저 기본 입력창 대신 사이트 창
function askText(title, ph) {
  return new Promise((res) => {
    const el = modal(`${mh(esc(title))}<form class="col" id="gsask"><input class="inp" id="gsask-t" maxlength="60" autocomplete="off" placeholder="${esc(ph)}" aria-label="${esc(ph)}"><button class="btn pri">다음</button></form>`);
    el.querySelector('#gsask-t').focus();
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    new MutationObserver((_, ob) => { if (!document.getElementById('gsask')) { ob.disconnect(); fin(''); } }).observe(document.getElementById('modal'), { childList: true });
    el.querySelector('#gsask').addEventListener('submit', (e) => { e.preventDefault(); const v = el.querySelector('#gsask-t').value.trim().slice(0, 60); if (!v) return toast('내용을 써 주세요'); fin(v); closeModal(); });
  });
}
act('gsPick', (d) => { const f = SH.pick; SH.pick = null; closeModal(); f?.(d.id); });

// 관리 > 길드: 금고 기준·조정
export function econAdminHTML() {
  if (!guildOn()) return '';
  const e = econ(), gm = guildMeta();
  return archiveHTML() + `<div class="panel gadm"><div class="ph"><b>${ic('coin')}문파 금고 기준</b><small class="mut">단위 ${CUR} · 금고는 계속 이어짐 · 기준을 바꾸면 지난 기록도 새 기준으로 다시 계산</small></div>
    <div class="ga-econ">${[['win', '일반 내전 승리(1인당 +)'], ['lose', '일반 내전 패배(1인당 −)'], ['gwWin', '정마대전 승리(문파 +)'], ['gwLose', '정마대전 패배(문파 −)']].map(([k, n]) => `<label class="fld"><span>${n}</span><input class="inp mono" id="ge-${k}" type="number" min="0" step="1" value="${e[k]}"></label>`).join('')}</div>
    <div class="row wrapr"><button class="btn xs" data-a="geSave">기준 저장</button></div>
    <div class="ga-econ">${GK.map((g) => `<label class="fld"><span>${N(g)} 이번 분기 관리자 조정(지금 ${(+gm.aq?.[curQ()]?.[g] || 0) >= 0 ? '+' : ''}${+gm.aq?.[curQ()]?.[g] || 0}${CUR})</span><input class="inp mono" id="ga-adj-${g}" type="number" step="10" placeholder="예: 500 또는 -200"></label>`).join('')}</div>
    <div class="row wrapr"><button class="btn xs" data-a="geAdj">조정 더하기</button></div></div>`;
}
act('geSave', () => needAdmin(async () => { const v = {}; for (const k of ['win', 'lose', 'gwWin', 'gwLose']) v[k] = Math.max(0, Math.round(+document.getElementById('ge-' + k).value || 0)); await S.store.patch('meta', 'guild', { econ: v }); toast('금고 기준을 저장했어요'); }));
act('geAdj', () => needAdmin(async () => {
  const add = Object.fromEntries(GK.map((g) => [g, Math.round(+document.getElementById('ga-adj-' + g).value || 0)]));
  if (!add.j && !add.m) return toast('조정할 금액을 넣어 주세요');
  const q = curQ();
  await S.store.tx('meta', 'guild', (r) => (r ? { ...r, aq: { ...(r.aq || {}), [q]: Object.fromEntries(GK.map((g) => [g, (+r.aq?.[q]?.[g] || 0) + add[g]])) } } : null));
  toast('금고를 조정했어요');
}));

// 관리 > 문파: 분기 결과 보관(창설 이후 모든 분기, 최근 분기부터). 저장하지 않고 경기 기록에서 계산 → 경기를 고치면 결과도 따라 바뀜
function archiveHTML() {
  const L = ledger(), qs = Object.keys(L).sort().reverse(), now = curQ();
  const row = (x) => { const w = x.war.j === x.war.m ? (x.j.w / Math.max(1, x.j.g) === x.m.w / Math.max(1, x.m.g) ? '' : x.j.w / Math.max(1, x.j.g) > x.m.w / Math.max(1, x.m.g) ? 'j' : 'm') : x.war.j > x.war.m ? 'j' : 'm';
    return `<tr class="${x.q === now ? 'now' : ''}"><td class="l"><b>${qName(x.q)}</b>${x.q === now ? ' <em class="tag">진행 중</em>' : ''}</td><td>${w ? `${gem(w)}${N(w)}` : '무승부'}</td><td class="mono">${x.gw.j} : ${x.gw.m}</td>${GK.map((g) => `<td class="mono">${x[g].w}승 ${x[g].g - x[g].w}패</td><td class="mono">${money(x[g].earn)} / −${money(x[g].spent)}${x[g].adj ? ` / ${x[g].adj > 0 ? '+' : '−'}${money(Math.abs(x[g].adj))}` : ''}<br><b>${money(x[g].bal)}</b></td>`).join('')}</tr>`; };
  return `<div class="panel gadm"><div class="ph"><b>${ic('scroll')}분기 결과 보관</b><small class="mut">분기 승자 = 정마대전 승수(같으면 문파 승률) · 금고 칸은 그 분기 수입 / 지출 / 조정과 그 분기 몫(금고 잔액은 분기와 상관없이 계속 이어짐)</small></div>
    <div class="tw"><table class="tbl ga-arc"><thead><tr><th class="l">분기</th><th>승자</th><th>정마대전</th><th>정파 전적</th><th>정파 금고 (수입 / 지출 → 남음)</th><th>마교 전적</th><th>마교 금고 (수입 / 지출 → 남음)</th></tr></thead>
    <tbody>${qs.map((q) => row(L[q])).join('') || '<tr><td colspan="7" class="empty">아직 기록이 없어요</td></tr>'}</tbody></table></div></div>`;
}
