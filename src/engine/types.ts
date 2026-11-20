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

/** 投手成績（outs＝投球アウト数。投球回 = outs/3） */
export interface PitchLine {
  g: number; gs: number; w: number; l: number; sv: number;
  outs: number; bf: number; h: number; hr: number; bb: number; k: number; r: number;
}

/** 投手能力（1〜256） */
export interface PitchAttrs { stuff: number; control: number; stamina: number }

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
  /** 投手のみ：投手能力・成績（野手は null） */
  pitch: PitchAttrs | null;
  pStats: PitchLine;
  pCareer: PitchLine;
  psPStats: PitchLine;
  /** 投手のみ：最近登板した日（連投管理用） */
  recentDays?: number[];
  /** 年度別の成績（シーズンが終わるたびに追加） */
  yearly?: YearLine[];
}

export interface YearLine { season: number; team: string; age: number; stats: StatLine; pStats: PitchLine }

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

/** チームに就任中の監督。効果は type（MANAGER_TYPES の key）から managerEffects() で引く */
export interface Manager {
  /** 監督の名前・年齢（旧版の保存データには無いので読み込み時に補う） */
  name?: string;
  given?: string;
  age?: number;
  /** 球団OBの監督なら、選手時代の通算成績の要約 */
  obNote?: string;
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
  given?: string;
  pos: string;
  age: number;
  seasonsPlayed: number;
  debutSeason: number;
  lastSeason: number;
  career: StatLine;
  awards: Awards;
  isPitcher?: boolean;
  pCareer?: PitchLine;
}

/** 投手陣の役割（選手IDで持つ） */
export interface PitchingStaff {
  rotation: string[];
  closer: string | null;
  setup: string | null;
}

export interface Team {
  id: string;
  name: string;
  league: string;
  tagline: string;
  /** 野手（スタメン9人＋控え） */
  roster: Player[];
  /** 基本のスタメン打順（9人） */
  battingOrder: Player[];
  /** 投手（先発5人＋中継ぎ・抑え） */
  pitchers: Player[];
  staff: PitchingStaff;
  /** 次に先発するローテーションの番号 */
  rotationIdx: number;
  /** 打順の方針（AIは監督の采配タイプから決める） */
  lineupStyle?: import('./data').LineupStyleKey;
  /** プレイヤーが方針を選んだ（監督が替わっても変えない） */
  lineupStyleLocked?: boolean;
  /** 打順を手動で固定している（休養した選手の打順に控えが入る） */
  lineupManual?: boolean;
  /** 投手の役割を手動で決めている（AIの見直しをしない） */
  staffManual?: boolean;
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
  consecutiveBClass: number;
  manager: Manager | null;
  managerHistory: Manager[];
  alumni?: Alumnus[];
  /** 永久欠番 */
  retiredNumbers?: { number: number; name: string; season: number }[];
}

export interface ScheduleGame {
  id: string;
  home: string;
  away: string;
  played: boolean;
  result: { home: number; away: number; winner: Winner } | null;
  order: number;
  /** 何日目の試合か（1〜144） */
  day: number;
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
  /** 失策が記録された野手（失策でなければ null） */
  errorFielder: Player | null;
  /** 送りバント成功（打数に数えない） */
  isSacBunt?: boolean;
  /** 2本鉛筆方式の出目（試作） */
  /** 対戦表方式（試作）の出目：打者 a・投手 b・分かれたマスの3本目 c */
  board?: { a: number; b: number; c: number | null; side: 'batter' | 'pitcher' };
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
  board?: Play['board'];
}

export type SeriesKey = 'H1' | 'B1' | 'H2' | 'B2' | 'JS';

/** 1試合の個人打撃成績（ボックススコア） */
export interface BoxLine { pa: number; ab: number; h: number; hr: number; rbi: number; bb: number; k: number; r: number; sb: number }

/** 1試合の投手成績（ボックススコア） */
export interface PitchBoxLine { outs: number; bf: number; h: number; hr: number; bb: number; k: number; r: number; dec: 'W' | 'L' | 'S' | null; entryLead?: number }

export interface Game {
  scheduleId: string | null;
  /** 連投管理用の通し日付 */
  dayKey: number;
  /** この試合の打順（選手ID）。代打などで書き換わる */
  lineup: Record<Side, string[]>;
  /** いま投げている投手（選手ID） */
  pitcher: Record<Side, string>;
  /** 登板した投手の順（選手ID） */
  pitchersUsed: Record<Side, string[]>;
  /** 選手ID → この試合の投手成績 */
  pbox: Record<string, PitchBoxLine>;
  /** 勝ち越し時点の勝利・敗戦投手候補 */
  winCand: string | null;
  loseCand: string | null;
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
  /** 選手ID → この試合の打撃成績 */
  box: Record<string, BoxLine>;
  /** 交代でベンチに下がった選手（再出場できない） */
  removed: string[];
  /** プレイヤーが采配する側（観戦中のマイチーム）。AIはこの側の攻撃の作戦を立てない */
  manualSide: Side | null;
  /** 勝負所カードの表示状況 */
  cards: { shown: number; lastKey: string | null };
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

export interface NewsItem {
  season: number;
  day: number | null;
  text: string;
  kind: 'milestone' | 'feat' | 'record' | 'retire' | 'title';
  teamId: string | null;
}
export interface SeasonRecordHolder { value: number; name: string; team: string; season: number }

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
  /** ニュース（新しいものが後ろ） */
  news?: NewsItem[];
  /** リーグのシーズン記録 */
  records?: Partial<Record<'hr' | 'h' | 'sb' | 'w' | 'sv' | 'k', SeasonRecordHolder>>;
  /** 今シーズンすでにニュースにした記録 */
  recordNewsThisSeason?: string[];
  /** 遊び方の設定 */
  options?: { decisionCards?: boolean };
}

/* ---- 球団史（保存される記録） ---- */
export interface LeaderEntry { name: string; team: string; value: number }
export interface PitcherAwardSummary { name: string; team: string; era: number; w: number; l: number; sv: number; k: number; ip: string }
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
  pitchingLeaders?: { era: LeaderEntry[]; w: LeaderEntry[]; sv: LeaderEntry[]; k: LeaderEntry[] };
  /** リーグ最優秀投手（規定投球回以上で防御率最良） */
  bestPitcher?: { H: PitcherAwardSummary | null; B: PitcherAwardSummary | null };
}
