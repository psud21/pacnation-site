import { useMemo, useState } from "react";
import { whole } from "../format";
import type { SeasonData, Transaction } from "../types";

const PAGE_SIZE = 50;
const MOVES = "Adds, drops & trades";
const ALL = "Everything";

/** One trade between two teams; ``sides`` lists what each team received. */
type Trade = { kind: "trade"; date: string; week: number; by: string; sides: { team: string; players: string[] }[]; text: string };
type Row = { kind: "row"; tx: Transaction; text: string };
type Item = Trade | Row;

// "Name POS - TEAM [status]" or "Team Name DEF", repeated when NFL packs several
// players into one row. Status codes follow the player, e.g. IR or Q.
const PLAYER = / ?(.+?) (?:(?:QB|RB|WR|TE|K) - [A-Z]{2,3}|DEF)(?: (?:IR|Q|O|D|SUS|PUP|NA|IA|FP))?(?= |$)/g;

/** Split a multi-player row; fall back to the original text if it doesn't split cleanly. */
function splitPlayers(text: string): string[] {
  const parts = [...text.matchAll(PLAYER)].map((match) => match[0].trim());
  return parts.length > 1 && parts.join(" ") === text ? parts : [text];
}

/**
 * NFL logs a trade as one row per direction, all with the same timestamp. Rows
 * with the same time and the same pair of teams are one trade. Two different
 * trades in the same minute stay separate because their team pairs differ.
 */
function groupTrades(transactions: Transaction[]): Item[] {
  const items: Item[] = [];
  const trades = new Map<string, Trade>();
  for (const tx of transactions) {
    if (tx.type !== "Trade") {
      items.push({ kind: "row", tx, text: `${tx.players} ${tx.from} ${tx.to} ${tx.by}`.toLowerCase() });
      continue;
    }
    const key = `${tx.date}|${tx.week}|${[tx.from, tx.to].sort().join("|")}`;
    let trade = trades.get(key);
    if (!trade) {
      trade = { kind: "trade", date: tx.date, week: tx.week, by: tx.by, sides: [], text: "" };
      trades.set(key, trade);
      items.push(trade);
    }
    let side = trade.sides.find((s) => s.team === tx.to);
    if (!side) trade.sides.push((side = { team: tx.to, players: [] }));
    side.players.push(...splitPlayers(tx.players));
    trade.text += ` ${tx.players} ${tx.from} ${tx.to} ${tx.by}`.toLowerCase();
  }
  return items;
}

function TradeCard({ trade }: { trade: Trade }) {
  return (
    <article className="trade-card">
      <span className="transaction-type type-trade">Trade</span>
      <div className="trade-sides">
        {trade.sides.map((side) => (
          <div key={side.team}>
            <small>{side.team} receives</small>
            {side.players.map((player, index) => <strong key={index}>{player}</strong>)}
          </div>
        ))}
      </div>
      <aside><strong>W{trade.week}</strong><small>{trade.date}</small><small>{trade.by}</small></aside>
    </article>
  );
}

export default function Transactions({ season }: { season: SeasonData }) {
  const [type, setType] = useState(MOVES);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const items = useMemo(() => groupTrades(season.transactions), [season]);
  const lineupRows = useMemo(() => season.transactions.filter((tx) => tx.type === "Lineup").length, [season]);
  const types = [MOVES, ALL, ...new Set(season.transactions.map((item) => item.type))];
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const itemType = item.kind === "trade" ? "Trade" : item.tx.type;
      const typeMatch = type === ALL || (type === MOVES ? itemType !== "Lineup" : itemType === type);
      return typeMatch && (!query || item.text.includes(query));
    });
  }, [items, type, search]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  return (
    <section className="panel">
      <div className="section-heading"><h2>Transactions</h2><span>{whole.format(rows.length)} results</span></div>
      <p className="method-note">
        Each trade is shown once, with what each team received.
        {type === MOVES && lineupRows > 0 && <> {whole.format(lineupRows)} lineup changes are hidden; choose “Everything” or “Lineup” to see them.</>}
      </p>
      <div className="transaction-tools">
        <select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }} aria-label="Filter transaction type">
          {types.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search player, team, or manager" aria-label="Search transactions" />
      </div>
      <div className="transaction-list">
        {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item, index) => item.kind === "trade" ? <TradeCard key={`trade-${item.date}-${index}`} trade={item} /> : (
          <article key={`${item.tx.date}-${item.tx.players}-${index}`}>
            <span className={`transaction-type type-${item.tx.type.toLowerCase()}`}>{item.tx.type}</span>
            <div><strong>{item.tx.players}</strong><p>{item.tx.from} <span>→</span> {item.tx.to}</p></div>
            <aside><strong>W{item.tx.week}</strong><small>{item.tx.date}</small><small>{item.tx.by}</small></aside>
          </article>
        ))}
      </div>
      {!rows.length && <p role="status">No activity matches. Try another search or transaction type.</p>}
      <div className="pagination">
        <button className="action" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span role="status">Page {page + 1} of {pageCount}</span>
        <button className="action" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      <p className="method-note">{PAGE_SIZE} per page, newest first.</p>
    </section>
  );
}
