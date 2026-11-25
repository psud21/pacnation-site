import { Link } from "../archive";
import { formatScore, ordinal, recordLabel, score, whole } from "../format";
import type { SeasonData, SeasonSummary } from "../types";

/**
 * One season laid out for print: champion, final order, standings, the
 * playoff bracket, the whole draft board, records and weekly highs. "Print"
 * opens the browser's print dialog, where it can also be saved as a PDF.
 */
export default function Yearbook({ season, summary, managerOf }: { season: SeasonData; summary: SeasonSummary; managerOf: (teamId: string) => string | undefined }) {
  const year = season.year;
  const champion = season.placements[0];
  const cutoff = Math.min(...season.playoffs.map((g) => g.week));
  const teams = [...new Set([...season.draft].sort((a, b) => a.overall - b.overall).map((p) => p.teamId))];
  const rounds = [...new Set(season.draft.map((p) => p.round))].sort((a, b) => a - b);
  const pick = new Map(season.draft.map((p) => [`${p.round}-${p.teamId}`, p]));
  const teamName = new Map(season.managers.map((m) => [m.teamId, m.team]));
  const weekly = season.matchups.filter((m) => m.week < cutoff).flatMap((m) => m.teams.map((t) => ({ ...t, week: m.week }))).filter((t) => t.score != null);
  const highs = [...weekly].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
  const lows = [...weekly].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 5);
  const counts = season.transactions.reduce<Record<string, number>>((c, t) => ({ ...c, [t.type]: (c[t.type] ?? 0) + 1 }), {});

  return (
    <article className="yearbook">
      <div className="yearbook-actions no-print">
        <Link to={{ view: "season", year, section: "Overview" }}>← Back to the {year} season</Link>
        <button className="action" onClick={() => window.print()}>Print or save as PDF</button>
      </div>

      <header className="yearbook-cover">
        <p className="eyebrow">PacNation League Archive</p>
        <h1>The {year} Yearbook</h1>
        <div className="yearbook-champion">
          <span>Champion</span>
          <strong>{champion?.team ?? season.champion.team_name}</strong>
          {champion?.manager && <small>Managed by {champion.manager}</small>}
        </div>
        <p className="yearbook-meta">{summary.teamCount} teams · {season.draft.length} draft picks · {whole.format(season.matchups.length)} games · {whole.format(season.transactions.length)} transaction rows</p>
      </header>

      <section className="yearbook-section">
        <h2>Final results</h2>
        <ol className="yearbook-podium">
          {season.placements.map((p) => (
            <li key={p.place}><b>{ordinal(p.place)}</b> {p.team} <small>{p.manager || managerOf(p.teamId)}</small></li>
          ))}
        </ol>
      </section>

      <section className="yearbook-section">
        <h2>Regular-season standings</h2>
        <table className="compact-table yearbook-table">
          <thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">Manager</th><th scope="col">W–L–T</th><th scope="col">PF</th><th scope="col">PA</th></tr></thead>
          <tbody>
            {season.standings.map((s) => (
              <tr key={s.teamId}><td>{s.rank}</td><td>{s.team}</td><td>{managerOf(s.teamId)}</td><td>{s.wins}–{s.losses}–{s.ties}</td><td>{score.format(s.pointsFor)}</td><td>{score.format(s.pointsAgainst)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="yearbook-section">
        <h2>Playoffs</h2>
        <ul className="yearbook-games">
          {season.playoffs.map((g, i) => (
            <li key={`${g.week}-${i}`}><b>Week {g.week} · {g.label}</b> {g.teams.map((t) => `${t.team} ${formatScore(t.score)}`).join("  vs  ")}</li>
          ))}
        </ul>
      </section>

      <section className="yearbook-section yearbook-draft">
        <h2>Draft board</h2>
        <table className="compact-table yearbook-table">
          <thead><tr><th scope="col">Rd</th>{teams.map((t) => <th scope="col" key={t}>{teamName.get(t)}</th>)}</tr></thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r}><th scope="row">{r}</th>{teams.map((t) => { const p = pick.get(`${r}-${t}`); return <td key={t}>{p ? <>{p.player}<small>{p.playerInfo}</small></> : "—"}</td>; })}</tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="yearbook-section yearbook-columns">
        <div>
          <h2>Season records</h2>
          <ul className="yearbook-games">
            {season.records.map((r) => <li key={r.record_type}><b>{recordLabel(r.record_type)}</b> {r.player_name || r.team_name} · {score.format(r.points)}{r.week ? ` (week ${r.week})` : ""}</li>)}
          </ul>
          <h2>Activity</h2>
          <ul className="yearbook-games">{Object.entries(counts).map(([type, n]) => <li key={type}><b>{type}</b> {whole.format(n)} rows</li>)}</ul>
        </div>
        <div>
          <h2>Best weeks</h2>
          <ul className="yearbook-games">{highs.map((t, i) => <li key={i}><b>{formatScore(t.score)}</b> {t.team}, week {t.week}</li>)}</ul>
          <h2>Worst weeks</h2>
          <ul className="yearbook-games">{lows.map((t, i) => <li key={i}><b>{formatScore(t.score)}</b> {t.team}, week {t.week}</li>)}</ul>
        </div>
      </section>
      <p className="yearbook-footer">PacNation League Archive · preserved from NFL Fantasy · {year} season</p>
    </article>
  );
}
