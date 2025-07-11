// Import compat libraries to create the global `firebase` object
import 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/9.6.1/firebase-functions-compat.js';

let auth;
let functions;

// --- Utility Functions (moved to global scope) ---
function showLoading() {
  console.log("showLoading CALLED", new Error().stack.split("\n")[2].trim());
  const localSpinner = document.getElementById('loading-spinner');
  const globalSpinner = document.getElementById('global-spinner');
  if(localSpinner) localSpinner.style.display = 'flex';
  if(globalSpinner) globalSpinner.style.display = 'flex';
}
function hideLoading() {
  console.log("hideLoading CALLED", new Error().stack.split("\n")[2].trim());
  const localSpinner = document.getElementById('loading-spinner');
  const globalSpinner = document.getElementById('global-spinner');
  if(localSpinner) localSpinner.style.display = 'none';
  if(globalSpinner) globalSpinner.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async (event) => {
    try {
        const firebaseConfig = await (await fetch('/__/firebase/init.json')).json();
        // Initialize using the global firebase object
        const app = firebase.initializeApp(firebaseConfig);
        
        // Make app globally available for other scripts that might need it
        window.firebaseApp = app;

        // Initialize top-level variables
        auth = firebase.auth();
        functions = app.functions('asia-northeast1');

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
                if (user.photoURL) {
                    userInfo.photoURL.src = user.photoURL;
                }
            } else {
                // 未ログイン
                loginContainer.style.display = 'flex';
                mainContainer.style.display = 'none';
                userInfo.displayName.textContent = '';
                userInfo.photoURL.src = ''; // Clear the image
            }
        });

        // =================================================================
        // ログイン・ログアウト処理
        // =================================================================
        loginButton.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithPopup(provider).catch(error => {
                console.error("Login failed:", error);
                alert(`ログインに失敗しました: ${error.message}`);
            });
        });

        logoutButton.addEventListener('click', () => {
            firebase.auth().signOut();
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
                            <td style="padding: 8px;">${user.tags ? user.tags.join(', ') : '未設定'}</td>
                            <td style="padding: 8px;"><button class="edit-user-button" data-user-id="${user.id}">編集</button></td>
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
                if (e.target.classList.contains('edit-user-button')) {
                    const userId = e.target.dataset.userId;
                    loadPage('user-detail', { userId });
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

        /**
         * タグ管理ページの処理
         */
        const initTagsPage = () => {
            const createTagButton = document.getElementById('createTagButton');
            const newTagName = document.getElementById('newTagName');
            const newTagCategory = document.getElementById('newTagCategory');
            const createTagResult = document.getElementById('createTagResult');
            const tagsListContainer = document.getElementById('tags-list-container');
            const tagListResult = document.getElementById('tagListResult');
            const reloadTagsButton = document.getElementById('reloadTagsButton');

            // タグのレンダリング
            const renderTags = (tags) => {
                // h3以外の要素をクリア
                const header = tagsListContainer.querySelector('h3');
                tagsListContainer.innerHTML = '';
                tagsListContainer.appendChild(header);
                
                if (tags.length === 0) {
                    tagsListContainer.insertAdjacentHTML('beforeend', '<p>タグはまだ作成されていません。</p>');
                    return;
                }
                
                const groupedTags = tags.reduce((acc, tag) => {
                    const category = tag.category || '未分類';
                    if (!acc[category]) {
                        acc[category] = [];
                    }
                    acc[category].push(tag);
                    return acc;
                }, {});

                for (const category in groupedTags) {
                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'tag-group';
                    
                    let tagsHtml = `<h3>${category}</h3>`;
                    groupedTags[category].forEach(tag => {
                        tagsHtml += `
                            <div class="tag-item" data-tag-id="${tag.id}">
                                <span>${tag.name}</span>
                                <div class="tag-actions">
                                    <button class="edit-tag-button">編集</button>
                                    <button class="delete-tag-button">削除</button>
                                </div>
                            </div>
                        `;
                    });
                    groupDiv.innerHTML = tagsHtml;
                    tagsListContainer.appendChild(groupDiv);
                }
            };

            // タグの取得
            const fetchTags = async () => {
                tagListResult.textContent = 'タグを取得中...';
                const getTags = functions.httpsCallable('getTags');
                try {
                    const result = await getTags();
                    renderTags(result.data.tags);
                    tagListResult.textContent = 'タグの読み込みが完了しました。';
                } catch (error) {
                    console.error('Fetch tags error:', error);
                    tagListResult.textContent = 'タグの取得に失敗しました: ' + error.message;
                }
            };

            // 更新ボタンのクリックイベント
            reloadTagsButton.addEventListener('click', fetchTags);

            // 新規タグ作成
            createTagButton.addEventListener('click', async () => {
                const name = newTagName.value;
                const category = newTagCategory.value;
                if (!name || !category) {
                    createTagResult.textContent = 'タグ名とカテゴリを入力してください。';
                    return;
                }
                createTagResult.textContent = '作成中...';
                const createTag = functions.httpsCallable('createTag');
                try {
                    await createTag({ name, category });
                    createTagResult.textContent = 'タグを作成しました。';
                    newTagName.value = '';
                    newTagCategory.value = '';
                    fetchTags(); // リストを再読み込み
                } catch (error) {
                    console.error('Create tag error:', error);
                    createTagResult.textContent = '作成に失敗しました: ' + error.message;
                }
            });

            // 編集・削除ボタンの処理 (イベント委任)
            tagsListContainer.addEventListener('click', async (e) => {
                const target = e.target;
                const tagItem = target.closest('.tag-item');
                if (!tagItem) return;
                
                const tagId = tagItem.dataset.tagId;
                const tagName = tagItem.querySelector('span').textContent;

                if (target.classList.contains('edit-tag-button')) {
                    const newName = prompt('新しいタグ名を入力してください:', tagName);
                    if (!newName) return;
                    
                    const currentCategory = tagItem.closest('.tag-group').querySelector('h3').textContent;
                    const newCategory = prompt('新しいカテゴリ名を入力してください:', currentCategory);
                    if (!newCategory) return;

                    const updateTag = functions.httpsCallable('updateTag');
                    try {
                        await updateTag({ id: tagId, name: newName, category: newCategory });
                        fetchTags();
                    } catch (error) {
                         console.error('Update tag error:', error);
                         alert('更新に失敗しました: ' + error.message);
                    }
                }

                if (target.classList.contains('delete-tag-button')) {
                    if (!confirm(`タグ「${tagName}」を本当に削除しますか？`)) return;

                    const deleteTag = functions.httpsCallable('deleteTag');
                    try {
                        await deleteTag({ id: tagId });
                        fetchTags();
                    } catch (error) {
                        console.error('Delete tag error:', error);
                        alert('削除に失敗しました: ' + error.message);
                    }
                }
            });
            
            // 初期表示は行わない
            // fetchTags();
        };

        /**
         * ユーザー詳細ページの処理
         */
        const initUserDetailPage = (params) => {
            const userId = params.userId;
            if (!userId) {
                contentArea.innerHTML = '<p style="color: red;">ユーザーIDが指定されていません。</p>';
                return;
            }

            // DOM要素
            const userDisplayName = document.getElementById('userDisplayName');
            const tagsCheckboxContainer = document.getElementById('tags-checkbox-container');
            const saveUserTagsButton = document.getElementById('saveUserTagsButton');
            const saveResult = document.getElementById('saveResult');
            
            // データの取得
            const fetchData = async () => {
                try {
                    // ユーザー情報と全タグを並行して取得
                    const getUserDetails = functions.httpsCallable('getUserDetails');
                    const getTags = functions.httpsCallable('getTags');

                    const [userResult, tagsResult] = await Promise.all([
                        getUserDetails({ userId }),
                        getTags()
                    ]);

                    const user = userResult.data.user;
                    const allTags = tagsResult.data.tags;

                    // 画面に描画
                    renderPage(user, allTags);

                } catch (error) {
                    console.error('Failed to fetch data for user detail page:', error);
                    contentArea.innerHTML = `<p style="color: red;">データの読み込みに失敗しました: ${error.message}</p>`;
                }
            };
            
            // 画面の描画
            const renderPage = (user, allTags) => {
                userDisplayName.textContent = user.displayName;
                tagsCheckboxContainer.innerHTML = ''; // コンテナをクリア
                
                const userTags = user.tags || [];

                const groupedTags = allTags.reduce((acc, tag) => {
                    const category = tag.category || '未分類';
                    if (!acc[category]) {
                        acc[category] = [];
                    }
                    acc[category].push(tag);
                    return acc;
                }, {});

                for (const category in groupedTags) {
                    const groupDiv = document.createElement('div');
                    groupDiv.className = 'tag-category-group';
                    let innerHTML = `<h3>${category}</h3><div class="tag-checkbox-list">`;

                    groupedTags[category].forEach(tag => {
                        const isChecked = userTags.includes(tag.name);
                        innerHTML += `
                            <div class="tag-checkbox-item">
                                <input type="checkbox" id="tag-${tag.id}" value="${tag.name}" ${isChecked ? 'checked' : ''}>
                                <label for="tag-${tag.id}">${tag.name}</label>
                            </div>
                        `;
                    });

                    innerHTML += `</div>`;
                    groupDiv.innerHTML = innerHTML;
                    tagsCheckboxContainer.appendChild(groupDiv);
                }
            };

            // 保存処理
            saveUserTagsButton.addEventListener('click', async () => {
                const selectedTags = [];
                tagsCheckboxContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                    selectedTags.push(checkbox.value);
                });

                saveResult.textContent = '保存中...';
                const updateUserTags = functions.httpsCallable('updateUserTags');
                try {
                    await updateUserTags({ userId, tags: selectedTags });
                    saveResult.textContent = 'タグを保存しました。';
                    saveResult.style.color = 'green';
                } catch (error) {
                    console.error('Failed to save user tags:', error);
                    saveResult.textContent = `保存に失敗しました: ${error.message}`;
                    saveResult.style.color = 'red';
                }
            });

            // 初期データ取得
            fetchData();
        };

        // =================================================================
        // ページの動的読み込み
        // =================================================================
        const pageInitializers = {
            'users': initUsersPage,
            'submissions': initSubmissionsPage,
            'messaging': initMessagingPage,
            'tags': initTagsPage,
            'user-detail': initUserDetailPage,
            'rich-menu-list': async () => {
                try {
                    await loadRichMenuList();
                } catch (e) {
                    console.error("Failed to execute loadRichMenuList", e);
                } finally {
                    console.log("[DEBUG] Initializer's finally block reached. Calling hideLoading.");
                    hideLoading(); // Ensure spinner is hidden
                }
            },
            'rich-menu-editor': () => {} // Do nothing, handled by module in HTML
        };
        
        let currentPage = '';
        const eventListeners = new AbortController(); // イベントリスナーを管理

        const loadPage = async (page, params = {}) => {
            if (page === 'rich-menu-editor') {
                window.currentPageParams = params;
            }

            try {
                showLoading();
                const response = await fetch(`pages/${page}.html`);
                if (!response.ok) throw new Error(`ページの読み込みに失敗しました: ${response.statusText}`);
                
                contentArea.innerHTML = await response.text();

                if (pageInitializers[page]) {
                    pageInitializers[page](params);
                }

            } catch (error) {
                console.error('Page loading error:', error);
                contentArea.innerHTML = `<p style="color: red;">${error.message}</p>`;
            } finally {
                hideLoading();
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

        // 「一覧に戻る」ボタンなどの動的な要素に対応するためのイベントリスナー
        contentArea.addEventListener('click', (e) => {
            if (e.target.id === 'backToListButton') {
                loadPage('users');
                globalNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                globalNav.querySelector('a[data-page="users"]').classList.add('active');
            } else if (e.target.id === 'backToRichMenuListButton') {
                loadPage('rich-menu-list');
                globalNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                globalNav.querySelector('a[data-page="rich-menu-list"]').classList.add('active');
            }

            // リッチメニュー作成ボタン
            if (e.target && e.target.id === 'createNewRichMenuButton') {
                loadPage('rich-menu-editor');
            }

            // リッチメニュー編集ボタン
            if (e.target && e.target.classList.contains('btn-edit-rich-menu')) {
                const richMenuId = e.target.dataset.id;
                loadPage('rich-menu-editor', { richMenuId });
            }
        });

    } catch (e) {
        console.error('App initialization failed:', e);
        document.body.innerHTML = 'アプリケーションの初期化に失敗しました。コンソールを確認してください。';
    }
}); 

