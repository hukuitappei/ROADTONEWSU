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
