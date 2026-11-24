import { useState } from "react";
import { TeamManagerLink } from "../archive";
import StandingsRace from "../charts/StandingsRace";
import { lower, score } from "../format";
import type { SeasonData } from "../types";

export default function Standings({ season, managerOf }: { season: SeasonData; managerOf: (teamId: string) => string | undefined }) {
  const [search, setSearch] = useState("");
  const query = search.toLowerCase();
  const rows = season.standings.filter((item) => lower(`${item.team} ${managerOf(item.teamId) ?? ""}`).includes(query));
  const finalPlace = (teamId: string) => season.placements.find((p) => p.teamId === teamId)?.place ?? "—";
  return (
    <section className="panel">
      <div className="section-heading"><h2>Regular-season standings</h2><span>{season.standings.length} teams</span></div>
      <label className="field-label">Find a team or manager<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <div className="table-scroll season-standings" role="region" aria-label="Season standings" tabIndex={0}>
        <table>
          <thead>
            <tr><th>Reg. rank</th><th>Team / manager</th><th>Record</th><th>Win %</th><th>PF</th><th>PA</th><th>Final</th><th>Streak</th></tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.teamId}>
                <td><span className="rank-chip">{item.rank}</span></td>
                <td><strong>{item.team}</strong><small><TeamManagerLink year={season.year} teamId={item.teamId}>{managerOf(item.teamId)}</TeamManagerLink></small></td>
                <td>{item.wins}-{item.losses}-{item.ties}</td>
                <td>{item.winPct?.toFixed(3).replace(/^0/, "")}</td>
                <td>{score.format(item.pointsFor)}</td>
                <td>{score.format(item.pointsAgainst)}</td>
                <td>{finalPlace(item.teamId)}</td>
                <td>{item.streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p role="status">No matching teams or managers.</p>}
      <details className="stats-details">
        <summary>About these stats</summary>
        <p>Records and points are regular season only. Reg. rank is before the playoffs; Final is placement after the postseason. PF = points for; PA = points against.</p>
      </details>
      <StandingsRace season={season} />
    </section>
  );
}
