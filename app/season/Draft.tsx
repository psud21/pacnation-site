import { Fragment, useMemo, useState } from "react";
import { lower } from "../format";
import type { DraftPick, SeasonData } from "../types";

type Layout = "board" | "list";

/** "WR - CIN" -> "wr"; used to colour picks by position. */
const position = (pick: DraftPick) => lower(pick.playerInfo?.split(" - ")[0]).replace(/[^a-z]/g, "") || "other";

/** Board columns: teams in round-1 order, then any team that had no first-round pick. */
function teamOrder(draft: DraftPick[]) {
  const order: string[] = [];
  for (const pick of [...draft].sort((a, b) => a.overall - b.overall)) if (!order.includes(pick.teamId)) order.push(pick.teamId);
  return order;
}

/** ``round`` 0 means all rounds; it lives in the URL so it survives reloads. */
export default function Draft({ season, round, onRound, managerOf }: { season: SeasonData; round: number; onRound: (round: number) => void; managerOf: (teamId: string) => string | undefined }) {
  const [search, setSearch] = useState("");
  // The board needs width; phones start with the list.
  const [layout, setLayout] = useState<Layout>(() => (window.matchMedia("(max-width: 900px)").matches ? "list" : "board"));
  const rounds = useMemo(() => [...new Set(season.draft.map((pick) => pick.round))].sort((a, b) => a - b), [season]);
  const teams = useMemo(() => teamOrder(season.draft), [season]);
  const teamNames = useMemo(() => new Map(season.draft.map((p) => [p.teamId, p.team])), [season]);
  const query = search.toLowerCase();
  const matches = (p: DraftPick) => lower(`${p.player} ${p.team} ${managerOf(p.teamId) ?? ""} ${p.playerInfo ?? ""}`).includes(query);
  const inRound = (p: DraftPick) => round === 0 || p.round === round;
  const picks = season.draft.filter((p) => inRound(p) && matches(p));
  const shownRounds = rounds.filter((r) => round === 0 || r === round);
  // A team could hold two picks in one round after a trade; keep every pick.
  const cell = new Map<string, DraftPick[]>();
  for (const p of season.draft) cell.set(`${p.round}-${p.teamId}`, [...(cell.get(`${p.round}-${p.teamId}`) ?? []), p]);

  return (
    <section className="panel">
      <div className="section-heading"><h2>Draft board</h2><span>{season.draft.length} picks</span></div>
      <div className="draft-controls">
        <div className="round-picker" aria-label="Draft round">
          <button aria-pressed={round === 0} className={round === 0 ? "active" : ""} onClick={() => onRound(0)}>All</button>
          {rounds.map((item) => (
            <button key={item} aria-pressed={item === round} aria-label={`Round ${item}`} className={item === round ? "active" : ""} onClick={() => onRound(item)}>R{item}</button>
          ))}
        </div>
        <div className="layout-toggle" aria-label="Draft layout">
          {(["board", "list"] as const).map((item) => (
            <button key={item} aria-pressed={layout === item} className={layout === item ? "active" : ""} onClick={() => setLayout(item)}>{item === "board" ? "Board" : "List"}</button>
          ))}
        </div>
      </div>
      <label className="field-label">Search draft<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player, position, team or manager" /></label>
      <p className="method-note">
        {picks.length} matching picks · numbers show overall selection{layout === "board" ? " · columns follow first-round order" : ""}.
      </p>

      {layout === "board" ? (
        <div className="table-scroll draft-board-scroll" role="region" aria-label="Draft board, scroll horizontally for all teams" tabIndex={0}>
          <div className="draft-board" style={{ gridTemplateColumns: `44px repeat(${teams.length}, minmax(92px, 1fr))` }}>
            <span className="board-corner" />
            {teams.map((teamId) => (
              <div className="board-team" key={teamId}><strong>{teamNames.get(teamId)}</strong><small>{managerOf(teamId)}</small></div>
            ))}
            {shownRounds.map((r) => (
              <Fragment key={r}>
                <span className="board-round">R{r}</span>
                {teams.map((teamId) => {
                  const cellPicks = cell.get(`${r}-${teamId}`) ?? [];
                  if (!cellPicks.length) return <span className="board-pick empty" key={teamId} />;
                  return (
                    <div className="board-cell" key={teamId}>
                      {cellPicks.map((pick) => (
                        <div className={`board-pick pos-${position(pick)} ${query && !matches(pick) ? "dim" : ""}`} key={pick.overall} title={`${pick.overall}. ${pick.player} (${pick.playerInfo ?? ""}) to ${pick.team}`}>
                          <small>{pick.overall}</small>
                          <strong>{pick.player}</strong>
                          <span>{pick.playerInfo}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="draft-list">
          {shownRounds.map((r) => {
            const roundPicks = picks.filter((p) => p.round === r);
            if (!roundPicks.length) return null;
            return (
              <div key={r}>
                {round === 0 && <h3 className="draft-round-heading">Round {r}</h3>}
                {roundPicks.map((pick) => (
                  <article key={pick.overall} className={`draft-row pos-${position(pick)}`}>
                    <span>{pick.overall}</span>
                    <div><strong>{pick.player}</strong><small>{pick.playerInfo}</small></div>
                    <p>{pick.team}</p>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {!picks.length && <p role="status">No picks match this round and search.</p>}
    </section>
  );
}
