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

export const TEAM_DEFS = [
  { name: '東京ジャイアンツ', league: 'E', tagline: '削れば削るほど、鋭くなる。' },
  { name: '横浜ブルーオーシャンズ', league: 'E', tagline: '転がっても、狙いは外さない。' },
  { name: '新潟アルビレックス', league: 'E', tagline: '白と黒、決着は芯の硬さで。' },
  { name: '仙台アークナイツ', league: 'E', tagline: '薄く、硬く、正確に。' },
  { name: '札幌シャイニングス', league: 'E', tagline: '木の香りと共に、一振り。' },
  { name: '甲府モンキーズ', league: 'E', tagline: '丸くても、まっすぐ飛ぶ。' },
  { name: '大阪バファローズ', league: 'W', tagline: '間違いも、なかったことに。' },
  { name: '京都フラワーピース', league: 'W', tagline: '下から支える、静かな強さ。' },
  { name: '博多ホークス', league: 'W', tagline: 'カチッと一押し、芯が出る。' },
  { name: '神戸スパーズ', league: 'W', tagline: '黒鉛が導く、静かな連携。' },
  { name: '広島レッドドラゴンズ', league: 'W', tagline: '蓋をして、また明日。' },
  { name: '名古屋ウィングス', league: 'W', tagline: '折れても、また削ればいい。' },
];
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

export const RETIREMENT_AGE = 45; // これを超えたら強制引退
export const GROWTH_PEAK = { early: 25, normal: 28, late: 32 } as const;
/** 打力上位から割り当てる打順の優先順 */
export const BATTING_SLOT_PRIORITY = [3, 4, 2, 5, 1, 6, 7, 8, 9];
export const SERIES_KEYS = ['H1', 'B1', 'H2', 'B2', 'JS'] as const;