/**
 * =================================================================
 * リッチメニュー管理 (Rich Menu)
 * =================================================================
 */

// リッチメニューリストを読み込んで表示する
async function loadRichMenuList() {
  const tableBody = document.querySelector('#richMenuListTable tbody');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  // showLoading(); // This will be handled by the caller (loadPage)

  try {
    const getRichMenuList = functions.httpsCallable('getRichMenuList');
    const result = await getRichMenuList();
    const richMenus = result.data.richMenus;

    if (richMenus.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">リッチメニューがありません。</td></tr>';
      return;
    }
    
    const downloadRichMenuImage = functions.httpsCallable('downloadRichMenuImage');

    const rowPromises = richMenus.map(async (menu) => {
      // Initialize with a default value.
      let imageCellHtml = '<small class="text-muted">画像なし</small>';
      
      try {
        const imageResult = await downloadRichMenuImage({ richMenuId: menu.richMenuId });
        
        if (imageResult.data.success) {
          const imageBase64 = imageResult.data.imageBase64;
          // Only overwrite if the download was successful and we have an image.
          if (imageBase64) {
            imageCellHtml = `<img src="data:image/png;base64,${imageBase64}" class="img-fluid" style="max-width: 150px; max-height: 100px;"/>`;
          }
        } else {
          // Log the friendly message from the server on why it failed
          console.warn(`Could not load image for ${menu.richMenuId}: ${imageResult.data.message}`);
        }
      } catch (error) {
        // This case handles if the callable function itself fails
        console.error(`Error calling downloadRichMenuImage for ${menu.richMenuId}:`, error);
      }
      
      return `
        <tr>
          <td class="text-center align-middle" style="width: 200px;">${imageCellHtml}</td>
          <td class="align-middle">${menu.name}</td>
          <td class="align-middle"><small>${menu.richMenuId}</small></td>
          <td class="align-middle">${menu.size.width}x${menu.size.height}</td>
          <td class="align-middle">
            <button class="btn btn-sm btn-info btn-edit-rich-menu" data-id="${menu.richMenuId}">編集</button>
            <button class="btn btn-sm btn-danger btn-delete-rich-menu" data-id="${menu.richMenuId}">削除</button>
          </td>
        </tr>
      `;
    });

    const rowsHtml = (await Promise.all(rowPromises)).join('');
    tableBody.innerHTML = rowsHtml;

    // Re-add event listeners
    document.querySelectorAll('.btn-delete-rich-menu').forEach(button => {
        button.addEventListener('click', handleDeleteRichMenu);
    });
    document.querySelectorAll('.btn-edit-rich-menu').forEach(button => {
        button.addEventListener('click', (e) => {
            const richMenuId = e.target.dataset.id;
            loadPage('rich-menu-editor', { richMenuId });
        });
    });

  } catch (error) {
    console.error('Error loading rich menu list:', error);
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">リッチメニューの読み込みに失敗しました: ${error.message}</td></tr>`;
  }
  // No finally block here, it's handled by the caller
}

// リッチメニューの削除処理
async function handleDeleteRichMenu(event) {
    const richMenuId = event.target.dataset.id;
    if (!confirm(`リッチメニュー「${richMenuId}」を削除しますか？この操作は元に戻せません。`)) {
        return;
    }
    try {
        const deleteRichMenu = functions.httpsCallable('deleteRichMenu');
        await deleteRichMenu({ richMenuId });
        alert('リッチメニューを削除しました。');
        loadRichMenuList(); // リストを再読み込み
    } catch (error) {
        console.error('Error deleting rich menu:', error);
        alert(`リッチメニューの削除中にエラーが発生しました: ${error.message}`);
    }
}