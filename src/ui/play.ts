/* 「試合」タブ：マイチーム選択・日程・試合画面・ポストシーズン・オフシーズンガチャ */
import { currentBattingKey, emptyBases, pencilsFor, pencilSummary } from '../engine/atbat';
import { ABILITY_INFO, FACE_LABEL, P1_FACES, P2_FACES, POSTSEASON_NAMES, SERIES_KEYS } from '../engine/data';
import { autoSimGame, changePitcher, currentBatter, fieldersOf, newGame, rollStep } from '../engine/game';
import { availableBench, decisionCard, executeBunt, executeIntentionalWalk, forceSteal, markCardShown, pencilHeadline, pinchHit, pitcherNow } from '../engine/tactics';
import { currentPitcher, fatigueOf, findPlayer } from '../engine/pitching';
import { ArchiveError, archiveCurrentSeason } from '../engine/history';
import { autoCompletePostseason, progressPostseason, startPostseason } from '../engine/postseason';
import { currentDay, lastDay, regularSeasonComplete } from '../engine/schedule';
import { completeDaysThrough, simulateDays, simulateScheduleGame } from '../engine/days';
import { startNewSeason } from '../engine/season';
import { DB, leagueName, teamById } from '../engine/state';
import { eraOf, ipOf, opsOf } from '../engine/stats';
import { gachaCandidates, gachaSwapAllTeams, worstPerformer } from '../engine/team';
import type { Game, Player, ScheduleGame, Series, SeriesKey } from '../engine/types';
import { choice } from '../engine/util';
import { render } from './app';
import { $, $$, abilityBadges, abilityShort, fmt3plain, fmtEra, gradeBadge, gradeOf, shortTeamName } from './format';
import { openConfirmModal } from './modal';
import { latestNewsHTML } from './news';
import { shareSeason } from './share';
import { maybeShowGuide } from './guide';
import { UI, resetTransientUi } from './state';

const seasonDone = () => regularSeasonComplete(DB.schedule);

export function renderPlayTab(): string {
  return UI.liveGame ? playScreenHTML(UI.liveGame) : scheduleHTML();
}

/* ---------- マイチーム選択・日程 ---------- */
function teamPickerHTML(): string {
  const cards = DB.teams.map((t) => `
    <div class="team-card" data-myteam="${t.id}">
      <div class="lg">${leagueName(t.league)}</div>
      <div class="tn">${t.name}</div>
      <div class="tg">${t.tagline}</div>
    </div>`).join('');
  return `<div class="card">
    <h2>マイチームを選んでください</h2>
    <div class="muted" style="margin-bottom:8px;">選んだチームの試合だけ、自分で鉛筆を転がしてプレイできます。他チーム同士の試合は自動シミュレートで消化します。</div>
    <div class="team-grid">${cards}</div>
  </div>`;
}

function gachaResultsHTML(): string {
  if (!UI.gachaResults) return '';
  const rows = UI.gachaResults.filter((r) => !r.skipped && r.out && r.in).map((r) => `
    <div class="gacha-row ${UI.myTeamId === r.team.id ? 'mine' : ''}">
      <div class="gacha-team">${r.team.name}</div>
      <div class="gacha-swap">
        <span class="gacha-out">${r.out!.name}（${r.out!.pos}・${r.out!.age}歳）</span>
        <span class="gacha-arrow">→</span>
        <span class="gacha-in">${r.in!.name}（${r.in!.pos}・${r.in!.age}歳）</span>
      </div>
      <div class="muted" style="font-size:10.5px;">${abilityBadges(r.in!)}${r.in!.ability ? `　<span class="pill">${ABILITY_INFO[r.in!.ability].label}</span>` : ''}</div>
    </div>`).join('');
  const skipped = UI.gachaResults.filter((r) => r.skipped).length;
  return `<div class="card">
    <h2>補強ガチャの結果</h2>
    ${rows || '<div class="muted">入れ替えはありませんでした。</div>'}
    ${skipped ? `<div class="muted" style="font-size:11px;margin-top:6px;">ほか${skipped}球団は今回は見送り</div>` : ''}
    <button class="btn secondary small" id="closeGachaBtn" style="margin-top:8px;">閉じる</button>
  </div>`;
}

/** 補強ガチャ（1回のオフにつき1回だけ） */
function gachaStepHTML(): string {
  if (DB.gachaDoneThisCycle) return `<div class="muted">今オフの補強は完了しました。${UI.gachaResults ? '' : '（新人は「名鑑」で確認できます）'}</div>`;
  if (!UI.gachaSelecting) {
    return `<div class="muted" style="margin-bottom:6px;">各球団1名を新人と入れ替えます。自チームは放出する選手を選べます（見送りも可）。</div>
      <button class="btn small" id="gachaBtn">放出する選手を選ぶ</button>`;
  }
  const myTeam = teamById(UI.myTeamId!)!;
  const selectablePlayers = gachaCandidates(myTeam);
  if (UI.gachaMySelection !== '__skip__' && !selectablePlayers.some((p) => p.id === UI.gachaMySelection)) {
    UI.gachaMySelection = worstPerformer(myTeam).id;
  }
  const protectedCount = myTeam.roster.length + myTeam.pitchers.length - selectablePlayers.length;
  const perf = (p: Player) => (p.pitch ? (p.pStats.outs >= 30 ? '防御率' + fmtEra(eraOf(p.pStats)) : '登板少') : (p.stats.ab >= 10 ? 'OPS' + fmt3plain(opsOf(p)) : '出場少'));
  const opts = selectablePlayers.map((p) => `<option value="${p.id}" ${UI.gachaMySelection === p.id ? 'selected' : ''}>${p.pos} ${p.name}・${p.age}歳（${abilityShort(p)}／${perf(p)}）</option>`).join('')
    + `<option value="__skip__" ${UI.gachaMySelection === '__skip__' ? 'selected' : ''}>今回は誰も放出しない</option>`;
  return `<div class="muted" style="margin-bottom:6px;">放出する1名（初期値は成績が振るわない選手）${protectedCount > 0 ? `。加入2年未満の${protectedCount}名は対象外` : ''}</div>
    <select data-gachaselect="${myTeam.id}">${opts}</select>
    <div class="row" style="margin-top:8px;">
      <button class="btn small" id="confirmGachaBtn">ガチャを引く（取り消し不可）</button>
      <button class="btn secondary small" id="cancelGachaBtn">やめる</button>
    </div>`;
}

