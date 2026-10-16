// firebase.js
// Official Firebase 12 entry packages avoid Snack's unsupported empty `firebase` root.
import firebase from '@firebase/app-compat';
import '@firebase/firestore-compat';
import '@firebase/auth-compat';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdd__5jzfF2Ph4uT0YuueWfo-iWoLuhSg",
  authDomain: "finalprojectsc362202.firebaseapp.com",
  projectId: "finalprojectsc362202",
  storageBucket: "finalprojectsc362202.appspot.com",
  messagingSenderId: "154193356905",
  appId: "1:154193356905:web:f9fc0d8ef8b66accc55af8",
  measurementId: "G-PLQLZ395E6"
};

// Check if Firebase is not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // if already initialized, use that one
}

const db = firebase.firestore();
const auth = firebase.auth();

export { db, auth, firebase }; // เพิ่ม firebase ในการ export
