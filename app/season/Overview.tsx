import { formatScore, isWinner, ordinal, recordLabel, score, whole } from "../format";
import type { SeasonData, SeasonSummary } from "../types";

export default function Overview({ season, summary, managerOf }: { season: SeasonData; summary: SeasonSummary; managerOf: (teamId: string) => string | undefined }) {
  const year = season.year;
  const [champion, runnerUp] = season.placements;
  const topScorer = [...season.standings].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  return (
    <>
      <section className="season-hero">
        <div>
          <p className="eyebrow">{year} champion</p>
          <h1>{champion?.team ?? season.champion.team_name}</h1>
          <p className="hero-subtitle">{champion?.manager ? `Managed by ${champion.manager}` : "PacNation champion"}</p>
        </div>
        <div className="trophy-block" aria-label={`${year} champion`}>
          <span>Champion</span>
          <strong>{year}</strong>
          <small>PacNation</small>
        </div>
      </section>

      <section className="season-facts" aria-label="Season summary">
        <div><span>Runner-up</span><strong>{runnerUp?.team ?? "—"}</strong></div>
        <div>
          <span>Top scorer</span>
          <strong>{topScorer?.team ?? "—"}</strong>
          <small>{topScorer ? `${score.format(topScorer.pointsFor)} PF` : ""}</small>
        </div>
        <div><span>League size</span><strong>{summary.teamCount} teams</strong></div>
        <div>
          <span>Activity</span>
          <strong>{whole.format(summary.transactions)}</strong>
          <small>transaction rows, not unique events</small>
        </div>
      </section>

      <div className="content-stack">
        <section className="panel podium-panel">
          <div className="section-heading"><h2>Final results</h2></div>
          <div className="podium-grid">
            {season.placements.slice(0, 4).map((item) => (
              <article key={item.place} className={`podium-card place-${item.place}`}>
                <span className="place-number">{ordinal(item.place)}</span>
                <h3>{item.team}</h3>
                <p>{item.manager || managerOf(item.teamId) || "Manager not listed"}</p>
                {item.summary && <small>{item.summary.replace("Reg. Season: ", "")}</small>}
              </article>
            ))}
          </div>
        </section>

        <section className="two-column">
          <div className="panel">
            <div className="section-heading"><h2>Playoff path</h2></div>
            <div className="playoff-list">
              {season.playoffs.map((game, index) => (
                <article className="playoff-game" key={`${game.week}-${game.label}-${index}`}>
                  <header><span>Week {game.week}</span><strong>{game.label}</strong></header>
                  {game.teams.map((team) => {
                    const won = isWinner(team, game.teams);
                    return (
                      <div key={team.teamId} className={won ? "winner" : ""}>
                        <span>{team.team}{won && <small className="win-badge">Winner</small>}</span>
                        <strong>{formatScore(team.score)}</strong>
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="section-heading"><h2>Managers</h2></div>
            <div className="manager-list">
              {season.managers.map((item) => (
                <div key={item.teamId}>
                  <span><strong>{item.manager}</strong><small>{item.team}</small></span>
                  <span className="manager-stats">{item.moves ?? "—"} moves · {item.trades ?? "—"} trades</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading"><h2>Season records</h2></div>
          <div className="record-grid">
            {season.records.map((record) => (
              <article key={record.record_type}>
                <span>{recordLabel(record.record_type)}</span>
                <strong>{record.player_name || record.team_name}</strong>
                {record.player_name && <small>{record.team_name}</small>}
                <em>{score.format(record.points)} pts{record.week ? ` · Week ${record.week}` : ""}</em>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
