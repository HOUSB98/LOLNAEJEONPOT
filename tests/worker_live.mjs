// Worker /live 시험(라이엇 API 가짜 응답)
import fs from 'fs';
import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const dir = os.tmpdir();
fs.writeFileSync(path.join(dir, 'naejeon-wmodl.mjs'), fs.readFileSync(path.join(ROOT, 'worker/worker.js'), 'utf8') + '\nexport { MEM };\n');
const env = { LEAGUE_KEY: 'k', RIOT_KEY: 'RGAPI-x' };
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
let ACC = {}, GAMES = {}, calls = [], riotStatus = 0, otherFetch = 0;
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (!url.includes('riotgames.com')) { otherFetch++; return new Response('{}', { status: 500 }); }
  calls.push(url);
  if (opt.headers?.['X-Riot-Token'] !== 'RGAPI-x') return new Response('{}', { status: 401 });
  if (riotStatus) return new Response('{}', { status: riotStatus });
  let m = url.match(/by-riot-id\/([^/]+)\/([^/?]+)$/);
  if (m) { const k = decodeURIComponent(m[1]) + '#' + decodeURIComponent(m[2]); return ACC[k] ? new Response(JSON.stringify({ puuid: ACC[k], gameName: m[1], tagLine: m[2] })) : new Response('{}', { status: 404 }); }
  m = url.match(/active-games\/by-summoner\/([^/?]+)$/);
  if (m) { const g = GAMES[m[1]]; return g ? new Response(JSON.stringify(g)) : new Response('{}', { status: 404 }); }
  return new Response('{}', { status: 404 });
};
const { default: W, MEM } = await import(path.join(dir, 'naejeon-wmodl.mjs'));
const call = async (body, { origin = 'https://housb98.github.io', key = 'k' } = {}) => {
  MEM.liveAt = 0; calls = [];
  const r = await W.fetch(new Request('https://w.test/live', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: JSON.stringify({ key, ...body }) }), env, {});
  return { status: r.status, j: await r.json() };
};
// 선수 10명: p0~p9, 롤 닉네임 '친구N#KR1', 저장된 puuid 는 짝수만
const pu = (n) => 'PUUID-' + String(n).padStart(30, '0');
const players = Array.from({ length: 10 }, (_, n) => ({ pid: 'p' + n, ids: ['친구' + n + '#KR1'], puuid: n % 2 ? '' : pu(n) }));
for (let n = 0; n < 10; n++) ACC['친구' + n + '#KR1'] = pu(n);
const custom = (ids, extra = {}) => ({ gameId: 777, gameType: 'CUSTOM_GAME', gameMode: 'CLASSIC', gameQueueConfigId: 0, mapId: 11, gameStartTime: 1, gameLength: 30,
  participants: ids.map((n, i) => ({ teamId: i < 5 ? 100 : 200, championId: 100 + i, riotId: typeof n === 'string' ? n : '친구' + n + '#KR1', puuid: typeof n === 'string' ? 'X-' + n : pu(n) })),
  bannedChampions: [{ championId: 1, teamId: 100, pickTurn: 1 }, { championId: 2, teamId: 200, pickTurn: 2 }, { championId: -1, teamId: 100, pickTurn: 3 }], ...extra });

