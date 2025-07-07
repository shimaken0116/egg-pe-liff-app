// This file will contain the main JavaScript logic for the admin console.
// Authentication, page loading, and event handling will be implemented here. 

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Firebaseのインスタンスを取得
        const auth = firebase.auth();
        const functions = firebase.app().functions('asia-northeast1');

        // DOM要素の取得
        const loginContainer = document.getElementById('login-container');
        const mainContainer = document.getElementById('main-container');
        const contentArea = document.getElementById('content-area');
        
        const loginButton = document.getElementById('loginButton');
        const logoutButton = document.getElementById('logoutButton');

        const userInfo = {
            displayName: document.getElementById('displayName'),
            photoURL: document.getElementById('photoURL'),
        };

        const globalNav = document.getElementById('global-nav');

        // =================================================================
        // 認証状態の監視
        // =================================================================
        auth.onAuthStateChanged(user => {
            if (user) {
                // ログイン済み
                loginContainer.style.display = 'none';
                mainContainer.style.display = 'flex';
                userInfo.displayName.textContent = user.displayName;
                userInfo.photoURL.src = user.photoURL;
            } else {
                // 未ログイン
                loginContainer.style.display = 'flex';
                mainContainer.style.display = 'none';
            }
        });

        // =================================================================
        // ログイン・ログアウト処理
        // =================================================================
        loginButton.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(error => {
                console.error("Login failed:", error);
                alert(`ログインに失敗しました: ${error.message}`);
            });
        });

        logoutButton.addEventListener('click', () => {
            auth.signOut();
        });
        
        // =================================================================
        // 各ページの初期化処理
        // =================================================================

        /**
         * 会員一覧ページの処理
         */
        const initUsersPage = () => {
            const getUsersButton = document.getElementById('getUsersButton');
            const usersTableBody = document.getElementById('usersTableBody');
            const userListResult = document.getElementById('userListResult');
            const prevButton = document.getElementById('prevButton');
            const nextButton = document.getElementById('nextButton');

            let lastVisibleDocId = null;
            let pageHistory = [];

            const fetchUsers = async (startAfter = null) => {
                if (!auth.currentUser) {
                    userListResult.textContent = 'エラー: ログインしていません。';
                    return;
                }
                userListResult.textContent = 'ユーザー情報を取得中...';
                usersTableBody.innerHTML = '';
                prevButton.style.display = 'none';
                nextButton.style.display = 'none';

                const getUsers = functions.httpsCallable('getUsers');
                try {
                    const result = await getUsers({ startAfterDocId: startAfter });
                    const { users, lastDocId } = result.data;

                    lastVisibleDocId = lastDocId;
                    
                    if (users.length === 0) {
                        userListResult.textContent = 'ユーザーが見つかりませんでした。';
                        prevButton.style.display = pageHistory.length > 0 ? 'inline' : 'none';
                        return;
                    }
                    
                    users.forEach(user => {
                        const row = usersTableBody.insertRow();
                        row.innerHTML = `
                            <td style="padding: 8px;">${user.displayName}</td>
                            <td style="padding: 8px;">${user.status}</td>
                            <td style="padding: 8px;"><input type="text" class="tags-input" value="${user.tags ? user.tags.join(', ') : ''}" style="width: 95%;"></td>
                            <td style="padding: 8px;"><button class="save-button" data-user-id="${user.id}">保存</button></td>
                        `;
                    });
                    
                    userListResult.textContent = `${usersTableBody.rows.length}人のユーザー情報を表示しました。`;
                    nextButton.style.display = lastVisibleDocId ? 'inline' : 'none';
                    prevButton.style.display = pageHistory.length > 0 ? 'inline' : 'none';

                } catch (error) {
                    console.error('Get users error:', error);
                    userListResult.textContent = 'ユーザー情報の取得に失敗しました: ' + error.message;
                }
            };

            getUsersButton.addEventListener('click', () => {
                lastVisibleDocId = null;
                pageHistory = [];
                fetchUsers();
            });

            nextButton.addEventListener('click', () => {
                if (!lastVisibleDocId) return;
                const currentStart = pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : null;
                if (lastVisibleDocId !== currentStart) {
                    pageHistory.push(lastVisibleDocId);
                }
                fetchUsers(lastVisibleDocId);
            });
            
            prevButton.addEventListener('click', () => {
                pageHistory.pop();
                const previousPageStartId = pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : null;
                fetchUsers(previousPageStartId);
            });

            // イベント委任で保存ボタンのクリックを処理
            contentArea.addEventListener('click', async (e) => {
                if (e.target.classList.contains('save-button')) {
                    const userId = e.target.dataset.userId;
                    const input = e.target.closest('tr').querySelector('.tags-input');
                    const newTags = input.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                    
                    userListResult.textContent = `ユーザーID: ${userId} のタグを更新中...`;
                    const updateUserTags = functions.httpsCallable('updateUserTags');
                    try {
                        await updateUserTags({ userId: userId, tags: newTags });
                        userListResult.textContent = `ユーザーID: ${userId} のタグを更新しました。`;
                    } catch (error) {
                        console.error('Update tags error:', error);
                        userListResult.textContent = 'タグの更新に失敗しました: ' + error.message;
                    }
                }
            });

            // 初期表示
            fetchUsers();
        };

        /**
         * 申込一覧ページの処理
         */
        const initSubmissionsPage = () => {
            const getSubmissionsButton = document.getElementById('getSubmissionsButton');
            const submissionsTableBody = document.getElementById('submissionsTableBody');
            const submissionListResult = document.getElementById('submissionListResult');

            const fetchSubmissions = async () => {
                if (!auth.currentUser) {
                    submissionListResult.textContent = 'エラー: ログインしていません。';
                    return;
                }
                submissionListResult.textContent = '申込情報を取得中...';
                submissionsTableBody.innerHTML = '';

                const getFormSubmissions = functions.httpsCallable('getFormSubmissions');
                try {
                    const result = await getFormSubmissions();
                    const submissions = result.data.submissions;
                    
                    if (submissions.length === 0) {
                        submissionListResult.textContent = '申込データが見つかりませんでした。';
                        return;
                    }

                    submissions.forEach(sub => {
                        const row = submissionsTableBody.insertRow();
                        row.innerHTML = `
                            <td style="padding: 8px;">${sub.submittedAt}</td>
                            <td style="padding: 8px;">${sub.displayName}</td>
                            <td style="padding: 8px;">${sub.desiredClass}</td>
                        `;
                    });
                    submissionListResult.textContent = `${submissions.length}件の申込情報を表示しました。`;

                } catch (error) {
                    console.error('Get submissions error:', error);
                    submissionListResult.textContent = '申込情報の取得に失敗しました: ' + error.message;
                }
            };
            
            getSubmissionsButton.addEventListener('click', fetchSubmissions);

            // 初期表示
            fetchSubmissions();
        };

        /**
         * セグメント配信ページの処理
         */
        const initMessagingPage = () => {
            const sendMessageButton = document.getElementById('sendMessageButton');
            const tagInput = document.getElementById('tagInput');
            const messageInput = document.getElementById('messageInput');
            const resultDiv = document.getElementById('result');

            sendMessageButton.addEventListener('click', async () => {
                if (!auth.currentUser) {
                    resultDiv.textContent = 'エラー: ログインしていません。';
                    return;
                }
                const tag = tagInput.value;
                const messageText = messageInput.value;
                
                if (!tag || !messageText) {
                    resultDiv.textContent = 'エラー: タグとメッセージ本文の両方を入力してください。';
                    return;
                }

                resultDiv.textContent = '関数を呼び出し中...';
                const pushMessage = functions.httpsCallable('pushMessage');
                try {
                    const result = await pushMessage({ tag: tag, messageText: messageText });
                    console.log('Function result:', result);
                    resultDiv.textContent = '関数の実行に成功しました: ' + JSON.stringify(result.data.message);
                } catch (error) {
                    console.error('Function error:', error);
                    resultDiv.textContent = '関数の実行に失敗しました: ' + error.message;
                }
            });
        };

        // =================================================================
        // ページの動的読み込み
        // =================================================================
        const pageInitializers = {
            'users': initUsersPage,
            'submissions': initSubmissionsPage,
            'messaging': initMessagingPage,
        };
        
        let currentPage = '';
        const eventListeners = new AbortController(); // イベントリスナーを管理

        const loadPage = async (page) => {
            if (currentPage === page) return; // 同じページは再読み込みしない
            currentPage = page;

            try {
                const response = await fetch(`pages/${page}.html`);
                if (!response.ok) throw new Error(`ページの読み込みに失敗しました: ${response.statusText}`);
                
                contentArea.innerHTML = await response.text();

                // ページに対応する初期化関数を実行
                if (pageInitializers[page]) {
                    pageInitializers[page]();
                }

            } catch (error) {
                console.error('Page loading error:', error);
                contentArea.innerHTML = `<p style="color: red;">${error.message}</p>`;
            }
        };

        globalNav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && e.target.dataset.page) {
                e.preventDefault();
                loadPage(e.target.dataset.page);

                globalNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                e.target.classList.add('active');
            }
        });

    } catch (e) {
        console.error('App initialization failed:', e);
        document.body.innerHTML = 'アプリケーションの初期化に失敗しました。コンソールを確認してください。';
    }
}); 