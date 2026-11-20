/*
 * 36マス対戦表方式：打者の鉛筆（1〜6）と投手の鉛筆（1〜6）を同時に振る。
 *
 * - 打者の数 ≥ 投手の数（21マス）なら「打者の表」、打者の数 < 投手の数（15マス）なら「投手の表」で結果が決まる
 * - 1マス＝1/36（約2.8%）。本塁打のように1マスより小さい確率は、マスを6つに分けて3本目の鉛筆で決める
 * - 表の中身は、いまの方式で調整済みの確率から作る：
 *     全体の確率 = 21/36 × 打者の表 + 15/36 × 投手の表
 *   なので、相手が平均的な投手のときに打者本来の確率になるよう「打者の表」を作り、
 *   相手が平均的な打者のときに投手本来の確率になるよう「投手の表」を作る
 * - 投手が疲れると、投手の表の凡打のマスがヒットや長打に書き換わっていく（目に見える）
 */
import { applyPitcherTo, effectiveBatter, finalizeResult, pencilsFor, type Pencils } from './atbat';
import { currentPitcher, fatigueOf, fieldingSide } from './pitching';
import { managerEffects } from './team';
import type { Bases, Game, Outcome, Play, Player } from './types';

/** 打席の決め方。'board' が対戦表方式（標準）、'classic' が以前の1本目・2本目方式 */
export type AtBatModel = 'classic' | 'board';
let model: AtBatModel = 'board';
export function getAtBatModel(): AtBatModel { return model; }
export function setAtBatModel(m: AtBatModel): void { model = m; }

export type BoardResult = 'single' | 'double' | 'hr' | 'walk' | 'k' | 'groundout' | 'flyout';
const RESULTS: BoardResult[] = ['hr', 'double', 'single', 'walk', 'k', 'groundout', 'flyout'];

export const BATTER_CELLS = 21;
export const PITCHER_CELLS = 15;

/** 鉛筆（1本目・2本目）の確率を、結果ごとの確率にまとめる */
function toDist(pc: Pencils): Record<BoardResult, number> {
  const o = pc.p1.otto;
  return {
    single: pc.p1.hit,
    double: o * pc.p2.double,
    hr: o * pc.p2.hr,
    walk: pc.p1.walk,
    k: pc.p1.k + o * pc.p2.k,
    groundout: pc.p1.groundout + o * pc.p2.groundout,
    flyout: pc.p1.flyout + o * pc.p2.flyout,
  };
}

const AVERAGE_PLAYER = { power: 128, contact: 128, speed: 128 } as Player;
let leagueDist: Record<BoardResult, number> | null = null;
function league(): Record<BoardResult, number> {
  return (leagueDist ??= toDist(pencilsFor(AVERAGE_PLAYER, null)));
}

/** 1マスは6つに分かれる（3本目の出目1〜6で決まる）。ほとんどのマスは6つとも同じ結果 */
export type Cell = BoardResult[];

/** 確率を n マス（＝6n 区画）に割り振る（最大剰余法。マイナスは0にして全体を合わせ直す） */
function toCells(target: Record<BoardResult, number>, n: number): Cell[] {
  const units = n * 6;
  const pos = RESULTS.map((r) => Math.max(0, target[r]));
  const sum = pos.reduce((a, b) => a + b, 0) || 1;
  const raw = pos.map((v) => (v / sum) * units);
  const counts = raw.map(Math.floor);
  let left = units - counts.reduce((a, b) => a + b, 0);
  raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => { if (left > 0) { counts[i]++; left--; } });
  const flat = RESULTS.flatMap((r, i) => Array.from({ length: counts[i] }, () => r));
  return Array.from({ length: n }, (_, k) => flat.slice(k * 6, k * 6 + 6));
}

/** 6つとも同じ結果でないマス（3本目を振るマス） */
export const isSplit = (c: Cell): boolean => c.some((r) => r !== c[0]);

/** 打者の表（21マス）：平均的な投手と対戦したときに、打者本来の確率になるように */
const cache = new Map<string, Cell[]>();
function cached(key: string, make: () => Cell[]): Cell[] {
  let v = cache.get(key);
  if (!v) { if (cache.size > 20000) cache.clear(); v = make(); cache.set(key, v); }
  return v;
}