function vsLabel(g: ScheduleGame): string {
  const opp = teamById(g.home === UI.myTeamId ? g.away : g.home)!;
  return `${g.home === UI.myTeamId ? 'vs' : '@'} ${opp.name}`;
}

/** 次の試合の予告先発（ローテーションの順番を進めずに見るだけ） */
function probableStarter(teamId: string): Player | undefined {
  const t = teamById(teamId)!;
  const rot = t.staff.rotation.map((id) => findPlayer(t, id)).filter((p): p is Player => !!p);
  return rot.length ? rot[(t.rotationIdx || 0) % rot.length] : undefined;
}

function resultMark(g: ScheduleGame): string {
  const r = g.result!;
  const my = g.home === UI.myTeamId ? r.home : r.away, opp = g.home === UI.myTeamId ? r.away : r.home;
  const mark = r.winner === 'tie' ? '△' : my > opp ? '○' : '●';
  return `<span class="pill ${mark === '○' ? 'win' : mark === '●' ? 'lose' : ''}">${mark} ${my}-${opp}</span>`;
}

function scheduleHTML(): string {
  if (!UI.myTeamId) return teamPickerHTML();
  const isMine = (g: ScheduleGame) => g.home === UI.myTeamId || g.away === UI.myTeamId;
  const mine = DB.schedule.filter(isMine).sort((a, b) => a.day - b.day || a.order - b.order);
  const unplayed = mine.filter((g) => !g.played);
  const played = mine.filter((g) => g.played);
  const today = unplayed[0] ?? null;

  const shareHtml = UI.lastArchived ? `<div class="card share-card row between">
      <div><b>第${UI.lastArchived.seasonNum}シーズンのまとめ</b><div class="muted" style="font-size:11px;">結果を画像にしてSNSで共有</div></div>
      <div class="row" style="gap:6px;"><button class="btn small" data-share="last">📤 シェア</button><button class="btn secondary small" id="closeShareBtn">✕</button></div>
    </div>` : '';

  if (!today) return shareHtml + offseasonHTML() + gachaResultsHTML();

  const myStarter = probableStarter(UI.myTeamId);
  const oppId = today.home === UI.myTeamId ? today.away : today.home;
  const oppStarter = probableStarter(oppId);
  const starterLine = (p?: Player) => (p?.pitch ? `${p.name}<span class="muted">（球威${gradeOf(p.pitch.stuff)}・制球${gradeOf(p.pitch.control)}）</span>` : '-');

  const shortVs = (g: ScheduleGame) => {
    const opp = teamById(g.home === UI.myTeamId ? g.away : g.home)!;
    return `${g.home === UI.myTeamId ? 'vs' : '@'} ${shortTeamName(opp.name)}`;
  };
  const recent = played.slice(-3).reverse().map((g) => `<div class="list-row"><span><span class="sub">${g.day}日</span> ${shortVs(g)}</span>${resultMark(g)}</div>`).join('');
  const upcoming = unplayed.slice(1, 4).map((g) => `<div class="list-row"><span><span class="sub">${g.day}日</span> ${shortVs(g)}</span></div>`).join('');

  return `
  ${shareHtml}
  <div class="card today-card">
    <div class="row between"><span class="muted">第${today.day}日 / 全${lastDay(DB.schedule)}日</span><button class="link-btn" id="editLineupBtn">⚙ 編成</button></div>
    <div class="today-vs">${vsLabel(today)}</div>
    <div class="starters">
      <div><span class="muted">先発</span> ${starterLine(myStarter)}</div>
      <div><span class="muted">相手</span> ${starterLine(oppStarter)}</div>
    </div>
    <button class="btn play-btn" data-play="${today.id}">▶ 試合を観る</button>
    <div class="row today-sub">
      <button class="link-btn" data-sim="${today.id}">結果だけ見る</button>
      <button class="link-btn" id="simWeekBtn">6日進める</button>
      <button class="link-btn" id="simSeasonBtn">シーズン終了まで</button>
    </div>
  </div>
  <div class="card">
    <div class="two-col">
      <div><div class="section-title" style="margin-top:0;">最近</div>${recent || '<div class="muted">まだ試合がありません</div>'}</div>
      <div><div class="section-title" style="margin-top:0;">この先</div>${upcoming || '<div class="muted">-</div>'}</div>
    </div>
  </div>
  ${latestNewsHTML(3)}
  `;
}

