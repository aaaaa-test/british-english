# Builds the data for kjv.html: kjv/bible.json (the text) and kjv/words.json (level, kind, base form and meanings
# for every word form in the KJV). usage: python3 -I build_kjv.py <KJV.json> <gloss.txt> <repo>
import json, re, sys, glob, os, collections
src, gloss_path, repo = sys.argv[1], sys.argv[2], sys.argv[3]
kj = json.load(open(src, encoding='utf-8-sig'))
BOOKS = [('Genesis','Gen','창세기'),('Exodus','Exod','출애굽기'),('Leviticus','Lev','레위기'),('Numbers','Num','민수기'),('Deuteronomy','Deut','신명기'),
 ('Joshua','Josh','여호수아'),('Judges','Judg','사사기'),('Ruth','Ruth','룻기'),('1 Samuel','1Sam','사무엘상'),('2 Samuel','2Sam','사무엘하'),
 ('1 Kings','1Kgs','열왕기상'),('2 Kings','2Kgs','열왕기하'),('1 Chronicles','1Chr','역대상'),('2 Chronicles','2Chr','역대하'),('Ezra','Ezra','에스라'),
 ('Nehemiah','Neh','느헤미야'),('Esther','Esth','에스더'),('Job','Job','욥기'),('Psalms','Ps','시편'),('Proverbs','Prov','잠언'),
 ('Ecclesiastes','Eccl','전도서'),('Song of Solomon','Song','아가'),('Isaiah','Isa','이사야'),('Jeremiah','Jer','예레미야'),('Lamentations','Lam','예레미야애가'),
 ('Ezekiel','Ezek','에스겔'),('Daniel','Dan','다니엘'),('Hosea','Hos','호세아'),('Joel','Joel','요엘'),('Amos','Amos','아모스'),
 ('Obadiah','Obad','오바댜'),('Jonah','Jonah','요나'),('Micah','Mic','미가'),('Nahum','Nah','나훔'),('Habakkuk','Hab','하박국'),
 ('Zephaniah','Zeph','스바냐'),('Haggai','Hag','학개'),('Zechariah','Zech','스가랴'),('Malachi','Mal','말라기'),
 ('Matthew','Matt','마태복음'),('Mark','Mark','마가복음'),('Luke','Luke','누가복음'),('John','John','요한복음'),('Acts','Acts','사도행전'),
 ('Romans','Rom','로마서'),('1 Corinthians','1Cor','고린도전서'),('2 Corinthians','2Cor','고린도후서'),('Galatians','Gal','갈라디아서'),('Ephesians','Eph','에베소서'),
 ('Philippians','Phil','빌립보서'),('Colossians','Col','골로새서'),('1 Thessalonians','1Thess','데살로니가전서'),('2 Thessalonians','2Thess','데살로니가후서'),
 ('1 Timothy','1Tim','디모데전서'),('2 Timothy','2Tim','디모데후서'),('Titus','Titus','디도서'),('Philemon','Phlm','빌레몬서'),('Hebrews','Heb','히브리서'),
 ('James','Jas','야고보서'),('1 Peter','1Pet','베드로전서'),('2 Peter','2Pet','베드로후서'),('1 John','1John','요한일서'),('2 John','2John','요한이서'),
 ('3 John','3John','요한삼서'),('Jude','Jude','유다서'),('Revelation','Rev','요한계시록')]
assert len(kj['books']) == 66
bible = []
for (name, ab, ko), b in zip(BOOKS, kj['books']):
    chs = []
    for ch in b['chapters']:
        vs = [re.sub(r'\s+', ' ', v['text']).strip() for v in ch['verses']]
        chs.append(vs)
    bible.append([name, ab, ko, chs])
