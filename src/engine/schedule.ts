/* 日程（1日に全12球団が1試合ずつ、計144日） */
import { LEAGUE_CODES } from './data';
import type { ScheduleGame, Team } from './types';
import { shuffle } from './util';

type Pair = [home: Team, away: Team];

/** 6チームの総当たり1巡（5節×3試合）をサークル法で作る */
function roundRobinRounds(teams: Team[]): [Team, Team][][] {
  const list = teams.slice();
  const rounds: [Team, Team][][] = [];
  for (let r = 0; r < list.length - 1; r++) {
    const round: [Team, Team][] = [];
    for (let i = 0; i < list.length / 2; i++) round.push([list[i], list[list.length - 1 - i]]);
    rounds.push(round);
    list.splice(1, 0, list.pop()!); // 先頭を固定して回転
  }
  return rounds;
}

/** 交流戦の期間（NPB同様、シーズン序盤の後に挟む） */
const INTERLEAGUE_START_DAY = 45;

/**
 * 同一リーグ24回戦(120日)＋交流戦4回戦(24日)＝1チーム144試合。
 * 毎日すべての球団が1試合ずつ戦うので、順位表の試合数が常に揃う。
 */
export function createSchedule(teams: Team[]): ScheduleGame[] {
  const leagueA = teams.filter((t) => t.league === LEAGUE_CODES[0]);
  const leagueB = teams.filter((t) => t.league === LEAGUE_CODES[1]);

  // 同一リーグ：5節を24周（周回ごとにホームを入れ替え、各カード12-12）。日付の並びはランダム
  const leagueDays = (league: Team[]): Pair[][] => {
    const rounds = roundRobinRounds(league);
    const days: Pair[][] = [];
    for (let cycle = 0; cycle < 24; cycle++) {
      rounds.forEach((round) => days.push(round.map(([a, b]) => (cycle % 2 === 0 ? [a, b] : [b, a]) as Pair)));
    }
    return shuffle(days);
  };
  const daysA = leagueDays(leagueA);
  const daysB = leagueDays(leagueB);

  // 交流戦：6日で全カード1試合、それを4周（2周ずつホームを入れ替え）
  const interleague: Pair[][] = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    for (let d = 0; d < leagueA.length; d++) {
      interleague.push(leagueA.map((a, i) => {
        const b = leagueB[(i + d) % leagueB.length];
        return (cycle % 2 === 0 ? [a, b] : [b, a]) as Pair;
      }));
    }
  }
  const interDays = shuffle(interleague);

  const allDays: Pair[][] = [];
  for (let i = 0; i < daysA.length; i++) {
    if (allDays.length === INTERLEAGUE_START_DAY - 1) allDays.push(...interDays);
    allDays.push([...daysA[i], ...daysB[i]]);
  }

  const games: ScheduleGame[] = [];
  allDays.forEach((pairs, dayIdx) => {
    pairs.forEach(([home, away]) => {
      games.push({ id: 'g' + (games.length + 1), home: home.id, away: away.id, played: false, result: null, order: games.length + 1, day: dayIdx + 1 });
    });
  });
  return games;
}

export function regularSeasonComplete(schedule: ScheduleGame[]): boolean {
  return schedule.length > 0 && schedule.every((g) => g.played);
}

/** 未消化の試合がある最初の日（全試合消化済みなら null） */
export function currentDay(schedule: ScheduleGame[]): number | null {
  let min: number | null = null;
  for (const g of schedule) if (!g.played && (min === null || g.day < min)) min = g.day;
  return min;
}

export function lastDay(schedule: ScheduleGame[]): number {
  return schedule.reduce((m, g) => Math.max(m, g.day), 0);
}
