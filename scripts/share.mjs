// Generate static share pages after `vite build`.
//
// The app routes with query strings (?view=manager&id=...), and chat apps and
// social sites fetch the same index.html for every such URL, so a link preview
// can't differ per page. This writes one small HTML page per season, manager
// and rivalry under dist/share/, each with its own title and description for
// link previews, which forwards visitors straight into the app.
//
//   node scripts/share.mjs            (run by `npm run build`)
// Set VITE_SITE_URL (as the deploy workflow does) for absolute preview URLs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const site = (process.env.VITE_SITE_URL ?? "").replace(/\/$/, "");
const read = (name) => JSON.parse(readFileSync(path.join(dist, "data", name), "utf8"));

const index = read("index.json");
const managers = read("managers.json").managers;
const games = read("games.json").games;
const careers = new Map(read("all-time.json").eras.all.careers.map((c) => [c.managerId, c]));
const byId = new Map(managers.map((m) => [m.id, m]));
const keyOf = new Map(managers.flatMap((m) => m.seasons.map((s) => [`${s.year}-${s.teamId}`, m.id])));

const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const record = (w, l, t = 0) => `${w}–${l}${t ? `–${t}` : ""}`;

function page({ dir, query, title, description }) {
  const target = `../../../?${new URLSearchParams(query)}`;
  const absolute = (relative) => (site ? `${site}/${relative}` : relative);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · PacNation League Archive</title>
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PacNation League Archive">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(absolute(`share/${dir}/`))}">
<meta property="og:image" content="${escape(absolute("og.jpg"))}">
<meta property="og:image:width" content="1536">
<meta property="og:image:height" content="1024">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${escape(absolute("og.jpg"))}">
<link rel="canonical" href="${escape(absolute(`?${new URLSearchParams(query)}`))}">
<meta http-equiv="refresh" content="0; url=${escape(target)}">
<script>location.replace(${JSON.stringify(target)})</script>
</head>
<body><p><a href="${escape(target)}">Open ${escape(title)} in the PacNation League Archive</a></p></body>
</html>
`;
  mkdirSync(path.join(dist, "share", dir), { recursive: true });
  writeFileSync(path.join(dist, "share", dir, "index.html"), html);
}

let count = 0;

for (const season of index.seasons) {
  const manager = byId.get(keyOf.get(`${season.year}-${season.championTeamId}`));
  page({
    dir: `season/${season.year}`,
    query: { view: "season", year: season.year, section: "Overview" },
    title: `The ${season.year} PacNation season`,
    description: `Champion: ${season.champion}${manager ? ` (${manager.name})` : ""}. ${season.teamCount} teams, ${season.matchups} games, every draft pick and lineup.`,
  });
  count += 1;
}

for (const m of managers) {
  const c = careers.get(m.id);
  const titles = m.seasons.filter((s) => s.final === 1).length;
  const span = `${m.seasons[0].year}–${m.seasons[m.seasons.length - 1].year}`;
  page({
    dir: `manager/${m.id}`,
    query: { view: "manager", id: m.id },
    title: `${m.label} · PacNation manager`,
    description: `${titles} ${titles === 1 ? "title" : "titles"} in ${m.seasons.length} seasons (${span}).${c ? ` Regular season ${record(c.wins, c.losses, c.ties)}, playoffs ${record(c.playoffWins, c.playoffLosses)}.` : ""}`,
  });
  count += 1;
}

const pairs = new Map();
for (const g of games) {
  if (g.kind === "consolation") continue;
  const [a, b] = [...g.teams].sort((x, y) => x.managerId.localeCompare(y.managerId));
  const key = `${a.managerId}--${b.managerId}`;
  const tally = pairs.get(key) ?? { a: a.managerId, b: b.managerId, aw: 0, bw: 0, t: 0, po: 0 };
  if (g.kind === "playoff") tally.po += 1;
  else if (a.score > b.score) tally.aw += 1; else if (b.score > a.score) tally.bw += 1; else tally.t += 1;
  pairs.set(key, tally);
}
for (const [key, p] of pairs) {
  const a = byId.get(p.a), b = byId.get(p.b);
  const verb = p.aw > p.bw ? "leads" : p.aw < p.bw ? "trails" : "is level at";
  const playoffs = p.po ? `, with ${p.po} playoff ${p.po === 1 ? "meeting" : "meetings"}` : "";
  page({
    dir: `rivalry/${key}`,
    query: { view: "rivalry", a: p.a, b: p.b },
    title: `${a.label} vs ${b.label}`,
    description: `${a.name} ${verb} ${record(p.aw, p.bw, p.t)} against ${b.name} in the regular season${playoffs}. Every game between them in the PacNation League Archive.`,
  });
  count += 1;
}

console.log(`share pages: ${count} (${index.seasons.length} seasons, ${managers.length} managers, ${pairs.size} rivalries)${site ? ` for ${site}` : " (relative URLs: set VITE_SITE_URL for previews)"}`);
