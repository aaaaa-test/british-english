# British English apps: guide for working on this repo

These are installable web apps (PWAs) for Korean learners of British English. They are hosted on GitHub Pages at
https://aaaaa-test.github.io/british-english/. There is no build system or framework: each app is one HTML file with
vanilla JS and CSS inline, plus data files.

## The apps

| File | App | Notes |
|---|---|---|
| `index.html` | Home page | Links to every app. Shows the "mindset" phrase. |
| `words.html` | 5000 British Words | Word data is inline in `<script id="wordData">` (`word|pos|meaning|…`), with Korean in `<script id="koData">`. |
| `writing.html` | British Writing and Grammar | Diary, calendar, range reviews. |
| `books.html` | British Book Courses | The engine for every course in `courses/`. |
| `kjv.html` | Redirect only | KJV Words and Bible moved to its own repo `aaaaa-test/kjv-words` (https://aaaaa-test.github.io/kjv-words/). This page and `kjv.webmanifest` / `icon-kjv-*` only keep old links and home-screen icons working. |
| `sw.js` | Service worker | Network-first, with an offline copy. |
| `config.js` | Firebase config for optional accounts | Public web config, not a secret. |

- Each app has a `*.webmanifest` and `icon-<app>-192/512/maskable.png`.
- The apps share these `localStorage` keys: `bw-answer` (answer mode: choose / see / type) and `bw-bg` (light or dark).
- Each app has its own progress key, e.g. `bw5000-v1`. Look for `const LS =` or `localStorage` in each file.
- Every app's Me tab has "Save a copy" / "Restore a copy" for moving progress between devices.
- Keyboard in sessions (`words.html`, `books.html`): Enter = next / Got it, 1–9 = a choice. Where there is no choice, 1 / 2 / 3 =
  Star / Tricky / My sentence. ← or Backspace = Previous (buttons marked `data-prev`). Escape = back.
  The key badges (`.kk`) show only on computers with a mouse. Test: `tools/tests/t52-keys.js`.

## Courses (books.html)

- **The book list:** `BOOKS` in `books.html` lists the books. `READY` lists the books whose course file exists, and `KO_READY` lists the books whose Korean is written.
- **Course files:** `courses/<id>.json` holds `{about, secs, units:[…]}`. Each unit has these keys:
  - `n` number, `s` section, `t` title, `sub` subtitle
  - `L` lesson blocks: `p` text, `kr` Korean note, `x` example, `tip`, `g` grammar
  - `W` words: `word|pos|meaning|example with [word]|level|pron…`
  - `C` concept cards (cv only): `{word:{t,i,l,r,c,n}}`
  - `X` exercises: `{k:'choose'|'gap', i, items:[{q, a, o, why}]}`
  - `O` writing task
- **Korean:** `courses/ko/<id>.json` maps `"unit:word"` to the Korean meaning.
- **Editing:** the JSON files are the source of truth, so edit them directly.
- **Checks after editing:** every gap answer must be one of the unit's words, and every wrong option must really be wrong.

## Rules for content

- All explanations, examples and exercises must be **original**. The books are a guide to scope and order only: never
  copy their text, examples or exercises.
- **English:** use British spelling and usage, e.g. colour, practise (verb), learnt.
- **Korean:** natural Korean, shown only when the user turns Korean meanings on. With "English only", no Korean may
  appear anywhere.
- Keep the UI text in plain English. The person who owns the repo reads progress reports in Korean.

## After any change

1. **Test** in a real browser with Playwright. Chromium is pre-installed in the cloud environment.
   - Serve the repo with `python3 -m http.server 8765` and open `http://localhost:8765/<app>.html`.
   - Check that the page reports no errors (`page.on('pageerror')`).
2. **Bump the cache** in `sw.js` (`const CACHE = 'bw-site-NN'`) so installed apps get the new files. The service worker may delete
   only `bw-site-*` caches: the KJV site on the same address keeps its own `kjv-site-*` caches.
   - When you add a new top-level file, also add it to `FILES`.
3. **Commit and push to both branches.**
   - Work on `book-courses`, then fast-forward `main`: `git checkout main && git merge --ff-only book-courses && git push origin main`.
   - Then switch back to `book-courses`.
   - GitHub Pages deploys from `main`. To see when a deploy is finished:

     ```bash
     gh api 'repos/aaaaa-test/british-english/actions/runs?per_page=5'
     ```
4. **Verify on the live site** once Pages has finished deploying.

## Code style in the apps

- **Small DOM helpers:** `el(tag, attrs, ...children)`, `put(node, ...children)` and `$()`. Screens are redrawn with `put`.
- **Overlays:** full-screen screens with Back use `openOv(title)` / `closeOv()`. Escape and the Back button go back.
- **Saved data:** state is one object `S`, saved with `save()`. New fields need a default in `blank()`.
- **Comments** explain why, in plain words. Keep lines long rather than splitting short statements. Follow the existing
  style of the file you edit.
