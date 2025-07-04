# LINE Developers セットアップ手順書

## 1. 概要

本プロジェクトで利用するLINEのプロバイダーと、以下の2つのチャネルを作成する手順を記す。

1.  **Messaging APIチャネル**: ユーザーへのリマインドメッセージ送信に使用する。
2.  **LINEログインチャネル**: LIFFアプリをホストし、ユーザーIDを取得するために使用する。

## 2. 事前準備

-   LINEアカウント

## 3. セットアップ手順

### 3.1. LINE Developersへのログインとプロバイダー作成

1.  [LINE Developersコンソール](https://developers.line.biz/ja/)にアクセスし、自身のLINEアカウントでログインする。
2.  コンソールトップで「作成」ボタンを押し、プロバイダーを作成する。
    -   **プロバイダー名**: `PROGRAMEGG` など、管理しやすい名前を入力する。

### 3.2. Messaging APIチャネルの作成

1.  作成したプロバイダーを選択し、「新規チャネル作成」から「Messaging API」を選択する。
2.  以下の項目を入力・選択する。
    -   **チャネルの種類**: Messaging API
    -   **プロバイダー**: 先ほど作成したプロバイダー
    -   **チャネル名**: `リマインド通知` など、用途がわかる名前
    -   **チャネル説明**: 「エンタメレッスンのリマインドメッセージを送信します。」など
    -   **大業種・小業種**: プロジェクトに合ったものを選択
    -   その他、アイコンや背景画像は任意で設定
3.  すべての必須項目を入力後、利用規約に同意し、「作成」ボタンをクリックする。
4.  作成後、**必ず以下の情報を控えておくこと。**
    -   `Messaging API設定`タブ > **チャネルアクセストークン（長期）**
    -   `チャネル基本設定`タブ > **チャネルシークレット**

### 3.3. LINEログインチャネルの作成

1.  再度プロバイダーのページに戻り、「新規チャネル作成」から「LINEログイン」を選択する。
2.  以下の項目を入力・選択する。
    -   **チャネルの種類**: LINEログイン
    -   **プロバイダー**: 先ほど作成したプロバイダー
    -   **チャネル名**: `申込受付` など、用途がわかる名前
    -   **チャネル説明**: 「エンタメレッスンの申込受付用LIFFアプリです。」など
    -   **アプリタイプ**: `ウェブアプリ` を選択
3.  すべての必須項目を入力後、利用規約に同意し、「作成」ボタンをクリックする。
4.  作成後、`LIFF`タブを開き、「追加」ボタンをクリックしてLIFFアプリを新規作成する。
5.  以下の項目を入力・選択する。
    -   **LIFFアプリ名**: `申込フォーム` など
    -   **サイズ**: `Full`
    -   **エンドポイントURL**: ここでは一旦ダミーのURL（例: `https://example.com`）を入力しておく。後でGASのWebアプリURLに差し替える。
    -   **Scope**: `profile`, `openid` にチェックを入れる。
    -   **ボットリンク機能**: `On (Aggressive)` に設定し、認証時にMessaging APIチャネルの友だち追加を促すようにする。
6.  作成後、**必ず以下の情報を控えておくこと。**
    -   `LIFF`タブ > 作成したLIFFアプリの **LIFF ID**

## 4. 注意事項

-   取得したアクセストークンやシークレットは、第三者に漏洩しないよう厳重に管理すること。
-   これらの情報は、後のGoogle Apps Script開発で使用する。
