/* 画面が更新されるたびに、少し間を置いて自動保存する */
import { saveToStorage } from '../engine/save';
import { UI } from './state';

const SAVE_DELAY_MS = 400;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;

export function saveErrorMessage(): string | null {
  return lastError;
}

async function saveNow(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  try {
    const ok = await saveToStorage({ myTeamId: UI.myTeamId, liveGame: UI.liveGame });
    lastError = ok ? null : '保存に失敗しました';
  } catch (e) {
    lastError = `保存に失敗しました（${e instanceof Error ? e.message : String(e)}）`;
    console.warn(lastError, e);
  }
}

export function scheduleSave(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void saveNow(); }, SAVE_DELAY_MS);
}

/** タブを閉じる・裏に回るときは待たずに保存する */
export function installSaveOnExit(): void {
  const flush = () => { if (timer) void saveNow(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
