import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDdkNWXdjhR1tdIdpBz7LXf13bMGr16KDM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "andaman-quiz.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "andaman-quiz",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "andaman-quiz.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "974859873844",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:974859873844:web:andamanquizweb"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
