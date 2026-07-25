# Benchsy

Interactive frontend concept for understanding the AI model landscape at a
glance. Benchsy shows which models lead overall and where specialists win
across coding, writing, chat, science, computer use, and cybersecurity.

The board tracks 16 frontier models from 8 labs, researched on **July 22, 2026**.
Prices, context windows, release dates and status come from provider
documentation; the 0–100 capability scores are Benchsy's own normalization
across the tracked set, with the benchmark basis recorded for every score.

Built from the `Benchsy.dc.html` design in the
[Claude Design project](https://claude.ai/design/p/47a4a80c-8113-4e27-8317-3eff0129dcb8).

## Running

Static site, no build step:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173. (Open `index.html` over `file://` and the
browser will refuse to load `data.js` / `app.js` — use the server.)

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Product shell and the Leaderboard, Pricing, Models, Labs, Compare, search, and methodology surfaces. |
| `styles.css` | The **Classical** design system — tokens and component classes, verbatim from the design project. Retune the look here. |
| `app.css` | Product layout, responsive behavior, data visualizations, motion, and the dark palette. |
| `data.js` | The single product-data source: categories and weights, 16 models, 8 labs, pricing, recent releases, and the source list. |
| `app.js` | Rendering, view navigation, sorting, selection, comparison, search, and dialogs. |
| `benchsy-research.json` | The research record `data.js` was derived from — one entry per model, including the benchmark basis for each score. |
| `benchsy-research-sources.md` | Primary sources, by lab, behind the research record. |

## How the board works

Each model gets **one** leaderboard DOM node for the life of the page.
Switching category re-sorts the data and updates each row's `translateY`, so
rows animate to their new position instead of being re-rendered. That re-sort
remains the centerpiece of the design.

Hovering or focusing previews a model in the fingerprint panel. Clicking pins
it across category switches. The same centralized model object drives pricing,
the model index, lab profiles, comparison, and search.

## Configuration

`CONFIG` at the top of `app.js` carries the lightweight display knobs:

```js
const CONFIG = {
  rowDensity: 'comfortable', // 'comfortable' | 'compact'
  highlightLeader: true,
};
```

## Notes

- **Dark theme.** The design ships a theme-toggle button but the system defines
  only light tokens, so `app.css` adds a `:root[data-theme="dark"]` palette that
  mirrors each ramp. It follows the OS preference on first visit and remembers
  the choice in `localStorage`.
- **Scores are a snapshot, not a feed.** The research covers a single day, so
  the board shows which models are new this month rather than week-over-week
  rank movement, and "What changed" carries real releases and pricing facts
  instead of synthetic ups and downs.
- **Every score is attributable.** Each model carries a `basis` string per
  category, surfaced on hover over the fingerprint bars; the methodology dialog
  links the primary sources.
- **No backend.** Nothing polls, persists remotely, or requires authentication.
- **Hash views.** Product navigation uses `#leaderboard`, `#pricing`, `#models`,
  `#labs`, and `#compare`, so every primary surface is directly reachable.
- **Replaceable data.** `data.js` is deliberately the only product-data source,
  making a future API migration straightforward.
