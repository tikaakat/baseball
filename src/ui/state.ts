/* 画面の状態 */
import type { AbilityKey, GachaResult, Game, SeasonRecord } from '../engine/types';

export type TabKey = 'play' | 'standings' | 'leaders' | 'roster' | 'history' | 'howto';

export type Modal =
  | { type: 'confirm'; message: string; onConfirm: () => void }
  | { type: 'editTeam'; teamId: string; name: string; tagline: string }
  | { type: 'editLeague'; code: string; name: string }
  | { type: 'editPlayer'; playerId: string; name: string; age: number; power: number; contact: number; speed: number; ability: AbilityKey | ''; pitch: { stuff: number; control: number; stamina: number } | null };

export interface UIState {
  tab: TabKey;
  liveGame: Game | null;
  flash: string | null;
  leaderCat: string;
  leaderLeague: string;
  leaderMode: 'bat' | 'pitch';
  pitchLeaderCat: string;
  rosterTeamId: string | null;
  rosterStatMode: 'season' | 'career';
  rolling: boolean;
  myTeamId: string | null;
  modal: Modal | null;
  gachaResults: GachaResult[] | null;
  gachaSelecting: boolean;
  gachaMySelection: string | null;
  seasonHistory: SeasonRecord[] | null;
  seasonHistoryLoading: boolean;
  /** 直前に球団史へ記録したシーズン（共有ボタン用） */
  lastArchived: SeasonRecord | null;
  /** 球団史の小タブ・選んでいるシーズン・歴代ランキングの種目・ニュースの絞り込み */
  historyTab?: string;
  historySeason?: number | null;
  allTimeCat?: string;
  newsFilter?: string;
  /** 名鑑・遊び方の小タブ */
  rosterTab?: string;
  howtoTab?: string;
}

export const UI: UIState = {
  tab: 'play', liveGame: null, flash: null, leaderCat: 'avg', leaderLeague: 'ALL', leaderMode: 'bat', pitchLeaderCat: 'era',
  rosterTeamId: null, rosterStatMode: 'season', rolling: false, myTeamId: null, modal: null,
  gachaResults: null, gachaSelecting: false, gachaMySelection: null,
  seasonHistory: null, seasonHistoryLoading: false, lastArchived: null,
};

/** シーズンが切り替わったときに画面の一時状態を片付ける */
export function resetTransientUi(): void {
  UI.liveGame = null; UI.flash = null; UI.rosterTeamId = null;
  UI.gachaResults = null; UI.gachaSelecting = false; UI.gachaMySelection = null;
}
