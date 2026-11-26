// 길드(#/jeongpa 정파, #/magyo 마교 — 각각 다른 화면): 정파·마교 두 문파. 소속감을 위한 '길드 기록실' + 대항전 + 길드 게시판(채팅은 채팅창 길드 탭).
// 저장하는 통계는 없다. 모든 숫자는 경기 기록에서 매번 계산한다(통계 S.st·길드 정보가 바뀔 때만 다시 계산, 화면을 열 때만).
// · 길드 전적(승률) = 길드원이 뛴 모든 경기의 승수 ÷ 판수(같은 경기에 길드원 3명이면 3번 셈), 창설일부터. 경기 당시 소속(players.glog)으로 센다
// · 대항전 = 한 팀에 한 길드가 3명 이상(다수)이고 상대 팀은 다른 길드가 다수인 경기. 이긴 쪽 다수 길드가 1승. 시즌 = 분기(1~3월 = 1분기)
// · 길드전 = 오늘의 내전에서 '길드전'으로 짠 경기(matches.gw)
// · 길드원 통산 = 지금 길드원의 전체 경기(창설 전 포함). 공식 기록이 아니라 '전력' 참고용
// · 길드 채팅은 채팅창의 정파·마교 탭(js/gchat.js, 길드 비밀번호·암호화). 길드 게시판은 이 화면(공개, gboard_j·gboard_m)
// DB 읽기: 길드 화면을 보는 동안 게시판 최신 30개 실시간, 채팅창 길드 탭을 보는 동안 채팅 최신 60개. 그 밖에는 0
import { S, page, act, esc, ic, refresh, col, toast, modal, closeModal, mh, sha, needAdmin, isAdmin, champIcon, artUrl, cardChamp, fmtDay, dots, go, uid, LANES, LANE_NAME, LANE_ICON, LANE_COLOR, pct, GUILDS, GK, guildMeta, guildOn, gOf, gAt, gem, gname, GPAGE, ghref, pureWar, gActiveFrom } from './core.js';
import { dayKey } from './stats.js';
import { seal, ensureArt, drift, entryFx } from './guildart.js';
import { hasKey, unlock } from './gchat.js';
import { nick, sysChat } from './social.js';
import { notify } from './hook.js';

// ---------- 화면 전용 스타일·글꼴(이 화면을 처음 열 때만 받음) ----------
const HANJA = '正派魔敎天下爭霸武林盟主教一二三四季';
const HEADS = '가간강같개걷걸검게겨격결겼경계고골공과관광교구굵균그근글금기긴길까꺾께꾸꿀뀌나난남내냈냥넣년누눠눴뉴는늘능니님다단달담당대댓더도동돼되됨두뒤듀든들등때또뛴띄라람래러럼려력련렸로록류률르른를름리림마만많말맞매맨맹먼메면명모목못무묶문미밀바반받발배버번법별병보본볼부분불블비빨빼사삭산살삼샀상새생서섞선설성세소속송수순숭스습슷승시식신실싶쌓써쓰쓴쓸아안않알았애액야약어언없엇에엠여연열영예오올옮와외왼요용우운울워원월웠위유으은을음의이익인일읽입있자작잡장쟁저적전절점정제져조족좋주준줄중즌지직진질짝짠쪽차창채챔챠처천첫체초총최추출취칠칭킬타탭터템통트특팀팅파판패페평포표풍피필하한할함합항해했행향혁현혈형호홈화확활회효후흐히'; // 문파 화면의 고정 글자(제목·이름표·안내) 전부: 이 글자만 담은 아주 작은 붓글씨 글꼴을 받는다
let ASSETS = null, ASSET_OK = false; // 미리 받기(app.js LAZY_GET)로 모듈만 받을 때는 스타일·글꼴을 받지 않는다
function loadAssets() {
  if (ASSETS) return ASSETS;
  const v = window.NP_V ? '?v=' + window.NP_V : '';
  const l = document.createElement('link'); l.id = 'gd-css'; l.rel = 'stylesheet'; l.href = 'css/guild.css' + v;
  const p = new Promise((r) => { l.onload = l.onerror = r; setTimeout(r, 1500); });
  document.head.appendChild(l);
  const f = document.createElement('link'); f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Song+Myung&display=swap&text=' + encodeURIComponent([...new Set(HANJA + HEADS + '0123456789.%—·' + GK.map((g) => (guildMeta()?.intro?.[g] || '') + (guildMeta()?.notice?.[g]?.t || '')).join(''))].join(''));
  document.head.appendChild(f);
  return (ASSETS = p.then(() => { ASSET_OK = true; }));
}

// ---------- 나·인원 ----------
const MEK = () => 'naejeon:me:' + S.key;
export function meId() {
  let id = '';
  try { id = localStorage.getItem(MEK()) || localStorage.getItem('naejeon:bdme:' + S.key) || JSON.parse(localStorage.getItem('naejeon:gme:' + S.key) || 'null')?.pid || ''; } catch {}
  const p = S.store.data.players?.[id]; return p && !p.deleted ? id : '';
}
const live = () => col('players').filter((p) => !p.deleted);
export const counts = () => { const c = { j: 0, m: 0 }; live().forEach((p) => { if (GUILDS[p.guild]) c[p.guild]++; }); return c; };
export const smaller = () => { const c = counts(); return c.j === c.m ? '' : c.j < c.m ? 'j' : 'm'; };
const other = (g) => (g === 'j' ? 'm' : 'j');
const qKey = (t) => { const d = dayKey(t); return `${d.slice(0, 4)}Q${Math.ceil(+d.slice(5, 7) / 3)}`; };
const qName = (q) => `${q.slice(0, 4)}년 ${q.slice(5)}분기`;
const wkKey = (t) => { const d = new Date(dayKey(t) + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime() + 6 * 3600e3); };
const nameOf = (id) => S.st?.P[id]?.name || S.store.data.players?.[id]?.name || '?';
const K = 10, bWr = (v) => (v.w + K / 2) / (v.g + K); // 판수가 적으면 50%에 가깝게(연말 결산과 같은 보정 승률)
const wrs = (v) => (v.g ? `${pct(v.w, v.g)}%` : '—');

// ---------- 경지(엠블럼 진화): 창설 뒤 길드 누적 승수 ----------
export const REALMS = [[0, '삼류'], [10, '이류'], [30, '일류'], [60, '절정'], [100, '초절정'], [160, '화경'], [250, '현경'], [400, '생사경']];
export function realm(w) { let i = 0; while (i + 1 < REALMS.length && w >= REALMS[i + 1][0]) i++; const nx = REALMS[i + 1]; return { lv: i, n: REALMS[i][1], next: nx ? nx[1] : '', need: nx ? nx[0] - w : 0, p: nx ? (w - REALMS[i][0]) / (nx[0] - REALMS[i][0]) : 1 }; }

// ---------- 계산: mode 'q'(이번 분기) · 'all'(창설 이후) · 'car'(지금 길드원 통산) ----------
let MEMO = { st: null, gm: null, v: {} };
export function gData(mode) {
  const gm = guildMeta();
  if (MEMO.st !== S.st || MEMO.gm !== gm) MEMO = { st: S.st, gm, v: {} };
  if (MEMO.v[mode]) return MEMO.v[mode];
  const t0 = +gm?.at || 0, curQ = qKey(Date.now()), curW = wkKey(Date.now());
  const B = () => ({ g: 0, w: 0 });
  const mk = () => ({ g: 0, w: 0, mem: {}, lanes: Object.fromEntries(LANES.map((l) => [l, B()])), champs: {}, kda: [0, 0, 0], kdaG: 0, duo: {}, feed: [], wk: {}, week: B(), war: B(), warCur: 0, warMax: 0, gw: B(), miles: [], first: null, firstWar: null, firstGw: null, killMax: null, games: 0 });
  const D = { j: mk(), m: mk(), wars: [], q: curQ, t0 };
  const MILES = [...new Set([10, 50, 100, 200, 300, 500, 1000, ...REALMS.slice(1).map((x) => x[0])])].sort((a, b) => a - b);
  for (const m of S.st.matches) {
    if (mode !== 'car' && m.at < t0) continue;
    if (mode === 'q' && qKey(m.at) !== curQ) continue;
    const gs = {}, inM = { j: null, m: null };
    for (const side of ['blue', 'red']) {
      gs[side] = m[side].map((id) => { if (mode === 'car') return gOf(id); const G = gAt(id, m.at); return G && m.at >= gActiveFrom(G) ? G : ''; }); // 문파 기록은 소속 3명이 된 뒤부터
      const win = m.winner === side;
      gs[side].forEach((G, i) => {
        if (!G) return;
        const d = D[G], id = m[side][i], l = LANES[i];
        const before = d.w;
        d.g++; if (win) d.w++;
        d.lanes[l].g++; if (win) d.lanes[l].w++;
        if (wkKey(m.at) === curW) { d.week.g++; if (win) d.week.w++; }
        const wk = (d.wk[wkKey(m.at)] ||= B()); wk.g++; if (win) wk.w++;
        const me = (d.mem[id] ||= { g: 0, w: 0, cur: 0, max: 0 });
        me.g++; if (win) { me.w++; me.cur++; if (me.cur > me.max) me.max = me.cur; } else me.cur = 0;
        const ch = m.champs?.[side]?.[i];
        if (ch) { const c = (d.champs[ch] ||= { name: ch, g: 0, w: 0, users: {} }); c.g++; if (win) c.w++; c.users[id] = (c.users[id] || 0) + 1; }
        const k = m.kda?.[id];
        if (Array.isArray(k)) { d.kdaG++; k.forEach((v, j) => (d.kda[j] += +v || 0)); if (!d.killMax || +k[0] > d.killMax.k) d.killMax = { id, k: +k[0], kda: k, m }; }
        if (win && !d.first) d.first = { m, id };
        for (const n of MILES) if (before < n && d.w >= n) d.miles.push({ n, at: m.at });
        const x = (inM[G] ||= { win: 0, lose: 0, ids: [] }); x.ids.push([id, side, i]); if (win) x.win++; else x.lose++;
      });
      // 같은 팀 길드원 듀오
      for (const G of GK) {
        const ix = gs[side].map((g, i) => (g === G ? i : -1)).filter((i) => i >= 0);
        for (let a = 0; a < ix.length; a++) for (let b = a + 1; b < ix.length; b++) {
          const x = m[side][ix[a]], y = m[side][ix[b]], key = x < y ? x + '|' + y : y + '|' + x;
          const p = (D[G].duo[key] ||= B()); p.g++; if (win) p.w++;
        }
      }
    }
    for (const G of GK) if (inM[G]) { D[G].games++; D[G].feed.push({ m, ...inM[G] }); }
    // 정마대전: 양 팀이 각각 한 문파로만 구성(용병 0명)
    const pw = pureWar(m.blue, m.red, (id) => gs.blue[m.blue.indexOf(id)] || gs.red[m.red.indexOf(id)] || '');
    if (pw) {
      const wg = pw[m.winner], lg = other(wg);
      D[wg].war.g++; D[wg].war.w++; D[lg].war.g++; D[wg].gw.g++; D[wg].gw.w++; D[lg].gw.g++;
      D[wg].warCur++; D[wg].warMax = Math.max(D[wg].warMax, D[wg].warCur); D[lg].warCur = 0;
      if (!D[wg].firstWar) D[wg].firstWar = m;
      for (const G of GK) if (!D[G].firstGw) D[G].firstGw = m;
      D.wars.push({ m, wg, b: pw.blue, r: pw.red, gw: true, merc: 0 });
    }
  }
  for (const G of GK) D[G].feed.reverse();
  D.wars.reverse();
  return (MEMO.v[mode] = D);
}

