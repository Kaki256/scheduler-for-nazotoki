# 謎解きスケジューラー (Scheduler for Nazotoki)

謎解きやその他のイベントの参加者のスケジュールを調整し、最適なチーム編成を提案するためのWebアプリケーションです。

## 概要

このアプリケーションは、複数の参加者と複数の開催日時を持つイベントの調整を簡素化することを目的としています。イベントのURLを登録するだけで、開催期間や場所などの情報が自動で入力されます。参加者はカレンダービューから参加可能な日時を「行ける」「微妙」「行けない」で選択するだけで、全員の出欠状況が一覧で確認できます。

さらに、参加者の出欠状況と、設定されたチームの最大人数に基づいて、参加可能なチームの組み合わせを自動で計算し、スコア順に提案します。特定のメンバーを同じチームに固定する機能もあり、より柔軟なチーム編成が可能です。

## 🎯 主な機能

- **イベント管理**:
  - イベントの登録、編集、削除が可能です。
  - イベントURL（[escape.id](http://escape.id), [LivePocket](https://t.livepocket.jp/), [よだかのレコード](https://www.yodaka.info/)などに対応）を貼り付けると、イベント名や開催期間、場所などの情報を自動で取得します。
- **スケジュール管理**:
  - **カレンダー表示**: 月別カレンダーでスケジュールを視覚的に確認
  - **参加可否の設定**: 各スロットごとに「行ける」「多分行ける」「行けない」を選択
- **一括操作**:
  - **日付単位の一括設定**: 特定の日の全スロットを一括で設定
  - **曜日単位の一括設定**: 同じ曜日の全スロットを一括で設定
- **出欠状況の可視化**:
  - 全参加者の出欠状況をマトリクス形式で一覧表示し、誰がどの時間に参加可能か一目で把握できます。
- **自動チーム編成提案**:
  - 全員の参加状況を基に、成立する可能性のあるチームの組み合わせを自動で計算します。
  - 各編成案はスコア付けされ、最適なものから順に表示されます。
- **固定チーム設定**:
  - 「このメンバーは必ず同じチームにしたい」といった要望に応えるため、特定のメンバーをチームとして固定した上で、残りのメンバーの最適な組み合わせを計算できます。
- **データ管理**:
  - **ユーザー設定の保存**: 選択した参加可否を自動保存
  - **ステータスの読み込み**: 以前の設定を復元可能
  - **満席スロットの表示**: 募集終了したスロットを自動で識別

## 🏗️ システム構成

```
scheduler-for-nazotoki/
├── frontend/          # Vue.js フロントエンド
├── backend/           # Express.js バックエンド
└── docker-compose.yml # Docker構成
```

### 技術スタック

- **フロントエンド**: Vue.js (Vite, Vue Router), Axios
- **バックエンド**: Node.js, Express.js
- **データベース**: MySQL / MariaDB
- **コンテナ**: Docker

## 🚀 セットアップ

このアプリケーションは、Dockerを使用する方法と手動でセットアップする方法の2通りで利用できます。

### Docker を使用したセットアップ (推奨)

#### 1. 前提条件
- Docker
- Docker Compose

#### 2. リポジトリのクローン
```bash
git clone https://github.com/Kaki256/scheduler-for-nazotoki.git
cd scheduler-for-nazotoki
```

#### 3. 環境変数の設定
プロジェクトのルートにある `.env.example` ファイルをコピーして `.env` ファイルを作成します。
```bash
cp .env.example .env
```
その後、`.env` ファイルを編集し、ご自身の環境に合わせて値を設定してください。特に `MYSQL_ROOT_PASSWORD` などの重要な変数を設定する必要があります。

#### 4. アプリケーションの起動
```bash
docker-compose up --build -d
```
- フロントエンドは `http://localhost:5173` で利用可能になります。
- バックエンドAPIは `http://localhost:3001` でリッスンします。
- Adminer（データベース管理ツール）は `http://localhost:8080` でアクセスできます。

### 手動セットアップ

#### 1. 前提条件
- Node.js (v14以上)
- MySQL
- Git

#### 2. インストール
```bash
# リポジトリのクローン
git clone https://github.com/Kaki256/scheduler-for-nazotoki.git
cd scheduler-for-nazotoki

# バックエンドのセットアップ
cd backend
npm install

# フロントエンドのセットアップ
cd ../frontend
npm install
```

#### 3. 環境設定
- **バックエンド**: データベース接続情報などを設定します。
- **フロントエンド**: `.env` ファイルを作成し、`VITE_API_BASE_URL=http://localhost:3001/api` のようにAPIサーバーのURLを設定します。

#### 4. 起動
```bash
# バックエンドサーバー起動
cd backend
node server.js

# フロントエンド開発サーバー起動
cd frontend
npm run dev
```

## 🔒 セキュリティに関する注意

**重要**: このアプリケーションの認証メカニズムは、リバースプロキシが `x-forwarded-user` または `x-showcase-user` ヘッダーを正しく設定することを前提としています。これは、TraPの部内サービスのような、信頼されたリバースプロキシ環境下での利用を想定したものです。

もしこのアプリケーションを直接インターネットに公開したり、信頼できないプロキシ環境下で実行したりする場合、悪意のあるユーザーがこれらのヘッダーを偽装して他のユーザーになりすます可能性があります。公開する際には、このリスクを十分に理解し、必要に応じて認証部分をより堅牢な方法（例: OAuth2のstateパラメータとPKCEを組み合わせた認証フローなど）に変更してください。

## 🔧 API エンドポイント

- `POST /api/get-schedule` - スケジュール情報の取得
- `GET /api/load-my-status` - ユーザーのステータス読み込み
- `POST /api/save-my-status` - ユーザーのステータス保存

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

