/* リーグ全体の状態（唯一の可変データ） */
import { DEFAULT_LEAGUE_NAMES, LEAGUE_CODES } from './data';
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
 * リーグ名を返す。リーグコード（'E'/'W'）のほか、順位表・ポストシーズン・球団史で使う
 * 'H'（=1つ目のリーグ）/'B'（=2つ目のリーグ）も受け付ける。
 */
export function leagueName(code: string): string {
  const key = code === 'H' ? LEAGUE_CODES[0] : code === 'B' ? LEAGUE_CODES[1] : code;
  return DB.leagueNames?.[key] || DEFAULT_LEAGUE_NAMES[key] || key;
}

export function teamById(id: string): Team | undefined {
  return DB.teams.find((t) => t.id === id);
}

export function playerById(id: string): { player: Player; team: Team } | null {
  for (const t of DB.teams) {
    const p = t.roster.find((pp) => pp.id === id) ?? t.pitchers.find((pp) => pp.id === id); // 野手も投手も
    if (p) return { player: p, team: t };
  }
  return null;
}
