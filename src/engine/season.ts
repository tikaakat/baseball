/* リーグの初期化とシーズン移行 */
import { DEFAULT_LEAGUE_NAMES } from './data';
import { resetPlayerForNewSeason, resetPlayerSeq } from './player';
import { createSchedule } from './schedule';
import { finalizeStandings } from './standings';
import { DB } from './state';
import { createTeams, forceRetireOldPlayers, hireNewManager, reorderBattingOrderByPerformance } from './team';
import type { ManagerChange, Player, Team } from './types';

/** 完全リセット：チーム名・選手も含めて全てを新規生成する */
export function hardResetLeague(): void {
  resetPlayerSeq();
  DB.currentSeasonNum = 1;
  DB.teams = createTeams();
  DB.schedule = createSchedule(DB.teams);
  DB.postseason = null;
  DB.leagueNames = { ...DEFAULT_LEAGUE_NAMES };
  DB.gachaDoneThisCycle = false;
}

/** シーズン移行：チーム名・選手・通算成績はそのまま、今シーズンの成績・日程・ポストシーズンを新しくする */
export function startNewSeason(): void {
  // 今シーズンの順位からAクラス/Bクラスを判定し、監督の進退に反映する
  const { H, B } = finalizeStandings();
  const rankMap: Record<string, number> = {};
  H.forEach((t, i) => { rankMap[t.id] = i + 1; });
  B.forEach((t, i) => { rankMap[t.id] = i + 1; });

  let allRetired: { team: Team; out: Player; in: Player }[] = [];
  const managerChanges: ManagerChange[] = [];
  DB.teams.forEach((t) => {
    const rank = rankMap[t.id] || 1;
    t.consecutiveBClass = rank > 3 ? (t.consecutiveBClass || 0) + 1 : 0;

    reorderBattingOrderByPerformance(t);

    t.wins = 0; t.losses = 0; t.ties = 0; t.runsFor = 0; t.runsAgainst = 0;
    t.roster.forEach((p) => resetPlayerForNewSeason(p));
    allRetired = allRetired.concat(forceRetireOldPlayers(t));

    if (t.manager) t.manager.tenureYears--;
    const shouldReplace = !t.manager || t.manager.tenureYears <= 0 || t.consecutiveBClass >= 3;
    if (shouldReplace) {
      const oldLabel = t.manager ? t.manager.label : null;
      const reason = t.manager && t.manager.tenureYears <= 0 ? '任期満了' : (t.consecutiveBClass >= 3 ? `Bクラス${t.consecutiveBClass}年連続` : '新規就任');
      if (t.manager) {
        if (!t.managerHistory) t.managerHistory = [];
        t.managerHistory.push({ ...t.manager, leftSeason: DB.currentSeasonNum || 1 });
      }
      hireNewManager(t);
      managerChanges.push({ team: t.name, from: oldLabel, to: t.manager!.label, reason });
      t.consecutiveBClass = 0; // 新監督で心機一転
    }
  });
  DB.lastForcedRetirements = allRetired;
  DB.lastManagerChanges = managerChanges;
  DB.currentSeasonNum = (DB.currentSeasonNum || 1) + 1;
  DB.schedule = createSchedule(DB.teams);
  DB.postseason = null;
  DB.gachaDoneThisCycle = false;
}
