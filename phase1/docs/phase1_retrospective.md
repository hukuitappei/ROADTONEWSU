# Phase 1 実装振り返り

作成日: 2026-05-08

---

## 1. 概要

Phase 1（PDF要約・質問応答アプリ）の実装を通じて得た設計判断・ロジックの工夫・採用理由、および「0から作り直すなら」という対比の視点をまとめた振り返りドキュメントです。

---

## 2. 実装の要点と採用理由

### 2-1. PDF 処理パイプライン

**実現したこと**

`pdf-parse` にカスタム `pagerender` コールバックを渡し、ページごとにテキストを取得しながら文字オフセット（`start` / `end`）を手動で記録する。これにより「全文テキスト中のどの範囲がどのページか」を示すページ境界マップ（`pages[]`）を構築する。

```
PDF バイナリ
  → pdfParse(buffer, { pagerender })
    → ページごとに textContent.items を結合
    → start/end オフセットと pageNumber を pages[] に積む
  → extractPdfText() が { text, pageCount, pages } を返す
```

**なぜこの記述か**

デフォルトの `data.text` はページ境界の情報を持たない。カスタムコールバックを使うことで、後続の `chunkText()` がページ情報付きのチャンクを生成できる。これが citation の `pageStart` / `pageEnd` 表示の土台となる。

**チャンク分割の工夫**

```typescript
const findPageForOffset = (pages, offset) =>
  pages.find(p => offset >= p.start && offset < p.end)?.pageNumber ?? null
```

チャンクの開始・終了オフセットをページ境界マップに照合し、`startPage` / `endPage` をチャンク生成と同時に確定させる。分割後にページを推定するのではなく、分割時に確定させることで精度を担保している。

**先頭 N チャンク方式の採用理由**

要約・Q&A ともに先頭 5 チャンク（最大約 15,000 トークン相当）を使用する。キーワード検索や類似度検索（RAG）より実装コストが格段に低く、30 ページ以内という Phase 1 の制約内では先頭 5 チャンクが文書の主要論点をほぼカバーするという現実的な判断。RAG への移行は Phase 2 で行う。

---

### 2-2. LLM 統合層

**タイムアウトと AbortSignal の合成**

外部からの AbortSignal（呼び出し元キャンセル）と内部のタイムアウト AbortSignal を第三の AbortController で合成し、どちらか先に発火した方でリクエストを中断する。

```typescript
signal?.addEventListener('abort', onAbort)
timeoutController.signal.addEventListener('abort', onAbort)
return { signal: controller.signal, cleanup: () => { clearTimeout(timeoutId); ... } }
```

単純に `Promise.race` でタイムアウトを実装すると fetch が内部でリクエストを継続し続けるが、AbortSignal で fetch を直接中断することで TCP 接続レベルから切断できる。

**指数バックオフリトライの設計**

`RETRY_DELAYS_MS = [1000, 2000, 4000]` という配列の長さがリトライ上限と連動する。

```typescript
for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
  ...
  await sleep(RETRY_DELAYS_MS[attempt])  // 1s → 2s → 4s
}
```

上限を変えたければ配列を変えるだけでよく、ループ条件と設定値の二重管理が発生しない。

**OpenAI SDK を使わず fetch を直書きした理由**

Ollama 等の OpenAI 互換 API への対応を `.env` の `OPENAI_BASE_URL` 変更だけで完結させるため。SDK を使うと互換性が SDK のバージョンに依存し、環境切り替えのコストが上がる。

---

### 2-3. レート制限

**Supabase RPC ベースの分散レート制限**

```typescript
await supabase.rpc('consume_api_rate_limit', { p_key: key, ... })
try {
  return await handler()
} finally {
  await supabase.rpc('release_api_rate_limit', { p_key: key })
}
```

インメモリのカウンターではなく PostgreSQL の RPC 関数で管理している理由は、Vercel のようなサーバーレス環境では各リクエストが別プロセスで処理されるためである。インメモリカウンターは当該プロセス内でしか共有されず、複数インスタンスが起動した瞬間に制限が無効になる。

