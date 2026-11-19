/* 「球団史」タブ */
import { loadSeasonHistory } from '../engine/history';
import { STORAGE_AVAILABLE } from '../engine/storage';
import { DB, leagueName, teamById } from '../engine/state';
import { avgOfStats, opsOfStats } from '../engine/stats';
import type { Awards, PitchLine, SeasonRecord, StandingRecord, StatLine } from '../engine/types';
import { renderSection } from './app';
import { fmt3, fmt3plain, fmtEra } from './format';
import { recordsAndNewsHTML } from './news';
import { shareSeason } from './share';
import { UI } from './state';

const EMPTY_AWARDS: Awards = { mvp: 0, bestNine: 0, psMvp: 0, rookie: 0, goldenGlove: 0 };
const awardTotal = (a: Awards) => a.mvp + a.bestNine + a.psMvp + a.rookie + a.goldenGlove;

function ensureHistoryLoaded(): void {
  if (UI.seasonHistoryLoading) return;
  UI.seasonHistoryLoading = true;
  loadSeasonHistory()
    .then((h) => { UI.seasonHistory = h; })
    .catch(() => { UI.seasonHistory = []; })
    .finally(() => {
      UI.seasonHistoryLoading = false;
      if (UI.tab === 'history') renderSection();
    });
}

function trendHTML(history: SeasonRecord[]): string {
  if (!UI.myTeamId) return '';
  const myTeam = teamById(UI.myTeamId);
  if (!myTeam) return '';
  const trend = history.slice().sort((a, b) => a.seasonNum - b.seasonNum).map((s) => {
    const found = s.standings.H.find((t) => t.teamId === UI.myTeamId) || s.standings.B.find((t) => t.teamId === UI.myTeamId);
    const isChamp = s.champion && s.champion === myTeam.name;
    return found ? `${found.rank}位${isChamp ? '🏆' : ''}` : '?';
  }).join(' → ');
  return `<div class="card"><h2>${myTeam.name} の順位推移</h2><div class="muted">${trend}</div></div>`;
}

function seasonCardHTML(s: SeasonRecord): string {
  const lnH = s.leagueNames?.H || leagueName('H');
  const lnB = s.leagueNames?.B || leagueName('B');
  const leagueRows = (list: StandingRecord[]) =>
    list.map((t) => `<div class="game-row"><div class="vs">${t.rank}位　${t.name}（${t.wins}勝${t.losses}敗${t.ties}分）</div></div>`).join('');
  const award = (a: { name: string; team: string; avg: number; ops: number; hr: number; rbi: number } | null | undefined, withOps = true) =>
    a ? `${a.name}（${a.team}） 打率${fmt3(a.avg)}${withOps ? `／OPS${fmt3plain(a.ops)}` : ''}／${a.hr}本／${a.rbi}点` : null;
  return `
    <details class="howto" style="margin-bottom:10px;">
      <summary>第${s.seasonNum}シーズン　${s.champion ? `🏆 ${s.champion}` : '（ポストシーズン未実施）'}</summary>
      <button class="btn secondary small" data-share-season="${s.seasonNum}" style="margin:8px 0 2px;">📤 このシーズンをシェア</button>
      <div class="rules">
        <div style="font-weight:800;color:var(--pencil);margin-top:6px;">${lnH}</div>
        ${leagueRows(s.standings.H)}
        <div style="font-weight:800;color:var(--pencil);margin-top:10px;">${lnB}</div>
        ${leagueRows(s.standings.B)}
        <div class="muted" style="margin-top:10px;line-height:1.8;">
          打率：${(s.leaders.avg || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${fmt3(x.value)}`).join('　') || '-'}<br>
          本塁打：${(s.leaders.hr || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${x.value}本`).join('　') || '-'}<br>
          打点：${(s.leaders.rbi || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${x.value}点`).join('　') || '-'}
        </div>
        <div class="muted" style="margin-top:10px;line-height:1.8;">
          🏆 ${lnH}MVP：${award(s.mvp?.H) ?? '-'}<br>
          🏆 ${lnB}MVP：${award(s.mvp?.B) ?? '-'}<br>
          🏆 ポストシーズンMVP（優勝チームから選出）：${award(s.postseasonMvp) ?? '-'}
        </div>
        ${s.bestNine ? `
        <div style="font-weight:800;color:var(--pencil);margin-top:10px;">ベストナイン</div>
        <div class="muted" style="line-height:1.8;">
          <b>${lnH}</b>：${(s.bestNine.H || []).map((b) => `${b.pos}:${b.name}(${b.team})`).join('　') || '-'}<br>
          <b>${lnB}</b>：${(s.bestNine.B || []).map((b) => `${b.pos}:${b.name}(${b.team})`).join('　') || '-'}
        </div>` : ''}
        <div class="muted" style="margin-top:10px;line-height:1.8;">
          🌱 ${lnH}新人王：${award(s.rookieOfYear?.H, false) ?? '該当者なし'}<br>
          🌱 ${lnB}新人王：${award(s.rookieOfYear?.B, false) ?? '該当者なし'}
        </div>
        ${s.pitchingLeaders ? `
        <div style="font-weight:800;color:var(--pencil);margin-top:10px;">⚾ 投手タイトル</div>
        <div class="muted" style="line-height:1.8;">
          防御率：${(s.pitchingLeaders.era || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${fmtEra(x.value)}`).join('　') || '-'}<br>
          勝利：${(s.pitchingLeaders.w || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${x.value}勝`).join('　') || '-'}<br>
          セーブ：${(s.pitchingLeaders.sv || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${x.value}S`).join('　') || '-'}<br>
          奪三振：${(s.pitchingLeaders.k || []).map((x, i) => `${i + 1}位 ${x.name}（${x.team}）${x.value}`).join('　') || '-'}
        </div>` : ''}
        ${s.bestPitcher ? `
        <div class="muted" style="margin-top:6px;line-height:1.8;">
          🏅 ${lnH}最優秀投手：${s.bestPitcher.H ? `${s.bestPitcher.H.name}（${s.bestPitcher.H.team}） ${s.bestPitcher.H.w}勝${s.bestPitcher.H.l}敗 防御率${fmtEra(s.bestPitcher.H.era)}` : '該当者なし'}<br>
          🏅 ${lnB}最優秀投手：${s.bestPitcher.B ? `${s.bestPitcher.B.name}（${s.bestPitcher.B.team}） ${s.bestPitcher.B.w}勝${s.bestPitcher.B.l}敗 防御率${fmtEra(s.bestPitcher.B.era)}` : '該当者なし'}
        </div>` : ''}
        ${s.goldenGlove ? `
        <div style="font-weight:800;color:var(--pencil);margin-top:10px;">🧤 ゴールデングラブ賞</div>
        <div class="muted" style="line-height:1.8;">
          <b>${lnH}</b>：${(s.goldenGlove.H || []).map((b) => `${b.pos}:${b.name}(${b.team})失策${b.errors}`).join('　') || '-'}<br>
          <b>${lnB}</b>：${(s.goldenGlove.B || []).map((b) => `${b.pos}:${b.name}(${b.team})失策${b.errors}`).join('　') || '-'}
        </div>` : ''}
      </div>
    </details>`;
}

