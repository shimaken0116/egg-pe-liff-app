const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const line = require("@line/bot-sdk");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { LINEClient } = require("./line-client");

// リッチメニューIDを定数として定義
const RICH_MENU_ID_NEW_USER = "richmenu-ae60d477857b475e9a7603fa4861c738";
const RICH_MENU_ID_MEMBER = "richmenu-4ec9391d5f4bdf2bcff033cdefcfb69d";

admin.initializeApp();
const db = admin.firestore();
const lineClient = new LINEClient(db);

const REGION = "asia-northeast1";
const FUNCTION_CONFIG = {
    region: REGION,
    secrets: ["LINE_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"],
    enforceAppCheck: false,
};

// A version of config without secrets for functions that don't need them.
const FUNCTION_CONFIG_NO_SECRETS = {
    region: REGION,
    enforceAppCheck: false,
};

exports.webhook = onRequest(FUNCTION_CONFIG, async (req, res) => {
    const lineConfig = {
        channelAccessToken: process.env.LINE_ACCESS_TOKEN,
        channelSecret: process.env.LINE_CHANNEL_SECRET,
    };

    const signature = req.headers["x-line-signature"];
    if (!signature) {
        logger.error("Signature not found.");
        res.status(401).send("Signature not found.");
        return;
    }

    if (!line.validateSignature(req.rawBody, lineConfig.channelSecret, signature)) {
        logger.error("Invalid signature");
        res.status(401).send("Invalid signature");
        return;
    }

    const events = req.body.events;
    logger.info("Request body: ", req.body);
    
    if (!events) {
        logger.warn("Request body does not contain events.");
        res.status(200).send("OK");
        return;
    }

    const client = new line.Client(lineConfig);
    for (const event of events) {
        if (event.type === "follow") {
            await handleFollowEvent(event, client);
        } else if (event.type === "unfollow") {
            await handleUnfollowEvent(event);
        } else if (event.type === "message" && event.message.type === "text") {
            await handleMessageEvent(event, client);
        }
    }

    res.status(200).send("OK");
});

const handleFollowEvent = async (event, client) => {
    const userId = event.source.userId;
    try {
        const profile = await client.getProfile(userId);
        const userRef = db.collection("users").doc(userId);

        await userRef.set({
            userId: userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            status: "follow", // 'follow', 'blocked', 'in-progress'
            tags: ["新規"], // e.g., ['新規', '体験レッスン', 'Aクラス']
            followedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`New user ${userId} has been saved.`);

        // 新規ユーザー向けリッチメニューをリンク
        await linkRichMenuToUser(userId, RICH_MENU_ID_NEW_USER);
    } catch (error) {
        logger.error(`Failed to get profile or save user data for ${userId}`, error);
    }
};

const handleUnfollowEvent = async (event) => {
    const userId = event.source.userId;
    try {
        const userRef = db.collection("users").doc(userId);
        await userRef.update({
            status: "blocked",
            blockedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`User ${userId} has been marked as blocked.`);
    } catch (error) {
        logger.error(`Failed to update status for user ${userId}`, error);
    }
};

const handleMessageEvent = async (event, client) => {
    const receivedMessage = event.message.text;

    if (receivedMessage === "こんにちは") {
        const replyMessage = {
            type: "text",
            text: "こんにちは！ご用件は何でしょうか？",
        };
        try {
            await client.replyMessage(event.replyToken, replyMessage);
        } catch (error) {
            logger.error("Failed to reply message", error);
        }
    }
};

/**
 * @see https://firebase.google.com/docs/functions/callable
 */
exports.pushMessage = onCall(FUNCTION_CONFIG, async (request) => {
    // 認証チェックは不要なので削除
    
    const { tag, messageText } = request.data;

    if (!tag || !messageText) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with two arguments 'tag' and 'messageText'.");
    }

    try {
        const lineConfig = {
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        };
        const client = new line.Client(lineConfig);

        const usersRef = db.collection("users");
        const snapshot = await usersRef.where("tags", "array-contains", tag).get();

        if (snapshot.empty) {
            logger.info("No users found with tag:", tag);
            return { success: true, message: "No users found." };
        }

        const userIds = snapshot.docs.map(doc => doc.id);
        
        const message = {
            type: "text",
            text: messageText,
        };

        await client.multicast(userIds, [message]);
        
        logger.info(`Message sent to ${userIds.length} users with tag: ${tag}`);
        return { success: true, message: `Message sent to ${userIds.length} users.` };

    } catch (error) {
        logger.error("Failed to send push message", error);
        throw new functions.https.HttpsError("internal", "Failed to send push message.", error);
    }
});

/**
 * ユーザー一覧を取得する
 */
exports.getUsers = onCall(FUNCTION_CONFIG, async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const { pageSize = 30, startAfterDocId } = request.data;
    
    try {
        let query = db.collection("users")
                        .orderBy("followedAt", "desc")
                        .limit(pageSize);

        if (startAfterDocId) {
            const startAfterDoc = await db.collection("users").doc(startAfterDocId).get();
            if (startAfterDoc.exists) {
                query = query.startAfter(startAfterDoc);
            }
        }

        const snapshot = await query.get();
        
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 次のページのために、最後に取得したドキュメントのIDを渡す
        const lastDocId = snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1].id : null;

        return { users, lastDocId };
    } catch (error) {
        logger.error("Failed to get users", error);
        throw new functions.https.HttpsError("internal", "Failed to get users.", error);
    }
});

