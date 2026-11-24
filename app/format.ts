import type { TeamScore } from "./types";

export const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const score = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Two-decimal points, or an em dash when the archive has no value. */
export const formatScore = (value: number | null | undefined) => (value == null ? "—" : score.format(value));

export function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}

/** True when ``team`` outscored every other team in the game (ties have no winner). */
export function isWinner(team: TeamScore, teams: TeamScore[]) {
  const others = teams.filter((other) => other.teamId !== team.teamId).map((other) => other.score ?? 0);
  return team.score != null && team.score > Math.max(...others);
}

export function recordLabel(type: string) {
  if (type === "team_season") return "Most points · season";
  if (type === "team_week") return "Most points · week";
  if (type === "player_week") return "Top player · week";
  return type.replaceAll("_", " ");
}

export const lower = (text: string | undefined) => (text ?? "").toLowerCase();
