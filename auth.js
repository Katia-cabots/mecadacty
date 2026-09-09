// ============================================================
// MECADACTY — Connexion (identifiant / mot de passe stockés
// dans Firestore) et demande d'inscription client.
// ============================================================

import { db } from "./firebase-config.js";
import { afficherBandeau } from "./interface.js";
import {
  collection, addDoc, doc, updateDoc, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
      const q = query(collection(db, "utilisateurs"), where("identifiant", "==", identifiant));
      const resultats = await getDocs(q);

      if (resultats.empty) {
        afficherBandeau("connexion-bandeau", "Aucun compte ne correspond à cet identifiant.", "erreur");
        return;
      }

      let utilisateurTrouve = null;
      resultats.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.motDePasse === motDePasse) {
          utilisateurTrouve = { id: docSnap.id, ...data };
        }
      });

      if (!utilisateurTrouve) {
        afficherBandeau("connexion-bandeau", "Mot de passe incorrect pour cet identifiant.", "erreur");
        return;
      }

      // Mise à jour de la dernière connexion (visible côté Admin / Super Admin)
      try {
        await updateDoc(doc(db, "utilisateurs", utilisateurTrouve.id), {
          derniereConnexion: serverTimestamp()
        });
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
