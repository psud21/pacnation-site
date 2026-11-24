import { useMemo } from "react";
import { Link, ManagerLink, SeasonLink, useArchive } from "../archive";
import { useJson } from "../data";
import { formatScore } from "../format";
import type { ArchiveGame } from "../types";

type Meeting = { game: ArchiveGame; a: ArchiveGame["teams"][number]; b: ArchiveGame["teams"][number] };

const kindLabel = (game: ArchiveGame) => (game.kind === "playoff" ? game.label ?? "Playoffs" : game.kind === "consolation" ? "Consolation" : "Regular season");

/** Every game between two managers, from manager ``a``'s side. */
export default function RivalryPage({ a, b, onChange }: { a: string; b: string; onChange: (a: string, b: string) => void }) {
  const { managers } = useArchive();
  const games = useJson<{ games: ArchiveGame[] }>("games.json");
  const meetings = useMemo<Meeting[]>(() => {
    const list: Meeting[] = [];
    for (const game of games.data?.games ?? []) {
      const ta = game.teams.find((t) => t.managerId === a);
      const tb = game.teams.find((t) => t.managerId === b);
      if (ta && tb && a !== b) list.push({ game, a: ta, b: tb });
    }
    return list.reverse(); // newest first
  }, [games.data, a, b]);

  const options = [...managers.values()].sort((x, y) => x.label.localeCompare(y.label));
  const left = managers.get(a);
  const right = managers.get(b);
  const regular = meetings.filter((m) => m.game.kind === "regular");
  const postseason = meetings.filter((m) => m.game.kind !== "regular");
  const tally = (list: Meeting[]) => list.reduce((t, m) => {
    if (m.a.score > m.b.score) t.a += 1; else if (m.a.score < m.b.score) t.b += 1; else t.ties += 1;
    t.aPoints += m.a.score; t.bPoints += m.b.score;
    return t;
  }, { a: 0, b: 0, ties: 0, aPoints: 0, bPoints: 0 });
  const reg = tally(regular);
  const playoffs = tally(meetings.filter((m) => m.game.kind === "playoff"));
  const biggest = (side: "a" | "b") => [...meetings].filter((m) => (side === "a" ? m.a.score > m.b.score : m.b.score > m.a.score))
    .sort((x, y) => Math.abs(y.a.score - y.b.score) - Math.abs(x.a.score - x.b.score))[0];

  const row = (m: Meeting) => (
    <tr key={`${m.game.year}-${m.game.week}`}>
      <td><SeasonLink year={m.game.year} section="Matchups" week={m.game.week}>{m.game.year} W{m.game.week}</SeasonLink>{m.game.kind !== "regular" && <small>{kindLabel(m.game)}</small>}</td>
      <td className={m.a.score > m.b.score ? "winner-cell" : ""}><strong>{formatScore(m.a.score)}</strong><small>{m.a.team}</small></td>
      <td className={m.b.score > m.a.score ? "winner-cell" : ""}><strong>{formatScore(m.b.score)}</strong><small>{m.b.team}</small></td>
      <td className="numeric">{formatScore(Math.abs(m.a.score - m.b.score))}</td>
    </tr>
  );
  const table = (list: Meeting[], label: string) => (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="compact-table rivalry-table">
        <thead><tr><th scope="col">Week</th><th scope="col">{left?.name ?? "Manager"}</th><th scope="col">{right?.name ?? "Opponent"}</th><th scope="col">Margin</th></tr></thead>
        <tbody>{list.map(row)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="content-stack profile">
      <header className="profile-heading">
        <p className="eyebrow">Rivalry</p>
        <h1>{left?.label ?? "?"} <span className="versus-word">vs</span> {right?.label ?? "?"}</h1>
        <div className="rivalry-pickers">
          <label>Manager<select value={a} onChange={(e) => onChange(e.target.value, b)}>{options.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <button className="action" onClick={() => onChange(b, a)} aria-label="Swap sides">⇄</button>
          <label>Opponent<select value={b} onChange={(e) => onChange(a, e.target.value)}>{options.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        </div>
      </header>

      {games.error ? <section className="panel" role="alert"><p>{games.error}</p><button className="action" onClick={games.retry}>Try again</button></section>
        : !games.data ? <section className="panel" role="status"><p>Loading games…</p></section>
        : a === b ? <section className="panel"><p>Choose two different managers.</p></section>
        : !meetings.length ? <section className="panel"><p>{left?.name} and {right?.name} never played each other. <Link to={{ view: "manager", id: a }}>See {left?.name}'s rivals</Link>.</p></section>
        : <>
          <section className="stat-tiles" aria-label="Rivalry summary">
            <div><span>Regular season</span><strong>{reg.a}–{reg.b}{reg.ties ? `–${reg.ties}` : ""}</strong><small>{left?.name}'s record in {regular.length} games</small></div>
            <div><span>Playoffs</span><strong>{playoffs.a + playoffs.b ? `${playoffs.a}–${playoffs.b}` : "—"}</strong><small>{playoffs.a + playoffs.b ? "bracket meetings" : "never met in the bracket"}</small></div>
            <div><span>Average score</span><strong>{formatScore(reg.aPoints / Math.max(1, regular.length))}</strong><small>vs {formatScore(reg.bPoints / Math.max(1, regular.length))}, regular season</small></div>
            {(["a", "b"] as const).map((side) => {
              const game = biggest(side);
              const who = side === "a" ? left : right;
              return <div key={side}><span>{who?.name}'s biggest win</span><strong>{game ? `+${formatScore(Math.abs(game.a.score - game.b.score))}` : "—"}</strong><small>{game ? `${game.game.year}, week ${game.game.week}` : "no wins yet"}</small></div>;
            })}
          </section>
          {postseason.length > 0 && <section className="panel"><div className="section-heading"><h2>Playoff and consolation meetings</h2><span>{postseason.length}</span></div>{table(postseason, "Playoff meetings")}</section>}
          <section className="panel">
            <div className="section-heading"><h2>Regular season</h2><span>{regular.length} games</span></div>
            {table(regular, "Regular-season games")}
          </section>
          <p className="method-note">Profiles: <ManagerLink id={a} /> · <ManagerLink id={b} /></p>
        </>}
    </div>
  );
}
