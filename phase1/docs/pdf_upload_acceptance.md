# Week 5-6 受け入れ基準: PDF アップロード〜要約生成

## 1. 目的とスコープ

本ドキュメントは、Week 5-6 で実装する **PDFアップロードから要約生成完了 (`ready`) まで** の受け入れ基準を定義する。  
対象は以下の機能とする。

- PDFファイルのアップロード
- Storageへの保存
- PDFテキスト抽出
- チャンク分割
- 要約生成
- 文書ステータス管理 (`uploaded` / `processing` / `ready` / `error`)

---

## 2. 正常系受け入れ基準

### 2.1 フロー定義

正常系は、以下の順序で処理されること。

1. ユーザーがPDFを選択し `/api/upload` へ送信する。
2. サーバーがファイルをStorageへ保存する。
3. 保存済みPDFからテキストを抽出する。
4. 抽出テキストをチャンク分割する。
5. チャンクをもとに要約を生成する。
6. ドキュメントレコードを `ready` に更新し、`summary` を保持する。

### 2.2 期待結果（受け入れ条件）

- `/api/upload` が `201 Created` を返し、`documentId` と初期 `status` を返却すること。
- アップロード後、`/api/documents/[id]` で状態遷移が観測できること。
  - 最低限: `uploaded`（または即時に `processing`）→ `processing` → `ready`
- `ready` 到達時、以下が取得できること。
  - `documentId`（一意な識別子）
  - `status: "ready"`
  - `summary`（空文字ではない）
- `ready` 到達時、ユーザーが再読込しても同じ `summary` を取得できること（永続化）。

### 2.3 非機能面（最低条件）

- 同一ユーザーの連続アップロードで、別々の `documentId` が発行されること。
- 1件の処理失敗が他ドキュメントの処理に波及しないこと。

---

## 3. 異常系受け入れ基準

### 3.1 非PDFファイル

**条件:** MIME type または拡張子がPDF以外  
**期待結果:**

- `/api/upload` は `400 Bad Request` を返す。
- エラーコードは `UNSUPPORTED_FILE_TYPE`。
- Storage保存・抽出処理は実行されない。

### 3.2 空ファイル（0 bytes）

**条件:** サイズ 0 byte のPDF  
**期待結果:**

- `/api/upload` は `400 Bad Request` を返す。
- エラーコードは `EMPTY_FILE`。
- `documentId` は発行しない。

### 3.3 抽出失敗

**条件:** PDF破損などによりテキスト抽出不可  
**期待結果:**

- `documentId` は発行済みであること（アップロード成功後に失敗）。
- `/api/documents/[id]` の `status` は `error` になること。
- `errorCode` は `EXTRACTION_FAILED`。
- `summary` は `null` のままであること。

### 3.4 Storage保存失敗

**条件:** Storage APIエラー、権限エラー、タイムアウト等  
**期待結果:**

- `/api/upload` は `500 Internal Server Error` を返す。
- エラーコードは `STORAGE_UPLOAD_FAILED`。
- DBにドキュメントレコードを残す場合は `status: "error"` とし、孤立データを作らないこと。

### 3.5 上限超過（ページ数 / 文字数）

**条件:** システム上限を超えるPDF  
**期待結果:**

- 上限チェックで検知し、処理を中断する。
- 返却または状態更新で、超過種別を識別できること。
  - `PAGE_LIMIT_EXCEEDED`
  - `CHAR_LIMIT_EXCEEDED`
- UIに上限超過の固定文言が表示されること（後述 5. UI文言）。

---

## 4. API入出力サンプル

## 4.1 `POST /api/upload`

### Request (multipart/form-data)

- `file`: PDFバイナリ

### Success Response (`201 Created`)

```json
{
  "documentId": "doc_01JXYZABCDEF1234567890",
  "status": "processing"
}
```

### Error Response 例 (`400 Bad Request`: 非PDF)

```json
{
  "error": {
    "code": "UNSUPPORTED_FILE_TYPE",
    "message": "PDFファイルのみアップロード可能です。"
  }
}
```

### Error Response 例 (`500 Internal Server Error`: Storage失敗)

```json
{
  "error": {
    "code": "STORAGE_UPLOAD_FAILED",
    "message": "ファイル保存に失敗しました。時間をおいて再試行してください。"
  }
}
```

## 4.2 `GET /api/documents/[id]`

### Success Response (`200 OK`: processing)

```json
{
  "documentId": "doc_01JXYZABCDEF1234567890",
  "status": "processing",
  "summary": null,
  "errorCode": null
}
```

### Success Response (`200 OK`: ready)

```json
{
  "documentId": "doc_01JXYZABCDEF1234567890",
  "status": "ready",
  "summary": "この文書は〇〇について説明しており、主要な論点は...",
  "errorCode": null
}
```

### Success Response (`200 OK`: error)

```json
{
  "documentId": "doc_01JXYZABCDEF1234567890",
  "status": "error",
  "summary": null,
  "errorCode": "EXTRACTION_FAILED"
}
```

---

## 5. UI表示文言（固定）

以下の文言は **受け入れ基準上の固定文言** とし、差分による判定漏れを防ぐ。

### 5.1 ローディング

- `アップロード中です...`
- `PDFを解析しています...`
- `要約を生成しています...`

### 5.2 一般エラー

- `アップロードに失敗しました。もう一度お試しください。`
- `PDFの解析に失敗しました。別のファイルをお試しください。`

### 5.3 上限超過

- `ページ数の上限を超えています。より短いPDFをアップロードしてください。`
- `文字数の上限を超えています。対象範囲を絞って再試行してください。`

---

## 6. Week 7-8（Q&A連携）への引き継ぎ方針

Q&A機能は、Week 5-6 で確定した以下の項目を前提に利用する。

- `documentId`
  - Q&A APIの入力キーとして必須利用する。
  - クライアントは選択中ドキュメントの `documentId` を保持する。
- `status`
  - `ready` 以外ではQ&A実行不可とする。
  - `processing` / `error` 時はQ&A入力UIを非活性化する。
- `summary`
  - 初回表示やドキュメント確認のプレビューとして利用する。
  - Q&Aプロンプトに含める場合は、要約全文ではなく必要部分のみ参照する（トークン最適化）。

### 6.1 連携時の判定ルール

- `status === "ready"` かつ `summary != null` のときのみ、Q&A開始ボタンを有効化する。
- `status === "error"` の場合は、再アップロード導線を表示する。
- `documentId` が欠損しているデータはQ&A対象外とする。

---

## 7. 受け入れ完了条件（DoD）

- 正常系・異常系の全ケースに対して、APIレスポンスまたは状態遷移が本書どおりである。
- UI文言が固定文言と一致する。
- `documentId` / `status` / `summary` の3項目が Week 7-8 のQ&A連携要件を満たす。
