# PROGRAM EGG LINE拡張機能

## 1. 概要

会員制エンタメレッスンサービス「PROGRAM EGG」のLINE公式アカウントの機能を拡張するためのバックエンドおよびフロントエンドアプリケーションです。

FirebaseとLINE Messaging APIを全面的に活用し、CRM機能、セグメントメッセージ配信、LIFFアプリケーションによる申し込みフォーム、管理者向けWebページなどを提供します。

## 2. 主な機能

- **LINEユーザー情報管理 (CRM)**
  - 友だち追加・ブロックを自動検知し、ユーザー情報をFirestoreに保存。
  - ユーザーに「新規」「会員」などのタグを付与し、顧客管理を容易に。

- **セグメントメッセージ配信**
  - 管理者ページから、特定のタグを持つユーザーに絞ってメッセージを一括送信。

- **LIFF (LINE Front-end Framework)**
  - LINEアプリ内で動作するレッスン申し込みフォーム。
  - フォーム送信内容はFirestoreに自動で記録されます。

- **リッチメニューの動的切替**
  - ユーザーの`tags`フィールドに「会員」が含まれるかどうかに応じて、表示されるリッチメニューを自動で切り替えます。

- **管理者向けWebページ**
  - **認証**: Googleアカウントでログインすることで、関係者以外はアクセスできないように保護されています。
  - **機能**:
    - 会員情報（タグ含む）の一覧表示と編集。
    - メッセージの手動配信。
    - LIFFフォームからの申込内容の閲覧。

- **簡易チャットボット**
  - 特定のキーワード（例：「こんにちは」）に対して自動で応答します。

## 2.1. 実装済み機能詳細 (2024年7月時点)い

- **認証機能**: Googleアカウントによる管理者ログイン・ログアウト機能。
- **管理者ダッシュボード**:
  - 全画面表示のレスポンシブUI（ライトテーマ）。
  - サイドバーナビゲーションによる各機能へのアクセス。
- **会員管理**:
  - LINEユーザーの一覧表示。
- **申込管理**:
  - Googleフォーム経由の申込情報の一覧表示。
- **メッセージング**:
  - タグに基づいたセグメント配信機能。
- **タグ管理**:
  - タグの一覧表示、作成、更新、削除（CRUD）機能。
- **リッチメニュー管理**:
  - **一覧表示**: 既存のリッチメニューを画像プレビュー付きのカード形式で表示。
  - **作成・削除**: 管理画面からのリッチメニューの新規作成・削除。
  - **画像管理**: 背景画像のアップロード・ダウンロード。
  - **エディタ画面**: GUI編集画面への画面遷移。 (※エディタ自体の機能は現在開発中です)

## 3. 使用技術

- **バックエンド**: Cloud Functions for Firebase (Node.js)
- **データベース**: Cloud Firestore
- **フロントエンド**: Firebase Hosting (HTML, CSS, JavaScript)
- **認証**: Firebase Authentication (Google Sign-In, Anonymous Sign-In)
- **LINE Platform**: Messaging API, LIFF

## 4. プロジェクト構成

```
.
├── docs/
│   └── TROUBLESHOOTING.md  # 開発時の問題と解決策をまとめたドキュメント
├── functions/              # Cloud Functions (バックエンド) のソースコード
│   ├── index.js
│   └── package.json
├── public/                 # Firebase Hosting (フロントエンド) の公開ファイル
│   ├── admin.html          # 管理者ページ
│   └── liff-form.html      # LIFF申し込みフォーム
├── firebase.json           # Firebaseのデプロイ設定
├── .firebaserc             # Firebaseプロジェクトのエイリアス設定
└── README.md               # このファイル
```

## 5. 環境構築

新しい環境で開発を始める際の手順です。

### 5-1. 前提ツール
- [Node.js](https://nodejs.org/) (v22)
- [npm](https://www.npmjs.com/) (Node.jsに付属)
- [Firebase CLI](https://firebase.google.com/docs/cli)

### 5-2. セットアップ手順

1.  **リポジトリのクローン**
    ```bash
    git clone <repository_url>
    cd egg-pe-liff-app
    ```

2.  **Firebaseへのログイン**
    ```bash
    firebase login
    ```

3.  **Firebaseプロジェクトの選択**
    このリポジトリは既に`egg-pe-liff-app`プロジェクトに紐付いています。以下のコマンドで確認できます。
    ```bash
    firebase use
    ```
    
4.  **バックエンドの依存関係をインストール**
    ```bash
    cd functions
    npm install
    ```

5.  **LINEの機密情報を設定**
    Cloud FunctionsからLINE APIを呼び出すために、チャネルアクセストークンとチャネルシークレットをFirebaseのSecret Managerに設定します。**これらの値は絶対にGitリポジトリに含めないでください。**

    LINE Developersコンソールから取得した値を、以下のコマンドで設定します。
    ```bash
    # <YOUR_...> の部分を実際の値に置き換えてください
    firebase functions:secrets:set LINE_ACCESS_TOKEN
    firebase functions:secrets:set LINE_CHANNEL_SECRET
    ```
    コマンド実行後、プロンプトに従って値を入力します。

## 6. デプロイ

変更を本番環境に反映させるためのコマンドです。

- **全ての変更をデプロイ**
  ```bash
  firebase deploy
  ```

- **Cloud Functionsのみデプロイ**
  ```bash
  firebase deploy --only functions
  ```

- **Webフロントエンド(Hosting)のみデプロイ**
  ```bash
  firebase deploy --only hosting
  ``` 