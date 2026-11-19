import { describe, expect, it } from 'vitest';
import { autoCompletePostseason } from '../src/engine/postseason';
import { hardResetLeague, startNewSeason } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { gachaSwapAllTeams } from '../src/engine/team';
import { simWholeSeason } from './sim-helpers';

describe('ニュース', () => {
  it('長く続けると、節目の記録・記録更新・名選手の引退がニュースになる', () => {
    hardResetLeague();
    const kinds = new Set<string>();
    for (let y = 0; y < 15; y++) {
      simWholeSeason();
      autoCompletePostseason();
      (DB.news ?? []).forEach((n) => kinds.add(n.kind));
      gachaSwapAllTeams(null, null);
      startNewSeason();
    }
    (DB.news ?? []).forEach((n) => kinds.add(n.kind));
    console.log([...kinds], (DB.news ?? []).slice(-6).map((n) => n.text));
    expect(kinds.has('milestone')).toBe(true);
    expect(kinds.has('record')).toBe(true);
    expect(kinds.has('feat')).toBe(true);
    expect(DB.records?.hr?.value).toBeGreaterThan(20);
  }, 120000);
});
