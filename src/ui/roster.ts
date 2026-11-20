/* 「選手名鑑」タブ */
import { ABILITY_INFO, LEAGUE_CODES } from '../engine/data';
import { DB, leagueName, teamById } from '../engine/state';
import { avgOfStats, eraOf, ipOf, opsOfStats } from '../engine/stats';
import { LINEUP_STYLES, type LineupStyleKey } from '../engine/data';
import { lineupStyleLabel, orderByStyle, reviewRegulars, styleForManager } from '../engine/lineup';
import { assignStaffRoles } from '../engine/team';
import type { Player, Team } from '../engine/types';
import { render } from './app';
import { $, $$, abilityBadges, abilityShort, fmt3, fmt3plain, fmtEra, formatNumber, nameBadge } from './format';
import { openEditPlayerModal, openEditTeamModal } from './modal';
import { UI } from './state';
import { chips, onPick, segTabs } from './components';

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
  tabs.push({ key: 'edit', label: isMine ? '⚙ 編成' : '方針' });
  if (alumni.length) tabs.push({ key: 'ob', label: 'OB' });
  const tab = tabs.some((x) => x.key === UI.rosterTab) ? UI.rosterTab! : 'bat';

  /** 1人1行のコンパクトな選手表示 */
  const row = (p: Player, label: string, extra = '') => `
    <div class="p-row">
      <div class="p-slot">${label}</div>
      <div class="p-main">
        <div class="p-name tap" data-player="${p.id}">${nameBadge(p, allPlayersFlat)} <span class="sub">${p.pos}・${p.age}歳・#${formatNumber(p.number)}</span>${p.ability ? ` <span class="pill" title="${ABILITY_INFO[p.ability].desc}">${ABILITY_INFO[p.ability].label}</span>` : ''}</div>
        <div class="p-abl">${abilityBadges(p)}</div>
      </div>
      ${extra}<span class="chev" data-player="${p.id}">›</span>
    </div>`;

  const moveBtns = (p: Player, i: number) => (isMine && t.lineupManual
    ? `<div class="move-btns"><button class="edit-btn" data-move="${p.id}:-1" ${i === 0 ? 'disabled' : ''}>▲</button><button class="edit-btn" data-move="${p.id}:1" ${i === 8 ? 'disabled' : ''}>▼</button></div>`
    : '');

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
      ${t.battingOrder.map((p, i) => row(p, String(i + 1), moveBtns(p, i))).join('')}
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
    const statRows = [...t.battingOrder, ...bench].map((p, i) => {
      const st = statMode === 'career' ? p.career : p.stats;
      return `<tr><td>${i < 9 ? i + 1 : '控'}</td><td class="name tap" data-player="${p.id}">${nameBadge(p, allPlayersFlat)}</td><td>${fmt3(avgOfStats(st))}</td><td>${st.hr}</td><td>${st.rbi}</td><td>${fmt3plain(opsOfStats(st))}</td></tr>`;
    }).join('');
    const pitchRows = staffSorted.map((p) => {
      const st = statMode === 'career' ? p.pCareer : p.pStats;
      return `<tr><td>${roleOf(p)}</td><td class="name tap" data-player="${p.id}">${nameBadge(p, allPlayersFlat)}</td><td>${st.w}-${st.l}</td><td>${st.sv}</td><td>${ipOf(st)}</td><td>${fmtEra(eraOf(st))}</td></tr>`;
    }).join('');
    body = `${chips('rstat', [{ key: 'season', label: '今シーズン' }, { key: 'career', label: '通算' }], statMode)}
    <div class="card"><table class="compact-table fit">
      <thead><tr><th></th><th class="namehead">野手</th><th>打率</th><th>本</th><th>点</th><th>OPS</th></tr></thead><tbody>${statRows}</tbody>
    </table></div>
    <div class="card"><table class="compact-table fit">
      <thead><tr><th></th><th class="namehead">投手</th><th>勝敗</th><th>S</th><th>回</th><th>防御率</th></tr></thead><tbody>${pitchRows}</tbody>
    </table></div>
    <div class="sub" style="text-align:center;">選手名をタップすると詳しい成績を表示</div>`;
  } else if (tab === 'edit') {
    body = isMine ? myTeamEditorHTML(t) : `<div class="card"><div class="list-row"><span class="sub">打順の方針</span><span>${lineupStyleLabel(t.lineupStyle)}</span></div>
      <div class="muted" style="font-size:11px;margin-top:6px;">他球団の打順・継投は、監督の采配タイプに沿ってAIが決めています。</div></div>`;
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
    ${t.manager ? `<div class="sub" style="margin-top:2px;">監督：${t.manager.label}<span class="muted">（${t.manager.desc}）</span></div>` : ''}
    ${(t.retiredNumbers ?? []).length ? `<div class="sub" style="margin-top:2px;">永久欠番：${t.retiredNumbers!.map((r) => `${String(r.number).padStart(2, '0')} ${r.name}`).join('、')}</div>` : ''}
  </div>
  ${segTabs('rtab', tabs, tab)}
  ${body}`;
}

/** 自チームの編成（打順の方針・手動の打順・スタメン入替・投手の役割） */
function myTeamEditorHTML(t: Team): string {
  const styleOpts = LINEUP_STYLES.map((st) => `<option value="${st.key}" ${t.lineupStyle === st.key ? 'selected' : ''}>${st.label}</option>`).join('');
  const styleDesc = LINEUP_STYLES.find((st) => st.key === t.lineupStyle)?.desc ?? '';
  const bench = t.roster.filter((p) => !t.battingOrder.includes(p));
  const batOpt = (p: Player) => `<option value="${p.id}">${p.pos} ${p.name}（${abilityShort(p)}）</option>`;
  const rotation = t.staff.rotation.map((id) => t.pitchers.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const pen = t.pitchers.filter((p) => !t.staff.rotation.includes(p.id));
  const pitchOpt = (p: Player, sel: string | null = null) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${p.name}（${abilityShort(p)}）</option>`;
  return `<div class="card editor">
    <h2>打順</h2>
    <label>方針</label>
    <select id="lineupStyleSel">${styleOpts}</select>
    <div class="sub" style="margin-top:3px;">${styleDesc}</div>
    <label class="check"><input type="checkbox" id="lineupManualChk" ${t.lineupManual ? 'checked' : ''}> 自分で並べる（「野手」タブの▲▼で並べ替え）</label>
  </div>
  <div class="card editor">
    <h2>スタメンと控えの入れ替え</h2>
    <label>スタメンから外す</label><select id="swapStarterSel">${t.battingOrder.map(batOpt).join('')}</select>
    <label>控えから入れる</label><select id="swapBenchSel">${bench.map(batOpt).join('')}</select>
    <button class="btn small" id="swapLineupBtn" style="margin-top:8px;">入れ替える</button>
  </div>
  <div class="card editor">
    <h2>投手陣</h2>
    <label>抑え</label><select id="closerSel">${pen.map((p) => pitchOpt(p, t.staff.closer)).join('')}</select>
    <label>セットアッパー</label><select id="setupSel">${pen.map((p) => pitchOpt(p, t.staff.setup)).join('')}</select>
    <label>先発から外す</label><select id="swapRotSel">${rotation.map((p) => pitchOpt(p)).join('')}</select>
    <label>リリーフから先発に入れる</label><select id="swapPenSel">${pen.map((p) => pitchOpt(p)).join('')}</select>
    <button class="btn small" id="swapStaffBtn" style="margin-top:8px;">入れ替える</button>
  </div>
  <div class="sub" style="margin:0 2px 10px;">${t.lineupManual || t.staffManual ? '自分で決めた部分は、シーズン中の自動の見直しをしません。' : 'いまは監督（AI）におまかせです。成績に応じてシーズン中もレギュラーや先発が入れ替わります。'}
    ${t.lineupManual || t.staffManual || t.lineupStyleLocked ? '<button class="link-btn" id="resetEditorBtn">監督におまかせに戻す</button>' : ''}</div>`;
}

