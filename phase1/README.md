# Phase 1：PDF要約・質問応答アプリ

## 概要

Next.js + Supabase + OpenAI API を使った、PDFアップロード/要約/質問応答アプリです。

- PDFをアップロードすると、テキスト抽出・チャンク分割・要約生成を実行
- チャットで質問すると、対象PDFの内容に基づく回答を返却
- セッション/メッセージ/文書状態をSupabaseに保存

## 進捗（Week 11〜12反映）

- Phase 1 全体進捗: **95%**
- Week 9〜10（品質改善）: 完了
- Week 11〜12:
  - ✅ README最終化（本ドキュメント）
  - ⏳ Vercel公開/本番Supabase設定は運用作業として残タスク
  - ✅ Phase 2課題整理（`docs/phase2_handoff.md`）

## 主な機能

1. **PDFアップロード**（最大10MB）
2. **抽出テキストのチャンク分割**
3. **要約生成**
4. **Q&A（文書コンテキスト付き）**
5. **引用情報（citations）付き応答**
6. **履歴表示（セッション詳細API）**
7. **レート制限/タイムアウト/リトライ**

## 画面（スクリーンショットの撮り方）

本リポジトリでは画像ファイルを同梱していません。デモ用に追加する場合は以下の手順で取得してください。

1. `npm run dev` でローカル起動
2. `http://localhost:3000/upload` を開く
3. 以下の3画面をキャプチャ
   - アップロード前
   - 処理中（ステータス表示）
   - Q&A結果（citation表示）
4. `docs/screenshots/` 配下に保存し、READMEへ画像リンクを追記

## セットアップ

```bash
cd phase1
npm install
cp .env.example .env.local
```

`.env.local` の必須項目:

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 実行

```bash
cd phase1
npm run dev
```

アプリ: `http://localhost:3000/upload`

## テスト/チェック

```bash
cd phase1
npm run test
bash tests/api_contract_smoke.sh
```

## APIエンドポイント（主要）

- `POST /api/upload` PDFアップロード
- `POST /api/chat` 質問応答（stream/non-stream）
- `GET /api/sessions` セッション一覧
- `GET /api/sessions/:id` セッション詳細
- `GET /api/documents/:id` 文書詳細

詳細は `docs/api_contract.md` を参照してください。

## 既知の制約（Phase 1）

- Q&A対象PDF上限:
  - 30ページ以内
  - 抽出文字数80,000文字以内
- 画像PDF/OCRは非対応
- 認証は暫定の `x-user-id` ヘッダー方式（Phase 2でSupabase Authへ移行）
- Q&Aコンテキスト投入は先頭Nチャンク方式（検索ベースRAGはPhase 2）

## デプロイ手順（Week 11〜12作業項目）

1. Vercelに `phase1` をプロジェクトとして接続
2. 環境変数（OpenAI/Supabase）を本番値で設定
3. Supabase本番DBへ migration を適用
4. デモシナリオ（アップロード→要約→Q&A）を実施
5. 動作確認後、デモURLをこのREADMEへ追記

## Phase 2への引き継ぎ

Phase 2に向けた優先課題は次のドキュメントに整理しています。

- `docs/phase2_handoff.md`

## 関連ドキュメント

- `IMPLEMENTATION_PLAN.md`
- `docs/api_contract.md`
- `docs/qa_evaluation_template.md`
- `docs/qa_evaluation_log.md`
