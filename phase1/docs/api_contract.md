# API契約書（Phase 1）

本ドキュメントは、以下のエンドポイントの入力・出力契約を定義する。

| # | メソッド | パス | 概要 |
|---|---|---|---|
| 1 | POST | `/api/upload` | PDFアップロード・処理開始 |
| 2 | POST | `/api/chat` | 質問応答（Streaming対応） |
| 3 | GET | `/api/sessions` | セッション一覧取得 |
| 4 | GET | `/api/documents/[id]` | ドキュメント処理状態・詳細取得 |
| 5 | GET | `/api/sessions/[id]` | セッション詳細・ドキュメント一覧・メッセージ履歴取得 |

---

## 共通仕様

- Base Path: `/api`
- Content-Type（JSON API）: `application/json`
- 文字コード: UTF-8
- 日時形式: ISO 8601（例: `2026-05-07T12:34:56Z`）
- ID形式: **UUID**（`uploadId` / `messageId` / `documentIds` / `cursor` を含むすべてのID例をUUIDで統一）

### 共通エラーレスポンス形式

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "リクエストが不正です",
    "details": {
      "field": "message",
      "reason": "required"
    }
  }
}
```

- `error.code`: 機械可読なエラーコード
- `error.message`: ユーザー向けメッセージ
- `error.details`: 任意の追加情報

### 共通エラーコードのUI表示ルール（画面契約）

| error.code | 表示文言（固定） | 再試行可否 | 入力欄disable |
|---|---|---|---|
| `BAD_REQUEST` | 入力内容に誤りがあります。内容を確認してください。 | 不可（入力修正後に送信） | なし |
| `PAYLOAD_TOO_LARGE` | 入力サイズが上限を超えています。短くするか対象を絞ってください。 | 不可（入力修正後に送信） | なし |
| `RATE_LIMITED` | リクエストが集中しています。しばらく待ってから再試行してください。 | 可（待機後に再試行） | あり（一定時間） |
| `INTERNAL_ERROR` | サーバーエラーが発生しました。時間をおいて再試行してください。 | 可（時間をおいて再試行） | なし |

---

## 1) `POST /api/upload`

PDFを受け取り、テキスト抽出・要約ジョブを開始する。

### ファイル制約

| 項目 | 上限 |
|---|---|
| ファイルサイズ | 10MB（10,485,760 バイト） |
| ページ数 | 30ページ |
| 抽出テキスト | 80,000文字（UTF-8） |
| ファイル形式 | `application/pdf` のみ |

### セッション自動作成ルール

- `sessionId` を省略した場合、バックエンドが **新しいセッションを自動作成** して返す。
- 自動作成されたセッションの `title` は `"{ファイル名} の要約"` 形式で設定する（例: `"sample.pdf の要約"`）。
- `sessionId` を指定した場合は、既存セッションにドキュメントを追加する。指定IDが存在しない場合は 400 `BAD_REQUEST` を返す。

### リクエスト（multipart/form-data）

- `file` (required): PDFファイル（`application/pdf`）
- `sessionId` (optional): 既存セッションID（UUID）。省略時は新規セッション自動作成。

#### 例

```bash
curl -X POST /api/upload \
  -F "file=@sample.pdf" \
  -F "sessionId=6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78"
```

### 正常レスポンス例（200）

```json
{
  "uploadId": "1f8b3f26-4b08-4e9f-b7d2-f2f3c5c4e7a1",
  "sessionId": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
  "fileName": "sample.pdf",
  "fileSize": 248193,
  "status": "processing",
  "createdAt": "2026-05-07T12:34:56Z"
}
```

### 主要エラーレスポンス

- 400 `BAD_REQUEST`（file欠落、拡張子不正、sessionId不正）
- 413 `PAYLOAD_TOO_LARGE`（サイズ上限超過）
- 429 `RATE_LIMITED`（アップロード回数制限）
- 500 `INTERNAL_ERROR`（抽出処理/保存処理失敗）

#### 413 例

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "ファイルサイズが上限を超えています",
    "details": {
      "maxBytes": 10485760
    }
  }
}
```

### ストリーミング方式

- なし（同期レスポンス）

---

## 2) `POST /api/chat`

ユーザー入力とコンテキストをもとに回答を生成する。

### リクエスト（application/json）

