# report.rifj.jp：既存Hostingを保護する追加統合手順

## 結論

`html-viewer/tools/prepare-overlay.mjs` は、**稼働中のHostingサイトのファイル一式を正確に取得したローカルスナップショット**を入力とし、その内容を1バイトも変更せずに、`/html-viewer/` と `/html-admin/` の許可済みファイルだけを追加した**検証用**の出力を作る。ツール自体はFirebaseにもGitHub Pagesにも接続せず、デプロイも行わない。

## 必須確認

1. Firebase Consoleで `report.rifj.jp` のカスタムドメインが接続されているFirebaseプロジェクトID・Hosting **サイトID** を確認する。GitHubリポジトリ内の `CNAME` はそれだけではHostingの証明にならない。
2. 現在の配信元のアーティファクト（**全ファイル**・rewrite・headers・redirects を含む設定）と、更新・ロールバック手順を確定する。GitHubの `RIFJ00/report` がその配信元だと決めつけない。
3. **サイトの現行ファイル一式を正確に取得できない場合、この追加統合方式の本番デプロイを中止する**。一部ページのコピーだけでは既存サイトが消える可能性がある。
4. まずステージングサイト・Hostingプレビューチャネルにデプロイし、`/` `/blog/` `/blogimport/` `/xpost/` `/sales_strategy/` `/html-viewer/` `/html-admin/` を確認する。必要に応じ他の運用URLも追加。
5. 本番のFirebase Auth、Firestore、Storageルール、CSPとURL入力サーバー側の取得処理については別途設計・検証する。現在のプレビューではFirebase連携は無効。

## ローカル検証用コマンド

```sh
# BASELINE は現行サイト全体を正確に復元したスナップショット。まず中身を別途確認すること。
node html-viewer/tools/prepare-overlay.mjs /absolute/path/to/BASELINE /absolute/path/to/NEW-OUTPUT
```

- 出力先は**未作成の新しいディレクトリ**であること。既存ディレクトリや入力スナップショットを上書きしない。
- スナップショットにすでに `html-viewer` または `html-admin` がある場合は自動上書きせずエラーとする。
- 既存ファイルはSHA-256で比較する。結果の `overlay-audit.json` を確認する。
- `overlay-audit.json` は監査レポートであり、不要なら公開パッケージから除外すること。
- **rewrite等のFirebase Hosting設定は、このスクリプトではコピー・検証しない。** 実際のデプロイ前に既存設定を保持し、必要なパスだけを安全に追加する。

## 現在の状態

- GitHubの作業ブランチのみを変更。Firebase本番のサイト・データ・ルールは未変更。
- 上記の入力スナップショットはまだ取得できていないため、ステージング・本番へのデプロイは行わない。

## 合成ベースラインによる統合ブラウザテスト

- `html-viewer/tools/prepare-overlay.browser.test.mjs` で、架空の既存サイト（`/`、`/blog/`、`/blogimport/`、`/xpost/`、`/sales_strategy/`）を組み立て、追加統合してからChromiumで各URLのレスポンスと見出しを検証する。
- 新しい `/html-viewer/`、`/html-admin/` の画面が同じ配信元で動作すること、Firebase接続が初期無効であることを確認する。
- このテストは**合成データだけ**を用いる。実際の `report.rifj.jp` 配信物やFirebase Hostingのリライト設定を検証したものではない。
- 実配信ファイル一式とHostingサイトIDが特定できない限り、本番デプロイはしない。
