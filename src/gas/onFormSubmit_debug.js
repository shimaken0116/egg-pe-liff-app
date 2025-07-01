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