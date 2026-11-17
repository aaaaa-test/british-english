// KJV app: Bible-order passage, one verse at a time, place picker, study record (date / passage / calendar).
// usage: node t49.js [base url]   SHOT=1 saves screenshots
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
const T = async (p, sel) => ((await p.$(sel)) ? (await p.textContent(sel)).replace(/\s+/g, ' ').trim() : '');
(async () => {
  const b = await chromium.launch(process.env.USE_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {});
  const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:1});
  p.setDefaultTimeout(10000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (process.env.SHOT) await p.screenshot({path:__dirname + '/shots/kjvpath-' + n + '.png'}); };
  const panel = async re => (await p.$$eval('#view .panel', (xs, s) => xs.map(x => x.textContent).find(t => new RegExp(s).test(t)) || '', re)).replace(/\s+/g, ' ');
  await p.goto(BASE + 'kjv.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bw-answer', 'choose'); }); await p.reload();
  await p.waitForSelector('#view .btn.primary.big', {timeout:30000});
  console.log('today panel:', (await panel('Bible in order')).slice(0, 200));
  await shot('1-today');
  await p.click('.tab[data-tab="me"]'); await p.click('#view .seg[aria-label="Verses in a Bible-order passage"] button:text-is("5")');
  await p.click('.tab[data-tab="today"]'); await p.waitForTimeout(200);
  await p.click('#view .mode:has-text("Today\'s passage")'); await p.waitForTimeout(300);
  console.log('verse screen:', await T(p, '#ov .qcount'), '|', (await T(p, '#ov .verse.big1')).slice(0, 70), '| new words:', (await p.$$eval('#ov .gloss .gl b', xs => xs.map(x => x.textContent))).join(', '));
  await shot('2-verse');
  let qs = 0, verses = 0;
  for (let k = 0; k < 400; k++) {
    if (await p.$('#ov .sum')) break;
    const opt = await p.$('#ov .opts .opt:not([disabled])');
    if (opt) { qs++; if (qs === 1) await shot('3-word'); await opt.click(); await p.waitForTimeout(100); await p.click('#ov .fb + .btn.primary, #ov .btn.primary.big >> nth=-1'); await p.waitForTimeout(120); continue; }
    const inl = await p.$$('#ov input.inl'), tiles = await p.$$('#ov .otiles .otile:not([disabled])'), ta = (await p.$('#ov .lhint')) ? await p.$('#ov textarea.memo') : null;
    if (inl.length || tiles.length || ta) {
      if (verses === 0) await shot('4-verse-ex');
      for (const i of inl) await i.fill('x');
      if (ta) await ta.fill('words');
      for (let t = 0; t < 60; t++) { const tt = await p.$('#ov .otiles .otile:not([disabled])'); if (!tt) break; await tt.click(); }
      await p.click('#ov .btn.teal'); await p.waitForTimeout(150); verses++;
      await p.click('#ov .btn.primary.big >> nth=-1'); await p.waitForTimeout(200); continue;
    }
    const go = await p.$('#ov .btn.primary.big'); if (go) { await go.click(); await p.waitForTimeout(150); continue; }
    break;
  }
  console.log('passage: word questions', qs, '· verses practised', verses, '· summary:', await T(p, '#ov .sum'));
  await shot('5-summary');
  await p.click('#ov .sum button:has-text("Finish")'); await p.waitForTimeout(300);
  console.log('today panel after:', (await panel('Bible in order')).slice(0, 120));
  await p.click('#view .mode:has-text("Change where to go on from")'); await p.waitForTimeout(200);
  await p.selectOption('#ov select[aria-label="Book"]', '42'); await p.selectOption('#ov select[aria-label="Chapter"]', '2'); await p.selectOption('#ov select[aria-label="Verse"]', '15');
  await p.click('#ov .btn.primary:has-text("Go on from")'); await p.waitForTimeout(300);
  await p.click('#view .mode:has-text("One verse at a time")'); await p.waitForTimeout(300);
  console.log('one verse:', await T(p, '#ov .qcount'), '|', (await T(p, '#ov .verse.big1')).slice(0, 60));
  await p.click('#ov button:has-text("Next verse without studying")'); await p.waitForTimeout(200);
  console.log('after skip:', await T(p, '#ov .qcount'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('.tab[data-tab="bible"]'); await p.click('#view .bk:has-text("Ruth")'); await p.click('#ov .chb >> nth=0'); await p.waitForTimeout(400);
  await p.click('#ov button:has-text("Mark as read")'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('.tab[data-tab="me"]'); await p.click('#view .item:has-text("My study record")'); await p.waitForTimeout(300);
  console.log('record tiles:', await T(p, '#ov .tiles4'));
  console.log('by date:', (await T(p, '#ov .hday')).slice(0, 300));
  await shot('6-date');
  await p.click('#ov .seg button:has-text("By passage")'); await p.waitForTimeout(300);
  console.log('by passage:', (await p.$$eval('#ov .bkrow:not(.none)', xs => xs.map(x => x.textContent.replace(/\s+/g, ' ')))).join(' | ').slice(0, 300));
  await shot('7-passage');
  await p.click('#ov .bkrow:has-text("Genesis")'); await p.waitForTimeout(300);
  console.log('Genesis chapters:', (await p.$$eval('#ov .bkrow', xs => xs.slice(0, 2).map(x => x.textContent.replace(/\s+/g, ' ')))).join(' | '));
  await shot('8-book');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#ov .seg button:has-text("Calendar")'); await p.waitForTimeout(300);
  await p.click('#ov .cal .cd.now'); await p.waitForTimeout(200);
  console.log('calendar:', (await p.$$('#ov .cal .cd')).length, 'days · today', await p.$eval('#ov .cal .cd.now', x => x.className), '·', (await T(p, '#ov .hday')).slice(0, 100));
  await shot('9-cal');
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
