// 채팅창 길드 탭(정파·마교): 길드 비밀번호를 넣어야 들어간다. 글은 비밀번호로 감싼 열쇠로 AES-GCM 암호화해 gchat_j·gchat_m에 저장(DB를 봐도 못 읽음).
// meta/guild.sec[g] = { salt, wk(비밀번호 열쇠로 감싼 데이터 열쇠), at }. 데이터 열쇠는 '이 기기에서 기억하기'면 기기에 남는다(비밀번호를 새로 시작하면 무효).
// 길드 탭을 보고 있는 동안에만 최신 60개를 실시간으로 받는다(로비로 돌아가거나 채팅창을 닫으면 끊음) → 평소 읽기 0. 이 파일은 길드 탭을 처음 누를 때 받는다
import { S, esc, toast, uid, guildMeta, GUILDS } from './core.js';
import { nick, cid } from './social.js';

const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const te = new TextEncoder(), td = new TextDecoder();
async function pwKey(pw, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(key, bytes) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes); const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return b64(out); }
async function unseal(key, s) { const u = unb64(s); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12))); }
const dataKey = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
export const LKK = (g) => `naejeon:gk:${S.key}:${g}`;
const secOf = (g) => guildMeta()?.sec?.[g] || null;

// 관리자: 비밀번호 정하기/바꾸기(지금 비밀번호를 알면 글은 그대로, 모르면 새로 시작 = 예전 글은 못 읽음)
export async function setPassword(g, pw, oldPw) {
  const sec = secOf(g);
  let raw = null;
  if (sec?.wk && oldPw) { try { raw = await unseal(await pwKey(oldPw, unb64(sec.salt)), sec.wk); } catch { throw new Error('지금 비밀번호가 맞지 않아요'); } }
  if (!raw) raw = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wk = await seal(await pwKey(pw, salt), raw);
  const at = sec?.wk && oldPw ? +sec.at || Date.now() : Date.now(); // 열쇠가 그대로면 기억된 기기도 그대로
  await S.store.patch('meta', 'guild', { sec: { [g]: { salt: b64(salt), wk, at } } });
  if (C.g === g) close();
  try { localStorage.removeItem(LKK(g)); } catch {}
}

