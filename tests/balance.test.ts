import { describe, expect, it } from 'vitest';
import { leagueReport } from './league-report';

/**
 * 現実のプロ野球（NPB近年）の成績に近いかを確認する。
 * 範囲は「NPBの目安 ± 乱数のぶれ」。係数（src/engine/data.ts の TUNING）を変えたらここで確認する。
 */
const TARGETS: Record<string, [number, number]> = {
  AVG: [0.235, 0.260],        // NPB .240〜.250
  OBP: [0.295, 0.325],        // .305〜.315
  SLG: [0.330, 0.390],        // .350〜.380
  'K%': [0.17, 0.22],         // 19〜20%
  'BB%': [0.07, 0.10],        // 8%前後
  'R/G': [3.3, 4.1],          // 3.5〜3.9
  'HR/team': [75, 120],       // 80〜110
  'GIDP/team': [80, 135],     // 約100
  'SB/team': [40, 90],        // 50〜70
  'SB%': [0.62, 0.80],        // 約70%
  'E/team': [50, 95],         // 60〜80
  tieRate: [0.005, 0.05],     // 2〜3%（12回まで）
  leadAvg: [0.290, 0.360],    // 首位打者 .320前後（年によっては.300を切ることも）
  leadHr: [25, 48],           // 本塁打王 30〜40
  hrP10: [0, 5],              // 規定到達者の下位1割は一桁前半（巧打者）
  ERA: [3.1, 4.2],            // リーグ防御率 3.3〜3.7
  leadEra: [1.0, 2.4],        // 最優秀防御率 1.5〜2.2
  worstQualEra: [3.6, 5.6],   // 規定投球回に達した中で最も悪い防御率
  leadW: [11, 21],            // 最多勝 13〜17
  leadSv: [25, 55],           // 最多セーブ 30〜45
  leadK: [130, 230],          // 最多奪三振 150〜200
  spIpPerStart: [5.3, 6.8],   // 先発1試合あたりの投球回 約6回
};

describe('バランス（NPBの目安との比較）', () => {
  it('4シーズン平均が目安の範囲に収まる', () => {
    const r = leagueReport(4) as unknown as Record<string, number>;
    console.table(Object.fromEntries(Object.keys(TARGETS).map((k) => [k, { value: r[k], min: TARGETS[k][0], max: TARGETS[k][1] }])));
    for (const [k, [min, max]] of Object.entries(TARGETS)) {
      expect.soft(r[k], k).toBeGreaterThanOrEqual(min);
      expect.soft(r[k], k).toBeLessThanOrEqual(max);
    }
  }, 60000);
});
