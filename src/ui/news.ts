/* ニュース・記録の表示 */
import { DB } from '../engine/state';
import type { NewsItem } from '../engine/types';
import { UI } from './state';

export function newsRow(n: NewsItem): string {
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
  return `<div class="card"><div class="row between"><h2 style="margin:0;">📰 ニュース</h2><button class="link-btn" id="moreNewsBtn">すべて見る</button></div>${list.map(newsRow).join('')}</div>`;
}
