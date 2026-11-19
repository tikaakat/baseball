/* モーダル（埋め込み環境では alert/confirm/prompt が使えないため自前で用意） */
import { ABILITY_INFO, ABILITY_KEYS, DEFAULT_LEAGUE_NAMES, GRADE_MID } from '../engine/data';
import { DB, leagueName, playerById, teamById } from '../engine/state';
import type { AbilityKey } from '../engine/types';
import { render } from './app';
import { $, escapeAttr, gradeOf, sanitizeText } from './format';
import { UI } from './state';

export function openEditTeamModal(teamId: string): void {
  const t = teamById(teamId)!;
  UI.modal = { type: 'editTeam', teamId, name: t.name, tagline: t.tagline };
  render();
}
export function openEditLeagueModal(code: string): void {
  UI.modal = { type: 'editLeague', code, name: leagueName(code) };
  render();
}
export function openEditPlayerModal(playerId: string): void {
  const found = playerById(playerId);
  if (!found) return;
  const p = found.player;
  UI.modal = { type: 'editPlayer', playerId, name: p.name, age: p.age, power: p.power, contact: p.contact, speed: p.speed, ability: p.ability || '', pitch: p.pitch ? { ...p.pitch } : null };
  render();
}
export function openConfirmModal(message: string, onConfirm: () => void): void {
  UI.modal = { type: 'confirm', message, onConfirm };
  render();
}

function gradeSelectHTML(id: string, current: number): string {
  const currentGrade = gradeOf(current);
  const opts = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((g) => `<option value="${g}" ${g === currentGrade ? 'selected' : ''}>${g}</option>`).join('');
  return `<select id="${id}">${opts}</select>`;
}
function abilitySelectHTML(current: string): string {
  const opts = ['<option value="">なし</option>'].concat(
    ABILITY_KEYS.map((k) => `<option value="${k}" ${k === current ? 'selected' : ''}>${ABILITY_INFO[k].label}</option>`),
  ).join('');
  return `<select id="editPlayerAbility">${opts}</select>`;
}
function buttons(okId: string, okLabel: string): string {
  return `<div class="row" style="justify-content:flex-end;margin-top:14px;">
        <button class="btn secondary small" id="modalCancel">キャンセル</button>
        <button class="btn small" id="${okId}">${okLabel}</button>
      </div>`;
}

export function modalHTML(): string {
  const m = UI.modal;
  if (!m) return '';
  let inner = '';
  switch (m.type) {
    case 'confirm':
      inner = `<h2>確認</h2>
      <p>${escapeAttr(m.message)}</p>
      ${buttons('modalOk', 'OK')}`;
      break;
    case 'editTeam':
      inner = `<h2>チームを編集</h2>
      <label>チーム名</label>
      <input type="text" id="editTeamName" value="${escapeAttr(m.name)}" maxlength="20">
      <label>キャッチコピー</label>
      <input type="text" id="editTeamTagline" value="${escapeAttr(m.tagline)}" maxlength="40">
      ${buttons('modalSave', '保存')}`;
      break;
    case 'editLeague':
      inner = `<h2>リーグ名を編集</h2>
      <label>リーグ名</label>
      <input type="text" id="editLeagueName" value="${escapeAttr(m.name)}" maxlength="20">
      ${buttons('modalSave', '保存')}`;
      break;
    case 'editPlayer':
      inner = `<h2>選手を編集</h2>
      <label>選手名</label>
      <input type="text" id="editPlayerName" value="${escapeAttr(m.name)}" maxlength="12">
      <label>年齢</label>
      <input type="text" id="editPlayerAge" value="${escapeAttr(String(m.age))}" maxlength="3">
      ${m.pitch ? `
      <label>球威</label>${gradeSelectHTML('editPitchStuff', m.pitch.stuff)}
      <label>制球</label>${gradeSelectHTML('editPitchControl', m.pitch.control)}
      <label>スタミナ</label>${gradeSelectHTML('editPitchStamina', m.pitch.stamina)}` : `
      <label>パワー</label>${gradeSelectHTML('editPlayerPower', m.power)}
      <label>ミート</label>${gradeSelectHTML('editPlayerContact', m.contact)}
      <label>走力</label>${gradeSelectHTML('editPlayerSpeed', m.speed)}
      <label>特殊能力</label>${abilitySelectHTML(m.ability)}`}
      ${buttons('modalSave', '保存')}`;
      break;
  }
  return `<div class="modal-overlay"><div class="modal-box">${inner}</div></div>`;
}

const inputValue = (sel: string): string | null => $<HTMLInputElement | HTMLSelectElement>(sel)?.value ?? null;

function close(): void {
  UI.modal = null;
  render();
}

export function wireModalEvents(): void {
  const m = UI.modal;
  if (!m) return;
  const cancel = $('#modalCancel');
  if (cancel) cancel.onclick = close;

  if (m.type === 'confirm') {
    const ok = $('#modalOk');
    if (ok) ok.onclick = () => {
      UI.modal = null;
      m.onConfirm();
      render();
    };
    return;
  }
  const save = $('#modalSave');
  if (!save) return;
  save.onclick = () => {
    if (m.type === 'editTeam') {
      const t = teamById(m.teamId);
      if (t) {
        const newName = sanitizeText(inputValue('#editTeamName') ?? '', 20);
        if (newName) t.name = newName;
        t.tagline = sanitizeText(inputValue('#editTeamTagline') ?? '', 40);
      }
    } else if (m.type === 'editLeague') {
      const newName = sanitizeText(inputValue('#editLeagueName') ?? '', 20);
      if (newName) {
        if (!DB.leagueNames) DB.leagueNames = { ...DEFAULT_LEAGUE_NAMES };
        DB.leagueNames[m.code] = newName;
      }
    } else if (m.type === 'editPlayer') {
      const found = playerById(m.playerId);
      if (found) {
        const p = found.player;
        const newName = sanitizeText(inputValue('#editPlayerName') ?? '', 12);
        if (newName) p.name = newName;
        const ageStr = inputValue('#editPlayerAge');
        if (ageStr !== null) { const a = parseInt(ageStr, 10); if (a >= 15 && a <= 50) p.age = a; }
        const grade = (sel: string) => GRADE_MID[inputValue(sel) ?? ''];
        if (p.pitch) {
          if (grade('#editPitchStuff')) p.pitch.stuff = grade('#editPitchStuff');
          if (grade('#editPitchControl')) p.pitch.control = grade('#editPitchControl');
          if (grade('#editPitchStamina')) p.pitch.stamina = grade('#editPitchStamina');
        }
        if (grade('#editPlayerPower')) p.power = grade('#editPlayerPower');
        if (grade('#editPlayerContact')) p.contact = grade('#editPlayerContact');
        if (grade('#editPlayerSpeed')) p.speed = grade('#editPlayerSpeed');
        const ability = inputValue('#editPlayerAbility');
        if (ability !== null) p.ability = ability ? (ability as AbilityKey) : null;
      }
    }
    close();
  };
}
