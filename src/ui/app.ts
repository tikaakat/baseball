/* 画面全体の描画とタブ切り替え */
import { renderHistory } from './history';
import { renderHowTo } from './howto';
import { renderLeaders, wireLeaderEvents } from './leaders';
import { modalHTML, wireModalEvents } from './modal';
import { renderPlayTab, wirePlayEvents } from './play';
import { renderRoster, wireRosterEvents } from './roster';
import { renderStandings, wireStandingsEvents } from './standings';
import { $, $$ } from './format';
import { UI, type TabKey } from './state';

function tabBtn(key: TabKey, label: string): string {
  return `<button class="tabbtn ${UI.tab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`;
}

export function render(): void {
  const app = $('#app')!;
  app.innerHTML = `
    <div class="hero">
      <h1>⬡ 六角鉛筆ベースボール ⬡</h1>
      <p>鉛筆を転がして戦う、12球団リーグ戦プロトタイプ</p>
    </div>
    <div class="tabbar">
      ${tabBtn('play', '▶ 試合')}
      ${tabBtn('standings', '📊 順位表')}
      ${tabBtn('leaders', '🏆 個人成績')}
      ${tabBtn('roster', '📋 選手名鑑')}
      ${tabBtn('history', '🏛 球団史')}
      ${tabBtn('howto', '📖 遊び方')}
    </div>
    <div class="section" id="section"></div>
    <div id="modalRoot">${modalHTML()}</div>
  `;
  $$('.tabbtn').forEach((b) => {
    b.onclick = () => { UI.tab = b.dataset.tab as TabKey; UI.flash = null; render(); };
  });
  renderSection();
  wireModalEvents();
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
      break;
    case 'howto':
      sec.innerHTML = renderHowTo();
      break;
  }
}
