import './style.css';
import { loadFromStorage } from './engine/save';
import { hardResetLeague } from './engine/season';
import { render } from './ui/app';
import { installSaveOnExit } from './ui/persist';
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
  render();
}

void start();
