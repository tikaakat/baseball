/* 球団史（過去シーズンの記録）の保存・読み込み */
import { computeBestNine, computeGoldenGlove, computePostseasonMVP, computeRookieOfYear, computeSeasonLeaders, computeSeasonMVP } from './awards';
import { finalizeStandings } from './standings';
import { DB, leagueName } from './state';
import type { SeasonRecord, Team } from './types';
import { sleep } from './util';

/** Claude アーティファクト環境が提供する保存API（他の環境では存在しない） */
interface ArtifactStorage {
  get(key: string, shared: boolean): Promise<{ value?: string } | null>;
  set(key: string, value: string, shared: boolean): Promise<unknown>;
}
declare global {
  interface Window { storage?: ArtifactStorage }
}

let inMemorySeasonHistory: SeasonRecord[] | null = null; // window.storage が使えない環境向けのフォールバック
export const STORAGE_AVAILABLE = typeof window !== 'undefined' && !!window.storage;

export async function loadSeasonHistory(): Promise<SeasonRecord[]> {
  if (!STORAGE_AVAILABLE) {
    if (inMemorySeasonHistory === null) inMemorySeasonHistory = [];
    return inMemorySeasonHistory;
  }
  try {
    const res = await window.storage!.get('season-history', false);
    if (res && res.value) return JSON.parse(res.value) as SeasonRecord[];
  } catch { /* まだ保存されていない */ }
  return [];
}

async function saveSeasonHistory(history: SeasonRecord[]): Promise<boolean> {
  if (!STORAGE_AVAILABLE) {
    inMemorySeasonHistory = history;
    return true;
  }
  const payload = JSON.stringify(history);
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await window.storage!.set('season-history', payload, false);
      if (result) return true;
      lastErr = 'window.storage.set returned no result';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < 2) await sleep(400 * (attempt + 1)); // 一時的な失敗を救うため少し待って再試行
  }
  DB.lastStorageError = lastErr + '（3回試行）';
  return false;
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
