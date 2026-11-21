/* 球団史（過去シーズンの記録）の保存・読み込み */
import { computeBestNine, computeBestPitcher, computeGoldenGlove, computePitchingLeaders, computePostseasonMVP, computeRookieOfYear, computeSeasonLeaders, computeSeasonMVP } from './awards';
import { onSeasonArchived } from './news';
import { finalizeStandings } from './standings';
import { DB, leagueName } from './state';
import { kvGet, kvRemove, kvSet } from './storage';
import type { BatRow, PitRow, SeasonRecord, Team, TeamSeasonRoster } from './types';
import { sleep } from './util';

const HISTORY_KEY = 'season-history';
const ROSTER_KEEP_SEASONS = 30;

function teamRosters(): Record<string, TeamSeasonRoster> {
  const out: Record<string, TeamSeasonRoster> = {};
  DB.teams.forEach((t) => {
    const roleOf = (id: string) => { const i = t.staff.rotation.indexOf(id); return i >= 0 ? `先${i + 1}` : id === t.staff.closer ? '抑え' : id === t.staff.setup ? '中継' : '救援'; };
    out[t.id] = {
      name: t.name,
      b: t.roster.filter((p) => p.stats.pa > 0).map((p): BatRow => {
        const s = p.stats;
        return [p.name, p.pos, s.pa, s.ab, s.h, s.doubles, s.triples, s.hr, s.rbi, s.bb, s.sb];
      }),
      p: t.pitchers.filter((p) => p.pStats.g > 0).map((p): PitRow => {
        const s = p.pStats;
        return [p.name, roleOf(p.id), s.g, s.gs, s.w, s.l, s.sv, s.outs, s.r, s.k];
      }),
    };
  });
  return out;
}

export async function loadSeasonHistory(): Promise<SeasonRecord[]> {
  try {
    const raw = await kvGet(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as SeasonRecord[];
  } catch { /* 壊れている・未保存 */ }
  return [];
}

async function saveSeasonHistory(history: SeasonRecord[]): Promise<boolean> {
  const payload = JSON.stringify(history);
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (await kvSet(HISTORY_KEY, payload)) return true;
      lastErr = 'storage.set returned no result';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < 2) await sleep(400 * (attempt + 1)); // 一時的な失敗を救うため少し待って再試行
  }
  DB.lastStorageError = lastErr + '（3回試行）';
  return false;
}

/** 球団史をまるごと置き換える（バックアップの読み込み用） */
export async function replaceSeasonHistory(history: SeasonRecord[]): Promise<void> {
  if (!(await saveSeasonHistory(history))) throw new Error(DB.lastStorageError || '球団史を保存できませんでした');
}

export async function clearSeasonHistory(): Promise<void> {
  await kvRemove(HISTORY_KEY);
}

export class ArchiveError extends Error {
  constructor(message: string, public record: SeasonRecord) { super(message); }
}

const standingRecords = (list: Team[]) =>
  list.map((t, i) => ({ teamId: t.id, name: t.name, rank: i + 1, wins: t.wins, losses: t.losses, ties: t.ties }));

/** 今シーズンの最終成績と表彰を球団史に記録する */
export async function archiveCurrentSeason(): Promise<SeasonRecord> {
  const { H, B } = finalizeStandings();
  const history = await loadSeasonHistory();
  // シーズン番号は選手の「初登場シーズン」と揃える（古いデータと重なる場合だけ後ろにずらす）
  const maxRecorded = history.length ? Math.max(...history.map((s) => s.seasonNum)) : 0;
  const nextNum = DB.currentSeasonNum > maxRecorded ? DB.currentSeasonNum : maxRecorded + 1;
  const champion = DB.postseason?.champion ?? null;
  const record: SeasonRecord = {
    seasonNum: nextNum,
    savedAt: new Date().toISOString(),
    leagueNames: { H: leagueName('H'), B: leagueName('B') },
    standings: { H: standingRecords(H), B: standingRecords(B) },
    champion: champion ? champion.name : null,
    championTeamId: champion ? champion.id : null,
    leaders: computeSeasonLeaders(),
    mvp: computeSeasonMVP(),
    postseasonMvp: computePostseasonMVP(),
    bestNine: computeBestNine(),
    rookieOfYear: computeRookieOfYear(),
    goldenGlove: computeGoldenGlove(),
    pitchingLeaders: computePitchingLeaders(),
    bestPitcher: computeBestPitcher(),
    rosters: teamRosters(),
  };
  history.push(record);
  // 選手成績は直近の分だけ残す（保存容量のため）
  history.slice(0, Math.max(0, history.length - ROSTER_KEEP_SEASONS)).forEach((h) => { delete h.rosters; });
  onSeasonArchived(record.champion, [
    record.mvp.H && `${record.leagueNames.H} MVPは${record.mvp.H.team}の${record.mvp.H.name}`,
    record.mvp.B && `${record.leagueNames.B} MVPは${record.mvp.B.team}の${record.mvp.B.name}`,
  ].filter((x): x is string => !!x));
  const saved = await saveSeasonHistory(history);
  if (!saved) throw new ArchiveError(DB.lastStorageError || 'storage unavailable', record); // 計算した結果自体は失わない
  return record;
}
