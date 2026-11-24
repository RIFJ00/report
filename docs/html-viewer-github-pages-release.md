# report.rifj.jp の公開方式再評価（2026-11-24）

## 実際に確認できた証拠

- GitHubリポジトリ `RIFJ00/report` のメタデータ：`has_pages: true`、デフォルトブランチ `main`。
- 同リポジトリの `main/CNAME` には `report.rifj.jp` と記載されている。
- 同リポジトリの `main/index.html` と `https://report.rifj.jp/` のタイトルおよび主要本文が一致する。
- リポジトリには既存の `/blog/`、`/blogimport/`、`/xpost/` 等がある。
- 現段階でGitHub Pagesの「Settings → Pages」の実際のソース設定（branch/folder）およびDNSは直接確認できていない。

**結論：** `report.rifj.jp` は `RIFJ00/report` のGitHub Pagesから配信されている可能性が高い。Firebase ConfigをHTML内に記載することは、Firebaseをデータバックエンドとして使用するだけで、Firebase Hostingを公開元にする必要はない。

## 推奨配信方式

GitHub Pagesの配信元が `main` のルートであると確認できた場合、現行サイトを維持したまま、すでに開発した `html-viewer/` と `html-admin/` の静的な公開用ファイルを `main` へ追加するだけで、以下のURLが有効になる想定である。

- `https://report.rifj.jp/html-viewer/`
- `https://report.rifj.jp/html-admin/`

Firebaseバックエンドは別プロジェクト `html-viewer-703b6` を使う。その接続はまだ無効（`firebase-config.json enabled:false`）であり、Firestoreの認証・ルールを確認してから有効化する。

## 正式反映前の禁止事項

- **GitHub Pagesの配信元を確認する前にPR #9をmainにマージしない。** `main` を自動公開している場合、マージ操作そのものが公開となる可能性がある。
- Firebase Hostingへ `report.rifj.jp` のDNS・カスタムドメインを移さない。
- `main/CNAME`、ルート `index.html`、既存 `/blog/` 等を変更しない。
- FirebaseのサービスアカウントをGitHubに平文で置かない。
- Firebase接続無効の状態で公開されても「記事保存が機能する」と説明しない。

## 公開前に確認する手順

1. GitHub → `RIFJ00/report` → Settings → Pages を開き、実際の公開URL、配信ソース（branch + folder）を確認する。
2. `main` ルートが配信元なら、GitHub Pages経由で公開する方針を採用する。もしActions配信やサブフォルダなら、そのワークフロー／ソースの配置を先に確認する。
3. PR #9の変更ファイル一覧を確認し、既存ルートファイルと`CNAME`が変更されていないことを確認する。
4. Firebase `html-viewer-703b6` のAuthentication／Firestoreルール／管理者クレームを確認する。
5. リリース後に公開閲覧と管理者保存の実機検証を行う。想定外の挙動ではGitHubの以前のコミットへ戻して静的サイトを復旧する。

## Firebase Hosting独立プレビューとの関係

Firebase Hosting独立プレビューはGitHub Pagesの正式配信とは別の**任意の検証経路**として保持する。GitHub Pagesが実際の配信元と確認されれば、本番反映にFirebase Hostingのプロジェクト・ドメイン移行は不要。
