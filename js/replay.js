// 리플레이(.rofl) 분석: 파일 안에 들어 있는 경기 결과 JSON(statsJson)을 브라우저에서 직접 읽는다. 파일은 어디에도 올라가지 않는다.
import { S, page, act, esc, go, refresh, champIcon, toast, ic, LANES, LANE_NAME, LANE_ICON } from './core.js';
import { importDraft } from './today.js';

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
function matchPlayer(gn, tag) {
  const full = norm(gn + '#' + tag), base = norm(gn);
  const list = S.st.list;
  return (list.find((s) => norm(s.p.riotId) === full) || list.find((s) => norm(s.p.riotId).split('#')[0] === base) || list.find((s) => norm(s.name) === base))?.id || '';
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
const fmtDur = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`; };
const itemImg = (id) => (id && S.ver ? `<img class="it" src="https://ddragon.leagueoflegends.com/cdn/${S.ver}/img/item/${id}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="it"></span>');

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
    return `<div class="h2row"><h1>${ic('replay')}리플레이 분석</h1><span class="tag gold">BETA</span></div>
    <label class="drop ${R.busy ? 'busy' : ''}" id="rdrop"><input type="file" accept=".rofl" id="rfile" hidden>
      <div class="dr-ic">${ic('replay')}</div><b>${R.busy ? '분석 중…' : '.rofl 리플레이 파일을 끌어다 놓거나 눌러서 선택'}</b>
      <span>롤 클라이언트 › 프로필 › 전적에서 경기를 눌러 <em>다운로드</em>하면 <code>문서\\League of Legends\\Replays</code> 폴더에 저장됩니다.<br>파일은 서버로 올라가지 않고 이 브라우저 안에서만 읽습니다.</span></label>
    ${R.err ? `<div class="panel errbox">${ic('alert')} ${esc(R.err)}</div>` : ''}
    ${m ? `<div class="stats">
        <div class="stat gold"><small>파일</small><b class="sm2">${esc(R.name)}</b><span>${esc(m.gameVersion || '')}</span></div>
        <div class="stat teal"><small>경기 시간</small><b class="mono">${fmtDur(R.dur)}</b><span>${R.rows.length}명</span></div>
        <div class="stat ${R.winner === 'blue' ? 'blue' : 'red'}"><small>승리</small><b>${R.winner === 'blue' ? '블루' : R.winner === 'red' ? '레드' : '—'}</b><span>리플레이 기록 기준</span></div>
        <div class="stat purple"><small>선수 매칭</small><b class="mono">${R.rows.filter((r) => r.pid).length}/${R.rows.length}</b><span>롤 닉네임으로 자동 연결</span></div></div>
      ${team('blue')}${team('red')}
      <div class="panel"><p class="sm">내전 선수가 비어 있는 칸은 직접 골라 주세요. 롤 닉네임은 관리 › 선수 상세에서 등록하면 다음부터 자동으로 연결됩니다.</p>
        <button class="btn pri block big" data-a="rpSend">${ic('today')}오늘의 내전 입력 화면으로 보내기</button><p class="hint center">보낸 뒤 입력 화면에서 확인하고 "경기 결과 저장"을 눌러야 기록됩니다. 피어리스·시리즈 판정도 그 화면에서 그대로 적용됩니다.</p></div>`
    : `<div class="grid2"><div class="panel"><div class="ph"><b>읽을 수 있는 정보</b></div><ul class="rlist">
        <li>챔피언, 소환사(롤 닉네임), 진영, 포지션, 승패</li><li>킬 · 데스 · 어시스트, 최대 연속 킬</li><li>CS(미니언 + 정글몹), 골드, 레벨</li>
        <li>챔피언에게 가한 피해량, 받은 피해량</li><li>시야 점수, 와드 설치 수</li><li>최종 아이템 7칸, 경기 시간, 게임 버전</li></ul></div>
      <div class="panel"><div class="ph"><b>알아 둘 점</b></div><ul class="rlist">
        <li>리플레이는 롤 클라이언트에서 <b>현재 패치</b> 경기만 다운로드할 수 있습니다.</li><li>사용자 설정(내전) 경기도 전적에 남아 있으면 다운로드할 수 있습니다.</li>
        <li>밴 정보와 타임라인(분당 골드 그래프 등)은 파일 앞부분 정보에 들어 있지 않아 읽지 않습니다.</li><li>읽은 상세 기록(CS·골드·피해량·시야)은 경기와 함께 저장되어 이후 통계에 쓸 수 있습니다.</li></ul></div></div>`}`;
  },
  after() {
    const drop = document.getElementById('rdrop'), inp = document.getElementById('rfile');
    if (!drop) return;
    inp.onchange = () => inp.files[0] && load(inp.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) load(f); };
  },
});
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
    x.stats[r.pid] = { cs: r.cs, gold: r.gold, dmg: r.dmg, taken: r.taken, vis: r.vis, wards: r.wards, lvl: r.lvl, multi: r.multi, items: r.items };
  }
  if (new Set(R.rows.map((r) => r.pid)).size !== R.rows.length) return toast('같은 선수가 두 번 선택되었습니다');
  importDraft(x); toast('입력 화면에 채웠습니다. 확인 후 저장하세요'); go('#/today');
});
