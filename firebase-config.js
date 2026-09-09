// ============================================================
// MECADACTY — Configuration Firebase
// Projet : mecadacty — Version du site : voir version.js
// Étapes :
//   1. Créer un projet sur https://console.firebase.google.com
//      nommé "mecadacty"
//   2. Activer Firestore Database (mode production)
//   3. Copier ici la config du projet (Paramètres du projet >
//      Général > Vos applications > Config)
//   4. Créer le premier compte Super Admin directement dans
//      Firestore, collection "utilisateurs" :
//        identifiant: "HeleneL"
//        motDePasse: "Helene123"
//        role: "admin"
//        estSuperAdmin: true
//        nom: "Laruelle"
//        prenom: "Hélène"
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "A_COMPLETER",
  authDomain: "mecadacty.firebaseapp.com",
  projectId: "mecadacty",
  storageBucket: "mecadacty.appspot.com",
  messagingSenderId: "A_COMPLETER",
  appId: "A_COMPLETER"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
