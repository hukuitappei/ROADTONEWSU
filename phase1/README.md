# Phase 1：生成AIアプリケーションの基礎

## 概要

LLM APIを使って、実際に使えるPDF要約・質問応答アプリを1つ完成させる。

---

## 作るアプリ

**PDF要約・質問応答アプリ**

PDFをアップロードして、内容の要約と質問応答ができる生成AIアプリ。

---

## 技術スタック

| 領域 | 技術 | 理由 |
|---|---|---|
| フロントエンド | Next.js (App Router) + TypeScript | バックエンドと統合しやすく、Vercelデプロイが簡単 |
| バックエンド | Next.js API Routes | フロントと同一リポジトリで管理できる |
| スタイリング | Tailwind CSS | 素早くUIを組める |
| LLM | OpenAI SDK互換（切替可） | OpenAI / Claude / Ollama を環境変数で切り替え可能 |
| DB・ストレージ | Supabase | PostgreSQL + ファイルストレージ + 認証が一体 |
| デプロイ | Vercel + Supabase | 無料枠で公開可能 |

### LLM切替の設計方針

`openai` npm パッケージを使い、`baseURL` を環境変数で切り替えることで複数LLMに対応する。

```
OPENAI_API_KEY=sk-...        → OpenAI (GPT-4o等)
OPENAI_BASE_URL=http://localhost:11434/v1  → Ollama（ローカルLLM）
OPENAI_BASE_URL=https://api.anthropic.com/v1  → Claude互換エンドポイント
```

---

## ディレクトリ構成（予定）

```
phase1/
├── README.md              ← このファイル
├── IMPLEMENTATION_PLAN.md ← 週別実装計画
├── app/                   ← Next.js Appディレクトリ（実装時に作成）
└── docs/
    └── screen_design.md   ← 画面ラフ・設計メモ
```

---

## 完了条件

- [ ] PDFをアップロードできる
- [ ] PDFの要約が生成される
- [ ] PDF内容に関する質問ができる
- [ ] 回答がPDF内容に基づいている
- [ ] 最低限の履歴が保存される
- [ ] 他人にデモできる
- [ ] READMEがある

## 現在の進捗

**0%**
