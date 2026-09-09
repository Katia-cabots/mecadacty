// ============================================================
// MECADACTY — Espace Admin / Super Admin
// ============================================================

import { db } from "./firebase-config.js";
import { VERSION_SITE } from "./version.js";
import { afficherBandeau } from "./interface.js";
import {
  collection, addDoc, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- Garde d'accès ----------
const utilisateurBrut = sessionStorage.getItem("mecadacty_utilisateur");
if (!utilisateurBrut) {
  window.location.href = "connexion.html";
}
const utilisateur = utilisateurBrut ? JSON.parse(utilisateurBrut) : null;
if (utilisateur && utilisateur.role !== "admin") {
  window.location.href = "client.html";
}

document.getElementById("version-tag").textContent = VERSION_SITE;

if (utilisateur && utilisateur.estSuperAdmin) {
  const badge = document.getElementById("badge-role");
  badge.textContent = "Super Admin";
  badge.classList.add("role-superadmin");
  document.getElementById("onglet-btn-motsdepasse").style.display = "block";
} else if (utilisateur && utilisateur.role === "admin" && !utilisateur.estSuperAdmin) {
  // Easter egg discret pour Katia uniquement (comme sur le site des Cabots de Fernelmont)
  const badge = document.getElementById("badge-role");
  badge.textContent = "Admin 🍓";
}

document.getElementById("btn-deconnexion").addEventListener("click", () => {
  sessionStorage.removeItem("mecadacty_utilisateur");
  window.location.href = "connexion.html";
});

// ---------- Navigation entre onglets ----------
document.querySelectorAll(".app-menu button[data-onglet]").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    document.querySelectorAll(".app-menu button").forEach((b) => b.classList.remove("actif"));
    document.querySelectorAll(".app-onglet").forEach((o) => o.classList.remove("actif"));
    bouton.classList.add("actif");
    document.getElementById("onglet-" + bouton.dataset.onglet).classList.add("actif");
    if (bouton.dataset.onglet === "messages") marquerMessagesLus();
    if (bouton.dataset.onglet === "motsdepasse") chargerMotsDePasse();
  });
});