/**
 * ユーザーのタグを更新する
 */
exports.updateUserTags = onCall(FUNCTION_CONFIG_NO_SECRETS, async (request) => {
    if (!request.auth) throw new Error("Authentication required.");
    const { userId, tags } = request.data;
    if (!userId || !tags) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'userId' and 'tags'.");
    }

    try {
        const userRef = db.collection("users").doc(userId);
        await userRef.update({
            tags: tags, // tagsはフロントエンドから配列で受け取る
        });
        logger.info(`Tags updated for user ${userId}`);
        return { success: true, message: `Successfully updated tags for user ${userId}` };
    } catch (error) {
        logger.error("Error updating user tags", error);
        throw new functions.https.HttpsError("internal", "Failed to update tags.", error.message);
    }
});

/**
 * LIFFフォームからの申し込みを処理する
 */
exports.submitLiffForm = onCall(FUNCTION_CONFIG, async (request) => {
    const { userId, displayName, desiredClass } = request.data;
    if (!userId || !displayName || !desiredClass) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'userId', 'displayName', and 'desiredClass'.");
    }

    try {
        await db.collection("formSubmissions").add({
            userId: userId,
            displayName: displayName,
            desiredClass: desiredClass,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`New form submission from user ${userId}`);
        return { success: true, message: "申し込みを受け付けました。" };
    } catch (error) {
        logger.error(`Failed to save form submission from user ${userId}`, error);
        throw new functions.https.HttpsError("internal", "Failed to save form submission.", error);
    }
});

/**
 * LIFFフォームの申込一覧を取得する
 */
exports.getFormSubmissions = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    
    try {
        const snapshot = await db.collection("formSubmissions").orderBy("submittedAt", "desc").get();
        const submissions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // タイムスタンプを読みやすい形式に変換
                submittedAt: data.submittedAt.toDate().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            }
        });
        return { submissions };
    } catch (error) {
        logger.error("Failed to get form submissions", error);
        throw new functions.https.HttpsError("internal", "Failed to get form submissions.", error);
    }
});

/**
 * =================================================================
 * タグ管理 (Tags)
 * =================================================================
 */

/**
 * すべてのタグを取得する
 */
exports.getTags = onCall(FUNCTION_CONFIG_NO_SECRETS, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const snapshot = await db.collection('tags').orderBy('category').orderBy('name').get();
    const tags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { tags };
});

/**
 * 新しいタグを作成する
 */
exports.createTag = onCall(FUNCTION_CONFIG_NO_SECRETS, async (request) => {
    if (!request.auth) throw new Error("Authentication required.");
    const { name, category } = request.data;
    if (!name || !category) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'name' and 'category'.");
    }
    try {
        const newTagRef = await db.collection("tags").add({
            name: name,
            category: category,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, id: newTagRef.id };
    } catch (error) {
        logger.error("Failed to create tag", error);
        throw new functions.https.HttpsError("internal", "Failed to create tag.", error);
    }
});

/**
 * タグを更新する
 */
