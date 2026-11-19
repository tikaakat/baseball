/* 日程 */
import { LEAGUE_CODES } from './data';
import type { ScheduleGame, Team } from './types';
import { shuffle } from './util';

/** 同一リーグ24回戦(計120試合)＋交流戦4回戦(計24試合)＝1チーム144試合 */
export function createSchedule(teams: Team[]): ScheduleGame[] {
  const leagueA = teams.filter((t) => t.league === LEAGUE_CODES[0]);
  const leagueB = teams.filter((t) => t.league === LEAGUE_CODES[1]);
  const games: Omit<ScheduleGame, 'order'>[] = [];
  let gid = 1;
  const add = (home: Team, away: Team) => {
    games.push({ id: 'g' + gid++, home: home.id, away: away.id, played: false, result: null });
  };
  function roundRobinN(list: Team[], n: number) {
    const half = n / 2;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      for (let k = 0; k < half; k++) {
        add(list[i], list[j]);
        add(list[j], list[i]);
      }
    }
  }
  roundRobinN(leagueA, 24);
  roundRobinN(leagueB, 24);
  leagueA.forEach((a) => {
    leagueB.forEach((b) => {
      for (let k = 0; k < 2; k++) {
        add(a, b);
        add(b, a);
      }
    });
  });
  return shuffle(games).map((g, i) => ({ ...g, order: i + 1 }));
}

export function regularSeasonComplete(schedule: ScheduleGame[]): boolean {
  return schedule.length > 0 && schedule.every((g) => g.played);
}
