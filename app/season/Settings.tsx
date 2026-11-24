import type { SeasonData } from "../types";

export default function Settings({ season }: { season: SeasonData }) {
  return (
    <section className="panel">
      <div className="section-heading"><h2>League settings</h2><span>{season.settings.length} rules</span></div>
      <div className="settings-grid">
        {season.settings.map((item, index) => <div key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </div>
    </section>
  );
}
