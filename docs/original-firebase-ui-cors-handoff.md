# 元Firebaseアプリ3画面の同一ドメイン移植：API接続の最終要件

## 確定したURL

| 現在の元画面 | 新たな表示URL |
|---|---|
| `https://html-viewer-703b6.web.app/admin.html` | `https://report.rifj.jp/html-admin/` |
| `https://html-viewer-703b6.web.app/viewer.html` | `https://report.rifj.jp/html-viewer/` |
| `https://html-viewer-703b6.web.app/columns.html` | `https://report.rifj.jp/column/` |

## 移植済みソース（開発ブランチ）

元サイトの3 HTML、`app.css`、`bookmark-subtle.css`、`app.js`、`viewer-public.js`、`article-preview-interactions.js`、`firebase-config.js` を取得し、GitHub Pagesから相対参照可能な構成にした。

管理・閲覧画面は元のHTMLを基準とし、**転送スクリプトを含めない**。元のJavaScriptが呼び出すAPIは `https://html-viewer-703b6.web.app/api` を明示するよう変更した。アプリのデータ移行は不要で、同じFirebaseプロジェクトのAPIとFirestoreを引き続き利用する想定である。

## 現在の本番化阻止事項：CORS

元のAPIにはGitHub Pagesの `report.rifj.jp` から直接アクセスするためのCORS設定がない。2026-11-24の実測では、`Origin: https://report.rifj.jp` を指定した `/api/articles` GETは401で `Access-Control-Allow-Origin` ヘッダーなし、OPTIONSは405で同ヘッダーなし。

APIサーバーのソースにアクセスできる開発担当者が、**既存APIの認証・認可や保存機能を維持して**次の対応を行う。

1. `Origin: https://report.rifj.jp` の場合のみ、HTTP応答に `Access-Control-Allow-Origin: https://report.rifj.jp` と `Vary: Origin` を設定。
2. `OPTIONS` プリフライトで必要なAPIメソッド（GET、POST等）、`Authorization` と `Content-Type` の許可ヘッダーを返し、HTTP 204とする。許可メソッドは既存APIで実際に必要なものだけに限定する。
3. 既存のFirebase ID Tokenと管理者権限のサーバー側検証を継続。CORS許可を管理者認証の代わりにしない。公開GETと管理者書き込みで適切な権限を区別する。
4. Firebase Authenticationの承認済みドメインで `report.rifj.jp` の必要性を確認し、ログイン後の認証状態を実機確認する。
5. 元サイトと新サイトの両方で、記事一覧、検索、本文表示、画像、ブックマーク、URL取り込み、上書き、編集、削除、HTML出力を検証する。
6. CORSと管理者操作の動作確認後、GitHub Pagesの新しい3パスへの展開を承認する。

`Access-Control-Allow-Origin: *` による無制限な許可は避ける。特に認証情報や権限エラーの情報を露出させない。

## 現時点の公開状態

移植版は `feature/map-original-html-three-routes` / PR #12 内のみ。**mainには未反映**。現在の本番3URLは、元Firebaseアプリへ転送して機能を維持する状態である。Firebaseバックエンドには変更を加えていない。

## 2026-11-24 CORS実測・修正案

読み取り専用テスト（GitHub Actions `45357017572`）では、元APIの公開一覧 `GET /api/list?kind=kantei&limit=1` は **HTTP 200** であったが、`Access-Control-Allow-Origin` が欠けていた。`OPTIONS /api/search?query=test` は **HTTP 405**、管理用のプリフライトも同様に許可ヘッダーがなかった。そのため、元のUIを直接GitHub Pagesで表示しても記事データを取得できない。

管理画面の元JavaScriptで確認した変更系APIはすべて **POST**：
- `/api/import-url` — URLからHTML生成・保存
- `/api/import-html` — HTMLファイル内容の登録
- `/api/article/{id}/edit` — 編集
- `/api/article/{id}/delete` — 削除

閲覧系は **GET**。`GET, POST, OPTIONS` とヘッダー `Authorization, Content-Type` を最小許可セットとして扱う。管理者の権限チェックは**必ず元サーバーで継続する**。

