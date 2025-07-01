function testFirestoreWrite() {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  const PROJECT_ID = 'egg-pe-liff-app'; // ここにあなたのFirebaseプロジェクトIDを記述
  const COLLECTION_NAME = 'test_collection'; // テスト用のコレクション名

  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}?key=${API_KEY}`;

  const data = {
    fields: {
      message: { stringValue: 'Hello from GAS!' },
      timestamp: { timestampValue: new Date().toISOString() }
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true // エラー発生時も例外を投げずにレスポンスを返す
  };

  try {
    const response = UrlFetchApp.fetch(FIRESTORE_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      Logger.log('Successfully wrote to Firestore: ' + responseBody);
    } else {
      Logger.log('Error writing to Firestore. Response Code: ' + responseCode + ', Body: ' + responseBody);
    }
  } catch (e) {
    Logger.log('Exception during Firestore write: ' + e.toString());
  }
}
