/* ニュース・記録の表示 */
import { RECORD_LABELS, type RecordKey } from '../engine/news';
import { DB } from '../engine/state';
import type { NewsItem } from '../engine/types';
import { UI } from './state';

function newsRow(n: NewsItem): string {
  const mine = n.teamId && n.teamId === UI.myTeamId;
  const when = `第${n.season}季${n.day ? `・${n.day}日目` : ''}`;
  return `<div class="news-row ${mine ? 'mine' : ''}"><span class="news-when">${when}</span>${n.text}</div>`;
}

/** 「試合」タブ用：最新のニュース（マイチームの話題を優先して数件） */
export function latestNewsHTML(limit = 5): string {
  const news = (DB.news ?? []).slice().reverse();
  if (!news.length) return '';
  const mine = news.filter((n) => n.teamId === UI.myTeamId).slice(0, 2);
  const rest = news.filter((n) => !mine.includes(n)).slice(0, limit - mine.length);
  const list = [...mine, ...rest].sort((a, b) => b.season - a.season || (b.day ?? 999) - (a.day ?? 999));
  return `<div class="card"><h2>📰 ニュース</h2>${list.map(newsRow).join('')}</div>`;
}

/** 「球団史」タブ用：リーグ記録とニュース一覧 */
export function recordsAndNewsHTML(): string {
  const recs = DB.records ?? {};
  const recRows = (Object.keys(RECORD_LABELS) as RecordKey[]).map((k) => {
    const r = recs[k];
    const l = RECORD_LABELS[k];
    return `<tr><td class="name">${l.label}</td><td>${r ? `${r.value}${l.unit}` : '-'}</td><td class="name">${r ? `${r.name}（${r.team}）` : ''}</td><td>${r ? `第${r.season}季` : ''}</td></tr>`;
  }).join('');
  const news = (DB.news ?? []).slice().reverse().slice(0, 60);
  return `<div class="card"><h2>📈 リーグ記録</h2>
    <table class="compact-table"><thead><tr><th class="namehead">記録</th><th>数字</th><th class="namehead">選手</th><th>年</th></tr></thead><tbody>${recRows}</tbody></table>
  </div>
  ${news.length ? `<details class="howto" style="margin-bottom:10px;"><summary>📰 ニュース（最近${news.length}件）</summary><div style="margin-top:8px;">${news.map(newsRow).join('')}</div></details>` : ''}`;
}
