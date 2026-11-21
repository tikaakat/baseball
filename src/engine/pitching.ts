/*
 * 投手：先発の選び方・疲労・継投（AI）・勝敗とセーブの記録。
 * 投手は「打者の鉛筆を書き換える」存在（atbat.ts の pencilsFor で反映）。
 */
import { TUNING } from './data';
import { DB } from './state';
import type { Game, Player, Side, Team } from './types';
import { frac } from './util';

/** 監督の采配タイプから、継投の方針を決める（先発をどこまで引っ張るか） */
export interface PitchingStyle { key: 'complete' | 'standard' | 'bullpen'; label: string; desc: string; starterPullAdj: number }
export const PITCHING_STYLES: Record<PitchingStyle['key'], PitchingStyle> = {
  complete: { key: 'complete', label: '先発完投型', desc: '先発を長く引っ張る。完投が増えるが、終盤に捕まることも', starterPullAdj: 3 },
  standard: { key: 'standard', label: '標準', desc: '先発が疲れたら中継ぎへ。8回セットアッパー、9回抑え', starterPullAdj: 0 },
  bullpen: { key: 'bullpen', label: '継投重視', desc: '先発を早めに降ろし、リリーフ陣でつなぐ', starterPullAdj: -3 },
};
export function pitchingStyleFor(managerType: string | undefined): PitchingStyle {
  if (managerType === 'oldschool' || managerType === 'star' || managerType === 'power') return PITCHING_STYLES.complete;
  if (managerType === 'defense' || managerType === 'realistic' || managerType === 'patient') return PITCHING_STYLES.bullpen;
  return PITCHING_STYLES.standard;
}


export const otherSide = (s: Side): Side => (s === 'home' ? 'away' : 'home');
/** 守っている側 */
export const fieldingSide = (game: Game): Side => (game.half === 'top' ? 'home' : 'away');

export function findPlayer(team: Team, id: string | null | undefined): Player | undefined {
  if (!id) return undefined;
  return team.roster.find((p) => p.id === id) ?? team.pitchers.find((p) => p.id === id);
}

export function currentPitcher(game: Game, side: Side = fieldingSide(game)): Player | undefined {
  return findPlayer(game[side], game.pitcher[side]);
}

/** 連投管理用の通し日付（シーズン×1000＋日。ポストシーズンは150日目以降） */
export function dayKeyFor(scheduleId: string | null): number {
  const season = DB.currentSeasonNum || 1;
  if (scheduleId) {
    const g = DB.schedule.find((x) => x.id === scheduleId);
    if (g) return season * 1000 + g.day;
  }
  const psGames = DB.postseason
    ? Object.values(DB.postseason.series).reduce((n, s) => n + (s ? s.games.length : 0), 0)
    : 0;
  return season * 1000 + 150 + psGames;
}

/** 疲れずに投げられる打者数 */
export function capacityOf(p: Player, asStarter: boolean): number {
  const S = TUNING.stamina;
  const st = frac(p.pitch?.stamina ?? 128);
  return asStarter ? S.starterBase + S.starterRange * st : S.relieverBase + S.relieverRange * st;
}

const isStarterInGame = (game: Game, side: Side, id: string) => game.pitchersUsed[side][0] === id;

/** 疲労（0〜1）。疲れずに投げられる打者数を超えると、少しずつたまる */
export function fatigueOf(game: Game, side: Side): number {
  const p = currentPitcher(game, side);
  if (!p) return 0;
  const box = game.pbox[p.id];
  if (!box) return 0;
  const cap = capacityOf(p, isStarterInGame(game, side, p.id));
  return Math.max(0, Math.min(1, (box.bf - cap) / TUNING.stamina.fatigueSpan));
}

/** 登板させる（試合と成績に記録） */
export function enterPitcher(game: Game, side: Side, p: Player, asStarter: boolean): void {
  game.pitcher[side] = p.id;
  game.pitchersUsed[side].push(p.id);
  const lead = game.score[side] - game.score[otherSide(side)];
  game.pbox[p.id] = { outs: 0, bf: 0, h: 0, hr: 0, bb: 0, k: 0, r: 0, dec: null, entryLead: lead };
  const line = game.seriesKey ? p.psPStats : p.pStats;
  line.g++;
  if (asStarter) line.gs++;
  p.recentDays = [...(p.recentDays ?? []).filter((d) => d > game.dayKey - 5), game.dayKey];
}

