// 가챠: 내전을 뛰면 받는 뽑기권으로 챔피언·스킨을 뽑아 내 선수 카드를 꾸민다.
//  · 뽑기권은 저장하지 않고 경기 기록에서 계산한다(오픈 이후 출전 판수 기준). 쓴 개수만 gacha/{선수id}.used 에 쌓는다.
//  · 챔피언 뽑기권: 3판마다 1장 + 희생 보너스(주라인이 아닌 라인으로 3판마다 1장) · 스킨 뽑기권: 5판마다 1장 · 오픈 기념 각 1장
//  · 이미 가진 것이 나오면 조각을 주고, 조각으로 뽑기권을 바꿀 수 있다.
//  · 본인 확인은 선수별 PIN(해시만 저장). 친구끼리 쓰는 잠금 수준이라 개발자 도구로는 우회할 수 있다.
// 데이터: gacha/{선수id} = { pinHash, used{champ,skin}, bought{champ,skin}, shards, champs{챔피언id:개수}, skins{스킨id:{n,c,num,name,tier}}, log[] }
//         (구독하지 않는 컬렉션이라 접속자 화면에 퍼지지 않는다. 가챠 화면에서만 한 번씩 읽는다)
import { S, page, act, esc, refresh, toast, sha, needAdmin, ic, burst } from './core.js';

const START = Date.parse('2026-11-17T12:00:00+09:00'); // 가챠 오픈: 이 시각 이후 경기만 뽑기권으로 친다
const WELCOME = { champ: 1, skin: 1 }; // 오픈 기념 지급
const EVERY = { champ: 3, skin: 5 }, SAC_EVERY = 3; // 판수 기준
const SHOP = { champ: 5, skin: 15 }; // 조각으로 뽑기권 교환 가격
const CH_MISS = 60; // 챔피언 뽑기 꽝 확률(%)
// 스킨 등급(가격 기준). 확률(%)은 등급 전체 합이고 같은 등급 안에서는 똑같이 나눈다. 조각 = 중복일 때 받는 조각 수
export const TIERS = [
  { k: 'miss', name: '꽝', p: 70, c: '#7d8799', shard: 0, price: '' },
  { k: 'common', name: '일반', p: 19, c: '#a9c2db', shard: 2, price: '520~975 RP' },
  { k: 'epic', name: '에픽', p: 7.5, c: '#a78bff', shard: 4, price: '1350 RP' },
  { k: 'legendary', name: '전설', p: 2.8, c: '#ffb347', shard: 8, price: '1820 RP' },
  { k: 'ultimate', name: '궁극', p: 0.5, c: '#ff5d8f', shard: 15, price: '3250 RP' },
  { k: 'mythic', name: '신화', p: 0.15, c: '#ff4fd8', shard: 25, price: '신화 정수' },
  { k: 'transcendent', name: '초월', p: 0.05, c: '#7ff3ff', shard: 40, price: '한정·최고가' },
];
const TIER = Object.fromEntries(TIERS.map((t) => [t.k, t]));
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
  const b = doc?.bought || {}, u = doc?.used || {};
  const earned = { champ: WELCOME.champ + Math.floor(g / EVERY.champ) + Math.floor(off / SAC_EVERY) + (+b.champ || 0), skin: WELCOME.skin + Math.floor(g / EVERY.skin) + (+b.skin || 0) };
  return { g, off, earned, left: { champ: earned.champ - (+u.champ || 0), skin: earned.skin - (+u.skin || 0) }, next: { champ: EVERY.champ - (g % EVERY.champ), skin: EVERY.skin - (g % EVERY.skin), sac: SAC_EVERY - (off % SAC_EVERY) } };
}

