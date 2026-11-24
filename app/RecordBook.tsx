import { useMemo, useState } from "react";
import { ManagerLink, PlayerLink, RivalryLink, SeasonLink } from "./archive";
import { useJson } from "./data";
import { formatScore } from "./format";
import type { Career, HighRecord, MarginGame, PickValue, RecordBookData } from "./types";

const eras = [{ id: "all", label: "All seasons" }, { id: "early", label: "2010–2015" }, { id: "modern", label: "2016–2025" }];
const sorts = [
  { key: "titles", label: "Championships" },
  { key: "wins", label: "Regular-season wins" },
  { key: "winPct", label: "Win percentage" },
  { key: "seasons", label: "Seasons played" },
  { key: "runnerUp", label: "Runner-up finishes" },
  { key: "topFour", label: "Top-four finishes" },
  { key: "firstPlace", label: "Regular-season firsts" },
  { key: "avgRegular", label: "Average regular finish" },
  { key: "avgFinal", label: "Average final finish" },
] as const;
type SortKey = (typeof sorts)[number]["key"];
const careerColumns = ["Manager / latest team", "Seasons", "Titles", "2nd", "Top 4", "W–L–T", "Win %", "Reg. #1", "Avg. reg.", "Avg. final"];

const points = (n: number | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const sortValue = (career: Career, key: SortKey) => career[key] ?? 0;

type HighKind = "season" | "week" | "moves" | "trades";

function HighTable({ records, kind, label, onSeason }: { records: HighRecord[]; kind: HighKind; label: (id: string) => string; onSeason: (year: number) => void }) {
  const heading = kind === "season" ? "Points for" : kind === "week" ? "Points" : kind;
  const value = (r: HighRecord) => (kind === "season" ? points(r.pointsFor) : kind === "week" ? points(r.points) : r[kind]);
  return (
    <div className="table-scroll" role="region" aria-label={`${kind} records`} tabIndex={0}>
      <table className="compact-table">
        <thead><tr><th scope="col">Season</th><th scope="col">Team / manager</th><th scope="col">{heading}</th></tr></thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={`${r.year}-${r.managerId}-${r.week}-${i}`}>
              <td><button className="text-link" onClick={() => onSeason(r.year)}>{r.year}</button>{r.week && <small>Week {r.week}</small>}</td>
              <td><strong>{r.team}</strong><small><ManagerLink id={r.managerId}>{label(r.managerId)}</ManagerLink></small></td>
              <td className="numeric">{value(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginTable({ games, label }: { games: MarginGame[]; label: string }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="compact-table">
        <thead><tr><th scope="col">Week</th><th scope="col">Winner</th><th scope="col">Loser</th><th scope="col">Margin</th></tr></thead>
        <tbody>
          {games.map((g, i) => (
            <tr key={`${g.year}-${g.week}-${i}`}>
              <td><SeasonLink year={g.year} section="Matchups" week={g.week}>{g.year} W{g.week}</SeasonLink></td>
              <td><strong>{formatScore(g.winner.points)}</strong><small><ManagerLink id={g.winner.managerId} /></small></td>
              <td><strong>{formatScore(g.loser.points)}</strong><small><ManagerLink id={g.loser.managerId} /></small></td>
              <td className="numeric">{g.tie ? "Tie" : formatScore(g.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PickTable({ picks, label }: { picks: PickValue[]; label: string }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="compact-table">
        <thead><tr><th scope="col">Season</th><th scope="col">Pick</th><th scope="col">Points</th></tr></thead>
        <tbody>
          {picks.map((p) => (
            <tr key={`${p.year}-${p.overall}`}>
              <td><SeasonLink year={p.year} section="Draft">{p.year}</SeasonLink><small>R{p.round} · #{p.overall}</small></td>
              <td><strong><PlayerLink id={p.playerId}>{p.player}</PlayerLink></strong><small><ManagerLink id={p.managerId} /></small></td>
              <td className="numeric"><strong>{formatScore(p.points)}</strong><small>{p.starts} starts</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The all-time view: champions, careers, head-to-head, highs and activity for one era. */
export default function RecordBook({ eraKey, onEra, onSeason }: { eraKey: string; onEra: (era: string) => void; onSeason: (year: number) => void }) {
  const { data: book, error, retry } = useJson<RecordBookData>("all-time.json");
  const [sort, setSort] = useState<SortKey>("titles");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState(1);
  const [selectedManager, setSelectedManager] = useState("");

  const era = book?.eras[eraKey] ?? book?.eras.all;
  const managers = useMemo(() => new Map(book?.managers.map((m) => [m.id, m]) ?? []), [book]);
  const label = (id: string) => managers.get(id)?.label ?? "Unidentified manager";
  const rows = useMemo(() => {
    const direction = sort.startsWith("avg") ? 1 : -1; // Lower average finishes are better.
    const search = query.toLowerCase();
    return [...(era?.careers ?? [])]
      .filter((c) => c.seasons >= minimum && `${managers.get(c.managerId)?.label} ${managers.get(c.managerId)?.team}`.toLowerCase().includes(search))
      .sort((a, b) => (sortValue(a, sort) - sortValue(b, sort)) * direction || (managers.get(a.managerId)?.label ?? "").localeCompare(managers.get(b.managerId)?.label ?? ""));
  }, [era, managers, sort, minimum, query]);

  if (error) {
    return <section className="panel" role="alert"><h1>Record book unavailable</h1><p>{error}</p><button className="action" onClick={retry}>Try again</button></section>;
  }
  if (!book || !era) return <section className="panel" role="status"><h1>Opening the record book…</h1></section>;

  const activeManager = era.careers.some((c) => c.managerId === selectedManager) ? selectedManager : rows[0]?.managerId ?? era.careers[0]?.managerId;
  const pairs = era.headToHead.filter((p) => p.managerId === activeManager).sort((a, b) => b.wins - a.wins || b.losses - a.losses);
  const highTable = (records: HighRecord[], kind: HighKind) => <HighTable records={records} kind={kind} label={label} onSeason={onSeason} />;

  return (
    <div className="content-stack record-book">
      <header className="book-heading"><h1>Record book</h1></header>
      <div className="era-bar">
        <div className="era-picker" aria-label="Record book era">
          {eras.map((e) => <button key={e.id} aria-pressed={eraKey === e.id} className={eraKey === e.id ? "active" : ""} onClick={() => onEra(e.id)}>{e.label}</button>)}
        </div>
        <p>{era.seasonCount} seasons · {era.careers.length} managers</p>
      </div>
      <nav className="book-index" aria-label="Record book sections">
        <a href="#champions">Champions</a>
        <a href="#careers">Career standings</a>
        <a href="#head-to-head">Head to head</a>
        <a href="#playoffs">Playoffs & luck</a>
        <a href="#highs">Highs & lows</a>
        <a href="#draft-value">Draft value</a>
        <a href="#activity">Draft & activity</a>
        <a href="#methodology">About the data</a>
      </nav>

      <section id="champions" className="panel">
        <div className="section-heading"><h2>Champions</h2><span>{era.start}–{era.end}</span></div>
        <div className="champions-timeline">
          {era.champions.map((c) => (
            <button key={c.year} onClick={() => onSeason(c.year)} aria-label={`${c.year} champion: ${c.team}, managed by ${label(c.managerId)}`}>
              <span className="champion-year">{c.year}</span>
              <strong>{c.team}</strong>
              <small>{label(c.managerId)}</small>
              <span className="timeline-link" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      <section id="careers" className="panel">
        <div className="section-heading"><h2>Career standings</h2><span>{rows.length} managers shown</span></div>
        <div className="book-tools">
          <label>Find a manager<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or latest team" type="search" /></label>
          <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label>
            Minimum seasons
            <select value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}>
              <option value={1}>All sample sizes</option>
              <option value={3}>3+ seasons</option>
              <option value={5}>5+ seasons</option>
            </select>
          </label>
        </div>
        <p className="method-note">W–L–T and win %: regular season only.</p>
        <div className="table-scroll career-scroll" role="region" aria-label="Career standings, scroll horizontally for all statistics" tabIndex={0}>
          <table className="career-table">
            <thead><tr>{careerColumns.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.managerId}>
                  <th scope="row">
                    <strong><ManagerLink id={c.managerId}>{managers.get(c.managerId)?.name}</ManagerLink></strong>
                    <small>{managers.get(c.managerId)?.team}</small>
                    <small>{c.first}–{c.last}{c.seasons < 3 ? " · Small sample" : ""}</small>
                  </th>
                  <td>{c.seasons}</td>
                  <td className={c.titles ? "title-cell" : ""}>{c.titles}</td>
                  <td>{c.runnerUp}</td>
                  <td>{c.topFour}</td>
                  <td className="nowrap">{c.wins}–{c.losses}–{c.ties}</td>
                  <td>{(100 * (c.winPct ?? 0)).toFixed(1)}%</td>
                  <td>{c.firstPlace}</td>
                  <td>{c.avgRegular.toFixed(2)}</td>
                  <td>{c.avgFinal?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p role="status">No managers match. Try a different name or minimum season count.</p>}
        <details className="stats-details">
          <summary>About these stats</summary>
          <p>Sorted by {sorts.find((s) => s.key === sort)?.label.toLowerCase()}, then name for ties. Win % = (wins + ½ ties) ÷ games. Lower average finishes are better.</p>
          <p>“2nd” and “Top 4” use final playoff placement; “Reg. #1” uses regular-season standings. Small sample means fewer than 3 seasons in this era. Average finish is raw placement, not normalized for 10- versus 12-team leagues.</p>
        </details>
      </section>

      <section id="head-to-head" className="panel">
        <div className="section-heading"><h2>Head to head</h2></div>
        <label className="field-label">
          View from
          <select value={activeManager} onChange={(e) => setSelectedManager(e.target.value)}>
            {[...era.careers].sort((a, b) => label(a.managerId).localeCompare(label(b.managerId))).map((c) => <option key={c.managerId} value={c.managerId}>{label(c.managerId)}</option>)}
          </select>
        </label>
        <p className="method-note">Regular season only · From the selected manager’s perspective.</p>
        <div className="table-scroll" role="region" aria-label="Head-to-head records" tabIndex={0}>
          <table className="compact-table">
            <thead><tr><th scope="col">Opponent</th><th scope="col">W–L–T</th><th scope="col">Games</th><th scope="col">Win %</th></tr></thead>
            <tbody>
              {pairs.map((p) => {
                const games = p.wins + p.losses + p.ties;
                return (
                  <tr key={p.opponentId}>
                    <td><strong><RivalryLink a={activeManager} b={p.opponentId}>{label(p.opponentId)}</RivalryLink></strong>{games < 5 && <small>Small sample</small>}</td>
                    <td>{p.wins}–{p.losses}–{p.ties}</td>
                    <td>{games}</td>
                    <td>{((100 * (p.wins + p.ties / 2)) / games).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details className="stats-details">
          <summary>About these stats</summary>
          <p>Playoffs and consolation are excluded. Small sample means fewer than 5 games. All {era.verifiedGames.toLocaleString()} games in this era reconcile to the archived standings.</p>
        </details>
      </section>

      <section id="playoffs">
        <div className="section-heading"><h2>Playoffs & luck</h2></div>
        <div className="two-column">
          <section className="panel">
            <h3>Playoff records</h3>
            <div className="table-scroll" role="region" aria-label="Playoff records" tabIndex={0}>
              <table className="compact-table">
                <thead><tr><th scope="col">Manager</th><th scope="col">W–L</th><th scope="col">Title games</th><th scope="col">Titles</th></tr></thead>
                <tbody>
                  {[...era.careers].filter((c) => c.playoffWins + c.playoffLosses > 0)
                    .sort((a, b) => b.titles - a.titles || b.playoffWins - a.playoffWins || a.playoffLosses - b.playoffLosses || label(a.managerId).localeCompare(label(b.managerId)))
                    .map((c) => (
                      <tr key={c.managerId}><td><ManagerLink id={c.managerId} /></td><td className="nowrap">{c.playoffWins}–{c.playoffLosses}</td><td>{c.titleGames}</td><td className={c.titles ? "title-cell" : ""}>{c.titles}</td></tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h3>Luck</h3>
            <div className="table-scroll" role="region" aria-label="Luck" tabIndex={0}>
              <table className="compact-table">
                <thead><tr><th scope="col">Manager</th><th scope="col">Wins</th><th scope="col">Expected</th><th scope="col">Luck</th></tr></thead>
                <tbody>
                  {[...era.careers].sort((a, b) => b.luck - a.luck || label(a.managerId).localeCompare(label(b.managerId))).map((c) => (
                    <tr key={c.managerId}>
                      <td><ManagerLink id={c.managerId} /><small>All-play {c.allPlayWins}–{c.allPlayLosses}{c.allPlayTies ? `–${c.allPlayTies}` : ""}</small></td>
                      <td>{c.wins + c.ties / 2}</td>
                      <td>{c.expectedWins.toFixed(1)}</td>
                      <td className="numeric"><strong>{c.luck > 0 ? "+" : c.luck < 0 ? "−" : ""}{Math.abs(c.luck).toFixed(1)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <details className="stats-details">
          <summary>About these stats</summary>
          <p>Playoff records count bracket games only: semifinals, the final and the third-place game. Consolation games are excluded. Title games are appearances in the final.</p>
          <p>All-play compares each week's score with every other team's score that week, as if you had played everyone. Expected wins add up each week's all-play win share. Luck is actual regular-season wins (ties count half) minus expected wins. Positive means the schedule helped. Across the league, luck sums to zero.</p>
        </details>
      </section>

      <section id="highs">
        <div className="section-heading"><h2>Highs & lows</h2></div>
        <p className="method-note">Top 10 regular-season results · Points are not era-adjusted. See season Settings for scoring rules.</p>
        <div className="two-column">
          <section className="panel"><h3>Highest-scoring seasons</h3>{highTable(era.highSeasons, "season")}</section>
          <section className="panel"><h3>Highest-scoring weeks</h3>{highTable(era.highWeeks, "week")}</section>
          <section className="panel"><h3>Lowest-scoring weeks</h3>{highTable(era.lowWeeks, "week")}</section>
          <section className="panel"><h3>Biggest blowouts</h3><MarginTable games={era.blowouts} label="Biggest blowouts" /></section>
          <section className="panel"><h3>Closest games</h3><MarginTable games={era.closestGames} label="Closest games" /></section>
        </div>
      </section>

      <section id="draft-value">
        <div className="section-heading"><h2>Draft value</h2></div>
        <p className="method-note">Points each pick scored as a starter for the team that drafted him that season, playoffs included.</p>
        <div className="two-column">
          <section className="panel"><h3>Best picks</h3><PickTable picks={era.bestPicks} label="Best picks" /></section>
          <section className="panel"><h3>Best late-round picks (round 8+)</h3><PickTable picks={era.lateRoundPicks} label="Best late-round picks" /></section>
        </div>
      </section>

      <section id="activity">
        <div className="section-heading"><h2>Draft & activity</h2></div>
        <div className="two-column">
          <section className="panel">
            <h3>Most-drafted players & defenses</h3>
            <ol className="ranked-list">{era.drafted.map((p) => <li key={p.player}><span>{p.player}</span><strong>{p.picks} picks</strong></li>)}</ol>
          </section>
          <section className="panel">
            <h3>Activity ledger</h3>
            <p className="method-note">Transaction rows, not unique events; includes lineup changes.</p>
            <dl className="activity-ledger">
              {Object.entries(era.activity).sort((a, b) => b[1] - a[1]).map(([type, count]) => <div key={type}><dt>{type}</dt><dd>{count.toLocaleString()}</dd></div>)}
            </dl>
          </section>
          <section className="panel"><h3>Most moves in a season</h3>{highTable(era.mostMoves, "moves")}</section>
          <section className="panel">
            <h3>Most trades in a season</h3>
            <p className="method-note">Trades count for each participant.</p>
            {highTable(era.mostTrades, "trades")}
          </section>
        </div>
        <details className="stats-details">
          <summary>About these stats</summary>
          <p>Draft counts are archived selections in the selected era, not draft-value grades. Move and trade totals use the NFL owners-page counters, linked through season account identities. In the activity ledger, one trade can produce multiple rows.</p>
        </details>
      </section>

      <section id="methodology" className="methodology">
        <h2>About the data</h2>
        <details className="stats-details">
          <summary>About these stats</summary>
          <p>Era filters include only results within the selected years. No strength-of-competition weighting is applied. Teams, scoring rules and season lengths changed over time.</p>
          <p>Managers are linked across seasons using stable NFL account identities and commissioner-confirmed names. The 24 archived accounts represent 23 managers: Peter Puzio’s 2011 account is combined with his main account by explicit confirmation. Krystian B. and Krystian P., Daniel B. and Daniel F., and Peter Puzio and Peter Polan remain separate people. Co-managers are not credited separately.</p>
          <p>Career finishes come from final and regular-season standings. Championship history is checked against the NFL almanac. Head-to-head results use weekly schedules and are checked against each team’s W–L–T. Transaction authors use archived account identities, not first-name matching. Missing values are not treated as zero.</p>
          <p>These are historical records, not a ranking of skill or luck. Confirmed display corrections are applied to public data; the original source archive remains unchanged.</p>
        </details>
      </section>
    </div>
  );
}
