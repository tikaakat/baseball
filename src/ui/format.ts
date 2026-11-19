/* 表示用のヘルパー */
import { GRADE_TIERS } from '../engine/data';
import type { Player } from '../engine/types';

export function $<T extends HTMLElement = HTMLElement>(sel: string): T | null {
  return document.querySelector<T>(sel);
}
export function $$<T extends HTMLElement = HTMLElement>(sel: string): NodeListOf<T> {
  return document.querySelectorAll<T>(sel);
}

export function gradeOf(v: number): string {
  for (const t of GRADE_TIERS) if (v >= t.min) return t.grade;
  return 'G';
}
function gradeColorOf(v: number): string {
  for (const t of GRADE_TIERS) if (v >= t.min) return t.color;
  return '#9a9a9a';
}
export function gradeBadge(v: number): string {
  return `<span style="display:inline-block;background:${gradeColorOf(v)};color:#1a1208;font-weight:900;border-radius:4px;padding:0px 6px;font-size:11px;line-height:1.5;">${gradeOf(v)}</span>`;
}

export function fmt3(n: number): string { return isFinite(n) ? n.toFixed(3).replace(/^0\./, '.') : '.---'; }
/** SLG/OPSは1.000を超えうるので先頭の0を消さない */
export function fmt3plain(n: number): string { return isFinite(n) ? n.toFixed(3) : '.000'; }
export function formatNumber(n: number | null): string { return n == null ? '--' : String(n).padStart(2, '0'); }

export function sanitizeText(s: unknown, maxLen = 30): string {
  return String(s == null ? '' : s).replace(/[<>&"']/g, '').trim().slice(0, maxLen);
}
export function escapeAttr(s: unknown): string {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 同じ苗字の選手がいる場合だけ、下の名前の頭文字を小さく添えて区別する */
export function nameBadge(player: Player, contextPlayers: Player[]): string {
  const dupe = contextPlayers.filter((x) => x.name === player.name).length > 1;
  if (!dupe) return player.name;
  return `<span style="position:relative;display:inline-block;padding-right:11px;">${player.name}<span style="position:absolute;right:-2px;bottom:-4px;font-size:9.5px;line-height:1;color:var(--pencil);font-weight:700;">${player.given.charAt(0)}</span></span>`;
}

/** 能力の評価バッジ（野手：パワー・ミート・走力／投手：球威・制球・スタミナ） */
export function abilityBadges(p: Player): string {
  if (p.pitch) return `球威${gradeBadge(p.pitch.stuff)}　制球${gradeBadge(p.pitch.control)}　スタミナ${gradeBadge(p.pitch.stamina)}`;
  return `パワー${gradeBadge(p.power)}　ミート${gradeBadge(p.contact)}　走力${gradeBadge(p.speed)}`;
}
/** 能力の評価（短い文字だけ） */
export function abilityShort(p: Player): string {
  if (p.pitch) return `球威${gradeOf(p.pitch.stuff)}/制球${gradeOf(p.pitch.control)}/ス${gradeOf(p.pitch.stamina)}`;
  return `P${gradeOf(p.power)}/C${gradeOf(p.contact)}/S${gradeOf(p.speed)}`;
}
/** 防御率の表記 */
export function fmtEra(n: number): string { return isFinite(n) ? n.toFixed(2) : '-.--'; }