// 1) 10명이 내전 중
GAMES = {}; const g1 = custom([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); for (let n = 0; n < 10; n++) GAMES[pu(n)] = g1;
let r = await call({ players });
ok(r.status === 200 && r.j.found && r.j.participants.length === 10 && r.j.bans.length === 3 && r.j.game.type === 'CUSTOM_GAME', `내전 중: 찾음 ${r.j.found} · 참가자 ${r.j.participants?.length} · 밴 ${r.j.bans?.length}`);
ok(calls.length === 1 && r.j.via === 'p0', `저장된 puuid 가 있는 선수부터 확인 → 라이엇 호출 ${calls.length}번 (via ${r.j.via})`);
ok(otherFetch === 0, 'Firestore·다른 곳 요청 0번');

// 2) 아무도 게임 중이 아님(밴픽 중)
GAMES = {}; MEM.pu = new Map();
r = await call({ players });
const spec = calls.filter((u) => u.includes('spectator')).length, acc = calls.filter((u) => u.includes('by-riot-id')).length;
ok(r.j.found === false && spec === 10 && acc === 5, `게임 전: 못 찾음 · 관전 확인 ${spec}번 · 닉네임→puuid ${acc}번(puuid 없는 5명)`);
r = await call({ players });
ok(calls.filter((u) => u.includes('by-riot-id')).length === 0, `다시 확인할 때는 puuid 를 기억해서 닉네임 조회 0번 (관전 ${calls.length}번)`);

// 3) 기다리는 중 빠른 확인: 3명만, 돌아가며
r = await call({ players, quick: 3, start: 0 }); const a = calls.map((u) => u.split('/').pop());
r = await call({ players, quick: 3, start: 3 }); const b = calls.map((u) => u.split('/').pop());
ok(a.length === 3 && b.length === 3 && !a.some((x) => b.includes(x)), `빠른 확인: 한 번에 ${a.length}·${b.length}번, 겹치지 않게 돌아가며`);

// 4) p0 은 솔랭 중(다른 사람들), 나머지는 내전 중 → 솔랭은 건너뛰고 내전을 찾음
GAMES = {}; const solo = custom(['남1#A', '남2#A', '남3#A', '남4#A', 0, '남5#A', '남6#A', '남7#A', '남8#A', '남9#A'], { gameId: 1, gameType: 'MATCHED_GAME', gameQueueConfigId: 420 });
GAMES[pu(0)] = solo; const g2 = custom([1, 2, 3, 4, 5, 6, 7, 8, 9, '모름#X']); for (let n = 1; n < 10; n++) GAMES[pu(n)] = g2;
r = await call({ players });
ok(r.j.found && r.j.game.id === 777 && r.j.via !== 'p0', `한 명이 솔랭 중이어도 내전을 찾음(game ${r.j.game?.id}, via ${r.j.via})`);

// 5) 6명 미만만 겹치는 게임은 내전으로 보지 않음
GAMES = {}; const g3 = custom([0, 1, 2, 3, 4, 'a#1', 'b#1', 'c#1', 'd#1', 'e#1']); for (let n = 0; n < 5; n++) GAMES[pu(n)] = g3;
r = await call({ players });
ok(r.j.found === false, '라인업 5명만 있는 게임: 내전 아님(못 찾음)');

// 6) 부계정으로 들어온 사람만 게임 중
GAMES = {}; const pl6 = players.map((p) => ({ ...p, ids: [...p.ids] })); pl6[3].ids.push('부캐3#KR2'); ACC['부캐3#KR2'] = 'ALT3-0000000000000000000000';
const g6 = custom([0, 1, 2, '부캐3#KR2', 4, 5, 6, 7, 8, 9]); g6.participants[3].puuid = 'ALT3-0000000000000000000000';
GAMES['ALT3-0000000000000000000000'] = g6;
r = await call({ players: pl6 });
ok(r.j.found && r.j.via === 'p3', `주계정 10명이 모두 아니면 부계정까지 확인 → 찾음 (via ${r.j.via}, 호출 ${calls.length}번)`);

// 7) 오류
riotStatus = 403; r = await call({ players }); ok(r.status === 500 && /키/.test(r.j.error), '라이엇 키 만료: ' + r.j.error);
riotStatus = 429; r = await call({ players }); ok(r.j.found === false && r.j.limited === true, '호출 한도: limited 로 알려 줌');
riotStatus = 0;
r = await call({ players: players.slice(0, 5) }); ok(r.status === 500 && /6명/.test(r.j.error), '닉네임 있는 선수 5명: ' + r.j.error);
r = await call({ players }, { key: 'zz' }); ok(r.status === 403, '리그 키 틀림: 403');
r = await call({ players }, { origin: 'https://evil.test' }); ok(r.status === 403, '다른 사이트에서 요청: 403');
MEM.liveAt = Date.now(); const r2 = await W.fetch(new Request('https://w.test/live', { method: 'POST', headers: { Origin: 'https://housb98.github.io' }, body: JSON.stringify({ key: 'k', players }) }), env, {});
ok(r2.status === 429, '2초 안에 또 요청: 429');
// 8) 이상한 입력
r = await call({ players: [...players, ...players, { pid: 'x'.repeat(500), ids: ['a'.repeat(500) + '#1'] }].map((p) => ({ ...p, puuid: 'bad puuid!' })) });
ok(r.status === 200 && calls.length <= 40, `이상한 입력(20명·긴 값·잘못된 puuid): 정상 처리, 라이엇 호출 ${calls.length}번(최대 40)`);
// 9) 기존 경로 그대로
r = await (async () => { MEM.riotAt = Date.now(); const x = await W.fetch(new Request('https://w.test/riot', { method: 'POST', headers: { Origin: 'https://housb98.github.io' }, body: JSON.stringify({ key: 'k' }) }), env, {}); return x.status; })();
ok(r === 429, '기존 /riot 경로 동작 그대로(1분 제한 응답)');
