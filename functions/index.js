const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const line = require("@line/bot-sdk");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

admin.initializeApp();
const db = admin.firestore();

exports.webhook = onRequest(
  {
    region: "asia-northeast1",
    secrets: ["LINE_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"],
  },
  async (req, res) => {
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
  }
);

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

exports.pushMessage = onCall(
  { region: "asia-northeast1", secrets: ["LINE_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"] },
  async (request) => {
    // 認証チェック（管理者ページなどからの呼び出しを想定）
    // if (!request.auth) {
    //   throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    // }
    
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
  }
); 