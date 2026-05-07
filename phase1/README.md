# Phase 1：生成AIアプリケーションの基礎

## 概要

LLM APIを使って、実際に使えるPDF要約・質問応答アプリを1つ完成させる。

## 現在の進捗

**25%（Week 3〜4 実装着手済み）**

---

## このリポジトリで実装済み（Week 3〜4 先行）

- API契約に沿った型定義を追加（`src/types/api.ts`）
- 共通エラーレスポンス/ヘルパーを追加（`src/lib/http.ts`）
- LLMサービス層の最小実装を追加（`src/lib/llm.ts`）
- `/api/chat` の最小ルート実装を追加（`src/app/api/chat/route.ts`）
- セッション一覧・詳細、アップロード雛形APIを追加
- ローカル起動手順（Next.js）を追記

---

## ローカル実行手順

```bash
cd phase1
npm install
cp .env.example .env.local
npm run dev
```

---

## 環境変数

`.env.local` に以下を設定:

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Supabaseマイグレーション（追加）

- `phase1/supabase/migrations/20260507_001_init_phase1.sql` を追加しました。
- 適用時は Supabase SQL Editor か CLI で実行してください。

## テスト（現時点）

- `phase1/tests/api_contract_smoke.sh` でAPI契約の主要要素をスモークチェックできます。
---

## 運用制約

### PDF入力制約

- **ファイルサイズ上限**：1ファイルあたり **10MB**（10,485,760バイト）
- **ページ数上限**：1ファイルあたり **30ページ**
- **対応形式**：テキスト抽出可能な通常PDF（デジタルPDF）のみ対応
- **非対応形式**：画像PDF（スキャンPDF）・パスワード保護PDF・破損PDFは対象外

### API運用制約

- **タイムアウト**：LLM API呼び出しは **30秒** でタイムアウト。PDF要約のバッチ処理は **60秒** を上限とする
- **リトライ方針**：ネットワークエラー・`429`・`5xx` のみ、指数バックオフ（1秒→2秒→4秒）で **最大3回** リトライ
- **レート制限**：1ユーザーあたり **1分間に30リクエスト**、同時実行は **3リクエスト** まで

### ログ保存ポリシー

- **機密情報の扱い**：APIキー・認証情報はログ出力禁止
- **個人情報の扱い**：氏名・メールアドレス等はマスキングして保存し、生データは保持しない
- **保持期間**：アプリケーションログは **30日間**、障害調査用の詳細ログは **7日間** で削除

### エラー時ユーザー表示文言ポリシー

- ユーザー向け文言は「何が起きたか」「再試行可否」「次の行動」を必ず含める
- 内部情報（スタックトレース・SQL・APIレスポンス生文）は表示しない
- 文言は責めないトーンで統一する
- 例：
  - 「PDFの解析に失敗しました。画像PDFの可能性があります。テキストを含むPDFで再度お試しください。」
  - 「サーバーが混み合っています。数秒待ってから再試行してください。」
