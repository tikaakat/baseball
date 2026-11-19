/* 画面で共通に使う小さな部品（小タブ・チップ・トースト） */

export interface SegItem { key: string; label: string }

/** 小タブ（画面の中を切り替える。data-seg="名前:キー"） */
export function segTabs(name: string, items: SegItem[], active: string): string {
  return `<div class="seg" role="tablist">${items
    .map((it) => `<button role="tab" class="${it.key === active ? 'active' : ''}" data-seg="${name}:${it.key}">${it.label}</button>`)
    .join('')}</div>`;
}

/** チップ（横スクロールする選択肢。data-chip="名前:キー"） */
export function chips(name: string, items: SegItem[], active: string): string {
  return `<div class="chips">${items
    .map((it) => `<button class="${it.key === active ? 'active' : ''}" data-chip="${name}:${it.key}">${it.label}</button>`)
    .join('')}</div>`;
}

/** data-seg / data-chip のクリックをまとめて拾う */
export function onPick(kind: 'seg' | 'chip', name: string, handler: (key: string) => void): void {
  document.querySelectorAll<HTMLElement>(`[data-${kind}^="${name}:"]`).forEach((b) => {
    b.onclick = () => handler(b.dataset[kind]!.slice(name.length + 1));
  });
}

/** 画面下に一時的なメッセージを出す */
export function showToast(msg: string, ms = 3800): void {
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
