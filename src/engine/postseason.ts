/* ポストシーズン（プレーオフ／ペンシルシリーズ） */
import { POSTSEASON_NAMES, SERIES_KEYS } from './data';
import { autoSimGame, newGame } from './game';
import { finalizeStandings } from './standings';
import { DB, leagueName } from './state';
import { emptyPitchLine, emptyStatLine } from './stats';
import type { Series, Team } from './types';

function makeSeries(teamA: Team, teamB: Team, winsToClinch: number, advA: number, advB: number, label: string): Series {
  return { teamA, teamB, winsA: advA || 0, winsB: advB || 0, winsToClinch, games: [], winner: null, label };
}

export function startPostseason(): void {
  const { H, B } = finalizeStandings();
  DB.teams.forEach((t) => [...t.roster, ...t.pitchers].forEach((p) => { p.psStats = emptyStatLine(); p.psPStats = emptyPitchLine(); }));
  DB.postseason = {
    standings: { H, B },
    series: {
      H1: makeSeries(H[1], H[2], 2, 0, 0, `${leagueName('H')} 1st（2位vs3位・2勝先取）`),
      B1: makeSeries(B[1], B[2], 2, 0, 0, `${leagueName('B')} 1st（2位vs3位・2勝先取）`),
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
    ps.series.H2 = makeSeries(H[0], ps.series.H1.winner, 4, 1, 0, `${leagueName('H')} ファイナル（1位に1勝つき・4勝先取）`);
  }
  if (!ps.series.B2 && ps.series.B1.winner) {
    ps.series.B2 = makeSeries(B[0], ps.series.B1.winner, 4, 1, 0, `${leagueName('B')} ファイナル（1位に1勝つき・4勝先取）`);
  }
  if (!ps.series.JS && ps.series.H2?.winner && ps.series.B2?.winner) {
    ps.series.JS = makeSeries(ps.series.H2.winner, ps.series.B2.winner, 4, 0, 0, `${POSTSEASON_NAMES.final}（4勝先取）`);
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

/** マイチームの出番（未決着のシリーズ）が来るまで、他球団のシリーズを自動で進める */
export function autoUntilTeamPlays(teamId: string): void {
  if (!DB.postseason) startPostseason();
  const ps = DB.postseason!;
  const involves = (s: Series | null) => !!s && !s.winner && (s.teamA.id === teamId || s.teamB.id === teamId);
  let guard = 0;
  while (!ps.champion && guard < 100) {
    progressPostseason();
    if (SERIES_KEYS.some((k) => involves(ps.series[k]))) return;
    if (!isAlive(teamId)) return;
    SERIES_KEYS.forEach((key) => {
      const s = ps.series[key];
      if (s && !s.winner && !involves(s)) autoSimGame(newGame(s.teamA, s.teamB, null, key));
    });
    guard++;
  }
  progressPostseason();
}

/** ポストシーズンでまだ勝ち残っているか（出場していなければ false） */
export function isAlive(teamId: string): boolean {
  const ps = DB.postseason;
  if (!ps) return false;
  const all = SERIES_KEYS.map((k) => ps.series[k]).filter((s): s is Series => !!s);
  const top = [ps.standings.H[0], ps.standings.B[0]].some((t) => t.id === teamId);
  const inAny = top || all.some((s) => s.teamA.id === teamId || s.teamB.id === teamId);
  if (!inAny) return false;
  return !all.some((s) => s.winner && (s.teamA.id === teamId || s.teamB.id === teamId) && s.winner.id !== teamId);
}
