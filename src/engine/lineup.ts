/*
 * 打順の方針と、試合ごとのスタメン（休養・控えの起用）。
 * 打者の評価は「その打者の鉛筆」から出す期待値に、今季の実績（打席が増えるほど重く）を混ぜて使う。
 */
import { pencilsFor } from './atbat';
import { LINEUP_STYLES, type LineupStyleKey } from './data';
import { obpOfStats, slgOfStats } from './stats';
import type { Player, Team } from './types';
import { frac } from './util';

export interface BatterValue { obp: number; slg: number; ops: number; hrRate: number; speed: number; contact: number }

/** 打者の評価（鉛筆の期待値＋今季の実績） */
export function batterValue(p: Player): BatterValue {
  const pc = pencilsFor(p, null);
  const xbh = pc.p1.otto * (pc.p2.double + pc.p2.hr);
  const hitsPerPA = pc.p1.hit + xbh;
  const exObp = hitsPerPA + pc.p1.walk;
  const ab = 1 - pc.p1.walk;
  const exSlg = (pc.p1.hit + pc.p1.otto * (pc.p2.double * 2 + pc.p2.hr * 4)) / ab;
  const w = p.stats.pa / (p.stats.pa + 200); // 実績の重み（200打席で半々）
  const obp = p.stats.pa > 0 ? exObp * (1 - w) + obpOfStats(p.stats) * w : exObp;
  const slg = p.stats.ab > 0 ? exSlg * (1 - w) + slgOfStats(p.stats) * w : exSlg;
  return { obp, slg, ops: obp + slg, hrRate: pc.p1.otto * pc.p2.hr, speed: frac(p.speed), contact: frac(p.contact) };
}

/** 9人を打順の方針に沿って並べる */
export function orderByStyle(players: Player[], style: LineupStyleKey): Player[] {
  const vals = new Map(players.map((p) => [p, batterValue(p)] as const));
  const v = (p: Player) => vals.get(p)!;
  let pool = players.slice();
  const take = (score: (x: BatterValue) => number): Player => {
    pool.sort((a, b) => score(v(b)) - score(v(a)));
    return pool.shift()!;
  };
  const slots: (Player | null)[] = new Array(9).fill(null);
  const fill = (slot: number, score: (x: BatterValue) => number) => { slots[slot - 1] = take(score); };
  const rest = (from: number) => { for (let i = from - 1; i < 9; i++) if (!slots[i]) slots[i] = take((x) => x.ops); };

  switch (style) {
    case 'traditional': // 1番出塁と足、2番つなぎ、3番最強打者、4番長打、5番もう一人の長距離砲
      fill(3, (x) => x.ops);
      fill(4, (x) => x.hrRate * 6 + x.slg);
      fill(1, (x) => x.obp + x.speed * 0.08);
      fill(5, (x) => x.hrRate * 4 + x.slg);
      fill(2, (x) => x.contact * 0.1 + x.obp);
      rest(6);
      break;
    case 'modern': // 2番に最強打者、1番出塁、4番長打
      fill(2, (x) => x.ops);
      fill(1, (x) => x.obp);
      fill(4, (x) => x.hrRate * 6 + x.slg);
      fill(3, (x) => x.ops);
      fill(5, (x) => x.slg);
      rest(6);
      break;
    case 'speed': // 1・2番に足の速い選手、3番巧打、4番長打
      fill(4, (x) => x.hrRate * 6 + x.slg);
      fill(1, (x) => x.speed * 0.25 + x.obp);
      fill(2, (x) => x.speed * 0.2 + x.contact * 0.1 + x.obp);
      fill(3, (x) => x.ops);
      rest(5);
      break;
    case 'ops': // 打力の高い順
    default:
      rest(1);
  }
  return slots as Player[];
}

const POS_GROUP: Record<string, string> = { 捕: '捕', 一: '内', 二: '内', 三: '内', 遊: '内', 左: '外', 中: '外', 右: '外', 指: '指', 内: '内', 外: '外' };

/** その試合で休ませる確率（ベテランほど休みが増える） */
function restChance(p: Player): number {
  let c = 0.03;
  if (p.age >= 32) c += 0.03;
  if (p.age >= 35) c += 0.04;
  if (p.pos === '捕') c += 0.04; // 捕手は休みが多い
  return c;
}

/**
 * その試合のスタメン（選手IDの打順）。
 * レギュラー（team.battingOrder）から時々休養を与え、同じ守備グループの控えを起用する。
 * 打順は、手動設定ならその順番（休んだ選手の打順に控えが入る）、そうでなければ方針どおりに並べ直す。
 */
export function gameLineup(team: Team, allowRest = true): string[] {
  const regulars = team.battingOrder.slice();
  const bench = team.roster.filter((p) => !regulars.includes(p));
  const used = new Set<Player>();
  let rests = 0;
  const starters = regulars.map((p) => {
    if (!allowRest || rests >= 2 || Math.random() >= restChance(p)) return p;
    const group = POS_GROUP[p.pos] ?? '指';
    const sub = bench.filter((b) => !used.has(b)).sort((a, b) => {
      const ga = POS_GROUP[a.pos] === group || group === '指' ? 1 : 0, gb = POS_GROUP[b.pos] === group || group === '指' ? 1 : 0;
      return gb - ga || batterValue(b).ops - batterValue(a).ops;
    })[0];
    if (!sub) return p;
    used.add(sub); rests++;
    return sub;
  });
  const ordered = team.lineupManual ? starters : orderByStyle(starters, team.lineupStyle ?? 'traditional');
  return ordered.map((p) => p.id);
}

/**
 * シーズンオフ（とシーズン途中の見直し）：控えの方が明らかに打てるなら、同じ守備グループのレギュラーと入れ替える。
 * 手動設定のチームは入れ替えない。
 */
export function reviewRegulars(team: Team): void {
  if (team.lineupManual) return;
  const bench = team.roster.filter((p) => !team.battingOrder.includes(p));
  bench.forEach((b) => {
    const group = POS_GROUP[b.pos];
    const candidates = team.battingOrder.filter((r) => POS_GROUP[r.pos] === group || r.pos === '指');
    const worst = candidates.sort((x, y) => batterValue(x).ops - batterValue(y).ops)[0];
    if (worst && batterValue(b).ops > batterValue(worst).ops + 0.05) {
      team.battingOrder[team.battingOrder.indexOf(worst)] = b;
      // 守備位置の表記を入れ替える（控えの選手がレギュラーの守備位置に就く）
      const pos = worst.pos; worst.pos = b.pos; b.pos = pos;
    }
  });
  team.battingOrder = orderByStyle(team.battingOrder, team.lineupStyle ?? 'traditional');
}

/** 監督の采配タイプから、打順の方針を決める */
export function styleForManager(managerType: string | undefined): LineupStyleKey {
  if (managerType === 'speedball' || managerType === 'aggressive' || managerType === 'youthful') return 'speed';
  if (managerType === 'star' || managerType === 'power' || managerType === 'oldschool') return 'modern';
  return 'traditional';
}

export function lineupStyleLabel(key: string | undefined): string {
  return LINEUP_STYLES.find((s) => s.key === key)?.label ?? LINEUP_STYLES[0].label;
}
