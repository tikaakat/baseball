import { describe, expect, it } from 'vitest';
import { pencilsFor } from '../src/engine/atbat';
import { newGame } from '../src/engine/game';
import { MANAGER_TYPES } from '../src/engine/data';
import { hardResetLeague } from '../src/engine/season';
import { DB, leagueName } from '../src/engine/state';
import { managerEffects } from '../src/engine/team';
import type { AbilityKey } from '../src/engine/types';
import { resetSeasonKeepRosters, simWholeSeason } from './sim-helpers';

/** 同じ選手のまま全員に同じ能力を付けて2シーズン回し、リーグ合計の成績を返す */
function seasonWithAbility(ability: AbilityKey | null) {
  DB.teams.forEach((t) => t.roster.forEach((p) => { p.ability = ability; }));
  const tot = { pa: 0, bb: 0, sb: 0, errors: 0 };
  for (let i = 0; i < 2; i++) {
    resetSeasonKeepRosters();
    simWholeSeason();
    DB.teams.forEach((t) => t.roster.forEach((p) => {
      tot.pa += p.stats.pa; tot.bb += p.stats.bb; tot.sb += p.stats.sb; tot.errors += p.stats.errors;
    }));
  }
  return tot;
}

describe('特殊能力が実際に効く', () => {
  hardResetLeague();
  DB.teams.forEach((t) => { t.manager!.type = 'none'; }); // 監督効果なし
  const none = seasonWithAbility(null);

  it('選球眼：四球が増える', () => {
    const eye = seasonWithAbility('goodEye');
    expect(eye.bb / eye.pa).toBeGreaterThan((none.bb / none.pa) * 1.15);
  });
  it('俊足盗塁王：盗塁が増える', () => {
    expect(seasonWithAbility('stealer').sb).toBeGreaterThan(none.sb * 1.25);
  });
  it('守備の達人：失策が減る', () => {
    expect(seasonWithAbility('defenseAce').errors).toBeLessThan(none.errors * 0.7);
  });
  it('先頭打者：安打が増える／逆転の一発：長打が増える（同じ選手で4シーズンずつ比較）', () => {
    const hitsAndXbh = (ability: AbilityKey | null) => {
      DB.teams.forEach((t) => t.roster.forEach((p) => { p.ability = ability; }));
      let h = 0, xbh = 0;
      for (let i = 0; i < 4; i++) {
        resetSeasonKeepRosters();
        simWholeSeason();
        DB.teams.forEach((t) => t.roster.forEach((p) => { h += p.stats.h; xbh += p.stats.doubles + p.stats.triples + p.stats.hr; }));
      }
      return { h, xbh };
    };
    const base = hitsAndXbh(null);
    expect(hitsAndXbh('inningStarter').h).toBeGreaterThan(base.h * 1.05);
    expect(hitsAndXbh('lateInningPower').xbh).toBeGreaterThan(base.xbh);
  });
});

describe('監督', () => {
  it('采配タイプから効果を引ける（保存データに効果が無くても効く）', () => {
    MANAGER_TYPES.forEach((t) => {
      expect(managerEffects({ type: t.key } as never)).toBe(t);
    });
    expect(managerEffects(null)).toEqual({});
  });
  it('監督の采配が打者の鉛筆に反映される', () => {
    hardResetLeague();
    const game = newGame(DB.teams[0], DB.teams[1], null); // 1回表：攻撃はビジター（DB.teams[1]）
    const batter = { ...game.away.roster[0], power: 150, contact: 150, speed: 150, ability: null };
    const pencilsWith = (type: string) => { game.away.manager!.type = type; return pencilsFor(batter, game); };
    const none = pencilsWith('none');
    expect(pencilsWith('power').p2.hr).toBeGreaterThan(none.p2.hr * 1.2);
    expect(pencilsWith('contactball').p1.hit).toBeGreaterThan(none.p1.hit);
    expect(pencilsWith('patient').p1.walk).toBeGreaterThan(none.p1.walk * 1.2);
  });
});

describe('打者の鉛筆', () => {
  it('どの能力でも各面の確率の合計は1で、パワーが高いほどHRの面が大きい', () => {
    hardResetLeague();
    const base = DB.teams[0].roster[0];
    for (const v of [1, 64, 128, 192, 256]) {
      const p = pencilsFor({ ...base, power: v, contact: v, speed: v }, null);
      const sum = (o: Record<string, number>) => Object.values(o).reduce((a, x) => a + x, 0);
      expect(sum(p.p1)).toBeCloseTo(1, 6);
      expect(sum(p.p2)).toBeCloseTo(1, 6);
      Object.values({ ...p.p1, ...p.p2 }).forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
    }
    const weak = pencilsFor({ ...base, power: 30 }, null), strong = pencilsFor({ ...base, power: 240 }, null);
    expect(strong.p2.hr).toBeGreaterThan(weak.p2.hr * 4);
  });
});

describe('リーグ名', () => {
  it('変更したリーグ名がポストシーズン・球団史用の呼び方（H/B）にも反映される', () => {
    hardResetLeague();
    DB.leagueNames.E = 'セントラル';
    expect(leagueName('H')).toBe('セントラル');
    expect(leagueName('B')).toBe('ウエストリーグ');
  });
});