// ---------- 문파 금고(돈, 단위 냥): 저장하지 않고 경기 기록에서 계산 + 상점 지출·관리자 조정만 meta/guild에 ----------
// 창설 뒤 일반 내전: 문도·교도가 이기면 한 판에 +win냥, 지면 -lose냥(사람마다). 정마대전(오늘의 내전 '정마대전'으로 짠 대항전): 이긴 문파 +gwWin냥, 진 문파 -gwLose냥
export const CUR = '냥';
export const ECON_DEF = { win: 10, lose: 5, gwWin: 100, gwLose: 50 };
export const econ = () => ({ ...ECON_DEF, ...(guildMeta()?.econ || {}) });
export const money = (n) => `${Math.round(n).toLocaleString()}${CUR}`;
// 금고 장부는 분기별로 나눠 계산하고(분기 수입 − 분기 지출 sq[분기] + 분기 조정 aq[분기]), 금고 잔액은 모든 분기를 더한다(초기화 없음)
// ledger() = 분기별 장부(창설 이후 모든 분기): 금고·대항전·전적. 관리 > 문파 '분기 결과 보관'이 이것을 보여 준다(저장 없음, 경기 기록에서 계산)
export const curQ = () => qKey(Date.now());
let LMEMO = { st: null, gm: null, v: null };
export function ledger() {
  const gm = guildMeta();
  if (LMEMO.st === S.st && LMEMO.gm === gm && LMEMO.v) return LMEMO.v;
  const e = econ(), t0 = +gm?.at || 0, wk = wkKey(Date.now()), L = {};
  const blank = (q) => ({ q, war: { j: 0, m: 0 }, gw: { j: 0, m: 0 }, ...Object.fromEntries(GK.map((g) => [g, { win: 0, lose: 0, gwWin: 0, gwLose: 0, earn: 0, week: 0, spent: +gm?.sq?.[q]?.[g] || 0, adj: +gm?.aq?.[q]?.[g] || 0, bal: 0, g: 0, w: 0 }])) });
  const Q = (q) => (L[q] ||= blank(q));
  if (t0) Q(curQ());
  for (const m of S.st.matches) {
    if (m.at < t0) continue;
    const x = Q(qKey(m.at)), T = x;
    const ga = (id) => { const G = gAt(id, m.at); return G && m.at >= gActiveFrom(G) ? G : ''; }; // 소속 3명이 된 뒤부터
    const gs = { blue: m.blue.map(ga), red: m.red.map(ga) };
    const pw = pureWar(m.blue, m.red, ga);
    const thisWeek = wkKey(m.at) === wk;
    for (const side of ['blue', 'red']) gs[side].forEach((G) => { if (!G) return; T[G].g++; if (m.winner === side) T[G].w++; });
    if (pw) { const wg = pw[m.winner]; x.war[wg]++; x.gw[wg]++; }
    if (pw) {
      const wg = pw[m.winner], lg = other(wg);
      T[wg].gwWin += e.gwWin; T[lg].gwLose += e.gwLose;
      if (thisWeek) { T[wg].week += e.gwWin; T[lg].week -= e.gwLose; }
      continue;
    }
    for (const side of ['blue', 'red']) gs[side].forEach((G) => { if (!G) return; const win = m.winner === side; if (win) T[G].win += e.win; else T[G].lose += e.lose; if (thisWeek) T[G].week += win ? e.win : -e.lose; });
  }
  for (const x of Object.values(L)) for (const g of GK) { const t = x[g]; t.earn = t.win - t.lose + t.gwWin - t.gwLose; t.bal = t.earn - t.spent + t.adj; }
  LMEMO = { st: S.st, gm, v: L };
  return L;
}
// 이번 분기 금고
// 금고(분기마다 초기화하지 않음): 창설 이후 모든 분기를 더한다. 분기별 수입·지출은 '분기 결과 보관'에서 따로 볼 수 있음
export function treasury() {
  const L = ledger(), out = { q: curQ() };
  for (const g of GK) { const t = { win: 0, lose: 0, gwWin: 0, gwLose: 0, earn: 0, week: 0, spent: 0, adj: 0, bal: 0 }; for (const x of Object.values(L)) for (const k of Object.keys(t)) t[k] += x[g][k]; out[g] = t; }
  return out;
}
export { qName };
// 상점 효과(meta/guild.fx[g]): 포고문·총애·연회·도전장은 기한, 영약은 경지 보너스(10승씩)
export const fxOf = (g) => guildMeta()?.fx?.[g] || {};
export const fxOn = (g, k) => { const v = fxOf(g)[k]; return !!v && +(v.exp ?? v) > Date.now(); };
export const pill = (g) => +fxOf(g).pill || 0;
export const rwins = (g) => gData('all')[g].w + pill(g) * 10;
export const FAVOR = { j: '맹주의 총애', m: '천마의 총애' };
export { loadAssets, leadOf, introOf, myPin, tchips, other };
export const assetsOk = () => ASSET_OK;

// 길드 칭호(창설 이후 기록): 맹주/교주 · 승률 1위 · 최다 승 · 최다 출전 · 최다 연승
const TT = { j: ['무림맹주', '검선', '검성', '호법검', '질풍검'], m: ['천마', '마검', '혈마', '혈위', '광마'] };
const TD = ['문파장', '문파 보정 승률 1위(창설 이후, 자격 판수 이상)', '문파 최다 승', '문파 최다 출전', '문파 최다 연승(3연승 이상)'];
export function gTitles(g) {
  const out = {}, add = (id, k) => { if (id) (out[id] ||= []).push({ n: TT[g][k], d: TD[k] }); };
  add(guildMeta()?.lead?.[g], 0);
  const d = gData('all'), mem = Object.entries(d[g].mem).filter(([id]) => gOf(id) === g).map(([id, v]) => ({ id, ...v }));
  if (mem.length) {
    const maxG = Math.max(...mem.map((x) => x.g)), minG = Math.max(5, Math.ceil(maxG * 0.3));
    add([...mem].filter((x) => x.g >= minG).sort((a, b) => bWr(b) - bWr(a) || b.g - a.g)[0]?.id, 1);
    add([...mem].sort((a, b) => b.w - a.w || b.g - a.g)[0]?.id, 2);
    add([...mem].sort((a, b) => b.g - a.g || b.w - a.w)[0]?.id, 3);
    const st = [...mem].sort((a, b) => b.max - a.max || b.g - a.g)[0]; if (st?.max >= 3) add(st.id, 4);
  }
  return out;
}
const tchips = (ts) => (ts || []).map((t) => `<span class="gd-tt" title="${esc(t.d)}">${esc(t.n)}</span>`).join('');

// ---------- 화면 상태 ----------
const V = { g: '', mode: '' };
const MODES = [['q', '이번 분기'], ['all', '창설 이후'], ['car', '통산']]; // 통산 = 지금 문도·교도의 전체 기록(화면에는 '문도 통산'·'교도 통산')
const gName = (g) => GUILDS[g].n;
const introOf = (g) => guildMeta()?.intro?.[g] || GUILDS[g].intro;
const leadOf = (g) => { const id = guildMeta()?.lead?.[g]; return id && S.store.data.players?.[id] && !S.store.data.players[id].deleted ? id : ''; };

