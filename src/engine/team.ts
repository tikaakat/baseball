/* チーム編成：ロースター・投手陣・打順・監督・ガチャ・引退 */
import { ABILITY_AFFINITY, BENCH_POSITIONS, MANAGER_TYPES, POSITIONS, RETIREMENT, STAFF_SIZE, TEAM_DEFS } from './data';
import { createPitcher, createPlayer, overallOf, performanceScore, pickPlayerIdentity, pickUniformNumber, pitcherQuality, retirePlayer } from './player';
import { orderByStyle, styleForManager } from './lineup';
import { onPlayerRetired } from './news';
import { DB } from './state';
import { emptyPitchLine } from './stats';
import type { GachaResult, Manager, ManagerEffects, Player, Team } from './types';
import { choice, pickWeightedOrNone, randInt } from './util';

/** 野手の打力のおおまかな評価（スタメン選びなど） */
const battingValue = (p: Player) => p.power + p.contact + p.speed * 0.5;

/** 野手13人：打力上位9人がスタメン（能力に応じて守備位置を割り振る）、残り4人が控え */
export function createRoster(usedNames: string[] = [], usedNumbers: number[] = []): Player[] {
  let pool: Player[] = [];
  for (let i = 0; i < 9 + BENCH_POSITIONS.length; i++) {
    const identity = pickPlayerIdentity(usedNames);
    usedNames.push(identity.surname);
    const p = createPlayer(null, identity);
    p.number = pickUniformNumber(usedNumbers);
    usedNumbers.push(p.number);
    pool.push(p);
  }
  pool.sort((a, b) => battingValue(b) - battingValue(a));
  const bench = pool.slice(9);
  pool = pool.slice(0, 9);
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
  assign(bench, BENCH_POSITIONS);
  const starters = [...speedGroup, ...powerGroup, ...restGroup].sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos));
  return [...starters, ...bench];
}

/** 投手10人（先発5・救援5） */
export function createPitchingStaff(usedNames: string[] = [], usedNumbers: number[] = []): Player[] {
  const staff: Player[] = [];
  for (let i = 0; i < STAFF_SIZE.rotation + STAFF_SIZE.bullpen; i++) {
    const identity = pickPlayerIdentity(usedNames);
    usedNames.push(identity.surname);
    const p = createPitcher(identity);
    p.number = pickUniformNumber(usedNumbers);
    usedNumbers.push(p.number);
    staff.push(p);
  }
  return staff;
}

/** 投手の役割を能力から決める：スタミナと質の高い5人が先発、残りの最良が抑え、次がセットアッパー */
export function assignStaffRoles(t: Team): void {
  const byStarter = t.pitchers.slice().sort((a, b) => (pitcherQuality(b) * 0.6 + b.pitch!.stamina * 0.4) - (pitcherQuality(a) * 0.6 + a.pitch!.stamina * 0.4));
  const rotation = byStarter.slice(0, STAFF_SIZE.rotation).sort((a, b) => pitcherQuality(b) - pitcherQuality(a));
  const pen = byStarter.slice(STAFF_SIZE.rotation).sort((a, b) => (b.pitch!.stuff * 0.6 + pitcherQuality(b) * 0.4) - (a.pitch!.stuff * 0.6 + pitcherQuality(a) * 0.4));
  t.staff = { rotation: rotation.map((p) => p.id), closer: pen[0]?.id ?? null, setup: pen[1]?.id ?? null };
}

/**
 * シーズン中の投手陣の見直し（AI）：打ち込まれている先発（40回以上で防御率5.00超）を、
 * 防御率の良い中継ぎと入れ替える。抑え・セットアッパーは動かさない
 */