`finally` で必ず `release` を呼ぶことで、ハンドラーが例外を投げても並行カウントが確実にデクリメントされる。

---

### 2-4. Q&A コンテキスト注入と回答ガード

**buildContext の設計思想**

コンテキスト構築と citation 生成を同一ループで行い、「どのチャンクからコンテキストを作ったか」と「どこを引用したか」を一対一で対応付ける。

```typescript
const docContexts = await Promise.all(
  readyDocs.map(async (doc) => {
    const chunks = await getDocumentChunks(doc.id, PHASE1_QA_CHUNK_LIMIT)
    return {
      contextText: `Document ${doc.id}\n${chunks.map(c => c.content).join('\n\n')}`,
      citations: chunks.map(c => ({
        chunkId: `${doc.id}:${c.chunk_index}`,  // URI 的な識別子
        pageStart: c.page_start,
        quote: c.content.slice(0, 120),
      }))
    }
  })
)
```

citation の `chunkId` を `${docId}:${chunkIndex}` 形式にしたのは、ドキュメントとチャンクを URI 的に識別でき、フロントエンドでのハイライト照合を文字列マッチで完結させるためである。

**回答ガードの二段構え**

```typescript
const qaBlocked = ids.length > 0 && (readyDocs.length === 0 || context.trim().length === 0)
```

「ready ドキュメントが 0 件」に加えて「コンテキストが空文字」も遮断する。ドキュメントは存在するが chunks も summary も空というエッジケースでハルシネーションが発生するのを防ぐ。

**システムプロンプトのバージョン管理**

```typescript
const PROMPT_VERSION = 'v1.3'
const SYSTEM_PROMPT = `あなたはPDF内容に基づいて回答するアシスタントです（prompt:${PROMPT_VERSION}）。
PDF外の知識・比較・推測は禁止する。根拠が見当たらない場合は即答する。`
```

プロンプトにバージョン番号を埋め込み、評価ログと対応付けられるようにする。v1.2 から v1.3 への改善は評価ログの Fail ケース（PDF 外知識の作話）を根拠とした。

---

### 2-5. データモデルの先見性

初期スキーマから `document_chunks` テーブルを含めている。

```sql
create table document_chunks (
  document_id uuid references documents(id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  page_start   int,
  page_end     int,
  unique (document_id, chunk_index)
);
```

- `ON DELETE CASCADE`: ドキュメント削除でチャンクも連動削除
- `UNIQUE(document_id, chunk_index)`: upsert が冪等に動く
- `page_start` / `page_end`: Phase 1 でページ情報を取得できる設計を最初から確保

Phase 2 で pgvector を導入する際も `embedding vector(1536)` カラムを追加するだけでこのテーブルを RAG インデックスとしてそのまま使える。

`citations jsonb` も同様で、現在は `[{chunkId, pageStart, pageEnd, quote}]` の固定構造だが、JSON スキーマを変えるだけで引用粒度の変更に対応できる。

---

### 2-6. エラー体系の統一

```
外部エラー（OpenAI / Storage）
  → ProviderErrorCode（llm.ts / storage.ts）
    → ApiErrorCode（http.ts: mapProviderErrorToApiError）
      → HTTP ステータス + JSON ボディ
        → mapUploadErrorMessage / mapChatErrorMessage（UI 層）
          → ユーザー向け日本語文言（次の行動を明示）
```

エラーが層を経るたびに抽象度が上がり、UI 層ではユーザーが次に何をすべきか（「再試行」「別ファイルを選択」等）だけを表示する。`StorageSaveError` のような型付きエラークラスは `instanceof` による分岐を型安全にする。

---

## 3. 0から作り直すなら

Phase 1 の実装は「シンプルさ優先・割り切りを明示」という方針で書かれている。同様の機能を一から作るとしたら、以下の選択をする。

### 3-1. LLM 統合に SDK を使う

