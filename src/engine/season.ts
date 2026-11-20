/* リーグの初期化とシーズン移行 */
import { DEFAULT_LEAGUE_NAMES } from './data';
import { resetPlayerForNewSeason, resetPlayerSeq } from './player';
import { createSchedule } from './schedule';
import { emptyPitchLine, emptyStatLine } from './stats';
import { finalizeStandings } from './standings';
import { DB } from './state';
import { reviewRegulars } from './lineup';
import { assignStaffRoles, createTeams, hireNewManager, managerName, retireVeterans } from './team';
import { addNews } from './news';
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
  DB.news = [];
  DB.records = {};
  DB.recordNewsThisSeason = [];
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

    reviewRegulars(t); // 今季の成績をもとに、レギュラーと打順を見直す

    t.wins = 0; t.losses = 0; t.ties = 0; t.runsFor = 0; t.runsAgainst = 0;
    [...t.roster, ...t.pitchers].forEach((p) => resetPlayerForNewSeason(p, t.name)); // 野手も投手も
    allRetired = allRetired.concat(retireVeterans(t));
    if (!t.staffManual) assignStaffRoles(t); // 能力の変化に合わせて投手の役割を決め直す
    t.rotationIdx = 0;

    if (t.manager) { t.manager.tenureYears--; t.manager.age = (t.manager.age ?? 50) + 1; }
    const retiring = !!t.manager && (t.manager.age ?? 0) >= 70;
    const shouldReplace = !t.manager || t.manager.tenureYears <= 0 || t.consecutiveBClass >= 3 || retiring;
    if (shouldReplace) {
      const oldLabel = t.manager ? managerName(t.manager) : null;
      const reason = t.consecutiveBClass >= 3 ? `Bクラス${t.consecutiveBClass}年連続で解任` : retiring ? '高齢のため勇退' : t.manager ? '任期満了で退任' : '新規就任';
      if (t.manager) {
        if (!t.managerHistory) t.managerHistory = [];
        t.managerHistory.push({ ...t.manager, leftSeason: DB.currentSeasonNum || 1 });
      }
      hireNewManager(t);
      const m = t.manager!;
      managerChanges.push({ team: t.name, from: oldLabel, to: managerName(m), reason });
      addNews(`🧢 ${t.name}の新監督に${managerName(m)}氏（${m.age}歳${m.obNote ? `・球団OB ${m.obNote}` : ''}）が就任。采配は「${m.label}」。${oldLabel ? `前任の${oldLabel}氏は${reason}。` : ''}`, 'title', t.id, null);
      t.consecutiveBClass = 0; // 新監督で心機一転
    }
  });
  DB.lastForcedRetirements = allRetired;
  DB.lastManagerChanges = managerChanges;
  DB.currentSeasonNum = (DB.currentSeasonNum || 1) + 1;
  DB.schedule = createSchedule(DB.teams);
  DB.postseason = null;
  DB.gachaDoneThisCycle = false;
  DB.recordNewsThisSeason = [];
}

/** 今シーズンを最初からやり直す（選手・監督はそのまま、今季の成績・日程・ポストシーズンだけ白紙に） */
export function restartCurrentSeason(): void {
  DB.teams.forEach((t) => {
    t.wins = 0; t.losses = 0; t.ties = 0; t.runsFor = 0; t.runsAgainst = 0;
    t.rotationIdx = 0;
    if (t.manager) { t.manager.wins = 0; t.manager.losses = 0; t.manager.ties = 0; }
    [...t.roster, ...t.pitchers].forEach((p) => {
      p.stats = emptyStatLine(); p.psStats = emptyStatLine();
      p.pStats = emptyPitchLine(); p.psPStats = emptyPitchLine();
      p.recentDays = [];
    });
  });
  DB.schedule = createSchedule(DB.teams);
  DB.postseason = null;
  DB.gachaDoneThisCycle = false;
  DB.recordNewsThisSeason = [];
}
