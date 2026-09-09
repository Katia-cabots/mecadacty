// ============================================================
// MECADACTY — Configuration Firebase
// Projet réel : mecadacty-51f6f
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCe8JucgufbT8dGtX8I4BlVtLV_JT2kvBA",
  authDomain: "mecadacty-51f6f.firebaseapp.com",
  projectId: "mecadacty-51f6f",
  storageBucket: "mecadacty-51f6f.firebasestorage.app",
  messagingSenderId: "969429008237",
  appId: "1:969429008237:web:2de2dbd15c94572f6ba464"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
