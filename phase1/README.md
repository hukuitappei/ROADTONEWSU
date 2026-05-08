# Phase 1：生成AIアプリケーションの基礎

## 概要

LLM APIを使って、実際に使えるPDF要約・質問応答アプリを1つ完成させる。

## 現在の進捗

**85%（Week 9〜10 の品質改善まで完了、Week 11〜12は未着手）**

---

## 実装済み

### API・バックエンド（Week 3〜4 完了）

| ファイル | 内容 |
|---|---|
| `src/types/api.ts` | API型定義（ChatRequest / ChatResponse / DocumentDetailResponse / SessionDetailResponse 等） |
| `src/lib/http.ts` | 共通エラーレスポンスヘルパー（`jsonError` / `mapProviderErrorToApiError`） |
| `src/lib/llm.ts` | OpenAI互換LLMクライアント（非ストリーミング・SSEストリーミング・タイムアウト・リトライ） |
| `src/lib/supabase.ts` | Supabaseクライアント初期化 |
| `src/lib/repository.ts` | Supabase CRUD（sessions / messages / documents） |
| `src/lib/auth.ts` | x-user-id ヘッダー検証（Phase 1 暫定擬似認証） |
| `src/lib/rate-limit.ts` | Supabase RPC ベースの分散レート制限（30req/min・3同時） |
| `src/app/api/chat/route.ts` | チャットAPI（SSEストリーミング・非ストリーミング・metaイベント対応） |
| `src/app/api/upload/route.ts` | PDFアップロードAPI（バリデーション・Storage保存・セッション自動作成） |
| `src/app/api/sessions/route.ts` | セッション一覧API（カーソルページング） |
| `src/app/api/sessions/[id]/route.ts` | セッション詳細API（メッセージ履歴・limit/beforeページング） |
| `src/app/api/documents/[id]/route.ts` | ドキュメント詳細API（status / qaEnabled / summary / pageCount 等） |

### PDF処理・ストレージ（Week 5〜6 ほぼ完了）

| ファイル | 内容 |
|---|---|
| `src/lib/storage.ts` | Supabase Storage への PDF 保存・削除・エラー分類 |
| `src/lib/pdf.ts` | pdf-parse によるテキスト抽出・ページ数取得・ページ境界オフセット生成 |
| `src/lib/chunking.ts` | テキストチャンク分割（3,000文字/チャンク）＋チャンクのページ範囲（startPage/endPage）付与 |
| `src/lib/summary.ts` | ドキュメント処理ジョブ（抽出→チャンク分割→要約保存） |
| `src/app/upload/page.tsx` | PDFアップロードUI（ステータスポーリング・処理中表示） |

### インフラ・設定

| ファイル | 内容 |
|---|---|
| `supabase/migrations/20260507_001_init_phase1.sql` | DBスキーマ（sessions / messages / documents / document_chunks） |
| `supabase/migrations/20260508_002_auth_and_rate_limit.sql` | user_id カラム・api_rate_limits テーブル・RPC 関数 |
| `package.json` / `tsconfig.json` / `next.config.ts` | Next.js 15 プロジェクト設定 |
| `.env.example` | 環境変数テンプレート |
| `tests/api_contract_smoke.sh` | API契約スモークチェックスクリプト |
| `docs/api_contract.md` | API契約書 |

### 未実装 / 今後の課題

- Vercel デプロイ — Week 11〜12
- 回答品質の手動評価・プロンプト改善（Week 9〜10）
- 認証を `x-user-id` から Supabase Auth へ移行（Phase 2）

---

## ローカル実行手順

```bash
cd phase1
npm install
cp .env.example .env.local
# .env.local に OPENAI_API_KEY 等を設定
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

---

## Supabaseマイグレーション

`phase1/supabase/migrations/20260507_001_init_phase1.sql` を Supabase SQL Editor または CLI で適用してください。

---

## テスト

```bash
bash phase1/tests/api_contract_smoke.sh
```

API契約の主要要素（型定義・エンドポイント・エラーコード）の存在をチェックします。

---

## 運用制約

### PDF入力制約

- **ファイルサイズ上限**：1ファイルあたり **10MB**（10,485,760バイト）
- **ページ数上限**：1ファイルあたり **30ページ**
- **対応形式**：テキスト抽出可能な通常PDF（デジタルPDF）のみ対応
- **非対応形式**：画像PDF（スキャンPDF）・パスワード保護PDF・破損PDFは対象外



### コスト見積もり運用制約（Phase 1）

- `src/lib/pricing.ts` の単価テーブルは **1,000トークンあたり（inputPer1k / outputPer1k）USD** で管理する。
- 未定義モデルの単価は **0として扱わず**、`estimateCost` は `unknown_model_pricing:<model>` エラーを送出する。
- APIレスポンスでは既存クライアント互換のため、`usage` / `estimatedCostUsd` は optional で段階導入する。

### 認証に関する重要な注意（Phase 1）

- 現在の `x-user-id` ヘッダーは **暫定的な擬似認証** であり、真正な本人確認を提供しません。
- セキュリティ要件上、この値は「認可前提の信頼済み ID」ではなく **未検証入力** として扱ってください。
- **Phase 2 で Supabase Auth（JWT 検証を含む）へ置換** する前提です。
- 実装上の追跡用識別子: `TODO(phase2-auth): replace x-user-id with Supabase Auth JWT verification`

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
