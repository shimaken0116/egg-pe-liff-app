# 開発の振り返りと今後の注意点

本ドキュメントは、「PROGRAM EGG」LINE拡張機能開発プロジェクトで発生した主な技術的課題とその解決策、そして今後の開発で留意すべき点をまとめたものです。

## 1. Firebase認証の落とし穴

プロジェクトを通して最も多くの時間を費やしたのが認証関連の問題でした。特にクライアント（Webフロントエンド）とサーバー（Cloud Functions）間の連携で問題が頻発しました。

### 1-1. Callable Functionsの正しい呼び出し方

**現象**: 管理者ページやLIFFフォームからCloud Functionsを呼び出した際に、原因不明の失敗や認証エラーが発生。

**原因**: Firebase SDKの初期化とFunctionsインスタンスの取得方法の誤り。`firebase.functions()`という古い（または誤った）呼び出し方をしていました。

**解決策**:
Firebase v9以降のモジュラーSDKでは、`firebaseApp`インスタンスを明示的に指定する必要があります。
```javascript
// 正しい呼び出し方
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(firebaseApp); // 初期化したappインスタンスを渡す
const myFunction = httpsCallable(functions, 'myFunctionName');
```
この原則は、管理者ページとLIFFフォームの両方で発生した問題の根本原因でした。

### 1-2. LIFFアプリからの匿名認証

**現象**: LIFFフォームからデータを送信しようとすると、権限なしエラーで失敗する。

**原因**: LIFFページからCloud Functions (Callable)を呼び出す際、ユーザーがFirebaseに対して認証されていないため。LIFFのユーザーであることと、Firebaseの利用者であることは別です。

**解決策**:
LIFFページ読み込み時にFirebaseの**匿名認証** (`signInAnonymously`) を実行しました。これにより、一時的なFirebaseユーザーとして識別され、セキュリティルールやCallable Functionの認証チェックを通過できるようになります。

```javascript
import { getAuth, signInAnonymously } from "firebase/auth";

const auth = getAuth();
signInAnonymously(auth)
  .then(() => {
    // 匿名認証成功後、アプリの処理を続ける
  })
  .catch((error) => {
    console.error("Anonymous sign-in failed:", error);
  });
```

### 1-3. 環境変数とSecretsの使い分け (Cloud Functions)

**現象**: Cloud FunctionsからLINE APIを呼び出す際、アクセストークンが読み込めず、リッチメニューのリンクに失敗する。

**原因**: Cloud Functions (v2) のトリガー関数（Firestoreトリガーなど）とHTTPS関数（Callable, OnRequest）での環境変数・Secretsの扱いの違いを理解していなかったため。

**解決策**:
- **`firebase functions:config:set` は古い**: このコマンドで設定した値は、v1関数や`functions.config()`経由でしか安全に取得できません。
- **v2関数では `secrets` を使う**: Cloud Functionsの定義に`secrets: ["MY_SECRET_NAME"]`オプションを追加し、`process.env.MY_SECRET_NAME`でアクセスするのが推奨される方法です。これにより、関数が必要とする秘匿情報が明示的になります。
- **アクセストークンの渡し方を統一**: 当初、`linkRichMenuToUser`関数内で`functions.config()`を参照していましたが、呼び出し元の`onUserTagsUpdate`関数がv2トリガーで`secrets`を使っていたため、トークンを取得できませんでした。関数定義に`secrets`を追加し、`process.env`で読み込むように統一して解決しました。

```javascript
// v2トリガー関数での正しい実装
exports.myFunction = onDocumentUpdated({
    document: "users/{userId}",
    region: "asia-northeast1",
    secrets: ["LINE_ACCESS_TOKEN"], // ここでSecretを指定
  }, async (event) => {
    // 関数内では process.env でアクセス
    const accessToken = process.env.LINE_ACCESS_TOKEN;
    // ...
});
```

## 2. Cloud Functions for Firebase (v2) への対応

プロジェクトの途中で、v1からv2への構文変更や仕様変更に起因する問題が発生しました。

### 2-1. トリガー関数の構文変更

**現象**: Firestoreトリガー関数をデプロイしようとすると `TypeError: functions.region is not a function` というエラーが発生。

**原因**: v1世代の古い構文 (`functions.region().firestore.document().onUpdate()`) で関数を定義しようとしたため。プロジェクトで使用している`firebase-functions`ライブラリはv2世代でした。

**解決策**: v2世代の正しい構文に書き換えました。v2では、トリガーの種類ごとにモジュールが分かれています。

```javascript
// NG (v1)
// exports.myFunction = functions.region("asia-northeast1")...

// OK (v2)
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

exports.myFunction = onDocumentUpdated("users/{userId}", (event) => {
  // ...
});
```

### 2-2. 初回デプロイ時のEventarc権限エラー

**現象**: v2のFirestoreトリガーを初めてデプロイする際に `Permission denied while using the Eventarc Service Agent` という権限エラーが発生。

**原因**: v2トリガーは内部的にGoogle Cloudの**Eventarc**サービスを利用します。プロジェクトで初めてEventarcを有効にした際、関連するサービスアカウントに必要な権限（IAMロール）が付与されるまでに数分のタイムラグがあるためです。

**解決策**: **時間をおいて、再度デプロイを実行する。** エラーメッセージの指示通り、数分待ってから同じ`firebase deploy`コマンドを再実行したところ、正常にデプロイできました。これは初回のみの問題です。

## 3. フロントエンド開発の注意点

### 3-1. スクリプトの読み込み順序

**現象**: LIFFページで「LIFFアプリの読み込みに失敗しました」というエラーが発生。

**原因**: HTMLファイル内で、Firebase SDKライブラリ（`firebase-app.js`など）を読み込む`<script>`タグよりも**前に**、SDKを利用する自作のスクリプト（`liff-form.js`など）を読み込んでいたため。

**解決策**: HTML内の`<script>`タグの順序を正しく修正しました。ライブラリは常に、それを利用するコードより先に読み込む必要があります。

### 3-2. 日時のタイムゾーン変換

**現象**: 管理者ページで、Firestoreから取得した申込時刻が9時間ずれて表示される（UTCのまま）。

**原因**: Firestoreの`Timestamp`型を`toDate()`でJavaScriptの`Date`オブジェクトに変換した後、`toLocaleString()`で文字列化する際にタイムゾーンを指定していなかったため、実行環境のデフォルト（この場合はUTC）が使われていました。

**解決策**: `toLocaleString()`のオプションで、日本のタイムゾーン`Asia/Tokyo`を明示的に指定しました。

```javascript
// timestamp はFirestoreのTimestampオブジェクト
const jstString = timestamp.toDate().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
```

## まとめ

このプロジェクトの技術的な課題の多くは、**Firebaseの各サービスのバージョンアップや仕様変更への追随**と、**クライアント・サーバー間の認証という基本的ながら複雑な領域**に集中していました。

今後の開発や保守においては、以下の点を特に意識することが重要です。
- **公式ドキュメントを第一の情報源とする**: ライブラリのバージョンを確認し、必ず対応する公式ドキュメントを参照する。
- **認証と権限のフローを意識する**: 「誰が」「どこから」「どのサービスを」呼び出すのかを常に図に描き、必要な認証・認可が揃っているか確認する。
- **エラーメッセージをよく読む**: 特にCloud Functionsのデプロイエラーは、原因と解決策を示唆している場合が多い（Eventarcのエラーなど）。
- **小さな単位でデプロイ・テストする**: 複数の変更を一度に行うのではなく、機能ごと、修正ごとにデプロイして動作確認することで、問題の切り分けが容易になる。 