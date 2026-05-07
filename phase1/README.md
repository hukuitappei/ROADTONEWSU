# Phase 1：生成AIアプリケーションの基礎

## 概要

LLM APIを使って、実際に使えるPDF要約・質問応答アプリを1つ完成させる。

---

## 作るアプリ

**PDF要約・質問応答アプリ**

PDFをアップロードして、内容の要約と質問応答ができる生成AIアプリ。

---

## Phase 1の制約

| 項目 | 制約内容 |
|---|---|
| 質問応答方式 | 先頭Nチャンク投入による簡易Q&A（RAG・ベクトル検索はPhase 2） |
| PDFサイズ | ファイルサイズ10MB以下、30ページ以内、抽出テキスト80,000文字以内 |
| LLMプロバイダ | OpenAI 1社固定（互換API対応はPhase 2以降） |
| 認証・認可 | 実装しない（URLを知っていれば誰でもアクセス可能） |
| 対象PDF | テキスト抽出可能なPDFのみ（スキャン画像・OCR不要PDFは対象外） |

---

## 技術スタック

| 領域 | 技術 | 理由 |
|---|---|---|
| フロントエンド | Next.js (App Router) + TypeScript | バックエンドと統合しやすく、Vercelデプロイが簡単 |
| バックエンド | Next.js API Routes | フロントと同一リポジトリで管理できる |
| スタイリング | Tailwind CSS | 素早くUIを組める |
| LLM | OpenAI API（公式サポート） | Phase 1は1プロバイダ固定にして実装と検証を単純化する |
| DB・ストレージ | Supabase | PostgreSQL + ファイルストレージ + 認証が一体 |
| デプロイ | Vercel + Supabase | 無料枠で公開可能 |

### LLM切替の設計方針

Phase 1の**公式サポート対象はOpenAIの1プロバイダに固定**する。
まずはOpenAI前提でPDF要約・Q&Aの品質、エラーハンドリング、運用手順を安定化させる。

`openai` npm パッケージの `baseURL` 切替機能は将来の拡張用として残せるが、
**OpenAI互換APIはPhase 1では非公式（自己責任）扱い**とし、動作保証対象に含めない。

```
OPENAI_API_KEY=sk-...        → OpenAI (GPT-4o等)
OPENAI_BASE_URL=https://api.openai.com/v1
```

> 補足: `OPENAI_BASE_URL` をOpenAI以外へ向ける構成（例: OllamaなどのOpenAI互換API）は、
> エンドポイント仕様・パラメータ・レスポンス形式の差分で不整合が起きる可能性があるため、
> Phase 1の公式サポート対象外。

---

## ディレクトリ構成（予定）

```
phase1/
├── README.md              ← このファイル
├── IMPLEMENTATION_PLAN.md ← 週別実装計画
├── app/                   ← Next.js Appディレクトリ（実装時に作成）
└── docs/
    ├── api_contract.md    ← APIエンドポイント仕様
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
