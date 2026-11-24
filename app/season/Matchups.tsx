import { useMemo } from "react";
import { formatScore, isWinner } from "../format";
import type { SeasonData } from "../types";

/** ``week`` and ``gameId`` live in the URL; without a gameId the first game of the week is shown. */
export default function Matchups({ season, week, gameId, onWeek, onGame }: { season: SeasonData; week: number; gameId: string | null; onWeek: (week: number) => void; onGame: (id: string) => void }) {
  const weeks = useMemo(() => [...new Set(season.matchups.map((item) => item.week))].sort((a, b) => a - b), [season]);
  const games = useMemo(() => season.matchups.filter((item) => item.week === week), [season, week]);
  const active = games.find((item) => item.id === gameId) ?? games[0];
  const lineups = useMemo(() => {
    if (!active) return [];
    const teamIds = new Set(active.teams.map((team) => team.teamId));
    return season.lineups.filter((lineup) => lineup.week === active.week && teamIds.has(lineup.teamId));
  }, [season, active]);

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="section-heading"><h2>Week {week} matchups</h2><span>{games.length} games</span></div>
        <div className="week-picker" aria-label="Matchup week">
          {weeks.map((item) => (
            <button key={item} aria-pressed={item === week} aria-label={`Week ${item}`} className={item === week ? "active" : ""} onClick={() => onWeek(item)}>{item}</button>
          ))}
        </div>
        <div className="matchup-grid">
          {games.map((matchup) => (
            <button key={matchup.id} aria-pressed={active?.id === matchup.id} className={`matchup-card ${active?.id === matchup.id ? "active" : ""}`} onClick={() => onGame(matchup.id)}>
              {matchup.teams.map((team) => (
                <span key={team.teamId}>
                  <em>{team.team}{isWinner(team, matchup.teams) && <small className="win-badge">Winner</small>}</em>
                  <strong>{formatScore(team.score)}</strong>
                </span>
              ))}
            </button>
          ))}
        </div>
        {!games.length && <p role="status">No archived games for this week. Choose a listed week above.</p>}
      </section>
      {active && (
        <section className="panel lineup-panel">
          <div className="section-heading"><h2>Starting lineups</h2><span>Week {active.week}</span></div>
          {lineups.length ? (
            <div className="lineup-columns">
              {lineups.map((lineup) => (
                <div key={lineup.teamId}>
                  <h3>{lineup.team}</h3>
                  <div className="lineup-list">
                    {lineup.players.filter((player) => player.starter).map((player, index) => (
                      <div key={`${player.playerId}-${index}`}>
                        <span className="slot">{player.slot}</span>
                        <span><strong>{player.player}</strong><small>{player.playerInfo}</small></span>
                        <em>{formatScore(player.points)}</em>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="empty-note">Detailed lineup data was not available for this archived matchup.</p>}
        </section>
      )}
    </div>
  );
}
