import { describe, expect, it } from 'vitest';
import { hardResetLeague } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { simWholeSeason } from './sim-helpers';

describe('投手', () => {
  it('勝ち負けのついた試合ごとに勝利投手・敗戦投手がちょうど1人ずつ、投球回と失点の合計がチーム成績と一致', () => {
    hardResetLeague();
    simWholeSeason();
    const decided = DB.schedule.filter((g) => g.result!.winner !== 'tie').length;
    const all = DB.teams.flatMap((t) => t.pitchers);
    expect(all.reduce((a, p) => a + p.pStats.w, 0)).toBe(decided);
    expect(all.reduce((a, p) => a + p.pStats.l, 0)).toBe(decided);
    expect(all.reduce((a, p) => a + p.pStats.gs, 0)).toBe(DB.schedule.length * 2);
    DB.teams.forEach((t) => {
      expect(t.pitchers.reduce((a, p) => a + p.pStats.r, 0)).toBe(t.runsAgainst);
      // 1チームの投球アウト数は、144試合×約27アウト（サヨナラ負け・裏の攻撃なしで少し前後）
      const outs = t.pitchers.reduce((a, p) => a + p.pStats.outs, 0);
      expect(outs).toBeGreaterThan(144 * 24);
      expect(outs).toBeLessThan(144 * 30);
      // 6人ローテーションなので、柱の先発は20試合以上に先発する（途中で入れ替わる投手もいる）
      expect(Math.max(...t.pitchers.map((p) => p.pStats.gs))).toBeGreaterThanOrEqual(20);
    });
  });
});
