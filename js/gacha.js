// 가챠: 내전을 뛰면 받는 뽑기권으로 챔피언·스킨을 뽑아 내 선수 카드를 꾸민다.
//  · 뽑기권은 저장하지 않고 경기 기록에서 계산한다(오픈 이후 출전 판수 기준). 쓴 개수만 gacha/{선수id}.used 에 쌓는다.
//  · 챔피언 뽑기권: 3판마다 1장 + 희생 보너스(주라인이 아닌 라인으로 3판마다 1장) · 스킨 뽑기권: 5판마다 1장 · 오픈 기념 각 1장
//  · 이미 가진 것이 나오면 조각을 주고, 조각으로 뽑기권을 바꿀 수 있다.
//  · 본인 확인은 선수별 PIN(해시만 저장). 친구끼리 쓰는 잠금 수준이라 개발자 도구로는 우회할 수 있다.
// 데이터: gacha/{선수id} = { pinHash, used{champ,skin}, bought{champ,skin}, shards, champs{챔피언id:개수}, skins{스킨id:{n,c,num,name,tier}}, log[] }
//         (구독하지 않는 컬렉션이라 접속자 화면에 퍼지지 않는다. 가챠 화면에서만 한 번씩 읽는다)
import { S, page, act, esc, refresh, toast, sha, needAdmin, ic, burst, settings, modal, closeModal, mh, pickChamp, sigChamp, canPickChamp, DEFAULT_CHAMP, tileUrl } from './core.js';

const START = Date.parse('2026-11-17T12:00:00+09:00'); // 가챠 오픈: 이 시각 이후 경기만 뽑기권으로 친다
// 확률·지급 기준 기본값. 관리 화면 "가챠 설정"에서 바꾸면 meta/settings.gacha 에 저장되고 그 값이 우선한다
export const GACHA_DEF = {
  chMiss: 60, champDup: 1, // 챔피언 뽑기 꽝(%), 챔피언 중복 조각
  every: { champ: 3, skin: 5 }, sac: 3, welcome: { champ: 1, skin: 1 }, shop: { champ: 5, skin: 15 },
  p: { common: 19, epic: 7.5, legendary: 2.8, ultimate: 0.5, mythic: 0.15, transcendent: 0.05 }, // 스킨 등급 확률(%), 꽝 = 100 - 합계
  shard: { common: 2, epic: 4, legendary: 8, ultimate: 15, mythic: 25, transcendent: 40 }, // 스킨 중복 조각
};
export const gcfg = () => { const g = settings().gacha || {}, D = GACHA_DEF; return { ...D, ...g, every: { ...D.every, ...g.every }, welcome: { ...D.welcome, ...g.welcome }, shop: { ...D.shop, ...g.shop }, p: { ...D.p, ...g.p }, shard: { ...D.shard, ...g.shard } }; };
// 스킨 등급(가격 기준): 이름·색·가격 표시는 고정, 확률과 조각은 설정에서 온다
const TIER_META = [
  { k: 'miss', name: '꽝', c: '#7d8799', price: '' },
  { k: 'common', name: '일반', c: '#a9c2db', price: '520~975 RP' },
  { k: 'epic', name: '에픽', c: '#a78bff', price: '1350 RP' },
  { k: 'legendary', name: '전설', c: '#ffb347', price: '1820 RP' },
  { k: 'ultimate', name: '궁극', c: '#ff5d8f', price: '3250 RP' },
  { k: 'mythic', name: '신화', c: '#ff4fd8', price: '신화 정수' },
  { k: 'transcendent', name: '초월', c: '#7ff3ff', price: '한정·최고가' },
];
export function tiers() {
  const g = gcfg(), list = TIER_META.map((t) => ({ ...t, p: t.k === 'miss' ? 0 : Math.max(0, +g.p[t.k] || 0), shard: t.k === 'miss' ? 0 : Math.max(0, +g.shard[t.k] || 0) }));
  list[0].p = Math.max(0, 100 - list.slice(1).reduce((a, t) => a + t.p, 0));
  return list;
}
const TIER = Object.fromEntries(TIER_META.map((t) => [t.k, t])); // 이름·색 찾기용
const RARITY = { kNoRarity: 'common', kRare: 'common', kEpic: 'epic', kLegendary: 'legendary', kUltimate: 'ultimate', kMythic: 'mythic', kTranscendent: 'transcendent', kExalted: 'transcendent' };
const CHAMP_COLOR = '#4fd0e0';

