# Phase 1 実装計画書

## アプリ名
PDF要約・質問応答アプリ

## 期間
3か月（Week 1〜12）

---

## Week 1〜2：設計と環境構築

### 目標
ローカルで「テキスト入力→AI回答」が動く状態にする。

### タスク

| # | タスク | 完了 |
|---|---|---|
| 1 | 技術スタック確定（Next.js + Supabase + OpenAI API） | ✅ |
| 2 | GitHubリポジトリ作成・初期コミット | ✅ |
| 3 | Next.js プロジェクト初期化（TypeScript + Tailwind + App Router） | [ ] |
| 4 | 環境変数ファイル（.env.local）の設定 | ✅ |
| 5 | LLM APIの疎通確認（Hello World相当） | [ ] |
| 6 | Supabaseプロジェクト作成・接続確認 | [ ] |
| 7 | 画面ラフをdocs/screen_design.mdに書く | ✅ |

### 環境変数テンプレート（.env.local）

```env
# LLM設定（Phase 1公式サポート: OpenAI）
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### OpenAI互換APIを試す場合（公式サポート対象外）

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3
```

---

## Week 3〜4：基本AI機能

### 目標
テキスト入力→AI回答の基本フローを実装し、DBに保存できる状態にする。

### タスク

| # | タスク | 完了 |
|---|---|---|
| 1 | API契約書作成（`docs/api_contract.md`） | ✅ |
| 2 | API契約に基づく実装（`/api/upload` `/api/chat` `/api/sessions` `/api/sessions/[id]`） | ✅ |
| 3 | `/api/chat` エンドポイント作成 | ✅ |
| 4 | LLMサービス層（`src/lib/llm.ts`）作成 | ✅ |
| 5 | チャットUIの基本実装 | [ ] |
| 6 | Streaming対応（逐次表示） | ✅ |
| 7 | Supabaseのテーブル設計・マイグレーション | ✅ |
| 8 | 入力・出力履歴のDB保存（Supabase永続化） | [ ] |
| 9 | エラー処理（API失敗・空入力・タイムアウト） | ✅ |

### Supabaseテーブル設計

- **ID型整合性ルール**: テーブル定義（`sessions.id` / `messages.id` / `documents.id` / `document_chunks.id` など）と、APIエンドポイントの入力で受け取るID（`sessionId` / `documentIds` / `cursor` 等）は、すべて **UUID** 型として一致させる。

```sql
-- セッション
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text
);

-- 会話履歴
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  role text check (role in ('user', 'assistant')),
  content text,
  tokens_used int,
  -- 回答根拠（どのチャンクを参照したか）
  -- Phase 1採用方式: citations jsonb を正とする
  -- DB保存形式（snake_case）: [{chunk_id, page_start, page_end, quote}]
  -- APIレスポンス形式（camelCase）: [{chunkId, pageStart, pageEnd, quote}]
  -- 変換責務: API層（src/lib/citations.ts 等）がDB→APIへ変換する
  citations jsonb,
  created_at timestamptz default now()
);

-- 文書メタ情報・抽出結果
create table documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  extracted_text text,
  summary text,
  page_count int,
  char_count int,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 文書チャンク（RAG/根拠表示の最小単位）
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_start int,
  page_end int,
  created_at timestamptz default now(),
  unique (document_id, chunk_index)
);

-- documents.updated_at 自動更新トリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger documents_updated_at
  before update on documents
  for each row execute function update_updated_at();
```

### 根拠表示UIとのフィールド対応

- チャット画面のAI回答テキスト本体は `messages.content` を表示。
- 「根拠（出典）」表示は **`messages.citations` をパースする方式に固定**。
  - `page_start`〜`page_end` と `quote` を表示。
- PDF名や文書単位の情報は `documents.filename` / `documents.summary` を利用。

---

## Week 5〜6：PDF対応

### 目標
PDFをアップロードし、テキスト抽出・要約生成ができる状態にする。

### タスク

| # | タスク | 完了 |
|---|---|---|
| 1 | PDFアップロードUI実装 | [x] |
| 2 | PDF→テキスト抽出（`pdf-parse`または`pdfjs-dist`） | [x] |
| 3 | 長文チャンク分割処理 | [x] |
| 4 | PDF全体の要約生成 | [x] |
| 5 | Supabaseストレージへのファイル保存 | [x] |
| 6 | 処理中ローディング表示 | [x] |

### PDF処理の方針

```
PDF入力
  ↓
テキスト抽出（pdf-parse）
  ↓
チャンク分割（最大3000トークン/チャンク、200トークンオーバーラップ）
  ↓
要約生成（各チャンク→部分要約→統合要約）
  ↓
DBへ保存（documents テーブル）
```

---

