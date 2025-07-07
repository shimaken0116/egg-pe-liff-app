import * as api from "../api.js";
import { showToast } from "../toast.js";
import { showLoading, hideLoading } from "../loading.js";

/**
 * Initializes the rich menu editor page.
 * @param {object} params - Parameters passed from the loader.
 */
export async function init(params) {
  console.log("rich-menu-editor.js (module) loaded with params:", params);
  const richMenuId = params.id;

  if (richMenuId) {
    // Edit mode
    try {
      showLoading("リッチメニューを読み込んでいます...");
      const result = await api.getRichMenu(richMenuId);
      const richMenu = result.data.richMenu;
      console.log("Loaded rich menu data:", richMenu);

      // Populate form fields with the loaded data
      document.getElementById('rich-menu-name').value = richMenu.name;
      document.getElementById('rich-menu-chat-bar-text').value = richMenu.chatBarText;
      // document.getElementById('rich-menu-selected').checked = richMenu.selected; // This will be handled later
      
      // TODO: Populate areas and image preview
      
    } catch (error) {
      console.error("Failed to load rich menu:", error);
      showToast("リッチメニューの読み込みに失敗しました。", "error");
    } finally {
      hideLoading();
    }
  } else {
    // Create mode
    console.log("Running in Create Mode");
    // Leave form fields as default
  }

  // Add event listener for the back button
  document.getElementById('backToRichMenuListButton').addEventListener('click', () => {
      // This assumes `loadPage` is globally available or passed somehow.
      // For now, we use a simple navigation approach.
      window.history.back();
  });
} 