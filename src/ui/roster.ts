/* 「選手名鑑」タブ */
import { ABILITY_INFO, LEAGUE_CODES } from '../engine/data';
import { DB, leagueName, teamById } from '../engine/state';
import { avgOfStats, eraOf, ipOf, opsOfStats } from '../engine/stats';
import { LINEUP_STYLES } from '../engine/data';
import { lineupStyleLabel, reviewRegulars, styleForManager, swapBatters } from '../engine/lineup';
import { pitchingStyleFor } from '../engine/pitching';
import { assignStaffRoles, managerName, swapPitcherRoles } from '../engine/team';
import type { Player, Team } from '../engine/types';
import { render } from './app';
import { $, $$, abilityBadges, fmt3, fmt3plain, fmtEra, formatNumber, nameBadge } from './format';
import { openEditPlayerModal, openEditTeamModal } from './modal';
import { UI } from './state';
import { onPick, segTabs } from './components';
import { ensureHistoryLoaded } from './history';

export function renderRoster(): string {
  return UI.rosterTeamId ? rosterDetailHTML(UI.rosterTeamId) : rosterListHTML();
}

function rosterListHTML(): string {
  const league = (code: string) => `<div class="card">
    <h2>${leagueName(code)}</h2>
    ${DB.teams.filter((t) => t.league === code).map((t) => `
      <div class="list-row tap ${t.id === UI.myTeamId ? 'mine' : ''}" data-team="${t.id}">
        <span>${t.name}${t.id === UI.myTeamId ? ' <span class="pill">マイチーム</span>' : ''}</span>
        <span class="sub">${t.wins}勝${t.losses}敗${t.ties}分 ›</span>
      </div>`).join('')}
  </div>`;
  return LEAGUE_CODES.map(league).join('');
}

