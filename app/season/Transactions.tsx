import { useMemo, useState } from "react";
import { whole } from "../format";
import type { SeasonData } from "../types";

const PAGE_SIZE = 50;

export default function Transactions({ season }: { season: SeasonData }) {
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const types = ["All", ...new Set(season.transactions.map((item) => item.type))];
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return season.transactions.filter((item) => {
      const typeMatch = type === "All" || item.type === type;
      const searchMatch = !query || `${item.players} ${item.from} ${item.to} ${item.by}`.toLowerCase().includes(query);
      return typeMatch && searchMatch;
    });
  }, [season, type, search]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  return (
    <section className="panel">
      <div className="section-heading"><h2>Transactions</h2><span>{whole.format(rows.length)} results</span></div>
      <p className="method-note">Transaction rows, not unique events. Lineup changes are included.</p>
      <div className="transaction-tools">
        <select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }} aria-label="Filter transaction type">
          {types.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search player, team, or manager" aria-label="Search transactions" />
      </div>
      <div className="transaction-list">
        {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item, index) => (
          <article key={`${item.date}-${item.players}-${index}`}>
            <span className={`transaction-type type-${item.type.toLowerCase()}`}>{item.type}</span>
            <div><strong>{item.players}</strong><p>{item.from} <span>→</span> {item.to}</p></div>
            <aside><strong>W{item.week}</strong><small>{item.date}</small><small>{item.by}</small></aside>
          </article>
        ))}
      </div>
      {!rows.length && <p role="status">No activity matches. Try another search or transaction type.</p>}
      <div className="pagination">
        <button className="action" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span role="status">Page {page + 1} of {pageCount}</span>
        <button className="action" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      <p className="method-note">{PAGE_SIZE} rows per page · Rows may be parts of an event, not unique transactions.</p>
    </section>
  );
}
