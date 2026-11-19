/* 日ごとの試合消化 */
import { autoSimGame, newGame } from './game';
import { currentDay } from './schedule';
import { DB, teamById } from './state';
import { reviewStaff } from './team';
import type { Game, ScheduleGame } from './types';

export function simulateScheduleGame(g: ScheduleGame): Game {
  return autoSimGame(newGame(teamById(g.home)!, teamById(g.away)!, g.id));
}

/** day 日目までの未消化試合を自動で消化する（exceptId の試合は除く＝観戦中の試合） */
export function completeDaysThrough(day: number, exceptId: string | null = null): number {
  let n = 0;
  DB.schedule.forEach((g) => {
    if (!g.played && g.day <= day && g.id !== exceptId) {
      simulateScheduleGame(g); n++;
      if (dayFinished(g.day)) onDayFinished(g.day);
    }
  });
  return n;
}

const dayFinished = (day: number) => DB.schedule.every((g) => g.day !== day || g.played);

/** 1日の全試合が終わったときの処理（15日ごとに投手陣を見直す） */
export function onDayFinished(day: number): void {
  if (day % 15 !== 0) return;
  DB.teams.forEach((t) => { reviewStaff(t); });
}

/** 今日から n 日分を自動で消化する（マイチームの試合も含む）。消化した日数を返す */
export function simulateDays(n: number): number {
  const start = currentDay(DB.schedule);
  if (start === null) return 0;
  completeDaysThrough(start + n - 1);
  return Math.min(n, (currentDay(DB.schedule) ?? start + n) - start);
}

/** マイチームの次の試合（未消化で一番早いもの） */
export function nextGameOf(teamId: string): ScheduleGame | null {
  let best: ScheduleGame | null = null;
  for (const g of DB.schedule) {
    if (!g.played && (g.home === teamId || g.away === teamId) && (!best || g.day < best.day || (g.day === best.day && g.order < best.order))) best = g;
  }
  return best;
}
