import { describe, expect, it, vi } from 'vitest';
import { emptyBases, finalizeAtBat } from '../src/engine/atbat';
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
  it('一発攻勢（パワー+20%）の監督だと、同じ出目でも二塁打が本塁打に伸びる', () => {
    hardResetLeague();
    const atBat = (managerType: string) => {
      const game = newGame(DB.teams[0], DB.teams[1], null); // 1回表：攻撃はビジター（DB.teams[1]）
      game.away.manager!.type = managerType;
      const batter = { ...game.away.roster[0], power: 150, speed: 1, ability: null };
      // 乱数を固定：パワー150だと二塁打止まり、+20%（180）なら本塁打に伸びる値
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.07);
      try {
        return finalizeAtBat(batter, 'otto', 'double', emptyBases(), game).rawResult;
      } finally {
        spy.mockRestore();
      }
    };
    expect(atBat('none')).toBe('double');
    expect(atBat('power')).toBe('hr');
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
