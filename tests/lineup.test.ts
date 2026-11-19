import { describe, expect, it } from 'vitest';
import { batterValue, gameLineup, orderByStyle } from '../src/engine/lineup';
import { hardResetLeague } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { simWholeSeason } from './sim-helpers';

describe('打順と起用', () => {
  it('伝統型は4番に長距離砲、2番最強型は2番に最も打てる打者を置く', () => {
    hardResetLeague();
    const nine = DB.teams[0].battingOrder.slice();
    const trad = orderByStyle(nine, 'traditional');
    const modern = orderByStyle(nine, 'modern');
    const ops = (p: (typeof nine)[number]) => batterValue(p).ops;
    const hr = (p: (typeof nine)[number]) => batterValue(p).hrRate;
    expect(new Set(trad).size).toBe(9);
    // 4番は（3番を除いて）長打力（HRの出やすさ×6＋長打率）が最も高い打者
    const power = (p: (typeof nine)[number]) => hr(p) * 6 + batterValue(p).slg;
    expect(power(trad[3])).toBe(Math.max(...nine.filter((p) => p !== trad[2]).map(power)));
    expect(ops(modern[1])).toBe(Math.max(...nine.map(ops)));
  });

  it('試合ごとのスタメンは9人で重複がなく、シーズンを通して控えにも出番がある', () => {
    hardResetLeague();
    for (let i = 0; i < 50; i++) {
      const ids = gameLineup(DB.teams[0]);
      expect(new Set(ids).size).toBe(9);
    }
    simWholeSeason();
    DB.teams.forEach((t) => {
      const bench = t.roster.filter((p) => !t.battingOrder.includes(p) && p.stats.pa > 0);
      expect(bench.length).toBeGreaterThan(0);
    });
  });
});
