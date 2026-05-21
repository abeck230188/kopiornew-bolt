import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBC3XaxG3573sD3Y9iIxdbEj5YEEK34mx4",
  authDomain: "kopiornew.firebaseapp.com",
  projectId: "kopiornew",
  storageBucket: "kopiornew.firebasestorage.app",
  messagingSenderId: "561523518751",
  appId: "1:561523518751:web:8d2dffc5ff4d190a87942a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app instance for creating users without signing out the current admin
const secondaryApp = initializeApp(firebaseConfig, 'secondary');
export const secondaryAuth = getAuth(secondaryApp);

export default app;
