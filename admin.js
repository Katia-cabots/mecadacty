// ============================================================
// MECADACTY — Espace Admin / Super Admin
// ============================================================

import { db, auth, firebaseConfig } from "./firebase-config.js";
import { VERSION_SITE } from "./version.js";
import { afficherBandeau } from "./interface.js";
import {
  collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  onAuthStateChanged, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword,
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeApp as initialiserAppSecondaire, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

// ---------- Garde d'accès (session pour l'affichage immédiat) ----------
const utilisateurBrut = sessionStorage.getItem("mecadacty_utilisateur");
if (!utilisateurBrut) {
  window.location.href = "connexion.html";
}
let utilisateur = utilisateurBrut ? JSON.parse(utilisateurBrut) : null;
if (utilisateur && utilisateur.role !== "admin") {
  window.location.href = "client.html";
}

document.getElementById("version-tag").textContent = VERSION_SITE;

function appliquerAffichageRole() {
  const badge = document.getElementById("badge-role");
  const estSuper = utilisateur && utilisateur.estSuperAdmin === true;

  badge.classList.remove("role-superadmin");
  document.getElementById("onglet-btn-motsdepasse").style.display = "none";

  if (estSuper) {
    badge.textContent = "Super Admin";
    badge.classList.add("role-superadmin");
    document.getElementById("onglet-btn-motsdepasse").style.display = "block";
  } else {
    // Easter egg discret pour Katia uniquement (comme sur le site des Cabots de Fernelmont)
    badge.textContent = "Admin 🍓";
  }

  const salutation = document.getElementById("salutation-admin");
  if (salutation && utilisateur) salutation.textContent = `Bonjour, ${utilisateur.prenom}`;
  const salutationEntete = document.getElementById("salutation-entete");
  if (salutationEntete && utilisateur) salutationEntete.textContent = `Bonjour, ${utilisateur.prenom}`;
}

appliquerAffichageRole();

// ---------- Garde d'accès réelle : vérifie la session Firebase Authentication ----------
// (si le cache de session existe mais qu'il n'y a pas de vraie session Firebase
// Auth active — déconnexion, expiration... — on renvoie vers la connexion)
onAuthStateChanged(auth, async (utilisateurFirebase) => {
  if (!utilisateurFirebase) {
    sessionStorage.removeItem("mecadacty_utilisateur");
    window.location.href = "connexion.html";
    return;
  }
  try {
    const snapProfil = await getDoc(doc(db, "utilisateurs", utilisateurFirebase.uid));
    if (!snapProfil.exists() || snapProfil.data().role !== "admin") {
      window.location.href = "connexion.html";
      return;
    }
    utilisateur = { id: utilisateurFirebase.uid, ...snapProfil.data() };
    sessionStorage.setItem("mecadacty_utilisateur", JSON.stringify(utilisateur));
    appliquerAffichageRole();
  } catch (err) {
    console.warn("Impossible de vérifier le profil connecté :", err);
  }
});

document.getElementById("btn-deconnexion").addEventListener("click", async () => {
  sessionStorage.removeItem("mecadacty_utilisateur");
  try { await signOut(auth); } catch (err) { console.warn(err); }
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
    if (bouton.dataset.onglet === "messagerie") ouvrirOngletMessagerie();
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
    const nbClients = clientsSnap.docs.filter(d => d.data().role === "client").length;
    const nbDossiersEnCours = dossiersSnap.docs.filter(d => d.data().statut === "en_cours").length;
    const nbInscriptionsAttente = inscriptionsSnap.docs.filter(d => !d.data().traitee).length;

    document.getElementById("resume-tableau").innerHTML = `
      <p><strong>${nbClients}</strong> client(s) enregistré(s)</p>
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

// ---------- Clients ----------
let listeClients = [];

async function chargerClients() {
  const corps = document.querySelector("#table-clients tbody");
  try {
    const snap = await getDocs(collection(db, "utilisateurs"));
    listeClients = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "client");

    if (listeClients.length === 0) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun client enregistré pour le moment.</td></tr>`;
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
    const selectHeures = document.getElementById("he-client");
    const options = `<option value="">— Choisir —</option>` + listeClients.map(c => `<option value="${c.id}">${c.prenom} ${c.nom}</option>`).join("");
    selectDossier.innerHTML = options;
    selectRdv.innerHTML = options;
    selectHeures.innerHTML = options;
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des clients. Vérifiez la connexion à Firebase.</td></tr>`;
  }
}

// Crée un compte Firebase Authentication sans déconnecter l'admin en cours
// (utilise une app Firebase secondaire temporaire, comme recommandé par Firebase
// pour créer un compte depuis une session admin déjà connectée)
async function creerCompteFirebaseAuth(email, motDePasse) {
  const appSecondaire = initialiserAppSecondaire(firebaseConfig, "secondaire-" + Date.now());
  const authSecondaire = getAuth(appSecondaire);
  try {
    const identifiants = await createUserWithEmailAndPassword(authSecondaire, email, motDePasse);
    const uid = identifiants.user.uid;
    await deleteApp(appSecondaire);
    return uid;
  } catch (err) {
    await deleteApp(appSecondaire);
    throw err;
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
  if (motDePasse.length < 6) {
    afficherBandeau("clients-bandeau", "Le mot de passe doit faire au moins 6 caractères (exigence de Firebase Authentication).", "erreur");
    return;
  }
  if (!email) email = `${identifiant}@mecadacty.be`; // e-mail généré par défaut si non fourni

  try {
    const uid = await creerCompteFirebaseAuth(email, motDePasse);

    await setDoc(doc(db, "utilisateurs", uid), {
      nom, prenom, gsm, email, identifiant, motDePasse,
      role: "client", estSuperAdmin: false, nbDossiers: 0,
      dateCreation: serverTimestamp(), derniereConnexion: null
    });
    await setDoc(doc(db, "identifiantsPublics", identifiant), { email });

    afficherBandeau("clients-bandeau", `Client ajouté. Identifiant : ${identifiant} — mot de passe : ${motDePasse} (aussi consultable dans l'onglet Comptes).`, "succes");
    ["cl-nom","cl-prenom","cl-naissance","cl-gsm","cl-email","cl-identifiant","cl-motdepasse"].forEach(id => document.getElementById(id).value = "");
    chargerClients();
    chargerTableauDeBord();
  } catch (err) {
    console.error(err);
    let message = "Erreur lors de l'ajout du client. Vérifiez la connexion à Firebase et réessayez.";
    if (err.code === "auth/email-already-in-use") message = "Cet e-mail est déjà utilisé par un autre compte.";
    if (err.code === "auth/invalid-email") message = "L'e-mail généré n'est pas valide.";
    afficherBandeau("clients-bandeau", message, "erreur");
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
    afficherBandeau("dossiers-bandeau", "Merci de choisir un client.", "erreur");
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

// ---------- Suivi des heures (par client — confidentiel) ----------
async function chargerHeuresAdmin() {
  const corps = document.querySelector("#table-heures tbody");
  try {
    const snap = await getDocs(collection(db, "heures"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="5" class="message-vide">Aucune heure enregistrée pour le moment.</td></tr>`;
      return;
    }
    const entrees = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    corps.innerHTML = entrees.map(h => {
      const client = listeClients.find(c => c.id === h.clientId);
      return `<tr>
        <td>${client ? client.prenom + " " + client.nom : "—"}</td>
        <td>${h.date || ""}</td>
        <td>${h.heures ?? ""}</td>
        <td>${h.description || ""}</td>
        <td><button class="bouton-mini-discret btn-suppr-heures" data-id="${h.id}">Supprimer</button></td>
      </tr>`;
    }).join("");

    document.querySelectorAll(".btn-suppr-heures").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "heures", bouton.dataset.id));
          chargerHeuresAdmin();
        } catch (err) { console.error(err); }
      });
    });
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="5" class="message-vide">Erreur de chargement des heures.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-heures").addEventListener("click", async () => {
  const clientId = document.getElementById("he-client").value;
  const date = document.getElementById("he-date").value;
  const heures = parseFloat(document.getElementById("he-heures").value);
  if (!clientId || !date || isNaN(heures)) {
    afficherBandeau("heures-bandeau", "Le client, la date et le nombre d'heures sont obligatoires.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "heures"), {
      clientId, date, heures,
      description: document.getElementById("he-description").value,
      dateCreation: serverTimestamp()
    });
    afficherBandeau("heures-bandeau", "Heures enregistrées.", "succes");
    document.getElementById("he-heures").value = "";
    document.getElementById("he-description").value = "";
    chargerHeuresAdmin();
  } catch (err) {
    console.error(err);
    afficherBandeau("heures-bandeau", "Erreur lors de l'enregistrement des heures.", "erreur");
  }
});

// ---------- Services affichés sur le site (page Services) ----------
const servicesParDefaut = [
  { titre: "Dactylographie & mise en forme de documents", texte: "Courriers, rapports, comptes-rendus de réunion, thèses, présentations — mise en page soignée et relecture." },
  { titre: "Secrétariat administratif", texte: "Gestion du courrier et des mails, classement, tenue d'agenda, préparation de dossiers, facturation." },
  { titre: "Renfort temporaire", texte: "Surcharge ponctuelle, pic d'activité, projet particulier : un appui administratif le temps nécessaire." },
  { titre: "Accompagnement récurrent", texte: "Une présence régulière (hebdomadaire, mensuelle) pour la gestion administrative continue de votre activité." },
  { titre: "Gestion des boîtes mails qui débordent", texte: "Tri, classement, réponses courantes, mise à plat d'une boîte mail débordée pour retrouver une messagerie sous contrôle." },
  { titre: "Structuration du système administratif", texte: "Mise en place ou réorganisation de vos outils et process administratifs, pour un fonctionnement plus clair et plus fluide au quotidien." },
  { titre: "Support client", texte: "Accueil, réponses aux demandes courantes de vos propres clients, suivi des échanges — un relais fiable pour votre service client." },
  { titre: "Missions sur devis", texte: "Un besoin spécifique non listé ici ? Chaque demande est étudiée pour construire la formule adaptée." }
];

async function chargerServicesAdmin() {
  const corps = document.querySelector("#table-services tbody");
  try {
    const snap = await getDocs(collection(db, "services"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun service — clique sur "Initialiser les services par défaut" ou ajoutes-en un toi-même.</td></tr>`;
      return;
    }
    const services = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    corps.innerHTML = services.map(s => `
      <tr>
        <td>${s.titre}</td>
        <td>${s.texte}</td>
        <td>${s.visible ? "Oui" : "Non"}</td>
        <td>
          <button class="bouton-mini-discret btn-toggle-service" data-id="${s.id}" data-visible="${s.visible}">${s.visible ? "Masquer" : "Afficher"}</button>
          <button class="bouton-mini-discret btn-suppr-service" data-id="${s.id}">Supprimer</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btn-toggle-service").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await updateDoc(doc(db, "services", bouton.dataset.id), { visible: bouton.dataset.visible !== "true" });
          chargerServicesAdmin();
        } catch (err) { console.error(err); }
      });
    });
    document.querySelectorAll(".btn-suppr-service").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "services", bouton.dataset.id));
          chargerServicesAdmin();
        } catch (err) { console.error(err); }
      });
    });
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des services.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-service").addEventListener("click", async () => {
  const titre = document.getElementById("se-titre").value.trim();
  const texte = document.getElementById("se-texte").value.trim();
  if (!titre || !texte) {
    afficherBandeau("services-bandeau", "Le titre et le texte sont obligatoires.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "services"), {
      titre, texte, visible: true, ordre: Date.now(), dateCreation: serverTimestamp()
    });
    afficherBandeau("services-bandeau", "Service ajouté.", "succes");
    document.getElementById("se-titre").value = "";
    document.getElementById("se-texte").value = "";
    chargerServicesAdmin();
  } catch (err) {
    console.error(err);
    afficherBandeau("services-bandeau", "Erreur lors de l'ajout du service.", "erreur");
  }
});

document.getElementById("btn-init-services").addEventListener("click", async () => {
  const confirmation = window.confirm("Ajouter les services par défaut (sans écraser ceux déjà présents) ?");
  if (!confirmation) return;
  try {
    for (let i = 0; i < servicesParDefaut.length; i++) {
      await addDoc(collection(db, "services"), {
        ...servicesParDefaut[i], visible: true, ordre: i, dateCreation: serverTimestamp()
      });
    }
    afficherBandeau("services-bandeau", "Services par défaut ajoutés.", "succes");
    chargerServicesAdmin();
  } catch (err) {
    console.error(err);
    afficherBandeau("services-bandeau", "Erreur lors de l'initialisation.", "erreur");
  }
});

// ---------- Rendez-vous ----------
async function chargerRdv() {
  const corps = document.querySelector("#table-rdv tbody");
  try {
    const snap = await getDocs(collection(db, "rdv"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="3" class="message-vide">Aucun rendez-vous pour le moment.</td></tr>`;
      return;
    }
    corps.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const client = listeClients.find(c => c.id === data.clientId);
      let colonneCreneaux;
      if (data.creneauChoisi) {
        colonneCreneaux = `<span class="statut-pastille statut-termine">Confirmé — ${new Date(data.creneauChoisi).toLocaleString("fr-BE")}</span>`;
      } else if (data.creneauxProposes && data.creneauxProposes.length) {
        colonneCreneaux = data.creneauxProposes.map(c => `
          <button class="bouton-mini-discret btn-valider-creneau" data-id="${d.id}" data-creneau="${c}">
            Valider : ${new Date(c).toLocaleString("fr-BE")}
          </button>`).join("<br>");
      } else {
        colonneCreneaux = data.date ? new Date(data.date).toLocaleString("fr-BE") : "—";
      }
      return `<tr>
        <td>${client ? client.prenom + " " + client.nom : "—"}</td>
        <td>${data.objet || ""}</td>
        <td>${colonneCreneaux}</td>
      </tr>`;
    }).join("");

    document.querySelectorAll(".btn-valider-creneau").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await updateDoc(doc(db, "rdv", bouton.dataset.id), { creneauChoisi: bouton.dataset.creneau, confirme: true });
          chargerRdv();
        } catch (err) { console.error(err); }
      });
    });
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="3" class="message-vide">Erreur de chargement des rendez-vous.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-rdv").addEventListener("click", async () => {
  const clientId = document.getElementById("rd-client").value;
  const date = document.getElementById("rd-date").value;
  if (!clientId || !date) {
    afficherBandeau("rdv-bandeau", "Le client et la date sont obligatoires.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "rdv"), {
      clientId,
      creneauxProposes: [date],
      creneauChoisi: date,
      objet: document.getElementById("rd-objet").value,
      confirme: true,
      dateCreation: serverTimestamp()
    });
    afficherBandeau("rdv-bandeau", "Rendez-vous créé et confirmé.", "succes");
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
  ["slogan_site", "Slogan (bloc à côté du logo, page d'accueil)"],
  ["accueil_eyebrow", "Accueil — Texte au-dessus du titre (héros)"],
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
  ["apropos_katia_texte3", "À propos — Présentation, paragraphe 3"],
  ["apropos_texte1", "À propos — Paragraphe 1 (Mecadacty)"],
  ["apropos_texte2", "À propos — Paragraphe 2 (Mecadacty)"],
  ["contact_titre", "Contact — Titre"],
  ["contact_chapo", "Contact — Texte d'introduction"],
  ["contact_gsm", "Contact — Ligne téléphone"],
  ["contact_email", "Contact — Ligne e-mail"],
  ["contact_adresse", "Contact — Ligne adresse"],
  ["identite_nom", "Mentions légales — Nom affiché (carte d'identité)"],
  ["identite_societe", "Mentions légales — Société"],
  ["identite_tel", "Mentions légales — Téléphone"],
  ["identite_email", "Mentions légales — E-mail"],
  ["identite_adresse", "Mentions légales — Adresse"],
  ["identite_tva", "Mentions légales — Numéro de TVA"],
  ["rgpd_intro", "RGPD — Texte d'introduction"],
  ["cgv_intro", "CGV — Texte d'introduction"],
  ["cookies_intro", "Cookies — Texte d'introduction"],
  ["temoignages_titre", "Accueil — Titre section témoignages"],
  ["temoignage1_texte", "Témoignage 1 — Citation"],
  ["temoignage1_auteur", "Témoignage 1 — Auteur"],
  ["temoignage2_texte", "Témoignage 2 — Citation"],
  ["temoignage2_auteur", "Témoignage 2 — Auteur"],
  ["temoignage3_texte", "Témoignage 3 — Citation"],
  ["temoignage3_auteur", "Témoignage 3 — Auteur"],
  ["actualites_titre", "Actualités — Titre"],
  ["actualites_chapo", "Actualités — Texte d'introduction"],
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

