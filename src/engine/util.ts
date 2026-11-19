/* 乱数などの汎用ユーティリティ */

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function choice<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** 重み付き抽選（重みの合計が1未満なら最後のキーにフォールバック） */
export function weightedChoice<K extends string>(weightMap: Record<K, number>): K {
  const r = Math.random();
  let acc = 0;
  const keys = Object.keys(weightMap) as K[];
  for (const key of keys) {
    acc += weightMap[key];
    if (r < acc) return key;
  }
  return keys[keys.length - 1];
}
/** 重み付き抽選（合計が1未満なら残りは「該当なし」） */
export function pickWeightedOrNone<K extends string>(affinity: Partial<Record<K, number>>): K | null {
  const r = Math.random();
  let acc = 0;
  for (const key of Object.keys(affinity) as K[]) {
    acc += affinity[key] ?? 0;
    if (r < acc) return key;
  }
  return null;
}
/** 能力値 1〜256 → 0〜1 */
export function frac(v: number): number {
  return Math.max(0, Math.min(1, (v - 1) / 255));
}
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
