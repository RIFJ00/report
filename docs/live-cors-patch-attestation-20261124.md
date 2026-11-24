# Cloud Functionsの本番実ソースに対するCORS最小修正：自動検証（2026-11-24）

## 検証の結果

**読取専用のGitHub Actions実行に成功。CORS修正を本番稼働中のAPIソースに対しメモリ上で適用・検証した。**

- 実行: https://github.com/RIFJ00/report/actions/runs/45385266973
- GitHub Actions artifacts: https://github.com/RIFJ00/report/actions/runs/45385266973/artifacts/14916475391
- `Production original main.py exact match: True`
- `CORS-only in-memory patch approved: True`
- オフラインテスト 4件 + Python APIパッチテスト + ハッシュ照合ツールテストが成功。
- GitHubには修正版のPythonソース一式や秘密情報をアップロード**していない**。JSON監査成果物はハッシュ・ファイル名・ブール値だけ。
- 本番 Cloud Functions のソース取得に成功。元のソースはGitHub Actionsの一時メモリのみで扱う。
- 稼働中の `main.py` に対して、既知の`on_request`デコレーターに `cors=options.CorsOptions(cors_origins=["https://report.rifj.jp"],cors_methods=["get","post"])` を追加し、明示OPTIONS応答を204にする変換が構文上成功。
- 元の `auth.verify_id_token` と `user.get("role")=="admin"` の権限判定、記事処理はASTで変更していないことを確認。
- **変更対象は `main.py` だけ。** `converter.py`、`kantei_parser.py`、`store.py` の現行本番内容をそのまま維持し、過去版に置き換えない。
- GitHubのPR #12はドラフトのまま。Firebase Hosting、Firestore、Storage、Cloud Functionsは一切変更なし。

## 未解決事項と公開判断

`CORS-only in-memory patch approved: True` は、**本番へ安全にデプロイできたことを意味しない。** 実際に現在のデプロイソース一式を使い、ユーザー承認を経てCloud Functions`api`だけをデプロイする必要がある。現在のGitHub接続アカウントは`cloudfunctions.functions.sourceCodeGet`だけを許可するため、デプロイ操作はできない（正しい最小権限）。

本番デプロイの前に、以下が必要：
1. ソース一式の保存形式・容量・機密情報の扱いを決定し、関数だけを更新する別の権限付きワークフローを段階的に設計（現状は無し）。
2. ロールバック手順・現在のリビジョン/URL/実行設定・環境変数・Secret Manager参照を確認し、デプロイ前バックアップを確保。
3. 元の `firebase-functions` 依存バージョンでCORSオプションが有効になるかテスト。記事HTML・添付に影響しないことを確認。
4. Authenticationの承認済みドメインに`report.rifj.jp` が存在するか確認（以前のスクリーンショットでは未登録）。
5. CORS反映後：Origin付きGET、OPTIONSプリフライト、ユーザー/管理者の権限・登録編集保存の検証。
6. GitHub Pages上の3画面についてURL保持と実ブラウザ検証後、PR #12をmainへマージ。

**完全一致を優先するというユーザー指示に従い、現時点では本番APIや公開サイトを更新しない。**