// ---------- 스킨 목록 (가격 등급 포함) ----------
// 커뮤니티 데이터(CommunityDragon)의 스킨 등급을 받아 [스킨id, 챔피언id, 번호, 이름, 등급]으로 줄여 기기에 저장한다(패치마다 갱신).
// 받지 못하면 라이엇 기본 데이터로 목록만 만들고 모두 '일반'으로 계산한다(표에 안내).
async function skinCatalog() {
  if (G.cat || G.catBusy || !S.ver || !S.champs.length || G.catTried === S.ver) return G.cat;
  G.catTried = S.ver; // 실패해도 같은 패치에서는 다시 시도하지 않는다(화면을 다시 그릴 때마다 받지 않게)
  try { const c = JSON.parse(localStorage.getItem('naejeon:skincat')); if (c?.ver === S.ver && c.list?.length) { G.cat = c.list; G.catNote = c.note || ''; return G.cat; } } catch {}
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
  if (list.length) { G.cat = list; G.catNote = note; try { localStorage.setItem('naejeon:skincat', JSON.stringify({ ver: S.ver, list, note })); } catch {} }
  if (S.page === 'gacha') refresh();
  return G.cat;
}
// 등급별 실제 확률: 스킨이 하나도 없는 등급의 확률은 꽝으로 넘긴다
function skinOdds() {
  const cnt = {}; (G.cat || []).forEach((x) => (cnt[x[4]] = (cnt[x[4]] || 0) + 1));
  let miss = 0; const rows = TIERS.map((t) => ({ ...t, n: t.k === 'miss' ? 0 : cnt[t.k] || 0 }));
  rows.forEach((r) => { if (r.k !== 'miss' && !r.n) { miss += r.p; r.p = 0; } });
  rows[0].p += miss;
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
  const nc = S.champs.length, rows = skinOdds();
  return `<div class="panel gc-odds"><div class="ph"><b>${ic('scale')}뽑기 확률 공개</b><small class="mut">모든 뽑기는 아래 확률로 무작위 결정됩니다</small></div>
    <div class="gc-odds-g">
      <div><h4>챔피언 뽑기</h4><table class="tbl gc-tbl"><thead><tr><th class="l">결과</th><th>확률</th><th>대상</th><th>개당</th></tr></thead><tbody>
        <tr class="miss"><td class="l"><i style="--c:${TIER.miss.c}"></i>꽝</td><td class="mono">${CH_MISS}%</td><td>-</td><td>-</td></tr>
        <tr><td class="l"><i style="--c:${CHAMP_COLOR}"></i>챔피언 (전원 동일)</td><td class="mono">${100 - CH_MISS}%</td><td class="mono">${nc || '…'}종</td><td class="mono">${nc ? fmtPct((100 - CH_MISS) / nc) : '-'}</td></tr>
      </tbody></table><p class="hint">중복이면 조각 1개</p></div>
      <div><h4>스킨 뽑기 <small class="mut">(가격이 비쌀수록 낮음)</small></h4><table class="tbl gc-tbl"><thead><tr><th class="l">등급</th><th>확률</th><th>스킨 수</th><th>개당</th><th>중복 조각</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${r.k}"><td class="l"><i style="--c:${r.c}"></i>${r.name}${r.price ? ` <small class="mut">${r.price}</small>` : ''}</td><td class="mono">${fmtPct(r.p)}</td><td class="mono">${r.k === 'miss' ? '-' : G.cat ? r.n : '…'}</td><td class="mono">${r.k === 'miss' || !r.n ? '-' : fmtPct(r.p / r.n)}</td><td class="mono">${r.shard || '-'}</td></tr>`).join('')}
      </tbody></table>${G.catNote ? `<p class="hint bad">${esc(G.catNote)}</p>` : G.cat ? '' : '<p class="hint">스킨 목록을 불러오는 중…</p>'}</div>
    </div>
    <p class="hint">뽑기권: 오픈(11/17) 이후 내전 ${EVERY.champ}판마다 챔피언 뽑기권 1장, ${EVERY.skin}판마다 스킨 뽑기권 1장 · <b>희생 보너스</b> 주라인이 아닌 라인으로 ${SAC_EVERY}판마다 챔피언 뽑기권 1장 · 오픈 기념 각 1장 · <b>조각</b> 챔피언 뽑기권 ${SHOP.champ}개 / 스킨 뽑기권 ${SHOP.skin}개로 교환</p></div>`;
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
function mineHTML() {
  const d = G.doc, s = S.st.P[G.pid], t = tickets(G.pid, d), by = champById(), eq = s?.p.skin?.pick ? s.p.skin : null;
  const champs = Object.entries(d.champs || {}).map(([id, n]) => ({ id, n, c: by[id] })).filter((x) => x.c).sort((a, b) => a.c.name.localeCompare(b.c.name, 'ko'));
  const skins = Object.entries(d.skins || {}).map(([sid, x]) => ({ sid, ...x })).sort((a, b) => TIERS.findIndex((q) => q.k === b.tier) - TIERS.findIndex((q) => q.k === a.tier) || a.name.localeCompare(b.name, 'ko'));
  const ready = S.champs.length > 0;
  return `<div class="gc-who"><span>${ic('user')}<b>${esc(s?.name || '?')}</b> 님의 가챠</span><span class="grow"></span>${eq ? `<span class="mut sm">카드: ${esc(eq.name || eq.champ)}</span>` : ''}<button class="btn ghost xs" data-a="gcLock">${ic('lock')}잠그기</button></div>
    <div class="gc-tix">
      <div class="gc-tk ch"><small>CHAMPION TICKET</small><b class="mono">${t.left.champ}</b><span>챔피언 뽑기권</span><em>다음까지 ${t.next.champ}판 · 희생 보너스 ${SAC_EVERY - t.next.sac}/${SAC_EVERY}</em></div>
      <div class="gc-tk sk"><small>SKIN TICKET</small><b class="mono">${t.left.skin}</b><span>스킨 뽑기권</span><em>다음까지 ${t.next.skin}판</em></div>
      <div class="gc-tk sh"><small>SHARDS</small><b class="mono">${+d.shards || 0}</b><span>조각</span><em><button class="lnk" data-a="gcBuy" data-k="champ" ${(+d.shards || 0) >= SHOP.champ ? '' : 'disabled'}>챔피언권 교환(${SHOP.champ})</button> · <button class="lnk" data-a="gcBuy" data-k="skin" ${(+d.shards || 0) >= SHOP.skin ? '' : 'disabled'}>스킨권 교환(${SHOP.skin})</button></em></div>
    </div>
    <div class="gc-mach">
      <button class="gc-go ch" data-a="gcDraw" data-k="champ" ${t.left.champ > 0 && ready && !G.busy ? '' : 'disabled'}><i class="gc-orb"></i><span><b>챔피언 뽑기</b><small>뽑기권 1장 · 꽝 ${CH_MISS}%</small></span></button>
      <button class="gc-go sk" data-a="gcDraw" data-k="skin" ${t.left.skin > 0 && G.cat && !G.busy ? '' : 'disabled'}><i class="gc-orb"></i><span><b>스킨 뽑기</b><small>${G.cat ? `뽑기권 1장 · 꽝 ${fmtPct(skinOdds()[0].p)}` : '스킨 목록 불러오는 중…'}</small></span></button>
    </div>
    <div class="panel gc-col"><div class="ph"><b>${ic('star')}내 보관함</b><span class="grow"></span><div class="seg"><button class="${G.tab === 'champ' ? 'on' : ''}" data-a="gcTab" data-t="champ">챔피언 ${champs.length}</button><button class="${G.tab === 'skin' ? 'on' : ''}" data-a="gcTab" data-t="skin">스킨 ${skins.length}</button></div></div>
      <p class="hint">누르면 내 선수 카드에 적용돼요(모두에게 보여요). ${eq ? '<button class="lnk" data-a="gcEquip" data-t="none">기본으로 되돌리기</button>' : ''}</p>
      <div class="gc-grid">${G.tab === 'champ'
        ? champs.map((x) => itemTile(tileOf(x.id), x.c.name, x.n > 1 ? `×${x.n}` : '', CHAMP_COLOR, eq && eq.champ === x.c.name && !+eq.num, `data-a="gcEquip" data-t="champ" data-id="${x.id}"`)).join('') || '<p class="mut sm">아직 뽑은 챔피언이 없어요.</p>'
        : skins.map((x) => itemTile(tileOf(x.c, x.num), x.name, `${TIER[x.tier]?.name || ''}${x.n > 1 ? ` · ×${x.n}` : ''}`, TIER[x.tier]?.c || '#aaa', eq && by[x.c]?.name === eq.champ && +eq.num === +x.num, `data-a="gcEquip" data-t="skin" data-id="${x.sid}"`)).join('') || '<p class="mut sm">아직 뽑은 스킨이 없어요.</p>'}</div></div>
    ${d.log?.length ? `<div class="panel"><div class="ph"><b>${ic('scroll')}최근 뽑기</b></div><div class="gc-log">${d.log.slice(0, 12).map((l) => `<span class="gc-lg ${l.t}" style="--c:${l.t === 'champ' ? CHAMP_COLOR : TIER[l.t]?.c || '#888'}"><i></i>${l.k === 'champ' ? '챔피언' : '스킨'} · <b>${l.t === 'miss' ? '꽝' : esc(l.n)}</b>${l.d ? ` <small>중복 +${l.d}조각</small>` : ''}</span>`).join('')}</div></div>` : ''}`;
}
page('gacha', {
  render() {
    if (!G.cat && !G.catBusy) setTimeout(skinCatalog, 0);
    if (G.pid && G.docFor !== G.pid && !G.loading) setTimeout(loadDoc, 0); // 이 선수 문서를 아직 한 번도 안 읽었을 때만
    return `<div class="h2row"><h1>${ic('gacha')}가챠</h1><span class="tag gold">내 선수 카드 꾸미기</span></div>
      <p class="hint">내전을 뛰면 뽑기권이 쌓여요. 챔피언·스킨을 뽑아 내 선수 카드의 대표 일러스트를 바꿀 수 있어요.</p>
      ${unlocked() ? mineHTML() : lockHTML()}
      ${oddsHTML()}`;
  },
});

// ---------- 동작 ----------
act('gcPick', async (d, el) => { G.pid = el.value; G.doc = null; G.docFor = null; G.h = ''; refresh(); });
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'gcf') return;
  e.preventDefault();
  const pin = (document.getElementById('gcpin')?.value || '').trim();
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
  G.h = h; saveMe(); toast(res ? 'PIN을 정했어요. 이 기기에서는 다시 묻지 않아요' : '열었어요'); refresh();
});
act('gcLock', () => { G.h = ''; saveMe(); refresh(); });
act('gcReset', () => needAdmin(async () => {
  if (!G.pid || !confirm(`${S.st.P[G.pid]?.name} 선수의 가챠 PIN을 초기화할까요? (뽑기권·보관함은 그대로)`)) return;
  await S.store.patch('gacha', G.pid, { pinHash: '' }); await loadDoc(); toast('PIN을 초기화했어요. 새 PIN을 정해 주세요');
}));
act('gcTab', (d) => { G.tab = d.t; refresh(); });

// 조각 → 뽑기권
act('gcBuy', async (d) => {
  if (!unlocked()) return; const k = d.k, cost = SHOP[k];
  if (!confirm(`조각 ${cost}개로 ${k === 'champ' ? '챔피언' : '스킨'} 뽑기권 1장을 받을까요?`)) return;
  try {
    await S.store.tx('gacha', G.pid, (doc) => {
      if (!doc || doc.pinHash !== G.h || (+doc.shards || 0) < cost) return null;
      return { ...doc, shards: doc.shards - cost, bought: { ...(doc.bought || {}), [k]: (+doc.bought?.[k] || 0) + 1 } };
    });
  } catch (e) { return toast('실패: ' + (e.code || e.message)); }
  await loadDoc(); toast('뽑기권으로 바꿨어요');
});

// 카드에 적용: players/{id}.skin = { champ(한글 이름), num, name, pick:true }. pick 이면 대표 챔피언 계산보다 우선한다
act('gcEquip', async (d) => {
  if (!unlocked()) return;
  const by = champById(); let skin;
  if (d.t === 'none') skin = { champ: '', num: 0, name: '', pick: false };
  else if (d.t === 'champ') { const c = by[d.id]; if (!c || !G.doc.champs?.[d.id]) return; skin = { champ: c.name, num: 0, name: '', pick: true }; }
  else { const x = G.doc.skins?.[d.id], c = x && by[x.c]; if (!c) return; skin = { champ: c.name, num: +x.num, name: x.name, pick: true }; }
  try { await S.store.patch('players', G.pid, { skin }); toast(d.t === 'none' ? '카드를 기본으로 되돌렸어요' : '내 선수 카드에 적용했어요'); } catch (e) { toast('실패: ' + (e.code || e.message)); }
});

// 뽑기: 결과를 먼저 정한 뒤(무작위) 거래로 뽑기권을 쓰고 보관함에 넣는다. 그다음 등급에 맞는 연출을 재생한다
act('gcDraw', async (d) => {
  if (!unlocked() || G.busy) return;
  const k = d.k, t = tickets(G.pid, G.doc);
  if (t.left[k] <= 0) return toast('뽑기권이 없어요');
  let res;
  if (k === 'champ') {
    if (!S.champs.length) return toast('챔피언 목록을 불러오는 중이에요');
    if (rand() * 100 < CH_MISS) res = { t: 'miss' };
    else { const c = S.champs[Math.floor(rand() * S.champs.length)]; res = { t: 'champ', id: c.id, n: c.name }; }
  } else {
    if (!G.cat) return toast('스킨 목록을 불러오는 중이에요');
    const rows = skinOdds(); let r = rand() * 100, tier = 'miss';
    for (const row of rows) { if (r < row.p) { tier = row.k; break; } r -= row.p; }
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
      if (res.t === 'champ') { if (next.champs[res.id]) dup = 1; next.champs[res.id] = (next.champs[res.id] || 0) + 1; }
      else if (res.t !== 'miss') { const had = next.skins[res.sid]; if (had) dup = TIER[res.t].shard; next.skins[res.sid] = { n: (had?.n || 0) + 1, c: res.c, num: res.num, name: res.n, tier: res.t }; }
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
        : `<div class="gx-art" style="--img:url('${img}')"></div><div class="gx-info"><small style="color:${tier.c}">${tier.name}${lv >= 4 ? ' ★'.repeat(lv - 3) : ''}</small><b>${esc(res.n)}</b>${dup ? `<em>중복! 조각 +${dup}</em>` : '<em>새로 획득!</em>'}</div>`}</div>
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
