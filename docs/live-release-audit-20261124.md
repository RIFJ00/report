# 現行Firebase版との照合と展開判定 — 2026-11-24

## 結論

**画面移植ファイルは、2026-11-24に取得した公開Firebase版を基準に、必要なパス／API／リンク処理の書換えを施した後のファイルで9/9完全一致。** GitHub Actions（実行ID `45373745244`）で毎回SHA-256を照合できるようにした。

**本番への切替は不承認。** APIのCORSが未修正で、サーバー側Pythonソースの現行版との完全一致・認証ドメイン・書込み機能の現地確認がまだできない。

検査はすべて読み取り専用で実施し、Firebase、GitHub Pagesのmainブランチ、保存記事データへの変更はない。

## 公開版を正本としたUIの照合（2026-11-24 GitHub Actions）

検証ツール：`html-viewer/tools/audit-live-firebase-release.py`。

オリジナルを `https://html-viewer-703b6.web.app/` から取得。元サイトの `admin.html`、`viewer.html`、`columns.html` をそれぞれ `html-admin/index.html`、`html-viewer/index.html`、`column/index.html` に配置する前提で、CSSとJSのパスを `../legacy-html-assets/` へ変更し、`/api` 呼び出しを元FirebaseドメインのAPIへ向ける。そのほか別ドメイン向け記事内フラグメントリンク対応を適用する。**これらの移植上必要な改変があるため、公開原本とバイト単位の同一物ではない。**

下記9ファイルは、この**決定論的変換後**の期待値とGitHub開発ブランチの実ファイルでSHA-256完全一致：

1. `html-admin/index.html`
2. `html-viewer/index.html`
3. `column/index.html`
4. `legacy-html-assets/app.css`
5. `legacy-html-assets/bookmark-subtle.css`
6. `legacy-html-assets/app.js`
7. `legacy-html-assets/viewer-public.js`
8. `legacy-html-assets/article-preview-interactions.js`
9. `legacy-html-assets/firebase-config.js`

元の再構成版v1.10.3には古いCSSやプレビュー表示が混在していたため、**今回の画面移植は再構成版で上書きせず、現行公開サイトの正本を優先**する。

## 実際のAPI HTTP検査結果

| HTTP検査 | 実結果 | 判定 |
|---|---|---|
| `GET https://html-viewer-703b6.web.app/api/list?kind=kantei&size=1`（Origin: https://report.rifj.jp） | HTTP 200 / `Access-Control-Allow-Origin` なし | 失敗 |
| `OPTIONS https://html-viewer-703b6.web.app/api/import-url`（POST、authorization,content-typeのプリフライト） | HTTP 405 / CORS許可ヘッダーなし | 失敗 |

以上により、GitHub Pages上のJavaScriptから元のFirebase APIを呼び出しても現時点では正常に機能しない。**GitHub Pages単独で `/api` を中継することもできない。** API側の厳密なCORS許可か、Firebase Hostingへの適切な移設など、バックエンドの設定が必要。

## 本番への切替前に未完了のゲート

- [x] 公開Firebase画面9ファイルをGitHub開発ブランチに移植し、ライブ再取得ベースのハッシュ比較9/9一致
- [x] 既存のPython API `main.py` のCORS最小修正箇所を特定し、オフラインパッチとテストを用意
- [ ] デプロイ済みFunctionsの **現在のソース一式**（converter、store、requirements等）を取得／実物の差分ゼロを証明
- [ ] CORS修正を実APIへ反映し、GETとOPTIONSのHTTPテスト成功
- [ ] Firebase Authentication承認済みドメイン `report.rifj.jp` を確認
- [ ] 元Firebaseサイトの管理者ログイン／記事登録・編集・削除が維持されることを確認
- [ ] `report.rifj.jp` の各画面から記事取得／管理者処理をブラウザで確認
- [ ] 本番Firestoreルールと更新通知購読の整合性を確認

**PR #12 はドラフトを維持。 `main` へマージして公開転送を切り替えない。** ユーザーの「完全一致してから展開」という条件を守る。

## 監査証跡

- GitHub Actions: https://github.com/RIFJ00/report/actions/runs/45373745244
- JSON監査成果物: https://github.com/RIFJ00/report/actions/runs/45373745244/artifacts/14910462158
- 移植開発PR: https://github.com/RIFJ00/report/pull/12
- 元Python APIのCORS修正: `docs/firebase-python-api-cors-exact-patch.md`
