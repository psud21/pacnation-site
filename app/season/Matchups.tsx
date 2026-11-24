import { useMemo, useRef } from "react";
import { formatScore, isWinner } from "../format";
import type { Lineup, PlayerLine, SeasonData, TeamScore } from "../types";

type Pair = { slot: string; left?: PlayerLine; right?: PlayerLine };

/**
 * Line up two starting lineups slot against slot. Players are paired by the
 * n-th occurrence of each slot (first RB vs first RB), so an empty slot on one
 * side never shifts the rest of the rows.
 */
function pairStarters(left: PlayerLine[], right: PlayerLine[]): Pair[] {
  const remaining = [...right];
  const pairs: Pair[] = left.map((player) => {
    const index = remaining.findIndex((other) => other.slot === player.slot);
    const match = index >= 0 ? remaining.splice(index, 1)[0] : undefined;
    return { slot: player.slot, left: player, right: match };
  });
  return [...pairs, ...remaining.map((player) => ({ slot: player.slot, right: player }))];
}

function PlayerCell({ player, side }: { player?: PlayerLine; side: "left" | "right" }) {
  if (!player) return <span className={`versus-player ${side} empty`}>—</span>;
  return (
    <span className={`versus-player ${side}`}>
      <strong>{player.player}</strong>
      <small>{[player.playerInfo, player.opponent].filter(Boolean).join(" · ")}</small>
    </span>
  );
}

function TeamHeading({ team, teams, side }: { team: TeamScore; teams: TeamScore[]; side: "left" | "right" }) {
  return (
    <div className={`versus-team ${side} ${isWinner(team, teams) ? "winner" : ""}`}>
      <strong>{team.team}</strong>
      <small>{[team.manager, team.record && `${team.record} after this week`].filter(Boolean).join(" · ")}</small>
      <em>{formatScore(team.score)}</em>
    </div>
  );
}

function Versus({ teams, lineups }: { teams: TeamScore[]; lineups: Lineup[] }) {
  const [left, right] = teams.map((team) => lineups.find((lineup) => lineup.teamId === team.teamId));
  const starters = pairStarters(left?.players.filter((p) => p.starter) ?? [], right?.players.filter((p) => p.starter) ?? []);
  const leftBench = left?.players.filter((p) => !p.starter) ?? [];
  const rightBench = right?.players.filter((p) => !p.starter) ?? [];
  const bench = Array.from({ length: Math.max(leftBench.length, rightBench.length) }, (_, i) => ({ slot: "BN", left: leftBench[i], right: rightBench[i] }));
  const rows = (pairs: Pair[], label: string) => (
    <div className="versus-rows" role="group" aria-label={label}>
      {pairs.map((pair, index) => (
        <div className="versus-row" key={`${pair.slot}-${index}`}>
          <PlayerCell player={pair.left} side="left" />
          <em className={pair.left && pair.right && (pair.left.points ?? 0) > (pair.right.points ?? 0) ? "better" : ""}>{pair.left ? formatScore(pair.left.points) : ""}</em>
          <span className="slot">{pair.slot}</span>
          <em className={pair.left && pair.right && (pair.right.points ?? 0) > (pair.left.points ?? 0) ? "better" : ""}>{pair.right ? formatScore(pair.right.points) : ""}</em>
          <PlayerCell player={pair.right} side="right" />
        </div>
      ))}
    </div>
  );
  return (
    <div className="versus">
      <div className="versus-header">
        <TeamHeading team={teams[0]} teams={teams} side="left" />
        <span className="versus-vs">vs</span>
        <TeamHeading team={teams[1]} teams={teams} side="right" />
      </div>
      {rows(starters, "Starters")}
      {bench.length > 0 && (
        <details className="versus-bench">
          <summary>Bench ({leftBench.length} and {rightBench.length} players, points not counted)</summary>
          {rows(bench, "Bench")}
        </details>
      )}
    </div>
  );
}

/** ``week`` and ``gameId`` live in the URL; without a gameId the first game of the week is shown. */
export default function Matchups({ season, week, gameId, onWeek, onGame }: { season: SeasonData; week: number; gameId: string | null; onWeek: (week: number) => void; onGame: (id: string) => void }) {
  const lineupPanel = useRef<HTMLElement>(null);
  const weeks = useMemo(() => [...new Set(season.matchups.map((item) => item.week))].sort((a, b) => a - b), [season]);
  const games = useMemo(() => season.matchups.filter((item) => item.week === week), [season, week]);
  const active = games.find((item) => item.id === gameId) ?? games[0];
  const lineups = useMemo(() => {
    if (!active) return [];
    const teamIds = new Set(active.teams.map((team) => team.teamId));
    return season.lineups.filter((lineup) => lineup.week === active.week && teamIds.has(lineup.teamId));
  }, [season, active]);

  function choose(id: string) {
    onGame(id);
    // In the single-column layout the lineups are far below the game list.
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => lineupPanel.current?.scrollIntoView({ block: "start" }));
    }
  }

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
            <button key={matchup.id} aria-pressed={active?.id === matchup.id} className={`matchup-card ${active?.id === matchup.id ? "active" : ""}`} onClick={() => choose(matchup.id)}>
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
        <section className="panel lineup-panel" ref={lineupPanel}>
          <div className="section-heading"><h2>Lineups</h2><span>Week {active.week}</span></div>
          {lineups.length ? <Versus teams={active.teams} lineups={lineups} /> : <p className="empty-note">Detailed lineup data was not available for this archived matchup.</p>}
        </section>
      )}
    </div>
  );
}