const G = { pid: '', h: '', doc: null, docFor: null, loading: false, cat: null, catBusy: false, catTried: '', catNote: '', tab: 'champ', busy: false };
const meKey = () => 'naejeon:gme:' + S.key;
try { const m = JSON.parse(localStorage.getItem(meKey()) || 'null'); if (m) { G.pid = m.pid; G.h = m.h; } } catch {}
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const pinHash = (pid, pin) => sha(`gacha:${pid}:${pin}`);
const champById = () => Object.fromEntries(S.champs.map((c) => [c.id, c]));
const tileOf = (id, num = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${id === 'Fiddlesticks' ? 'FiddleSticks' : id}_${num}.jpg`;
const artOf = (id, num = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${id === 'Fiddlesticks' ? 'FiddleSticks' : id}_${num}.jpg`;
const blankDoc = (pid) => ({ pid, pinHash: '', used: { champ: 0, skin: 0 }, bought: { champ: 0, skin: 0 }, shards: 0, champs: {}, skins: {}, log: [] });

// ---------- 뽑기권 계산 (경기 기록 기준) ----------
function tickets(pid, doc) {
  const st = S.st, s = st.P[pid]; let g = 0, off = 0;
  if (s) st.matches.forEach((m) => { if (m.at < START) return; const side = m.blue.includes(pid) ? 'blue' : m.red.includes(pid) ? 'red' : ''; if (!side) return; g++; if (['top', 'jg', 'mid', 'adc', 'sup'][m[side].indexOf(pid)] !== s.mainLane) off++; });
  const b = doc?.bought || {}, u = doc?.used || {}, c = gcfg(), E = { champ: Math.max(1, +c.every.champ), skin: Math.max(1, +c.every.skin) }, SAC = Math.max(1, +c.sac);
  const earned = { champ: (+c.welcome.champ || 0) + Math.floor(g / E.champ) + Math.floor(off / SAC) + (+b.champ || 0), skin: (+c.welcome.skin || 0) + Math.floor(g / E.skin) + (+b.skin || 0) };
  return { g, off, sac: SAC, earned, left: { champ: earned.champ - (+u.champ || 0), skin: earned.skin - (+u.skin || 0) }, next: { champ: E.champ - (g % E.champ), skin: E.skin - (g % E.skin), sac: SAC - (off % SAC) } };
}

// ---------- 스킨 목록 (가격 등급 포함) ----------
// 커뮤니티 데이터(CommunityDragon)의 스킨 등급을 받아 [스킨id, 챔피언id, 번호, 이름, 등급]으로 줄여 기기에 저장한다(패치마다 갱신).
// 받지 못하면 라이엇 기본 데이터로 목록만 만들고 모두 '일반'으로 계산한다(표에 안내).
async function skinCatalog() {
  if (G.cat || G.catBusy || !S.ver || !S.champs.length || G.catTried === S.ver) return G.cat;
  G.catTried = S.ver; // 실패해도 같은 패치에서는 다시 시도하지 않는다(화면을 다시 그릴 때마다 받지 않게)
  try { const c = JSON.parse(localStorage.getItem('naejeon:skincat')); if (c?.ver === S.ver && c.list?.length && !c.note) { G.cat = c.list; G.catNote = c.note || ''; return G.cat; } } catch {}
  G.catBusy = true;
  const byKey = Object.fromEntries(S.champs.filter((c) => c.key).map((c) => [c.key, c])); let list = [], note = '';
  try {
    const d = await (await fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/skins.json')).json();
    for (const v of Object.values(d)) {
      if (v.isBase || !v.id) continue;
      const c = byKey[Math.floor(v.id / 1000)]; if (!c) continue;
      list.push([v.id, c.id, v.id % 1000, v.name, RARITY[v.rarity] || 'common']);
    }
  } catch (e) { console.warn('[gacha] 스킨 등급 정보를 받지 못했습니다', e); }
  if (!list.length) {
    try {
      const d = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${S.ver}/data/ko_KR/championFull.json`)).json()).data;
      for (const c of Object.values(d)) for (const k of c.skins) if (k.num > 0) list.push([+k.id, c.id, k.num, k.name, 'common']);
      note = '스킨 가격 정보를 받지 못해 모든 스킨을 일반 등급으로 계산 중이에요';
    } catch (e) { console.warn('[gacha] 스킨 목록을 받지 못했습니다', e); }
  }
  G.catBusy = false;
  if (list.length) { G.cat = list; G.catNote = note; if (!note) try { localStorage.setItem('naejeon:skincat', JSON.stringify({ ver: S.ver, list })); } catch {} }
  if (S.page === 'gacha') refresh();
  return G.cat;
}
// 등급별 확률: p = 관리 화면에서 정한 값(그대로 표시), eff = 실제로 그 등급 스킨이 나올 확률.
// 스킨이 하나도 없는 등급이 뽑히면 바로 아래(더 싼) 등급 중 스킨이 있는 등급으로 준다(없으면 꽝).
function skinOdds() {
  const cnt = {}; (G.cat || []).forEach((x) => (cnt[x[4]] = (cnt[x[4]] || 0) + 1));
  const rows = tiers().map((t) => ({ ...t, n: t.k === 'miss' ? 0 : cnt[t.k] || 0, eff: t.p, to: '' }));
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i].n) continue;
    let j = i - 1; while (j > 0 && !rows[j].n) j--;
    rows[j].eff += rows[i].eff; rows[i].eff = 0; rows[i].to = rows[j].name;
  }
  return rows;
}

// ---------- 문서 읽기 / 본인 확인 ----------
async function loadDoc() {
  if (!G.pid || G.loading) return;
  G.loading = true;
  const pid = G.pid;
  try { G.doc = (await S.store.get('gacha', pid)) || null; } catch (e) { toast('가챠 정보를 불러오지 못했어요: ' + (e.code || e.message)); }
  G.docFor = pid; G.loading = false;
  if (S.page === 'gacha') refresh();
}
const unlocked = () => G.pid && G.doc && G.doc.pinHash && G.doc.pinHash === G.h;
function saveMe() { try { localStorage.setItem(meKey(), JSON.stringify({ pid: G.pid, h: G.h })); } catch {} }

// ---------- 화면 ----------
const fmtPct = (v) => (v >= 1 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(2) : v.toFixed(3)).replace(/\.?0+$/, '') + '%';
function oddsHTML() {
  const nc = S.champs.length, rows = skinOdds(), c = gcfg(), CH_MISS = Math.min(100, Math.max(0, +c.chMiss));
  return `<div class="panel gc-odds"><div class="ph"><b>${ic('scale')}뽑기 확률 공개</b><small class="mut">모든 뽑기는 아래 확률로 무작위 결정됩니다</small></div>
    <div class="gc-odds-g">
      <div><h4>챔피언 뽑기</h4><table class="tbl gc-tbl"><thead><tr><th class="l">결과</th><th>확률</th><th>대상</th><th>개당</th></tr></thead><tbody>
        <tr class="miss"><td class="l"><i style="--c:${TIER.miss.c}"></i>꽝</td><td class="mono">${CH_MISS}%</td><td>-</td><td>-</td></tr>
        <tr><td class="l"><i style="--c:${CHAMP_COLOR}"></i>챔피언 (전원 동일)</td><td class="mono">${100 - CH_MISS}%</td><td class="mono">${nc || '…'}종</td><td class="mono">${nc ? fmtPct((100 - CH_MISS) / nc) : '-'}</td></tr>
      </tbody></table><p class="hint">중복이면 조각 ${c.champDup}개</p></div>
      <div><h4>스킨 뽑기 <small class="mut">(가격이 비쌀수록 낮음)</small></h4><table class="tbl gc-tbl"><thead><tr><th class="l">등급</th><th>확률</th><th>스킨 수</th><th>개당</th><th>중복 조각</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r.k}"><td class="l"><i style="--c:${r.c}"></i>${r.name}${r.price ? ` <small class="mut">${r.price}</small>` : ''}</td><td class="mono">${fmtPct(r.p)}</td><td class="mono">${r.k === 'miss' ? '-' : G.cat ? r.n : '…'}</td><td class="mono">${r.k === 'miss' || !r.n ? '-' : fmtPct(r.eff / r.n)}</td><td class="mono">${r.shard || '-'}</td></tr>`).join('')}
      </tbody></table>${G.cat && rows.some((r) => r.to && r.p) ? `<p class="hint">스킨이 없는 등급: ${rows.filter((r) => r.to && r.p).map((r) => `${r.name} → ${r.to}`).join(', ')} (그 등급이 뽑히면 아래 등급 스킨이 나와요)</p>` : ''}${G.catNote ? `<p class="hint bad">${esc(G.catNote)}</p>` : G.cat ? '' : '<p class="hint">스킨 목록을 불러오는 중…</p>'}</div>
    </div>
    <p class="hint">뽑기권: 오픈(11/17) 이후 내전 ${c.every.champ}판마다 챔피언 뽑기권 1장, ${c.every.skin}판마다 스킨 뽑기권 1장 · <b>희생 보너스</b> 주라인이 아닌 라인으로 ${c.sac}판마다 챔피언 뽑기권 1장 · 오픈 기념 챔피언 ${c.welcome.champ}장·스킨 ${c.welcome.skin}장 · <b>조각</b> 챔피언 뽑기권 ${c.shop.champ}개 / 스킨 뽑기권 ${c.shop.skin}개로 교환</p></div>`;
}
function lockHTML() {
  const list = [...S.st.list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const has = G.doc?.pinHash, sel = G.pid, wait = sel && G.docFor !== sel;
  return `<div class="panel gc-lock">${ic('lock')}<div class="gc-lock-in"><b>내 선수로 들어가기</b>
    <p class="mut sm">뽑기권은 본인만 쓸 수 있도록 선수마다 PIN으로 잠가요. 처음이면 PIN을 새로 정하고, 이 기기에서는 다시 묻지 않아요.</p>
    <form id="gcf" class="gc-lock-f"><select class="inp" id="gcp" data-c="gcPick"><option value="">선수 선택</option>${list.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <input class="inp" id="gcpin" type="password" inputmode="numeric" maxlength="8" placeholder="${sel ? (wait ? '확인 중…' : has ? 'PIN 입력' : '새 PIN 정하기 (4~8자리)') : 'PIN'}" autocomplete="off" ${sel ? '' : 'disabled'}>
      <button class="btn pri" ${sel && !wait ? '' : 'disabled'}>${sel && !wait && !has ? 'PIN 정하고 시작' : '열기'}</button></form>
    ${sel && has ? '<p class="hint">PIN을 잊었다면 관리자에게 초기화를 부탁하세요. <button class="lnk" data-a="gcReset">관리자: PIN 초기화</button></p>' : ''}</div></div>`;
}
function itemTile(src, name, sub, color, on, attrs) {
  return `<button class="gc-it ${on ? 'on' : ''}" style="--c:${color}" ${attrs}><span class="gc-it-art" style="--img:url('${src}')"></span><b>${esc(name)}</b>${sub ? `<small>${sub}</small>` : ''}${on ? '<em>적용 중</em>' : ''}</button>`;
}
// 보관함(챔피언·스킨 탭): 누르면 내 선수 카드에 적용. 가챠 페이지와 선수 카드의 "카드 꾸미기" 창에서 같이 쓴다
function colHTML() {
  const d = G.doc, by = champById(), p = S.st.P[G.pid]?.p || {}, curNum = p.skin?.champ === p.champ ? +p.skin?.num || 0 : 0;
  const champs = Object.entries(d.champs || {}).map(([id, n]) => ({ id, n, c: by[id] })).filter((x) => x.c).sort((a, b) => a.c.name.localeCompare(b.c.name, 'ko'));
  const skins = Object.entries(d.skins || {}).map(([sid, x]) => ({ sid, ...x })).sort((a, b) => TIER_META.findIndex((q) => q.k === b.tier) - TIER_META.findIndex((q) => q.k === a.tier) || a.name.localeCompare(b.name, 'ko'));
  return `<div class="ph"><b>${ic('star')}내 보관함</b><span class="grow"></span><div class="seg"><button class="${G.tab === 'champ' ? 'on' : ''}" data-a="gcTab" data-t="champ">챔피언 ${champs.length}</button><button class="${G.tab === 'skin' ? 'on' : ''}" data-a="gcTab" data-t="skin">스킨 ${skins.length}</button></div></div>
      <p class="hint">누르면 내 선수 카드에 적용돼요(랭킹·홈 등 모든 화면, 모두에게 보여요). 챔피언은 기본 스킨으로, 스킨은 그 스킨으로 바뀌어요.</p>
      <div class="gc-grid">${G.tab === 'champ'
        ? champs.map((x) => itemTile(tileOf(x.id), x.c.name, x.n > 1 ? `×${x.n}` : '', CHAMP_COLOR, p.champ === x.c.name && !curNum, `data-a="gcEquip" data-t="champ" data-id="${x.id}"`)).join('') || '<p class="mut sm">아직 뽑은 챔피언이 없어요.</p>'
        : skins.map((x) => itemTile(tileOf(x.c, x.num), x.name, `${TIER[x.tier]?.name || ''}${x.n > 1 ? ` · ×${x.n}` : ''}`, TIER[x.tier]?.c || '#aaa', p.champ === by[x.c]?.name && curNum === +x.num, `data-a="gcEquip" data-t="skin" data-id="${x.sid}"`)).join('') || '<p class="mut sm">아직 뽑은 스킨이 없어요.</p>'}</div>`;
}
const mainRow = (s) => { const main = sigChamp(s); return `<div class="panel gc-main"><span class="gc-main-art" style="--img:url('${main ? tileUrl(main) : ''}')"></span><div class="gc-main-tx"><small>MY CHAMPION</small><b>${esc(main || DEFAULT_CHAMP)}</b><span class="mut sm">선수 카드·랭킹·홈 등 내 선수가 나오는 모든 화면에 보여요. 전체 챔피언 중 기본 스킨으로 고르거나, 아래 보관함에서 뽑은 챔피언·스킨을 눌러 적용해요.</span></div><button class="btn gold" data-a="gcMain">${ic('star')}기본 챔피언 고르기</button></div>`; };
function mineHTML() {
  const d = G.doc, s = S.st.P[G.pid], t = tickets(G.pid, d);
  const ready = S.champs.length > 0, c = gcfg(), SHOP = c.shop;
  return `<div class="gc-who"><span>${ic('user')}<b>${esc(s?.name || '?')}</b> 님의 가챠</span><span class="grow"></span><button class="btn ghost xs" data-a="gcLock">${ic('lock')}잠그기</button></div>
    ${canPickChamp(s) ? mainRow(s) : ''}
    <div class="gc-tix">
      <div class="gc-tk ch"><small>CHAMPION TICKET</small><b class="mono">${t.left.champ}</b><span>챔피언 뽑기권</span><em>다음까지 ${t.next.champ}판 · 희생 보너스 ${t.sac - t.next.sac}/${t.sac}</em></div>
      <div class="gc-tk sk"><small>SKIN TICKET</small><b class="mono">${t.left.skin}</b><span>스킨 뽑기권</span><em>다음까지 ${t.next.skin}판</em></div>
      <div class="gc-tk sh"><small>SHARDS</small><b class="mono">${+d.shards || 0}</b><span>조각</span><em><button class="lnk" data-a="gcBuy" data-k="champ" ${(+d.shards || 0) >= SHOP.champ ? '' : 'disabled'}>챔피언권 교환(${SHOP.champ})</button> · <button class="lnk" data-a="gcBuy" data-k="skin" ${(+d.shards || 0) >= SHOP.skin ? '' : 'disabled'}>스킨권 교환(${SHOP.skin})</button></em></div>
    </div>
    <div class="gc-mach">
      <button class="gc-go ch" data-a="gcDraw" data-k="champ" ${t.left.champ > 0 && ready && !G.busy ? '' : 'disabled'}><i class="gc-orb"></i><span><b>챔피언 뽑기</b><small>뽑기권 1장 · 꽝 ${c.chMiss}%</small></span></button>
      <button class="gc-go sk" data-a="gcDraw" data-k="skin" ${t.left.skin > 0 && G.cat && !G.busy ? '' : 'disabled'}><i class="gc-orb"></i><span><b>스킨 뽑기</b><small>${G.cat ? `뽑기권 1장 · 꽝 ${fmtPct(skinOdds()[0].p)}` : '스킨 목록 불러오는 중…'}</small></span></button>
    </div>
    <div class="panel gc-col">${colHTML()}</div>
    ${d.log?.length ? `<div class="panel"><div class="ph"><b>${ic('scroll')}최근 뽑기</b></div><div class="gc-log">${d.log.slice(0, 12).map((l) => `<span class="gc-lg ${l.t}" style="--c:${l.t === 'champ' ? CHAMP_COLOR : TIER[l.t]?.c || '#888'}"><i></i>${l.k === 'champ' ? '챔피언' : '스킨'} · <b>${l.t === 'miss' ? '꽝' : esc(l.n)}</b>${l.d ? ` <small>중복 +${l.d}조각</small>` : ''}</span>`).join('')}</div></div>` : ''}`;
}
page('gacha', {
  render() {
    if (!G.cat && !G.catBusy) setTimeout(skinCatalog, 0);
    if (G.pid && G.docFor !== G.pid && !G.loading) setTimeout(loadDoc, 0); // 이 선수 문서를 아직 한 번도 안 읽었을 때만
    return `<div class="h2row"><h1>${ic('gacha')}가챠</h1><span class="tag gold">챔피언·스킨 수집</span></div>
      <p class="hint">내전을 뛰면 뽑기권이 쌓여요. 챔피언·스킨을 뽑아 모으고, 내 PIN으로 열면 선수 카드에 보일 기본 챔피언도 여기서 고를 수 있어요.</p>
      ${unlocked() ? mineHTML() : lockHTML()}
      ${oddsHTML()}`;
  },
});

// ---------- 동작 ----------
act('gcPick', async (d, el) => { G.pid = el.value; G.doc = null; G.docFor = null; G.h = ''; refresh(); });
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'gcf' && e.target.id !== 'gcdf') return;
  const inDeco = e.target.id === 'gcdf';
  e.preventDefault();
  const pin = (e.target.querySelector('input[type=password]')?.value || '').trim();
  if (!G.pid) return toast('선수를 먼저 골라 주세요');
  if (!/^\d{4,8}$/.test(pin)) return toast('PIN은 숫자 4~8자리로 해 주세요');
  const h = await pinHash(G.pid, pin);
  let res = null;
  try {
    res = await S.store.tx('gacha', G.pid, (doc) => {
      const cur = doc || blankDoc(G.pid);
      if (cur.pinHash) return cur.pinHash === h ? null : null; // 이미 있으면 바꾸지 않고 아래에서 비교만
      return { ...cur, pinHash: h, at: Date.now() };
    });
  } catch (err) { return toast('실패: ' + (err.code || err.message)); }
  await loadDoc();
  if (G.doc?.pinHash !== h) return toast(res ? 'PIN 저장에 실패했어요' : 'PIN이 맞지 않아요');
  G.h = h; saveMe(); toast(res ? 'PIN을 정했어요. 이 기기에서는 다시 묻지 않아요' : '열었어요');
  if (inDeco) renderDeco(); else refresh();
});
act('gcLock', () => { G.h = ''; saveMe(); refresh(); });
act('gcReset', () => needAdmin(async () => {
  if (!G.pid || !confirm(`${S.st.P[G.pid]?.name} 선수의 가챠 PIN을 초기화할까요? (뽑기권·보관함은 그대로)`)) return;
  await S.store.patch('gacha', G.pid, { pinHash: '' }); await loadDoc(); toast('PIN을 초기화했어요. 새 PIN을 정해 주세요');
}));
act('gcTab', (d) => { G.tab = d.t; if (document.querySelector('#modal.on .deco-in')) renderDeco(); else refresh(); });

// 조각 → 뽑기권
act('gcBuy', async (d) => {
  if (!unlocked()) return; const k = d.k, cost = Math.max(1, +gcfg().shop[k]);
  if (!confirm(`조각 ${cost}개로 ${k === 'champ' ? '챔피언' : '스킨'} 뽑기권 1장을 받을까요?`)) return;
  try {
    await S.store.tx('gacha', G.pid, (doc) => {
      if (!doc || doc.pinHash !== G.h || (+doc.shards || 0) < cost) return null;
      return { ...doc, shards: doc.shards - cost, bought: { ...(doc.bought || {}), [k]: (+doc.bought?.[k] || 0) + 1 } };
    });
  } catch (e) { return toast('실패: ' + (e.code || e.message)); }
  await loadDoc(); toast('뽑기권으로 바꿨어요');
});

// 뽑기: 결과를 먼저 정한 뒤(무작위) 거래로 뽑기권을 쓰고 보관함에 넣는다. 그다음 등급에 맞는 연출을 재생한다
act('gcDraw', async (d) => {
  if (!unlocked() || G.busy) return;
  const k = d.k, t = tickets(G.pid, G.doc);
  if (t.left[k] <= 0) return toast('뽑기권이 없어요');
  let res;
  if (k === 'champ') {
    if (!S.champs.length) return toast('챔피언 목록을 불러오는 중이에요');
    if (rand() * 100 < +gcfg().chMiss) res = { t: 'miss' };
    else { const c = S.champs[Math.floor(rand() * S.champs.length)]; res = { t: 'champ', id: c.id, n: c.name }; }
  } else {
    if (!G.cat) return toast('스킨 목록을 불러오는 중이에요');
    const rows = skinOdds(); let r = rand() * 100, tier = 'miss';
    for (const row of rows) { if (r < row.eff) { tier = row.k; break; } r -= row.eff; }
    if (tier === 'miss') res = { t: 'miss' };
    else { const pool = G.cat.filter((x) => x[4] === tier), x = pool[Math.floor(rand() * pool.length)]; res = { t: tier, sid: String(x[0]), c: x[1], num: x[2], n: x[3] }; }
  }
  G.busy = true; refresh();
  let dup = 0, ok = false;
  try {
    ok = await S.store.tx('gacha', G.pid, (doc) => {
      if (!doc || doc.pinHash !== G.h) return null;
      if (tickets(G.pid, doc).left[k] <= 0) return null;
      const next = { ...doc, used: { ...(doc.used || {}), [k]: (+doc.used?.[k] || 0) + 1 }, champs: { ...(doc.champs || {}) }, skins: { ...(doc.skins || {}) }, shards: +doc.shards || 0 };
      dup = 0;
      if (res.t === 'champ') { if (next.champs[res.id]) dup = +gcfg().champDup || 0; next.champs[res.id] = (next.champs[res.id] || 0) + 1; }
      else if (res.t !== 'miss') { const had = next.skins[res.sid]; if (had) dup = +gcfg().shard[res.t] || 0; next.skins[res.sid] = { n: (had?.n || 0) + 1, c: res.c, num: res.num, name: res.n, tier: res.t }; }
      next.shards += dup;
      next.log = [{ at: Date.now(), k, t: res.t, n: res.n || '', d: dup }, ...(doc.log || [])].slice(0, 30);
      return next;
    });
  } catch (e) { G.busy = false; refresh(); return toast('뽑기 실패: ' + (e.code || e.message)); }
  if (!ok) { G.busy = false; await loadDoc(); return toast('뽑기권이 없거나 잠겨 있어요'); }
  await play(k, res, dup);
  G.busy = false; await loadDoc();
});

// ---------- 연출 ----------
// 1단계(모두 같음, 2초): 캡슐이 떠올라 흔들리며 빛을 모은다 → 결과를 미리 알 수 없다
// 2단계(등급별): 꽝은 연기와 함께 담담하게, 등급이 높을수록 빛줄기·충격파·흔들림·폭죽이 커진다
const LEVEL = { miss: 0, champ: 2, common: 1, epic: 3, legendary: 4, ultimate: 5, mythic: 6, transcendent: 6 };
function play(k, res, dup) {
  return new Promise((done) => {
    const lv = LEVEL[res.t] ?? 1, tier = res.t === 'champ' ? { name: '챔피언', c: CHAMP_COLOR } : TIER[res.t];
    const img = res.t === 'champ' ? artOf(res.id) : res.t !== 'miss' ? artOf(res.c, res.num) : '';
    if (img) { const pre = new Image(); pre.src = img; } // 연출 중에 미리 받아 둔다
    const el = document.createElement('div');
    el.id = 'gx'; el.className = `gx ${k}`; el.style.setProperty('--c', tier.c);
    el.innerHTML = `<div class="gx-bg"></div><div class="gx-rays"></div><div class="gx-ring"></div><div class="gx-ring r2"></div>
      <div class="gx-cap"><i class="gx-cap-t"></i><i class="gx-cap-b"></i><i class="gx-core"></i></div>
      <div class="gx-card">${res.t === 'miss'
        ? '<div class="gx-miss"><b>꽝</b><span>다음 기회에…</span></div>'
        : `<div class="gx-art" style="--img:url('${img}')"></div><div class="gx-info"><small style="color:${tier.c}">${tier.name}${lv >= 4 ? ' ★'.repeat(lv - 3) : ''}${tier.price ? ` · ${tier.price}` : ''}</small><b>${esc(res.n)}</b>${dup ? `<em>중복! 조각 +${dup}</em>` : '<em>새로 획득!</em>'}</div>`}</div>
      <div class="gx-banner">${lv >= 6 ? 'MYTHIC' : lv === 5 ? 'ULTIMATE' : lv === 4 ? 'LEGENDARY' : ''}</div>
      <button class="gx-x btn ghost" hidden>확인</button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const timers = [];
    const later = (ms, f) => timers.push(setTimeout(f, ms));
    const cx = () => innerWidth / 2, cy = () => innerHeight / 2;
    later(2000, () => {
      el.classList.add('open', `lv${lv}`, res.t);
      if (lv === 0) return;
      burst(cx(), cy(), [0, 40, 50, 90, 140, 200, 260][lv]);
      if (lv >= 4) document.body.classList.add('gx-shake');
      if (lv >= 5) { later(500, () => burst(cx() - 160, cy() - 80, 120)); later(800, () => burst(cx() + 160, cy() - 60, 120)); }
      if (lv >= 6) for (let i = 0; i < 6; i++) later(1100 + i * 280, () => burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.4), 110));
      later(700, () => document.body.classList.remove('gx-shake'));
    });
    const close = () => { timers.forEach(clearTimeout); document.body.classList.remove('gx-shake'); el.classList.add('out'); setTimeout(() => el.remove(), 350); done(); };
    later(2000 + [500, 700, 800, 1000, 1400, 1800, 2200][lv], () => { const b = el.querySelector('.gx-x'); b.hidden = false; b.onclick = close; el.onclick = (e) => { if (e.target === el || e.target.classList.contains('gx-bg')) close(); }; });
  });
}

