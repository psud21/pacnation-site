import { ordinal } from "../format";
import type { ManagerSeason } from "../types";

// Final place binned into five ordered classes on one navy ramp (validated:
// monotone lightness, visible steps, light end >= 2:1 on the card surface).
// The place number is printed in each cell, so colour is never the only cue.
export const FINISH_BINS = [
  { key: "champion", label: "Champion", test: (p: number) => p === 1 },
  { key: "second", label: "Runner-up", test: (p: number) => p === 2 },
  { key: "top4", label: "3rd–4th", test: (p: number) => p <= 4 },
  { key: "middle", label: "5th–7th", test: (p: number) => p <= 7 },
  { key: "bottom", label: "8th or lower", test: () => true },
] as const;

const binOf = (place: number) => FINISH_BINS.find((bin) => bin.test(place))!;

export const describeSeason = (s: ManagerSeason) =>
  `${s.year}: ${s.team}, finished ${s.final ? ordinal(s.final) : "unknown"} of ${s.teamCount} (${s.wins}–${s.losses}–${s.ties}, regular season #${s.rank ?? "?"})`;

/**
 * One cell per league season, darker for a better final place. Seasons the
 * manager didn't play are shown as gaps so the career span reads at a glance.
 * ``compact`` drops the printed numbers for small cards; the cell's accessible
 * name and hover text still carry them.
 */
export default function FinishStrip({ seasons, years, compact = false }: { seasons: ManagerSeason[]; years: number[]; compact?: boolean }) {
  const byYear = new Map(seasons.map((season) => [season.year, season]));
  return (
    <div className={`finish-strip${compact ? " compact" : ""}`} role="list" aria-label="Final place by season" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}>
      {years.map((year, index) => {
        const season = byYear.get(year);
        const short = `’${String(year).slice(2)}`;
        if (!season || season.final == null) {
          return (
            <span role="listitem" className="finish-col" key={year} aria-label={`${year}: did not play`}>
              <span className="finish-cell empty" />
              {!compact && <small aria-hidden="true">{short}</small>}
            </span>
          );
        }
        const text = describeSeason(season);
        return (
          <span role="listitem" className="finish-col" key={year} aria-label={text} title={compact ? text : undefined} style={{ ["--i" as string]: index }}>
            <span className={`finish-cell bin-${binOf(season.final).key}`} tabIndex={compact ? undefined : 0} data-tip={compact ? undefined : text}>
              {!compact && <b aria-hidden="true">{season.final}</b>}
            </span>
            {!compact && <small aria-hidden="true">{short}</small>}
          </span>
        );
      })}
    </div>
  );
}

export function FinishLegend() {
  return (
    <ul className="finish-legend" aria-label="Finish key">
      {FINISH_BINS.map((bin) => <li key={bin.key}><span className={`finish-swatch bin-${bin.key}`} />{bin.label}</li>)}
    </ul>
  );
}
