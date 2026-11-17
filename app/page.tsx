"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RecordBook from "./RecordBook";
import { useArchiveQuery } from "./useArchiveQuery";

type SeasonSummary = {
  year: number;
  champion: string;
  championTeamId: string;
  teamCount: number;
  draftPicks: number;
  matchups: number;
  transactions: number;
};

type LeagueIndex = {
  leagueId: string;
  leagueName: string;
  provider: string;
  firstSeason: number;
  lastSeason: number;
  seasonCount: number;
  seasons: SeasonSummary[];
};

type TeamResult = {
  rank: number;
  teamId: string;
  team: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  streak: string;
  pointsFor: number;
  pointsAgainst: number;
};

type TeamScore = {
  teamId: string;
  team: string;
  manager?: string;
  record?: string;
  score: number;
};

type PlayerLine = {
  starter: boolean;
  slot: string;
  playerId: string;
  player: string;
  playerInfo?: string;
  opponent?: string;
  points: number;
};

type Lineup = {
  week: number;
  requestedTeamId: string;
  teamId: string;
  team: string;
  players: PlayerLine[];
};

type SeasonData = {
  year: number;
  champion: { season: number; team_name: string; provider_team_id: string };
  placements: Array<{ place: number; teamId: string; team: string; manager?: string; summary?: string }>;
  standings: TeamResult[];
  managers: Array<{ teamId: string; team: string; manager: string; coManager?: string; moves?: number; trades?: number }>;
  draft: Array<{ overall: number; round: number; pickInRound: number; player: string; playerInfo?: string; teamId: string; team: string }>;
  matchups: Array<{ id: string; week: number; teams: TeamScore[] }>;
  playoffs: Array<{ week: number; label: string; teams: TeamScore[] }>;
  lineups: Lineup[];
  transactions: Array<{ date: string; week: number; type: string; players: string; from: string; to: string; by: string }>;
  settings: Array<{ label: string; value: string }>;
  records: Array<{ record_type: string; week?: number; team_name: string; player_name?: string; points: number }>;
};

const tabs = ["Overview", "Standings", "Draft", "Matchups", "Transactions", "Settings"] as const;
type Tab = (typeof tabs)[number];

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const score = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const seasonCache = new Map<number, SeasonData>();
const formatScore = (value: number | null | undefined) => value == null ? "—" : score.format(value);

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}

function recordLabel(type: string) {
  if (type === "team_season") return "Most points · season";
  if (type === "team_week") return "Most points · week";
  if (type === "player_week") return "Top player · week";
  return type.replaceAll("_", " ");
}

function LoadingArchive() {
  return (
    <main className="loading-shell" role="status">
      <div className="loading-mark">PN</div>
      <p className="eyebrow">PacNation archive</p>
      <h1>Opening the record book…</h1>
      <div className="loading-line" />
    </main>
  );
}

