/* リーグ全体の状態（唯一の可変データ） */
import { DEFAULT_LEAGUE_NAMES } from './data';
import type { DBState, Player, Team } from './types';

export const DB: DBState = {
  teams: [],
  schedule: [],
  postseason: null,
  leagueNames: { ...DEFAULT_LEAGUE_NAMES },
  gachaDoneThisCycle: false,
  currentSeasonNum: 1,
};

/**
 * リーグ名を返す。
 * 注意：元のHTML版と同様、ポストシーズンや球団史では 'H'/'B' というキーで呼ばれており、
 * DB.leagueNames（キーは 'E'/'W'）に一致しないため常に既定名にフォールバックしている。
 */
export function leagueName(code: string): string {
  return DB.leagueNames?.[code] || (code === 'H' ? 'イーストリーグ' : 'ウエストリーグ');
}

export function teamById(id: string): Team | undefined {
  return DB.teams.find((t) => t.id === id);
}

export function playerById(id: string): { player: Player; team: Team } | null {
  for (const t of DB.teams) {
    const p = t.roster.find((pp) => pp.id === id);
    if (p) return { player: p, team: t };
  }
  return null;
}
