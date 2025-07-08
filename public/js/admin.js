// Import compat libraries to create the global `firebase` object
import 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js';

let auth;
let functions;

// --- Utility Functions (global scope) ---
function showLoading() {
  console.log("showLoading CALLED at " + new Error().stack.split("\n")[2].trim());
  const localSpinner = document.getElementById('loading-spinner');
  const globalSpinner = document.getElementById('global-spinner');
  if(localSpinner) localSpinner.style.display = 'flex';
  if(globalSpinner) globalSpinner.style.display = 'flex';
}
function hideLoading() {
  console.log("hideLoading CALLED at " + new Error().stack.split("\n")[2].trim());
  const localSpinner = document.getElementById('loading-spinner');
  const globalSpinner = document.getElementById('global-spinner');
  if(localSpinner) localSpinner.style.display = 'none';
  if(globalSpinner) globalSpinner.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async (event) => {
    try {
        const firebaseConfig = await (await fetch('/__/firebase/init.json')).json();
        const app = firebase.initializeApp(firebaseConfig);
        window.firebaseApp = app;

        auth = firebase.auth();
        functions = app.functions('asia-northeast1');

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
        // Page Loading Logic
        // =================================================================
        const loadPage = async (page, params = {}) => {
            showLoading();
            try {
                const response = await fetch(`pages/${page}.html`);
                if (!response.ok) throw new Error(`ページが見つかりません: ${page}.html`);
                contentArea.innerHTML = await response.text();

                if (pageInitializers[page]) {
                    await pageInitializers[page](params);
                }
            } catch (error) {
                contentArea.innerHTML = `<p class="text-danger">ページの読み込みに失敗しました: ${error.message}</p>`;
                console.error('Page load error:', error);
            } finally {
                hideLoading();
            }
        };
        window.loadPage = loadPage; // Make it globally accessible if needed, but prefer internal calls

        // =================================================================
        // Authentication
        // =================================================================
        auth.onAuthStateChanged(user => {
            if (user) {
                loginContainer.style.display = 'none';
                mainContainer.style.display = 'flex';
                userInfo.displayName.textContent = user.displayName;
                if (user.photoURL) userInfo.photoURL.src = user.photoURL;
                if (!window.location.hash) {
                    loadPage('users'); // Default page after login
                }
            } else {
                loginContainer.style.display = 'flex';
                mainContainer.style.display = 'none';
                userInfo.displayName.textContent = '';
                userInfo.photoURL.src = '';
            }
        });

        loginButton.addEventListener('click', () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(error => {
                console.error("Login failed:", error);
                alert(`ログインに失敗しました: ${error.message}`);
            });
        });

        logoutButton.addEventListener('click', () => auth.signOut());
        
        // =================================================================
        // Page Initializers
        // =================================================================
        const initUsersPage = () => {
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
                prevButton.disabled = true;
                nextButton.disabled = true;

                const getUsers = functions.httpsCallable('getUsers');
                try {
                    const result = await getUsers({ startAfterDocId: startAfter });
                    const { users, lastDocId } = result.data;

                    lastVisibleDocId = lastDocId;
                    
                    if (users.length === 0) {
                        userListResult.textContent = 'ユーザーが見つかりませんでした。';
                        prevButton.disabled = pageHistory.length === 0;
                        return;
                    }
                    
                    users.forEach(user => {
                        const row = usersTableBody.insertRow();
                        row.innerHTML = `
                            <td>${user.displayName}</td>
                            <td>${user.status}</td>
                            <td>${user.tags ? user.tags.join(', ') : '未設定'}</td>
                            <td><button class="btn btn-sm btn-primary edit-user-button" data-user-id="${user.id}">編集</button></td>
                        `;
                    });
                    
                    userListResult.textContent = `${usersTableBody.rows.length}人のユーザー情報を表示しました。`;
                    nextButton.disabled = !lastVisibleDocId;
                    prevButton.disabled = pageHistory.length === 0;

                } catch (error) {
                    console.error('Get users error:', error);
                    userListResult.textContent = 'ユーザー情報の取得に失敗しました: ' + error.message;
                }
            };

            nextButton.addEventListener('click', () => {
                if (!lastVisibleDocId) return;
                pageHistory.push(lastVisibleDocId);
                fetchUsers(lastVisibleDocId);
            });
            
            prevButton.addEventListener('click', () => {
                pageHistory.pop();
                const previousPageStartId = pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : null;
                fetchUsers(previousPageStartId);
            });

            // Initial fetch
            fetchUsers();
        };

        const initSubmissionsPage = () => {
            const submissionsTableBody = document.getElementById('submissionsTableBody');
            const submissionListResult = document.getElementById('submissionListResult');

            const fetchSubmissions = async () => {
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
                            <td>${sub.submittedAt}</td>
                            <td>${sub.displayName}</td>
                            <td>${sub.desiredClass}</td>
                        `;
                    });
                    submissionListResult.textContent = `${submissions.length}件の申込情報を表示しました。`;
                } catch (error) {
                    console.error('Get submissions error:', error);
                    submissionListResult.textContent = '申込情報の取得に失敗しました: ' + error.message;
                }
            };
            fetchSubmissions();
        };

        const initMessagingPage = () => { /* ... placeholder ... */ };
        
        const initTagsPage = () => { /* ... placeholder ... */ };

        const initUserDetailPage = (params) => {
            const userId = params.userId;
            const userDetailContainer = document.getElementById('userDetailContainer');
            if (!userId) {
                userDetailContainer.innerHTML = '<p class="text-danger">ユーザーIDが指定されていません。</p>';
                return;
            }
            // Fetch and render user details...
        };

        const pageInitializers = {
            'users': initUsersPage,
            'user-detail': initUserDetailPage,
            'submissions': initSubmissionsPage,
            'tags': initTagsPage,
            'messaging': initMessagingPage,
            'rich-menu-list': async () => {
                try {
                    await loadRichMenuList();
                } catch (e) {
                    console.error("Failed to execute loadRichMenuList", e);
                } finally {
                    console.log("[DEBUG] Initializer's finally block reached. Calling hideLoading.");
                    hideLoading();
                }
            },
            'rich-menu-editor': () => {}
        };
        window.pageInitializers = pageInitializers;

        // =================================================================
        // Navigation Handling
        // =================================================================
        globalNav.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && e.target.dataset.page) {
                e.preventDefault();
                const page = e.target.dataset.page;
                window.location.hash = page; // Use hash for navigation state
                loadPage(page);
                globalNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                e.target.classList.add('active');
            }
        });

        contentArea.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('edit-user-button')) {
                loadPage('user-detail', { userId: target.dataset.userId });
            } else if (target.id === 'backToListButton') {
                loadPage('users');
            } else if (target.id === 'createNewRichMenuButton') {
                loadPage('rich-menu-editor');
            } else if (target.classList.contains('btn-edit-rich-menu')) {
                loadPage('rich-menu-editor', { richMenuId: target.dataset.id });
            }
        });

        // Handle initial page load based on hash
        const initialPage = window.location.hash.substring(1) || 'users';
        loadPage(initialPage);
        const activeLink = globalNav.querySelector(`a[data-page="${initialPage}"]`);
        if (activeLink) activeLink.classList.add('active');


    } catch (e) {
        console.error('App initialization failed:', e);
        document.body.innerHTML = 'アプリケーションの初期化に失敗しました。コンソールを確認してください。';
    }

    // =================================================================
    // Rich Menu Management (Now inside DOMContentLoaded)
    // =================================================================
    async function loadRichMenuList() {
      const tableBody = document.querySelector('#richMenuListTable tbody');
      if (!tableBody) return;
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">読み込み中...</td></tr>';

      try {
        const getRichMenuList = functions.httpsCallable('getRichMenuList');
        const result = await getRichMenuList();
        const richMenus = result.data.richMenus;

        if (!richMenus || richMenus.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="5" class="text-center">リッチメニューがありません。</td></tr>';
          return;
        }
        
        const downloadRichMenuImage = functions.httpsCallable('downloadRichMenuImage');
        const rowPromises = richMenus.map(async (menu) => {
          let imageCellHtml = '<small class="text-muted">画像なし</small>';
          try {
            const imageResult = await downloadRichMenuImage({ richMenuId: menu.richMenuId });
            if (imageResult.data.success && imageResult.data.imageBase64) {
              imageCellHtml = `<img src="data:image/png;base64,${imageResult.data.imageBase64}" class="img-fluid" style="max-width: 150px; max-height: 100px;"/>`;
            } else {
              console.warn(`Could not load image for ${menu.richMenuId}: ${imageResult.data.message}`);
            }
          } catch (error) {
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

        document.querySelectorAll('.btn-delete-rich-menu').forEach(button => {
            button.addEventListener('click', handleDeleteRichMenu);
        });
        // Edit buttons are handled by event delegation on contentArea now.
      } catch (error) {
        console.error('Error loading rich menu list:', error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">リッチメニューの読み込みに失敗しました: ${error.message}</td></tr>`;
      }
    }

    async function handleDeleteRichMenu(event) {
        const richMenuId = event.target.dataset.id;
        if (!confirm(`リッチメニュー「${richMenuId}」を削除しますか？この操作は元に戻せません。`)) {
            return;
        }
        showLoading();
        try {
            const deleteRichMenu = functions.httpsCallable('deleteRichMenu');
            await deleteRichMenu({ richMenuId });
            alert('リッチメニューを削除しました。');
            await loadRichMenuList();
        } catch (error) {
            console.error('Error deleting rich menu:', error);
            alert(`リッチメニューの削除中にエラーが発生しました: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
}); 