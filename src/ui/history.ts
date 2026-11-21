/* 「球団史」タブ：シーズン／記録／球団／ニュース の4つに分けて表示 */
import { loadSeasonHistory } from '../engine/history';
import { RECORD_LABELS, type RecordKey } from '../engine/news';
import { DB, leagueName, teamById } from '../engine/state';
import { avgOfStats, eraOf, opsOfStats } from '../engine/stats';
import type { AwardSummary, Awards, PitchLine, SeasonRecord, StandingRecord, StatLine } from '../engine/types';
import { render, renderSection } from './app';
import { managerName } from '../engine/team';
import { chips, onPick, segTabs, showToast } from './components';
import { fmt3, fmt3plain, fmtEra } from './format';
import { newsRow } from './news';
import { shareSeason } from './share';
import { UI } from './state';

type HistoryTab = 'season' | 'records' | 'teams' | 'news';

export function ensureHistoryLoaded(): void {
  if (UI.seasonHistoryLoading) return;
  UI.seasonHistoryLoading = true;
  loadSeasonHistory()
    .then((h) => { UI.seasonHistory = h; })
    .catch(() => { UI.seasonHistory = []; })
    .finally(() => {
      UI.seasonHistoryLoading = false;
      if (UI.tab === 'history') renderSection();
      else if (UI.tab === 'roster') render();
    });
}

/* ---------- シーズン ---------- */
function seasonTabHTML(history: SeasonRecord[]): string {
  if (!history.length) {
    return `<div class="card"><div class="muted">まだ記録がありません。シーズンを最後まで終えて「新しいシーズンを始める」と、ここに1年ずつ記録されていきます。</div></div>`;
  }
  const seasons = history.slice().sort((a, b) => b.seasonNum - a.seasonNum);
  const sel = seasons.find((s) => s.seasonNum === UI.historySeason) ?? seasons[0];
  const opts = seasons.map((s) => `<option value="${s.seasonNum}" ${s === sel ? 'selected' : ''}>第${s.seasonNum}シーズン　${s.champion ? `優勝：${s.champion}` : ''}${s.championTeamId === UI.myTeamId ? ' 🏆' : ''}</option>`).join('');
  const picker = `<select id="seasonSel" class="season-select" aria-label="シーズンを選ぶ">${opts}</select>`;
  return picker + seasonDetailHTML(sel);
}

