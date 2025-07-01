# コントリビューションガイドライン

このプロジェクトへの貢献ありがとうございます！
コードの品質と履歴の一貫性を保つため、以下のガイドラインに従ってコミットをお願いします。

## 1. Git ワークフローの基本

1.  **変更の確認**:
    作業を開始する前に、常に `git status` と `git diff` を実行して、現在の変更内容を確認してください。

    ```bash
    git status
    git diff
    ```

2.  **変更のステージング**:
    コミットに含めたいファイルのみをステージングエリアに追加します。

    ```bash
    git add <file1> <file2> ...
    # または、すべての変更をステージングする場合 (慎重に):
    # git add .
    ```

3.  **コミット**:
    以下の「コミットメッセージのガイドライン」に従って、明確で簡潔なコミットメッセージを作成し、コミットします。

    ```bash
    git commit -m "feat: Add new feature"
    # または、複数行のメッセージの場合:
    # git commit -m "feat: Add new feature
    #
    # 詳細な説明..."
    ```

4.  **プッシュ**:
    コミットが完了したら、リモートリポジトリにプッシュします。

    ```bash
    git push origin <your-branch-name>
    # 通常は 'main' ブランチにプッシュします
    # git push origin main
    ```

## 2. コミットメッセージのガイドライン

コミットメッセージは、変更の目的と内容を簡潔かつ明確に伝えるために重要です。
[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) の規約に準拠することを推奨します。

### フォーマット

```
<type>: <subject>

[optional body]

[optional footer(s)]
```

### `<type>` (必須)

変更の種類を示します。主なタイプは以下の通りです。

*   `feat`: 新機能の追加
*   `fix`: バグ修正
*   `docs`: ドキュメントのみの変更
*   `style`: コードのスタイル変更 (フォーマット、セミコロンなど、コードの動作に影響しない変更)
*   `refactor`: リファクタリング (バグ修正や機能追加ではないコード構造の変更)
*   `perf`: パフォーマンス改善
*   `test`: テストの追加または修正
*   `build`: ビルドシステムや外部依存に関する変更 (npm, yarn, gulp など)
*   `ci`: CI/CD 設定に関する変更
*   `chore`: その他の変更 (ビルドプロセスや補助ツール、ライブラリの変更など)
*   `revert`: 以前のコミットの取り消し

### `<subject>` (必須)

変更の簡潔な説明です。

*   命令形を使用します (例: "Add new feature" ではなく "Add new feature")。
*   最初の文字を大文字にします。
*   末尾にピリオドを付けません。
*   50文字以内に収めることを目指します。

### `[optional body]` (任意)

変更の詳細な説明です。

*   なぜこの変更が必要なのか、何が解決されるのか、どのような影響があるのかなどを記述します。
*   各行は72文字以内に収めることを推奨します。

### `[optional footer(s)]` (任意)

関連するIssue番号やBreaking Changesなどを記述します。

*   `Closes #123`: 関連するIssueを閉じる場合。
*   `BREAKING CHANGE: ...`: 破壊的な変更が含まれる場合。

### 例

```
feat: Add Firebase integration for form submissions

This commit introduces the initial integration of Firebase Firestore
to store Google Form submission data. It includes:
- Addition of `saveFormDataToFirestore` function in `onFormSubmit_debug.js`.
- Creation of `firestore_test.js` for testing purposes.
- Documentation of the Firebase plan in `docs/firebase_plan.md`.
- Setup of `docs/firebase_sdk_snippets.md` for SDK code examples.

Closes #45
```
