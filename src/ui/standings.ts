/* 「順位表」タブ */
import { LEAGUE_CODES } from '../engine/data';
import { regularSeasonComplete } from '../engine/schedule';
import { gamesBehind, sortStandings } from '../engine/standings';
import { DB, leagueName } from '../engine/state';
import { winPct } from '../engine/stats';
import { $$, fmt3 } from './format';
import { openEditLeagueModal } from './modal';
import { UI } from './state';

function leagueTable(leagueCode: string, title: string, ruleFlag: 'H' | 'B'): string {
  const list = sortStandings(DB.teams.filter((t) => t.league === leagueCode), ruleFlag);
  const leader = list[0];
  const rows = list.map((t, i) => `
      <tr class="${t.id === UI.myTeamId ? 'mine' : ''} ${i === 2 ? 'cutline' : ''}">
        <td>${i + 1}</td>
        <td class="name">${t.name}</td>
        <td>${t.wins}</td>
        <td>${t.losses}</td>
        <td>${t.ties}</td>
        <td>${fmt3(winPct(t))}</td>
        <td>${gamesBehind(leader, t)}</td>
      </tr>`).join('');
  return `<div class="card">
      <div class="row between"><h2 style="margin:0;">${title}</h2><button class="link-btn" data-editleague="${leagueCode}">✎ 名前</button></div>
      <table class="standings"><thead><tr><th></th><th class="namehead">チーム</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th><th>差</th></tr></thead>
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
  const done = DB.schedule.filter((g) => g.played).length;
  return leagueTable(LEAGUE_CODES[0], leagueName(LEAGUE_CODES[0]), 'H')
    + leagueTable(LEAGUE_CODES[1], leagueName(LEAGUE_CODES[1]), 'B')
    + `<div class="muted" style="font-size:11px;margin:-4px 2px 12px;line-height:1.6;">
        上位3チーム（線より上）がプレーオフへ。${regularSeasonComplete(DB.schedule) ? 'レギュラーシーズン終了。' : `消化 ${done}/${DB.schedule.length} 試合。`}<br>
        勝率が並んだら、${leagueName(LEAGUE_CODES[0])}は勝利数→直接対決、${leagueName(LEAGUE_CODES[1])}は直接対決→勝利数の順で決めます。
      </div>`
    + headToHeadMatrixHTML();
}

export function wireStandingsEvents(): void {
  $$('[data-editleague]').forEach((b) => {
    b.onclick = () => { openEditLeagueModal(b.dataset.editleague!); };
  });
}