/** 全チーム通算成績（記録されている全シーズン分を合算） */
function teamTotalsHTML(history: SeasonRecord[]): string {
  const totals: Record<string, { name: string; wins: number; losses: number; ties: number }> = {};
  DB.teams.forEach((t) => { totals[t.id] = { name: t.name, wins: 0, losses: 0, ties: 0 }; });
  history.forEach((s) => {
    [...(s.standings.H || []), ...(s.standings.B || [])].forEach((t) => {
      totals[t.teamId] ??= { name: t.name, wins: 0, losses: 0, ties: 0 };
      totals[t.teamId].wins += t.wins; totals[t.teamId].losses += t.losses; totals[t.teamId].ties += t.ties;
    });
  });
  const rows = Object.values(totals).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses)).map((t, i) => {
    const g = t.wins + t.losses;
    return `<tr><td>${i + 1}</td><td class="name">${t.name}</td><td>${t.wins}</td><td>${t.losses}</td><td>${t.ties}</td><td>${fmt3(g > 0 ? t.wins / g : 0)}</td></tr>`;
  }).join('');
  return `<details class="howto" style="margin-bottom:10px;">
    <summary>全球団 通算成績（記録済み全${history.length}シーズン合算）</summary>
    <table class="compact-table"><thead><tr><th></th><th class="namehead">チーム</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </details>`;
}

