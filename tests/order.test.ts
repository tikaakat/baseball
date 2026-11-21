import { describe, expect, it } from 'vitest';
import { swapBatters } from '../src/engine/lineup';
import { pitchingStyleFor } from '../src/engine/pitching';
import { hardResetLeague } from '../src/engine/season';
import { DB } from '../src/engine/state';
import { swapPitcherRoles } from '../src/engine/team';

describe('オーダー（2人タップで入れ替え）', () => {
  it('スタメン同士は打順だけ、控えとはスタメンと守備位置ごと入れ替わる', () => {
    hardResetLeague();
    const t = DB.teams[0];
    const [a, b] = [t.battingOrder[0], t.battingOrder[3]];
    const [posA, posB] = [a.pos, b.pos];
    expect(swapBatters(t, a.id, b.id)).toBe(true);
    expect(t.battingOrder[0]).toBe(b); expect(t.battingOrder[3]).toBe(a);
    expect([a.pos, b.pos]).toEqual([posA, posB]);
    expect(t.lineupManual).toBe(true);

    const bench = t.roster.find((p) => !t.battingOrder.includes(p))!;
    const starter = t.battingOrder[5], starterPos = starter.pos, benchPos = bench.pos;
    swapBatters(t, bench.id, starter.id);
    expect(t.battingOrder[5]).toBe(bench);
    expect(bench.pos).toBe(starterPos); expect(starter.pos).toBe(benchPos);
    expect(new Set(t.battingOrder).size).toBe(9);
  });

  it('投手は役割（先発◯番手・抑え・セットアッパー）が入れ替わる', () => {
    hardResetLeague();
    const t = DB.teams[0];
    const starter = t.staff.rotation[2], closer = t.staff.closer!, setup = t.staff.setup!;
    swapPitcherRoles(t, starter, closer);
    expect(t.staff.rotation[2]).toBe(closer); expect(t.staff.closer).toBe(starter);
    swapPitcherRoles(t, setup, starter);
    expect(t.staff.setup).toBe(starter); expect(t.staff.closer).toBe(setup);
    const plain = t.pitchers.find((p) => !t.staff.rotation.includes(p.id) && p.id !== t.staff.closer && p.id !== t.staff.setup)!;
    swapPitcherRoles(t, plain.id, t.staff.rotation[0]);
    expect(t.staff.rotation[0]).toBe(plain.id);
    expect(new Set(t.staff.rotation).size).toBe(t.staff.rotation.length);
    expect(t.staffManual).toBe(true);
  });

  it('監督の采配タイプで継投の方針が決まる', () => {
    expect(pitchingStyleFor('oldschool').key).toBe('complete');
    expect(pitchingStyleFor('defense').key).toBe('bullpen');
    expect(pitchingStyleFor('aggressive').key).toBe('standard');
  });
});
