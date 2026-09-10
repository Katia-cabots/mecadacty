# Mecadacty — Site internet

Version : **V01-016**

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
- **Logo Mecadacty** (fourni) intégré dans l'en-tête de toutes les
  pages publiques
- Badge personnel HL en SVG (bas droite des pages publiques uniquement)

## Collections Firestore

### `utilisateurs`
| Champ | Type | Description |
|---|---|---|
| nom, prenom | string | Identité |
| gsm, email | string | Coordonnées (email généré automatiquement si non fourni : `identifiant@mecadacty.be`) |
| identifiant | string | Login (sans caractères spéciaux) |
| motDePasse | string | Mot de passe en clair (voir note sécurité ci-dessous) |
| role | string | `"admin"` ou `"client"` |
| estSuperAdmin | boolean | `true` uniquement pour le compte `HeleneL` |
| derniereConnexion | timestamp | Mise à jour à chaque connexion réussie |
| dateReinitialisationMdp | timestamp | Mise à jour lors d'une réinitialisation |
| dateCreation | timestamp | Date de création du compte |
| nbDossiers | number | Compteur (informatif) |

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
| date | string | Date affichée (AAAA-MM-JJ) |
| visible | boolean | Publié ou masqué |
| dateCreation | timestamp | |

### `demandesInscription`
| Champ | Type | Description |
|---|---|---|
| nom, prenom, gsm, email | string | Coordonnées du demandeur |
| date | timestamp | |
| traitee | boolean | `false` = en attente (point rouge admin) |

### `messagesContact`
| Champ | Type | Description |
|---|---|---|
| nom, email, gsm | string | Coordonnées |
| message | string | Contenu du message |
| date | timestamp | |
| lu | boolean | `false` = non lu (point rouge admin) |

### `contenu` (document unique `site`)
Un seul document contenant toutes les clés de texte éditable des
pages publiques (voir la liste dans `admin.js`, section "Contenu du
site").

## Sécurité — note importante
L'authentification est "maison" (identifiant/mot de passe comparés
côté client, pas Firebase Authentication). C'est volontairement
simple pour rester gratuit, comme pour le site des Cabots de
Fernelmont à ses débuts — mais cela veut dire que les règles
Firestore actuelles (`firestore.rules`) sont ouvertes : à resserrer
plus tard si des données sensibles étaient stockées.

## À faire avant mise en ligne
1. Créer le projet Firebase **"mecadacty"** (Firestore Database)
2. Compléter `firebase-config.js` avec les identifiants du projet
3. Créer le compte **Super Admin** directement dans Firestore,
   collection `utilisateurs` :
   - `identifiant`: `HeleneL`
   - `motDePasse`: `Helene123`
   - `role`: `admin`
   - `estSuperAdmin`: `true`
   - `nom`: `Laruelle`, `prenom`: `Hélène`
4. Créer le compte **Admin** de Katia de la même façon (`role: admin`,
   `estSuperAdmin: false`)
5. Compléter les coordonnées réelles sur la page Contact
6. Les 3 pages légales (Cookies, RGPD, CGV) sont déjà rédigées avec les informations disponibles — à relire/ajuster si besoin
