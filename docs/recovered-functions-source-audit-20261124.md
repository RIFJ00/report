# 発見された元ソースの照合・復元候補（2026-11-24）

## 確認したユーザー提供ZIP

- `RIFJ_Firebase_HTML_html-viewer-703b6_secure_v1_1(1).zip`: Python Functionsの `main.py`, `converter.py`, `store.py`, `search_index.py`, `publication_date.py`, `kantei_parser.py`, `thumbnail_zoom.py`, `requirements.txt` と `firebase.json` を含む。
- `RIFJ_Firebase_HTML_v1_3_public_viewer_patch(2).zip`: 本番APIとして提示された `main.py` と内容が一致する `main.py`、更新通知処理を追加した `store.py` を含む。
- `RIFJ_api_CORS_安全修正案_20261124.zip`: `original/main.py` はv1.3の `main.py` と**バイト単位で一致**。 `patched/main.py` はCORSデコレーターおよびOPTIONS応答のみを変更。
- v1.7とv1.8のパッチには変換処理関連の `converter.py` が含まれる。v1.9～v1.10.3のパッチには省庁別変換、サムネイル、Adobe Reader画像対策が含まれる。**未統合**。

## 安全な復元候補（ローカル検証用）

ユーザーへの成果物 `RIFJ_Firebase_API_復元検証_20261124.zip` は以下のファイルから構成し、実稼働環境には反映していない。

| ファイル | 採用元 | 内容 |
|---|---|---|
| `functions/main.py` | v1.3 + CORS修正案 | 公開GET / Firebase ID Token / role=admin認可。CORS2箇所の変更のみ |
| `functions/store.py` | v1.3 | 記事保存・更新通知 |
| `functions/converter.py` | secure v1.1 | **現行より古い**変換処理 |
| `functions/search_index.py` | secure v1.1 | 検索処理 |
| `functions/publication_date.py` | secure v1.1 | 公開日取得 |
| `functions/kantei_parser.py` | secure v1.1 | 首相官邸抽出 |
| `functions/thumbnail_zoom.py` | secure v1.1 | サムネイル処理 |
| `functions/unified.css` | secure v1.1 | 変換HTML用CSS |
| `functions/requirements.txt` | secure v1.1 | Python依存関係。**稼働版との一致は未確認** |

除外：`functions/.env`（元のZIPに存在）、 `.firebaserc`、秘密情報を含み得るプロジェクト設定、全体デプロイスクリプト、Hosting/Firestore/Storageのルール。参照用の `firebase-functions-only.example.json` を別途配置。ZIP内部の破損なし、Pythonファイルの構文検査成功。

## 厳密な制約

**この候補ZIPは、本番用の完成版ではない。** v1.9～v1.10.3で発生した変換・画像処理の変更を統合できていない。Cloud Functionsの元のソースと依存関係を実際に取得するまでは、この一式をFirebaseへデプロイしない。

先に行うのは、Google Cloudのデプロイ済みFunctionsソース一式（Cloud Build/Artifact経由で取得できれば）を既存の本番構成として確定すること。その実ソースの `main.py` に、 `docs/firebase-python-api-cors-exact-patch.md` の2箇所だけ適用する。ユーザー側のFirebase Authの承認済みドメインに `report.rifj.jp` が追加されたかも確認する。

本作業は元の公開サイトとPR #12を変更しない。PR #12をマージする前にCORSプリフライト、公開GET、認証付きPOST、3画面を動作検証する。

## v1.10.3までのオフライン再構成に成功（2026-11-24追記）

ユーザーが添付した元ZIPをローカルの別フォルダへ展開し、**v1.8のconverter.pyを基準に以下の更新プログラムをバージョン順に全て実行**した。

1. `apply_v19.py`（v1.9）— dry-run成功・apply成功
2. `apply_v191.py`（v1.9.1）— dry-run成功・apply成功
3. `apply_v110.py`（v1.10）— dry-run成功・apply成功
4. `apply_v1101.py`（v1.10.1）— dry-run成功・apply成功
5. `apply_v1102.py`（v1.10.2）— apply成功（dry-runなし）
6. `apply_v1103.py`（v1.10.3）— dry-run成功・apply成功

元のsecure v1.1の補助ライブラリ、v1.3の実API `main.py` と `store.py` を合わせ、すでに作成済みのCORS修正版 `main.py` を適用した。Python `compileall` 成功。元プロジェクトの12テスト中11成功、1失敗。

**旧テストの失敗は現行UIの自動更新機能との仕様差異**： `test_no_client_firestore_data_access` は `public/app.js` に `getFirestore(` が存在しないことを要求する。しかしv1.9→v1.10.3で構築したapp.jsには記事変更検知用 `onSnapshot(doc(firestore,"system","article_revision"))` がある。元secure v1.1の `firestore.rules` は全ドキュメント読み書きを拒否するため、このルールをデプロイした場合リアルタイム更新通知が失敗する可能性がある。**現在の本番Firestoreルールが同じとは限らない**ため、先に本番ルール確認が必要。

成果物：`RIFJ_Firebase_v1_10_3_オフライン再構成_要検証_20261124.zip`。39ファイル、SHA256マニフェスト、適用ログ、明示した「本番投入禁止」説明書を含む。秘密の `.env` は含めていない。ZIP整合性検査に成功。

公開Firebaseサイトの元ソースを取得した別スナップショット `original-ui-three-routes.zip` と比較し、`app.js` / `viewer-public.js` が**バイト単位一致**。 `article-preview-interactions.js` は一致せず（再構成側が一部追加機能を含み得る）。これだけで本番Functionsと完全一致したとは主張できない。

### 本番切替へのゲート
- デプロイ済みFunctionsソースの復元／現行converter/store/requirements差分の確認
- Firebase Authenticationの承認済みドメイン `report.rifj.jp` の確認
- Firebase CORS GETとOPTIONSの本番反映確認
- 既存Firebaseサイトの管理者認証・書込み機能に後退がないことの実機確認
- Github Pagesの3画面についてURL保持・プレビュー・検索・更新の確認
- Firestoreの既存本番ルールを取得し、更新通知購読の整合性を確認

上記が終わるまでGitHub PR #12はドラフトとし、Firebase本番への変更は行わない。
