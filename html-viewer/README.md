# 省庁記事ビューワー（開発版）

閲覧画面: `/html-viewer/`

このフォルダは独立して追加されており、既存の `/blog/` `/blogimport/` `/xpost/` およびトップページは変更しません。

## 現在の実装
- `articles.json` から公開記事を読み込む（初期状態は空配列）
- タイトル・本文の文字列検索、省庁・分野による絞り込み
- 公開日（新旧）、省庁名、登録順で並び替え
- サムネイル表示、画像が無い場合は省庁名で代替表示
- 左に一覧、右に記事プレビュー。スマートフォン対応
- 出典記事と生成HTMLへのリンク
- `?id=記事ID` による個別記事選択
- 記事HTMLのプレビューは sandbox iframe に隔離（JavaScript不許可）

## 記事フィード（articles.json）

```json
[
  {
    "id": "ministry-20261124-001",
    "title": "記事の正式タイトル",
    "ministry": "文部科学省",
    "category": "教育",
    "sourceUrl": "https://www.mext.go.jp/",
    "publishedAt": "2026-11-24",
    "publishedAtSource": "source",
    "imageUrl": "",
    "summary": "記事の概要",
    "text": "記事本文（プレーンテキスト）",
    "html": "",
    "htmlUrl": "",
    "status": "published"
  }
]
```

`publishedAt` は原則として元ページの公表日を使う。公表日不明時のみ既存仕様に従ってアップロード日を採用し、`publishedAtSource: "upload"` と記録する。生成HTMLは `html`（直接埋込み）または `htmlUrl`（別ページのURL）で提供できる。公開済みの `status: "published"` のみ閲覧画面に表示する。

## 未接続の機能
- 自動取得、HTML生成、Firebase/Firestore上の既存コレクションへの接続
- 管理画面、Firebase Authの管理権限、データ更新とアクセス制御
- 省庁ページのメタデータや画像抽出

現時点では静的JSONで動作確認できる閲覧画面の土台であり、既存の生成プログラムとの連携や本番公開は未実施。データの自動取得は行わない。元記事のHTMLやリンクは信頼しないものとして扱い、安全性の確認と権限設計が必要。

## 公開前確認
1. 現行 `report.rifj.jp` のHostingプロジェクト・サイトIDとデプロイ元を確定する。
2. 本フォルダだけでなく既存サイトの全配信物を含む構成でプレビュー環境へデプロイする。
3. `/` `/blog/` `/blogimport/` `/xpost/` `/html-viewer/` を回帰確認。
4. Firestoreの公開データだけを読める安全なフィード生成を設計。
5. レビューとバックアップを経て本番に反映する。

**本番Firebase Hostingへは未デプロイ。**