// 정파(#/jeongpa)·마교(#/magyo)는 각각 다른 화면. 예전 주소 #/guild, #/guild/j 는 해당 화면으로 넘긴다(디스코드 알림 링크 등)
page('guild', {
  title: '문파',
  render(arg) { const g = GUILDS[arg] ? arg : gOf(meId()) || 'j'; setTimeout(() => location.replace(ghref(g)), 0); return '<div class="panel empty lazy-wait">불러오는 중…</div>'; },
});
for (const G of GK) page(GPAGE[G], { keyed: true, title: GUILDS[G].n, render: () => guildPage(G), after(entering) { if (entering && guildOn()) loadAssets().then(() => { if (S.page === GPAGE[G]) entryFx(G); }); } });
function guildPage(g) {
    if (!ASSET_OK) { loadAssets().then(() => { if (S.page === GPAGE[g]) refresh(); }); return '<div class="panel empty lazy-wait">불러오는 중…</div>'; }
    if (!guildOn()) return notYet();
    ensureArt(); bdWatch(g);
    const mine = gOf(meId());
    V.g = g;
    const all = gData('all');
    if (!V.mode) V.mode = all[g].g + all[other(g)].g ? 'q' : 'car';
    const D = gData(V.mode), d = D[g], o = D[other(g)], c = counts();
    const members = live().filter((p) => p.guild === g).map((p) => p.id);
    const rl = realm(rwins(g)), tt = gTitles(g), lead = leadOf(g);
    return `<div class="gd gd-${g}">
      <section class="gd-hero${fxOn(g, 'feast') ? ' feast' : ''}" data-k="hero">${drift(g)}${fxOn(g, 'feast') ? '<span class="gd-lant" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' : ''}${mine === g ? '<em class="gd-mine">내 문파</em>' : ''}<a class="gd-other" href="${ghref(other(g))}">${gem(other(g))}${gName(other(g))} 보기 ›</a>
        <div class="gd-seal">${seal(g, rl.lv)}</div>
        <div class="gd-id"><small class="gd-en">${GUILDS[g].en}</small><h1><span class="gd-hj">${GUILDS[g].h}</span>${gName(g)}</h1>
          <p class="gd-intro">${esc(introOf(g))}</p>
</div>
        <div class="gd-rec"><div class="gd-modes" role="tablist">${MODES.map(([k, n]) => `<button role="tab" aria-selected="${k === V.mode}" class="${k === V.mode ? 'on' : ''}" data-a="gdMode" data-m="${k}">${k === 'car' ? GUILDS[g].mem + ' ' : ''}${n}</button>`).join('')}</div>
          <div class="gd-big"><b class="mono">${d.w}</b><small>승</small><b class="mono">${d.g - d.w}</b><small>패</small></div>
          <div class="gd-wr"><b class="mono">${d.g ? (d.w / d.g * 100).toFixed(1) : '—'}</b>${d.g ? '<small>%</small>' : ''}<span>${V.mode === 'q' ? qName(D.q) : V.mode === 'all' ? '창설 이후' : `지금 ${GUILDS[g].mem} 전체 기록`}</span></div></div>
      </section>
      <div class="gd-strip" data-k="st"><div class="gd-meta"><span>${GUILDS[g].lead} <b>${lead ? gname(lead) : '미정'}</b></span><span>${GUILDS[g].mem} <b>${members.length}</b>명</span><span>창설 <b>${fmtDay(dayKey(+guildMeta().at))}</b></span><a class="gd-gold" href="#/gshop" title="문파 금고 · 상점">금고 <b>${money(treasury()[g].bal)}</b></a></div>
          <div class="gd-realm" title="창설 뒤 문파 누적 ${all[g].w}승${pill(g) ? ` + 영약 ${pill(g) * 10}승` : ''}"><span>경지</span><b>${rl.n}</b><i><u style="width:${Math.round(rl.p * 100)}%"></u></i><small>${rl.next ? `${rl.next}까지 ${rl.need}승` : '최고 경지'}</small></div></div>
      ${V.mode !== 'car' && !d.g ? `<p class="gd-note" data-k="note">${ic('scroll')}${V.mode === 'q' ? '이번 분기' : '창설 후'} ${GUILDS[g].mem}가 뛴 경기가 기록되면 공식 기록이 시작돼요. 지금은 <button class="lnk" data-a="gdMode" data-m="car">${GUILDS[g].mem} 통산</button>으로 전력을 볼 수 있어요.</p>` : ''}
      ${kpis(g, d, members)}
      <div class="gd-row r1">${boardPanel(g)}${noticePanel(g, members, tt)}</div>
      <div class="gd-row r1">${warPanel(g, D)}${historyPanel(g)}</div>
      ${champPanel(g, d, o)}
      <div class="gd-row r2">${lanePanel(g, d, members)}${duoPanel(g, d)}</div>
      <div class="gd-row r3">${feedPanel(g, d)}${flowPanel(g, d)}</div>
      ${memberPanel(g, d, members, tt)}
      ${recordPanel(g, d, D)}
    </div>`;
}

function notYet() {
  return `<div class="panel empty gd-wait">${gem('j')}${gem('m')}<h2>정파 · 마교</h2><p>관리자가 문파를 창설하면 열려요.</p>${isAdmin() ? '<a class="btn gold" href="#/admin/guild">문파 창설하러 가기</a>' : ''}</div>`;
}
// 아직 길드가 없는 '나'(새로 온 사람): 인원이 같으면 고르고, 다르면 적은 쪽으로 정해짐
function joinCard() {
  const me = meId(); if (!me || gOf(me)) return '';
  const sm = smaller();
  return `<div class="gd-join panel" data-k="join"><b>${esc(nameOf(me))}님, 문파를 정해 주세요</b><p class="mut">${sm ? `지금은 ${gName(sm)}의 인원이 적어서 ${gName(sm)}로 합류해요.` : '두 문파의 인원이 같아요. 원하는 문파를 골라 주세요.'}</p>
    <div class="row">${sm ? `<button class="btn pri" data-a="gJoin" data-g="${sm}">${gem(sm)} ${gName(sm)} 합류</button>` : GK.map((G) => `<button class="btn pri gj-${G}" data-a="gJoin" data-g="${G}">${gem(G)} ${gName(G)} 합류</button>`).join('')}</div></div>`;
}

function kpis(g, d, members) {
  const mm = members.map((id) => S.st.P[id]?.mmr).filter(Boolean), avgM = mm.length ? Math.round(mm.reduce((a, b) => a + b, 0) / mm.length) : 0;
  const kd = d.kdaG ? ((d.kda[0] + d.kda[2]) / Math.max(1, d.kda[1])).toFixed(2) : '—';
  const per = members.length ? (d.g / members.length).toFixed(1) : '0';
  const M = GUILDS[g].mem;
  const items = [['판수', d.g, `${M} 출전 합계`], ['승률', wrs(d), '승 ÷ 판'], ['평균 MMR', avgM || '—', `지금 ${M}`], ['평균 KDA', kd, `KDA 기록 ${d.kdaG}판`], ['1인당 판수', per, `판수 ÷ ${M}`], ['이번 주', d.week.g ? `${d.week.w}승 ${d.week.g - d.week.w}패` : '—', '월요일부터']];
  return `<div class="gd-kp" data-k="kp">${items.map(([a, b, c]) => `<div><small>${a}</small><b class="mono">${b}</b><span>${c}</span></div>`).join('')}</div>`;
}
const ph = (hj, t, extra = '') => `<div class="gp-h"><i class="gp-hj" aria-hidden="true">${hj}</i><b>${t}</b>${extra}</div>`;
const EMPTY = { j: '아직 고요한 수련장', m: '아직 피를 보지 못한 성채' }; // 빈 칸에도 문파 분위기
const none = (t) => `<p class="gp-none">${V.g ? `${gem(V.g)}<b>${EMPTY[V.g]}</b>` : ''}<span>${t}</span></p>`;

