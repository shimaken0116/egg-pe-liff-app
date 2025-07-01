/**
 * LIFFアプリからのPOSTリクエストを受け取るWeb Appのエンドポイント
 * この関数は、GASプロジェクトをWeb Appとしてデプロイした際に実行されます。
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    console.log('doPost 関数が実行されました。');
    console.log('受け取ったリクエスト:', e);

    // リクエストボディがJSON形式であることを想定
    const requestBody = JSON.parse(e.postData.contents);
    const idToken = requestBody.idToken;
    const formData = requestBody.formData; // LIFFアプリから送信されるフォームデータ

    if (!idToken) {
      throw new Error('IDトークンがリクエストボディに含まれていません。');
    }

    // 1. IDトークンの検証
    const verifiedUserId = verifyIdToken(idToken);
    if (!verifiedUserId) {
      throw new Error('IDトークンの検証に失敗しました。');
    }

    // 2. フォームデータをFirestoreに保存
    // formDataはLIFFアプリ側で整形して送ることを想定
    // 例: { '氏名': '山田太郎', '参加希望レッスン': ['A Lesson', 'B Lesson'] }
    const dataToSave = { ...formData, LINEUserID: verifiedUserId };
    saveFormDataToFirestore(dataToSave);

    // 3. LINEメッセージの送信
    let userName = formData['氏名'] || 'お客様';
    let lessonNames = formData['参加希望レッスン'] || [];
    let message = '';

    if (lessonNames.length > 0) {
      const lessonList = lessonNames.join('、');
      message = `${userName}様、${lessonList}へのお申し込みありがとうございます！\n詳細が決まり次第、改めてご連絡いたします。`;
    } else {
      message = `${userName}様、お申し込みありがとうございます！\n詳細が決まり次第、改めてご連絡いたします。`;
    }

    sendLineMessage(verifiedUserId, message);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: '処理が完了しました。' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('doPost 処理中にエラーが発生しました:', error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * LINEのIDトークンを検証する関数
 * @param {string} idToken
 * @returns {string|null} 検証成功時はユーザーID、失敗時はnull
 */
function verifyIdToken(idToken) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const channelId = scriptProperties.getProperty('LINE_LOGIN_CHANNEL_ID'); // LIFFアプリのチャネルID

  if (!channelId) {
    console.error('スクリプトプロパティにLINE_LOGIN_CHANNEL_IDが設定されていません。');
    return null;
  }

  const url = 'https://api.line.me/oauth2/v2.1/verify';
  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: `id_token=${idToken}&client_id=${channelId}`,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    if (responseCode === 200 && responseBody.sub) {
      console.log('IDトークン検証成功:', responseBody);
      return responseBody.sub; // 'sub'クレームにユーザーIDが含まれる
    } else {
      console.error('IDトークン検証失敗. Response Code:', responseCode, 'Body:', responseBody);
      return null;
    }
  } catch (e) {
    console.error('IDトークン検証中に例外が発生しました:', e.toString());
    return null;
  }
}

// sendLineMessage 関数と saveFormDataToFirestore 関数は onFormSubmit.js からコピーするか、
// GASプロジェクト内でライブラリとして読み込むことを想定
// ここでは仮に定義しておきますが、実際には onFormSubmit.js の内容を統合するか、
// GASのプロジェクト設定で onFormSubmit.js をライブラリとして追加してください。

/**
 * LINE Messaging APIを使ってメッセージを送信する関数
 * @param {string} toUserId 送信先のLINEユーザーID
 * @param {string} message 送信するメッセージ内容
 */
function sendLineMessage(toUserId, message) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const channelAccessToken = scriptProperties.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (!channelAccessToken) {
    throw new Error('スクリプトプロパティにLINE_CHANNEL_ACCESS_TOKENが設定されていません。');
  }

  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + channelAccessToken
  };
  const postData = {
    to: toUserId,
    messages: [{
      type: 'text',
      text: message
    }]
  };

  const options = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(postData),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error(`LINEメッセージ送信エラー: ${responseCode} - ${responseText}`);
    throw new Error(`LINEメッセージ送信に失敗しました: ${responseText}`);
  } else {
    console.log('LINEメッセージ送信成功:', responseText);
  }
}

/**
 * フォームの回答データをFirestoreに保存する関数
 * @param {Object} formData フォームのnamedValuesオブジェクト
 */
function saveFormDataToFirestore(formData) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  const PROJECT_ID = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID'); 
  const COLLECTION_NAME = 'formSubmissions';

  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}?key=${API_KEY}`;

  const fields = {};
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
      // 配列の場合はそのまま、それ以外はstringValueとして扱う
      if (Array.isArray(formData[key])) {
        fields[key] = { arrayValue: { values: formData[key].map(item => ({ stringValue: item })) } };
      } else {
        fields[key] = { stringValue: formData[key] || '' };
      }
    }
  }
  fields['timestamp'] = { timestampValue: new Date().toISOString() };

  const payloadData = {
    fields: fields
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payloadData),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(FIRESTORE_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      console.log('Firestoreにデータを保存しました:', responseBody);
    } else {
      console.error('Firestoreへのデータ保存エラー. Response Code: ' + responseCode + ', Body: ' + responseBody);
    }
  } catch (e) {
    console.error('Firestoreへのデータ保存中に例外が発生しました:', e.toString());
  }
}
