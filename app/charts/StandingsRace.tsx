import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { SeasonData } from "../types";

// Emphasis form: the selected team in the accent ink, every other team in a
// recessive gray (>= 2:1 on the card). Ties count as half a win.
const ACCENT = "var(--chart-accent)";
const CONTEXT = "var(--chart-context)";
const HEIGHT = 260;

type Line = { teamId: string; team: string; wins: number[] };

/** Cumulative regular-season wins after each week, per team. */
function raceLines(season: SeasonData): { weeks: number[]; lines: Line[] } {
  const cutoff = Math.min(...season.playoffs.map((g) => g.week));
  const weeks = [...new Set(season.matchups.filter((m) => m.week < cutoff).map((m) => m.week))].sort((a, b) => a - b);
  const lines = season.standings.map((row) => ({ teamId: row.teamId, team: row.team, wins: [] as number[] }));
  const byId = new Map(lines.map((line) => [line.teamId, line]));
  const seen = new Set<string>();
  const total = new Map(lines.map((line) => [line.teamId, 0]));
  for (const week of weeks) {
    for (const game of season.matchups.filter((m) => m.week === week)) {
      const [a, b] = game.teams;
      if (seen.has(game.id) || a.score == null || b.score == null) continue;
      seen.add(game.id);
      total.set(a.teamId, (total.get(a.teamId) ?? 0) + (a.score > b.score ? 1 : a.score === b.score ? 0.5 : 0));
      total.set(b.teamId, (total.get(b.teamId) ?? 0) + (b.score > a.score ? 1 : a.score === b.score ? 0.5 : 0));
    }
    for (const [teamId, wins] of total) byId.get(teamId)?.wins.push(wins);
  }
  return { weeks, lines };
}

/**
 * Width of the plot container (null until measured). The element is kept in
 * state so the effect re-runs whenever React attaches a new one; it measures
 * synchronously on mount, then follows container and window resizes.
 */
function useWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const measured = Math.round(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(Math.max(280, measured));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [element]);
  return { ref: setElement, width };
}


const fmt = (wins: number) => (Number.isInteger(wins) ? String(wins) : wins.toFixed(1));
const STEP_MS = 650;
const ROW = 30;

/**
 * Cumulative wins by week as an emphasis line chart, with a season replay:
 * play (or scrub) week by week while a ranked standings list re-sorts itself,
 * ending on the champion. ``autoReplay`` starts it on arrival.
 */
