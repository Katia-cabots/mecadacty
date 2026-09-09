// ============================================================
// MECADACTY — Chargement du contenu éditable (pages publiques)
// Chaque élément avec [data-contenu="cle"] est rempli depuis
// Firestore (collection "contenu", document "site") si une
// valeur existe pour cette clé, sinon le texte HTML par défaut
// écrit dans la page reste affiché.
// ============================================================

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function chargerContenuEditable() {
  try {
    const ref = doc(db, "contenu", "site");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    document.querySelectorAll("[data-contenu]").forEach((el) => {
      const cle = el.getAttribute("data-contenu");
      if (data[cle] !== undefined && data[cle] !== "") {
        el.innerHTML = data[cle];
      }
    });
  } catch (err) {
    // Pas bloquant : le texte par défaut reste affiché
    console.warn("Contenu éditable non chargé :", err);
  }
}

document.addEventListener("DOMContentLoaded", chargerContenuEditable);
