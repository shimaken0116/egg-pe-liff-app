# プロジェクトダッシュボード: PROGRAM EGG LINE拡張アプリ

## 概要

このダッシュボードは、開発プロジェクトの進捗を管理するためのものです。

## 全体進捗

- タスク完了率: 8% (1/12)

## タスクリスト

| ID | タスク内容 | ステータス | 依存関係 |
| :--- | :--- | :--- | :--- |
| **環境構築** |
| `setup-environment` | Firebase/LINEチャネル設定 | ✅完了 | |
| **バックエンド** |
| `webhook-firestore` | LINE Webhookでユーザー情報をFirestoreに保存 | 🚧作業中 | `setup-environment` |
| `implement-crm` | CRM機能（タグ・ステータス等）の実装 | ⏳未着手 | `webhook-firestore` |
| `implement-segment-push` | セグメント配信機能の実装 | ⏳未着手 | `implement-crm` |
| `implement-chatbot` | キーワード自動応答の実装 | ⏳未着手 | `webhook-firestore` |
| `implement-richmenu` | 動的リッチメニュー機能の実装 | ⏳未着手 | `implement-crm` |
| **フロントエンド (LIFF)** |
| `create-liff-form` | LIFF申し込みフォームの作成 | ⏳未着手 | `webhook-firestore` |
| **フロントエンド (管理者ページ)** |
| `admin-auth` | 管理者ページの認証機能の実装 | ⏳未着手 | `webhook-firestore` |
| `admin-ui-base` | 管理者ページの基本UIの構築 | ⏳未着手 | `admin-auth` |
| `admin-crm-view-edit` | 【管理ページ】会員情報の閲覧・編集 | ⏳未着手 | `implement-crm`, `admin-ui-base` |
| `admin-manual-push` | 【管理ページ】手動セグメント配信 | ⏳未着手 | `implement-segment-push`, `admin-ui-base` |
| `admin-form-viewer` | 【管理ページ】フォーム申込内容の閲覧 | ⏳未着手 | `create-liff-form`, `admin-ui-base` |

</rewritten_file> 