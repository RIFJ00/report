# Firebase本番ソースの自動照合（2026-11-24）

本手順は **読み取り専用**。`api` の実稼働ソースのSHA-256を取得し、添付ZIPから復元した候補と比較する。Firebaseのソースや認証情報はGitHubへコミットしない。

## 作成した自動化

- `.github/workflows/audit-deployed-python-source.yml`
- `html-viewer/tools/audit-deployed-python-source.py`
- `html-viewer/audit/recovered-python-sha256.json`

GitHub Actionsの既存設計に合わせ、`GCP_WIF_PROVIDER` と `GCP_DEPLOY_SERVICE_ACCOUNT` の**リポジトリ変数**がある場合だけGoogle Cloudの一時認証を実施する。恒久的な秘密鍵は使わない。Google Functions v2 `generateDownloadUrl` を読み取り、署名付きソースZIPをメモリ上だけで展開し、拡張子 `.py` / `.txt` / `.css` の対象ファイルをハッシュ比較する。JSON監査結果だけを7日間のActions artifactとして保存する。

**自動化ができたことと、本番ソースを実際に取得できたことは別。** ワークフローの実行ログで、`source_download_succeeded: true` と比較結果を確認するまで本番一致の証拠としない。

## 運用上の安全条件

- Google Cloudのアカウントに Cloud Functions v2のソース取得権限が必要。認証用リポジトリ変数が未設定の場合は安全に失敗。
- このジョブには `firebase deploy`、Firestore変更、Hosting切替、GitHub mainへのマージ処理を持たせない。
- ハッシュが一致してもCORSと認証ドメイン・管理者UIの実テストが未了ならリリースしない。
- 元の `main.py` は**CORSを適用する前**のハッシュで比較する。パッチ済み版と一致しないことは仕様どおり。
- 本番ソースに追加ファイルがある場合は `deployed_extra_file_names` に出す。小文字/大文字、配置階層、圧縮アーカイブのルートの違いがあると比較できないことがあり、その場合はソース取得は成功でも候補一致として扱わない。
- Google Cloudに保存されたFunctionsソースがそもそも取得不可能である場合は、同じデプロイのCloud Build成果物やオリジナル開発フォルダとの照合が別途必要。

## ステータス

- UI静的ファイル9/9一致：確認済み。
- Python本番ソースのSHA照合：自動化を作成、**実行・認証結果未確認**。
- 公開GET CORS：現在失敗。
- 管理者POST CORS：現在OPTIONS 405。
- 公開本番への切替：**保留（PR #12ドラフト）**。

GitHub Actionsは `https://github.com/RIFJ00/report/actions` から確認。既存のワークフローは `main` へのpushでFirebase全体をデプロイする危険があるため、こちらの構成を本番デプロイ系と混同しないこと。
