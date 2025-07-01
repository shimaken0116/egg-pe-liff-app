# GitHub Pagesを利用したLIFFアプリ公開手順書

## 1. 概要

ローカルで作成した`liff_app.html`を、GitHub Pagesの機能を使って無料でインターネット上に公開し、LIFFアプリとして動作させるための手順を記します。

## 2. 事前準備

-   GitHubアカウント
-   Gitの基本的な知識（あれば尚良いですが、Web上でも完結できます）

## 3. 公開手順

### ステップ1: `liff_app.html` の編集

まず、ローカルにある `liff_app.html` を開き、2箇所のプレースホルダーを実際の値に書き換えます。

1.  `YOUR_LIFF_ID`: LINE Developersコンソールで取得した**LIFF ID**に書き換えます。
2.  `YOUR_GAS_WEB_APP_URL`: GASをデプロイして取得した**WebアプリのURL**に書き換えます。

```html
<script>
    // ...
    const LIFF_ID = "ここにあなたのLIFF IDを貼り付け"; 
    // ...
    async function sendIdTokenToGas(idToken) {
        // ...
        const GAS_URL = "ここにあなたのGASのWebアプリURLを貼り付け";
        // ...
    }
    // ...
</script>
```

### ステップ2: GitHubに新しいリポジトリを作成

1.  [GitHub](https://github.com/)にログインし、右上の「+」アイコンから「New repository」を選択します。
2.  以下の通りに設定します。
    *   **Repository name**: `liff-app` など、分かりやすい名前を入力します。
    *   **Description**: （任意）「LINE LIFF app for PROGRAM EGG」など。
    *   **Public**: **必ず `Public` を選択してください。** (`Private`リポジトリではGitHub Pagesの無料利用に制限があります)
    *   `Add a README file` にチェックを入れておくと良いでしょう。
3.  「Create repository」ボタンをクリックします。

### ステップ3: `liff_app.html` をアップロード

1.  作成したリポジトリのページで、「Add file」ボタンから「Upload files」を選択します。
2.  ファイル選択画面が表示されるので、先ほど編集した `liff_app.html` ファイルをドラッグ＆ドロップするか、選択してアップロードします。
3.  画面下の「Commit changes」ボタンをクリックして、ファイルのアップロードを確定します。

### ステップ4: GitHub Pagesを有効にする

1.  リポジトリのページの上部にある「Settings」タブをクリックします。
2.  左側のメニューから「Pages」を選択します。
3.  「Build and deployment」のセクションで、`Source` を **`Deploy from a branch`** に設定します。
4.  `Branch` の項目で、以下のように設定します。
    *   **Branch**: `main` (または `master`)
    *   **Folder**: `/(root)`
    *   **「Save」** ボタンをクリックします。
5.  ページが再読み込みされ、「Your site is live at...」というメッセージと共に、公開されたWebサイトのURLが表示されます。
    *   URLの形式: `https://<あなたのGitHubユーザー名>.github.io/<リポジトリ名>/`
    *   実際にアクセスするLIFFアプリのURLは、この末尾にファイル名を付けた `https://<あなたのGitHubユーザー名>.github.io/<リポジトリ名>/liff_app.html` となります。

### ステップ5: LIFFアプリのエンドポイントURLを更新

最後に、一番重要な設定です。

1.  [LINE Developersコンソール](https://developers.line.biz/ja/)を開き、該当のLINEログインチャネルのLIFFアプリ設定画面に移動します。
2.  **「Endpoint URL」** を、**ステップ4で取得したGitHub PagesのURL (`.../liff_app.html` の方)** に書き換えます。
3.  「更新」ボタンを押して保存します。

これで全ての準備が整いました。
LINEアプリからLIFFのURLにアクセスして、動作をテストすることができます。
