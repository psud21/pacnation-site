import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import Badge from "./Badge";
import type { ManagerProfile } from "./types";
import { queryString, type QueryParams } from "./useArchiveQuery";

/** Site-wide helpers: page navigation and who managed each team. */
export type Archive = {
  open: (params: QueryParams) => void;
  managers: Map<string, ManagerProfile>;
  /** Manager key for a season's NFL team ID. */
  keyOf: (year: number, teamId: string) => string | undefined;
};

export const ArchiveContext = createContext<Archive>({ open: () => {}, managers: new Map(), keyOf: () => undefined });
export const useArchive = () => useContext(ArchiveContext);

/** A real link (open in new tab works) that navigates in place on a plain click. */
export function Link({ to, children, className = "archive-link", label }: { to: QueryParams; children: ReactNode; className?: string; label?: string }) {
  const { open } = useArchive();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(to);
  };
  return <a href={`?${queryString(to)}`} className={className} onClick={onClick} aria-label={label}>{children}</a>;
}

export function ManagerLink({ id, children, badge = false }: { id?: string; children?: ReactNode; badge?: boolean }) {
  const { managers } = useArchive();
  const manager = id ? managers.get(id) : undefined;
  if (!id || !manager) return <>{children ?? "Unidentified manager"}</>;
  const link = <Link to={{ view: "manager", id }}>{children ?? manager.label}</Link>;
  return badge ? <span className="with-badge"><Badge id={id} name={manager.name} />{link}</span> : link;
}

/** Link a manager named in a season page, found by season and NFL team ID. */
export function TeamManagerLink({ year, teamId, children }: { year: number; teamId: string; children: ReactNode }) {
  const { keyOf } = useArchive();
  return <ManagerLink id={keyOf(year, teamId)}>{children}</ManagerLink>;
}

export function PlayerLink({ id, children }: { id?: string | null; children: ReactNode }) {
  if (!id) return <>{children}</>;
  return <Link to={{ view: "player", id }}>{children}</Link>;
}

export function RivalryLink({ a, b, children }: { a: string; b: string; children: ReactNode }) {
  return <Link to={{ view: "rivalry", a, b }}>{children}</Link>;
}

export function SeasonLink({ year, section = "Overview", week, children }: { year: number; section?: string; week?: number; children: ReactNode }) {
  return <Link to={{ view: "season", year, section, ...(week ? { week } : {}) }}>{children}</Link>;
}
