# Googleフォーム セットアップガイド

## 1. 概要

LIFFアプリと連携させ、LINEのユーザーIDを自動的に記録するためのGoogleフォームを作成する手順を記します。

## 2. 手順

### ステップ1: Googleフォームの作成

1.  [Googleフォーム](https://docs.google.com/forms/u/0/)にアクセスし、「新しいフォームを作成」から「空白」のフォームを選択します。
2.  フォームのタイトルを「月1特別レッスン 申込フォーム」などに設定します。
3.  ユーザーに回答してほしい質問項目を追加します。
    *   **例1**: 質問「参加希望」 / 形式「チェックボックス」 / 選択肢「はい、参加を希望します」
    *   **例2**: 質問「お名前（任意）」 / 形式「記述式」
    *   その他、必要な項目を追加してください。

### ステップ2: LINEユーザーIDを記録する「隠しフィールド」の作成

これが一番重要な設定です。

1.  フォームの質問追加メニュー（右側の⊕ボタン）から、新しい質問を追加します。
2.  質問の形式を**「記述式」**にします。
3.  質問のタイトルを**「LINE User ID」**と入力します。
    *   *このタイトルは後でURLを特定するために使うので、半角英数字で、スペースを含まないこのままの名前にしてください。*
4.  この質問はユーザーに見せる必要がないため、後で非表示にします。（手順は後述）

### ステップ3: 回答先をスプレッドシートに設定

1.  フォーム編集画面の上部にある**「回答」**タブをクリックします。
2.  緑色のスプレッドシートアイコン（「スプレッドシートにリンク」）をクリックします。
3.  「回答の送信先を選択」というウィンドウで、**「既存のスプレッドシートを選択」**を選びます。
4.  「選択」ボタンを押し、以前作成した**「PROGRAM_EGG_マスター」**のスプレッドシートを選択します。
5.  これで、フォームの回答が自動的に「PROGRAM_EGG_マスター」の新しいシート（「フォームの回答 1」など）に記録されるようになります。

### ステップ4: 「隠しフィールド」のURLを取得する

1.  フォーム編集画面の右上にある**「送信」**ボタンをクリックします。
2.  送信方法の選択で、**リンクのアイコン**（🔗）を選択します。
3.  表示されたURLの横にある**「URLを短縮」にはチェックを入れず**、「コピー」をクリックします。
4.  コピーしたURLを、一度テキストエディタなどに貼り付けます。
    *   例: `https://docs.google.com/forms/d/e/ ... /viewform?usp=sf_link`
5.  このURLの末尾を、**「事前入力したURLを取得」**するための形式に書き換えます。
    *   `viewform?usp=sf_link` の部分を `prefill` に書き換えます。
    *   修正後のURL例: `https://docs.google.com/forms/d/e/ ... /prefill`
6.  修正したURLにブラウザでアクセスします。
7.  「事前入力」モードでフォームが開きます。ここで、**「LINE User ID」の欄にだけ、`test_user_id` のようなダミーのIDを入力**し、他の項目は空のまま、一番下にある**「リンクを取得」**ボタンをクリックします。
8.  画面右下に「リンクをコピー」というポップアップが表示されるので、それをクリックします。
9.  コピーされたリンクが、**「隠しフィールド」に値を渡すための特別なURL**です。このURLを安全な場所に控えておいてください。LIFFアプリの改修で使います。
    *   取得できるURLの例: `https://docs.google.com/forms/d/e/ ... /viewform?entry.1234567890=test_user_id`
    *   この `entry.1234567890` の部分が、「LINE User ID」の質問項目に対応するIDになります。

これでGoogleフォームの準備は完了です。