```json
{
  "sessionId": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
  "message": "このPDFの要点を3つで教えて",
  "documentIds": ["2c7adf6b-3f9d-4b8f-a48e-9b7c7f6a0d12"],
  "stream": true
}
```

- `sessionId` (required): セッションID
- `message` (required): ユーザー質問
- `documentIds` (optional): 参照対象ドキュメントID配列
- `stream` (optional, default: `true`): ストリーミング有効化

### 正常レスポンス例（200, 非ストリーミング時）

```json
{
  "messageId": "5df2f5a7-3d4f-4db2-b0f7-bf5f1f1188e3",
  "sessionId": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
  "role": "assistant",
  "content": "要点は次の3つです...",
  "citations": [
    {
      "chunkId": "9a1cb8fd-95c6-42b0-a36f-f834348cb8f4",
      "pageStart": 2,
      "pageEnd": 2,
      "quote": "この資料の目的は..."
    }
  ],
  "usage": {
    "promptTokens": 1250,
    "completionTokens": 210,
    "totalTokens": 1460
  },
  "estimatedCostUsd": 0.000314,
  "createdAt": "2026-05-07T12:35:56Z"
}
```

### レスポンスフィールド定義（非ストリーミング時）

- `messageId` (required, string): 生成された assistant メッセージID
- `sessionId` (required, string): 対象セッションID
- `role` (required, string): 常に `assistant`
- `content` (required, string): 回答本文
- `citations` (required, array): 根拠配列（Phase 1採用方式）
  - `chunkId` (required, string): 根拠となるチャンクID（`{documentId}:{chunk_index}` / 旧データは `:summary`）
  - `pageStart` (required, integer): 開始ページ
  - `pageEnd` (required, integer): 終了ページ
  - `quote` (required, string): 根拠抜粋テキスト
- `usage` (optional): トークン使用量
  - `promptTokens` (required, integer)
  - `completionTokens` (required, integer)
  - `totalTokens` (required, integer)
- `estimatedCostUsd` (optional, number): `usage` と `model` から計算した概算USD
- `createdAt` (required, string): 生成時刻（ISO 8601）

- `citations` の `pageStart` / `pageEnd` は `document_chunks.page_start` / `page_end` を返す。
- 旧データなどページ情報が未保存のチャンクは `pageStart=1` / `pageEnd=1` にフォールバックする。

### 主要エラーレスポンス

- 400 `BAD_REQUEST`（message空、sessionId不正）
- 413 `PAYLOAD_TOO_LARGE`（入力文字数/トークン上限超過）
- 429 `RATE_LIMITED`（モデル呼び出し制限）
- 500 `INTERNAL_ERROR`（LLM応答失敗、DB保存失敗）

### ストリーミング方式

- **SSE（Server-Sent Events）**
- Header: `Content-Type: text/event-stream`

#### イベントフォーマット

- `event: start` : 生成開始
- `event: token` : 部分テキスト
- `event: meta` : 使用量や参照情報
- `event: error` : 途中エラー
- `event: done` : 生成完了

#### 例

```text
event: start
data: {"messageId":"5df2f5a7-3d4f-4db2-b0f7-bf5f1f1188e3"}

event: token
data: {"delta":"要点は"}

event: token
data: {"delta":"次の3つです"}

event: meta
data: {"usage":{"promptTokens":1250,"completionTokens":210,"totalTokens":1460}}

event: done
data: {"finishReason":"stop"}
```

---

## 3) `GET /api/sessions`

セッション一覧を取得する。

### リクエスト（query）

- `limit` (optional, default: 20, max: 100)
- `cursor` (optional): ページングカーソル

#### 例

`GET /api/sessions?limit=20&cursor=6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78`

### 正常レスポンス例（200）

```json
{
  "items": [
    {
      "id": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
      "title": "sample.pdf の要約",
      "lastMessageAt": "2026-05-07T12:36:56Z",
      "createdAt": "2026-05-07T12:00:00Z"
    }
  ],
  "nextCursor": "0f2e91c6-89d5-4b58-b3cd-4c2d5c01d2aa"
}
```

### 主要エラーレスポンス

- 400 `BAD_REQUEST`（limit不正、cursor不正）
- 413 `PAYLOAD_TOO_LARGE`（※通常は非該当。極端なquery長などを防御的に扱う）
- 429 `RATE_LIMITED`（一覧取得の呼び出し制限）
- 500 `INTERNAL_ERROR`（DB取得失敗）

### ストリーミング方式