// ---------- Utilitaires ----------
function retirerAccents(texte) {
  return (texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggererIdentifiant(prenom, nom) {
  if (!prenom || !nom) return "";
  return `${retirerAccents(prenom)}.${retirerAccents(nom).charAt(0)}`;
}

function suggererMotDePasse(prenom, nom, dateNaissance) {
  if (!prenom || !nom || !dateNaissance) return "";
  const p = retirerAccents(prenom).slice(0, 3);
  const n = retirerAccents(nom).slice(0, 3);
  const [, mois, jour] = dateNaissance.split("-"); // format YYYY-MM-DD
  return `${p}${n}${jour}${mois}`;
}

function formaterDate(champ) {
  if (!champ) return "Jamais connecté";
  if (champ.toDate) return champ.toDate().toLocaleString("fr-BE");
  return "Jamais connecté";
}

document.getElementById("btn-toggle-form-client").addEventListener("click", () => {
  const carte = document.getElementById("carte-form-client");
  carte.style.display = carte.style.display === "none" ? "block" : "none";
});

document.getElementById("btn-suggerer").addEventListener("click", () => {
  const prenom = document.getElementById("cl-prenom").value;
  const nom = document.getElementById("cl-nom").value;
  const naissance = document.getElementById("cl-naissance").value;
  document.getElementById("cl-identifiant").value = suggererIdentifiant(prenom, nom);
  document.getElementById("cl-motdepasse").value = suggererMotDePasse(prenom, nom, naissance);
});

// ---------- Tableau de bord ----------
async function chargerTableauDeBord() {
  try {
    const [clientsSnap, dossiersSnap, rdvSnap, inscriptionsSnap] = await Promise.all([
      getDocs(collection(db, "utilisateurs")),
      getDocs(collection(db, "dossiers")),
      getDocs(collection(db, "rdv")),
      getDocs(collection(db, "demandesInscription"))
    ]);
    const nbClients = clientsSnap.docs.filter(d => d.data().role === "membre").length;
    const nbDossiersEnCours = dossiersSnap.docs.filter(d => d.data().statut === "en_cours").length;
    const nbInscriptionsAttente = inscriptionsSnap.docs.filter(d => !d.data().traitee).length;

    document.getElementById("resume-tableau").innerHTML = `
      <p><strong>${nbClients}</strong> membre(s) enregistré(s)</p>
      <p><strong>${nbDossiersEnCours}</strong> dossier(s) en cours</p>
      <p><strong>${rdvSnap.size}</strong> rendez-vous au total</p>
      <p><strong>${nbInscriptionsAttente}</strong> demande(s) d'inscription en attente</p>
    `;

    if (nbInscriptionsAttente > 0) {
      document.getElementById("notif-inscriptions").style.display = "inline-block";
    }
  } catch (err) {
    console.error(err);
    afficherBandeau("tableau-bandeau", "Impossible de charger le tableau de bord : vérifiez la connexion à Firebase (config dans firebase-config.js).", "erreur");
  }
}

// ---------- Membres (clients) ----------
let listeClients = [];

async function chargerClients() {
  const corps = document.querySelector("#table-clients tbody");
  try {
    const snap = await getDocs(collection(db, "utilisateurs"));
    listeClients = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "membre");

    if (listeClients.length === 0) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun membre enregistré pour le moment.</td></tr>`;
    } else {
      corps.innerHTML = listeClients.map(c => `
        <tr>
          <td>${c.prenom} ${c.nom}</td>
          <td>${c.gsm || ""}<br>${c.email || ""}</td>
          <td>${c.identifiant}</td>
          <td>${formaterDate(c.derniereConnexion)}</td>
        </tr>
      `).join("");
    }

    const selectDossier = document.getElementById("do-client");
    const selectRdv = document.getElementById("rd-client");
    const options = `<option value="">— Choisir —</option>` + listeClients.map(c => `<option value="${c.id}">${c.prenom} ${c.nom}</option>`).join("");
    selectDossier.innerHTML = options;
    selectRdv.innerHTML = options;
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des membres. Vérifiez la connexion à Firebase.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-client").addEventListener("click", async () => {
  const nom = document.getElementById("cl-nom").value.trim();
  const prenom = document.getElementById("cl-prenom").value.trim();
  const gsm = document.getElementById("cl-gsm").value.trim();
  let email = document.getElementById("cl-email").value.trim();
  let identifiant = document.getElementById("cl-identifiant").value.trim();
  let motDePasse = document.getElementById("cl-motdepasse").value.trim();

  if (!nom || !prenom) {
    afficherBandeau("clients-bandeau", "Le nom et le prénom sont obligatoires.", "erreur");
    return;
  }
  if (!identifiant) identifiant = suggererIdentifiant(prenom, nom);
  if (!motDePasse) motDePasse = suggererMotDePasse(prenom, nom, document.getElementById("cl-naissance").value);
  if (!identifiant || !motDePasse) {
    afficherBandeau("clients-bandeau", "Impossible de générer l'identifiant ou le mot de passe : renseignez au moins le nom, le prénom et la date de naissance, ou saisissez-les manuellement.", "erreur");
    return;
  }
  if (!email) email = `${identifiant}@mecadacty.be`; // e-mail généré par défaut si non fourni

  try {
    await addDoc(collection(db, "utilisateurs"), {
      nom, prenom, gsm, email, identifiant, motDePasse,
      role: "membre", estSuperAdmin: false, nbDossiers: 0,
      dateCreation: serverTimestamp(), derniereConnexion: null
    });
    afficherBandeau("clients-bandeau", `Membre ajouté. Identifiant : ${identifiant} — Mot de passe : ${motDePasse}`, "succes");
    ["cl-nom","cl-prenom","cl-naissance","cl-gsm","cl-email","cl-identifiant","cl-motdepasse"].forEach(id => document.getElementById(id).value = "");
    chargerClients();
    chargerTableauDeBord();
  } catch (err) {
    console.error(err);
    afficherBandeau("clients-bandeau", "Erreur lors de l'ajout du membre. Vérifiez la connexion à Firebase et réessayez.", "erreur");
  }
});

// ---------- Dossiers ----------
async function chargerDossiers() {
  const corps = document.querySelector("#table-dossiers tbody");
  try {
    const snap = await getDocs(collection(db, "dossiers"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun dossier pour le moment.</td></tr>`;
      return;
    }
    const libellesStatut = { attente: ["statut-attente", "En attente"], en_cours: ["statut-en-cours", "En cours"], termine: ["statut-termine", "Terminé"] };
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const client = listeClients.find(c => c.id === data.clientId);
      const [classe, libelle] = libellesStatut[data.statut] || ["statut-attente", data.statut];
      return `<tr>
        <td>${client ? client.prenom + " " + client.nom : "—"}</td>
        <td>${data.type === "recurrent" ? "Récurrente" : "Ponctuelle"}</td>
        <td>${data.description || ""}</td>
        <td><span class="statut-pastille ${classe}">${libelle}</span></td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des dossiers.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-dossier").addEventListener("click", async () => {
  const clientId = document.getElementById("do-client").value;
  if (!clientId) {
    afficherBandeau("dossiers-bandeau", "Merci de choisir un membre.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "dossiers"), {
      clientId,
      type: document.getElementById("do-type").value,
      description: document.getElementById("do-description").value,
      statut: document.getElementById("do-statut").value,
      dateCreation: serverTimestamp()
    });
    afficherBandeau("dossiers-bandeau", "Dossier créé.", "succes");
    document.getElementById("do-description").value = "";
    chargerDossiers();
    chargerTableauDeBord();
  } catch (err) {
    console.error(err);
    afficherBandeau("dossiers-bandeau", "Erreur lors de la création du dossier.", "erreur");
  }
});

// ---------- Rendez-vous ----------
async function chargerRdv() {
  const corps = document.querySelector("#table-rdv tbody");
  try {
    const snap = await getDocs(collection(db, "rdv"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun rendez-vous pour le moment.</td></tr>`;
      return;
    }
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const client = listeClients.find(c => c.id === data.clientId);
      const dateAffichee = data.date ? new Date(data.date).toLocaleString("fr-BE") : "";
      return `<tr>
        <td>${client ? client.prenom + " " + client.nom : "—"}</td>
        <td>${dateAffichee}</td>
        <td>${data.objet || ""}</td>
        <td>${data.confirme ? "Oui" : "En attente"}</td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des rendez-vous.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-rdv").addEventListener("click", async () => {
  const clientId = document.getElementById("rd-client").value;
  const date = document.getElementById("rd-date").value;
  if (!clientId || !date) {
    afficherBandeau("rdv-bandeau", "Le membre et la date sont obligatoires.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "rdv"), {
      clientId, date,
      objet: document.getElementById("rd-objet").value,
      confirme: false,
      dateCreation: serverTimestamp()
    });
    afficherBandeau("rdv-bandeau", "Rendez-vous créé.", "succes");
    document.getElementById("rd-objet").value = "";
    chargerRdv();
    chargerTableauDeBord();
  } catch (err) {
    console.error(err);
    afficherBandeau("rdv-bandeau", "Erreur lors de la création du rendez-vous.", "erreur");
  }
});

// ---------- Demandes d'inscription ----------
async function chargerInscriptions() {
  const corps = document.querySelector("#table-inscriptions tbody");
  try {
    const snap = await getDocs(collection(db, "demandesInscription"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucune demande en attente.</td></tr>`;
      return;
    }
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const dateAffichee = data.date && data.date.toDate ? data.date.toDate().toLocaleDateString("fr-BE") : "";
      return `<tr>
        <td>${data.prenom} ${data.nom}</td>
        <td>${data.gsm || ""}<br>${data.email || ""}</td>
        <td>${dateAffichee}</td>
        <td>${data.traitee ? "Traitée" : `<button data-id="${d.id}" data-nom="${data.nom}" data-prenom="${data.prenom}" data-gsm="${data.gsm||''}" data-email="${data.email||''}" class="btn-convertir bouton-mini-discret">Créer le compte</button>`}</td>
      </tr>`;
    }).join("");

    document.querySelectorAll(".btn-convertir").forEach(bouton => {
      bouton.addEventListener("click", () => {
        document.querySelector('.app-menu button[data-onglet="clients"]').click();
        document.getElementById("carte-form-client").style.display = "block";
        document.getElementById("cl-nom").value = bouton.dataset.nom;
        document.getElementById("cl-prenom").value = bouton.dataset.prenom;
        document.getElementById("cl-gsm").value = bouton.dataset.gsm;
        document.getElementById("cl-email").value = bouton.dataset.email;
        updateDoc(doc(db, "demandesInscription", bouton.dataset.id), { traitee: true }).catch(console.error);
      });
    });
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des demandes.</td></tr>`;
  }
}

// ---------- Messages de contact ----------
let messagesNonLus = [];

async function chargerMessages() {
  const corps = document.querySelector("#table-messages tbody");
  try {
    const snap = await getDocs(collection(db, "messagesContact"));
    messagesNonLus = snap.docs.filter(d => !d.data().lu).map(d => d.id);
    if (messagesNonLus.length > 0) {
      document.getElementById("notif-messages").style.display = "inline-block";
    }
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun message reçu.</td></tr>`;
      return;
    }
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const dateAffichee = data.date && data.date.toDate ? data.date.toDate().toLocaleDateString("fr-BE") : "";
      return `<tr>
        <td>${data.nom}</td>
        <td>${data.gsm || ""}<br>${data.email || ""}</td>
        <td>${data.message}</td>
        <td>${dateAffichee}</td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des messages.</td></tr>`;
  }
}