exports.updateTag = onCall(FUNCTION_CONFIG_NO_SECRETS, async (request) => {
    if (!request.auth) throw new Error("Authentication required.");
    const { id, name, category } = request.data;
    if (!id || !name || !category) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'id', 'name', and 'category'.");
    }
    try {
        await db.collection("tags").doc(id).update({
            name: name,
            category: category,
        });
        return { success: true };
    } catch (error) {
        logger.error(`Failed to update tag ${id}`, error);
        throw new functions.https.HttpsError("internal", "Failed to update tag.", error);
    }
});

/**
 * タグを削除する
 */
exports.deleteTag = onCall(FUNCTION_CONFIG_NO_SECRETS, async (request) => {
    if (!request.auth) throw new Error("Authentication required.");
    const { id } = request.data;
    if (!id) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'id'.");
    }
    try {
        await db.collection("tags").doc(id).delete();
        return { success: true };
    } catch (error) {
        logger.error(`Failed to delete tag ${id}`, error);
        throw new functions.https.HttpsError("internal", "Failed to delete tag.", error);
    }
});

/**
 * 指定したユーザーにリッチメニューをリンクする
 * @param {string} userId - LINEユーザーID
 * @param {string} richMenuId - リッチメニューID
 */
const linkRichMenuToUser = async (userId, richMenuId) => {
    // 環境変数からアクセストークンを読み込む
    const channelAccessToken = process.env.LINE_ACCESS_TOKEN;
    if (!channelAccessToken) {
        logger.error("LINE channel access token is not set in environment variables.");
        return;
    }

    const client = new line.Client({ channelAccessToken });
    try {
        await client.linkRichMenuToUser(userId, richMenuId);
        logger.info(`Linked rich menu ${richMenuId} to user ${userId}`);
    } catch (error) {
        logger.error(`Failed to link rich menu to user ${userId}`, error.response ? error.response.data : error.message);
    }
};

/**
 * ユーザーのタグに基づいてリッチメニューを切り替えるトリガー
 */
exports.onUserTagsUpdate = onDocumentUpdated({
    document: "users/{userId}",
    ...FUNCTION_CONFIG
}, async (event) => {
    const userId = event.params.userId;
    if (!event.after.exists) {
        logger.info("No data associated with the event");
        return;
    }
    const beforeData = event.before.data();
    const afterData = event.after.data();

    // タグが変更されていない場合は何もしない
    if (JSON.stringify(beforeData.tags) === JSON.stringify(afterData.tags)) {
        logger.info(`Tags not changed for user ${userId}. Skipping.`);
        return;
    }

    const userTags = new Set(afterData.tags || []);

    try {
        const lineConfig = {
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        };
        const client = new line.Client(lineConfig);

        const richMenusSnapshot = await db.collection('richMenus').get();
        if (richMenusSnapshot.empty) {
            logger.warn("No rich menus found in Firestore. Cannot link any menu.");
            return;
        }

        let bestMatch = { menuId: null, score: -1, isDefault: false };
        let defaultMenuId = null;

        richMenusSnapshot.forEach(doc => {
            const menu = doc.data();
            
            // Store the default menu ID in case no specific menu matches
            if (menu.isDefault) {
                defaultMenuId = menu.richMenuId;
            }

            const targetTags = new Set(menu.targetTags || []);
            if (targetTags.size === 0) return; // Skip menus with no target tags

            // Check if user has all the tags required by the menu
            const isMatch = [...targetTags].every(tag => userTags.has(tag));

            if (isMatch) {
                // Prioritize menus with more matching tags
                if (targetTags.size > bestMatch.score) {
                    bestMatch = { menuId: menu.richMenuId, score: targetTags.size };
                }
            }
        });

        const targetRichMenuId = bestMatch.menuId || defaultMenuId;

        if (targetRichMenuId) {
            await client.linkRichMenuToUser(userId, targetRichMenuId);
            logger.info(`Linked rich menu ${targetRichMenuId} to user ${userId} based on tag matching.`);
        } else {
             // If no suitable menu is found, unlink the current rich menu
             await client.unlinkRichMenuFromUser(userId);
             logger.info(`No suitable rich menu found for user ${userId}. Unlinked current menu.`);
        }

    } catch (error) {
        logger.error(`Failed to link rich menu for user ${userId}`, error);
    }
});

/**
 * 特定のユーザーの詳細情報を取得する
 */