export function batterCard(b: Player, walkBoost = 1): Cell[] {
  return cached(`b${b.power},${b.contact},${walkBoost}`, () => makeBatterCard(b, walkBoost));
}
function makeBatterCard(b: Player, walkBoost: number): Cell[] {
  const p = toDist(pencilsFor(b, null)), L = league();
  if (walkBoost !== 1) {
    // 待球作戦の監督：凡打の分を四球に回す
    const extra = p.walk * (walkBoost - 1), outs = p.groundout + p.flyout;
    p.walk += extra; p.groundout -= extra * p.groundout / outs; p.flyout -= extra * p.flyout / outs;
  }
  const t = {} as Record<BoardResult, number>;
  RESULTS.forEach((r) => { t[r] = (p[r] - (PITCHER_CELLS / 36) * L[r]) / (BATTER_CELLS / 36); });
  return toCells(t, BATTER_CELLS);
}

/** 投手の表（15マス）：平均的な打者と対戦したときに、投手本来の確率になるように（疲労込み） */
export function pitcherCard(p: Player | undefined, fatigue = 0): Cell[] {
  return cached(`p${p?.pitch?.stuff},${p?.pitch?.control},${fatigue}`, () => makePitcherCard(p, fatigue));
}
function makePitcherCard(p: Player | undefined, fatigue: number): Cell[] {
  const q = toDist(applyPitcherTo(pencilsFor(AVERAGE_PLAYER, null), p, fatigue)), L = league();
  const t = {} as Record<BoardResult, number>;
  RESULTS.forEach((r) => { t[r] = (q[r] - (BATTER_CELLS / 36) * L[r]) / (PITCHER_CELLS / 36); });
  return toCells(t, PITCHER_CELLS);
}

/** 2本の出目 → どちらの表の何マス目か */
export function cellOf(a: number, b: number): { side: 'batter' | 'pitcher'; index: number } {
  if (a >= b) return { side: 'batter', index: (a - 1) * a / 2 + (b - 1) }; // a=1..6, b=1..a
  return { side: 'pitcher', index: (b - 1) * (b - 2) / 2 + (a - 1) };     // b=2..6, a=1..b-1
}

const toOutcome = (r: BoardResult): Outcome => (r === 'single' ? 'hit' : r);

/** いまの打席の対戦表（打者の表・投手の表） */
export function boardFor(batter: Player, game: Game | null): { batter: Cell[]; pitcher: Cell[] } {
  const walkBoost = game ? managerEffects(game[game.half === 'top' ? 'away' : 'home'].manager).walkBoost || 1 : 1;
  return {
    batter: batterCard(effectiveBatter(batter, game), walkBoost),
    pitcher: pitcherCard(game ? currentPitcher(game) : undefined, game ? fatigueOf(game, fieldingSide(game)) : 0),
  };
}

/** 36マスのうち (a, b) のマス */
export function cellAt(board: { batter: Cell[]; pitcher: Cell[] }, a: number, b: number): Cell {
  const c = cellOf(a, b);
  return (c.side === 'batter' ? board.batter : board.pitcher)[c.index];
}

export function rollBoard(batter: Player, game: Game | null): { result: Outcome; a: number; b: number; c: number | null; side: 'batter' | 'pitcher' } {
  const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
  const sq = cellAt(boardFor(batter, game), a, b);
  // 分かれているマスだけ3本目を振る
  const c = isSplit(sq) ? 1 + Math.floor(Math.random() * 6) : null;
  return { result: toOutcome(sq[(c ?? 1) - 1]), a, b, c, side: cellOf(a, b).side };
}

export function resolveBoardAtBat(batter: Player, bases: Bases, game: Game | null): Play {
  const r = rollBoard(batter, game);
  return finalizeResult(batter, r.result, bases, game, {
    p1: r.result === 'double' || r.result === 'hr' ? 'otto' : 'hit', p2: null,
    board: { a: r.a, b: r.b, c: r.c, side: r.side },
  });
}
