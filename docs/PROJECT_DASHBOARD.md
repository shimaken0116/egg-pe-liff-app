# プロジェクトダッシュボード：LINEリマインド自動化システム

## 1. プロジェクト概要
LINE LiffとGoogleフォームを連携させ、会員へのリマインドメッセージ送信を自動化するシステム。

## 2. 現在の作業フォーカス
**会員向けLINEメッセージ送信システムの構築とパーソナライズ化**

## 3. 主要コンポーネントと関連ファイル
- **LINE LIFFアプリ**: `liff_app.html`
  - ユーザーIDの取得とGoogleフォームへのリダイレクトを担当。
- **Google Apps Script (GAS)**: `src/gas/onFormSubmit.js`, `src/gas/firestore_test.js`
  - Googleフォームの送信トリガーで実行され、LINEメッセージ送信とFirestoreへのデータ保存を担当。
- **Googleフォーム**: ユーザーからの情報収集インターフェース。
- **Googleスプレッドシート**: フォーム回答の一次データストア。
- **Firestore**: フォーム回答の永続的なデータストア。

## 4. 最近の進捗
- `src/gas/onFormSubmit_debug.js` を `src/gas/onFormSubmit.js` にリネーム。
- `src/gas/onFormSubmit.js` を改修し、フォーム回答から氏名と参加希望レッスンを取得してLINEメッセージに反映するようにパーソナライズ化。
- 複数選択されたレッスン名もメッセージに含めるように対応。
- Firestoreへのフォームデータ保存機能が実装済み。

## 5. 今後の課題と次のステップ
- **【最重要】セキュリティ課題の解決**:
  - `liff_app.html` におけるLINE IDトークン検証のサーバーサイド化（GAS Web AppへのIDトークン送信とGAS側での検証）
  - `evaluation_report.md` で指摘されたセキュリティリスクへの対応。
- **GASスクリプトのデプロイ**:
  - `src/gas/onFormSubmit.js` の変更をGoogle Apps Scriptプロジェクトにデプロイする（手動操作が必要）。
- **Firestoreセキュリティルールの強化**:
  - テスト完了後、Firestoreのセキュリティルールを「テストモード」から本番運用に適したルールに強化する。
- **LINEメッセージ送信機能の拡張**:
  - リマインドメッセージのスケジュール送信機能の検討。
  - メッセージ内容のテンプレート化や管理機能の検討。
