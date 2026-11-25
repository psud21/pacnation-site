import { useMemo, useState } from "react";
import { ManagerLink, PlayerLink, RivalryLink, SeasonLink } from "./archive";
import Tabbed from "./Tabbed";
import { useJson } from "./data";
import { formatScore } from "./format";
import type { Career, HighRecord, MarginGame, PickValue, RecordBookData } from "./types";

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

/** The all-time record book: champions, careers, head-to-head, playoffs and luck, highs, draft and activity. */
export default function RecordBook({ onSeason }: { onSeason: (year: number) => void }) {
  const { data: book, error, retry } = useJson<RecordBookData>("all-time.json");
  const [sort, setSort] = useState<SortKey>("titles");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState(1);
  const [selectedManager, setSelectedManager] = useState("");

  const era = book?.eras.all;
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
  const titleCounts = [...era.careers].filter((c) => c.titles > 0).sort((a, b) => b.titles - a.titles || label(a.managerId).localeCompare(label(b.managerId)));
  const champions = [...era.champions].sort((a, b) => b.year - a.year);

  return (
    <div className="content-stack record-book">
      <header className="book-heading">
        <h1>Record book</h1>
        <p className="book-meta">{era.start}–{era.end} · {era.seasonCount} seasons · {era.careers.length} managers · {era.verifiedGames.toLocaleString()} regular-season games verified</p>
      </header>
      <nav className="book-index" aria-label="Record book sections">
        <a href="#champions">Champions</a>
        <a href="#careers">Careers</a>
        <a href="#head-to-head">Head to head</a>
        <a href="#playoffs">Playoffs & luck</a>
        <a href="#highs">Highs & lows</a>
        <a href="#draft">Draft</a>
        <a href="#activity">Activity</a>
        <a href="#methodology">About</a>
      </nav>

      <section id="champions" className="panel">
        <div className="section-heading"><h2>Champions</h2><span>{era.seasonCount} titles</span></div>
        <ul className="title-tally" aria-label="Titles by manager">
          {titleCounts.map((c) => (
            <li key={c.managerId}>
              <ManagerLink id={c.managerId} badge>{managers.get(c.managerId)?.name}</ManagerLink>
              <b>{c.titles}</b>
            </li>
          ))}
        </ul>
        <ol className="champion-list">
          {champions.map((c) => (
            <li key={c.year}>
              <button onClick={() => onSeason(c.year)} aria-label={`${c.year} champion: ${c.team}, managed by ${label(c.managerId)}`}>
                <span className="champion-year">{c.year}</span>
                <strong>{c.team}</strong>
                <small>{label(c.managerId)}</small>
              </button>
            </li>
          ))}
        </ol>
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
        <div className="table-scroll career-scroll" role="region" aria-label="Career standings, scroll horizontally for all statistics" tabIndex={0}>
          <table className="career-table">
            <thead><tr>{careerColumns.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.managerId}>
                  <th scope="row">
                    <strong><ManagerLink id={c.managerId} badge>{managers.get(c.managerId)?.name}</ManagerLink></strong>
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
          <p>W–L–T and win % are regular season only. Sorted by {sorts.find((s) => s.key === sort)?.label.toLowerCase()}, then name for ties. Win % = (wins + ½ ties) ÷ games. Lower average finishes are better.</p>
          <p>“2nd” and “Top 4” use final playoff placement; “Reg. #1” uses regular-season standings. Small sample means fewer than 3 seasons. Average finish is raw placement, not normalized for 10- versus 12-team leagues.</p>
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
          <p>Regular season only, from the selected manager’s side. Playoffs and consolation are excluded; open a rivalry for every game. Small sample means fewer than 5 games. All {era.verifiedGames.toLocaleString()} games reconcile to the archived standings.</p>
        </details>
      </section>

      <section id="playoffs" className="panel">
        <div className="section-heading"><h2>Playoffs & luck</h2></div>
        <Tabbed label="Playoffs and luck" tabs={[
          { id: "playoffs", label: "Playoff records", content: (
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
          ) },
          { id: "luck", label: "Luck", content: (
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
          ) },
        ]} />
        <details className="stats-details">
          <summary>About these stats</summary>
          <p>Playoff records count bracket games only: semifinals, the final and the third-place game. Consolation games are excluded. Title games are appearances in the final.</p>
          <p>All-play compares each week's score with every other team's score that week, as if you had played everyone. Expected wins add up each week's all-play win share. Luck is actual regular-season wins (ties count half) minus expected wins; positive means the schedule helped. Across the league, luck sums to zero.</p>
        </details>
      </section>

      <section id="highs" className="panel">
        <div className="section-heading"><h2>Highs & lows</h2></div>
        <Tabbed label="Highs and lows" tabs={[
          { id: "seasons", label: "Best seasons", content: highTable(era.highSeasons, "season") },
          { id: "weeks", label: "Best weeks", content: highTable(era.highWeeks, "week") },
          { id: "lows", label: "Worst weeks", content: highTable(era.lowWeeks, "week") },
          { id: "blowouts", label: "Blowouts", content: <MarginTable games={era.blowouts} label="Biggest blowouts" /> },
          { id: "closest", label: "Closest games", content: <MarginTable games={era.closestGames} label="Closest games" /> },
        ]} />
        <p className="method-note">Top 10 regular-season results. Points are not adjusted across seasons; see each season's Settings for its scoring rules.</p>
      </section>

      <section id="draft" className="panel">
        <div className="section-heading"><h2>Draft</h2></div>
        <Tabbed label="Draft records" tabs={[
          { id: "best", label: "Best picks", content: <PickTable picks={era.bestPicks} label="Best picks" /> },
          { id: "late", label: "Late-round gems", content: <PickTable picks={era.lateRoundPicks} label="Best late-round picks" /> },
          { id: "drafted", label: "Most drafted", content: <ol className="ranked-list">{era.drafted.map((p) => <li key={p.player}><span>{p.player}</span><strong>{p.picks} picks</strong></li>)}</ol> },
        ]} />
        <p className="method-note">Pick value is the points a player scored as a starter for the team that drafted him that season, playoffs included. Late-round gems are from round 8 on.</p>
      </section>

      <section id="activity" className="panel">
        <div className="section-heading"><h2>Activity</h2></div>
        <Tabbed label="Activity records" tabs={[
          { id: "moves", label: "Most moves", content: highTable(era.mostMoves, "moves") },
          { id: "trades", label: "Most trades", content: highTable(era.mostTrades, "trades") },
          { id: "ledger", label: "Activity ledger", content: (
            <dl className="activity-ledger">
              {Object.entries(era.activity).sort((a, b) => b[1] - a[1]).map(([type, count]) => <div key={type}><dt>{type}</dt><dd>{count.toLocaleString()}</dd></div>)}
            </dl>
          ) },
        ]} />
        <p className="method-note">Moves and trades in a season come from the NFL owners-page counters; trades count for each participant. The ledger counts transaction rows, not unique events, lineup changes included.</p>
      </section>

      <section id="methodology" className="methodology">
        <h2>About the data</h2>
        <details className="stats-details">
          <summary>How the record book is built</summary>
          <p>Every season counts equally. No strength-of-competition weighting is applied; teams, scoring rules and season lengths changed over time.</p>
          <p>Managers are linked across seasons using stable NFL account identities and commissioner-confirmed names. The 24 archived accounts represent 23 managers: Peter Puzio’s 2011 account is combined with his main account by explicit confirmation. Krystian B. and Krystian P., Daniel B. and Daniel F., and Peter Puzio and Peter Polan remain separate people. Co-managers are not credited separately.</p>
          <p>Career finishes come from final and regular-season standings. Championship history is checked against the NFL almanac. Head-to-head results use weekly schedules and are checked against each team’s W–L–T. Transaction authors use archived account identities, not first-name matching. Missing values are not treated as zero.</p>
          <p>These are historical records, not a ranking of skill or luck. Confirmed display corrections are applied to public data; the original source archive remains unchanged.</p>
        </details>
      </section>
    </div>
  );
}
