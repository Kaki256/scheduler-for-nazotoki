# API Specification

## Authentication & Headers

本システムのAPIは、信頼されたリバースプロキシ環境下で動作することを前提としています。
各エンドポイントにおいて、リクエスト元のユーザー特定には **`x-showcase-user`** (または `x-forwarded-user`) ヘッダーを排他的に使用します。
※フロントエンドからペイロードやクエリでユーザー名を送信してはいけません。

## Endpoints

### 1. `POST /api/get-schedule`

外部チケットサイトからスケジュール情報をスクレイピングして取得・登録します。

- **Payload:** `{ "event_url": "https://..." }`
- **Response:** JSON containing dates, time slots, and basic event info.

### 2. `GET /api/events/:eventUrlEncoded/summary`

特定イベントの全ユーザーの出欠状況サマリーを取得します。

- **Response:** JSON containing the attendance matrix of all users.

### 3. `GET /api/load-my-status`

ユーザー自身の出欠状況を取得します。

- **Headers Required:** `x-showcase-user`
- **Query Params:** `event_url`
- **Response:** `{ "selections": {...} }`

### 4. `POST /api/save-my-status`

ユーザー自身の出欠状況を保存します。

- **Headers Required:** `x-showcase-user`
- **Payload:** `{ "event_url": "...", "selections": {...} }`
- **Response:** `{ "status": "success" }`

### 5. `POST /api/calculate-teams`

Calculates optimal team combinations based on the current attendance matrix.

- *Performance & Safety:* Implements a time-boxed best-effort algorithm (max 5 seconds timeout) on the backend to prevent server crashes and 504 timeouts due to combinatorial explosions for large groups (20-30+ people).
- **Payload:** `{ "event_url": "...", "participatingUsers": [...], "maxParticipants": 4, "fixedTeamsFromUI": [...], "allEventTimeSlotsUTC": [...], "userSelectionsMap": {...}, "vacancyStatusMap": {...} }`
- **Response:** JSON containing scored team combination proposals `{"combinations": [...], "timeoutReached": boolean}`.
