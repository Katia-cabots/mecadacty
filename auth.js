// ============================================================
// MECADACTY — Connexion via Firebase Authentication
// (le champ "User" est mappé vers un e-mail via la collection
// publique "identifiantsPublics", puis l'authentification réelle
// se fait avec Firebase Auth) + demande d'inscription client.
// ============================================================

import { db, auth } from "./firebase-config.js";
import { afficherBandeau } from "./interface.js";
import {
  collection, addDoc, doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---------- Connexion ----------
const formConnexion = document.getElementById("form-connexion");
if (formConnexion) {
  formConnexion.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifiant = document.getElementById("identifiant").value.trim();
    const motDePasse = document.getElementById("mdp").value;

    if (!identifiant || !motDePasse) {
      afficherBandeau("connexion-bandeau", "Merci de renseigner l'identifiant et le mot de passe.", "erreur");
      return;
    }

    try {
      // 1. Retrouver l'e-mail associé à ce "User" (collection publique, sans mot de passe)
      const refIdentifiant = doc(db, "identifiantsPublics", identifiant);
      const snapIdentifiant = await getDoc(refIdentifiant);

      if (!snapIdentifiant.exists()) {
        afficherBandeau("connexion-bandeau", "Aucun compte ne correspond à cet identifiant.", "erreur");
        return;
      }
      const { email } = snapIdentifiant.data();

      // 2. Authentification réelle via Firebase Authentication
      let identifiants;
      try {
        identifiants = await signInWithEmailAndPassword(auth, email, motDePasse);
      } catch (errAuth) {
        console.error(errAuth);
        afficherBandeau("connexion-bandeau", "Identifiant ou mot de passe incorrect.", "erreur");
        return;
      }

      // 3. Récupérer le profil (rôle, nom...) — l'utilisateur ne peut lire que son propre profil
      const uid = identifiants.user.uid;
      const snapProfil = await getDoc(doc(db, "utilisateurs", uid));
      if (!snapProfil.exists()) {
        afficherBandeau("connexion-bandeau", "Compte authentifié mais profil introuvable — contactez l'administrateur.", "erreur");
        return;
      }
      const utilisateurTrouve = { id: uid, ...snapProfil.data() };

      // Mise à jour de la dernière connexion (visible côté Admin / Super Admin)
      try {
        await updateDoc(doc(db, "utilisateurs", uid), { derniereConnexion: serverTimestamp() });
      } catch (err) {
        console.warn("Impossible de mettre à jour la dernière connexion :", err);
      }

      sessionStorage.setItem("mecadacty_utilisateur", JSON.stringify(utilisateurTrouve));

      if (utilisateurTrouve.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "client.html";
      }
    } catch (err) {
      console.error(err);
      afficherBandeau("connexion-bandeau", "Erreur de connexion au serveur. Vérifiez votre connexion internet et réessayez.", "erreur");
    }
  });
}

// ---------- Demande d'inscription (futur client) ----------
const formInscription = document.getElementById("form-inscription");
if (formInscription) {
  formInscription.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = document.getElementById("i-nom").value.trim();
    const prenom = document.getElementById("i-prenom").value.trim();
    const gsm = document.getElementById("i-gsm").value.trim();
    const email = document.getElementById("i-email").value.trim();

    if (!nom || !prenom || !gsm || !email) {
      afficherBandeau("inscription-bandeau", "Tous les champs marqués d'une * sont obligatoires.", "erreur");
      return;
    }

    try {
      await addDoc(collection(db, "demandesInscription"), {
        nom, prenom, gsm, email,
        date: serverTimestamp(),
        traitee: false
      });
      afficherBandeau("inscription-bandeau", "Demande envoyée ! Vous recevrez vos accès prochainement.", "succes");
      e.target.reset();
    } catch (err) {
      console.error(err);
      afficherBandeau("inscription-bandeau", "Erreur d'envoi de la demande. Merci de réessayer dans quelques instants.", "erreur");
    }
  });
}
