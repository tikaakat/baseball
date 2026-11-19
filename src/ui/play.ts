/* 「試合」タブ：マイチーム選択・日程・試合画面・ポストシーズン・オフシーズンガチャ */
import { currentBattingKey, emptyBases, pencilsFor, pencilSummary } from '../engine/atbat';
import { ABILITY_INFO, FACE_LABEL, P1_FACES, P2_FACES, POSTSEASON_NAMES, SERIES_KEYS } from '../engine/data';
import { autoSimGame, currentBatter, fieldersOf, newGame, rollStep } from '../engine/game';
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
import { $, $$, abilityBadges, abilityShort, fmt3plain, fmtEra, gradeBadge, gradeOf } from './format';
import { openConfirmModal } from './modal';
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

function gachaHTML(): string {
  if (!seasonDone()) return '';
  if (UI.gachaResults) {
    const rows = UI.gachaResults.map((r) => {
      if (r.skipped || !r.out || !r.in) {
        return `<div class="gacha-row">
            <div class="gacha-team">${r.team.name}${UI.myTeamId === r.team.id ? '（自チーム）' : ''}</div>
            <div class="muted">今回は放出なし</div>
          </div>`;
      }
      return `<div class="gacha-row">
          <div class="gacha-team">${r.team.name}${r.slot ? `　${r.slot}番` : ''}</div>
          <div class="gacha-swap">
            <span class="gacha-out">${r.out.name}(${r.out.pos}・${r.out.age}歳)</span>
            <span class="gacha-arrow">→</span>
            <span class="gacha-in">★NEW★ ${r.in.name}(${r.in.pos}・${r.in.age}歳)${r.in.ability ? `<span class="pill" style="margin-left:4px;">${ABILITY_INFO[r.in.ability].label}</span>` : ''}</span>
          </div>
          <div class="muted" style="font-size:10.5px;">${abilityBadges(r.in)}</div>
        </div>`;
    }).join('');
    const swappedCount = UI.gachaResults.filter((r) => !r.skipped).length;
    return `<div class="card">
        <h2>オフシーズン補強ガチャ結果</h2>
        <div class="muted" style="margin-bottom:8px;">12球団中${swappedCount}球団が新人と入れ替わりました（年齢・成績を見て見送った球団もあります）。</div>
        ${rows}
        <div class="row" style="margin-top:10px;">
          <button class="btn secondary small" id="closeGachaBtn">閉じる</button>
        </div>
      </div>`;
  }
  if (UI.gachaSelecting) {
    const myTeam = teamById(UI.myTeamId!)!;
    // 選択済みIDが現在のロースターに存在しない場合は安全にデフォルトへ戻す
    const selectablePlayers = gachaCandidates(myTeam);
    if (UI.gachaMySelection !== '__skip__' && !selectablePlayers.some((p) => p.id === UI.gachaMySelection)) {
      UI.gachaMySelection = worstPerformer(myTeam).id;
    }
    const protectedCount = myTeam.roster.length + myTeam.pitchers.length - selectablePlayers.length;
    const perf = (p: Player) => (p.pitch ? (p.pStats.outs >= 30 ? '防御率' + fmtEra(eraOf(p.pStats)) : '登板少') : (p.stats.ab >= 10 ? 'OPS' + fmt3plain(opsOf(p)) : '出場少'));
    const opts = selectablePlayers.map((p) => `<option value="${p.id}" ${UI.gachaMySelection === p.id ? 'selected' : ''}>${p.pos} ${p.name}・${p.age}歳（${abilityShort(p)}／${perf(p)}）</option>`).join('')
      + `<option value="__skip__" ${UI.gachaMySelection === '__skip__' ? 'selected' : ''}>――今回は誰も放出しない――</option>`;
    return `<div class="card">
        <h2>放出する選手を選択（${myTeam.name}）</h2>
        <div class="muted" style="margin-bottom:8px;">自チームだけ、入れ替える1名を選んでください（初期値は成績が振るわない選手）。見送ることもできます。他11球団は年齢・成績を見て自動で判断します。入ってくる新人はランダムです。${protectedCount > 0 ? `　※加入2年未満の選手${protectedCount}名は放出候補から保護されています。` : ''}</div>
        <select data-gachaselect="${myTeam.id}">${opts}</select>
        <div class="row" style="margin-top:10px;">
          <button class="btn secondary small" id="cancelGachaBtn">キャンセル</button>
          <button class="btn small" id="confirmGachaBtn">この内容でガチャを引く</button>
        </div>
      </div>`;
  }
  return `<div class="card">
        <h2>オフシーズン補強ガチャ</h2>
        <div class="muted" style="margin-bottom:8px;">シーズン終了後、全12球団それぞれ1名を選んで新人と入れ替えます（新人はランダム）。元に戻すことはできません。</div>
        <button class="btn" id="gachaBtn">放出する選手を選ぶ</button>
      </div>`;
}

function vsLabel(g: ScheduleGame): string {
  const opp = teamById(g.home === UI.myTeamId ? g.away : g.home)!;
  return `${g.home === UI.myTeamId ? 'vs' : '@'} ${opp.name}`;
}

