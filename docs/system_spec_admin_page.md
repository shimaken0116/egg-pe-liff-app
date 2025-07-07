# 管理者ページシステム仕様書

## 1. 目的

本ドキュメントは、管理者ページの現在のシステム仕様を定義するものです。
開発者間の共通認識を確立し、今後の機能追加や改修における正確な指針とすることを目的とします。

## 2. システム構成図

```mermaid
graph TD
    subgraph "ユーザーデバイス"
        A[管理者ページ<br>(admin.html)]
    end

    subgraph "Google Cloud / Firebase"
        B[Firebase Hosting]
        C[Firebase Auth<br>(Google Sign-In)]
        D[Cloud Functions]
        E[Cloud Firestore]
    end

    subgraph "LINE Platform"
        F[LINE API]
    end
    
    A -- "1. HTML/JS/CSSを読込" --> B
    A -- "2. Googleアカウントでログイン" --> C
    A -- "3. 認証後、ID Tokenを保持" --> C

    A -- "4. APIリクエスト<br>(ID Tokenを付与)" --> D

    D -- "5. ID Tokenを検証" --> C
    D -- "6. Firestoreのデータを操作" --> E
    D -- "7. LINE APIを呼び出し" --> F
    
    D -- "8. 処理結果を返却" --> A

    linkStyle 0 stroke-width:2px,fill:none,stroke:green;
    linkStyle 1 stroke-width:2px,fill:none,stroke:blue;
    linkStyle 2 stroke-width:2px,fill:none,stroke:blue;
    linkStyle 3 stroke-width:2px,fill:none,stroke:red;
    linkStyle 4 stroke-width:1px,fill:none,stroke:gray,stroke-dasharray: 3;
    linkStyle 5 stroke-width:2px,fill:none,stroke:purple;
    linkStyle 6 stroke-width:2px,fill:none,stroke:orange;
    linkStyle 7 stroke-width:2px,fill:none,stroke:red;

```

## 3. 認証フロー

管理者ページの機能を利用するには、**Googleアカウントによるログイン**が必要です。

1.  ユーザーが `admin.html` にアクセスすると、ログインボタンが表示されます。
2.  ログインボタンをクリックすると、Firebase AuthenticationのGoogleプロバイダを利用したポップアップが表示されます。
3.  ユーザーがGoogleアカウントで認証に成功すると、Firebaseがユーザー情報を返却します。
4.  フロントエンドは、ログイン状態を監視し、ログインが確認でき次第、メインコンテンツを表示します。
5.  以降、バックエンド（Cloud Functions）のAPIを呼び出す際は、Firebaseが発行したID Tokenをリクエストに自動的に含めて送信します。バックエンド側ではこのID Tokenを検証し、認証済みユーザーからのリクエストであることを確認します。

**注意:** 現在のバージョンでは、LINE LIFFによる認証・ログイン機能は**実装されていません**。

## 4. フロントエンド (`public/admin.html`)

HTMLとインラインのJavaScriptで構成される単一のファイルです。
Firebase SDK（App, Auth, Functions）を利用して、バックエンドとの連携を実現しています。

### 4.1. 主要機能

-   **ログイン/ログアウト**: Googleアカウントによる認証機能。
-   **セグメント配信**: 指定した`タグ`を持つLINEユーザーに対し、一斉にテストメッセージを送信します。
-   **会員一覧**: Firestoreに登録されているユーザー情報を一覧で表示・更新します。
    -   **ページネーション**: 30件ごとにユーザー情報を区切って表示します。
    -   **タグ編集**: 各ユーザーのタグをテキスト形式（カンマ区切り）で編集し、保存できます。
-   **申込一覧**: LIFFアプリのフォームから送信された申込情報を一覧で表示します。

### 4.2. API呼び出し

`firebase.functions().httpsCallable('functionName')` を介して、以下のCloud Functionsを呼び出します。

| 機能名 | 呼び出すCloud Function | 説明 |
| :--- | :--- | :--- |
| メッセージ送信テスト | `pushMessage` | 指定タグを持つ全ユーザーにLINEメッセージを送信 |
| ユーザー情報更新 | `getUsers` | ユーザー一覧をページ単位で取得 |
| ユーザーのタグ保存 | `updateUserTags` | 特定ユーザーのタグ情報を更新 |
| 申込情報更新 | `getFormSubmissions` | フォーム申込情報を全件取得 |


## 5. バックエンド (`functions/index.js`)

Node.jsで記述されたCloud Functionsのコードです。
大きく分けて、管理者ページから呼び出されるCallable Functionsと、LINE WebhookやFirestoreのイベントをトリガーとするバックグラウンド関数に分かれます。

### 5.1. Callable Functions (管理者ページ向けAPI)

`onCall` で定義され、認証済みの管理者からの呼び出しを想定しています。
リクエストには自動的にユーザーの認証情報が含まれ、各関数の冒頭で `if (!request.auth)` のように存在チェックを行っています。

| Function名 | 入力 (request.data) | 出力 (戻り値) | 説明 |
| :--- | :--- | :--- | :--- |
| `pushMessage` | `{ tag: string, messageText: string }` | `{ success: boolean, message: string }` | 指定タグを持つユーザーにLINEメッセージを送信 |
| `getUsers` | `{ pageSize: number, startAfterDocId: string \| null }` | `{ users: User[], lastDocId: string \| null }` | ユーザー一覧をページ単位で取得 |
| `updateUserTags` | `{ userId: string, tags: string[] }` | `{ success: boolean, message: string }` | ユーザーのタグを更新 |
| `getFormSubmissions`| (なし) | `{ submissions: Submission[] }` | 全ての申込情報を取得 |

### 5.2. Webhook / Trigger Functions

| Function名 | トリガー | 説明 |
| :--- | :--- | :--- |
| `webhook` | HTTP Request (LINE Webhook) | LINEのFollow/Unfollow/Messageイベントを処理 |
| `submitLiffForm` | Callable | LIFFの申込フォームから呼び出され、申込データを保存 |
| `onUserTagsUpdate` | Firestore (usersドキュメント更新) | ユーザーのタグが変更された際、タグ内容に応じてリッチメニューを自動で切り替える |

## 6. Firestoreデータモデル

| コレクション名 | ドキュメントID | 主要フィールド | 説明 |
| :--- | :--- | :--- | :--- |
| `users` | LINE User ID | `displayName`, `status`, `tags` | LINE公式アカウントの友だちユーザー情報 |
| `formSubmissions`| 自動生成ID | `userId`, `displayName`, `desiredClass`, `submittedAt`| LIFFフォームからの申込情報 |

</rewritten_file> 