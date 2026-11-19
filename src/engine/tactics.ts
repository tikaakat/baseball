/*
 * 作戦：代打・送りバント・盗塁・敬遠。
 * AI（全球団の監督）とプレイヤーの「勝負所カード」は、同じ関数を使う。
 */
import { emptyBases, pencilsFor, resolveContact } from './atbat';
import { applyPlay, currentBatter, executeSteal, pushLog, stealSuccessChance } from './game';
import { batterValue } from './lineup';
import { availableRelievers, currentPitcher, fatigueOf, fieldingSide, findPlayer, otherSide } from './pitching';
import type { Game, Play, Player, Side } from './types';
import { frac } from './util';

const battingSide = (game: Game): Side => (game.half === 'top' ? 'away' : 'home');

/** 代打に出せる控え（スタメンでなく、まだ交代で退いていない野手） */
export function availableBench(game: Game, side: Side): Player[] {
  return game[side].roster.filter((p) => !game.lineup[side].includes(p.id) && !game.removed.includes(p.id));
}

export function pinchHit(game: Game, sub: Player): void {
  const side = battingSide(game);
  const slot = game.orderIdx[side];
  const out = findPlayer(game[side], game.lineup[side][slot]);
  game.lineup[side][slot] = sub.id;
  if (out) game.removed.push(out.id);
  pushLog(game, `${game[side].name}、代打：${out ? out.name + ' → ' : ''}${sub.name}`);
}

/* ---------- 送りバント ---------- */
export interface BuntChances { success: number; fail: number; hit: number; pop: number }

export function buntChances(batter: Player): BuntChances {
  const c = frac(batter.contact), s = frac(batter.speed);
  const hit = 0.03 + 0.07 * s;
  const fail = Math.max(0.06, 0.20 - 0.10 * c);
  const pop = Math.max(0.03, 0.09 - 0.05 * c);
  return { success: 1 - hit - fail - pop, fail, hit, pop };
}

export const canBunt = (game: Game) =>
  game.outs < 2 && !game.bases.third && !!(game.bases.first || game.bases.second);

export function executeBunt(game: Game): Play {
  const batter = currentBatter(game);
  const ch = buntChances(batter);
  const r = Math.random();
  const b = game.bases;
  const nb = emptyBases();
  let outsAdded = 1, desc = '', raw: Play['rawResult'] = 'groundout', isSacBunt = false;
  if (r < ch.success) {
    nb.second = b.first; nb.third = b.second;
    isSacBunt = true;
    desc = `${batter.name}、送りバント成功。`;
  } else if (r < ch.success + ch.fail) {
    // 先頭の走者が封殺され、打者は一塁に残る
    if (b.second && b.first) { nb.third = null; nb.second = b.first; }
    else { nb.second = b.second; }
    nb.first = batter;
    desc = `${batter.name}、バント失敗…先頭の走者がアウト。`;
  } else if (r < ch.success + ch.fail + ch.hit) {
    nb.first = batter; nb.second = b.first; nb.third = b.second;
    outsAdded = 0; raw = 'hit';
    desc = `${batter.name}、セーフティバント成功！`;
  } else {
    nb.first = b.first; nb.second = b.second; nb.third = b.third;
    raw = 'flyout';
    desc = `${batter.name}、バントを打ち上げてしまう…`;
  }
  const play: Play = {
    nb, outsAdded, scored: [], desc, isSacFly: false, isGidp: false, errorFielder: null, isSacBunt,
    p1: 'groundout', p2: null, usedPencil2: false, abilityNote: null, abilityKey: null, batter, rawResult: raw,
  };
  game.battedThisGame.add(batter.id);
  applyPlay(game, play);
  return play;
}

/* ---------- 敬遠 ---------- */
export const canWalk = (game: Game) => !game.bases.first && !!(game.bases.second || game.bases.third);

export function executeIntentionalWalk(game: Game): Play {
  const batter = currentBatter(game);
  const c = resolveContact('walk', batter, game.bases, { outs: game.outs });
  const play: Play = { ...c, desc: `${batter.name}、敬遠で一塁へ。`, errorFielder: null, p1: 'walk', p2: null, usedPencil2: false, abilityNote: null, abilityKey: null, batter, rawResult: 'walk' };
  game.battedThisGame.add(batter.id);
  applyPlay(game, play);
  return play;
}

/* ---------- 盗塁 ---------- */
export const canSteal = (game: Game) => !!game.bases.first && !game.bases.second;
export function forceSteal(game: Game) { return executeSteal(game); }
export function stealChanceNow(game: Game): number { return game.bases.first ? stealSuccessChance(game, game.bases.first) : 0; }

/* ---------- 勝負所の判定 ---------- */
const lateAndClose = (game: Game, side: Side, maxDiff = 2) =>
  game.inning >= 7 && Math.abs(game.score[side] - game.score[otherSide(side)]) <= maxDiff;