- なし（同期レスポンス）

---

## 4) `GET /api/documents/[id]`

アップロード済みドキュメントの処理状態と詳細を取得する。
アップロード後に処理完了をポーリングするために使用する。

### リクエスト

- Path Parameter: `id`（UUID）

#### 例

`GET /api/documents/1f8b3f26-4b08-4e9f-b7d2-f2f3c5c4e7a1`

### 正常レスポンス例（200）

```json
{
  "document": {
    "id": "1f8b3f26-4b08-4e9f-b7d2-f2f3c5c4e7a1",
    "sessionId": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
    "fileName": "sample.pdf",
    "status": "ready",
    "qaEnabled": true,
    "summary": "この文書は○○について述べており...",
    "pageCount": 12,
    "charCount": 24800,
    "createdAt": "2026-05-07T12:34:56Z",
    "updatedAt": "2026-05-07T12:35:10Z"
  }
}
```

### `status` フィールド定義

| 値 | 意味 |
|---|---|
| `uploaded` | アップロード済み、処理待ち |
| `processing` | テキスト抽出・要約処理中 |
| `ready` | 処理完了、Q&A・要約利用可能 |
| `error` | 処理失敗 |

### `qaEnabled` フィールド定義

- `true`: ページ数・文字数がPhase 1上限内のためQ&A可能
- `false`: 上限超過のためQ&A無効（要約のみ可能）

### 主要エラーレスポンス

- 400 `BAD_REQUEST`（id形式不正）
- 404 `NOT_FOUND`（対象ドキュメントが存在しない）
- 500 `INTERNAL_ERROR`（DB取得失敗）

### ストリーミング方式

- なし（同期レスポンス）

---

## 5) `GET /api/sessions/[id]`

特定セッションの詳細（メタ情報 + ドキュメント一覧 + メッセージ履歴）を取得する。
チャット画面の初期表示でこのエンドポイントを呼び出し、`documents[].qaEnabled` によりQ&A入力の有効/無効を判断する。

### リクエスト

- Path Parameter: `id`（UUID）
- Query:
  - `limit` (optional, default: 50, max: 200)
  - `before` (optional): 指定メッセージIDより前を取得

#### 例

`GET /api/sessions/6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78?limit=50`

### 正常レスポンス例（200）

```json
{
  "session": {
    "id": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
    "title": "sample.pdf の要約",
    "createdAt": "2026-05-07T12:00:00Z"
  },
  "documents": [
    {
      "id": "1f8b3f26-4b08-4e9f-b7d2-f2f3c5c4e7a1",
      "fileName": "sample.pdf",
      "status": "ready",
      "qaEnabled": true,
      "summary": "この文書は○○について述べており...",
      "createdAt": "2026-05-07T12:34:56Z"
    }
  ],
  "messages": [
    {
      "id": "9ac7f0cf-6a44-4a0f-8e7c-565e6f2f41e9",
      "role": "user",
      "content": "このPDFの要点を3つで教えて",
      "createdAt": "2026-05-07T12:35:20Z"
    },
    {
      "id": "5df2f5a7-3d4f-4db2-b0f7-bf5f1f1188e3",
      "role": "assistant",
      "content": "要点は次の3つです...",
      "createdAt": "2026-05-07T12:35:56Z"
    }
  ],
  "hasMore": false
}
```

### 主要エラーレスポンス

- 400 `BAD_REQUEST`（id形式不正、limit不正）
- 413 `PAYLOAD_TOO_LARGE`（※通常は非該当。防御的な入力制限）
- 429 `RATE_LIMITED`（詳細取得の呼び出し制限）
- 500 `INTERNAL_ERROR`（DB取得失敗）

### ストリーミング方式

- なし（同期レスポンス）

### 非同期ジョブ仕様（Phase 1）

- `POST /api/upload` 登録直後にサーバー側で文書処理ジョブを起動する。
- `documents.status` は `processing -> ready` または `processing -> error` に遷移する。
- ジョブ完了時に `documents` へ以下を反映する。
  - `qaEnabled`
  - `summary`
  - `pageCount`
  - `charCount`
  - `error_message`

### 上限超過時の固定メッセージ

- ページ数上限（30）または文字数上限（80,000）を超える場合、Q&Aは無効化する。
- APIが返す固定文言は以下とする。

`このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。`

- 上限超過時でも要約は先頭5チャンクのみを対象に実行する。
