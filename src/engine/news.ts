/*
 * ニュース：節目の記録（通算2000本安打など）、1試合の快挙、シーズン記録の更新、名選手の引退と永久欠番。
 * 球団の歴史が積み上がっていく楽しさを、その場で知らせるためのもの。
 */
import { DB } from './state';
import type { Game, NewsItem, Player, Team } from './types';

const MAX_NEWS = 150;

export function addNews(text: string, kind: NewsItem['kind'], teamId: string | null = null, day: number | null = null): void {
  (DB.news ??= []).push({ season: DB.currentSeasonNum, day, text, kind, teamId });
  if (DB.news.length > MAX_NEWS) DB.news.splice(0, DB.news.length - MAX_NEWS);
}

/** 通算記録の節目 */
const MILESTONES = {
  h: { label: '安打', marks: [1000, 1500, 2000, 2500, 3000, 3500] },
  hr: { label: '本塁打', marks: [100, 200, 300, 400, 500, 600, 700] },
  sb: { label: '盗塁', marks: [200, 300, 400, 500] },
  w: { label: '勝', marks: [100, 150, 200, 250] },
  sv: { label: 'セーブ', marks: [100, 200, 250, 300] },
  k: { label: '奪三振', marks: [1000, 1500, 2000, 2500, 3000] },
} as const;
type MilestoneKey = keyof typeof MILESTONES;

/** 名球会の基準 */
const HALL = { h: 2000, w: 200, sv: 250 } as const;

function careerTotal(p: Player, key: MilestoneKey): number {
  switch (key) {
    case 'h': return p.career.h + p.stats.h;
    case 'hr': return p.career.hr + p.stats.hr;
    case 'sb': return p.career.sb + p.stats.sb;
    case 'w': return p.pCareer.w + p.pStats.w;
    case 'sv': return p.pCareer.sv + p.pStats.sv;
    case 'k': return p.pCareer.k + p.pStats.k;
  }
}

/** シーズン記録（リーグ史上最多） */
const SEASON_RECORDS = {
  hr: { label: 'シーズン最多本塁打', unit: '本', get: (p: Player) => p.stats.hr },
  h: { label: 'シーズン最多安打', unit: '本', get: (p: Player) => p.stats.h },
  sb: { label: 'シーズン最多盗塁', unit: '個', get: (p: Player) => p.stats.sb },
  w: { label: 'シーズン最多勝', unit: '勝', get: (p: Player) => p.pStats.w },
  sv: { label: 'シーズン最多セーブ', unit: 'セーブ', get: (p: Player) => p.pStats.sv },
  k: { label: 'シーズン最多奪三振', unit: '個', get: (p: Player) => p.pStats.k },
} as const;
export type RecordKey = keyof typeof SEASON_RECORDS;
export const RECORD_LABELS = Object.fromEntries(Object.entries(SEASON_RECORDS).map(([k, v]) => [k, { label: v.label, unit: v.unit }])) as Record<RecordKey, { label: string; unit: string }>;

const dayOf = (game: Game) => DB.schedule.find((g) => g.id === game.scheduleId)?.day ?? null;

/** レギュラーシーズンの試合が終わったときに、節目・快挙・記録をチェックする */
export function onGameFinished(game: Game): void {
  if (game.seriesKey || !game.scheduleId) return;
  const day = dayOf(game);

  (['away', 'home'] as const).forEach((side) => {
    const team = game[side];
    const opp = game[side === 'home' ? 'away' : 'home'];
    // 打者：この試合の増加分から、節目を越えたかを判定
    Object.entries(game.box).forEach(([id, b]) => {
      const p = team.roster.find((x) => x.id === id);
      if (!p) return;
      const deltas: Partial<Record<MilestoneKey, number>> = { h: b.h, hr: b.hr, sb: b.sb };
      checkMilestones(p, team, deltas, day);
      if (b.hr >= 3) addNews(`${team.name}の${p.name}が1試合${b.hr}本塁打の大暴れ！（対${opp.name}）`, 'feat', team.id, day);
      else if (b.h >= 5) addNews(`${team.name}の${p.name}が1試合${b.h}安打の固め打ち（対${opp.name}）`, 'feat', team.id, day);
    });
    // 投手
    game.pitchersUsed[side].forEach((id) => {
      const p = team.pitchers.find((x) => x.id === id);
      const b = game.pbox[id];
      if (!p || !b) return;
      checkMilestones(p, team, { w: b.dec === 'W' ? 1 : 0, sv: b.dec === 'S' ? 1 : 0, k: b.k }, day);
      if (b.k >= 15) addNews(`${team.name}の${p.name}が1試合${b.k}奪三振！（対${opp.name}）`, 'feat', team.id, day);
    });
    // ノーヒットノーラン（相手を無安打・無得点に抑えて勝利）
    const oppSide = side === 'home' ? 'away' : 'home';
    if (game.winner === side && game.hits[oppSide] === 0 && game.score[oppSide] === 0) {
      const used = game.pitchersUsed[side];
      const who = used.length === 1 ? `${team.pitchers.find((x) => x.id === used[0])?.name ?? ''}が` : '継投で';
      addNews(`🎉 ${team.name}の${who}ノーヒットノーラン達成！（対${opp.name}）`, 'feat', team.id, day);
    }
  });
}

