/* 選手の詳細シート：今季の成績・鉛筆・年度別成績・通算・受賞歴（選手名をタップすると開く） */
import { pencilsFor, pencilSummary } from '../engine/atbat';
import { ABILITY_INFO } from '../engine/data';
import { playerById } from '../engine/state';
import { avgOfStats, eraOf, ipOf, isQualified, isQualifiedPitcher, obpOfStats, opsOfStats, slgOfStats, whipOf } from '../engine/stats';
import type { PitchLine, Player, StatLine, Team } from '../engine/types';
import { render } from './app';
import { abilityBadges, fmt3, fmt3plain, fmtEra, formatNumber } from './format';
import { openEditPlayerModal } from './modal';
import { UI } from './state';

const cell = (label: string, value: string | number, strong = false) =>
  `<div class="stat-cell"><div class="stat-label">${label}</div><div class="stat-val ${strong ? 'strong' : ''}">${value}</div></div>`;

function batterGrid(s: StatLine): string {
  return `<div class="stat-grid">
    ${cell('打率', fmt3(avgOfStats(s)), true)}${cell('本塁打', s.hr, true)}${cell('打点', s.rbi, true)}${cell('OPS', fmt3plain(opsOfStats(s)), true)}
    ${cell('出塁率', fmt3(obpOfStats(s)))}${cell('長打率', fmt3plain(slgOfStats(s)))}${cell('打席', s.pa)}${cell('打数', s.ab)}
    ${cell('安打', s.h)}${cell('二塁打', s.doubles)}${cell('三塁打', s.triples)}${cell('得点', s.r)}
    ${cell('四球', s.bb)}${cell('三振', s.k)}${cell('盗塁', `${s.sb}<small>/${s.sb + s.cs}</small>`)}${cell('併殺', s.gidp)}
  </div>`;
}

function pitcherGrid(s: PitchLine): string {
  const k9 = s.outs ? ((s.k * 27) / s.outs).toFixed(1) : '-';
  return `<div class="stat-grid">
    ${cell('防御率', fmtEra(eraOf(s)), true)}${cell('勝-敗', `${s.w}-${s.l}`, true)}${cell('セーブ', s.sv, true)}${cell('奪三振', s.k, true)}
    ${cell('登板', s.g)}${cell('先発', s.gs)}${cell('投球回', ipOf(s))}${cell('WHIP', isFinite(whipOf(s)) ? whipOf(s).toFixed(2) : '-')}
    ${cell('被安打', s.h)}${cell('被本塁打', s.hr)}${cell('与四球', s.bb)}${cell('奪三振率', k9)}
  </div>`;
}

function yearlyTable(p: Player, team: Team): string {
  const rows = [...(p.yearly ?? []).map((y) => ({ label: `${y.season}季`, team: y.team, s: y.stats, ps: y.pStats })),
    { label: '今季', team: team.name, s: p.stats, ps: p.pStats }];
  const total = { label: '通算', s: addStat(p.career, p.stats), ps: addPitch(p.pCareer, p.pStats) };
  if (p.pitch) {
    const tr = (r: { label: string; ps: PitchLine }, cls = '') => `<tr class="${cls}"><td>${r.label}</td><td>${r.ps.g}</td><td>${r.ps.w}-${r.ps.l}</td><td>${r.ps.sv}</td><td>${ipOf(r.ps)}</td><td>${r.ps.k}</td><td>${fmtEra(eraOf(r.ps))}</td></tr>`;
    return `<table class="compact-table"><thead><tr><th>年</th><th>登板</th><th>勝敗</th><th>S</th><th>回</th><th>三振</th><th>防御率</th></tr></thead>
      <tbody>${rows.map((r) => tr(r)).join('')}${tr(total, 'total')}</tbody></table>`;
  }
  const tr = (r: { label: string; s: StatLine }, cls = '') => `<tr class="${cls}"><td>${r.label}</td><td>${r.s.pa}</td><td>${fmt3(avgOfStats(r.s))}</td><td>${r.s.h}</td><td>${r.s.hr}</td><td>${r.s.rbi}</td><td>${r.s.sb}</td><td>${fmt3plain(opsOfStats(r.s))}</td></tr>`;
  return `<table class="compact-table"><thead><tr><th>年</th><th>打席</th><th>打率</th><th>安打</th><th>本</th><th>点</th><th>盗</th><th>OPS</th></tr></thead>
    <tbody>${rows.map((r) => tr(r)).join('')}${tr(total, 'total')}</tbody></table>`;
}

