import { useMemo, useState } from "react";
import { Link, ManagerLink, SeasonLink, useArchive } from "./archive";
import Badge from "./Badge";
import { useJson } from "./data";
import { formatScore, whole } from "./format";
import { CountUp } from "./motion";
import type { ArchiveGame, LeagueIndex } from "./types";

type Classic = { game: ArchiveGame; why: string };

/** The NFL week being played today (kickoff is the Thursday after Labor Day), or null in the offseason. */
export function nflWeek(now = new Date()): number | null {
  const year = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
  const sept1 = new Date(year, 8, 1);
  const laborDay = 1 + ((8 - sept1.getDay()) % 7);
  const kickoff = new Date(year, 8, laborDay + 3);
  const week = Math.floor((now.getTime() - kickoff.getTime()) / (7 * 86_400_000)) + 1;
  return week >= 1 && week <= 17 ? week : null;
}

const margin = (g: ArchiveGame) => Math.abs(g.teams[0].score - g.teams[1].score);
const top = (g: ArchiveGame) => Math.max(g.teams[0].score, g.teams[1].score);

/** The most memorable games played in a given week across every season. */
function weekClassics(games: ArchiveGame[], week: number): Classic[] {
  const pool = games.filter((g) => g.week === week && g.kind !== "consolation");
  if (!pool.length) return [];
  const picks: Classic[] = [];
  const add = (game: ArchiveGame | undefined, why: string) => { if (game && !picks.some((p) => p.game === game)) picks.push({ game, why }); };
  add([...pool].sort((a, b) => top(b) - top(a))[0], "Highest score");
  add([...pool].sort((a, b) => margin(b) - margin(a))[0], "Biggest blowout");
  add([...pool].sort((a, b) => margin(a) - margin(b))[0], "Closest finish");
  return picks;
}

/** Games worth a random pull: photo finishes, routs, shootouts and title games. */
function classicPool(games: ArchiveGame[]): Classic[] {
  return games.flatMap((g): Classic[] => {
    if (g.kind === "playoff" && (g.label === "Championship" || g.label === "Fantasy Super Bowl")) return [{ game: g, why: "Title game" }];
    if (g.kind === "consolation") return [];
    if (margin(g) < 1) return [{ game: g, why: "Photo finish" }];
    if (margin(g) > 80) return [{ game: g, why: "Rout" }];
    if (top(g) > 175) return [{ game: g, why: "Shootout" }];
    return [];
  });
}

function GameCard({ classic }: { classic: Classic }) {
  const { game, why } = classic;
  const [a, b] = [...game.teams].sort((x, y) => y.score - x.score);
  return (
    <article className="classic-card">
      <p className="eyebrow">{why} · {game.year}, week {game.week}{game.label ? ` · ${game.label}` : ""}</p>
      {[a, b].map((team, index) => (
        <div key={team.managerId + index} className={`classic-team ${index === 0 && a.score !== b.score ? "won" : ""}`}>
          <ManagerLink id={team.managerId} badge>{team.team}</ManagerLink>
          <strong>{formatScore(team.score)}</strong>
        </div>
      ))}
      <SeasonLink year={game.year} section="Matchups" week={game.week}>Open the week →</SeasonLink>
    </article>
  );
}