function seasonDetailHTML(s: SeasonRecord): string {
  const lnH = s.leagueNames?.H || leagueName('H');
  const lnB = s.leagueNames?.B || leagueName('B');
  const standings = (title: string, list: StandingRecord[]) => `
    <div class="section-title">${title}</div>
    ${list.map((t) => `<div class="list-row ${t.teamId === UI.myTeamId ? 'mine' : ''}"><span>${t.rank}. ${t.name}${t.teamId === s.championTeamId ? ' 🏆' : ''}</span><span class="sub">${t.wins}勝${t.losses}敗${t.ties}分</span></div>`).join('')}`;
  const who = (a: { name: string; team: string } | null | undefined) => (a ? `${a.name}<span class="sub">（${a.team}）</span>` : '<span class="sub">該当なし</span>');
  const bat = (a: AwardSummary | null | undefined) => (a ? `${who(a)} <span class="sub">打率${fmt3(a.avg)}・${a.hr}本・${a.rbi}点</span>` : who(null));
  const top = (list: { name: string; team: string; value: number }[] | undefined, fmt: (v: number) => string) =>
    list?.[0] ? `${who(list[0])} <b>${fmt(list[0].value)}</b>` : '-';
  const awardRow = (label: string, value: string) => `<div class="list-row"><span class="sub">${label}</span><span style="text-align:right;">${value}</span></div>`;

  return `
  <div class="card">
    <div class="row between">
      <h2 style="margin:0;">第${s.seasonNum}シーズン</h2>
      <button class="btn secondary small" data-share-season="${s.seasonNum}">📤 シェア</button>
    </div>
    ${s.champion ? `<div class="champ">🏆 ${s.champion}<span class="sub">　ペンシルシリーズ制覇</span></div>` : '<div class="muted">ポストシーズンは行われませんでした</div>'}
    ${standings(lnH, s.standings.H)}
    ${standings(lnB, s.standings.B)}
  </div>
  <div class="card">
    <h2>表彰</h2>
    ${awardRow(`${lnH} MVP`, bat(s.mvp?.H))}
    ${awardRow(`${lnB} MVP`, bat(s.mvp?.B))}
    ${s.bestPitcher ? awardRow(`${lnH} 最優秀投手`, s.bestPitcher.H ? `${who(s.bestPitcher.H)} <span class="sub">${s.bestPitcher.H.w}勝・防${fmtEra(s.bestPitcher.H.era)}</span>` : who(null)) : ''}
    ${s.bestPitcher ? awardRow(`${lnB} 最優秀投手`, s.bestPitcher.B ? `${who(s.bestPitcher.B)} <span class="sub">${s.bestPitcher.B.w}勝・防${fmtEra(s.bestPitcher.B.era)}</span>` : who(null)) : ''}
    ${awardRow(`${lnH} 新人王`, who(s.rookieOfYear?.H))}
    ${awardRow(`${lnB} 新人王`, who(s.rookieOfYear?.B))}
    ${awardRow('シリーズMVP', who(s.postseasonMvp))}
  </div>
  <div class="card">
    <h2>タイトル</h2>
    ${awardRow('首位打者', top(s.leaders.avg, fmt3))}
    ${awardRow('本塁打王', top(s.leaders.hr, (v) => `${v}本`))}
    ${awardRow('打点王', top(s.leaders.rbi, (v) => `${v}点`))}
    ${s.pitchingLeaders ? awardRow('最優秀防御率', top(s.pitchingLeaders.era, fmtEra)) : ''}
    ${s.pitchingLeaders ? awardRow('最多勝', top(s.pitchingLeaders.w, (v) => `${v}勝`)) : ''}
    ${s.pitchingLeaders ? awardRow('最多セーブ', top(s.pitchingLeaders.sv, (v) => `${v}S`)) : ''}
    ${s.pitchingLeaders ? awardRow('最多奪三振', top(s.pitchingLeaders.k, String)) : ''}
  </div>
  ${s.bestNine ? `<details class="howto"><summary>ベストナイン</summary>${['H', 'B'].map((lg) => `
    <div class="section-title">${lg === 'H' ? lnH : lnB}</div>
    ${(s.bestNine![lg as 'H' | 'B'] || []).map((b) => `<div class="list-row"><span class="sub">${b.pos}</span><span>${b.name}<span class="sub">（${b.team}）</span></span></div>`).join('')}`).join('')}</details>` : ''}
  ${s.goldenGlove ? `<details class="howto"><summary>ゴールデングラブ賞</summary>${['H', 'B'].map((lg) => `
    <div class="section-title">${lg === 'H' ? lnH : lnB}</div>
    ${(s.goldenGlove![lg as 'H' | 'B'] || []).map((b) => `<div class="list-row"><span class="sub">${b.pos}</span><span>${b.name}<span class="sub">（${b.team}・失策${b.errors}）</span></span></div>`).join('')}`).join('')}</details>` : ''}`;
}

/* ---------- 記録 ---------- */
interface AllTime { name: string; team: string; career: StatLine; pCareer: PitchLine | null; awards: Awards; active: boolean; seasons: number }

const ALL_TIME_CATS: { key: string; label: string; pitcher: boolean; minSeasons: number; calc: (x: AllTime) => number; fmt: (x: AllTime) => string; asc?: boolean }[] = [
  { key: 'h', label: '安打', pitcher: false, minSeasons: 0, calc: (x) => x.career.h, fmt: (x) => `${x.career.h}本` },
  { key: 'hr', label: '本塁打', pitcher: false, minSeasons: 0, calc: (x) => x.career.hr, fmt: (x) => `${x.career.hr}本` },
  { key: 'rbi', label: '打点', pitcher: false, minSeasons: 0, calc: (x) => x.career.rbi, fmt: (x) => `${x.career.rbi}点` },
  { key: 'sb', label: '盗塁', pitcher: false, minSeasons: 0, calc: (x) => x.career.sb || 0, fmt: (x) => `${x.career.sb || 0}個` },
  { key: 'avg', label: '打率', pitcher: false, minSeasons: 5, calc: (x) => avgOfStats(x.career), fmt: (x) => fmt3(avgOfStats(x.career)) },
  { key: 'ops', label: 'OPS', pitcher: false, minSeasons: 5, calc: (x) => opsOfStats(x.career), fmt: (x) => fmt3plain(opsOfStats(x.career)) },
  { key: 'w', label: '勝利', pitcher: true, minSeasons: 0, calc: (x) => x.pCareer!.w, fmt: (x) => `${x.pCareer!.w}勝` },
  { key: 'sv', label: 'セーブ', pitcher: true, minSeasons: 0, calc: (x) => x.pCareer!.sv, fmt: (x) => `${x.pCareer!.sv}S` },
  { key: 'k', label: '奪三振', pitcher: true, minSeasons: 0, calc: (x) => x.pCareer!.k, fmt: (x) => `${x.pCareer!.k}` },
  { key: 'era', label: '防御率', pitcher: true, minSeasons: 5, calc: (x) => eraOf(x.pCareer!), fmt: (x) => fmtEra(eraOf(x.pCareer!)), asc: true },
  { key: 'awards', label: '受賞', pitcher: false, minSeasons: 0, calc: (x) => x.awards.mvp * 3 + x.awards.bestNine + x.awards.psMvp + x.awards.rookie + x.awards.goldenGlove, fmt: (x) => `MVP${x.awards.mvp}・BN${x.awards.bestNine}` },
];

