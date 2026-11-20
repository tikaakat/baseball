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
      expect(t.roster).toHaveLength(13);
      expect(t.pitchers).toHaveLength(13);
      expect(new Set(t.battingOrder.map((p) => p.id)).size).toBe(9);
      expect(t.staff.rotation).toHaveLength(6);
      t.staff.rotation.forEach((id) => expect(t.pitchers.some((p) => p.id === id)).toBe(true));
      t.battingOrder.forEach((p) => expect(t.roster).toContain(p));
    });
  });
});

describe('補強ガチャ', () => {
  it('1回のオフに1回しか引けず、新しいシーズンでまた引ける', () => {
    hardResetLeague();
    simWholeSeason();
    autoCompletePostseason();
    const ids = () => DB.teams.flatMap((t) => [...t.roster, ...t.pitchers].map((p) => p.id)).join(',');
    gachaSwapAllTeams('t0', null);
    const after1 = ids();
    expect(gachaSwapAllTeams('t0', null)).toHaveLength(0);
    expect(ids()).toBe(after1);
    startNewSeason();
    expect(DB.gachaDoneThisCycle).toBe(false);
  });
});

describe('シーズン移行', () => {
  it('野手も投手も今季の成績がリセットされて通算と年度別に移り、1歳年を取る', () => {
    hardResetLeague();
    simWholeSeason();
    autoCompletePostseason();
    const p = DB.teams[0].pitchers.find((x) => x.pStats.outs > 0)!;
    const b = DB.teams[0].battingOrder[0];
    const before = { outs: p.pStats.outs, age: p.age, h: b.stats.h };
    startNewSeason();
    for (const x of [p, b]) {
      if (!DB.teams[0].pitchers.includes(x) && !DB.teams[0].roster.includes(x)) continue; // 引退した場合
      expect(x.pStats.outs).toBe(0);
      expect(x.stats.pa).toBe(0);
      expect(x.yearly?.length).toBe(1);
    }
    if (DB.teams[0].pitchers.includes(p)) {
      expect(p.pCareer.outs).toBe(before.outs);
      expect(p.age).toBe(before.age + 1);
      expect(p.yearly![0].pStats.outs).toBe(before.outs);
    }
    if (DB.teams[0].roster.includes(b)) expect(b.yearly![0].stats.h).toBe(before.h);
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
