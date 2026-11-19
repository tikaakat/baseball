/*
 * バックアップ：リーグ全体（進行中のシーズン・選手・球団史）を1つのファイルに書き出す／読み込む。
 * ブラウザのデータを消すとセーブも消えるので、長く遊んだリーグを手元に残せるようにする。
 */
import { loadSeasonHistory, replaceSeasonHistory } from './history';
import { restoreState, serializeState, type SaveData } from './save';
import type { Game, SeasonRecord } from './types';

const FORMAT = 'pencil-baseball-backup';

export interface BackupFile {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  league: SaveData;
  history: SeasonRecord[];
}

export async function buildBackup(ui: { myTeamId: string | null; liveGame: Game | null }): Promise<BackupFile> {
  return {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    league: serializeState(ui),
    history: await loadSeasonHistory(),
  };
}

/** バックアップを読み込んでリーグを置き換える。形式が違えば例外（いまのリーグは変更しない） */
export async function restoreBackup(json: string): Promise<{ myTeamId: string | null; liveGame: Game | null }> {
  let data: BackupFile;
  try {
    data = JSON.parse(json) as BackupFile;
  } catch {
    throw new Error('ファイルを読み込めませんでした（JSON形式ではありません）');
  }
  if (data?.format !== FORMAT || !data.league) throw new Error('六角鉛筆ベースボールのバックアップファイルではありません');
  const ui = restoreState(data.league); // 不正なら例外を投げ、DBは変わらない
  await replaceSeasonHistory(Array.isArray(data.history) ? data.history : []);
  return ui;
}
