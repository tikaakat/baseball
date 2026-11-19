/* 定数データ（名前・チーム・能力・出目の確率など） */
import type { AbilityKey, ManagerType, P1Face, P2Face } from './types';

export const POSITIONS = ['指', '捕', '一', '二', '三', '遊', '左', '中', '右'];

export const SURNAMES = ['鈴木', '佐藤', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
  '阿部', '森', '池田', '橋本', '石川', '前田', '藤田', '岡田', '長谷川', '村上',
  '近藤', '石井', '坂本', '遠藤', '青木', '福田', '三浦', '西村', '藤井', '岡本',
  '中川', '中島', '小川', '大野', '竹内', '金子', '原田', '上田', '柴田', '宮崎',
  '横山', '宮本', '内田', '高木', '安藤', '谷口', '丸山', '今井', '高田', '増田',
  '小野', '田村', '高野', '河野', '藤本', '山下', '石田', '大西', '菅原', '浜田',
  '杉山', '小島', '平野', '久保', '星野', '荒木', '岩崎', '堀', '秋山', '本田'];

/** 架空の12球団（文房具がモチーフ） */
export const TEAM_DEFS = [
  { name: '東京シャープナーズ', league: 'E', tagline: '削れば削るほど、鋭くなる。' },
  { name: '横浜ヘキサゴンズ', league: 'E', tagline: '転がっても、狙いは外さない。' },
  { name: '新潟エイチビーズ', league: 'E', tagline: '白と黒、決着は芯の硬さで。' },
  { name: '仙台ルーラーズ', league: 'E', tagline: '薄く、硬く、正確に。' },
  { name: '札幌シダーズ', league: 'E', tagline: '木の香りと共に、一振り。' },
  { name: '甲府ラウンダーズ', league: 'E', tagline: '丸くても、まっすぐ飛ぶ。' },
  { name: '大阪イレーサーズ', league: 'W', tagline: '間違いも、なかったことに。' },
  { name: '京都シタジキーズ', league: 'W', tagline: '下から支える、静かな強さ。' },
  { name: '福岡ノッカーズ', league: 'W', tagline: 'カチッと一押し、芯が出る。' },
  { name: '神戸グラファイツ', league: 'W', tagline: '黒鉛が導く、静かな連携。' },
  { name: '広島ペンキャップス', league: 'W', tagline: '蓋をして、また明日。' },
  { name: '名古屋スペアーズ', league: 'W', tagline: '折れても、また削ればいい。' },
];
/** 旧版のチーム名（保存データの移行用。ユーザーが変更していなければ新しい名前に置き換える） */
export const LEGACY_TEAM_NAMES = ['東京ジャイアンツ', '横浜ブルーオーシャンズ', '新潟アルビレックス', '仙台アークナイツ', '札幌シャイニングス', '甲府モンキーズ',
  '大阪バファローズ', '京都フラワーピース', '博多ホークス', '神戸スパーズ', '広島レッドドラゴンズ', '名古屋ウィングス'];

/** ポストシーズンの名称 */
export const POSTSEASON_NAMES = { firstStage: 'プレーオフ ファーストステージ', finalStage: 'プレーオフ ファイナルステージ', final: 'ペンシルシリーズ' };

/** 野手の控え（守備位置の表記） */
export const BENCH_POSITIONS = ['捕', '内', '内', '外'];
/** 投手陣の人数 */
export const STAFF_SIZE = { rotation: 6, bullpen: 7 }; // NPB同様の6人ローテーション
/** チーム定義から実際のリーグコードを取得（[0]=イースト, [1]=ウエスト） */
export const LEAGUE_CODES = [...new Set(TEAM_DEFS.map((d) => d.league))];
export const DEFAULT_LEAGUE_NAMES: Record<string, string> = { E: 'イーストリーグ', W: 'ウエストリーグ' };