export default function Home({ league }: { league: LeagueIndex }) {
  const { managers, keyOf, open } = useArchive();
  const games = useJson<{ games: ArchiveGame[] }>("games.json");
  const all = games.data?.games ?? [];
  const liveWeek = nflWeek();
  // In the offseason, feature a different week each day.
  const week = liveWeek ?? (Math.floor(Date.now() / 86_400_000) % 14) + 1;
  const classics = useMemo(() => weekClassics(all, week), [all, week]);
  const pool = useMemo(() => classicPool(all), [all]);
  const [random, setRandom] = useState<Classic | null>(null);

  const seasons = [...league.seasons].sort((a, b) => a.year - b.year);
  const latest = seasons[seasons.length - 1];
  const championKey = keyOf(latest.year, latest.championTeamId);
  const champion = championKey ? managers.get(championKey) : undefined;
  const picks = seasons.reduce((n, s) => n + s.draftPicks, 0);
  const firstRival = [...managers.values()].sort((a, b) => b.seasons.length - a.seasons.length);

  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <p className="eyebrow">PacNation League Archive · {league.firstSeason}–{league.lastSeason}</p>
          <h1>Every season. Every matchup. Every bad trade.</h1>
          <p className="home-lede">The complete history of PacNation, preserved from NFL Fantasy: champions, rivalries, drafts and records from {league.seasonCount} seasons.</p>
          <dl className="home-stats">
            <div><dt>Seasons</dt><dd><CountUp value={league.seasonCount} /></dd></div>
            <div><dt>Managers</dt><dd><CountUp value={managers.size} /></dd></div>
            <div><dt>Games</dt><dd><CountUp value={all.length || 1339} format={(n) => whole.format(n)} /></dd></div>
            <div><dt>Draft picks</dt><dd><CountUp value={picks} format={(n) => whole.format(n)} /></dd></div>
          </dl>
        </div>
        <Link to={{ view: "season", year: latest.year, section: "Overview" }} className="reigning" label={`${latest.year} champion: ${latest.champion}`}>
          <span className="reigning-label">Reigning champion</span>
          <strong>{latest.champion}</strong>
          {champion && <span className="reigning-manager"><Badge id={champion.id} name={champion.name} size="md" />{champion.label}</span>}
          <span className="reigning-year">{latest.year}</span>
        </Link>
      </section>

      <section aria-label="Champions by season" className="banner-row">
        {seasons.map((season, i) => {
          const key = keyOf(season.year, season.championTeamId);
          return (
            <Link key={season.year} to={{ view: "season", year: season.year, section: "Overview" }} className="pennant" label={`${season.year} champion: ${season.champion}`}>
              <span className="pennant-inner" style={{ ["--i" as string]: i }}>
                <b>{season.year}</b>
                <small>{season.champion}</small>
                {key && <em>{managers.get(key)?.name}</em>}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="entry-cards" aria-label="Start exploring">
        <button className="entry-card" onClick={() => open({ view: "season", year: latest.year, section: "Standings", replay: 1 })}>
          <span className="entry-kicker">Relive a season</span><strong>Replay {latest.year}, week by week</strong><small>Watch the standings race unfold to the title.</small>
        </button>
        <button className="entry-card" onClick={() => open({ view: "managers" })}>
          <span className="entry-kicker">Find your manager</span><strong>{managers.size} careers, one page each</strong><small>Finish history, rivals, best weeks and draft habits.</small>
        </button>
        <button className="entry-card" onClick={() => open({ view: "rivalry", a: firstRival[0]?.id ?? "", b: firstRival[1]?.id ?? "" })}>
          <span className="entry-kicker">Settle a rivalry</span><strong>Every head-to-head game</strong><small>Pick any two managers and see who really owns whom.</small>
        </button>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>{liveWeek ? `This week in PacNation history` : `From the archive`}</h2>
          <span>Week {week}</span>
        </div>
        <p className="method-note">{liveWeek ? `It's week ${week} of the NFL season. Here's what happened in week ${week} across ${league.seasonCount} PacNation seasons.` : `It's the offseason, so here's a different week from the archive each day.`}</p>
        {games.error ? <p role="alert">{games.error} <button className="action" onClick={games.retry}>Try again</button></p>
          : !games.data ? <p role="status">Loading games…</p>
          : <div className="classic-grid">{classics.map((c) => <GameCard key={`${c.game.year}-${c.why}`} classic={c} />)}</div>}
      </section>

      <section className="panel random-classic">
        <div className="section-heading"><h2>Random classic</h2><span>{whole.format(pool.length)} memorable games</span></div>
        <p className="method-note">Photo finishes under a point, routs over 80, shootouts over 175 and every title game.</p>
        <button className="action" disabled={!pool.length} onClick={() => setRandom(pool[Math.floor(Math.random() * pool.length)])}>{random ? "Another one" : "Pull a classic game"}</button>
        {random && <div className="classic-grid single" role="status"><GameCard classic={random} /></div>}
      </section>
    </div>
  );
}
