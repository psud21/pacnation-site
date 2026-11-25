import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type TabSpec = { id: string; label: string; content: ReactNode };

/**
 * A small set of tabs inside one panel (ARIA tabs pattern): arrow keys, Home
 * and End move between tabs, and only the selected panel is rendered.
 */
export default function Tabbed({ label, tabs }: { label: string; tabs: TabSpec[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div className="tabbed">
      <div className="tabbed-list" role="tablist" aria-label={label} onKeyDown={keys}>
        {tabs.map((tab, i) => (
          <button key={tab.id} ref={(el) => { buttons.current[i] = el; }} role="tab" id={`${base}-${tab.id}`} aria-selected={i === index}
            aria-controls={`${base}-${tab.id}-panel`} tabIndex={i === index ? 0 : -1} className={i === index ? "active" : ""} onClick={() => setActive(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-${tabs[index].id}-panel`} aria-labelledby={`${base}-${tabs[index].id}`} className="tabbed-panel">
        {tabs[index].content}
      </div>
    </div>
  );
}
