/*
 * 1打席の判定。
 * 打者ごとに「その打者の鉛筆」（各面の出やすさ）を能力から作り、それを転がして結果を決める。
 * 鉛筆を振った後に結果が変わるのは、走力による長打の上積み・特殊能力・失策だけ。
 */
import { TUNING } from './data';
import { currentPitcher, fatigueOf } from './pitching';
import { pickWeightedFielderForError } from './player';
import { managerEffects } from './team';
import type { AbilityKey, Bases, ContactResult, Game, Outcome, P1Face, P2Face, Play, Player } from './types';
import { frac, weightedChoice } from './util';

export function emptyBases(): Bases { return { first: null, second: null, third: null }; }
export function currentBattingKey(game: Game): 'home' | 'away' { return game.half === 'top' ? 'away' : 'home'; }
const fieldingKeyOf = (game: Game): 'home' | 'away' => (currentBattingKey(game) === 'home' ? 'away' : 'home');

/* ---------- 打者の鉛筆 ---------- */

/** 監督の采配（能力の実質倍率）を反映した打者。記録には使わない */
export function effectiveBatter(batter: Player, game: Game | null): Player {
  if (!game) return batter;
  const m = managerEffects(game[currentBattingKey(game)].manager).statMult;
  if (!m) return batter;
  const scale = (v: number, k: number) => Math.max(1, Math.min(256, Math.round(v * (k || 1))));
  return { ...batter, power: scale(batter.power, m.power), contact: scale(batter.contact, m.contact), speed: scale(batter.speed, m.speed) };
}

export interface Pencils { p1: Record<P1Face, number>; p2: Record<P2Face, number> }

/** その打者の2本の鉛筆（各面の確率。合計1） */
export function pencilsFor(batter: Player, game: Game | null): Pencils {
  const b = effectiveBatter(batter, game);
  const c = frac(b.contact), pw = frac(b.power);
  const T = TUNING;
  const walkBoost = game ? managerEffects(game[currentBattingKey(game)].manager).walkBoost || 1 : 1;

  const hit = T.p1.hit.base + T.p1.hit.contact * c;
  const walk = T.p1.walk * walkBoost;
  const k = T.p1.k.base + T.p1.k.contact * c + T.p1.k.power * pw;
  const otto = T.p1.otto.base + T.p1.otto.power * pw;
  const outs1 = Math.max(0, 1 - hit - walk - k - otto);
  const fly1 = T.p1.flyShare.base + T.p1.flyShare.power * pw;

  const hr = T.p2.hr.base + T.p2.hr.power * pw * pw;
  const dbl = T.p2.double.base + T.p2.double.contact * c;
  const outs2 = Math.max(0, 1 - hr - dbl - T.p2.k);

  const base: Pencils = {
    p1: { hit, walk, k, otto, flyout: outs1 * fly1, groundout: outs1 * (1 - fly1) },
    p2: { double: dbl, hr, k: T.p2.k, flyout: outs2 * T.p2.flyShare, groundout: outs2 * (1 - T.p2.flyShare) },
  };
  return game ? applyPitcher(base, game) : base;
}

/** 投手が打者の鉛筆を書き換える（球威・制球・疲労）。凡打の面で帳尻を合わせる */
function applyPitcher(pc: Pencils, game: Game): Pencils {
  const pitcher = currentPitcher(game);
  if (!pitcher?.pitch) return pc;
  const s = frac(pitcher.pitch.stuff) - 0.5, c = frac(pitcher.pitch.control) - 0.5;
  const f = fatigueOf(game, game.half === 'top' ? 'home' : 'away');
  const P = TUNING.pitcher;
  const m = (x: { stuff?: number; control?: number; fatigue?: number }) =>
    Math.max(0.05, 1 + (x.stuff ?? 0) * s + (x.control ?? 0) * c + (x.fatigue ?? 0) * f);
  const p1 = { ...pc.p1, hit: pc.p1.hit * m(P.hit), otto: pc.p1.otto * m(P.otto), k: pc.p1.k * m(P.k), walk: pc.p1.walk * m(P.walk) };
  const p2 = { ...pc.p2, hr: pc.p2.hr * m(P.hr), double: pc.p2.double * m(P.double) };
  const refill1 = Math.max(0, 1 - p1.hit - p1.otto - p1.k - p1.walk), out1 = pc.p1.flyout + pc.p1.groundout || 1;
  const refill2 = Math.max(0, 1 - p2.hr - p2.double - p2.k), out2 = pc.p2.flyout + pc.p2.groundout || 1;
  p1.flyout = refill1 * (pc.p1.flyout / out1); p1.groundout = refill1 * (pc.p1.groundout / out1);
  p2.flyout = refill2 * (pc.p2.flyout / out2); p2.groundout = refill2 * (pc.p2.groundout / out2);
  return { p1, p2 };
}

