/* 試合の進行 */
import { currentBattingKey, emptyBases, finalizeAtBat, resolveAtBat, rollPencil1, rollPencil2 } from './atbat';
import { pickWeightedFielderForError } from './player';
import { DB } from './state';
import type { Game, P1Face, P2Face, Play, Player, SeriesKey, Team } from './types';
import { frac } from './util';

export function newGame(homeTeam: Team, awayTeam: Team, scheduleId: string | null, seriesKey?: SeriesKey): Game {
  return {
    scheduleId: scheduleId || null, home: homeTeam, away: awayTeam,
    inning: 1, half: 'top', outs: 0, bases: emptyBases(),
    score: { home: 0, away: 0 }, orderIdx: { home: 0, away: 0 }, log: [],
    finished: false, winner: null, pencilStage: 'ready', pendingP1: null, lastPlay: null,
    battedThisGame: new Set(),
    inningRuns: { home: [], away: [] }, hits: { home: 0, away: 0 }, errors: { home: 0, away: 0 },
    seriesKey,
  };
}

export function currentBatter(game: Game): Player {
  const k = currentBattingKey(game);
  return game[k].battingOrder[game.orderIdx[k]];
}

function pushLog(game: Game, text: string): void {
  game.log.push(`${game.inning}回${game.half === 'top' ? '表' : '裏'} ${text}`);
  if (game.log.length > 200) game.log.shift();
}

/** ポストシーズンの成績はレギュラーシーズンと分けて集計する */
function statsTarget(game: Game, p: Player) {
  return game.seriesKey ? p.psStats : p.stats;
}

export function applyPlay(game: Game, play: Play): void {
  const battingKey = currentBattingKey(game);
  const fieldingKey = battingKey === 'home' ? 'away' : 'home';
  const b = play.batter;
  const outsAfter = Math.min(game.outs + play.outsAdded, 3);
  const madeThirdOut = game.outs + play.outsAdded >= 3;
  const isForceOrFly = play.rawResult === 'flyout' || play.rawResult === 'groundout';
  const negateRuns = madeThirdOut && isForceOrFly; // その打席がイニング最終アウトなら得点なし
  const runsThisPlay = negateRuns ? [] : play.scored;
  const sacFlyCounts = play.isSacFly && !negateRuns;
  const target = statsTarget(game, b);

  // 掲示板用：この回にまだ記録が無ければ0点で欄を作っておく
  const arr = game.inningRuns[battingKey];
  while (arr.length < game.inning) arr.push(0);

  target.pa++;
  if (!sacFlyCounts && play.rawResult !== 'walk') target.ab++; // 失策での出塁も打数に含める
  if (play.rawResult === 'walk') target.bb++;
  if (play.rawResult === 'hit' || play.rawResult === 'double' || play.rawResult === 'triple' || play.rawResult === 'hr') {
    target.h++;
    if (play.rawResult === 'double') target.doubles++;
    if (play.rawResult === 'triple') target.triples++;
    if (play.rawResult === 'hr') target.hr++;
    game.hits[battingKey]++;
  }
  if (play.rawResult === 'k') target.k++;
  if (play.isGidp) target.gidp++;
  if (sacFlyCounts) target.sac++;
  if (play.rawResult === 'error') {
    game.errors[fieldingKey]++;
    // 失策を相手守備陣から1人選んで個人成績に加算（ゴールデングラブ賞の集計に使う）
    const fieldingTeam = game[fieldingKey];
    if (fieldingTeam.roster.length) {
      statsTarget(game, pickWeightedFielderForError(fieldingTeam.roster)).errors++;
    }
  }
  if (runsThisPlay.length) {
    if (play.rawResult !== 'error') target.rbi += runsThisPlay.length; // 失策での生還は打点にしない
    runsThisPlay.forEach((p) => { statsTarget(game, p).r++; });
    game.score[battingKey] += runsThisPlay.length;
    game.inningRuns[battingKey][game.inning - 1] += runsThisPlay.length;
  }
  game.bases = play.nb;
  game.outs = outsAfter;

  let text = play.desc;
  if (play.abilityNote) text += ` （${play.abilityNote}）`;
  if (runsThisPlay.length) text += ` ${runsThisPlay.length}点入る！`;
  pushLog(game, text);
  game.lastPlay = { p1: play.p1, p2: play.p2, abilityKey: play.abilityKey, abilityNote: play.abilityNote };

  game.orderIdx[battingKey] = (game.orderIdx[battingKey] + 1) % 9;

  checkHalfInningEnd(game);
}

function checkHalfInningEnd(game: Game): void {
  if (game.outs >= 3) {
    game.outs = 0; game.bases = emptyBases();
    if (game.half === 'top') {
      game.half = 'bottom';
      if (game.inning >= 9 && game.score.home > game.score.away) { finishGame(game); return; }
    } else {
      game.inning++; game.half = 'top';
      if (game.inning - 1 >= 9 && game.score.home !== game.score.away) {
        game.inning--; finishGame(game); return;
      }
      if (game.inning > 15) { finishGame(game, true); return; }
    }
  } else if (game.half === 'bottom' && game.inning >= 9 && game.score.home > game.score.away) {
    finishGame(game);
  }
}

