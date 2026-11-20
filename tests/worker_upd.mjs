// 연동 서버: 라이엇 갱신이 선수 문서에 upd(서버 시각)를 붙이는지(사이트가 '바뀐 선수만' 받는 기준), 버전이 사이트와 같은지
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), MOD = path.join(os.tmpdir(), 'naejeon-wmodu.mjs');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
fs.writeFileSync(MOD, fs.readFileSync(path.join(ROOT, 'worker/worker.js'), 'utf8') + '\nexport { patchWrite, WORKER_VER };\n');
const { patchWrite, WORKER_VER } = await import(MOD);
const env = { LEAGUE_KEY: 'k', GCP_SA: '{"project_id":"x"}' };
const hook = fs.readFileSync(path.join(ROOT, 'js/hook.js'), 'utf8').match(/WORKER_VER = '([^']+)'/)[1];
ok(WORKER_VER === hook, `Worker 버전 ${WORKER_VER} = 사이트 기대값 ${hook}`);
const p = patchWrite(env, 'players', 'p1', { soloTier: '골드' }), g = patchWrite(env, 'gacha', 'p1', { a: 1 });
ok(JSON.stringify(p.updateTransforms) === '[{"fieldPath":"upd","setToServerValue":"REQUEST_TIME"}]' && JSON.stringify(p.updateMask.fieldPaths) === '["soloTier"]', '선수 문서 수정: upd 를 서버 시각으로 붙이고, 고친 필드만 바꿈');
ok(!g.updateTransforms, '다른 문서(가챠 등)에는 upd 를 붙이지 않음');
