# Firebase SDK コードスニペット

ここにFirebase SDKの初期化コードや、Firestoreへのアクセス例などを記述してください。

---

## 初期化コード例

```javascript
// Firebase SDK の初期化
// ここにFirebaseプロジェクトの設定情報を記述します
const firebaseConfig = {
  apiKey: "AIzaSyCszjhcHkvgAA5Ue1bbmw-GZtTJ8fr-J4A",
  authDomain: "egg-pe-liff-app.firebaseapp.com",
  projectId: "egg-pe-liff-app",
  storageBucket: "egg-pe-liff-app.firebasestorage.app",
  messagingSenderId: "560378460540",
  appId: "1:560378460540:web:e345813dfdebf0a67eccf9"
};

// Firebase を初期化
// firebase.initializeApp(firebaseConfig);
// const db = firebase.firestore();
```

## Firestore データ書き込み例

```javascript
// Firestore にデータを追加
// db.collection("your_collection").add({
//   field1: "value1",
//   field2: "value2"
// })
// .then((docRef) => {
//   console.log("Document written with ID: ", docRef.id);
// })
// .catch((error) => {
//   console.error("Error adding document: ", error);
// });
```

## Firestore データ読み込み例

```javascript
// Firestore からデータを読み込み
// db.collection("your_collection").get().then((querySnapshot) => {
//   querySnapshot.forEach((doc) => {
//     console.log(`${doc.id} => ${doc.data()}`);
//   });
// });
```
