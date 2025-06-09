
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Import GoogleAuthProvider
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// User-provided configuration:
const firebaseConfig = {
  apiKey: "AIzaSyAs4ck3Y5t1YXE2mNRhniItbGpJWyBSwxw",
  authDomain: "uninest-mu6v7.firebaseapp.com",
  projectId: "uninest-mu6v7",
  storageBucket: "uninest-mu6v7.firebasestorage.app",
  messagingSenderId: "213218023965",
  appId: "1:213218023965:web:f09a327738d095d70744f4"
};

// Initialize Firebase App
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const storage = getStorage(app);
const studybeamDb = getFirestore(app, 'studybeam');

// Create and export the Google Auth Provider
const googleProvider = new GoogleAuthProvider();

export { app, auth, storage, studybeamDb, googleProvider }; // Export googleProvider
