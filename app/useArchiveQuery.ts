"use client";
import { useEffect, useState } from "react";

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
  function navigate(patch: Record<string, string | number | null>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) url.searchParams.delete(key); else url.searchParams.set(key, String(value));
    }
    url.hash = "";
    window.history.pushState({}, "", url);
    setParams(Object.fromEntries(url.searchParams));
  }
  return { params, navigate, ready };
}