exports.getUserDetails = onCall(FUNCTION_CONFIG_NO_SECRETS, async (request) => {
    if (!request.auth) throw new Error("Authentication required.");
    const { userId } = request.data;
    if (!userId) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'userId'.");
    }
    try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError("not-found", "User not found.");
        }
        return { user: { id: userDoc.id, ...userDoc.data() } };
    } catch (error) {
        logger.error(`Failed to get user details for ${userId}`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to get user details.", error);
    }
});

/**
 * =================================================================
 * リッチメニュー管理 (Rich Menu)
 * =================================================================
 */

/**
 * リッチメニューのリストを取得する
 */
exports.getRichMenuList = onCall(FUNCTION_CONFIG, async (request) => {
    logger.info("getRichMenuList called");
    if (!request.auth) {
        logger.warn("getRichMenuList: Unauthenticated call");
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }
    try {
        logger.info("getRichMenuList: Initializing LINE client.");
        const client = new line.Client({
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        });
        logger.info("getRichMenuList: Calling client.getRichMenuList()");
        const richMenus = await client.getRichMenuList();
        logger.info(`getRichMenuList: Successfully got ${richMenus.length} rich menus.`);

        // Sanitize the output to ensure it's JSON-serializable
        const safeRichMenus = richMenus.map(menu => ({
            richMenuId: menu.richMenuId,
            name: menu.name,
            size: menu.size,
            chatBarText: menu.chatBarText,
            selected: menu.selected,
            areas: menu.areas,
        }));

        return { richMenus: safeRichMenus };

    } catch (error) {
        logger.error("getRichMenuList: Error getting rich menu list.", {
            errorMessage: error.message,
            originalError: error.originalError?.response?.data,
        });
        throw new functions.https.HttpsError(
            "internal",
            "Failed to get rich menu list."
        );
    }
});

/**
 * リッチメニューを作成する
 */
exports.createRichMenu = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { richMenu } = request.data;
    if (!richMenu) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'richMenu' object.");
    }
    try {
        const client = new line.Client({
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        });
        const richMenuId = await client.createRichMenu(richMenu);
        return { richMenuId };
    } catch (error) {
        logger.error("Failed to create rich menu", error);
        throw new functions.https.HttpsError("internal", "Failed to create rich menu.", error.originalError?.response?.data || error);
    }
});

/**
 * リッチメニューを削除する
 */
exports.deleteRichMenu = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { richMenuId } = request.data;
    if (!richMenuId) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'richMenuId'.");
    }
    try {
        const client = new line.Client({
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        });
        await client.deleteRichMenu(richMenuId);
        return { success: true };
    } catch (error) {
        logger.error(`Failed to delete rich menu ${richMenuId}`, error);
        throw new functions.https.HttpsError("internal", "Failed to delete rich menu.", error.originalError?.response?.data || error);
    }
});

/**
 * リッチメニューの画像をアップロードする
 */
exports.uploadRichMenuImage = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { richMenuId, image } = request.data;
    if (!richMenuId || !image) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'richMenuId' and 'image' data.");
    }

    try {
        const lineConfig = {
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        };
        const client = new line.Client(lineConfig);

        // Base64エンコードされた画像データをBufferに変換
        const buffer = Buffer.from(image, 'base64');

        // 画像をアップロード
        await client.setRichMenuImage(richMenuId, buffer);

        return { success: true };

    } catch (error) {
        logger.error(`Failed to upload image for rich menu ${richMenuId}`, error);
        throw new functions.https.HttpsError("internal", "Failed to upload rich menu image.", error.message);
    }
});

/**
 * リッチメニューの画像を取得する (Base64で返す)
 */
