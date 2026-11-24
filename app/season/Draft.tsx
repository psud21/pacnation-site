import { useMemo, useState } from "react";
import { lower } from "../format";
import type { SeasonData } from "../types";

/** ``round`` 0 means all rounds; it lives in the URL so it survives reloads. */
export default function Draft({ season, round, onRound, managerOf }: { season: SeasonData; round: number; onRound: (round: number) => void; managerOf: (teamId: string) => string | undefined }) {
  const [search, setSearch] = useState("");
  const rounds = useMemo(() => [...new Set(season.draft.map((pick) => pick.round))].sort((a, b) => a - b), [season]);
  const query = search.toLowerCase();
  const picks = season.draft.filter((p) => (round === 0 || p.round === round) && lower(`${p.player} ${p.team} ${managerOf(p.teamId) ?? ""}`).includes(query));
  return (
    <section className="panel">
      <div className="section-heading"><h2>Draft board</h2><span>{season.draft.length} picks</span></div>
      <div className="round-picker" aria-label="Draft round">
        <button aria-pressed={round === 0} className={round === 0 ? "active" : ""} onClick={() => onRound(0)}>All</button>
        {rounds.map((item) => (
          <button key={item} aria-pressed={item === round} aria-label={`Round ${item}`} className={item === round ? "active" : ""} onClick={() => onRound(item)}>R{item}</button>
        ))}
      </div>
      <label className="field-label">Search draft<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Player, team or manager" /></label>
      <p className="method-note">{picks.length} matching picks · numbers show overall selection.</p>
      <div className="draft-grid">
        {picks.map((pick) => (
          <article key={pick.overall} className="draft-pick">
            <span>{pick.overall}</span>
            <div><strong>{pick.player}</strong><small>{pick.playerInfo}</small></div>
            <p>{pick.team}</p>
          </article>
        ))}
      </div>
      {!picks.length && <p role="status">No picks match this round and search.</p>}
    </section>
  );
}
