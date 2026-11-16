# Vie privée

Principe : l'extension ne transmet **que des posts publics filtrés**, avec un payload
minimal, et **rien sur l'utilisateur**. Ce document sert de base à la politique de
confidentialité du site et au formulaire « Pratiques de confidentialité » du Chrome
Web Store. Il n'est pas un avis juridique : à faire relire par une personne compétente.

## Ce qui est transmis

| Donnée | Quand | Vers |
|---|---|---|
| Contenu d'un post public qui correspond aux filtres de l'équipe (ID, pseudo de l'auteur, texte, langue, date, métriques affichées, médias, IDs du post cité / parent) | Envoi des observations (désactivable) | `POST /v1/ingest/observations` |
| Jeton d'installation aléatoire | Avec ces envois seulement | idem |
| IDs numériques des auteurs affichés à l'écran | Affichage des badges | `GET /v1/badges/lookup` (public, cachable) |
| ID d'un post filtré + langue choisie | Affichage des vérifications | `GET /v1/content/x/{id}/verdict` |
| ID d'un auteur à coche grise | Indice « government » | `POST /v1/badges/x-government-hints` |
| Contenu d'un formulaire (demande, signalement) | Sur action explicite | `POST /v1/badges/requests` / `reports` |

## Ce qui n'est jamais transmis

Le compte X connecté, son pseudo, l'historique de navigation, le fil d'actualité
complet, les messages privés, les notifications, les brouillons, les posts protégés,
les publicités. Aucun cookie n'est envoyé (`credentials: "omit"`). Côté serveur : le
jeton n'est pas stocké (pseudonyme du jour seulement), aucune IP n'est stockée, aucun
profil n'est constitué.

## Données locales

Réglages, jeton, file d'envoi, caches : dans `chrome.storage` du navigateur, jamais
synchronisés. La désinstallation les supprime. Le bouton « réinitialiser le jeton » en
génère un nouveau.

## Permissions demandées

| Permission | Justification (Chrome Web Store) |
|---|---|
| `storage` | Réglages, file d'envoi et caches, en local |
| `alarms` | Rafraîchir les filtres (15 min) et vider la file (1 min) malgré l'arrêt du service worker |
| `https://x.com/*` | Lire les posts affichés et y insérer badges et vérifications |
| Domaine de gate | Appeler l'API Seat 12A |

Aucune autre permission (`tabs`, `history`, `cookies`, `webRequest`, `<all_urls>`…).
Seules les polices de l'extension sont exposées à x.com (`web_accessible_resources`),
pour l'affichage des badges et vérifications.

Pas de code distant : les filtres sont des données, jamais du code.