exports.downloadRichMenuImage = onCall(FUNCTION_CONFIG, async (request) => {
    // Add version marker and detailed logging
    logger.info(`[v2] downloadRichMenuImage called for richMenuId: ${request.data.richMenuId}`);

    if (!request.auth) {
        logger.warn("[v2] Function called without authentication.");
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { richMenuId } = request.data;
    if (!richMenuId) {
        logger.warn("[v2] Function called without richMenuId.");
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'richMenuId'.");
    }
    try {
        logger.info(`[v2] Attempting to get image for ${richMenuId}`);
        const client = new line.Client({
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        });
        const stream = await client.getRichMenuImage(richMenuId);
        
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        logger.info(`[v2] Successfully downloaded image for ${richMenuId}.`);
        // 成功レスポンス
        return { success: true, imageBase64: buffer.toString('base64') };

    } catch (error) {
        logger.error(`[v2] Caught error for ${richMenuId}. Error message: ${error.message}. Returning success:false.`, { originalError: error });
        // 失敗を示す成功レスポンス
        return { success: false, message: `Image not found or an error occurred for ${richMenuId}.` };
    }
});

/**
 * 個別のリッチメニューを取得する
 */
exports.getRichMenu = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }
    const { richMenuId } = request.data;
    if (!richMenuId) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with 'richMenuId'."
        );
    }
    try {
        const client = new line.Client({
            channelAccessToken: process.env.LINE_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
        });
        const richMenu = await client.getRichMenu(richMenuId);
        return { richMenu };
    } catch (error) {
        logger.error(`Failed to get rich menu ${richMenuId}`, {
            errorMessage: error.message,
            originalError: error.originalError?.response?.data,
        });
        throw new functions.https.HttpsError(
            "internal",
            `Failed to get rich menu ${richMenuId}.`
        );
    }
});

/**
 * 特定のリッチメニューの詳細を取得する
 */
exports.getRichMenuDetails = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    
    const { richMenuId } = request.data;
    if (!richMenuId) {
        throw new functions.https.HttpsError("invalid-argument", "The 'richMenuId' argument is required.");
    }

    try {
        const menuDocRef = db.collection('richMenus').doc(richMenuId);
        const doc = await menuDocRef.get();

        if (!doc.exists) {
            throw new functions.https.HttpsError("not-found", `Rich menu with ID ${richMenuId} not found in Firestore.`);
        }

        return { success: true, menuData: doc.data() };

    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        logger.error(`Failed to get rich menu details for ${richMenuId}:`, error);
        throw new functions.https.HttpsError("internal", "Failed to get rich menu details.", error.message);
    }
});

/**
 * リッチメニューを作成・更新する
 */
exports.saveRichMenu = onCall(FUNCTION_CONFIG, async (request) => {
    if (!request.auth) throw new Error("Authentication required.");
    const { richMenuId, menuData, imageBase64 } = request.data;
    if (!menuData) {
        throw new functions.https.HttpsError("invalid-argument", "The 'menuData' argument is required.");
    }

    const lineConfig = {
        channelAccessToken: process.env.LINE_ACCESS_TOKEN,
        channelSecret: process.env.LINE_CHANNEL_SECRET,
    };
    const client = new line.Client(lineConfig);

    try {
        let newRichMenuId = richMenuId;

        // 1. If it's an existing menu, delete the old one first.
        // LINE API doesn't support direct updates, so we replace it.
        if (richMenuId) {
            try {
                await client.deleteRichMenu(richMenuId);
                logger.info(`Successfully deleted old rich menu: ${richMenuId}`);
            } catch(e) {
                // It might fail if the menu was already deleted from LINE's side.
                // We can ignore this error and proceed.
                logger.warn(`Could not delete rich menu ${richMenuId}. It might not exist on LINE's server.`, e.message);
            }
        }

        // 2. Create a new rich menu object
        const richMenuObject = {
            size: menuData.size,
            selected: menuData.selected,
            name: menuData.name,
            chatBarText: menuData.chatBarText,
            areas: menuData.areas,
        };
        newRichMenuId = await client.createRichMenu(richMenuObject);
        logger.info(`Successfully created new rich menu with id: ${newRichMenuId}`);

        // 3. Upload image if provided
        if (imageBase64) {
            // Remove the data URI prefix if it exists
            const buffer = Buffer.from(imageBase64, 'base64');
            await client.setRichMenuImage(newRichMenuId, buffer);
            logger.info(`Successfully uploaded image for rich menu: ${newRichMenuId}`);
        }

        // 4. Save metadata to Firestore
        const menuDocRef = db.collection('richMenus').doc(newRichMenuId);
        await menuDocRef.set({
            ...menuData, // This contains name, chatBarText, size, areas, etc.
            richMenuId: newRichMenuId, // ensure the new ID is stored
            targetTags: menuData.targetTags || [], // Store the target tags
            isDefault: menuData.isDefault || false, // Store default status
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info(`Rich menu ${newRichMenuId} metadata saved to Firestore.`);
        
        return { success: true, richMenuId: newRichMenuId };

    } catch (error) {
        logger.error("Failed to save rich menu:", error);
        throw new functions.https.HttpsError("internal", "Failed to save rich menu.", error.message);
    }
}); 