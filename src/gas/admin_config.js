/**
 * 管理UIのHTMLを提供する関数、またはLIFFアプリからGoogleフォームのURLを返す関数
 */
function doGet(e) {
  console.log('doGet 関数が実行されました。');
  console.log('e.parameter:', e.parameter);

  if (e.parameter.action === 'getGoogleFormUrl') {
    console.log('アクション: getGoogleFormUrl');
    const formUrl = getGoogleFormUrl();
    console.log('getGoogleFormUrl() が返したURL:', formUrl);
    return ContentService.createTextOutput(formUrl);
  } else {
    console.log('アクション: 管理UI表示');
    const htmlOutput = HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <base target="_top">
        <title>フォームURL設定</title>
        <style>
          body { font-family: sans-serif; margin: 20px; }
          h1 { color: #333; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input[type="text"] { width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background-color: #45a049; }
          #message { margin-top: 15px; font-weight: bold; }
          .success { color: green; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>GoogleフォームURL設定</h1>
        <p>LIFFアプリがリダイレクトするGoogleフォームのURLを設定します。</p>
        <form id="configForm">
          <label for="formUrl">GoogleフォームのURL:</label>
          <input type="text" id="formUrl" name="formUrl" placeholder="https://docs.google.com/forms/d/e/.../viewform?usp=pp_url&entry.FIELD_ID=" required>
          <button type="submit">保存</button>
        </form>
        <div id="message"></div>

        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('configForm');
            const formUrlInput = document.getElementById('formUrl');
            const messageDiv = document.getElementById('message');

            // 現在のURLを読み込んで表示
            google.script.run.withSuccessHandler(function(url) {
              formUrlInput.value = url;
            }).getGoogleFormUrl();

            form.addEventListener('submit', function(e) {
              e.preventDefault();
              messageDiv.textContent = '保存中...';
              messageDiv.className = '';

              const url = formUrlInput.value;
              google.script.run.withSuccessHandler(function() {
                messageDiv.textContent = 'URLが正常に保存されました！';
                messageDiv.className = 'success';
              }).withFailureHandler(function(error) {
                messageDiv.textContent = '保存に失敗しました: ' + error.message;
                messageDiv.className = 'error';
              }).setGoogleFormUrl(url);
            });
          });
        </script>
      </body>
      </html>
    `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

    return htmlOutput;
  }
}

/**
 * LIFFアプリからGoogleフォームのURLを取得するための関数
 * @returns {string} 現在設定されているGoogleフォームのURL
 */
function getGoogleFormUrl() {
  return PropertiesService.getScriptProperties().getProperty('GOOGLE_FORM_BASE_URL') || '';
}

/**
 * 管理UIからGoogleフォームのURLを設定するための関数
 * @param {string} url 設定するGoogleフォームのURL
 */
function setGoogleFormUrl(url) {
  PropertiesService.getScriptProperties().setProperty('GOOGLE_FORM_BASE_URL', url);
}