function addStat(a: StatLine, b: StatLine): StatLine {
  const o = { ...a };
  (Object.keys(o) as (keyof StatLine)[]).forEach((k) => { o[k] += b[k] || 0; });
  return o;
}
function addPitch(a: PitchLine, b: PitchLine): PitchLine {
  const o = { ...a };
  (Object.keys(o) as (keyof PitchLine)[]).forEach((k) => { o[k] += b[k] || 0; });
  return o;
}

function pencilMini(p: Player): string {
  const [p1, p2] = pencilSummary(pencilsFor(p, null));
  const bar = (label: string, segs: { key: string; label: string; pct: number }[]) => `
    <div class="pencil-bar-row"><div class="pencil-bar-label">${label}</div><div class="pencil-bar">${segs.map((x) => `<div class="seg seg-${x.key}" style="flex:${x.pct}" title="${x.label} ${Math.round(x.pct)}%">${x.pct >= x.label.length * 4.5 + 5 ? `${x.label}<small>${Math.round(x.pct)}%</small>` : x.pct >= 6 ? `<small>${Math.round(x.pct)}%</small>` : ''}</div>`).join('')}</div></div>`;
  return `<div class="pencil-bars">${bar('1本目', p1)}${bar('2本目', p2)}<div class="sub" style="font-size:10px;">平均的な投手と対戦したときの鉛筆</div></div>`;
}

export function playerSheetHTML(): string {
  if (!UI.playerSheet) return '';
  const found = playerById(UI.playerSheet);
  if (!found) return '';
  const { player: p, team } = found;
  const role = p.pitch
    ? (team.staff.rotation.includes(p.id) ? '先発' : p.id === team.staff.closer ? '抑え' : p.id === team.staff.setup ? 'セットアッパー' : '中継ぎ')
    : (team.battingOrder.includes(p) ? `${team.battingOrder.indexOf(p) + 1}番` : '控え');
  const qualified = p.pitch ? isQualifiedPitcher(p, team) : isQualified(p, team);
  const aw = p.awards;
  const awards = [aw.mvp && `MVP ${aw.mvp}回`, aw.bestNine && `ベストナイン ${aw.bestNine}回`, aw.goldenGlove && `ゴールデングラブ ${aw.goldenGlove}回`, aw.rookie && '新人王', aw.psMvp && `シリーズMVP ${aw.psMvp}回`].filter(Boolean).join('・');

  return `<div class="sheet-overlay" data-close-sheet="1">
    <div class="sheet" role="dialog" aria-label="${p.name}の成績">
      <div class="sheet-head">
        <div>
          <div class="sheet-name">${p.name}<span class="sub"> ${p.given}</span></div>
          <div class="sub">${team.name}・${p.pos}・${role}・${p.age}歳・#${formatNumber(p.number)}・${(p.seasonsPlayed || 0) + 1}年目</div>
        </div>
        <button class="edit-btn" data-close-sheet="1" aria-label="閉じる">✕</button>
      </div>
      <div class="p-abl" style="margin:6px 0;">${abilityBadges(p)}</div>
      ${p.ability ? `<div class="sub"><span class="pill">${ABILITY_INFO[p.ability].label}</span> ${ABILITY_INFO[p.ability].desc}</div>` : ''}
      ${p.pitch ? '' : pencilMini(p)}
      <div class="section-title">今季の成績${qualified ? '' : '<span class="sub">（規定未到達）</span>'}</div>
      ${p.pitch ? pitcherGrid(p.pStats) : batterGrid(p.stats)}
      <div class="section-title">年度別</div>
      <div class="table-scroll">${yearlyTable(p, team)}</div>
      ${awards ? `<div class="section-title">受賞歴</div><div class="sub">${awards}</div>` : ''}
      <div class="row" style="margin-top:12px;"><button class="btn secondary small" data-sheet-edit="${p.id}">✎ 能力・名前を編集</button></div>
    </div>
  </div>`;
}

/** 画面のどこでも data-player="選手ID" をタップすると詳細シートを開く */
export function installPlayerSheetHandler(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-player],[data-close-sheet],[data-sheet-edit]');
    if (!el) return;
    if (el.dataset.player) { e.stopPropagation(); UI.playerSheet = el.dataset.player; render(); return; }
    if (el.dataset.sheetEdit) { const id = el.dataset.sheetEdit; UI.playerSheet = null; openEditPlayerModal(id); return; }
    if (el.dataset.closeSheet && (e.target === el || el.tagName === 'BUTTON')) { UI.playerSheet = null; render(); }
  });
}
