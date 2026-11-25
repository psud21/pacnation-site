// A small initials badge that gives each manager a recognisable mark wherever
// their name appears. The initials carry identity; the tone is decoration, so
// it can repeat across 23 managers without harm. Every tone keeps white
// initials above 4.5:1 contrast.
export const BADGE_TONES = ["#0c1830", "#2e4877", "#7a2e2b", "#3d6642", "#6b4f1d", "#4b3a6e", "#245a63", "#55595f", "#86385a", "#33587f", "#5f5226", "#2d5a4b"];

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\s.'-]/gu, "").split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const word = words[0] ?? "?";
  return word.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

export const toneFor = (id: string) => BADGE_TONES[(parseInt(id.replace(/\D/g, ""), 10) || 0) % BADGE_TONES.length];

export default function Badge({ id, name, size = "sm" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`badge badge-${size}`} style={{ background: toneFor(id) }} aria-hidden="true">{initials(name)}</span>;
}
