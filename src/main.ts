import './style.css';
import { GOATCOUNTER_CODE } from './config';
import { loadFromStorage } from './engine/save';
import { hardResetLeague } from './engine/season';
import { render } from './ui/app';
import { installSaveOnExit } from './ui/persist';
import { installPlayerSheetHandler } from './ui/player';
import { UI } from './ui/state';

async function start(): Promise<void> {
  const restored = await loadFromStorage();
  if (restored) {
    UI.myTeamId = restored.myTeamId;
    UI.liveGame = restored.liveGame;
  } else {
    hardResetLeague();
  }
  installSaveOnExit();
  installPlayerSheetHandler();
  render();
  registerServiceWorker();
  loadAnalytics();
}

/** オフラインでも遊べるように（本番ビルドのときだけ） */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 使えない環境では何もしない */ });
}

/** アクセス解析（config.ts にコードを設定したときだけ。Cookieを使わない GoatCounter） */
function loadAnalytics(): void {
  if (!import.meta.env.PROD || !GOATCOUNTER_CODE) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.appendChild(s);
}

void start();