const anyRunner = (game: Game) => !!(game.bases.first || game.bases.second || game.bases.third);
const risp = (game: Game) => !!(game.bases.second || game.bases.third);

export interface DecisionCard {
  kind: 'offense' | 'defense';
  key: string;
  pinchHitters: Player[];
  steal: number | null;
  bunt: BuntChances | null;
  relievers: Player[];
  walk: boolean;
}

/** プレイヤーに勝負所カードを出すか（観戦中のマイチームの側だけ。1試合3回まで、同じ打席では1回） */
export function decisionCard(game: Game): DecisionCard | null {
  const side = game.manualSide;
  if (!side || game.finished || game.pencilStage !== 'ready' || game.cards.shown >= 3) return null;
  const key = `${game.inning}${game.half}${game.outs}-${game.orderIdx[battingSide(game)]}-${game.score.home}-${game.score.away}`;
  if (game.cards.lastKey === key || !lateAndClose(game, side)) return null;

  if (battingSide(game) === side) {
    if (!anyRunner(game)) return null;
    const cur = batterValue(currentBatter(game)).ops;
    const pinchHitters = availableBench(game, side).filter((p) => batterValue(p).ops > cur).sort((a, b) => batterValue(b).ops - batterValue(a).ops).slice(0, 2);
    const card: DecisionCard = { kind: 'offense', key, pinchHitters, steal: canSteal(game) ? stealChanceNow(game) : null, bunt: canBunt(game) ? buntChances(currentBatter(game)) : null, relievers: [], walk: false };
    return card.pinchHitters.length || card.steal !== null || card.bunt ? card : null;
  }
  const tired = fatigueOf(game, side) >= 0.3;
  if (!risp(game) && !(tired && anyRunner(game))) return null;
  const relievers = availableRelievers(game, side).sort((a, b) => relieverScore(b) - relieverScore(a)).slice(0, 3);
  const card: DecisionCard = { kind: 'defense', key, pinchHitters: [], steal: null, bunt: null, relievers, walk: canWalk(game) };
  return card.relievers.length || card.walk ? card : null;
}
const relieverScore = (p: Player) => (p.pitch ? p.pitch.stuff * 0.5 + p.pitch.control * 0.5 : 0);

export function markCardShown(game: Game, card: DecisionCard): void {
  game.cards.shown++;
  game.cards.lastKey = card.key;
}

/** カードの比較用：打者の鉛筆のヒット・HRの出やすさ（いまの投手を反映） */
export function pencilHeadline(game: Game, batter: Player): { hit: number; hr: number; onBase: number } {
  const pc = pencilsFor(batter, game);
  const hr = pc.p1.otto * pc.p2.hr;
  const hit = pc.p1.hit + pc.p1.otto * (pc.p2.double + pc.p2.hr);
  return { hit, hr, onBase: hit + pc.p1.walk };
}

/* ---------- AI の作戦（マイチームを観戦中は、その側の作戦はプレイヤーに任せる） ---------- */
export function aiTactics(game: Game): Play | null {
  const bat = battingSide(game), fld = fieldingSide(game);
  if (bat !== game.manualSide && lateAndClose(game, bat, 3)) {
    const diff = game.score[bat] - game.score[fld];
    // 代打：ビハインド〜1点リードで走者あり、控えの方が明らかに打てる
    if (anyRunner(game) && diff <= 1) {
      const cur = batterValue(currentBatter(game)).ops;
      const best = availableBench(game, bat).sort((a, b) => batterValue(b).ops - batterValue(a).ops)[0];
      if (best && batterValue(best).ops > cur + 0.07) pinchHit(game, best);
    }
    // 送りバント：無死一塁（一・二塁）で同点〜1点ビハインド、打力の低い打者
    if (game.outs === 0 && canBunt(game) && diff >= -1 && diff <= 0 && batterValue(currentBatter(game)).ops < 0.62) {
      return executeBunt(game);
    }
  }
  if (fld !== game.manualSide && game.inning >= 8 && Math.abs(game.score[fld] - game.score[bat]) <= 1 && game.outs >= 1 && canWalk(game)) {
    // 敬遠：一塁が空いていて、強打者のあとに打てない打者が続く
    const batter = currentBatter(game);
    const nextId = game.lineup[bat][(game.orderIdx[bat] + 1) % game.lineup[bat].length];
    const next = findPlayer(game[bat], nextId);
    const v = batterValue(batter).ops;
    if (next && v > 0.78 && batterValue(next).ops < v - 0.1) return executeIntentionalWalk(game);
  }
  return null;
}

/** 現在の投手（カード表示用） */
export function pitcherNow(game: Game): Player | undefined { return currentPitcher(game); }
