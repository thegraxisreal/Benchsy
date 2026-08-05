# Benchsy

Interactive frontend concept for understanding the AI model landscape at a
glance. Benchsy shows which models lead overall and where specialists win
across coding, writing, chat, science, computer use, and cybersecurity.

The board tracks 17 frontier models from 8 labs, researched on **August 3, 2026**.
Prices, context windows, release dates and status come from provider
documentation; the 0–100 capability scores are Benchsy's own normalization
across the tracked set, with the benchmark basis recorded for every score. The
scale leaves headroom above the current field — the strongest result sits at 98,
not 100 — so a stronger model can be added without rescaling the whole board.

Built from the `Benchsy.dc.html` design in the
[Claude Design project](https://claude.ai/design/p/47a4a80c-8113-4e27-8317-3eff0129dcb8).

## Running

Static site, no build step:

```bash
python3 serve.py
```

Then open http://localhost:4173. (Open `index.html` over `file://` and the
browser will refuse to load `data.js` / `app.js` — use the server.)

`serve.py` is `http.server` with caching turned off. The stdlib server sends
`Last-Modified` and no `Cache-Control`, so browsers heuristically cache
`data.js` and `app.js` and keep serving a stale board after you edit the data.
`serve.py` sends `no-store` and strips the validators, so a plain reload always
shows current data. Pass a port to override the default: `python3 serve.py 8080`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Product shell and the Leaderboard, Pricing, Models, Labs, Compare, search, and methodology surfaces. |
| `styles.css` | The **Classical** design system — tokens and component classes, verbatim from the design project. Retune the look here. |
| `app.css` | Product layout, responsive behavior, data visualizations, motion, and the dark palette. |
| `data.js` | The single product-data source: categories and weights, 17 models, 8 labs, pricing, recent releases, and the source list. |
| `app.js` | Rendering, view navigation, sorting, selection, comparison, search, and dialogs. |
| `benchsy-research.json` | The research record `data.js` was derived from — one entry per model, including the benchmark basis for each score. |
| `benchsy-research-sources.md` | Primary sources, by lab, behind the research record. |
| `serve.py` | Dev server — `http.server` with caching disabled so data edits always show. |
| `assets/og-source.html` | Source for the link-preview card. Edit this, never `og.png`. |
| `tools/make-og.sh` | Re-renders `assets/og.png` and `assets/apple-touch-icon.png` via headless Chrome. |
| `tools/validate-data.mjs` | Checks model/research parity, scores, prices, category weights, sources, and research dates. |

## How the board works

Each model gets **one** leaderboard DOM node for the life of the page.
Switching category re-sorts the data and updates each row's `translateY`, so
rows animate to their new position instead of being re-rendered. That re-sort
remains the centerpiece of the design.

Hovering or focusing previews a model in the fingerprint panel. Clicking pins
it across category switches. The same centralized model object drives pricing,
the model index, lab profiles, comparison, and search.

Run `node tools/validate-data.mjs` after every research refresh. It catches
missing research records, duplicate models, partial pricing, invalid scores,
invalid community-build links, and mismatched research dates before deployment.

Community examples for the Overall and Coding boards live in the
`COMMUNITY_BUILDS` map in `data.js`. Add a project name and HTTPS URL under the
model id; the compact row link and expanded profile update together.

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
- **Before deploying, replace the placeholder domain.** `index.html` carries
  `https://your-domain.example` in four tags — `canonical`, `og:url`, `og:image`
  and `twitter:image`. Scrapers won't resolve relative paths, so link previews
  stay broken until those are the real domain. Re-run `./tools/make-og.sh` if you
  change the card artwork.
- **The board states its own age.** `RESEARCH_ISO` in `data.js` drives a chip in
  the hero that reads "researched today", "12 days old", "3 weeks old", and
  escalates tone past 14 and 45 days. Bump `RESEARCH_DATE` and `RESEARCH_ISO`
  together on every refresh — that's the whole maintenance ritual.
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
  Compare carries its selection — `#compare=claude-opus-5,grok-4-1-fast` — and
  accepts zero to three models, building up from an empty state to a single
  profile to a full comparison.
- **Replaceable data.** `data.js` is deliberately the only product-data source,
  making a future API migration straightforward.
