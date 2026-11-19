/* 1打席の判定：鉛筆の出目 → 能力・状況による補正 → 走者の進塁 */
import { P1_WEIGHTS, P2_WEIGHTS } from './data';
import type { AbilityKey, Bases, BaseKey, ContactResult, Game, Outcome, P1Face, P2Face, Play, Player } from './types';
import { frac, weightedChoice } from './util';

export function rollPencil1(): P1Face { return weightedChoice(P1_WEIGHTS); }
export function rollPencil2(): P2Face { return weightedChoice(P2_WEIGHTS); }
export function emptyBases(): Bases { return { first: null, second: null, third: null }; }
export function currentBattingKey(game: Game): 'home' | 'away' { return game.half === 'top' ? 'away' : 'home'; }

/** 四球・失策のときの押し出し進塁 */
function forceAdvance(orig: Bases, nb: Bases, batter: Player, scored: Player[]): void {
  nb.first = batter;
  if (orig.first) {
    nb.second = orig.first;
    if (orig.second) {
      nb.third = orig.second;
      if (orig.third) scored.push(orig.third);
    } else {
      nb.third = orig.third;
    }
  } else {
    nb.second = orig.second;
    nb.third = orig.third;
  }
}

/** 打球結果から走者の動き・アウト・得点を決める */
export function resolveContact(result: Outcome, batter: Player, bases: Bases, mgrGidpResist = 0): ContactResult {
  const orig = bases;
  const nb = emptyBases();
  const scored: Player[] = [];
  let outsAdded = 0, desc = '', isSacFly = false, isGidp = false, gidpEscaped = false;

  const scoreAllRunners = () => {
    if (orig.third) scored.push(orig.third);
    if (orig.second) scored.push(orig.second);
    if (orig.first) scored.push(orig.first);
  };

  switch (result) {
    case 'hit':
      if (orig.third) scored.push(orig.third);
      if (orig.second) scored.push(orig.second);
      if (orig.first) {
        if (Math.random() < Math.max(0, frac(batter.speed) - 0.4) * 0.25) nb.third = orig.first;
        else nb.second = orig.first;
      }
      nb.first = batter;
      desc = `${batter.name}、単打で出塁！`;
      break;
    case 'double':
      scoreAllRunners();
      nb.second = batter;
      desc = `${batter.name}、二塁打！`;
      break;
    case 'triple':
      scoreAllRunners();
      nb.third = batter;
      desc = `${batter.name}、三塁打！`;
      break;
    case 'hr':
      scoreAllRunners();
      scored.push(batter);
      desc = `${batter.name}、ホームラン！！`;
      break;
    case 'flyout':
      outsAdded = 1;
      nb.first = orig.first; nb.second = orig.second; nb.third = null;
      if (orig.third) { scored.push(orig.third); isSacFly = true; desc = `${batter.name}、犠牲フライ。三塁走者タッチアップ。`; }
      else desc = `${batter.name}、外野フライアウト。`;
      break;
    case 'groundout': {
      // ゲッツーは"詰まっている走者"の先頭が封殺される
      const chain: BaseKey[] = [];
      if (orig.first) chain.push('first');
      if (orig.first && orig.second) chain.push('second');
      if (orig.first && orig.second && orig.third) chain.push('third');
      if (chain.length === 0) {
        outsAdded = 1;
        nb.first = orig.first; nb.second = orig.second; nb.third = orig.third;
        desc = `${batter.name}、内野ゴロアウト。`;
      } else {
        const targetKey = chain[chain.length - 1];
        const advanceMap: Partial<Record<BaseKey, BaseKey>> = { first: 'second', second: 'third' };
        nb.first = orig.first; nb.second = orig.second; nb.third = orig.third;
        nb[targetKey] = null;
        if (Math.random() < frac(batter.speed) * 0.18 + mgrGidpResist) gidpEscaped = true;
        if (!gidpEscaped && batter.ability === 'steady' && Math.random() < 0.12) gidpEscaped = true;
        isGidp = !gidpEscaped;
        outsAdded = gidpEscaped ? 1 : 2;
        const others = chain.filter((k) => k !== targetKey).reverse();
        others.forEach((k) => { const dest = advanceMap[k]!; nb[dest] = orig[k]; nb[k] = null; });
        if (gidpEscaped) { nb.first = batter; desc = `${batter.name}、ゴロ…併殺崩れ！一塁生きる。`; }
        else desc = `${batter.name}、ゲッツー！`;
      }
      break;
    }
    case 'k':
      outsAdded = 1;
      nb.first = orig.first; nb.second = orig.second; nb.third = orig.third;
      desc = `${batter.name}、三振。`;
      break;
    case 'walk':
      forceAdvance(orig, nb, batter, scored);
      desc = `${batter.name}、四球で出塁。`;
      break;
    case 'error':
      forceAdvance(orig, nb, batter, scored);
      desc = `${batter.name}、相手の失策で出塁。`;
      break;
  }
  return { nb, outsAdded, scored, desc, isSacFly, isGidp };
}

