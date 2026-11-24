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

## 実行結果（2026-11-24 19時台）

- ソース自動照合の初回GitHub Actions実行： https://github.com/RIFJ00/report/actions/runs/45376330088
- **失敗理由：GitHub Actionsのリポジトリ変数 `GCP_WIF_PROVIDER` と `GCP_DEPLOY_SERVICE_ACCOUNT` が両方未設定。** 外部Google Cloudへの認証処理は実行されていない。Cloud Functionsソース取得・比較も未実施。
- ハッシュ照合ツールのオフラインテストは https://github.com/RIFJ00/report/actions/runs/45376592257 で成功。
- 過去の `RIFJ_GitHub_Firebase_AutoDeploy_Setup_v1` のCloud Shell設定スクリプトは **`RIFJ00/rifj-firebase-html` の `main` ブランチ向け**であり、現在作業している **`RIFJ00/report` の `feature/map-original-html-three-routes` ブランチには適合しない**。そのまま実行しない。
- Google Cloud Functions v2ソース取得に必要な権限は `cloudfunctions.functions.sourceCodeGet`。本作業にはこの権限のみ（必要に応じて表示権限）を持つ、GitHubの開発ブランチに制限した専用の読み取り用OIDC接続を設定するのが最小権限原則に適う。`roles/cloudfunctions.admin` やデプロイ系IAM権限はこの監査には不要。
- ユーザー管理者のGoogle CloudとGitHub両方のIAMを設定しない限り、完全なクラウド側自動化は進められない。現時点で本番を上書きする選択はしない。

## 実際のCloud Functions本番ソース取得と差分確定（2026-11-24 20:29頃）

GitHubのユーザー操作による Workload Identity + 専用サービスアカウント連携後、OIDC認証とCloud Functions v2 `generateDownloadUrl` に成功。最初の検証はZIPに含まれる大きなデータの容量上限で失敗したため、検査対象を**第一階層のソースファイルのみ**に絞り、ZIP全体の上限と検査対象の個別ファイル上限を維持して再実行。実行 `45384480473` は成功し、`45384620612` でファイル名別の照合結果も確認。

**本番に配備された実ソースの照合：復元候補11ファイル中8ファイルがSHA-256で完全一致、3ファイルが不一致。**

一致：
- `additional_ministry.py`
- `main.py`（v1.3提示元と一致するCORS未修正の実API）
- `new_ministry.py`
- `publication_date.py`
- `requirements.txt`
- `search_index.py`
- `thumbnail_zoom.py`
- `unified.css`

不一致：
- `converter.py`
- `kantei_parser.py`
- `store.py`

ルート直下の追加ソースは0件。なおこの監査プログラムは第一階層の `.py/.txt/.css` だけを対象にしており、バイナリ素材・下層フォルダの有無まで同一を保証するものではない。

**本番ソースをGitHubへプッシュ・配布していない。** 実ソースはGitHub Actionsの一時メモリ内でハッシュ計算され、成果物に記録されるのはハッシュとファイル名のみ。署名付きソースURLや認証トークンも出力しない。

次段階：不一致3ファイルを絶対に復元候補で上書きせず、本番ソースのプライベートな保管・差分のレビューを行う。ユーザーの「完全一致してから展開」の条件を満たすまで、FunctionsをデプロイせずPR #12はドラフトのまま維持。

- 認証を含むソース照合成功: https://github.com/RIFJ00/report/actions/runs/45384620612
- 9/9のUIソース移植照合: https://github.com/RIFJ00/report/actions/runs/45373745244
