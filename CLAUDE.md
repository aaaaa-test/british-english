# KJV Words and Bible: guide for working on this repo

This is an installable web app (PWA) for Korean learners of English. It teaches every word of the King James Bible
through its verses, alongside Bible reading and study. It is hosted on GitHub Pages at https://aaaaa-test.github.io/kjv-words/.
There is no framework: one page with vanilla JS and CSS, plus data files.

It used to be part of the British English apps (https://aaaaa-test.github.io/british-english/, repo
`aaaaa-test/british-english`). That repo's old `kjv.html` now only sends people here.

## Files

| File | What it is |
|---|---|
| `index.html`, `icon-*.png`, `manifest.webmanifest` | The app. **Generated**: never edit them by hand. |
| `kjv/bible.json`, `kjv/bible1611.json`, `kjv/words.json`, `kjv/ed.json` | Bible text and word data. **Generated.** |
| `tools/` | The sources: `kjv-app.js`, `kjv-css.css`, `base-head.html`, builders, glossaries and tests. |
| `tools/README.md` | How to rebuild, the data formats, saved progress and the tests. |
| `sw.js` | Service worker. Network-first, with an offline copy. |

After editing the app code:

```bash
python3 -I tools/assemble.py . tools
```

## Same address as the British English apps

Both sites are on `aaaaa-test.github.io`, so they share browser storage and caches.

- **Progress:** progress is kept in `localStorage['bwkjv-v1']`. It carried over from the old address unchanged.
- **Shared settings:** `bw-answer` (answer mode) and `bw-bg` (light or dark) are shared with the British English apps on purpose.
- **Caches:** this site's caches are named `kjv-site-N`. A service worker must only delete its own caches: this one
  deletes `kjv-site-*`, and the British English one deletes `bw-site-*`.

## Rules for content

- Meanings, Korean, lessons and exercises are written for this app. Never copy them from dictionaries or study
  books. The Bible text is public domain: the 1769 standard text and the 1611 first edition.
- **English:** use British spelling and usage.
- **Korean:** shown only when Korean meanings are on. With "English only", no Korean may appear anywhere.
- Keep the UI text in plain English. The person who owns the repo reads progress reports in Korean.

## After any change

1. **Test** with Playwright. Chromium is pre-installed in the cloud environment.
   - Serve the repo with `python3 -m http.server 8766`.
   - Run `node tools/tests/t51.js http://localhost:8766/`, and the other tests that touch your change.
   - Each test must end with `no page errors`.
2. **Bump the cache:** `const CACHE = 'kjv-site-N'` in `sw.js`.
3. **Commit and push `main`.** GitHub Pages deploys from `main`.
4. **Verify on the live site.**

## Code style

- **DOM helpers:** `el(tag, attrs, ...children)`, `put(node, ...children)`, `$()`.
- **Overlays:** `openOv(title)` / `closeOv()`.
- **Saved data:** state is one object `S`, saved with `save()`. New fields need a default in `blank()`.
- **Comments:** explain why, in plain words. Follow the style of `tools/kjv-app.js`.