### Week 5〜6 完了メモ（2026-05-08時点）

- 実装済み項目はチェックを `[x]` に更新。
- 残件の絞り込み結果（Week 7〜8着手前提）:
  1. チャットAPIで `documentIds` を使った PDF本文コンテキスト注入（現状は未使用）
  2. citations（出典）生成と `messages.citations` 保存
  3. 回答不可制御メッセージの厳密化（根拠不足/関連箇所なし/上限超過）
  4. 質問履歴のUX改善（表示/再送/フィルタ）
  5. Q&AセクションUI改善（状態表示・導線）

---

## Week 7〜8：質問応答機能

### 目標
アップロードしたPDFの内容に基づいて質問応答ができる状態にする。

### タスク

| # | タスク | 完了 |
|---|---|---|
| 1 | PDFテキストをコンテキストとしてLLMへ渡す | [x] |
| 2 | 回答に根拠（出典箇所）を含める | [x] |
| 3 | 回答できない場合の制御 | [x] |
| 4 | 質問履歴の保存 | [x] |
| 5 | UIのQ&Aセクション改善 | [x] |

### Phase 1におけるPDFサイズ上限

- **ページ数上限**: 30ページまで
- **抽出テキスト上限**: 80,000文字まで（UTF-8文字数）
- 上限を超えるPDFは、Phase 1では「全文Q&A対象外」として扱う
- **Q&A無効化タイミング**: アップロード完了時点でページ数/文字数上限を判定し、超過時はその時点でQ&Aを無効化する
- **要約の実行範囲**: 上限超過時でも要約は継続し、**先頭Nチャンクまで**を対象に実行する（Phase 1の既定値は先頭5チャンク）
- **上限超過時の画面表示文言（固定）**: `このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。`

### `PDFテキストをコンテキストとしてLLMへ渡す` 実装方針（Phase 1）

1. **コンテキスト投入方式**
   - Phase 1では **「先頭Nチャンク投入」方式** を採用する
   - 理由: 実装が単純で、まずは安定動作を優先できるため
   - 具体値:
     - チャンクサイズ: 最大3,000トークン
     - オーバーラップ: 200トークン
     - Q&A時に投入する上限: **先頭5チャンク**（最大約15,000トークン相当）
   - 補足:
     - 「全文投入」はトークン超過リスクが高いためPhase 1では非採用
     - 「キーワード抽出後チャンク選別」は検索拡張に近いためPhase 2で実装

2. **上限超過時のフォールバック**
   - PDFがページ数上限または文字数上限を超えた場合:
     - UIに **「このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。」**（固定文言）と表示
     - Q&A入力は無効化（または送信時に同メッセージを返す）
     - 要約機能は可能な範囲（先頭Nチャンク）で継続

3. **回答不可判定の条件**
   - 以下のいずれかを満たす場合、回答不可として固定メッセージを返す:
     - **根拠不足**: コンテキスト内に断定可能な記述がなく、推測が必要
     - **関連箇所なし**: 質問に対応する記述が投入チャンク内に見当たらない
     - **上限超過**: PDF自体がPhase 1の上限超過でQ&A対象外
   - 返却メッセージ例:
     - `PDFの内容からは判断できません（根拠不足または関連箇所なし）。`
     - `このPDFはPhase 1の上限を超えているため、Q&Aに対応していません。`

### 質問応答のプロンプト設計

```
system:
  あなたはPDF内容に基づいて回答するアシスタントです。
  必ず以下のルールに従ってください：
  1. PDF内容に記載されていることのみ回答する
  2. 回答の根拠となる箇所を引用する
  3. 根拠が見当たらない場合は「PDFの内容からは判断できません」と答える

user:
  ## PDF内容
  {extracted_text}

  ## 質問
  {user_question}
```

---

### Week 7〜8 完了メモ（2026-05-08時点）

- `src/app/api/chat/route.ts` で `documentIds` を受け取り、対象ドキュメント（ready + qa_enabled）をコンテキストとしてプロンプトへ注入する処理を実装済み。
- 回答レスポンス/履歴保存時に `citations` を付与する処理を実装済み。
- Q&A対象外（選択ドキュメントが上限超過・未準備など）時は固定メッセージを返す制御を実装済み。
- ユーザー/アシスタント双方のメッセージを `messages` に保存し、`/api/sessions/[id]` から質問履歴を表示するUIを実装済み。
- `src/app/upload/page.tsx` に以下を実装済み:
  - 文書状態ポーリング
  - Q&A上限超過メッセージ表示
  - Q&Aフォームの有効/無効制御
  - 質問履歴表示

### Week 7〜8 追加実装メモ（2026-05-08時点）