// 대항전(시즌 점수판·맞대결·길드전)
function warPanel(g, D) {
  const q = gData('q'), all = gData('all'), j = q.j.war.w, m = q.m.war.w, tot = j + m;
  const recent = all.wars.slice(0, 5);
  const gwj = all.j.gw.w, gwm = all.m.gw.w;
  const ch = GK.filter((G) => fxOn(G, 'chal'));
  return `<section class="gp gp-war" data-k="war">${ph('爭', '천하쟁패 · 정마대전', `<small class="gp-s">${qName(q.q)} 시즌</small>`)}${ch.map((G) => `<p class="gw-chal">⚔️ <b>${gName(G)}</b>이(가) ${gName(other(G))}에 정마대전 도전장을 보냈어요</p>`).join('')}
    <div class="gw-board"><div class="gw-s s-j ${j > m ? 'lead' : ''}">${gem('j')}<b class="mono">${j}</b><small>정파</small></div><div class="gw-mid"><i style="--p:${tot ? Math.round(j / tot * 100) : 50}%"></i><small>${tot ? `정마대전 ${tot}판` : '이번 시즌 정마대전 없음'}</small></div><div class="gw-s s-m ${m > j ? 'lead' : ''}"><b class="mono">${m}</b>${gem('m')}<small>마교</small></div></div>
    <div class="gw-sub"><span>창설 이후 정마대전 <b class="mono">${gwj} : ${gwm}</b></span><span>${gName(g)} 최다 연승 <b class="mono">${all[g].warMax}</b></span></div>
    ${recent.length ? `<ul class="gw-list">${recent.map((x) => `<li class="${x.wg === g ? 'w' : 'l'}"><span class="gw-d">${fmtDay(dayKey(x.m.at)).slice(5)}</span><em class="gw-tag">정마대전</em><span>${gem(x.wg)}<b>${gName(x.wg)} 승</b></span><small>${GUILDS[x.b].n}(블루) vs ${GUILDS[x.r].n}(레드)</small></li>`).join('')}</ul>` : none('블루·레드 팀이 각각 한 문파로만(다섯 명 모두) 구성되면 정마대전으로 기록돼요. 소속이 3명 이상인 문파부터 기록이 쌓여요.')}
  </section>`;
}
// 공지(길드장) + 길드 내 TOP
function noticePanel(g, members, tt) {
  const n = guildMeta()?.notice?.[g], d = gData(V.mode)[g];
  const rows = members.map((id) => ({ id, ...(d.mem[id] || { g: 0, w: 0, max: 0 }) }));
  const maxG = Math.max(0, ...rows.map((r) => r.g)), minG = Math.max(3, Math.ceil(maxG * 0.3));
  const top = rows.filter((r) => r.g >= minG).sort((a, b) => bWr(b) - bWr(a) || b.g - a.g).slice(0, 5);
  return `<section class="gp gp-ntc" data-k="ntc">${ph('令', '문파 공지', `<button class="btn ghost xs" data-a="gNotice" data-g="${g}" title="${GUILDS[g].lead}만 고칠 수 있어요">${ic('edit')}</button>`)}
    <blockquote class="gn-box">${n?.t ? `${esc(n.t).replace(/\n/g, '<br>')}<small>${GUILDS[g].lead} · ${fmtDay(dayKey(+n.at))}</small>` : `<span class="mut">아직 공지가 없어요. ${GUILDS[g].lead}가 공지를 남길 수 있어요.</span>`}</blockquote>
    ${ph('榜', '문파 순위', `<small class="gp-s">보정 승률 · ${minG}판 이상</small>`)}
    ${top.length ? `<ol class="gt-rank">${top.map((r, i) => `<li><i class="mono">${i + 1}</i><span>${gname(r.id)}${rkChip(g, r.id, 'sm')}${tchips(tt[r.id])}</span><b class="mono">${pct(r.w, r.g)}%</b><small>${r.w}승 ${r.g - r.w}패</small></li>`).join('')}</ol>` : none(`자격 판수를 채운 ${GUILDS[g].mem}가 아직 없어요.`)}
  </section>`;
}
function champPanel(g, d, o) {
  const cs = Object.values(d.champs).sort((a, b) => b.g - a.g || b.w - a.w), top = cs.slice(0, 9);
  const best = [...cs].filter((c) => c.g >= 3).sort((a, b) => bWr(b) - bWr(a) || b.g - a.g)[0];
  const own = cs.filter((c) => c.g >= 3 && (o.champs[c.name]?.g || 0) <= 1).slice(0, 3);
  const user = (c) => { const e = Object.entries(c.users).sort((a, b) => b[1] - a[1])[0]; return e ? `최다 ${esc(nameOf(e[0]))}` : ''; };
  return `<section class="gp gp-ch" data-k="ch">${ph('兵', '챔피언 활용', `<small class="gp-s">많이 쓴 챔피언 TOP 9</small>`)}
    ${top.length ? `<div class="gdc-grid">${top.map((c, i) => `<div class="gc-c ${i === 0 ? 'big' : ''}" style="--img:url('${artUrl(c.name)}')"><i class="mono">${i + 1}</i><b>${esc(c.name)}</b><small>${c.g}판 · ${pct(c.w, c.g)}%</small><em>${user(c)}</em></div>`).join('')}</div>
    <div class="gc-tags">${best ? `<span>${champIcon(best.name, 'sm')}<small>대표 챔피언</small><b>${esc(best.name)}</b><em>${pct(best.w, best.g)}% · ${best.g}판</em></span>` : ''}${own.length ? `<span class="own"><small>우리만 쓰는 챔피언</small>${own.map((c) => champIcon(c.name, 'sm')).join('')}</span>` : '<span class="own"><small>우리만 쓰는 챔피언</small><em>아직 없음</em></span>'}</div>` : none('챔피언을 입력한 경기가 쌓이면 나타나요.')}
  </section>`;
}
function lanePanel(g, d, members) {
  const mx = Math.max(1, ...LANES.map((l) => d.lanes[l].g)), main = Object.fromEntries(LANES.map((l) => [l, 0]));
  members.forEach((id) => { const l = S.st.P[id]?.mainLane || S.store.data.players[id]?.mainLane; if (main[l] !== undefined) main[l]++; });
  const strong = LANES.filter((l) => d.lanes[l].g >= 5).sort((a, b) => bWr(d.lanes[b]) - bWr(d.lanes[a]))[0];
  return `<section class="gp gp-ln" data-k="ln">${ph('陣', '라인 분포', strong ? `<small class="gp-s">강세 라인 ${LANE_NAME[strong]}</small>` : '')}
    <div class="gl-rows">${LANES.map((l) => { const v = d.lanes[l]; return `<div class="gl-r" style="--lc:${LANE_COLOR[l]}"><span class="gl-n">${LANE_ICON[l]}${LANE_NAME[l]}</span><i class="gl-b"><u style="width:${Math.round(v.g / mx * 100)}%"></u></i><b class="mono">${wrs(v)}</b><small>${v.g}판 · 주라인 ${main[l]}명</small></div>`; }).join('')}</div>
  </section>`;
}
function duoPanel(g, d) {
  const ps = Object.entries(d.duo).map(([k, v]) => ({ ids: k.split('|'), ...v })).filter((x) => x.ids.every((id) => gOf(id) === g));
  const minD = Math.max(3, Math.ceil(Math.max(0, ...ps.map((x) => x.g)) * 0.3));
  const top = ps.filter((x) => x.g >= minD && x.w * 2 > x.g).sort((a, b) => bWr(b) - bWr(a) || b.g - a.g).slice(0, 4);
  return `<section class="gp gp-duo" data-k="duo">${ph('義', '문파 듀오', `<small class="gp-s">같은 팀 ${minD}판 이상</small>`)}
    ${top.length ? `<ul class="gd-duo">${top.map((x, i) => `<li><i class="mono">${i + 1}</i><span>${gname(x.ids[0])}<em>+</em>${gname(x.ids[1])}</span><b class="mono">${pct(x.w, x.g)}%</b><small>${x.w}승 ${x.g - x.w}패</small></li>`).join('')}</ul>` : none('함께 이긴 기록이 쌓이면 최고의 짝이 나타나요.')}
  </section>`;
}
function feedPanel(g, d) {
  const list = d.feed.slice(0, 7);
  return `<section class="gp gp-feed" data-k="feed">${ph('戰', '최근 경기')}
    ${list.length ? `<ul class="gf-list">${list.map((x) => { const all = x.win && !x.lose ? 'w' : x.lose && !x.win ? 'l' : 'mx'; return `<li class="${all}"><span class="gf-d mono">${fmtDay(dayKey(x.m.at)).slice(5)}</span><b>${all === 'w' ? '승' : all === 'l' ? '패' : '내전'}</b><span class="gf-p">${x.ids.map(([id, side, i]) => `<span class="${x.m.winner === side ? 'w' : 'l'}">${champIcon(x.m.champs?.[side]?.[i] || '', 'xs')}${esc(nameOf(id))}</span>`).join('')}</span></li>`; }).join('')}</ul>` : none(`${GUILDS[g].mem}가 뛴 경기가 여기에 쌓여요.`)}
  </section>`;
}
function flowPanel(g, d) {
  const ks = Object.keys(d.wk).sort().slice(-10), mx = Math.max(1, ...ks.map((k) => d.wk[k].g));
  return `<section class="gp gp-flow" data-k="flow">${ph('勢', '주간 흐름', '<small class="gp-s">최근 10주 · 승/패</small>')}
    ${ks.length ? `<div class="gfl">${ks.map((k) => { const v = d.wk[k]; return `<div title="${fmtDay(k)} 주 · ${v.w}승 ${v.g - v.w}패"><i style="height:${Math.round(v.g / mx * 100)}%"><u style="height:${v.g ? Math.round(v.w / v.g * 100) : 0}%"></u></i><b class="mono">${pct(v.w, v.g)}</b><small>${k.slice(5).replace('-', '/')}</small></div>`; }).join('')}</div>` : none('경기가 쌓이면 주마다 흐름이 그려져요.')}
  </section>`;
}
// 문파 직위: 내전 통산 판수로 정한다(길드장은 무림맹주·천마). 단계가 오를수록 테두리가 진해진다
export const RANKS = { j: [[0, '속가제자'], [80, '삼대제자'], [200, '이대제자'], [400, '일대제자'], [800, '장로']], m: [[0, '외당 신도'], [80, '내당 신도'], [200, '향주'], [400, '당주'], [800, '호법']] }; // 처음 기준(0·20·50·100·200)의 4배
export function rankOf(g, id) {
  const n = S.st?.P[id]?.g || 0, R = RANKS[g] || RANKS.j;
  if (leadOf(g) === id) return { n: GUILDS[g].lead, lv: 5, games: n, next: '', need: 0 };
  let i = 0; while (i + 1 < R.length && n >= R[i + 1][0]) i++;
  return { n: R[i][1], lv: i, games: n, next: R[i + 1]?.[1] || '', need: R[i + 1] ? R[i + 1][0] - n : 0 };
}
const rkChip = (g, id, cls = '') => { const r = rankOf(g, id); return `<em class="gd-rk lv${r.lv} ${cls}" title="${r.next ? `통산 ${r.games}판 · ${r.next}까지 ${r.need}판` : `통산 ${r.games}판`}">${esc(r.n)}</em>`; };
function memberPanel(g, d, members, tt) {
  const rows = members.map((id) => ({ id, s: S.st.P[id], v: d.mem[id] || { g: 0, w: 0 }, r: rankOf(g, id) })).sort((a, b) => b.r.lv - a.r.lv || b.r.games - a.r.games);
  const tw = d.w || 1, dist = [...RANKS[g]].reverse().map(([, n]) => [n, rows.filter((x) => x.r.n === n).length]).filter(([, k]) => k);
  return `<section class="gp gp-mem" data-k="mem">${ph('門', GUILDS[g].mem, `<small class="gp-s">${members.length}명 · 직위는 내전 통산 판수 · 기여도 = 문파 승리 중 내 승리</small>`)}
    <div class="gd-rkd">${leadOf(g) ? `<span class="lv5">${GUILDS[g].lead} 1</span>` : ''}${dist.map(([n, k]) => { const lv = RANKS[g].findIndex((x) => x[1] === n); return `<span class="lv${lv}">${esc(n)} ${k}</span>`; }).join('')}<small>${RANKS[g].map(([n, t]) => `${t} ${n}판`).join(' · ')}</small></div>
    <div class="gm-grid">${rows.map(({ id, s, v }) => { const ch = s ? cardChamp(s) : ''; return `<a class="gm-c" href="#/players/${id}" style="--img:url('${ch ? artUrl(ch) : ''}')"><span class="gm-top">${gname(id)}${rkChip(g, id)}</span><span class="gm-tt">${fxOn(g, 'favor') && fxOf(g).favor.id === id ? `<span class="gd-tt fav">${FAVOR[g]}</span>` : ''}${tchips((tt[id] || []).filter((t) => t.n !== GUILDS[g].lead))}</span>
      <span class="gm-st"><b class="mono">${wrs(v)}</b><small>${v.g}판${v.g ? ` · 기여 ${Math.round(v.w / tw * 100)}%` : ''}</small></span><span class="gm-nx">${(() => { const r = rankOf(g, id); return r.next ? `통산 ${r.games}판 · ${esc(r.next)}까지 ${r.need}판` : `통산 ${r.games}판`; })()}</span><span class="gm-ft">${s ? `${LANE_ICON[s.mainLane] || ''}<small class="mono">MMR ${Math.round(s.mmr)}</small>${dots(s.recent)}` : ''}</span></a>`; }).join('')}</div>
  </section>`;
}
function recordPanel(g, d, D) {
  const mem = Object.entries(d.mem).map(([id, v]) => ({ id, ...v }));
  const maxG = Math.max(0, ...mem.map((x) => x.g)), minG = Math.max(5, Math.ceil(maxG * 0.3));
  const st = [...mem].sort((a, b) => b.max - a.max || b.g - a.g)[0], most = [...mem].sort((a, b) => b.g - a.g)[0], best = mem.filter((x) => x.g >= minG).sort((a, b) => bWr(b) - bWr(a))[0];
  const R = [
    ['최다 연승', st?.max ? `${gname(st.id)}<b class="mono">${st.max}연승</b>` : ''],
    ['한 경기 최다 킬', d.killMax ? `${gname(d.killMax.id)}<b class="mono">${d.killMax.kda.join('/')}</b>` : ''],
    ['최다 출전', most ? `${gname(most.id)}<b class="mono">${most.g}판</b>` : ''],
    [`최고 승률 (${minG}판↑)`, best ? `${gname(best.id)}<b class="mono">${pct(best.w, best.g)}%</b>` : ''],
    ['정마대전 최다 연승', d.warMax ? `<span>${gem(g)} ${gName(g)}</span><b class="mono">${d.warMax}연승</b>` : ''],
    ['첫 승', d.first ? `${gname(d.first.id)}<b class="mono">${fmtDay(dayKey(d.first.m.at))}</b>` : ''],
  ];
  return `<section class="gp gp-rec" data-k="rec">${ph('譜', '명예의 전당', `<small class="gp-s">${MODES.find((x) => x[0] === V.mode)[1]}</small>`)}
    <dl class="gr-list">${R.map(([a, b]) => `<div><dt>${a}</dt><dd>${b || '<span class="mut">—</span>'}</dd></div>`).join('')}</dl></section>`;
}
// 연혁(창설 이후 기록에서 자동으로)
function historyPanel(g) {
  const gm = guildMeta(), all = gData('all')[g], ev = [];
  ev.push({ at: +gm.at, t: `${gName(g)} 창설`, k: 'start' });
  live().forEach((p) => (p.glog || []).forEach((e) => { if (e.g === g && e.by !== 'init' && +e.at > +gm.at) ev.push({ at: +e.at, t: `${esc(p.name)} 합류`, k: 'join' }); }));
  if (all.first) ev.push({ at: all.first.m.at, t: '창설 후 첫 승리', k: 'win' });
  if (all.firstWar) ev.push({ at: all.firstWar.at, t: '첫 정마대전 승리', k: 'war' });
  all.miles.forEach((x) => { const r = REALMS.find((y) => y[0] === x.n); ev.push(r ? { at: x.at, t: `경지 ${r[1]} 도달 · 누적 ${x.n}승`, k: 'realm' } : { at: x.at, t: `누적 ${x.n}승 달성`, k: 'mile' }); });
  ev.sort((a, b) => b.at - a.at);
  return `<section class="gp gp-his" data-k="his">${ph('史', '문파 연혁')}
    <ol class="gh-list">${ev.slice(0, 8).map((e) => `<li class="k-${e.k}"><span class="mono">${fmtDay(dayKey(e.at))}</span><b>${e.t}</b></li>`).join('')}</ol></section>`;
}