function rosterDetailHTML(teamId: string): string {
  const t = teamById(teamId)!;
  const isMine = UI.myTeamId === t.id;
  const statMode = UI.rosterStatMode || 'season';
  const allPlayersFlat: Player[] = [];
  DB.teams.forEach((tm) => [...tm.roster, ...tm.pitchers].forEach((p) => allPlayersFlat.push(p)));
  const bench = t.roster.filter((p) => !t.battingOrder.includes(p));
  const alumni = t.alumni || [];

  const tabs = [{ key: 'bat', label: '野手' }, { key: 'pitch', label: '投手' }, { key: 'stats', label: '成績' }];
  tabs.push({ key: 'edit', label: isMine ? '⚙ オーダー' : '監督・方針' });
  if (alumni.length) tabs.push({ key: 'ob', label: 'OB' });
  const tab = tabs.some((x) => x.key === UI.rosterTab) ? UI.rosterTab! : 'bat';

  /** 1人1行のコンパクトな選手表示 */
  const row = (p: Player, label: string, extra = '') => `
    <div class="p-row tap" data-player="${p.id}">
      <div class="p-slot">${label}</div>
      <div class="p-main">
        <div class="p-name">${nameBadge(p, allPlayersFlat)} <span class="sub">${p.pos}・${p.age}歳・#${formatNumber(p.number)}</span>${p.ability ? ` <span class="pill" title="${ABILITY_INFO[p.ability].desc}">${ABILITY_INFO[p.ability].label}</span>` : ''}</div>
        <div class="p-abl">${abilityBadges(p)}</div>
      </div>
      ${extra}<span class="chev">›</span>
    </div>`;

  const roleOf = (p: Player) => {
    const r = t.staff.rotation.indexOf(p.id);
    if (r >= 0) return `先${r + 1}`;
    if (p.id === t.staff.closer) return '抑え';
    if (p.id === t.staff.setup) return '中継';
    return '救援';
  };
  const roleOrder = (p: Player) => { const r = t.staff.rotation.indexOf(p.id); return r >= 0 ? r : p.id === t.staff.closer ? 10 : p.id === t.staff.setup ? 11 : 12; };
  const staffSorted = t.pitchers.slice().sort((a, b) => roleOrder(a) - roleOrder(b));

  let body = '';
  if (tab === 'bat') {
    body = `<div class="card">
      <div class="muted" style="font-size:11px;margin-bottom:4px;">打順（${lineupStyleLabel(t.lineupStyle)}）</div>
      ${t.battingOrder.map((p, i) => row(p, String(i + 1))).join('')}
      ${bench.length ? `<div class="section-title">控え</div>${bench.map((p) => row(p, '控')).join('')}` : ''}
    </div>`;
  } else if (tab === 'pitch') {
    const starters = staffSorted.filter((p) => t.staff.rotation.includes(p.id));
    const pen = staffSorted.filter((p) => !t.staff.rotation.includes(p.id));
    body = `<div class="card">
      <div class="section-title" style="margin-top:0;">先発ローテーション</div>
      ${starters.map((p) => row(p, roleOf(p))).join('')}
      <div class="section-title">リリーフ</div>
      ${pen.map((p) => row(p, roleOf(p))).join('')}
    </div>`;
  } else if (tab === 'stats') {
    body = statsTabHTML(t, statMode, allPlayersFlat, staffSorted, roleOf);
  } else if (tab === 'edit') {
    body = managerPolicyHTML(t, isMine) + (isMine ? orderEditorHTML(t, staffSorted, roleOf) : '');
  } else {
    body = `<div class="card">${alumni.slice().reverse().map((a) => `<div class="list-row"><span>${a.name}<span class="sub">（${a.isPitcher ? '投' : a.pos}・${a.seasonsPlayed}年）</span></span><span class="sub">${a.isPitcher && a.pCareer
      ? `${a.pCareer.w}勝${a.pCareer.sv}S 防${fmtEra(eraOf(a.pCareer))}`
      : `打率${fmt3(avgOfStats(a.career))} ${a.career.h}安打 ${a.career.hr}本`}</span></div>`).join('')}</div>`;
  }

  return `
  <div class="card team-head">
    <div class="row between">
      <button class="link-btn" id="backToTeamsBtn">← 球団一覧</button>
      <button class="link-btn" data-editteam="${t.id}">✎ 名前を編集</button>
    </div>
    <div class="team-name">${t.name}${isMine ? ' <span class="pill">マイチーム</span>' : ''}</div>
    <div class="sub">${leagueName(t.league)}・${t.wins}勝${t.losses}敗${t.ties}分・得点${t.runsFor}／失点${t.runsAgainst}</div>
    ${t.manager ? `<div class="sub" style="margin-top:2px;">監督：<b style="color:var(--cream);">${managerName(t.manager)}</b>（${t.manager.age ?? '-'}歳・${(DB.currentSeasonNum || 1) - t.manager.hireSeason + 1}年目${t.manager.obNote ? '・球団OB' : ''}）通算${t.manager.wins}勝${t.manager.losses}敗</div>
    <div class="sub">采配：${t.manager.label}<span class="muted">（${t.manager.desc}）</span></div>` : ''}
    ${(t.retiredNumbers ?? []).length ? `<div class="sub" style="margin-top:2px;">永久欠番：${t.retiredNumbers!.map((r) => `${String(r.number).padStart(2, '0')} ${r.name}`).join('、')}</div>` : ''}
  </div>
  ${segTabs('rtab', tabs, tab)}
  ${body}`;
}