export const FACE_LABEL: Record<string, string> = {
  hit: 'ヒット', flyout: 'フライ', groundout: 'ゴロ', k: '三振', otto: 'おっと…',
  double: '２ベース', triple: '３ベース', hr: 'HR！', walk: '四球',
};
/** 鉛筆アニメーション用の面 */
export const P1_FACES: P1Face[] = ['hit', 'flyout', 'groundout', 'k', 'walk', 'otto'];
export const P2_FACES: P2Face[] = ['double', 'double', 'hr', 'k', 'flyout', 'groundout'];

/** 出目の確率（現実のプロ野球の成績に近づくよう調整済み） */
export const P1_WEIGHTS: Record<P1Face, number> = { hit: 0.155, walk: 0.085, flyout: 0.185, groundout: 0.22, k: 0.155, otto: 0.20 };
export const P2_WEIGHTS: Record<P2Face, number> = { double: 0.215, hr: 0.115, k: 0.185, flyout: 0.22, groundout: 0.265 };

export const GIVEN_NAMES = [
  { name: '翔太', initial: 's' }, { name: '陸', initial: 'r' }, { name: '蓮', initial: 'r' }, { name: '颯', initial: 's' },
  { name: '悠斗', initial: 'y' }, { name: '大輝', initial: 'd' }, { name: '健太', initial: 'k' }, { name: '太郎', initial: 't' },
  { name: '次郎', initial: 'j' }, { name: '一郎', initial: 'i' }, { name: '誠', initial: 'm' }, { name: '健二', initial: 'k' },
  { name: '洋平', initial: 'y' }, { name: '拓也', initial: 't' }, { name: '隼人', initial: 'h' }, { name: '直樹', initial: 'n' },
  { name: '裕也', initial: 'y' }, { name: '和也', initial: 'k' }, { name: '雄大', initial: 'y' }, { name: '賢人', initial: 'k' },
  { name: '諒', initial: 'r' }, { name: '翼', initial: 't' }, { name: '淳', initial: 'j' }, { name: '浩二', initial: 'k' },
  { name: '聡', initial: 's' }, { name: '卓也', initial: 't' }, { name: '武', initial: 't' }, { name: '修平', initial: 's' },
  { name: '広大', initial: 'k' }, { name: '優', initial: 'y' }, { name: '大樹', initial: 'd' }, { name: '康平', initial: 'k' },
  { name: '航', initial: 'w' }, { name: '駿', initial: 's' }, { name: '樹', initial: 'i' }, { name: '稜', initial: 'r' },
  { name: '創', initial: 's' }, { name: '陽翔', initial: 'h' }, { name: '新', initial: 'a' }, { name: '貴之', initial: 't' },
  { name: '正人', initial: 'm' }, { name: '和樹', initial: 'k' }, { name: '竜也', initial: 't' }, { name: '光', initial: 'h' },
  { name: '豪', initial: 'g' }, { name: '茂', initial: 's' }, { name: '信治', initial: 's' }, { name: '昌弘', initial: 'm' },
  { name: '英樹', initial: 'h' }, { name: '崇', initial: 't' },
];
/** 外国人選手用の名前プール（姓・名をセットで持つ） */
export const FOREIGN_NAMES = [
  { surname: 'スミス', given: 'マイク', initial: 'm' }, { surname: 'ジョンソン', given: 'クリス', initial: 'c' },
  { surname: 'ロドリゲス', given: 'カルロス', initial: 'c' }, { surname: 'ガルシア', given: 'ホセ', initial: 'j' },
  { surname: 'マルティネス', given: 'ルイス', initial: 'l' }, { surname: 'ブラウン', given: 'トニー', initial: 't' },
  { surname: 'ウィリアムズ', given: 'ジェイク', initial: 'j' }, { surname: 'デービス', given: 'ライアン', initial: 'r' },
  { surname: 'ペレス', given: 'ダニエル', initial: 'd' }, { surname: 'ゴンザレス', given: 'マーカス', initial: 'm' },
  { surname: 'テイラー', given: 'アダム', initial: 'a' }, { surname: 'アンダーソン', given: 'ネイト', initial: 'n' },
  { surname: 'トーマス', given: 'ケビン', initial: 'k' }, { surname: 'ヘルナンデス', given: 'ミゲル', initial: 'm' },
  { surname: 'モラレス', given: 'フアン', initial: 'j' }, { surname: 'クルーズ', given: 'エディ', initial: 'e' },
  { surname: 'ジャクソン', given: 'デレク', initial: 'd' }, { surname: 'ロビンソン', given: 'ブレット', initial: 'b' },
  { surname: 'バティスタ', given: 'ラファエル', initial: 'r' }, { surname: 'キム', given: 'ジュン', initial: 'j' },
  { surname: 'ウォーカー', given: 'ザック', initial: 'z' }, { surname: 'ヤング', given: 'コディ', initial: 'c' },
  { surname: 'ハリス', given: 'オースティン', initial: 'a' }, { surname: 'キング', given: 'タイラー', initial: 't' },
  { surname: 'ライト', given: 'ブライアン', initial: 'b' }, { surname: 'ロペス', given: 'ディエゴ', initial: 'd' },
  { surname: 'サンチェス', given: 'パブロ', initial: 'p' }, { surname: 'ラミレス', given: 'エクトル', initial: 'e' },
  { surname: 'パク', given: 'ミンス', initial: 'm' }, { surname: 'チェン', given: 'ウェイ', initial: 'w' },
];
/** 外国人選手が生まれる確率 */
export const FOREIGN_PLAYER_RATE = 0.16;