/** レギュラーシーズン終了後：①ポストシーズン ②補強ガチャ ③新しいシーズン の順に進める */
function offseasonHTML(): string {
  const ps = DB.postseason;
  const psDone = !!ps?.champion;
  const step = (n: number, title: string, state: 'done' | 'now' | 'todo', body: string) => `
    <div class="step ${state}"><div class="step-no">${state === 'done' ? '✓' : n}</div><div class="step-body"><div class="step-title">${title}</div>${state === 'todo' ? '' : body}</div></div>`;
  const psBody = psDone
    ? `<div class="muted">${POSTSEASON_NAMES.final} 優勝：<b style="color:var(--pencil);">${ps!.champion!.name}</b></div>`
    : `<div class="row">${ps ? '' : '<button class="btn small" id="startPostseasonBtn">1試合ずつ進める</button>'}<button class="btn ${ps ? 'small' : 'secondary small'}" id="simPostseasonBtn">残りを自動で消化</button></div>`;
  const newSeasonBody = `<button class="btn small" id="newSeasonBtn">第${DB.currentSeasonNum + 1}シーズンを始める</button>
    <div class="muted" style="font-size:11px;margin-top:4px;">今シーズンの成績を球団史に記録してから始めます</div>`;
  return `<div class="card">
    <h2>シーズン終了 — オフの手続き</h2>
    ${step(1, 'ポストシーズン', psDone ? 'done' : 'now', psBody)}
    ${step(2, '補強ガチャ', DB.gachaDoneThisCycle ? 'done' : psDone ? 'now' : 'todo', gachaStepHTML())}
    ${step(3, '新しいシーズン', psDone && DB.gachaDoneThisCycle ? 'now' : 'todo', newSeasonBody)}
    ${psDone && !DB.gachaDoneThisCycle ? '<div class="muted" style="font-size:11px;margin-top:6px;">ガチャを引かずに新しいシーズンを始めると、全球団おまかせで入れ替えます。<button class="link-btn" id="newSeasonBtn2">このまま始める</button></div>' : ''}
  </div>
  ${ps && !psDone ? postseasonSectionHTML() : ''}
  ${psDone ? `<details class="howto"><summary>ポストシーズンの結果</summary>${postseasonSectionHTML()}</details>` : ''}`;
}

/* ---------- ポストシーズン ---------- */
function seriesGamesHTML(s: Series): string {
  return s.games.map((g, i) => {
    const h = teamById(g.homeId)!, a = teamById(g.awayId)!;
    return `<div class="game-row"><div class="vs">第${i + 1}戦　${a.name} ${g.scoreAway} - ${g.scoreHome} ${h.name}${g.tie ? '（引分・再戦）' : ''}</div></div>`;
  }).join('');
}
function seriesCard(key: SeriesKey, s: Series | null): string {
  if (!s) return '';
  if (s.winner) {
    // 決着済みシリーズはコンパクトに1行で表示（各戦の詳細は折りたたみ）
    return `<details class="howto">
        <summary>${s.label}：${s.teamA.name} ${s.winsA}-${s.winsB} ${s.teamB.name}　→ ${s.winner.name}突破</summary>
        <div style="margin-top:8px;">${seriesGamesHTML(s)}</div>
      </details>`;
  }
  const nextNum = s.games.length + 1;
  return `<div class="card">
      <h2>${s.label}</h2>
      <div class="muted">${s.teamA.name} ${s.winsA} - ${s.winsB} ${s.teamB.name}</div>
      ${seriesGamesHTML(s)}
      <div class="row" style="margin-top:6px;">
        <button class="btn small" data-psplay="${key}">第${nextNum}戦を観る</button>
        <button class="btn small secondary" data-pssim="${key}">第${nextNum}戦を自動</button>
      </div>
    </div>`;
}
function postseasonSectionHTML(): string {
  progressPostseason();
  const ps = DB.postseason;
  if (!ps) {
    return `<div class="card">
      <div class="muted" style="margin-bottom:8px;">ポストシーズンは、ここから1試合ずつ「観る」または「自動」で進めます（「試合」カードの一括自動シミュレートボタンでもまとめて消化できます）。</div>
      <button class="btn" id="startPostseasonBtn">プレーオフを開始</button>
    </div>`;
  }
  let html = SERIES_KEYS.map((key) => seriesCard(key, ps.series[key])).join('');
  if (ps.champion) {
    html += `<div class="finish-banner"><div>${POSTSEASON_NAMES.final} 優勝</div><div class="score">${ps.champion.name}</div></div>`;
  }
  return html;
}

/* ---------- 試合画面 ---------- */
function linescoreHTML(game: Game): string {
  const awayArr = game.inningRuns.away, homeArr = game.inningRuns.home;
  const maxInning = Math.max(9, game.inning, homeArr.length, awayArr.length);
  function cell(arr: number[], i: number, otherLen: number): string | number {
    if (i < arr.length) return arr[i];
    // ホームが裏を戦わずに終わった回（サヨナラ・逃げ切り）は「X」で表す
    if (game.finished && i < otherLen) return 'X';
    return '';
  }
  let head = '<th class="namehead"></th>';
  for (let i = 0; i < maxInning; i++) head += `<th>${i + 1}</th>`;
  head += '<th>R</th><th>H</th><th>E</th>';
  const row = (side: 'home' | 'away', arr: number[], other: number[]) =>
    `<tr><td class="name">${game[side].name}</td>` +
    Array.from({ length: maxInning }, (_, i) => `<td>${cell(arr, i, other.length)}</td>`).join('') +
    `<td class="hl">${game.score[side]}</td><td>${game.hits[side]}</td><td>${game.errors[side]}</td></tr>`;
  return `<table class="linescore">
    <thead><tr>${head}</tr></thead>
    <tbody>${row('away', awayArr, homeArr)}${row('home', homeArr, awayArr)}</tbody>
  </table>`;
}

