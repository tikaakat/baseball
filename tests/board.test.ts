import { describe, expect, it } from 'vitest';
import { batterCard, cellOf, getAtBatModel, pitcherCard, BATTER_CELLS, PITCHER_CELLS } from '../src/engine/board';
import { leagueReport } from './league-report';

describe('対戦表方式', () => {
  it('36通りの出目が、打者21マス・投手15マスにちょうど1回ずつ対応する', () => {
    const seen = new Set<string>();
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
      const c = cellOf(a, b);
      expect(c.index).toBeLessThan(c.side === 'batter' ? BATTER_CELLS : PITCHER_CELLS);
      seen.add(`${c.side}${c.index}`);
    }
    expect(seen.size).toBe(36);
  });

  it('強打者の表には本塁打が多く、好投手の表には三振が多い', () => {
    const count = (cells: string[][], r: string) => cells.flat().filter((x) => x === r).length;
    const weak = batterCard({ power: 40, contact: 120, speed: 120 } as never);
    const strong = batterCard({ power: 240, contact: 120, speed: 120 } as never);
    expect(count(strong, 'hr')).toBeGreaterThan(count(weak, 'hr'));
    const ace = pitcherCard({ pitch: { stuff: 240, control: 200 } } as never);
    const poor = pitcherCard({ pitch: { stuff: 40, control: 60 } } as never);
    expect(count(ace, 'k')).toBeGreaterThan(count(poor, 'k'));
    expect(ace.every((c) => c.length === 6)).toBe(true);
  });

  it('シーズンを回すとNPBらしい数字になる', () => {
    expect(getAtBatModel()).toBe('board'); // 標準は対戦表方式
    const r = leagueReport(2);
    expect(r.AVG).toBeGreaterThan(0.230); expect(r.AVG).toBeLessThan(0.265);
    expect(r['HR/team']).toBeGreaterThan(70); expect(r['HR/team']).toBeLessThan(140);
    expect(r.ERA).toBeGreaterThan(3.0); expect(r.ERA).toBeLessThan(4.6);
  });
});
