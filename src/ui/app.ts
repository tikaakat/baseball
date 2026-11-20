/* 画面全体の描画とタブ切り替え */
import { renderHistory, wireHistoryEvents } from './history';
import { renderHowTo, wireHowToEvents } from './howto';
import { renderLeaders, wireLeaderEvents } from './leaders';
import { modalHTML, wireModalEvents } from './modal';
import { renderPlayTab, wirePlayEvents } from './play';
import { renderRoster, wireRosterEvents } from './roster';
import { renderStandings, wireStandingsEvents } from './standings';
import { $, $$, shortTeamName } from './format';
import { showToast } from './components';
import { playerSheetHTML } from './player';
import { currentDay, regularSeasonComplete } from '../engine/schedule';
import { finalizeStandings } from '../engine/standings';
import { DB, teamById } from '../engine/state';
import { saveErrorMessage, scheduleSave } from './persist';
import { UI, type TabKey } from './state';

function tabBtn(key: TabKey, icon: string, label: string): string {
  return `<button class="tabbtn ${UI.tab === key ? 'active' : ''}" data-tab="${key}"><span class="ic">${icon}</span>${label}</button>`;
}

export function render(): void {
  const app = $('#app')!;
  app.innerHTML = `
    <header class="appbar">
      <div class="logo">⬡ 六角鉛筆ベースボール</div>
      <div class="ctx">${headerContext()}</div>
    </header>
    <nav class="tabbar">
      ${tabBtn('play', '⚾', '試合')}
      ${tabBtn('standings', '📊', '順位')}
      ${tabBtn('leaders', '🏆', '成績')}
      ${tabBtn('roster', '📋', '名鑑')}
      ${tabBtn('history', '🏛', '球団史')}
      ${tabBtn('howto', '📖', '遊び方')}
    </nav>
    ${saveErrorMessage() ? `<div class="flash">⚠ ${saveErrorMessage()}。この端末の空き容量やブラウザの設定を確認してください。</div>` : ''}
    <div class="section" id="section"></div>
    <div id="modalRoot">${modalHTML()}</div>
    ${playerSheetHTML()}
  `;
  $$('.tabbtn').forEach((b) => {
    b.onclick = () => { UI.tab = b.dataset.tab as TabKey; UI.flash = null; render(); };
  });
  renderSection();
  wireModalEvents();
  if (UI.flash) { showToast(UI.flash); UI.flash = null; }
  scheduleSave();
}

/** ヘッダー右側：シーズンと日付、マイチームの成績 */
function headerContext(): string {
  const day = currentDay(DB.schedule);
  const when = `第${DB.currentSeasonNum}季・${day ? `${day}日目` : regularSeasonComplete(DB.schedule) ? 'シーズン終了' : ''}`;
  const t = UI.myTeamId ? teamById(UI.myTeamId) : undefined;
  if (!t) return when;
  const { H, B } = finalizeStandings();
  const rank = [...H, ...B].filter((x) => x.league === t.league).indexOf(t) + 1;
  return `${when}<br><b>${shortTeamName(t.name)}</b> ${t.wins}-${t.losses}${t.ties ? '-' + t.ties : ''}・${rank}位`;
}

export function renderSection(): void {
  const sec = $('#section')!;
  switch (UI.tab) {
    case 'play':
      sec.innerHTML = renderPlayTab();
      wirePlayEvents();
      break;
    case 'standings':
      sec.innerHTML = renderStandings();
      wireStandingsEvents();
      break;
    case 'leaders':
      sec.innerHTML = renderLeaders();
      wireLeaderEvents();
      break;
    case 'roster':
      sec.innerHTML = renderRoster();
      wireRosterEvents();
      break;
    case 'history':
      sec.innerHTML = renderHistory();
      wireHistoryEvents();
      break;
    case 'howto':
      sec.innerHTML = renderHowTo();
      wireHowToEvents();
      break;
  }
}