os.makedirs(os.path.join(repo, 'kjv'), exist_ok=True)
json.dump({'v': 'KJV 1769 (public domain)', 'b': bible}, open(os.path.join(repo, 'kjv', 'bible.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---- word forms: the same tokens the app uses (letters with inner apostrophes; possessive 's dropped)
TOK = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)*")
cnt, low = collections.Counter(), collections.Counter()
for bk in bible:
    for vs in bk[3]:
        for t in vs:
            tt = t.replace('[', '').replace(']', '')
            for m in TOK.finditer(tt):
                w = re.sub(r"['’]s$", '', m.group(0).replace('’', "'"))
                k = w.lower(); cnt[k] += 1
                if not w[0].isupper() and not (m.start() > 0 and tt[m.start() - 1] in '-–'): low[k] += 1   # Beth-lehem-judah: parts of a name

# ---- meanings: the app's own word lists, then the KJV glossary
DEF = {}   # key -> [meaning, korean, note, source]
LV = {}    # key -> level 1-5 from the app's lists
s = open(os.path.join(repo, 'words.html'), encoding='utf-8').read()
kom = {}
for l in re.search(r'id="koData"[^>]*>(.*?)</script>', s, re.S).group(1).split('\n'):
    if '|' in l: a, b2 = l.strip().split('|', 1); kom[a] = b2
for i, l in enumerate([l for l in re.search(r'id="wordData"[^>]*>(.*?)</script>', s, re.S).group(1).split('\n') if '|' in l]):
    p = l.split('|'); w = p[0].strip().lower()
    if ' ' in w: continue
    lv = i // 500 + 1
    LV[w] = min(LV.get(w, 9), 1 if lv <= 3 else 2 if lv <= 6 else 3)
    DEF.setdefault(w, [p[2].strip(), kom.get(p[0].strip(), ''), '', 'Words'])
BOOKLV = {'evu-e': 3, 'evu-p': 3, 'evu-u': 4, 'col-i': 4, 'pv-i': 4, 'idm': 4, 'avu': 4, 'pr-e': 3, 'pr-i': 4, 'evu-a': 5, 'col-a': 5, 'pv-a': 5, 'cv': 5, 'wp': 5, 'ielts': 5}
for bid in ['evu-e', 'evu-p', 'evu-u', 'avu', 'evu-a', 'col-i', 'col-a', 'pv-i', 'pv-a', 'idm', 'cv', 'wp', 'ielts']:
    f = os.path.join(repo, 'courses', bid + '.json')
    if not os.path.exists(f): continue
    c = json.load(open(f, encoding='utf-8'))
    kof = os.path.join(repo, 'courses', 'ko', bid + '.json'); kk = json.load(open(kof, encoding='utf-8')) if os.path.exists(kof) else {}
    for u in c['units']:
        for l in u.get('W', []) or []:
            p = l.split('|'); w = p[0].replace('{', '').replace('}', '').strip()
            if ' ' in w or not p[2:3] or not p[2].strip(): continue
            k = w.lower()
            LV[k] = min(LV.get(k, 9), BOOKLV[bid])
            DEF.setdefault(k, [p[2].strip(), kk.get(f"{u['n']}:{w}", ''), '', bid])
KIND = {}
for l in open(gloss_path, encoding='utf-8'):
    if not l.strip() or l.startswith('#'): continue
    p = [x.strip() for x in l.rstrip('\n').split('|')]
    w = p[0].lower()
    if w in ('gave',): continue
    note = p[4] if len(p) > 4 else ''
    if p[3] == 'a!' and w in DEF:   # the KJV sense is the usual one in the Bible: show it first
        DEF[w] = [p[1], p[2], (note + ' Today it usually means: ' + DEF[w][0]).strip(), 'KJV']; KIND[w] = 'a'
        continue
    if p[3] == 'a' and w in DEF and w in LV:   # a modern word with an old KJV sense: keep the modern meaning, add the KJV one
        m = DEF[w]
        DEF[w] = [m[0], m[1], ('In the KJV it can also mean: ' + p[1] + ' (' + p[2] + '). ' + note).strip(), 'KJV+']
        continue
    DEF[w] = [p[1], p[2], note, 'KJV']   # the KJV glossary gives the Bible sense
    KIND[w] = p[3]
# more KJV meanings so that every word can be learnt in this app alone: g2/*.txt  head|meaning|korean|note|kind
HEADOF = {}
for l in open(os.path.join(os.path.dirname(os.path.abspath(gloss_path)), 'heads.txt'), encoding='utf-8'):
    p = l.rstrip('\n').split('\t')
    for f in p[1].split(): HEADOF[f] = p[0]
for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(gloss_path)), 'g2', '*.txt'))):
    for l in open(f, encoding='utf-8'):
        if not l.strip() or l.startswith('#'): continue
        p = [x.strip() for x in l.rstrip('\n').split('|')] + ['', '', '']
        w = p[0].lower()
        if w in DEF: continue
        DEF[w] = [p[1], p[2], p[3], 'KJV']
        kd = next((x for x in p[4:] if x in ('a', 'b')), None)
        if kd: KIND[w] = kd