export function wireRosterEvents(): void {
  wireEditorEvents();
  onPick('seg', 'rtab', (k) => { UI.rosterTab = k; render(); });
  onPick('chip', 'rstat', (k) => { UI.rosterStatMode = k as 'season' | 'career'; render(); });
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
  const val = (sel: string) => $<HTMLSelectElement>(sel)?.value ?? '';
  const find = (id: string) => [...t.roster, ...t.pitchers].find((p) => p.id === id);

  const styleSel = $<HTMLSelectElement>('#lineupStyleSel');
  if (styleSel) styleSel.onchange = () => {
    t.lineupStyle = styleSel.value as LineupStyleKey;
    t.lineupStyleLocked = true;
    if (!t.lineupManual) t.battingOrder = orderByStyle(t.battingOrder, t.lineupStyle);
    render();
  };
  const manual = $<HTMLInputElement>('#lineupManualChk');
  if (manual) manual.onchange = () => {
    t.lineupManual = manual.checked;
    if (!t.lineupManual) t.battingOrder = orderByStyle(t.battingOrder, t.lineupStyle ?? 'traditional');
    render();
  };
  $$('[data-move]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const [id, dir] = b.dataset.move!.split(':');
      const i = t.battingOrder.findIndex((p) => p.id === id), j = i + Number(dir);
      if (i < 0 || j < 0 || j > 8) return;
      [t.battingOrder[i], t.battingOrder[j]] = [t.battingOrder[j], t.battingOrder[i]];
      render();
    };
  });
  const swapLineup = $('#swapLineupBtn');
  if (swapLineup) swapLineup.onclick = () => {
    const a = find(val('#swapStarterSel')), b = find(val('#swapBenchSel'));
    if (!a || !b) return;
    t.battingOrder[t.battingOrder.indexOf(a)] = b;
    const pos = a.pos; a.pos = b.pos; b.pos = pos; // 守備位置も入れ替える
    t.lineupManual = true;
    render();
  };
  const swapStaff = $('#swapStaffBtn');
  if (swapStaff) swapStaff.onclick = () => {
    const a = val('#swapRotSel'), b = val('#swapPenSel');
    if (!a || !b) return;
    t.staff.rotation = t.staff.rotation.map((id) => (id === a ? b : id));
    if (t.staff.closer === b) t.staff.closer = a;
    if (t.staff.setup === b) t.staff.setup = a;
    t.staffManual = true;
    render();
  };
  const closer = $<HTMLSelectElement>('#closerSel');
  if (closer) closer.onchange = () => {
    if (t.staff.setup === closer.value) t.staff.setup = t.staff.closer;
    t.staff.closer = closer.value; t.staffManual = true; render();
  };
  const setup = $<HTMLSelectElement>('#setupSel');
  if (setup) setup.onchange = () => {
    if (t.staff.closer === setup.value) t.staff.closer = t.staff.setup;
    t.staff.setup = setup.value; t.staffManual = true; render();
  };
  const reset = $('#resetEditorBtn');
  if (reset) reset.onclick = () => {
    t.lineupManual = false; t.staffManual = false; t.lineupStyleLocked = false;
    t.lineupStyle = styleForManager(t.manager?.type);
    reviewRegulars(t);
    assignStaffRoles(t);
    render();
  };
}