/** 盗塁：1塁に足の速い走者がいると、打席の前に盗塁を試みることがある（2塁が空いている場合のみ） */
function attemptSteal(game: Game): { success: boolean; runner: Player } | null {
  if (game.finished) return null;
  const runner = game.bases.first;
  if (!runner || game.bases.second) return null;
  const runnerMgr = game[currentBattingKey(game)].manager;
  const stealMult = runnerMgr?.stealBoost || 1;
  const attemptChance = Math.max(0, frac(runner.speed) - 0.3) * 0.22 * stealMult;
  if (Math.random() >= attemptChance) return null;
  const successChance = 0.55 + frac(runner.speed) * 0.35;
  const success = Math.random() < successChance;
  const target = statsTarget(game, runner);
  if (success) {
    target.sb = (target.sb || 0) + 1;
    game.bases.second = runner;
    game.bases.first = null;
    pushLog(game, `${runner.name}、盗塁成功！2塁へ`);
  } else {
    target.cs = (target.cs || 0) + 1;
    game.bases.first = null;
    game.outs = Math.min(3, game.outs + 1);
    pushLog(game, `${runner.name}、盗塁失敗…`);
    checkHalfInningEnd(game);
  }
  return { success, runner };
}

function finishGame(game: Game, forcedTie = false): void {
  game.finished = true;
  if (forcedTie || game.score.home === game.score.away) game.winner = 'tie';
  else game.winner = game.score.home > game.score.away ? 'home' : 'away';
  pushLog(game, `試合終了　${game.away.name} ${game.score.away} - ${game.score.home} ${game.home.name}`);

  if (game.seriesKey) {
    const s = DB.postseason!.series[game.seriesKey]!;
    const base = { homeId: game.home.id, awayId: game.away.id, scoreHome: game.score.home, scoreAway: game.score.away };
    if (game.winner !== 'tie') {
      const winnerTeam = game.winner === 'home' ? game.home : game.away;
      if (winnerTeam.id === s.teamA.id) s.winsA++; else s.winsB++;
      s.games.push({ ...base, winnerId: winnerTeam.id, tie: false });
      if (s.winsA >= s.winsToClinch) s.winner = s.teamA;
      else if (s.winsB >= s.winsToClinch) s.winner = s.teamB;
    } else {
      s.games.push({ ...base, winnerId: null, tie: true });
    }
    return;
  }

  const { home, away } = game;
  home.runsFor += game.score.home; home.runsAgainst += game.score.away;
  away.runsFor += game.score.away; away.runsAgainst += game.score.home;
  if (game.winner === 'home') { home.wins++; away.losses++; }
  else if (game.winner === 'away') { away.wins++; home.losses++; }
  else { home.ties++; away.ties++; }
  // 監督の通算成績（レギュラーシーズンのみ）
  [home, away].forEach((t) => { if (t.manager) t.manager.careerGames = (t.manager.careerGames || 0) + 1; });
  const hm = home.manager, am = away.manager;
  if (game.winner === 'home') { if (hm) hm.wins = (hm.wins || 0) + 1; if (am) am.losses = (am.losses || 0) + 1; }
  else if (game.winner === 'away') { if (am) am.wins = (am.wins || 0) + 1; if (hm) hm.losses = (hm.losses || 0) + 1; }
  else { if (hm) hm.ties = (hm.ties || 0) + 1; if (am) am.ties = (am.ties || 0) + 1; }

  if (game.scheduleId) {
    const g = DB.schedule.find((s) => s.id === game.scheduleId);
    if (g) { g.played = true; g.result = { home: game.score.home, away: game.score.away, winner: game.winner }; }
  }
}

export type RollStepResult =
  | { stage: 'otto'; p1: P1Face; batter: Player }
  | { stage: 'resolved'; p1?: P1Face; p2?: P2Face | null; play: Play | null; stealOnly?: boolean };

/** 手動プレイ：鉛筆を1本転がす */
export function rollStep(game: Game): RollStepResult | null {
  if (game.finished) return null;
  if (game.pencilStage === 'ready') {
    attemptSteal(game); // 打席の前に、1塁走者が盗塁を試みることがある
    if (game.finished) return { stage: 'resolved', play: null, stealOnly: true };
  }
  const batter = currentBatter(game);
  if (game.pencilStage === 'ready') {
    const p1 = rollPencil1();
    game.pendingP1 = p1;
    if (p1 === 'otto') {
      game.pencilStage = 'awaitingPencil2';
      pushLog(game, `${batter.name} … 1本目「おっと」！ 2本目の鉛筆へ`);
      return { stage: 'otto', p1, batter };
    }
    const play = finalizeAtBat(batter, p1, null, game.bases, game);
    applyPlay(game, play);
    return { stage: 'resolved', p1, p2: null, play };
  }
  const p1 = game.pendingP1!;
  const p2 = rollPencil2();
  game.pencilStage = 'ready'; game.pendingP1 = null;
  const play = finalizeAtBat(batter, p1, p2, game.bases, game);
  applyPlay(game, play);
  return { stage: 'resolved', p1, p2, play };
}

export function autoSimGame(game: Game): Game {
  let it = 0;
  while (!game.finished && it < 5000) {
    attemptSteal(game);
    if (game.finished) break;
    const play = resolveAtBat(currentBatter(game), game.bases, game);
    applyPlay(game, play);
    it++;
  }
  return game;
}
