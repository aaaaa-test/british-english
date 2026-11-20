// KJV app, Bible order with stacked words: Genesis 1:1 then 1:2 (words of 1:1 not taught again), the meaning step
// (word by word, today's English, own Korean translation) and verse practice. usage: node t50.js [base url]   SHOT=1
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/';
const T = async (p, sel) => ((await p.$(sel)) ? (await p.textContent(sel)).replace(/\s+/g, ' ').trim() : '');
(async () => {
  const b = await chromium.launch(process.env.USE_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {});
  const p = await b.newPage({viewport:{width:390, height:844}, deviceScaleFactor:1});
  p.setDefaultTimeout(10000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (process.env.SHOT) await p.screenshot({path:__dirname + '/shots/kjvstack-' + n + '.png', fullPage:false}); };
  await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); }); await p.reload();
  await p.waitForSelector('#view .btn.primary.big', {timeout:30000});
  // one verse: learn every new word right, then the meaning, then the verse
  async function doVerse(tag, translation) {
    const ref = await T(p, '#ov .qcount');
    const ws = await p.$$eval('#ov .gloss .gl b', xs => xs.map(x => x.textContent));
    const known = await p.$$eval('#ov .knew .kchip:not(.n)', xs => xs.map(x => x.textContent));
    const names = await p.$$eval('#ov .knew .kchip.n', xs => xs.map(x => x.textContent));
    console.log(ref, '| new:', ws.join(' '), '| already learnt:', known.join(' ') || '-', '| names:', names.join(' ') || '-');
    await shot(tag + '-1-read');
    await p.click('#ov .btn.primary.big'); await p.waitForTimeout(150);
    for (let g = 0; g < 60 && (await p.$('#ov button:has-text("Got it")')); g++) { await p.click('#ov button:has-text("Got it")'); await p.waitForTimeout(40); }
    let asked = 0, right = 0;
    for (let k = 0; k < 60; k++) {
      if (!(await p.$('#ov .opts .opt:not([disabled])'))) break;
      const hint = await T(p, '#ov .tip');
      if (asked === 0) await shot(tag + '-2-word');
      const want = ws[asked]; asked++;
      const btn = await p.$('#ov .opts .opt:text-is("' + want + '")') || await p.$('#ov .opts .opt');
      await btn.click(); await p.waitForTimeout(80); if (await p.$('#ov .fb.ok')) right++;
      if (asked === 1) console.log('  first question hint:', hint.slice(0, 80));
      await p.click('#ov .fb + .btn.primary'); await p.waitForTimeout(80);
    }
    console.log('  word questions', asked, 'right', right);
    console.log('  word by word:', (await p.$$eval('#ov .interlin .il', xs => xs.map(x => x.querySelector('b').textContent + '=' + x.querySelector('span').textContent))).join(' '));
    console.log('  today\'s English:', await p.$$eval('#ov p.verse', xs => xs.map(x => x.textContent).join(' | ')));
    await shot(tag + '-3-meaning');
    if (translation) await p.fill('#ov textarea.memo', translation);
    await p.click('#ov .btn.primary.big'); await p.waitForTimeout(150);
    await shot(tag + '-4-verse');
    const inl = await p.$$('#ov input.inl'); for (const i of inl) await i.fill('x');
    const ta = await p.$('#ov textarea.memo'); if (ta) await ta.fill('words');
    for (let t = 0; t < 60; t++) { const tt = await p.$('#ov .otiles .otile:not([disabled])'); if (!tt) break; await tt.click(); }
    await p.click('#ov .btn.teal'); await p.waitForTimeout(150);
    console.log('  after the verse:', (await T(p, '#ov .fb')).slice(0, 120));
    await p.click('#ov .btn.primary.big >> nth=-1'); await p.waitForTimeout(200);
  }
  await p.click('#view .mode:has-text("One verse at a time")'); await p.waitForTimeout(300);
  await doVerse('g1', '태초에 하나님이 하늘과 땅을 창조하셨다.');
  await doVerse('g2');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Psalm 23:4 for today's English
  await p.click('#view .mode:has-text("Change where to go on from")');
  await p.selectOption('#ov select[aria-label="Book"]', '18'); await p.selectOption('#ov select[aria-label="Chapter"]', '22'); await p.selectOption('#ov select[aria-label="Verse"]', '3');
  await p.click('#ov .btn.primary:has-text("Go on from")'); await p.waitForTimeout(300);
  await p.click('#view .mode:has-text("One verse at a time")'); await p.waitForTimeout(300);
  await doVerse('ps');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('.tab[data-tab="study"]'); await p.waitForTimeout(300);
  console.log('translations panel:', (await p.$$eval('#view .panel', xs => xs.map(x => x.textContent).find(t => /Korean translations/.test(t)) || '')).replace(/\s+/g, ' ').slice(0, 160));
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
