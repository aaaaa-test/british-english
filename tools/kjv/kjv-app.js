(() => {
'use strict';
/* Source of kjv.html (do not edit kjv.html by hand: run tools/kjv/assemble.py, see tools/kjv/README.md).
   KJV Words and Bible: every word of the King James Bible (1769 text, public domain), learnt through its verses.
   Data: kjv/bible.json {b:[[name, abbr, korean, [[verse, ...] per chapter]]]} and kjv/words.json {w:{form:[count, level, kind, base?]},
   d:{key:[meaning, korean, note, source]}}. Kinds: c common, a old KJV English, b Bible word, n name. Levels 1-6.
   Progress is kept in this browser (localStorage). */
const $ = s => document.querySelector(s);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}
const put = (n, ...k) => n.replaceChildren(...k.flat(Infinity).filter(x => x != null && x !== false));
const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = d; return s; };
const ICON = {back:'<path d="M15 5l-7 7 7 7"/>', sound:'<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>', next:'<path d="M9 5l7 7-7 7"/>', prev:'<path d="M15 5l-7 7 7 7"/>'};
const escH = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const hl = s => escH(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<mark class="h">$1</mark>');
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const fmt = n => Number(n).toLocaleString('en-GB');
function DAY(d = new Date()) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2600); }
const view = $('#view');

/* ---------- saved progress ---------- */
const LS = 'bwkjv-v1';
const blank = () => ({p:{}, stars:[], trk:[], vstars:[], notes:{}, read:{}, mem:{}, log:{}, sets:[], hist:[], path:{v:0}, tr:{}, set:{pathN:10, pathLv:1, pathWords:'both', pathReview:true, pathPractice:'hints', cardV:1, daily:10, revMax:20, ko:true, size:'normal', voice:true, rate:0.9, hl:'a', wordset:null, plan:'year', planStart:null, from:'all'}});
let S = blank();
try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j) { S = Object.assign(blank(), j); S.set = Object.assign(blank().set, j.set || {}); S.path = Object.assign({v:0}, j.path || {}); if (!S.set.pathV2) { S.set.pathLv = 1; S.set.pathV2 = true; } } } catch (e) {}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast('Could not save: the browser storage is full'); } }, 150); }
const todayLog = () => S.log[DAY()] || (S.log[DAY()] = [0, 0, 0, 0]);
function logAct(kind, ok) { const L = todayLog(); if (kind === 'new') L[0]++; if (kind === 'review') L[1]++; if (ok === true) L[2]++; if (ok === false) L[3]++; save(); }
/* study history: [day, type, first verse, last verse, new words, right, tried]; a = -1 when there is no passage */
const HT = {path:'In Bible order', one:'One verse at a time', read:'Read', verse:'Verse practice', mem:'Memory verses', words:'Word session', quiz:'Word quiz'};
const HTI = {path:'➡️', one:'☝️', read:'📖', verse:'✍️', mem:'🧠', words:'🌱', quiz:'🎯'};
function logStudy(t, a, z, n, r, q) {
  const d = DAY(), h = S.hist, L = h[h.length - 1];
  const same = L && L[0] === d && L[1] === t;
  const sameCh = (i, j) => i >= 0 && j >= 0 && V[i][0] === V[j][0] && V[i][1] === V[j][1];
  if (same && ((a < 0 && L[2] < 0) || (a >= 0 && L[2] >= 0 && (a === L[3] + 1 || (t === 'verse' && sameCh(a, L[2])))))) { if (a >= 0) { L[2] = Math.min(L[2], a); L[3] = Math.max(L[3], z); } L[4] += n || 0; L[5] += r || 0; L[6] += q || 0; }
  else h.push([d, t, a, z, n || 0, r || 0, q || 0]);
  save();
}
function streak() { const has = d => { const L = S.log[d]; return L && L[0] + L[1] + L[2] + L[3] > 0; }; let t = DAY(), s = 0; if (!has(t)) t--; while (has(t)) { s++; t--; } return s; }
function applySize() { document.documentElement.classList.toggle('large', S.set.size === 'large'); }
applySize();

/* ---------- voice ---------- */
const SPEECH = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
let VOICES = [];
function pickVoices() { if (!SPEECH) return; const gb = speechSynthesis.getVoices().filter(v => /^en[-_]GB/i.test(v.lang)); const q = v => /premium|natural|neural/i.test(v.name) ? 0 : /enhanced|google/i.test(v.name) ? 1 : 2; VOICES = gb.sort((a, b) => q(a) - q(b)); }
if (SPEECH) { pickVoices(); try { speechSynthesis.addEventListener('voiceschanged', pickVoices); } catch (e) {} }
function say(text, btn) {
  if (!SPEECH || !text || S.set.voice === false) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/[\[\]]/g, '')); u.lang = 'en-GB'; if (VOICES[0]) u.voice = VOICES[0]; u.rate = S.set.rate || 0.9;
  if (btn) { btn.classList.add('on'); u.onend = u.onerror = () => btn.classList.remove('on'); }
  speechSynthesis.speak(u);
}
const sayBtn = (text, cls) => SPEECH && S.set.voice !== false ? el('button', {class:'say' + (cls ? ' ' + cls : ''), type:'button', 'aria-label':'Listen', title:'Listen', onclick:e => { e.stopPropagation(); say(text, e.currentTarget); }}, svg(ICON.sound)) : null;

