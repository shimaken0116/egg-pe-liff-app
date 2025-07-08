// Import compat libraries to create the global `firebase` object
import 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.0/firebase-functions-compat.js';

let auth;
let functions;

const debug = true; // Set to true for verbose console logging

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
                // 1. Add cache-busting parameter to prevent loading stale html
                const response = await fetch(`pages/${page}.html?t=${new Date().getTime()}`);
                if (!response.ok) throw new Error(`ページが見つかりません: ${page}.html`);
                const htmlText = await response.text();

                // 2. Clear old content
                contentArea.innerHTML = '';

                // 3. Use DOMParser for a more robust insertion
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                Array.from(doc.body.childNodes).forEach(node => {
                    contentArea.appendChild(document.importNode(node, true));
                });

                // The above should be synchronous, but we wait one tick just in case
                await new Promise(resolve => setTimeout(resolve, 0));

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
        window.loadPage = loadPage;

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
            const container = document.getElementById('user-detail-container');
            if (!userId) {
                container.innerHTML = '<p class="text-danger">ユーザーIDが指定されていません。</p>';
                return;
            }
            
            const userDisplayName = document.getElementById('userDisplayName');
            const tagsCheckboxContainer = document.getElementById('tags-checkbox-container');
            const saveButton = document.getElementById('saveUserTagsButton');
            const saveResult = document.getElementById('saveResult');

            const loadDetails = async () => {
                tagsCheckboxContainer.innerHTML = '読み込み中...';
                try {
                    // 並列でユーザー情報と全タグリストを取得
                    const getUserDetails = functions.httpsCallable('getUserDetails');
                    const getTags = functions.httpsCallable('getTags');
                    
                    const [userDetailsRes, allTagsRes] = await Promise.all([
                        getUserDetails({ userId }),
                        getTags()
                    ]);

                    const user = userDetailsRes.data.user;
                    const allTags = allTagsRes.data.tags;

                    userDisplayName.textContent = user.displayName;
                    
                    // タグをカテゴリ別にグループ化
                    const groupedTags = allTags.reduce((acc, tag) => {
                        const category = tag.category || '未分類';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(tag);
                        return acc;
                    }, {});

                    // HTMLを生成
                    tagsCheckboxContainer.innerHTML = '';
                    for (const category in groupedTags) {
                        const groupDiv = document.createElement('div');
                        groupDiv.className = 'tag-category-group';
                        
                        let tagsHtml = `<h3>${category}</h3><div class="tag-checkbox-list">`;
                        groupedTags[category].forEach(tag => {
                            const isChecked = user.tags && user.tags.includes(tag.name);
                            tagsHtml += `
                                <div class="tag-checkbox-item">
                                    <input type="checkbox" id="tag-${tag.id}" value="${tag.name}" ${isChecked ? 'checked' : ''}>
                                    <label for="tag-${tag.id}">${tag.name}</label>
                                </div>
                            `;
                        });
                        tagsHtml += `</div>`;
                        groupDiv.innerHTML = tagsHtml;
                        tagsCheckboxContainer.appendChild(groupDiv);
                    }

                } catch (error) {
                    console.error('Failed to load user details:', error);
                    tagsCheckboxContainer.innerHTML = `<p class="text-danger">情報の読み込みに失敗しました: ${error.message}</p>`;
                }
            };
            
            saveButton.addEventListener('click', async () => {
                const selectedTags = [];
                tagsCheckboxContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                    selectedTags.push(checkbox.value);
                });

                saveResult.textContent = '保存中...';
                try {
                    const updateUserTags = functions.httpsCallable('updateUserTags');
                    await updateUserTags({ userId, tags: selectedTags });
                    saveResult.textContent = '保存しました！';
                    saveResult.className = 'text-success';
                } catch (error) {
                    console.error('Failed to save user tags:', error);
                    saveResult.textContent = `保存に失敗しました: ${error.message}`;
                    saveResult.className = 'text-danger';
                }
            });

            loadDetails();
        };

        const initRichMenuEditorPage = async (params = {}) => {
            const richMenuId = params.richMenuId;
            console.log(`Initializing Rich Menu Editor for ID: ${richMenuId || 'new'}`);

            const elements = {
                title: document.getElementById('rich-menu-editor-title'),
                nameInput: document.getElementById('richMenuName'),
                chatBarInput: document.getElementById('chatBarText'),
                isDefaultCheckbox: document.getElementById('isDefaultMenu'),
                tagsSelect: document.getElementById('targetTags'),
                tagsSpinner: document.getElementById('tags-loading-spinner'),
                templateSelector: document.querySelector('.template-selector'),
                preview: document.getElementById('rich-menu-preview'),
                imageUploadInput: document.getElementById('richMenuImageUpload'),
                uploadImageButton: document.getElementById('uploadImageButton'),
                saveButton: document.getElementById('saveRichMenuButton'),
                backButton: document.getElementById('backToRichMenuListButton'),
                actionSettings: document.getElementById('action-settings'),
            };

            for (const [key, el] of Object.entries(elements)) {
                if (!el) {
                    console.error(`Rich Menu Editor init failed: Element #${key} not found.`);
                    return; // Stop initialization
                }
            }

            const actionModal = new bootstrap.Modal(document.getElementById('actionModal'));

            let state = {
                richMenu: {
                    name: '',
                    chatBarText: '',
                    selected: true,
                    size: { width: 2500, height: 1686 },
                    areas: []
                },
                isDefault: false,
                targetTags: [],
                imageFile: null  // Will hold file object with { file, type }
            };
            
            elements.backButton.addEventListener('click', () => loadPage('rich-menu-list'));

            const renderActionAreas = (templateKey) => {
                const templates = {
                    'large_6': { class: 'rich-menu-template-large_6', areas: ['A', 'B', 'C', 'D', 'E', 'F'] },
                    'compact_4': { class: 'rich-menu-template-compact_4', areas: ['A', 'B', 'C', 'D'] }
                };
                const config = templates[templateKey];

                elements.preview.className = `rich-menu-preview ${config.class}`;
                elements.preview.innerHTML = '';
                config.areas.forEach(areaId => {
                    const areaEl = document.createElement('div');
                    areaEl.className = 'action-area';
                    areaEl.dataset.area = areaId;
                    areaEl.textContent = areaId;
                    elements.preview.appendChild(areaEl);
                });
            };

            const loadTags = async () => {
                elements.tagsSpinner.style.display = 'block';
                try {
                    const getTags = functions.httpsCallable('getTags');
                    const result = await getTags();
                    const tags = result.data.tags || [];
                    elements.tagsSelect.innerHTML = '';
                    tags.forEach(tag => {
                        const option = new Option(`${tag.category} / ${tag.name}`, tag.name);
                        elements.tagsSelect.add(option);
                    });
                } catch (error) {
                    console.error("Error loading tags:", error);
                    elements.tagsSelect.innerHTML = '<option disabled>タグの読み込みに失敗</option>';
                } finally {
                    elements.tagsSpinner.style.display = 'none';
                }
            };
            
            const populateForm = (menuData) => {
                 elements.nameInput.value = menuData.name || '';
                 elements.chatBarInput.value = menuData.chatBarText || '';
                 state.isDefault = menuData.isDefault || false;
                 elements.isDefaultCheckbox.checked = state.isDefault;

                 if (menuData.size.height === 843) {
                    renderActionAreas('compact_4');
                    elements.templateSelector.querySelector('[data-template="compact_4"]').classList.add('active');
                    elements.templateSelector.querySelector('[data-template="large_6"]').classList.remove('active');
                 } else {
                    renderActionAreas('large_6');
                 }
                 
                 // TODO: Set image preview
                 
                 // Set selected tags
                 const tagValues = menuData.targetTags || [];
                 Array.from(elements.tagsSelect.options).forEach(option => {
                    option.selected = tagValues.includes(option.value);
                 });
                 
                 // Render saved actions
                 state.richMenu.areas = menuData.areas || [];
                 elements.preview.querySelectorAll('.action-area').forEach(areaEl => {
                    const areaId = areaEl.dataset.area;
                    if (state.richMenu.areas.find(a => getAreaId(a) === areaId)) {
                        areaEl.classList.add('configured');
                    }
                 });

            };

            if (richMenuId) {
                elements.title.textContent = 'リッチメニューの編集';
                showLoading();
                await loadTags();
                try {
                    const getMenu = functions.httpsCallable('getRichMenuDetails');
                    const result = await getMenu({ menuId: richMenuId });
                    
                    const menuData = result.data;

                    if (menuData.warning) {
                        const warningDiv = document.createElement('div');
                        warningDiv.className = 'alert alert-warning mt-3';
                        warningDiv.role = 'alert';
                        warningDiv.innerHTML = `<strong><i class="bi bi-exclamation-triangle-fill"></i> 要確認:</strong> ${menuData.warning}`;
                        elements.title.parentElement.insertAdjacentElement('afterend', warningDiv);
                    }
                    
                    // Populate state from the menuData
                    state.richMenu = menuData;
                    state.isDefault = menuData.isDefault || false;
                    state.targetTags = menuData.tags || [];

                    // Populate form elements from state
                    elements.nameInput.value = state.richMenu.name || '';
                    elements.chatBarInput.value = state.richMenu.chatBarText || '';
                    elements.isDefaultCheckbox.checked = state.isDefault;

                    const template = (state.richMenu.size && state.richMenu.size.height === 843) ? 'compact_4' : 'large_6';
                    elements.templateSelector.querySelectorAll('button').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.template === template);
                    });
                    renderActionAreas(template);
                    
                    Array.from(elements.tagsSelect.options).forEach(option => {
                        option.selected = (state.targetTags || []).includes(option.value);
                    });
                     
                    elements.preview.querySelectorAll('.action-area').forEach(areaEl => {
                        const areaId = areaEl.dataset.area;
                        // A simple check to see if an action is defined for this area.
                        // This might need a more robust check based on your area definition.
                        const areaLetter = areaId; // Assuming areaId is 'A', 'B', etc.
                        if ((state.richMenu.areas || []).some(a => a.bounds.x === (areaLetter.charCodeAt(0) - 65) * (state.richMenu.size.width / 3))) {
                             areaEl.classList.add('configured');
                        }
                    });

                    // If the menu has an image, try to load it
                    if (menuData.lineRichMenuId) {
                        const downloadImage = functions.httpsCallable('downloadRichMenuImage');
                        downloadImage({ richMenuId: menuData.lineRichMenuId })
                            .then(imageResult => {
                                if (imageResult.data.success && imageResult.data.imageBase64) {
                                    elements.preview.style.backgroundImage = `url(data:image/png;base64,${imageResult.data.imageBase64})`;
                                    elements.preview.classList.add('has-image');
                                }
                            }).catch(e => console.warn("Could not load preview image.", e));
                    }

                } catch (error) {
                    console.error("Failed to load rich menu details:", error);
                    alert(`メニュー情報の読み込みに失敗しました: ${error.message}`);
                    loadPage('rich-menu-list');
                } finally {
                    hideLoading();
                }
            } else {
                elements.title.textContent = 'リッチメニューの新規作成';
                renderActionAreas('large_6');
                loadTags();
            }
            
            // Event Listeners
            elements.templateSelector.addEventListener('click', (e) => {
                if (!e.target.matches('button')) return;
                const button = e.target;
                const template = button.dataset.template;
                
                elements.templateSelector.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                
                state.richMenu.size = template === 'large_6' ? { width: 2500, height: 1686 } : { width: 2500, height: 843 };
                state.richMenu.areas = []; // Reset actions on template change
                renderActionAreas(template);
            });

            elements.uploadImageButton.addEventListener('click', () => elements.imageUploadInput.click());
            elements.imageUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Store the file object itself and its type
                state.imageFile = { file: file, type: file.type }; 

                const reader = new FileReader();
                reader.onload = (readEvent) => {
                    elements.preview.style.backgroundImage = `url(${readEvent.target.result})`;
                    elements.preview.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            });
            
            elements.saveButton.addEventListener('click', async () => {
                state.richMenu.name = elements.nameInput.value;
                state.richMenu.chatBarText = elements.chatBarInput.value;
                state.isDefault = elements.isDefaultCheckbox.checked;
                state.targetTags = Array.from(elements.tagsSelect.selectedOptions).map(o => o.value);
                
                // Construct the menu data for the backend in the expected format
                const backendMenuData = {
                    name: state.richMenu.name,
                    chatBarText: state.richMenu.chatBarText,
                    size: state.richMenu.size,
                    selected: state.richMenu.selected,
                    areas: state.richMenu.areas,
                    tags: state.targetTags,
                    isDefault: state.isDefault,
                };

                if (!backendMenuData.name || !backendMenuData.chatBarText) {
                    return alert("タイトルとメニューバーのテキストは必須です。");
                }
                
                if (!richMenuId && !state.imageFile) {
                    return alert("新規作成時は背景画像が必須です。");
                }
                
                showLoading();
                
                try {
                    const saveMenu = functions.httpsCallable('saveRichMenu');
                    const payload = {
                        menuData: backendMenuData,
                        existingMenuId: richMenuId || null,
                    };
                    
                    // We need to send image as base64 for functions
                    if (state.imageFile && state.imageFile.file) {
                        payload.imageBase64 = await toBase64(state.imageFile.file);
                        payload.imageType = state.imageFile.type;
                    }

                    await saveMenu(payload);
                    alert("リッチメニューを保存しました。");
                    loadPage('rich-menu-list');

                } catch (error) {
                    console.error("Failed to save rich menu:", error);
                    if (error.details) {
                        console.error("Server-side error details:", error.details);
                    }
                    alert(`保存に失敗しました。詳細はコンソールを確認してください。`);
                } finally {
                    hideLoading();
                }
            });
        };

        const initRichMenuListPage = () => {
            if (debug) console.log("[DEBUG] Initializer called for: rich-menu-list");

            const loadRichMenuList = async () => {
                showLoading();
                const tableBody = document.querySelector('#richMenuListTable tbody');
                if (!tableBody) {
                    console.error("Could not find table body for rich menu list.");
                    hideLoading();
                    return;
                }
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">読み込み中...</td></tr>';

                try {
                    const getList = functions.httpsCallable('getRichMenuList');
                    const result = await getList();
                    const menus = result.data.richMenus;

                    if (!menus || menus.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">登録されているリッチメニューはありません。</td></tr>';
                        return;
                    }

                    tableBody.innerHTML = ''; // Clear loading message

                    for (const menu of menus) {
                        const row = tableBody.insertRow();

                        const imageCell = row.insertCell();
                        imageCell.className = 'text-center align-middle';
                        imageCell.style.width = '200px';
                        const img = document.createElement('img');
                        img.alt = menu.name;
                        img.className = 'img-fluid';
                        img.style.maxWidth = '150px';
                        img.style.maxHeight = '100px';
                        img.src = 'https://via.placeholder.com/150x100.png?text=...'; // Placeholder
                        imageCell.appendChild(img);

                        const downloadImage = functions.httpsCallable('downloadRichMenuImage');
                        downloadImage({ richMenuId: menu.richMenuId })
                            .then(imageResult => {
                                if (imageResult.data.success && imageResult.data.imageBase64) {
                                    img.src = `data:image/png;base64,${imageResult.data.imageBase64}`;
                                } else {
                                    imageCell.innerHTML = `<small class="text-muted">画像なし</small>`;
                                }
                            })
                            .catch(error => {
                                console.error(`RPC failed for downloadRichMenuImage on ${menu.richMenuId}:`, error);
                                imageCell.innerHTML = `<small class="text-danger">読込失敗</small>`;
                            });
                        
                        row.insertCell().textContent = menu.name;
                        row.insertCell().innerHTML = `<small>${menu.richMenuId}</small>`;
                        row.insertCell().textContent = `${menu.size.width}x${menu.size.height}`;

                        const actionsCell = row.insertCell();
                        actionsCell.className = 'align-middle';
                        actionsCell.innerHTML = `
                            <button class="btn btn-sm btn-info btn-edit-rich-menu" data-id="${menu.richMenuId}">編集</button>
                            <button class="btn btn-sm btn-danger btn-delete-rich-menu" data-id="${menu.richMenuId}">削除</button>
                        `;
                    }
                } catch (error) {
                    console.error("Failed to load rich menu list:", error);
                    if(tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">リストの読み込みに失敗しました: ${error.message}</td></tr>`;
                } finally {
                    if (debug) console.log("[DEBUG] Initializer's finally block reached. Calling hideLoading.");
                    hideLoading();
                }
            };

            loadRichMenuList();

            // Event listener for the create button
            const createButton = document.getElementById('createNewRichMenuButton');
            if (createButton) {
                createButton.addEventListener('click', () => {
                    loadPage('rich-menu-editor', { richMenuId: null });
                });
            }
        };

        const pageInitializers = {
            'users': initUsersPage,
            'user-detail': initUserDetailPage,
            'submissions': initSubmissionsPage,
            'tags': initTagsPage,
            'messaging': initMessagingPage,
            'rich-menu-list': initRichMenuListPage,
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

        // Helper function to convert a File object to base64
        const toBase64 = file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });

    } catch (e) {
        console.error('App initialization failed:', e);
        document.body.innerHTML = 'アプリケーションの初期化に失敗しました。コンソールを確認してください。';
    }
}); 