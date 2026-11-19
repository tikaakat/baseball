/* 成績の計算 */
import type { Player, StatLine, Team } from './types';

export function emptyStatLine(): StatLine {
  return { pa: 0, ab: 0, bb: 0, h: 0, doubles: 0, triples: 0, hr: 0, k: 0, rbi: 0, r: 0, gidp: 0, sac: 0, errors: 0, sb: 0, cs: 0 };
}
export function accumulateStatLine(target: StatLine, source: Partial<StatLine>): void {
  (Object.keys(target) as (keyof StatLine)[]).forEach((k) => { target[k] += source[k] || 0; });
}

export function avgOfStats(s: StatLine): number { return s.ab > 0 ? s.h / s.ab : 0; }
export function obpOfStats(s: StatLine): number {
  const d = s.ab + s.bb + s.sac;
  return d > 0 ? (s.h + s.bb) / d : 0;
}
export function slgOfStats(s: StatLine): number {
  const singles = s.h - s.doubles - s.triples - s.hr;
  const total = singles * 1 + s.doubles * 2 + s.triples * 3 + s.hr * 4;
  return s.ab > 0 ? total / s.ab : 0;
}
export function opsOfStats(s: StatLine): number { return obpOfStats(s) + slgOfStats(s); }
export function avgOf(p: Player): number { return avgOfStats(p.stats); }
export function obpOf(p: Player): number { return obpOfStats(p.stats); }
export function slgOf(p: Player): number { return slgOfStats(p.stats); }
export function opsOf(p: Player): number { return opsOfStats(p.stats); }
export function winPct(t: Pick<Team, 'wins' | 'losses'>): number {
  const d = t.wins + t.losses;
  return d > 0 ? t.wins / d : 0;
}
