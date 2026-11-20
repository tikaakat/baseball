/*
 * 対戦表（36マス）の表示。縦＝打者の鉛筆の出目、横＝投手の鉛筆の出目。
 * 左下（打者の数 ≧ 投手の数）が打者の表、右上（投手の数が大きい）が投手の表。
 */
import { cellAt, cellOf, isSplit, type BoardResult, type Cell } from '../engine/board';

export const RESULT_SHORT: Record<BoardResult, string> = {
  single: 'ヒット', double: '2塁打', hr: 'HR', walk: '四球', k: '三振', groundout: 'ゴロ', flyout: 'フライ',
};
const ORDER: BoardResult[] = ['hr', 'double', 'single', 'walk', 'k', 'groundout', 'flyout'];

/** マス1つの中身（分かれたマスは色を割合で塗り分け、2つの結果を小さく出す） */
function cellInner(cell: Cell): string {
  if (!isSplit(cell)) return `<span>${RESULT_SHORT[cell[0]]}</span>`;
  const kinds = ORDER.filter((r) => cell.includes(r));
  const stops: string[] = []; const lines: string[] = []; let at = 0;
  kinds.forEach((r) => {
    const n = cell.filter((x) => x === r).length;
    stops.push(`var(--r-${r}) ${(at / 6) * 100}% ${((at + n) / 6) * 100}%`);
    // 3本目の出目のどこがこの結果か（例：1-2）
    lines.push(`<b>${RESULT_SHORT[r]}<small>${n === 1 ? at + 1 : `${at + 1}-${at + n}`}</small></b>`);
    at += n;
  });
  return `<span class="split" style="--split:linear-gradient(to right, ${stops.join(',')});">${lines.join('')}</span>`;
}

const toneOf = (cell: Cell): string => (isSplit(cell) ? 'split' : cell[0]);

export function boardGridHTML(board: { batter: Cell[]; pitcher: Cell[] }, opts: { batterName: string; pitcherName: string; highlight?: { a: number; b: number } | null }): string {
  const nums = [1, 2, 3, 4, 5, 6];
  const head = `<div class="bd-corner"><span>投→</span><span>打↓</span></div>${nums.map((b) => `<div class="bd-head">${b}</div>`).join('')}`;
  const rows = nums.map((a) => `<div class="bd-head">${a}</div>${nums.map((b) => {
    const cell = cellAt(board, a, b);
    const side = cellOf(a, b).side;
    const on = opts.highlight && opts.highlight.a === a && opts.highlight.b === b;
    return `<div class="bd-cell r-${toneOf(cell)} ${side} ${on ? 'on' : ''}" data-cell="${a}-${b}">${cellInner(cell)}</div>`;
  }).join('')}`).join('');
  return `
  <div class="board-wrap">
    <div class="board-title"><span class="bt-batter">■ ${opts.batterName}の表</span>（打者の数≧投手）<span class="bt-vs"></span><span class="bt-pitcher">■ ${opts.pitcherName}の表</span>（投手の数が大）</div>
    <div class="board-grid">${head}${rows}</div>
    <div class="board-legend">${ORDER.map((r) => `<span><i class="r-${r}"></i>${RESULT_SHORT[r]}</span>`).join('')}<span><i class="r-split"></i>2色のマス＝3本目の数で決める</span></div>
  </div>`;
}

/** 選手シートなどに出す、その選手の表（21マス or 15マス）の中身 */
export function cardSummaryHTML(cells: Cell[], title: string, note: string): string {
  const units: Partial<Record<BoardResult, number>> = {};
  cells.flat().forEach((r) => { units[r] = (units[r] ?? 0) + 1; });
  const total = cells.length * 6;
  const segs = ORDER.filter((r) => units[r]).map((r) => {
    const n = units[r]! / 6;
    const txt = Number.isInteger(n) ? `${n}` : n.toFixed(1);
    return `<div class="seg r-${r}" style="flex:${units[r]! / total}">${units[r]! / total >= 0.09 ? `${RESULT_SHORT[r]}<small>${txt}</small>` : units[r]! / total >= 0.045 ? `<small>${txt}</small>` : ''}</div>`;
  }).join('');
  const legend = ORDER.filter((r) => units[r]).map((r) => {
    const n = units[r]! / 6;
    return `<span><i class="r-${r}"></i>${RESULT_SHORT[r]} ${Number.isInteger(n) ? n : n.toFixed(1)}</span>`;
  }).join('');
  return `<div class="pencil-bars"><div class="pencil-title">${title}</div><div class="pencil-bar">${segs}</div><div class="pencil-legend">${legend}</div><div class="sub" style="font-size:10px;">${note}</div></div>`;
}
