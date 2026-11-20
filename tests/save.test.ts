import { describe, expect, it } from 'vitest';
import { newGame, rollStep } from '../src/engine/game';
import { autoCompletePostseason } from '../src/engine/postseason';
import { restoreState, serializeState } from '../src/engine/save';
import { hardResetLeague, startNewSeason } from '../src/engine/season';
import { DB, teamById } from '../src/engine/state';
import { gachaSwapAllTeams } from '../src/engine/team';
import { simWholeSeason } from './sim-helpers';

/** JSON 文字列を経由して保存→復元する（実際のストレージと同じ経路） */
function roundTrip(ui: Parameters<typeof serializeState>[0]) {
  const json = JSON.stringify(serializeState(ui));
  hardResetLeague(); // 別のリーグで上書きしてから復元できることを確かめる
  return restoreState(JSON.parse(json));
}

describe('セーブデータ', () => {
  it('シーズン途中のリーグを保存・復元でき、打順は同じ選手オブジェクトを指す', () => {
    hardResetLeague();
    DB.schedule.slice(0, 300).forEach((g) => {
      const game = newGame(teamById(g.home)!, teamById(g.away)!, g.id);
      while (!game.finished) rollStep(game);
    });
    const before = JSON.stringify(serializeState({ myTeamId: 't3', liveGame: null }).db);

    const ui = roundTrip({ myTeamId: 't3', liveGame: null });

    expect(ui.myTeamId).toBe('t3');
    expect(JSON.stringify(serializeState(ui).db)).toBe(before);
    DB.teams.forEach((t) => t.battingOrder.forEach((p) => expect(t.roster).toContain(p)));

    // 復元後もそのまま最後まで遊べる
    simWholeSeason();
    DB.teams.forEach((t) => expect(t.wins + t.losses + t.ties).toBe(144));
  });

  it('観戦中の試合（塁上の走者を含む）を途中から再開できる', () => {
    hardResetLeague();
    const g = DB.schedule[0];
    const game = newGame(teamById(g.home)!, teamById(g.away)!, g.id);
    for (let i = 0; i < 40 && !(game.bases.first || game.bases.second); i++) rollStep(game);

    const ui = roundTrip({ myTeamId: g.home, liveGame: game });
    const live = ui.liveGame!;

    expect(live.home).toBe(teamById(g.home));
    expect(live.score).toEqual(game.score);
    (['first', 'second', 'third'] as const).forEach((b) => {
      const runner = live.bases[b];
      if (runner) expect(live[game.half === 'top' ? 'away' : 'home'].roster).toContain(runner);
    });
    while (!live.finished) rollStep(live);
    expect(DB.schedule[0].played).toBe(true);
  });

  it('ポストシーズン後・数年後のデータも復元できる', () => {
    hardResetLeague();
    for (let y = 0; y < 3; y++) {
      simWholeSeason();
      autoCompletePostseason();
      gachaSwapAllTeams(null, null);
      if (y < 2) startNewSeason();
    }
    const champId = DB.postseason!.champion!.id;
    roundTrip({ myTeamId: null, liveGame: null });
    expect(DB.currentSeasonNum).toBe(3);
    expect(DB.postseason!.champion).toBe(teamById(champId));
    expect(DB.postseason!.series.JS!.teamA).toBe(teamById(DB.postseason!.series.JS!.teamA.id));
    expect(DB.teams.some((t) => (t.alumni || []).length > 0)).toBe(true);
  });

  it('旧版の保存データ（日程の「何日目」・ボックススコアが無い）も読み込んで続きから遊べる', () => {
    hardResetLeague();
    const g = DB.schedule[0];
    const game = newGame(teamById(g.home)!, teamById(g.away)!, g.id);
    rollStep(game);
    const data = JSON.parse(JSON.stringify(serializeState({ myTeamId: g.home, liveGame: game })));
    data.db.schedule.forEach((x: Record<string, unknown>) => { delete x.day; });
    delete data.ui.liveGame.box;
    hardResetLeague();
    const ui = restoreState(data);
    expect(DB.schedule.every((x) => x.day >= 1)).toBe(true);
    while (!ui.liveGame!.finished) rollStep(ui.liveGame!);
    simWholeSeason();
    DB.teams.forEach((t) => expect(t.wins + t.losses + t.ties).toBe(144));
  });

  it('旧版のバグで投手の今季成績が積み上がっていたら、読み込み時に通算へ移して今季を数え直す', () => {
    hardResetLeague();
    simWholeSeason();
    const data = JSON.parse(JSON.stringify(serializeState({ myTeamId: null, liveGame: null })));
    // 6シーズン分が積み上がった状態を再現（今季はまだ10試合）
    data.db.teams.forEach((t: { wins: number; losses: number; ties: number; pitchers: { pStats: { g: number; gs: number; w: number }; pCareer: { w: number } }[] }) => {
      t.wins = 6; t.losses = 4; t.ties = 0;
      t.pitchers.forEach((p) => { p.pStats.g *= 6; p.pStats.gs *= 6; p.pStats.w *= 6; });
    });
    const inflatedW = data.db.teams[0].pitchers.reduce((a: number, p: { pStats: { w: number } }) => a + p.pStats.w, 0);
    hardResetLeague();
    restoreState(data);
    const t = DB.teams[0];
    t.pitchers.forEach((p) => { expect(p.pStats.gs).toBeLessThanOrEqual(10); });
    expect(t.pitchers.reduce((a, p) => a + p.pCareer.w + p.pStats.w, 0)).toBe(inflatedW);
  });

  it('形式の違うデータは拒否し、リーグを壊さない', () => {
    hardResetLeague();
    const teamsBefore = DB.teams;
    expect(() => restoreState({ version: 999 } as never)).toThrow();
    expect(DB.teams).toBe(teamsBefore);
  });
});
