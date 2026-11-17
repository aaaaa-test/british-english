# KJV Words and Bible: sources and build

`kjv.html` and `kjv/*.json` are **generated**. Edit the files in this folder, rebuild, then commit both the
sources and the generated files.

| File | What it is |
|---|---|
| `kjv-app.js` | The whole app (vanilla JS, one IIFE). Sections are marked `/* ---------- … ---------- */`. |
| `kjv-css.css` | Styles added on top of the shared styles copied from `books.html`. |
| `assemble.py` | Writes `kjv.html` = head + styles of `books.html` + `kjv-css.css` + tab bar + `kjv-app.js`; also the icons and `kjv.webmanifest`. |
| `build_kjv.py` | Writes `kjv/bible.json` (text) and `kjv/words.json` (every word form: count, level, kind, base form, meanings). |
| `build1611.py` | Adds the 1611 first edition: `kjv/bible1611.json`, 1611 spellings in `words.json` (`o`, `ed`), `kjv/ed.json`. **Run after `build_kjv.py`** (it rewrites `words.json`). |
| `gloss.txt` | Old KJV English and Bible words: `word|modern meaning|Korean|kind a/b (a! = KJV sense first)|note`. |
| `g2/*.txt` | Meanings for every other word: `head|meaning|Korean|note|kind?`. |
| `heads.txt` | Which word forms belong to which `g2` headword (`head<TAB>forms<TAB>count`). |
| `kjvsense.txt` | Common words whose usual KJV sense differs from today's (earth = land, saw = past of see); shown first. |
| `fetch.sh` | Downloads the two source texts (not kept in the repo). |
| `tests/t47–t51.js` | Playwright checks (see below). |

## Rebuild

Only the app code or styles changed:

```bash
python3 -I tools/kjv/assemble.py . tools/kjv
```

Meanings or word data changed (needs the downloads):

```bash
bash tools/kjv/fetch.sh /tmp/kjv-src
python3 -I tools/kjv/build_kjv.py /tmp/kjv-src/KJV.json tools/kjv/gloss.txt .
python3 -I tools/kjv/build1611.py /tmp/kjv-src/1611 .
python3 -I tools/kjv/assemble.py . tools/kjv
```

Run all three from the repo root. `assemble.py` needs Pillow (for the icons).

## Data formats

- `bible.json`: `{b:[[name, abbr, korean name, [[verse text, …] per chapter]]]}`. `[square brackets]` = words in italics.
- `words.json`:
  - `w:{form:[count, level 1–6, kind, base?]}`. Kind is c (common), a (old KJV English), b (Bible word) or n (name).
  - `d:{key:[meaning, korean, note, source]}`. Source is `KJV`, `KJV+` (today's meaning, KJV sense in the note), `Words`, or a course id.
  - `o:{form:[same-count, spelling1, n1, …]}` gives the 1611 spellings.
  - `ed` holds the totals for the 1611 lesson.
- The app builds a verse index at load (an Int32Array per word, about 1 second).

## Saved progress

Saved progress is kept in `localStorage['bwkjv-v1']`. Fields:

| Field | What it holds |
|---|---|
| `p[word]` | Box, due day, tries, misses, last day, first day |
| `stars`, `trk` | Starred and tricky words |
| `vstars`, `mem` | Memory verses |
| `notes` | Notes on verses |
| `tr` | The user's own Korean translations |
| `read` | Chapters marked as read |
| `log[day]` | `[new, reviews, right, wrong]` for each day |
| `hist` | Study record: `[day, type, first verse, last verse, new words, right, tried]` |
| `path.v` | The Bible-order place |
| `set` | Settings |

- Days are `DAY()` = days since 1970 in local time.
- When you add a field, give it a default in `blank()`. Old saves get it through `Object.assign`.
- The answer mode `bw-answer` and the theme `bw-bg` are shared with the other apps.

## Tests

1. Serve the repo with `python3 -m http.server 8765`.
2. Run the tests:

```bash
node tools/kjv/tests/t51.js http://localhost:8765/
```

Add `SHOT=1` to save screenshots to `tests/shots/`. For the live site, pass its URL and set `USE_PROXY=1` in the cloud environment.

| Test | What it checks |
|---|---|
| t47 | Loading, Today, filters, chapter, search, plan |
| t48 | 1611 edition |
| t49 | Bible-order passage and study record |
| t50 | Stacked words, meaning step |
| t51 | Word cards, hints, English only, review, verses per card |

Each test should end with `no page errors`.
