import { useEffect, useState } from "react";

// Each file in public/data is fetched at most once per visit.
const pending = new Map<string, Promise<unknown>>();
const loaded = new Map<string, unknown>();

export function loadJson<T>(name: string): Promise<T> {
  let request = pending.get(name);
  if (!request) {
    request = fetch(`./data/${name}`).then((response) => {
      if (!response.ok) throw new Error(`${name} could not be loaded.`);
      return response.json();
    });
    request.then((data) => loaded.set(name, data), () => pending.delete(name)); // A failed load can be retried.
    pending.set(name, request);
  }
  return request as Promise<T>;
}

/** Load one data file; ``retry`` re-requests it after an error. */
export function useJson<T>(name: string | null) {
  const [state, setState] = useState<{ name: string | null; data?: T; error?: string }>(() => ({ name, data: name ? (loaded.get(name) as T | undefined) : undefined }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!name) return;
    if (loaded.has(name)) { setState({ name, data: loaded.get(name) as T }); return; }
    let live = true;
    setState({ name });
    loadJson<T>(name).then((data) => live && setState({ name, data }), (error: Error) => live && setState({ name, error: error.message }));
    return () => { live = false; };
  }, [name, attempt]);
  const current = state.name === name ? state : { name, data: name ? (loaded.get(name) as T | undefined) : undefined };
  return { data: current.data, error: current.error, retry: () => setAttempt((n) => n + 1) };
}
