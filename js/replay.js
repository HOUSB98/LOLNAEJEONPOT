// 리플레이(.rofl) 분석: 파일 안에 들어 있는 경기 결과 JSON(statsJson)을 브라우저에서 직접 읽는다. 파일은 어디에도 올라가지 않는다.
import { S, page, act, esc, go, refresh, champIcon, toast, ic, modal, closeModal, mh, history, fmtDT, LANES, LANE_NAME, LANE_ICON } from './core.js';
import { importDraft } from './today.js';
import { XKEYS } from './stats.js';

const R = { name: '', meta: null, rows: [], winner: '', dur: 0, err: '', busy: false };
const POS = { TOP: 0, JUNGLE: 1, MIDDLE: 2, MID: 2, BOTTOM: 3, BOT: 3, ADC: 3, UTILITY: 4, SUPPORT: 4 };
const norm = (s) => String(s || '').replace(/[‎‏⁦-⁩\s]/g, '').toLowerCase();
const n = (v) => +v || 0;

// 문자열 안의 따옴표·이스케이프를 고려해 { } 짝을 맞춰 JSON 객체 하나를 잘라낸다
function cutObject(txt, start) {
  let depth = 0, inStr = false, esc_ = false;
  for (let i = start; i < txt.length; i++) {
    const c = txt[i];
    if (inStr) { if (esc_) esc_ = false; else if (c === '\\') esc_ = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) return txt.slice(start, i + 1);
  }
  return null;
}
async function parseRofl(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...head) !== 'RIOT') throw new Error('롤 리플레이(.rofl) 파일이 아닙니다.');
  const dec = new TextDecoder('utf-8');
  // 메타데이터는 예전 형식은 파일 앞부분, 최신 형식은 파일 끝부분에 있다
  for (const blob of [file.slice(Math.max(0, file.size - 3e6)), file.slice(0, 3e6)]) {
    const txt = dec.decode(await blob.arrayBuffer());
    const k = txt.lastIndexOf('"statsJson"');
    if (k < 0) continue;
    const json = cutObject(txt, txt.lastIndexOf('{', k));
    if (!json) continue;
    const meta = JSON.parse(json);
    const stats = typeof meta.statsJson === 'string' ? JSON.parse(meta.statsJson) : meta.statsJson;
    if (Array.isArray(stats) && stats.length) return { ...meta, stats };
  }
  throw new Error('파일에서 경기 결과 정보를 찾지 못했습니다. 다른 리플레이로 시도해 주세요.');
}
const champName = (skin) => { const c = S.champs.find((x) => x.id.toLowerCase() === String(skin).toLowerCase()); return c ? c.name : skin; };
// 롤 닉네임 → 선수. 선수 정보의 롤 닉네임(쉼표로 여러 개 가능)과, 리플레이를 적용할 때 자동으로 배운 닉네임(riotAlt)을 본다.
const nicks = (s) => [...String(s.p.riotId || '').split(/[,/]/), ...(s.p.riotAlt || [])].map(norm).filter(Boolean);
function matchPlayer(gn, tag) {
  const full = norm(gn + '#' + tag), base = norm(gn);
  const list = S.st.list;
  return (list.find((s) => nicks(s).includes(full)) || list.find((s) => nicks(s).some((x) => x.split('#')[0] === base)) || list.find((s) => norm(s.name) === base))?.id || '';
}
function toRows(meta) {
  const rows = meta.stats.map((p) => {
    const gn = p.RIOT_ID_GAME_NAME || p.NAME || p.SUMMONER_NAME || '', tag = p.RIOT_ID_TAG_LINE || '';
    const pos = POS[String(p.TEAM_POSITION || p.INDIVIDUAL_POSITION || '').toUpperCase()];
    return {
      side: String(p.TEAM) === '200' ? 'red' : 'blue', lane: pos ?? -1, riot: tag ? `${gn}#${tag}` : gn, pid: matchPlayer(gn, tag),
      champ: champName(p.SKIN || p.CHAMPION || ''), win: String(p.WIN).toLowerCase() === 'win',
      k: n(p.CHAMPIONS_KILLED), d: n(p.NUM_DEATHS), a: n(p.ASSISTS), cs: n(p.MINIONS_KILLED) + n(p.NEUTRAL_MINIONS_KILLED),
      gold: n(p.GOLD_EARNED), dmg: n(p.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS), taken: n(p.TOTAL_DAMAGE_TAKEN), vis: n(p.VISION_SCORE), wards: n(p.WARD_PLACED),
      lvl: n(p.LEVEL), multi: n(p.LARGEST_MULTI_KILL), items: [0, 1, 2, 3, 4, 5, 6].map((i) => n(p['ITEM' + i])),
      // 확장 지표(v2): 파일의 경기 결과에 들어 있는 나머지 수치 전부
      mk: n(p.MINIONS_KILLED), jk: n(p.NEUTRAL_MINIONS_KILLED),
      pd: n(p.PHYSICAL_DAMAGE_DEALT_TO_CHAMPIONS), md: n(p.MAGIC_DAMAGE_DEALT_TO_CHAMPIONS), td: n(p.TRUE_DAMAGE_DEALT_TO_CHAMPIONS),
      obj: n(p.TOTAL_DAMAGE_DEALT_TO_OBJECTIVES), tur: n(p.TOTAL_DAMAGE_DEALT_TO_TURRETS || p.TOTAL_DAMAGE_DEALT_TO_BUILDINGS),
      heal: n(p.TOTAL_HEAL), healT: n(p.TOTAL_HEAL_ON_TEAMMATES), shT: n(p.TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES), mit: n(p.TOTAL_DAMAGE_SELF_MITIGATED),
      cc: n(p.TIME_CCING_OTHERS), wk: n(p.WARD_KILLED), cw: n(p.VISION_WARDS_BOUGHT_IN_GAME),
      dk: n(p.DOUBLE_KILLS), tk: n(p.TRIPLE_KILLS), qk: n(p.QUADRA_KILLS), pk: n(p.PENTA_KILLS), spree: n(p.LARGEST_KILLING_SPREE),
      tw: n(p.TURRETS_KILLED || p.TURRET_TAKEDOWNS), spent: n(p.GOLD_SPENT), dead: n(p.TOTAL_TIME_SPENT_DEAD), crit: n(p.LARGEST_CRITICAL_STRIKE),
    };
  });
  // 포지션 정보가 없는 경우(일부 사용자 설정 게임)는 팀 안에서 비어 있는 라인을 순서대로 채운다
  for (const side of ['blue', 'red']) {
    const used = new Set(), need = [];
    rows.filter((r) => r.side === side).forEach((r) => { if (r.lane >= 0 && !used.has(r.lane)) used.add(r.lane); else need.push(r); });
    need.forEach((r) => { r.lane = [0, 1, 2, 3, 4].find((l) => !used.has(l)) ?? -1; used.add(r.lane); });
  }
  return rows;
}
// 경기 문서에 저장할 선수별 상세 기록 (Firestore: undefined 금지 → 전부 숫자)
const statsOf = (r) => ({ v: 2, cs: r.cs, gold: r.gold, dmg: r.dmg, taken: r.taken, vis: r.vis, wards: r.wards, lvl: r.lvl, multi: r.multi, items: r.items, ...Object.fromEntries(XKEYS.map((k) => [k, r[k] || 0])) });
const fmtDur = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`; };
const itemImg = (id) => (id && S.ver ? `<img class="it" src="https://ddragon.leagueoflegends.com/cdn/${S.ver}/img/item/${id}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="it"></span>');