// 문파 게시판 글쓰기도 같은 문파 비밀번호로 연다(KS: 이번 접속에서 연 문파 · 기억한 기기는 바로)
const KS = {};
export function hasKey(g) {
  const sec = secOf(g); if (!sec?.wk) return false;
  if (KS[g] === +sec.at) return true;
  try { const v = JSON.parse(localStorage.getItem(LKK(g)) || 'null'); return !!v && +v.at === +sec.at; } catch { return false; }
}
export async function unlock(g, pw, remember) {
  const sec = secOf(g); if (!sec?.wk) return false;
  let raw; try { raw = await unseal(await pwKey(pw, unb64(sec.salt)), sec.wk); } catch { return false; }
  KS[g] = +sec.at;
  if (remember) try { localStorage.setItem(LKK(g), JSON.stringify({ at: +sec.at, k: b64(raw) })); } catch {}
  return true;
}
const C = { g: '', key: null, at: 0, msgs: [], un: null, cb: null, busy: false, err: '' };
export function close() { C.un?.(); C.un = null; C.key = null; C.g = ''; C.msgs = []; C.busy = false; }
export const isOpen = (g) => C.g === g && !!C.key;
async function use(g, raw, remember) {
  const sec = secOf(g);
  C.g = g; C.key = await dataKey(raw); C.at = +sec.at; KS[g] = C.at;
  if (remember) try { localStorage.setItem(LKK(g), JSON.stringify({ at: C.at, k: b64(raw) })); } catch {}
  C.un = S.store.watchRecent('gchat_' + g, 60, (docs) => dec(docs).then((v) => { if (C.g !== g) return; C.msgs = v.reverse(); C.cb?.(); }), (e) => toast('문파 채팅 연결 오류: ' + (e.code || e.message)));
}
async function dec(docs) {
  const k = C.key; if (!k) return [];
  return (await Promise.all(docs.filter((x) => !x.deleted).map(async (x) => { try { return { id: x.id, at: x.at, ...JSON.parse(td.decode(await unseal(k, x.x))) }; } catch { return null; } }))).filter(Boolean);
}
// 탭을 열 때: 기억된 열쇠가 있으면 바로 들어간다
export async function enter(g, cb) {
  C.cb = cb;
  if (C.g && C.g !== g) close();
  if (C.key || C.busy) return cb();
  C.g = g;
  const sec = secOf(g);
  try { const v = JSON.parse(localStorage.getItem(LKK(g)) || 'null'); if (sec?.wk && v && +v.at === +sec.at) { C.busy = true; await use(g, unb64(v.k), false); C.busy = false; } } catch { C.busy = false; }
  cb();
}
export function leave() { close(); C.cb = null; }
export const locked = (g) => !isOpen(g);
const tm = (at) => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
// 채팅 목록 자리에 그릴 내용
export function html(g) {
  const sec = secOf(g), n = GUILDS[g].n;
  if (C.key && C.g === g && sec && +sec.at !== C.at) close(); // 관리자가 비밀번호를 새로 시작했으면 다시 잠금
  if (!sec?.wk) return `<div class="gch-lock"><b>${n} 채팅</b><p>관리자가 ${n} 비밀번호를 정하면 열려요.</p></div>`;
  if (!isOpen(g)) return `<form class="gch-lock" id="gchf" data-g="${g}"><b>${n} ${GUILDS[g].mem} 전용 채팅</b><p>문파 비밀번호를 넣어 주세요.<br><small>대화는 암호화되어 저장돼요.</small></p><input class="inp" id="gchf-p" type="password" autocomplete="off" placeholder="${n} 비밀번호" aria-label="${n} 비밀번호"><label class="mini"><input type="checkbox" id="gchf-r" checked> 이 기기에서 기억하기</label><button class="btn pri">입장</button></form>`;
  const bar = `<div class="gch-bar g-${g}"><span>${n} ${GUILDS[g].mem} 전용 · 암호화</span><button class="lnk" data-a="chGLock" title="이 기기에서 기억한 비밀번호 지우기">잠그기</button></div>`;
  if (!C.msgs.length) return `${bar}<div class="cempty"><p>${n} ${GUILDS[g].mem}만 보는 채팅이에요.<br>첫 이야기를 남겨 보세요.</p></div>`;
  let prev = '', out = bar;
  for (const m of C.msgs) {
    const me = m.c === cid, who = (m.c || '') + m.n, head = who !== prev; prev = who;
    out += `<div class="cm ${me ? 'me' : ''} ${head ? 'head' : ''}">${head && !me ? `<b class="cn gtint"><span class="gnm g-${g}"><u>${esc(m.n || '익명')}</u></span></b>` : ''}<div class="cl"><span class="cb">${esc(m.t)}</span><small>${tm(m.at)}</small></div></div>`;
  }
  return out;
}
export async function send(g, t) {
  if (!isOpen(g)) { toast('문파 비밀번호를 먼저 넣어 주세요'); return false; }
  const id = uid();
  try { await S.store.put('gchat_' + g, id, { at: Date.now(), x: await seal(C.key, te.encode(JSON.stringify({ n: nick() || '익명', t: String(t).slice(0, 300), c: cid }))), deleted: false }); return true; } catch (e) { toast('전송 실패: ' + (e.code || e.message)); return false; }
}
export function lock(g) { try { localStorage.removeItem(LKK(g)); } catch {} delete KS[g]; if (C.g === g) close(); }
// 비밀번호 입력(채팅창 안의 양식)
document.addEventListener('submit', async (e) => {
  const f = e.target; if (!(f instanceof HTMLFormElement) || f.id !== 'gchf') return;
  e.preventDefault();
  const g = f.dataset.g, sec = secOf(g), pw = f.querySelector('#gchf-p').value;
  if (!pw || !sec?.wk) return;
  const btn = f.querySelector('.btn'); btn.disabled = true;
  let raw; try { raw = await unseal(await pwKey(pw, unb64(sec.salt)), sec.wk); } catch { btn.disabled = false; return toast('비밀번호가 맞지 않아요'); }
  if (C.g && C.g !== g) close();
  C.un?.(); await use(g, raw, f.querySelector('#gchf-r').checked); C.cb?.();
});