/** 各チームの順位回数とペンシルシリーズ制覇回数 */
function rankCountsHTML(history: SeasonRecord[]): string {
  const counts: Record<string, { name: string; ranks: number[]; jsChamp: number }> = {};
  const blank = (name: string) => ({ name, ranks: [0, 0, 0, 0, 0, 0], jsChamp: 0 });
  DB.teams.forEach((t) => { counts[t.id] = blank(t.name); });
  history.forEach((s) => {
    [...(s.standings.H || []), ...(s.standings.B || [])].forEach((t) => {
      counts[t.teamId] ??= blank(t.name);
      counts[t.teamId].ranks[Math.min(6, Math.max(1, t.rank)) - 1]++;
    });
    if (s.championTeamId && counts[s.championTeamId]) {
      counts[s.championTeamId].jsChamp++;
    } else if (!s.championTeamId && s.champion) {
      const byName = Object.values(counts).find((r) => r.name === s.champion);
      if (byName) byName.jsChamp++;
    }
  });
  const rows = Object.values(counts).sort((a, b) => (b.ranks[0] - a.ranks[0]) || (b.jsChamp - a.jsChamp))
    .map((r) => `<tr><td class="name">${r.name}</td>${r.ranks.map((n) => `<td>${n}</td>`).join('')}<td>${r.jsChamp}</td></tr>`).join('');
  return `<details class="howto" style="margin-bottom:10px;">
    <summary>各チームの優勝・順位回数（記録済み全${history.length}シーズン合算）</summary>
    <table class="compact-table"><thead><tr><th class="namehead">チーム</th><th>優勝</th><th>2位</th><th>3位</th><th>4位</th><th>5位</th><th>6位</th><th>シリーズ制覇</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </details>`;
}

/** 監督の通算成績（現任＋過去の監督） */
function managerHistoryHTML(): string {
  const rows: { team: string; label: string; wins: number; losses: number; ties: number; pct: number }[] = [];
  DB.teams.forEach((t) => {
    (t.managerHistory || []).concat(t.manager ? [t.manager] : []).forEach((m) => {
      const g = (m.wins || 0) + (m.losses || 0);
      rows.push({ team: t.name, label: m.label, wins: m.wins || 0, losses: m.losses || 0, ties: m.ties || 0, pct: g > 0 ? (m.wins || 0) / g : 0 });
    });
  });
  const list = rows.filter((r) => r.wins + r.losses + r.ties > 0).sort((a, b) => b.pct - a.pct);
  if (!list.length) return '';
  return `<details class="howto" style="margin-bottom:10px;">
    <summary>監督の通算成績</summary>
    <table class="compact-table"><thead><tr><th class="namehead">チーム</th><th>采配</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th></tr></thead>
    <tbody>${list.map((r) => `<tr><td class="name">${r.team}</td><td>${r.label}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.ties}</td><td>${fmt3(r.pct)}</td></tr>`).join('')}</tbody></table>
  </details>`;
}

