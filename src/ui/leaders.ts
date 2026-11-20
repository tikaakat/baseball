/* 「成績」タブ：個人成績ランキング（打撃・投手） */
import { LEAGUE_CODES } from '../engine/data';
import { DB, leagueName } from '../engine/state';
import { avgOf, eraOf, ipOf, isQualified, isQualifiedPitcher, obpOf, opsOf, slgOf, whipOf } from '../engine/stats';
import type { Player, Team } from '../engine/types';
import { render } from './app';
import { chips, onPick, segTabs } from './components';
import { fmt3, fmt3plain, fmtEra, nameBadge, shortTeamName } from './format';
import { UI } from './state';

interface Cat { key: string; label: string; calc: (p: Player) => number; fmt: (v: number) => string; asc?: boolean; qualified: boolean }

const BAT_CATS: Cat[] = [
  { key: 'avg', label: '打率', calc: avgOf, fmt: fmt3, qualified: true },
  { key: 'hr', label: '本塁打', calc: (p) => p.stats.hr, fmt: String, qualified: false },
  { key: 'rbi', label: '打点', calc: (p) => p.stats.rbi, fmt: String, qualified: false },
  { key: 'h', label: '安打', calc: (p) => p.stats.h, fmt: String, qualified: false },
  { key: 'ops', label: 'OPS', calc: opsOf, fmt: fmt3plain, qualified: true },
  { key: 'obp', label: '出塁率', calc: obpOf, fmt: fmt3, qualified: true },
  { key: 'slg', label: '長打率', calc: slgOf, fmt: fmt3plain, qualified: true },
  { key: 'sb', label: '盗塁', calc: (p) => p.stats.sb || 0, fmt: String, qualified: false },
  { key: 'r', label: '得点', calc: (p) => p.stats.r, fmt: String, qualified: false },
  { key: 'bb', label: '四球', calc: (p) => p.stats.bb, fmt: String, qualified: false },
  { key: 'triples', label: '三塁打', calc: (p) => p.stats.triples, fmt: String, qualified: false },
  { key: 'k', label: '三振', calc: (p) => p.stats.k, fmt: String, qualified: false },
];
const PITCH_CATS: Cat[] = [
  { key: 'era', label: '防御率', calc: (p) => eraOf(p.pStats), fmt: fmtEra, asc: true, qualified: true },
  { key: 'w', label: '勝利', calc: (p) => p.pStats.w, fmt: String, qualified: false },
  { key: 'sv', label: 'セーブ', calc: (p) => p.pStats.sv, fmt: String, qualified: false },
  { key: 'k', label: '奪三振', calc: (p) => p.pStats.k, fmt: String, qualified: false },
  { key: 'whip', label: 'WHIP', calc: (p) => whipOf(p.pStats), fmt: (v) => (isFinite(v) ? v.toFixed(2) : '-'), asc: true, qualified: true },
];

export function renderLeaders(): string {
  const pitch = UI.leaderMode === 'pitch';
  const cats = pitch ? PITCH_CATS : BAT_CATS;
  const cat = cats.find((c) => c.key === (pitch ? UI.pitchLeaderCat : UI.leaderCat)) ?? cats[0];
  const league = UI.leaderLeague || 'ALL';

  let pool: { p: Player; t: Team }[] = [];
  DB.teams.forEach((t) => (pitch ? t.pitchers : t.roster).forEach((p) => pool.push({ p, t })));
  const everyone = pool.map((x) => x.p);
  const mineOnly = league === 'MINE' && !!UI.myTeamId;
  if (mineOnly) pool = pool.filter((x) => x.t.id === UI.myTeamId && (pitch ? x.p.pStats.bf > 0 : x.p.stats.pa > 0));
  else if (league !== 'ALL') pool = pool.filter((x) => x.t.league === league);
  // マイチームの一覧では規定に関係なく全員を出す
  if (cat.qualified && !mineOnly) pool = pool.filter((x) => (pitch ? isQualifiedPitcher(x.p, x.t) : isQualified(x.p, x.t)));
  pool.sort((a, b) => (cat.asc ? cat.calc(a.p) - cat.calc(b.p) : cat.calc(b.p) - cat.calc(a.p)));

  const detail = (p: Player) => (pitch
    ? `${p.pStats.w}勝${p.pStats.l}敗${p.pStats.sv ? p.pStats.sv + 'S' : ''}・${ipOf(p.pStats)}回・防${fmtEra(eraOf(p.pStats))}`
    : `打率${fmt3(avgOf(p))}・${p.stats.hr}本・${p.stats.rbi}点・OPS${fmt3plain(opsOf(p))}`);
  const rows = pool.slice(0, mineOnly ? 30 : 10).map((x, i) => `
    <div class="rank-row tap ${x.t.id === UI.myTeamId ? 'mine' : ''}" data-player="${x.p.id}">
      <div class="rank-no">${i + 1}</div>
      <div class="rank-main"><div>${nameBadge(x.p, everyone)}<span class="sub">（${shortTeamName(x.t.name)}）</span></div><div class="sub">${detail(x.p)}</div></div>
      <div class="rank-val">${cat.fmt(cat.calc(x.p))}</div>
    </div>`).join('');

  return `
  ${segTabs('lmode', [{ key: 'bat', label: '打撃' }, { key: 'pitch', label: '投手' }], pitch ? 'pitch' : 'bat')}
  ${chips('lcat', cats.map((c) => ({ key: c.key, label: c.label })), cat.key)}
  ${chips('lleague', [...(UI.myTeamId ? [{ key: 'MINE', label: 'マイチーム全員' }] : []), { key: 'ALL', label: '両リーグ' }, { key: LEAGUE_CODES[0], label: leagueName(LEAGUE_CODES[0]) }, { key: LEAGUE_CODES[1], label: leagueName(LEAGUE_CODES[1]) }], league)}
  <div class="card">
    <div class="sub" style="font-size:10.5px;margin-bottom:2px;">行をタップすると詳しい成績を表示</div>
    ${cat.qualified && !mineOnly ? `<div class="muted" style="font-size:11px;margin-bottom:4px;">${pitch ? '規定投球回（チーム試合数×1回）' : '規定打席（チーム試合数×3.1）'}以上が対象</div>` : ''}
    ${rows || '<div class="muted">まだ対象の選手がいません。試合を進めましょう。</div>'}
  </div>`;
}

export function wireLeaderEvents(): void {
  onPick('seg', 'lmode', (k) => { UI.leaderMode = k as 'bat' | 'pitch'; render(); });
  onPick('chip', 'lcat', (k) => { if (UI.leaderMode === 'pitch') UI.pitchLeaderCat = k; else UI.leaderCat = k; render(); });
  onPick('chip', 'lleague', (k) => { UI.leaderLeague = k; render(); });
}
