import { Link, useArchive } from "../archive";
import Badge from "../Badge";
import FinishStrip, { FinishLegend } from "../charts/FinishStrip";

/** Every manager as a card: seasons, titles, record and a compact finish history. */
export default function ManagersIndex({ years }: { years: number[] }) {
  const { managers } = useArchive();
  const cards = [...managers.values()].sort((a, b) => b.seasons.length - a.seasons.length || a.label.localeCompare(b.label));
  return (
    <div className="content-stack">
      <header className="book-heading"><h1>Managers</h1></header>
      <p className="method-note">{cards.length} managers across {years.length} seasons. Each strip shows a career, one cell per season: darker is a better final place, gaps are seasons not played.</p>
      <FinishLegend />
      <div className="manager-cards">
        {cards.map((manager) => {
          const titles = manager.seasons.filter((s) => s.final === 1).length;
          const wins = manager.seasons.reduce((n, s) => n + s.wins, 0);
          const losses = manager.seasons.reduce((n, s) => n + s.losses, 0);
          const first = manager.seasons[0]?.year;
          const last = manager.seasons[manager.seasons.length - 1]?.year;
          return (
            <Link key={manager.id} to={{ view: "manager", id: manager.id }} className="manager-card">
              <span className="manager-card-head">
                <strong className="with-badge"><Badge id={manager.id} name={manager.name} size="md" />{manager.label}</strong>
                {titles > 0 && <span className="title-count">{titles} {titles === 1 ? "title" : "titles"}</span>}
              </span>
              <small>{manager.team}</small>
              <small>{first === last ? first : `${first}–${last}`} · {manager.seasons.length} {manager.seasons.length === 1 ? "season" : "seasons"} · {wins}–{losses} regular season</small>
              <FinishStrip seasons={manager.seasons} years={years} compact />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