export function rollPencil1(pencils: Pencils): P1Face { return weightedChoice(pencils.p1); }
export function rollPencil2(pencils: Pencils): P2Face { return weightedChoice(pencils.p2); }

/* ---------- 走者の動き ---------- */

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

export interface ContactContext {
  /** この打席の前のアウト数 */
  outs: number;
  /** 打者の実質走力（監督効果込み） */
  speed?: number;
  /** 併殺の起きにくさ（監督） */
  gidpResist?: number;
}

/** 打球結果から走者の動き・アウト・得点を決める（塁に置くのは常に batter 本体） */
export function resolveContact(result: Outcome, batter: Player, bases: Bases, ctx: ContactContext): ContactResult {
  const orig = bases;
  const nb = emptyBases();
  const scored: Player[] = [];
  const R = TUNING.running;
  const twoOuts = ctx.outs >= 2;
  const batterSpeed = frac(ctx.speed ?? batter.speed);
  const rs = (p: Player) => frac(p.speed);
  let outsAdded = 0, desc = '', isSacFly = false, isGidp = false;

  const scoreAllRunners = () => {
    if (orig.third) scored.push(orig.third);
    if (orig.second) scored.push(orig.second);
    if (orig.first) scored.push(orig.first);
  };

  switch (result) {
    case 'hit': {
      if (orig.third) scored.push(orig.third);
      if (orig.second) {
        const p = R.singleScoreFrom2nd.base + R.singleScoreFrom2nd.speed * rs(orig.second) + (twoOuts ? R.singleScoreFrom2nd.twoOutBonus : 0);
        if (Math.random() < p) scored.push(orig.second);
        else nb.third = orig.second;
      }
      if (orig.first) {
        const p = R.single1stTo3rd.base + R.single1stTo3rd.speed * rs(orig.first) + (twoOuts ? R.single1stTo3rd.twoOutBonus : 0);
        if (!nb.third && Math.random() < p) nb.third = orig.first;
        else nb.second = orig.first;
      }
      nb.first = batter;
      desc = `${batter.name}、単打で出塁！`;
      break;
    }
    case 'double':
      if (orig.third) scored.push(orig.third);
      if (orig.second) scored.push(orig.second);
      if (orig.first) {
        const p = R.doubleScoreFrom1st.base + R.doubleScoreFrom1st.speed * rs(orig.first) + (twoOuts ? R.doubleScoreFrom1st.twoOutBonus : 0);
        if (Math.random() < p) scored.push(orig.first);
        else nb.third = orig.first;
      }
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
      nb.first = orig.first; nb.second = orig.second; nb.third = orig.third;
      if (!twoOuts && orig.third && Math.random() < R.sacFly) {
        scored.push(orig.third); nb.third = null; isSacFly = true;
        desc = `${batter.name}、犠牲フライ。三塁走者タッチアップ。`;
      } else {
        desc = `${batter.name}、外野フライアウト。`;
      }
      if (!twoOuts && orig.second && !nb.third && Math.random() < R.flyTag2ndTo3rd.base + R.flyTag2ndTo3rd.speed * rs(orig.second)) {
        nb.third = orig.second; nb.second = null;
      }
      break;
    case 'groundout':
      if (orig.first && !twoOuts) {
        // 走者一塁：併殺か、一塁走者が二塁で封殺（打者は一塁に残る）
        const D = TUNING.doublePlay;
        let dpChance = D.base + D.speed * batterSpeed - (ctx.gidpResist || 0);
        if (batter.ability === 'steady') dpChance *= D.steadyMult;
        dpChance = Math.max(D.min, dpChance);
        // 一塁より先の走者は押し出しで進む
        nb.third = orig.third;
        if (orig.second) { nb.third = orig.second; if (orig.third) scored.push(orig.third); }
        if (Math.random() < dpChance) {
          outsAdded = 2; isGidp = true;
          desc = `${batter.name}、ゲッツー！`;
        } else {
          outsAdded = 1; nb.first = batter;
          desc = `${batter.name}、ゴロ…併殺崩れ！一塁生きる。`;
        }
      } else if (orig.first) {
        // 2アウト：一塁で打者アウト（チェンジ）
        outsAdded = 1;
        nb.first = orig.first; nb.second = orig.second; nb.third = orig.third;
        desc = `${batter.name}、内野ゴロアウト。`;
      } else {
        // 一塁が空いている：打者アウト。2アウト未満なら走者が進むことも
        outsAdded = 1;
        nb.second = orig.second; nb.third = orig.third;
        if (!twoOuts && orig.third && Math.random() < R.groundScoreFrom3rd.base + R.groundScoreFrom3rd.speed * rs(orig.third)) {
          scored.push(orig.third); nb.third = null;
        }
        if (!twoOuts && orig.second && !nb.third && Math.random() < R.groundAdvance2ndTo3rd) {
          nb.third = orig.second; nb.second = null;
        }
        desc = `${batter.name}、内野ゴロアウト。`;
      }
      break;
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

/* ---------- 打席結果の確定 ---------- */

const OUT_RESULTS: Outcome[] = ['flyout', 'groundout', 'k'];

/** 鉛筆の出目に、走力・特殊能力・失策を反映して打席結果を確定する */
export function finalizeAtBat(batter: Player, p1: P1Face, p2: P2Face | null, bases: Bases, game: Game | null): Play {
  const usedPencil2 = p1 === 'otto';
  let result: Outcome = p1 === 'otto' ? p2! : p1;
  let abilityNote: string | null = null;
  let abilityKey: AbilityKey | null = null; // どの"名前つき特殊能力"が結果を覆したか（演出用）
  const eff = effectiveBatter(batter, game);

  let gidpResist = 0, errorMult = 1;
  let isFirstPaThisGame = false, isTrailing = false, isLuckySeven = false, isLateInning = false, isInningLeadoff = false;
  if (game) {
    const battingKey = currentBattingKey(game);
    const fieldingKey = fieldingKeyOf(game);
    gidpResist = managerEffects(game[battingKey].manager).gidpResist || 0;
    errorMult = managerEffects(game[fieldingKey].manager).errorReduction || 1;
    // 守備力：野手陣の平均守備力が高いほど失策が起きにくい（最低で1.5倍、最高で0.6倍）
    const roster = game[fieldingKey].battingOrder;
    if (roster.length) errorMult *= 1.5 - frac(roster.reduce((s, p) => s + (p.defense || 128), 0) / roster.length) * 0.9;

    isFirstPaThisGame = !game.battedThisGame.has(batter.id);
    isTrailing = game.score[battingKey] < game.score[fieldingKey];
    isLuckySeven = game.inning === 7;
    isLateInning = game.inning >= 8;
    isInningLeadoff = game.outs === 0 && !bases.first && !bases.second && !bases.third;
  }
  const isRISP = !!(bases.second || bases.third);
  const isBasesLoaded = !!(bases.first && bases.second && bases.third);
  const isOut = () => OUT_RESULTS.includes(result);
  const name = batter.name;

  // 凡打 → ヒット系（どれか1つだけ発動）
  if (batter.ability === 'leadoff' && isFirstPaThisGame && isOut() && Math.random() < TUNING.abilityHit.leadoff) {
    result = 'hit'; abilityNote = `${name}、第一打席の勢いでヒットに！`; abilityKey = 'leadoff';
  }
  if (!abilityKey && batter.ability === 'comeback' && isTrailing && isOut() && Math.random() < TUNING.abilityHit.comeback) {
    result = 'hit'; abilityNote = `${name}、劣勢をはね返す一打！`; abilityKey = 'comeback';
  }
  if (!abilityKey && batter.ability === 'luckySeven' && isLuckySeven && isOut() && Math.random() < TUNING.abilityHit.luckySeven) {
    result = 'hit'; abilityNote = `${name}、ラッキーセブンで魅せる！`; abilityKey = 'luckySeven';
  }
  if (!abilityKey && batter.ability === 'inningStarter' && isInningLeadoff && isOut() && Math.random() < TUNING.abilityHit.inningStarter) {
    result = 'hit'; abilityNote = `${name}、先頭打者として出塁！`; abilityKey = 'inningStarter';
  }
  // 長打化
  if (batter.ability === 'clutch' && isRISP) {
    if (result === 'hit' && Math.random() < 0.30) { result = 'double'; abilityNote = `${name}、勝負強さを発揮！二塁打に`; abilityKey = 'clutch'; }
    else if (result === 'double' && Math.random() < 0.30) { result = 'hr'; abilityNote = `${name}、勝負強さを発揮！本塁打に`; abilityKey = 'clutch'; }
  }
  if (batter.ability === 'basesLoadedHero' && isBasesLoaded) {
    if (result === 'hit' && Math.random() < 0.35) { result = 'double'; abilityNote = `${name}、満塁男の本領発揮！二塁打に`; abilityKey = 'basesLoadedHero'; }
    else if (result === 'double' && Math.random() < 0.35) { result = 'hr'; abilityNote = `${name}、満塁男の本領発揮！満塁本塁打だ！`; abilityKey = 'basesLoadedHero'; }
  }
  if (!abilityKey && batter.ability === 'lateInningPower' && isLateInning && isTrailing) {
    if (result === 'hit' && Math.random() < 0.30) { result = 'double'; abilityNote = `${name}、終盤の反撃！二塁打に`; abilityKey = 'lateInningPower'; }
    else if (result === 'double' && Math.random() < 0.30) { result = 'hr'; abilityNote = `${name}、終盤に起死回生の一発！`; abilityKey = 'lateInningPower'; }
  }
  if (batter.ability === 'bigSwing' && result === 'double' && Math.random() < 0.22) {
    result = 'hr'; abilityNote = `${name}のフルスイングでスタンドへ`; abilityKey = 'bigSwing';
  }
  // 三振を防ぐ
  if (!abilityKey && batter.ability === 'goodEye' && result === 'k' && Math.random() < 0.30) {
    result = 'walk'; abilityNote = `${name}、際どい球を見極めて四球`; abilityKey = 'goodEye';
  }
  if (!abilityKey && batter.ability === 'steady' && result === 'k' && Math.random() < 0.12) {
    result = 'groundout'; abilityNote = `${name}、堅実なバットコントロールでゴロに`; abilityKey = 'steady';
  }

  // 走力：単打→二塁打／二塁打→三塁打（三塁打はここでのみ発生）
  const S = TUNING.stretch;
  const sp = frac(eff.speed);
  if (result === 'hit') {
    if (Math.random() < Math.max(0, sp - S.singleMinSpeed) * S.singleToDouble) { result = 'double'; abilityNote ??= `${name}、俊足を飛ばして二塁打に`; }
  } else if (result === 'double') {
    if (Math.random() < sp * S.doubleToTriple) { result = 'triple'; abilityNote ??= `${name}、俊足で三塁打を陥れる！`; }
  }

  // 失策：ゴロ・フライのアウトが、まれに相手の失策で出塁に変わる（守備力の低い野手ほどやらかしやすい）
  let errorFielder: Player | null = null;
  if ((result === 'groundout' || result === 'flyout') && Math.random() < TUNING.errorRate * errorMult) {
    const fielders = game ? game.lineup[fieldingKeyOf(game)].map((id) => game[fieldingKeyOf(game)].roster.find((p) => p.id === id)).filter((p): p is Player => !!p) : [];
    errorFielder = fielders.length ? pickWeightedFielderForError(fielders) : null;
    if (errorFielder?.ability === 'defenseAce' && Math.random() < 0.5) {
      // 守備の達人：自分の失策を好プレーで防ぐ
      abilityNote = `${errorFielder.name}の好守備！失策を防いだ`; abilityKey = 'defenseAce';
      errorFielder = null;
    } else {
      result = 'error';
    }
  }

  if (game) game.battedThisGame.add(batter.id);
  const play = resolveContact(result, batter, bases, { outs: game ? game.outs : 0, speed: eff.speed, gidpResist });
  return { ...play, errorFielder, p1, p2, usedPencil2, abilityNote, abilityKey, batter, rawResult: result };
}

export function resolveAtBat(batter: Player, bases: Bases, game: Game | null): Play {
  const pencils = pencilsFor(batter, game);
  const p1 = rollPencil1(pencils);
  const p2 = p1 === 'otto' ? rollPencil2(pencils) : null;
  return finalizeAtBat(batter, p1, p2, bases, game);
}

/** 画面表示用：打者の鉛筆の要約（%） */
export function pencilSummary(pencils: Pencils): { label: string; key: string; pct: number }[][] {
  const pct = (v: number) => Math.round(v * 1000) / 10;
  return [
    [
      { key: 'hit', label: 'ヒット', pct: pct(pencils.p1.hit) },
      { key: 'walk', label: '四球', pct: pct(pencils.p1.walk) },
      { key: 'otto', label: 'おっと', pct: pct(pencils.p1.otto) },
      { key: 'k', label: '三振', pct: pct(pencils.p1.k) },
      { key: 'out', label: '凡打', pct: pct(pencils.p1.flyout + pencils.p1.groundout) },
    ],
    [
      { key: 'hr', label: 'HR', pct: pct(pencils.p2.hr) },
      { key: 'double', label: '2ベース', pct: pct(pencils.p2.double) },
      { key: 'k', label: '三振', pct: pct(pencils.p2.k) },
      { key: 'out', label: '凡打', pct: pct(pencils.p2.flyout + pencils.p2.groundout) },
    ],
  ];
}