# the sense a common word usually has in the KJV comes first (kjvsense.txt)
for l in open(os.path.join(os.path.dirname(os.path.abspath(gloss_path)), 'kjvsense.txt'), encoding='utf-8'):
    if not l.strip() or l.startswith('#'): continue
    p = [x.strip() for x in l.rstrip('\n').split('|')] + ['', '']
    w = p[0].lower(); old = DEF.get(w)
    if old and old[3] == 'KJV': continue
    note = p[3]
    if old and old[0] and old[0] != p[1]: note = (note + ' Today it can also mean: ' + old[0]).strip()
    DEF[w] = [p[1], p[2], note, 'KJV']
BASIC = set('''the and of to that in he shall i his a they be is him not them it with all for was which my me said but have will from as are when
this out were upon by you up there then people came had house into her on before also day land men against she these so what one were their
an at or if no who we our us its your do did done go went come made make say said see saw give gave take took know knew let may might can could
would should must over under after down off now here where how why than more most very much many some any other such own same each every
both few man woman child son daughter father mother brother sister king name hand eye head heart face word way water fire earth heaven god lord'''.split())
for w in BASIC: LV[w] = 1
IRR = dict(x.split(':') for x in '''went:go gone:go goeth:go goest:go was:be were:be is:be am:be are:be been:be being:be art:be wast:be wert:be
hath:have hast:have had:have has:have hadst:have having:have did:do done:do doth:do dost:do didst:do doeth:do doest:do saith:say said:say sayest:say
spake:speak spoken:speak spakest:speak made:make madest:make came:come camest:come brought:bring broughtest:bring sent:send found:find told:tell
laid:lay seen:see saw:see sawest:see seeth:see taken:take took:take tookest:take given:give gave:give gavest:give written:write wrote:write
smote:smite smitten:smite smotest:smite slew:slay slain:slay sware:swear sworn:swear begat:beget begotten:beget arose:arise risen:rise rose:rise
knew:know known:know knowest:know knoweth:know sat:sit fled:flee sought:seek chosen:choose chose:choose kept:keep built:build eaten:eat ate:eat
drew:draw drawn:draw wrought:work sold:sell taught:teach fell:fall fallen:fall abode:abide led:lead wept:weep held:hold slept:sleep driven:drive
drove:drive beheld:behold met:meet understood:understand digged:dig forgotten:forget forgat:forget bare:bear borne:bear brake:break broken:break
clave:cleave gat:get gotten:get stood:stand shewed:shew shewn:shew dwelt:dwell became:become began:begin begun:begin drank:drink drunk:drink ran:run
sang:sing sung:sing thought:think bought:buy caught:catch fought:fight heard:hear left:leave lost:lose paid:pay felt:feel fed:feed hid:hide
hidden:hide rode:ride ridden:ride shook:shake shaken:shake stole:steal stolen:steal struck:strike threw:throw thrown:throw tore:tear torn:tear
wore:wear worn:wear men:man women:woman children:child feet:foot teeth:tooth oxen:ox brethren:brother kine:cow mice:mouse wives:wife knives:knife
loaves:loaf sheaves:sheaf thieves:thief calves:calf lives:life leaves:leaf wolves:wolf better:good best:good worse:bad worst:bad elder:old eldest:old
spat:spit lay:lie lain:lie lieth:lie shut:shut cast:cast set:set put:put hurt:hurt cut:cut burnt:burn brought:bring sware:swear wist:wit
thee:thou thy:thou thine:thou thyself:thou shalt:shall wilt:will canst:can couldest:could mayest:may mightest:might shouldest:should wouldest:would'''.split())
def lemmas(k):
    out = [k]
    if k in IRR: out.append(IRR[k])
    for suf, rep in [('ieth', 'y'), ('iest', 'y'), ('ies', 'y'), ('ied', 'y'), ('eth', 'e'), ('eth', ''), ('est', 'e'), ('est', ''), ('edst', ''), ('edst', 'e'),
                     ('es', ''), ('s', ''), ('ed', 'e'), ('ed', ''), ('d', ''), ('ing', 'e'), ('ing', ''), ('st', ''), ('er', ''), ('ly', ''), ('ness', '')]:
        if k.endswith(suf) and len(k) - len(suf) >= 2:
            b = k[:-len(suf)] + rep; out.append(b)
            if len(b) > 3 and b[-1] == b[-2] and suf in ('ed', 'ing', 'eth', 'est'): out.append(b[:-1])   # stopped -> stop
            if b in IRR: out.append(IRR[b])
    return out
