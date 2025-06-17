# Scheduler for Nazotoki (謎解きスケジューラー)

謎解きイベント（リアル脱出ゲーム等）のスケジュール調整を効率化するWebアプリケーションです。escape.idのイベント情報を取得し、参加者が希望日時を選択・管理できます。

## 🎯 主な機能

### スケジュール管理
- **イベント情報の自動取得**: escape.idからスケジュール情報を自動取得
- **カレンダー表示**: 月別カレンダーでスケジュールを視覚的に確認
- **参加可否の設定**: 各スロットごとに「行ける」「多分行ける」「行けない」を選択

### 一括操作
- **日付単位の一括設定**: 特定の日の全スロットを一括で設定
- **曜日単位の一括設定**: 同じ曜日の全スロットを一括で設定
- **代表スロット機能**: 同じ時間帯のスロットをまとめて管理

### データ管理
- **ユーザー設定の保存**: 選択した参加可否を自動保存
- **ステータスの読み込み**: 以前の設定を復元可能
- **満席スロットの表示**: 募集終了したスロットを自動で識別

## 🏗️ システム構成

```
scheduler-for-nazotoki/
├── frontend/          # Vue.js フロントエンド
│   ├── src/
│   │   ├── components/
│   │   │   └── SchedulePage.vue  # メインコンポーネント
│   │   └── style.css            # スタイル定義
│   └── package.json
├── backend/           # Express.js バックエンド
│   ├── server.js      # APIサーバー
│   └── package.json
└── README.md
```

### 技術スタック

**フロントエンド**
- Vue 3 (Composition API)
- Vue Router 4
- Vite
- Axios

**バックエンド**
- Node.js
- Express.js
- MySQL2
- Puppeteer (Webスクレイピング)
- CORS

## 🚀 セットアップ

### 前提条件
- Node.js (v14以上)
- MySQL
- Git

### インストール

1. **リポジトリのクローン**
```bash
git clone https://github.com/Kaki256/scheduler-for-nazotoki.git
cd scheduler-for-nazotoki
```

2. **バックエンドのセットアップ**
```bash
cd backend
npm install
```

3. **フロントエンドのセットアップ**
```bash
cd ../frontend
npm install
```

### 環境設定

**フロントエンド環境変数**
```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:3000/api
```

**データベース設定**
- MySQL データベースを作成
- バックエンドでデータベース接続情報を設定

### 起動

1. **バックエンドサーバー起動**
```bash
cd backend
node server.js
```

2. **フロントエンド開発サーバー起動**
```bash
cd frontend
npm run dev
```

アプリケーションは `http://localhost:5173` でアクセス可能です。

## 📱 使用方法

### 基本的な使い方

1. **イベントページにアクセス**
   - `/{orgSlug}/{eventSlug}` の形式でイベントページを開く

2. **スケジュール確認**
   - カレンダー表示でイベントの開催日時を確認
   - 各日をクリックして詳細スロットを表示

3. **参加可否の設定**
   - 各スロットをクリックして状態を変更
   - 「行ける」（緑）/ 「多分行ける」（黄）/ 「行けない」（赤）

### 一括操作機能

**日付単位の一括設定**
- 日付をクリックしてモーダルを開く
- 「全部行ける」「全部多分」「全部無理」ボタンで一括設定

**曜日単位の一括設定**
- カレンダー上部の曜日ラベルをクリック
- その曜日の全スロットを時間帯別に一括設定

### ステータスの意味

| ステータス | 表示色 | 意味 |
|------------|--------|------|
| 行ける | 緑 | 確実に参加可能 |
| 多分行ける | 黄 | 条件次第で参加可能 |
| 行けない | 赤 | 参加不可 |
| 未選択 | グレー | まだ決めていない |
| 満席 | 暗いグレー | 募集終了（選択不可） |

## 🔧 API エンドポイント

### スケジュール関連
- `POST /api/get-schedule` - スケジュール情報の取得
- `GET /api/load-my-status` - ユーザーのステータス読み込み
- `POST /api/save-my-status` - ユーザーのステータス保存

### パラメータ例
```javascript
// スケジュール取得
{
  "event_url": "https://escape.id/org/example/event/sample",
  "date_from": "2025-01-01",
  "date_to": "2025-01-31",
  "location_uid": "location123"
}
```

## 🎨 UI/UX の特徴

### レスポンシブデザイン
- モバイル・タブレット・デスクトップ対応
- タッチデバイスでの操作に最適化

### アクセシビリティ
- キーボードナビゲーション対応
- スクリーンリーダー対応（ARIA属性）
- 色以外でも状態を識別可能

### ユーザビリティ
- 直感的な色分けによる状態表示
- モーダルによる詳細操作
- 一括操作による効率的な設定

## 🔒 セキュリティ

- CORS設定による適切なアクセス制御
- SQL インジェクション対策
- XSS 攻撃対策

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

## 📄 ライセンス

このプロジェクトは ISC ライセンスの下で公開されています。

## 🙋‍♂️ サポート

バグ報告や機能要望は [Issues](https://github.com/Kaki256/scheduler-for-nazotoki/issues) までお願いします。

---

**開発者**: [@Kaki256](https://github.com/Kaki256)

**リポジトリ**: [scheduler-for-nazotoki](https://github.com/Kaki256/scheduler-for-nazotoki)
