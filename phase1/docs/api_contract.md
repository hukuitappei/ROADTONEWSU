# API契約書（Phase 1）

本ドキュメントは、`/api/upload`, `/api/chat`, `/api/sessions`, `/api/sessions/[id]` の入力・出力契約を定義する。

---

## 共通仕様

- Base Path: `/api`
- Content-Type（JSON API）: `application/json`
- 文字コード: UTF-8
- 日時形式: ISO 8601（例: `2026-05-07T12:34:56Z`）

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

---

## 1) `POST /api/upload`

PDFを受け取り、テキスト抽出・要約ジョブを開始する。

### リクエスト（multipart/form-data）

- `file` (required): PDFファイル（`application/pdf`）
- `sessionId` (optional): 既存セッションID（UUID）

#### 例

```bash
curl -X POST /api/upload \
  -F "file=@sample.pdf" \
  -F "sessionId=6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78"
```

### 正常レスポンス例（200）

```json
{
  "uploadId": "up_01JX8Q9M6Q1R7K2",
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
  "documentIds": ["doc_01JX8QA2M4"],
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
  "messageId": "msg_01JX8QB1N2",
  "sessionId": "6a8d8f0d-9d74-4ef1-8f92-4d7e0b7f0f78",
  "role": "assistant",
  "content": "要点は次の3つです...",
  "citations": [
    { "documentId": "doc_01JX8QA2M4", "page": 2, "snippet": "..." }
  ],
  "usage": {
    "promptTokens": 1250,
    "completionTokens": 210,
    "totalTokens": 1460
  },
  "createdAt": "2026-05-07T12:35:56Z"
}
```

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
data: {"messageId":"msg_01JX8QB1N2"}

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

`GET /api/sessions?limit=20&cursor=ses_01JX8Q`

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
  "nextCursor": "ses_01JX8R"
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

## 4) `GET /api/sessions/[id]`

特定セッションの詳細（メタ情報 + メッセージ履歴）を取得する。

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
  "messages": [
    {
      "id": "msg_01JX8QB1N1",
      "role": "user",
      "content": "このPDFの要点を3つで教えて",
      "createdAt": "2026-05-07T12:35:20Z"
    },
    {
      "id": "msg_01JX8QB1N2",
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