元APIの実装コードは現在接続中のGitHubリポジトリにはなく、Cloud FunctionsかCloud Run等の実サーバー構成も未確認である。このため、`html-viewer/tools/original-api-cors-express.example.mjs` は**既存APIサーバーがNode/Express系だった場合のコード例**に限定した。自動デプロイも実APIの変更も行わない。FastAPI/Flask等であれば同じ制限をそちらのフレームワークに合わせて適用すること。

テスト用コードでは次を確認する：
- `https://report.rifj.jp` のみを許可（ワイルドカード `*` を使わない）
- OPTIONSのみ認証前に正常応答し、実際のGET/POSTは必ず元の認証・認可へ渡す
- 元Firebaseサイトの同一オリジンアクセスを維持する
- 未許可オリジンのブラウザにCORS許可を与えない
- Firebaseの設定変更・トークン発行・ユーザーデータ操作は一切行わない

API側の変更が実環境に適用された後、読み取り専用ツール `html-viewer/tools/check-original-api-cors.py` を再実行し `ready: true` を確認する。そのうえで実ブラウザで公開記事表示・管理者ログイン・保存・再読込・編集・削除を検証してからPR #12をマージする。

## Firebaseコンソール画面で判明した実バックエンド（2026-11-24）

ユーザー提供のFirebaseコンソール画面から、既存APIの実体が判明した：

- Firebaseプロジェクト：`html-viewer-703b6`
- Functionsの関数名：`api`
- 第2世代（v2）、地域：`asia-northeast1`
- FunctionsのHTTPトリガーが指すCloud Run URL：`https://api-qkdr5zitea-an.a.run.app`
- Firebase Hostingの現行標準ドメイン：`html-viewer-703b6.web.app` および `html-viewer-703b6.firebaseapp.com`
- Firebase Hostingには `report.rifj.jp` のカスタムドメイン登録なし。このドメインはGitHub Pagesのまま維持する。

**次に必要な作業：** Google Cloud ConsoleのCloud Run／Cloud Functionsの該当 `api` のソースコード（あるいはローカル開発元の `functions/index.js`、`functions/src/index.ts`、`main.py` など）を確認し、実装言語・CORSミドルウェア・既存Firebase Auth検証の順序を把握する。Functions v2の実装・デプロイ元が不明なまま、仮のExpressコードを本番に適用しない。

公開GitHub Pagesの各画面が呼び出すAPIは、既存Firebase Hostingの `/api` エンドポイントを明示している。Cloud Run直接URLを使うかはFunctionsの認証/IAM設定とHTTPルーティング、許可Originを確認した後に判断する。Cloud RunのIAMで未認証呼び出しを無制限に公開する変更は行わない。CORSとFirebaseの管理者権限検証は別の層であり、既存のサーバー側認証を残す。

提供されたスクリーンショットには関数の一覧およびHostingリリース・ドメインが写っているが、ソースコードやFirebase Authenticationの許可ドメイン設定は写っていないため、対応済みと判断しない。

## 実APIのPythonソースが判明（2026-11-24）

ユーザー提示の本番Python関数 `api` の全文から確認：

- `from firebase_functions import https_fn,options` と Flask Response/requestを使用。
- `get_identity` でBearer Firebase ID tokenを検証。
- 実管理者権限は **`role == "admin"`**、匿名ログイン禁止。旧開発版の `rifjAdmin` ではない。
- `GET /list`、`GET /search`、一部記事GETは公開。
- URL取得・HTML取込・編集・削除はadminだけに許可。
- 現状の `if request.method=="OPTIONS":return send(...,405)` はCORSプリフライトを拒否している。
- 最小修正は既存デコレーターに `cors=options.CorsOptions(cors_origins=["https://report.rifj.jp"],cors_methods=["get","post"])` を追加し、明示OPTIONS応答を204に変更すること。Firebase公式Python Functionsでサポートされている。
- 詳細な現行ソースへのdiffは `docs/firebase-python-api-cors-exact-patch.md` に保存。

**本番関数の変更はまだ行っていない。** 元の `main.py` だけでなく、`converter.py`、`store.py`、`requirements.txt`、`firebase.json` 等のデプロイ可能なソース一式とバックアップが必要。これまでのコードを実APIの代わりに上書きしてはならない。
