# mecadacty — Site internet

Version : **V01-037**

## Structure du dépôt GitHub
Tous les fichiers sont à la racine (HTML, CSS, JS), avec un seul
dossier `assets/` pour les images — pas de sous-dossiers.

## Nouveautés de cette version (V01-002)
- 3 niveaux : **Super Admin** (Hélène, identifiant `HeleneL`), **Admin**
  (Katia), **Clients** — Super Admin et Admin utilisent la
  même interface (`admin.html`), seul le compte super admin voit
  l'onglet "Mots de passe"
- Onglet **Mots de passe** (visible uniquement sur le compte `HeleneL`) :
  tableau Nom / Identifiant / Mot de passe / Rôle / Dernière connexion,
  avec bouton de réinitialisation
- **Dernière connexion** de chaque client enregistrée et visible côté
  Admin (liste des clients) et côté Super Admin (onglet Mots de passe)
- Bouton **"+ Ajouter un client"** en haut à droite de l'onglet Clients
- **Points rouges** de notification sur les onglets Clients, Demandes
  d'inscription et Messages quand il y a du nouveau
- **Retour à l'accueil** possible depuis n'importe quelle page (icône
  maison dans l'en-tête des espaces Admin/Membre)
- **Messages d'erreur clairs** partout (bandeaux verts/rouges/bleus)
- Interdiction des **caractères spéciaux** dans les champs identifiant
  et mot de passe (lettres, chiffres, points, tirets uniquement)
- **Numéro de version** affiché dans l'en-tête Admin/Membre et en
  commentaire dans `firestore.rules`
- **Logo mecadacty** (fourni) intégré dans l'en-tête de toutes les
  pages publiques
- Badge personnel HL en SVG (bas droite des pages publiques uniquement)

## Collections Firestore

### `utilisateurs`
**L'ID du document est l'UID Firebase Authentication de la personne** (plus un ID auto).
| Champ | Type | Description |
|---|---|---|
| nom, prenom | string | Identité |
| gsm, email | string | Coordonnées (email généré automatiquement si non fourni : `identifiant@mecadacty.be`) |
| identifiant | string | "User" affiché à la connexion (sans caractères spéciaux) |
| motDePasse | string | Copie de confort du mot de passe, visible par le Super Admin (risque connu et accepté) — ne se met pas à jour automatiquement si la personne change son mot de passe elle-même |
| role | string | `"admin"` ou `"client"` |
| estSuperAdmin | boolean | `true` uniquement pour le compte `HeleneL` |
| derniereConnexion | timestamp | Mise à jour à chaque connexion réussie |
| dateCreation | timestamp | Date de création du compte |
| nbDossiers | number | Compteur (informatif) |

### `identifiantsPublics`
**L'ID du document est l'identifiant texte** (ex. `HeleneL`, `katia.r`). Lecture publique nécessaire pour retrouver l'e-mail associé à un "User" avant la connexion — ne contient jamais de mot de passe.
| Champ | Type | Description |
|---|---|---|
| email | string | E-mail Firebase Authentication associé à cet identifiant |

### `dossiers`
| Champ | Type | Description |
|---|---|---|
| clientId | string | Référence à `utilisateurs` |
| type | string | `"ponctuel"` ou `"recurrent"` |
| description | string | Description de la mission |
| statut | string | `"attente"`, `"en_cours"`, `"termine"` |
| dateCreation | timestamp | |

### `rdv`
| Champ | Type | Description |
|---|---|---|
| clientId | string | Référence à `utilisateurs` |
| creneauxProposes | array de string | Les créneaux (ISO datetime-local) proposés par le client (jusqu'à 3) |
| creneauChoisi | string ou null | Le créneau validé par l'admin parmi les proposés |
| objet | string | Objet du rendez-vous |
| confirme | boolean | `true` une fois qu'un créneau a été validé |
| facturable | boolean | `false` = rendez-vous non facturable (défaut : `true`) |
| dateCreation | timestamp | |

### `heures`
| Champ | Type | Description |
|---|---|---|
| clientId | string | Référence à `utilisateurs` — chaque client ne voit que ses propres entrées |
| date | string | Date (AAAA-MM-JJ) |
| heures | number | Heures prestées |
| description | string | Détail de la prestation |
| dateCreation | timestamp | |

### `messages`
| Champ | Type | Description |
|---|---|---|
| clientId | string | Référence à `utilisateurs` |
| expediteur | string | `"client"` ou `"admin"` (boîte partagée Katia/Hélène) |
| texte | string | Contenu du message |
| lu | boolean | Lu par le destinataire ou non (point rouge sinon) |
| dateEnvoi | timestamp | |

### `articles`
| Champ | Type | Description |
|---|---|---|
| titre, contenu | string | Contenu de l'article |
| resume | string | Phrase d'accroche affichée sur la vignette |
| photoUrl | string | URL de la photo (facultatif, sinon icône par défaut) |
| date | string | Date affichée (AAAA-MM-JJ) |
| visible | boolean | Publié ou masqué |
| dateCreation | timestamp | |

### `services`
| Champ | Type | Description |
|---|---|---|
| titre, texte | string | Contenu de la carte service (page Services) |
| visible | boolean | Affiché sur le site ou masqué |
| ordre | number | Ordre d'affichage |
| dateCreation | timestamp | |

### `avis`
| Champ | Type | Description |
|---|---|---|
| clientId | string | Référence à `utilisateurs` |
| clientNom | string | Nom affiché publiquement avec l'avis |
| texte | string | Contenu de l'avis |
| note | number | Note de 1 à 5 |
| valide | boolean | `false` = en attente de validation admin (point rouge), `true` = publié sur "Ils parlent de nous" |
| misEnAvant | boolean | `true` = affiché parmi les 3 avis "à la une" sur l'accueil (max 3, géré par l'admin) |
| dateCreation | timestamp | |

### `demandesInscription`
| Champ | Type | Description |
|---|---|---|
| nom, prenom, gsm, email | string | Coordonnées du demandeur |
| date | timestamp | |
| traitee | boolean | `true` une fois convertie en compte client |
| statut | string | `"nouveau"`, `"en_cours"` ou `"converti"` (suivi façon CRM) |

### `messagesContact`
| Champ | Type | Description |
|---|---|---|
| nom, email, gsm | string | Coordonnées |
| message | string | Contenu du message |
| date | timestamp | |
| lu | boolean | `false` = non lu (point rouge admin) |
| statut | string | `"nouveau"`, `"en_cours"` ou `"traite"` (suivi façon CRM) |

### `contenu` (document unique `site`)
Un seul document contenant toutes les clés de texte éditable des
pages publiques (voir la liste dans `admin.js`, section "Contenu du
site").

## Sécurité
Le site utilise **Firebase Authentication** (e-mail/mot de passe) — Firestore
n'a jamais accès aux mots de passe, et les règles (`firestore.rules`)
vérifient réellement l'identité de la personne connectée : un client ne
peut lire/écrire que ses propres données, seul un compte `admin` voit tout.
Reste gratuit (offre gratuite Firebase Authentication largement suffisante
pour ce volume d'utilisateurs).

## Migration vers Firebase Authentication (V01-037)

Le site utilise maintenant une vraie authentification Firebase (et non plus des mots de passe stockés en clair dans Firestore). **Étapes à suivre dans la console Firebase, dans cet ordre :**

1. **Authentication → Sign-in method** → activer la méthode **E-mail/Mot de passe**.
2. **Authentication → Users → Add user**, créer les 2 comptes existants :
   - `helenel@mecadacty.be` / mot de passe `Helene123` → **noter l'UID généré**
   - `katia.r@mecadacty.be` / mot de passe `Katia5300` → **noter l'UID généré**
3. **Firestore → collection `utilisateurs`** : supprimer les 2 anciens documents (ceux créés manuellement, avec un champ `motDePasse`). Recréer 2 nouveaux documents dont **l'ID du document est exactement l'UID noté à l'étape 2** (et non un ID auto) :
   - Document `{UID de Hélène}` : `identifiant: HeleneL`, `email: helenel@mecadacty.be`, `nom: Laruelle`, `prenom: Hélène`, `role: admin`, `estSuperAdmin: true`, `motDePasse: Helene123`, `derniereConnexion: null`
   - Document `{UID de Katia}` : `identifiant: katia.r`, `email: katia.r@mecadacty.be`, `nom: Renard`, `prenom: Katia`, `role: admin`, `estSuperAdmin: false`, `motDePasse: Katia5300`, `derniereConnexion: null`, `nbDossiers: 0`
   - Le champ `motDePasse` est une copie de confort pour l'onglet "Mots de passe" (Super Admin) — pas la vraie source de vérité pour la connexion, qui reste gérée par Firebase Authentication.
4. **Firestore → collection `identifiantsPublics`** (nouvelle, à créer) : 2 documents, dont **l'ID du document est l'identifiant texte lui-même** :
   - Document `HeleneL` : `{ email: "helenel@mecadacty.be" }`
   - Document `katia.r` : `{ email: "katia.r@mecadacty.be" }`
5. **Firestore → Règles** : coller le contenu de `firestore.rules` (fourni dans ce zip) et cliquer sur **Publier**.
6. Tester la connexion avec `HeleneL` / `Helene123` puis `katia.r` / `Katia5300`.

Les futurs comptes clients créés depuis l'Admin passent maintenant automatiquement par ce système (plus besoin de manipulation manuelle).

## À faire avant mise en ligne
1. Suivre la migration Firebase Authentication ci-dessus
2. Compléter les coordonnées réelles sur la page Contact si besoin
3. Les 3 pages légales (Cookies, RGPD, CGV) sont déjà rédigées avec les informations disponibles — à relire/ajuster si besoin
