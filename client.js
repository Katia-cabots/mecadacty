// ============================================================
// MECADACTY — Espace Client
// ============================================================

import { db } from "./firebase-config.js";
import { VERSION_SITE } from "./version.js";
import { afficherBandeau } from "./interface.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- Garde d'accès ----------
const utilisateurBrut = sessionStorage.getItem("mecadacty_utilisateur");
if (!utilisateurBrut) {
  window.location.href = "connexion.html";
}
const utilisateur = utilisateurBrut ? JSON.parse(utilisateurBrut) : null;
if (utilisateur && utilisateur.role !== "client") {
  window.location.href = "admin.html";
}

document.getElementById("version-tag").textContent = VERSION_SITE;

document.getElementById("btn-deconnexion").addEventListener("click", () => {
  sessionStorage.removeItem("mecadacty_utilisateur");
  window.location.href = "connexion.html";
});

if (utilisateur) {
  document.getElementById("salutation-client").textContent = `Bonjour, ${utilisateur.prenom}`;
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

// ---------- Mes rendez-vous (3 créneaux proposés, Katia valide) ----------
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
      const creneaux = (data.creneauxProposes || []).map(c => new Date(c).toLocaleString("fr-BE")).join(" / ");
      let statutHtml;
      if (data.creneauChoisi) {
        statutHtml = `<span class="statut-pastille statut-termine">Confirmé le ${new Date(data.creneauChoisi).toLocaleString("fr-BE")}</span>`;
      } else {
        statutHtml = `<span class="statut-pastille statut-attente">En attente de validation</span>`;
      }
      return `<tr>
        <td>${creneaux}</td>
        <td>${data.objet || ""}</td>
        <td>${statutHtml}</td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="3" class="message-vide">Erreur de chargement de vos rendez-vous.</td></tr>`;
  }
}

document.getElementById("btn-demander-rdv").addEventListener("click", async () => {
  const d1 = document.getElementById("rd-date1-client").value;
  const d2 = document.getElementById("rd-date2-client").value;
  const d3 = document.getElementById("rd-date3-client").value;
  const creneauxProposes = [d1, d2, d3].filter(Boolean);
  if (creneauxProposes.length < 1 || !utilisateur) {
    afficherBandeau("rdv-client-bandeau", "Merci de proposer au moins un créneau (idéalement 3).", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "rdv"), {
      clientId: utilisateur.id,
      creneauxProposes,
      creneauChoisi: null,
      objet: document.getElementById("rd-objet-client").value,
      confirme: false,
      dateCreation: serverTimestamp()
    });
    afficherBandeau("rdv-client-bandeau", "Demande envoyée avec vos créneaux proposés, en attente de validation par Katia.", "succes");
    document.getElementById("rd-objet-client").value = "";
    document.getElementById("rd-date1-client").value = "";
    document.getElementById("rd-date2-client").value = "";
    document.getElementById("rd-date3-client").value = "";
    chargerMesRdv();
  } catch (err) {
    console.error(err);
    afficherBandeau("rdv-client-bandeau", "Erreur lors de l'envoi de la demande. Merci de réessayer.", "erreur");
  }
});

// ---------- Message à Katia (boîte partagée avec l'équipe Mecadacty) ----------
async function chargerFilMessagesClient() {
  const conteneur = document.getElementById("fil-messages-client");
  if (!utilisateur) return;
  try {
    const q = query(collection(db, "messages"), where("clientId", "==", utilisateur.id));
    const snap = await getDocs(q);
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.dateEnvoi && a.dateEnvoi.toMillis ? a.dateEnvoi.toMillis() : 0) - (b.dateEnvoi && b.dateEnvoi.toMillis ? b.dateEnvoi.toMillis() : 0));

    if (messages.length === 0) {
      conteneur.innerHTML = `<p class="message-vide">Aucun message pour le moment. Écrivez à Katia ci-dessous.</p>`;
    } else {
      conteneur.innerHTML = messages.map(m => {
        const heure = m.dateEnvoi && m.dateEnvoi.toDate ? m.dateEnvoi.toDate().toLocaleString("fr-BE") : "";
        const classe = m.expediteur === "admin" ? "bulle-admin" : "bulle-client";
        return `<div class="bulle-message ${classe}">${m.texte}<span class="heure-message">${heure}</span></div>`;
      }).join("");
      conteneur.scrollTop = conteneur.scrollHeight;
    }

    // Marquer comme lus les messages envoyés par l'admin
    messages.filter(m => m.expediteur === "admin" && !m.lu).forEach(m => {
      updateDoc(doc(db, "messages", m.id), { lu: true }).catch(console.error);
    });
    document.getElementById("notif-messagerie-client").style.display = "none";
  } catch (err) {
    console.error(err);
    conteneur.innerHTML = `<p class="message-vide">Erreur de chargement de la conversation.</p>`;
  }
}

document.getElementById("btn-envoyer-message-client").addEventListener("click", async () => {
  const texte = document.getElementById("msg-texte-client").value.trim();
  if (!texte || !utilisateur) {
    afficherBandeau("messagerie-client-bandeau", "Écrivez un message avant d'envoyer.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "messages"), {
      clientId: utilisateur.id,
      expediteur: "client",
      texte,
      lu: false,
      dateEnvoi: serverTimestamp()
    });
    document.getElementById("msg-texte-client").value = "";
    chargerFilMessagesClient();
  } catch (err) {
    console.error(err);
    afficherBandeau("messagerie-client-bandeau", "Erreur lors de l'envoi du message.", "erreur");
  }
});

async function verifierNotifMessagerieClient() {
  if (!utilisateur) return;
  try {
    const q = query(collection(db, "messages"), where("clientId", "==", utilisateur.id), where("expediteur", "==", "admin"), where("lu", "==", false));
    const snap = await getDocs(q);
    if (!snap.empty) document.getElementById("notif-messagerie-client").style.display = "inline-block";
  } catch (err) {
    console.warn(err);
  }
}

// ---------- Mes heures (lecture seule — confidentiel, filtré par mon propre id) ----------
async function chargerMesHeures() {
  const corps = document.querySelector("#table-mes-heures tbody");
  const totalEl = document.getElementById("total-mes-heures");
  if (!utilisateur) return;
  try {
    const q = query(collection(db, "heures"), where("clientId", "==", utilisateur.id));
    const snap = await getDocs(q);
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="3" class="message-vide">Aucune heure enregistrée pour le moment.</td></tr>`;
      totalEl.textContent = "";
      return;
    }
    const entrees = snap.docs.map(d => d.data()).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    corps.innerHTML = entrees.map(h => `
      <tr>
        <td>${h.date || ""}</td>
        <td>${h.heures ?? ""}</td>
        <td>${h.description || ""}</td>
      </tr>
    `).join("");
    const total = entrees.reduce((somme, h) => somme + (Number(h.heures) || 0), 0);
    totalEl.textContent = `Total : ${total} heure(s)`;
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="3" class="message-vide">Erreur de chargement de vos heures.</td></tr>`;
  }
}

// ---------- Chargement initial ----------
chargerMesDossiers();
chargerMesHeures();
chargerMesRdv();
chargerFilMessagesClient();
verifierNotifMessagerieClient();
