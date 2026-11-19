/* リーグ全体の成績を集計する（バランス確認用） */
import { autoSimGame, newGame } from '../src/engine/game';
import { hardResetLeague } from '../src/engine/season';
import { DB, teamById } from '../src/engine/state';
import { avgOfStats, opsOfStats } from '../src/engine/stats';
import type { Player } from '../src/engine/types';

const pct = (arr: number[], q: number) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

export interface LeagueReport {
  AVG: number; OBP: number; SLG: number; 'K%': number; 'BB%': number;
  'R/G': number; 'HR/team': number; '2B/team': number; '3B/team': number; 'SB/team': number; 'SB%': number;
  'GIDP/team': number; 'SF/team': number; 'E/team': number; tieRate: number; extraInningRate: number;
  leadAvg: number; leadHr: number; leadRbi: number; leadSb: number; leadHits: number;
  hrP10: number; hrP50: number; hrP90: number; avgP10: number; avgP90: number; opsP10: number; opsP90: number;
  winPctBest: number; winPctWorst: number;
}

/** 新しいリーグで n シーズン回した平均 */
export function leagueReport(n: number): LeagueReport {
  const acc: Record<string, number[]> = {};
  const push = (k: string, v: number) => { (acc[k] ??= []).push(v); };
  for (let s = 0; s < n; s++) {
    hardResetLeague();
    let extra = 0;
    DB.schedule.forEach((g) => { const game = autoSimGame(newGame(teamById(g.home)!, teamById(g.away)!, g.id)); if (game.inning > 9) extra++; });
    const t = { pa: 0, ab: 0, h: 0, bb: 0, k: 0, d: 0, tr: 0, hr: 0, sb: 0, cs: 0, gidp: 0, sac: 0, err: 0, r: 0 };
    const all: Player[] = []; const winPcts: number[] = [];
    DB.teams.forEach((team) => {
      winPcts.push(team.wins / (team.wins + team.losses));
      team.roster.forEach((p) => {
        all.push(p); const x = p.stats;
        t.pa += x.pa; t.ab += x.ab; t.h += x.h; t.bb += x.bb; t.k += x.k; t.d += x.doubles; t.tr += x.triples; t.hr += x.hr;
        t.sb += x.sb; t.cs += x.cs; t.gidp += x.gidp; t.sac += x.sac; t.err += x.errors; t.r += x.r;
      });
    });
    push('AVG', t.h / t.ab); push('OBP', (t.h + t.bb) / (t.ab + t.bb + t.sac));
    push('SLG', (t.h + t.d + 2 * t.tr + 3 * t.hr) / t.ab); push('K%', t.k / t.pa); push('BB%', t.bb / t.pa);
    push('R/G', t.r / DB.schedule.length / 2);
    push('HR/team', t.hr / 12); push('2B/team', t.d / 12); push('3B/team', t.tr / 12); push('SB/team', t.sb / 12); push('SB%', t.sb / (t.sb + t.cs));
    push('GIDP/team', t.gidp / 12); push('SF/team', t.sac / 12); push('E/team', t.err / 12);
    push('tieRate', DB.schedule.filter((g) => g.result?.winner === 'tie').length / DB.schedule.length);
    push('extraInningRate', extra / DB.schedule.length);
    const q = all.filter((p) => p.stats.pa >= 446);
    push('leadAvg', Math.max(...q.map((p) => avgOfStats(p.stats)))); push('leadHr', Math.max(...all.map((p) => p.stats.hr)));
    push('leadRbi', Math.max(...all.map((p) => p.stats.rbi))); push('leadSb', Math.max(...all.map((p) => p.stats.sb)));
    push('leadHits', Math.max(...all.map((p) => p.stats.h)));
    const hrs = q.map((p) => p.stats.hr), avgs = q.map((p) => avgOfStats(p.stats)), opss = q.map((p) => opsOfStats(p.stats));
    push('hrP10', pct(hrs, 0.1)); push('hrP50', pct(hrs, 0.5)); push('hrP90', pct(hrs, 0.9));
    push('avgP10', pct(avgs, 0.1)); push('avgP90', pct(avgs, 0.9)); push('opsP10', pct(opss, 0.1)); push('opsP90', pct(opss, 0.9));
    push('winPctBest', Math.max(...winPcts)); push('winPctWorst', Math.min(...winPcts));
  }
  const out: Record<string, number> = {};
  for (const k in acc) out[k] = Math.round(mean(acc[k]) * 1000) / 1000;
  return out as unknown as LeagueReport;
}
