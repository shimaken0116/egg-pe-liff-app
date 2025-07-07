/**
 * 個別のリッチメニューを取得する
 * @param {string} richMenuId
 * @returns {Promise<any>}
 */
export const getRichMenu = async (richMenuId) => {
  if (!window.firebaseFunctions) {
    console.error("Firebase Functions is not initialized.");
    throw new Error("Firebase Functions is not initialized.");
  }
  const func = httpsCallable(window.firebaseFunctions, "getRichMenu");
  return await func({ richMenuId });
};

/**
 * リッチメニューの画像をアップロードする
 * @param {string} richMenuId
// ... existing code ... 