// ---------- 기본 챔피언 고르기(가챠 페이지, 본인 PIN으로 연 뒤) ----------
// 전체 챔피언 중 하나를 골라 players/{id}.champ 에 저장한다(기본 일러스트, 스킨은 고르지 않음). 선수 관련 모든 화면에 쓰인다.
act('gcMain', () => {
  if (!unlocked()) return; const pid = G.pid, s = S.st.P[pid]; if (!canPickChamp(s)) return;
  pickChamp({ title: `${s.name} · 기본 챔피언 고르기 (비우면 ${DEFAULT_CHAMP})`, current: sigChamp(s), onPick: async (name) => {
    try { await S.store.patch('players', pid, { champ: name || '', skin: { champ: '', num: 0, name: '' } }); toast(`기본 챔피언을 ${name || DEFAULT_CHAMP}(으)로 바꿨어요`); }
    catch (e) { toast('저장 실패: ' + (e.code || e.message)); }
    refresh();
  } });
});

// 보관함에서 적용: players/{id}.champ + skin{champ,num,name}
act('gcEquip', async (d) => {
  if (!unlocked()) return; const pid = G.pid; if (!canPickChamp(S.st.P[pid])) return toast('이 선수는 카드 챔피언이 고정이에요');
  const by = champById(); let champ, num = 0, name = '';
  if (d.t === 'champ') { const c = by[d.id]; if (!c || !G.doc.champs?.[d.id]) return; champ = c.name; }
  else { const x = G.doc.skins?.[d.id], c = x && by[x.c]; if (!c) return; champ = c.name; num = +x.num; name = x.name; }
  try { await S.store.patch('players', pid, { champ, skin: { champ, num, name } }); toast(`내 선수 카드에 ${name || champ}을(를) 적용했어요`); }
  catch (e) { return toast('실패: ' + (e.code || e.message)); }
  refresh(); if (document.querySelector('#modal.on .deco-in')) setTimeout(renderDeco, 60); // 통계가 다시 계산된 뒤 창을 새로 그린다
});

