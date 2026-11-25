import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up from 0 to ``value`` once when it appears (instant with reduced motion). */
export function CountUp({ value, duration = 700, format = (n: number) => String(n) }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t < 1 ? Math.round(value * eased) : value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Browsers throttle animation frames in background or unfocused tabs; make
    // sure the real number is showing once the animation's time is up.
    const done = window.setTimeout(() => setShown(value), duration + 50);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(done); };
  }, [value, duration]);
  // Screen readers get the final value straight away.
  return <span aria-label={format(value)}><span aria-hidden="true">{format(shown)}</span></span>;
}

/** Fades its children in whenever ``routeKey`` changes. */
export function PageFade({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return <div key={routeKey} className="page-fade">{children}</div>;
}

/** A sliding underline for a row of tab buttons; the active button must carry `.active`. */
export function useTabIndicator(dependency: unknown) {
  const nav = useRef<HTMLElement>(null);
  const [style, setStyle] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const active = nav.current?.querySelector<HTMLElement>("button.active");
      if (active && nav.current) setStyle({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [dependency]);
  return { nav, indicator: style && <span className="tab-indicator" aria-hidden="true" style={{ transform: `translateX(${style.left}px)`, width: style.width }} /> };
}
