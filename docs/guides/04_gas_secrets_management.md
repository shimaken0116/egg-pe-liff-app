# GASでの機密情報管理ガイド

## 1. 概要

LINEのチャネルアクセストークンやチャネルシークレットなどの機密情報を安全に管理するため、Google Apps Scriptの「スクリプトプロパティ」機能を利用します。

## 2. スクリプトプロパティの設定手順

1.  Google Apps Scriptのエディタを開きます。
2.  左側のメニューから歯車アイコンの「プロジェクトの設定」をクリックします。
3.  画面を下にスクロールし、「スクリプト プロパティ」のセクションを見つけます。
4.  「スクリプト プロパティを追加」ボタンをクリックします。
5.  以下の要領で、キー（プロパティ）と値のペアを追加します。
    *   **プロパティ**: `LINE_CHANNEL_ACCESS_TOKEN`
    *   **値**: Messaging APIのチャネルアクセストークンを貼り付け
6.  同様に、他の機密情報も追加します。
    *   **プロパティ**: `LINE_CHANNEL_SECRET`
    *   **値**: Messaging APIのチャネルシークレットを貼り付け
    *   **プロパティ**: `LIFF_ID`
    *   **値**: LINEログインチャネルのLIFF IDを貼り付け


*(イメージ画像のURLは後で実際のスクリーンショットに差し替えることを推奨します)*

## 3. スクリプトからの値の呼び出し方

スクリプトプロパティに保存した値は、`PropertiesService`クラスを使って以下のように取得できます。

```javascript
// スクリプトプロパティを取得
const scriptProperties = PropertiesService.getScriptProperties();

// 各プロパティの値を取得
const accessToken = scriptProperties.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const channelSecret = scriptProperties.getProperty('LINE_CHANNEL_SECRET');
const liffId = scriptProperties.getProperty('LIFF_ID');

// 取得した値を使用する例
console.log(accessToken);
```

このように管理することで、コードを安全に保ちながら開発を進めることができます。
