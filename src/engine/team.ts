/* チーム編成：ロースター・打順・監督・ガチャ・引退 */
import { ABILITY_AFFINITY, BATTING_SLOT_PRIORITY, MANAGER_TYPES, POSITIONS, RETIREMENT_AGE, TEAM_DEFS } from './data';
import { createPlayer, performanceScore, pickPlayerIdentity, pickUniformNumber, retirePlayer } from './player';
import { DB } from './state';
import type { GachaResult, Player, Team } from './types';
import { choice, pickWeightedOrNone, randInt } from './util';

/** 能力に応じて守備位置を割り振る（指名打者制のため投手は打席に立たない） */
export function createRoster(): Player[] {
  const used: string[] = [];
  let pool: Player[] = [];
  const usedNumbers: number[] = [];
  for (let i = 0; i < 9; i++) {
    const identity = pickPlayerIdentity(used);
    used.push(identity.surname);
    const p = createPlayer(null, identity);
    p.number = pickUniformNumber(usedNumbers);
    usedNumbers.push(p.number);
    pool.push(p);
  }
  function takeTop(n: number, scoreFn: (p: Player) => number): Player[] {
    pool = pool.slice().sort((a, b) => scoreFn(b) - scoreFn(a));
    const picked = pool.slice(0, n);
    pool = pool.slice(n);
    return picked;
  }
  const speedGroup = takeTop(3, (p) => p.speed * 1.2 + p.contact);
  const powerGroup = takeTop(3, (p) => p.power);
  const restGroup = pool;
  const assign = (players: Player[], positions: string[]) => players.forEach((p, i) => { p.pos = positions[i]; });
  assign(speedGroup, ['遊', '中', '二']);
  assign(powerGroup, ['一', '左', '捕']);
  assign(restGroup, ['三', '右', '指']);
  return [...speedGroup, ...powerGroup, ...restGroup].sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos));
}

/** 打順が決まった後に、打順のタイプに合った特殊能力を割り振る */
export function assignAbilitiesByBattingOrder(battingOrder: Player[]): void {
  battingOrder.forEach((p, slot) => { p.ability = pickWeightedOrNone(ABILITY_AFFINITY[slot] || {}); });
}

/** 打順を能力から機械的に組む */
export function buildBattingOrder(roster: Player[]): Player[] {
  let pool = roster.slice();
  const order: Player[] = [];
  function takeBest(scoreFn: (p: Player) => number): Player {
    pool = pool.slice().sort((a, b) => scoreFn(b) - scoreFn(a));
    const p = pool[0];
    pool = pool.slice(1);
    return p;
  }
  order.push(takeBest((p) => p.speed * 2 + p.contact));   // 1番：俊足巧打
  order.push(takeBest((p) => p.contact * 2 + p.speed));   // 2番：つなぎ役
  order.push(takeBest((p) => p.contact + p.power));       // 3番：総合力
  order.push(takeBest((p) => p.power * 2 + p.contact));   // 4番：最強のパワーヒッター
  order.push(takeBest((p) => p.power * 1.5 + p.contact)); // 5番：もう一人の長距離砲
  for (let i = 0; i < 4; i++) order.push(takeBest((p) => p.contact + p.power + p.speed));
  assignAbilitiesByBattingOrder(order);
  return order;
}

export function hireNewManager(team: Team): void {
  const type = choice(MANAGER_TYPES);
  team.manager = {
    type: type.key, label: type.label, desc: type.desc,
    hireSeason: DB.currentSeasonNum || 1, tenureYears: randInt(3, 30),
    wins: 0, losses: 0, ties: 0, careerGames: 0,
  };
}

export function createTeams(): Team[] {
  return TEAM_DEFS.map((def, idx) => {
    const roster = createRoster();
    const team: Team = {
      id: 't' + idx, name: def.name, league: def.league, tagline: def.tagline,
      roster, battingOrder: buildBattingOrder(roster),
      wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0,
      consecutiveBClass: 0, manager: null, managerHistory: [],
    };
    hireNewManager(team);
    return team;
  });
}

