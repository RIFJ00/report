# VALIDATION — v1.5.2

## アニメーション参考機能

- `animators.js` に国内21名・海外20名、計41名を登録。
- 16種類の表現ジャンルを登録。
- `index.html` にジャンル、地域、名前検索、候補選択、自由入力、説明欄を追加。
- HTML内のID重複がないことを確認。
- `animators.js` が `app.js` より前に読み込まれることを確認。
- `app.js` と `prompt.js` のJavaScript構文チェックに合格。
- 制作依頼文で、選択したアニメーター名と一般的な映像特徴が反映されることを確認。
- 画像・動画生成プロンプトでは固有名を直接コピーせず、一般化した特徴へ変換する指示が出力されることを確認。
- 小説・文章作品の制作依頼文にはアニメーション参考情報が混入しないことを確認。
- `node tests/test_animators.js` 合格。
- `node tests/test_prompt.js` 合格。

## DOCXレンダリング検証（v1.5から継承）

| テンプレート | ページ数 | 結果 |
|---|---:|---|
| short-compact.docx | 3 | 合格 |
| medium-chapter.docx | 5 | 合格 |
| long-toc-chapter.docx | 6 | 合格 |
| essay.docx | 4 | 合格 |
| nonfiction-documentary.docx | 4 | 合格 |
| column-review.docx | 1 | 合格 |
| horizontal-general.docx | 3 | 合格 |
| photo-illustration.docx | 4 | 合格 |

既存 `11point&挿絵.docx` と `12point.docx` を含む10種類のテンプレート構成はv1.5から変更していません。


## v1.5.2 UI defaults / clear-all

- `duration` の先頭選択肢が「約3分」であることを静的テスト。
- 設定・確認・結果画面に `clear-all` 操作が存在することを静的テスト。
- `clearAll()` がフォーム、検索条件、追加テンプレート、確認データ、生成依頼文を初期化するコードを確認。
- 既存の prompt / animator テストを再実行。


## v1.5.3追加検証

- `authors.js` は135名、重複名なし。
- 新規7名（戸川猪佐武、大下英治、池井戸潤、真山仁、山崎豊子、村上春樹、谷川俊太郎）を検索・選択可能。
- 宮部みゆき、松本清張、太宰治、三島由紀夫は既存登録を維持。
- `animators.js` は41名、松本零士を追加、宮崎駿の既存登録を維持。
- 初期 `wordOutput`、すべてクリア後、Word成果物を再度有効化した場合の既定値はすべて `template12`。
- `prompt.js` のフォールバックも `template12`。
