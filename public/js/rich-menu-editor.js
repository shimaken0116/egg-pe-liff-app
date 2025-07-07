// public/js/rich-menu-editor.js
// This script assumes admin.js has already run and initialized Firebase,
// creating a global `firebase` object and `window.firebaseApp`.

// These will be initialized inside initRichMenuEditor
let functions;
let auth;

/**
 * Initializes the rich menu editor.
 * This function is called from admin.js when the editor page is loaded.
 * @param {object} params - Parameters passed from the page loader, e.g., { richMenuId: '...' }
 */
function initRichMenuEditor(params) {
    // It's now safe to get Firebase services because this is called after admin.js is ready.
    if (!functions) {
        functions = firebase.app().functions('asia-northeast1');
    }
    if (!auth) {
        auth = firebase.auth();
    }
    
    console.log("Rich Menu Editor Initialized with params:", params);

    const richMenuId = params.richMenuId;

    // DOM Elements
    const editorTitle = document.getElementById('editor-title');
    const richMenuNameInput = document.getElementById('richMenuName');
    const chatBarTextInput = document.getElementById('chatBarText');
    const imageUploadInput = document.getElementById('richMenuImageUpload');
    const imagePreview = document.getElementById('rich-menu-image-preview');
    const editorContainer = document.getElementById('rich-menu-editor-container');
    const areasList = document.getElementById('tappable-areas-list');
    const addAreaButton = document.getElementById('add-area-button');
    const saveButton = document.getElementById('saveRichMenuButton');
    
    if (richMenuId) {
        // 編集モード
        editorTitle.textContent = "リッチメニューの編集";
        loadRichMenuForEdit(richMenuId);
    } else {
        // 新規作成モード
        editorTitle.textContent = "リッチメニューの新規作成";
    }

    // イベントリスナーの設定
    imageUploadInput.addEventListener('change', handleImageUpload);
    addAreaButton.addEventListener('click', addNewArea);
    saveButton.addEventListener('click', saveRichMenu);
}

const loadRichMenuForEdit = async (richMenuId) => {
    // TODO: getRichMenuDetails関数をCloud Functionsに実装し、
    //       リッチメニューのJSONと画像を取得してフォームに設定する
    console.log(`Loading data for rich menu: ${richMenuId}`);
};

const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imagePreview = document.getElementById('rich-menu-image-preview');
            imagePreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

const addNewArea = () => {
    console.log("Adding new tappable area...");
    // TODO: 新しいタップ領域をプレビューとリストに追加するロジック
};

const saveRichMenu = async () => {
    console.log("Saving rich menu...");
    // TODO: 現在のエディタの状態からJSONを構築し、
    //       Cloud Functionsを呼び出して保存するロジック
};


// グローバルに公開
window.richMenuEditor = {
    init: initRichMenuEditor
}; 