// ---------- 동작 ----------
act('gdMode', (d) => { V.mode = d.m; refresh(); });
// 소속 기록 한 칸 추가(경기 당시 소속 계산용). 배열 안에 객체만(중첩 배열 없음)
const glogAdd = (p, g, by) => [...(Array.isArray(p.glog) ? p.glog : []), { g, at: Date.now(), by }].slice(-20);
async function setGuild(id, g, by) {
  const p = S.store.data.players[id];
  await S.store.patch('players', id, { guild: g, glog: glogAdd(p, g, by) });
  if (by !== 'admin-init') { sysChat(`${g === 'j' ? '🌸' : '🔥'} ${p.name}님이 ${gName(g)}에 합류했어요`); notify('guild', id); }
}
// 새로 온 사람: 인원이 다르면 적은 쪽으로만, 같으면 고른 곳으로
act('gJoin', async (d) => { return toast('문파는 관리자가 배정해요');
  const me = meId(); if (!me) return toast("먼저 '내 페이지'에서 나를 골라 주세요");
  if (gOf(me)) return toast('이미 문파가 있어요');
  const sm = smaller(), g = sm || d.g;
  if (sm && d.g !== sm) toast(`인원이 적은 ${gName(sm)}로 합류해요`);
  if (!confirm(`${nameOf(me)}님이 ${gName(g)}에 합류할까요?`)) return;
  try { await setGuild(me, g, 'new'); toast(`${gName(g)}에 합류했어요`); go(ghref(g)); } catch (e) { toast('저장 실패: ' + (e.code || e.message)); }
});
// 본인 확인: 가챠에서 쓰는 본인 PIN(선수별)으로. PIN이 없으면 가챠 화면에서 먼저 만든다
async function myPin(pid, why) {
  const doc = await S.store.get('gacha', pid).catch(() => null);
  if (!doc?.pinHash) { toast('본인 PIN이 아직 없어요. 가챠 화면에서 내 PIN을 먼저 만들어 주세요'); return false; }
  return new Promise((res) => {
    const el = modal(`${mh('본인 확인')}<p class="mut">${esc(why)}<br>가챠에서 쓰는 <b>${esc(nameOf(pid))}</b>님의 PIN을 넣어 주세요.</p><form class="row" id="gpin"><input class="inp grow" id="gpin-i" type="password" inputmode="numeric" autocomplete="off" placeholder="본인 PIN" aria-label="본인 PIN"><button class="btn pri">확인</button></form>`);
    el.querySelector('#gpin-i').focus();
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    new MutationObserver((_, ob) => { if (!document.getElementById('gpin')) { ob.disconnect(); fin(false); } }).observe(document.getElementById('modal'), { childList: true });
    el.querySelector('#gpin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const h = await sha(`gacha:${pid}:${el.querySelector('#gpin-i').value.trim()}`);
      if (h !== doc.pinHash) return toast('PIN이 맞지 않아요');
      fin(true); closeModal();
    });
  });
}
// 문파 옮기기: 분기마다 한 번, 옮긴 뒤 인원 차이가 2명 이하일 때만(관리자는 관리 화면에서 언제든)
export function moveRule(id) {
  const g = gOf(id); if (!g) return { ok: false, why: '아직 문파가 없어요' };
  const c = counts(), to = other(g), q = qKey(Date.now());
  const used = (S.store.data.players[id].glog || []).some((e) => e.by === 'self' && qKey(+e.at) === q);
  if (used) return { ok: false, why: `이번 분기(${qName(q)})에 이미 옮겼어요. 다음 분기에 다시 옮길 수 있어요` };
  if (c[to] + 1 - (c[g] - 1) > 2) return { ok: false, why: `${gName(to)} 인원이 더 많아서 지금은 옮길 수 없어요(인원 차이 2명까지)` };
  return { ok: true, to };
}
act('gMove', async () => { return toast('문파는 관리자가 배정해요');
  const me = meId(); if (!me) return toast("먼저 '내 페이지'에서 나를 골라 주세요");
  const r = moveRule(me); if (!r.ok) return toast(r.why);
  if (!confirm(`${gName(gOf(me))} → ${gName(r.to)}(으)로 옮길까요?\n분기마다 한 번만 옮길 수 있어요.`)) return;
  if (!(await myPin(me, '문파를 옮기려면 본인 확인이 필요해요.'))) return;
  try { await setGuild(me, r.to, 'self'); toast(`${gName(r.to)}로 옮겼어요`); go(ghref(r.to)); } catch (e) { toast('저장 실패: ' + (e.code || e.message)); }
});
// 공지: 길드장(본인 PIN) 또는 관리자
act('gNotice', async (d) => {
  const g = d.g, lead = leadOf(g), me = meId();
  let ok = false;
  if (isAdmin()) ok = true;
  else if (lead && me === lead) ok = await myPin(lead, `${GUILDS[g].lead}만 공지를 고칠 수 있어요.`);
  else return toast(lead ? `${GUILDS[g].lead}(${nameOf(lead)})만 공지를 고칠 수 있어요` : `아직 ${GUILDS[g].lead}가 없어요. 관리자가 정해요`);
  if (!ok) return;
  const cur = guildMeta()?.notice?.[g]?.t || '';
  const el = modal(`${mh(`${gName(g)} 공지`)}<form id="gnf" class="col"><textarea class="inp" id="gnf-t" rows="4" maxlength="300" placeholder="${GUILDS[g].mem}에게 전할 말">${esc(cur)}</textarea><button class="btn pri">저장</button></form>`);
  el.querySelector('#gnf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await S.store.patch('meta', 'guild', { notice: { [g]: { t: el.querySelector('#gnf-t').value.trim().slice(0, 300), at: Date.now(), by: me || 'admin' } } }); closeModal(); toast('공지를 저장했어요'); } catch (err) { toast('저장 실패: ' + (err.code || err.message)); }
  });
});

