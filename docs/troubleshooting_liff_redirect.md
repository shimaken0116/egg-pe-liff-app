# LIFFアプリ リダイレクト問題のトラブルシューティング

## 1. 目標とするシステムフロー

現在構築中のシステムは、以下のフローで動作することを目指しています。

1.  ユーザーがLINEアプリ内でLIFFアプリを起動する。
2.  LIFFアプリ (`index.html`) が起動し、LINEのIDトークンを取得する。
3.  LIFFアプリが、GASでデプロイされた管理UI (`admin_config.js` Web App) にリクエストを送り、**現在設定されているGoogleフォームのURL**を動的に取得する。
4.  LIFFアプリが、取得したGoogleフォームのURLにIDトークンを付与してリダイレクトする。
5.  ユーザーはGoogleフォームで情報を入力し、送信する。
6.  Googleフォームの送信をトリガーとして、GASスクリプト (`onFormSubmit.js`) が実行される。
7.  `onFormSubmit.js`が、フォームから渡されたIDトークンを検証し、ユーザーIDを特定する。
8.  検証済みのユーザーIDとフォームデータを使って、Firestoreへのデータ保存とLINEメッセージの送信を行う。

## 2. 現在の状況と確認済み事項

*   **LIFFアプリ (`index.html`)**: GitHub Pagesにデプロイ済み。`GAS_ADMIN_CONFIG_WEB_APP_URL`からGoogleフォームのURLを動的に取得しようとするロジックが実装されている。
*   **GAS管理UI (`admin_config.js`)**: Web Appとしてデプロイ済み。`doGet`関数は、`action=getGoogleFormUrl`パラメータがあればGoogleフォームのURLを返し、なければ管理UIのHTMLを返すように修正済み。
*   **GAS (`onFormSubmit.js`)**: Googleフォームの送信トリガーで実行され、IDトークン検証、Firestoreへのデータ保存、LINEメッセージ送信が正常に動作することを確認済み。
*   **Googleフォーム**: IDトークンを受け取るための非表示フィールドが設定済み。
*   **GitHub Pages**: `index.html`がルートに配置され、通常のブラウザでアクセスするとLIFFアプリのフォーム（リダイレクト前の画面）が正しく表示されることを確認済み。

## 3. 発生している問題

*   LINEアプリ内でLIFFアプリを起動すると、**リダイレクト先が404エラー**となる。
*   404エラーのURLを見ると、**GoogleフォームのURLではなく、GAS管理UIのHTMLコードがURLエンコードされて含まれている**。

## 4. 問題の根本原因（推測）

*   GAS管理UI (`admin_config.js`) のWeb Appの実行ログを確認すると、`doGet`関数が呼び出された際に`e.parameter: {}`となっており、`action=getGoogleFormUrl`パラメータが**正しくGAS側に渡されていない**。
*   これにより、`admin_config.js`の`doGet`関数が、LIFFアプリからのリクエストを「管理UI表示」のリクエストだと誤認識し、GoogleフォームのURLではなく、管理UIのHTML全体を返してしまっている。
*   LIFFアプリは、そのHTMLコードをGoogleフォームのURLだと解釈し、リダイレクトしようとするため、404エラーが発生する。

## 5. 考えられる原因の候補

1.  **`index.html`の`GAS_ADMIN_CONFIG_WEB_APP_URL`が間違っている**: `admin_config.js`をWeb Appとしてデプロイした際に発行されたURLと完全に一致していない（特に末尾の`/exec`が抜けている、または余計な文字が入っているなど）。
2.  **LIFFアプリの変更がGitHub Pagesに反映されていない**: `index.html`の修正（`GAS_ADMIN_CONFIG_WEB_APP_URL`の設定や`console.log`の追加）が、まだGitHub Pagesに反映されていない。
3.  **LINEアプリのキャッシュがまだ残っている**: LINEアプリの内部ブラウザが古い`index.html`をキャッシュしている。

## 6. 次のデバッグステップ

問題の根本原因を特定するためには、LIFFアプリが実際に`admin_config.js`のWeb Appに送っているリクエストのURLを正確に把握する必要があります。

*   **LIFFアプリのデバッグログから、`Fetching URL:` の後に表示されるURLを教えてください。**
    *   `index.html`にはすでにこのログ出力が追加されています。
    *   LINEアプリのキャッシュをクリアした後、LIFFアプリのURL (`liff.line.me/あなたのLIFF_ID`) にアクセスし、LIFFアプリのデバッグログ（開発者ツールなど）を確認してください。

この情報があれば、問題の根本原因を特定し、解決策を提案できます。