// 리플레이 분석 화면 사용 여부. false면 화면은 보이지만 파일을 넣을 수 없다("도입 예정"). 경기 기록의 경기별 "리플레이" 버튼은 계속 쓸 수 있다.
const REPLAY_PAGE = true;
page('replay', {
  render() {
    const m = R.meta, k = (v) => v.toLocaleString('ko-KR');
    const team = (side) => {
      const rows = R.rows.filter((r) => r.side === side).sort((a, b) => a.lane - b.lane), tot = (f) => rows.reduce((s, r) => s + r[f], 0);
      return `<div class="rteam ${side} ${R.winner === side ? 'win' : ''}"><div class="rth"><b>${side === 'blue' ? 'BLUE' : 'RED'}</b><em>${R.winner === side ? 'VICTORY' : 'DEFEAT'}</em><span class="mono">${tot('k')} / ${tot('d')} / ${tot('a')} · ${k(tot('gold'))}G</span></div>
      <div class="tw"><table class="tbl rtbl"><thead><tr><th>라인</th><th class="l">챔피언 · 소환사</th><th class="l">내전 선수</th><th>KDA</th><th>CS</th><th>골드</th><th>피해량</th><th>시야</th><th class="l">아이템</th></tr></thead><tbody>
      ${rows.map((r) => { const i = R.rows.indexOf(r); return `<tr><td><select class="inp cell" data-c="rpLane" data-i="${i}">${LANES.map((l, j) => `<option value="${j}" ${r.lane === j ? 'selected' : ''}>${LANE_NAME[l]}</option>`).join('')}</select></td>
        <td class="l"><span class="rch">${champIcon(r.champ)}<span><b>${esc(r.champ)}</b><small>${esc(r.riot)} · Lv${r.lvl}</small></span></span></td>
        <td class="l"><select class="inp ${r.pid ? '' : 'warnsel'}" data-c="rpPid" data-i="${i}"><option value="">선수 선택</option>${S.st.list.map((s) => `<option value="${s.id}" ${s.id === r.pid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></td>
        <td class="mono">${r.k}/${r.d}/${r.a}<small> ${((r.k + r.a) / Math.max(1, r.d)).toFixed(1)}</small></td><td class="mono">${r.cs}<small> ${R.dur ? (r.cs / (R.dur / 60000)).toFixed(1) : ''}</small></td>
        <td class="mono">${k(r.gold)}</td><td class="mono">${k(r.dmg)}</td><td class="mono">${r.vis}</td><td class="l items">${r.items.map(itemImg).join('')}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    };
    return `<div class="h2row"><h1>${ic('replay')}리플레이 분석</h1><span class="tag gold">${REPLAY_PAGE ? 'BETA' : '도입 예정'}</span></div>
    ${REPLAY_PAGE ? '' : `<div class="panel soonbox">${ic('alert')}<div><b>도입 예정인 기능입니다</b><span>리플레이를 올리면 해당 경기를 자동으로 찾아 주는 기능과 함께 열릴 예정입니다. 그때까지는 <a href="#/matches">경기 기록</a>에서 각 경기의 <em>리플레이</em> 버튼으로 파일을 넣어 주세요.</span></div></div>`}
    <label class="drop ${R.busy ? 'busy' : ''} ${REPLAY_PAGE ? '' : 'off'}" id="rdrop"><input type="file" accept=".rofl" id="rfile" multiple hidden ${REPLAY_PAGE ? '' : 'disabled'}>
      <div class="dr-ic">${ic('replay')}</div><b>${!REPLAY_PAGE ? '도입 예정 — 지금은 파일을 넣을 수 없습니다' : R.busy ? '분석 중…' : '.rofl 리플레이 파일을 끌어다 놓거나 눌러서 선택 (여러 개 가능)'}</b>
      <span>닉네임으로 선수를 찾고, 팀 색(블루/레드)과 상관없이 <b>같은 10명이 같은 편으로 뛴 경기</b>를 경기 기록에서 자동으로 찾아 연결합니다.<br>롤 클라이언트 › 프로필 › 전적에서 경기를 눌러 <em>다운로드</em>하면 <code>문서\\League of Legends\\Replays</code> 폴더에 저장됩니다.<br>파일은 서버로 올라가지 않고 이 브라우저 안에서만 읽습니다.</span></label>
    ${R.err ? `<div class="panel errbox">${ic('alert')} ${esc(R.err)}</div>` : ''}
    ${Q.items.length && !m ? queueView() : ''}
    ${m ? `${Q.items.length ? '<button class="btn ghost" data-a="rqBack">← 자동 연결 결과로 돌아가기</button>' : ''}<div class="stats">
        <div class="stat gold"><small>파일</small><b class="sm2">${esc(R.name)}</b><span>${esc(m.gameVersion || '')}</span></div>
        <div class="stat teal"><small>경기 시간</small><b class="mono">${fmtDur(R.dur)}</b><span>${R.rows.length}명</span></div>
        <div class="stat ${R.winner === 'blue' ? 'blue' : 'red'}"><small>승리</small><b>${R.winner === 'blue' ? '블루' : R.winner === 'red' ? '레드' : '—'}</b><span>리플레이 기록 기준</span></div>
        <div class="stat purple"><small>선수 매칭</small><b class="mono">${R.rows.filter((r) => r.pid).length}/${R.rows.length}</b><span>롤 닉네임으로 자동 연결</span></div></div>
      ${team('blue')}${team('red')}
      <div class="panel"><p class="sm">내전 선수가 비어 있는 칸은 직접 골라 주세요. 롤 닉네임은 관리 › 선수 상세에서 등록하면 다음부터 자동으로 연결됩니다.</p>
        <button class="btn pri block big" data-a="rpSend">${ic('today')}오늘의 내전 입력 화면으로 보내기</button><p class="hint center">보낸 뒤 입력 화면에서 확인하고 "경기 결과 저장"을 눌러야 기록됩니다. 피어리스·시리즈 판정도 그 화면에서 그대로 적용됩니다.</p></div>`
    : Q.items.length ? '' : `<div class="grid2"><div class="panel"><div class="ph"><b>읽을 수 있는 정보</b></div><ul class="rlist">
        <li>챔피언, 소환사(롤 닉네임), 진영, 포지션, 승패</li><li>킬 · 데스 · 어시스트, 최대 연속 킬</li><li>CS(미니언 + 정글몹), 골드, 레벨</li>
        <li>챔피언에게 가한 피해량, 받은 피해량</li><li>시야 점수, 와드 설치·제거, 제어 와드 구매</li><li>물리·마법·고정 피해 구성, 오브젝트·포탑 피해</li><li>치유·아군 보호막·피해 경감·CC 시간, 멀티킬, 사망 시간</li><li>최종 아이템 7칸, 경기 시간, 게임 버전</li></ul></div>
      <div class="panel"><div class="ph"><b>알아 둘 점</b></div><ul class="rlist">
        <li>리플레이는 롤 클라이언트에서 <b>현재 패치</b> 경기만 다운로드할 수 있습니다.</li><li>사용자 설정(내전) 경기도 전적에 남아 있으면 다운로드할 수 있습니다.</li>
        <li>밴 정보와 타임라인(분당 골드 그래프 등)은 파일 앞부분 정보에 들어 있지 않아 읽지 않습니다.</li><li>읽은 상세 기록(CS·골드·피해량·시야)은 경기와 함께 저장되어 이후 통계에 쓸 수 있습니다.</li></ul></div></div>`}`;
  },
  after() {
    const drop = document.getElementById('rdrop'), inp = document.getElementById('rfile');
    if (!drop || !REPLAY_PAGE) return;
    inp.onchange = () => inp.files.length && loadMany([...inp.files]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const fs = [...e.dataTransfer.files].filter((f) => /\.rofl$/i.test(f.name)); if (fs.length) loadMany(fs); else toast('.rofl 파일만 넣을 수 있어요'); };
  },
});
// ---------- 기존 경기에 리플레이 붙이기 ----------
// 경기 기록의 "리플레이 넣기"에서 호출. 라인업·승패는 건드리지 않고 KDA·상세 기록·챔피언만 채운다.
const AT = { id: '', rows: [], dur: 0, name: '' };
act('matchReplay', (d) => {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.rofl' });
  inp.onchange = async () => {
    const f = inp.files[0], m = S.store.data.matches[d.id]; if (!f || !m) return;
    try {
      const meta = await parseRofl(f), ids = [...m.blue, ...m.red];
      AT.id = d.id; AT.name = f.name; AT.dur = n(meta.gameLength);
      const rows = toRows(meta).map((r) => ({ ...r, pid: ids.includes(r.pid) ? r.pid : '' }));
      // 팀 색과 상관없이 같은 편끼리 맞춰 보고, 못 찾은 사람은 같은 편의 남은 자리로 채운다
      const c = candidates(rows).find((x) => x.id === m.id);
      AT.rows = c ? resolve(rows, m, c.flip) : rows;
      attachView();
    } catch (e) { toast(e.message || String(e)); }
  };
  inp.click();
});
function attachView() {
  const m = S.store.data.matches[AT.id], st = S.st, ids = [...m.blue, ...m.red];
  const sideOf = (pid) => (m.blue.includes(pid) ? 'blue' : 'red');
  const used = AT.rows.map((r) => r.pid).filter(Boolean), dup = used.length !== new Set(used).size, miss = AT.rows.some((r) => !r.pid);
  const wrongWin = AT.rows.filter((r) => r.pid && r.win !== (m.winner === sideOf(r.pid))).length;
  const split = AT.rows.filter((r) => r.pid).some((r) => AT.rows.some((o) => o.pid && o.side === r.side && sideOf(o.pid) !== sideOf(r.pid)));
  const warn = [miss && '연결되지 않은 소환사가 있습니다. 직접 골라 주세요.', dup && '같은 선수가 두 번 선택되었습니다.',
    !miss && !dup && split && '리플레이의 팀 구성이 이 경기의 팀 구성과 다릅니다. 다른 경기의 리플레이일 수 있습니다.',
    !miss && !dup && !split && wrongWin && '리플레이의 승패가 기록된 승패와 다릅니다. 다른 경기의 리플레이일 수 있습니다.'].filter(Boolean);
  modal(`${mh(`경기 #${st.MI[AT.id].no}에 리플레이 넣기`)}
    <p class="mut sm">${esc(AT.name)} · ${fmtDur(AT.dur)} — 라인업과 승패는 그대로 두고 KDA·CS·골드·피해량·시야·아이템·챔피언을 채웁니다.</p>
    ${warn.map((w) => `<div class="panel errbox">${ic('alert')} ${w}</div>`).join('')}
    <div class="tw"><table class="tbl rtbl"><thead><tr><th>진영</th><th class="l">챔피언 · 소환사</th><th class="l">이 경기의 선수</th><th>KDA</th><th>CS</th><th>피해량</th></tr></thead><tbody>
    ${AT.rows.map((r, i) => `<tr><td class="${r.side}"><b>${r.side === 'blue' ? 'BLUE' : 'RED'}</b></td><td class="l"><span class="rch">${champIcon(r.champ)}<span><b>${esc(r.champ)}</b><small>${esc(r.riot)}</small></span></span></td>
      <td class="l"><select class="inp ${r.pid ? '' : 'warnsel'}" data-c="atPid" data-i="${i}"><option value="">선수 선택</option>${ids.map((id) => `<option value="${id}" ${id === r.pid ? 'selected' : ''}>${esc(st.P[id]?.name || '?')}</option>`).join('')}</select></td>
      <td class="mono">${r.k}/${r.d}/${r.a}</td><td class="mono">${r.cs}</td><td class="mono">${r.dmg.toLocaleString('ko-KR')}</td></tr>`).join('')}</tbody></table></div>
    <div class="row"><span class="grow"></span><button class="btn ghost" data-a="close">취소</button><button class="btn pri" data-a="atApply" ${miss || dup ? 'disabled' : ''}>${m.stats ? '기존 상세 기록을 이 리플레이로 교체' : '이 경기에 적용'}</button></div>`, 'xwide');
}
act('atPid', (d, el) => { AT.rows[+d.i].pid = el.value; attachView(); });
act('atApply', async () => { if (await applyReplay(AT.id, AT.rows, AT.dur)) { closeModal(); toast('리플레이 기록을 적용했습니다'); } });
// 경기에 리플레이 기록을 넣는다. 라인업·승패는 그대로, 선수별(id 기준)로 KDA·상세 기록·챔피언을 채우므로 팀 색이 반대로 기록돼 있어도 맞게 들어간다.
// 처음 보는 롤 닉네임은 그 선수의 riotAlt에 저장해 다음부터 자동으로 찾는다.
async function applyReplay(id, rows, dur) {
  const m = S.store.data.matches[id]; if (!m) return false;
  const kda = { ...(m.kda || {}) }, stats = {}, champs = { blue: [...(m.champs?.blue || ['', '', '', '', ''])], red: [...(m.champs?.red || ['', '', '', '', ''])] };
  for (const r of rows) {
    kda[r.pid] = [r.k, r.d, r.a];
    stats[r.pid] = statsOf(r);
    const side = m.blue.includes(r.pid) ? 'blue' : 'red', i = m[side].indexOf(r.pid);
    if (S.champBy[r.champ]) champs[side][i] = r.champ;
  }
  try {
    await history('match-replay', m);
    await S.store.patch('matches', m.id, { kda, stats, champs, dur });
    for (const r of rows) { // 닉네임 학습
      const pl = S.store.data.players[r.pid], key = norm(r.riot);
      if (!pl || !key || nicks({ p: pl }).includes(key)) continue;
      await S.store.patch('players', r.pid, pl.riotId ? { riotAlt: [...(pl.riotAlt || []), r.riot].slice(-8) } : { riotId: r.riot });
    }
    return true;
  } catch (e) { toast('저장 실패: ' + (e.code || e.message)); return false; }
}

async function load(file) {
  R.busy = true; R.err = ''; refresh();
  try {
    const meta = await parseRofl(file);
    R.name = file.name; R.meta = meta; R.rows = toRows(meta); R.dur = n(meta.gameLength);
    const w = R.rows.find((r) => r.win); R.winner = w ? w.side : '';
    toast('리플레이를 읽었습니다');
  } catch (e) { R.meta = null; R.rows = []; R.err = e.message || String(e); console.warn(e); }
  R.busy = false; refresh();
}
act('rpLane', (d, el) => { R.rows[+d.i].lane = +el.value; refresh(); });
act('rpPid', (d, el) => { R.rows[+d.i].pid = el.value; refresh(); });
act('rpSend', () => {
  const five = () => ['', '', '', '', ''], x = { blue: five(), red: five(), champs: { blue: five(), red: five() }, kda: {}, stats: {}, winner: R.winner, dur: R.dur };
  for (const r of R.rows) {
    if (!r.pid) return toast('모든 칸의 내전 선수를 골라 주세요');
    if (r.lane < 0 || x[r.side][r.lane]) return toast(`${r.side === 'blue' ? '블루' : '레드'} 팀의 라인이 겹칩니다`);
    x[r.side][r.lane] = r.pid; x.champs[r.side][r.lane] = S.champBy[r.champ] ? r.champ : '';
    x.kda[r.pid] = `${r.k}/${r.d}/${r.a}`;
    x.stats[r.pid] = statsOf(r);
  }
  if (new Set(R.rows.map((r) => r.pid)).size !== R.rows.length) return toast('같은 선수가 두 번 선택되었습니다');
  importDraft(x); toast('입력 화면에 채웠습니다. 확인 후 저장하세요'); go('#/today');
});

// ---------- 리플레이 → 경기 자동 연결 ----------
// 팀 색은 보지 않는다. 리플레이의 두 팀(각 5명)을 닉네임으로 선수에 연결한 뒤, 경기 기록 중
// "한 팀의 선수가 모두 기록의 한 팀 안에, 다른 팀 선수는 모두 다른 팀 안에" 있고 "이긴 쪽도 같은" 경기를 찾는다.
// 같은 멤버로 여러 판 했으면 챔피언 기록 → 아직 리플레이가 없는 경기 → 파일 순서(게임 번호)와 경기 시각 순서로 고른다.
const Q = { items: [], busy: false };
const gameNo = (name) => +(String(name).match(/(\d{6,})/)?.[1] || 0);
function candidates(rows) {
  const A = rows.filter((r) => r.side === 'blue'), B = rows.filter((r) => r.side === 'red'), winA = A.some((r) => r.win);
  const known = rows.filter((r) => r.pid).length, out = [];
  if (known < 5) return out;
  for (const m of S.st.matches) {
    for (const flip of [false, true]) { // flip: 리플레이 블루 = 기록 레드
      const tb = flip ? B : A, tr = flip ? A : B;
      if (!tb.every((r) => !r.pid || m.blue.includes(r.pid)) || !tr.every((r) => !r.pid || m.red.includes(r.pid))) continue;
      if ((m.winner === 'blue') !== (flip ? !winA : winA)) continue;
      let ch = 0, chMis = 0;
      for (const [team, side] of [[tb, 'blue'], [tr, 'red']]) for (const r of team) {
        const c = r.pid && m.champs?.[side]?.[m[side].indexOf(r.pid)];
        if (c) c === r.champ ? ch++ : chMis++;
      }
      out.push({ id: m.id, flip, known, ch, chMis, has: !!m.stats, at: m.at });
    }
  }
  return out.sort((a, b) => b.known - a.known || a.chMis - b.chMis || b.ch - a.ch || a.has - b.has || a.at - b.at);
}
// 닉네임으로 못 찾은 사람은 같은 편에 남은 자리로 채운다(남은 자리가 여럿이면 포지션 → 순서)
function resolve(rows, m, flip) {
  const out = rows.map((r) => ({ ...r }));
  for (const side of ['blue', 'red']) {
    const recSide = (side === 'blue') !== flip ? 'blue' : 'red', team = out.filter((r) => r.side === side);
    const left = m[recSide].filter((id) => !team.some((r) => r.pid === id));
    for (const r of team.filter((x) => !x.pid)) {
      const byLane = left.find((id) => m[recSide].indexOf(id) === r.lane);
      r.pid = byLane || left[0] || ''; r.guessed = !!r.pid;
      left.splice(left.indexOf(r.pid), 1);
    }
  }
  return out;
}
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
function plan() {
  for (const it of Q.items) if (it.status !== 'done' && it.status !== 'err') {
    const c = it.cands, top = c[0];
    it.pick = top ? top.id : '';
    it.status = !top ? 'none' : c.length === 1 || c[1].known < top.known || c[1].chMis > top.chMis || c[1].ch < top.ch ? 'ok' : 'ambig';
  }
  // 같은 후보 묶음(같은 멤버 연속 경기)을 공유하는 파일들은 게임 번호 순서 ↔ 경기 시각 순서로 하나씩 나눠 준다
  const groups = new Map();
  for (const it of Q.items) if (it.status === 'ambig') {
    const ids = it.cands.filter((x) => x.known === it.cands[0].known && x.chMis === it.cands[0].chMis).map((x) => x.id).sort().join();
    (groups.get(ids) || groups.set(ids, []).get(ids)).push(it);
  }
  for (const [ids, its] of groups) {
    const ms = ids.split(',').map((id) => S.store.data.matches[id]).filter((m) => m && !m.stats).sort((a, b) => a.at - b.at);
    its.sort((a, b) => gameNo(a.name) - gameNo(b.name));
    if (its.length > 1 && ms.length >= its.length) its.forEach((it, i) => { it.pick = ms[i].id; it.guess = '파일 순서로 추정'; });
    else if (ms.length) its[0].pick = ms[0].id;
  }
}
const candOf = (it) => it.cands.find((c) => c.id === it.pick);
const rowsFor = (it) => { const c = candOf(it), m = c && S.store.data.matches[c.id]; return m ? resolve(it.rows, m, c.flip) : it.rows; };
async function loadMany(files) {
  R.busy = true; R.err = ''; R.meta = null; refresh();
  for (const f of files) {
    if (Q.items.some((x) => x.name === f.name)) continue;
    try {
      const meta = await parseRofl(f), rows = toRows(meta);
      Q.items.push({ name: f.name, meta, rows, dur: n(meta.gameLength), cands: candidates(rows), status: '', pick: '' });
    } catch (e) { Q.items.push({ name: f.name, status: 'err', err: e.message || String(e), cands: [], rows: [] }); }
  }
  plan(); R.busy = false; refresh();
  const ok = Q.items.filter((x) => x.pick && x.status !== 'done').length;
  toast(`${files.length}개 읽음 · ${ok}개 경기를 찾았어요`);
}
function queueView() {
  const st = S.st, k = (v) => v.toLocaleString('ko-KR');
  const label = (c) => { const m = S.store.data.matches[c.id], mi = st.MI[c.id]; return `#${mi?.no ?? '?'} · ${fmtDT(m.at)} · 닉네임 ${c.known}/10${c.ch ? ` · 챔피언 ${c.ch}개 일치` : ''}${c.has ? ' · 리플레이 있음(교체)' : ''}`; };
  const ready = Q.items.filter((x) => x.pick && (x.status === 'ok' || x.status === 'ambig'));
  return `<div class="panel rq"><div class="ph"><b>${ic('link')}자동 연결 결과</b><span class="tag">${Q.items.length}개</span><span class="grow"></span>
    <button class="btn ghost xs" data-a="rqClear">목록 비우기</button>${ready.length ? `<button class="btn pri" data-a="rqAll">${ic('save')}연결된 ${ready.length}개 모두 적용</button>` : ''}</div>
    ${Q.items.map((it, i) => {
      if (it.status === 'err') return `<div class="rq-it err"><b>${esc(it.name)}</b><span class="tag bad">읽기 실패</span><small>${esc(it.err)}</small><button class="btn ghost xs" data-a="rqDrop" data-i="${i}">${ic('x')}</button></div>`;
      const rows = rowsFor(it), m = it.pick && S.store.data.matches[it.pick], c = candOf(it);
      const chip = it.status === 'done' ? '<span class="tag ok">적용 완료</span>' : it.status === 'ok' ? '<span class="tag ok">자동 연결</span>' : it.status === 'ambig' ? `<span class="tag warn">${it.guess || '후보 여러 개 · 확인 필요'}</span>` : '<span class="tag bad">맞는 경기 없음</span>';
      const win = rows.filter((r) => r.win), lose = rows.filter((r) => !r.win);
      const ppl = (list) => list.map((r) => `<span class="${r.pid && !r.guessed ? '' : 'miss'}" title="${esc(r.riot)} · ${esc(r.champ)}${r.guessed ? ' · 닉네임을 못 찾아 남은 자리로 채움' : ''}">${champIcon(r.champ)}${esc(r.pid ? st.P[r.pid]?.name || '?' : r.riot)}</span>`).join('');
      return `<div class="rq-it ${it.status}">
        <div class="rq-h"><b>${esc(it.name)}</b><small class="mut">${fmtDur(it.dur)} · 닉네임 인식 ${it.rows.filter((r) => r.pid).length}/10</small>${chip}<span class="grow"></span><button class="btn ghost xs" data-a="rqDrop" data-i="${i}" title="목록에서 빼기">${ic('x')}</button></div>
        <div class="rq-teams"><div><em class="good">승리</em>${ppl(win)}</div><div><em class="bad">패배</em>${ppl(lose)}</div></div>
        ${it.status === 'done' ? '' : `<div class="rq-f">
          <select class="inp" data-c="rqPick" data-i="${i}">${it.cands.length ? '' : '<option value="">찾은 경기 없음</option>'}${it.cands.map((x) => `<option value="${x.id}" ${x.id === it.pick ? 'selected' : ''}>${label(x)}</option>`).join('')}</select>
          ${m ? `<small class="mut">기록상 ${c.flip ? '<b>팀 색이 반대로</b> 기록됨 · ' : ''}${m.winner === 'blue' ? '블루' : '레드'} 승</small>` : ''}
          <span class="grow"></span><button class="btn ghost xs" data-a="rqNew" data-i="${i}" title="경기 기록에 없는 판이면 새 경기로 입력">새 경기로 입력</button>
          ${m ? `<button class="btn gold xs" data-a="rqOne" data-i="${i}">적용</button>` : ''}</div>`}
      </div>`;
    }).join('')}
    <p class="hint">닉네임을 못 찾은 사람(흐린 이름)은 같은 편의 남은 자리로 채웁니다. 적용하면 그 닉네임을 선수에게 기억해 두어 다음부터 바로 찾습니다.</p></div>`;
}
act('rqPick', (d, el) => { const it = Q.items[+d.i]; it.pick = el.value; it.guess = ''; it.status = 'ok'; refresh(); });
act('rqDrop', (d) => { Q.items.splice(+d.i, 1); refresh(); });
act('rqClear', () => { Q.items = []; refresh(); });
act('rqBack', () => { R.meta = null; R.rows = []; refresh(); });
act('rqNew', (d) => { const it = Q.items[+d.i]; R.name = it.name; R.meta = it.meta; R.rows = it.rows.map((r) => ({ ...r })); R.dur = it.dur; const w = R.rows.find((r) => r.win); R.winner = w ? w.side : ''; refresh(); });
async function applyItem(it) {
  const rows = rowsFor(it);
  if (rows.some((r) => !r.pid) || new Set(rows.map((r) => r.pid)).size !== 10) { toast(`${it.name}: 선수를 모두 연결하지 못했습니다`); return false; }
  const ok = await applyReplay(it.pick, rows, it.dur);
  if (ok) it.status = 'done';
  return ok;
}
act('rqOne', async (d) => { if (await applyItem(Q.items[+d.i])) toast('리플레이 기록을 적용했습니다'); refresh(); });
act('rqAll', async () => {
  const list = Q.items.filter((x) => x.pick && (x.status === 'ok' || x.status === 'ambig'));
  const picks = list.map((x) => x.pick);
  if (new Set(picks).size !== picks.length) return toast('같은 경기에 연결된 파일이 둘 이상 있습니다. 확인해 주세요');
  let n_ = 0; for (const it of list) if (await applyItem(it)) n_++;
  toast(`${n_}개 경기에 리플레이 기록을 적용했습니다`); refresh();
});