// ---------- 길드 게시판(공개 · gboard_j·gboard_m): 길드 화면을 보고 있는 동안에만 최신 30개 실시간 ----------
const BD = { g: '', posts: [], un: null, open: '', write: false };
function bdWatch(g) {
  if (BD.g === g && BD.un) return;
  bdStop(); BD.g = g;
  BD.un = S.store.watchRecent('gboard_' + g, 30, (docs) => { if (BD.g !== g) return; BD.posts = docs.filter((x) => !x.deleted); if (S.page === GPAGE[g]) refresh(); }, () => {});
}
function bdStop() { BD.un?.(); BD.un = null; BD.g = ''; BD.posts = []; BD.open = ''; BD.write = false; }
addEventListener('hashchange', () => setTimeout(() => { if (BD.g && S.page !== GPAGE[BD.g]) bdStop(); }, 0));
const myCid = () => localStorage.getItem('naejeon:cid') || '';
const tm = (at) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const who = (x) => (x.pid && S.store.data.players?.[x.pid] ? gname(x.pid, x.n) : esc(x.n || '익명'));
function boardPanel(g) {
  const p = BD.open && BD.posts.find((x) => x.id === BD.open);
  let body;
  if (p) {
    body = `<article class="gb-post"><button class="btn ghost xs" data-a="gbBack">‹ 목록</button><h3>${esc(p.t)}</h3><small class="gb-meta">${who(p)} · ${tm(p.at)}${p.c === myCid() ? ' · <button class="lnk" data-a="gbDel" data-id="' + p.id + '">삭제</button>' : ''}</small><p>${esc(p.b).replace(/\n/g, '<br>')}</p>
      <ul class="gb-cm">${(p.cm || []).map((c) => `<li><b>${who(c)}</b><span>${esc(c.t)}</span><small>${tm(c.at)}</small></li>`).join('')}</ul>
      ${hasKey(g) ? `<form class="row gb-cf" id="gbk" data-id="${p.id}"><input class="inp grow" id="gbk-t" maxlength="200" autocomplete="off" placeholder="댓글 달기" aria-label="댓글"><button class="btn">등록</button></form>` : `<button class="btn ghost block" data-a="gbUnlock">${ic('lock')}비밀번호를 넣고 댓글 달기</button>`}</article>`;
  } else if (BD.write && !hasKey(g)) {
    body = guildMeta()?.sec?.[g]?.wk ? `<form class="col gb-lock" id="gbl"><b>${gName(g)} 비밀번호를 넣으면 글을 쓸 수 있어요</b><small class="mut">채팅창 ${gName(g)} 탭과 같은 비밀번호예요. 읽기는 누구나 할 수 있어요.</small><input class="inp" id="gbl-p" type="password" autocomplete="off" placeholder="${gName(g)} 비밀번호" aria-label="${gName(g)} 비밀번호"><label class="mini"><input type="checkbox" id="gbl-r" checked> 이 기기에서 기억하기</label><div class="row"><button type="button" class="btn ghost" data-a="gbWrite">취소</button><span class="grow"></span><button class="btn pri">확인</button></div></form>` : none(`관리자가 ${gName(g)} 비밀번호를 정하면 글을 쓸 수 있어요.`);
  } else if (BD.write) {
    body = `<form class="col gb-new" id="gbf"><input class="inp" id="gbf-t" maxlength="60" placeholder="제목" aria-label="제목"><textarea class="inp" id="gbf-b" rows="5" maxlength="1000" placeholder="${gName(g)} ${GUILDS[g].mem}에게 전하고 싶은 이야기" aria-label="내용"></textarea><div class="row"><button type="button" class="btn ghost" data-a="gbWrite">취소</button><span class="grow"></span><button class="btn pri">글 올리기</button></div></form>`;
  } else {
    body = BD.posts.length ? `<ul class="gb-list">${BD.posts.map((x, i) => `<li><button data-a="gbOpen" data-id="${x.id}"><i class="mono">${BD.posts.length - i}</i><b>${esc(x.t)}</b>${(x.cm || []).length ? `<em>${x.cm.length}</em>` : ''}<small>${who(x)} · ${tm(x.at)}</small></button></li>`).join('')}</ul>` : none(`${gName(g)} 게시판의 첫 글을 남겨 보세요. 작전·후기·잡담 무엇이든 좋아요.`);
  }
  return `<section class="gp gp-bd" data-k="bd">${ph('帖', `${gName(g)} 게시판`, `${p || BD.write ? '' : `<button class="btn xs pri" data-a="gbWrite">${ic('edit')}글쓰기</button>`}`)}${body}</section>`;
}
act('gbWrite', () => { BD.write = !BD.write; BD.open = ''; refresh(); });
act('gbUnlock', () => { BD.open = ''; BD.write = true; refresh(); }); // 비밀번호 칸을 띄운다(넣고 나면 글쓰기·댓글 모두 가능)
act('gbOpen', (d) => { BD.open = d.id; BD.write = false; refresh(); });
act('gbBack', () => { BD.open = ''; refresh(); });
act('gbDel', async (d) => { if (!confirm('이 글을 지울까요?')) return; try { await S.store.patch('gboard_' + BD.g, d.id, { deleted: true }); BD.open = ''; toast('지웠어요'); } catch (e) { toast('실패: ' + (e.code || e.message)); } });
document.addEventListener('submit', async (e) => {
  const f = e.target; if (!(f instanceof HTMLFormElement) || !f.closest('.gp-bd')) return;
  e.preventDefault();
  const g = BD.g; if (!g) return;
  const n = nick() || '익명', pid = meId();
  try {
    if (f.id === 'gbl') {
      const okk = await unlock(g, f.querySelector('#gbl-p').value, f.querySelector('#gbl-r').checked);
      if (!okk) return toast('비밀번호가 맞지 않아요');
      toast('글을 쓸 수 있어요'); refresh(); return;
    }
    if ((f.id === 'gbf' || f.id === 'gbk') && !hasKey(g)) return toast(`${gName(g)} 비밀번호를 먼저 넣어 주세요`);
    if (f.id === 'gbf') {
      const t = f.querySelector('#gbf-t').value.trim(), b = f.querySelector('#gbf-b').value.trim();
      if (!t || !b) return toast('제목과 내용을 써 주세요');
      const id = uid(); await S.store.put('gboard_' + g, id, { at: Date.now(), t, b, n, pid, c: myCid(), cm: [], deleted: false });
      BD.write = false; toast('글을 올렸어요'); refresh();
    } else if (f.id === 'gbk') {
      const i = f.querySelector('#gbk-t'), t = i.value.trim(); if (!t) return;
      i.value = '';
      await S.store.tx('gboard_' + g, f.dataset.id, (r) => (r ? { ...r, cm: [...(r.cm || []), { at: Date.now(), n, pid, t }].slice(-100) } : null));
    }
  } catch (err) { toast('실패: ' + (err.code || err.message)); }
});

