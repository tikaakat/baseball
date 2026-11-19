/* 「個人成績」タブ */
import { ABILITY_INFO, LEAGUE_CODES } from '../engine/data';
import { DB, leagueName } from '../engine/state';
import { avgOf, eraOf, ipOf, isQualified, isQualifiedPitcher, obpOf, opsOf, slgOf, whipOf } from '../engine/stats';
import type { Player, Team } from '../engine/types';
import { render } from './app';
import { $$, fmt3, fmt3plain, fmtEra, nameBadge } from './format';
import { UI } from './state';

interface LeaderCat { key: string; label: string; calc: (p: Player) => number; minAb: boolean }

const LEADER_CATS: LeaderCat[] = [
  { key: 'avg', label: '打率', calc: (p) => avgOf(p), minAb: true },
  { key: 'obp', label: '出塁率', calc: (p) => obpOf(p), minAb: true },
  { key: 'slg', label: '長打率', calc: (p) => slgOf(p), minAb: true },
  { key: 'ops', label: 'OPS', calc: (p) => opsOf(p), minAb: true },
  { key: 'hr', label: '本塁打', calc: (p) => p.stats.hr, minAb: false },
  { key: 'rbi', label: '打点', calc: (p) => p.stats.rbi, minAb: false },
  { key: 'h', label: '安打', calc: (p) => p.stats.h, minAb: false },
  { key: 'triples', label: '三塁打', calc: (p) => p.stats.triples, minAb: false },
  { key: 'bb', label: '四球', calc: (p) => p.stats.bb, minAb: false },
  { key: 'r', label: '得点', calc: (p) => p.stats.r, minAb: false },
  { key: 'sb', label: '盗塁', calc: (p) => p.stats.sb || 0, minAb: false },
  { key: 'k', label: '三振(粘り不足王)', calc: (p) => p.stats.k, minAb: false },
];

interface PitchCat { key: string; label: string; calc: (p: Player) => number; asc: boolean; qualified: boolean; fmt: (v: number) => string }
const PITCH_CATS: PitchCat[] = [
  { key: 'era', label: '防御率', calc: (p) => eraOf(p.pStats), asc: true, qualified: true, fmt: fmtEra },
  { key: 'w', label: '勝利', calc: (p) => p.pStats.w, asc: false, qualified: false, fmt: String },
  { key: 'sv', label: 'セーブ', calc: (p) => p.pStats.sv, asc: false, qualified: false, fmt: String },
  { key: 'k', label: '奪三振', calc: (p) => p.pStats.k, asc: false, qualified: false, fmt: String },
  { key: 'whip', label: 'WHIP', calc: (p) => whipOf(p.pStats), asc: true, qualified: true, fmt: (v) => (isFinite(v) ? v.toFixed(2) : '-') },
];

function leagueTabsHTML(leagueFilter: string): string {
  return [
    { key: 'ALL', label: '両リーグ' },
    { key: LEAGUE_CODES[0], label: leagueName(LEAGUE_CODES[0]) },
    { key: LEAGUE_CODES[1], label: leagueName(LEAGUE_CODES[1]) },
  ].map((l) => `<button class="${leagueFilter === l.key ? 'active' : ''}" data-league="${l.key}">${l.label}</button>`).join('');
}
const modeTabsHTML = () => `<div class="subtabs">
    <button class="${UI.leaderMode !== 'pitch' ? 'active' : ''}" data-leadermode="bat">打撃</button>
    <button class="${UI.leaderMode === 'pitch' ? 'active' : ''}" data-leadermode="pitch">投手</button>
  </div>`;

