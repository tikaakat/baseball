/* 成績の計算 */
import type { PitchLine, Player, StatLine, Team } from './types';

export function emptyStatLine(): StatLine {
  return { pa: 0, ab: 0, bb: 0, h: 0, doubles: 0, triples: 0, hr: 0, k: 0, rbi: 0, r: 0, gidp: 0, sac: 0, errors: 0, sb: 0, cs: 0 };
}
export function emptyPitchLine(): PitchLine {
  return { g: 0, gs: 0, w: 0, l: 0, sv: 0, outs: 0, bf: 0, h: 0, hr: 0, bb: 0, k: 0, r: 0 };
}
export function accumulatePitchLine(target: PitchLine, source: Partial<PitchLine>): void {
  (Object.keys(target) as (keyof PitchLine)[]).forEach((k) => { target[k] += source[k] || 0; });
}
/** 防御率（このゲームでは失点＝自責点として扱う） */
export function eraOf(s: PitchLine): number { return s.outs > 0 ? (s.r * 27) / s.outs : Infinity; }
export function whipOf(s: PitchLine): number { return s.outs > 0 ? ((s.h + s.bb) * 3) / s.outs : Infinity; }
/** 投球回の表記（例：123.1） */
export function ipOf(s: Pick<PitchLine, 'outs'>): string { return `${Math.floor(s.outs / 3)}${s.outs % 3 ? '.' + (s.outs % 3) : ''}`; }
/** 規定投球回（チーム試合数×1.0回） */
export function qualifyingOuts(team: Pick<Team, 'wins' | 'losses' | 'ties'>): number {
  return (team.wins + team.losses + team.ties) * 3;
}
export function isQualifiedPitcher(p: Player, team: Pick<Team, 'wins' | 'losses' | 'ties'>): boolean {
  const need = qualifyingOuts(team);
  return !!p.pitch && need > 0 && p.pStats.outs >= need;
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
/** 規定打席（NPBと同じく、所属チームの試合数×3.1） */
export function qualifyingPA(team: Pick<Team, 'wins' | 'losses' | 'ties'>): number {
  return Math.floor((team.wins + team.losses + team.ties) * 3.1);
}
/** 規定打席に達しているか（チームがまだ試合をしていなければ false） */
export function isQualified(p: Player, team: Pick<Team, 'wins' | 'losses' | 'ties'>): boolean {
  const need = qualifyingPA(team);
  return need > 0 && p.stats.pa >= need;
}

export function winPct(t: Pick<Team, 'wins' | 'losses'>): number {
  const d = t.wins + t.losses;
  return d > 0 ? t.wins / d : 0;
}