/** 成績（今シーズン・通算・過去のシーズンをプルダウンで） */
function statsTabHTML(t: Team, statMode: string, all: Player[], staffSorted: Player[], roleOf: (p: Player) => string): string {
  const history = UI.seasonHistory;
  if (!history) ensureHistoryLoaded();
  const past = (history ?? []).slice().sort((a, b) => b.seasonNum - a.seasonNum);
  const opts = [['season', `今シーズン（第${DB.currentSeasonNum || 1}季）`], ['career', '通算'], ...past.map((h) => [`y${h.seasonNum}`, `第${h.seasonNum}季`])]
    .map(([k, l]) => `<option value="${k}" ${k === statMode ? 'selected' : ''}>${l}</option>`).join('');
  const select = `<div class="card stat-pick"><span class="sub">表示する成績</span><select id="rosterStatSel">${opts}</select></div>`;
  const batHead = '<thead><tr><th></th><th class="namehead">野手</th><th>打率</th><th>本</th><th>点</th><th>OPS</th></tr></thead>';
  const pitHead = '<thead><tr><th></th><th class="namehead">投手</th><th>勝敗</th><th>S</th><th>回</th><th>防御率</th></tr></thead>';
  const empty = '<tr><td colspan="6" class="sub">記録なし</td></tr>';
  const tables = (bat: string, pit: string, note: string) => `${select}
    <div class="card"><table class="compact-table fit">${batHead}<tbody>${bat || empty}</tbody></table></div>
    <div class="card"><table class="compact-table fit">${pitHead}<tbody>${pit || empty}</tbody></table></div>
    <div class="sub" style="text-align:center;">${note}</div>`;

  if (statMode === 'season' || statMode === 'career') {
    const bench = t.roster.filter((p) => !t.battingOrder.includes(p));
    const bat = [...t.battingOrder, ...bench].map((p, i) => {
      const st = statMode === 'career' ? p.career : p.stats;
      return `<tr class="tap" data-player="${p.id}"><td>${i < 9 ? i + 1 : '控'}</td><td class="name">${nameBadge(p, all)}</td><td>${fmt3(avgOfStats(st))}</td><td>${st.hr}</td><td>${st.rbi}</td><td>${fmt3plain(opsOfStats(st))}</td></tr>`;
    }).join('');
    const pit = staffSorted.map((p) => {
      const st = statMode === 'career' ? p.pCareer : p.pStats;
      return `<tr class="tap" data-player="${p.id}"><td>${roleOf(p)}</td><td class="name">${nameBadge(p, all)}</td><td>${st.w}-${st.l}</td><td>${st.sv}</td><td>${ipOf(st)}</td><td>${fmtEra(eraOf(st))}</td></tr>`;
    }).join('');
    return tables(bat, pit, '行をタップすると詳しい成績を表示');
  }

  // 過去のシーズン
  const n = Number(statMode.slice(1));
  const rec = past.find((h) => h.seasonNum === n);
  const saved = rec?.rosters?.[t.id];
  if (saved) {
    const bat = saved.b.slice().sort((x, y) => y[2] - x[2]).map(([name, pos, , ab, h, d, tr, hr, rbi, bb]) => {
      const avg = ab ? h / ab : 0, obp = ab + bb ? (h + bb) / (ab + bb) : 0, slg = ab ? (h + d + 2 * tr + 3 * hr) / ab : 0;
      return `<tr><td>${pos}</td><td class="name">${name}</td><td>${fmt3(avg)}</td><td>${hr}</td><td>${rbi}</td><td>${fmt3plain(obp + slg)}</td></tr>`;
    }).join('');
    const pit = saved.p.slice().sort((x, y) => y[7] - x[7]).map(([name, role, , , w, l, sv, outs, r]) =>
      `<tr><td>${role}</td><td class="name">${name}</td><td>${w}-${l}</td><td>${sv}</td><td>${ipOf({ outs })}</td><td>${fmtEra(outs ? (r * 27) / outs : Infinity)}</td></tr>`).join('');
    return tables(bat, pit, `第${n}季の${saved.name}（打席・投球回の多い順）`);
  }
  // 選手成績を残す前のシーズン：いま在籍している選手の年度別成績から
  const lineOf = (p: Player) => p.yearly?.find((y) => y.season === n);
  const other = (team: string) => (team !== t.name ? `<small class="sub">（${team}）</small>` : '');
  const bat = t.roster.filter((p) => lineOf(p)?.stats.pa).map((p) => {
    const y = lineOf(p)!; const st = y.stats;
    return `<tr class="tap" data-player="${p.id}"><td>${p.pos}</td><td class="name">${p.name}${other(y.team)}</td><td>${fmt3(avgOfStats(st))}</td><td>${st.hr}</td><td>${st.rbi}</td><td>${fmt3plain(opsOfStats(st))}</td></tr>`;
  }).join('');
  const pit = t.pitchers.filter((p) => lineOf(p)?.pStats.g).map((p) => {
    const y = lineOf(p)!; const st = y.pStats;
    return `<tr class="tap" data-player="${p.id}"><td>投</td><td class="name">${p.name}${other(y.team)}</td><td>${st.w}-${st.l}</td><td>${st.sv}</td><td>${ipOf(st)}</td><td>${fmtEra(eraOf(st))}</td></tr>`;
  }).join('');
  return tables(bat, pit, `第${n}季は、いま在籍している選手の分だけ表示しています`);
}

/** 監督と方針（打順の組み方・継投） */
function managerPolicyHTML(t: Team, isMine: boolean): string {
  const m = t.manager;
  const lineup = LINEUP_STYLES.find((st) => st.key === (t.lineupStyle ?? styleForManager(m?.type)));
  const pitching = pitchingStyleFor(m?.type);
  const line = (k: string, v: string, d = '') => `<div class="policy-row"><span class="k">${k}</span><span><b>${v}</b>${d ? `<small>${d}</small>` : ''}</span></div>`;
  return `<div class="card policy">
    <h2>監督の方針</h2>
    ${m ? line('監督', `${managerName(m)}（${m.age ?? '-'}歳）`) + line('采配', m.label, m.desc) : ''}
    ${line('打順', lineup?.label ?? '-', lineup?.desc ?? '')}
    ${line('継投', pitching.label, pitching.desc)}
    <div class="sub" style="margin-top:6px;">${isMine
      ? '打順の組み方・継投・レギュラーや先発の見直しは監督が行います。下で入れ替えると、その部分だけは監督の見直しを止めます。'
      : '他球団も、それぞれの監督の方針に沿って打順や継投を決めています。'}</div>
  </div>`;
}

