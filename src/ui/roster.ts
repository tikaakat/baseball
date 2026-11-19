/* 「選手名鑑」タブ */
import { ABILITY_INFO } from '../engine/data';
import { DB, leagueName, teamById } from '../engine/state';
import { avgOfStats, eraOf, ipOf, opsOfStats } from '../engine/stats';
import type { Player } from '../engine/types';
import { render } from './app';
import { $, $$, abilityBadges, fmt3, fmt3plain, fmtEra, formatNumber, nameBadge } from './format';
import { openEditPlayerModal, openEditTeamModal } from './modal';
import { UI } from './state';

export function renderRoster(): string {
  return UI.rosterTeamId ? rosterDetailHTML(UI.rosterTeamId) : rosterListHTML();
}

function rosterListHTML(): string {
  const cards = DB.teams.map((t) => `
    <div class="team-card" data-team="${t.id}">
      <div class="row between" style="align-items:flex-start;">
        <div class="lg">${leagueName(t.league)}</div>
        <button class="edit-btn" data-editteam="${t.id}">✎ 編集</button>
      </div>
      <div class="tn">${t.name}</div>
      <div class="tg">${t.tagline}</div>
      <div class="rec">${t.wins}勝 ${t.losses}敗 ${t.ties}分</div>
    </div>`).join('');
  return `<div class="card"><h2>球団一覧</h2><div class="team-grid">${cards}</div></div>`;
}

