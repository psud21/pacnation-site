import { useMemo, useState } from "react";
import { Link, ManagerLink, SeasonLink } from "../archive";
import { useJson } from "../data";
import { formatScore, whole } from "../format";
import type { Player } from "../types";

type PlayersFile = { players: Player[] };
const POSITIONS = ["All", "QB", "RB", "WR", "TE", "K", "DEF"];
const LIMIT = 60;

function useAllPlayers() {
  const file = useJson<PlayersFile>("players.json");
  return { ...file, players: file.data?.players ?? [] };
}

function Status({ error, retry }: { error?: string; retry: () => void }) {
  return error
    ? <section className="panel" role="alert"><p>{error}</p><button className="action" onClick={retry}>Try again</button></section>
    : <section className="panel" role="status"><p>Loading players…</p></section>;
}

/** Search every player who was drafted or started for a PacNation team. */
export function PlayersSearch() {
  const { players, data, error, retry } = useAllPlayers();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("All");
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return players.filter((p) => (position === "All" || p.pos === position) && words.every((w) => p.name.toLowerCase().includes(w)));
  }, [players, query, position]);
  if (!data) return <Status error={error} retry={retry} />;

  return (
    <div className="content-stack">
      <header className="book-heading"><h1>Players</h1></header>
      <section className="panel">
        <p className="method-note">{whole.format(players.length)} NFL players drafted or started by a PacNation team, ranked by points scored as a starter across all seasons.</p>
        <div className="transaction-tools">
          <select value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Position">{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a player, e.g. Derrick Henry" aria-label="Search players" />
        </div>
        <div className="table-scroll" role="region" aria-label="Players" tabIndex={0}>
          <table className="compact-table">
            <thead><tr><th scope="col">Player</th><th scope="col">Drafted</th><th scope="col">Starts</th><th scope="col">Points</th></tr></thead>
            <tbody>
              {matches.slice(0, LIMIT).map((p) => (
                <tr key={p.id}>
                  <td><Link to={{ view: "player", id: p.id }}><strong>{p.name}</strong></Link><small>{p.pos ?? "—"}</small></td>
                  <td>{p.drafts.length ? `${p.drafts.length}×` : "—"}</td>
                  <td>{p.starts}</td>
                  <td className="numeric">{formatScore(p.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="method-note" role="status">{matches.length > LIMIT ? `Showing the top ${LIMIT} of ${whole.format(matches.length)} matches; refine the search to see more.` : `${matches.length} ${matches.length === 1 ? "match" : "matches"}.`}</p>
      </section>
    </div>
  );
}

/** One player: who drafted him, and what he scored for each manager. */
export function PlayerPage({ id }: { id: string }) {
  const { players, data, error, retry } = useAllPlayers();
  const player = useMemo(() => players.find((p) => p.id === id), [players, id]);
  if (!data) return <Status error={error} retry={retry} />;
  if (!player) return <section className="panel" role="alert"><h1>Player not found</h1><p><Link to={{ view: "players" }}>Search all players</Link></p></section>;
  const rank = players.indexOf(player) + 1;

  return (
    <div className="content-stack profile">
      <header className="profile-heading">
        <p className="eyebrow">Player · <Link to={{ view: "players" }}>all players</Link></p>
        <h1>{player.name}</h1>
        <p>{player.pos ?? "Position unknown"} · #{rank} in PacNation starter points</p>
      </header>
      <section className="stat-tiles" aria-label="Player summary">
        <div><span>Points as a starter</span><strong>{formatScore(player.points)}</strong><small>for PacNation teams</small></div>
        <div><span>Starts</span><strong>{player.starts}</strong><small>for {player.managers.length} {player.managers.length === 1 ? "manager" : "managers"}</small></div>
        <div><span>Times drafted</span><strong>{player.drafts.length}</strong><small>{player.drafts.length ? `first in ${player.drafts[0].year}` : "never drafted"}</small></div>
        {player.bestWeek && <div><span>Best week</span><strong>{formatScore(player.bestWeek.points)}</strong><small>{player.bestWeek.year}, week {player.bestWeek.week}</small></div>}
      </section>
      <div className="two-column">
        <section className="panel">
          <h3>Draft history</h3>
          {player.drafts.length ? (
            <div className="table-scroll" role="region" aria-label="Draft history" tabIndex={0}>
              <table className="compact-table">
                <thead><tr><th scope="col">Season</th><th scope="col">Drafted by</th><th scope="col">Pick</th></tr></thead>
                <tbody>{[...player.drafts].reverse().map((d) => (
                  <tr key={`${d.year}-${d.overall}`}><td><SeasonLink year={d.year} section="Draft">{d.year}</SeasonLink></td><td><ManagerLink id={d.managerId} /></td><td className="numeric">R{d.round} · #{d.overall}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty-note">Never drafted; picked up during seasons.</p>}
        </section>
        <section className="panel">
          <h3>Points by manager</h3>
          {player.managers.length ? (
            <div className="table-scroll" role="region" aria-label="Points by manager" tabIndex={0}>
              <table className="compact-table">
                <thead><tr><th scope="col">Manager</th><th scope="col">Starts</th><th scope="col">Points</th></tr></thead>
                <tbody>{player.managers.map((m) => (
                  <tr key={m.managerId}><td><ManagerLink id={m.managerId} /><small>{m.years.join(", ")}</small></td><td>{m.starts}</td><td className="numeric">{formatScore(m.points)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty-note">Never started for a PacNation team.</p>}
        </section>
      </div>
      <p className="method-note">Points count only weeks the player was in a starting lineup, including playoff and consolation weeks.</p>
    </div>
  );
}