**Phase 1 の選択**: fetch 直書き  
**0から作るなら**: `@openai/openai` SDK または **Vercel AI SDK** を使用

理由: リトライ・タイムアウト・ストリーミングが標準で備わっており、互換 API 対応も `baseURL` オプションで同様に実現できる。fetch 直書きは制御の自由度が高い反面、テストが煩雑になる。Vercel AI SDK を使えばストリーミング UI の実装が数行で済む。

### 3-2. バックグラウンド処理に Queue を使う

**Phase 1 の選択**: `void enqueueDocumentProcessing()` による fire-and-forget  
**0から作るなら**: **Inngest** または **Upstash QStash** を使用

理由: Vercel サーバーレス関数はレスポンス送信後も関数タイムアウトまで実行を続けるが、その保証は不安定。Queue を使えば HTTP レスポンスを返した後も確実にジョブを実行でき、リトライ・ログ・監視が標準で付いてくる。

### 3-3. 認証を最初から Supabase Auth にする

**Phase 1 の選択**: `x-user-id` ヘッダーによる暫定認証  
**0から作るなら**: `getUser()` による Supabase Auth JWT 検証から開始

理由: x-user-id は「後で直す」と決まっているコードであり、二度書きのコストが発生する。最初から Supabase Auth にすれば RLS・JWT 検証・セッション管理が一括で手に入る。

### 3-4. ORM を使う

**Phase 1 の選択**: Supabase JS SDK のチェーン呼び出し  
**0から作るなら**: **Drizzle ORM** + Supabase

理由: スキーマから TypeScript 型を自動生成することで、DB の変更がアプリ層まで型エラーとして伝播する。Supabase JS SDK は柔軟だが、クエリの戻り値型を手動で管理する必要がある箇所がある。

### 3-5. チャンク分割を意味単位にする

**Phase 1 の選択**: 3,000 文字の固定長分割  
**0から作るなら**: 段落・文境界を優先した分割（`RecursiveCharacterTextSplitter` 相当）

理由: 固定長分割は文の途中でチャンクが切れ、文脈が失われる。段落→文→文字の優先順位で分割するだけで Q&A の回答精度が向上する。実装コストは低い。

### 3-6. Next.js Server Actions を使う

**Phase 1 の選択**: API Routes（`app/api/*/route.ts`）  
**0から作るなら**: Server Actions でアップロード・Q&A を実装

理由: Server Actions を使えば `POST → route.ts → lib/ → supabase` の多段構造がシンプルになり、バリデーション・認証・DB 操作を一か所に書ける。ただし細かいエラーコード管理や外部からの API 利用が不要な場合に限る。

---

## 4. 総括

| 観点 | Phase 1 の方針 | 効果 | 代償 |
|---|---|---|---|
| PDF 処理 | カスタム pagerender でページ境界を記録 | citation のページ表示が正確 | 実装が pdf-parse の内部挙動に依存 |
| LLM 統合 | fetch 直書き + 指数バックオフ | 互換 API への対応が容易 | テストが煩雑・SDK で無償で得られる機能を手書き |
| レート制限 | Supabase RPC で分散管理 | サーバーレス環境でも正確に動作 | RPC 呼び出しのレイテンシが加算される |
| コンテキスト注入 | 先頭 5 チャンクの実本文 | 実装シンプル・安定 | 文書後半に重要情報がある場合に回答が不完全 |
| データモデル | Phase 2 を見越した `document_chunks` 設計 | RAG 移行時にスキーマ変更が最小 | 現時点では使いきれていない列が存在 |
| 認証 | x-user-id 暫定方式 | 実装コストが低く学習に集中できた | Phase 2 で必ず書き直しが発生する |

Phase 1 の主な学びは、**「割り切りを明示して積み上げる」** という開発スタイルの有効性である。暫定方式に `TODO(phase2-auth)` コメントを付け、評価ログでプロンプトバージョンを記録し、スキーマに将来の拡張余地を残す——これらは小さな手間だが、次のフェーズへの引き継ぎコストを大幅に下げる。