/** 歴代個人成績トップ10（現役の通算＋OB。在籍10年以上が対象） */
function allTimeHTML(): string {
  interface AllTime { name: string; team: string; career: StatLine; pCareer: PitchLine | null; awards: Awards; active: boolean; seasonsPlayed: number; debutSeason: number; lastSeason: number }
  const players: AllTime[] = [];
  DB.teams.forEach((t) => {
    [...t.roster, ...t.pitchers].forEach((p) => players.push({ name: p.name, team: t.name, career: p.career, pCareer: p.pitch ? p.pCareer : null, awards: p.awards, active: true, seasonsPlayed: p.seasonsPlayed || 0, debutSeason: p.debutSeason || 1, lastSeason: DB.currentSeasonNum || 1 }));
    (t.alumni || []).forEach((a) => players.push({ name: a.name, team: t.name, career: a.career, pCareer: a.isPitcher && a.pCareer ? a.pCareer : null, awards: a.awards || EMPTY_AWARDS, active: false, seasonsPlayed: a.seasonsPlayed || 0, debutSeason: a.debutSeason || 1, lastSeason: a.lastSeason || 1 }));
  });
  if (!players.length) return '';
  const qualified = players.filter((x) => x.seasonsPlayed >= 10 && !x.pCareer);
  const qualifiedPitchers = players.filter((x) => x.seasonsPlayed >= 10 && x.pCareer);
  const seasonRange = (x: AllTime) => (x.active ? `'${x.debutSeason}-現役` : `'${x.debutSeason}-'${x.lastSeason}`);
  const statTable = (title: string, calc: (x: AllTime) => number, fmtFn: (x: AllTime) => string) => {
    const rows = qualified.slice().sort((a, b) => calc(b) - calc(a)).slice(0, 10)
      .map((x, i) => `<tr><td>${i + 1}</td><td class="name">${x.name}（${x.team}${x.active ? '' : '・OB'}）<div class="muted" style="font-size:9px;">${seasonRange(x)}</div></td><td>${fmtFn(x)}</td></tr>`).join('');
    return `<div style="font-weight:800;color:var(--pencil);margin-top:8px;">${title}</div>
    <table class="compact-table"><thead><tr><th></th><th class="namehead">選手</th><th>${title.replace('通算', '')}</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  };
  const pitchTable = (title: string, calc: (x: AllTime) => number, fmtFn: (x: AllTime) => string) => {
    const rows = qualifiedPitchers.slice().sort((a, b) => calc(b) - calc(a)).slice(0, 10)
      .map((x, i) => `<tr><td>${i + 1}</td><td class="name">${x.name}（${x.team}${x.active ? '' : '・OB'}）<div class="muted" style="font-size:9px;">${seasonRange(x)}</div></td><td>${fmtFn(x)}</td></tr>`).join('');
    return `<div style="font-weight:800;color:var(--pencil);margin-top:8px;">${title}</div>
    <table class="compact-table"><thead><tr><th></th><th class="namehead">選手</th><th>${title.replace('通算', '')}</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  };
  const awardRows = players.filter((x) => awardTotal(x.awards) > 0)
    .sort((a, b) => awardTotal(b.awards) - awardTotal(a.awards)).slice(0, 10)
    .map((x) => `<tr><td class="name">${x.name}（${x.team}${x.active ? '' : '・OB'}）</td><td>${x.awards.mvp}</td><td>${x.awards.bestNine}</td><td>${x.awards.psMvp}</td><td>${x.awards.rookie}</td><td>${x.awards.goldenGlove}</td></tr>`).join('');
  return `<details class="howto" style="margin-bottom:10px;">
    <summary>歴代個人成績トップ10（現役＋引退選手・通算／在籍10年以上）</summary>
    <div style="margin-top:8px;">
      ${qualified.length === 0 ? '<div class="muted">在籍10年以上の選手がまだいません。</div>' : `
      ${statTable('通算打率', (x) => avgOfStats(x.career), (x) => fmt3(avgOfStats(x.career)))}
      ${statTable('通算安打', (x) => x.career.h, (x) => x.career.h + '本')}
      ${statTable('通算本塁打', (x) => x.career.hr, (x) => x.career.hr + '本')}
      ${statTable('通算打点', (x) => x.career.rbi, (x) => x.career.rbi + '点')}
      ${statTable('通算盗塁', (x) => x.career.sb || 0, (x) => (x.career.sb || 0) + '個')}
      ${statTable('通算OPS', (x) => opsOfStats(x.career), (x) => fmt3plain(opsOfStats(x.career)))}
      ${pitchTable('通算勝利', (x) => x.pCareer!.w, (x) => x.pCareer!.w + '勝')}
      ${pitchTable('通算セーブ', (x) => x.pCareer!.sv, (x) => x.pCareer!.sv + 'S')}
      ${pitchTable('通算奪三振', (x) => x.pCareer!.k, (x) => String(x.pCareer!.k))}
      <div style="font-weight:800;color:var(--pencil);margin-top:8px;">受賞歴（MVP／ベストナイン／CS MVP／新人王／ゴールデングラブ）</div>
      <table class="compact-table"><thead><tr><th class="namehead">選手</th><th>MVP</th><th>BN</th><th>CS</th><th>新人</th><th>GG</th></tr></thead>
      <tbody>${awardRows || '<tr><td colspan="6" class="muted">まだ受賞者がいません。</td></tr>'}</tbody></table>`}
    </div>
  </details>`;
}

export function renderHistory(): string {
  const history = UI.seasonHistory;
  if (history === null) {
    ensureHistoryLoaded();
    return `<div class="card"><h2>球団史</h2><div class="muted">読み込み中…</div></div>`;
  }
  if (history.length === 0) {
    return `<div class="card"><h2>球団史</h2><div class="muted">まだ記録がありません。レギュラーシーズンを終えてから「シーズンを新しくする」を実行すると、そのシーズンの最終成績が記録されます。</div></div>`;
  }
  const cards = history.slice().sort((a, b) => b.seasonNum - a.seasonNum).map(seasonCardHTML).join('');
  const storageNote = STORAGE_AVAILABLE
    ? 'この端末に保存され、次に開いたときも残ります'
    : 'このブラウザタブを開いている間だけ保持されます。タブを閉じたり再読み込みすると消えます';
  return `<div class="card"><h2>球団史</h2><div class="muted">これまでのシーズンの最終成績を記録しています（${storageNote}）。チーム名・選手はシーズンをまたいで引き継がれ、オフシーズンごとに各球団1名だけガチャで入れ替わります。</div></div>`
    + recordsAndNewsHTML() + trendHTML(history) + teamTotalsHTML(history) + rankCountsHTML(history) + managerHistoryHTML() + allTimeHTML() + cards;
}

export function wireHistoryEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-share-season]').forEach((b) => {
    b.onclick = () => {
      const rec = (UI.seasonHistory ?? []).find((x) => String(x.seasonNum) === b.dataset.shareSeason);
      if (rec) void shareSeason(rec).then((msg) => showToast(msg));
    };
  });
}

/** 画面下に一時的なメッセージを出す */
function showToast(msg: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