/* ---------- the Bible and its words ---------- */
let B = null, WD = null, V = [], CH = [], IDX = new Map(), WL = [], WM = new Map(), LOADED = false, LOADERR = null;
const TOK = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
const keyOf = t => t.replace(/’/g, "'").replace(/'s$/i, '').toLowerCase();
const KIND = {c:'Common word', a:'Old KJV English', b:'Bible word', n:'Name'};
const KINDKO = {c:'일반 단어', a:'KJV 고어', b:'성경 용어', n:'고유명사'};
const LEVEL = ['', 'Level 1 · basic', 'Level 2 · everyday', 'Level 3 · intermediate', 'Level 4 · upper-intermediate', 'Level 5 · advanced', 'Level 6 · rare'];
Promise.all([fetch('kjv/bible.json').then(r => r.json()), fetch('kjv/words.json').then(r => r.json())]).then(([b, w]) => {
  B = b.b; WD = w;
  B.forEach((bk, bi) => bk[3].forEach((vs, ci) => { CH.push([bi, ci, V.length]); vs.forEach((t, vi) => V.push([bi, ci, vi, t])); }));
  const tmp = new Map();
  V.forEach((r, i) => {
    const seen = new Set();
    for (const m of r[3].replace(/[\[\]]/g, '').matchAll(TOK)) { const k = keyOf(m[0]); if (seen.has(k)) continue; seen.add(k); let a = tmp.get(k); if (!a) tmp.set(k, a = []); a.push(i); }
  });
  for (const [k, a] of tmp) IDX.set(k, Int32Array.from(a));
  for (const [k, e] of Object.entries(WD.w)) {
    const vs = IDX.get(k); if (!vs) continue;
    const x = {k, n:e[0], lv:e[1], kind:e[2], base:e[3] || null, first:vs[0], nv:vs.length};
    WL.push(x); WM.set(k, x);
  }
  WL.sort((a, b) => a.first - b.first || b.n - a.n);
  WL.forEach((x, i) => { x.ord = i; });
  if (!S.hist.length && Object.keys(S.read).length) { Object.entries(S.read).forEach(([k, d]) => { const [b, c] = k.split('.').map(Number), ci = chIndex(b, c); if (ci >= 0) S.hist.push([d, 'read', CH[ci][2], CH[ci][2] + B[b][3][c].length - 1, 0, 0, 0]); }); S.hist.sort((a, b) => a[0] - b[0] || a[2] - b[2]); save(); }
  LOADED = true; render();
}).catch(e => { LOADERR = e; render(); });
const refOf = i => { const r = V[i]; return B[r[0]][1] + ' ' + (r[1] + 1) + ':' + (r[2] + 1); };
const refLong = i => { const r = V[i]; return B[r[0]][0] + ' ' + (r[1] + 1) + ':' + (r[2] + 1); };
const vIndex = (b, c, v) => { const ch = CH.find(x => x[0] === b && x[1] === c); return ch ? ch[2] + v : -1; };
const chIndex = (b, c) => CH.findIndex(x => x[0] === b && x[1] === c);
const meaningOf = x => { if (!x) return null; const d = WD.d[x.k] || (x.base && WD.d[x.base]); return d ? {def:d[0], ko:d[1], note:d[2], src:d[3], via:WD.d[x.k] ? null : x.base} : null; };
function oldForm(x) {   // an explanation of old verb endings
  if (x.kind !== 'a' || !x.base) return null;
  if (/eth$/.test(x.k)) return 'The ending -eth is the old form of -s: he ' + x.k + ' = he ' + modern3(x.base) + '.';
  if (/(e)?st$/.test(x.k)) return 'The ending -est (or -st) goes with thou: thou ' + x.k + ' = you ' + x.base + '.';
  return null;
}
const modern3 = b => /(s|x|z|ch|sh|o)$/.test(b) ? b + 'es' : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + 'ies' : b === 'have' ? 'has' : b + 's';
/* ---------- the 1611 first edition ----------
   kjv/bible1611.json has the same books, chapters and verses as the main text. WD.o[form] = [times spelled the same,
   1611 spelling, count, ...]. */
let OLD = null, OLDP = null, REV = null;
function loadOld() { if (OLD) return Promise.resolve(OLD); if (!OLDP) OLDP = fetch('kjv/bible1611.json').then(r => r.json()).then(j => { OLD = j.b; return OLD; }); return OLDP; }
const oldV = i => { const r = V[i]; return (OLD && OLD[r[0]][r[1]][r[2]]) || ''; };
const OTOK = /[A-Za-zþōēāū]+(?:['’][A-Za-z]+)*/g;
const EXP = {'þ':'th', 'ō':'on', 'ē':'en', 'ā':'an', 'ū':'un'};
const norm1611 = w => { w = w.toLowerCase().replace(/’/g, "'"); if (w === 'þ') w = 'the'; w = w.replace(/[þōēāū]/g, c => EXP[c]).replace(/v/g, 'u').replace(/j/g, 'i').replace(/y/g, 'i').replace(/'s$/, '').replace(/(.)\1+/g, '$1').replace(/e$/, ''); return w; };
const oldSp = x => (WD.o && WD.o[x.k]) || null;
const spelledDiff = x => { const o = oldSp(x); if (!o || o.length < 2) return false; let n = 0; for (let j = 2; j < o.length; j += 2) n += o[j]; return n > o[0]; };   // usually printed differently in 1611
function revMap() {   // a 1611 spelling -> the main-text word it stands for most often
  if (REV) return REV; REV = new Map(); const best = new Map();
  for (const [k, o] of Object.entries(WD.o || {})) { if (o[0] && (best.get(k) || 0) < o[0]) { best.set(k, o[0]); REV.set(k, k); } for (let j = 1; j < o.length; j += 2) if ((best.get(o[j]) || 0) < o[j + 1]) { best.set(o[j], o[j + 1]); REV.set(o[j], k); } }
  return REV;
}
function oldNodes(i) {   // the 1611 verse: words tappable (to the word they stand for); wording that differs from the main text marked
  const mw = plainV(i).match(TOK) || [], mainSet = new Set(mw.map(norm1611)), mainKeys = new Set(mw.map(keyOf)), t = oldV(i), out = [], R = revMap(); let last = 0, m;
  OTOK.lastIndex = 0;
  while ((m = OTOK.exec(t))) {
    out.push(t.slice(last, m.index)); last = OTOK.lastIndex;
    const k = R.get(m[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, '')), chg = !mainSet.has(norm1611(m[0])) && !(k && mainKeys.has(k));
    out.push(el('span', {class:(k ? 'kw' : '') + (chg ? ' chg' : ''), 'data-w':k || null, title:k && k !== m[0].toLowerCase() ? 'today: ' + k : null}, m[0]));
  }
  out.push(t.slice(last)); return out;
}
function versesOf(x) { const a = IDX.get(x.k); return a ? Array.from(a) : []; }
function plainV(i) { return V[i][3].replace(/[\[\]]/g, ''); }
function vNodes(i, mark) {   // a verse as nodes: words tappable, italic supplied words, the word being studied marked
  const t = V[i][3], out = []; let last = 0, ital = false;
  const re = /\[|\]|[A-Za-z]+(?:['’][A-Za-z]+)*/g; let m, cur = el('span');
  const flush = s => { if (s) cur.append(s); };
  const push = () => { out.push(cur); cur = el(ital ? 'i' : 'span'); };
  while ((m = re.exec(t))) {
    flush(t.slice(last, m.index)); last = re.lastIndex;
    if (m[0] === '[') { push(); ital = true; cur = el('i'); continue; }
    if (m[0] === ']') { push(); ital = false; cur = el('span'); continue; }
    const k = keyOf(m[0]), x = WM.get(k);
    const cls = 'kw' + (x ? ' ' + x.kind + ' l' + x.lv : '') + (k === mark ? ' hit' : '') + (x && isLearnt(x) ? ' lrn' : '');
    cur.append(el('span', {class:cls, 'data-w':k}, m[0]));
  }
  flush(t.slice(last)); out.push(cur);
  return out;
}
document.addEventListener('click', e => { const w = e.target.closest && e.target.closest('.kw'); if (w && !e.target.closest('.noword')) { e.preventDefault(); openWord(WM.get(w.dataset.w)); } });

/* ---------- learning model (as in the other apps): boxes and review days ---------- */
const INT = [0, 1, 3, 7, 16, 35, 90, 180];
const rec = x => S.p[x.k] || null;
const isLearnt = x => { const r = rec(x); return !!r && r[0] >= 1; };
const isDue = x => { const r = rec(x); return !!r && r[0] >= 1 && r[1] <= DAY(); };
function grade(x, ok, mode) {
  const t = DAY(), r = S.p[x.k] ? S.p[x.k].slice() : [0, t, 0, 0, t, null];
  r[2]++; r[4] = t;
  if (mode === 'practice') { if (!ok) r[3]++; }
  else if (ok) { r[0] = Math.min(7, r[0] + 1); r[1] = t + INT[r[0]]; if (r[5] == null) r[5] = t; }
  else { r[3]++; if (r[0] > 0) r[0] = 1; r[1] = t + 1; }
  S.p[x.k] = r; save();
}
const status = x => { const r = rec(x); return !r ? 0 : r[0] >= 5 ? 3 : r[0] >= 1 ? 2 : 1; };
const STATUS = ['New', 'Seen', 'Learning', 'Mastered'];
const tricky = () => { const man = S.trk.map(k => WM.get(k)).filter(Boolean), seen = new Set(man); return man.concat(WL.filter(x => !seen.has(x) && rec(x) && rec(x)[3] > 0 && rec(x)[0] <= 3)); };
const starred = () => S.stars.map(k => WM.get(k)).filter(Boolean);

/* ---------- word filters: conditions joined by AND or OR, each can be turned into NOT ---------- */
const CONDS = {
  level:{label:'Level', make:() => ({t:'level', v:[2, 3, 4, 5]})},
  kind:{label:'Kind of word', make:() => ({t:'kind', v:['c', 'a', 'b']})},
  freq:{label:'How often in the KJV', make:() => ({t:'freq', min:5, max:100000})},
  range:{label:'Appears in a passage', make:() => ({t:'range', b1:0, c1:0, b2:0, c2:0})},
  first:{label:'First appears in a passage', make:() => ({t:'first', b1:0, c1:0, b2:0, c2:49})},
  status:{label:'My progress', make:() => ({t:'status', v:['new']})},
  meaning:{label:'Has a meaning written', make:() => ({t:'meaning', v:true})},
  len:{label:'Word length', make:() => ({t:'len', min:4, max:30})},
  ed:{label:'Spelled differently in 1611', make:() => ({t:'ed', v:true})},
  text:{label:'Spelling', make:() => ({t:'text', how:'starts', s:'' })}};
const chRange = c => { const a = chIndex(c.b1, Math.min(c.c1, B[c.b1][3].length - 1)), z = chIndex(c.b2, Math.min(c.c2, B[c.b2][3].length - 1)); const lo = CH[Math.min(a, z)][2], hiCh = CH[Math.max(a, z)]; return [lo, hiCh[2] + B[hiCh[0]][3][hiCh[1]].length - 1]; };
function test(c, x) {
  switch (c.t) {
    case 'level': return c.v.includes(x.lv) && x.kind !== 'n';
    case 'kind': return c.v.includes(x.kind);
    case 'freq': return x.n >= (+c.min || 0) && x.n <= (+c.max || 1e9);
    case 'range': { const [lo, hi] = c._r || (c._r = chRange(c)); const a = IDX.get(x.k); let l = 0, h = a.length; while (l < h) { const m = (l + h) >> 1; if (a[m] < lo) l = m + 1; else h = m; } return l < a.length && a[l] <= hi; }
    case 'first': { const [lo, hi] = c._r || (c._r = chRange(c)); return x.first >= lo && x.first <= hi; }
    case 'status': { const s = status(x); return c.v.some(v => v === 'new' ? s === 0 : v === 'learning' ? s === 1 || s === 2 : v === 'mastered' ? s === 3 : v === 'starred' ? S.stars.includes(x.k) : v === 'tricky' ? (S.trk.includes(x.k) || (rec(x) && rec(x)[3] > 0)) : v === 'due' ? isDue(x) : false); }
    case 'meaning': return !!meaningOf(x) === !!c.v;
    case 'ed': return spelledDiff(x) === !!c.v;
    case 'len': return x.k.length >= (+c.min || 0) && x.k.length <= (+c.max || 99);
    case 'text': { const s = String(c.s || '').toLowerCase().trim(); if (!s) return true; return c.how === 'starts' ? x.k.startsWith(s) : c.how === 'ends' ? x.k.endsWith(s) : x.k.includes(s); }
  }
  return true;
}
function runFilter(F) {
  const cs = (F.c || []).filter(c => !c.off); cs.forEach(c => { delete c._r; });
  let out = !cs.length ? WL.slice() : WL.filter(x => F.mode === 'or' ? cs.some(c => !!test(c, x) !== !!c.not) : cs.every(c => !!test(c, x) !== !!c.not));
  const by = {bible:(a, b) => a.ord - b.ord, freq:(a, b) => b.n - a.n, rare:(a, b) => a.n - b.n, az:(a, b) => a.k.localeCompare(b.k), level:(a, b) => a.lv - b.lv || a.ord - b.ord}[F.sort || 'bible'];
  return out.sort(by);
}
const PRESETS = [
  ['Old KJV English', 'thou, hath, saith, begat …', {mode:'and', sort:'freq', c:[{t:'kind', v:['a']}]}],
  ['Bible words', 'covenant, tabernacle, atonement …', {mode:'and', sort:'freq', c:[{t:'kind', v:['b']}]}],
  ['The 500 most common (no names)', 'the core of the KJV', {mode:'and', sort:'freq', c:[{t:'kind', v:['c', 'a', 'b']}, {t:'freq', min:120, max:100000}]}],
  ['Advanced words', 'levels 5 and 6, used 5 times or more', {mode:'and', sort:'bible', c:[{t:'level', v:[5, 6]}, {t:'freq', min:5, max:100000}]}],
  ['In Bible order: Genesis', 'every word the first time it appears', {mode:'and', sort:'bible', c:[{t:'first', b1:0, c1:0, b2:0, c2:49}, {t:'kind', v:['c', 'a', 'b']}]}],
  ['New Testament words', 'words that first appear in Matthew–Revelation', {mode:'and', sort:'bible', c:[{t:'first', b1:39, c1:0, b2:65, c2:21}, {t:'kind', v:['c', 'a', 'b']}]}],
  ['Names', 'people and places', {mode:'and', sort:'freq', c:[{t:'kind', v:['n']}]}],
  ['Spelled differently in 1611', 'vnto, haue, sonne, citie …', {mode:'and', sort:'freq', c:[{t:'ed', v:true}, {t:'kind', v:['c', 'a', 'b']}]}],
  ['Old English OR Bible words used 50+ times', 'an OR filter example', {mode:'or', sort:'freq', c:[{t:'kind', v:['a']}, {t:'freq', min:50, max:100000}]}]];
const defaultSet = () => ({mode:'and', sort:'bible', c:[{t:'kind', v:['c', 'a', 'b']}, {t:'level', v:[3, 4, 5, 6]}], name:'Bible order, levels 3–6'});
const curSet = () => S.set.wordset || defaultSet();
let WF = JSON.parse(JSON.stringify(curSet()));
const describeSet = F => F.name || ((F.c || []).filter(c => !c.off).map(c => (c.not ? 'NOT ' : '') + CONDS[c.t].label).join(F.mode === 'or' ? ' OR ' : ' AND ') || 'All words');

/* ---------- overlay screens with Back ---------- */
const OV = {open:false, stack:[], onreturn:null};
function openOv(title) {
  const ov = $('#ov');
  if (OV.open) { const frag = document.createDocumentFragment(); while (ov.firstChild) frag.append(ov.firstChild); OV.stack.push({frag, top:ov.scrollTop, onreturn:OV.onreturn}); }
  else { ov.hidden = false; OV.open = true; document.documentElement.classList.add('locked'); try { history.pushState({kjv:1}, ''); } catch (e) {} }
  OV.onreturn = null;
  const bar = el('div', {class:'ovbar'}, el('button', {class:'x', type:'button', 'aria-label':'Back', title:'Back', onclick:() => closeOv()}, svg(ICON.back)), el('div', {class:'ttl'}, title));
  const body = el('div', {class:'ovbody'});
  ov.append(bar, body); ov.scrollTop = 0;
  return {body, setTitle:t => { bar.querySelector('.ttl').textContent = t; }, onReturn:f => { OV.onreturn = f; }};
}
function closeOv() {
  if (!OV.open) return;
  const ov = $('#ov'), prev = OV.stack.pop(); put(ov);
  if (prev) { ov.append(prev.frag); OV.onreturn = prev.onreturn; if (OV.onreturn) OV.onreturn(); ov.scrollTop = prev.top; return; }
  ov.hidden = true; OV.open = false; document.documentElement.classList.remove('locked'); render();
}
window.addEventListener('popstate', () => { if (OV.open) { closeOv(); if (OV.open) try { history.pushState({kjv:1}, ''); } catch (e) {} } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && OV.open) closeOv();
  if (!OV.open || e.altKey || e.ctrlKey || e.metaKey) return;
  const a = document.activeElement; if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'button'))) return;
  if (e.key === 'Enter') { if (a && a.tagName === 'BUTTON') return; const b = [...document.querySelectorAll('#ov .fb .btn.primary, #ov [data-enter]')].find(b => b.offsetParent); if (b) { e.preventDefault(); b.click(); } }
  else if (/^[1-9]$/.test(e.key)) { const b = [...document.querySelectorAll('#ov .opts button.opt')].filter(b => !b.disabled && b.offsetParent)[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
});

/* ---------- a word ---------- */
const lvBadge = x => el('span', {class:'lvb k-' + x.kind, title:x.kind === 'n' ? 'Name' : LEVEL[x.lv]}, x.kind === 'n' ? 'N' : x.kind === 'a' ? 'A' + x.lv : x.kind === 'b' ? 'B' + x.lv : 'L' + x.lv);
function wordRow(x, list) {
  const m = meaningOf(x);
  return el('button', {class:'wr', type:'button', onclick:() => openWord(x, list)}, lvBadge(x),
    el('span', {style:'min-width:0'}, el('div', {class:'w'}, x.k), el('div', {class:'m'}, m ? (S.set.ko && m.ko ? m.ko + ' · ' : '') + m.def : 'First: ' + refOf(x.first))),
    el('span', {class:'n num'}, fmt(x.n) + '×'));
}
function bookBars(x) {
  const c = new Map(); for (const i of IDX.get(x.k)) c.set(V[i][0], (c.get(V[i][0]) || 0) + 1);
  const top = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top.length ? top[0][1] : 1;
  let ot = 0, nt = 0; for (const [b, n] of c) { if (b < 39) ot += n; else nt += n; }
  return el('div', {class:'kbars'}, el('p', {class:'tip', style:'margin:0'}, 'Old Testament ' + fmt(ot) + ' verses · New Testament ' + fmt(nt) + ' verses · in ' + c.size + ' of 66 books'),
    top.map(([b, n]) => el('div', null, el('span', null, B[b][0]), el('i', {style:'width:' + Math.max(4, Math.round(n / mx * 100)) + '%'}), el('span', {class:'num'}, n))));
}
function openWord(x, list) {
  if (!x) return;
  const o = openOv(x.k);
  const draw = (x, more = 12) => {
    o.setTitle(x.k);
    const m = meaningOf(x), vs = versesOf(x), forms = WL.filter(y => y.base === x.k || (x.base && (y.base === x.base || y.k === x.base)) && y !== x).slice(0, 12);
    const idx = list ? list.indexOf(x) : -1;
    const star = el('button', {class:'btn small' + (S.stars.includes(x.k) ? ' on' : ''), type:'button', onclick:() => { const i = S.stars.indexOf(x.k); if (i >= 0) S.stars.splice(i, 1); else S.stars.unshift(x.k); save(); draw(x, more); }}, S.stars.includes(x.k) ? '★ Starred' : '☆ Star');
    const trk = el('button', {class:'btn small' + (S.trk.includes(x.k) ? ' on' : ''), type:'button', onclick:() => { const i = S.trk.indexOf(x.k); if (i >= 0) S.trk.splice(i, 1); else S.trk.unshift(x.k); save(); draw(x, more); }}, S.trk.includes(x.k) ? '🧩 In Tricky' : '🧩 Tricky');
    put(o.body,
      el('article', {class:'card', lang:'en-GB'},
        el('div', {class:'head'}, el('h2', {class:'hw' + (x.k.length > 12 ? ' sm' : '')}, x.k), sayBtn(x.k)),
        el('div', {class:'meta'}, lvBadge(x), el('span', {class:'chip'}, KIND[x.kind]), S.set.ko ? el('span', {class:'chip ko'}, KINDKO[x.kind]) : null, el('span', null, x.kind === 'n' ? '' : LEVEL[x.lv])),
        m ? el('div', {class:'line def'}, el('p', null, m.via ? el('span', {class:'muted'}, 'from ' + m.via + ': ') : null, m.def)) : el('div', {class:'line def'}, el('p', {class:'muted'}, x.kind === 'n' ? 'A name of a person or a place. Read the verses to see who or what it is.' : 'No meaning is written for this word yet. The verses below show how it is used.')),
        m && m.ko && S.set.ko ? el('div', {class:'line ko', lang:'ko'}, el('p', null, m.ko)) : null,
        oldForm(x) ? el('p', {class:'tip'}, oldForm(x)) : null,
        m && m.note ? el('div', {class:'box gb'}, el('p', {class:'eyebrow'}, 'KJV English'), el('p', null, m.note)) : null,
        el('p', {class:'tip'}, fmt(x.n) + ' times in ' + fmt(x.nv) + ' verses · first in ', el('button', {class:'linkbtn', type:'button', onclick:() => openChapter(V[x.first][0], V[x.first][1], x.first)}, refLong(x.first)), ' · status: ' + STATUS[status(x)])),
      el('div', {class:'row', style:'flex-wrap:wrap;gap:8px'}, star, trk, el('button', {class:'btn small', type:'button', onclick:() => startQuiz([x], 'This word', {kinds:['cloze', 'meaning'], n:4})}, 'Practise it')),
      forms.length ? el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Other forms in the KJV'), el('div', {class:'chk'}, forms.map(y => el('button', {class:'btn small', type:'button', onclick:() => draw(y)}, y.k + ' · ' + y.n)))) : null,
      oldSp(x) ? el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'In the 1611 first edition'), (() => { const o = oldSp(x), parts = []; for (let j = 1; j < o.length; j += 2) parts.push(el('b', {style:'font-family:var(--f-read);font-weight:400;font-size:19px;color:var(--word)'}, o[j]), ' ' + fmt(o[j + 1]) + '×  '); return el('p', {style:'margin:0'}, parts.length ? ['Printed as ', parts, o[0] ? '· as today ' + fmt(o[0]) + '×' : ''] : 'Spelled as today (' + fmt(o[0]) + '×).'); })(),
        spelledDiff(x) ? el('p', {class:'tip'}, 'In 1611 English spelling was not yet fixed. The 1769 revision made the spelling regular, as it is today.') : null,
        el('button', {class:'btn small', type:'button', onclick:e => { const btn = e.currentTarget; btn.disabled = true; loadOld().then(() => { const i = x.first; btn.replaceWith(el('div', {class:'vrow'}, el('span', {class:'ref'}, refLong(i) + ' · 1769'), el('p', {class:'verse noword'}, vNodes(i, x.k)), el('span', {class:'ref'}, '1611'), el('p', {class:'verse old noword'}, oldNodes(i)))); }); }}, 'Compare its first verse with 1611')) : null,
      el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Where it appears'), bookBars(x)),
      el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Verses (' + fmt(vs.length) + ')'),
        el('div', {style:'display:grid;gap:8px'}, vs.slice(0, more).map(i => el('div', {class:'vrow'}, el('span', {class:'ref'}, refLong(i)), el('p', {class:'verse noword'}, vNodes(i, x.k)), el('div', {class:'row', style:'gap:6px'}, el('button', {class:'btn small', type:'button', onclick:() => openChapter(V[i][0], V[i][1], i)}, 'Open the chapter'), sayBtn(plainV(i), 'sm'))))),
        vs.length > more ? el('button', {class:'btn', type:'button', onclick:() => draw(x, more + 30)}, 'Show more verses') : null),
      list && list.length > 1 ? el('div', {class:'row'}, el('button', {class:'btn', type:'button', disabled:idx <= 0, onclick:() => draw(list[idx - 1])}, svg(ICON.prev), 'Previous'), el('button', {class:'btn', type:'button', disabled:idx >= list.length - 1, onclick:() => draw(list[idx + 1])}, 'Next', svg(ICON.next))) : null);
    $('#ov').scrollTop = 0;
  };
  draw(x);
}

/* ---------- questions made from verses ----------
   cloze: a verse with the word missing; meaning: what the word means in this verse; modern: an old word and its modern English;
   order: put a short verse in order; recall: a verse with several words missing. */
const ANSWER_KEY = 'bw-answer';
const answerMode = () => { try { const v = localStorage.getItem(ANSWER_KEY); return v === 'see' || v === 'type' ? v : 'choose'; } catch (e) { return 'choose'; } };
const normA = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
function goodVerse(x) {   // a short verse that shows the word, chosen at random among the shorter ones
  const vs = versesOf(x).map(i => [i, plainV(i).split(' ').length]).filter(([, n]) => n >= 5).sort((a, b) => a[1] - b[1]);
  const pool = vs.slice(0, Math.max(3, Math.ceil(vs.length / 3)));
  return pool.length ? pool[rnd(pool.length)][0] : versesOf(x)[0];
}
function distractors(x, n, pred) {
  const near = WL.filter(y => y !== x && y.kind === x.kind && Math.abs(y.lv - x.lv) <= 1 && y.k.slice(-2) === x.k.slice(-2) && (!pred || pred(y)));
  const wide = WL.filter(y => y !== x && y.kind !== 'n' && (x.kind === 'n' ? y.kind === 'n' : true) && (!pred || pred(y)) && Math.abs(y.k.length - x.k.length) <= 3);
  const out = [], seen = new Set([x.k, x.base].filter(Boolean));
  for (const y of shuffle(near).concat(shuffle(wide).slice(0, 200))) { if (seen.has(y.k) || seen.has(y.base)) continue; seen.add(y.k); out.push(y); if (out.length >= n) break; }
  return out;
}
function makeQ(x, kind) {
  if (kind === 'meaning') {
    const m = meaningOf(x); if (!m) return null;
    const o = distractors(x, 12, y => !!meaningOf(y)).map(y => meaningOf(y)).filter(d => d.def !== m.def);
    const opts = [...new Set([m.def, ...o.map(d => d.def)])].slice(0, 4); if (opts.length < 3) return null;
    const vi = goodVerse(x);
    return {k:'mc', x, vi, instr:'What does "' + x.k + '" mean in this verse?', o:opts, a:0, long:true};
  }
  if (kind === 'modern') {
    const m = meaningOf(x); if (x.kind !== 'a' || !m || m.via || m.src !== 'KJV') return null;
    const pool = WL.filter(y => y !== x && y.kind === 'a' && meaningOf(y) && !meaningOf(y).via && meaningOf(y).def !== m.def);
    const opts = [m.def, ...sample(pool, 6).map(y => meaningOf(y).def)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    return {k:'mc', x, vi:goodVerse(x), instr:'In modern English, "' + x.k + '" means …', o:opts, a:0, long:true};
  }
  if (kind === 'sp1611') {
    const o = oldSp(x); if (!o || o.length < 2) return null;
    const ds = distractors(x, 3); if (ds.length < 2) return null;
    return {k:'mc', x, vi:x.first, sp:o[1], instr:'In 1611 this word was printed "' + o[1] + '". How is it spelled today?', o:[x.k, ...ds.map(y => y.k)], a:0};
  }
  if (kind === 'cloze') {
    const vi = goodVerse(x); if (vi == null) return null;
    const o = distractors(x, 3); if (o.length < 2) return null;
    return {k:'cloze', x, vi, instr:'Which word completes the verse?', o:[x.k, ...o.map(y => y.k)], a:0};
  }
  return null;
}
function clozeNodes(vi, k, fill) {
  const t = plainV(vi); let done = false;
  return t.split(/([A-Za-z]+(?:['’][A-Za-z]+)*)/).map(p => { if (!done && keyOf(p) === k) { done = true; return el('span', {class:'gap' + (fill ? ' tgt' : '')}, fill ? p : '_____'); } return p; });
}
function startQuiz(words, title, opt) {
  opt = opt || {};
  const kinds = opt.kinds || ['cloze', 'meaning', 'modern'];
  const qs = [];
  shuffle(words).forEach((x, i) => { for (let j = 0; j < kinds.length; j++) { const q = makeQ(x, kinds[(i + j) % kinds.length]); if (q) { q.mode = opt.mode || (isDue(x) ? 'review' : 'practice'); qs.push(q); break; } } });
  if (!qs.length) { toast('No questions could be made from these words'); return; }
  runSession(openOv(title), title, qs.slice(0, opt.n || 20).map(q => ({q})), Object.assign({hist:'quiz'}, opt));
}
/* a session: steps are {learn:x} (a new-word card, checked a little later) or {q} (a question) */
function runSession(o, title, steps, opt) {
  opt = opt || {};
  const st = {q:steps.slice(), done:0, right:0, total:steps.filter(s => s.q).length, pend:[], wrong:[], learnt:0};
  const bar = () => el('div', {class:'pbar teal'}, el('i', {style:'width:' + Math.round(st.done / Math.max(1, st.total) * 100) + '%'}));
  function next() {
    if (st.pend.length && (st.pend.length >= 5 || !st.q.length || !st.q[0].learn)) {
      const ch = shuffle(st.pend.splice(0)).map(x => { const q = makeQ(x, 'cloze') || makeQ(x, 'meaning'); if (q) q.mode = 'check'; return q ? {q} : null; }).filter(Boolean);
      st.q.unshift(...ch); st.total += ch.length;
    }
    const s = st.q.shift(); $('#ov').scrollTop = 0;
    if (!s) return end();
    if (s.learn) return card(s.learn);
    ask(s.q);
  }
  function card(x) {
    put(o.body, bar(), el('p', {class:'eyebrow', style:'text-align:center'}, 'New word'), wordCard(x, goodVerse(x)),
      el('button', {class:'btn primary big', type:'button', 'data-enter':'', onclick:() => { st.pend.push(x); next(); }}, 'Got it'));
  }
  function ask(q) {
    const am = q.k === 'cloze' ? answerMode() : 'choose';
    const fb = el('div'); let answered = false;
    const prompt = q.k === 'cloze' ? el('p', {class:'qtext ex', lang:'en-GB'}, clozeNodes(q.vi, q.x.k)) : q.sp ? el('p', {class:'qtext big', lang:'en-GB', style:'text-align:center'}, q.sp) : el('div', null, el('p', {class:'qtext big', lang:'en-GB'}, q.x.k), q.vi != null ? el('p', {class:'verse noword', style:'text-align:center'}, vNodes(q.vi, q.x.k)) : null);
    const finish = (ok, given) => {
      if (answered) return; answered = true;
      st.done++; if (ok) st.right++; else st.wrong.push(q);
      const x = q.x, wasL = isLearnt(x);
      if (q.mode === 'check') { if (ok) { if (!isLearnt(x)) { grade(x, true, 'check'); st.learnt++; logAct('new', true); } else logAct(null, true); } else { grade(x, false, 'check'); logAct(null, false); st.q.push({learn:x}); } }
      else if (q.mode === 'review') { grade(x, ok, 'review'); logAct('review', ok); }
      else { grade(x, ok, 'practice'); logAct(null, ok); }
      logStudy(opt.hist || 'words', -1, -1, !wasL && isLearnt(x) ? 1 : 0, ok ? 1 : 0, 1);
      const m = meaningOf(x);
      if (q.k === 'cloze') put(prompt, clozeNodes(q.vi, x.k, true));
      put(fb, el('section', {class:'fb ' + (ok ? 'ok' : 'no')}, el('h3', null, ok ? ['Well done!', 'Spot on!', 'Lovely!', 'Brilliant!'][rnd(4)] : 'Not quite'),
        ok ? null : el('p', {class:'ans'}, 'The answer is: ' + (q.k === 'cloze' ? x.k : q.o[q.a])),
        el('p', {class:'why'}, el('span', {class:'ref'}, refLong(q.vi)), ' '),
        m ? el('p', {class:'why', style:'color:var(--def)'}, x.k + ': ' + m.def) : null,
        m && m.ko && S.set.ko ? el('p', {class:'why ko', lang:'ko'}, x.k + ' · ' + m.ko) : null,
        el('div', {class:'row'}, el('button', {class:'btn small', type:'button', onclick:() => openWord(x)}, 'About this word'), sayBtn(plainV(q.vi), 'sm'))),
        el('div', {class:'row'}, el('button', {class:'btn primary big', type:'button', onclick:next}, st.q.length ? 'Next' : 'See my score')));
      const nb = fb.querySelector('.btn.primary'); if (nb) nb.focus({preventScroll:true});
    };
    let body;
    if (am !== 'choose') {
      const order = shuffle(q.o.map((t, i) => ({t, i})));
      const chips = am === 'see' ? el('div', {class:'opts see'}, order.map(({t}) => el('div', {class:'opt', lang:'en-GB'}, t))) : null;
      const inp = el('input', {class:'w', type:'text', 'aria-label':'Type the missing word', placeholder:'Type the missing word', autocapitalize:'off', autocorrect:'off', spellcheck:'false', autocomplete:'off', enterkeyhint:'done'});
      body = [chips, el('form', {onsubmit:e => { e.preventDefault(); const v = inp.value.trim(); if (!v || answered) return; inp.disabled = true; finish(normA(v) === normA(q.o[q.a]), v); }}, inp, el('button', {class:'btn teal big', type:'submit', style:'margin-top:10px'}, 'Check'))];
      setTimeout(() => inp.focus({preventScroll:true}), 60);
    } else {
      const order = shuffle(q.o.map((t, i) => ({t, i})));
      const opts = el('div', {class:'opts' + (q.long ? ' long' : '')}, order.map(({t, i}) => el('button', {class:'opt', type:'button', lang:'en-GB', onclick:e => {
        if (answered) return; opts.querySelectorAll('.opt').forEach(b => { b.disabled = true; }); e.currentTarget.classList.add(i === q.a ? 'right' : 'wrong');
        opts.querySelectorAll('.opt')[order.findIndex(z => z.i === q.a)].classList.add('right'); finish(i === q.a, t); }}, t)));
      body = [opts];
    }
    put(o.body, el('div', {class:'qhead'}, el('div', {class:'qcount'}, el('span', null, title), el('span', {class:'num'}, Math.min(st.done + 1, st.total) + ' of ' + st.total)), bar(), el('p', {class:'qinstr'}, q.instr)), prompt, body, fb);
  }
  function end() {
    const score = st.done ? Math.round(st.right / st.done * 100) : 100;
    if (opt.onEnd) opt.onEnd(score);
    put(o.body, el('div', {class:'sum'}, el('p', {class:'eyebrow'}, title), el('div', {class:'big num'}, st.done ? score + '%' : '✓'),
      el('p', {style:'margin:0'}, st.done ? st.right + ' of ' + st.done + ' right.' : 'Done!'), st.learnt ? el('p', {class:'muted', style:'margin:0'}, st.learnt + ' new words learnt') : null,
      st.wrong.length ? el('div', {class:'miss'}, el('p', {class:'eyebrow'}, 'To look at again'), st.wrong.slice(0, 20).map(q => el('div', {class:'m'}, el('div', null, q.x.k), el('div', {class:'a'}, refLong(q.vi))))) : null,
      el('button', {class:'btn primary big', type:'button', onclick:closeOv}, 'Finish')));
  }
  next();
}

/* ---------- verse study: blanks, word order, first letters ---------- */
function verseQs(vis, kind) { return vis.map(vi => ({vi, kind:kind === 'mix' ? ['blanks', 'order', 'letters'][rnd(3)] : kind})); }
function runVerses(title, items, onEach) {
  const o = openOv(title); let i = 0, right = 0;
  const step = () => {
    if (i >= items.length) { put(o.body, el('div', {class:'sum'}, el('p', {class:'eyebrow'}, title), el('div', {class:'big num'}, right + '/' + items.length), el('p', {style:'margin:0'}, 'verses right first time.'), el('button', {class:'btn primary big', type:'button', onclick:closeOv}, 'Finish'))); return; }
    const it = items[i], vi = it.vi, text = plainV(vi);
    const head = el('div', {class:'qhead'}, el('div', {class:'qcount'}, el('span', null, refLong(vi)), el('span', {class:'num'}, (i + 1) + ' of ' + items.length)), el('div', {class:'pbar teal'}, el('i', {style:'width:' + Math.round(i / items.length * 100) + '%'})));
    const res = el('div');
    const done = ok => { if (ok) right++; if (onEach) onEach(vi, ok); if (onEach === memGrade) logStudy('mem', -1, -1, 0, ok ? 1 : 0, 1); else logStudy('verse', vi, vi, 0, ok ? 1 : 0, 1); put(res, el('section', {class:'fb ' + (ok ? 'ok' : 'no')}, el('h3', null, ok ? 'Well done!' : 'Here is the verse'), el('p', {class:'verse noword'}, vNodes(vi)), el('div', {class:'row'}, sayBtn(text, 'sm'))), el('button', {class:'btn primary big', type:'button', onclick:() => { i++; step(); }}, i < items.length - 1 ? 'Next verse' : 'See my score')); const nb = res.querySelector('.btn.primary'); if (nb) nb.focus({preventScroll:true}); };
    put(o.body, head, verseEx(vi, it.kind, done), res);
    $('#ov').scrollTop = 0;
  };
  step();
}
/* one verse exercise: blanks, word order or first letters; done(ok) is called once */
function verseEx(vi, kind, done, opt) {
  opt = opt || {};
  const text = plainV(vi), words = text.split(' ');
  if (kind === 'order' && words.length > 22) kind = 'blanks';
  if (kind === 'blanks' && !opt.hints && !words.some(w => { const x = WM.get(keyOf(w.replace(/[^A-Za-z'’]/g, ''))); return x && x.lv >= 2 && w.replace(/[^A-Za-z]/g, '').length > 2; })) kind = words.length <= 22 ? 'order' : 'letters';
    if (kind === 'order') {
      const tiles = shuffle(words.map((w, k) => ({w, k}))), chosen = [];
      const line = el('div', {class:'oline'}), bank = el('div', {class:'otiles'});
      const draw = () => { put(line, chosen.map((t, j) => el('button', {class:'otile', type:'button', onclick:() => { chosen.splice(j, 1); draw(); }}, t.w))); put(bank, tiles.map(t => el('button', {class:'otile', type:'button', disabled:chosen.includes(t), onclick:() => { chosen.push(t); draw(); }}, t.w))); };
      draw();
      return [el('p', {class:'qinstr'}, 'Put the verse in order. Tap a word to move it.'), line, bank, el('button', {class:'btn teal big', type:'button', onclick:e => { if (chosen.length !== words.length) { toast('Use every word'); return; } e.currentTarget.disabled = true; done(chosen.map(t => t.w).join(' ') === text); }}, 'Check')];
    } else if (kind === 'letters') {
      const hint = words.map(w => w.replace(/[A-Za-z]/g, (c, j) => j === 0 ? c : '_')).join(' ');
      const ta = el('textarea', {class:'memo', rows:'4', 'aria-label':'Type the verse', autocapitalize:'sentences', autocorrect:'off', spellcheck:'false'});
      setTimeout(() => ta.focus({preventScroll:true}), 60);
      return [el('p', {class:'qinstr'}, 'Type the whole verse. The first letter of each word is shown.'), el('p', {class:'lhint'}, hint), ta,
        el('button', {class:'btn teal big', type:'button', onclick:e => { const a = normA(ta.value).split(' '), b = normA(text).split(' '); let same = 0; b.forEach((w, j) => { if (a[j] === w) same++; }); e.currentTarget.disabled = true; done(same / b.length >= 0.9); }}, 'Check')];
    } else {
      const cand0 = words.map((w, k) => ({w, k, x:WM.get(keyOf(w.replace(/[^A-Za-z'’]/g, '')))})).filter(t => t.x && t.x.lv >= 2 && t.w.replace(/[^A-Za-z]/g, '').length > 2), cand = opt.hints ? words.map((w, k) => ({w, k, x:WM.get(keyOf(w.replace(/[^A-Za-z'’]/g, '')))})).filter(t => t.x && t.x.kind !== 'n' && meaningOf(t.x) && t.w.replace(/[^A-Za-z]/g, '').length > 2).sort((a, b) => (hintOf(b.x, true).en ? 1 : 0) - (hintOf(a.x, true).en ? 1 : 0) || b.x.lv - a.x.lv).slice(0, 6) : cand0;
      const hide = new Set(sample(cand, Math.min(3, Math.max(opt.hints ? 2 : 1, Math.round(words.length / (opt.hints ? 6 : 8))))).map(t => t.k));
      const inputs = [];
      const sent = el('p', {class:'qtext ex', style:'line-height:2.1'}, words.map((w, k) => { if (!hide.has(k)) return w + ' '; const core = w.replace(/[^A-Za-z'’]/g, ''); const inp = el('input', {class:'inl', type:'text', size:Math.max(4, core.length), 'aria-label':'Missing word', autocapitalize:'off', autocorrect:'off', spellcheck:'false', autocomplete:'off'}); inputs.push([inp, core]); if (opt.hints) inp.placeholder = String(inputs.length); return [inp, w.slice(w.indexOf(core) + core.length) + ' ']; }));
      if (inputs[0]) setTimeout(() => inputs[0][0].focus({preventScroll:true}), 60);
      const hl = opt.hints ? el('ol', {class:'bhints'}, inputs.map(([, core]) => { const x = WM.get(keyOf(core)), h = x && hintOf(x); return el('li', null, h && h.en ? h.en : '', h && h.ko ? [h.en ? ' · ' : '', el('span', {class:'ko'}, h.ko)] : null, el('span', {class:'muted'}, (h && (h.en || h.ko) ? ' · ' : '') + 'starts with “' + core[0].toLowerCase() + '”, ' + core.length + ' letters')); })) : null;
      return [el('p', {class:'qinstr'}, opt.hints ? 'Write the missing words. Each one has a hint below.' : 'Write the missing words.'), sent, hl, el('button', {class:'btn teal big', type:'button', onclick:e => { const ok = inputs.every(([inp, w]) => normA(inp.value) === normA(w)); inputs.forEach(([inp, w]) => { inp.disabled = true; inp.style.color = normA(inp.value) === normA(w) ? 'var(--good)' : 'var(--bad)'; }); e.currentTarget.disabled = true; done(ok); }}, 'Check')];
    }
}
function memGrade(vi, ok) { const t = DAY(), r = S.mem[vi] || [0, t]; if (ok) { r[0] = Math.min(7, r[0] + 1); r[1] = t + INT[r[0]]; } else { r[0] = Math.max(0, r[0] - 1); r[1] = t + 1; } S.mem[vi] = r; logAct(ok ? 'review' : null, ok); save(); }

/* ---------- the Bible in order: a passage a day, or one verse at a time ---------- */
const fmtDay = (d, long) => new Date(d * 864e5).toLocaleDateString('en-GB', long ? {timeZone:'UTC', weekday:'short', day:'numeric', month:'short', year:'numeric'} : {timeZone:'UTC', day:'numeric', month:'short'});
function rangeText(a, z) {
  if (a < 0) return '';
  const A = V[a], Z = V[z], nv = (b, c) => B[b][3][c].length;
  if (a === z) return refLong(a);
  if (A[0] !== Z[0]) return refLong(a) + ' – ' + refLong(z);
  const whole = A[2] === 0 && Z[2] === nv(Z[0], Z[1]) - 1;
  if (A[1] !== Z[1]) return B[A[0]][0] + ' ' + (whole ? (A[1] + 1) + '–' + (Z[1] + 1) : (A[1] + 1) + ':' + (A[2] + 1) + '–' + (Z[1] + 1) + ':' + (Z[2] + 1));
  return B[A[0]][0] + ' ' + (A[1] + 1) + (whole ? '' : ':' + (A[2] + 1) + '–' + (Z[2] + 1));
}
function histDetail(h) {
  const nv = h[2] >= 0 ? h[3] - h[2] + 1 : 0, bits = [];
  if (h[1] === 'path' || h[1] === 'one') { bits.push(nv + (nv === 1 ? ' verse' : ' verses')); if (h[4]) bits.push(h[4] + ' new words'); if (h[6]) bits.push(h[5] + '/' + h[6] + ' right'); }
  else if (h[1] === 'read') bits.push(nv + ' verses read');
  else if (h[1] === 'verse' || h[1] === 'mem') bits.push(h[6] + ' tried · ' + h[5] + ' right');
  else { if (h[4]) bits.push(h[4] + ' new words'); bits.push(h[5] + '/' + h[6] + ' right'); }
  return bits.join(' · ');
}
function verseWords(vi) {   // the words of a verse in order, once each: {x, name}
  const out = new Map();
  for (const m of plainV(vi).matchAll(TOK)) { const x = WM.get(keyOf(m[0])); if (x && !out.has(x.k)) out.set(x.k, x); }
  return [...out.values()];
}
function pathWords(vi) {   // the words to learn in this verse: every word (or those from the chosen level) not learnt before; names are only shown
  const lv = S.set.pathLv || 1;
  return verseWords(vi).filter(x => x.kind !== 'n' && !isLearnt(x) && meaningOf(x) && (lv <= 1 || x.lv >= lv || ((x.kind === 'a' || x.kind === 'b') && x.lv >= 2)));
}
const firstKo = s => String(s || '').split(/[,;]/)[0].trim();
function koOf(x) {   // a short Korean gloss for a word, the KJV sense first
  if (!x) return '';
  if (x.kind === 'n') return '(이름)';
  const m = meaningOf(x); if (!m) return '';
  if (m.src === 'KJV+') { const nt = m.note || '', i0 = nt.indexOf('In the KJV it can also mean: ');
    if (i0 >= 0) { let dep = 0, st = -1; for (let j = i0; j < nt.length; j++) { if (nt[j] === '(') { if (!dep) st = j + 1; dep++; } else if (nt[j] === ')' && dep) { dep--; if (!dep) { const ko = nt.slice(st, j); if (/[\uac00-\ud7a3]/.test(ko)) return firstKo(ko); } } } } }
  return firstKo(m.ko);
}
const glossRow = x => { const m = meaningOf(x), of = oldForm(x); return el('div', {class:'gl', role:'button', tabindex:'0', onclick:() => openWord(x)}, el('b', null, x.k), el('span', null, m.via ? el('span', {class:'muted'}, 'from ' + m.via + ': ') : null, m.def, S.set.ko && m.ko ? el('span', {class:'ko'}, ' · ' + m.ko) : null, m.src === 'KJV+' && m.note ? el('span', {class:'tip', style:'display:block;margin:2px 0 0'}, m.note) : null, of ? el('span', {class:'tip', style:'display:block;margin:2px 0 0'}, of) : null)); };
/* the verse in today's English: old forms changed word by word (a guide made by the app, not a translation) */
const MODW = {thou:'you', thee:'you', ye:'you', thy:'your', hath:'has', hast:'have', doth:'does', dost:'do', shalt:'shall', saith:'says', spake:'spoke', unto:'to', wast:'were', wert:'were', canst:'can', couldest:'could', mayest:'may', mightest:'might', shouldest:'should', wouldest:'would', didst:'did', hadst:'had', verily:'truly', wherefore:'why', whence:'from where', whither:'where', hither:'here', thither:'there', yea:'yes', nay:'no', art:'are', wilt:'will', shew:'show', shewed:'showed', sware:'swore', brake:'broke', bare:'bore', gat:'got', clave:'clung', wist:'knew'};
function modernNodes(vi) {
  const t = plainV(vi), out = []; let last = 0, prev = '', m; const re = new RegExp(TOK.source, 'g');
  while ((m = re.exec(t))) {
    const w = m[0], k = keyOf(w), x = WM.get(k); let r = null;
    if ((k === 'art' || k === 'wilt') && prev !== 'thou') r = null;
    else if (k === 'thine') { const nx = /^\s*([A-Za-z]+)/.exec(t.slice(m.index + w.length)); r = nx && WM.get(keyOf(nx[1])) && WM.get(keyOf(nx[1])).kind !== 'n' && !/^(and|or|is|be|o|for|but)$/i.test(nx[1]) && !/[,.;:]/.test(t.slice(m.index + w.length, m.index + w.length + 1)) ? 'your' : 'yours'; }
    else if (MODW[k] && (x ? x.kind === 'a' || ['art', 'wilt', 'shew', 'shewed', 'bare', 'gat'].includes(k) : true)) r = MODW[k];
    else if (x && x.kind === 'a' && x.base && /eth$/.test(k)) r = modern3(x.base);
    else if (x && x.kind === 'a' && x.base && /(e)?st$/.test(k)) r = x.base;
    if (r && /^[A-Z]/.test(w)) r = r[0].toUpperCase() + r.slice(1);
    out.push(t.slice(last, m.index), r && r.toLowerCase() !== w.toLowerCase() ? el('span', {class:'mod', title:w}, r) : w);
    last = m.index + w.length; prev = k;
  }
  out.push(t.slice(last));
  return out;
}
/* hints that do not give the answer away: the word and its other forms are hidden */
let FORMS = null;
function formsOf(x) {
  if (!FORMS) { FORMS = new Map(); WL.forEach(y => { const b = y.base || y.k; if (!FORMS.has(b)) FORMS.set(b, []); FORMS.get(b).push(y.k); }); }
  const b = x.base || x.k; return new Set([x.k, b, ...(FORMS.get(b) || []), ...(FORMS.get(x.k) || [])]);
}
function maskHint(text, x) { const fs = formsOf(x); let hit = 0; return {text:String(text || '').replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g, w => fs.has(keyOf(w)) ? (hit++, '___') : w), hit}; }
function hintOf(x, enOnly) {   // {en, ko}: the meaning with the word hidden (en is null when too little is left to help)
  const m = meaningOf(x); if (!m) return null;
  const h = maskHint(m.def, x), left = h.text.replace(/___/g, ' ').replace(/[^A-Za-z]+/g, ' ').trim().split(' ').filter(w => w.length > 1).length;
  return {en:left >= 1 && h.text.replace(/[^A-Za-z]/g, '').length >= 3 ? h.text : null, ko:!enOnly && S.set.ko ? koOf(x) : null};
}
function hintNode(x) { const h = hintOf(x); if (!h || (!h.en && !h.ko)) return null; return el('p', {class:'tip'}, 'Hint: ', h.en || '', h.en && h.ko ? ' · ' : '', h.ko ? el('span', {class:'ko'}, h.ko) : null); }
const shortDef = x => { const m = x && meaningOf(x); if (!m) return ''; const d = m.def.split(/;\s*/)[0]; return d.length <= 30 && !maskHint(d, x).hit ? d : ''; };
/* a word card: meaning, then a set number of verses (more on request) */
function cardVerses(x, first, n, skip) {
  const out = first != null ? [first] : [], no = new Set(skip || []); if (first != null) no.add(first);
  const pool = versesOf(x).filter(i => !no.has(i)).map(i => [i, plainV(i).length]).sort((a, b) => a[1] - b[1]).slice(0, Math.max(40, n * 4));
  for (const [i] of shuffle(pool)) { if (out.length >= n) break; out.push(i); }
  return out;
}
function wordCard(x, first) {
  const m = meaningOf(x); let shown = cardVerses(x, first, S.set.cardV || 1);
  const box = el('div', {class:'cvs'});
  const drawV = () => put(box, shown.map((vi, j) => el('div', {class:'vrow'}, el('span', {class:'ref'}, refLong(vi) + (j === 0 && first != null ? ' · this verse' : '')), el('p', {class:'verse noword'}, vNodes(vi, x.k)), sayBtn(plainV(vi), 'sm'))),
    x.nv > shown.length ? el('button', {class:'btn small', type:'button', onclick:() => { shown = shown.concat(cardVerses(x, null, 5, shown)); drawV(); }}, 'Show more verses · ' + fmt(x.nv - shown.length) + ' more in the Bible') : null);
  drawV();
  return el('article', {class:'card', lang:'en-GB'}, el('div', {class:'head'}, el('h2', {class:'hw'}, x.k), sayBtn(x.k)),
    el('div', {class:'meta'}, lvBadge(x), el('span', {class:'chip'}, KIND[x.kind]), el('span', null, fmt(x.n) + ' times in the KJV')),
    m ? el('div', {class:'line def'}, el('p', null, m.via ? el('span', {class:'muted'}, 'from ' + m.via + ': ') : null, m.def)) : null,
    m && m.ko && S.set.ko ? el('div', {class:'line ko', lang:'ko'}, el('p', null, m.ko)) : null,
    m && m.note ? el('p', {class:'tip'}, m.note) : null, oldForm(x) ? el('p', {class:'tip'}, oldForm(x)) : null, box);
}
/* settings for the Bible-order study and word cards (used in Me and in the study panel) */
const PATH_OPTS = [
  ['pathWords', 'How to learn the new words of a verse', [['both', 'Cards, then fill the verse'], ['cards', 'Cards, then choose the meaning'], ['verse', 'Fill the verse only']]],
  ['pathReview', 'A verse with no new words', [[true, 'Review its words in English'], [false, 'Go straight to the meaning']]],
  ['pathPractice', 'Verse practice', [['hints', 'Blanks with meaning hints'], ['order', 'Put in order'], ['letters', 'First letters'], ['off', 'Off']]],
  ['cardV', 'Verses on a word card', [[1, '1'], [3, '3'], [5, '5']]],
  ['pathN', 'Verses in a Bible-order passage', [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30']]],
  ['pathLv', 'Words to learn in Bible order', [[1, 'Every word'], [2, 'Level 2+'], [3, 'Level 3+'], [4, 'Level 4+'], [5, 'Level 5+']]]];
const optSegs = after => PATH_OPTS.map(([key, label, opts]) => [el('span', {class:'lab'}, label), el('div', {class:'seg', role:'group', 'aria-label':label}, opts.map(([v, t]) => el('button', {type:'button', 'aria-pressed':(S.set[key] ?? blank().set[key]) === v ? 'true' : 'false', onclick:() => { S.set[key] = v; save(); after(); }}, t)))]);
function pathOptions() { const o = openOv('Study options'); const draw = () => put(o.body, el('section', {class:'panel set'}, optSegs(draw), el('p', {class:'tip'}, 'Korean meanings follow the setting in Me (한국어 뜻 보기 / English only).'))); draw(); }
const pathPos = () => Math.min(S.path.v || 0, V.length);
const versesToday = t => S.hist.filter(h => h[0] === DAY() && (!t || t.includes(h[1])) && h[2] >= 0).reduce((n, h) => n + h[3] - h[2] + 1, 0);
function runPath(mode) {
  const one = mode === 'one', N = one ? Infinity : (S.set.pathN || 10), title = one ? 'One verse at a time' : 'The Bible in order';
  const o = openOv(title);
  let st = {start:pathPos(), count:0, learnt:0, right:0, q:0};
  const head = (vi, step) => el('div', {class:'qhead'}, el('div', {class:'qcount'}, el('span', null, refLong(vi) + ' · ' + step), el('span', {class:'num'}, one ? fmt(vi + 1) + ' / ' + fmt(V.length) : Math.min(st.count + 1, N) + ' of ' + N)),
    el('div', {class:'pbar teal'}, el('i', {style:'width:' + (one ? (vi / V.length * 100).toFixed(2) : Math.round(st.count / N * 100)) + '%'})));
  const STEPS = ['read', 'words', 'meaning', 'verse'];
  const steps = (cur, nw) => el('div', {class:'steps'}, STEPS.map((s, i) => el('span', {class:s === cur ? 'on' : STEPS.indexOf(cur) > i ? 'done' : ''}, (i + 1) + ' ' + ({read:'Read', words:nw ? 'Words (' + nw + ')' : 'Words', meaning:'Meaning', verse:'Practise'})[s])));
  function show() {
    const vi = pathPos();
    if (vi >= V.length) return finish(true);
    if (st.count >= N) return finish();
    const r = V[vi], vw = verseWords(vi), ws = pathWords(vi), bookStart = r[1] === 0 && r[2] === 0;
    const known = vw.filter(x => x.kind !== 'n' && !ws.includes(x)), names = vw.filter(x => x.kind === 'n');
    $('#ov').scrollTop = 0;
    put(o.body, head(vi, 'read'), steps('read', ws.length),
      r[2] === 0 ? el('div', {class:'chhead'}, el('p', {class:'eyebrow'}, B[r[0]][0] + (S.set.ko ? ' · ' + B[r[0]][2] : '') + ' · chapter ' + (r[1] + 1) + ' of ' + B[r[0]][3].length), bookStart ? el('p', {class:'tip'}, ABOUT[r[0]].split('|')[0], S.set.ko ? el('span', {class:'ko'}, ' · ' + ABOUT[r[0]].split('|')[1]) : null) : null) : null,
      el('p', {class:'verse big1', lang:'en-GB'}, vNodes(vi)), el('div', {class:'row'}, sayBtn(plainV(vi), 'sm'), el('button', {class:'btn small', type:'button', onclick:() => openChapter(r[0], r[1], vi)}, 'See the chapter')),
      ws.length ? el('section', {class:'panel'}, el('p', {class:'eyebrow'}, ws.length + ' new ' + (ws.length === 1 ? 'word' : 'words') + ' to learn · tap one for more'), el('div', {class:'gloss'}, ws.map(glossRow)))
        : el('p', {class:'tip'}, 'No new words: you have learnt every word in this verse.'),
      known.length ? el('div', {class:'knew'}, el('span', {class:'not'}, 'Already learnt · not taught again'), el('div', {class:'chips'}, known.map(x => el('button', {class:'kchip', type:'button', onclick:() => openWord(x)}, x.k)))) : null,
      names.length ? el('div', {class:'knew'}, el('span', {class:'not'}, 'Names'), el('div', {class:'chips'}, names.map(x => el('button', {class:'kchip n', type:'button', onclick:() => openWord(x)}, x.k)))) : null,
      el('button', {class:'btn primary big', type:'button', 'data-enter':'', onclick:() => ws.length ? learn(vi, ws) : S.set.pathReview !== false ? review(vi) : meaning(vi, 0, 0, 0)}, ws.length ? 'Learn these ' + ws.length + ' words' : S.set.pathReview !== false ? 'Review this verse\'s words' : 'Go on to the meaning'),
      el('button', {class:'btn ghost', type:'button', onclick:() => advance(vi, 0, 0, 0)}, 'Next verse without studying this one'));
  }
  function learn(vi, ws) {   // word cards first (as in Today's words), unless the setting is "in the verse only"
    const wm = S.set.pathWords || 'both';
    if (wm === 'verse' || !ws.length) return check(vi, ws, 'cloze');
    let k = 0;
    const step = () => {
      $('#ov').scrollTop = 0;
      if (k >= ws.length) return check(vi, ws, wm === 'cards' ? 'meaning' : 'cloze');
      const x = ws[k];
      put(o.body, head(vi, 'card ' + (k + 1) + ' of ' + ws.length), steps('words', ws.length), el('p', {class:'eyebrow', style:'text-align:center'}, 'New word ' + (k + 1) + ' of ' + ws.length), wordCard(x, vi),
        el('button', {class:'btn primary big', type:'button', 'data-enter':'', onclick:() => { k++; step(); }}, k + 1 < ws.length ? 'Got it · next word' : 'Got it · check the words'),
        k ? el('button', {class:'btn ghost', type:'button', onclick:() => { k--; step(); }}, 'Back') : null);
    };
    step();
  }
  function check(vi, ws, kind) {   // each new word checked once (a word missed comes back once at the end)
    const queue = ws.map(x => ({x, again:false})); let n = 0, right = 0, tried = 0, k = 0;
    const step = () => {
      $('#ov').scrollTop = 0;
      if (k >= queue.length) return meaning(vi, n, right, tried);
      const it = queue[k], x = it.x, m = meaningOf(x);
      let q = null;
      if (kind === 'meaning' && m) { const o4 = [...new Set([m.def, ...distractors(x, 12, y => !!meaningOf(y)).map(y => meaningOf(y).def).filter(d => d !== m.def)])].slice(0, 4); if (o4.length >= 3) q = {k:'meaning', o:shuffle(o4), a:m.def}; }
      if (!q) { const d = distractors(x, 3); if (d.length >= 2) q = {k:'cloze', o:shuffle([x.k, ...d.map(y => y.k)]), a:x.k}; }
      if (!q) { const was = isLearnt(x); grade(x, true, 'check'); if (!was) { n++; logAct('new', true); } k++; return step(); }
      const fb = el('div'), prompt = q.k === 'cloze' ? el('p', {class:'qtext ex', lang:'en-GB'}, clozeNodes(vi, x.k)) : el('div', null, el('p', {class:'qtext big', lang:'en-GB'}, x.k), el('p', {class:'verse noword'}, vNodes(vi, x.k)));
      const h = q.k === 'cloze' ? hintNode(x) : null;
      const opts = el('div', {class:'opts' + (q.k === 'meaning' ? ' long' : '')}, q.o.map(t => el('button', {class:'opt', type:'button', lang:'en-GB', onclick:e => {
        opts.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === q.a) b.classList.add('right'); });
        const ok = t === q.a; if (!ok) e.currentTarget.classList.add('wrong');
        const was = isLearnt(x); grade(x, ok, 'check'); if (ok && !was) { n++; logAct('new', true); } else logAct(null, ok);
        if (ok) right++; tried++; if (!ok && !it.again) queue.push({x, again:true});
        if (q.k === 'cloze') put(prompt, clozeNodes(vi, x.k, true));
        put(fb, el('section', {class:'fb ' + (ok ? 'ok' : 'no')}, el('h3', null, ok ? 'Well done!' : (q.k === 'cloze' ? 'The word is "' + x.k + '"' : 'Not quite')) , !ok && !it.again ? el('p', {class:'why'}, 'It will come back once more.') : null,
            m ? el('p', {class:'why', style:'color:var(--def)'}, x.k + ': ' + m.def) : null, S.set.ko && koOf(x) ? el('p', {class:'why ko', lang:'ko'}, x.k + ' · ' + koOf(x)) : null),
          el('button', {class:'btn primary big', type:'button', onclick:() => { k++; step(); }}, 'Next'));
        fb.querySelector('.btn.primary').focus({preventScroll:true});
      }}, t)));
      put(o.body, head(vi, 'word ' + (k + 1) + ' of ' + queue.length), steps('words', ws.length),
        el('p', {class:'qinstr'}, q.k === 'cloze' ? 'Which word completes the verse?' : 'What does "' + x.k + '" mean here?'), h, prompt, opts, fb);
    };
    step();
  }
  function review(vi) {   // a verse with no new words: its words again, in English
    const vw = verseWords(vi).filter(x => x.kind !== 'n' && meaningOf(x));
    const good = vw.filter(x => { const h = hintOf(x, true); return h && h.en; }).sort((a, b) => b.lv - a.lv || a.n - b.n);
    const pick = shuffle(good.slice(0, 6)).slice(0, Math.min(3, good.length));
    let k = 0, right = 0, tried = 0;
    const step = () => {
      $('#ov').scrollTop = 0;
      if (k >= pick.length) return meaning(vi, 0, right, tried);
      const x = pick[k], h = hintOf(x, true);
      const others = shuffle(vw.filter(y => y !== x && !formsOf(x).has(y.k))).slice(0, 3);
      if (others.length < 3) others.push(...distractors(x, 3 - others.length));
      const o4 = shuffle([x, ...others.slice(0, 3)]), fb = el('div');
      const opts = el('div', {class:'opts'}, o4.map(y => el('button', {class:'opt', type:'button', lang:'en-GB', onclick:e => {
        opts.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === x.k) b.classList.add('right'); });
        const ok = y === x; if (!ok) e.currentTarget.classList.add('wrong');
        grade(x, ok, isDue(x) ? 'review' : 'practice'); logAct(isDue(x) ? 'review' : null, ok); if (ok) right++; tried++;
        put(fb, el('section', {class:'fb ' + (ok ? 'ok' : 'no')}, el('h3', null, ok ? 'Well done!' : 'It is "' + x.k + '"'), el('p', {class:'why', style:'color:var(--def)'}, x.k + ': ' + meaningOf(x).def)),
          el('button', {class:'btn primary big', type:'button', onclick:() => { k++; step(); }}, 'Next'));
        fb.querySelector('.btn.primary').focus({preventScroll:true});
      }}, y.k)));
      put(o.body, head(vi, 'review ' + (k + 1) + ' of ' + pick.length), steps('words'), el('p', {class:'qinstr'}, 'Every word here is one you know. Which word in the verse means …'),
        el('p', {class:'qtext def', lang:'en-GB'}, '“' + h.en + '”'), el('p', {class:'verse', lang:'en-GB'}, plainV(vi)), opts, fb);
    };
    step();
  }
  function meaning(vi, n, right, tried) {   // understand the verse: word by word, in today's English, then (with Korean on) your own translation
    $('#ov').scrollTop = 0;
    const t = plainV(vi), toks = [], ko = !!S.set.ko;
    for (const m of t.matchAll(TOK)) { const x = WM.get(keyOf(m[0])); toks.push(el('span', {class:'il' + (x && x.kind === 'n' ? ' n' : ''), role:'button', tabindex:'0', onclick:() => x && openWord(x)}, el('b', null, m[0] + t.slice(m.index + m[0].length).match(/^[^A-Za-z]*/)[0].replace(/\s+$/, '')), el('span', {class:ko ? '' : 'en'}, (ko ? koOf(x) : x && x.kind === 'n' ? 'name' : shortDef(x)) || (ko ? '·' : '\u00a0')))); }
    const modern = modernNodes(vi), changed = modern.some(z => z && z.className === 'mod');
    const ta = ko ? el('textarea', {class:'memo', rows:'3', lang:'ko', 'aria-label':'My Korean translation', placeholder:'이 절을 내 말로 우리말로 옮겨 보세요'}) : null; if (ta) ta.value = S.tr[vi] || '';
    const go = () => { if (ta) { const v = ta.value.trim(); if (v) S.tr[vi] = v; else delete S.tr[vi]; save(); } practise(vi, n, right, tried); };
    put(o.body, head(vi, 'meaning'), steps('meaning'),
      el('p', {class:'eyebrow'}, 'Word by word'), el('div', {class:'interlin', lang:'en-GB'}, toks),
      changed ? [el('p', {class:'eyebrow'}, 'In today\'s English'), el('p', {class:'verse', lang:'en-GB'}, modern), el('p', {class:'tip'}, 'Only the old forms are changed (thou → you, -eth → -s, unto → to …). It is a guide made by the app, not a new translation.')] : null,
      ta ? [el('p', {class:'eyebrow'}, 'Translate it · 우리말로 옮기기'), el('p', {class:'tip'}, 'Write the verse in Korean in your own words, using the words above. It is saved with the verse.'), ta] : null,
      el('button', {class:'btn primary big', type:'button', onclick:go}, ta && ta.value ? 'Save and practise the verse' : (S.set.pathPractice || 'hints') === 'off' ? 'Next' : 'Practise the verse'));
    if (ta) ta.addEventListener('input', () => { o.body.querySelector('.btn.primary.big').textContent = ta.value.trim() ? 'Save and practise the verse' : 'Practise the verse'; });
  }
  function practise(vi, n, right, tried) {
    $('#ov').scrollTop = 0;
    const kind = S.set.pathPractice || 'hints', ko = !!S.set.ko;
    const next = () => el('button', {class:'btn primary big', type:'button', onclick:() => advance(vi, n, right, tried)}, one || st.count + 1 < N ? 'Next verse · ' + (vi + 1 < V.length ? refOf(vi + 1) : 'the end') : 'See how I did');
    const stop = () => one ? el('button', {class:'btn ghost', type:'button', onclick:() => advance(vi, n, right, tried, true)}, 'Stop here for now') : null;
    if (kind === 'off') { put(o.body, head(vi, 'done'), el('p', {class:'verse big1', lang:'en-GB'}, vNodes(vi)), ko && S.tr[vi] ? el('p', {class:'why ko', lang:'ko'}, S.tr[vi]) : null, next(), stop()); return; }
    const res = el('div');
    const done = ok => {
      if (ok) right++; tried++;
      put(res, el('section', {class:'fb ' + (ok ? 'ok' : 'no')}, el('h3', null, ok ? 'Well done!' : 'Here is the verse'), el('p', {class:'verse noword'}, vNodes(vi)), ko && S.tr[vi] ? el('p', {class:'why ko', lang:'ko'}, S.tr[vi]) : null), next(), stop());
      res.querySelector('.btn.primary').focus({preventScroll:true});
    };
    put(o.body, head(vi, 'verse'), steps('verse'), verseEx(vi, kind === 'hints' ? 'blanks' : kind, done, {hints:kind === 'hints'}), res);
  }
  function advance(vi, n, right, tried, stop) {
    logStudy(one ? 'one' : 'path', vi, vi, n, right, tried);
    S.path.v = vi + 1; st.count++; st.learnt += n; st.right += right; st.q += tried; save();
    if (stop) return finish();
    show();
  }
  function finish(end) {
    const last = pathPos() - 1;
    put(o.body, el('div', {class:'sum'}, el('p', {class:'eyebrow'}, title), el('div', {class:'big num'}, st.count ? st.count + (st.count === 1 ? ' verse' : ' verses') : '✓'),
      st.count ? el('p', {style:'margin:0'}, rangeText(st.start, last)) : null,
      el('p', {class:'muted', style:'margin:0'}, [st.learnt ? st.learnt + ' new words learnt' : null, st.q ? st.right + ' of ' + st.q + ' right' : null].filter(Boolean).join(' · ')),
      end ? el('p', null, 'You have reached the end of the Bible. Well done!') : el('p', {class:'tip'}, 'Next time you start at ' + refLong(pathPos()) + '.'),
      end ? null : el('button', {class:'btn primary big', type:'button', onclick:() => { st = {start:pathPos(), count:0, learnt:0, right:0, q:0}; show(); }}, one ? 'Carry on' : (S.set.pathN || 10) + ' more verses'),
      el('button', {class:'btn big', type:'button', onclick:closeOv}, 'Finish')));
  }
  show();
}
function pickPlace(onSet) {   // choose where the Bible-order study goes on from
  const o = openOv('Where to go on from');
  const cur = V[pathPos()] || V[V.length - 1], st = {b:cur[0], c:cur[1], v:cur[2]};
  const draw = () => {
    const nv = B[st.b][3][st.c].length; st.v = Math.min(st.v, nv - 1);
    const set = vi => { S.path.v = vi; save(); toast('You will go on from ' + refLong(vi)); closeOv(); if (onSet) onSet(); };
    put(o.body, el('p', {class:'tip'}, 'Now at ' + refLong(pathPos()) + '. Your history is kept when you move.'),
      el('div', {class:'row', style:'gap:6px;flex-wrap:wrap'},
        el('select', {class:'fld', 'aria-label':'Book', onchange:e => { st.b = +e.target.value; st.c = 0; st.v = 0; draw(); }}, B.map((bk, bi) => el('option', {value:bi, selected:st.b === bi}, bk[0]))),
        el('select', {class:'fld', 'aria-label':'Chapter', onchange:e => { st.c = +e.target.value; st.v = 0; draw(); }}, B[st.b][3].map((_, ci) => el('option', {value:ci, selected:st.c === ci}, 'chapter ' + (ci + 1)))),
        el('select', {class:'fld', 'aria-label':'Verse', onchange:e => { st.v = +e.target.value; draw(); }}, Array.from({length:nv}, (_, k) => el('option', {value:k, selected:st.v === k}, 'verse ' + (k + 1))))),
      el('button', {class:'btn primary', type:'button', onclick:() => set(vIndex(st.b, st.c, st.v))}, 'Go on from ' + B[st.b][1] + ' ' + (st.c + 1) + ':' + (st.v + 1)),
      el('div', {class:'modes'},
        S.last != null && V[S.last] ? modeBtn('📖', 'Where I last read', refLong(S.last), () => set(S.last)) : null,
        (() => { const nx = CH.findIndex(c => !S.read[c[0] + '.' + c[1]]); return nx >= 0 ? modeBtn('✅', 'The first chapter I have not read', B[CH[nx][0]][0] + ' ' + (CH[nx][1] + 1), () => set(CH[nx][2])) : null; })(),
        modeBtn('🌅', 'The beginning', 'Genesis 1:1', () => set(0)),
        modeBtn('✝️', 'The New Testament', 'Matthew 1:1', () => set(vIndex(39, 0, 0)))));
  };
  draw();
}
function pathPanel(redraw) {
  const pos = pathPos(), done = pos >= V.length, today = versesToday(['path', 'one']);
  return el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'The Bible in order'),
    el('p', {style:'margin:0'}, done ? 'You have studied to the end of the Bible.' : 'Next: ', done ? null : el('b', null, refLong(pos)), today ? ' · ' + today + ' verses today' : ''),
    el('div', {class:'pbar teal', title:fmt(pos) + ' of ' + fmt(V.length) + ' verses'}, el('i', {style:'width:' + (pos / V.length * 100).toFixed(2) + '%'})),
    el('p', {class:'tip'}, fmt(pos) + ' of ' + fmt(V.length) + ' verses (' + (pos / V.length * 100).toFixed(1) + '%). Read each verse, learn its new words, then practise it, in the order of the books.'),
    el('div', {class:'modes'},
      modeBtn('➡️', "Today's passage", (S.set.pathN || 10) + ' verses from ' + (done ? '—' : refOf(pos)), () => runPath('path'), done),
      modeBtn('☝️', 'One verse at a time', 'Go on verse by verse; stop whenever you like', () => runPath('one'), done),
      modeBtn('⚙️', 'Study options', 'How to learn the words, verse practice, verses on a card', () => pathOptions()),
      modeBtn('📍', 'Change where to go on from', 'A book, chapter and verse, or where you last read', () => pickPlace(redraw)),
      modeBtn('🗓️', 'My study record', 'By date, by passage and on a calendar', () => openRecord())));
}

/* ---------- study record: by date, by passage, calendar ---------- */
function openRecord(tab0) {
  const o = openOv('My study record');
  let tab = tab0 || 'date', more = 30, month = 0, pickDay = null;
  const days = () => { const m = new Map(); S.hist.forEach(h => { if (!m.has(h[0])) m.set(h[0], []); m.get(h[0]).push(h); }); Object.keys(S.log).forEach(d => { if (!m.has(+d)) m.set(+d, []); }); return m; };
  const logLine = d => { const L = S.log[d]; return L && L[0] + L[1] + L[2] + L[3] ? [L[0] ? L[0] + ' new words' : null, L[1] ? L[1] + ' reviews' : null, L[2] + L[3] ? L[2] + '/' + (L[2] + L[3]) + ' right' : null].filter(Boolean).join(' · ') : ''; };
  const entry = h => el('button', {class:'hrow', type:'button', onclick:() => { if (h[2] >= 0) openChapter(V[h[2]][0], V[h[2]][1], h[2]); }, disabled:h[2] < 0},
    el('span', {class:'ic', 'aria-hidden':'true'}, HTI[h[1]] || '•'), el('span', null, el('b', null, h[2] >= 0 ? rangeText(h[2], h[3]) : HT[h[1]]), el('span', {class:'d'}, (h[2] >= 0 ? HT[h[1]] + ' · ' : '') + histDetail(h))));
  const dayBlock = (d, hs) => el('section', {class:'hday'}, el('div', {class:'hd'}, el('b', null, fmtDay(d, true)), el('span', {class:'muted'}, logLine(d))), hs.length ? hs.map(entry) : el('p', {class:'tip'}, 'Word practice only.'));
  function cover() {   // what was done to each verse: 1 read, 2 studied in order, 4 practised; and the dates for each chapter
    const f = new Uint8Array(V.length), chd = new Map();
    S.hist.forEach(h => { if (h[2] < 0) return; const bit = h[1] === 'read' ? 1 : h[1] === 'path' || h[1] === 'one' ? 2 : 4;
      for (let i = h[2]; i <= h[3]; i++) f[i] |= bit;
      for (let ci = chIndex(V[h[2]][0], V[h[2]][1]); ci < CH.length && CH[ci][2] <= h[3]; ci++) { if (!chd.has(ci)) chd.set(ci, []); chd.get(ci).push(h); } });
    return {f, chd};
  }
  const draw = () => {
    const D = days(), dk = [...D.keys()].sort((a, b) => b - a);
    const tot = {days:dk.filter(d => D.get(d).length || logLine(d)).length, order:0, read:Object.keys(S.read).length};
    S.hist.forEach(h => { if ((h[1] === 'path' || h[1] === 'one') && h[2] >= 0) tot.order += h[3] - h[2] + 1; });
    const seg = el('div', {class:'seg am', role:'group', 'aria-label':'Show'}, [['date', 'By date'], ['passage', 'By passage'], ['cal', 'Calendar']].map(([k, l]) => el('button', {type:'button', 'aria-pressed':tab === k ? 'true' : 'false', onclick:() => { tab = k; draw(); }}, l)));
    let body;
    if (tab === 'date') {
      body = dk.length ? [dk.slice(0, more).map(d => dayBlock(d, D.get(d))), dk.length > more ? el('button', {class:'btn', type:'button', onclick:() => { more += 30; draw(); }}, 'Show older days') : null] : el('p', {class:'empty'}, 'Nothing yet. What you study and read is recorded here, day by day.');
    } else if (tab === 'passage') {
      const {f, chd} = cover();
      body = el('div', {class:'wlist'}, B.map((bk, bi) => {
        const ci0 = chIndex(bi, 0), a = CH[ci0][2], z = bi === 65 ? V.length : CH[chIndex(bi + 1, 0)][2]; let any = 0, ord = 0;
        for (let i = a; i < z; i++) { if (f[i]) any++; if (f[i] & 2) ord++; }
        const rd = bk[3].filter((_, c) => S.read[bi + '.' + c]).length;
        const dates = []; for (let c = 0; c < bk[3].length; c++) (chd.get(ci0 + c) || []).forEach(h => dates.push(h[0]));
        const span = dates.length ? fmtDay(Math.min(...dates)) + (Math.max(...dates) !== Math.min(...dates) ? ' – ' + fmtDay(Math.max(...dates)) : '') : '';
        return el('button', {class:'bkrow' + (any ? '' : ' none'), type:'button', onclick:() => openRecBook(bi, cover)},
          el('span', null, el('b', null, bk[0]), el('span', {class:'d'}, any ? [(any / (z - a) < 0.01 ? '<1' : Math.round(any / (z - a) * 100)) + '% studied', rd ? rd + '/' + bk[3].length + ' chapters read' : null, ord ? fmt(ord) + (ord === 1 ? ' verse' : ' verses') + ' in order' : null, span].filter(Boolean).join(' · ') : 'not started')),
          el('span', {class:'pbar teal'}, el('i', {style:'width:' + (any / (z - a) * 100).toFixed(1) + '%'})));
      }));
    } else {
      const now = new Date(), y = now.getFullYear(), m = now.getMonth() + month, first = new Date(y, m, 1), nd = new Date(y, m + 1, 0).getDate(), d0 = DAY(first), lead = (first.getDay() + 6) % 7;
      const amount = d => { const L = S.log[d] || [0, 0, 0, 0]; return L[0] + L[2] + L[3] + (D.get(d) || []).reduce((n, h) => n + (h[2] >= 0 ? h[3] - h[2] + 1 : 0), 0); };
      const lvl = n => n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4;
      body = [el('div', {class:'calnav'}, el('button', {class:'btn small', type:'button', 'aria-label':'Previous month', onclick:() => { month--; pickDay = null; draw(); }}, svg(ICON.prev)), el('b', null, first.toLocaleDateString('en-GB', {month:'long', year:'numeric'})), el('button', {class:'btn small', type:'button', 'aria-label':'Next month', disabled:month >= 0, onclick:() => { month++; pickDay = null; draw(); }}, svg(ICON.next))),
        el('div', {class:'cal'}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(t => el('span', {class:'wd'}, t)), Array.from({length:lead}, () => el('span')), Array.from({length:nd}, (_, k) => { const d = d0 + k, n = amount(d); return el('button', {type:'button', class:'cd l' + lvl(n) + (d === DAY() ? ' now' : '') + (d === pickDay ? ' pick' : ''), title:n ? n + ' things done' : '', onclick:() => { pickDay = d; draw(); }}, k + 1); })),
        el('p', {class:'tip'}, 'The deeper the colour, the more you did that day. Tap a day to see it.'),
        pickDay != null ? dayBlock(pickDay, D.get(pickDay) || []) : null];
    }
    put(o.body, el('div', {class:'tiles4'}, el('div', {class:'tl'}, el('b', {class:'num'}, tot.days), el('span', null, 'days of study')), el('div', {class:'tl'}, el('b', {class:'num'}, streak()), el('span', null, 'day streak')),
        el('div', {class:'tl'}, el('b', {class:'num'}, fmt(tot.order)), el('span', null, 'verses studied in order')), el('div', {class:'tl'}, el('b', {class:'num'}, tot.read), el('span', null, 'chapters read'))),
      seg, body);
  };
  o.onReturn(draw);
  draw();
}
function openRecBook(bi, cover) {
  const o = openOv(B[bi][0] + ' · record');
  const draw = () => {
    const {f, chd} = cover(), ci0 = chIndex(bi, 0);
    put(o.body, el('p', {class:'tip'}, 'For each chapter: how much you have studied, and when. Tap a chapter to open it.'),
      el('div', {class:'wlist'}, B[bi][3].map((vs, c) => {
        const a = CH[ci0 + c][2], hs = chd.get(ci0 + c) || []; let any = 0; for (let i = a; i < a + vs.length; i++) if (f[i]) any++;
        const byType = new Map(); hs.forEach(h => { const k = h[1]; if (!byType.has(k)) byType.set(k, []); byType.get(k).push(h); });
        return el('button', {class:'bkrow' + (any ? '' : ' none'), type:'button', onclick:() => openChapter(bi, c)},
          el('span', null, el('b', null, 'Chapter ' + (c + 1) + (S.read[bi + '.' + c] ? ' ✓' : '')), el('span', {class:'d'}, any ? any + '/' + vs.length + ' verses' : 'not studied yet'),
            [...byType].map(([t, l]) => el('span', {class:'d'}, HTI[t] + ' ' + HT[t] + ': ' + l.map(h => fmtDay(h[0]) + (h[2] > a || h[3] < a + vs.length - 1 ? ' (v. ' + (Math.max(h[2], a) - a + 1) + (h[3] !== h[2] ? '–' + (Math.min(h[3], a + vs.length - 1) - a + 1) : '') + ')' : '')).join(', ')))),
          el('span', {class:'pbar teal'}, el('i', {style:'width:' + (any / vs.length * 100).toFixed(1) + '%'})));
      })));
  };
  o.onReturn(draw);
  draw();
}

/* ---------- reading a chapter ---------- */
function openChapter(b, c, focus) {
  const o = openOv(B[b][0] + ' ' + (c + 1));
  const draw = (b, c, focus) => {
    o.setTitle(B[b][0] + ' ' + (c + 1));
    const ci = chIndex(b, c), start = CH[ci][2], n = B[b][3][c].length, key = b + '.' + c;
    S.last = focus != null ? focus : start; save();
    const vis = Array.from({length:n}, (_, k) => start + k);
    const hlc = {a:'hlA', b:'hlB', '4':'hl4', '5':'hl5', n:'hlN', off:''}[S.set.hl] || '';
    const words = new Map(); vis.forEach(i => { for (const m of plainV(i).matchAll(TOK)) { const x = WM.get(keyOf(m[0])); if (x) words.set(x.k, x); } });
    const study = [...words.values()].filter(x => x.kind !== 'n' && x.lv >= 3 && !isLearnt(x)).sort((a, b) => a.ord - b.ord);
    const firstHere = [...words.values()].filter(x => x.first >= start && x.first < start + n && x.kind !== 'n');
    const ed = S.set.ed || 'main';
    if (ed !== 'main' && !OLD) { put(o.body, el('p', {class:'loading'}, 'Opening the 1611 edition…')); loadOld().then(() => draw(b, c, focus), () => { S.set.ed = 'main'; draw(b, c, focus); toast('The 1611 text could not be loaded'); }); return; }
    const edSeg = el('div', {class:'seg am', role:'group', 'aria-label':'Edition'}, [['main', '1769'], ['1611', '1611'], ['both', 'Both']].map(([k, l]) => el('button', {type:'button', 'aria-pressed':ed === k ? 'true' : 'false', onclick:() => { S.set.ed = k; save(); draw(b, c, focus); }}, l)));
    const hlSeg = el('div', {class:'seg am', role:'group', 'aria-label':'Mark words'}, [['a', 'Old English'], ['b', 'Bible words'], ['4', 'Level 4+'], ['n', 'Names'], ['off', 'None']].map(([k, l]) => el('button', {type:'button', 'aria-pressed':S.set.hl === k ? 'true' : 'false', onclick:() => { S.set.hl = k; save(); draw(b, c); }}, l)));
    const vn = (i, k) => el('span', {class:'vn', role:'button', tabindex:'0', onclick:() => verseMenu(i, () => draw(b, c, i))}, k + 1);
    const vlist = el('div', {class:'vs ' + hlc, lang:'en-GB'}, vis.map((i, k) => ed === '1611' ? el('p', {id:'v' + i, class:'old' + (S.vstars.includes(i) ? ' star' : '')}, vn(i, k), oldNodes(i))
      : ed === 'both' ? el('div', {id:'v' + i, class:'pair' + (S.vstars.includes(i) ? ' star' : '')}, el('p', null, vn(i, k), vNodes(i)), el('p', {class:'old'}, el('span', {class:'vn'}, '1611'), oldNodes(i)))
      : el('p', {id:'v' + i, class:(S.vstars.includes(i) ? 'star' : '')}, vn(i, k), vNodes(i))));
    const done = !!S.read[key];
    put(o.body,
      el('header', {class:'hello'}, el('p', {class:'eyebrow'}, B[b][0] + (S.set.ko ? ' · ' + B[b][2] : '') + ' · chapter ' + (c + 1) + ' of ' + B[b][3].length), el('h1', null, B[b][0] + ' ' + (c + 1))),
      el('p', {class:'tip'}, 'Tap a word for its meaning and verses. Tap a verse number to star it, write a note or practise it. Words in italics were added by the translators.'),
      el('div', null, el('span', {class:'lab'}, 'Edition: '), edSeg), ed !== 'main' ? el('p', {class:'tip'}, 'The 1611 first edition, as printed: u and v, i and j, and many spellings were not yet fixed. Words in pink differ in wording from the 1769 text. Tap a word to see it today.') : null,
      el('div', null, el('span', {class:'lab'}, 'Mark: '), hlSeg),
      vlist,
      el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Study this chapter'),
        el('p', {style:'margin:0'}, words.size + ' different words · ' + firstHere.length + ' appear here for the first time in the Bible · ' + study.length + ' words at level 3+ that you have not learnt.'),
        el('div', {class:'modes'},
          modeBtn('🌱', 'Learn this chapter\'s words', study.length ? study.length + ' words, in order' : 'You know them all', () => runSession(openOv('Words · ' + B[b][1] + ' ' + (c + 1)), 'Chapter words', study.slice(0, 15).map(x => ({learn:x}))), !study.length),
          modeBtn('🎯', 'Word quiz on this chapter', 'Questions from these verses', () => startQuiz(sample([...words.values()].filter(x => x.kind !== 'n' && x.lv >= 2), 12), 'Quiz · ' + B[b][1] + ' ' + (c + 1)), words.size < 4),
          modeBtn('📖', 'Verse practice', 'Blanks, word order and first letters', () => runVerses('Verses · ' + B[b][1] + ' ' + (c + 1), verseQs(sample(vis, Math.min(8, vis.length)), 'mix'))),
          modeBtn('☝️', 'Study this chapter verse by verse', 'In order, from verse 1; your Bible-order place moves here', () => { S.path.v = start; save(); runPath('one'); }),
          modeBtn('📋', 'All words in this chapter', 'Open them in Words', () => { WF = {mode:'and', sort:'bible', c:[{t:'range', b1:b, c1:c, b2:b, c2:c}, {t:'kind', v:['c', 'a', 'b']}]}; closeAll(); TAB = 'words'; render(); }))),
      el('div', {class:'row'}, el('button', {class:'btn ' + (done ? '' : 'primary'), type:'button', onclick:() => { if (done) delete S.read[key]; else { S.read[key] = DAY(); logStudy('read', start, start + n - 1); } save(); draw(b, c); }}, done ? '✓ Read · undo' : 'Mark as read'), sayBtn(vis.map(plainV).join(' '))),
      el('div', {class:'row'},
        el('button', {class:'btn', type:'button', disabled:ci <= 0, onclick:() => { const p = CH[ci - 1]; draw(p[0], p[1]); }}, svg(ICON.prev), 'Previous'),
        el('button', {class:'btn', type:'button', disabled:ci >= CH.length - 1, onclick:() => { const p = CH[ci + 1]; draw(p[0], p[1]); }}, 'Next', svg(ICON.next))));
    if (focus != null) { const n0 = document.getElementById('v' + focus); if (n0) { n0.classList.add('sel'); setTimeout(() => n0.scrollIntoView({block:'center'}), 30); } } else $('#ov').scrollTop = 0;
  };
  draw(b, c, focus);
}
const closeAll = () => { while (OV.open) closeOv(); };
function modeBtn(ic, t, d, f, off) { return el('button', {class:'mode', type:'button', disabled:!!off, onclick:f}, el('span', {class:'ic', 'aria-hidden':'true'}, ic), el('span', null, el('b', null, t), el('span', null, d))); }
function verseMenu(vi, redraw) {
  const o = openOv(refLong(vi));
  const draw = () => {
    const on = S.vstars.includes(vi), ta = el('textarea', {class:'memo', 'aria-label':'My note'}); ta.value = S.notes[vi] || '';
    put(o.body, el('p', {class:'verse noword', lang:'en-GB'}, vNodes(vi)), el('div', {class:'row'}, sayBtn(plainV(vi))),
      el('div', {class:'row', style:'flex-wrap:wrap;gap:8px'},
        el('button', {class:'btn' + (on ? '' : ' primary'), type:'button', onclick:() => { if (on) { S.vstars.splice(S.vstars.indexOf(vi), 1); delete S.mem[vi]; } else { S.vstars.unshift(vi); S.mem[vi] = S.mem[vi] || [0, DAY()]; } save(); draw(); }}, on ? '★ Memory verse · remove' : '☆ Add to memory verses'),
        el('button', {class:'btn', type:'button', onclick:() => { S.path.v = vi; save(); runPath('one'); }}, 'Study in order from here'),
        el('button', {class:'btn', type:'button', onclick:() => runVerses('Practise ' + refOf(vi), [{vi, kind:'blanks'}, {vi, kind:'order'}, {vi, kind:'letters'}])}, 'Practise this verse'),
        el('button', {class:'btn', type:'button', onclick:() => { try { navigator.clipboard.writeText(plainV(vi) + ' (' + refLong(vi) + ', KJV)'); toast('Copied'); } catch (e) {} }}, 'Copy')),
      S.tr[vi] ? [el('p', {class:'eyebrow'}, 'My Korean translation'), el('p', {class:'ko', lang:'ko', style:'margin:0'}, S.tr[vi])] : null,
      el('label', {class:'eyebrow'}, 'My note'), ta,
      el('button', {class:'btn', type:'button', onclick:() => { const t = ta.value.trim(); if (t) S.notes[vi] = t; else delete S.notes[vi]; save(); toast(t ? 'Note saved' : 'Note removed'); }}, 'Save note'));
  };
  o.onReturn(() => redraw && redraw());
  draw();
}

/* ---------- the 66 books ---------- */
const SECTION = [[0, 5, 'The Law', '율법서'], [5, 17, 'History', '역사서'], [17, 22, 'Poetry and Wisdom', '시가서'], [22, 27, 'Major Prophets', '대선지서'], [27, 39, 'Minor Prophets', '소선지서'],
  [39, 43, 'Gospels', '복음서'], [43, 44, 'History of the Church', '역사서'], [44, 57, "Paul's Letters", '바울 서신'], [57, 65, 'General Letters', '일반 서신'], [65, 66, 'Prophecy', '예언서']];
const ABOUT = ['God creates the world and calls Abraham’s family.|창조와 족장들의 이야기', 'God frees Israel from Egypt and gives the law.|출애굽과 율법', 'Laws for worship, offerings and holiness.|제사와 거룩함의 규례', 'Forty years in the wilderness.|광야 40년', 'Moses repeats the law before Israel enters the land.|모세의 마지막 설교',
 'Israel enters and divides the promised land.|가나안 정복', 'Leaders called judges rescue Israel again and again.|사사들의 시대', 'A Moabite widow’s loyalty is rewarded.|룻의 충성', 'Samuel, Saul and young David.|사무엘과 사울과 다윗', 'King David’s reign.|다윗 왕의 통치',
 'Solomon, the temple, and the divided kingdom.|솔로몬과 분열 왕국', 'The kings of Israel and Judah until the exile.|포로기까지의 왕들', 'Family lines and David’s kingdom.|족보와 다윗 왕국', 'The kings of Judah and the temple.|유다 왕들과 성전', 'The return from exile and the new temple.|포로 귀환과 성전 재건',
 'Rebuilding the walls of Jerusalem.|예루살렘 성벽 재건', 'A Jewish queen saves her people.|에스더가 백성을 구함', 'A good man suffers and asks why.|의인의 고난', 'Songs and prayers of Israel.|이스라엘의 노래와 기도', 'Wise sayings for daily life.|삶의 지혜',
 'Life under the sun is vanity without God.|해 아래의 헛됨', 'A song of love.|사랑의 노래', 'Judgement and the promise of a coming saviour.|심판과 메시아의 약속', 'A prophet warns Judah before the fall of Jerusalem.|예루살렘 멸망 전의 경고', 'Sorrow over Jerusalem’s fall.|예루살렘을 위한 애가',
 'Visions of God’s glory and a new temple.|하나님의 영광과 새 성전', 'Faithfulness in Babylon and visions of kingdoms.|바벨론에서의 신실함과 환상', 'God’s love for an unfaithful people.|신실하지 못한 백성을 향한 사랑', 'The day of the LORD and the promise of the Spirit.|여호와의 날과 성령의 약속', 'Justice for the poor.|가난한 자를 위한 정의',
 'Judgement on Edom.|에돔에 대한 심판', 'A prophet runs from God and Nineveh repents.|요나와 니느웨', 'Do justly, love mercy, walk humbly.|공의와 인자와 겸손', 'The fall of Nineveh.|니느웨의 멸망', 'The just shall live by faith.|의인은 믿음으로 산다',
 'The day of the LORD.|여호와의 날', 'Rebuild the temple.|성전을 재건하라', 'Visions of the coming king.|오실 왕의 환상', 'Return to the LORD before the great day.|여호와께 돌아오라',
 'Jesus the King and his teaching.|왕이신 예수와 그 가르침', 'Jesus the servant, in action.|섬기는 종 예수', 'Jesus the Saviour of all people.|모든 사람의 구주 예수', 'Jesus the Son of God, that you might believe.|하나님의 아들 예수', 'The Holy Ghost and the spread of the church.|성령과 교회의 확장',
 'Righteousness by faith.|믿음으로 얻는 의', 'Problems in the church, and love.|교회의 문제들과 사랑', 'Strength in weakness.|약할 때 강함', 'Freedom in Christ.|그리스도 안의 자유', 'The church as the body of Christ.|그리스도의 몸인 교회',
 'Joy in Christ.|그리스도 안의 기쁨', 'Christ above all.|만물보다 뛰어나신 그리스도', 'Christ will come again.|그리스도의 재림', 'Keep working until he comes.|재림을 기다리며 일하라', 'Advice for a young pastor.|젊은 목회자를 위한 권면',
 'Paul’s last letter: stay faithful.|바울의 마지막 편지', 'Good works and sound teaching.|선한 일과 바른 교훈', 'Receive a runaway slave as a brother.|형제로 받아들이라', 'Jesus is greater than all.|더 나은 예수', 'Faith shows itself in works.|행함이 있는 믿음',
 'Hope in suffering.|고난 속의 소망', 'Grow in grace; beware false teachers.|은혜 안에서 자라라', 'God is love; walk in the light.|하나님은 사랑이시다', 'Walk in truth and love.|진리와 사랑', 'Welcome those who serve the truth.|진리를 위한 동역',
 'Contend for the faith.|믿음의 도를 위해 싸우라', 'The final victory of the Lamb.|어린양의 최후 승리'];
function booksPanel(onPick) {
  return SECTION.map(([a, z, en, ko]) => [el('h2', {class:'sechead'}, en + (S.set.ko ? ' · ' + ko : '')), el('div', {class:'bkgrid'}, B.slice(a, z).map((bk, k) => {
    const bi = a + k, nch = bk[3].length, read = bk[3].filter((_, ci) => S.read[bi + '.' + ci]).length;
    return el('button', {class:'bk', type:'button', onclick:() => onPick(bi)}, el('b', null, bk[0]), S.set.ko ? el('span', {class:'ko', lang:'ko'}, bk[2]) : null, el('span', null, nch + ' chapters' + (read ? ' · ' + read + ' read' : '')));
  }))]);
}
function openBook(bi) {
  const o = openOv(B[bi][0]), bk = B[bi], about = ABOUT[bi].split('|');
  const draw = () => put(o.body,
    el('header', {class:'hello'}, el('p', {class:'eyebrow'}, SECTION.find(s => bi >= s[0] && bi < s[1])[2]), el('h1', null, bk[0]), S.set.ko ? el('p', {class:'lv ko', lang:'ko'}, bk[2]) : null),
    el('p', {style:'margin:0'}, about[0]), S.set.ko ? el('p', {class:'ko', lang:'ko', style:'margin:0'}, about[1]) : null,
    el('p', {class:'tip'}, bk[3].length + ' chapters · ' + fmt(bk[3].reduce((a, c) => a + c.length, 0)) + ' verses'),
    el('div', {class:'chgrid'}, bk[3].map((_, ci) => el('button', {class:'chb' + (S.read[bi + '.' + ci] ? ' done' : ''), type:'button', onclick:() => openChapter(bi, ci)}, ci + 1))),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Study the whole book'), el('div', {class:'modes'},
      modeBtn('🆕', 'Words that first appear in ' + bk[0], 'Open them in Words', () => { WF = {mode:'and', sort:'bible', c:[{t:'first', b1:bi, c1:0, b2:bi, c2:bk[3].length - 1}, {t:'kind', v:['c', 'a', 'b']}]}; closeAll(); TAB = 'words'; render(); }),
      modeBtn('📋', 'All words in ' + bk[0], 'Open them in Words', () => { WF = {mode:'and', sort:'freq', c:[{t:'range', b1:bi, c1:0, b2:bi, c2:bk[3].length - 1}, {t:'kind', v:['c', 'a', 'b']}]}; closeAll(); TAB = 'words'; render(); }))));
  o.onReturn(draw); draw();
}

/* ---------- tabs ---------- */
const TABS = ['today', 'words', 'bible', 'study', 'me'];
let TAB = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { closeAll(); TAB = b.dataset.tab; try { history.replaceState(null, '', '#' + TAB); } catch (e) {} render(); window.scrollTo(0, 0); }));
function render() {
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === TAB ? 'page' : 'false'));
  if (OV.open) return;
  if (!LOADED) { put(view, el('header', {class:'hello'}, el('p', {class:'eyebrow'}, 'KJV Words and Bible'), el('h1', null, 'The King James Bible')), LOADERR ? el('div', {class:'empty'}, el('p', null, 'The Bible could not be loaded. Check the internet connection.'), el('button', {class:'btn', type:'button', onclick:() => location.reload()}, 'Try again')) : el('p', {class:'loading'}, 'Opening the Bible… (the first time takes a few seconds)')); return; }
  ({today:renderToday, words:renderWords, bible:renderBible, study:renderStudy, me:renderMe})[TAB]();
}
const homeLink = () => el('a', {class:'back', href:window.BW_HOME || 'index.html'}, svg(ICON.back), 'All apps');
function setWords() { return runFilter(curSet()); }
function reviewPool() {
  const from = S.set.from;
  if (from === 'star') return starred(); if (from === 'trk') return tricky();
  return WL.filter(isDue).sort((a, b) => S.p[a.k][1] - S.p[b.k][1]);
}
function startToday(only) {
  const due = only === 'new' ? [] : reviewPool().slice(0, S.set.revMax || 20);
  const left = Math.max(0, S.set.daily - todayLog()[0]);
  const fresh = only === 'review' ? [] : setWords().filter(x => !rec(x)).slice(0, only === 'new' ? (left || 5) : (left || (due.length ? 0 : 5)));
  const qs = []; due.forEach(x => { const q = makeQ(x, ['cloze', 'meaning', 'modern'][rnd(3)]) || makeQ(x, 'cloze'); if (q) { q.mode = isDue(x) ? 'review' : 'practice'; qs.push({q}); } });
  const steps = [...shuffle(qs), ...fresh.map(x => ({learn:x}))];
  if (!steps.length) { toast(only === 'review' ? 'No reviews are due today' : 'Nothing to learn in this word set'); return; }
  runSession(openOv("Today's words"), "Today's words", steps);
}
function renderToday() {
  const L = todayLog(), dueN = S.set.from === 'all' ? WL.filter(isDue).length : reviewPool().length, set = curSet(), sw = setWords(), left = sw.filter(x => !rec(x)).length;
  const learnt = WL.filter(isLearnt).length, chRead = Object.keys(S.read).length;
  const vday = (() => { const d = DAY(), mem = [...S.vstars]; const pool = mem.length ? mem : WL.length ? [vIndex(18, 22, 0), vIndex(42, 2, 15), vIndex(19, 2, 4), vIndex(22, 39, 30), vIndex(44, 7, 27), vIndex(49, 3, 12), vIndex(5, 0, 8)] : []; return pool[d % pool.length]; })();
  const memDue = S.vstars.filter(vi => (S.mem[vi] || [0, 0])[1] <= DAY());
  const plan = planToday();
  put(view, homeLink(),
    el('header', {class:'hello'}, el('p', {class:'eyebrow'}, new Date().toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'})), el('h1', null, 'KJV Words and Bible'), el('p', {class:'lv'}, 'Every word of the King James Bible, learnt through its verses')),
    el('section', {class:'panel goal'}, el('div', {class:'stats'},
      el('div', {class:'stat'}, el('span', null, 'New today'), el('b', {class:'num'}, L[0] + ' / ' + S.set.daily)),
      el('div', {class:'stat'}, el('span', null, 'Reviews due'), el('b', {class:'num'}, fmt(dueN))),
      el('div', {class:'stat'}, el('span', null, 'Words learnt'), el('b', {class:'num'}, fmt(learnt) + ' / ' + fmt(WL.length))),
      el('div', {class:'stat'}, el('span', null, 'Chapters read'), el('b', {class:'num'}, chRead + ' / 1,189')),
      el('div', {class:'stat'}, el('span', null, 'Day streak'), el('b', {class:'num'}, streak())))),
    el('button', {class:'btn primary big', type:'button', onclick:() => startToday()}, L[0] + L[1] ? 'Carry on' : "Start today's words"),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, "Today's word set"), el('b', null, describeSet(set)), el('p', {class:'tip'}, fmt(sw.length) + ' words · ' + fmt(left) + ' not started yet. Change it in Words → "Use for Today".'),
      el('div', {class:'modes'},
        modeBtn('🔁', 'Reviews only', S.set.from === 'all' ? (dueN ? fmt(dueN) + ' due today' : 'No reviews are due today') : (S.set.from === 'star' ? 'Starred' : 'Tricky') + ' words · ' + dueN, () => startToday('review'), !dueN),
        modeBtn('🌱', 'New words only', left ? 'From your word set' : 'You have started every word in this set', () => startToday('new'), !left))),
    pathPanel(renderToday),
    vday != null && vday >= 0 ? el('section', {class:'panel'}, el('p', {class:'eyebrow'}, S.vstars.length ? 'One of your memory verses' : 'A verse for today'), el('p', {class:'verse noword', lang:'en-GB'}, vNodes(vday)), el('div', {class:'row'}, el('span', {class:'ref'}, refLong(vday)), sayBtn(plainV(vday), 'sm'), el('button', {class:'btn small', type:'button', onclick:() => openChapter(V[vday][0], V[vday][1], vday)}, 'Read the chapter'))) : null,
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Bible study today'), el('div', {class:'modes'},
      plan ? modeBtn('📅', "Today's reading", plan.map(p => B[p[0]][1] + ' ' + (p[1] + 1)).join(', '), () => openChapter(plan[0][0], plan[0][1])) : null,
      modeBtn('🧠', 'Memory verses', memDue.length ? memDue.length + ' due today' : S.vstars.length ? S.vstars.length + ' verses, none due' : 'Star a verse number in any chapter', () => runVerses('Memory verses', verseQs(memDue.length ? memDue : S.vstars.slice(0, 10), 'mix'), memGrade), !S.vstars.length))));
}
/* Words tab: the filter builder */
function condUI(c, i, redraw) {
  const bookSel = (key) => el('select', {'aria-label':'Book', onchange:e => { c[key] = +e.target.value; redraw(); }}, B.map((bk, bi) => el('option', {value:bi, selected:c[key] === bi}, bk[0])));
  const chSel = (bkey, key) => el('select', {'aria-label':'Chapter', onchange:e => { c[key] = +e.target.value; redraw(); }}, B[c[bkey]][3].map((_, ci) => el('option', {value:ci, selected:c[key] === ci}, 'ch. ' + (ci + 1))));
  const checks = (opts) => el('div', {class:'chk'}, opts.map(([v, l]) => el('label', null, el('input', {type:'checkbox', checked:c.v.includes(v), onchange:e => { c.v = e.target.checked ? [...c.v, v] : c.v.filter(z => z !== v); redraw(); }}), l)));
  const num = (key, l) => el('label', {class:'not'}, l + ' ', el('input', {type:'number', value:c[key], min:'0', onchange:e => { c[key] = +e.target.value; redraw(); }}));
  let body;
  switch (c.t) {
    case 'level': body = checks([[1, '1 basic'], [2, '2 everyday'], [3, '3 intermediate'], [4, '4 upper'], [5, '5 advanced'], [6, '6 rare']]); break;
    case 'kind': body = checks([['c', 'Common'], ['a', 'Old KJV English'], ['b', 'Bible words'], ['n', 'Names']]); break;
    case 'freq': body = el('div', {class:'row', style:'gap:10px;flex-wrap:wrap'}, num('min', 'at least'), num('max', 'at most'), el('span', {class:'not'}, 'times')); break;
    case 'range': case 'first': body = el('div', {style:'display:grid;gap:6px'}, el('div', {class:'row', style:'gap:6px;flex-wrap:wrap'}, el('span', {class:'not'}, 'from'), bookSel('b1'), chSel('b1', 'c1')), el('div', {class:'row', style:'gap:6px;flex-wrap:wrap'}, el('span', {class:'not'}, 'to'), bookSel('b2'), chSel('b2', 'c2'))); break;
    case 'status': body = checks([['new', 'Not started'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['due', 'Due today'], ['starred', 'Starred'], ['tricky', 'Tricky']]); break;
    case 'ed': case 'meaning': body = el('div', {class:'seg am'}, [[true, 'Yes'], [false, 'No']].map(([v, l]) => el('button', {type:'button', 'aria-pressed':c.v === v ? 'true' : 'false', onclick:() => { c.v = v; redraw(); }}, l))); break;
    case 'len': body = el('div', {class:'row', style:'gap:10px;flex-wrap:wrap'}, num('min', 'from'), num('max', 'to'), el('span', {class:'not'}, 'letters')); break;
    case 'text': body = el('div', {class:'row', style:'gap:6px;flex-wrap:wrap'}, el('select', {onchange:e => { c.how = e.target.value; redraw(); }}, [['starts', 'starts with'], ['ends', 'ends with'], ['has', 'contains']].map(([v, l]) => el('option', {value:v, selected:c.how === v}, l))), el('input', {type:'text', value:c.s || '', placeholder:'e.g. eth', autocapitalize:'off', onchange:e => { c.s = e.target.value; redraw(); }})); break;
  }
  return el('div', {class:'cond'}, el('div', {class:'top'}, el('b', null, (i ? (WF.mode === 'or' ? 'OR ' : 'AND ') : '') + CONDS[c.t].label),
    el('div', {class:'row', style:'gap:6px'}, el('label', {class:'not'}, el('input', {type:'checkbox', checked:!!c.not, onchange:e => { c.not = e.target.checked; redraw(); }}), ' NOT'),
      el('button', {class:'cx-x', type:'button', 'aria-label':'Remove this condition', onclick:() => { WF.c.splice(i, 1); redraw(); }}, '✕'))), body);
}
let WMORE = 100;
function renderWords() {
  const list = runFilter(WF);
  const redraw = () => { WF.name = null; WMORE = 100; renderWords(); };
  const add = el('select', {class:'fld', 'aria-label':'Add a condition', onchange:e => { if (!e.target.value) return; WF.c = WF.c || []; WF.c.push(CONDS[e.target.value].make()); redraw(); }}, el('option', {value:''}, '+ Add a condition'), Object.entries(CONDS).map(([k, v]) => el('option', {value:k}, v.label)));
  put(view, homeLink(),
    el('header', {class:'hello'}, el('p', {class:'eyebrow'}, 'Words'), el('h1', null, fmt(WL.length) + ' KJV words'), el('p', {class:'lv'}, 'Every word form in the King James Bible')),
    el('details', {class:'more'}, el('summary', null, 'Ready-made word sets'), el('div', {class:'in modes'}, PRESETS.map(([t, d, f]) => modeBtn('📚', t, d, () => { WF = JSON.parse(JSON.stringify(f)); WF.name = t; WMORE = 100; renderWords(); })))),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Choose words'),
      el('div', {class:'row', style:'gap:8px;flex-wrap:wrap;align-items:center'}, el('span', {class:'lab'}, 'Match'), el('div', {class:'seg am', role:'group', 'aria-label':'Match'}, [['and', 'All conditions (AND)'], ['or', 'Any condition (OR)']].map(([v, l]) => el('button', {type:'button', 'aria-pressed':(WF.mode || 'and') === v ? 'true' : 'false', onclick:() => { WF.mode = v; redraw(); }}, l)))),
      (WF.c || []).map((c, i) => condUI(c, i, redraw)), add,
      el('div', {class:'row', style:'gap:8px;flex-wrap:wrap;align-items:center'}, el('span', {class:'lab'}, 'Order'), el('select', {class:'fld', 'aria-label':'Order', onchange:e => { WF.sort = e.target.value; renderWords(); }}, [['bible', 'Bible order (first appearance)'], ['freq', 'Most frequent first'], ['rare', 'Least frequent first'], ['level', 'By level'], ['az', 'A to Z']].map(([v, l]) => el('option', {value:v, selected:(WF.sort || 'bible') === v}, l)))),
      el('p', {style:'margin:0;font-weight:600'}, fmt(list.length) + ' words match'),
      el('div', {class:'row', style:'gap:8px;flex-wrap:wrap'},
        el('button', {class:'btn primary', type:'button', disabled:!list.length, onclick:() => { const fresh = list.filter(x => !rec(x)).slice(0, 10); if (!fresh.length) { toast('You have started every word here'); return; } runSession(openOv('Learn'), 'New words', fresh.map(x => ({learn:x}))); }}, 'Learn 10 new'),
        el('button', {class:'btn teal', type:'button', disabled:!list.length, onclick:() => startQuiz(sample(list, 40), 'Word quiz', {n:15})}, 'Quiz me'),
        el('button', {class:'btn', type:'button', disabled:!list.length, onclick:() => { S.set.wordset = JSON.parse(JSON.stringify(WF)); S.set.wordset.name = S.set.wordset.name || describeSet(WF); save(); toast("Saved as Today's word set"); }}, 'Use for Today'),
        el('button', {class:'btn ghost', type:'button', onclick:() => { WF = {mode:'and', sort:'bible', c:[]}; redraw(); }}, 'Clear'))),
    el('div', {class:'wlist'}, list.slice(0, WMORE).map(x => wordRow(x, list))),
    list.length > WMORE ? el('button', {class:'btn', type:'button', onclick:() => { WMORE += 200; renderWords(); }}, 'Show more (' + fmt(list.length - WMORE) + ' left)') : null);
}
let BQ = '';
function renderBible() {
  const res = el('div', {style:'display:grid;gap:8px'});
  const search = () => {
    const q = BQ.trim().toLowerCase(); if (q.length < 3) { put(res); return; }
    const out = []; for (let i = 0; i < V.length && out.length < 200; i++) if (plainV(i).toLowerCase().includes(q)) out.push(i);
    let total = 0; if (out.length >= 200) { for (let i = 0; i < V.length; i++) if (plainV(i).toLowerCase().includes(q)) total++; }
    put(res, el('p', {class:'tip'}, (out.length >= 200 ? fmt(total) + ' verses; the first 200:' : out.length + ' verses')), out.map(i => el('button', {class:'vrow', type:'button', onclick:() => openChapter(V[i][0], V[i][1], i)}, el('span', {class:'ref'}, refLong(i)), el('span', {class:'verse'}, plainV(i)))));
  };
  const inp = el('input', {class:'field', type:'search', placeholder:'Search the Bible (3+ letters)', value:BQ, 'aria-label':'Search the Bible', autocapitalize:'off', oninput:e => { BQ = e.target.value; clearTimeout(inp.t); inp.t = setTimeout(search, 250); }});
  const last = S.last && V[S.last] ? S.last : null;
  put(view, homeLink(), el('header', {class:'hello'}, el('p', {class:'eyebrow'}, 'Bible'), el('h1', null, 'The King James Bible'), el('p', {class:'lv'}, '66 books · 1,189 chapters · 31,102 verses · 1769 text with the 1611 first edition')),
    last != null ? el('button', {class:'btn teal', type:'button', onclick:() => openChapter(V[last][0], V[last][1], last)}, 'Carry on reading: ' + refLong(last)) : null,
    inp, res, booksPanel(openBook));
  search();
}
function planChapters() { const all = CH.map(c => [c[0], c[1]]); if (S.set.plan === 'nt') return all.filter(c => c[0] >= 39); return all; }
function planToday() {
  if (!S.set.planStart) return null;
  const all = planChapters(), days = S.set.plan === 'nt' ? 90 : 365, per = Math.ceil(all.length / days), d = DAY() - S.set.planStart;
  return all.slice(d * per, d * per + per).filter(Boolean);
}
function renderStudy() {
  const memDue = S.vstars.filter(vi => (S.mem[vi] || [0, 0])[1] <= DAY());
  const plan = planToday();
  const rangePick = (() => {   // practise a passage: book, chapter and verse range
    const st = S.rng || (S.rng = {b:42, c:0, v1:0, v2:13});
    const box = el('div', {style:'display:grid;gap:8px'});
    const draw = () => {
      const nv = B[st.b][3][st.c].length; st.v1 = Math.min(st.v1, nv - 1); st.v2 = Math.min(Math.max(st.v2, st.v1), nv - 1);
      const vsel = (key) => el('select', {class:'fld', onchange:e => { st[key] = +e.target.value; save(); draw(); }}, Array.from({length:nv}, (_, k) => el('option', {value:k, selected:st[key] === k}, 'v. ' + (k + 1))));
      const start = CH[chIndex(st.b, st.c)][2], vis = Array.from({length:st.v2 - st.v1 + 1}, (_, k) => start + st.v1 + k);
      const ws = new Map(); vis.forEach(i => { for (const m of plainV(i).matchAll(TOK)) { const x = WM.get(keyOf(m[0])); if (x && x.kind !== 'n') ws.set(x.k, x); } });
      put(box, el('div', {class:'row', style:'gap:6px;flex-wrap:wrap'},
          el('select', {class:'fld', onchange:e => { st.b = +e.target.value; st.c = 0; st.v1 = 0; st.v2 = 0; save(); draw(); }}, B.map((bk, bi) => el('option', {value:bi, selected:st.b === bi}, bk[0]))),
          el('select', {class:'fld', onchange:e => { st.c = +e.target.value; st.v1 = 0; st.v2 = 0; save(); draw(); }}, B[st.b][3].map((_, ci) => el('option', {value:ci, selected:st.c === ci}, 'chapter ' + (ci + 1))))),
        el('div', {class:'row', style:'gap:6px;flex-wrap:wrap'}, el('span', {class:'not'}, 'verses'), vsel('v1'), el('span', {class:'not'}, 'to'), vsel('v2')),
        el('p', {class:'tip'}, refLong(vis[0]) + (vis.length > 1 ? '–' + (st.v2 + 1) : '') + ' · ' + vis.length + ' verses · ' + ws.size + ' different words'),
        el('div', {class:'modes'},
          modeBtn('📖', 'Read these verses', '', () => openChapter(st.b, st.c, vis[0])),
          modeBtn('✍️', 'Fill the blanks', 'Write the missing words', () => runVerses('Blanks · ' + B[st.b][1] + ' ' + (st.c + 1), verseQs(vis, 'blanks'))),
          modeBtn('🧩', 'Put in order', 'Build each verse from its words', () => runVerses('Order · ' + B[st.b][1] + ' ' + (st.c + 1), verseQs(vis, 'order'))),
          modeBtn('🔤', 'First letters', 'Type each verse from memory', () => runVerses('First letters · ' + B[st.b][1] + ' ' + (st.c + 1), verseQs(vis, 'letters'))),
          modeBtn('🎯', 'Word quiz on this passage', 'Questions made from these verses', () => startQuiz([...ws.values()].filter(x => x.lv >= 2), 'Passage words', {n:15}), ws.size < 3),
          modeBtn('⭐', 'Add to memory verses', '', () => { vis.forEach(vi => { if (!S.vstars.includes(vi)) { S.vstars.push(vi); S.mem[vi] = [0, DAY()]; } }); save(); toast(vis.length + ' verses added'); renderStudy(); })));
    };
    draw(); return box;
  })();
  put(view, homeLink(), el('header', {class:'hello'}, el('p', {class:'eyebrow'}, 'Study'), el('h1', null, 'Bible study')),
    pathPanel(renderStudy),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Study a passage · book, chapter, verse'), rangePick),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Memory verses'),
      el('p', {style:'margin:0'}, S.vstars.length ? S.vstars.length + ' verses · ' + memDue.length + ' due today. A verse comes back after 1, 3, 7, 16, 35, 90 and 180 days.' : 'Tap a verse number in any chapter and choose "Add to memory verses".'),
      S.vstars.length ? el('div', {class:'modes'}, modeBtn('🧠', 'Practise the verses due', memDue.length + ' due', () => runVerses('Memory verses', verseQs(memDue, 'mix'), memGrade), !memDue.length), modeBtn('🔁', 'Practise all of them', S.vstars.length + ' verses', () => runVerses('Memory verses', verseQs(shuffle(S.vstars).slice(0, 15), 'mix'), memGrade))) : null,
      S.vstars.length ? el('div', {style:'display:grid;gap:6px'}, S.vstars.slice(0, 30).map(vi => el('button', {class:'vrow', type:'button', onclick:() => verseMenu(vi, renderStudy)}, el('span', {class:'ref'}, refLong(vi) + (S.notes[vi] ? ' · note' : '')), el('span', {class:'verse'}, plainV(vi))))) : null),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'Reading plan'),
      el('div', {class:'seg am', role:'group', 'aria-label':'Plan'}, [['year', 'Whole Bible in a year'], ['nt', 'New Testament in 90 days']].map(([v, l]) => el('button', {type:'button', 'aria-pressed':S.set.plan === v ? 'true' : 'false', onclick:() => { S.set.plan = v; save(); renderStudy(); }}, l))),
      S.set.planStart ? [el('p', {style:'margin:0'}, 'Day ' + (DAY() - S.set.planStart + 1) + '. Today: ' + (plan && plan.length ? plan.map(p => B[p[0]][0] + ' ' + (p[1] + 1)).join(', ') : 'the plan is finished!')),
        plan && plan.length ? el('div', {class:'chgrid'}, plan.map(p => el('button', {class:'chb' + (S.read[p[0] + '.' + p[1]] ? ' done' : ''), type:'button', title:B[p[0]][0] + ' ' + (p[1] + 1), onclick:() => openChapter(p[0], p[1])}, B[p[0]][1] + ' ' + (p[1] + 1)))) : null,
        el('button', {class:'btn ghost', type:'button', onclick:() => { S.set.planStart = null; save(); renderStudy(); }}, 'Stop the plan')]
        : el('button', {class:'btn primary', type:'button', onclick:() => { S.set.planStart = DAY(); save(); renderStudy(); }}, 'Start today')),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'KJV English'), el('p', {style:'margin:0'}, 'The KJV was translated in 1611. Learn how its English works before you read.'), el('div', {class:'modes'},
      LESSONS.map(([t, d, body]) => modeBtn('📜', t, d, () => { const o = openOv(t); put(o.body, el('div', {class:'lesson'}, body())); })),
      modeBtn('🔤', 'Quiz: 1611 spelling', 'vnto, haue, sonne … how are they spelled today?', () => startQuiz(WL.filter(x => spelledDiff(x) && x.kind !== 'n' && x.n >= 10), '1611 spelling', {kinds:['sp1611'], n:15})),
      modeBtn('🎯', 'Quiz: old words in modern English', 'thou, hath, wherefore, peradventure …', () => startQuiz(WL.filter(x => x.kind === 'a' && meaningOf(x) && !meaningOf(x).via && x.n >= 3), 'Old KJV English', {kinds:['modern', 'cloze'], n:15})))),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'My Korean translations'), Object.keys(S.tr).length ? el('div', {style:'display:grid;gap:6px'}, Object.keys(S.tr).map(Number).sort((a, b) => a - b).slice(-50).reverse().map(vi => el('button', {class:'vrow', type:'button', onclick:() => verseMenu(vi, renderStudy)}, el('span', {class:'ref'}, refLong(vi)), el('span', {class:'verse'}, plainV(vi)), el('span', {class:'ko', lang:'ko'}, S.tr[vi])))) : el('p', {class:'tip'}, 'Translations you write in the Bible-order study appear here.')),
    el('section', {class:'panel'}, el('p', {class:'eyebrow'}, 'My notes'), Object.keys(S.notes).length ? el('div', {style:'display:grid;gap:6px'}, Object.entries(S.notes).map(([vi, t]) => el('button', {class:'vrow', type:'button', onclick:() => verseMenu(+vi, renderStudy)}, el('span', {class:'ref'}, refLong(+vi)), el('span', null, t)))) : el('p', {class:'tip'}, 'Notes you write on verses appear here.')));
}
const glossRows = ws => el('div', {class:'gloss'}, ws.map(k => { const x = WM.get(k), m = x && meaningOf(x); return el('div', null, el('b', null, k), el('span', null, m ? (m.src === 'KJV+' ? m.note : m.def) : '', S.set.ko && m && m.ko && m.src !== 'KJV+' ? el('span', {class:'ko'}, ' · ' + m.ko) : null)); }));
const exV = (b, c, v) => { const i = vIndex(b, c, v); return el('div', {class:'vrow'}, el('span', {class:'ref'}, refLong(i)), el('p', {class:'verse noword'}, vNodes(i))); };
const LESSONS = [
  ['Thou, thee, thy, ye', 'Two kinds of "you"', () => [el('p', null, 'In 1611 English still had a singular you and a plural you. The KJV keeps them, so you can tell whether one person or many are meant.'), glossRows(['thou', 'thee', 'thy', 'thine', 'ye']), el('h3', null, 'In the Bible'), exV(1, 19, 2), exV(42, 13, 0)]],
  ['-eth and -est', 'he goeth, thou goest', () => [el('p', null, 'Verbs had two old endings. -eth (or -th) goes with he, she and it, where we now say -s. -est (or -st) goes with thou.'), el('ul', null, el('li', null, 'he loveth = he loves · she saith = she says · it hath = it has · he doth = he does'), el('li', null, 'thou lovest = you love · thou hast = you have · thou art = you are · thou shalt = you shall')), exV(42, 2, 15), exV(19, 2, 4)]],
  ['Words that changed their meaning', 'let, prevent, conversation, meat …', () => [el('p', null, 'Some words look modern but meant something else in 1611. Read them with care.'), glossRows(['suffer', 'prevent', 'let', 'conversation', 'charity', 'meat', 'corn', 'quick', 'want', 'meet', 'divers', 'ghost'])]],
  ['Old little words', 'unto, wherefore, lest, behold …', () => [el('p', null, 'These small words appear thousands of times.'), glossRows(['unto', 'behold', 'lo', 'yea', 'nay', 'verily', 'wherefore', 'whither', 'whence', 'thither', 'hither', 'thence', 'thereof', 'wherein', 'lest', 'howbeit', 'peradventure', 'withal'])]],
  ['Old past forms', 'spake, smote, begat, wrought …', () => [glossRows(['spake', 'smote', 'slew', 'sware', 'begat', 'wrought', 'brake', 'bare', 'gat', 'clave', 'digged', 'forgat', 'shewed', 'dwelt', 'abode'])]],
  ['Numbers and measures', 'threescore, cubit, shekel …', () => [el('p', null, 'A score is twenty, so threescore and ten is seventy.'), glossRows(['score', 'threescore', 'fourscore', 'twain', 'cubit', 'shekel', 'talent', 'ephah', 'hin', 'omer']), exV(18, 89, 9)]],
  ['1611 and 1769', 'the first edition and the standard text', () => {
    const ed = WD.ed || {}, box = el('div', {style:'display:grid;gap:8px'});
    const exPair = (b, c, v) => { const i = vIndex(b, c, v); return el('div', {class:'vrow'}, el('span', {class:'ref'}, refLong(i) + ' · 1769'), el('p', {class:'verse noword'}, vNodes(i)), el('span', {class:'ref'}, '1611'), el('p', {class:'verse old noword'}, oldNodes(i))); };
    loadOld().then(() => fetch('kjv/ed.json').then(r => r.json())).then(j => put(box, exPair(0, 0, 1), exPair(42, 2, 15), exPair(7, 2, 14),
      el('h3', null, 'Verses with the most changes in wording'), el('p', null, 'Besides spelling, the revisers corrected printing mistakes and changed some words. These verses changed most (pink words differ):'),
      j.changed.slice(0, 15).map(([b, c, v]) => exPair(b, c, v)))).catch(() => put(box, el('p', {class:'muted'}, 'The 1611 text could not be loaded.')));
    return [el('p', null, 'The King James Version was first printed in 1611 by Robert Barker in London. English spelling was not yet fixed, so the first edition prints vnto, haue, sonne and citie. Corrections were made in 1629 and 1638 at Cambridge. In 1769 Benjamin Blayney at Oxford revised the whole text: he made the spelling regular, corrected mistakes and checked the italics. Almost every KJV printed today follows that 1769 revision, with small differences between the Oxford and Cambridge printings.'),
      el('p', null, 'This app uses the 1769 text as its main text and shows the 1611 first edition beside it. The two editions share the same words and verses; what changed is mostly how the words were written.'),
      el('h3', null, 'How the spelling changed'),
      el('ul', null, (ed.pat || []).map(([p, n]) => el('li', null, p + ': ' + fmt(n) + ' times'))),
      el('p', null, fmt(ed.same || 0) + ' word forms are spelled the same in both editions; ' + fmt(ed.diff || 0) + ' were printed differently in 1611.'),
      el('h3', null, 'Side by side'), box];
  }],
  ['Italics, LORD and GOD', 'how to read the page', () => [el('h3', null, 'Words in italics'), el('p', null, 'The translators printed in italics the words they added to make the English read well. They are not in the Hebrew or Greek. In this app they are shown in italics too.'), exV(0, 0, 9), el('h3', null, 'LORD in capitals'), el('p', null, 'LORD in capital letters stands for God’s personal name in Hebrew (YHWH). Lord in small letters translates a word meaning master.'), exV(18, 109, 0)]]];
