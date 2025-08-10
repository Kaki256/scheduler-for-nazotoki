# 謎解きスケジューラー - 実装方針とアーキテクチャ

## プロジェクト概要

謎解きイベントの参加者スケジュール調整と最適なチーム編成提案を行う Web アプリケーション。複数のチケット販売サイトからのスケジュール自動取得と、参加者の出欠状況に基づく自動チーム編成機能を提供します。

## アーキテクチャ

### フロントエンド

- **技術スタック**: Vue.js 3 + Vite + Vue Router + Axios
- **UI/UX**: 直感的なカレンダーベースの操作、リアルタイムでの出欠状況可視化
- **レスポンシブ対応**: モバイル・タブレット・デスクトップ環境での最適表示

### バックエンド

- **技術スタック**: Node.js + Express.js + MySQL/MariaDB
- **Web スクレイピング**: Cheerio + Axios による複数サイト対応
- **API 設計**: RESTful API、適切なエラーハンドリングとレスポンス形式

## 対応イベントサイト

### 1. escape.id

- **URL 形式**: `https://escape.id/{org}-org/e-{event}/`
- **取得方法**: 専用 API エンドポイント経由
- **取得情報**: イベント名、開催期間、場所、時間帯、売れ行き状況

### 2. LivePocket

- **URL 形式**: `https://t.livepocket.jp/t/{event-id}`
- **取得方法**: HTML スクレイピング（ページネーション対応）
- **取得情報**: 詳細な時間帯情報、リアルタイム売れ行き状況
- **売れ行き状況マッピング**:
  - `sale` → `MANY`（余裕あり）
  - `sell-out-soon` → `FEW`（残りわずか）
  - `finished-scheduled-quantity` → `FULL`（完売）

### 3. Yodaka（よだかのレコード）

- **URL 形式**: `https://yodaka.info/event/{event-slug}/`
- **取得方法**: Yodaka ページから LivePocket リンクを抽出 →LivePocket スクレイピング
- **実装特徴**: 二段階スクレイピング（Yodaka→LivePocket）

## 主要機能実装

### 1. イベント管理システム

#### URL 自動認識とデータ取得

```javascript
// URL形式の判定
if (eventUrl.includes("escape.id/")) {
  // escape.id API呼び出し
} else if (eventUrl.includes("yodaka.info/event/")) {
  // Yodakaスクレイピング → LivePocket連携
} else if (eventUrl.includes("t.livepocket.jp/t/")) {
  // LivePocket直接スクレイピング
}
```

#### データベース設計

```sql
-- イベント基本情報
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_url VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  start_date DATE,
  end_date DATE,
  location_uid VARCHAR(100),
  max_participants INT,
  estimated_time INT,
  location_name VARCHAR(255),
  location_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- ユーザー出欠情報
CREATE TABLE user_event_selections (
  username VARCHAR(50),
  event_url VARCHAR(255),
  selections_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (username, event_url)
);
```

### 2. スケジュール取得とスクレイピング

#### LivePocket スクレイピング実装

```javascript
async function fetchScheduleFromLivePocket(eventUrl) {
  const dateMap = {};
  let page = 1;

  // 403エラー対策ヘッダー設定
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    'Accept': 'text/html,application/xhtml+xml...',
    // ... その他ブラウザヘッダー
  };

  // ページネーション対応
  while (true) {
    const pagedUrl = `${eventUrl}?sort=1&page=${page}`;
    const { data: html } = await axios.get(pagedUrl, { headers });

    // 詳細ページリンク抽出
    const links = $('a[href^="https://t.livepocket.jp/e/"]').map(...).get();

    // 各詳細ページから時間帯と売れ行き状況を取得
    for (const detailUrl of links) {
      const { data: detailHtml } = await axios.get(detailUrl, { headers });
      const $$ = cheerio.load(detailHtml);

      // 日時情報の抽出
      $$('section.ticket section.title h4.text-break').each((i, elem) => {
        const text = $$(elem).text().trim();
        const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
        const times = text.match(/(\d{1,2}:\d{2})/g) || [];

        // 売れ行き状況の判定
        const statusSection = $$(elem).closest('section.title').find('section.status');
        let vacancyType = 'MANY';
        if (statusSection.hasClass('sell-out-soon')) vacancyType = 'FEW';
        else if (statusSection.hasClass('finished-scheduled-quantity')) vacancyType = 'FULL';

        // データ格納
        times.forEach(time => {
          dateMap[dateStr].push({ time, vacancyType });
        });
      });
    }

    // 次ページ確認
    const hasNext = pagerLinks.some(href => href?.includes(`page=${page + 1}`));
    if (!hasNext) break;
    page++;

    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return schedules;
}
```

#### Yodaka 対応実装