function marquerMessagesLus() {
  document.getElementById("notif-messages").style.display = "none";
  messagesNonLus.forEach(id => {
    updateDoc(doc(db, "messagesContact", id), { lu: true }).catch(console.error);
  });
  messagesNonLus = [];
}

// ---------- Contenu du site ----------
const clesContenu = [
  ["slogan_site", "En-tête — Slogan sous le logo"],
  ["accueil_titre", "Accueil — Titre principal"],
  ["accueil_chapo", "Accueil — Texte sous le titre"],
  ["accueil_services_titre", "Accueil — Titre section services"],
  ["accueil_espace_titre", "Accueil — Titre section espace client"],
  ["accueil_espace_texte", "Accueil — Texte section espace client"],
  ["services_titre", "Services — Titre"],
  ["services_chapo", "Services — Texte d'introduction"],
  ["apropos_titre", "À propos — Titre"],
  ["apropos_katia_titre", "À propos — Nom (présentation)"],
  ["apropos_katia_texte1", "À propos — Présentation, paragraphe 1"],
  ["apropos_katia_texte2", "À propos — Présentation, paragraphe 2"],
  ["apropos_texte1", "À propos — Paragraphe 1 (Mecadacty)"],
  ["apropos_texte2", "À propos — Paragraphe 2 (Mecadacty)"],
  ["contact_titre", "Contact — Titre"],
  ["contact_chapo", "Contact — Texte d'introduction"],
  ["contact_gsm", "Contact — Ligne téléphone"],
  ["contact_email", "Contact — Ligne e-mail"],
  ["contact_adresse", "Contact — Ligne adresse"],
];