export default function Home() {
  const { params, navigate, ready } = useArchiveQuery();
  const [league, setLeague] = useState<LeagueIndex | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const view = params.view === "season" ? "season" : "all-time";
  const year = league?.seasons.some(s => s.year === Number(params.year)) ? Number(params.year) : league?.lastSeason ?? 2025;
  const tab: Tab = tabs.includes(params.section as Tab) ? params.section as Tab : "Overview";
  const week = Math.max(1, Math.min(18, Number(params.week) || 1));
  const matchupId = params.game ?? null;
  const draftRound = Math.max(0, Math.min(30, Number(params.round) || 0));
  const setYear = (value: number) => navigate({ view: "season", year: value, week: null, game: null, round: null });
  const setTab = (value: Tab) => navigate({ section: value });
  const setWeek = (value: number) => navigate({ week: value, game: null });
  const setMatchupId = (value: string | null) => navigate({ game: value });
  const setDraftRound = (value: number) => navigate({ round: value });
  const [transactionType, setTransactionType] = useState("All");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionPage, setTransactionPage] = useState(0);
  const [draftSearch, setDraftSearch] = useState("");
  const [standingsSearch, setStandingsSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const enteredArchive = useRef(false);

  useEffect(() => {
    if (!ready || !league) return;
    if (!enteredArchive.current) {
      enteredArchive.current = true;
      return;
    }
    // Major navigation starts at the new content; week/round/filter changes stay put.
    // Respect section anchors when returning through browser history.
    const frame = requestAnimationFrame(() => {
      const target = window.location.hash
        ? document.getElementById(window.location.hash.slice(1))
        : document.getElementById("main-content");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, league, view, year, tab]);

  useEffect(() => {
    fetch("./data/index.json")
      .then((response) => {
        if (!response.ok) throw new Error("League index was not found.");
        return response.json() as Promise<LeagueIndex>;
      })
      .then((data: LeagueIndex) => {
        setLeague(data);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [retry]);

  useEffect(() => {
    if (!ready || view !== "season") return;
    const controller = new AbortController();
    // Reset view-local filters when the external URL changes (including Back).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setTransactionType("All");
    setTransactionSearch("");
    setTransactionPage(0);
    setDraftSearch("");
    setStandingsSearch("");
    setSeason(seasonCache.get(year) ?? null);
    if (seasonCache.has(year)) return;
    fetch(`./data/seasons/${year}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`The ${year} season could not be loaded.`);
        return response.json() as Promise<SeasonData>;
      })
      .then((data: SeasonData) => {
        seasonCache.set(year, data);
        setSeason(data);
        setError(null);
      })
      .catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [year, view, ready, retry]);

  const weeks = useMemo(
    () => (season ? [...new Set(season.matchups.map((item) => item.week))].sort((a, b) => a - b) : []),
    [season],
  );
  const weeklyMatchups = useMemo(
    () => season?.matchups.filter((item) => item.week === week) ?? [],
    [season, week],
  );
  const activeMatchup = weeklyMatchups.find((item) => item.id === matchupId) ?? weeklyMatchups[0];
  const activeLineups = useMemo(() => {
    if (!season || !activeMatchup) return [];
    const teamIds = new Set(activeMatchup.teams.map((team) => team.teamId));
    return season.lineups.filter(
      (lineup) => lineup.week === activeMatchup.week && teamIds.has(lineup.teamId),
    );
  }, [season, activeMatchup]);
  const draftRounds = useMemo(
    () => (season ? [...new Set(season.draft.map((pick) => pick.round))].sort((a, b) => a - b) : []),
    [season],
  );
  const filteredTransactions = useMemo(() => {
    if (!season) return [];
    const query = transactionSearch.trim().toLowerCase();
    return season.transactions.filter((item) => {
      const typeMatch = transactionType === "All" || item.type === transactionType;
      const searchMatch = !query || `${item.players} ${item.from} ${item.to} ${item.by}`.toLowerCase().includes(query);
      return typeMatch && searchMatch;
    });
  }, [season, transactionType, transactionSearch]);
  const filteredDraft = season?.draft.filter(p => (draftRound === 0 || p.round === draftRound) && `${p.player} ${p.team} ${season.managers.find(m => m.teamId === p.teamId)?.manager}`.toLowerCase().includes(draftSearch.toLowerCase())) ?? [];
  const filteredStandings = season?.standings.filter(s => `${s.team} ${season.managers.find(m => m.teamId === s.teamId)?.manager}`.toLowerCase().includes(standingsSearch.toLowerCase())) ?? [];

  if (error && !league) {
    return <main className="error-shell" role="alert"><p className="eyebrow">PacNation archive</p><h1>We hit a gap in the record book.</h1><p>{error}</p><button className="action" onClick={() => {setError(null); setRetry(retry + 1);}}>Try again</button></main>;
  }
  if (!league || !ready) return <LoadingArchive />;

  const seasonSummary = league.seasons.find((item) => item.year === year)!;
  const champion = season?.placements[0];
  const runnerUp = season?.placements[1];
  const topScorer = [...(season?.standings ?? [])].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  const transactionTypes = ["All", ...new Set(season?.transactions.map((item) => item.type))];

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => navigate({ view: "all-time" })} aria-label="PacNation history home">
          <span className="brand-mark">PN</span>
          <span><strong>PacNation</strong><small>League archive</small></span>
        </button>
        <div className="archive-range"><span>{league.firstSeason}</span><i /> <span>{league.lastSeason}</span></div>
      </header>

      <div className="archive-layout" id="top">
        <aside className="season-rail" aria-label="Season archive">
          <p className="rail-label">Season archive</p>
          <button className={`book-button ${view === "all-time" ? "active" : ""}`} aria-pressed={view === "all-time"} onClick={() => navigate({ view: "all-time" })}>Record book</button>
          <select className="season-select" value={view === "season" ? year : ""} onChange={(event) => setYear(Number(event.target.value))} aria-label="Choose a season">
            <option value="" disabled>Choose season</option>
            {league.seasons.map((item) => <option key={item.year} value={item.year}>{item.year} season</option>)}
          </select>
          <div className="season-list">
            {league.seasons.map((item) => (
              <button key={item.year} aria-pressed={view === "season" && item.year === year} className={view === "season" && item.year === year ? "active" : ""} onClick={() => setYear(item.year)}>
                <span>{item.year}</span><small>{item.champion}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="archive-main" id="main-content" tabIndex={-1}>
          {view === "all-time" ? <RecordBook eraKey={["all", "early", "modern"].includes(params.era) ? params.era : "all"} onEra={era => navigate({ era })} onSeason={y => navigate({ view: "season", year: y, section: "Overview", week: null, game: null })} /> : <>
          <div className="season-heading">{tab === "Overview" ? <p>{year} season</p> : <h1>{year} season</h1>}</div>
          <nav className="section-tabs" aria-label="Season sections">
            {tabs.map((item) => <button key={item} aria-pressed={item === tab} className={item === tab ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
          </nav>
          {error ? <section className="panel" role="alert"><h1>Season unavailable</h1><p>{error}</p><button className="action" onClick={() => setRetry(retry + 1)}>Try again</button></section> : !season || season.year !== year ? <section className="panel" role="status"><h1>Opening {year}…</h1></section> : <>
          {tab === "Overview" && <><section className="season-hero">
            <div>
              <p className="eyebrow">{year} champion</p>
              <h1>{champion?.team ?? season.champion.team_name}</h1>
              <p className="hero-subtitle">{champion?.manager ? `Managed by ${champion.manager}` : "PacNation champion"}</p>
            </div>
            <div className="trophy-block" aria-label={`${year} champion`}><span>Champion</span><strong>{year}</strong><small>PacNation</small></div>
          </section>

          <section className="season-facts" aria-label="Season summary">
            <div><span>Runner-up</span><strong>{runnerUp?.team ?? "—"}</strong></div>
            <div><span>Top scorer</span><strong>{topScorer?.team ?? "—"}</strong><small>{topScorer ? `${score.format(topScorer.pointsFor)} PF` : ""}</small></div>
            <div><span>League size</span><strong>{seasonSummary.teamCount} teams</strong></div>
            <div><span>Activity</span><strong>{whole.format(seasonSummary.transactions)}</strong><small>transaction rows, not unique events</small></div>
          </section></>}

          {tab === "Overview" && (
            <div className="content-stack">
              <section className="panel podium-panel">
                <div className="section-heading"><h2>Final results</h2></div>
                <div className="podium-grid">
                  {season.placements.slice(0, 4).map((item) => (
                    <article key={item.place} className={`podium-card place-${item.place}`}>
                      <span className="place-number">{ordinal(item.place)}</span>
                      <h3>{item.team}</h3>
                      <p>{item.manager || season.managers.find(m => m.teamId === item.teamId)?.manager || "Manager not listed"}</p>
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
                        {game.teams.map((team) => <div key={team.teamId} className={team.score != null && team.score > Math.max(...game.teams.filter(t => t.teamId !== team.teamId).map(t => t.score)) ? "winner" : ""}><span>{team.team}{team.score != null && team.score > Math.max(...game.teams.filter(t => t.teamId !== team.teamId).map(t => t.score)) && <small className="win-badge">Winner</small>}</span><strong>{formatScore(team.score)}</strong></div>)}
                      </article>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="section-heading"><h2>Managers</h2></div>
                  <div className="manager-list">
                    {season.managers.map((item) => (
                      <div key={item.teamId}><span><strong>{item.manager}</strong><small>{item.team}</small></span><span className="manager-stats">{item.moves ?? "—"} moves · {item.trades ?? "—"} trades</span></div>
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
          )}

          {tab === "Standings" && (
            <section className="panel">
              <div className="section-heading"><h2>Regular-season standings</h2><span>{season.standings.length} teams</span></div>
              <label className="field-label">Find a team or manager<input type="search" value={standingsSearch} onChange={e => setStandingsSearch(e.target.value)} /></label>
              <div className="table-scroll season-standings" role="region" aria-label="Season standings" tabIndex={0}><table><thead><tr><th>Reg. rank</th><th>Team / manager</th><th>Record</th><th>Win %</th><th>PF</th><th>PA</th><th>Final</th><th>Streak</th></tr></thead>
                <tbody>{filteredStandings.map((item) => <tr key={item.teamId}><td><span className="rank-chip">{item.rank}</span></td><td><strong>{item.team}</strong><small>{season.managers.find(m => m.teamId === item.teamId)?.manager}</small></td><td>{item.wins}-{item.losses}-{item.ties}</td><td>{item.winPct?.toFixed(3).replace(/^0/, "")}</td><td>{score.format(item.pointsFor)}</td><td>{score.format(item.pointsAgainst)}</td><td>{season.placements.find(p => p.teamId === item.teamId)?.place ?? "—"}</td><td>{item.streak}</td></tr>)}</tbody>
              </table></div>
              {!filteredStandings.length && <p role="status">No matching teams or managers.</p>}
              <details className="stats-details"><summary>About these stats</summary><p>Records and points are regular season only. Reg. rank is before the playoffs; Final is placement after the postseason. PF = points for; PA = points against.</p></details>
            </section>
          )}

          {tab === "Draft" && (
            <section className="panel">
              <div className="section-heading"><h2>Draft board</h2><span>{season.draft.length} picks</span></div>
              <div className="round-picker" aria-label="Draft round">
                <button aria-pressed={draftRound === 0} className={draftRound === 0 ? "active" : ""} onClick={() => setDraftRound(0)}>All</button>
                {draftRounds.map((round) => <button key={round} aria-pressed={round === draftRound} aria-label={`Round ${round}`} className={round === draftRound ? "active" : ""} onClick={() => setDraftRound(round)}>R{round}</button>)}
              </div>
              <label className="field-label">Search draft<input type="search" value={draftSearch} onChange={e => setDraftSearch(e.target.value)} placeholder="Player, team or manager" /></label>
              <p className="method-note">{filteredDraft.length} matching picks · numbers show overall selection.</p>
              <div className="draft-grid">
                {filteredDraft.map((pick) => (
                  <article key={pick.overall} className="draft-pick"><span>{pick.overall}</span><div><strong>{pick.player}</strong><small>{pick.playerInfo}</small></div><p>{pick.team}</p></article>
                ))}
              </div>
              {!filteredDraft.length && <p role="status">No picks match this round and search.</p>}
            </section>
          )}

          {tab === "Matchups" && (
            <div className="content-stack">
              <section className="panel">
                <div className="section-heading"><h2>Week {week} matchups</h2><span>{weeklyMatchups.length} games</span></div>
                <div className="week-picker" aria-label="Matchup week">{weeks.map((item) => <button key={item} aria-pressed={item === week} aria-label={`Week ${item}`} className={item === week ? "active" : ""} onClick={() => setWeek(item)}>{item}</button>)}</div>
                <div className="matchup-grid">
                  {weeklyMatchups.map((matchup) => (
                    <button key={matchup.id} aria-pressed={activeMatchup?.id === matchup.id} className={`matchup-card ${activeMatchup?.id === matchup.id ? "active" : ""}`} onClick={() => setMatchupId(matchup.id)}>
                      {matchup.teams.map((team) => <span key={team.teamId}><em>{team.team}{team.score != null && team.score > Math.max(...matchup.teams.filter(t => t.teamId !== team.teamId).map(t => t.score)) && <small className="win-badge">Winner</small>}</em><strong>{formatScore(team.score)}</strong></span>)}
                    </button>
                  ))}
                </div>
                {!weeklyMatchups.length && <p role="status">No archived games for this week. Choose a listed week above.</p>}
              </section>
              {activeMatchup && (
                <section className="panel lineup-panel">
                  <div className="section-heading"><h2>Starting lineups</h2><span>Week {activeMatchup.week}</span></div>
                  {activeLineups.length ? <div className="lineup-columns">
                    {activeLineups.map((lineup) => <div key={lineup.teamId}><h3>{lineup.team}</h3><div className="lineup-list">{lineup.players.filter((player) => player.starter).map((player, index) => <div key={`${player.playerId}-${index}`}><span className="slot">{player.slot}</span><span><strong>{player.player}</strong><small>{player.playerInfo}</small></span><em>{formatScore(player.points)}</em></div>)}</div></div>)}
                  </div> : <p className="empty-note">Detailed lineup data was not available for this archived matchup.</p>}
                </section>
              )}
            </div>
          )}

          {tab === "Transactions" && (
            <section className="panel">
              <div className="section-heading"><h2>Transactions</h2><span>{whole.format(filteredTransactions.length)} results</span></div>
              <p className="method-note">Transaction rows, not unique events. Lineup changes are included.</p>
              <div className="transaction-tools">
                <select value={transactionType} onChange={(event) => {setTransactionType(event.target.value); setTransactionPage(0);}} aria-label="Filter transaction type">{transactionTypes.map((type) => <option key={type}>{type}</option>)}</select>
                <input type="search" value={transactionSearch} onChange={(event) => {setTransactionSearch(event.target.value); setTransactionPage(0);}} placeholder="Search player, team, or manager" aria-label="Search transactions" />
              </div>
              <div className="transaction-list">
                {filteredTransactions.slice(transactionPage * 50, (transactionPage + 1) * 50).map((item, index) => <article key={`${item.date}-${item.players}-${index}`}><span className={`transaction-type type-${item.type.toLowerCase()}`}>{item.type}</span><div><strong>{item.players}</strong><p>{item.from} <span>→</span> {item.to}</p></div><aside><strong>W{item.week}</strong><small>{item.date}</small><small>{item.by}</small></aside></article>)}
              </div>
              {!filteredTransactions.length && <p role="status">No activity matches. Try another search or transaction type.</p>}
              <div className="pagination"><button className="action" disabled={transactionPage === 0} onClick={() => setTransactionPage(transactionPage - 1)}>Previous</button><span role="status">Page {transactionPage + 1} of {Math.max(1, Math.ceil(filteredTransactions.length / 50))}</span><button className="action" disabled={(transactionPage + 1) * 50 >= filteredTransactions.length} onClick={() => setTransactionPage(transactionPage + 1)}>Next</button></div>
              <p className="method-note">50 rows per page · Rows may be parts of an event, not unique transactions.</p>
            </section>
          )}

          {tab === "Settings" && (
            <section className="panel">
              <div className="section-heading"><h2>League settings</h2><span>{season.settings.length} rules</span></div>
              <div className="settings-grid">{season.settings.map((item, index) => <div key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
            </section>
          )}
          </>}</>}
        </main>
      </div>
      <footer>
        <span>PacNation League Archive</span>
        <span>Preserved independently from NFL Fantasy · League {league.leagueId}</span>
        <a href={view === "season" ? `./data/seasons/${year}.json` : "./data/all-time.json"} download>Download {view === "season" ? "season" : "record-book"} data (JSON)</a>
      </footer>
    </div>
  );
}
