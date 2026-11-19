/*
 * 進行中のリーグ（DB）と観戦中の試合を保存・復元する。
 * 打順・塁上の走者・シリーズの対戦チームなどはオブジェクト参照なので、保存時はIDに置き換え、
 * 復元時にロースターの実体へ結び直す。
 */
import { getPlayerSeq, setPlayerSeq } from './player';
import { DB } from './state';
import { kvGet, kvRemove, kvSet } from './storage';
import type { Bases, DBState, Game, Player, Postseason, Series, SeriesKey, Team } from './types';

const SAVE_KEY = 'league-save';
export const SAVE_VERSION = 1;

type Id = string;
type SavedTeam = Omit<Team, 'battingOrder'> & { battingOrder: Id[] };
type SavedSeries = Omit<Series, 'teamA' | 'teamB' | 'winner'> & { teamA: Id; teamB: Id; winner: Id | null };
interface SavedPostseason {
  standings: { H: Id[]; B: Id[] };
  series: Record<SeriesKey, SavedSeries | null>;
  champion: Id | null;
}
type SavedBases = Record<keyof Bases, Id | null>;
type SavedGame = Omit<Game, 'home' | 'away' | 'bases' | 'battedThisGame'> & {
  home: Id; away: Id; bases: SavedBases; battedThisGame: Id[];
};

export interface SaveData {
  version: number;
  savedAt: string;
  playerSeq: number;
  db: {
    teams: SavedTeam[];
    schedule: DBState['schedule'];
    postseason: SavedPostseason | null;
    leagueNames: DBState['leagueNames'];
    gachaDoneThisCycle: boolean;
    currentSeasonNum: number;
    lastManagerChanges?: DBState['lastManagerChanges'];
  };
  /** 画面側の状態（マイチーム・観戦中の試合など） */
  ui: { myTeamId: string | null; liveGame: SavedGame | null };
}

/* ---------- 保存（参照 → ID） ---------- */
const idOf = (x: { id: string } | null | undefined): Id | null => (x ? x.id : null);

function saveSeries(s: Series | null): SavedSeries | null {
  if (!s) return null;
  const { _key, ...rest } = s;
  void _key;
  return { ...rest, teamA: s.teamA.id, teamB: s.teamB.id, winner: idOf(s.winner) };
}

function savePostseason(ps: Postseason | null): SavedPostseason | null {
  if (!ps) return null;
  return {
    standings: { H: ps.standings.H.map((t) => t.id), B: ps.standings.B.map((t) => t.id) },
    series: {
      H1: saveSeries(ps.series.H1), B1: saveSeries(ps.series.B1),
      H2: saveSeries(ps.series.H2), B2: saveSeries(ps.series.B2), JS: saveSeries(ps.series.JS),
    },
    champion: idOf(ps.champion),
  };
}

function saveGame(g: Game | null): SavedGame | null {
  if (!g) return null;
  return {
    ...g,
    home: g.home.id, away: g.away.id,
    bases: { first: idOf(g.bases.first), second: idOf(g.bases.second), third: idOf(g.bases.third) },
    battedThisGame: [...g.battedThisGame],
  };
}

export function serializeState(ui: { myTeamId: string | null; liveGame: Game | null }): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    playerSeq: getPlayerSeq(),
    db: {
      teams: DB.teams.map((t) => ({ ...t, battingOrder: t.battingOrder.map((p) => p.id) })),
      schedule: DB.schedule,
      postseason: savePostseason(DB.postseason),
      leagueNames: DB.leagueNames,
      gachaDoneThisCycle: DB.gachaDoneThisCycle,
      currentSeasonNum: DB.currentSeasonNum,
      lastManagerChanges: DB.lastManagerChanges,
    },
    ui: { myTeamId: ui.myTeamId, liveGame: saveGame(ui.liveGame) },
  };
}

/* ---------- 復元（ID → 参照） ---------- */
class SaveFormatError extends Error {}

function must<T>(x: T | undefined | null, what: string): T {
  if (x == null) throw new SaveFormatError(`保存データが壊れています（${what}）`);
  return x;
}