words = {}
stats = collections.Counter()
for k, n in cnt.items():
    name = low[k] == 0 and k not in DEF and k not in BASIC
    ls = lemmas(k)
    base = next((b for b in ls if b in DEF), None)
    if not base and HEADOF.get(k) in DEF: base = HEADOF[k]
    lv = min([LV[b] for b in ls if b in LV] or [6])
    kind = 'n' if name else KIND.get(k) or (KIND.get(base) if base and base != k and KIND.get(base) == 'b' else None)
    if not kind:   # old verb endings: -eth (he goeth), -est (thou goest), and irregular old forms
        old = (re.search(r'(eth|est)$', k) and any(b in LV or b in DEF for b in ls[1:]) and not (k.endswith('est') and k[:-3] in LV and k not in IRR)) or (k in IRR and KIND.get(k) == 'a')
        kind = 'a' if old else 'c'
    if lv == 6 and not name:   # not in the app's lists: estimate from how often the KJV uses it
        lv = 2 if n >= 300 else 3 if n >= 100 else 4 if n >= 30 else 5 if n >= 8 else 6
    if name: lv = 6
    e = [n, lv, kind]
    if base and base != k: e.append(base)
    words[k] = e
    stats[kind] += 1; stats['L' + str(lv)] += 1
    if base: stats['meaning'] += 1
used = {e[3] if len(e) > 3 else k for k, e in words.items()}
defs = {k: v for k, v in DEF.items() if k in used}
json.dump({'w': words, 'd': defs}, open(os.path.join(repo, 'kjv', 'words.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('forms', len(words), dict(stats), 'meanings shipped', len(defs))
print('sizes', os.path.getsize(os.path.join(repo, 'kjv', 'bible.json')), os.path.getsize(os.path.join(repo, 'kjv', 'words.json')))
ex = ['unto', 'thou', 'goeth', 'saith', 'begat', 'tabernacle', 'created', 'abraham', 'beginning', 'verily', 'smote', 'shew', 'loveth', 'greatest', 'brethren', 'righteousness']
for w in ex: print(w, words.get(w), defs.get((words.get(w) or [0,0,0,w])[3] if len(words.get(w) or []) > 3 else w, '')[:2] if words.get(w) else '')
