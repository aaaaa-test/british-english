# Builds kjv.html from books.html's head and styles, the KJV styles and the KJV app script; makes the icons and manifest.
# usage: python3 -I assemble.py <repo> <dir with kjv-css.css and kjv-app.js>
import sys, os, re, json
repo, d = sys.argv[1], sys.argv[2]
s = open(os.path.join(repo, 'books.html'), encoding='utf-8').read()
head = s[:s.index('</head>')]
head = head.replace('<title>British Book Courses</title>', '<title>KJV Words and Bible</title>').replace('content="Books"', 'content="KJV"')
head = head.replace('href="books.webmanifest"', 'href="kjv.webmanifest"').replace('href="icon-books-512.png"', 'href="icon-kjv-512.png"')
head = re.sub(r'<link rel="icon" type="image/png" href="data:image/png;base64,[^"]*">', '<link rel="icon" type="image/png" href="icon-kjv-192.png">', head, count=1)
css = open(os.path.join(d, 'kjv-css.css'), encoding='utf-8').read()
js = open(os.path.join(d, 'kjv-app.js'), encoding='utf-8').read()
TAB = lambda k, icon, label: f'  <button class="tab" data-tab="{k}" type="button"><svg viewBox="0 0 24 24">{icon}</svg>{label}</button>'
body = '\n'.join([
 '<style>', css, '</style>', '</head>', '<body>',
 '<script>window.BW_HOME = "index.html";</script>',
 "<script>(function () { let t = null; try { t = localStorage.getItem('bw-bg'); } catch (e) {} if (t !== 'dark') document.documentElement.classList.add('light'); })();</script>",
 '<main id="view" aria-live="polite"></main>',
 '<nav class="tabs" aria-label="Sections">',
 TAB('today', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 'Today'),
 TAB('words', '<path d="M4 6h16M4 12h16M4 18h10"/>', 'Words'),
 TAB('bible', '<path d="M6 3h11a1 1 0 011 1v16a1 1 0 01-1 1H6a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M11 7v6M8.5 9.5h5"/>', 'Bible'),
 TAB('study', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>', 'Study'),
 TAB('me', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 'Me'),
 '</nav>', '<div id="ov" hidden role="dialog" aria-modal="true"></div>', '<div id="toast" class="toast" hidden role="status"></div>',
 '<script>', js, '</script>',
 '<script>if (\'serviceWorker\' in navigator && window.isSecureContext) addEventListener(\'load\', () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>',
 '</body>', '</html>', ''])
open(os.path.join(repo, 'kjv.html'), 'w', encoding='utf-8').write(head + body)
# icons: a dark book with a gold cross and "KJV"
from PIL import Image, ImageDraw
def icon(n, pad=0):
    im = Image.new('RGB', (n, n), (10, 16, 18)); dr = ImageDraw.Draw(im)
    m = int(n * (0.18 + pad)); dr.rounded_rectangle([m, int(n * .12 + pad * n), n - m, n - int(n * .12 + pad * n)], radius=int(n * .06), fill=(255, 128, 213))
    cx, cy, t = n // 2, int(n * .45), max(2, int(n * .05))
    dr.rectangle([cx - t, cy - int(n * .2), cx + t, cy + int(n * .2)], fill=(10, 16, 18))
    dr.rectangle([cx - int(n * .12), cy - int(n * .09) - t, cx + int(n * .12), cy - int(n * .09) + t], fill=(10, 16, 18))
    return im
for sz in (192, 512): icon(sz).save(os.path.join(repo, f'icon-kjv-{sz}.png'))
icon(512, .08).save(os.path.join(repo, 'icon-kjv-maskable.png'))
man = json.load(open(os.path.join(repo, 'books.webmanifest'), encoding='utf-8'))
man.update({'name': 'KJV Words and Bible', 'short_name': 'KJV', 'start_url': 'kjv.html', 'id': 'kjv.html',
            'icons': [{'src': 'icon-kjv-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-kjv-512.png', 'sizes': '512x512', 'type': 'image/png'}, {'src': 'icon-kjv-maskable.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]})
if 'description' in man: man['description'] = 'Every word of the King James Bible, learnt through its verses, with Bible reading and study.'
json.dump(man, open(os.path.join(repo, 'kjv.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('kjv.html', os.path.getsize(os.path.join(repo, 'kjv.html')))