async function chargerContenuAdmin() {
  const conteneur = document.getElementById("liste-contenu");
  let data = {};
  try {
    const snap = await getDocs(collection(db, "contenu"));
    snap.forEach(d => { if (d.id === "site") data = d.data(); });
  } catch (err) {
    console.warn(err);
  }

  conteneur.innerHTML = clesContenu.map(([cle, libelle]) => `
    <div class="champ">
      <label for="ct-${cle}">${libelle}</label>
      <textarea id="ct-${cle}" rows="2">${data[cle] || ""}</textarea>
    </div>
  `).join("");
}

document.getElementById("btn-enregistrer-contenu").addEventListener("click", async () => {
  const valeurs = {};
  clesContenu.forEach(([cle]) => {
    valeurs[cle] = document.getElementById(`ct-${cle}`).value;
  });
  try {
    await setDoc(doc(db, "contenu", "site"), valeurs, { merge: true });
    afficherBandeau("contenu-bandeau", "Contenu enregistré.", "succes");
  } catch (err) {
    console.error(err);
    afficherBandeau("contenu-bandeau", "Erreur lors de l'enregistrement du contenu.", "erreur");
  }
});

// ---------- Mots de passe (Super Admin uniquement) ----------
async function chargerMotsDePasse() {
  if (!utilisateur || !utilisateur.estSuperAdmin) return;
  const corps = document.querySelector("#table-motsdepasse tbody");
  try {
    const snap = await getDocs(collection(db, "utilisateurs"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="6" class="message-vide">Aucun utilisateur.</td></tr>`;
      return;
    }
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `<tr>
        <td>${data.prenom} ${data.nom}</td>
        <td>${data.identifiant}</td>
        <td>${data.motDePasse}</td>
        <td>${data.estSuperAdmin ? "Super Admin" : (data.role === "admin" ? "Admin" : "Membre")}</td>
        <td>${formaterDate(data.derniereConnexion)}</td>
        <td><button class="bouton-mini-discret btn-reinit" data-id="${d.id}" data-prenom="${data.prenom}" data-nom="${data.nom}">Réinitialiser</button></td>
      </tr>`;
    }).join("");

    document.querySelectorAll(".btn-reinit").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        const nouveauMdp = suggererMotDePasse(bouton.dataset.prenom, bouton.dataset.nom, "2000-01-01").slice(0, 6) + Math.floor(Math.random() * 90 + 10);
        try {
          await updateDoc(doc(db, "utilisateurs", bouton.dataset.id), {
            motDePasse: nouveauMdp,
            dateReinitialisationMdp: serverTimestamp()
          });
          chargerMotsDePasse();
        } catch (err) {
          console.error(err);
        }
      });
    });
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="6" class="message-vide">Erreur de chargement.</td></tr>`;
  }
}

// ---------- Chargement initial ----------
(async function initAdmin() {
  await chargerClients();
  await Promise.all([
    chargerTableauDeBord(),
    chargerDossiers(),
    chargerRdv(),
    chargerInscriptions(),
    chargerMessages(),
    chargerContenuAdmin()
  ]);
})();
