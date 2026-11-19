import { describe, expect, it } from 'vitest';
import { autoCompletePostseason } from '../src/engine/postseason';
import { hardResetLeague, startNewSeason } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { gachaSwapAllTeams } from '../src/engine/team';
import { simWholeSeason, summarizeLeague } from './sim-helpers';

describe('シーズン進行', () => {
  it('144試合×12球団を消化でき、ポストシーズンで日本一が決まる', () => {
    hardResetLeague();
    expect(DB.schedule).toHaveLength(864);
    simWholeSeason();
    DB.teams.forEach((t) => expect(t.wins + t.losses + t.ties).toBe(144));
    autoCompletePostseason();
    expect(DB.postseason?.champion).toBeTruthy();
  });

  it('ガチャとシーズン移行を10年繰り返しても壊れない', () => {
    hardResetLeague();
    for (let y = 0; y < 10; y++) {
      simWholeSeason();
      autoCompletePostseason();
      gachaSwapAllTeams(null, null);
      startNewSeason();
    }
    expect(DB.currentSeasonNum).toBe(11);
    DB.teams.forEach((t) => {
      expect(t.roster).toHaveLength(9);
      expect(new Set(t.battingOrder.map((p) => p.id)).size).toBe(9);
      t.battingOrder.forEach((p) => expect(t.roster).toContain(p));
    });
  });
});

describe('バランス（リーグ全体の成績が現実のプロ野球に近い範囲に収まる）', () => {
  it('3シーズン平均', () => {
    const results = [0, 1, 2].map(() => { hardResetLeague(); simWholeSeason(); return summarizeLeague(); });
    const mean = (k: keyof (typeof results)[0]) => results.reduce((a, r) => a + r[k], 0) / results.length;
    const summary = {
      runsPerGame: mean('runsPerGame'), avg: mean('avg'), obp: mean('obp'), slg: mean('slg'),
      hrPerTeam: mean('hrPerTeam'), sbPerTeam: mean('sbPerTeam'), tieRate: mean('tieRate'),
    };
    console.table(summary);
    expect(summary.avg).toBeGreaterThan(0.22);
    expect(summary.avg).toBeLessThan(0.29);
    expect(summary.runsPerGame).toBeGreaterThan(2.5);
    expect(summary.runsPerGame).toBeLessThan(5.5);
  });
});
