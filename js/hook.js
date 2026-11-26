// 연동 서버(Cloudflare Worker) 호출. 서버 주소는 js/config.js 의 WORKER_URL.
// 디스코드 웹훅 주소·라이엇 키 같은 비밀값은 서버에만 있고, 여기서는 "무슨 일이 있었는지(종류·문서 id)"만 알린다.
// 서버는 Firestore에서 그 문서를 직접 읽어 확인한 뒤 메시지를 만든다(내용을 꾸며 보낼 수 없음).
import { WORKER_URL } from './config.js';
import { S } from './core.js';

export const hookOn = () => !!WORKER_URL && S.store?.mode === 'firebase';
const base = () => WORKER_URL.replace(/\/+$/, '');

// 연동 서버 버전: worker/worker.js 의 WORKER_VER 와 같아야 한다(Worker를 고치면 둘 다 올린다). 관리 화면이 비교해서 '옛 버전' 경고를 띄운다.
export const WORKER_VER = '2026-11-26a';
const VER = { at: 0, p: null };
// 배포된 연동 서버의 버전을 확인한다(주소 GET /, Firestore 사용 없음). 10분 동안은 다시 묻지 않는다. { ver } 또는 { error }
export function workerVer(force) {
  if (!WORKER_URL) return Promise.resolve({ error: 'WORKER_URL 이 비어 있어요' });
  if (!force && VER.p && Date.now() - VER.at < 10 * 60e3) return VER.p;
  VER.at = Date.now();
  VER.p = fetch(base() + '/').then((r) => r.json()).then((j) => ({ ver: j.ver || '' })).catch((e) => ({ error: '연동 서버에 연결하지 못했어요 · ' + (e.message || e) }));
  return VER.p;
}

// ---------- 사이트 오류 보고 ----------
// 이 사이트의 코드(js/*.js)에서 난 오류만 연동 서버(/report)를 거쳐 디스코드로 알린다(같은 오류는 서버가 하루 한 번만 보냄).
// 보내는 것: 오류 문구·파일·줄·화면 이름·사이트 버전·기기 종류. 닉네임·리그 내용 같은 개인 정보는 보내지 않는다.
// 확장 프로그램·다른 사이트 코드·연결 끊김처럼 우리가 고칠 수 없는 오류는 보내지 않는다. 한 탭에서 3건, 한 기기에서 같은 오류는 하루 한 번까지.
const SITE_V = (() => { try { return new URL(import.meta.url).searchParams.get('v') || ''; } catch { return ''; } })();
const ERR_SKIP = /ResizeObserver loop|^Script error\.?$|Failed to fetch|NetworkError|Load failed|network error|QuotaExceeded|AbortError|The operation was aborted|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically imported module/i;
const FB_SKIP = /unavailable|deadline-exceeded|cancelled|resource-exhausted|failed-precondition|aborted/;
const ERR = { n: 0, seen: new Set() };
const devInfo = () => {
  const u = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '기타';
  const br = /SamsungBrowser/.test(u) ? '삼성 인터넷' : /KAKAOTALK/i.test(u) ? '카카오톡' : /Edg\//.test(u) ? 'Edge' : /Whale/.test(u) ? '웨일' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : '기타';
  return `${matchMedia('(pointer: coarse)').matches ? '휴대폰' : 'PC'} · ${br} · ${os}`;
};
// 오류가 난 곳(우리 파일)을 찾는다: 'js/today.js' 처럼 사이트 안의 경로만 남긴다(주소의 ?v= 와 초대 코드는 버림)
function ownPlace(file, stack) {
  const root = location.origin + location.pathname.replace(/[^/]*$/, '');
  const pick = (u) => { if (!u || !String(u).startsWith(root)) return null; const f = String(u).slice(root.length).split(/[?#]/)[0]; return /^js\/[\w-]+\.js$/.test(f) ? f : f === '' || f === 'index.html' ? 'index.html' : null; };
  const f = pick(file); if (f) return { file: f };
  const m = String(stack || '').match(/(https?:\/\/[^\s)]+?\.(?:js|html)[^\s):]*):(\d+):(\d+)/g) || [];
  for (const x of m) { const k = x.match(/^(.*):(\d+):(\d+)$/); const g = k && pick(k[1]); if (g) return { file: g, line: +k[2], col: +k[3] }; }
  return null;
}
function report(kind, msg, file, line, col, stack, err) {
  try {
    if (!hookOn() || !S.key || ERR.n >= 3) return;
    msg = String(msg || '').replace(/^Uncaught\s+/, '').slice(0, 240);
    if (!msg || ERR_SKIP.test(msg)) return;
    if (err?.name === 'FirebaseError' && FB_SKIP.test(String(err.code || ''))) return; // 연결 문제 등 일시적인 Firebase 오류
    const at = ownPlace(file, stack); if (!at) return; // 우리 코드가 아님
    if (!at.line) { at.line = +line || 0; at.col = +col || 0; }
    const sig = `${at.file}:${at.line}:${msg.slice(0, 80)}`;
    if (ERR.seen.has(sig)) return;
    ERR.seen.add(sig);
    const day = new Date().toDateString(), K = 'naejeon:errsent';
    let st; try { st = JSON.parse(localStorage.getItem(K) || '{}'); } catch { st = {}; }
    if (st.day !== day) st = { day, sigs: [] };
    if (st.sigs.includes(sig) || st.sigs.length >= 10) return;
    st.sigs.push(sig); try { localStorage.setItem(K, JSON.stringify(st)); } catch {}
    ERR.n++;
    fetch(base() + '/report', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: S.key, kind, msg, file: at.file, line: at.line, col: at.col, page: S.page || '', v: SITE_V, dev: devInfo() }) }).catch(() => {});
  } catch {}
}
addEventListener('error', (e) => { if (e.error || e.message) report('error', e.message || e.error?.message, e.filename, e.lineno, e.colno, e.error?.stack, e.error); });
addEventListener('unhandledrejection', (e) => { const r = e.reason; report('promise', r?.message || String(r), '', 0, 0, r?.stack, r); });

