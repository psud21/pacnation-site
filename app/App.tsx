import { useEffect, useMemo, useRef, useState } from "react";
import RecordBook from "./RecordBook";
import Draft from "./season/Draft";
import Matchups from "./season/Matchups";
import Overview from "./season/Overview";
import Settings from "./season/Settings";
import Standings from "./season/Standings";
import Transactions from "./season/Transactions";
import type { LeagueIndex, SeasonData } from "./types";
import { useArchiveQuery } from "./useArchiveQuery";

const tabs = ["Overview", "Standings", "Draft", "Matchups", "Transactions", "Settings"] as const;
type Tab = (typeof tabs)[number];
const eraKeys = ["all", "early", "modern"];

// Season files are fetched on demand and kept for the rest of the visit.
const seasonCache = new Map<number, SeasonData>();

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

/**
 * The whole site. Everything that identifies a page lives in the URL query
 * (view, era, year, section, week, game, round), so links, reloads and
 * Back/Forward all work; see useArchiveQuery.
 */
export default function App() {
  const { params, navigate, ready } = useArchiveQuery();
  const [league, setLeague] = useState<LeagueIndex | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const enteredArchive = useRef(false);

  const view = params.view === "season" ? "season" : "all-time";
  const year = league?.seasons.some((s) => s.year === Number(params.year)) ? Number(params.year) : league?.lastSeason ?? 2025;
  const tab: Tab = tabs.includes(params.section as Tab) ? (params.section as Tab) : "Overview";
  const week = Math.max(1, Math.min(18, Number(params.week) || 1));
  const draftRound = Math.max(0, Math.min(30, Number(params.round) || 0));
  const setYear = (value: number) => navigate({ view: "season", year: value, week: null, game: null, round: null });

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
      .then(setLeague)
      .catch((reason: Error) => setError(reason.message));
  }, [retry]);

  useEffect(() => {
    if (!ready || view !== "season") return;
    const controller = new AbortController();
    setError(null);
    setSeason(seasonCache.get(year) ?? null);
    if (seasonCache.has(year)) return;
    fetch(`./data/seasons/${year}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`The ${year} season could not be loaded.`);
        return response.json() as Promise<SeasonData>;
      })
      .then((data) => {
        seasonCache.set(year, data);
        setSeason(data);
        setError(null);
      })
      .catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [year, view, ready, retry]);

  const managerNames = useMemo(() => new Map(season?.managers.map((m) => [m.teamId, m.manager]) ?? []), [season]);
  const managerOf = (teamId: string) => managerNames.get(teamId);

  if (error && !league) {
    return (
      <main className="error-shell" role="alert">
        <p className="eyebrow">PacNation archive</p>
        <h1>We hit a gap in the record book.</h1>
        <p>{error}</p>
        <button className="action" onClick={() => { setError(null); setRetry(retry + 1); }}>Try again</button>
      </main>
    );
  }
  if (!league || !ready) return <LoadingArchive />;

  const summary = league.seasons.find((item) => item.year === year)!;

  function seasonContent() {
    if (error) {
      return <section className="panel" role="alert"><h1>Season unavailable</h1><p>{error}</p><button className="action" onClick={() => setRetry(retry + 1)}>Try again</button></section>;
    }
    if (!season || season.year !== year) {
      return <section className="panel" role="status"><h1>Opening {year}…</h1></section>;
    }
    // key={year}: filters and searches start fresh for each season.
    switch (tab) {
      case "Overview": return <Overview key={year} season={season} summary={summary} managerOf={managerOf} />;
      case "Standings": return <Standings key={year} season={season} managerOf={managerOf} />;
      case "Draft": return <Draft key={year} season={season} round={draftRound} onRound={(round) => navigate({ round })} managerOf={managerOf} />;
      case "Matchups": return <Matchups key={year} season={season} week={week} gameId={params.game ?? null} onWeek={(value) => navigate({ week: value, game: null })} onGame={(game) => navigate({ game })} />;
      case "Transactions": return <Transactions key={year} season={season} />;
      case "Settings": return <Settings key={year} season={season} />;
    }
  }

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
          {view === "all-time" ? (
            <RecordBook
              eraKey={eraKeys.includes(params.era) ? params.era : "all"}
              onEra={(era) => navigate({ era })}
              onSeason={(y) => navigate({ view: "season", year: y, section: "Overview", week: null, game: null })}
            />
          ) : (
            <>
              <div className="season-heading">{tab === "Overview" ? <p>{year} season</p> : <h1>{year} season</h1>}</div>
              <nav className="section-tabs" aria-label="Season sections">
                {tabs.map((item) => <button key={item} aria-pressed={item === tab} className={item === tab ? "active" : ""} onClick={() => navigate({ section: item })}>{item}</button>)}
              </nav>
              {seasonContent()}
            </>
          )}
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