function pencilBarsHTML(batter: Player, game: Game): string {
  const [p1, p2] = pencilSummary(pencilsFor(batter, game));
  const bar = (label: string, segs: { key: string; label: string; pct: number }[]) => `
    <div class="pencil-bar-row">
      <div class="pencil-bar-label">${label}</div>
      <div class="pencil-bar">${segs.map((x) => {
        const pct = Math.round(x.pct);
        // 項目名が収まる幅のときだけ名前も出す（狭い面は％のみ。色の凡例を下に表示）
        const text = x.pct >= x.label.length * 4.5 + 5 ? `${x.label}<small>${pct}%</small>` : x.pct >= 6 ? `<small>${pct}%</small>` : '';
        return `<div class="seg seg-${x.key}" style="flex:${x.pct}" title="${x.label} ${pct}%">${text}</div>`;
      }).join('')}</div>
    </div>`;
  const legend = [['hit', 'ヒット・2ベース'], ['walk', '四球'], ['otto', 'おっと'], ['hr', 'HR'], ['k', '三振'], ['out', '凡打']]
    .map(([k, l]) => `<span><i class="seg-${k}"></i>${l}</span>`).join('');
  return `<div class="pencil-bars"><div class="pencil-title">${batter.name}の鉛筆</div>${bar('1本目', p1)}${bar('2本目', p2)}<div class="pencil-legend">${legend}</div></div>`;
}

/** 守っている投手（能力と疲れ具合） */
function pitcherLineHTML(game: Game): string {
  const side = game.half === 'top' ? 'home' : 'away';
  const p = currentPitcher(game, side);
  if (!p?.pitch) return '';
  const f = fatigueOf(game, side);
  const box = game.pbox[p.id];
  const tired = f >= 0.6 ? 'ばてばて' : f >= 0.25 ? '疲れ気味' : '元気';
  return `<div class="pitcher-line">投手 <b>${p.name}</b> 球威${gradeOf(p.pitch.stuff)} 制球${gradeOf(p.pitch.control)}　<span class="${f >= 0.25 ? 'tired' : ''}">${tired}</span><span class="muted">（${box ? box.bf : 0}人目）</span></div>`;
}

