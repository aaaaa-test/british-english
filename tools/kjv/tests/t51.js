// KJV app, Bible order v3: word cards then checks, hints that hide the answer, English only (no Korean anywhere,
// no translation box), review of a verse with no new words, blanks with meaning hints, and the verses-per-card setting.
// usage: node t51.js [base url]   SHOT=1
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
const T = async (p, sel) => ((await p.$(sel)) ? (await p.textContent(sel)).replace(/\s+/g, ' ').trim() : '');
(async () => {
  const b = await chromium.launch(process.env.USE_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {});
  const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:1});
  p.setDefaultTimeout(10000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (process.env.SHOT) await p.screenshot({path:__dirname + '/shots/kjv3-' + n + '.png'}); };
  const hangul = async () => (await p.textContent('#ov')).match(/[가-힣]+/g) || [];
  await p.goto(BASE + 'kjv.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('bw-answer', 'choose'); }); await p.reload();
  await p.waitForSelector('#view .btn.primary.big', {timeout:30000});
  // English only
  await p.click('.tab[data-tab="me"]'); await p.click('#view .seg[aria-label="Korean"] button:has-text("English only")');
  console.log('Me has the study options:', (await p.$$('#view .seg[aria-label="How to learn the new words of a verse"] button')).length, 'choices');
  await p.click('.tab[data-tab="today"]'); await p.waitForTimeout(200);
  await p.click('#view .mode:has-text("One verse at a time")'); await p.waitForTimeout(300);
  const ws = await p.$$eval('#ov .gloss .gl b', xs => xs.map(x => x.textContent));
  console.log('1:1 new words:', ws.join(' '));
  await p.click('#ov .btn.primary.big'); await p.waitForTimeout(150);
  console.log('card 1:', (await T(p, '#ov .card')).slice(0, 150), '| verses on card', (await p.$$('#ov .card .vrow')).length, '| Korean on screen:', (await hangul()).length);
  await shot('1-card');
  for (let k = 0; k < ws.length; k++) { await p.click('#ov .btn.primary.big'); await p.waitForTimeout(60); }
  let hints = [], asked = 0;
  for (let k = 0; k < 30; k++) {
    if (!(await p.$('#ov .opts .opt:not([disabled])'))) break;
    const want = ws[asked]; asked++;
    hints.push(want + ' → ' + ((await T(p, '#ov .tip')) || '(no hint)'));
    if (asked === 2) await shot('2-check');
    await (await p.$('#ov .opts .opt:text-is("' + want + '")') || await p.$('#ov .opts .opt')).click(); await p.waitForTimeout(60);
    await p.click('#ov .fb + .btn.primary'); await p.waitForTimeout(60);
  }
  console.log('hints:\n  ' + hints.join('\n  '));
  const leak = hints.filter(h => { const [w, t] = h.split(' → '); return new RegExp('\\b' + w + '\\b', 'i').test(t.replace(/^Hint: /, '')); });
  console.log('hints that show the answer:', leak.length ? leak.join(' | ') : 'none');
  console.log('meaning step: translation box', !!(await p.$('#ov textarea')), '| word by word', (await p.$$eval('#ov .interlin .il', xs => xs.map(x => x.textContent))).join(' '), '| Korean on screen:', (await hangul()).length);
  await shot('3-meaning');
  await p.click('#ov .btn.primary.big'); await p.waitForTimeout(150);
  console.log('practice:', await T(p, '#ov .qinstr'), '| hints:', await T(p, '#ov .bhints'));
  await shot('4-practice');
  for (const i of await p.$$('#ov input.inl')) await i.fill('x');
  await p.click('#ov .btn.teal'); await p.waitForTimeout(150);
  await p.click('#ov .btn.primary.big >> nth=-1'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // back to 1:1: every word is known now
  await p.click('#view .mode:has-text("Change where to go on from")'); await p.click('#ov .mode:has-text("The beginning")'); await p.waitForTimeout(300);
  await p.click('#view .mode:has-text("One verse at a time")'); await p.waitForTimeout(300);
  console.log('known verse button:', await T(p, '#ov .btn.primary.big'));
  await p.click('#ov .btn.primary.big'); await p.waitForTimeout(150);
  console.log('review:', await T(p, '#ov .qinstr'), '|', await T(p, '#ov .qtext'), '|', (await p.$$eval('#ov .opts .opt', xs => xs.map(x => x.textContent))).join(' / '));
  await shot('5-review');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Today's words with 3 verses on a card
  await p.click('#view .mode:has-text("Study options")'); await p.click('#ov .seg[aria-label="Verses on a word card"] button:text-is("3")'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#view .btn.primary.big'); await p.waitForTimeout(300);
  console.log('today card verses:', (await p.$$('#ov .card .vrow')).length, '|', await T(p, '#ov .card .btn.small'));
  await p.click('#ov .card .btn.small'); await p.waitForTimeout(150);
  console.log('after "more":', (await p.$$('#ov .card .vrow')).length, 'verses');
  await shot('6-today-card');
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