function allTimePlayers(): AllTime[] {
  const list: AllTime[] = [];
  const empty: Awards = { mvp: 0, bestNine: 0, psMvp: 0, rookie: 0, goldenGlove: 0 };
  DB.teams.forEach((t) => {
    [...t.roster, ...t.pitchers].forEach((p) => {
      const career = { ...p.career }, pc = { ...p.pCareer };
      (Object.keys(career) as (keyof StatLine)[]).forEach((k) => { career[k] += p.stats[k] || 0; });
      (Object.keys(pc) as (keyof PitchLine)[]).forEach((k) => { pc[k] += p.pStats[k] || 0; });
      list.push({ name: p.name, team: t.name, career, pCareer: p.pitch ? pc : null, awards: p.awards, active: true, seasons: (p.seasonsPlayed || 0) + 1 });
    });
    (t.alumni || []).forEach((a) => list.push({ name: a.name, team: t.name, career: a.career, pCareer: a.isPitcher && a.pCareer ? a.pCareer : null, awards: a.awards || empty, active: false, seasons: a.seasonsPlayed || 0 }));
  });
  return list;
}

function recordsTabHTML(): string {
  const recs = DB.records ?? {};
  const recRows = (Object.keys(RECORD_LABELS) as RecordKey[]).map((k) => {
    const r = recs[k];
    const l = RECORD_LABELS[k];
    return `<div class="list-row"><span class="sub">${l.label.replace('シーズン', '')}</span><span>${r ? `<b>${r.value}${l.unit}</b> ${r.name}<span class="sub">（${r.team}・第${r.season}季）</span>` : '-'}</span></div>`;
  }).join('');

  const cat = ALL_TIME_CATS.find((c) => c.key === UI.allTimeCat) ?? ALL_TIME_CATS[0];
  const pool = allTimePlayers().filter((x) => (cat.key === 'awards' ? true : cat.pitcher ? !!x.pCareer : !x.pCareer) && x.seasons >= cat.minSeasons);
  const ranked = pool.sort((a, b) => (cat.asc ? cat.calc(a) - cat.calc(b) : cat.calc(b) - cat.calc(a))).filter((x) => cat.asc || cat.calc(x) > 0).slice(0, 10);
  const rows = ranked.map((x, i) => `<div class="list-row"><span>${i + 1}. ${x.name}<span class="sub">（${x.team}${x.active ? '・現役' : ''}）</span></span><b>${cat.fmt(x)}</b></div>`).join('');
  return `
  <div class="card"><h2>シーズン記録</h2>${recRows}</div>
  <div class="card"><h2>歴代ランキング（通算）</h2>
    ${chips('alltime', ALL_TIME_CATS.map((c) => ({ key: c.key, label: c.label })), cat.key)}
    ${cat.minSeasons ? `<div class="muted" style="font-size:11px;margin-bottom:4px;">在籍${cat.minSeasons}年以上が対象</div>` : ''}
    ${rows || '<div class="muted">まだ記録がありません。</div>'}
  </div>`;
}

