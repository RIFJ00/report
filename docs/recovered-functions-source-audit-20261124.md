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
