import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { SeasonData } from "../types";

// Emphasis form: the selected team in the accent ink, every other team in a
// recessive gray (>= 2:1 on the card). Ties count as half a win.
const ACCENT = "#0c1830";
const CONTEXT = "#b9b2a3";
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

/** Width of the plot container, measured from the moment the element mounts (null until then). */
function useWidth() {
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.current.observe(element);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return { ref, width };
}

const fmt = (wins: number) => (Number.isInteger(wins) ? String(wins) : wins.toFixed(1));

export default function StandingsRace({ season }: { season: SeasonData }) {
  const { weeks, lines } = useMemo(() => raceLines(season), [season]);
  const champion = season.placements.find((p) => p.place === 1)?.teamId ?? lines[0]?.teamId;
  const [selected, setSelected] = useState(champion);
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width: measured } = useWidth();
  if (!weeks.length) return null;
  const width = measured ?? 0;

  const narrow = width < 520;
  const margin = { top: 14, right: narrow ? 14 : 150, bottom: 30, left: 34 };
  const plotW = width - margin.left - margin.right;
  const plotH = HEIGHT - margin.top - margin.bottom;
  const maxWins = Math.max(1, ...lines.map((l) => l.wins[l.wins.length - 1] ?? 0));
  const x = (i: number) => margin.left + (weeks.length === 1 ? plotW / 2 : (i * plotW) / (weeks.length - 1));
  const y = (wins: number) => margin.top + plotH - (wins / maxWins) * plotH;
  const ticks = Array.from({ length: Math.floor(maxWins / 2) + 1 }, (_, i) => i * 2);
  const path = (line: Line) => line.wins.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w).toFixed(1)}`).join("");
  const focus = lines.find((l) => l.teamId === selected) ?? lines[0];
  const last = weeks.length - 1;

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.round(((event.clientX - box.left) / box.width) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };
  const keys = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setHover((h) => Math.max(0, Math.min(last, (h ?? (step > 0 ? -1 : last + 1)) + step)));
    } else if (event.key === "Escape") setHover(null);
  };
  const readout = hover == null ? null : [...lines].sort((a, b) => b.wins[hover] - a.wins[hover] || a.team.localeCompare(b.team));
  const tipLeft = hover == null ? 0 : Math.min(Math.max(x(hover) + 12, 0), width - 210);

  return (
    <figure className="race">
      <figcaption>
        <h3>The standings race</h3>
        <p className="method-note">Regular-season wins after each week. Choose a team to follow it; hover or use the arrow keys for every team's total.</p>
      </figcaption>
      <div className="race-legend" role="group" aria-label="Team to highlight">
        {lines.map((line) => (
          <button key={line.teamId} aria-pressed={line.teamId === focus.teamId} className={line.teamId === focus.teamId ? "active" : ""} onClick={() => setSelected(line.teamId)}>
            <i style={{ background: line.teamId === focus.teamId ? ACCENT : CONTEXT }} />{line.team}
          </button>
        ))}
      </div>
      <div className="race-plot" ref={ref} style={{ minHeight: HEIGHT }}>
        {measured != null && <svg width={width} height={HEIGHT} role="img" tabIndex={0} onKeyDown={keys} onBlur={() => setHover(null)}
          aria-label={`Cumulative wins by week. ${focus.team} finished the regular season with ${fmt(focus.wins[last])} wins.`}>
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
            <path key={line.teamId} d={path(line)} fill="none" stroke={CONTEXT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          <path d={path(focus)} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(focus.wins[last])} r={5} fill={ACCENT} stroke="var(--card)" strokeWidth={2} />
          {!narrow && (
            <text x={x(last) + 10} y={y(focus.wins[last])} dy="0.32em" className="race-label">
              {focus.team.length > 20 ? `${focus.team.slice(0, 19)}…` : focus.team} · {fmt(focus.wins[last])}
            </text>
          )}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + plotH} className="race-crosshair" />}
          {hover != null && <circle cx={x(hover)} cy={y(focus.wins[hover])} r={4} fill={ACCENT} stroke="var(--card)" strokeWidth={2} />}
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
      <details className="stats-details">
        <summary>Show as table</summary>
        <div className="table-scroll" role="region" aria-label="Wins by week" tabIndex={0}>
          <table className="compact-table race-table">
            <thead><tr><th scope="col">Team</th>{weeks.map((w) => <th scope="col" key={w}>W{w}</th>)}</tr></thead>
            <tbody>
              {[...lines].sort((a, b) => b.wins[last] - a.wins[last]).map((line) => (
                <tr key={line.teamId}><th scope="row">{line.team}</th>{line.wins.map((w, i) => <td key={i}>{fmt(w)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