/** 先発投手：ローテーションの順番どおり（試合を作るたびに次の投手へ） */
export function pickStarter(team: Team): Player {
  const rot = team.staff.rotation.map((id) => findPlayer(team, id)).filter((p): p is Player => !!p);
  const list = rot.length ? rot : team.pitchers;
  const p = list[(team.rotationIdx || 0) % list.length];
  team.rotationIdx = ((team.rotationIdx || 0) + 1) % list.length;
  return p;
}

/** 救援として使えるか（この試合で未登板、3連投にならず、直近4日で3登板していない。抑え・セットアッパーは連投を控えめに） */
export function isRelieverAvailable(game: Game, side: Side, p: Player): boolean {
  if (game.pitchersUsed[side].includes(p.id)) return false;
  if (game[side].staff.rotation.includes(p.id)) return false;
  const days = p.recentDays ?? [];
  // 3連投はしない。直近4日で3試合投げていたら休ませる（現実のブルペン運用に近づける）
  if (days.includes(game.dayKey - 1) && days.includes(game.dayKey - 2)) return false;
  const last4 = days.filter((d) => d >= game.dayKey - 4 && d < game.dayKey).length;
  if (last4 >= 3) return false;
  // 抑え・セットアッパーは、前日に投げていたら4割ほどの日は休ませる（その日は他の投手が9回を任される）
  const isKey = p.id === game[side].staff.closer || p.id === game[side].staff.setup;
  if (isKey && days.includes(game.dayKey - 1) && dailyCoin(p.id, game.dayKey) < 0.4) return false;
  return true;
}

/** 選手と日付から決まる 0〜1 の値（同じ日の判断がぶれないように乱数ではなく決め打ち） */
function dailyCoin(id: string, day: number): number {
  let h = day * 2654435761;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2246822519);
  return ((h >>> 0) % 1000) / 1000;
}

export function availableRelievers(game: Game, side: Side): Player[] {
  return game[side].pitchers.filter((p) => isRelieverAvailable(game, side, p));
}

/**
 * AIの継投判断（打席の前に呼ぶ）。交代するなら新しい投手を返す。
 * - 先発：疲れたら（疲れずに投げられる打者数＋数人）、または大量失点で降板
 * - 9回にリード1〜3点（後攻なら同点も）で抑え、8回にリード1〜3点か同点でセットアッパー
 * - 救援が疲れたら次の救援へ。接戦の中継ぎは1イニングで交代
 */