export const ABILITY_INFO: Record<AbilityKey, { label: string; desc: string }> = {
  leadoff: { label: '一番打者向き', desc: 'その試合の第一打席は、凡打がヒットに化けやすい。' },
  clutch: { label: '勝負強い', desc: '得点圏に走者がいると、長打に化けやすい。' },
  bigSwing: { label: '一発長打', desc: '状況を問わず、二塁打が本塁打に化けやすい。' },
  steady: { label: '堅実', desc: '三振や併殺を粘って防ぎやすい。' },
  comeback: { label: '逆転の一振り', desc: '自チームがビハインドの場面で、凡打がヒットに化けやすい。' },
  luckySeven: { label: 'ラッキーセブン', desc: '7回になると、凡打がヒットに化けやすい。' },
  basesLoadedHero: { label: '満塁男', desc: '満塁の場面で、長打に化けやすい（勝負強いより強力）。' },
  inningStarter: { label: '先頭打者', desc: '無死走者なしの場面（イニング先頭）で、凡打がヒットに化けやすい。' },
  goodEye: { label: '選球眼', desc: '三振が四球に変わりやすい。' },
  lateInningPower: { label: '逆転の一発', desc: '8回以降、自チームがビハインドの場面で長打に化けやすい。' },
  stealer: { label: '俊足盗塁王', desc: '盗塁を仕掛けやすく、成功率も高い。' },
  defenseAce: { label: '守備の達人', desc: '自分が失策の対象に選ばれても、好プレーで防ぐことがある。' },
};
export const ABILITY_KEYS = Object.keys(ABILITY_INFO) as AbilityKey[];

/**
 * 打順(0=1番〜8=9番)ごとの能力の出やすさ。値の合計が低いほど「無能力」の余地が大きい。
 * 1-2番=一番打者向き/堅実/選球眼/俊足、3-5番=勝負強い/一発長打/満塁男/逆転の一発、下位打線は堅実・守備中心で控えめ。
 */
export const ABILITY_AFFINITY: Partial<Record<AbilityKey, number>>[] = [
  { leadoff: 0.28, inningStarter: 0.10, stealer: 0.10, steady: 0.06, comeback: 0.04 },
  { steady: 0.18, goodEye: 0.10, leadoff: 0.06, inningStarter: 0.06, comeback: 0.04 },
  { clutch: 0.22, basesLoadedHero: 0.09, bigSwing: 0.07, lateInningPower: 0.05, comeback: 0.04 },
  { bigSwing: 0.24, basesLoadedHero: 0.12, clutch: 0.09, lateInningPower: 0.07 },
  { bigSwing: 0.18, clutch: 0.15, basesLoadedHero: 0.07, lateInningPower: 0.06 },
  { clutch: 0.09, steady: 0.09, luckySeven: 0.07, goodEye: 0.06, comeback: 0.05 },
  { steady: 0.13, luckySeven: 0.07, defenseAce: 0.06, comeback: 0.05 },
  { steady: 0.12, luckySeven: 0.05, defenseAce: 0.08, comeback: 0.04 },
  { steady: 0.08, defenseAce: 0.08, comeback: 0.03 },
];