/** ボックススコア（試合の個人打撃成績） */
function boxScoreHTML(game: Game): string {
  const table = (side: 'away' | 'home') => {
    const team = game[side];
    const rows = fieldersOf(game, side).map((p, i) => {
      const b = game.box[p.id] ?? { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0, r: 0, sb: 0 };
      const hot = b.h >= 3 || b.hr >= 1 || b.rbi >= 3;
      return `<tr class="${hot ? 'hot' : ''}"><td>${i + 1}</td><td class="name tap" data-player="${p.id}">${p.name}<span class="muted" style="font-size:9px;">(${p.pos})</span></td><td>${b.ab}</td><td>${b.h}</td><td>${b.rbi}</td><td>${b.hr}</td><td>${b.bb}</td><td>${b.k}</td><td>${b.sb}</td></tr>`;
    }).join('');
    return `<div class="box-team">${team.name}</div>
      <table class="compact-table box"><thead><tr><th></th><th class="namehead">選手</th><th>打</th><th>安</th><th>点</th><th>本</th><th>四</th><th>三</th><th>盗</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  const pitchTable = (side: 'away' | 'home') => {
    const rows = game.pitchersUsed[side].map((id) => {
      const p = findPlayer(game[side], id);
      const b = game.pbox[id];
      if (!p || !b) return '';
      const dec = b.dec ? `<span class="pill ${b.dec === 'L' ? 'lose' : 'win'}" style="margin-left:4px;">${{ W: '勝', L: '敗', S: 'S' }[b.dec]}</span>` : '';
      return `<tr><td class="name tap" data-player="${p.id}">${p.name}${dec}</td><td>${ipOf(b)}</td><td>${b.bf}</td><td>${b.h}</td><td>${b.hr}</td><td>${b.bb}</td><td>${b.k}</td><td>${b.r}</td></tr>`;
    }).join('');
    return `<table class="compact-table box" style="margin-top:6px;"><thead><tr><th class="namehead">投手</th><th>回</th><th>打者</th><th>安</th><th>本</th><th>四</th><th>三</th><th>失</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  return `<details class="howto" open><summary>ボックススコア</summary>${table('away')}${pitchTable('away')}${table('home')}${pitchTable('home')}</details>`;
}

function playScreenHTML(game: Game): string {
  const battingKey = currentBattingKey(game);
  const batter = !game.finished ? currentBatter(game) : null;
  const outsDots = [0, 1].map((i) => `<span class="dot ${i < game.outs ? 'on' : ''}"></span>`).join('');
  const bases = game.bases;
  const runnerText = `1塁 <b>${bases.first ? bases.first.name : '-'}</b>　2塁 <b>${bases.second ? bases.second.name : '-'}</b>　3塁 <b>${bases.third ? bases.third.name : '-'}</b>`;

  const pencil2Active = game.pencilStage === 'awaitingPencil2';
  const p1Text = game.pendingP1 ? FACE_LABEL[game.pendingP1] : (game.lastPlay ? FACE_LABEL[game.lastPlay.p1] : '?');
  const p2Text = (!pencil2Active && game.lastPlay?.p2) ? FACE_LABEL[game.lastPlay.p2] : '?';
  const btnLabel = pencil2Active ? '② もう一本の鉛筆を転がす！' : '① 鉛筆を転がす';
  const noteText = pencil2Active ? '「おっと」が出た！もう一本転がそう' : '';

  const abilityFlashHtml = (!pencil2Active && game.lastPlay?.abilityKey)
    ? `<div class="ability-flash">⚡ ${ABILITY_INFO[game.lastPlay.abilityKey].label}、発動！
        <div class="ability-flash-note">${game.lastPlay.abilityNote}</div>
      </div>`
    : '';
  const logHtml = game.log.slice(-12).map((l) => `<div>${l}</div>`).join('');

  const scoreboard = `
    <div class="scoreboard">
      <div class="sb-team"><div class="nm">${game.away.name}</div><div class="sc">${game.score.away}</div></div>
      <div class="sb-mid">
        <div class="sb-inning">${game.finished ? '試合終了' : `${game.inning}回${game.half === 'top' ? '表 ▲' : '裏 ▼'}`}</div>
        ${game.finished ? '' : `<div class="sb-outs">${outsDots} <span class="muted" style="font-size:10px;">OUT</span></div>`}
      </div>
      <div class="sb-team"><div class="nm">${game.home.name}</div><div class="sc">${game.score.home}</div></div>
    </div>
    ${linescoreHTML(game)}`;

  if (game.finished) {
    const w = game.winner === 'tie' ? '引き分け' : (game.winner === 'home' ? game.home.name : game.away.name) + ' の勝利！';
    return `
    <div class="card">
      ${scoreboard}
      ${abilityFlashHtml}
      <div class="finish-banner">
        <div class="score">${w}</div>
        <button class="btn" id="backToScheduleBtn">${game.seriesKey ? '順位表・シリーズに戻る' : '日程に戻る'}</button>
      </div>
      ${boxScoreHTML(game)}
      <div class="log-box" id="logBox">${logHtml}</div>
    </div>`;
  }

  return `
  <div class="card play-card">
    ${scoreboard}
    <div class="field-row">
      <div class="diamond">
        <div class="base" id="b-second"></div>
        <div class="base" id="b-first"></div>
        <div class="base" id="b-third"></div>
        <div id="b-home"></div>
      </div>
      ${batter ? `
      <div class="batter-card">
        <div class="nm"><span class="pos">${batter.pos}</span>${batter.name}<span class="muted" style="font-size:10.5px;font-weight:400;">　${game[battingKey].name}</span></div>
        <div class="stats">パワー${gradeBadge(batter.power)} ミート${gradeBadge(batter.contact)} 走力${gradeBadge(batter.speed)}${batter.ability ? `<span class="pill" style="margin-left:4px;">${ABILITY_INFO[batter.ability].label}</span>` : ''}</div>
        <div class="runners-text">${runnerText}</div>
        ${pitcherLineHTML(game)}
      </div>` : ''}
    </div>
    ${decisionCardHTML(game)}
    ${batter ? pencilBarsHTML(batter, game) : ''}
    <div class="dice-area">
      <div><div class="hex" id="hex1">${p1Text}</div><div class="hex-label">1本目</div></div>
      <div><div class="hex ${pencil2Active ? '' : 'dim'}" id="hex2">${p2Text}</div><div class="hex-label">2本目</div></div>
    </div>
    <div class="play-note" id="playNote">${noteText}</div>
    ${abilityFlashHtml}
    <div class="log-box" id="logBox">${logHtml}</div>
  </div>
  <div class="roll-dock">
    <button class="btn roll-btn" id="rollBtn" aria-disabled="${UI.rolling}">${btnLabel}</button>
    <div class="hold-hint">長押しで早送り</div>
  </div>
  `;
}

function updateDiamondClasses(game: Pick<Game, 'bases'>): void {
  const b = game.bases;
  $('#b-first')?.classList.toggle('occ', !!b.first);
  $('#b-second')?.classList.toggle('occ', !!b.second);
  $('#b-third')?.classList.toggle('occ', !!b.third);
}

/* ---------- 鉛筆を転がす（タップ1回＝1本、長押しで早送り） ---------- */
let holdStartTimer: ReturnType<typeof setTimeout> | null = null;
let holdRepeatTimer: ReturnType<typeof setInterval> | null = null;
const HOLD_THRESHOLD_MS = 350; // このくらい押し続けたら早送りモードに入る
const HOLD_REPEAT_MS = 90;     // 早送り中、1打席を処理する間隔

export function clearHoldTimers(): void {
  if (holdStartTimer) { clearTimeout(holdStartTimer); holdStartTimer = null; }
  if (holdRepeatTimer) { clearInterval(holdRepeatTimer); holdRepeatTimer = null; }
}
/**
 * 指・マウスを離したことはページ全体で検知する。
 * （転がしている間はボタンが無効化されるため、ボタン自身には mouseup が届かない。
 *   元の版ではこれにより、1回クリックしただけで早送りが始まっていた）
 */
function listenForRelease(): void {
  const release = () => {
    releaseRoll();
    window.removeEventListener('mouseup', release);
    window.removeEventListener('touchend', release);
    window.removeEventListener('touchcancel', release);
    window.removeEventListener('blur', release);
  };
  window.addEventListener('mouseup', release);
  window.addEventListener('touchend', release);
  window.addEventListener('touchcancel', release);
  window.addEventListener('blur', release);
}
/** 観戦する試合で、マイチームの側をプレイヤーの采配にする（設定でカードを切っていれば AI 任せ） */
function withManualSide(game: Game): Game {
  if (DB.options?.decisionCards === false) return game;
  game.manualSide = game.home.id === UI.myTeamId ? 'home' : game.away.id === UI.myTeamId ? 'away' : null;
  return game;
}

/** 観戦中の試合を1本進める。マイチームの試合が終わったら、その日の他球団の試合も消化する */
function rollLiveStep(game: Game): ReturnType<typeof rollStep> {
  const card = decisionCard(game);
  if (card) markCardShown(game, card);
  const res = rollStep(game);
  if (game.finished && game.scheduleId) {
    const g = DB.schedule.find((x) => x.id === game.scheduleId);
    if (g) completeDaysThrough(g.day);
  }
  return res;
}

function pressRoll(): void {
  if (UI.rolling || !UI.liveGame || UI.liveGame.finished) return;
  const gameRef = UI.liveGame;
  doRoll(); // 1回分はアニメーション付きで転がす
  clearHoldTimers();
  listenForRelease();
  holdStartTimer = setTimeout(() => {
    holdRepeatTimer = setInterval(() => {
      if (UI.tab !== 'play' || UI.liveGame !== gameRef || gameRef.finished) { clearHoldTimers(); return; }
      // 早送り中はアニメーションを省略し、1打席ずつ素早く処理して都度再描画する
      if (decisionCard(gameRef)) { clearHoldTimers(); render(); return; }
      rollLiveStep(gameRef);
      render();
    }, HOLD_REPEAT_MS);
  }, HOLD_THRESHOLD_MS);
}
function releaseRoll(): void {
  clearHoldTimers();
}
function doRoll(): void {
  const game = UI.liveGame;
  if (UI.rolling || !game || game.finished) return;
  const wasAwaiting = game.pencilStage === 'awaitingPencil2';
  UI.rolling = true;
  const rollBtn = $('#rollBtn');
  rollBtn?.setAttribute('aria-disabled', 'true'); // disabled にすると mouseup が届かず長押し判定が解けないため、見た目だけ無効にする

  const res = rollLiveStep(game); // エンジンは同期的に結果を確定する

  const hex = $(wasAwaiting ? '#hex2' : '#hex1');
  const faces: readonly string[] = wasAwaiting ? P2_FACES : P1_FACES;
  hex?.classList.add('spin');

  // 一定間隔でフリップして、すぐ結果を見せる（約0.5秒）
  let spins = 0;
  const spinTimer = setInterval(() => {
    if (hex) hex.textContent = FACE_LABEL[choice(faces)];
    spins++;
    if (spins > 7) {
      clearInterval(spinTimer);
      const face = res && (wasAwaiting ? ('p2' in res ? res.p2 : null) : res.p1);
      if (hex) hex.textContent = face ? FACE_LABEL[face] : '?';
      UI.rolling = false;
      render();
    }
  }, 60);
}

/* ---------- イベント ---------- */
function on(sel: string, handler: () => void): void {
  const el = $(sel);
  if (el) el.onclick = handler;
}


function confirmNewSeason(): void {
  const done = seasonDone();
  const psUnfinished = done && !DB.postseason?.champion;
  const gachaSkipped = done && !DB.gachaDoneThisCycle;
  const noteParts: string[] = [];
  if (psUnfinished) noteParts.push('ポストシーズンが未完了のため、残りは自動で最後まで消化されます。');
  if (gachaSkipped) noteParts.push('オフシーズン補強ガチャがまだのため、自チームも含めて全球団、年齢・成績を見て自動で判断されます。');
  const msg = done
    ? `今シーズンの最終成績を「球団史」に記録してから、今シーズンの成績・スケジュール・ポストシーズンをリセットして新シーズンを始めます（チーム名・選手・編集内容はそのまま引き継がれます）。${noteParts.join('')}よろしいですか？`
    : '現在の成績・スケジュール・ポストシーズンをリセットして新シーズンを始めます（このシーズンはレギュラーシーズン未消化のため記録には残りません。チーム名・選手はそのまま引き継がれます）。よろしいですか？';

  const beginNewSeason = () => {
    startNewSeason();
    clearHoldTimers();
    resetTransientUi();
  };

  openConfirmModal(msg, () => {
    if (!done) {
      beginNewSeason();
      return;
    }
    if (!DB.postseason?.champion) autoCompletePostseason();
    if (!DB.gachaDoneThisCycle) gachaSwapAllTeams(null, null); // 自チームも含め、全球団を年齢・成績で自動判定
    UI.flash = '前シーズンの成績を球団史に記録しています…';
    render();
    archiveCurrentSeason().then((record) => {
      UI.lastArchived = record;
      UI.seasonHistory = null; // 次回「球団史」タブを開いたときに再読込させる
      beginNewSeason();
      const retiredCount = (DB.lastForcedRetirements || []).length;
      const changes = DB.lastManagerChanges || [];
      const myChange = UI.myTeamId ? changes.find((c) => c.team === teamById(UI.myTeamId!)!.name) : null;
      let managerNote = '';
      if (changes.length > 0) {
        if (myChange) managerNote = `　⚾自チームの監督が交代：${myChange.from || '新規'}→${myChange.to}（${myChange.reason}）。他${changes.length - 1}球団でも監督交代あり。`;
        else managerNote = `　${changes.length}球団で監督交代がありました。`;
      }
      UI.flash = `前シーズンの成績を球団史に記録し、新シーズンを開始しました。${retiredCount > 0 ? `（ベテラン${retiredCount}名が引退し、新人と入れ替わりました）` : ''}${managerNote}`;
      render();
    }).catch((e: unknown) => {
      beginNewSeason();
      const detail = e instanceof Error ? e.message : String(e);
      if (e instanceof ArchiveError) {
        const rec = e.record;
        const summary = `MVP: ${rec.mvp?.H ? rec.mvp.H.name + '(' + rec.mvp.H.team + ')' : '-'}／優勝: ${rec.champion || '-'}`;
        UI.flash = `保存に失敗しました（新シーズンは開始しています）。この端末に記録は残っていませんが、直前の結果 → ${summary}。詳細: ${detail}`;
      } else {
        UI.flash = `球団史への記録に失敗しました（新シーズンは開始しています）。詳細: ${detail}`;
      }
      render();
    });
  });
}

export function wirePlayEvents(): void {
  wireDecisionCard();
  if (UI.liveGame && !UI.liveGame.finished) maybeShowGuide();
  const cardEl = $('.decision-card');
  if (cardEl && !cardEl.dataset.seen) cardEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateDiamondClasses(UI.liveGame || { bases: emptyBases() });

  on('#startPostseasonBtn', () => { startPostseason(); render(); });
  $$('[data-psplay]').forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.psplay as SeriesKey;
      const s = DB.postseason!.series[key]!;
      UI.liveGame = withManualSide(newGame(s.teamA, s.teamB, null, key));
      render();
    };
  });
  $$('[data-pssim]').forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.pssim as SeriesKey;
      const s = DB.postseason!.series[key]!;
      autoSimGame(newGame(s.teamA, s.teamB, null, key));
      render();
    };
  });

  const simDays = (n: number) => {
    const before = currentDay(DB.schedule);
    simulateDays(n);
    const after = currentDay(DB.schedule);
    UI.flash = after === null ? 'レギュラーシーズンの全日程が終わりました。' : `第${before}日〜第${after - 1}日を自動で消化しました。`;
    render();
  };
  on('#simWeekBtn', () => simDays(6));
  on('#simSeasonBtn', () => simDays(999));
  on('#simPostseasonBtn', () => {
    if (!seasonDone()) {
      UI.flash = 'レギュラーシーズンが終わってから実行できます。';
    } else {
      autoCompletePostseason();
      UI.flash = 'ポストシーズンを自動で消化しました。';
    }
    render();
  });

  on('#gachaBtn', () => {
    UI.gachaSelecting = true;
    UI.gachaMySelection = worstPerformer(teamById(UI.myTeamId!)!).id;
    render();
  });
  $$<HTMLSelectElement>('[data-gachaselect]').forEach((sel) => {
    sel.onchange = () => { UI.gachaMySelection = sel.value; };
  });
  on('#cancelGachaBtn', () => { UI.gachaSelecting = false; UI.gachaMySelection = null; render(); });
  on('#confirmGachaBtn', () => {
    UI.gachaResults = gachaSwapAllTeams(UI.myTeamId, UI.gachaMySelection);
    UI.gachaSelecting = false;
    UI.gachaMySelection = null;
    render();
  });
  on('#closeGachaBtn', () => { UI.gachaResults = null; render(); });

  const cardsChk = $<HTMLInputElement>('#cardsChk');
  if (cardsChk) cardsChk.onchange = () => { DB.options = { ...(DB.options ?? {}), decisionCards: cardsChk.checked }; };
  on('#closeShareBtn', () => { UI.lastArchived = null; render(); });
  $$('[data-share]').forEach((b) => {
    b.onclick = () => {
      if (!UI.lastArchived) return;
      void shareSeason(UI.lastArchived).then((msg) => { UI.flash = msg; render(); });
    };
  });
  on('#editLineupBtn', () => { UI.tab = 'roster'; UI.rosterTeamId = UI.myTeamId; UI.rosterTab = 'edit'; render(); });
  on('#changeTeamBtn', () => {
    UI.myTeamId = null; UI.gachaSelecting = false; UI.gachaMySelection = null; UI.gachaResults = null;
    render();
  });
  $$('[data-myteam]').forEach((c) => {
    c.onclick = () => { UI.myTeamId = c.dataset.myteam!; render(); };
  });
  on('#newSeasonBtn', confirmNewSeason);
  on('#newSeasonBtn2', confirmNewSeason);
  on('#moreNewsBtn', () => { UI.tab = 'history'; UI.historyTab = 'news'; render(); });

  $$('[data-play]').forEach((b) => {
    b.onclick = () => {
      const g = DB.schedule.find((s) => s.id === b.dataset.play)!;
      completeDaysThrough(g.day - 1); // 前日までの試合が残っていれば先に消化
      UI.flash = null;
      UI.liveGame = withManualSide(newGame(teamById(g.home)!, teamById(g.away)!, g.id));
      render();
    };
  });
  $$('[data-sim]').forEach((b) => {
    b.onclick = () => {
      const g = DB.schedule.find((s) => s.id === b.dataset.sim)!;
      completeDaysThrough(g.day - 1);
      const game = simulateScheduleGame(g);
      completeDaysThrough(g.day);
      UI.flash = null;
      UI.liveGame = game; // 試合終了画面（ボックススコア）を見せる
      render();
    };
  });

  const rollBtn = $('#rollBtn');
  if (rollBtn) {
    rollBtn.onmousedown = () => pressRoll();
    rollBtn.onmouseleave = () => releaseRoll();
    rollBtn.ontouchstart = (e) => { e.preventDefault(); pressRoll(); };
  }

  on('#backToScheduleBtn', () => {
    releaseRoll();
    const wasPostseason = !!UI.liveGame?.seriesKey;
    UI.liveGame = null;
    if (wasPostseason) UI.tab = 'standings';
    render();
  });
}

