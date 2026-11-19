/* 画面全体の描画とタブ切り替え */
import { renderHistory, wireHistoryEvents } from './history';
import { renderHowTo, wireHowToEvents } from './howto';
import { renderLeaders, wireLeaderEvents } from './leaders';
import { modalHTML, wireModalEvents } from './modal';
import { renderPlayTab, wirePlayEvents } from './play';
import { renderRoster, wireRosterEvents } from './roster';
import { renderStandings, wireStandingsEvents } from './standings';
import { $, $$ } from './format';
import { saveErrorMessage, scheduleSave } from './persist';
import { UI, type TabKey } from './state';

function tabBtn(key: TabKey, icon: string, label: string): string {
  return `<button class="tabbtn ${UI.tab === key ? 'active' : ''}" data-tab="${key}"><span class="ic">${icon}</span>${label}</button>`;
}

export function render(): void {
  const app = $('#app')!;
  app.innerHTML = `
    <div class="hero">
      <h1>⬡ 六角鉛筆ベースボール ⬡</h1>
    </div>
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
  `;
  $$('.tabbtn').forEach((b) => {
    b.onclick = () => { UI.tab = b.dataset.tab as TabKey; UI.flash = null; render(); };
  });
  renderSection();
  wireModalEvents();
  scheduleSave();
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
