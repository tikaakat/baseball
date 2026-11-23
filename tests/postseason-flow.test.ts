import { describe, expect, it } from 'vitest';
import { autoUntilTeamPlays, isAlive, startPostseason } from '../src/engine/postseason';
import { hardResetLeague } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { simWholeSeason } from './sim-helpers';

describe('ポストシーズンの進め方', () => {
  it('1位チームは「出番まで進める」でファイナルの直前まで進み、4位以下は出場していない扱い', () => {
    hardResetLeague(); simWholeSeason();
    startPostseason();
    const ps = DB.postseason!;
    const top = ps.standings.H[0], fourth = ps.standings.H[3];
    expect(isAlive(top.id)).toBe(true);
    expect(isAlive(fourth.id)).toBe(false);
    autoUntilTeamPlays(top.id);
    const final = ps.series.H2!;
    expect(final).toBeTruthy();
    expect(final.winner).toBeNull();
    expect([final.teamA.id, final.teamB.id]).toContain(top.id);
    expect(final.games.length).toBe(0); // マイチームの試合はまだ1つも自動で進めていない
  });
});