/* ---------- 勝負所カード ---------- */
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 投手を仮に替えたときの、いまの打者の鉛筆（比較表示用） */
function headlineWithPitcher(game: Game, pitcherId: string): { hit: number; hr: number; onBase: number } {
  const side = game.half === 'top' ? 'home' : 'away';
  const prev = game.pitcher[side];
  game.pitcher[side] = pitcherId;
  const h = pencilHeadline(game, currentBatter(game));
  game.pitcher[side] = prev;
  return h;
}

function decisionCardHTML(game: Game): string {
  const card = decisionCard(game);
  if (!card) return '';
  const batter = currentBatter(game);
  const cur = pencilHeadline(game, batter);
  const line = (h: { hit: number; hr: number; onBase: number }) => `ヒット${pct(h.hit)}・HR${pct(h.hr)}・出塁${pct(h.onBase)}`;
  const my = game.manualSide!;
  const diff = game.score[my] - game.score[my === 'home' ? 'away' : 'home'];
  const situation = `${game.inning}回${game.half === 'top' ? '表' : '裏'}　${diff > 0 ? `${diff}点リード` : diff < 0 ? `${-diff}点ビハインド` : '同点'}　${game.outs}アウト`;
  let body = '';
  if (card.kind === 'offense') {
    body += `<div class="card-now">打席：<b>${batter.name}</b>　${line(cur)}</div>`;
    body += card.pinchHitters.map((p) => `<button class="btn small" data-card="pinch:${p.id}">代打 ${p.name}<small>${line(pencilHeadline(game, p))}</small></button>`).join('');
    if (card.steal !== null) body += `<button class="btn small" data-card="steal">盗塁を仕掛ける<small>${game.bases.first!.name}・成功率 ${pct(card.steal)}</small></button>`;
    if (card.bunt) body += `<button class="btn small" data-card="bunt">送りバント<small>成功 ${pct(card.bunt.success)}・失敗 ${pct(card.bunt.fail + card.bunt.pop)}</small></button>`;
  } else {
    const p = pitcherNow(game);
    const side = game.half === 'top' ? 'home' : 'away';
    const tired = fatigueOf(game, side);
    body += `<div class="card-now">投手：<b>${p?.name ?? '-'}</b>${tired >= 0.25 ? '<span class="tired">（疲れ気味）</span>' : ''}　打者 ${batter.name}：${line(cur)}</div>`;
    body += card.relievers.map((r) => `<button class="btn small" data-card="relief:${r.id}">${r.id === game[side].staff.closer ? '抑え ' : r.id === game[side].staff.setup ? 'セットアッパー ' : ''}${r.name} に交代<small>${abilityShort(r)}・${line(headlineWithPitcher(game, r.id))}</small></button>`).join('');
    if (card.walk) body += `<button class="btn small" data-card="walk">敬遠する<small>次は ${nextBatterName(game)}</small></button>`;
  }
  return `<div class="decision-card">
    <div class="decision-title">⚡ 勝負所！ <span class="muted">${situation}</span></div>
    ${body}
    <button class="btn secondary small" data-card="pass">そのまま鉛筆を転がす</button>
  </div>`;
}