// 실패해도 사이트 동작에는 영향이 없게 조용히 넘긴다. 탭을 바로 닫아도 전송되도록 keepalive.
export function notify(type, id) {
  if (!hookOn()) return;
  try {
    fetch(base() + '/notify', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: S.key, type, id }) }).catch(() => {});
  } catch {}
}

// 관리 화면용: 결과(JSON)를 돌려준다. 실패하면 { error } .
export async function callWorker(path, body) {
  if (!WORKER_URL) return { error: 'js/config.js 의 WORKER_URL 이 비어 있어요' };
  try {
    const r = await fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: S.key, ...(body || {}) }) }); // text/plain: 사전 요청(CORS preflight) 없이 바로 보낸다
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || `서버 오류 (${r.status})` };
  } catch (e) { return { error: '연동 서버에 연결하지 못했어요 · ' + (e.message || e) }; }
}

// ---------- Firebase 사용량 (관리 화면·채팅창 공용) ----------
// 연동 서버가 구글 집계를 5분 동안 재사용하므로 여러 화면에서 불러도 같은 값이다. Firestore 읽기는 쓰지 않는다.
// 새 값이 오면 window 에 'usage' 이벤트를 보낸다.
export const USAGE = { d: null, err: '', at: 0, busy: false };
export async function loadUsage(force) {
  if (!hookOn() || USAGE.busy || (!force && Date.now() - USAGE.at < 5 * 60e3)) return;
  USAGE.busy = true; USAGE.at = Date.now();
  const r = await callWorker('/usage');
  USAGE.busy = false;
  if (r.error) USAGE.err = r.error; else { USAGE.d = r; USAGE.err = ''; }
  dispatchEvent(new Event('usage'));
}
export const won = (usd, krw) => '₩' + Math.round((+usd || 0) * (krw || 1400)).toLocaleString('ko-KR');
export const kfmt = (v) => (v >= 10000 ? (v / 1000).toFixed(0) + 'k' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.max(0, Math.round(v))));
