# HTML Viewer 独立Hostingのプレビューチャネル公開手順

対象：Firebase Hostingサイト `html-viewer-703b6`。本番用の `report.rifj.jp` とは切り離して検証する。既存Hostingのライブチャネルにも変更を加えない。

## 現在の実装と制約

- GitHub Actionsの `preview-bundle` は `html-viewer-hosting-preview` というアーティファクトを生成する。ファイル構成は `firebase.json`、`public/index.html`、`public/html-viewer/`、`public/html-admin/`。
- `public/html-viewer/firebase-config.json` は `enabled:false` / `firebaseConfig:null`。この段階ではAuth・Firestore・Storageへの通信をしない。
- 公開するのは検証用の空記事一覧と編集画面。**URL入力だけでの自動取得・生成・Firebase保存は未接続**。
- HTML管理画面が静的配信されること自体は、Firebase Authenticationによる管理者認可の代わりにならない。HTML内の非公開情報を公開ビルドに含めない。
- **これまでの検証・CIは実際のFirebaseプロジェクトへのデプロイを行っていない**。

## 1. GitHub Actionsで検証用ファイルを取得

1. `RIFJ00/report` の開発用PRから、最新の **HTML Viewer Unit Tests** 実行を開く。
2. 5つのジョブがすべて成功していることを確認する。
3. Artifactsから **html-viewer-hosting-preview** を取得する。
4. ZIPを展開し、直下に `firebase.json` と `public/` があることを確認する。

## 2. ローカル検証

Firebase CLI（公式の `firebase-tools`）をMacにインストール済みなら、展開先の `firebase.json` のあるディレクトリで実行：

```sh
firebase --version
firebase login
firebase projects:list
firebase hosting:sites:list --project html-viewer-703b6
firebase emulators:start --only hosting --project html-viewer-703b6
```

`firebase hosting:sites:list` に `html-viewer-703b6` が存在することを必ず確認する。上記のエミュレーターはローカル動作で、本番Hostingには公開しない。

## 3. Hostingのプレビューチャネルへの公開（明示的な作業）

※ 実行者がFirebaseコンソールで対象サイトを確認し、GitHub Actionsの成功結果、展開ファイル、現在のHostingの配信元を確認してから実行する。

```sh
firebase hosting:channel:deploy rifj-html-test \
  --project html-viewer-703b6
```

**注意：** このコマンドは実際にFirebaseへデプロイし、期間限定の公開プレビューURLを発行する。ユーザーが実行・承認するまで自動実行しない。 `firebase deploy` や `firebase deploy --only hosting` はライブチャネルを更新するため、今回の検証段階では実行しない。

プレビューURLから `/html-viewer/` と `/html-admin/` を開き、公開記事件数は0件、Firebaseへの保存は無効、既存公開サイトが変わっていないことを確認する。

## 4. Firebase実データの接続は次段階

ステージング上でFirestoreを有効化する場合は、まずFirebase ConsoleでAuthenticationのGoogleログイン、許可ドメイン、Firestore本番適用ルール、サーバー側で付与する `rifjAdmin:true` の実管理者権限を確認する。今回の無効なプレビューパッケージからは自動的に有効化しない。

`report.rifj.jp` への正式公開は、配信元Firebase Hostingサイトと現行全ファイル・リライトルール・ロールバック方法を確認した後に、別工程で行う。

## 5. GitHub Actionsでの手動プレビュー（オプション）

開発ブランチには `.github/workflows/html-viewer-manual-preview.yml` を追加した。**workflow_dispatch（手動実行）専用**であり、push・PR・mainへのマージによる自動公開はしない。対象はFirebaseプロジェクトおよびHostingサイト `html-viewer-703b6`、チャンネル `rifj-html-test`、有効期限7日間で固定する。ライブチャネルへのデプロイコマンドは含まない。

実行にあたっては、GitHubの保護されたEnvironment `html-viewer-preview` の承認ルールを設定し、Firebase対象プロジェクトに必要最小限の権限を持つサービスアカウントJSONをGitHub Actions Secret `FIREBASE_SERVICE_ACCOUNT_HTML_VIEWER_PREVIEW` として登録する。**サービスアカウントJSONをHTMLやリポジトリ内のファイルに貼り付けない。** 秘密情報が未設定または対象プロジェクトが違う場合、デプロイは中止する。

GitHubのActions画面にワークフローが表示されるには、通常そのワークフローがデフォルトブランチに存在する必要がある。したがって現時点の機能ブランチだけでは、手動実行ボタンが表示されない場合がある。メインブランチへの反映は、既存ファイル保護とレビュー後に行う。アカウント権限・Secretの登録・実際のデプロイはまだ実施していない。

手動実行時の確認文字列は `PREVIEW_HTML_VIEWER_703B6`。作業ディレクトリは公開アセット専用の一時ディレクトリであり、リポジトリ全体の `firebase deploy` は使用しない。
