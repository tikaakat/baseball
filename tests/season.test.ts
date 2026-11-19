import { describe, expect, it } from 'vitest';
import { autoCompletePostseason } from '../src/engine/postseason';
import { hardResetLeague, startNewSeason } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { gachaSwapAllTeams } from '../src/engine/team';
import { simWholeSeason } from './sim-helpers';

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

describe('日程', () => {
  it('毎日すべての球団が1試合ずつ、144日。同一リーグ各24試合（ホーム12）、交流戦各4試合', () => {
    hardResetLeague();
    const days = new Map<number, string[]>();
    DB.schedule.forEach((g) => { const d = days.get(g.day) ?? []; d.push(g.home, g.away); days.set(g.day, d); });
    expect(days.size).toBe(144);
    days.forEach((teams) => expect(new Set(teams).size).toBe(12));
    const t0 = DB.teams[0];
    DB.teams.filter((t) => t !== t0).forEach((t) => {
      const vs = DB.schedule.filter((g) => (g.home === t0.id && g.away === t.id) || (g.home === t.id && g.away === t0.id));
      const home = vs.filter((g) => g.home === t0.id).length;
      if (t.league === t0.league) { expect(vs).toHaveLength(24); expect(home).toBe(12); }
      else { expect(vs).toHaveLength(4); expect(home).toBe(2); }
    });
  });
});