/** 能力は内部的に1〜256の数値で持ち、表示はA〜G評価＋色で行う */
export const GRADE_TIERS = [
  { min: 220, grade: 'A', color: '#e0473f' },
  { min: 184, grade: 'B', color: '#f2924a' },
  { min: 147, grade: 'C', color: '#f2d43f' },
  { min: 110, grade: 'D', color: '#a8d84a' },
  { min: 74, grade: 'E', color: '#4ac97a' },
  { min: 37, grade: 'F', color: '#4a9de0' },
  { min: 1, grade: 'G', color: '#9a9a9a' },
];
/** 能力値の編集時、評価からその評価の中央値へ変換する */
export const GRADE_MID: Record<string, number> = { A: 238, B: 201, C: 165, D: 128, E: 91, F: 55, G: 18 };

/** 監督：チームの能力に恒常的な補正をかける。数年〜数十年の任期があり、Bクラスが続くと解任される */
export const MANAGER_TYPES: ManagerType[] = [
  { key: 'star', label: 'スター采配', desc: '全打者の能力が実質+10%扱いになる', statMult: { power: 1.10, contact: 1.10, speed: 1.10 } },
  { key: 'power', label: '一発攻勢', desc: '全打者のパワーが実質+20%扱いになる', statMult: { power: 1.20, contact: 1, speed: 1 } },
  { key: 'speedball', label: '機動力野球', desc: '全打者の走力が実質+20%扱いになる', statMult: { power: 1, contact: 1, speed: 1.20 } },
  { key: 'contactball', label: 'つなぐ野球', desc: '全打者のミートが実質+20%扱いになる', statMult: { power: 1, contact: 1.20, speed: 1 } },
  { key: 'realistic', label: '堅実采配', desc: '併殺になりにくい', gidpResist: 0.35 },
  { key: 'defense', label: '守り勝つ野球', desc: '自チーム守備時、相手の失策が減りにくい／自軍の失策は起きにくい', errorReduction: 0.5 },
  { key: 'balanced', label: 'バランス重視', desc: '全打者の能力が実質+5%扱いになる代わりに、突出はしにくい', statMult: { power: 1.05, contact: 1.05, speed: 1.05 } },
  { key: 'aggressive', label: '積極采配', desc: '盗塁を仕掛けやすくなる', stealBoost: 1.6 },
  { key: 'patient', label: '待球作戦', desc: '全打者が四球を選びやすくなる', walkBoost: 1.3 },
  { key: 'oldschool', label: '昭和の猛練習', desc: '全打者のパワー・ミートが実質+8%、走力は実質-5%扱いになる', statMult: { power: 1.08, contact: 1.08, speed: 0.95 } },
  { key: 'youthful', label: '若手抜擢', desc: '全打者の走力が実質+15%、パワーが実質-5%扱いになる', statMult: { power: 0.95, contact: 1, speed: 1.15 } },
  { key: 'unlucky', label: '迷采配', desc: '併殺になりやすい（不運な監督）', gidpResist: -0.15 },
];

/** 引退：startAge 歳から、base + perYear×(年齢−startAge) の確率で引退（能力が weakOverall 未満なら +weakBonus）。forcedAge で必ず引退 */
export const RETIREMENT = { startAge: 33, base: 0.12, perYear: 0.10, weakOverall: 105, weakBonus: 0.20, forcedAge: 42 } as const;
/** 新人（ガチャ・引退の穴埋め）の能力の上限。1〜この値で生成し、若いうちに伸びる */
export const ROOKIE_MAX_STAT = 230;
/** 新人の入団年齢（高卒〜社会人） */
export const ROOKIE_AGE = [20, 25] as const;
export const GROWTH_PEAK = { early: 25, normal: 28, late: 32 } as const;
/** 打力上位から割り当てる打順の優先順 */
export const BATTING_SLOT_PRIORITY = [3, 4, 2, 5, 1, 6, 7, 8, 9];
export const SERIES_KEYS = ['H1', 'B1', 'H2', 'B2', 'JS'] as const;

