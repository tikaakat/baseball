/* 球団史（過去シーズンの記録）の保存・読み込み */
import { computeBestNine, computeGoldenGlove, computePostseasonMVP, computeRookieOfYear, computeSeasonLeaders, computeSeasonMVP } from './awards';
import { finalizeStandings } from './standings';
import { DB, leagueName } from './state';
import { kvGet, kvRemove, kvSet } from './storage';
import type { SeasonRecord, Team } from './types';
import { sleep } from './util';

const HISTORY_KEY = 'season-history';

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
  const nextNum = history.length ? Math.max(...history.map((s) => s.seasonNum)) + 1 : 1;
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
  };
  history.push(record);
  const saved = await saveSeasonHistory(history);
  if (!saved) throw new ArchiveError(DB.lastStorageError || 'storage unavailable', record); // 計算した結果自体は失わない
  return record;
}
