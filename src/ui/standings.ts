/* 「順位表」タブ */
import { LEAGUE_CODES } from '../engine/data';
import { regularSeasonComplete } from '../engine/schedule';
import { gamesBehind, sortStandings } from '../engine/standings';
import { DB, leagueName } from '../engine/state';
import { winPct } from '../engine/stats';
import { $$, fmt3 } from './format';
import { openEditLeagueModal } from './modal';

function leagueTable(leagueCode: string, title: string, ruleNote: string, ruleFlag: 'H' | 'B'): string {
  const list = sortStandings(DB.teams.filter((t) => t.league === leagueCode), ruleFlag);
  const leader = list[0];
  const rows = list.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="name">${t.name}</td>
        <td>${t.wins + t.losses + t.ties}</td>
        <td>${t.wins}</td>
        <td>${t.losses}</td>
        <td>${t.ties}</td>
        <td>${fmt3(winPct(t))}</td>
        <td>${gamesBehind(leader, t)}</td>
      </tr>`).join('');
  return `<div class="card">
      <div class="row between"><h2 style="margin:0;">${title}</h2><button class="edit-btn" data-editleague="${leagueCode}">✎</button></div>
      <div class="muted" style="margin:6px 0;">勝率が同じ場合の順位決定：${ruleNote}</div>
      <table><thead><tr><th>順位</th><th>チーム</th><th>試合</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th><th>差</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

/** 対戦成績マトリクス：行チームから見た、列チームとの通算対戦成績（勝-敗-分） */
function headToHeadMatrixHTML(): string {
  const teams = DB.teams;
  const headerCells = teams.map((t) => `<th style="font-size:9.5px;white-space:nowrap;">${t.name.slice(0, 4)}</th>`).join('');
  const rows = teams.map((t1) => {
    const cells = teams.map((t2) => {
      if (t1.id === t2.id) return '<td class="muted">―</td>';
      const games = DB.schedule.filter((g) => g.played && ((g.home === t1.id && g.away === t2.id) || (g.home === t2.id && g.away === t1.id)));
      let w = 0, l = 0, tt = 0;
      games.forEach((g) => {
        const t1IsHome = g.home === t1.id;
        if (g.result!.winner === 'tie') tt++;
        else if ((g.result!.winner === 'home') === t1IsHome) w++;
        else l++;
      });
      return `<td style="font-size:10px;">${w}-${l}${tt ? '-' + tt : ''}</td>`;
    }).join('');
    return `<tr><td class="name" style="white-space:nowrap;">${t1.name}</td>${cells}</tr>`;
  }).join('');
  return `<details class="howto">
    <summary>対戦成績マトリクス（行チーム視点の対 列チーム 勝-敗-分）</summary>
    <div class="table-scroll" style="margin-top:8px;">
    <table><thead><tr><th></th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
    </div>
  </details>`;
}

export function renderStandings(): string {
  let html = leagueTable(LEAGUE_CODES[0], leagueName(LEAGUE_CODES[0]), 'まず①勝利数の多い方を上位に。それでも並べば②その2チーム同士の直接対決の勝率で決定', 'H')
    + leagueTable(LEAGUE_CODES[1], leagueName(LEAGUE_CODES[1]), 'まず①その2チーム同士の直接対決の勝率で決定。それでも並べば②勝利数の多い方を上位に', 'B');

  if (regularSeasonComplete(DB.schedule)) {
    html += `<div class="card"><h2>ポストシーズン</h2><div class="muted">レギュラーシーズンが終了しました。クライマックスシリーズ・日本シリーズの進行は「試合」タブから行えます。</div></div>`;
  } else {
    const done = DB.schedule.filter((g) => g.played).length;
    html += `<div class="card"><h2>ポストシーズン</h2><div class="muted">レギュラーシーズン（${done} / ${DB.schedule.length} 試合）が終わると、「試合」タブからクライマックスシリーズ・日本シリーズに進めます。</div></div>`;
  }
  html += headToHeadMatrixHTML();
  return html;
}

export function wireStandingsEvents(): void {
  $$('[data-editleague]').forEach((b) => {
    b.onclick = () => { openEditLeagueModal(b.dataset.editleague!); };
  });
}
