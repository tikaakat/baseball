/* 試合の進行 */
import { currentBattingKey, emptyBases, finalizeAtBat, pencilsFor, resolveAtBat, rollPencil1, rollPencil2 } from './atbat';
import { TUNING } from './data';
import { aiPitchingChoice, assignDecisions, currentPitcher, dayKeyFor, enterPitcher, fieldingSide, findPlayer, pickStarter, trackLeadChange } from './pitching';
import { gameLineup } from './lineup';
import { aiTactics } from './tactics';
import { onGameFinished } from './news';
import { managerEffects } from './team';
import { DB } from './state';
import type { BoxLine, Game, P1Face, P2Face, PitchBoxLine, Play, Player, SeriesKey, Side, Team } from './types';
import { frac } from './util';

export function newGame(homeTeam: Team, awayTeam: Team, scheduleId: string | null, seriesKey?: SeriesKey): Game {
  const game: Game = {
    scheduleId: scheduleId || null, home: homeTeam, away: awayTeam,
    dayKey: dayKeyFor(scheduleId || null),
    lineup: { home: gameLineup(homeTeam), away: gameLineup(awayTeam) },
    pitcher: { home: '', away: '' }, pitchersUsed: { home: [], away: [] }, pbox: {},
    winCand: null, loseCand: null,
    inning: 1, half: 'top', outs: 0, bases: emptyBases(),
    score: { home: 0, away: 0 }, orderIdx: { home: 0, away: 0 }, log: [],
    finished: false, winner: null, pencilStage: 'ready', pendingP1: null, lastPlay: null,
    battedThisGame: new Set(),
    inningRuns: { home: [], away: [] }, hits: { home: 0, away: 0 }, errors: { home: 0, away: 0 },
    box: {},
    removed: [],
    manualSide: null,
    cards: { shown: 0, lastKey: null },
    seriesKey,
  };
  (['away', 'home'] as const).forEach((side) => enterPitcher(game, side, pickStarter(game[side]), true));
  return game;
}

export function currentBatter(game: Game): Player {
  const k = currentBattingKey(game);
  return findPlayer(game[k], game.lineup[k][game.orderIdx[k]])!;
}

/** 試合に出ている野手（守備側の失策の対象など） */
export function fieldersOf(game: Game, side: Side): Player[] {
  return game.lineup[side].map((id) => findPlayer(game[side], id)).filter((p): p is Player => !!p);
}

function pboxOfCurrent(game: Game): { p: Player; line: PitchBoxLine; season: Player['pStats'] } | null {
  const p = currentPitcher(game);
  if (!p) return null;
  return { p, line: game.pbox[p.id], season: game.seriesKey ? p.psPStats : p.pStats };
}

/**
 * 打席の前に、AIの采配（継投・代打・バント・敬遠）を行う。
 * バントや敬遠でその打席が終わったら、その Play を返す
 */
export function beforePlateAppearance(game: Game): Play | null {
  if (game.finished) return null;
  const next = aiPitchingChoice(game);
  if (next) changePitcher(game, next);
  return aiTactics(game);
}

export function changePitcher(game: Game, next: Player): void {
  const side = fieldingSide(game);
  const prev = currentPitcher(game, side);
  enterPitcher(game, side, next, false);
  pushLog(game, `${game[side].name}、投手交代：${prev ? prev.name + ' → ' : ''}${next.name}`);
}

export function pushLog(game: Game, text: string): void {
  game.log.push(`${game.inning}回${game.half === 'top' ? '表' : '裏'} ${text}`);
  if (game.log.length > 200) game.log.shift();
}

function boxOf(game: Game, p: Player): BoxLine {
  return (game.box[p.id] ??= { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, r: 0, sb: 0 });
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
  if (!sacFlyCounts && !play.isSacBunt && play.rawResult !== 'walk') target.ab++; // 失策での出塁も打数に含める。犠打は打数に含めない
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
    // 失策した野手の個人成績に加算（ゴールデングラブ賞の集計に使う）
    if (play.errorFielder) statsTarget(game, play.errorFielder).errors++;
  }
  // 投手の成績
  const pc = pboxOfCurrent(game);
  if (pc) {
    const isHit = play.rawResult === 'hit' || play.rawResult === 'double' || play.rawResult === 'triple' || play.rawResult === 'hr';
    const outs = outsAfter - game.outs;
    for (const line of [pc.line, pc.season]) {
      line.bf++; line.outs += outs; line.r += runsThisPlay.length;
      if (isHit) line.h++;
      if (play.rawResult === 'hr') line.hr++;
      if (play.rawResult === 'walk') line.bb++;
      if (play.rawResult === 'k') line.k++;
    }
  }
  const scoreBefore = { ...game.score };

  // ボックススコア
  const box = boxOf(game, b);
  box.pa++;
  if (!sacFlyCounts && !play.isSacBunt && play.rawResult !== 'walk') box.ab++;
  if (play.rawResult === 'walk') box.bb++;
  if (play.rawResult === 'k') box.k++;
  if (play.rawResult === 'hit' || play.rawResult === 'double' || play.rawResult === 'triple' || play.rawResult === 'hr') box.h++;
  if (play.rawResult === 'hr') box.hr++;

  if (runsThisPlay.length) {
    if (play.rawResult !== 'error') { target.rbi += runsThisPlay.length; box.rbi += runsThisPlay.length; } // 失策での生還は打点にしない
    runsThisPlay.forEach((p) => { statsTarget(game, p).r++; boxOf(game, p).r++; });
    game.score[battingKey] += runsThisPlay.length;
    game.inningRuns[battingKey][game.inning - 1] += runsThisPlay.length;
    trackLeadChange(game, battingKey, scoreBefore);
  }
  game.bases = play.nb;
  game.outs = outsAfter;

  let text = play.desc;
  if (play.abilityNote) text += ` （${play.abilityNote}）`;
  if (runsThisPlay.length) text += ` ${runsThisPlay.length}点入る！`;
  pushLog(game, text);
  game.lastPlay = { p1: play.p1, p2: play.p2, abilityKey: play.abilityKey, abilityNote: play.abilityNote };

  game.orderIdx[battingKey] = (game.orderIdx[battingKey] + 1) % game.lineup[battingKey].length;

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
      if (game.inning > TUNING.maxInnings) { game.inning--; finishGame(game, true); return; }
    }
  } else if (game.half === 'bottom' && game.inning >= 9 && game.score.home > game.score.away) {
    finishGame(game);
  }
}

