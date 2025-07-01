/**
 * Googleフォームが送信されたときに実行される関数
 * この関数は、フォームの送信イベントに紐付けられます。
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e
 */
function onFormSubmit(e) {
  try {
    console.log('onFormSubmit 関数が実行されました。');
    console.log('渡されたイベントオブジェクト (e):', e);

    // フォームデータをFirestoreに保存
    saveFormDataToFirestore(namedValues);

    // e.response が undefined の場合でも namedValues からデータを取得
    const namedValues = e.namedValues;

    if (!namedValues) {
      throw new Error('フォームの回答データ (namedValues) が取得できませんでした。');
    }

    let userId = null;
    let lessonApplied = false;

    // namedValues から LINEUserID を取得
    // namedValues の値は配列なので、最初の要素を取得
    if (namedValues['LINEUserID'] && namedValues['LINEUserID'].length > 0) {
      userId = namedValues['LINEUserID'][0];
    }

    // namedValues から「参加希望レッスン」の回答を取得
    // ログから '参加希望レッスン': [ 'A Lesson' ] となっていたので、その値で判定
    if (namedValues['参加希望レッスン'] && namedValues['参加希望レッスン'].length > 0) {
      const lessonAnswer = namedValues['参加希望レッスン'][0];
      // ここは、Googleフォームで設定した「参加希望レッスン」の具体的な選択肢に合わせてください
      // 例: チェックボックスで「はい、参加を希望します」という選択肢がある場合
      if (lessonAnswer === 'A Lesson') { // ログの例に合わせて 'A Lesson' としています
        lessonApplied = true;
      }
    }

    if (!userId) {
      throw new Error('フォームの回答からLINE User IDが取得できませんでした。');
    }

    // 月1特別レッスンに申し込んだ人にだけメッセージを送信する
    if (lessonApplied) {
      sendLineMessage(userId, '月1特別レッスンへのお申し込みありがとうございます！\n詳細が決まり次第、改めてご連絡いたします。');
    } else {
      console.log(`ユーザーID: ${userId} はレッスンに申し込んでいません。`);
      // 必要であれば、別のメッセージを送る
      // sendLineMessage(userId, 'お申し込みを受け付けました。');
    }

  } catch (error) {
    console.error('フォーム送信処理中にエラーが発生しました:', error);
    // エラー通知など、必要に応じて追加
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
  // TODO: ここにあなたのFirebaseプロジェクトIDを記述してください。
  // 例: const PROJECT_ID = 'your-firebase-project-id';
  const PROJECT_ID = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID'); 
  const COLLECTION_NAME = 'formSubmissions'; // Firestoreに保存するコレクション名

  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}?key=${API_KEY}`;

  // Firestoreに保存するデータ形式に変換
  // namedValuesは { '質問タイトル': ['回答'] } の形式なので、適切な形に変換
  const fields = {};
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
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