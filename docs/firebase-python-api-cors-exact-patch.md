# Firebase Functions v2（Python 3.12）api 関数への最小CORSパッチ

2026-11-24、現在稼働中の `api` の `main.py` 相当のコードが提示されたため、その**現物に基づく**変更案。現行の `https://html-viewer-703b6.web.app` を維持しつつ、GitHub Pages `https://report.rifj.jp` からAPIを利用できるようにする。

## 現行ソースに対する変更

既存の import `from firebase_functions import https_fn,options` は変更不要。

```diff
-@https_fn.on_request(region="asia-northeast1",memory=options.MemoryOption.MB_512,timeout_sec=120,max_instances=10)
+@https_fn.on_request(
+    region="asia-northeast1",
+    memory=options.MemoryOption.MB_512,
+    timeout_sec=120,
+    max_instances=10,
+    cors=options.CorsOptions(
+        cors_origins=["https://report.rifj.jp"],
+        cors_methods=["get", "post"],
+    ),
+)
 def api(req: https_fn.Request)->https_fn.Response:
     start=time.monotonic()
     path=request.path
     if path.startswith("/api/"):path=path[4:]
     elif path=="/api":path="/"
-    if request.method=="OPTIONS":return send({"error":"Unsupported method"},405)
+    if request.method=="OPTIONS":return Response(status=204)
```

Firebase Functions Python SDK公式の `https_fn.on_request(cors=options.CorsOptions(...))` を使用。SDKラッパーによるCORSと既存関数のOPTIONS応答が共存するか、実HTTP応答で確かめる。**OPTIONSに認証トークンは付かないため、認証チェックに到達する前に処理**する。

## 変更しないもの

- Firebase IDトークン検証：`auth.verify_id_token`
- 管理者判定：**`user.get("role")=="admin"`**。以前の簡易管理画面で想定した `rifjAdmin` は**別仕様であり、適用しない**。
- 非匿名ユーザーの制約、`role in ("admin","viewer")`、公開GETの区分
- /import-url、/import-html、/article/{id}/edit、/article/{id}/delete の管理者のみ書込み
- Firebaseプロジェクト、Firestore、Storageの保管先、関数のリージョン、メモリ、タイムアウト、最大インスタンス
- Firebase Hostingの既存リライトルール、元ドメインの動作

## デプロイ方法

元の `main.py`、`store.py`、`converter.py`、`requirements.txt`、`firebase.json` 等の**現在実行中の関数一式**を取得できてから、同じプロジェクトの専用ソースディレクトリで差分を適用する。コードがGitHub `RIFJ00/report` には見つからないため、今ある開発用Python例だけをCloud Functionsへ新規デプロイしてはならない。

既存関数のソースを確実に特定したら、バックアップを取り、Firebase CLIの `firebase deploy --only functions:api --project html-viewer-703b6` で**関数apiだけ**更新する。Hosting全体の上書きやFirestoreルールの変更は行わない。

## 実測テスト

```bash
curl -i 'https://html-viewer-703b6.web.app/api/list?kind=kantei&size=1' \
  -H 'Origin: https://report.rifj.jp'

curl -i -X OPTIONS 'https://html-viewer-703b6.web.app/api/import-url' \
  -H 'Origin: https://report.rifj.jp' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

期待：GETには `Access-Control-Allow-Origin: https://report.rifj.jp` が付き、OPTIONSには2xxと許可Origin／Authorization／Content-Type等のヘッダーが付く。**管理者APIへの未認証POSTは実行しない。** 認証した利用者でも `role` がadminでなければ書込403を維持する。元のUIから検索、編集、保存まで実機確認する。

## Firebase Authentication

元のコードは `signInWithEmailAndPassword` 方式。Firebase Authenticationの「承認済みドメイン」に `report.rifj.jp` を登録することは安全な移植準備だが、それだけでCORSの問題は解決しない。

## 注意

- これらは修正**指示書**であり、Firebaseの実APIは**未変更**。
- 元のソースとrequirements、デプロイ元のバックアップが揃うまで、本番の関数を再デプロイしない。
- GitHub Pagesに元のHTMLを反映するPR #12は、APIの実接続・認証・記事保存のテストが完了するまでドラフトのままにする。
