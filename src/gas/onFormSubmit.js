/**
 * フォームの回答データをFirestoreに保存する関数
 * @param {Object} formData フォームのnamedValuesオブジェクト
 */
function saveFormDataToFirestore(formData) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  const PROJECT_ID = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const COLLECTION_NAME = 'formSubmissions'; // Firestoreに保存するコレクション名

  if (!API_KEY || !PROJECT_ID) {
    console.error('Firebase API KeyまたはProject IDがスクリプトプロパティに設定されていません。');
    return; // プロパティが不足している場合は処理を中断
  }

  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}?key=${API_KEY}`;
  console.log('Firestoreへの保存を試行中。URL:', FIRESTORE_URL); // 追加ログ

  // Firestoreに保存するデータ形式に変換
  const fields = {};
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
      // namedValuesは { '質問タイトル': ['回答'] } の形式なので、適切な形に変換
      // 配列の最初の要素を取得（単一選択/入力の場合）
      // 複数選択の場合は、適宜処理を調整してください
      fields[key] = { stringValue: formData[key][0] || '' }; 
    }
  }
  // タイムスタンプを追加
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

/**
 * Googleフォームが送信されたときに実行される関数
 * この関数は、フォームの送信イベントに紐付けられます。
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e
 */
function onFormSubmit(e) {
  try {
    console.log('onFormSubmit 関数が実行されました。');
    console.log('渡されたイベントオブジェクト (e):', e);

    // e.response が undefined の場合でも namedValues からデータを取得
    const namedValues = e.namedValues;

    // フォームデータをFirestoreに保存
    saveFormDataToFirestore(namedValues);

    if (!namedValues) {
      throw new Error('フォームの回答データ (namedValues) が取得できませんでした。');
    }

    let userId = null;
    let userName = 'お客様'; // デフォルト値
    let lessonNames = [];

    // namedValues から IDトークンを取得
    // GoogleフォームでIDトークンを受け取る質問項目のタイトルに合わせてください
    const idToken = namedValues['LINE ID Token'] && namedValues['LINE ID Token'].length > 0 ? namedValues['LINE ID Token'][0] : null;

    if (!idToken) {
      throw new Error('フォームの回答からIDトークンが取得できませんでした。');
    }

    // IDトークンの検証
    userId = verifyIdToken(idToken);
    if (!userId) {
      throw new Error('IDトークンの検証に失敗し、ユーザーIDを特定できませんでした。');
    }

    // namedValues から「氏名」を取得 (フォームの質問名に合わせてください)
    if (namedValues['氏名'] && namedValues['氏名'].length > 0) {
      userName = namedValues['氏名'][0];
    }

    // namedValues から「参加希望レッスン」を取得 (複数選択の可能性も考慮)
    if (namedValues['参加希望レッスン'] && namedValues['参加希望レッスン'].length > 0) {
      lessonNames = namedValues['参加希望レッスン'];
    }

    let message = '';
    if (lessonNames.length > 0) {
      const lessonList = lessonNames.join('、');
      message = `${userName}様、${lessonList}へのお申し込みありがとうございます！\n詳細が決まり次第、改めてご連絡いたします。`;
    } else {
      message = `${userName}様、お申し込みありがとうございます！\n詳細が決まり次第、改めてご連絡いたします。`;
    }

    sendLineMessage(userId, message);

  } catch (error) {
    console.error('フォーム送信処理中にエラーが発生しました:', error);
    // エラー通知など、必要に応じて追加
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

// sendLineMessage 関数はそのまま
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
    muteHttpExceptions: true // エラー時も例外を投げずにレスポンスを返す
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
  const COLLECTION_NAME = 'formSubmissions'; // Firestoreに保存するコレクション名

  if (!API_KEY || !PROJECT_ID) {
    console.error('Firebase API KeyまたはProject IDがスクリプトプロパティに設定されていません。');
    return; // プロパティが不足している場合は処理を中断
  }

  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}?key=${API_KEY}`;
  console.log('Firestoreへの保存を試行中。URL:', FIRESTORE_URL); // 追加ログ

  // Firestoreに保存するデータ形式に変換
  const fields = {};
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
      // namedValuesは { '質問タイトル': ['回答'] } の形式なので、適切な形に変換
      // 配列の最初の要素を取得（単一選択/入力の場合）
      // 複数選択の場合は、適宜処理を調整してください
      fields[key] = { stringValue: formData[key][0] || '' }; 
    }
  }
  // タイムスタンプを追加
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

// sendLineMessage 関数はそのまま
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
    muteHttpExceptions: true // エラー時も例外を投げずにレスポンスを返す
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