// ---------- 선수 카드의 "카드 꾸미기" 창: 본인 PIN 확인 → 기본 챔피언 고르기 + 보관함 ----------
export async function openDeco(pid) {
  const s = S.st.P[pid]; if (!canPickChamp(s)) return;
  if (G.pid !== pid) {
    let me = null; try { me = JSON.parse(localStorage.getItem(meKey()) || 'null'); } catch {}
    G.pid = pid; G.h = me?.pid === pid ? me.h : ''; G.doc = null; G.docFor = null;
  }
  modal(`<div class="deco-in">${mh(`${ic('star')}${esc(s.name)} 카드 꾸미기`)}<p class="mut">불러오는 중…</p></div>`, 'tall deco');
  if (G.docFor !== pid) await loadDoc();
  renderDeco();
}
function renderDeco() {
  const box = document.querySelector('#modal.on .deco-in'); if (!box) return;
  const s = S.st.P[G.pid], head = mh(`${ic('star')}${esc(s?.name || '')} 카드 꾸미기`);
  if (!G.doc?.pinHash) box.innerHTML = `${head}<p>본인만 꾸밀 수 있도록 가챠 페이지에서 먼저 PIN을 정해 주세요. 정한 뒤에는 여기서 바로 꾸밀 수 있어요.</p><button class="btn pri" data-a="decoGo">${ic('gacha')}가챠로 가기</button>`;
  else if (!unlocked()) box.innerHTML = `${head}<p class="mut sm">본인 확인을 위해 가챠 PIN을 입력해 주세요. 이 기기에서는 다시 묻지 않아요.</p>
    <form id="gcdf" class="gc-lock-f"><input class="inp" type="password" inputmode="numeric" maxlength="8" placeholder="PIN 입력" autocomplete="off"><button class="btn pri">확인</button></form>`;
  else box.innerHTML = `${head}${mainRow(s)}<div class="gc-col">${colHTML()}</div><p class="hint">더 뽑으려면 <button class="lnk" data-a="decoGo">가챠 페이지</button>로 가세요.</p>`;
  box.querySelector('input[type=password]')?.focus();
}
act('decoOpen', (d) => openDeco(d.id));
act('decoGo', () => { closeModal(); location.hash = '#/gacha'; });

