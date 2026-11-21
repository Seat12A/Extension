# Architecture

L'extension est un client de **gate** (l'API de 12A Tower) comme les autres : elle ne
parle qu'à l'API, jamais à la base. Manifest V3, TypeScript strict, Vite.

## Contextes et responsabilités

```
┌────────────────────────── x.com (onglet) ──────────────────────────┐
│ content script (src/content)                                      │
│  · lit le DOM affiché (MutationObserver, par paquets)             │
│  · parse les posts, applique les filtres localement               │
│  · affiche badges et vérifications (Shadow DOM)                   │
│  · AUCUN appel réseau                                             │
└───────────────┬────────────────────────────────────────────────────┘
                │ chrome.runtime.sendMessage (src/shared/messages.ts)
┌───────────────▼────────────────────────────────────────────────────┐
│ service worker (src/background)                                   │
│  · seul à appeler gate (fetch, credentials: "omit")               │
│  · jeton d'installation, filtres (ETag), file d'envoi, backoff    │
│  · caches bornés (verdicts, badges), quotas, alarmes              │
│  · AUCUN accès au DOM, aucun état durable en mémoire              │
└───────────────▲────────────────────────────────────────────────────┘
                │ mêmes messages
┌───────────────┴──────────────┐   chrome.storage.local (réglages)
│ popup / options (src/popup,  │◄─ lus/écrits directement par
│ src/options, React+shadcn)   │   tous les contextes
└──────────────────────────────┘
```

| Partie | Fait | Ne fait pas |
|---|---|---|
| Content script | Observe le DOM, extrait les posts visibles, filtre, envoie les candidats au worker, affiche badges et verdicts | Aucun `fetch` |
| Service worker | Jeton, config, file d'envoi, appels à gate, caches, quotas | Aucun accès au DOM |
| Popup / options | Réglages (`chrome.storage.local`), état, formulaires badges | Aucun appel réseau direct |

**Pourquoi tout le réseau passe par le worker** : depuis Chrome 85 un `fetch` lancé par
un content script est soumis au CORS de la page (`https://x.com`). Le worker ne l'est
pas pour les hôtes de `host_permissions`. Rien à configurer côté Tower.

**Worker éphémère** : MV3 arrête le worker après ~30 s d'inactivité. File, compteurs,
backoff, jeton et config sont dans `chrome.storage.local` ; les caches dans
`chrome.storage.session` ; les tâches périodiques passent par `chrome.alarms`.

## Arborescence

```
manifest            généré par scripts/build.mjs (host_permissions dérivé de VITE_GATE_URL)
src/
  background/       service worker : api, token, config, queue, verdicts, badges, forms, status, router
  content/          content script : selectors, parser, numbers, page, filter, author-ids, pipeline, ui/
  popup/ options/   pages React (shadcn/ui)
  pages/            popup.html, options.html (points d'entrée Vite)
  ui/               design system partagé des pages : globals.css (tokens), composants shadcn,
                    icônes Material Symbols, i18n React, thème
  shared/           contrat commun à tous les contextes : types API, messages, réglages,
                    i18n, palette, normalisation du texte, constantes
  locales/<lang>/   traductions (common, content, popup, options) → _locales au build
  assets/brand/     SVG de la marque (logos, badge de vérification)
public/icons/       icônes PNG générées (npm run icons)
test/               vitest (unitaires) + fixtures HTML de X + e2e Playwright
```

## Protocole de messages

Défini une seule fois dans `src/shared/messages.ts` (union `Request` + `ResponseMap`),
utilisé par `send()` côté appelant et par `router.ts` côté worker (switch exhaustif).

| Message | Émetteur | Effet côté worker |
|---|---|---|
| `getConfig` | content | Filtres en cache (rafraîchis toutes les 15 min) |
| `observe` | content | Mise en file des posts filtrés (si envoi actif et version de filtres active) |
| `getVerdicts` | content | `GET /v1/content/x/{id}/verdict` avec cache 5 min (y compris les 404) |
| `lookupBadges` | content | `GET /v1/badges/lookup` par lots triés de 100, cache par ID |
| `getAccountDetail` | content, options | `GET /v1/badges/accounts/x/{id}` |
| `governmentHints` | content | `POST /v1/badges/x-government-hints`, dédoublonné 7 jours |
| `getBadgeCategories` | options | `GET /v1/badges/categories`, cache 24 h |
| `submitBadgeRequest` / `submitBadgeReport` | options | `POST /v1/badges/requests` / `reports`, sans nouvel essai automatique |
| `getStatus` | popup, options | État calculé (actif, pause, quota, hors ligne, sans filtres) |
| `resetToken` | options | Nouveau jeton d'installation |
| `openOptions` | content | Ouvre `options.html#<onglet>?account=<id>` |

Le worker ignore tout message dont `sender.id` n'est pas l'extension elle-même.

## Stockage

| Clé | Zone | Contenu |
|---|---|---|
| `settings` | local | Réglages utilisateur (`src/shared/settings.ts`) |
| `installToken` | local | Jeton d'installation (jamais affiché ni journalisé) |
| `ingestConfig` | local | `{etag, version, filters, fetchedAt}` |
| `queue`, `dedupe`, `sendState` | local | File d'envoi, dédoublonnage 24 h, compteur du jour, quota, backoff |
| `badgeCategories`, `govHints` | local | Catégories (24 h), indices déjà envoyés (7 jours) |
| `verdictCache`, `badgeCache`, `lookupEtags`, `accountDetailCache` | session | Caches bornés, perdus à la fermeture du navigateur |
| `authorIds` | session | Correspondance pseudo → ID numérique apprise dans le DOM (voir points ouverts) |

| `cacheEpoch` | local | Horodatage du dernier « Recharger les données » (les onglets x.com l'écoutent) |

Tout est **borné** (nombre d'entrées et durée) : une charge forte ralentit, elle ne
déborde pas.

Le bouton ⟳ de la popup (`src/background/cache.ts`) vide `verdictCache`, `badgeCache`,
`lookupEtags`, `accountDetailCache`, `authorIds` et `badgeCategories`, recharge la
config sans `If-None-Match`, contourne le cache HTTP du navigateur pendant 2 min
(`cache: "reload"`), puis écrit `cacheEpoch` : chaque onglet x.com oublie alors ses
réponses en mémoire et redessine. Il ne touche ni aux réglages, ni au jeton, ni à la
file d'envoi, ni au quota, ni aux indices « government » déjà envoyés.

## Build

`scripts/build.mjs` lance trois builds Vite, car les contextes MV3 diffèrent :

1. pages (popup, options) : application multi-page classique ;
2. content script : un seul fichier **IIFE** (les content scripts ne sont pas des modules) ;
3. service worker : un seul module ES.

Puis il fusionne `src/locales/<lang>/*.json` en `_locales/<lang>/messages.json`
(clé en double = erreur de build ; les `$1` sont déclarés en placeholders Chrome),
copie les polices utilisées dans la page et écrit `manifest.json`.
