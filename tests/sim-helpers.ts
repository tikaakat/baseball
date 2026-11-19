import { completeDaysThrough } from '../src/engine/days';
import { createSchedule, lastDay } from '../src/engine/schedule';
import { emptyStatLine } from '../src/engine/stats';
import { DB } from '../src/engine/state';

export interface LeagueSummary {
  games: number; runsPerGame: number; avg: number; obp: number; slg: number;
  hrPerTeam: number; sbPerTeam: number; tieRate: number;
}

/** 現在のスケジュールを全部自動で消化する */
export function simWholeSeason(): void {
  completeDaysThrough(lastDay(DB.schedule));
}

export function summarizeLeague(): LeagueSummary {
  const t = { pa: 0, ab: 0, h: 0, bb: 0, sac: 0, d: 0, tr: 0, hr: 0, sb: 0 };
  DB.teams.forEach((team) => team.roster.forEach((p) => {
    const s = p.stats;
    t.pa += s.pa; t.ab += s.ab; t.h += s.h; t.bb += s.bb; t.sac += s.sac;
    t.d += s.doubles; t.tr += s.triples; t.hr += s.hr; t.sb += s.sb;
  }));
  const games = DB.schedule.filter((g) => g.played).length;
  const runs = DB.teams.reduce((a, team) => a + team.runsFor, 0);
  const ties = DB.schedule.filter((g) => g.result?.winner === 'tie').length;
  const singles = t.h - t.d - t.tr - t.hr;
  return {
    games,
    runsPerGame: runs / games / 2,
    avg: t.h / t.ab,
    obp: (t.h + t.bb) / (t.ab + t.bb + t.sac),
    slg: (singles + 2 * t.d + 3 * t.tr + 4 * t.hr) / t.ab,
    hrPerTeam: t.hr / DB.teams.length,
    sbPerTeam: t.sb / DB.teams.length,
    tieRate: ties / games,
  };
}

/** 同じ選手・監督のまま、成績だけを白紙に戻して日程を作り直す（条件比較用） */
export function resetSeasonKeepRosters(): void {
  DB.teams.forEach((t) => {
    t.wins = 0; t.losses = 0; t.ties = 0; t.runsFor = 0; t.runsAgainst = 0;
    t.roster.forEach((p) => { p.stats = emptyStatLine(); });
  });
  DB.schedule = createSchedule(DB.teams);
  DB.postseason = null;
}