function rosterDetailHTML(teamId: string): string {
  const t = teamById(teamId)!;
  const statMode = UI.rosterStatMode || 'season';
  const allPlayersFlat: Player[] = [];
  DB.teams.forEach((tm) => [...tm.roster, ...tm.pitchers].forEach((p) => allPlayersFlat.push(p)));

  const playerRow = (p: Player, label: string) => `
    <div class="player-row">
      <div class="pos">${label}</div>
      <div class="nm">#${formatNumber(p.number)} ${nameBadge(p, allPlayersFlat)}（${p.pos}）　${p.age}歳${p.ability ? `<span class="pill" style="margin-left:6px;">${ABILITY_INFO[p.ability].label}</span>` : ''}
        <div class="abl">${abilityBadges(p)}　在籍${p.seasonsPlayed || 0}年目</div>
        ${p.ability ? `<div class="abl" style="color:var(--pencil);">${ABILITY_INFO[p.ability].desc}</div>` : ''}
      </div>
      <button class="edit-btn" data-editplayer="${p.id}">✎</button>
    </div>`;
  const bench = t.roster.filter((p) => !t.battingOrder.includes(p));
  const abilityRows = t.battingOrder.map((p, i) => playerRow(p, String(i + 1))).join('')
    + (bench.length ? `<div class="muted" style="margin:8px 0 2px;font-size:11px;">控え</div>${bench.map((p) => playerRow(p, '控')).join('')}` : '');

  const roleOf = (p: Player) => {
    const r = t.staff.rotation.indexOf(p.id);
    if (r >= 0) return `先${r + 1}`;
    if (p.id === t.staff.closer) return '抑';
    if (p.id === t.staff.setup) return '中';
    return '継';
  };
  const roleOrder = (p: Player) => { const r = t.staff.rotation.indexOf(p.id); return r >= 0 ? r : p.id === t.staff.setup ? 10 : p.id === t.staff.closer ? 11 : 12; };
  const staffSorted = t.pitchers.slice().sort((a, b) => roleOrder(a) - roleOrder(b));
  const pitcherRows = staffSorted.map((p) => playerRow(p, roleOf(p))).join('');
  const pitchStatRows = staffSorted.map((p) => {
    const s = statMode === 'career' ? p.pCareer : p.pStats;
    return `<tr><td>${roleOf(p)}</td><td class="name">${nameBadge(p, allPlayersFlat)}</td><td>${s.g}</td><td>${s.w}</td><td>${s.l}</td><td>${s.sv}</td><td>${ipOf(s)}</td><td>${s.k}</td><td>${fmtEra(eraOf(s))}</td></tr>`;
  }).join('');

  const managerHtml = t.manager ? `<div class="card">
    <h2>監督</h2>
    <div class="muted">${t.manager.label}　<span class="pill">就任${t.manager.hireSeason}年目〜　残り任期${t.manager.tenureYears}年</span></div>
    <div class="muted" style="margin-top:4px;">${t.manager.desc}</div>
  </div>` : '';

  const statRows = [...t.battingOrder, ...bench].map((p, i) => {
    const s = statMode === 'career' ? p.career : p.stats;
    return `
    <tr>
      <td>${i < 9 ? i + 1 : '控'}</td>
      <td class="name">${nameBadge(p, allPlayersFlat)}<span class="muted" style="font-size:9px;">(${p.pos})</span></td>
      <td>${fmt3(avgOfStats(s))}</td>
      <td>${s.h}</td>
      <td>${s.hr}</td>
      <td>${s.rbi}</td>
      <td>${s.sb || 0}</td>
      <td>${fmt3plain(opsOfStats(s))}</td>
    </tr>`;
  }).join('');

  const alumni = t.alumni || [];
  const alumniHtml = alumni.length ? `<details class="howto">
    <summary>OB（退団選手） ${alumni.length}名</summary>
    <table class="compact-table"><thead><tr><th class="namehead">選手</th><th>在籍</th><th>打率</th><th>OPS</th><th>安打</th><th>本塁打</th><th>打点</th></tr></thead>
    <tbody>${alumni.slice().reverse().map((a) => a.isPitcher && a.pCareer
      ? `<tr><td class="name">${a.name}(投)</td><td>${a.seasonsPlayed}年</td><td colspan="5" style="text-align:left;">${a.pCareer.w}勝${a.pCareer.l}敗${a.pCareer.sv}S　防御率${fmtEra(eraOf(a.pCareer))}　${a.pCareer.k}奪三振</td></tr>`
      : `<tr><td class="name">${a.name}(${a.pos})</td><td>${a.seasonsPlayed}年</td><td>${fmt3(avgOfStats(a.career))}</td><td>${fmt3plain(opsOfStats(a.career))}</td><td>${a.career.h}</td><td>${a.career.hr}</td><td>${a.career.rbi}</td></tr>`).join('')}</tbody></table>
  </details>` : '';

  return `
  <div class="card">
    <div class="row between">
      <button class="btn secondary small" id="backToTeamsBtn">← 球団一覧に戻る</button>
      <button class="edit-btn" data-editteam="${t.id}">✎ 編集</button>
    </div>
    <div style="margin-top:10px;">
      <div class="lg muted">${leagueName(t.league)}</div>
      <h2 style="margin-top:2px;">${t.name}</h2>
      <div class="muted" style="font-style:italic;margin-bottom:8px;">${t.tagline}</div>
      <div class="muted">${t.wins}勝 ${t.losses}敗 ${t.ties}分　得点${t.runsFor}／失点${t.runsAgainst}</div>
    </div>
  </div>
  ${managerHtml}
  <div class="card">
    <h2>打順・能力<span class="muted" style="font-size:11px;font-weight:400;">（成績に応じて自動編成）</span></h2>
    ${abilityRows}
  </div>
  <div class="card">
    <h2>投手陣<span class="muted" style="font-size:11px;font-weight:400;">（先＝先発ローテ／中＝セットアッパー／抑＝抑え／継＝中継ぎ）</span></h2>
    ${pitcherRows}
    ${alumniHtml}
  </div>
  <div class="card">
    <div class="row between"><h2 style="margin:0;">チーム成績（打順順）</h2></div>
    <div class="subtabs">
      <button class="${statMode === 'season' ? 'active' : ''}" data-statmode="season">今シーズン</button>
      <button class="${statMode === 'career' ? 'active' : ''}" data-statmode="career">通算</button>
    </div>
    <div class="muted" style="font-size:10.5px;margin-bottom:4px;">詳しい成績（出塁率・長打率・四球・三振など）は「個人成績」タブで確認できます。</div>
    <table class="compact-table">
      <thead><tr><th></th><th class="namehead">選手</th><th>打率</th><th>安打</th><th>本塁打</th><th>打点</th><th>盗塁</th><th>OPS</th></tr></thead>
      <tbody>${statRows}</tbody>
    </table>
    <table class="compact-table" style="margin-top:10px;">
      <thead><tr><th></th><th class="namehead">投手</th><th>登板</th><th>勝</th><th>敗</th><th>S</th><th>回</th><th>三振</th><th>防御率</th></tr></thead>
      <tbody>${pitchStatRows}</tbody>
    </table>
  </div>`;
}

export function wireRosterEvents(): void {
  $$('[data-team]').forEach((c) => {
    c.onclick = () => { UI.rosterTeamId = c.dataset.team!; render(); };
  });
  $$('[data-editteam]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); openEditTeamModal(b.dataset.editteam!); };
  });
  $$('[data-editplayer]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); openEditPlayerModal(b.dataset.editplayer!); };
  });
  $$('[data-statmode]').forEach((b) => {
    b.onclick = () => { UI.rosterStatMode = b.dataset.statmode as 'season' | 'career'; render(); };
  });
  const back = $('#backToTeamsBtn');
  if (back) back.onclick = () => { UI.rosterTeamId = null; render(); };
}
