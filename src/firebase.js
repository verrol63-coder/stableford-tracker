import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ---------------------------------------------------------------------
// PASTE YOUR OWN FIREBASE CONFIG HERE.
// Get this from: Firebase console -> Project settings -> General ->
// "Your apps" -> Web app (</>) -> SDK setup and configuration.
// See SETUP.md, step 3, for the full walkthrough.
// ---------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: "AIzaSyCGjxMVZGJhzOxFmxib434qalU9-Xn2R_E",
  authDomain: "stableford-tracker.firebaseapp.com",
  projectId: "stableford-tracker",
  storageBucket: "stableford-tracker.firebasestorage.app",
  messagingSenderId: "250621793989",
  appId: "1:250621793989:web:616ea9057ca3d6424f42ac",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