/* ---------- 球団 ---------- */
function teamsTabHTML(history: SeasonRecord[]): string {
  const myTrend = UI.myTeamId && history.length ? history.slice().sort((a, b) => a.seasonNum - b.seasonNum).map((s) => {
    const r = [...s.standings.H, ...s.standings.B].find((t) => t.teamId === UI.myTeamId);
    return r ? `<span class="trend ${r.rank === 1 ? 'top' : r.rank <= 3 ? 'a' : ''}">${s.seasonNum}季<b>${r.rank}位</b>${s.championTeamId === UI.myTeamId ? '🏆' : ''}</span>` : '';
  }).join('') : '';

  const agg: Record<string, { name: string; w: number; l: number; t: number; pennant: number; series: number }> = {};
  DB.teams.forEach((t) => { agg[t.id] = { name: t.name, w: 0, l: 0, t: 0, pennant: 0, series: 0 }; });
  history.forEach((s) => {
    [...s.standings.H, ...s.standings.B].forEach((r) => {
      const a = (agg[r.teamId] ??= { name: r.name, w: 0, l: 0, t: 0, pennant: 0, series: 0 });
      a.w += r.wins; a.l += r.losses; a.t += r.ties;
      if (r.rank === 1) a.pennant++;
    });
    if (s.championTeamId && agg[s.championTeamId]) agg[s.championTeamId].series++;
  });
  const teamRows = Object.entries(agg).sort(([, a], [, b]) => b.series - a.series || b.pennant - a.pennant || (b.w - b.l) - (a.w - a.l)).map(([id, a]) => `
    <tr class="${id === UI.myTeamId ? 'mine' : ''}"><td class="name">${a.name}</td><td>${a.w}-${a.l}</td><td>${fmt3(a.w + a.l ? a.w / (a.w + a.l) : 0)}</td><td>${a.pennant}</td><td>${a.series}</td></tr>`).join('');

  const managers: { team: string; teamId: string; label: string; w: number; l: number; current: boolean }[] = [];
  DB.teams.forEach((t) => {
    (t.managerHistory || []).forEach((m) => managers.push({ team: t.name, teamId: t.id, label: `${managerName(m)}<span class="sub">・${m.label}・第${m.hireSeason}〜${m.leftSeason ?? ''}季</span>`, w: m.wins || 0, l: m.losses || 0, current: false }));
    if (t.manager) managers.push({ team: t.name, teamId: t.id, label: `${managerName(t.manager)}<span class="sub">・${t.manager.label}・第${t.manager.hireSeason}季〜</span>`, w: t.manager.wins || 0, l: t.manager.losses || 0, current: true });
  });
  const mgrRows = managers.filter((m) => m.w + m.l > 0).sort((a, b) => b.w - a.w).slice(0, 12)
    .map((m) => `<div class="list-row ${m.teamId === UI.myTeamId ? 'mine' : ''}"><span>${m.label}<span class="sub">（${m.team}${m.current ? '・現職' : ''}）</span></span><span class="sub">${m.w}勝${m.l}敗</span></div>`).join('');

  return `
  ${myTrend ? `<div class="card"><h2>${teamById(UI.myTeamId!)?.name ?? ''} の歩み</h2><div class="trend-row">${myTrend}</div></div>` : ''}
  <div class="card"><h2>全球団の通算成績</h2>
    ${history.length ? `<div class="table-scroll"><table class="compact-table"><thead><tr><th class="namehead">チーム</th><th>勝-敗</th><th>勝率</th><th>リーグ優勝</th><th>シリーズ制覇</th></tr></thead><tbody>${teamRows}</tbody></table></div>` : '<div class="muted">シーズンを終えると集計されます。</div>'}
  </div>
  ${mgrRows ? `<div class="card"><h2>監督（勝利数順）</h2>${mgrRows}</div>` : ''}`;
}

/* ---------- ニュース ---------- */
function newsTabHTML(): string {
  const mineOnly = UI.newsFilter === 'mine';
  const all = (DB.news ?? []).slice().reverse();
  const list = (mineOnly ? all.filter((n) => n.teamId === UI.myTeamId) : all).slice(0, 80);
  return `${UI.myTeamId ? chips('newsf', [{ key: 'all', label: 'すべて' }, { key: 'mine', label: 'マイチーム' }], mineOnly ? 'mine' : 'all') : ''}
    <div class="card">${list.map(newsRow).join('') || '<div class="muted">まだニュースはありません。</div>'}</div>`;
}

export function renderHistory(): string {
  const history = UI.seasonHistory;
  if (history === null) {
    ensureHistoryLoaded();
    return `<div class="card"><div class="muted">読み込み中…</div></div>`;
  }
  const tab = (UI.historyTab ?? 'season') as HistoryTab;
  const tabs = segTabs('htab', [
    { key: 'season', label: 'シーズン' }, { key: 'records', label: '記録' }, { key: 'teams', label: '球団' }, { key: 'news', label: 'ニュース' },
  ], tab);
  const body = tab === 'records' ? recordsTabHTML() : tab === 'teams' ? teamsTabHTML(history) : tab === 'news' ? newsTabHTML() : seasonTabHTML(history);
  return tabs + body;
}

export function wireHistoryEvents(): void {
  onPick('seg', 'htab', (k) => { UI.historyTab = k; render(); });
  const seasonSel = document.querySelector<HTMLSelectElement>('#seasonSel');
  if (seasonSel) seasonSel.onchange = () => { UI.historySeason = Number(seasonSel.value); render(); };
  onPick('chip', 'alltime', (k) => { UI.allTimeCat = k; render(); });
  onPick('chip', 'newsf', (k) => { UI.newsFilter = k; render(); });
  document.querySelectorAll<HTMLElement>('[data-share-season]').forEach((b) => {
    b.onclick = () => {
      const rec = (UI.seasonHistory ?? []).find((x) => String(x.seasonNum) === b.dataset.shareSeason);
      if (rec) void shareSeason(rec).then((msg) => showToast(msg));
    };
  });
}