// ---------- 관리자: 창설(자동 배정) ----------
// 균형: 지금 MMR 합(평균) 차이 + 최근 60일 출전자 수 차이 + 주라인 분포 차이를 가장 작게. 인원 차이 1명 이하, '같은 길드로 묶기' 짝은 반드시 같은 쪽
export function balance(ids, pairs = [], tries = 400) {
  const now = Date.now(), act60 = (id) => (S.st.P[id]?.lastAt || 0) > now - 60 * 864e5 ? 1 : 0;
  const mmr = (id) => S.st.P[id]?.mmr || 1200, lane = (id) => S.st.P[id]?.mainLane || S.store.data.players[id]?.mainLane || '';
  // 짝을 한 덩어리로
  const parent = Object.fromEntries(ids.map((id) => [id, id])), find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  pairs.forEach(([a, b]) => { if (parent[a] && parent[b]) parent[find(a)] = find(b); });
  const groups = Object.values(ids.reduce((o, id) => ((o[find(id)] ||= []).push(id), o), {}));
  const cost = (side) => {
    const A = [], Bv = []; groups.forEach((gr, i) => (side[i] ? A : Bv).push(...gr));
    if (Math.abs(A.length - Bv.length) > 1) return Infinity;
    const avg = (a) => (a.length ? a.reduce((s, id) => s + mmr(id), 0) / a.length : 0);
    let c = Math.abs(avg(A) - avg(Bv)) + 60 * Math.abs(A.reduce((s, id) => s + act60(id), 0) - Bv.reduce((s, id) => s + act60(id), 0));
    LANES.forEach((l) => { c += 15 * Math.abs(A.filter((id) => lane(id) === l).length - Bv.filter((id) => lane(id) === l).length); });
    return c;
  };
  let best = null, bestC = Infinity;
  for (let t = 0; t < tries; t++) {
    // 무작위 시작 → 한 덩어리씩 옮기거나 두 덩어리 맞바꾸며 좋아지면 채택
    const side = groups.map(() => Math.random() < 0.5);
    let c = cost(side), better = true;
    while (better) {
      better = false;
      for (let i = 0; i < groups.length; i++) {
        side[i] = !side[i]; const c1 = cost(side); if (c1 < c) { c = c1; better = true; } else side[i] = !side[i];
        for (let k = i + 1; k < groups.length; k++) { if (side[i] === side[k]) continue; side[i] = !side[i]; side[k] = !side[k]; const c2 = cost(side); if (c2 < c) { c = c2; better = true; } else { side[i] = !side[i]; side[k] = !side[k]; } }
      }
    }
    if (c < bestC) { bestC = c; best = [...side]; }
  }
  const out = { j: [], m: [] }; if (!best) return null;
  groups.forEach((gr, i) => out[best[i] ? 'j' : 'm'].push(...gr));
  const sum = (a) => ({ n: a.length, mmr: a.length ? Math.round(a.reduce((s, id) => s + mmr(id), 0) / a.length) : 0, act: a.reduce((s, id) => s + act60(id), 0), lanes: Object.fromEntries(LANES.map((l) => [l, a.filter((id) => lane(id) === l).length])) });
  return { ...out, sj: sum(out.j), sm: sum(out.m), cost: bestC };
}
export async function createGuilds(plan) {
  const at = Date.now();
  await S.store.bulk(async () => {
    for (const g of GK) for (const id of plan[g]) await S.store.patch('players', id, { guild: g, glog: [{ g, at, by: 'init' }] });
    await S.store.patch('meta', 'guild', { at, lead: {}, intro: {}, notice: {}, sec: {}, keep: Object.fromEntries((plan.pairs || []).map((x) => [[...x].sort().join('|'), 1])) });
  });
  sysChat(`⚔️ 정파 · 마교 창설! 정파 ${plan.j.length}명 · 마교 ${plan.m.length}명. 문파 메뉴에서 내 문파를 확인해 보세요`);
}
export async function adminSet(id, g) { await setGuild(id, g, 'admin'); }
export const GUILD_COLS = ['gchat_j', 'gchat_m', 'gboard_j', 'gboard_m'];

