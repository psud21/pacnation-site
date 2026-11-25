import { useEffect, useMemo, useRef, useState } from "react";
import { ArchiveContext, type Archive } from "./archive";
import { useJson } from "./data";
import Home from "./Home";
import { PageFade, useTabIndicator } from "./motion";
import Search from "./Search";
import ThemeToggle from "./ThemeToggle";
import Yearbook from "./season/Yearbook";
import ManagerPage from "./managers/ManagerPage";
import ManagersIndex from "./managers/ManagersIndex";
import RivalryPage from "./managers/RivalryPage";
import { PlayerPage, PlayersSearch } from "./players/Players";
import RecordBook from "./RecordBook";
import Draft from "./season/Draft";
import Matchups from "./season/Matchups";
import Overview from "./season/Overview";
import Settings from "./season/Settings";
import Standings from "./season/Standings";
import Transactions from "./season/Transactions";
import type { LeagueIndex, ManagerProfile, SeasonData } from "./types";
import { useArchiveQuery } from "./useArchiveQuery";

const tabs = ["Overview", "Standings", "Draft", "Matchups", "Transactions", "Settings"] as const;
type Tab = (typeof tabs)[number];
const views = ["home", "all-time", "season", "yearbook", "managers", "manager", "rivalry", "players", "player"] as const;
type View = (typeof views)[number];

// Season files are fetched on demand and kept for the rest of the visit.
const seasonCache = new Map<number, SeasonData>();

// The data file each page offers in the footer.
const downloads: Record<View, string> = {
  home: "index.json", "all-time": "all-time.json", season: "", yearbook: "", managers: "managers.json", manager: "managers.json",
  rivalry: "games.json", players: "players.json", player: "players.json",
};

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
 * (view, era, year, section, week, game, round, id, a, b), so links, reloads
 * and Back/Forward all work; see useArchiveQuery.
 */
