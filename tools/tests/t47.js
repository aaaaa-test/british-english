// KJV app: loads the Bible, Today's session, word filters (AND/OR/NOT), a chapter with tappable words, verse study,
// memory verses, reading plan and settings. usage: node t47.js [base url]   SHOT=1 saves screenshots in shots/
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
const T = async (p, sel) => ((await p.$(sel)) ? (await p.textContent(sel)).replace(/\s+/g, ' ').trim() : '');
(async () => {
  const b = await chromium.launch(process.env.USE_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {});
  const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:1});
  p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (process.env.SHOT) await p.screenshot({path:__dirname + '/shots/kjv-' + n + '.png'}); };
  const t0 = Date.now();
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bw-answer', 'choose'); }); await p.reload();
  await p.waitForSelector('#view .btn.primary.big', {timeout:30000});
  console.log('loaded in', Date.now() - t0, 'ms ·', (await T(p, '#view .panel.goal')).slice(0, 120));
  await shot('1-today');
  // Today's session: learn 5 cards, then answer checks
  await p.click('#view button:has-text("Start today")'); await p.waitForTimeout(300);
  let cards = 0, qs = 0, right = 0;
  for (let k = 0; k < 40; k++) {
    if (await p.$('#ov .sum')) break;
    const got = await p.$('#ov button:has-text("Got it")');
    if (got) { cards++; if (cards === 1) await shot('2-card'); await got.click(); await p.waitForTimeout(120); continue; }
    const opt = await p.$('#ov .opts button.opt:not([disabled])');
    if (opt) { qs++; await opt.click(); await p.waitForTimeout(120); if (await p.$('#ov .fb.ok')) right++; if (qs === 1) await shot('3-question'); }
    const nx = await p.$('#ov .fb ~ .row .btn.primary, #ov .row .btn.primary.big'); if (nx) { await nx.click(); await p.waitForTimeout(120); }
  }
  console.log('today: cards', cards, '· questions', qs, '· right', right, '· summary', (await T(p, '#ov .sum')).slice(0, 60));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Words: presets and AND / OR / NOT
  await p.click('.tab[data-tab="words"]'); await p.waitForTimeout(400);
  const count = async () => (await T(p, '#view .panel p[style*="font-weight:600"]'));
  console.log('words default set:', await count());
  await p.click('#view details.more summary'); await p.click('#view .mode:has-text("Old KJV English")'); await p.waitForTimeout(400);
  console.log('preset Old KJV English:', await count(), '· first rows:', (await p.$$eval('#view .wr .w', xs => xs.slice(0, 8).map(x => x.textContent))).join(' '));
  await p.selectOption('#view select[aria-label="Add a condition"]', 'freq'); await p.waitForTimeout(300);
  console.log('AND freq 5+:', await count());
  await p.click('#view .seg button:has-text("Any condition")'); await p.waitForTimeout(400);
  console.log('OR:', await count());
  await p.click('#view .cond >> nth=1 >> input[type=checkbox]'); await p.waitForTimeout(400);
  console.log('OR with NOT on the second:', await count());
  await shot('4-words');
  await p.click('#view button:has-text("Use for Today")'); await p.waitForTimeout(200);
  // a word page
  await p.click('#view .wr'); await p.waitForTimeout(400);
  console.log('word page:', (await T(p, '#ov .card')).slice(0, 140), '· verses:', (await p.$$('#ov .vrow')).length);
  await shot('5-word');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Bible: Genesis 1, tap a word, verse menu, mark read
  await p.click('.tab[data-tab="bible"]'); await p.waitForTimeout(300);
  await p.click('#view .bk:has-text("Genesis")'); await p.waitForTimeout(300);
  await p.click('#ov .chb >> nth=0'); await p.waitForTimeout(500);
  console.log('Genesis 1:', (await T(p, '#ov .vs p')).slice(0, 80), '· verses', (await p.$$('#ov .vs p')).length, '· marked old words', (await p.$$('#ov .vs .kw.a')).length);
  await shot('6-chapter');
  await p.click('#ov .vs .kw:text-is("created")'); await p.waitForTimeout(300);
  console.log('tap "created":', (await T(p, '#ov .ttl')), (await T(p, '#ov .line.def')).slice(0, 60));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#ov .vn >> nth=0'); await p.waitForTimeout(300);
  await p.click('#ov button:has-text("Add to memory verses")'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#ov button:has-text("Mark as read")'); await p.waitForTimeout(200);
  console.log('chapter read button now:', await T(p, '#ov .row .btn >> nth=0'));
  await p.click('#ov .mode:has-text("Verse practice")'); await p.waitForTimeout(400);
  console.log('verse practice:', await T(p, '#ov .qinstr'));
  await shot('7-verse');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // search
  await p.click('.tab[data-tab="bible"]'); await p.waitForTimeout(300);
  await p.fill('#view input[type=search]', 'love one another'); await p.waitForTimeout(800);
  console.log('search "love one another":', await T(p, '#view .tip'));
  // Study: passage, order, lesson, plan
  await p.click('.tab[data-tab="study"]'); await p.waitForTimeout(400);
  console.log('study passage:', await T(p, '#view .panel .tip'));
  await p.click('#view .mode:has-text("Put in order")'); await p.waitForTimeout(400);
  const tiles = (await p.$$('#ov .otiles .otile')).length;
  console.log('order tiles:', tiles);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#view button:has-text("Start today")'); await p.waitForTimeout(300);
  console.log('plan:', (await p.$$eval('#view .panel', xs => xs.map(x => x.textContent).find(t => /Reading plan/.test(t)) || '')).replace(/\s+/g, ' ').slice(0, 120));
  await p.click('#view .mode:has-text("-eth and -est")'); await p.waitForTimeout(300);
  console.log('lesson:', (await T(p, '#ov .lesson')).slice(0, 100));
  await shot('8-lesson');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#view .mode:has-text("Quiz: old words")'); await p.waitForTimeout(300);
  console.log('old-word quiz:', await T(p, '#ov .qinstr'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('.tab[data-tab="me"]'); await p.waitForTimeout(300);
  console.log('me:', (await T(p, '#view .tiles')));
  await p.click('.tab[data-tab="today"]'); await p.waitForTimeout(300);
  console.log('today set:', (await p.$$eval('#view .panel', xs => xs.map(x => x.textContent).find(t => /word set/.test(t)) || '')).replace(/\s+/g, ' ').slice(0, 120));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
