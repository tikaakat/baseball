import { describe, expect, it } from 'vitest';
import { buildBackup, restoreBackup } from '../src/engine/backup';
import { completeDaysThrough } from '../src/engine/days';
import { hardResetLeague } from '../src/engine/season';
import { DB } from '../src/engine/state';

describe('バックアップ', () => {
  it('書き出したファイルを読み込むと、同じリーグに戻る', async () => {
    hardResetLeague();
    completeDaysThrough(30);
    const json = JSON.stringify(await buildBackup({ myTeamId: 't4', liveGame: null }));
    const wins = DB.teams.map((t) => t.wins);
    hardResetLeague();
    const ui = await restoreBackup(json);
    expect(ui.myTeamId).toBe('t4');
    expect(DB.teams.map((t) => t.wins)).toEqual(wins);
  });
  it('関係ないファイルは拒否し、いまのリーグはそのまま', async () => {
    hardResetLeague();
    const teams = DB.teams;
    await expect(restoreBackup('{"hello":1}')).rejects.toThrow();
    await expect(restoreBackup('not json')).rejects.toThrow();
    expect(DB.teams).toBe(teams);
  });
});
