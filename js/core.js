// 공통: 상태, 라우터, 이벤트 위임, 모달, 챔피언/선수 선택창, 관리자 PIN
import { compute, LANES, LANE_NAME, LANE_ICON, pct } from './stats.js';

export const S = {
  store: null, key: 'local', st: null, dirty: true, page: 'home', arg: [], admin: false,
  champs: [], champBy: {}, ver: '', ui: {},
};
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const col = (name) => Object.values(S.store.data[name] || {});
export const settings = () => S.store.data.meta?.settings || {};
export const pname = (id) => esc(S.st?.P[id]?.name || S.store.data.players?.[id]?.name || '?');

const pages = {}, acts = {};
export const page = (id, def) => (pages[id] = def);
export const act = (name, fn) => (acts[name] = fn);
export const NAV = [
  ['home', '🏆', '리더보드'], ['today', '⚔️', '오늘의 내전'], ['matches', '📜', '경기 기록'], ['players', '🪪', '선수'],
  ['chem', '💞', '케미'], ['champs', '📈', '챔피언'], ['fearless', '🚫', '피어리스'], ['auction', '🔨', '경매'], ['admin', '⚙️', '관리'],
];

export function go(hash) { location.hash = hash; }
function parseHash() {
  const [p, ...arg] = location.hash.replace(/^#\/?/, '').split('/');
  S.page = pages[p] ? p : 'home'; S.arg = arg.map(decodeURIComponent);
}
let raf = 0;
export function refresh(dataChanged) {
  if (dataChanged) S.dirty = true;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
}
export function render() {
  if (S.dirty) { S.st = compute(col('players'), col('matches'), settings()); S.dirty = false; }
  const main = document.getElementById('main');
  const f = document.activeElement, fid = f && main.contains(f) ? f.id : '', sel = fid && f.selectionStart;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.p === S.page));
  document.getElementById('league').textContent = settings().leagueName || '친구 내전 리그';
  main.innerHTML = pages[S.page].render(...S.arg);
  pages[S.page].after?.();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(sel, sel); } catch {} } }
}
export function initShell() {
  document.getElementById('nav').innerHTML = NAV.map(([p, i, t]) => `<a href="#/${p}" data-p="${p}"><span>${i}</span>${t}</a>`).join('');
  document.getElementById('mode').innerHTML = S.store.mode === 'local' ? '<span class="tag warn" title="이 브라우저에만 저장됩니다">체험 모드</span>' : '<span class="tag ok">● 실시간</span>';
  const on = (type, attr) => document.addEventListener(type, (e) => {
    const el = e.target.closest?.(`[${attr}]`);
    if (el && acts[el.getAttribute(attr)]) acts[el.getAttribute(attr)](el.dataset, el, e);
  });
  on('click', 'data-a'); on('change', 'data-c'); on('input', 'data-i');
  window.addEventListener('hashchange', () => { parseHash(); window.scrollTo(0, 0); render(); });
  parseHash(); render();
}

// ---------- 표시 도우미 ----------
export const fmtDT = (at) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const fmtDay = (k) => { const [y, m, d] = k.split('-'); return `${y}.${m}.${d}`; };
export const wr = (o) => (o && o.g ? `${pct(o.w, o.g)}% <small>(${o.g})</small>` : '<span class="mut">-</span>');
export const wrClass = (v) => (v === null || v === undefined ? '' : v >= 60 ? 'good' : v <= 40 ? 'bad' : '');
export const dots = (arr) => `<span class="dots">${[...Array(5 - arr.length).fill(null), ...arr].map((r) => `<i class="${r === null ? '' : r ? 'w' : 'l'}">${r === null ? '·' : r ? '승' : '패'}</i>`).join('')}</span>`;
export const streak = (n) => (n >= 2 ? `<span class="good">🔥${n}연승</span>` : n <= -2 ? `<span class="bad">🧊${-n}연패</span>` : '');
export const laneTag = (l) => `<span class="lane">${LANE_ICON[l]} ${LANE_NAME[l]}</span>`;
export const titleChips = (s, max = 99) => s.titles.slice(0, max).map((t) => `<span class="chip" title="${esc(t.d)}">${t.e}${t.n}</span>`).join('') + (s.titles.length > max ? `<span class="chip mut">+${s.titles.length - max}</span>` : '');
export function champIcon(name, cls = '') {
  if (!name) return `<span class="ci empty ${cls}"></span>`;
  const c = S.champBy[name];
  return c ? `<img class="ci ${cls}" src="${c.img}" alt="${esc(name)}" title="${esc(name)}" loading="lazy">` : `<span class="ci txt ${cls}" title="${esc(name)}">${esc(name.slice(0, 2))}</span>`;
}
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}
export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: type + ';charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');

