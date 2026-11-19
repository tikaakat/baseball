/* 順位表 */
import { LEAGUE_CODES } from './data';
import { DB } from './state';
import { winPct } from './stats';
import type { Team } from './types';

export function headToHeadPct(teamA: Team, teamB: Team): number {
  const games = DB.schedule.filter((g) => g.played && (
    (g.home === teamA.id && g.away === teamB.id) || (g.home === teamB.id && g.away === teamA.id)
  ));
  let winsA = 0, decisive = 0;
  games.forEach((g) => {
    if (g.result!.winner === 'tie') return;
    decisive++;
    const winnerId = g.result!.winner === 'home' ? g.home : g.away;
    if (winnerId === teamA.id) winsA++;
  });
  return decisive > 0 ? winsA / decisive : 0.5;
}

/**
 * 同率の順位の決め方はリーグで違う：
 * イースト（'H'）＝勝率→勝利数→直接対決／ウエスト（'B'）＝勝率→直接対決→勝利数
 */
export function sortStandings(list: Team[], ruleFlag: 'H' | 'B'): Team[] {
  return list.slice().sort((a, b) => {
    const pa = winPct(a), pb = winPct(b);
    if (pa !== pb) return pb - pa;
    if (ruleFlag === 'H') {
      if (a.wins !== b.wins) return b.wins - a.wins;
      const hh = headToHeadPct(a, b);
      if (hh !== 0.5) return hh > 0.5 ? -1 : 1;
      return 0;
    }
    const hh = headToHeadPct(a, b);
    if (hh !== 0.5) return hh > 0.5 ? -1 : 1;
    if (a.wins !== b.wins) return b.wins - a.wins;
    return 0;
  });
}

export function finalizeStandings(): { H: Team[]; B: Team[] } {
  return {
    H: sortStandings(DB.teams.filter((t) => t.league === LEAGUE_CODES[0]), 'H'),
    B: sortStandings(DB.teams.filter((t) => t.league === LEAGUE_CODES[1]), 'B'),
  };
}

export function gamesBehind(leader: Team, team: Team): string {
  if (leader.id === team.id) return '-';
  const gb = ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
  return gb.toFixed(1);
}
