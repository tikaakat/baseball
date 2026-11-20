/*
 * 3Dの六角鉛筆。6つの面を持つ六角柱を CSS 3D で組み立て、机の上を転がって1つの面で止まる。
 * いまの遊び方（1本目・2本目）にも、対戦表方式（出目1〜6）にも使えるように、面の中身は外から渡す。
 */

export interface PencilFace { label: string; tone?: string }
export type PencilColor = 'yellow' | 'blue' | 'red' | 'green';

const STEP = 60; // 1面あたりの角度

/** 鉛筆のHTML。shown 番目の面が手前を向いた状態で描く（null なら止まっていない＝どの面も強調しない） */
export function pencil3dHTML(id: string, faces: PencilFace[], shown: number | null, opts: { color?: PencilColor; dim?: boolean; label?: string } = {}): string {
  const rest = shown ?? 0;
  const faceHtml = faces.map((f, i) => `
    <div class="p3d-face ${shown === i ? 'up' : ''}" style="transform:rotateX(${i * STEP}deg) translateZ(var(--p3d-r));">
      ${f.tone ? `<i class="p3d-dot seg-${f.tone}"></i>` : ''}<span>${f.label}</span>
    </div>`).join('');
  return `
  <div class="p3d ${opts.dim ? 'dim' : ''}" id="${id}" data-color="${opts.color ?? 'yellow'}" data-angle="${-rest * STEP}">
    ${opts.label ? `<div class="p3d-name">${opts.label}</div>` : ''}
    <div class="p3d-stage">
      <div class="p3d-shadow"></div>
      <div class="p3d-pencil">
        <div class="p3d-end"></div>
        <div class="p3d-body">
          <div class="p3d-prism" style="transform:rotateX(${-rest * STEP}deg);">${faceHtml}</div>
          <div class="p3d-light"></div>
        </div>
        <div class="p3d-tip"><div class="p3d-lead"></div></div>
      </div>
    </div>
  </div>`;
}

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 鉛筆を転がして target 番目の面で止める。終わったら resolve */
export function rollPencil3d(el: HTMLElement | null, target: number, durationMs = 820): Promise<void> {
  if (!el) return Promise.resolve();
  const prism = el.querySelector<HTMLElement>('.p3d-prism');
  const pencil = el.querySelector<HTMLElement>('.p3d-pencil');
  const shadow = el.querySelector<HTMLElement>('.p3d-shadow');
  if (!prism || !pencil || typeof prism.animate !== 'function') return Promise.resolve();
  el.classList.remove('dim');
  el.querySelectorAll('.p3d-face.up').forEach((f) => f.classList.remove('up'));

  const from = Number(el.dataset.angle ?? 0);
  // 手前に向かって2〜3回転して止まる（角度を減らす方向）
  const turns = 2 + Math.floor(Math.random() * 2);
  let to = -target * STEP;
  while (to > from - turns * 360) to -= 360;
  el.dataset.angle = String(to);
  const d = reducedMotion() ? 1 : durationMs;

  // 回転：勢いよく転がり、少し行き過ぎてから面で止まる（ゆらっと戻る）
  const spin = prism.animate([
    { transform: `rotateX(${from}deg)`, easing: 'cubic-bezier(.2,.55,.35,1)' },
    { transform: `rotateX(${to - 14}deg)`, offset: 0.78, easing: 'ease-in-out' },
    { transform: `rotateX(${to + 5}deg)`, offset: 0.9, easing: 'ease-in-out' },
    { transform: `rotateX(${to}deg)` },
  ], { duration: d, fill: 'forwards' });
  // 位置：奥から手前へ転がってきて、2回小さく跳ねる
  pencil.animate([
    { transform: 'translateY(-22px) scale(.86)', offset: 0 },
    { transform: 'translateY(-6px) scale(.97)', offset: 0.35 },
    { transform: 'translateY(-11px) scale(.99)', offset: 0.5 },
    { transform: 'translateY(0) scale(1)', offset: 0.68 },
    { transform: 'translateY(-3px) scale(1)', offset: 0.78 },
    { transform: 'translateY(0) scale(1)', offset: 0.88 },
    { transform: 'translateY(0) scale(1)', offset: 1 },
  ], { duration: d, easing: 'linear' });
  shadow?.animate([
    { transform: 'scaleX(.6)', opacity: 0.25, offset: 0 },
    { transform: 'scaleX(.85)', opacity: 0.5, offset: 0.35 },
    { transform: 'scaleX(.8)', opacity: 0.4, offset: 0.5 },
    { transform: 'scaleX(1)', opacity: 0.7, offset: 0.68 },
    { transform: 'scaleX(1)', opacity: 0.7, offset: 1 },
  ], { duration: d, easing: 'linear' });

  return spin.finished.then(() => {
    prism.style.transform = `rotateX(${to}deg)`;
    spin.cancel();
    el.querySelectorAll<HTMLElement>('.p3d-face')[target]?.classList.add('up');
  }, () => undefined);
}
