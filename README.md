# PacNation League Archive — website

Sixteen seasons of PacNation fantasy football history (2010–2025), preserved
from NFL Fantasy. Live at **https://psud21.github.io/pacnation-site/**.

The site is a static React app with no server and no database: it reads the JSON
files in `public/data/`. Those files are **generated** by the private archive
repository ([psud21/pacnation-archive](https://github.com/psud21/pacnation-archive)),
which holds the raw NFL pages and the pipeline. Don't edit them by hand.

## Run locally

Requires Node.js 22.13+ (the deploy uses Node 24).

```powershell
npm ci
npm run dev       # http://localhost:5173
npm run build     # type-check, build to dist/, then generate dist/share/ pages
npm run preview   # serve dist/
```

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`, which builds the site
and publishes it to GitHub Pages; nothing else is needed. Pages is configured
under **Settings → Pages → Source: GitHub Actions**. The workflow sets
`VITE_SITE_URL` so the social preview image (`og.jpg`) uses an absolute URL.

## Share pages

The app routes with query strings, and chat apps fetch the same `index.html`
for every such URL, so a link preview can't differ per page. After the Vite
build, `scripts/share.mjs` writes one small HTML page per season, manager and
rivalry (221 in all) under `dist/share/`, such as `share/manager/manager-04/`.
Each carries its own title and description for link previews and forwards
visitors into the app. The **Share** buttons copy these links. Previews
currently all use `og.jpg`; per-page images would need an image renderer
added to the build.

## Update the data

In the archive repository:

```powershell
python -m src.rebuild --compare ..\pacnation-site\public\data
```

That rebuilds everything from the raw archive into `build/site-data/` and lists
what would change. To publish, copy that folder's contents over `public/data/`
here, commit and push. `.gitattributes` keeps the data files byte-for-byte so
the archive repository's CI can confirm the published site matches the archive.

## Code layout

| File | What it does |
|---|---|
| `index.html` | Page shell, meta tags and fonts |
| `app/main.tsx` | Mounts the app |
| `app/App.tsx` | Layout, rail and routing; loads `index.json`, `managers.json` and season files |
| `app/Home.tsx` | Home page: champion hero, championship banners, entry cards, this-week classics, random classic |
| `app/Search.tsx` | ⌘K / Ctrl+K (or `/`) search across managers, team names, seasons and players |
| `app/Badge.tsx`, `app/motion.tsx` | Manager initials badges; count-up numbers, page fade and the sliding tab underline |
| `app/ShareButton.tsx`, `scripts/share.mjs` | Share links and the static share pages behind them |
| `app/season/Yearbook.tsx` | A printable one-page season yearbook (print or save as PDF) |
| `app/archive.tsx` | Shared context and the links between pages (manager, rivalry, player, season) |
| `app/data.ts` | Loads each JSON file once per visit |
| `app/managers/*.tsx` | Managers index, manager profile and rivalry pages |
| `app/players/Players.tsx` | Player search and player pages |
| `app/charts/*.tsx` | The finish-history strip and the standings-race chart (plain SVG/HTML, no chart library) |
| `app/useArchiveQuery.ts` | Keeps page state in the URL so links, reloads and Back/Forward work |
| `app/RecordBook.tsx` | All-time view: champions, careers, head-to-head, highs and activity |
| `app/season/*.tsx` | One component per season tab (Overview, Standings, Draft, Matchups, Transactions, Settings) |
| `app/types.ts` | Types for the JSON files in `public/data/` (definitions: `docs/DATA.md` in the archive repository) |
| `app/format.ts` | Number formatting and small shared helpers |
| `app/globals.css` | All styles (Tailwind base plus hand-written CSS) |

### Styling

`app/globals.css` starts with the design tokens: every colour, text size,
radius and shadow, defined once in `:root`. Use a token (`var(--line-soft)`,
`var(--text-sm)`) rather than a literal value. Only the semantic palettes
(`.pos-*` draft positions, `.bin-*` finish classes, `.type-*` transaction
types) keep literal colours, in their own classes.

- **Text floor:** nothing renders below `--text-xs` (12px); unsized `<small>`
  elements are clamped to it.
- **Dark mode:** the dark values of the tokens live in one block near the end
  of `globals.css` (`:root[data-theme="dark"]`, screen only, so printing stays
  light). A script in `index.html` sets the theme before first paint from the
  saved choice (`localStorage` key `pn-theme`), else the device setting;
  `ThemeToggle` switches it. Add a dark value for any new token.
- **Links between pages** use `.archive-link` (via the `Link`, `ManagerLink`,
  `PlayerLink` and `RivalryLink` components). Their underline is blended from
  the text colour, so it shows on cream and navy alike.

### URL parameters

| Parameter | Values | Meaning |
|---|---|---|
| `view` | `home` (default), `all-time`, `season`, `yearbook`, `managers`, `manager`, `rivalry`, `players`, `player` | Which page |
| `replay` | `1` | On a season's Standings tab, start the week-by-week replay |
| `id` | manager key (`manager-07`) or NFL player ID | The manager or player shown |
| `a`, `b` | manager keys | The two sides of a rivalry |
| `year` | `2010`–`2025` | Season or yearbook (defaults to the latest) |
| `section` | `Overview`, `Standings`, `Draft`, `Matchups`, `Transactions`, `Settings` | Season tab |
| `week`, `game` | week number, matchup ID | Selected matchup on the Matchups tab |
| `round` | `0` (all) or a round number | Draft board filter |

Search boxes and the transaction type filter are not in the URL; they reset when
you change tab or season.
