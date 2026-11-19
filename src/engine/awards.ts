/* シーズンの表彰・タイトル（呼ぶと選手の受賞回数も加算される） */
import { LEAGUE_CODES, POSITIONS } from './data';
import { DB } from './state';
import { avgOf, avgOfStats, isQualified, opsOf, opsOfStats } from './stats';
import type { AwardSummary, LeaderEntry, Player, PositionAward, Team } from './types';

type Entry = { p: Player; t: Team };
const LEAGUES = [['H', LEAGUE_CODES[0]], ['B', LEAGUE_CODES[1]]] as const;

function allEntries(filter: (p: Player, t: Team) => boolean = () => true, leagueCode?: string): Entry[] {
  const all: Entry[] = [];
  DB.teams
    .filter((t) => leagueCode === undefined || t.league === leagueCode)
    .forEach((t) => t.roster.forEach((p) => { if (filter(p, t)) all.push({ p, t }); }));
  return all;
}
function summary(x: Entry): AwardSummary {
  return { name: x.p.name, team: x.t.name, ops: opsOf(x.p), avg: avgOf(x.p), hr: x.p.stats.hr, rbi: x.p.stats.rbi };
}
const byOpsDesc = (a: Entry, b: Entry) => opsOf(b.p) - opsOf(a.p);

export function computeSeasonLeaders(): { avg: LeaderEntry[]; hr: LeaderEntry[]; rbi: LeaderEntry[] } {
  const all = allEntries();
  const qualified = all.filter((x) => isQualified(x.p, x.t));
  const top3 = (list: Entry[], calc: (p: Player) => number) =>
    list.slice().sort((a, b) => calc(b.p) - calc(a.p)).slice(0, 3).map((x) => ({ name: x.p.name, team: x.t.name, value: calc(x.p) }));
  return {
    avg: top3(qualified, (p) => avgOf(p)),
    hr: top3(all, (p) => p.stats.hr),
    rbi: top3(all, (p) => p.stats.rbi),
  };
}

/** シーズンMVP：リーグごとに、規定打席以上でOPS最高の選手 */
export function computeSeasonMVP(): { H: AwardSummary | null; B: AwardSummary | null } {
  const result: { H: AwardSummary | null; B: AwardSummary | null } = { H: null, B: null };
  LEAGUES.forEach(([outKey, code]) => {
    const all = allEntries((p, t) => isQualified(p, t), code);
    if (!all.length) return;
    const best = all.slice().sort(byOpsDesc)[0];
    best.p.awards.mvp++;
    result[outKey] = summary(best);
  });
  return result;
}

/** ポストシーズンMVP：日本一チームから、ポストシーズンOPS最高の選手 */
export function computePostseasonMVP(): AwardSummary | null {
  const champTeam = DB.postseason?.champion;
  if (!champTeam) return null;
  const candidates = champTeam.roster.filter((p) => p.psStats && p.psStats.ab >= 3);
  if (!candidates.length) return null;
  const best = candidates.slice().sort((a, b) => opsOfStats(b.psStats) - opsOfStats(a.psStats))[0];
  best.awards.psMvp++;
  return { name: best.name, team: champTeam.name, ops: opsOfStats(best.psStats), avg: avgOfStats(best.psStats), hr: best.psStats.hr, rbi: best.psStats.rbi };
}

/** ベストナイン：リーグ・守備位置ごとに最高OPSの選手（規定打席以上） */
export function computeBestNine(): { H: PositionAward[]; B: PositionAward[] } {
  const result: { H: PositionAward[]; B: PositionAward[] } = { H: [], B: [] };
  LEAGUES.forEach(([outKey, code]) => {
    POSITIONS.forEach((pos) => {
      const candidates = allEntries((p, t) => p.pos === pos && isQualified(p, t), code);
      if (!candidates.length) return;
      const best = candidates.slice().sort(byOpsDesc)[0];
      best.p.awards.bestNine++;
      result[outKey].push({ pos, name: best.p.name, team: best.t.name, ops: opsOf(best.p), avg: avgOf(best.p), hr: best.p.stats.hr });
    });
  });
  return result;
}

/** 新人王：今シーズンが初年度の選手から、リーグごとにOPS最高の選手（創設1年目は全員が初年度なので該当なし） */
export function computeRookieOfYear(): { H: AwardSummary | null; B: AwardSummary | null } {
  const result: { H: AwardSummary | null; B: AwardSummary | null } = { H: null, B: null };
  if (DB.currentSeasonNum <= 1) return result;
  LEAGUES.forEach(([outKey, code]) => {
    const all = allEntries((p, t) => (p.seasonsPlayed || 0) === 0 && isQualified(p, t), code);
    if (!all.length) return;
    const best = all.slice().sort(byOpsDesc)[0];
    best.p.awards.rookie++;
    result[outKey] = summary(best);
  });
  return result;
}

/** ゴールデングラブ賞：リーグ・守備位置ごとに失策が最も少ない選手（同数ならOPS） */
export function computeGoldenGlove(): { H: PositionAward[]; B: PositionAward[] } {
  const result: { H: PositionAward[]; B: PositionAward[] } = { H: [], B: [] };
  LEAGUES.forEach(([outKey, code]) => {
    POSITIONS.forEach((pos) => {
      const candidates = allEntries((p, t) => p.pos === pos && isQualified(p, t), code);
      if (!candidates.length) return;
      const best = candidates.slice().sort((a, b) => (a.p.stats.errors - b.p.stats.errors) || byOpsDesc(a, b))[0];
      best.p.awards.goldenGlove++;
      result[outKey].push({ pos, name: best.p.name, team: best.t.name, errors: best.p.stats.errors });
    });
  });
  return result;
}