- `src/lib/summary.ts` でアップロード処理時に全チャンクを `document_chunks` テーブルへ保存するよう変更。
- `src/lib/repository.ts` に `saveDocumentChunks` / `getDocumentChunks` を追加。
- `buildContext`（`src/app/api/chat/route.ts`）を summary ベースから **先頭5チャンクの実本文** ベースに切り替え。citations の `chunkId` も `${docId}:${chunk_index}` 形式に精度向上。
- `document_chunks` が空の既存ドキュメントは `summary` フォールバックで引き続き動作する。
- `src/types/api.ts` に `DbDocumentChunkRow` 型を追加。

#### 残課題（Week 9以降へ持ち越し）

1. Q&A UI の UX 拡張（再送/フィルタ/ハイライト）は未実装。
2. citations の `page_start` / `page_end` はページ単位の計算が未実装（現在は `null` 保存 → 表示上は `1` 固定）。

---

## Week 9〜10：品質改善

### 目標
実際のPDFで安定動作し、コスト・速度が把握できる状態にする。

### タスク

| # | タスク | 完了 |
|---|---|---|
| 1 | テスト用PDF複数枚で動作確認 | [ ] |
| 2 | 回答品質の手動評価（5件以上） | [ ] |
| 3 | プロンプト改善 | [ ] |
| 4 | トークン数・概算コストの表示 | [ ] |
| 5 | エラーケースの潰し込み | [ ] |
| 6 | レスポンス速度の確認と改善 | [ ] |
| 7 | PDFサイズ上限・ページ数上限・非対応形式（画像PDF等）の検証テスト | [ ] |
| 8 | APIタイムアウト・リトライ・レート制限の負荷/異常系テスト | [ ] |
| 9 | ログ保存ポリシー（PIIマスキング・保持期間）の運用検証 | [ ] |
| 10 | エラー時ユーザー表示文言ポリシーのUI/UXレビューと改善 | [ ] |

### コスト計算の実装方針

- APIレスポンスの `usage` から `prompt_tokens` / `completion_tokens` を取得する。
- 単価はコード内に直書きせず、`src/lib/pricing.ts`（想定）に集約した設定テーブルから参照する。
- `pricing.ts` は `model` ごとに `input` / `output` の単価（例: USD / 1K tokens）を管理し、コスト計算関数はモデル名を引数にして参照する。
- 未定義モデルを受け取った場合のフォールバック（エラー・既定モデル・0円扱いなど）を方針として明示する。

```typescript
// src/lib/pricing.ts（責務イメージ）
export const MODEL_PRICING_TABLE = {
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  // ...modelごとの単価
} as const;

export function estimateCost({ model, promptTokens, completionTokens }: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const unit = MODEL_PRICING_TABLE[model as keyof typeof MODEL_PRICING_TABLE];
  if (!unit) throw new Error(`Pricing not found for model: ${model}`);

  const inputCost = (promptTokens / 1000) * unit.inputPer1k;
  const outputCost = (completionTokens / 1000) * unit.outputPer1k;
  return inputCost + outputCost;
}
```

---

## Week 11〜12：公開・振り返り

### 目標
他人にデモできる状態にして公開する。

### タスク

| # | タスク | 完了 |
|---|---|---|
| 1 | README.md（使い方・スクショ付き）作成 | [ ] |
| 2 | Vercelへデプロイ | [ ] |
| 3 | Supabaseの本番環境設定 | [ ] |
| 4 | デモURL確認・動作テスト | [ ] |
| 5 | Phase 2に向けた課題・改善点のまとめ | [ ] |

---

## 学習チェックリスト

Phase 1で身につけるべきスキル：

- ✅ LLM APIの基本呼び出し（テキスト生成）
- ✅ Streaming（逐次出力）
- [ ] Structured Output（JSON出力）
- ✅ system / user / assistant ロールの設計
- [ ] PDFのテキスト抽出
- [ ] Next.js App Router の基本構成
- ✅ API Routes の作り方
- [ ] Supabase の基本CRUD
- ✅ 環境変数の管理
- ✅ エラー処理パターン
- [ ] トークンとコストの計算方法

---

## リスクと対策

| リスク | 対策 |
|---|---|
| API料金が予想外に高い | GPT-4o-miniなど安価なモデルから始める / Ollamaで無料検証 |
| PDFの文字化け・抽出失敗 | OCRが必要な画像PDFは対象外と明示する |
| 長文PDFでトークン超過 | チャンク分割を必須設計にする |
| Supabase無料枠超過 | 開発中はストレージ保存を最小限にする |

---

## 参考リソース

- [Next.js公式ドキュメント](https://nextjs.org/docs)
- [OpenAI APIリファレンス](https://platform.openai.com/docs/api-reference)
- [Ollama公式](https://ollama.com/)
- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Vercel公式](https://vercel.com/docs)