// ---------- Actualités / conseils ----------
async function chargerArticles() {
  const corps = document.querySelector("#table-articles tbody");
  try {
    const snap = await getDocs(collection(db, "articles"));
    if (snap.empty) {
      corps.innerHTML = `<tr><td colspan="4" class="message-vide">Aucun article pour le moment.</td></tr>`;
      return;
    }
    const articles = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    corps.innerHTML = articles.map(a => `
      <tr>
        <td>${a.date || ""}</td>
        <td>${a.titre}</td>
        <td>${a.visible ? "Oui" : "Non"}</td>
        <td>
          <button class="bouton-mini-discret btn-toggle-article" data-id="${a.id}" data-visible="${a.visible}">${a.visible ? "Masquer" : "Publier"}</button>
          <button class="bouton-mini-discret btn-suppr-article" data-id="${a.id}">Supprimer</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btn-toggle-article").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await updateDoc(doc(db, "articles", bouton.dataset.id), { visible: bouton.dataset.visible !== "true" });
          chargerArticles();
        } catch (err) { console.error(err); }
      });
    });
    document.querySelectorAll(".btn-suppr-article").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "articles", bouton.dataset.id));
          chargerArticles();
        } catch (err) { console.error(err); }
      });
    });
  } catch (err) {
    console.error(err);
    corps.innerHTML = `<tr><td colspan="4" class="message-vide">Erreur de chargement des articles.</td></tr>`;
  }
}

document.getElementById("btn-ajouter-article").addEventListener("click", async () => {
  const titre = document.getElementById("ar-titre").value.trim();
  const contenu = document.getElementById("ar-contenu").value.trim();
  const date = document.getElementById("ar-date").value;
  if (!titre || !contenu) {
    afficherBandeau("articles-bandeau", "Le titre et le contenu sont obligatoires.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "articles"), {
      titre, contenu, date, visible: true, dateCreation: serverTimestamp()
    });
    afficherBandeau("articles-bandeau", "Article publié.", "succes");
    document.getElementById("ar-titre").value = "";
    document.getElementById("ar-contenu").value = "";
    document.getElementById("ar-date").value = "";
    chargerArticles();
  } catch (err) {
    console.error(err);
    afficherBandeau("articles-bandeau", "Erreur lors de la publication de l'article.", "erreur");
  }
});

// ---------- Messagerie (fil 1-à-1 avec chaque client) ----------
// Boîte partagée entre Katia (Admin) et Hélène (Super Admin) : les
// réponses apparaissent toujours comme venant de "Mecadacty", sans
// distinguer quel compte a répondu (HeleneL reste un accès invisible).
let clientMessagerieOuvert = null;

function ouvrirOngletMessagerie() {
  const select = document.getElementById("msg-client");
  select.innerHTML = `<option value="">— Choisir un client —</option>` +
    listeClients.map(c => `<option value="${c.id}">${c.prenom} ${c.nom}</option>`).join("");
}

document.getElementById("msg-client").addEventListener("change", (e) => {
  clientMessagerieOuvert = e.target.value || null;
  chargerFilMessages();
});

async function chargerFilMessages() {
  const conteneur = document.getElementById("fil-messages");
  if (!clientMessagerieOuvert) {
    conteneur.innerHTML = `<p class="message-vide">Choisissez un client pour voir la conversation.</p>`;
    return;
  }
  try {
    const q = query(collection(db, "messages"), where("clientId", "==", clientMessagerieOuvert));
    const snap = await getDocs(q);
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.dateEnvoi && a.dateEnvoi.toMillis ? a.dateEnvoi.toMillis() : 0) - (b.dateEnvoi && b.dateEnvoi.toMillis ? b.dateEnvoi.toMillis() : 0));

    if (messages.length === 0) {
      conteneur.innerHTML = `<p class="message-vide">Aucun message avec ce client pour le moment.</p>`;
    } else {
      conteneur.innerHTML = messages.map(m => {
        const heure = m.dateEnvoi && m.dateEnvoi.toDate ? m.dateEnvoi.toDate().toLocaleString("fr-BE") : "";
        const classe = m.expediteur === "admin" ? "bulle-admin" : "bulle-client";
        return `<div class="bulle-message ${classe}">
          ${m.texte}
          <span class="heure-message">${heure} <button class="btn-suppr-message" data-id="${m.id}">Supprimer</button></span>
        </div>`;
      }).join("");
      conteneur.scrollTop = conteneur.scrollHeight;
    }

    // Marquer comme lus les messages envoyés par le client
    messages.filter(m => m.expediteur === "client" && !m.lu).forEach(m => {
      updateDoc(doc(db, "messages", m.id), { lu: true }).catch(console.error);
    });
    document.getElementById("notif-messagerie").style.display = "none";

    document.querySelectorAll(".btn-suppr-message").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await deleteDoc(doc(db, "messages", bouton.dataset.id));
          chargerFilMessages();
        } catch (err) { console.error(err); }
      });
    });
  } catch (err) {
    console.error(err);
    conteneur.innerHTML = `<p class="message-vide">Erreur de chargement de la conversation.</p>`;
  }
}

document.getElementById("btn-envoyer-message").addEventListener("click", async () => {
  const texte = document.getElementById("msg-texte").value.trim();
  if (!clientMessagerieOuvert || !texte) {
    afficherBandeau("messagerie-bandeau", "Choisissez un client et écrivez un message avant d'envoyer.", "erreur");
    return;
  }
  try {
    await addDoc(collection(db, "messages"), {
      clientId: clientMessagerieOuvert,
      expediteur: "admin",
      texte,
      lu: false,
      dateEnvoi: serverTimestamp()
    });
    document.getElementById("msg-texte").value = "";
    chargerFilMessages();
  } catch (err) {
    console.error(err);
    afficherBandeau("messagerie-bandeau", "Erreur lors de l'envoi du message.", "erreur");
  }
});

async function verifierNotifMessagerie() {
  try {
    const q = query(collection(db, "messages"), where("expediteur", "==", "client"), where("lu", "==", false));
    const snap = await getDocs(q);
    if (!snap.empty) document.getElementById("notif-messagerie").style.display = "inline-block";
  } catch (err) {
    console.warn(err);
  }
}

// ---------- Réinitialiser le contenu du site par défaut ----------
document.getElementById("btn-reinit-contenu").addEventListener("click", async () => {
  const confirmation = window.confirm("Réinitialiser tous les textes du site à leur valeur par défaut ? Cette action est irréversible.");
  if (!confirmation) return;
  try {
    const valeursVides = {};
    clesContenu.forEach(([cle]) => { valeursVides[cle] = deleteField(); });
    await updateDoc(doc(db, "contenu", "site"), valeursVides);
    afficherBandeau("contenu-bandeau", "Contenu réinitialisé aux valeurs par défaut.", "succes");
    chargerContenuAdmin();
  } catch (err) {
    console.error(err);
    // Si le document n'existe pas encore, il n'y a simplement rien à réinitialiser
    afficherBandeau("contenu-bandeau", "Contenu déjà par défaut (ou erreur de connexion).", "info");
  }
});

// ---------- Comptes (Super Admin uniquement) ----------
// Le mot de passe stocké ici est une copie de confort pour le Super Admin
// (risque connu et accepté) — il reflète le mot de passe donné à la création
// du compte, mais NE SE MET PAS À JOUR automatiquement si la personne change
// son mot de passe elle-même (Firebase Authentication ne renvoie jamais un
// mot de passe existant, seul un lien de réinitialisation par e-mail permet
// d'en fixer un nouveau à distance).
async function chargerMotsDePasse() {
  if (!utilisateur || utilisateur.estSuperAdmin !== true) return;
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
        <td>${data.motDePasse || "—"}</td>
        <td>${data.estSuperAdmin ? "Super Admin" : (data.role === "admin" ? "Admin" : "Client")}</td>
        <td>${formaterDate(data.derniereConnexion)}</td>
        <td>
          <button class="bouton-mini-discret btn-reinit" data-email="${data.email}">Lien de réinitialisation</button>
        </td>
      </tr>`;
    }).join("");

    document.querySelectorAll(".btn-reinit").forEach(bouton => {
      bouton.addEventListener("click", async () => {
        try {
          await sendPasswordResetEmail(auth, bouton.dataset.email);
          afficherBandeau("motsdepasse-bandeau", `Lien de réinitialisation envoyé à ${bouton.dataset.email}.`, "succes");
        } catch (err) {
          console.error(err);
          afficherBandeau("motsdepasse-bandeau", "Erreur lors de l'envoi du lien de réinitialisation.", "erreur");
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
    chargerHeuresAdmin(),
    chargerRdv(),
    chargerInscriptions(),
    chargerMessages(),
    chargerContenuAdmin(),
    chargerArticles(),
    chargerServicesAdmin(),
    verifierNotifMessagerie()
  ]);
})();
