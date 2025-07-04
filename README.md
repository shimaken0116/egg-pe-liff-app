## プロジェクト概要書：LINE LiffとGoogleフォーム連携によるリマインド自動化システム

### 1. プロジェクトの目的と背景

#### 1.1. 目的
エンタメレッスンの参加者へのリマインド業務を効率化・自動化し、手作業による負担を軽減するとともに、リマインド漏れを防ぎ、参加者の満足度向上とレッスン運営の円滑化を図る。

#### 1.2. 背景
現状、リマインド業務は手動で行われており、時間と労力がかかっている。また、ヒューマンエラーによるリマインド漏れのリスクも存在する。LINEとGoogleフォームを活用した自動化により、これらの課題を解決し、より効率的で信頼性の高い運営体制を構築する。

### 2. システムの全体像とデータフロー

#### 2.1. システム概要
本システムは、LINE Liffアプリ、Googleフォーム、Google Apps Script (GAS)、Googleスプレッドシート、LINE Messaging APIを連携させ、レッスン申込からリマインドメッセージ自動送信までの一連のプロセスを自動化する。

#### 2.2. データフロー（推奨アーキテクチャ）
1.  **ユーザーインタラクションとLIFF起動**: ユーザーがLINEアプリ内で特定のURLをタップし、LIFFアプリを起動する。
2.  **LIFFアプリでのIDトークン取得**: LIFFアプリのJavaScriptが`liff.getIDToken()`メソッドを実行し、LINEの認証サーバーによって署名されたIDトークン（JWT）を取得する。
3.  **GAS Web Appへのデータ送信**: クライアントサイドのJavaScriptから、デプロイされたGASのWeb App（`doPost(e)`関数でリクエストを処理）に対してHTTP POSTリクエストを送信する。このリクエストのボディに、取得したIDトークンとその他の申込情報（氏名、希望日時など）を含める。
4.  **サーバーサイドでのIDトークン検証**: GASのWeb Appは、受け取ったIDトークンをLINE Platformの検証エンドポイントに送信し、その正当性を確認する。
5.  **ユーザーIDの確定とデータ記録**: LINE Platformから返された検証済みのユーザー情報（`userId`など）を信頼し、その他の申込情報と共にGoogleスプレッドシートに新しい行として記録する。
6.  **リマインド処理の実行**: Googleスプレッドシート側で、フォームの送信をトリガーとする`onFormSubmit`イベントが設定されたGASが自動的に実行される。GASはスプレッドシートからデータを取得し、リマインドメッセージの内容と送信タイミングを決定する。
7.  **リマインドメッセージの送信**: GASがLINE Messaging APIのプッシュメッセージ送信エンドポイントに対し、取得した`userId`宛にリマインドメッセージを送信する。

### 3. 主要技術要素と役割

*   **LINE Liff**: ユーザーインターフェース。LINEアプリ内で動作し、ユーザー認証（IDトークン取得）と申込情報の入力インターフェースを提供する。
*   **Googleフォーム**: (推奨アーキテクチャでは直接利用しないが、申込情報の収集インターフェースとして代替手段を検討)
*   **Google Apps Script (GAS)**: バックエンドロジック。LIFFアプリからのデータ受信、IDトークン検証、スプレッドシートへのデータ記録、リマインドメッセージの送信ロジックを実装する。
*   **Googleスプレッドシート**: データストア。申込情報（ユーザーID、氏名、レッスン希望日時など）を記録・管理する。
*   **LINE Messaging API**: メッセージ送信。GASからの指示に基づき、ユーザーへリマインドメッセージをプッシュ送信する。

### 4. 開発フェーズとタスク（案）

#### フェーズ1: 環境構築と基本機能の実装
*   LINE Developersコンソールでのチャネル作成とLIFFアプリ設定
*   Google Cloud Platformでのプロジェクト設定とAPI有効化
*   GASプロジェクトの作成とWeb Appデプロイ
*   LIFFアプリからのIDトークン取得とGAS Web Appへの送信実装
*   GASでのIDトークン検証とユーザーIDの確定実装
*   検証済みユーザーIDと申込情報のスプレッドシートへの記録実装

#### フェーズ2: リマインドロジックとメッセージ送信の実装
*   スプレッドシートのデータ構造設計
*   GASでの`onFormSubmit`トリガー設定
*   リマインドメッセージの内容と送信タイミングのロジック実装
*   LINE Messaging APIを用いたプッシュメッセージ送信実装

#### フェーズ3: テストと改善
*   各機能の単体テスト、結合テスト
*   セキュリティテスト（なりすまし、データ改ざんなど）
*   ユーザーテスト（UXの確認）
*   エラーハンドリングとログ記録の強化
*   クォータ監視とアラート設定

### 5. 考慮事項とリスク

*   **セキュリティ**: IDトークン検証の厳格な実装が必須。
*   **安定性**: LINE、Googleプラットフォームの仕様変更への継続的な追随が必要。
*   **GASクォータ**: 大規模運用時のクォータ制限への対応（例: バッチ処理、有料プランへの移行検討）。
*   **UX**: LIFFアプリの同意画面、リダイレクト遅延、友だち追加の促し方。
*   **メンテナンス**: 複数プラットフォームにまたがるため、継続的なメンテナンスコストが発生。

### 6. 今後の進め方

本概要書に基づき、各フェーズの詳細なタスク洗い出し、担当者の割り当て、スケジュール策定を進める。

### 7. プロジェクト管理

#### 7.1. スケジュール
- **マイルストーン**: テスト開発完了
- **期限**: 2025年7月31日

#### 7.2. 担当者
- **開発担当**: 大島健大朗
- **レビュー担当**: 北野雄大

#### 7.3. 予算
- 当面はGoogle Apps Script等の無料枠範囲内で実装・運用を行う。

#### 7.4. 完成の定義（マイルストーン）
- フォーム機能を除く主要部分の実装を完了させる。
- 具体的には、LIFFアプリからユーザーIDを取得し、GASを介して特定のユーザーのLINEアカウントへAPI経由でメッセージを送信できることを確認する。
- 上記が完了した時点で、北野雄大氏へレビューを依頼する。