function scheduleHTML(): string {
  if (!UI.myTeamId) return teamPickerHTML();

  const myTeam = teamById(UI.myTeamId)!;
  const isMine = (g: ScheduleGame) => g.home === UI.myTeamId || g.away === UI.myTeamId;
  const mine = DB.schedule.filter(isMine).sort((a, b) => a.day - b.day || a.order - b.order);
  const unplayed = mine.filter((g) => !g.played);
  const played = mine.filter((g) => g.played);
  const today = unplayed[0] ?? null;
  const flashHtml = UI.flash ? `<div class="flash">${UI.flash}</div>` : '';

  const todayHtml = today ? `
    <div class="today">
      <div class="today-day">第${today.day}日（全${lastDay(DB.schedule)}日）</div>
      <div class="today-vs">${vsLabel(today)}</div>
      <div class="row" style="justify-content:center;margin-top:10px;">
        <button class="btn" data-play="${today.id}">▶ 観る（鉛筆を転がす）</button>
        <button class="btn secondary" data-sim="${today.id}">自動で結果だけ</button>
      </div>
      <div class="muted" style="text-align:center;margin-top:6px;font-size:11px;">試合が終わると、同じ日の他球団の試合も自動で進みます</div>
    </div>` : '<div class="muted">レギュラーシーズンの全試合が終わりました。お疲れさまでした。</div>';

  const upcoming = unplayed.slice(1, 6).map((g) => `<div class="game-row"><div class="vs">第${g.day}日　${vsLabel(g)}</div></div>`).join('');
  const recent = played.slice(-5).reverse().map((g) => {
    const r = g.result!;
    const myScore = g.home === UI.myTeamId ? r.home : r.away, oppScore = g.home === UI.myTeamId ? r.away : r.home;
    const mark = r.winner === 'tie' ? '△' : myScore > oppScore ? '○' : '●';
    return `<div class="game-row"><div class="vs">第${g.day}日　${vsLabel(g)}</div><span class="pill ${mark === '○' ? 'win' : mark === '●' ? 'lose' : ''}">${mark} ${myScore}-${oppScore}</span></div>`;
  }).join('');

  return `
  ${flashHtml}
  <div class="card">
    <div class="row between">
      <h2 style="margin:0;">マイチーム: ${myTeam.name}</h2>
      <div class="row" style="gap:6px;">
        <button class="btn secondary small" id="editLineupBtn">⚙ 編成</button>
        <button class="btn secondary small" id="changeTeamBtn">変更</button>
      </div>
    </div>
    <div class="muted" style="margin-top:4px;">${myTeam.wins}勝 ${myTeam.losses}敗 ${myTeam.ties}分　（${played.length}/${mine.length} 試合消化）</div>
    ${todayHtml}
  </div>
  ${upcoming || recent ? `<div class="card">
    ${upcoming ? `<h2>今後の予定</h2>${upcoming}` : ''}
    ${recent ? `<h2 style="margin-top:${upcoming ? 14 : 0}px;">最近の結果</h2>${recent}` : ''}
  </div>` : ''}
  <div class="card">
    <h2>まとめて進める</h2>
    <div class="row">
      ${today ? `<button class="btn secondary small" id="simWeekBtn">6日分を自動</button>
      <button class="btn secondary small" id="simSeasonBtn">シーズン終了まで自動</button>` : ''}
      ${seasonDone() ? '<button class="btn secondary small" id="simPostseasonBtn">ポストシーズンを自動</button>' : ''}
      <button class="btn secondary small" id="newSeasonBtn">新しいシーズンを始める</button>
    </div>
  </div>
  ${seasonDone() ? postseasonSectionHTML() : ''}
  ${gachaHTML()}
  `;
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
      return `<tr class="${hot ? 'hot' : ''}"><td>${i + 1}</td><td class="name">${p.name}<span class="muted" style="font-size:9px;">(${p.pos})</span></td><td>${b.ab}</td><td>${b.h}</td><td>${b.rbi}</td><td>${b.hr}</td><td>${b.bb}</td><td>${b.k}</td><td>${b.sb}</td></tr>`;
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
      return `<tr><td class="name">${p.name}${dec}</td><td>${ipOf(b)}</td><td>${b.bf}</td><td>${b.h}</td><td>${b.hr}</td><td>${b.bb}</td><td>${b.k}</td><td>${b.r}</td></tr>`;
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
/** 観戦中の試合を1本進める。マイチームの試合が終わったら、その日の他球団の試合も消化する */
function rollLiveStep(game: Game): ReturnType<typeof rollStep> {
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
    archiveCurrentSeason().then(() => {
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
  updateDiamondClasses(UI.liveGame || { bases: emptyBases() });

  on('#startPostseasonBtn', () => { startPostseason(); render(); });
  $$('[data-psplay]').forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.psplay as SeriesKey;
      const s = DB.postseason!.series[key]!;
      UI.liveGame = newGame(s.teamA, s.teamB, null, key);
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

  on('#editLineupBtn', () => { UI.tab = 'roster'; UI.rosterTeamId = UI.myTeamId; render(); });
  on('#changeTeamBtn', () => {
    UI.myTeamId = null; UI.gachaSelecting = false; UI.gachaMySelection = null; UI.gachaResults = null;
    render();
  });
  $$('[data-myteam]').forEach((c) => {
    c.onclick = () => { UI.myTeamId = c.dataset.myteam!; render(); };
  });
  on('#newSeasonBtn', confirmNewSeason);

  $$('[data-play]').forEach((b) => {
    b.onclick = () => {
      const g = DB.schedule.find((s) => s.id === b.dataset.play)!;
      completeDaysThrough(g.day - 1); // 前日までの試合が残っていれば先に消化
      UI.flash = null;
      UI.liveGame = newGame(teamById(g.home)!, teamById(g.away)!, g.id);
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
