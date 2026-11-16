# Seat 12A — extension Chromium

Extension Manifest V3 de **Seat 12A**, le service francophone de fact-checking et de
modération centré sur X. C'est un client de **gate**, l'API de 12A Tower : elle ne parle
qu'à l'API.

Elle fait trois choses :

1. **Remonter des observations** : les posts affichés qui correspondent aux filtres
   publiés par l'équipe partent vers Tower (`POST /v1/ingest/observations`).
2. **Afficher les vérifications** validées sous les posts concernés.
3. **Remplacer les badges de X** : coches masquées, badges Seat 12A par catégorie.

Et jamais : rien sur l'utilisateur, aucune publication ni action sur X, aucun scraping.

## Démarrage rapide

```bash
npm install
```

```bash
npm run build
```

Puis `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée »
→ `dist/`. Gate visé par défaut : `http://localhost:8000` (`VITE_GATE_URL`, voir
`.env.example`).

```bash
npm test
```

## Pile

TypeScript strict · Manifest V3 · Vite · React 19 (popup, options) ·
[shadcn/ui](https://ui.shadcn.com) · Tailwind CSS v4 · Google Material Symbols ·
Google Sans · vitest · Playwright. Français et anglais, thèmes clair et sombre.

## Documentation

| Document | Contenu |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Contextes MV3, messages, stockage, build |
| [docs/tower-contract.md](docs/tower-contract.md) | Endpoints, lecture des posts, filtres, file d'envoi, codes d'erreur |
| [docs/design.md](docs/design.md) | Système visuel, tokens, badges, marque |
| [docs/i18n.md](docs/i18n.md) | Traductions, ajout d'une langue |
| [docs/privacy.md](docs/privacy.md) | Données transmises ou non, permissions |
| [docs/development.md](docs/development.md) | Commandes, tests, gate local, publication, liste de contrôle |
| [docs/open-points.md](docs/open-points.md) | Manques côté Tower et choix provisoires |
| [docs/store-listing.md](docs/store-listing.md) | Fiche Chrome Web Store FR/EN |
