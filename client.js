// ============================================================
// MECADACTY — Espace Membre (client)
// ============================================================

import { db } from "./firebase-config.js";
import { VERSION_SITE } from "./version.js";
import { afficherBandeau } from "./interface.js";
import {
  collection, addDoc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- Garde d'accès ----------
const utilisateurBrut = sessionStorage.getItem("mecadacty_utilisateur");
if (!utilisateurBrut) {
  window.location.href = "connexion.html";
}
const utilisateur = utilisateurBrut ? JSON.parse(utilisateurBrut) : null;
if (utilisateur && utilisateur.role !== "membre") {
  window.location.href = "admin.html";
}

document.getElementById("version-tag").textContent = VERSION_SITE;

document.getElementById("btn-deconnexion").addEventListener("click", () => {
  sessionStorage.removeItem("mecadacty_utilisateur");
  window.location.href = "connexion.html";
});

if (utilisateur) {
  document.getElementById("salutation-client").textContent = `Bienvenue, ${utilisateur.prenom}`;
}

// ---------- Navigation entre onglets ----------
document.querySelectorAll(".app-menu button[data-onglet]").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    document.querySelectorAll(".app-menu button").forEach((b) => b.classList.remove("actif"));
    document.querySelectorAll(".app-onglet").forEach((o) => o.classList.remove("actif"));
    bouton.classList.add("actif");
    document.getElementById("onglet-" + bouton.dataset.onglet).classList.add("actif");
  });
});

// ---------- Mes dossiers ----------
async function chargerMesDossiers() {
  const corps = document.querySelector("#table-mes-dossiers tbody");
  if (!utilisateur) return;
  try {
    const q = query(collection(db, "dossiers"), where("clientId", "==", utilisateur.id));
    const snap = await getDocs(q);
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="3" class="message-vide">Aucun dossier pour le moment.</td></tr>`;
      return;
    }
    const libellesStatut = { attente: ["statut-attente", "En attente"], en_cours: ["statut-en-cours", "En cours"], termine: ["statut-termine", "Terminé"] };
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const [classe, libelle] = libellesStatut[data.statut] || ["statut-attente", data.statut];
      return `<tr>
        <td>${data.type === "recurrent" ? "Récurrente" : "Ponctuelle"}</td>
        <td>${data.description || ""}</td>
        <td><span class="statut-pastille ${classe}">${libelle}</span></td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="3" class="message-vide">Erreur de chargement de vos dossiers. Vérifiez votre connexion internet.</td></tr>`;
  }
}

// ---------- Mes rendez-vous ----------
async function chargerMesRdv() {
  const corps = document.querySelector("#table-mes-rdv tbody");
  if (!utilisateur) return;
  try {
    const q = query(collection(db, "rdv"), where("clientId", "==", utilisateur.id));
    const snap = await getDocs(q);
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="3" class="message-vide">Aucun rendez-vous pour le moment.</td></tr>`;
      return;
    }
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const dateAffichee = data.date ? new Date(data.date).toLocaleString("fr-BE") : "";
      return `<tr>
        <td>${dateAffichee}</td>
        <td>${data.objet || ""}</td>
        <td><span class="statut-pastille ${data.confirme ? "statut-termine" : "statut-attente"}">${data.confirme ? "Confirmé" : "En attente"}</span></td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="3" class="message-vide">Erreur de chargement de vos rendez-vous.</td></tr>`;
  }
}

document.getElementById("btn-demander-rdv").addEventListener("click", async () => {
  const date = document.getElementById("rd-date-client").value;
  if (!date || !utilisateur) {
    afficherBandeau("rdv-client-bandeau", "Merci d'indiquer une date souhaitée.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "rdv"), {
      clientId: utilisateur.id,
      date,
      objet: document.getElementById("rd-objet-client").value,
      confirme: false,
      dateCreation: serverTimestamp()
    });
    afficherBandeau("rdv-client-bandeau", "Demande envoyée, en attente de confirmation.", "succes");
    document.getElementById("rd-objet-client").value = "";
    chargerMesRdv();
  } catch (err) {
    console.error(err);
    afficherBandeau("rdv-client-bandeau", "Erreur lors de l'envoi de la demande. Merci de réessayer.", "erreur");
  }
});

// ---------- Chargement initial ----------
chargerMesDossiers();
chargerMesRdv();
