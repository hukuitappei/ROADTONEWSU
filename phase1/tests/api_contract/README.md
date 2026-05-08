# API契約テスト

Route Handler を直接呼び出す統合寄りテスト群です。

## 実行例

```bash
cd phase1
npx vitest run -c tests/api_contract/vitest.config.ts tests/api_contract/route_handlers.contract.test.ts
```

> 備考: `tests/api_contract_smoke.sh` は補助チェックとして残し、契約検証の主系は本テストに移行します。
