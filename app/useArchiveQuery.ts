import { useEffect, useState } from "react";

export type QueryParams = Record<string, string | number>;

// URLs are the source of navigation state; pushState makes Back/Forward useful.
export function useArchiveQuery() {
  const [params, setParams] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => { setParams(Object.fromEntries(new URLSearchParams(window.location.search))); setReady(true); };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function push(url: URL) {
    url.hash = "";
    window.history.pushState({}, "", url);
    setParams(Object.fromEntries(url.searchParams));
  }

  /** Change some parameters and keep the rest (filters within a page). */
  function navigate(patch: Record<string, string | number | null>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) url.searchParams.delete(key); else url.searchParams.set(key, String(value));
    }
    push(url);
  }

  /** Go to a different page: replace every parameter (links between pages). */
  function open(next: QueryParams) {
    const url = new URL(window.location.href);
    url.search = queryString(next);
    push(url);
  }

  return { params, navigate, open, ready };
}

export const queryString = (params: QueryParams) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