/** パワプロ風のオーダー変更：入れ替えたい選手を2人タップ */
function orderEditorHTML(t: Team, staffSorted: Player[], roleOf: (p: Player) => string): string {
  const pick = UI.orderPick ?? null;
  const picked = pick ? [...t.roster, ...t.pitchers].find((p) => p.id === pick) : null;
  const pickedKind = picked ? (picked.pitch ? 'p' : 'b') : null;
  const bench = t.roster.filter((p) => !t.battingOrder.includes(p));
  const row = (p: Player, num: string, kind: 'b' | 'p', posLabel: string) => `
    <div class="o-row tap ${pick === p.id ? 'picked' : ''} ${pickedKind === kind && pick !== p.id ? 'target' : ''}" data-opick="${p.id}">
      <span class="o-num">${num}</span><span class="o-pos">${posLabel}</span>
      <span class="o-name">${p.name}</span><span class="o-abl">${abilityBadges(p)}</span>
    </div>`;
  const hint = picked
    ? `<b>${picked.name}</b> と入れ替える${pickedKind === 'p' ? '投手' : '選手'}をタップ <button class="link-btn" data-opick="${picked.id}">やめる</button>`
    : '入れ替えたい選手を2人タップ（打順・スタメン・投手の役割）';
  const status = t.lineupManual || t.staffManual
    ? `${[t.lineupManual && '打順・スタメン', t.staffManual && '投手の役割'].filter(Boolean).join('と')}は自分で決めた並びです。<button class="link-btn" id="resetEditorBtn">監督におまかせに戻す</button>`
    : 'いまは監督におまかせです。成績に応じてシーズン中もレギュラーや先発が入れ替わります。';
  return `
  <div class="order-hint ${picked ? 'on' : ''}">${hint}</div>
  <div class="card order-editor">
    <div class="section-title" style="margin-top:0;">スタメン</div>
    ${t.battingOrder.map((p, i) => row(p, String(i + 1), 'b', p.pos)).join('')}
    ${bench.length ? `<div class="section-title">控え</div>${bench.map((p) => row(p, '控', 'b', p.pos)).join('')}` : ''}
  </div>
  <div class="card order-editor">
    <div class="section-title" style="margin-top:0;">投手</div>
    ${staffSorted.map((p) => row(p, '', 'p', roleOf(p))).join('')}
  </div>
  <div class="sub" style="margin:0 2px 10px;">${status}</div>`;
}

export function wireRosterEvents(): void {
  wireEditorEvents();
  onPick('seg', 'rtab', (k) => { UI.rosterTab = k; render(); });
  const statSel = $<HTMLSelectElement>('#rosterStatSel');
  if (statSel) statSel.onchange = () => { UI.rosterStatMode = statSel.value; render(); };
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

function wireEditorEvents(): void {
  const t = UI.myTeamId ? teamById(UI.myTeamId) : undefined;
  if (!t || UI.rosterTeamId !== t.id) return;
  $$('[data-opick]').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      const id = el.dataset.opick!;
      const pick = UI.orderPick ?? null;
      const isPitcher = (x: string) => t.pitchers.some((p) => p.id === x);
      if (!pick || pick === id || isPitcher(pick) !== isPitcher(id)) {
        UI.orderPick = pick === id ? null : id; // 1人目を選ぶ（同じ選手をもう一度で解除）
      } else {
        if (isPitcher(id)) swapPitcherRoles(t, pick, id); else swapBatters(t, pick, id);
        UI.orderPick = null;
      }
      render();
    };
  });
  const reset = $('#resetEditorBtn');
  if (reset) reset.onclick = () => {
    t.lineupManual = false; t.staffManual = false; t.lineupStyleLocked = false;
    t.lineupStyle = styleForManager(t.manager?.type);
    reviewRegulars(t);
    assignStaffRoles(t);
    UI.orderPick = null;
    render();
  };
}
