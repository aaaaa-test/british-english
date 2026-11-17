# Adds the 1611 first edition: kjv/bible1611.json (the text, verse by verse, aligned with the main text) and, in
# kjv/words.json, how each main-text word was spelled in 1611 ("o": [[spelling, count], ...], "s": times spelled the same).
# Also writes kjv/ed.json: counts for the comparison lesson (spelling patterns, verses with wording changes).
# usage: python3 -I build1611.py <dir with the 1611 book files> <repo>   (run after build_kjv.py)
import json, re, sys, os, html, difflib, collections
d, repo = sys.argv[1], sys.argv[2]
names = json.load(open(os.path.join(d, 'Books.json')))[:66]
main = json.load(open(os.path.join(repo, 'kjv', 'bible.json'), encoding='utf-8'))
W = json.load(open(os.path.join(repo, 'kjv', 'words.json'), encoding='utf-8'))
old = []
for bi, n in enumerate(names):
    chs = []
    for ch in json.load(open(os.path.join(d, n + '.json'), encoding='utf-8'))['chapters']:
        vs = {v['verse']: v['text'] for v in ch['verses']}
        chs.append(vs)
    mb = main['b'][bi][3]
    assert len(chs) == len(mb), n
    old.append([[re.sub(r'\s+', ' ', html.unescape(chs[ci].get(vi + 1, '')).replace('`', "'")).strip() for vi in range(len(mb[ci]))] for ci in range(len(mb))])
json.dump({'v': 'KJV 1611 first edition (transcription, public domain text)', 'b': old}, open(os.path.join(repo, 'kjv', 'bible1611.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

TOK = re.compile(r"[A-Za-zþōēāū]+(?:['’][A-Za-z]+)*")
EXP = {'þ': 'th', 'ō': 'on', 'ē': 'en', 'ā': 'an', 'ū': 'un'}
def norm(w):   # a spelling skeleton that ignores 1611 conventions
    w = w.lower().replace('’', "'")
    if w == 'þ': w = 'the'
    w = ''.join(EXP.get(ch, ch) for ch in w)
    w = w.replace('v', 'u').replace('j', 'i').replace('y', 'i')
    w = re.sub(r"'s$", '', w); w = re.sub(r'(.)\1+', r'\1', w); w = re.sub(r'e$', '', w)
    return w
spell = collections.defaultdict(collections.Counter)
pat = collections.Counter(); verses_changed = 0; changed_refs = []
for bi in range(66):
    for ci, vs in enumerate(main['b'][bi][3]):
        for vi, t in enumerate(vs):
            A = [m.group(0) for m in TOK.finditer(t.replace('[', '').replace(']', ''))]
            Bt = [m.group(0) for m in TOK.finditer(old[bi][ci][vi])]
            na, nb = [norm(x) for x in A], [norm(x) for x in Bt]
            sm = difflib.SequenceMatcher(a=na, b=nb, autojunk=False)
            real = 0
            for op, a1, a2, b1, b2 in sm.get_opcodes():
                if op == 'equal':
                    for k in range(a2 - a1): spell[re.sub(r"['’]s$", '', A[a1 + k]).lower()][re.sub(r"['’]s$", '', Bt[b1 + k]).lower()] += 1
                elif op == 'replace' and a2 - a1 == b2 - b1:
                    for k in range(a2 - a1):
                        x, y = A[a1 + k], Bt[b1 + k]
                        if norm(x) == norm(y) or difflib.SequenceMatcher(a=norm(x), b=norm(y)).ratio() >= .8: spell[re.sub(r"['’]s$", '', x).lower()][re.sub(r"['’]s$", '', y).lower()] += 1
                        else: real += 1
                else: real += max(a2 - a1, b2 - b1)
            if real: verses_changed += 1; changed_refs.append([bi, ci, vi, real])
same = diff = 0
for k, e in W['w'].items():
    c = spell.get(k)
    if not c: continue
    s = c.get(k, 0); top = [w for w, n in c.most_common() if w != k][:1]
    other = [[w, n] for w, n in c.most_common() if w != k and (n >= 2 or w in top)][:4]
    e_extra = {'s': s}
    if other: e_extra['o'] = other
    # words.json entries are lists: [count, level, kind, base?]; spellings go in a parallel map
    W.setdefault('o', {})[k] = [s] + [x for p in other for x in p]
    if sum(n for _, n in other) > s: diff += 1
    else: same += 1
    for w, n in other:   # spelling patterns
        a, b = k, w
        if 'v' in b and b.replace('v', 'u') == a: pat['v for u (vnto = unto)'] += n
        elif 'u' in b and b.replace('u', 'v') == a: pat['u for v (haue = have)'] += n
        elif b.replace('i', 'j') == a: pat['i for j (Iesus = Jesus)'] += n
        elif b == a + 'e': pat['an extra final e (sonne, olde)'] += n
        elif re.sub(r'(.)\1', r'\1', b) == re.sub(r'(.)\1', r'\1', a): pat['double or single letters (sinne, shall)'] += n
        elif b.endswith('ie') and a.endswith('y'): pat['-ie for -y (citie = city)'] += n
        else: pat['other spelling'] += n
W['ed'] = {'same': same, 'diff': diff, 'pat': pat.most_common(), 'changed': verses_changed}
json.dump(W, open(os.path.join(repo, 'kjv', 'words.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
changed_refs.sort(key=lambda r: -r[3])
json.dump({'changed': changed_refs}, open(os.path.join(repo, 'kjv', 'ed.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print('forms spelled the same in 1611:', same, '· spelled differently:', diff, '· verses with wording changes:', verses_changed)
print('patterns:', pat.most_common())
for k in ['unto', 'have', 'jesus', 'son', 'city', 'the', 'from', 'when', 'heaven', 'believeth', 'shew', 'sin', 'old']: print(k, W['o'].get(k))
print('sizes', os.path.getsize(os.path.join(repo, 'kjv', 'bible1611.json')), os.path.getsize(os.path.join(repo, 'kjv', 'words.json')), os.path.getsize(os.path.join(repo, 'kjv', 'ed.json')))
