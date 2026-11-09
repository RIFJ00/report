# 政策リサーチ 営業管理 v1.65 導入・動作確認

本修正は管理者用の企業マスタ登録機能、登録済み企業の修正・削除、CSV/Excel/JSON一括追加、画面幅に合わせた営業進捗KPIの横一列表示を追加します。企業マスタの既存データをGitHubに置く必要はありません。

## 1. 注意：本番公開の前に行うこと

- **現在のCloud Firestoreルールを控えとして保存してください。**
- `sales_strategy/firestore_admin_v165.rules` をFirebase ConsoleのFirestore「ルール」に貼り付け、「公開」をクリックしてください。これで通常の営業担当者は企業マスタを閲覧のみ、`companyAdmin=true` のユーザーは企業マスタの登録・編集・削除が可能になります。
- 「企業マスタ管理」はブラウザで隠しているだけではありません。Firestoreのサーバー側ルールでも管理者権限を強制します。
- 管理権限は既に権限を付与したメールアドレス `seisaku@rifj.jp` に追加します。既存の `salesAccess` を消さず、別のカスタムクレームも保持します。
- この操作はGoogle Cloud Shellの以前の管理者用フォルダー（`firebase-admin` 導入済み）から行います。Firebaseのパスワード、Googleのトークン、サービスアカウント鍵をGitHubに置かないでください。

Cloud Shellで次を実行:

```bash
export GOOGLE_CLOUD_QUOTA_PROJECT=sales-3d63b
node --input-type=module <<'NODE'
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
initializeApp({credential:applicationDefault(),projectId:'sales-3d63b'});
const auth=getAuth();
const user=await auth.getUserByEmail('seisaku@rifj.jp');
await auth.setCustomUserClaims(user.uid,{
  ...(user.customClaims||{}),
  salesAccess:true,
  companyAdmin:true
});
console.log('管理者権限を付与しました。再ログインすると反映されます。');
NODE
```

権限付与後はブラウザでログアウトしてログインし直してください。ログアウトができない場合は認証をやり直してください。

## 2. 公開ファイル

- 単体HTML: `政策リサーチ_営業管理_v1_65_企業マスタ管理.html`（別ファイルからの実行は不要、FirebaseとExcel解析ライブラリにはインターネット接続が必要）
- 複数ファイル構成: `index.html`、`app.js`、`firebase-sales.js`、`company-admin.js`、`styles.css`
- `firestore_admin_v165.rules` はCloud Firestore Console用。Webサイトの表示には直接読み込まないファイルです。
- 以前の `data.js`、`active_master.json`、企業情報を含む旧版HTMLなどを公開場所に残さないよう注意してください。GitHubの過去のコミット履歴にも旧ファイルが残る場合があります。

## 3. 管理者画面

- **個別新規登録**: 「新規入力」を押し、正式企業名と情報を入力して「企業を登録・更新」。
- **編集**: 「登録済み企業」から1社選択して、既存の情報を修正し保存。未表示の従来の詳細属性は保持されます。企業名（FirestoreドキュメントID）は編集不可です。名称変更は新規登録→営業進捗を確認→旧名削除の手順で行ってください。
- **削除**: 対象を選び、「選択企業を削除」。確認後に企業マスタから削除。**営業進捗は自動削除しません**。
- **一括登録**: CSV（UTF-8）、Excel（.xlsx/.xls）、JSONを選択。「重複チェック・追加候補を確認」で件数を表示し、「新規企業だけを登録」で実行。
- **重複防止**: 企業名をNFKC正規化、空白や法人格（前後の株式会社等）を正規化して比較。既存企業・ファイル内部で重複する社名は登録しません。**確認時のチェックは候補判定であり、法人番号に基づく厳密な同一法人識別ではありません**。同名で別法人のケースは管理者が判断してください。
- Excel解析は初回取込時にSheetJS Community Edition 0.20.3をブラウザで読み込みます。企業データ自体を外部サービスにアップロードしません。
- 一括登録済み企業に同名がある場合は**既存の情報を上書きせずスキップ**します。

## 4. 確認手順

1. 管理者アカウントでログイン → 「企業マスタ管理（管理者専用）」が表示されること。
2. 一般の営業アカウント（`salesAccess=true`、`companyAdmin` なし）では管理画面が表示されず、Firestoreでも登録・修正・削除できないこと。
3. テスト用企業を1社登録→別端末に表示→情報を更新→別端末で変更確認→削除の順に確認。
4. 同じ企業を再度追加すると重複で拒否されること。Excel/CSV内の重複と既存企業もスキップされること。
5. 旧縁あり・なしの営業トーク、成長戦略17分野の絞り込み、進捗保存、Word/PDFをそれぞれ確認。
6. 営業進捗の7件の集計カードとCSVボタンが、幅の広い画面では横一列、狭い画面では横スクロールで表示されること。

## 5. 本番反映前の未確認事項

このコードは静的な構文チェックまで確認済みですが、実際のFirebase権限、387社すべての企業データ、Excelファイルの実読込、複数端末の実動作については未検証です。運用するアカウントでテストしてからmainブランチに反映してください。