export function aiPitchingChoice(game: Game): Player | null {
  const side = fieldingSide(game);
  const team = game[side];
  const cur = currentPitcher(game, side);
  if (!cur) return null;
  const box = game.pbox[cur.id];
  const asStarter = isStarterInGame(game, side, cur.id);
  const cap = capacityOf(cur, asStarter);
  const lead = game.score[side] - game.score[otherSide(side)];
  const inningStart = game.outs === 0 && !game.bases.first && !game.bases.second && !game.bases.third;
  const avail = availableRelievers(game, side);
  const closer = avail.find((p) => p.id === team.staff.closer);
  const setup = avail.find((p) => p.id === team.staff.setup);
  const saveSituation = lead >= 1 && lead <= 3;

  // 抑え：9回以降のセーブ機会。後攻チームは同点の9回以降も（サヨナラ負けを防ぐ）
  const tieAtHome = lead === 0 && side === 'home';
  if (inningStart && game.inning >= 9 && (saveSituation || tieAtHome) && closer && cur.id !== team.staff.closer) return closer;
  // セットアッパー：8回にリード1〜3点か同点
  if (inningStart && game.inning === 8 && (saveSituation || lead === 0) && setup && cur.id !== team.staff.setup && cur.id !== team.staff.closer && (!asStarter || box.bf >= cap - 4)) return setup;

  const pull = asStarter ? pitchingStyleFor(team.manager?.type).starterPullAdj : 0; // 監督の継投方針
  const tired = asStarter
    ? box.bf >= cap + 3 + pull || (box.bf >= cap + pull && (game.bases.second || game.bases.third)) || box.r >= 5
    : box.bf >= cap + 2 || box.r >= 4;
  // 接戦の中継ぎは1イニングずつ（大差なら長いイニングを任せる）
  const oneInningDone = !asStarter && inningStart && box.outs >= 3 && Math.abs(lead) <= 4;
  if (!tired && !oneInningDone) return null;
  // 中継ぎ（抑え・セットアッパーは温存）から、質の高い順に
  const middle = avail.filter((p) => p.id !== team.staff.closer && p.id !== team.staff.setup);
  const pool = middle.length ? middle : tired ? avail : [];
  if (!pool.length) return null;
  // 前日も投げた投手・最近よく投げている投手はなるべく避ける（登板を分散）
  const recent = (p: Player) => (p.recentDays ?? []).filter((d) => d >= game.dayKey - 5 && d < game.dayKey).length;
  const rest = (p: Player) => ((p.recentDays ?? []).includes(game.dayKey - 1) ? 80 : 0) + recent(p) * 25;
  // 接戦は良い投手から、大差（5点以上）は格下の投手に任せる
  const blowout = Math.abs(lead) >= 5;
  const score = (p: Player) => (blowout ? -quality(p) : quality(p)) - rest(p);
  return pool.slice().sort((a, b) => score(b) - score(a))[0];
}
const quality = (p: Player) => (p.pitch ? p.pitch.stuff * 0.5 + p.pitch.control * 0.4 + p.pitch.stamina * 0.1 : 0);

/** 得点でリードが入れ替わったら、勝利・敗戦投手の候補を更新する */
export function trackLeadChange(game: Game, battingSide: Side, scoreBefore: Record<Side, number>): void {
  const fSide = otherSide(battingSide);
  const before = scoreBefore[battingSide] - scoreBefore[fSide];
  const after = game.score[battingSide] - game.score[fSide];
  if (before <= 0 && after > 0) {
    game.winCand = game.pitcher[battingSide];
    game.loseCand = game.pitcher[fSide];
  } else if (after <= 0 && before > 0) {
    // （このゲームでは攻撃側が得点したときだけ呼ぶので起きないが念のため）
    game.winCand = null; game.loseCand = null;
  } else if (before < 0 && after === 0) {
    game.winCand = null; game.loseCand = null; // 同点に追いついた
  }
}

/** 試合終了時：勝利・敗戦・セーブを決めて記録する */
export function assignDecisions(game: Game): void {
  if (game.winner === 'tie' || !game.winner) return;
  const wSide = game.winner, lSide = otherSide(wSide);
  const statOf = (p: Player) => (game.seriesKey ? p.psPStats : p.pStats);

  let winId = game.winCand;
  const used = game.pitchersUsed[wSide];
  // 先発は5回（15アウト）を投げないと勝利投手になれない → 最も長く投げた救援投手へ
  if (winId && winId === used[0] && (game.pbox[winId]?.outs ?? 0) < 15 && used.length > 1) {
    winId = used.slice(1).sort((a, b) => (game.pbox[b].outs - game.pbox[a].outs))[0];
  }
  const w = findPlayer(game[wSide], winId), l = findPlayer(game[lSide], game.loseCand);
  if (w) { statOf(w).w++; game.pbox[w.id].dec = 'W'; }
  if (l) { statOf(l).l++; game.pbox[l.id].dec = 'L'; }

  // セーブ：最後に投げた投手が勝利投手でなく、リード3点以内で登板して1回以上、または3回以上投げた
  const lastId = used[used.length - 1];
  const last = findPlayer(game[wSide], lastId);
  if (last && lastId !== w?.id && used.length > 1) {
    const b = game.pbox[lastId];
    const entry = b.entryLead ?? 99;
    if ((entry >= 1 && entry <= 3 && b.outs >= 3) || b.outs >= 9) { statOf(last).sv++; b.dec = 'S'; }
  }
}
