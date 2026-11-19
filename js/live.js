// 진행 중인 게임 불러오기(오늘의 내전 '게임에서 챔피언·밴 불러오기'). 버튼을 처음 누를 때만 받는 파일.
// 연동 서버(/live)가 라이엇 관전 API로 찾은 게임(참가자 10명의 진영·챔피언, 밴)을 지금 라인업의 자리에 맞춘다.
//   ① 참가자 → 선수: 저장된 puuid → 롤 닉네임 전체(이름#태그) → 이름만(# 앞) 순서로, 라인업 10명 안에서 한 사람에게 한 번만
//   ② 진영: 게임의 블루(100)/레드(200)와 사이트의 블루/레드가 반대로 들어갔으면 사이트 쪽을 바꾼다(선수·챔피언·밴·승리팀 함께)
//   ③ 같은 팀이어야 할 사람이 게임에서 다른 팀이면 맞추지 않고 이름을 알려 준다(라인업이 실제 게임과 다름)
//   ④ 닉네임을 몰라 못 찾은 사람은, 그 팀에 모르는 사람·빈 자리가 하나씩만 남았을 때만 남은 자리로 맞춘다
// 라인(탑·정글…)은 관전 정보에 없으므로 사이트 라인업의 자리를 그대로 쓴다.
import { S } from './core.js';
import { callWorker } from './hook.js';

const norm = (s) => String(s || '').replace(/[‎‏⁦-⁩\s]/g, '').toLowerCase();
const rawIds = (p) => [...new Set([...String(p?.riotId || '').split(/[,/]/), ...(p?.riotAlt || [])].map((s) => String(s).trim()).filter((s) => s.includes('#')))];
const idsOf = (p) => rawIds(p).map(norm);
const five = () => ['', '', '', '', ''];
const SIDE = { blue: '블루', red: '레드' };

// 서버에 보낼 내용: 라인업 선수의 id·롤 닉네임·저장된 puuid(주계정 것이 맞을 때만). 개인 정보는 없음(롤 닉네임은 공개값)
export function liveRequest(dr, quick = 0, start = 0) {
  const players = [...dr.blue, ...dr.red].filter(Boolean).map((pid) => {
    const p = S.store.data.players[pid] || {}, ids = rawIds(p);
    return { pid, ids, puuid: p.riot?.puuid && ids[0] && norm(p.riot.id) === norm(ids[0]) ? p.riot.puuid : '' };
  });
  return callWorker('/live', { players, quick, start });
}

const champOf = (id) => (+id > 0 ? S.champs.find((c) => c.key === +id)?.name || '' : '');