// 큰 작업(창설·전체 다시 나누기)은 관리자 모드여도 PIN을 한 번 더 묻는다
function pinAgain(why) {
  return new Promise((res) => {
    const el = modal(`${mh('관리자 PIN 확인')}<p class="mut">${esc(why)}</p><form class="row" id="gapin"><input class="inp grow" id="gapin-i" type="password" inputmode="numeric" autocomplete="off" placeholder="관리자 PIN" aria-label="관리자 PIN"><button class="btn pri">확인</button></form>`);
    el.querySelector('#gapin-i').focus();
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    new MutationObserver((_, ob) => { if (!document.getElementById('gapin')) { ob.disconnect(); fin(false); } }).observe(document.getElementById('modal'), { childList: true });
    el.querySelector('#gapin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const h = await sha(el.querySelector('#gapin-i').value.trim()), cur = S.store.data.meta?.settings?.pinHash;
      if (!cur || h !== cur) return toast('PIN이 맞지 않아요');
      fin(true); closeModal();
    });
  });
}
// ---------- 관리 > 길드 탭 ----------
const GA = { pairs: [], plan: null };
const opts = (sel = '') => live().slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
const sumHTML = (s) => `<small class="mut">평균 MMR <b class="mono">${s.mmr}</b> · 최근 60일 출전 ${s.act}명 · ${LANES.map((l) => `${LANE_NAME[l]} ${s.lanes[l]}`).join(' ')}</small>`;
export function guildAdminHTML() {
  if (!guildOn()) {
    return `<div class="panel gadm"><div class="ph"><b>${ic('guild')}문파 창설</b><small class="mut">정파 · 마교</small></div>
      <p class="sm">선수 ${live().length}명을 실력이 비슷하도록 자동으로 나눠요. 기준: 지금 MMR 평균, 최근 60일 출전자 수, 주라인 분포. 인원 차이는 1명 이하.</p>
      <div class="ga-pair"><b class="sm">같은 문파로 묶기</b><select class="inp" id="ga-a">${opts()}</select><select class="inp" id="ga-b">${opts()}</select><button class="btn xs" data-a="gaPair">추가</button>
        ${pairsNow().map(([a, b], i) => `<span class="chip">${esc(nameOf(a))} + ${esc(nameOf(b))} <button class="lnk" data-a="gaUnpair" data-i="${i}" aria-label="묶음 빼기">✕</button></span>`).join('')}</div>
      <div class="row wrapr"><button class="btn gold" data-a="gaPlan">${GA.plan ? '다시 섞기' : '자동 배정 미리보기'}</button>${GA.plan ? '<button class="btn pri" data-a="gaCreate">이대로 창설</button>' : ''}</div>
      ${GA.plan ? `<div class="ga-plan">${GK.map((g) => `<div class="ga-col g-${g}"><b>${gem(g)} ${gName(g)} ${GA.plan[g].length}명</b>${sumHTML(GA.plan[g === 'j' ? 'sj' : 'sm'])}<p>${GA.plan[g].map((id) => esc(nameOf(id))).join(', ')}</p></div>`).join('')}</div>` : ''}</div>`;
  }
  const un = live().filter((p) => !GUILDS[p.guild]), c = counts(), gm = guildMeta();
  return `<div class="panel gadm"><div class="ph"><b>${ic('guild')}문파 관리</b><small class="mut">창설 ${fmtDay(dayKey(+gm.at))} · 정파 ${c.j}명 · 마교 ${c.m}명</small></div>
    ${un.length ? `<div class="ga-un"><b class="sm">무소속 ${un.length}명</b> ${un.map((p) => esc(p.name)).join(', ')} <small class="mut">아래 '인원 조정'에서 문파를 정해 주세요</small></div>` : ''}
    <div class="ga-plan">${GK.map((g) => { const sec = gm.sec?.[g]; return `<div class="ga-col g-${g}"><b>${gem(g)} ${gName(g)}</b>
      <label class="fld"><span>한 줄 소개</span><textarea class="inp" id="ga-in-${g}" rows="2" maxlength="80">${esc(introOf(g))}</textarea></label><button class="btn xs" data-a="gaIntro" data-g="${g}">소개 저장</button>
      <label class="fld"><span>${GUILDS[g].lead}(문파장 · 공지만 고칠 수 있음)</span><select class="inp" id="ga-ld-${g}"><option value="">없음</option>${live().filter((p) => p.guild === g).map((p) => `<option value="${p.id}" ${gm.lead?.[g] === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label><button class="btn xs" data-a="gaLead" data-g="${g}">문파장 저장</button>
      <label class="fld"><span>채팅 비밀번호(채팅창 ${GUILDS[g].n} 탭) ${sec?.wk ? '<em class="tag ok">설정됨</em>' : '<em class="tag">없음</em>'}</span>${sec?.wk ? `<input class="inp" id="ga-op-${g}" type="password" autocomplete="off" placeholder="지금 비밀번호(모르면 비워 두기)">` : ''}<input class="inp" id="ga-pw-${g}" type="password" autocomplete="new-password" placeholder="새 비밀번호(4자 이상)"></label><button class="btn xs" data-a="gaPw" data-g="${g}">비밀번호 저장</button>
      <p class="hint">지금 비밀번호를 넣고 바꾸면 예전 글도 그대로 보여요. 비워 두고 바꾸면 문파 채팅이 새로 시작돼요(예전 대화는 아무도 못 읽음).</p>
      </div>`; }).join('')}</div></div>
    <div class="panel gadm"><div class="ph"><b>${ic('users')}인원 조정</b><span class="grow"></span><button class="btn xs ghost" data-a="gaReset" title="무림맹주·천마만 남기고 모두 무소속으로(관리자 PIN)">대장만 남기기</button><small class="mut">정파 ${c.j}명 · 마교 ${c.m}명 · 누르면 바로 옮겨요(지난 경기는 예전 소속 그대로)</small></div>
      <div class="ga-roster">${live().slice().sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id)).map((p) => `<div class="ga-r"><span>${gname(p.id)}</span><span class="ga-seg">${GK.map((G) => `<button class="g-${G} ${p.guild === G ? 'on' : ''}" data-a="gaSet" data-id="${p.id}" data-g="${G}" aria-pressed="${p.guild === G}">${gName(G)}</button>`).join('')}<button class="g-x ${GUILDS[p.guild] ? '' : 'on'}" data-a="gaSet" data-id="${p.id}" data-g="" aria-pressed="${!GUILDS[p.guild]}">무소속</button></span></div>`).join('')}</div>
      <div class="ph"><b>전체 다시 나누기</b><small class="mut">창설 때처럼 실력 균형으로 모두 다시 배정(위 '같은 문파로 묶기' 짝 유지)</small></div>
      <div class="ga-pair">${pairsNow().map(([a, b], i) => `<span class="chip">${esc(nameOf(a))} + ${esc(nameOf(b))} <button class="lnk" data-a="gaUnpair" data-i="${i}" aria-label="묶음 빼기">✕</button></span>`).join('') || '<span class="mut sm">묶은 짝 없음</span>'}<select class="inp" id="ga-a">${opts()}</select><select class="inp" id="ga-b">${opts()}</select><button class="btn xs" data-a="gaPair">짝 추가</button></div>
      <div class="row wrapr"><button class="btn gold" data-a="gaPlan">${GA.plan ? '다시 섞기' : '다시 나누기 미리보기'}</button>${GA.plan ? '<button class="btn pri" data-a="gaReApply">이대로 다시 나누기</button>' : ''}</div>
      ${GA.plan ? `<div class="ga-plan">${GK.map((g) => `<div class="ga-col g-${g}"><b>${gem(g)} ${gName(g)} ${GA.plan[g].length}명</b>${sumHTML(GA.plan[g === 'j' ? 'sj' : 'sm'])}<p>${GA.plan[g].map((id) => `${gOf(id) !== g ? '<b class="ga-mv">' : ''}${esc(nameOf(id))}${gOf(id) !== g ? '</b>' : ''}`).join(', ')}</p></div>`).join('')}</div><p class="hint">굵은 이름이 문파를 옮기는 사람이에요.</p>` : ''}
      <p class="hint">문파는 관리자만 배정·변경해요(본인이 고르거나 옮기는 기능 없음). 문파 기록은 소속이 3명 이상이 된 순간부터 쌓여요.</p></div>`;
}
// '같은 길드로 묶기' 짝: 창설 전에는 이 화면에서만, 창설 뒤에는 meta/guild.keep{'a|b':1}에 남겨 '전체 다시 나누기'에도 그대로 쓴다
const pairsNow = () => (guildOn() ? Object.entries(guildMeta()?.keep || {}).filter(([, v]) => v).map(([k]) => k.split('|')) : GA.pairs);
act('gaPair', () => { const a = document.getElementById('ga-a').value, b = document.getElementById('ga-b').value; if (!a || !b || a === b) return toast('서로 다른 두 사람을 골라 주세요'); GA.plan = null; if (!guildOn()) { GA.pairs.push([a, b]); return refresh(); } needAdmin(() => S.store.patch('meta', 'guild', { keep: { [[a, b].sort().join('|')]: 1 } })); });
act('gaUnpair', (d) => { GA.plan = null; if (!guildOn()) { GA.pairs.splice(+d.i, 1); return refresh(); } const k = pairsNow()[+d.i]?.join('|'); if (k) needAdmin(() => S.store.patch('meta', 'guild', { keep: { [k]: 0 } })); });
act('gaPlan', () => { GA.plan = balance(live().map((p) => p.id), pairsNow()); refresh(); });
act('gaCreate', () => needAdmin(async () => {
  if (!GA.plan || guildOn()) return;
  if (!(await pinAgain('문파 창설은 관리자 PIN을 한 번 더 확인해요.'))) return;
  if (!confirm(`정파 ${GA.plan.j.length}명 · 마교 ${GA.plan.m.length}명으로 창설할까요?`)) return;
  try { await createGuilds({ ...GA.plan, pairs: GA.pairs }); GA.plan = null; GA.pairs = []; toast('정파 · 마교를 창설했어요'); } catch (e) { toast('실패: ' + (e.code || e.message)); }
}));
act('gaAuto', () => needAdmin(async () => {
  for (const p of live().filter((x) => !GUILDS[x.guild])) {
    const sm = smaller() || (() => { const b = balance([...live().filter((x) => GUILDS[x.guild]).map((x) => x.id)], [], 1); return b && b.sj.mmr >= b.sm.mmr ? 'm' : 'j'; })();
    await setGuild(p.id, sm, 'admin');
  }
  toast('배정했어요');
}));
act('gaIntro', (d) => needAdmin(async () => { await S.store.patch('meta', 'guild', { intro: { [d.g]: document.getElementById('ga-in-' + d.g).value.trim().slice(0, 80) } }); toast('소개를 저장했어요'); }));
act('gaLead', (d) => needAdmin(async () => { await S.store.patch('meta', 'guild', { lead: { [d.g]: document.getElementById('ga-ld-' + d.g).value } }); toast('문파장을 저장했어요'); }));
act('gaPw', (d) => needAdmin(async () => {
  const pw = document.getElementById('ga-pw-' + d.g).value, old = document.getElementById('ga-op-' + d.g)?.value || '';
  if (pw.length < 4) return toast('비밀번호는 4자 이상');
  const had = guildMeta()?.sec?.[d.g]?.wk;
  if (had && !old && !confirm('지금 비밀번호 없이 바꾸면 예전 문파 채팅은 아무도 읽을 수 없게 돼요. 계속할까요?')) return;
  try { const { setPassword } = await import('./gchat.js'); await setPassword(d.g, pw, old); toast('비밀번호를 저장했어요. 문파원에게 알려 주세요'); } catch (e) { toast(e.message); }
}));
// 대장(무림맹주·천마)만 남기고 모두 무소속: 소속 기록에 '무소속' 한 칸, 문파 기록은 다시 3명이 된 순간부터
act('gaReset', () => needAdmin(async () => {
  const gm = guildMeta(), keep = new Set(GK.map((g) => gm?.lead?.[g]).filter(Boolean));
  const out = live().filter((p) => GUILDS[p.guild] && !keep.has(p.id));
  if (!out.length) return toast('바꿀 사람이 없어요');
  if (!confirm(`무림맹주·천마만 남기고 ${out.length}명을 무소속으로 바꿀까요?\n문파 기록은 다시 소속이 3명 이상이 된 순간부터 쌓여요.`)) return;
  if (!(await pinAgain('모두 무소속으로 바꾸려면 관리자 PIN을 한 번 더 확인해요.'))) return;
  const at = Date.now();
  try {
    await S.store.bulk(async () => { for (const p of out) await S.store.patch('players', p.id, { guild: '', glog: [...(Array.isArray(p.glog) ? p.glog : []), { g: '', at, by: 'admin' }].slice(-20) }); await S.store.patch('meta', 'guild', { reset: at }); });
    toast(`${out.length}명을 무소속으로 바꿨어요`);
  } catch (e) { toast('실패: ' + (e.code || e.message)); }
}));
act('gaSet', (d) => needAdmin(async () => { if ((gOf(d.id) || '') === d.g) return; if (!d.g) { const p = S.store.data.players[d.id]; await S.store.patch('players', d.id, { guild: '', glog: glogAdd(p, '', 'admin') }); return toast(`${nameOf(d.id)} → 무소속`); } await setGuild(d.id, d.g, 'admin'); toast(`${nameOf(d.id)} → ${gName(d.g)}`); }));
act('gaReApply', () => needAdmin(async () => {
  const plan = GA.plan; if (!plan) return;
  if (!(await pinAgain('전체 다시 나누기는 관리자 PIN을 한 번 더 확인해요.'))) return;
  const mv = GK.flatMap((g) => plan[g].filter((id) => gOf(id) !== g).map((id) => [id, g]));
  if (!mv.length) { GA.plan = null; refresh(); return toast('바뀌는 사람이 없어요'); }
  if (!confirm(`${mv.length}명의 문파를 바꿀까요? (정파 ${plan.j.length}명 · 마교 ${plan.m.length}명)`)) return;
  try { await S.store.bulk(async () => { for (const [id, g] of mv) { const p = S.store.data.players[id]; await S.store.patch('players', id, { guild: g, glog: glogAdd(p, g, 'admin') }); } }); sysChat(`⚖️ 문파 인원을 다시 나눴어요 · 정파 ${plan.j.length}명 · 마교 ${plan.m.length}명`); GA.plan = null; toast(`${mv.length}명을 옮겼어요`); } catch (e) { toast('실패: ' + (e.code || e.message)); }
}));
act('gaMove', (d) => needAdmin(async () => { const g = gOf(d.id); if (!g || !confirm(`${nameOf(d.id)}님을 ${gName(other(g))}(으)로 옮길까요?`)) return; await setGuild(d.id, other(g), 'admin'); toast('옮겼어요'); }));

// ---------- 내 페이지 · 홈 띠 ----------
export function meStrip(id) {
  if (!guildOn()) return '';
  const g = gOf(id);
  if (!g) {
    const sm = smaller(), mine = meId() === id;
    return `<div class="me-gd none"><span class="me-gd-e">${gem('j')}${gem('m')}</span><span class="me-gd-t"><b>아직 문파가 없어요</b><small>관리자가 문파를 배정하면 이름 옆에 엠블럼이 붙어요</small></span></div>`;
  }
  const d = gData('all')[g], v = d.mem[id] || { g: 0, w: 0 }, rl = realm(rwins(g)), tt = gTitles(g)[id];
  return `<div class="me-gd g-${g}"><a class="me-gd-l" href="${ghref(g)}">${gem(g)}<span class="me-gd-t"><small>${GUILDS[g].en}</small><b>${gName(g)}</b></span></a>
    <span class="me-gd-k"><small>문파 기여</small><b class="mono">${v.w}승${d.w ? ` · ${Math.round((v.w / d.w) * 100)}%` : ''}</b></span><span class="me-gd-k"><small>직위</small><b>${esc(rankOf(g, id).n)}</b></span><span class="me-gd-k"><small>문파 경지</small><b>${rl.n}</b></span>${tt ? `<span class="me-gd-tt">${tchips(tt)}</span>` : ''}
</div>`;
}