/**
 * バランス調整用の係数（NPBの近年の成績に合わせて調整。tests/balance.test.ts で確認）
 * c = ミート、pw = パワー、s = 走力（いずれも 0〜1 に正規化した値）
 */
export const TUNING = {
  /** 1本目の鉛筆 */
  p1: {
    hit: { base: 0.138, contact: 0.042 },        // ヒット = base + contact×c
    walk: 0.082,
    k: { base: 0.195, contact: -0.08, power: 0.03 },
    otto: { base: 0.165, power: 0.075 },         // おっと（2本目へ）
    flyShare: { base: 0.40, power: 0.16 },       // 残り（凡打）のうちフライの割合
  },
  /** 2本目の鉛筆（おっと時） */
  p2: {
    hr: { base: 0.014, power: 0.145 },            // HR = base + power×pw²（パワーが高いほど急に伸びる）
    double: { base: 0.15, contact: 0.04 },
    k: 0.16,
    flyShare: 0.5,
  },
  /** 走力による長打の上積み */
  stretch: { singleToDouble: 0.20, singleMinSpeed: 0.4, doubleToTriple: 0.13 },
  /** 走者の進塁 */
  running: {
    singleScoreFrom2nd: { base: 0.42, speed: 0.38, twoOutBonus: 0.30 },
    single1stTo3rd: { base: 0.08, speed: 0.30, twoOutBonus: 0.10 },
    doubleScoreFrom1st: { base: 0.25, speed: 0.45, twoOutBonus: 0.20 },
    sacFly: 0.65,                                 // 三塁走者が犠牲フライで還る確率
    flyTag2ndTo3rd: { base: 0.15, speed: 0.25 },
    groundAdvance2ndTo3rd: 0.5,                   // 走者二塁（一塁なし）のゴロで三進
    groundScoreFrom3rd: { base: 0.25, speed: 0.30 }, // 走者三塁（一塁なし）のゴロで生還
  },
  /** 併殺：走者一塁・2アウト未満のゴロで、この確率で併殺（打者走力・監督・堅実で下がる） */
  doublePlay: { base: 0.60, speed: -0.40, steadyMult: 0.7, min: 0.05 },
  /** 盗塁 */
  steal: { attemptMinSpeed: 0.3, attempt: 0.21, success: { base: 0.48, speed: 0.33 }, stealer: { attemptMult: 1.8, successBonus: 0.08 } },
  /** 「凡打→ヒット」系の特殊能力が発動する確率（打率への上乗せがそれぞれ +.020前後になるよう調整） */
  abilityHit: { leadoff: 0.15, comeback: 0.07, luckySeven: 0.25, inningStarter: 0.10 },
  /** 失策率（ゴロ・フライのアウトに対して） */
  errorRate: 0.026,
  /** 延長の上限（NPB同様。これを超えたら引き分け） */
  maxInnings: 12,
  /**
   * 投手が打者の鉛筆を書き換える係数。s=球威, c=制球（いずれも平均0、−0.5〜+0.5）、f=疲労（0〜1）
   * 各面の確率に (1 + 係数×値) を掛け、残りを凡打に回す
   */
  pitcher: {
    hit: { stuff: -0.34, fatigue: 0.25 },
    otto: { stuff: -0.22, fatigue: 0.25 },
    k: { stuff: 0.60, fatigue: -0.25 },
    walk: { control: -0.70, fatigue: 0.30 },
    hr: { stuff: -0.20, control: -0.35, fatigue: 0.30 },
    double: { stuff: -0.15, fatigue: 0.15 },
  },
  /** 投手が疲れずに投げられる打者数（先発・救援）。超えると疲労がたまる */
  stamina: { starterBase: 17, starterRange: 11, relieverBase: 4, relieverRange: 6, fatigueSpan: 9 },
} as const;
