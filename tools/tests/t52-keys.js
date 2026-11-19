// words.html and books.html: on a new-word card, keys 1 / 2 / 3 = Star / Tricky / My sentence, ← or Backspace = Previous, Enter = Got it.
// usage: node tools/tests/t52-keys.js [base url]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(process.env.USE_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {});
  const p = await b.newPage({viewport:{width:1100, height:900}});
  p.setDefaultTimeout(15000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const word = async () => (await p.textContent('#ov .card .hw')).trim();
  const row = async () => (await p.$$eval('#ov .qsave .row > button', xs => xs.map(x => x.textContent.trim()))).join(' | ');
  await p.goto(BASE + 'words.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.click('#view .btn.primary.big'); await p.waitForSelector('#ov .card .hw');
  const w1 = await word();
  console.log('words.html card:', w1, '| buttons:', await row(), '| key badges visible:', await p.$eval('#ov .qsave .kk', k => getComputedStyle(k).display));
  await p.keyboard.press('1'); await p.waitForTimeout(150);
  await p.keyboard.press('2'); await p.waitForTimeout(150);
  console.log('after 1 and 2:', await row(), '| saved', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('bw5000-v1') || '{}'); return JSON.stringify({stars:s.stars, trk:s.trk}); }));
  await p.keyboard.press('3'); await p.waitForTimeout(150);
  console.log('after 3: sentence box open', !!(await p.$('#ov .qsave textarea')), '| focused', await p.evaluate(() => document.activeElement.tagName));
  await p.click('#ov .card'); await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  const w2 = await word(); console.log('Enter → next card:', w2);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
  console.log('← → back to:', await word(), w1 === await word() ? '(ok)' : '(NOT the first card)');
  await p.keyboard.press('Enter'); await p.waitForTimeout(250); await p.keyboard.press('Backspace'); await p.waitForTimeout(250);
  console.log('Backspace → back to:', await word());
  // books.html: a unit's word cards
  await p.keyboard.press('3'); await p.waitForTimeout(150); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  console.log('3 then Escape: still in the session', !!(await p.$('#ov .card .hw')), '| box focused', await p.evaluate(() => document.activeElement.tagName));
  await p.goto(BASE + 'books.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bw-answer', 'choose'); }); await p.reload(); await p.waitForTimeout(900);
  await p.click('#view button:has-text("Start today")'); await p.waitForSelector('#ov .hw');
  const b1 = (await p.textContent('#ov .hw')).trim();
  await p.keyboard.press('1'); await p.waitForTimeout(150); await p.keyboard.press('2'); await p.waitForTimeout(150);
  console.log('books.html card:', b1, '| after 1 and 2:', await row());
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  console.log('Enter → next:', (await p.textContent('#ov .hw')).trim(), '| previous button on this screen:', !!(await p.$('#ov [data-prev]')));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