export default function App() {
  const { params, navigate, open, ready } = useArchiveQuery();
  const [league, setLeague] = useState<LeagueIndex | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const enteredArchive = useRef(false);
  const profiles = useJson<{ managers: ManagerProfile[] }>("managers.json");

  const view: View = views.includes(params.view as View) ? (params.view as View) : "home";
  const year = league?.seasons.some((s) => s.year === Number(params.year)) ? Number(params.year) : league?.lastSeason ?? 2025;
  const tab: Tab = tabs.includes(params.section as Tab) ? (params.section as Tab) : "Overview";
  const week = Math.max(1, Math.min(18, Number(params.week) || 1));
  const draftRound = Math.max(0, Math.min(30, Number(params.round) || 0));
  // Changing season keeps the current tab (2010 Draft -> 2011 Draft).
  const setYear = (value: number) => open({ view: "season", year: value, ...(params.view === "season" && params.section ? { section: params.section } : {}) });

  const archive = useMemo<Archive>(() => {
    const managers = new Map((profiles.data?.managers ?? []).map((m) => [m.id, m]));
    const byTeam = new Map<string, string>();
    for (const m of managers.values()) for (const s of m.seasons) byTeam.set(`${s.year}-${s.teamId}`, m.id);
    return { open, managers, keyOf: (y, teamId) => byTeam.get(`${y}-${teamId}`) };
    // `open` only closes over setState and window, so it is stable in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.data]);

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
  }, [ready, league, view, year, tab, params.id, params.a, params.b]);

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
    if (!ready || (view !== "season" && view !== "yearbook")) return;
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

  const { nav: tabNav, indicator: tabIndicator } = useTabIndicator(`${view}-${tab}-${!!league}`);
  const managerNames = useMemo(() => new Map(season?.managers.map((m) => [m.teamId, m.manager]) ?? []), [season]);
  const managerOf = (teamId: string) => managerNames.get(teamId);

  if ((error || profiles.error) && !league) {
    return (
      <main className="error-shell" role="alert">
        <p className="eyebrow">PacNation archive</p>
        <h1>We hit a gap in the record book.</h1>
        <p>{error ?? profiles.error}</p>
        <button className="action" onClick={() => { setError(null); setRetry(retry + 1); profiles.retry(); }}>Try again</button>
      </main>
    );
  }
  if (!league || !ready || !profiles.data) return <LoadingArchive />;

  const loaded = league; // narrowed: available to the nested render helpers below
  const summary = league.seasons.find((item) => item.year === year)!;
  const years = [...league.seasons.map((s) => s.year)].sort((a, b) => a - b);
  const firstManager = [...archive.managers.values()].sort((a, b) => b.seasons.length - a.seasons.length)[0]?.id ?? "";

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
      case "Standings": return <Standings key={year} season={season} managerOf={managerOf} autoReplay={params.replay === "1"} />;
      case "Draft": return <Draft key={year} season={season} round={draftRound} onRound={(round) => navigate({ round })} managerOf={managerOf} />;
      case "Matchups": return <Matchups key={year} season={season} week={week} gameId={params.game ?? null} onWeek={(value) => navigate({ week: value, game: null })} onGame={(game) => navigate({ game })} />;
      case "Transactions": return <Transactions key={year} season={season} />;
      case "Settings": return <Settings key={year} season={season} />;
    }
  }

  function page() {
    switch (view) {
      case "season":
        return (
          <>
            <div className="season-heading">{tab === "Overview" ? <p>{year} season</p> : <h1>{year} season</h1>}</div>
            <nav className="section-tabs" aria-label="Season sections" ref={tabNav}>
              {tabs.map((item) => <button key={item} aria-pressed={item === tab} className={item === tab ? "active" : ""} onClick={() => navigate({ section: item, replay: null })}>{item}</button>)}
              {tabIndicator}
            </nav>
            {seasonContent()}
          </>
        );
      case "yearbook":
        return error ? <section className="panel" role="alert"><p>{error}</p></section>
          : !season || season.year !== year ? <section className="panel" role="status"><h1>Opening {year}…</h1></section>
          : <Yearbook season={season} summary={summary} managerOf={managerOf} />;
      case "home": return <Home league={loaded} />;
      case "managers": return <ManagersIndex years={years} />;
      case "manager": return <ManagerPage key={params.id} id={params.id ?? firstManager} years={years} />;
      case "rivalry": {
        const a = params.a ?? firstManager;
        const b = params.b ?? [...archive.managers.keys()].find((id) => id !== a) ?? a;
        return <RivalryPage a={a} b={b} onChange={(left, right) => open({ view: "rivalry", a: left, b: right })} />;
      }
      case "players": return <PlayersSearch />;
      case "player": return <PlayerPage key={params.id} id={params.id ?? ""} />;
      default:
        return (
          <RecordBook onSeason={(y) => open({ view: "season", year: y, section: "Overview" })} />
        );
    }
  }

  const railButton = (target: View, label: string, active: boolean) => (
    <button className={`book-button ${active ? "active" : ""}`} aria-pressed={active} onClick={() => open({ view: target })}>{label}</button>
  );
  const download = view === "season" || view === "yearbook" ? `seasons/${year}.json` : downloads[view];

  return (
    <ArchiveContext.Provider value={archive}>
      <div className="site-shell">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="topbar">
          <button className="brand" onClick={() => open({ view: "home" })} aria-label="PacNation history home">
            <span className="brand-mark">PN</span>
            <span><strong>PacNation</strong><small>League archive</small></span>
          </button>
          <div className="topbar-tools">
            <Search league={loaded} />
            <ThemeToggle />
            <div className="archive-range"><span>{league.firstSeason}</span><i /> <span>{league.lastSeason}</span></div>
          </div>
        </header>

        <div className="archive-layout" id="top">
          <aside className="season-rail" aria-label="Season archive">
            <p className="rail-label">Season archive</p>
            <nav className="rail-nav" aria-label="Archive sections">
              {railButton("home", "Home", view === "home")}
              {railButton("all-time", "Record book", view === "all-time")}
              {railButton("managers", "Managers", view === "managers" || view === "manager" || view === "rivalry")}
              {railButton("players", "Players", view === "players" || view === "player")}
            </nav>
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

          <main className={`archive-main view-${view}`} id="main-content" tabIndex={-1}>
            <PageFade routeKey={`${view}-${params.id ?? ""}-${params.a ?? ""}-${params.b ?? ""}-${view === "season" || view === "yearbook" ? year : ""}`}>{page()}</PageFade>
          </main>
        </div>
        <footer>
          <span>PacNation League Archive</span>
          <span>Preserved independently from NFL Fantasy · League {league.leagueId}</span>
          <a href={`./data/${download}`} download>Download this page's data (JSON)</a>
        </footer>
      </div>
    </ArchiveContext.Provider>
  );
}
