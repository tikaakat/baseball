/* ゲーム全体で使うデータ型 */

export type P1Face = 'hit' | 'walk' | 'flyout' | 'groundout' | 'k' | 'otto';
export type P2Face = 'double' | 'hr' | 'k' | 'flyout' | 'groundout';
/** 1打席の最終結果 */
export type Outcome = 'hit' | 'double' | 'triple' | 'hr' | 'walk' | 'flyout' | 'groundout' | 'k' | 'error';

export type AbilityKey =
  | 'leadoff' | 'clutch' | 'bigSwing' | 'steady' | 'comeback' | 'luckySeven'
  | 'basesLoadedHero' | 'inningStarter' | 'goodEye' | 'lateInningPower' | 'stealer' | 'defenseAce';

export type GrowthType = 'early' | 'normal' | 'late';

export interface StatLine {
  pa: number; ab: number; bb: number; h: number; doubles: number; triples: number; hr: number;
  k: number; rbi: number; r: number; gidp: number; sac: number; errors: number; sb: number; cs: number;
}

export interface Awards {
  mvp: number; bestNine: number; psMvp: number; rookie: number; goldenGlove: number;
}

export interface Player {
  id: string;
  name: string;
  given: string;
  initial: string;
  pos: string;
  number: number | null;
  power: number;
  contact: number;
  speed: number;
  defense: number;
  ability: AbilityKey | null;
  age: number;
  growthType: GrowthType;
  debutSeason: number;
  stats: StatLine;
  career: StatLine;
  awards: Awards;
  seasonsPlayed: number;
  psStats: StatLine;
  gachaImmunitySeasons: number;
}

export interface ManagerEffects {
  statMult?: { power: number; contact: number; speed: number };
  gidpResist?: number;
  errorReduction?: number;
  stealBoost?: number;
  walkBoost?: number;
}

export interface ManagerType extends ManagerEffects {
  key: string;
  label: string;
  desc: string;
}

/**
 * チームに就任中の監督。
 * 効果（ManagerEffects）は本来ここに載る想定だが、現状の hireNewManager は効果をコピーしていない
 * （＝元のHTML版と同じく、監督の効果は実際には発揮されていない）。
 */
export interface Manager extends ManagerEffects {
  type: string;
  label: string;
  desc: string;
  hireSeason: number;
  tenureYears: number;
  wins: number;
  losses: number;
  ties: number;
  careerGames: number;
  leftSeason?: number;
}

export interface Alumnus {
  name: string;
  pos: string;
  age: number;
  seasonsPlayed: number;
  debutSeason: number;
  lastSeason: number;
  career: StatLine;
  awards: Awards;
}

export interface Team {
  id: string;
  name: string;
  league: string;
  tagline: string;
  roster: Player[];
  battingOrder: Player[];
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
  consecutiveBClass: number;
  manager: Manager | null;
  managerHistory: Manager[];
  alumni?: Alumnus[];
}

export interface ScheduleGame {
  id: string;
  home: string;
  away: string;
  played: boolean;
  result: { home: number; away: number; winner: Winner } | null;
  order: number;
}

export type Side = 'home' | 'away';
export type Winner = Side | 'tie';
export type BaseKey = 'first' | 'second' | 'third';
export type Bases = Record<BaseKey, Player | null>;

export interface ContactResult {
  nb: Bases;
  outsAdded: number;
  scored: Player[];
  desc: string;
  isSacFly: boolean;
  isGidp: boolean;
}

export interface Play extends ContactResult {
  p1: P1Face;
  p2: P2Face | null;
  usedPencil2: boolean;
  abilityNote: string | null;
  abilityKey: AbilityKey | null;
  batter: Player;
  rawResult: Outcome;
}

export interface LastPlay {
  p1: P1Face;
  p2: P2Face | null;
  abilityKey: AbilityKey | null;
  abilityNote: string | null;
}

export type SeriesKey = 'H1' | 'B1' | 'H2' | 'B2' | 'JS';

export interface Game {
  scheduleId: string | null;
  home: Team;
  away: Team;
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  bases: Bases;
  score: Record<Side, number>;
  orderIdx: Record<Side, number>;
  log: string[];
  finished: boolean;
  winner: Winner | null;
  pencilStage: 'ready' | 'awaitingPencil2';
  pendingP1: P1Face | null;
  /** 直前の打席（画面の演出用。保存できるよう選手オブジェクトは持たない） */
  lastPlay: LastPlay | null;
  battedThisGame: Set<string>;
  inningRuns: Record<Side, number[]>;
  hits: Record<Side, number>;
  errors: Record<Side, number>;
  seriesKey?: SeriesKey;
}

export interface SeriesGame {
  homeId: string;
  awayId: string;
  scoreHome: number;
  scoreAway: number;
  winnerId: string | null;
  tie: boolean;
}

export interface Series {
  teamA: Team;
  teamB: Team;
  winsA: number;
  winsB: number;
  winsToClinch: number;
  games: SeriesGame[];
  winner: Team | null;
  label: string;
  _key?: SeriesKey;
}

export interface Postseason {
  standings: { H: Team[]; B: Team[] };
  series: { H1: Series; B1: Series; H2: Series | null; B2: Series | null; JS: Series | null };
  champion: Team | null;
}

export interface GachaResult {
  team: Team;
  out: Player | null;
  in: Player | null;
  slot: number | null;
  skipped: boolean;
}

export interface ManagerChange {
  team: string;
  from: string | null;
  to: string;
  reason: string;
}

export interface DBState {
  teams: Team[];
  schedule: ScheduleGame[];
  postseason: Postseason | null;
  leagueNames: Record<string, string>;
  gachaDoneThisCycle: boolean;
  currentSeasonNum: number;
  lastForcedRetirements?: { team: Team; out: Player; in: Player }[];
  lastManagerChanges?: ManagerChange[];
  lastStorageError?: string;
}

/* ---- 球団史（保存される記録） ---- */
export interface LeaderEntry { name: string; team: string; value: number }
export interface AwardSummary { name: string; team: string; ops: number; avg: number; hr: number; rbi: number }
export interface PositionAward { pos: string; name: string; team: string; ops?: number; avg?: number; hr?: number; errors?: number }
export interface StandingRecord { teamId: string; name: string; rank: number; wins: number; losses: number; ties: number }

export interface SeasonRecord {
  seasonNum: number;
  savedAt: string;
  leagueNames: { H: string; B: string };
  standings: { H: StandingRecord[]; B: StandingRecord[] };
  champion: string | null;
  championTeamId: string | null;
  leaders: { avg: LeaderEntry[]; hr: LeaderEntry[]; rbi: LeaderEntry[] };
  mvp: { H: AwardSummary | null; B: AwardSummary | null };
  postseasonMvp: AwardSummary | null;
  bestNine?: { H: PositionAward[]; B: PositionAward[] };
  rookieOfYear?: { H: AwardSummary | null; B: AwardSummary | null };
  goldenGlove?: { H: PositionAward[]; B: PositionAward[] };
}