// 서버 결과 → 새 라인업 값 { blue, red, champs, bans(없으면 null), winner, swap, filled, nb, notes } 또는 { error }
export function planLive(dr, res) {
  const P = S.store.data.players, name = (pid) => P[pid]?.name || pid;
  const seat = {};
  ['blue', 'red'].forEach((side) => dr[side].forEach((pid, i) => { if (pid) seat[pid] = { side, i }; }));
  const pids = Object.keys(seat);
  const parts = (res.participants || []).filter((x) => x.teamId === 100 || x.teamId === 200).map((x) => ({ ...x, pid: '' }));
  if (parts.length !== 10) return { error: `게임 참가자가 ${parts.length}명이라 맞출 수 없어요(5대5 게임만 불러올 수 있어요)` };
  // ① 참가자 → 선수(후보가 딱 한 명일 때만)
  const used = new Set();
  const pass = (fn) => parts.forEach((x) => {
    if (x.pid) return;
    const c = pids.filter((pid) => !used.has(pid) && fn(x, P[pid] || {}));
    if (c.length === 1) { x.pid = c[0]; used.add(c[0]); }
  });
  pass((x, p) => !!x.puuid && p.riot?.puuid === x.puuid);
  pass((x, p) => !!x.riotId && idsOf(p).includes(norm(x.riotId)));
  pass((x, p) => { const b = norm(x.riotId).split('#')[0]; return !!b && idsOf(p).some((v) => v.split('#')[0] === b); });
  const known = parts.filter((x) => x.pid);
  if (known.length < 6) return { error: `진행 중인 게임에서 라인업 선수를 ${known.length}명만 찾았어요. 이번 라인업의 내전이 맞는지, 롤 닉네임이 등록돼 있는지 확인해 주세요` };
  // ② 진영
  const gSide = (x) => (x.teamId === 100 ? 'blue' : 'red');
  const agree = known.filter((x) => gSide(x) === seat[x.pid].side).length, swap = known.length - agree > agree;
  const sSide = (pid) => (swap ? (seat[pid].side === 'blue' ? 'red' : 'blue') : seat[pid].side);
  // ③ 팀 구성이 다르면 맞추지 않는다
  const wrong = known.filter((x) => gSide(x) !== sSide(x.pid));
  if (wrong.length) return { error: `라인업과 실제 게임의 팀 구성이 달라요. 라인업을 게임과 같게 고친 뒤 다시 불러와 주세요 · ${wrong.map((x) => `${name(x.pid)}(게임에서는 ${SIDE[gSide(x)]})`).join(', ')}` };
  const notes = [];
  // ④ 남은 사람 1명 ↔ 남은 자리 1개면 맞춘다
  for (const side of ['blue', 'red']) {
    const left = parts.filter((x) => !x.pid && gSide(x) === side), open = pids.filter((pid) => sSide(pid) === side && !used.has(pid));
    if (left.length === 1 && open.length === 1) { left[0].pid = open[0]; used.add(open[0]); notes.push(`${name(open[0])}: 등록 안 된 닉네임(${left[0].riotId || '알 수 없음'})이라 남은 자리로 맞췄어요`); }
    else if (left.length) notes.push(`${SIDE[side]}팀 ${left.length}명은 누군지 몰라 챔피언을 비워 뒀어요: ${left.map((x) => `${x.riotId || '닉네임 없음'}(${champOf(x.championId) || '?'})`).join(', ')}`);
  }
  // 새 값(진영을 바꾸면 선수·챔피언·밴·승리팀을 함께 바꾼다)
  const fl = (s) => (swap ? (s === 'blue' ? 'red' : 'blue') : s);
  const blue = [...dr[fl('blue')]], red = [...dr[fl('red')]];
  const champs = { blue: [...(dr.champs?.[fl('blue')] || five())], red: [...(dr.champs?.[fl('red')] || five())] };
  let filled = 0;
  for (const x of parts) {
    if (!x.pid) continue;
    const c = champOf(x.championId);
    if (!c) { notes.push(`${name(x.pid)}: 챔피언 번호 ${x.championId}을(를) 목록에서 찾지 못했어요(직접 골라 주세요)`); continue; }
    champs[gSide(x)][seat[x.pid].i] = c; filled++;
  }
  let bans = null, nb = 0;
  const bl = (res.bans || []).filter((b) => +b.championId > 0 && (b.teamId === 100 || b.teamId === 200));
  if (bl.length) {
    bans = { blue: five(), red: five() };
    for (const side of ['blue', 'red']) {
      bl.filter((b) => (b.teamId === 100 ? 'blue' : 'red') === side).sort((a, b) => a.pickTurn - b.pickTurn).map((b) => champOf(b.championId)).filter(Boolean).slice(0, 5).forEach((c, i) => { bans[side][i] = c; nb++; });
    }
  }
  else if (swap) bans = { blue: [...(dr.bans?.red || five())], red: [...(dr.bans?.blue || five())] }; // 밴 정보가 없는 게임(블라인드 픽 등): 적어 둔 밴은 진영만 따라간다
  const winner = swap && dr.winner ? (dr.winner === 'blue' ? 'red' : 'blue') : dr.winner || '';
  return { blue, red, champs, bans, winner, swap, filled, nb, notes };
}