// ---------- 모달 ----------
export function modal(html, cls = '') {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.classList.add('on');
  return m.firstElementChild;
}
export function closeModal() { const m = document.getElementById('modal'); m.classList.remove('on'); m.innerHTML = ''; }
act('close', closeModal);
document.addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// ---------- 챔피언 ----------
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const cho = (s) => [...s].map((c) => { const n = c.charCodeAt(0) - 0xac00; return n >= 0 && n < 11172 ? CHO[Math.floor(n / 588)] : c; }).join('');
export async function loadChamps() {
  const set = (o) => { S.ver = o.ver; S.champs = o.list; S.champBy = Object.fromEntries(o.list.map((c) => [c.name, c])); };
  try {
    const cached = JSON.parse(localStorage.getItem('naejeon:champs') || 'null');
    if (cached) set(cached);
    if (cached && Date.now() - cached.at < 864e5) return;
    const ver = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
    const data = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/ko_KR/champion.json`)).json()).data;
    const list = Object.values(data).map((c) => ({ name: c.name, img: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.image.full}` })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const o = { ver, list, at: Date.now() };
    localStorage.setItem('naejeon:champs', JSON.stringify(o)); set(o); refresh();
  } catch (e) { console.warn('챔피언 목록을 불러오지 못했습니다', e); }
}
let pickCb = null;
export function pickChamp({ title, used = {}, current = '', onPick }) {
  pickCb = onPick;
  const grid = S.champs.map((c) => `<button class="cp ${used[c.name] ? 'used' : ''} ${c.name === current ? 'cur' : ''}" data-a="cp" data-n="${esc(c.name)}" data-k="${esc(c.name.replace(/\s/g, '') + ' ' + cho(c.name.replace(/\s/g, '')))}" ${used[c.name] ? `disabled title="${esc(used[c.name])}"` : ''}><img src="${c.img}" loading="lazy" alt=""><span>${esc(c.name)}</span></button>`).join('');
  const el = modal(`<div class="mh"><b>${esc(title)}</b><button class="btn ghost" data-a="close">닫기</button></div>
    <div class="row"><input id="cpq" class="inp grow" placeholder="챔피언 검색 (초성 가능: ㅇㄹ)" data-i="cpq" autocomplete="off">
    <button class="btn" data-a="cp" data-n="">비우기</button></div>
    ${S.champs.length ? `<div class="cpgrid">${grid}</div>` : `<p class="mut">챔피언 목록을 불러오지 못했습니다. 이름을 직접 입력하고 Enter를 누르세요.</p>`}`, 'tall');
  const q = el.querySelector('#cpq');
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = el.querySelector('.cp:not([hidden]):not([disabled])');
    if (first) first.click(); else if (!S.champs.length && q.value.trim()) { closeModal(); pickCb(q.value.trim()); }
  });
  if (matchMedia('(min-width: 800px)').matches) q.focus();
}
act('cpq', (d, el) => {
  const q = el.value.replace(/\s/g, '');
  document.querySelectorAll('.cp').forEach((b) => (b.hidden = !!q && !b.dataset.k.includes(q)));
});
act('cp', (d) => { closeModal(); pickCb?.(d.n); });

// ---------- 선수 선택 ----------
let pickPCb = null;
export function pickPlayer({ title, exclude = [], lane, onPick, allowClear }) {
  pickPCb = onPick;
  const list = S.st.list.filter((s) => !exclude.includes(s.id)).sort((a, b) => (lane ? (b.p.scores?.[lane] || 0) - (a.p.scores?.[lane] || 0) : a.name.localeCompare(b.name, 'ko')));
  modal(`<div class="mh"><b>${esc(title)}</b><button class="btn ghost" data-a="close">닫기</button></div>
    ${allowClear ? '<button class="btn block" data-a="pp" data-id="">자리 비우기</button>' : ''}
    <div class="pplist">${list.map((s) => `<button class="pp" data-a="pp" data-id="${s.id}"><b>${esc(s.name)}</b><small>${LANE_ICON[s.mainLane]} ${lane ? `${LANE_NAME[lane]} ${s.p.scores?.[lane] ?? 0}점` : `평균 ${s.avg.toFixed(1)}`}</small></button>`).join('') || '<p class="mut">선택할 선수가 없습니다.</p>'}</div>`, 'tall');
}
act('pp', (d) => { closeModal(); pickPCb?.(d.id); });

// ---------- 관리자 PIN (가벼운 잠금: 실수·장난 방지용) ----------
async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('naejeon:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function needAdmin(fn) {
  if (S.admin || sessionStorage.getItem('naejeon:admin:' + S.key) === settings().pinHash && settings().pinHash) { S.admin = true; return fn(); }
  const has = !!settings().pinHash;
  const el = modal(`<div class="mh"><b>🔒 관리자 확인</b><button class="btn ghost" data-a="close">닫기</button></div>
    <p class="mut">${has ? '점수 수정·경기 삭제 같은 작업은 관리자 PIN이 필요합니다.' : '아직 관리자 PIN이 없습니다. 지금 정하는 PIN이 관리자 PIN이 됩니다. (4자리 이상)'}</p>
    <form class="row" id="pinf"><input class="inp grow" id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN"><button class="btn pri">확인</button></form>`);
  el.querySelector('#pin').focus();
  el.querySelector('#pinf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = el.querySelector('#pin').value.trim();
    if (v.length < 4) return toast('4자리 이상 입력하세요');
    const hsh = await sha(v);
    if (!has) await S.store.patch('meta', 'settings', { pinHash: hsh });
    else if (hsh !== settings().pinHash) return toast('PIN이 맞지 않습니다');
    S.admin = true; sessionStorage.setItem('naejeon:admin:' + S.key, hsh);
    closeModal(); fn();
  });
}
export const history = (type, before) => S.store.put('history', uid(), { type, at: Date.now(), before });
export { LANES, LANE_NAME, LANE_ICON, pct };