function checkMilestones(p: Player, team: Team, deltas: Partial<Record<MilestoneKey, number>>, day: number | null): void {
  (Object.keys(deltas) as MilestoneKey[]).forEach((key) => {
    const d = deltas[key] ?? 0;
    if (d <= 0) return;
    const after = careerTotal(p, key), before = after - d;
    const m = MILESTONES[key];
    m.marks.forEach((mark) => {
      if (before < mark && after >= mark) {
        const hall = (key === 'h' || key === 'w' || key === 'sv') && mark === HALL[key] ? '　名球会入りの資格を手にした！' : '';
        addNews(`🏅 ${team.name}の${p.name}が通算${mark}${m.label}を達成${hall}`, 'milestone', team.id, day);
      }
    });
  });
}

/**
 * 1日の試合が終わったら、シーズン記録の更新をチェックする。
 * 記録はシーズン中も更新していくが、ニュースはそのシーズンで初めて塗り替えたときだけ出す。
 * 1年目は比べる記録がないのでニュースにしない。
 */
export function checkSeasonRecords(day: number): void {
  DB.records ??= {};
  DB.recordNewsThisSeason ??= [];
  const players = DB.teams.flatMap((t) => [...t.roster, ...t.pitchers].map((p) => ({ p, t })));
  (Object.keys(SEASON_RECORDS) as RecordKey[]).forEach((key) => {
    const def = SEASON_RECORDS[key];
    const best = players.reduce((a, x) => (def.get(x.p) > def.get(a.p) ? x : a), players[0]);
    if (!best) return;
    const value = def.get(best.p);
    const rec = DB.records![key];
    if (value <= 0 || (rec && value <= rec.value)) return;
    const isNewHolder = !rec || rec.season !== DB.currentSeasonNum;
    DB.records![key] = { value, name: best.p.name, team: best.t.name, season: DB.currentSeasonNum };
    if (DB.currentSeasonNum > 1 && isNewHolder && !DB.recordNewsThisSeason!.includes(key)) {
      DB.recordNewsThisSeason!.push(key);
      addNews(`📈 ${best.t.name}の${best.p.name}が${def.label}記録を更新！（${value}${def.unit}、従来は${rec ? `${rec.value}${def.unit}・第${rec.season}季 ${rec.name}` : 'なし'}）`, 'record', best.t.id, day);
    }
  });
}

/** 名選手の引退。とくに偉大な選手は背番号を永久欠番にする */
export function onPlayerRetired(p: Player, team: Team): void {
  const h = careerTotal(p, 'h'), hr = careerTotal(p, 'hr'), w = careerTotal(p, 'w'), sv = careerTotal(p, 'sv');
  const notable = h >= 1500 || hr >= 250 || w >= 120 || sv >= 150 || p.awards.mvp >= 1;
  if (!notable) return;
  const summary = p.pitch ? `通算${w}勝${sv}セーブ` : `通算${h}安打${hr}本塁打`;
  const legend = h >= 2000 || hr >= 400 || w >= 200 || sv >= 250 || p.awards.mvp >= 2;
  let text = `👋 ${team.name}の${p.name}（${p.age}歳）が引退。${summary}${p.awards.mvp ? `、MVP${p.awards.mvp}回` : ''}。`;
  if (legend && p.number != null && !(team.retiredNumbers ?? []).some((r) => r.number === p.number)) {
    (team.retiredNumbers ??= []).push({ number: p.number, name: p.name, season: DB.currentSeasonNum });
    text += `背番号${String(p.number).padStart(2, '0')}は永久欠番に。`;
  }
  addNews(text, 'retire', team.id, null);
}

/** シーズン終了時のニュース（優勝・MVP） */
export function onSeasonArchived(champion: string | null, mvps: string[]): void {
  if (champion) addNews(`🏆 第${DB.currentSeasonNum}季は${champion}がペンシルシリーズ制覇！`, 'title', null, null);
  mvps.forEach((m) => addNews(`⭐ ${m}`, 'title', null, null));
}
