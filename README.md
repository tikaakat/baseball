# 六角鉛筆ベースボール

2本の六角鉛筆を転がして1打席ずつ結果を決める、12球団リーグ戦のブラウザゲームです。

## 開発

```bash
npm install
npm run dev      # 開発サーバー（http://localhost:5173）
npm test         # シーズン進行とバランスのテスト
npm run build    # 型チェック＋本番ビルド（dist/）
```

`main` ブランチに push すると GitHub Actions でテスト・ビルドされ、GitHub Pages に公開されます
（リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく必要があります）。

## 構成

```
src/
  engine/        ゲームのロジック（画面に依存しない）
    types.ts       データ型
    data.ts        定数（名前・能力・出目の確率・監督タイプ）
    atbat.ts       1打席の判定（鉛筆の出目 → 能力補正 → 進塁）
    game.ts        試合の進行
    player.ts      選手の生成・成長・退団
    team.ts        ロースター・打順・監督・ガチャ・引退
    schedule.ts    日程
    standings.ts   順位表
    postseason.ts  クライマックスシリーズ・日本シリーズ
    awards.ts      表彰
    history.ts     球団史の保存
    save.ts        進行中のリーグの保存・復元
    storage.ts     保存先（localStorage など）の切り替え
    season.ts      リーグ初期化・シーズン移行
  ui/            各タブの描画とイベント
tests/           Vitest（シーズン進行・バランス・保存・能力と監督の効果）
original/        移行元の単一HTML版
```