function nextBatterName(game: Game): string {
  const side = game.half === 'top' ? 'away' : 'home';
  const id = game.lineup[side][(game.orderIdx[side] + 1) % game.lineup[side].length];
  return findPlayer(game[side], id)?.name ?? '-';
}

function wireDecisionCard(): void {
  const game = UI.liveGame;
  if (!game) return;
  $$('[data-card]').forEach((b) => {
    b.onclick = () => {
      const card = decisionCard(game);
      if (!card) return;
      markCardShown(game, card);
      const [action, id] = b.dataset.card!.split(':');
      const side = game.half === 'top' ? 'home' : 'away';
      if (action === 'pinch') {
        const sub = availableBench(game, game.manualSide!).find((p) => p.id === id);
        if (sub) pinchHit(game, sub);
      } else if (action === 'steal') {
        forceSteal(game);
      } else if (action === 'bunt') {
        executeBunt(game);
      } else if (action === 'relief') {
        const r = game[side].pitchers.find((p) => p.id === id);
        if (r) changePitcher(game, r);
      } else if (action === 'walk') {
        executeIntentionalWalk(game);
      }
      if (game.finished && game.scheduleId) {
        const g = DB.schedule.find((x) => x.id === game.scheduleId);
        if (g) completeDaysThrough(g.day);
      }
      render();
    };
  });
}
