## Firebase活用計画：GoogleフォームとLINEリマインド連携システム

### 1. はじめに

本ドキュメントは、LINE LIFFアプリとGoogleフォーム、Google Apps Script (GAS) を連携させたリマインド自動化システムにおいて、データストアとしてFirebase (Firestore) を導入するための計画と手順をまとめたものです。無料枠（Sparkプラン）での運用を前提としています。

### 2. Firebaseプロジェクトのセットアップ（確認）

この部分は既に完了しているかと思いますが、必要な要素が揃っているか確認してください。

1.  **Firebaseプロジェクトの作成**:
    *   Firebaseコンソール ([https://console.firebase.google.com/](https://console.firebase.google.com/)) にて、プロジェクトが作成済みであること。
    *   プロジェクト名が適切であること。
2.  **Firestoreデータベースの作成**:
    *   プロジェクト内で「Firestore Database」が有効化されていること。
    *   **セキュリティルール**: 開発中は「テストモードで開始」を選択していることを確認してください。
        *   **重要**: 本番環境にデプロイする前に、必ずセキュリティルールを適切に設定し直し、不正なアクセスを防ぐ必要があります。
3.  **ウェブAPIキーの取得**:
    *   プロジェクト設定（歯車アイコン）の「全般」タブにある「**ウェブAPIキー**」を控えておくこと。これはGASからFirebaseにアクセスする際に必要になります。
    *   **重要**: このAPIキーは公開してはいけません。GASのスクリプトプロパティなどで安全に管理します。

### 3. GASとFirestoreの連携準備

Googleフォームの回答をFirestoreに保存し、またメッセージ文面をFirestoreから取得するために、GASのスクリプトを準備します。

1.  **GASプロジェクトの準備**:
    *   既存のGASプロジェクト（Googleスプレッドシートに紐付いているもの）を使用します。
    *   または、必要に応じて新しいスタンドアロンスクリプトを作成します。
2.  **Firestoreのデータ構造設計**:
    *   **フォーム回答データ**:
        *   コレクション名: `formSubmissions` (例)
        *   ドキュメント: 各フォーム送信ごとに1つのドキュメントを作成。
        *   フィールド: フォームの質問項目に対応するフィールド（例: `userId`, `name`, `lessonDate`, `submissionTime` など）。
        *   例:
            ```json
            // formSubmissions/doc12345
            {
              "userId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
              "name": "山田太郎",
              "lessonDate": "2025-07-30",
              "submissionTime": "2025-07-02T10:00:00Z"
            }
            ```
    *   **メッセージテンプレートデータ**:
        *   コレクション名: `messageTemplates` (例)
        *   ドキュメント: 各メッセージタイプごとに1つのドキュメントを作成。
        *   フィールド: メッセージの内容（テキスト、画像URL、Flex MessageのJSONなど）。
        *   例（シンプルなテキストメッセージの場合）:
            ```json
            // messageTemplates/reminder_lesson_day_before
            {
              "type": "text",
              "content": "明日はいよいよレッスンです！お忘れなく！"
            }
            ```
        *   例（Flex Messageの場合）:
            ```json
            // messageTemplates/welcome_message
            {
              "type": "flex",
              "altText": "ようこそメッセージ",
              "contents": {
                // ここにFlex MessageのJSON構造を記述
                "type": "bubble",
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "text",
                      "text": "ようこそ！"
                    }
                  ]
                }
              }
            }
            ```
3.  **GASからFirestoreへのデータ書き込み（概念）**:
    *   Googleフォームの `onFormSubmit` トリガーでGAS関数を起動します。
    *   GAS内で `UrlFetchApp` サービスを使用して、Firestore REST APIを呼び出します。
    *   フォームの回答データをJSON形式に整形し、HTTP POSTリクエストでFirestoreに送信します。
    *   **認証**: ウェブAPIキーを使用し、必要に応じてサービスアカウントキー（よりセキュアな方法）も検討しますが、無料枠・手軽さを優先するならAPIキーとセキュリティルールで制御します。
4.  **GASからFirestoreからのデータ読み込み（概念）**:
    *   LINEメッセージ送信時に、`UrlFetchApp` を使用してFirestore REST APIを呼び出します。
    *   必要なメッセージテンプレートのドキュメントをHTTP GETリクエストで取得します。
    *   取得したJSONデータをパースし、LINE Messaging APIに渡します。

### 4. Firestoreセキュリティルール

Firestoreのセキュリティルールは、誰がどのデータにアクセスできるかを定義する非常に重要な部分です。

*   **開発中**: 「テストモードで開始」で、誰でも読み書きできるように設定されています。
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if request.time < timestamp.date(2025, 7, 31); // 例: 期限付き
        }
      }
    }
    ```
*   **本番環境移行前**:
    *   `formSubmissions` コレクションには、GAS（サービスアカウント）のみが書き込み可能にする。
    *   `messageTemplates` コレクションは、GAS（サービスアカウント）のみが読み込み可能にする。
    *   ユーザーからの直接アクセスは許可しない。
    *   **重要**: セキュリティルールは慎重に設計し、テストしてください。

### 5. メッセージ文面管理

スプレッドシートの課題を解決するため、Firestoreでメッセージ文面を管理します。

*   **Firestoreでの保存**:
    *   `messageTemplates` コレクションに、メッセージの種類ごとにドキュメントを作成します。
    *   テキストメッセージ、画像メッセージ、Flex Messageなど、LINEで送信したいメッセージの形式に合わせてJSON構造で保存します。
*   **GASからの利用**:
    *   GASのスクリプト内で、送信したいメッセージのID（ドキュメントID）を指定してFirestoreから取得します。
    *   取得したJSONデータをそのままLINE Messaging APIのペイロードとして利用することで、複雑なメッセージも柔軟に扱えます。

### 6. 無料枠（Sparkプラン）について

Firebase Sparkプランは、以下の無料枠を提供しています（2025年7月時点の一般的な情報。最新情報はFirebase公式ドキュメントで確認してください）。

*   **Firestore**:
    *   保存容量: 1GB
    *   ドキュメントの読み取り: 50,000回/日
    *   ドキュメントの書き込み: 20,000回/日
    *   ドキュメントの削除: 20,000回/日
*   **Cloud Functions**:
    *   呼び出し回数: 200万回/月
    *   実行時間: 40万GB-秒/月
    *   ネットワーク下り: 5GB/月
*   **Hosting**:
    *   保存容量: 10GB
    *   データ転送: 360MB/日
*   **Authentication**:
    *   月間アクティブユーザー数: 10,000人

顧客数200人規模であれば、通常の運用であればこれらの無料枠に収まる可能性が高いです。ただし、リマインドの頻度やメッセージの種類、フォーム送信の回数によっては、Firestoreの読み書き回数やCloud Functionsの呼び出し回数が上限に達する可能性もゼロではありません。

*   **監視**: Firebaseコンソールで利用状況を定期的に監視し、無料枠を超えそうになったらアラートを設定するなどの対策を検討してください。

### 7. 次のステップ

1.  **GASからFirestoreへの接続テスト**:
    *   まずは簡単なテストデータを作成し、GASからFirestoreにデータを書き込めるか、読み込めるかを確認するスクリプトを作成します。
    *   この際、ウェブAPIキーをGASのスクリプトプロパティに設定し、スクリプト内に直接書き込まないように注意してください。
