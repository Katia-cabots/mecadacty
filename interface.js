// ============================================================
// MECADACTY — Comportements d'interface communs
// ============================================================

import { VERSION_SITE } from "./version.js";

document.addEventListener("DOMContentLoaded", () => {
  // Bouton "Retour à l'accueil" fixe en haut à droite — uniquement sur les
  // pages publiques (les espaces Admin/Client ont déjà leur icône maison
  // dans leur propre en-tête, à côté du bouton "Se déconnecter")
  if (!document.querySelector(".app-entete") && !document.getElementById("bouton-accueil-global")) {
    const lien = document.createElement("a");
    lien.id = "bouton-accueil-global";
    lien.href = "index.html";
    lien.title = "Retour à l'accueil";
    lien.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg>`;
    document.body.appendChild(lien);
  }

  // Numéro de version dans le pied de page public
  const versionEl = document.getElementById("pied-version");
  if (versionEl) versionEl.textContent = "Version " + VERSION_SITE;

  // Menu mobile
  const toggle = document.querySelector(".menu-mobile-toggle");
  const nav = document.querySelector("nav.entete-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("ouvert"));
  }

  // Année dynamique dans le copyright
  document.querySelectorAll(".annee-courante").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Affichage / masquage des champs mot de passe
  document.querySelectorAll(".oeil-toggle").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const input = bouton.previousElementSibling;
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        bouton.textContent = "🙈";
        bouton.setAttribute("aria-label", "Masquer le mot de passe");
      } else {
        input.type = "password";
        bouton.textContent = "👁";
        bouton.setAttribute("aria-label", "Afficher le mot de passe");
      }
    });
  });

  // Interdiction des caractères spéciaux sur les champs identifiant / mot de passe
  // (lettres, chiffres, point et tiret uniquement)
  document.querySelectorAll(".sans-caracteres-speciaux").forEach((input) => {
    input.addEventListener("input", () => {
      const nettoye = input.value.replace(/[^a-zA-Z0-9.\-]/g, "");
      if (nettoye !== input.value) input.value = nettoye;
    });
  });
});

// ---------- Bandeaux de message clairs (erreur / succès / info) ----------
export function afficherBandeau(elementId, texte, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = texte;
  el.className = "bandeau visible bandeau-" + type;
}

export function masquerBandeau(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = "bandeau";
}