const OUT_RESULTS: Outcome[] = ['flyout', 'groundout', 'k'];

/** 鉛筆の出目に、監督・能力・状況の補正をかけて打席結果を確定する */
export function finalizeAtBat(batter: Player, p1: P1Face, p2: P2Face | null, bases: Bases, game: Game | null): Play {
  const usedPencil2 = p1 === 'otto';
  let result: Outcome = p1 === 'otto' ? p2! : p1;
  let abilityNote: string | null = null;
  let abilityKey: AbilityKey | null = null; // どの"名前つき特殊能力"が結果を覆したか（演出用）

  // 監督効果：能力の実質倍率を、以降の計算に使う打者オブジェクトへ反映する（記録は元のbatterに対して行う）
  const realBatter = batter;
  let mgrGidpResist = 0, mgrErrorMult = 1;
  if (game) {
    const battingKey = currentBattingKey(game);
    const fieldingKey = battingKey === 'home' ? 'away' : 'home';
    const battingMgr = game[battingKey].manager;
    const fieldingMgr = game[fieldingKey].manager;
    if (battingMgr) {
      if (battingMgr.statMult) {
        const m = battingMgr.statMult;
        batter = {
          ...batter,
          power: Math.max(1, Math.min(256, Math.round(batter.power * (m.power || 1)))),
          contact: Math.max(1, Math.min(256, Math.round(batter.contact * (m.contact || 1)))),
          speed: Math.max(1, Math.min(256, Math.round(batter.speed * (m.speed || 1)))),
        };
      }
      if (battingMgr.gidpResist) mgrGidpResist = battingMgr.gidpResist;
      if (battingMgr.walkBoost && result === 'k' && Math.random() < 0.15 * (battingMgr.walkBoost - 1)) {
        result = 'walk';
        abilityNote ??= `${batter.name}、監督の待球方針で四球を選ぶ`;
      }
    }
    if (fieldingMgr?.errorReduction) mgrErrorMult = fieldingMgr.errorReduction;
    // 守備力：野手陣の平均守備力が高いほど失策が起きにくい
    const fieldingTeam = game[fieldingKey];
    if (fieldingTeam.roster.length) {
      const avgDef = fieldingTeam.roster.reduce((s, p) => s + (p.defense || 128), 0) / fieldingTeam.roster.length;
      mgrErrorMult *= 1.5 - frac(avgDef) * 0.9; // 守備力最低で1.5倍、最高で0.6倍
    }
  }

  // 本塁打だと思ったが、パワー不足でフェンスまで届かないことがある（出目そのままの本塁打のみ対象）
  if (result === 'hr') {
    const shortChance = Math.max(0, 0.5 - frac(batter.power)) * 0.24;
    if (Math.random() < shortChance) {
      if (Math.random() < 0.5) { result = 'flyout'; abilityNote = `${batter.name}、特大の当たりも本塁打には届かず...`; }
      else { result = 'double'; abilityNote = `${batter.name}、フェンス直撃！本塁打かと思ったら二塁打`; }
    }
  }

  const isFirstPaThisGame = !!game && !game.battedThisGame.has(realBatter.id);
  const isRISP = !!(bases.second || bases.third);
  const isBasesLoaded = !!(bases.first && bases.second && bases.third);
  let isTrailing = false, isLuckySeven = false;
  if (game) {
    const battingKey = currentBattingKey(game);
    const oppKey = battingKey === 'home' ? 'away' : 'home';
    isTrailing = game.score[battingKey] < game.score[oppKey];
    isLuckySeven = game.inning === 7;
  }
  const isOut = () => OUT_RESULTS.includes(result);

  // 一番打者向き：その試合の最初の打席で凡打がヒットに
  if (batter.ability === 'leadoff' && isFirstPaThisGame && isOut() && Math.random() < 0.25) {
    result = 'hit'; abilityNote = `${batter.name}、第一打席の勢いでヒットに！`; abilityKey = 'leadoff';
  }
  // 逆転の一振り：ビハインドの場面で凡打がヒットに
  if (!abilityKey && batter.ability === 'comeback' && isTrailing && isOut() && Math.random() < 0.25) {
    result = 'hit'; abilityNote = `${batter.name}、劣勢をはね返す一打！`; abilityKey = 'comeback';
  }
  // ラッキーセブン：7回に凡打がヒットに
  if (!abilityKey && batter.ability === 'luckySeven' && isLuckySeven && isOut() && Math.random() < 0.25) {
    result = 'hit'; abilityNote = `${batter.name}、ラッキーセブンで魅せる！`; abilityKey = 'luckySeven';
  }
  // 勝負強い：得点圏で長打に
  if (batter.ability === 'clutch' && isRISP) {
    if (result === 'hit' && Math.random() < 0.30) { result = 'double'; abilityNote = `${batter.name}、勝負強さを発揮！二塁打に`; abilityKey = 'clutch'; }
    else if (result === 'double' && Math.random() < 0.30) { result = 'hr'; abilityNote = `${batter.name}、勝負強さを発揮！本塁打に`; abilityKey = 'clutch'; }
  }
  // 満塁男：満塁で長打に（勝負強いより強力）
  if (batter.ability === 'basesLoadedHero' && isBasesLoaded) {
    if (result === 'hit' && Math.random() < 0.35) { result = 'double'; abilityNote = `${batter.name}、満塁男の本領発揮！二塁打に`; abilityKey = 'basesLoadedHero'; }
    else if (result === 'double' && Math.random() < 0.35) { result = 'hr'; abilityNote = `${batter.name}、満塁男の本領発揮！満塁本塁打だ！`; abilityKey = 'basesLoadedHero'; }
  }
  // 一発長打：二塁打が本塁打に
  if (batter.ability === 'bigSwing' && result === 'double' && Math.random() < 0.22) {
    result = 'hr'; abilityNote = `${batter.name}のフルスイングでスタンドへ`; abilityKey = 'bigSwing';
  }

  // 基礎ステータス：ミート／パワー（能力とは別枠の微調整）
  if (result === 'k') {
    const chance = Math.max(0, frac(batter.contact) - 0.5) * 0.50;
    if (Math.random() < chance) { result = 'groundout'; abilityNote ??= `${batter.name}のミートで粘って内野ゴロに`; }
  } else if (result === 'hit') {
    const chance = Math.max(0, 0.5 - frac(batter.contact)) * 0.40;
    if (Math.random() < chance) { result = 'groundout'; abilityNote ??= `${batter.name}、詰まった当たりでゴロに`; }
  }
  if (result === 'double') {
    const upChance = Math.max(0, frac(batter.power) - 0.5) * 0.50;
    const downChance = Math.max(0, 0.5 - frac(batter.power)) * 0.40;
    if (Math.random() < upChance) { result = 'hr'; abilityNote ??= `${batter.name}のパワーでスタンドイン`; }
    else if (Math.random() < downChance) { result = 'hit'; abilityNote ??= `${batter.name}、伸びを欠いて単打止まり`; }
  }
  // 走力：単打→二塁打／二塁打→三塁打（三塁打はここでのみ発生）
  if (result === 'hit') {
    const chance = Math.max(0, frac(batter.speed) - 0.4) * 0.25;
    if (Math.random() < chance) { result = 'double'; abilityNote ??= `${batter.name}、俊足を飛ばして二塁打に`; }
  } else if (result === 'double') {
    const chance = frac(batter.speed) * 0.20;
    if (Math.random() < chance) { result = 'triple'; abilityNote ??= `${batter.name}、俊足で三塁打を陥れる！`; }
  }
  // 堅実：三振を粘ってゴロに
  if (!abilityKey && batter.ability === 'steady' && result === 'k' && Math.random() < 0.12) {
    result = 'groundout'; abilityNote = `${batter.name}、堅実なバットコントロールでゴロに`; abilityKey = 'steady';
  }
  // 失策：ゴロ・フライのアウトが、まれに相手の失策で出塁に変わる
  if ((result === 'groundout' || result === 'flyout') && Math.random() < 0.03 * mgrErrorMult) {
    result = 'error';
  }

  if (game) game.battedThisGame.add(realBatter.id);
  const play = resolveContact(result, batter, bases, mgrGidpResist);
  return { ...play, p1, p2, usedPencil2, abilityNote, abilityKey, batter: realBatter, rawResult: result };
}

export function resolveAtBat(batter: Player, bases: Bases, game: Game | null): Play {
  const p1 = rollPencil1();
  const p2 = p1 === 'otto' ? rollPencil2() : null;
  return finalizeAtBat(batter, p1, p2, bases, game);
}
