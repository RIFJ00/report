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