export default function StandingsRace({ season, autoReplay = false }: { season: SeasonData; autoReplay?: boolean }) {
  const { weeks, lines } = useMemo(() => raceLines(season), [season]);
  const champion = season.placements.find((p) => p.place === 1);
  const [selected, setSelected] = useState(champion?.teamId ?? lines[0]?.teamId);
  const [hover, setHover] = useState<number | null>(null);
  const [upTo, setUpTo] = useState<number | null>(null); // null: the whole season, no replay panel
  const [playing, setPlaying] = useState(false);
  const figure = useRef<HTMLElement>(null);
  const { ref, width: measured } = useWidth();
  const last = weeks.length - 1;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setUpTo((w) => {
        const next = (w ?? -1) + 1;
        if (next >= last) { setPlaying(false); return last; }
        return next;
      });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, last]);

  useEffect(() => {
    if (!autoReplay || !weeks.length) return;
    figure.current?.scrollIntoView({ block: "start" });
    setUpTo(0);
    const start = window.setTimeout(() => setPlaying(true), 500);
    return () => window.clearTimeout(start);
  }, [autoReplay, weeks.length]);

  if (!weeks.length) return null;
  const width = measured ?? 0;
  const shown = upTo ?? last;

  const narrow = width < 520;
  const margin = { top: 14, right: narrow ? 14 : 150, bottom: 30, left: 34 };
  const plotW = width - margin.left - margin.right;
  const plotH = HEIGHT - margin.top - margin.bottom;
  const maxWins = Math.max(1, ...lines.map((l) => l.wins[last] ?? 0));
  const x = (i: number) => margin.left + (weeks.length === 1 ? plotW / 2 : (i * plotW) / (weeks.length - 1));
  const y = (wins: number) => margin.top + plotH - (wins / maxWins) * plotH;
  const ticks = Array.from({ length: Math.floor(maxWins / 2) + 1 }, (_, i) => i * 2);
  const path = (line: Line) => line.wins.slice(0, shown + 1).map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w).toFixed(1)}`).join("");
  const focus = lines.find((l) => l.teamId === selected) ?? lines[0];

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.round(((event.clientX - box.left) / box.width) * last);
    setHover(Math.max(0, Math.min(shown, i)));
  };
  const keys = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setHover((h) => Math.max(0, Math.min(shown, (h ?? (step > 0 ? -1 : shown + 1)) + step)));
    } else if (event.key === "Escape") setHover(null);
  };
  const ranked = (week: number) => [...lines].sort((a, b) => b.wins[week] - a.wins[week] || a.team.localeCompare(b.team));
  const readout = hover == null ? null : ranked(hover);
  const tipLeft = hover == null ? 0 : Math.min(Math.max(x(hover) + 12, 0), width - 210);
  const replayOrder = upTo == null ? [] : ranked(upTo);
  const rankOf = new Map(replayOrder.map((line, i) => [line.teamId, i]));
  const finished = upTo === last && !playing;
  const championRow = season.standings.find((row) => row.teamId === champion?.teamId);
  const championLine = `${champion?.manager ? `${champion.manager} won the ${season.year} title` : `${season.year} champion`}${championRow ? ` from the No. ${championRow.rank} seed (${championRow.wins}–${championRow.losses}${championRow.ties ? `–${championRow.ties}` : ""} in the regular season)` : ""}.`;

  const play = () => {
    setHover(null);
    if (upTo == null || upTo >= last) setUpTo(0);
    setPlaying(true);
  };

  return (
    <figure className="race" ref={figure}>
      <figcaption>
        <h3>The standings race</h3>
        <p className="method-note">Regular-season wins after each week. Choose a team to follow it; hover or use the arrow keys for every team's total. Replay the season to watch it unfold.</p>
      </figcaption>
      <div className="replay-controls">
        <button className="action replay-button" onClick={playing ? () => setPlaying(false) : play}>
          {playing ? "❚❚ Pause" : upTo == null || upTo >= last ? "▶ Replay season" : "▶ Resume"}
        </button>
        {upTo != null && (
          <>
            <label className="replay-scrub">
              <span>Week {weeks[upTo]}</span>
              <input type="range" min={0} max={last} value={upTo} onChange={(e) => { setPlaying(false); setUpTo(Number(e.target.value)); }} aria-label="Week" />
            </label>
            <button className="text-button" onClick={() => { setPlaying(false); setUpTo(null); }}>Show full season</button>
          </>
        )}
      </div>
      <div className="race-legend" role="group" aria-label="Team to highlight">
        {lines.map((line) => (
          <button key={line.teamId} aria-pressed={line.teamId === focus.teamId} className={line.teamId === focus.teamId ? "active" : ""} onClick={() => setSelected(line.teamId)}>
            <i style={{ background: line.teamId === focus.teamId ? ACCENT : CONTEXT }} />{line.team}
          </button>
        ))}
      </div>
      <div className={`race-body${upTo != null ? " replaying" : ""}`}>
        <div className="race-plot" ref={ref} style={{ minHeight: HEIGHT }}>
          {measured != null && <svg width={width} height={HEIGHT} role="img" tabIndex={0} onKeyDown={keys} onBlur={() => setHover(null)}
            aria-label={`Cumulative wins by week. ${focus.team} had ${fmt(focus.wins[shown])} wins after week ${weeks[shown]}.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margin.left} x2={margin.left + plotW} y1={y(t)} y2={y(t)} className="race-grid" />
                <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="race-tick">{t}</text>
              </g>
            ))}
            {weeks.map((week, i) => (narrow ? i % 2 === 0 || i === last : true) && (
              <text key={week} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="race-tick">{narrow ? week : `W${week}`}</text>
            ))}
            {lines.filter((l) => l.teamId !== focus.teamId).map((line) => (
              <path key={line.teamId} d={path(line)} fill="none" style={{ stroke: CONTEXT }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            <path d={path(focus)} fill="none" style={{ stroke: ACCENT }} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(shown)} cy={y(focus.wins[shown])} r={5} style={{ fill: ACCENT, stroke: "var(--card)" }} strokeWidth={2} />
            {!narrow && (
              <text x={x(shown) + 10} y={y(focus.wins[shown])} dy="0.32em" className="race-label">
                {focus.team.length > 20 ? `${focus.team.slice(0, 19)}…` : focus.team} · {fmt(focus.wins[shown])}
              </text>
            )}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + plotH} className="race-crosshair" />}
            {hover != null && <circle cx={x(hover)} cy={y(focus.wins[hover])} r={4} style={{ fill: ACCENT, stroke: "var(--card)" }} strokeWidth={2} />}
            <rect x={margin.left - 10} y={margin.top} width={plotW + 20} height={plotH} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} />
          </svg>}
          {readout && hover != null && (
            <div className="race-tip" style={{ left: tipLeft }} role="status">
              <strong>Week {weeks[hover]}</strong>
              {readout.map((line) => (
                <span key={line.teamId} className={line.teamId === focus.teamId ? "focus" : ""}>
                  <i style={{ background: line.teamId === focus.teamId ? ACCENT : CONTEXT }} /><b>{fmt(line.wins[hover])}</b>{line.team}
                </span>
              ))}
            </div>
          )}
        </div>
        {upTo != null && (
          <div className="replay-board" aria-label={`Standings after week ${weeks[upTo]}`} role="group">
            <p className="replay-week" aria-live="polite">After week {weeks[upTo]}</p>
            <ol style={{ height: lines.length * ROW }}>
              {lines.map((line) => {
                const rank = rankOf.get(line.teamId) ?? 0;
                return (
                  <li key={line.teamId} className={line.teamId === focus.teamId ? "focus" : ""} style={{ transform: `translateY(${rank * ROW}px)` }}>
                    <span className="replay-rank">{rank + 1}</span>
                    <span className="replay-team">{line.team}</span>
                    <span className="replay-bar"><i style={{ width: `${(line.wins[upTo] / maxWins) * 100}%` }} /></span>
                    <b>{fmt(line.wins[upTo])}</b>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
      {finished && champion && (
        <div className="replay-champion" role="status">
          <span>Champion</span>
          <strong>{champion.team}</strong>
          <small>{championLine}</small>
        </div>
      )}
      <details className="stats-details">
        <summary>Show as table</summary>
        <div className="table-scroll" role="region" aria-label="Wins by week" tabIndex={0}>
          <table className="compact-table race-table">
            <thead><tr><th scope="col">Team</th>{weeks.map((w) => <th scope="col" key={w}>W{w}</th>)}</tr></thead>
            <tbody>
              {ranked(last).map((line) => (
                <tr key={line.teamId}><th scope="row">{line.team}</th>{line.wins.map((w, i) => <td key={i}>{fmt(w)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
