import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useArchive } from "./archive";
import Badge from "./Badge";
import { loadJson } from "./data";
import type { LeagueIndex, Player } from "./types";
import type { QueryParams } from "./useArchiveQuery";

type Result = { key: string; kind: "Manager" | "Team" | "Season" | "Player"; title: string; detail: string; to: QueryParams; badge?: { id: string; name: string } };

const MAX = 12;

/** Lower-case words of the query must all appear; earlier matches rank higher. */
function score(text: string, words: string[]) {
  const hay = text.toLowerCase();
  if (!words.every((w) => hay.includes(w))) return -1;
  return (hay.startsWith(words[0]) ? 0 : 10) + hay.indexOf(words[0]) / 100;
}

/** ⌘K / Ctrl+K (or "/") search across managers, team names, seasons and players. */
export default function Search({ league }: { league: LeagueIndex }) {
  const { managers, open } = useArchive();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        opener.current = document.activeElement as HTMLElement;
        setVisible(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    input.current?.focus();
    loadJson<{ players: Player[] }>("players.json").then((file) => setPlayers(file.players), () => setPlayers([]));
  }, [visible]);

  const index = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const m of managers.values()) {
      const first = m.seasons[0]?.year, last = m.seasons[m.seasons.length - 1]?.year;
      out.push({ key: `m-${m.id}`, kind: "Manager", title: m.label, detail: `${first}–${last} · ${m.seasons.length} seasons`, to: { view: "manager", id: m.id }, badge: { id: m.id, name: m.name } });
      const names = new Map<string, number[]>();
      for (const s of m.seasons) names.set(s.team, [...(names.get(s.team) ?? []), s.year]);
      for (const [team, years] of names) out.push({ key: `t-${m.id}-${team}`, kind: "Team", title: team, detail: `${m.name} · ${years.join(", ")}`, to: { view: "season", year: years[years.length - 1], section: "Overview" }, badge: { id: m.id, name: m.name } });
    }
    for (const s of league.seasons) out.push({ key: `s-${s.year}`, kind: "Season", title: `${s.year} season`, detail: `Champion: ${s.champion}`, to: { view: "season", year: s.year, section: "Overview" } });
    for (const p of players) out.push({ key: `p-${p.id}`, kind: "Player", title: p.name, detail: `${p.pos ?? "Player"} · ${p.starts} starts · drafted ${p.drafts.length}×`, to: { view: "player", id: p.id } });
    return out;
  }, [managers, league, players]);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return index.filter((r) => r.kind === "Manager" || r.kind === "Season").slice(0, MAX);
    const kinds = ["Manager", "Team", "Season", "Player"];
    return index
      .flatMap((r) => {
        const anywhere = score(`${r.title} ${r.detail}`, words);
        if (anywhere < 0) return [];
        const inTitle = score(r.title, words);
        return [{ r, s: inTitle >= 0 ? inTitle : 50 + anywhere }]; // title matches rank above detail matches
      })
      .sort((a, b) => a.s - b.s || kinds.indexOf(a.r.kind) - kinds.indexOf(b.r.kind) || a.r.title.localeCompare(b.r.title))
      .slice(0, MAX)
      .map((x) => x.r);
  }, [index, query]);

  const close = () => { setVisible(false); setQuery(""); setActive(0); opener.current?.focus?.(); };
  const choose = (result: Result) => { close(); open(result.to); };
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
  };
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <button className="search-trigger" onClick={(e) => { opener.current = e.currentTarget; setVisible(true); }} aria-label="Search the archive" aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span>Search</span><kbd>{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      {visible && (
        <div className="search-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search the archive">
            <input ref={input} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={keys}
              placeholder="Managers, team names, seasons, players…" aria-label="Search" role="combobox" aria-expanded="true"
              aria-controls="search-results" aria-activedescendant={results[active] ? `sr-${results[active].key}` : undefined} />
            <ul id="search-results" role="listbox" aria-label="Results">
              {results.map((r, i) => (
                <li key={r.key} id={`sr-${r.key}`} role="option" aria-selected={i === active} className={i === active ? "active" : ""}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(r); }}>
                  {r.badge ? <Badge id={r.badge.id} name={r.badge.name} /> : <span className={`result-icon kind-${r.kind.toLowerCase()}`} aria-hidden="true">{r.kind[0]}</span>}
                  <span className="result-text"><strong>{r.title}</strong><small>{r.detail}</small></span>
                  <span className="result-kind">{r.kind}</span>
                </li>
              ))}
              {!results.length && <li className="empty" role="presentation">No matches for “{query}”.</li>}
            </ul>
            <p className="search-hint"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close{players.length ? "" : " · loading players…"}</p>
          </div>
        </div>
      )}
    </>
  );
}
