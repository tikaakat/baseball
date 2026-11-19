import { describe, expect, it } from 'vitest';
import { newGame } from '../src/engine/game';
import { hardResetLeague } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { availableBench, decisionCard, executeBunt, executeIntentionalWalk, pinchHit } from '../src/engine/tactics';
import { simWholeSeason } from './sim-helpers';

function lateCloseGame() {
  hardResetLeague();
  const g = newGame(DB.teams[0], DB.teams[1], null);
  g.inning = 8; g.half = 'bottom'; g.score = { home: 2, away: 3 }; g.outs = 0;
  g.manualSide = 'home';
  return g;
}

describe('作戦', () => {
  it('送りバント成功で走者が進み、打者はアウト（打数に数えない）', () => {
    for (let i = 0; i < 40; i++) {
      const g = lateCloseGame();
      const runner = DB.teams[0].roster[0];
      g.bases.first = runner;
      const batter = DB.teams[0].roster.find((p) => p.id === g.lineup.home[0])!;
      const abBefore = batter.stats.ab;
      const play = executeBunt(g);
      if (play.isSacBunt) {
        expect(g.bases.second).toBe(runner);
        expect(g.outs).toBe(1);
        expect(batter.stats.ab).toBe(abBefore);
        return;
      }
    }
    throw new Error('40回試してもバントが成功しなかった');
  });

  it('敬遠で打者が一塁へ', () => {
    const g = lateCloseGame();
    g.bases.second = DB.teams[0].roster[0];
    executeIntentionalWalk(g);
    expect(g.bases.first).not.toBeNull();
    expect(g.bases.second).not.toBeNull();
  });

  it('代打で打順の選手が入れ替わり、退いた選手は再出場できない', () => {
    const g = lateCloseGame();
    const sub = availableBench(g, 'home')[0];
    const out = g.lineup.home[0];
    pinchHit(g, sub);
    expect(g.lineup.home[0]).toBe(sub.id);
    expect(availableBench(g, 'home').some((p) => p.id === out)).toBe(false);
  });

  it('終盤の接戦で走者がいれば、マイチームの攻撃時に勝負所カードが出る', () => {
    const g = lateCloseGame();
    expect(decisionCard(g)).toBeNull(); // 走者なし
    g.bases.first = DB.teams[0].roster[0];
    const card = decisionCard(g);
    expect(card?.kind).toBe('offense');
    g.inning = 3;
    expect(decisionCard(g)).toBeNull(); // 序盤は出ない
  });

  it('AIもシーズンを通して送りバントや代打を使う', () => {
    hardResetLeague();
    simWholeSeason();
    const all = DB.teams.flatMap((t) => t.roster);
    const sacBunts = all.reduce((a, p) => a + (p.stats.pa - p.stats.ab - p.stats.bb - p.stats.sac), 0);
    expect(sacBunts).toBeGreaterThan(20);
  });
});