function pitchingLeadersHTML(): string {
  const cat = PITCH_CATS.find((c) => c.key === UI.pitchLeaderCat) || PITCH_CATS[0];
  const leagueFilter = UI.leaderLeague || 'ALL';
  let all: { p: Player; t: Team }[] = [];
  DB.teams.forEach((t) => t.pitchers.forEach((p) => all.push({ p, t })));
  if (leagueFilter !== 'ALL') all = all.filter((x) => x.t.league === leagueFilter);
  if (cat.qualified) all = all.filter((x) => isQualifiedPitcher(x.p, x.t));
  all.sort((a, b) => (cat.asc ? cat.calc(a.p) - cat.calc(b.p) : cat.calc(b.p) - cat.calc(a.p)));
  const hl = (key: string) => (cat.key === key ? 'hl' : '');
  const rows = all.slice(0, 10).map((x, i) => {
    const s = x.p.pStats;
    return `<tr><td>${i + 1}</td><td class="name">${x.p.name}<div class="muted" style="font-size:10.5px;">${x.t.name}</div></td>
      <td class="${hl('era')}">${fmtEra(eraOf(s))}</td><td>${s.g}</td><td class="${hl('w')}">${s.w}</td><td>${s.l}</td><td class="${hl('sv')}">${s.sv}</td>
      <td>${ipOf(s)}</td><td class="${hl('k')}">${s.k}</td><td class="${hl('whip')}">${PITCH_CATS[4].fmt(whipOf(s))}</td></tr>`;
  }).join('');
  const tabs = PITCH_CATS.map((c) => `<button class="${c.key === cat.key ? 'active' : ''}" data-pcat="${c.key}">${c.label}</button>`).join('');
  return `
  <div class="card">
    <h2>個人成績ランキング</h2>
    ${modeTabsHTML()}
    <div class="subtabs">${leagueTabsHTML(leagueFilter)}</div>
    <div class="subtabs">${tabs}</div>
    <div class="muted" style="margin-bottom:6px;">並び順：${cat.label}${cat.qualified ? '／規定投球回（チーム試合数×1回）以上が対象' : ''}</div>
    <div class="table-scroll"><table>
      <thead><tr><th>順位</th><th>投手</th><th>防御率</th><th>登板</th><th>勝</th><th>敗</th><th>S</th><th>回</th><th>三振</th><th>WHIP</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="10" class="muted">まだ対象の投手がいません。</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

export function renderLeaders(): string {
  if (UI.leaderMode === 'pitch') return pitchingLeadersHTML();
  const cat = LEADER_CATS.find((c) => c.key === UI.leaderCat) || LEADER_CATS[0];
  const leagueFilter = UI.leaderLeague || 'ALL';
  let all: { p: Player; t: Team }[] = [];
  DB.teams.forEach((t) => t.roster.forEach((p) => all.push({ p, t })));
  const allPlayersFlat = all.map((x) => x.p);
  if (leagueFilter !== 'ALL') all = all.filter((x) => x.t.league === leagueFilter);
  if (cat.minAb) all = all.filter((x) => isQualified(x.p, x.t));
  all.sort((a, b) => cat.calc(b.p) - cat.calc(a.p));
  const top = all.slice(0, 10);

  const hl = (key: string) => (cat.key === key ? 'hl' : '');
  const rows = top.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="name">${nameBadge(x.p, allPlayersFlat)}${x.p.ability ? `<span class="pill" style="margin-left:4px;">${ABILITY_INFO[x.p.ability].label}</span>` : ''}<div class="muted" style="font-size:10.5px;">${x.t.name}</div></td>
      <td class="${hl('avg')}">${fmt3(avgOf(x.p))}</td>
      <td class="${hl('obp')}">${fmt3(obpOf(x.p))}</td>
      <td class="${hl('slg')}">${fmt3plain(slgOf(x.p))}</td>
      <td class="${hl('ops')}">${fmt3plain(opsOf(x.p))}</td>
      <td class="${hl('h')}">${x.p.stats.h}</td>
      <td class="${hl('triples')}">${x.p.stats.triples}</td>
      <td class="${hl('hr')}">${x.p.stats.hr}</td>
      <td class="${hl('rbi')}">${x.p.stats.rbi}</td>
      <td class="${hl('bb')}">${x.p.stats.bb}</td>
      <td class="${hl('k')}">${x.p.stats.k}</td>
    </tr>`).join('');

  const tabs = LEADER_CATS.map((c) => `<button class="${c.key === cat.key ? 'active' : ''}" data-cat="${c.key}">${c.label}</button>`).join('');
  const leagueTabs = leagueTabsHTML(leagueFilter);

  return `
  <div class="card">
    <h2>個人成績ランキング</h2>
    ${modeTabsHTML()}
    <div class="subtabs">${leagueTabs}</div>
    <div class="subtabs">${tabs}</div>
    <div class="muted" style="margin-bottom:6px;">並び順：${cat.label}（${leagueFilter === 'ALL' ? '両リーグ合算' : leagueName(leagueFilter) + 'のみ'}）　${cat.minAb ? '／規定打席（チーム試合数×3.1）以上が対象' : ''}</div>
    <div class="table-scroll">
    <table>
      <thead><tr><th>順位</th><th>選手</th><th>打率</th><th>出塁率</th><th>長打率</th><th>OPS</th><th>安打</th><th>三塁打</th><th>本塁打</th><th>打点</th><th>四球</th><th>三振</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="12" class="muted">まだ記録がありません。試合を消化しましょう。</td></tr>'}</tbody>
    </table>
    </div>
  </div>`;
}

export function wireLeaderEvents(): void {
  $$('[data-cat]').forEach((b) => {
    b.onclick = () => { UI.leaderCat = b.dataset.cat!; render(); };
  });
  $$('[data-leadermode]').forEach((b) => {
    b.onclick = () => { UI.leaderMode = b.dataset.leadermode as 'bat' | 'pitch'; render(); };
  });
  $$('[data-pcat]').forEach((b) => {
    b.onclick = () => { UI.pitchLeaderCat = b.dataset.pcat!; render(); };
  });
  $$('[data-league]').forEach((b) => {
    b.onclick = () => { UI.leaderLeague = b.dataset.league!; render(); };
  });
}