/** 盗塁の成功率 */
export function stealSuccessChance(game: Game, runner: Player): number {
  const T = TUNING.steal;
  const isStealer = runner.ability === 'stealer'; // 俊足盗塁王：成功率も高い
  void game;
  return Math.min(0.95, T.success.base + frac(runner.speed) * T.success.speed + (isStealer ? T.stealer.successBonus : 0));
}

/** 盗塁を実行する（一塁走者が二塁へ） */
export function executeSteal(game: Game): { success: boolean; runner: Player } | null {
  const runner = game.bases.first;
  if (game.finished || !runner || game.bases.second) return null;
  const success = Math.random() < stealSuccessChance(game, runner);
  const target = statsTarget(game, runner);
  if (success) {
    target.sb = (target.sb || 0) + 1;
    boxOf(game, runner).sb++;
    game.bases.second = runner;
    game.bases.first = null;
    pushLog(game, `${runner.name}、盗塁成功！2塁へ`);
  } else {
    target.cs = (target.cs || 0) + 1;
    const pc = pboxOfCurrent(game);
    if (pc && game.outs < 3) { pc.line.outs++; pc.season.outs++; }
    game.bases.first = null;
    game.outs = Math.min(3, game.outs + 1);
    pushLog(game, `${runner.name}、盗塁失敗…`);
    checkHalfInningEnd(game);
  }
  return { success, runner };
}

/** 盗塁：1塁に足の速い走者がいると、打席の前に盗塁を試みることがある（2塁が空いている場合のみ。手動操作の側は自分で決める） */
function attemptSteal(game: Game): { success: boolean; runner: Player } | null {
  if (game.finished) return null;
  const runner = game.bases.first;
  if (!runner || game.bases.second) return null;
  if (game.manualSide === currentBattingKey(game)) return null;
  const T = TUNING.steal;
  const stealMult = managerEffects(game[currentBattingKey(game)].manager).stealBoost || 1;
  const isStealer = runner.ability === 'stealer';
  const attemptChance = Math.max(0, frac(runner.speed) - T.attemptMinSpeed) * T.attempt * stealMult * (isStealer ? T.stealer.attemptMult : 1);
  if (Math.random() >= attemptChance) return null;
  return executeSteal(game);
}

function finishGame(game: Game, forcedTie = false): void {
  game.finished = true;
  if (forcedTie || game.score.home === game.score.away) game.winner = 'tie';
  else game.winner = game.score.home > game.score.away ? 'home' : 'away';
  pushLog(game, `試合終了　${game.away.name} ${game.score.away} - ${game.score.home} ${game.home.name}`);
  assignDecisions(game);
  onGameFinished(game);

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
    const tactic = beforePlateAppearance(game);
    if (tactic) return { stage: 'resolved', play: tactic };
    attemptSteal(game); // 打席の前に、1塁走者が盗塁を試みることがある
    if (game.finished) return { stage: 'resolved', play: null, stealOnly: true };
  }
  const batter = currentBatter(game);
  if (game.pencilStage === 'ready') {
    const p1 = rollPencil1(pencilsFor(batter, game));
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
  const p2 = rollPencil2(pencilsFor(batter, game));
  game.pencilStage = 'ready'; game.pendingP1 = null;
  const play = finalizeAtBat(batter, p1, p2, game.bases, game);
  applyPlay(game, play);
  return { stage: 'resolved', p1, p2, play };
}

export function autoSimGame(game: Game): Game {
  let it = 0;
  while (!game.finished && it < 5000) {
    if (beforePlateAppearance(game)) { it++; continue; }
    attemptSteal(game);
    if (game.finished) break;
    const play = resolveAtBat(currentBatter(game), game.bases, game);
    applyPlay(game, play);
    it++;
  }
  return game;
}
