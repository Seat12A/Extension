# Contrat avec 12A Tower

Ce que l'extension consomme de gate, et la conduite du client pour chaque réponse. La
source de vérité reste la documentation de Tower (`api.md`, `ingestion.md`,
`badges.md`, `auth.md`) ; ce fichier décrit l'implémentation côté client.

Toujours décider sur `error.code`, jamais sur `message` :

```json
{"error": {"code": "TWR-ING-002", "message": "...", "details": {}, "request_id": "...", "fingerprint": "..."}}
```

## Endpoints utilisés

| Endpoint | Auth | Module | Conduite |
|---|---|---|---|
| `GET /v1/ingest/config` | public | `background/config.ts` | Démarrage puis toutes les 15 min ; `If-None-Match` → `304` garde le cache ; échec → dernière config connue ; `version` nulle (avec `filters: {}`, clés absentes = vides) → rien n'est envoyé |
| `POST /v1/ingest/observations` | `X-Installation-Token` | `background/queue.ts` | Corps `{filter_version, items}` : version au niveau du lot (un lot = une version), items limités aux champs du schéma (champ inconnu = `422`). Voir [file d'envoi](#file-denvoi) |
| `GET /v1/verdict-index/x/{bucket}` | public | `background/verdict-index.ts` | Boîte = 4 premiers caractères hex de SHA-256(ID) ; cache **mémoire** LRU 2 000 boîtes, 5 min ; une requête en vol par boîte ; `If-None-Match` → `304` garde la liste ; `404` (route pas déployée) → ancien comportement, nouvel essai dans 10 min ; `422` journalisé ; `5xx`/réseau → rien, nouvel essai dans 1 min |
| `GET /v1/content/x/{id}/verdict?lang=` | public | `background/verdicts.ts` | Seulement pour les posts présents dans l'index ; `404 TWR-FCK-013` → rien à afficher (mis en cache) ; cache 5 min |
| `GET /v1/badges/categories` | public | `background/badges.ts` | Démarrage puis toutes les 24 h |
| `GET /v1/badges/lookup?platform=x&ids=…` | public | `background/badges.ts` | IDs numériques triés, 100 max, `ETag`/`304`, cache par ID 5 min (absents compris) ; chaque compte normalisé par `normalizeBadgeAccount` |
| `GET /v1/badges/accounts/x/{id}` | public | `background/badges.ts` | Détail au clic ; réponse `{account, badge, affiliations}` normalisée par la même fonction ; `404 TWR-BDG-001` → rien |
| `POST /v1/badges/x-government-hints` | public, limité par IP | `background/badges.ts` | 50 IDs max, un même ID une fois par semaine |
| `POST /v1/badges/requests`, `POST /v1/badges/reports` | public, limité par IP | `background/forms.ts` | `201` ; `TWR-BDG-019` → « réessayez dans une minute », pas de nouvel essai automatique |

Le jeton n'est envoyé que sur `POST /v1/ingest/observations`. Toutes les requêtes
partent avec `credentials: "omit"` (aucun cookie) et un délai maximal de 15 s.

## Jeton d'installation

32 octets de `crypto.getRandomValues`, encodés en base64url sans remplissage
(43 caractères). Créé à l'installation, stocké dans `chrome.storage.local`, jamais
affiché ni journalisé. Le serveur n'en garde qu'un pseudonyme du jour
(`HMAC-SHA256(secret du jour, jeton)`) dont le secret est détruit le lendemain. Les
options permettent de le réinitialiser.

## Lecture des posts (content script)

Pages lues : `/home`, profils publics, pages de post, recherche. Jamais : messages,
notifications, réglages, brouillons, signets, le profil de l'utilisateur connecté, ses
propres posts. Ignorés : publicités, posts protégés.

| Champ | Source dans le DOM de X (centralisée dans `content/selectors.ts`) |
|---|---|
| `external_id`, `author.handle` | lien `/<pseudo>/status/<id>` qui entoure la balise `time` du post |
| `text` | `[data-testid="tweetText"]` d'origine (émojis par leur `alt`), sans le bloc de traduction de X ni le post cité |
| `lang_hint` | attribut `lang` du bloc de texte (sauf `und`, `qme`, `zxx`…) |
| `created_at` | `time[datetime]` |
| `metrics` | compteurs affichés (réponses, reposts, j'aime, vues) ; `1,2 k` → 1200 ; absent → omis |
| `quoted_external_id` | lien de statut du bloc cité s'il est affiché |
| `parent_external_id` | page d'un post seulement : post affiché juste au-dessus du post principal |
| `media` | images et affiches vidéo en `https`, 4 au plus |

Un post non reconnu est ignoré, jamais envoyé à moitié.

## Filtres

Un post est envoyé s'il correspond à **un mot-clé** ou à **un compte** de
`filters.accounts`, puis s'il respecte les seuils.

- Mots-clés : normalisation alignée sur E0 (NFKC, minuscules, espaces compactés) ; mot
  seul = mot entier, expression = sous-chaîne (`src/shared/text.ts`).
- Comptes : par ID numérique, seulement si l'ID de l'auteur est connu (voir points
  ouverts).
- Seuils (**sémantique provisoire**, en attente de Tower) : `min_views`, `min_likes`,
  `min_reposts`, `min_replies` exigent une métrique affichée supérieure ou égale ; une
  métrique absente fait échouer le seuil ; les autres noms sont ignorés.

## File d'envoi

| Règle | Valeur |
|---|---|
| Dédoublonnage local | par `external_id`, 24 h, 5 000 entrées |
| Envoi | à 50 items ou toutes les 60 s ; ≤ 256 Ko par requête (lot coupé sinon) |
| Texte | 20 000 caractères max par item |
| Âge max d'un item | 23 h (le serveur réécrit `observed_at` au-delà de 24 h) |
| Taille de la file | 500 items, les plus anciens jetés |

| Réponse | Conduite |
|---|---|
| `202` | Items retirés de la file, refusés compris (jamais renvoyés) |
| `401 TWR-ING-001` | Jeton mal formé : nouveau jeton généré, lot renvoyé une fois |
| `429 TWR-ING-002` | Quota quotidien (500) : envois suspendus jusqu'à 00:00 UTC, file vidée |
| `429 TWR-ING-007` | Limite par IP : 30 s, puis backoff exponentiel avec gigue (max 30 min) |
| `422 TWR-ING-003`, `413 TWR-ING-004` | Bug client : lot coupé en deux et renvoyé |
| `422` par item (`TWR-ING-005/006`, `TWR-GEN-001`) | Item jeté |
| `503 TWR-ING-010` | Backoff 1 min → 30 min, file conservée |
| Réseau, `5xx` | Backoff exponentiel avec gigue, file conservée |

Aucune erreur d'envoi n'est montrée comme erreur technique : la popup indique seulement
l'état (actif, quota atteint, injoignable, sans filtres, en pause).

## Vérifications : quels posts interroger ?

**Tous les posts affichés**, filtrés ou non, et même sans version de filtres active.
Les filtres ne servent plus qu'à l'envoi des observations.

1. Le content script envoie au service worker les IDs des posts affichés (et, à part,
   ceux qui passent les filtres). Rien ne sort encore.
2. Le service worker calcule SHA-256(ID) et ne demande à gate que la **boîte** (4
   caractères hex) : `GET /v1/verdict-index/x/{boîte}`.
3. Seuls les posts dont l'empreinte **complète** figure dans la liste sont interrogés
   par ID (`GET /v1/content/x/{id}/verdict`).
4. Route absente (`404`, pas encore déployée) : ancien comportement, posts filtrés seulement.

Un « pas de verdict » est redemandé au bout de 5 min (une vérification a pu être publiée
entre-temps). Délai d'apparition ou de disparition d'une vérification : 5 min au plus.

## Badges

- Coches de X masquées pour tous les auteurs (classe `seat12a-badges` sur `<html>`).
- **Badge et affiliation sont indépendants** (Tower, 21/11/2026) :
  - la coche Seat 12A ne vient **que du badge propre** du compte (`badge`) ; `category` et
    `color` du lookup valent `null` sans badge propre, et la coche n'est alors pas affichée ;
  - une affiliation affiche le **logo de l'organisation principale** (`affiliation`) à côté
    du nom, sans coche ; sans `logo_url`, l'initiale de l'organisation sur une tuile neutre ;
  - un compte peut avoir les deux (coche **et** logo) ; la catégorie de l'affilié ne se
    déduit jamais de celle de son organisation (`org.category`/`org.color` ne servent qu'au détail).
- Couleur de la coche selon la catégorie et le thème de X (`src/shared/palette.ts`).
- Infobulle et détail au clic : « Catégorie · domaine » (`badge.expertise` pour les experts),
  la raison de la certification, puis la liste `affiliations` (5 au plus, principale en
  tête). Le nom du compte (`badge.label`) n'est pas répété. Le détail propose « Demander
  un badge » et « Signaler ce badge » (formulaires des options, compte prérempli).
- `personality` est devenu `verified` : le client lit encore l'ancienne valeur comme
  `verified` et envoie `verified` dans les demandes.
- Caches du lookup et du détail : clés `badgeCache2`, `lookupEtags2`,
  `accountDetailCache2` (les entrées de l'ancien format ne sont jamais relues).
- Coche grise de X → indice « government » envoyé si l'ID est connu ; **aucun badge
  n'est affiché sur la seule foi de la coche grise**.