export function reviewStaff(t: Team): string | null {
  const era = (p: Player) => (p.pStats.outs > 0 ? (p.pStats.r * 27) / p.pStats.outs : 99);
  const starters = t.staff.rotation.map((id) => t.pitchers.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const worst = starters.filter((p) => p.pStats.outs >= 120 && era(p) > 5.0).sort((a, b) => era(b) - era(a))[0];
  if (!worst || t.staffManual) return null;
  const candidates = t.pitchers.filter((p) => !t.staff.rotation.includes(p.id) && p.id !== t.staff.closer && p.id !== t.staff.setup);
  const best = candidates.sort((a, b) => (pitcherQuality(b) + b.pitch!.stamina * 0.3) - (pitcherQuality(a) + a.pitch!.stamina * 0.3))[0];
  if (!best || (best.pStats.outs >= 30 && era(best) >= era(worst))) return null;
  t.staff.rotation = t.staff.rotation.map((id) => (id === worst.id ? best.id : id));
  return `${t.name}：先発 ${worst.name} → ${best.name} に入れ替え`;
}

export function allPlayersOf(t: Team): Player[] {
  return [...t.roster, ...t.pitchers];
}

/**
 * 旧版の保存データのチームを今の形にそろえる（控え野手・投手陣を追加、成績欄を補う）。
 * 新規作成したチームには何もしない。
 */
export function upgradeTeam(t: Team): void {
  const usedNames = allPlayersOf(t).map((p) => p.name);
  const usedNumbers = allPlayersOf(t).map((p) => p.number ?? -1);
  allPlayersOf(t).forEach((p) => {
    p.pitch ??= null;
    p.pStats ??= emptyPitchLine();
    p.pCareer ??= emptyPitchLine();
    p.psPStats ??= emptyPitchLine();
  });
  if (t.roster.length < 9 + BENCH_POSITIONS.length) {
    BENCH_POSITIONS.slice(t.roster.length - 9).forEach((pos) => {
      const identity = pickPlayerIdentity(usedNames);
      usedNames.push(identity.surname);
      const p = createPlayer(pos, identity);
      p.number = pickUniformNumber(usedNumbers);
      usedNumbers.push(p.number);
      t.roster.push(p);
    });
  }
  if (!t.pitchers || t.pitchers.length === 0) {
    t.pitchers = createPitchingStaff(usedNames, usedNumbers);
    assignStaffRoles(t);
  }
  t.rotationIdx ??= 0;
  if (!t.staff) assignStaffRoles(t);
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

/** 監督の采配効果（タイプから引く。保存データに効果を持たせないので、調整してもすぐ反映される） */
export function managerEffects(m: Manager | null | undefined): ManagerEffects {
  return (m && MANAGER_TYPES.find((t) => t.key === m.type)) || {};
}

export function hireNewManager(team: Team): void {
  const type = choice(MANAGER_TYPES);
  if (!team.lineupStyleLocked) team.lineupStyle = styleForManager(type.key);
  team.manager = {
    type: type.key, label: type.label, desc: type.desc,
    hireSeason: DB.currentSeasonNum || 1, tenureYears: randInt(3, 30),
    wins: 0, losses: 0, ties: 0, careerGames: 0,
  };
}

export function createTeams(): Team[] {
  return TEAM_DEFS.map((def, idx) => {
    const usedNames: string[] = [], usedNumbers: number[] = [];
    const roster = createRoster(usedNames, usedNumbers);
    const pitchers = createPitchingStaff(usedNames, usedNumbers);
    const team: Team = {
      id: 't' + idx, name: def.name, league: def.league, tagline: def.tagline,
      roster, battingOrder: buildBattingOrder(roster.slice(0, 9)),
      pitchers, staff: { rotation: [], closer: null, setup: null }, rotationIdx: 0,
      wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0,
      consecutiveBClass: 0, manager: null, managerHistory: [],
    };
    assignStaffRoles(team);
    hireNewManager(team);
    team.battingOrder = orderByStyle(team.battingOrder, team.lineupStyle ?? 'traditional');
    return team;
  });
}


/** ガチャの放出候補（加入2年未満の選手は、候補が2人以上いる限り保護） */
export function gachaCandidates(t: Team): Player[] {
  const all = allPlayersOf(t);
  const eligible = all.filter((p) => !(p.gachaImmunitySeasons > 0));
  return eligible.length >= 2 ? eligible : all;
}

export function worstPerformer(t: Team): Player {
  const pool = gachaCandidates(t);
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

/** 選手を新人に入れ替える（野手なら同じ守備位置・打順、投手なら同じ役割を引き継ぐ） */
function replaceWithRookie(t: Team, outgoing: Player): { outgoing: Player; incoming: Player; boIdx: number } {
  retirePlayer(t, outgoing);
  const others = allPlayersOf(t).filter((p) => p !== outgoing);
  const identity = pickPlayerIdentity(others.map((p) => p.name));
  const debut = (DB.currentSeasonNum || 1) + 1;
  const incoming = outgoing.pitch ? createPitcher(identity, true, debut) : createPlayer(outgoing.pos, identity, true, debut);
  const retired = t.retiredNumbers?.map((r) => r.number) ?? [];
  incoming.number = pickUniformNumber([...others.map((p) => p.number), ...retired]);
  let boIdx = -1;
  if (outgoing.pitch) {
    t.pitchers[t.pitchers.indexOf(outgoing)] = incoming;
    t.staff.rotation = t.staff.rotation.map((id) => (id === outgoing.id ? incoming.id : id));
    if (t.staff.closer === outgoing.id) t.staff.closer = incoming.id;
    if (t.staff.setup === outgoing.id) t.staff.setup = incoming.id;
  } else {
    t.roster[t.roster.indexOf(outgoing)] = incoming;
    boIdx = t.battingOrder.indexOf(outgoing);
    if (boIdx >= 0) t.battingOrder[boIdx] = incoming;
    incoming.ability = pickWeightedOrNone(ABILITY_AFFINITY[boIdx >= 0 ? boIdx : 8] || {});
  }
  return { outgoing, incoming, boIdx };
}

/**
 * オフシーズン補強ガチャ：全12球団、それぞれ1名だけを新人に入れ替える。
 * mySelectedPlayerId: 選手ID／'__skip__'なら自チームは放出しない／null なら全球団を自動判定
 */
export function gachaSwapAllTeams(myTeamId: string | null, mySelectedPlayerId: string | null): GachaResult[] {
  if (DB.gachaDoneThisCycle) return []; // 1回のオフにつき1回だけ
  const results: GachaResult[] = [];
  DB.teams.forEach((t) => {
    const isMine = t.id === myTeamId;
    let target: Player | undefined;
    if (isMine && mySelectedPlayerId === '__skip__') {
      target = undefined;
    } else if (isMine && mySelectedPlayerId) {
      target = allPlayersOf(t).find((p) => p.id === mySelectedPlayerId);
    } else if (isMine) {
      target = worstPerformer(t);
    } else {
      const candidate = worstPerformer(t);
      if (shouldReleasePlayer(candidate)) target = candidate;
    }

    if (!target) {
      results.push({ team: t, out: null, in: null, slot: null, skipped: true });
      return;
    }
    const { outgoing, incoming, boIdx } = replaceWithRookie(t, target);
    results.push({ team: t, out: outgoing, in: incoming, slot: boIdx >= 0 ? boIdx + 1 : null, skipped: false });
  });
  DB.gachaDoneThisCycle = true;
  return results;
}

/** ベテランの引退判断：33歳ごろから、年齢が上がるほど・能力が落ちているほど引退しやすい */
export function shouldRetire(p: Player): boolean {
  const R = RETIREMENT;
  if (p.age >= R.forcedAge) return true;
  if (p.age < R.startAge) return false;
  const overall = overallOf(p);
  const chance = R.base + R.perYear * (p.age - R.startAge) + (overall < R.weakOverall ? R.weakBonus : 0);
  return Math.random() < chance;
}

/** シーズンオフの引退。引退した選手は若手に入れ替える */
export function retireVeterans(t: Team): { team: Team; out: Player; in: Player }[] {
  const retiredList: { team: Team; out: Player; in: Player }[] = [];
  allPlayersOf(t).forEach((p) => {
    if (shouldRetire(p)) {
      onPlayerRetired(p, t);
      const { incoming } = replaceWithRookie(t, p);
      retiredList.push({ team: t, out: p, in: incoming });
    }
  });
  return retiredList;
}
