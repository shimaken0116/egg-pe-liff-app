# 技術スタック一覧

このドキュメントは、「PROGRAM EGG LINE拡張アプリケーション」開発プロジェクトで使用している主要な言語、ライブラリ、サービスとそのバージョンを管理するものです。

## 実行環境

| 技術 | バージョン | 備考 |
| :--- | :--- | :--- |
| Node.js | 22 | Cloud Functionsの実行環境 |

## 主要ライブラリ (バックエンド)

場所: `functions/package.json`

| ライブラリ | バージョン | 概要 |
| :--- | :--- | :--- |
| `firebase-functions` | ^6.3.2 | Cloud Functions for FirebaseのSDK |
| `firebase-admin` | ^13.4.0 | Firebase Admin SDK (Firestore等へのアクセス) |
| `@line/bot-sdk` | ^7.5.0 | LINE Messaging APIのSDK |

## インフラストラクチャ

| サービス | 概要 |
| :--- | :--- |
| Firebase | BaaS (Backend as a Service) |
| ├ Cloud Functions for Firebase | サーバーレスのバックエンド処理 |
| ├ Cloud Firestore | NoSQLデータベース |
| ├ Firebase Hosting | 静的Webホスティング (LIFF, 管理者ページ) |
| └ Cloud Secret Manager | APIキーなどの機密情報管理 |

## フロントエンド

フロントエンド開発では、特定のフレームワーク（React, Vue.jsなど）は現時点では導入せず、基本的なHTML, CSS, JavaScriptで構築する想定です。 