// 빠른 이동: Ctrl+K(맥은 ⌘K) 또는 / 를 누르면 작은 검색창이 뜨고, 페이지·선수 이름(초성 가능)으로 바로 간다.
// 누를 때만 그려서 평소 성능에는 영향이 없다. 읽기·쓰기 없음(이미 받아 둔 선수 목록만 쓴다).
import { S, act, esc, cho, go, ic, modal, closeModal, NAV_ALL, LANE_ICON, LANE_NAME, moreHooks } from './core.js';

const F = { q: '', sel: 0, items: [] };
const isOpen = () => !!document.querySelector('#modal.on .finder');
const norm = (t) => String(t || '').toLowerCase().replace(/\s/g, '');
// 이름에서 찾는 말이 나오는 위치로 점수: 앞에서 시작(0) > 중간(1) > 초성만 맞음(2). 안 맞으면 -1
function rank(name, q) {
  const n = norm(name); if (!q) return 0;
  const i = n.indexOf(q); if (i === 0) return 0; if (i > 0) return 1;
  return cho(n).includes(q) ? 2 : -1;
}
const PAGES = () => NAV_ALL.filter(([p]) => p).map(([p, t]) => ({ k: 'page', id: p, name: t, alt: p, href: '#/' + p }));
function search(raw) {
  const q = norm(raw);
  const pages = PAGES().map((x) => ({ ...x, r: Math.min(...[rank(x.name, q), rank(x.alt, q)].filter((r) => r >= 0).concat(9)) }));
  const players = (S.st?.list || []).map((s) => ({ k: 'player', id: s.id, name: s.name, lane: s.mainLane, sub: `${LANE_NAME[s.mainLane] || ''} · OVR ${s.ovr}`, href: '#/players/' + s.id, r: rank(s.name, q) }));
  const keep = (a) => a.filter((x) => x.r >= 0 && x.r < 9).sort((a, b) => a.r - b.r || a.name.localeCompare(b.name, 'ko'));
  // 아무것도 안 쳤으면 페이지 전체(메뉴 순서) + 선수는 생략, 치면 선수 먼저(이름 찾기가 주된 쓰임)
  return q ? [...keep(players).slice(0, 8), ...keep(pages)] : PAGES();
}
const row = (x, i) => `<button type="button" class="fd-it ${i === F.sel ? 'on' : ''}" data-a="fdGo" data-i="${i}" role="option" aria-selected="${i === F.sel}">
  ${x.k === 'page' ? ic(x.id) : `<span class="fd-av">${esc(x.name.slice(0, 1))}</span>`}<b>${esc(x.name)}</b>${x.sub ? `<small>${LANE_ICON[x.lane] || ''}${esc(x.sub)}</small>` : ''}<em>${x.k === 'page' ? '페이지' : '선수'}</em></button>`;
function paint() {
  const box = document.getElementById('fd-list'); if (!box) return;
  box.innerHTML = F.items.length ? F.items.map(row).join('') : '<p class="mut fd-none">찾는 결과가 없어요</p>';
  box.querySelector('.fd-it.on')?.scrollIntoView({ block: 'nearest' });
}
export function openFinder() {
  if (isOpen()) return;
  F.q = ''; F.sel = 0; F.items = search('');
  const el = modal(`<div class="finder"><label class="fd-q">${ic('search')}<input id="fd-q" data-i="fdQ" placeholder="페이지·선수 이름 (초성 가능: ㄱㄴ)" autocomplete="off" spellcheck="false" aria-label="빠른 이동 검색"><kbd>Esc</kbd></label>
    <div id="fd-list" class="fd-list" role="listbox"></div><p class="fd-tip mut">↑↓ 고르기 · Enter 이동 · <kbd>Ctrl</kbd>+<kbd>K</kbd> 또는 <kbd>/</kbd> 로 언제든 열기</p></div>`, 'finder-sheet');
  paint();
  el.querySelector('#fd-q').focus();
}
function goSel(i) {
  const x = F.items[i]; if (!x) return;
  closeModal(); go(x.href);
}
act('fdQ', (d, el) => { F.q = el.value; F.sel = 0; F.items = search(F.q); paint(); });
act('fdGo', (d) => goSel(+d.i));
act('fdOpen', () => { closeModal(); openFinder(); });
const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
document.addEventListener('keydown', (e) => {
  if (isOpen()) {
    if (e.isComposing) return; // 한글 조합 중 Enter·화살표는 입력기에 맡긴다
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!F.items.length) return;
      F.sel = (F.sel + (e.key === 'ArrowDown' ? 1 : -1) + F.items.length) % F.items.length; paint(); return;
    }
    if (e.key === 'Enter' && e.target?.id === 'fd-q') { e.preventDefault(); goSel(F.sel); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); closeModal(); }
    return;
  }
  if (document.querySelector('#modal.on')) return; // 다른 창이 열려 있으면 건드리지 않는다
  const ck = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K');
  const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(document.activeElement);
  if (ck || slash) { e.preventDefault(); openFinder(); }
});
// 여는 버튼: PC는 왼쪽 메뉴의 '내전 시작' 옆 작은 아이콘(메뉴 높이를 늘리지 않게 같은 줄에), 휴대폰은 '더보기' 창 아래쪽
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const cta = document.querySelector('#side>a.btn.gold');
if (cta) {
  const row = document.createElement('div'); row.className = 'side-cta';
  cta.before(row); row.append(cta);
  row.insertAdjacentHTML('beforeend', `<button type="button" class="fd-btn" data-a="fdOpen" title="빠른 이동 (${MAC ? '⌘' : 'Ctrl'}+K 또는 /)" aria-label="빠른 이동">${ic('search')}</button>`);
}
moreHooks.push(() => `<button class="btn" data-a="fdOpen">${ic('search')}빠른 이동</button>`);
