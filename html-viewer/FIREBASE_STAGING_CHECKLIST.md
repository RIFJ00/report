# HTML Viewer Firebase実環境接続：公開前チェックリスト

対象Firebaseプロジェクト：`html-viewer-703b6`。以下の工程は**確認手順**であり、このリポジトリからFirebaseの本番設定を自動変更するものではない。

## 1. Firebaseコンソールで確認する項目

1. Firebase Console → HTML Viewer（`html-viewer-703b6`）→ Authentication → Sign-in method でGoogleプロバイダーが有効か確認。
2. Authentication → Settings → Authorized domains で**実際にログイン画面を開くステージング用のドメイン**が登録されているか確認。別FirebaseプロジェクトのAuthorized domainsを編集しない。
3. Firestore Databaseが利用可能か確認し、**現在適用中のルール全体を退避**する。
4. `html-viewer/firestore.rules.example` の`ministryArticles`ブロックだけを既存ルールへ統合する。**現在のルールを丸ごと置き換えない。**
5. 書き込みに用いるアカウントのFirebase Auth UIDを確認。管理者権限 `rifjAdmin: true` は信頼できるサーバー側のFirebase Admin SDKから付与する。HTML内やブラウザコンソールで権限を付与しない。
6. Storageに将来HTML/画像を保存する場合は別途ルールを準備する。現在はStorageの保存機能・権限テストを本番接続していない。

## 2. ステージング設定

- `html-viewer/firebase-staging-config.example.json` は**無効状態**の設定ひな形。
- `html-viewer/firebase-config.json` は引き続き **enabled: false**。GitHubに対し、このファイルを本番用に有効化した変更をマージしない。
- 実際のステージング用作業コピーでFirebase Consoleから取得したWeb SDK設定を入力する。正確なアプリID、認証ドメイン、Storage Bucket、APIキーを確認し、最後に `enabled: true` とする。
- `firebase-options.mjs` はプロジェクトID `html-viewer-703b6` 以外への誤接続を防ぐが、アクセス権限を代替しない。

## 3. 接続後の実機検証

- 未ログイン：公開記事のみ閲覧でき、下書き・非公開は閲覧できないこと
- 一般ログイン：管理画面へのログインを試みても管理者権限がないため書き込めないこと
- 管理者：明示的な操作で記事を下書き登録し、一般公開画面にはまだ表示されないこと
- 管理者：公開へ変更すると閲覧画面の再読み込み後に表示されること
- 管理者：非公開へ変更すると一般閲覧画面から消えること
- 管理者：元記事の公開日時が更新日や取り込み日で上書きされないこと
- 既存の `/`、`/blog/`、`/xpost/`、`/sales_strategy/` 等が変わらず閲覧できること
- すべての操作が成功した後も、Firebase Hostingの実際のサイトID・現在配信中の全アセットとrewrite設定を確認するまでは `report.rifj.jp` への本番デプロイを行わないこと

## 4. 今回のコードの検証

`firestore-rules-parity.test.mjs` で本番導入用ルール断片とEmulator用ルールの一致をテストする。Firestore Emulatorの権限テストと合わせて差異を検知する。これは実Firebaseプロジェクトの適用ルールを検査するものではない。

**本番未変更：** Firebase Authentication、Firestore、Storage、Hosting、DNS、GitHub `main`。

## 5. 読み取り専用の接続診断（2026-11-24追加）

管理画面 `/html-admin/` に「接続を診断（読み取り専用）」を追加した。初期状態（`enabled: false`）では「接続は無効」と表示し、Firebaseへ通信しない。

ステージング用設定を有効にした場合だけ、認証なしで `ministryArticles` の `status == published` を最大1件取得する。診断によって管理者ログイン・ルール変更・記事書き込みは行わない。

診断が失敗した場合は、権限拒否、インデックス設定、ネットワーク接続等を区別して案内する。**公開記事の読み取りに成功しても、Google管理者認証や管理用書き込み権限が確認できたことにはならない。**