```javascript
// YodakaページからLivePocketリンクを抽出
if (event_url.includes("yodaka.info/event/")) {
  const { data: yodakaHtml } = await axios.get(event_url);
  const livePocketMatch = yodakaHtml.match(
    /https:\/\/t\.livepocket\.jp\/t\/[A-Za-z0-9\-]+/
  );
  const baseLpUrl = livePocketMatch[0];

  // LivePocketスクレイピング実行
  const lpResults = await fetchScheduleFromLivePocket(baseLpUrl);
  return res.json({
    dates: lpResults.sort((a, b) => new Date(a.date) - new Date(b.date)),
  });
}
```

### 3. チーム編成アルゴリズム

#### 基本方針

1. **全参加者の出欠状況分析**: 各時間帯での「行ける」「微妙」「行けない」状況を数値化
2. **スコアリング**: 参加確実性、チームバランス、売れ行き状況を総合評価
3. **固定チーム対応**: 指定されたメンバーを同一チーム固定した上での最適化
4. **動的計算**: リアルタイムでの組み合わせ再計算

#### スコア計算ロジック

```javascript
function calculateTeamScore(team, timeSlot) {
  let score = 0;
  const attendanceScores = { AVAILABLE: 5, MAYBE: 1, UNAVAILABLE: 0 };
  const vacancyScores = { MANY: 5, FEW: 1, FULL: 0 };

  // 参加者スコア合計
  team.forEach((member) => {
    score += attendanceScores[member.status] || 0;
  });

  // 売れ行き状況ボーナス
  score += vacancyScores[timeSlot.vacancyType] || 0;

  return score;
}
```

### 4. フロントエンド実装

#### Vue.js コンポーネント設計

- **EventListPage**: イベント一覧、検索、フィルタリング
- **EventFormPage**: イベント作成・編集、URL 自動取得
- **SchedulePage**: 個人スケジュール入力、カレンダー UI
- **EventSummaryPage**: 全体出欠状況、チーム編成提案

#### URL 処理の統一化

```javascript
// 各サイト対応のナビゲーション関数
function navigateToSchedule(eventUrl) {
  const url = new URL(eventUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  let orgSlug, eventSlug;

  if (url.hostname === "yodaka.info") {
    orgSlug = "Yodaka";
    eventSlug = parts[1]; // event/{slug}/
  } else if (parts[0] === "org") {
    // 旧形式: /org/{orgSlug}/event/{eventSlug}/
    orgSlug = parts[1];
    eventSlug = parts[3];
  } else {
    // 新形式: /{orgSlug}-org/e-{eventSlug}/
    orgSlug = parts[0].endsWith("-org") ? parts[0].slice(0, -4) : parts[0];
    eventSlug = parts[1].startsWith("e-") ? parts[1].slice(2) : parts[1];
  }

  router.push({ name: "SchedulePage", params: { orgSlug, eventSlug } });
}
```

### 5. エラーハンドリングと最適化

#### スクレイピング耐性向上

- **User-Agent 偽装**: 実ブラウザと同等のヘッダー設定
- **レート制限対策**: リクエスト間隔調整
- **部分的失敗許容**: 一部ページの取得失敗でも処理継続
- **タイムアウト設定**: 適切なタイムアウト値設定

#### データベース最適化

- **論理削除**: 物理削除ではなく`deleted_at`フラグでの論理削除
- **UPSERT 処理**: 重複データの適切な処理
- **インデックス設定**: パフォーマンス向上のための適切なインデックス

#### フロントエンド最適化

- **レスポンシブ対応**: 各デバイスサイズでの最適表示
- **リアルタイム更新**: 出欠状況変更の即座反映
- **ローディング状態**: 適切なローディング表示とエラーメッセージ

## セキュリティ考慮事項

### 1. スクレイピング対策

- **適切な User-Agent 設定**: ボット検出回避
- **リクエスト頻度制限**: サーバー負荷軽減
- **エラー時のグレースフルデグレード**: 機能の段階的縮退

### 2. データ保護

- **SQL インジェクション対策**: プリペアドステートメント使用
- **XSS 対策**: 入力値のサニタイズ
- **CORS 設定**: 適切なクロスオリジン設定

## 今後の拡張予定

### 1. 対応サイト拡張

- SCRAP（Mystery Circus）の完全対応
- その他謎解きサイトの対応追加

### 2. 機能拡張

- プッシュ通知機能
- カレンダーアプリ連携
- チーム編成の手動調整機能
- 統計・分析機能

### 3. パフォーマンス改善

- キャッシュ機能の実装
- バックグラウンドでのスケジュール更新
- CDN 導入検討

## 開発・運用指針

### 1. コード品質

- ESLint/Prettier による一貫したコードスタイル
- 適切なコメントと型定義
- ユニットテスト・統合テストの実装

### 2. 監視・ログ

- スクレイピング成功率の監視
- エラーログの適切な収集
- パフォーマンスメトリクスの測定

### 3. 継続的改善

- ユーザーフィードバックの収集
- A/B テストによる機能改善
- 定期的なセキュリティ監査

この実装により、複数のチケット販売サイトに対応した包括的なスケジュール調整システムを提供し、謎解きコミュニティの利便性向上に貢献します。
