/*
 * 永続ストレージの窓口。
 * 1. Claude アーティファクトの window.storage があればそれを使う
 * 2. なければブラウザの localStorage（GitHub Pages などの通常環境）
 * 3. どちらも使えなければメモリ上（タブを閉じると消える）
 */

/** Claude アーティファクト環境が提供する保存API */
interface ArtifactStorage {
  get(key: string, shared: boolean): Promise<{ value?: string } | null>;
  set(key: string, value: string, shared: boolean): Promise<unknown>;
  delete?(key: string, shared: boolean): Promise<unknown>;
}
declare global {
  interface Window { storage?: ArtifactStorage }
}

const KEY_PREFIX = 'pencil-baseball:';
const memory = new Map<string, string>();

function artifactStorage(): ArtifactStorage | null {
  return typeof window !== 'undefined' && window.storage ? window.storage : null;
}

function localStorageOrNull(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = KEY_PREFIX + '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null; // プライベートブラウズ等で使えない
  }
}

/** 次に開いたときもデータが残る環境かどうか */
export const STORAGE_AVAILABLE = !!artifactStorage() || !!localStorageOrNull();

export async function kvGet(key: string): Promise<string | null> {
  const art = artifactStorage();
  if (art) {
    try {
      const res = await art.get(key, false);
      return res?.value ?? null;
    } catch {
      return null; // 未保存
    }
  }
  const ls = localStorageOrNull();
  if (ls) return ls.getItem(KEY_PREFIX + key);
  return memory.get(key) ?? null;
}

/** 保存できたら true */
export async function kvSet(key: string, value: string): Promise<boolean> {
  const art = artifactStorage();
  if (art) return !!(await art.set(key, value, false));
  const ls = localStorageOrNull();
  if (ls) {
    ls.setItem(KEY_PREFIX + key, value); // 容量超過などは例外として呼び出し元へ
    return true;
  }
  memory.set(key, value);
  return true;
}

export async function kvRemove(key: string): Promise<void> {
  const art = artifactStorage();
  if (art) {
    if (art.delete) await art.delete(key, false);
    else await art.set(key, '', false);
    return;
  }
  const ls = localStorageOrNull();
  if (ls) ls.removeItem(KEY_PREFIX + key);
  memory.delete(key);
}