function renderMe() {
  const learnt = WL.filter(isLearnt).length, mast = WL.filter(x => status(x) === 3).length;
  const pick = (label, key, opts) => el('div', {class:'seg', role:'group', 'aria-label':label}, opts.map(([v, t]) => el('button', {type:'button', 'aria-pressed':S.set[key] === v ? 'true' : 'false', onclick:() => { S.set[key] = v; save(); applySize(); renderMe(); }}, t)));
  const am = answerMode();
  const exp = () => { const a = el('a', {href:URL.createObjectURL(new Blob([JSON.stringify(S)], {type:'application/json'})), download:'kjv-progress-' + new Date().toISOString().slice(0, 10) + '.json'}); a.click(); };
  const imp = el('input', {type:'file', accept:'application/json', hidden:true, onchange:e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { const j = JSON.parse(t); S = Object.assign(blank(), j); S.set = Object.assign(blank().set, j.set || {}); save(); toast('Progress restored'); renderMe(); }).catch(() => toast('That file could not be read')); }});
  put(view, homeLink(), el('header', {class:'hello'}, el('p', {class:'eyebrow'}, 'Me'), el('h1', null, 'My progress')),
    el('div', {class:'tiles'},
      el('div', {class:'tile'}, el('b', {class:'num'}, fmt(learnt)), el('span', null, 'words learnt')),
      el('div', {class:'tile'}, el('b', {class:'num'}, fmt(mast)), el('span', null, 'mastered')),
      el('div', {class:'tile'}, el('b', {class:'num'}, Object.keys(S.read).length), el('span', null, 'chapters read')),
      el('div', {class:'tile'}, el('b', {class:'num'}, S.vstars.length), el('span', null, 'memory verses'))),
    el('div', {class:'list'},
      el('button', {class:'item', type:'button', onclick:() => openRecord()}, el('span', {class:'id'}, '🗓️'), el('span', null, el('div', {style:'font-weight:600'}, 'My study record'), el('div', {class:'d'}, 'By date, by passage and on a calendar · ' + S.hist.length + ' entries')), el('span', null, '›')),
      el('button', {class:'item', type:'button', onclick:() => { const o = openOv('Starred words'); const l = starred(); put(o.body, l.length ? el('div', {class:'wlist'}, l.map(x => wordRow(x, l))) : el('p', {class:'empty'}, 'Tap Star on a word to keep it here.')); }}, el('span', {class:'id'}, '⭐'), el('span', null, el('div', {style:'font-weight:600'}, 'Starred words'), el('div', {class:'d'}, S.stars.length + ' words')), el('span', null, '›')),
      el('button', {class:'item', type:'button', onclick:() => { const o = openOv('Tricky words'); const l = tricky(); put(o.body, l.length ? el('div', {class:'wlist'}, l.map(x => wordRow(x, l))) : el('p', {class:'empty'}, 'Words you get wrong appear here.')); }}, el('span', {class:'id'}, '🧩'), el('span', null, el('div', {style:'font-weight:600'}, 'Tricky words'), el('div', {class:'d'}, tricky().length + ' words')), el('span', null, '›'))),
    el('section', {class:'panel set'}, el('p', {class:'eyebrow'}, 'Settings'),
      el('span', {class:'lab'}, 'New words a day'), pick('New words a day', 'daily', [5, 10, 15, 20, 30].map(n => [n, String(n)])),
      el('span', {class:'lab'}, 'Most reviews at a time'), pick('Most reviews at a time', 'revMax', [5, 10, 20, 30, 50].map(n => [n, String(n)])),
      optSegs(renderMe),
      el('p', {class:'tip'}, 'Every word: each word of each verse is learnt once, the first time it appears; words you have learnt are not taught again. With a level, only words from that level are taught (old KJV English and Bible words from level 2).'),
      el('span', {class:'lab'}, 'Reviews come from'), pick('Reviews come from', 'from', [['all', 'All words'], ['star', 'Starred'], ['trk', 'Tricky']]),
      el('span', {class:'lab'}, 'How to answer word questions'), el('div', {class:'seg', role:'group'}, [['choose', 'Choose'], ['see', 'See & type'], ['type', 'Type']].map(([k, l]) => el('button', {type:'button', 'aria-pressed':am === k ? 'true' : 'false', onclick:() => { try { localStorage.setItem(ANSWER_KEY, k); } catch (e) {} renderMe(); }}, l))),
      el('span', {class:'lab'}, 'Korean meanings · 한국어 뜻'), pick('Korean', 'ko', [[true, '한국어 뜻 보기'], [false, 'English only']]),
      el('span', {class:'lab'}, 'Text size'), pick('Text size', 'size', [['normal', 'Normal'], ['large', 'Large']]),
      el('span', {class:'lab'}, 'Background'), el('div', {class:'seg', role:'group'}, [['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => el('button', {type:'button', 'aria-pressed':(document.documentElement.classList.contains('light') ? 'light' : 'dark') === k ? 'true' : 'false', onclick:() => { try { localStorage.setItem('bw-bg', k); } catch (e) {} document.documentElement.classList.toggle('light', k === 'light'); renderMe(); }}, l))),
      SPEECH ? [el('span', {class:'lab'}, 'Read aloud (British voice)'), pick('Voice', 'voice', [[true, 'On'], [false, 'Off']])] : null,
      el('p', {class:'tip'}, 'How levels work: words in the app\'s other courses take the level of that course (1 basic to 5 advanced). Other words get a level from how often the KJV uses them; level 6 is rare. Kinds: Old KJV English (A), Bible words (B), Names (N).'),
      el('p', {class:'tip'}, 'Your progress is saved in this browser. Save a copy to move it to another device.'),
      el('div', {class:'row', style:'gap:8px;flex-wrap:wrap'}, el('button', {class:'btn', type:'button', onclick:exp}, 'Save a copy'), el('button', {class:'btn', type:'button', onclick:() => imp.click()}, 'Restore a copy'), imp),
      el('p', {class:'tip'}, 'Main text: the standard King James text that follows Blayney\'s 1769 revision, in the form printed today (the Cambridge text, e.g. "she went into the city" in Ruth 3:15). Also the 1611 first edition, from a transcription. Both are public domain. Meanings, Korean and lessons are written for this app.'),
      el('button', {class:'btn ghost', type:'button', onclick:() => { if (confirm('Delete all progress in the KJV app? This cannot be undone.')) { const keep = S.set; S = blank(); S.set = keep; save(); renderMe(); } }}, 'Reset my progress')));
}
render();
})();
