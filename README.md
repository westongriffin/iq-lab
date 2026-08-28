# IQ Lab

A self-contained, research-grounded IQ testing and education website. Static HTML/CSS/JS —
no build step, no backend, no accounts. All data (name, progress, results) lives in the
visitor's browser via localStorage.

## Run it

Any static file server works:

```bash
python3 serve.py            # serves on http://localhost:8123
```

or deploy the folder as-is to Netlify, Vercel, GitHub Pages, or any static host
(`serve.py` and `.claude/` are dev-only and can be excluded).

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing: test cards, research stat band, interactive percentile explorer |
| `test.html?mode=short` | 16-item Quick Assessment (~10–15 min, 4 domains) |
| `test.html?mode=long` | 40-item Full Assessment (~30–40 min, 5 domains incl. digit span) |
| `results.html` | Score, bell curve, domain profile, share / download PNG card, history |
| `learn.html` | "The Science of IQ" — long-form education, 27 peer-reviewed references |
| `methodology.html` | Full transparency on item formats, scoring model, and limitations |

## Architecture

- `js/items.js` — original item bank. Matrix items are *generated from rule functions*
  (Latin squares, progressions, overlays) so the correct answer is correct by construction;
  option order is shuffled deterministically per item (stable across sessions for resume).
  Every item carries an a-priori difficulty estimate `p` used by the scoring model.
- `js/render.js` — renders matrix cells and chiral polyomino rotation items as inline SVG
  (currentColor, so light/dark themes both work).
- `js/engine.js` — test flow: intro/resume, navigation, auto-save on every action,
  one-attempt digit-span playback, keyboard shortcuts (A–F, arrows).
- `js/scoring.js` — deviation IQ (M=100, SD=15): raw score → z against the expected
  population distribution for this form (Σp mean, covariance-inflated SD) → IQ, with
  SEM-based confidence intervals. Fully documented in `methodology.html`.
- `js/storage.js` — localStorage wrapper (profile, history, in-progress state).
- `js/results.js` — bell-curve SVG with hover readout, domain bars, Web Share API /
  clipboard sharing, canvas-drawn 1200×630 PNG result card download.

## Honesty constraints (please preserve when editing)

- Every quantitative claim on the site cites a peer-reviewed source (see `learn.html#refs`).
- All items are original; no copyrighted Raven's/WAIS content.
- Results always display the confidence interval and the "estimate, not clinical" framing;
  scores are clamped to 60–145 because a brief instrument has no precision beyond that.
