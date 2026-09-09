// ============================================================
// MECADACTY — Comportements d'interface communs
// ============================================================

import { VERSION_SITE } from "./version.js";

document.addEventListener("DOMContentLoaded", () => {
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
