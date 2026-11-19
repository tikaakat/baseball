import { describe, expect, it } from 'vitest';
import { autoCompletePostseason } from '../src/engine/postseason';
import { hardResetLeague, startNewSeason } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { overallOf } from '../src/engine/player';
import { gachaSwapAllTeams } from '../src/engine/team';
import { simWholeSeason } from './sim-helpers';

describe('長期（30年）', () => {
  it('能力が上がり続けず、現役期間・通算記録が現実的な範囲に収まる', () => {
    hardResetLeague();
    const abilityMeans: number[] = [];
    for (let y = 0; y < 30; y++) {
      simWholeSeason();
      autoCompletePostseason();
      const ps = DB.teams.flatMap((t) => [...t.roster, ...t.pitchers]);
      abilityMeans.push(ps.reduce((a, p) => a + overallOf(p), 0) / ps.length);
      gachaSwapAllTeams(null, null);
      startNewSeason();
    }
    const careers = DB.teams.flatMap((t) => [...t.roster, ...t.pitchers, ...(t.alumni || [])]);
    const late = abilityMeans.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const everyone = DB.teams.flatMap((t) => [...t.roster, ...t.pitchers]);
    const avgAge = everyone.reduce((a, p) => a + p.age, 0) / everyone.length;
    console.log({ abilityFirst: Math.round(abilityMeans[0]), abilityLast5: Math.round(late), avgAge, careerMax: Math.max(...careers.map((p) => p.seasonsPlayed)) });
    expect(late).toBeGreaterThan(110);
    expect(late).toBeLessThan(142);
    expect(avgAge).toBeGreaterThan(25);
    expect(avgAge).toBeLessThan(31);
    expect(Math.max(...careers.map((p) => p.seasonsPlayed))).toBeLessThanOrEqual(24);
  }, 60000);
});
