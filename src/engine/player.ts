/* 選手の生成・成長・退団 */
import { FOREIGN_NAMES, FOREIGN_PLAYER_RATE, GIVEN_NAMES, GROWTH_PEAK, SURNAMES } from './data';
import { DB } from './state';
import { accumulateStatLine, emptyStatLine, opsOfStats } from './stats';
import type { GrowthType, Player, Team } from './types';
import { choice, frac, randInt } from './util';

let playerSeq = 1;
export function resetPlayerSeq(): void { playerSeq = 1; }
export function getPlayerSeq(): number { return playerSeq; }
export function setPlayerSeq(n: number): void { playerSeq = n; }

export interface PlayerIdentity { surname: string; given: string; initial: string }

export function pickPlayerIdentity(excludeNames: string[] = []): PlayerIdentity {
  if (Math.random() < FOREIGN_PLAYER_RATE) {
    const pool = FOREIGN_NAMES.filter((n) => !excludeNames.includes(n.surname));
    const pick = choice(pool.length ? pool : FOREIGN_NAMES);
    return { surname: pick.surname, given: pick.given, initial: pick.initial };
  }
  const pool = SURNAMES.filter((n) => !excludeNames.includes(n));
  const surname = choice(pool.length ? pool : SURNAMES);
  const g = choice(GIVEN_NAMES);
  return { surname, given: g.name, initial: g.initial };
}

const GROWTH_TYPES: GrowthType[] = ['early', 'normal', 'late'];

/**
 * 年齢の成長曲線：内部的に「早熟／普通／大器晩成」を割り振り、
 * ピーク年齢を過ぎたら能力は下がり続ける（内部データのみ、UIには出さない）
 */
export function applyAging(p: Player): void {
  p.age = (p.age || 24) + 1;
  const peak = GROWTH_PEAK[p.growthType] || 28;
  const dist = p.age - peak;
  let changeChance: number, direction: number, magnitude: number;
  if (dist <= -3) { changeChance = 0.45; direction = 1; magnitude = randInt(4, 14); }            // 成長期：伸びやすい
  else if (dist >= -2 && dist <= 1) { changeChance = 0.12; direction = 1; magnitude = randInt(2, 8); } // 全盛期：ごく僅かに伸びることも
  else if (dist <= 4) { changeChance = 0.45; direction = -1; magnitude = randInt(4, 12); }       // 下降開始：緩やかに衰える
  else if (dist <= 8) { changeChance = 0.65; direction = -1; magnitude = randInt(8, 20); }       // はっきり衰える
  else { changeChance = 0.8; direction = -1; magnitude = randInt(15, 30); }                      // ベテラン：大きく衰える
  if (Math.random() < changeChance) {
    const stat = choice(['power', 'contact', 'speed'] as const);
    p[stat] = Math.max(1, Math.min(256, p[stat] + direction * magnitude));
  }
}

export function createPlayer(pos: string | null, identity?: PlayerIdentity, youngProspect = false, debutSeasonOverride?: number): Player {
  const id = identity || pickPlayerIdentity([]);
  return {
    id: 'p' + playerSeq++, name: id.surname, given: id.given, initial: id.initial, pos: pos ?? '',
    number: null, // 背番号はロースター作成時にチーム単位で重複しないよう割り振る
    power: randInt(1, 256), contact: randInt(1, 256), speed: randInt(1, 256), defense: randInt(1, 256), ability: null,
    age: youngProspect ? randInt(18, 23) : Math.round((randInt(19, 36) + randInt(19, 36)) / 2),
    growthType: choice(GROWTH_TYPES),
    debutSeason: debutSeasonOverride || DB.currentSeasonNum || 1,
    stats: emptyStatLine(),   // 今シーズンの成績
    career: emptyStatLine(),  // 通算成績
    awards: { mvp: 0, bestNine: 0, psMvp: 0, rookie: 0, goldenGlove: 0 },
    seasonsPlayed: 0,
    psStats: emptyStatLine(), // 直近のポストシーズン成績
    gachaImmunitySeasons: youngProspect ? 2 : 0, // ガチャ加入直後の2年間は再放出の対象から保護
  };
}

/** 背番号（00〜99）をチーム内で重複しないように割り振る */
export function pickUniformNumber(excludeNumbers: (number | null)[] = []): number {
  const used = new Set(excludeNumbers);
  if (used.size >= 100) return randInt(0, 99);
  let n: number;
  do { n = randInt(0, 99); } while (used.has(n));
  return n;
}

/** 実績があればOPS、出場が少なければ基礎能力（0〜1スケール）で評価 */
export function performanceScore(p: Player): number {
  if (p.stats.ab >= 10) return opsOfStats(p.stats);
  return (frac(p.power) + frac(p.contact) + frac(p.speed)) / 3;
}

export function resetPlayerForNewSeason(p: Player): void {
  accumulateStatLine(p.career, p.stats);
  p.stats = emptyStatLine();
  p.psStats = emptyStatLine();
  p.seasonsPlayed = (p.seasonsPlayed || 0) + 1;
  p.gachaImmunitySeasons = Math.max(0, (p.gachaImmunitySeasons || 0) - 1);
  applyAging(p);
}

/** 退団する選手の通算成績をチームのOB名簿に残す（今シーズン分も加算） */
export function retirePlayer(team: Team, player: Player): void {
  const totalCareer = emptyStatLine();
  accumulateStatLine(totalCareer, player.career);
  accumulateStatLine(totalCareer, player.stats);
  if (!team.alumni) team.alumni = [];
  team.alumni.push({
    name: player.name, pos: player.pos, age: player.age,
    seasonsPlayed: (player.seasonsPlayed || 0) + (player.stats.pa > 0 ? 1 : 0),
    debutSeason: player.debutSeason || 1, lastSeason: DB.currentSeasonNum || 1,
    career: totalCareer,
    awards: Object.assign({ mvp: 0, bestNine: 0, psMvp: 0, rookie: 0, goldenGlove: 0 }, player.awards || {}),
  });
}

/** 失策が起きた際、守備力の低い選手ほど選ばれやすい */
export function pickWeightedFielderForError(roster: Player[]): Player {
  const weights = roster.map((p) => (256 - (p.defense || 128)) + 10);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < roster.length; i++) { r -= weights[i]; if (r <= 0) return roster[i]; }
  return roster[roster.length - 1];
}
