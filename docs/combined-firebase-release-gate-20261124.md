# Firebase統合リリース判定（2026-11-24）

## 目的

Firebase稼働中API・公開元画面・GitHub Pages移植版を、**本番デプロイを伴わず**同じGitHub Actionsジョブで独立に照合する。ユーザー要求は「既存機能を保持し、完全一致を確認してから展開」。

## 自動検証

- GitHub Actions: https://github.com/RIFJ00/report/actions/runs/45386137382
- Workflow: `.github/workflows/combined-firebase-release-gate.yml`
- Gate code: `html-viewer/tools/combine-firebase-release-gates.py`
- Tests: `html-viewer/tools/test-combine-firebase-release-gates.py`
- 出力: `firebase-release-matrix.json`、`firebase-ui-api.json`、`deployed-python-attest.json`（GitHub Actionsの期限付きartifactのみ。署名URL・ソース本文なし）

2026-11-24 の実行ログで次を確認：

| 項目 | 判定 |
|---|---|
| 元Firebase公開UIから決定論的に移植した9ファイルのSHA-256 | **一致** |
| Cloud Functions v2本番ソースをOIDC経由で読取取得 | **成功** |
| 本番 `main.py` とv1.3の元コードのSHA-256 | **一致** |
| 稼働中全ソースを保持しCORS修正が `main.py` だけで完結する事前検証 | **成功** |
| 実APIのOrigin付きGETとOPTIONS CORSプリフライト | **不合格（CORS未反映）** |
| Firebase Authの`report.rifj.jp`承認済みドメイン | **未確認** |
| `report.rifj.jp`上での管理者ログインと登録・編集・削除 | **未実施** |
| 本番の関数リビジョン・環境変数・シークレット参照・ロールバック手順 | **未確認** |
| Firebase API本番CORS修正デプロイ | **未実施** |
| PR #12のmainマージ | **禁止／未実施** |

## なぜ「テスト成功」なのに切替しないか

CIのジョブ成功は**監査処理が正常に実行され、現時点の不合格条件を正しく検知した**という意味。公開許可とは異なる。監査JSONの`production_deployment_approved`と`main_branch_merge_approved`は明示的に`false`。これらの値を人の承認や実機試験なしにtrueに変える実装は禁止。

## 今後の安全な段取り

1. Google Cloud Functions `api` の本番設定／リビジョン／Secret参照を読み取り専用で取得・保管（機密値は不可）。
2. ユーザーが許可した別の臨時デプロイ権限を使い、**実際にデプロイされているソースをまるごとバックアップしたコピー**に対し、検証済みの2箇所だけ変更。過去ZIPの `converter.py`、`store.py`、`kantei_parser.py`で置換しない。
3. Firebase Functions `api` だけを更新し、公開GET/OPTIONS/管理者認証/編集/削除等で後退がないか確認。Firestore/Storage/Hosting等は一切同時変更しない。
4. Firebase Authenticationの許可ドメインに `report.rifj.jp` を追加し、移植3画面をステージングで検証する。
5. 監査証跡・復元方法・運用確認が整った時点でのみPR #12をmainへマージ。

上記を完了するまで本番のFirebaseやreport.rifj.jpの既存導線に変更を加えない。