/** シーズン成績（実績が無ければ基礎能力）に応じて打順を組み直す。能力は選手に固定のまま */
export function reorderBattingOrderByPerformance(t: Team): void {
  const ranked = t.roster.slice().sort((a, b) => performanceScore(b) - performanceScore(a));
  const newOrder = new Array<Player>(9);
  ranked.forEach((p, i) => { newOrder[BATTING_SLOT_PRIORITY[i] - 1] = p; });
  t.battingOrder = newOrder;
}

export function worstPerformer(t: Team): Player {
  // ガチャで加入して2年未満の選手は、放出候補となる選手が2人以上いる限り保護する
  const eligible = t.roster.filter((p) => !(p.gachaImmunitySeasons > 0));
  const pool = eligible.length >= 2 ? eligible : t.roster;
  return pool.slice().sort((a, b) => performanceScore(a) - performanceScore(b))[0];
}

/** 他球団のガチャ判断：若手は温存されやすく、高齢かつ不振の選手は放出されやすい */
export function shouldReleasePlayer(p: Player): boolean {
  const perf = performanceScore(p);
  let chance = 0.45;
  if (p.age >= 34) chance += 0.35;
  else if (p.age >= 30) chance += 0.15;
  else if (p.age <= 22) chance -= 0.35;
  else if (p.age <= 25) chance -= 0.15;
  if (perf < 0.45) chance += 0.2;
  else if (perf > 0.8) chance -= 0.3;
  chance = Math.max(0.05, Math.min(0.95, chance));
  return Math.random() < chance;
}

/** ロースターの idx 番目を新人に入れ替える（打順・能力も引き継ぐ） */
function replaceWithRookie(t: Team, idx: number): { outgoing: Player; incoming: Player; boIdx: number } {
  const outgoing = t.roster[idx];
  retirePlayer(t, outgoing);
  const otherNames = t.roster.filter((_, i) => i !== idx).map((p) => p.name);
  const identity = pickPlayerIdentity(otherNames);
  const incoming = createPlayer(outgoing.pos, identity, true, (DB.currentSeasonNum || 1) + 1);
  incoming.number = pickUniformNumber(t.roster.filter((_, i) => i !== idx).map((p) => p.number));
  t.roster[idx] = incoming;
  const boIdx = t.battingOrder.indexOf(outgoing);
  if (boIdx >= 0) {
    t.battingOrder[boIdx] = incoming;
    incoming.ability = pickWeightedOrNone(ABILITY_AFFINITY[boIdx] || {});
  }
  return { outgoing, incoming, boIdx };
}

/**
 * オフシーズン補強ガチャ：全12球団、それぞれ1名だけを新人に入れ替える。
 * mySelectedPlayerId: 選手ID／'__skip__'なら自チームは放出しない／null なら全球団を自動判定
 */
export function gachaSwapAllTeams(myTeamId: string | null, mySelectedPlayerId: string | null): GachaResult[] {
  const results: GachaResult[] = [];
  DB.teams.forEach((t) => {
    const isMine = t.id === myTeamId;
    let idx = -1, skip = false;

    if (isMine && mySelectedPlayerId === '__skip__') {
      skip = true;
    } else if (isMine && mySelectedPlayerId) {
      idx = t.roster.findIndex((p) => p.id === mySelectedPlayerId);
    } else if (isMine) {
      idx = t.roster.findIndex((p) => p.id === worstPerformer(t).id);
    } else {
      const candidate = worstPerformer(t);
      if (shouldReleasePlayer(candidate)) idx = t.roster.findIndex((p) => p.id === candidate.id);
      else skip = true;
    }

    if (skip || idx < 0) {
      results.push({ team: t, out: null, in: null, slot: null, skipped: true });
      return;
    }
    const { outgoing, incoming, boIdx } = replaceWithRookie(t, idx);
    results.push({ team: t, out: outgoing, in: incoming, slot: boIdx >= 0 ? boIdx + 1 : null, skipped: false });
  });
  DB.gachaDoneThisCycle = true;
  return results;
}

/** 45歳を超えた選手を強制引退させ、若手に入れ替える */
export function forceRetireOldPlayers(t: Team): { team: Team; out: Player; in: Player }[] {
  const retiredList: { team: Team; out: Player; in: Player }[] = [];
  t.roster.forEach((p, idx) => {
    if (p.age > RETIREMENT_AGE) {
      const { incoming } = replaceWithRookie(t, idx);
      retiredList.push({ team: t, out: p, in: incoming });
    }
  });
  return retiredList;
}
