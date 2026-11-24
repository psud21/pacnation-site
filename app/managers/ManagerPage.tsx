import { useMemo } from "react";
import { Link, ManagerLink, PlayerLink, RivalryLink, SeasonLink, useArchive } from "../archive";
import FinishStrip, { FinishLegend } from "../charts/FinishStrip";
import { useJson } from "../data";
import { formatScore, ordinal, score } from "../format";
import type { ArchiveGame, ManagerWeek, RecordBookData } from "../types";

type Rival = { opponentId: string; wins: number; losses: number; ties: number; playoffWins: number; playoffLosses: number; games: number };

/** Head-to-head against every opponent: regular season W-L-T plus bracket playoff meetings. */
export function rivalsOf(games: ArchiveGame[], id: string): Rival[] {
  const table = new Map<string, Rival>();
  for (const game of games) {
    const own = game.teams.find((t) => t.managerId === id);
    const other = game.teams.find((t) => t.managerId !== id);
    if (!own || !other || game.kind === "consolation") continue;
    const row = table.get(other.managerId) ?? { opponentId: other.managerId, wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, games: 0 };
    row.games += 1;
    if (game.kind === "playoff") {
      if (own.score > other.score) row.playoffWins += 1; else if (own.score < other.score) row.playoffLosses += 1;
    } else if (own.score > other.score) row.wins += 1; else if (own.score < other.score) row.losses += 1; else row.ties += 1;
    table.set(other.managerId, row);
  }
  return [...table.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
}

const pct = (wins: number, losses: number, ties = 0) => (wins + losses + ties ? `${((100 * (wins + ties / 2)) / (wins + losses + ties)).toFixed(1)}%` : "—");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

function WeeksTable({ weeks, label }: { weeks: ManagerWeek[]; label: string }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="compact-table">
        <thead><tr><th scope="col">Week</th><th scope="col">Opponent</th><th scope="col">Score</th></tr></thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={`${w.year}-${w.week}`}>
              <td><SeasonLink year={w.year} section="Matchups" week={w.week}>{w.year} W{w.week}</SeasonLink>{w.kind !== "regular" && <small>{w.kind === "playoff" ? "Playoffs" : "Consolation"}</small>}</td>
              <td><ManagerLink id={w.opponentId} /><small>{formatScore(w.opponentPoints)}</small></td>
              <td className="numeric"><strong>{formatScore(w.points)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ManagerPage({ id, years }: { id: string; years: number[] }) {
  const { managers } = useArchive();
  const manager = managers.get(id);
  const book = useJson<RecordBookData>("all-time.json");
  const games = useJson<{ games: ArchiveGame[] }>("games.json");
  const rivals = useMemo(() => (games.data ? rivalsOf(games.data.games, id) : []), [games.data, id]);
  if (!manager) return <section className="panel" role="alert"><h1>Manager not found</h1><p>Choose one from the <Link to={{ view: "managers" }}>managers list</Link>.</p></section>;

  const career = book.data?.eras.all.careers.find((c) => c.managerId === id);
  const titles = manager.seasons.filter((s) => s.final === 1).length;
  const first = manager.seasons[0].year;
  const last = manager.seasons[manager.seasons.length - 1].year;
  const teams = [...new Set(manager.seasons.map((s) => s.team))];

  return (
    <div className="content-stack profile">
      <header className="profile-heading">
        <p className="eyebrow">Manager</p>
        <h1>{manager.label}</h1>
        <p>{first === last ? first : `${first}–${last}`} · {manager.seasons.length} {manager.seasons.length === 1 ? "season" : "seasons"} · {teams.length} team {teams.length === 1 ? "name" : "names"} · latest: {manager.team}</p>
      </header>

      <section className="stat-tiles" aria-label="Career summary">
        <div><span>Titles</span><strong>{titles}</strong><small>{manager.titleGames} title {manager.titleGames === 1 ? "game" : "games"}</small></div>
        {career && <div><span>Regular season</span><strong>{career.wins}–{career.losses}{career.ties ? `–${career.ties}` : ""}</strong><small>{pct(career.wins, career.losses, career.ties)} win rate</small></div>}
        {career && <div><span>Playoffs</span><strong>{career.playoffWins}–{career.playoffLosses}</strong><small>bracket games only</small></div>}
        {career && <div><span>Luck</span><strong>{signed(career.luck)}</strong><small>wins vs. {career.expectedWins.toFixed(1)} expected from all-play</small></div>}
      </section>

      <section className="panel">
        <div className="section-heading"><h2>Finish history</h2><span>{years[0]}–{years[years.length - 1]}</span></div>
        <FinishStrip seasons={manager.seasons} years={years} />
        <FinishLegend />
        <div className="table-scroll" role="region" aria-label="Seasons" tabIndex={0}>
          <table className="compact-table profile-seasons">
            <thead><tr><th scope="col">Season</th><th scope="col">Team</th><th scope="col">Final</th><th scope="col">Reg. rank</th><th scope="col">W–L–T</th><th scope="col">PF</th><th scope="col">PA</th><th scope="col">Moves</th><th scope="col">Trades</th></tr></thead>
            <tbody>
              {[...manager.seasons].reverse().map((s) => (
                <tr key={s.year}>
                  <td><SeasonLink year={s.year}>{s.year}</SeasonLink></td>
                  <td><strong>{s.team}</strong><small>{s.teamCount} teams</small></td>
                  <td className={s.final === 1 ? "title-cell" : ""}>{s.final ? ordinal(s.final) : "—"}</td>
                  <td>{s.rank ?? "—"}</td>
                  <td className="nowrap">{s.wins}–{s.losses}–{s.ties}</td>
                  <td>{score.format(s.pointsFor)}</td>
                  <td>{score.format(s.pointsAgainst)}</td>
                  <td>{s.moves ?? "—"}</td>
                  <td>{s.trades ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-column">
        <section className="panel"><h3>Best weeks</h3><WeeksTable weeks={manager.bestWeeks} label="Best weeks" /></section>
        <section className="panel"><h3>Worst weeks</h3><WeeksTable weeks={manager.worstWeeks} label="Worst weeks" /></section>
      </div>

      <section className="panel">
        <div className="section-heading"><h2>Rivals</h2><span>{rivals.length} opponents</span></div>
        <p className="method-note">Most-played first. Regular season and bracket playoff games; consolation games are left out. Open a rivalry for every game.</p>
        {games.error ? <p role="alert">{games.error} <button className="action" onClick={games.retry}>Try again</button></p> : (
          <div className="table-scroll" role="region" aria-label="Rivals" tabIndex={0}>
            <table className="compact-table">
              <thead><tr><th scope="col">Opponent</th><th scope="col">Regular season</th><th scope="col">Win %</th><th scope="col">Playoffs</th><th scope="col">Games</th></tr></thead>
              <tbody>
                {rivals.map((r) => (
                  <tr key={r.opponentId}>
                    <td><RivalryLink a={id} b={r.opponentId}>{managers.get(r.opponentId)?.label ?? "Unidentified manager"}</RivalryLink></td>
                    <td className="nowrap">{r.wins}–{r.losses}–{r.ties}</td>
                    <td>{pct(r.wins, r.losses, r.ties)}</td>
                    <td>{r.playoffWins + r.playoffLosses ? `${r.playoffWins}–${r.playoffLosses}` : "—"}</td>
                    <td className="numeric">{r.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="two-column">
        <section className="panel">
          <h3>Trade partners</h3>
          {manager.tradePartners.length ? (
            <ol className="ranked-list">{manager.tradePartners.map((p) => <li key={p.managerId}><span><ManagerLink id={p.managerId} /></span><strong>{p.trades} {p.trades === 1 ? "trade" : "trades"}</strong></li>)}</ol>
          ) : <p className="empty-note">No trades on record.</p>}
        </section>
        <section className="panel">
          <h3>Drafted most often</h3>
          {manager.mostDrafted.length ? (
            <ol className="ranked-list">{manager.mostDrafted.map((p) => <li key={p.player}><span><PlayerLink id={p.playerId}>{p.player}</PlayerLink><small>{p.years.join(", ")}</small></span><strong>{p.picks}×</strong></li>)}</ol>
          ) : <p className="empty-note">No player drafted more than once.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="section-heading"><h2>First pick each season</h2></div>
        <div className="table-scroll" role="region" aria-label="First picks" tabIndex={0}>
          <table className="compact-table">
            <thead><tr><th scope="col">Season</th><th scope="col">Player</th><th scope="col">Overall</th></tr></thead>
            <tbody>
              {[...manager.firstPicks].reverse().map((p) => (
                <tr key={p.year}>
                  <td><SeasonLink year={p.year} section="Draft">{p.year}</SeasonLink></td>
                  <td><strong><PlayerLink id={p.playerId}>{p.player}</PlayerLink></strong><small>{p.playerInfo}</small></td>
                  <td className="numeric">{p.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
