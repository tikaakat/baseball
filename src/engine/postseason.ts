/* ポストシーズン（クライマックスシリーズ／日本シリーズ） */
import { SERIES_KEYS } from './data';
import { autoSimGame, newGame } from './game';
import { finalizeStandings } from './standings';
import { DB, leagueName } from './state';
import { emptyStatLine } from './stats';
import type { Series, Team } from './types';

function makeSeries(teamA: Team, teamB: Team, winsToClinch: number, advA: number, advB: number, label: string): Series {
  return { teamA, teamB, winsA: advA || 0, winsB: advB || 0, winsToClinch, games: [], winner: null, label };
}

export function startPostseason(): void {
  const { H, B } = finalizeStandings();
  DB.teams.forEach((t) => t.roster.forEach((p) => { p.psStats = emptyStatLine(); }));
  DB.postseason = {
    standings: { H, B },
    series: {
      H1: makeSeries(H[1], H[2], 2, 0, 0, leagueName('H') + ' ファーストステージ（2位 vs 3位・2勝先取）'),
      B1: makeSeries(B[1], B[2], 2, 0, 0, leagueName('B') + ' ファーストステージ（2位 vs 3位・2勝先取）'),
      H2: null, B2: null, JS: null,
    },
    champion: null,
  };
}

/** 決着したシリーズに応じて次のシリーズを作る */
export function progressPostseason(): void {
  const ps = DB.postseason;
  if (!ps) return;
  const { H, B } = ps.standings;
  if (!ps.series.H2 && ps.series.H1.winner) {
    ps.series.H2 = makeSeries(H[0], ps.series.H1.winner, 4, 1, 0, leagueName('H') + ' ファイナルステージ（1位に1勝のアドバンテージ・4勝先取）');
  }
  if (!ps.series.B2 && ps.series.B1.winner) {
    ps.series.B2 = makeSeries(B[0], ps.series.B1.winner, 4, 1, 0, leagueName('B') + ' ファイナルステージ（1位に1勝のアドバンテージ・4勝先取）');
  }
  if (!ps.series.JS && ps.series.H2?.winner && ps.series.B2?.winner) {
    ps.series.JS = makeSeries(ps.series.H2.winner, ps.series.B2.winner, 4, 0, 0, '日本シリーズ（4勝先取）');
  }
  if (ps.series.JS?.winner) ps.champion = ps.series.JS.winner;
}

/** ポストシーズンの残りを全て自動で消化する */
export function autoCompletePostseason(): void {
  if (!DB.postseason) startPostseason();
  const ps = DB.postseason!;
  let guard = 0;
  while (!ps.champion && guard < 100) {
    progressPostseason();
    SERIES_KEYS.forEach((key) => {
      const s = ps.series[key];
      if (s && !s.winner) autoSimGame(newGame(s.teamA, s.teamB, null, key));
    });
    guard++;
  }
  progressPostseason();
}