// ---------- 관리 화면: 가챠 설정(확률·지급 기준) ----------
const NUM = (n, v, step = 'any', w = '') => `<input class="inp mono gcf-n" name="${n}" type="number" min="0" step="${step}" value="${v}" ${w}>`;
export function gachaAdminHTML() {
  const c = gcfg(), T = tiers(), sum = T.slice(1).reduce((a, t) => a + t.p, 0);
  return `<div class="panel gcf"><div class="ph"><b>${ic('gacha')}가챠 설정</b><small class="mut">확률·지급 기준 (저장하면 바로 모두에게 적용)</small></div>
    <form id="gcff">
      <div class="gcf-g">
        <div><h4>챔피언 뽑기</h4>
          <label>꽝 확률 % ${NUM('chMiss', c.chMiss)}</label><p class="mut sm">나머지 ${Math.max(0, 100 - c.chMiss)}%를 모든 챔피언이 똑같이 나눔</p>
          <label>중복 조각 ${NUM('champDup', c.champDup, 1)}</label><p class="gcf-d">이미 가진 챔피언이 또 나오면 받는 조각 개수예요. 0이면 조각을 주지 않아요.</p></div>
        <div><h4>스킨 뽑기 <small class="mut">꽝 = 100 − 등급 합계</small></h4>
          <table class="tbl gc-tbl"><thead><tr><th class="l">등급</th><th>확률 %</th><th>중복 조각</th></tr></thead><tbody>
            <tr><td class="l"><i style="--c:${TIER.miss.c}"></i>꽝</td><td class="mono" id="gcf-miss">${(100 - sum).toFixed(2).replace(/\.?0+$/, '')}</td><td>-</td></tr>
            ${T.slice(1).map((t) => `<tr><td class="l"><i style="--c:${t.c}"></i>${t.name} <small class="mut">${t.price}</small></td><td>${NUM('p.' + t.k, t.p)}</td><td>${NUM('shard.' + t.k, t.shard, 1)}</td></tr>`).join('')}
          </tbody></table><p class="gcf-d">확률 %: 스킨 뽑기 한 번에 그 등급이 나올 확률이에요. 등급 안에서는 모든 스킨이 똑같은 확률로 나오고, 합계가 100을 넘을 수 없어요. 중복 조각: 이미 가진 스킨이 또 나오면 받는 조각 개수예요.</p></div>
        <div><h4>뽑기권 지급</h4>
          <label>챔피언 뽑기권: ${NUM('every.champ', c.every.champ, 1)} 판마다</label>
          <label>스킨 뽑기권: ${NUM('every.skin', c.every.skin, 1)} 판마다</label><p class="gcf-d">오픈(11/17) 이후 내전에 나간 판수로 계산해요. 이기든 지든 똑같이 쳐요.</p>
          <label>희생 보너스(주라인 밖): ${NUM('sac', c.sac, 1)} 판마다 챔피언권</label><p class="gcf-d">주라인이 아닌 라인으로 이만큼 뛰면 챔피언 뽑기권을 1장 더 줘요.</p>
          <label>오픈 기념: 챔피언 ${NUM('welcome.champ', c.welcome.champ, 1)} 장 · 스킨 ${NUM('welcome.skin', c.welcome.skin, 1)} 장</label><p class="gcf-d">모든 선수에게 처음부터 주는 뽑기권이에요.</p>
          <h4>조각 교환</h4>
          <label>챔피언 뽑기권 = ${NUM('shop.champ', c.shop.champ, 1)} 조각</label>
          <label>스킨 뽑기권 = ${NUM('shop.skin', c.shop.skin, 1)} 조각</label><p class="gcf-d">모은 조각을 이 개수만큼 내면 가챠 페이지에서 뽑기권 1장으로 바꿀 수 있어요.</p></div>
      </div>
      <div class="row wrapr"><button class="btn pri">가챠 설정 저장</button><button type="button" class="btn ghost" data-a="gcCfgReset">기본값으로</button><span class="mut sm">관리자 PIN 필요 · 지급 판수를 바꾸면 이미 쌓인 뽑기권 수도 다시 계산돼요</span></div>
    </form></div>`;
}
document.addEventListener('input', (e) => { // 스킨 등급 확률을 바꾸면 꽝 확률을 바로 보여 준다
  const f = e.target.closest?.('#gcff'); if (!f) return;
  const sum = [...f.querySelectorAll('input[name^="p."]')].reduce((a, i) => a + (+i.value || 0), 0), el = document.getElementById('gcf-miss');
  if (el) { el.textContent = (100 - sum).toFixed(2).replace(/\.?0+$/, ''); el.classList.toggle('bad', sum > 100); }
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'gcff') return;
  e.preventDefault();
  const f = new FormData(e.target), g = { every: {}, welcome: {}, shop: {}, p: {}, shard: {} };
  for (const [k, v] of f.entries()) { const n = Math.max(0, +v || 0), [a, b] = k.split('.'); if (b) g[a][b] = n; else g[a] = n; }
  const sum = Object.values(g.p).reduce((a, x) => a + x, 0);
  if (sum > 100) return toast(`스킨 등급 확률 합계가 ${sum}%예요. 100% 이하로 맞춰 주세요`);
  if (g.chMiss > 100) return toast('챔피언 꽝 확률은 100% 이하로 해 주세요');
  for (const k of ['champ', 'skin']) if (g.every[k] < 1 || g.shop[k] < 1) return toast('지급 판수와 교환 조각은 1 이상이어야 해요');
  if (g.sac < 1) return toast('희생 보너스 판수는 1 이상이어야 해요');
  needAdmin(async () => { await S.store.patch('meta', 'settings', { gacha: g }); toast('가챠 설정을 저장했어요'); refresh(); });
});
act('gcCfgReset', () => needAdmin(async () => { if (!confirm('가챠 설정을 기본값으로 되돌릴까요?')) return; await S.store.patch('meta', 'settings', { gacha: JSON.parse(JSON.stringify(GACHA_DEF)) }); toast('기본값으로 되돌렸어요'); refresh(); }));
