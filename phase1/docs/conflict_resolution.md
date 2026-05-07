# コンフリクト解消の手順（Phase 1）

`main` 取り込み時の衝突を最小化するため、以下の順で統合する。

1. 先に最新 `main` を取り込む

```bash
git fetch origin
git rebase origin/main
```

2. 競合が出たら「契約優先」で解消する

優先順:
- `phase1/docs/api_contract.md`
- `phase1/IMPLEMENTATION_PLAN.md`
- `phase1/src/app/api/*`
- `phase1/src/lib/*`
- `phase1/README.md`

3. 競合解消後にテストして継続

```bash
git add <resolved-files>
git rebase --continue
```

4. push 前に差分確認

```bash
git status
git log --oneline -n 5
```

## 補足

- `README.md` は更新頻度が高いため競合しやすい。機能実装PRとは分けるのが安全。
- API仕様に差分がある場合は、`api_contract.md` を正として実装を合わせる。
