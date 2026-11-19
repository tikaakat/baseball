/* シーズンのまとめを画像とテキストで共有する */
import type { SeasonRecord } from '../engine/types';
import { UI } from './state';

const APP_NAME = '六角鉛筆ベースボール';
const HASHTAG = '#六角鉛筆ベースボール';
const appUrl = () => (typeof location !== 'undefined' ? location.origin + location.pathname : '');

interface Summary { title: string; lines: string[]; text: string }

function summarize(rec: SeasonRecord): Summary {
  const mine = [...rec.standings.H, ...rec.standings.B].find((t) => t.teamId === UI.myTeamId);
  const lines: string[] = [];
  if (rec.champion) lines.push(`🏆 優勝　${rec.champion}`);
  if (mine) {
    const champ = rec.championTeamId === mine.teamId;
    lines.push(`⚾ ${mine.name}　${mine.rank}位（${mine.wins}勝${mine.losses}敗${mine.ties}分）${champ ? '　シリーズ制覇！' : ''}`);
  }
  if (rec.mvp.H) lines.push(`⭐ ${rec.leagueNames.H} MVP　${rec.mvp.H.name}（${rec.mvp.H.team}）`);
  if (rec.mvp.B) lines.push(`⭐ ${rec.leagueNames.B} MVP　${rec.mvp.B.name}（${rec.mvp.B.team}）`);
  const hr = rec.leaders.hr?.[0];
  if (hr) lines.push(`💥 本塁打王　${hr.name}（${hr.team}）${hr.value}本`);
  const w = rec.pitchingLeaders?.w?.[0];
  if (w) lines.push(`🔥 最多勝　${w.name}（${w.team}）${w.value}勝`);
  const title = `第${rec.seasonNum}シーズン`;
  const head = mine ? `${title}、${mine.name}は${mine.rank}位（${mine.wins}勝${mine.losses}敗）でした。` : `${title}が終わりました。`;
  const text = `${head}${rec.champion ? `優勝は${rec.champion}！` : ''}\n${HASHTAG}\n${appUrl()}`;
  return { title, lines, text };
}

/** 1200×630 の画像を描く（SNSのカードサイズ） */
function drawCard(s: Summary): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 630);
  bg.addColorStop(0, '#24382d'); bg.addColorStop(1, '#182620');
  g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
  g.strokeStyle = '#f2b632'; g.lineWidth = 8; g.strokeRect(24, 24, 1152, 582);
  const font = (px: number, weight = 700) => `${weight} ${px}px -apple-system, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`;
  g.fillStyle = '#f2b632'; g.font = font(44, 900); g.textAlign = 'center';
  g.fillText(`⬡ ${APP_NAME} ⬡`, 600, 100);
  g.fillStyle = '#f3ecd9'; g.font = font(56, 900);
  g.fillText(s.title, 600, 180);
  g.textAlign = 'left'; g.font = font(34, 700);
  s.lines.slice(0, 6).forEach((line, i) => {
    g.fillStyle = i === 0 ? '#f2b632' : '#f3ecd9';
    g.fillText(line, 90, 260 + i * 56, 1020);
  });
  g.fillStyle = '#a9c2ae'; g.font = font(24, 600); g.textAlign = 'right';
  g.fillText(appUrl().replace(/^https?:\/\//, ''), 1150, 590);
  return c;
}

/** 共有する。スマホでは共有シート、それ以外は画像を保存してテキストをコピー。結果のメッセージを返す */
export async function shareSeason(rec: SeasonRecord): Promise<string> {
  const s = summarize(rec);
  const canvas = drawCard(s);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], `pencil-baseball-season${rec.seasonNum}.png`, { type: 'image/png' }) : null;
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: s.text, title: APP_NAME });
      return '共有しました。';
    }
    if (navigator.share) {
      await navigator.share({ text: s.text, title: APP_NAME, url: appUrl() });
      return '共有しました。';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return '共有をキャンセルしました。';
  }
  // フォールバック：画像を保存＋テキストをコピー
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file!.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  try {
    await navigator.clipboard.writeText(s.text);
    return '画像を保存し、投稿用のテキストをコピーしました。SNSに貼り付けて共有できます。';
  } catch {
    return '画像を保存しました。';
  }
}

/** プレビュー用（テスト・確認） */
export function shareText(rec: SeasonRecord): string { return summarize(rec).text; }