/**
 * 保存データを DB に書き戻し、画面側の状態を返す。
 * データが不正なら例外を投げ、DB は変更しない。
 */
export function restoreState(data: SaveData): { myTeamId: string | null; liveGame: Game | null } {
  if (!data || data.version !== SAVE_VERSION) throw new SaveFormatError('保存データの形式が違います');

  const playerMap = new Map<Id, Player>();
  const teams: Team[] = data.db.teams.map((st) => {
    st.roster.forEach((p) => playerMap.set(p.id, p));
    const byId = new Map(st.roster.map((p) => [p.id, p] as const));
    return { ...st, battingOrder: st.battingOrder.map((id) => must(byId.get(id), `打順 ${id}`)) };
  });
  const teamMap = new Map(teams.map((t) => [t.id, t] as const));
  const team = (id: Id) => must(teamMap.get(id), `チーム ${id}`);
  const teamOrNull = (id: Id | null) => (id ? team(id) : null);
  const player = (id: Id | null) => (id ? must(playerMap.get(id), `選手 ${id}`) : null);

  const series = (s: SavedSeries | null, key: SeriesKey): Series | null =>
    s ? { ...s, teamA: team(s.teamA), teamB: team(s.teamB), winner: teamOrNull(s.winner), _key: key } : null;

  let postseason: Postseason | null = null;
  const sp = data.db.postseason;
  if (sp) {
    postseason = {
      standings: { H: sp.standings.H.map(team), B: sp.standings.B.map(team) },
      series: {
        H1: must(series(sp.series.H1, 'H1'), 'H1'), B1: must(series(sp.series.B1, 'B1'), 'B1'),
        H2: series(sp.series.H2, 'H2'), B2: series(sp.series.B2, 'B2'), JS: series(sp.series.JS, 'JS'),
      },
      champion: teamOrNull(sp.champion),
    };
  }

  let liveGame: Game | null = null;
  const sg = data.ui.liveGame;
  if (sg) {
    liveGame = {
      ...sg,
      home: team(sg.home), away: team(sg.away),
      bases: { first: player(sg.bases.first), second: player(sg.bases.second), third: player(sg.bases.third) },
      battedThisGame: new Set(sg.battedThisGame),
      box: sg.box ?? {}, // 古い保存データには無い
    };
  }

  // 古い保存データには「何日目」が無いので、試合順から割り振る
  const schedule = data.db.schedule.map((g) => (g.day ? g : { ...g, day: Math.floor((g.order - 1) / (teams.length / 2)) + 1 }));

  // ここまで例外が出なければ確定
  DB.teams = teams;
  DB.schedule = schedule;
  DB.postseason = postseason;
  DB.leagueNames = data.db.leagueNames;
  DB.gachaDoneThisCycle = data.db.gachaDoneThisCycle;
  DB.currentSeasonNum = data.db.currentSeasonNum;
  DB.lastManagerChanges = data.db.lastManagerChanges;
  DB.lastForcedRetirements = [];
  setPlayerSeq(data.playerSeq);

  return { myTeamId: data.ui.myTeamId && teamMap.has(data.ui.myTeamId) ? data.ui.myTeamId : null, liveGame };
}

/* ---------- ストレージとのやりとり ---------- */
export async function saveToStorage(ui: { myTeamId: string | null; liveGame: Game | null }): Promise<boolean> {
  return kvSet(SAVE_KEY, JSON.stringify(serializeState(ui)));
}

/** 保存データがあれば復元する。無い・壊れている場合は null（DB は変更しない） */
export async function loadFromStorage(): Promise<{ myTeamId: string | null; liveGame: Game | null } | null> {
  const raw = await kvGet(SAVE_KEY);
  if (!raw) return null;
  try {
    return restoreState(JSON.parse(raw) as SaveData);
  } catch (e) {
    console.warn('保存データを読み込めませんでした。新しいリーグで始めます。', e);
    return null;
  }
}

export async function clearSave(): Promise<void> {
  await kvRemove(SAVE_KEY);
}
