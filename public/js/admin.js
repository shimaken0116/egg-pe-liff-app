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
        
        const initTagsPage = () => {
            const createTagButton = document.getElementById('createTagButton');
            const newTagNameInput = document.getElementById('newTagName');
            const newTagCategoryInput = document.getElementById('newTagCategory');
            const createTagResult = document.getElementById('createTagResult');
            const tagsListContainer = document.getElementById('tags-list-container');
            const tagListResult = document.getElementById('tagListResult');
            const reloadTagsButton = document.getElementById('reloadTagsButton');

            // タグのレンダリング
            const renderTags = (tags) => {
                const header = tagsListContainer.querySelector('h3');
                tagsListContainer.innerHTML = ''; // Clear previous content
                if(header) tagsListContainer.appendChild(header);
                
                if (!tags || tags.length === 0) {
                    tagsListContainer.insertAdjacentHTML('beforeend', '<p>タグはまだ作成されていません。</p>');
                    return;
                }
                
                const groupedTags = tags.reduce((acc, tag) => {
                    const category = tag.category || '未分類';
                    if (!acc[category]) acc[category] = [];
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
                                    <button class="btn btn-sm btn-info edit-tag-button">編集</button>
                                    <button class="btn btn-sm btn-danger delete-tag-button">削除</button>
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
                try {
                    const getTags = functions.httpsCallable('getTags');
                    const result = await getTags();
                    renderTags(result.data.tags);
                    tagListResult.textContent = 'タグの読み込みが完了しました。';
                } catch (error) {
                    console.error('Fetch tags error:', error);
                    tagListResult.textContent = 'タグの取得に失敗しました: ' + error.message;
                }
            };

            reloadTagsButton.addEventListener('click', fetchTags);

            createTagButton.addEventListener('click', async () => {
                const name = newTagNameInput.value.trim();
                const category = newTagCategoryInput.value.trim();
                if (!name || !category) {
                    createTagResult.textContent = 'タグ名とカテゴリを入力してください。';
                    return;
                }
                createTagResult.textContent = '作成中...';
                try {
                    const createTag = functions.httpsCallable('createTag');
                    await createTag({ name, category });
                    createTagResult.textContent = 'タグを作成しました。';
                    newTagNameInput.value = '';
                    newTagCategoryInput.value = '';
                    fetchTags(); // Refresh list
                } catch (error) {
                    console.error('Create tag error:', error);
                    createTagResult.textContent = '作成に失敗しました: ' + error.message;
                }
            });

            // Event delegation for edit/delete buttons
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
                    
                    try {
                        const updateTag = functions.httpsCallable('updateTag');
                        await updateTag({ id: tagId, name: newName, category: newCategory });
                        fetchTags();
                    } catch (error) {
                         console.error('Update tag error:', error);
                         alert('更新に失敗しました: ' + error.message);
                    }
                }

                if (target.classList.contains('delete-tag-button')) {
                    if (!confirm(`タグ「${tagName}」を本当に削除しますか？`)) return;
                    try {
                        const deleteTag = functions.httpsCallable('deleteTag');
                        await deleteTag({ id: tagId });
                        fetchTags();
                    } catch (error) {
                        console.error('Delete tag error:', error);
                        alert('削除に失敗しました: ' + error.message);
                    }
                }
            });
            
            // Initial fetch when the page loads
            fetchTags();
        };

        const initUserDetailPage = (params) => {
            const userId = params.userId;
            const userDetailContainer = document.getElementById('userDetailContainer');
            if (!userId) {
                userDetailContainer.innerHTML = '<p class="text-danger">ユーザーIDが指定されていません。</p>';
                return;
            }
            // Fetch and render user details...
        };

        const initRichMenuEditorPage = (params = {}) => {
            const richMenuId = params.richMenuId;
            const title = document.getElementById('rich-menu-editor-title');
            
            // --- State Management ---
            let richMenuState = {
                name: '',
                chatBarText: '',
                selected: true,
                isDefault: false,
                targetTags: [],
                size: { width: 2500, height: 1686 }, // Default 'large'
                areas: [],
                imageBase64: null,
            };

            const actionModal = new bootstrap.Modal(document.getElementById('actionModal'));
            
            // --- DOM Elements ---
            const richMenuNameInput = document.getElementById('richMenuName');
            const chatBarTextInput = document.getElementById('chatBarText');
            const isDefaultCheckbox = document.getElementById('isDefaultMenu');
            const targetTagsSelect = document.getElementById('targetTags');
            const preview = document.getElementById('rich-menu-preview');
            const templateSelector = document.querySelector('.template-selector');
            const imageUploadInput = document.getElementById('richMenuImageUpload');
            const uploadImageButton = document.getElementById('uploadImageButton');
            const saveButton = document.getElementById('saveRichMenuButton');

            // --- Initial Load ---
            if (richMenuId) {
                title.textContent = 'リッチメニューの編集';
                loadRichMenuDetails(richMenuId);
            } else {
                title.textContent = 'リッチメニューの新規作成';
                initializeEditor();
            }

            function initializeEditor() {
                // Setup based on default state
                updateActionAreas('large_6'); 
                loadTags();
            }

            async function loadRichMenuDetails(id) {
                showLoading();
                try {
                    // First, try to get extended details from our Firestore DB
                    const getDetails = functions.httpsCallable('getRichMenuDetails');
                    const result = await getDetails({ richMenuId: id });
                    richMenuState = result.data.menuData;
                    
                } catch (error) {
                    console.warn(`Could not get menu details from Firestore (menu might be legacy): ${error.message}`);
                    // If not in Firestore, fetch basic details from LINE API via a different function
                    // For now, let's just initialize with the name and let user fill the rest
                    // TODO: Create a function to get basic details from LINE API
                    richMenuState.name = "読み込み失敗（要再設定）";
                    richMenuState.chatBarText = "";
                }

                // Populate form with loaded data
                richMenuNameInput.value = richMenuState.name;
                chatBarTextInput.value = richMenuState.chatBarText;
                isDefaultCheckbox.checked = richMenuState.isDefault || false;

                // TODO: Load image preview from LINE
                const template = (richMenuState.size && richMenuState.size.height === 843) ? 'compact_4' : 'large_6';
                updateActionAreas(template);
                
                // Highlight the correct template button
                templateSelector.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.template === template);
                });

                await loadTags(); // Wait for tags to load
                
                // Now set the selected tags
                const tagValues = richMenuState.targetTags || [];
                for (const option of targetTagsSelect.options) {
                    if (tagValues.includes(option.value)) {
                        option.selected = true;
                    }
                }
                
                hideLoading();
            }


            // --- Template and Action Area Logic ---
            function updateActionAreas(template) {
                const areaConfigs = {
                    large_6: { count: 6, chars: ['A', 'B', 'C', 'D', 'E', 'F'] },
                    compact_4: { count: 4, chars: ['A', 'B', 'C', 'D'] }
                };

                const config = areaConfigs[template];
                preview.innerHTML = ''; // Clear previous areas
                for (let i = 0; i < config.count; i++) {
                    const areaDiv = document.createElement('div');
                    areaDiv.className = 'action-area';
                    areaDiv.dataset.area = config.chars[i];
                    areaDiv.textContent = config.chars[i];
                    preview.appendChild(areaDiv);
                }
            }

            templateSelector.addEventListener('click', e => {
                if (e.target.tagName !== 'BUTTON') return;
                
                templateSelector.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const template = e.target.dataset.template;
                
                preview.className = 'rich-menu-preview'; // Reset classes
                preview.classList.add(`rich-menu-template-${template}`);

                richMenuState.size = template === 'large_6' ? { width: 2500, height: 1686 } : { width: 2500, height: 843 };
                updateActionAreas(template);
                richMenuState.areas = []; // Reset areas when template changes
            });


            // --- Image Upload ---
            uploadImageButton.addEventListener('click', () => imageUploadInput.click());
            imageUploadInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64String = e.target.result.split(',')[1];
                    richMenuState.imageBase64 = base64String;
                    preview.style.backgroundImage = `url('${e.target.result}')`;
                    preview.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            });

            // --- Action Modal Logic ---
            preview.addEventListener('click', e => {
                if (!e.target.classList.contains('action-area')) return;
                const areaId = e.target.dataset.area;
                preview.querySelectorAll('.action-area').forEach(area => area.classList.remove('selected'));
                e.target.classList.add('selected');
                
                const modalEl = document.getElementById('actionModal');
                if (modalEl) {
                    const actionModal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    document.getElementById('modalAreaId').textContent = areaId;
                    document.getElementById('current-editing-area').value = areaId;
                    actionModal.show();
                } else {
                    console.error("Modal element #actionModal not found!");
                }
            });

            // Moved event listener setup here to ensure it's only done once.
            document.getElementById('saveActionButton').addEventListener('click', () => {
                 const areaId = document.getElementById('current-editing-area').value;
                 alert(`Action for Area ${areaId} saved (locally)!`);
                 const modalEl = document.getElementById('actionModal');
                 const actionModal = bootstrap.Modal.getInstance(modalEl);
                 if (actionModal) {
                    actionModal.hide();
                 }
            });


            // --- Load Tags for Targeting ---
            async function loadTags() {
                tagsLoadingSpinner.style.display = 'block';
                try {
                    const getTags = functions.httpsCallable('getTags');
                    const result = await getTags();
                    const tags = result.data.tags;
                    
                    targetTagsSelect.innerHTML = '';
                    if (tags && tags.length > 0) {
                        tags.forEach(tag => {
                            const option = new Option(`${tag.category} / ${tag.name}`, tag.name);
                            targetTagsSelect.add(option);
                        });
                    } else {
                        targetTagsSelect.innerHTML = '<option disabled>利用可能なタグがありません</option>';
                    }

                } catch (error) {
                    console.error("Failed to load tags:", error);
                    targetTagsSelect.innerHTML = '<option disabled>タグの読込に失敗</option>';
                } finally {
                    tagsLoadingSpinner.style.display = 'none';
                }
            }

            // --- Save Logic ---
            saveButton.addEventListener('click', async () => {
                // 1. Collect data from form into state
                richMenuState.name = richMenuNameInput.value;
                richMenuState.chatBarText = chatBarTextInput.value;
                richMenuState.isDefault = isDefaultCheckbox.checked;
                richMenuState.targetTags = Array.from(targetTagsSelect.selectedOptions).map(opt => opt.value);
                // richMenuState.areas is updated via modal (TODO)

                // 2. Validate data
                if (!richMenuState.name || !richMenuState.chatBarText) {
                    alert('タイトルとメニューバーのテキストは必須です。');
                    return;
                }

                // 3. Call Cloud Function
                showLoading();
                try {
                    const saveMenu = functions.httpsCallable('saveRichMenu');
                    const result = await saveMenu({ 
                        richMenuId: richMenuId, // Pass existing ID if in edit mode
                        menuData: richMenuState,
                        imageBase64: richMenuState.imageBase64 // Pass the new image
                    });

                    if (result.data.success) {
                        alert('リッチメニューを保存しました！');
                        loadPage('rich-menu-list');
                    } else {
                         throw new Error(result.data.message || '不明なエラーが発生しました。');
                    }
                } catch (error) {
                    console.error("Failed to save rich menu:", error);
                    alert(`保存に失敗しました: ${error.message}`);
                } finally {
                    hideLoading();
                }
            });
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
            'rich-menu-editor': initRichMenuEditorPage,
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