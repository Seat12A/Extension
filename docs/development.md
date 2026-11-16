# Développement

## Prérequis

Node 22+, npm. Chromium ou Chrome 116+.

```bash
npm install
```

```bash
cp .env.example .env.local   # VITE_GATE_URL, VITE_SITE_URL
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run build` | Build de production dans `dist/` |
| `npm run dev` | Build en mode surveillance (recharger l'extension après chaque build) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitaires (vitest, jsdom) |
| `npm run e2e` | Build + tests de bout en bout Playwright (extension chargée dans Chromium) |
| `npm run icons` | Régénère les PNG d'icône depuis `src/assets/brand/logo-sky.svg` |
| `npm run zip` | Build + archive `seat12a-extension-<version>.zip` pour le Store |

## Charger l'extension

1. `npm run build`
2. `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » →
   dossier `dist/`.

## Contre un gate local

Dans le dépôt de Tower :

```bash
uv run tower migrate
```

```bash
uv run tower ingest publish-filters filters.json --version dev.1
```

```bash
uv run tower gate
```

Puis ici, avec `VITE_GATE_URL=http://localhost:8000` dans `.env.local` (par défaut, le build vise la production `https://api.seat12a.org`) :

```bash
npm run build
```

Les types de `src/shared/api-types.ts` suivent `/openapi.json` de gate (disponible hors
production) ; à mettre à jour si le contrat évolue.

## Tests

- **Parseur** (`test/content/parser.test.ts`) sur des fixtures HTML de X
  (`test/fixtures/`) : post simple, citation, réponse, médias, post long, publicité,
  post protégé. **À réenregistrer quand X change son DOM** : enregistrer l'`article`
  depuis les outils de développement, anonymiser, remplacer la fixture.
- **Filtres, file, worker** : tests unitaires avec un `chrome` simulé
  (`test/chrome-mock.ts`) et `fetch` simulé.
- **i18n** : mêmes clés dans toutes les langues, aucune chaîne visible en dur.
- **Bout en bout** (`test/e2e/`) : Chromium avec `--load-extension`, x.com servi par
  une fixture locale (routage Playwright) et un faux gate ; jamais contre x.com.

## Quand X change son DOM

Tous les sélecteurs sont dans `src/content/selectors.ts`. Un post non reconnu est
ignoré silencieusement : si plus rien ne remonte, vérifier d'abord ces sélecteurs sur
une page réelle, mettre à jour les fixtures, puis les tests.

## Publication

1. Version semver dans `package.json` (reportée dans le manifeste au build).
2. `VITE_GATE_URL=https://<gate> VITE_SITE_URL=https://<site> npm run zip`
3. Chrome Web Store : d'abord en « non répertorié » pour l'équipe, puis public. Même
   paquet pour Microsoft Edge Add-ons.
4. Formulaire de confidentialité : voir [privacy.md](privacy.md). Captures d'écran et
   descriptions FR/EN : voir [store-listing.md](store-listing.md).

Le serveur reste compatible avec les anciennes versions (règle expand/contract) : pas
besoin de forcer la mise à jour.

## Liste de contrôle avant publication

- [ ] Seules `storage`, `alarms` et les deux hôtes sont demandés (`dist/manifest.json`).
- [ ] Aucun appel réseau depuis le content script (`grep fetch dist/content.js`).
- [ ] Rien n'est envoyé sans version de filtres active ; seuls les posts filtrés partent.
- [ ] Aucune donnée sur l'utilisateur dans les payloads (vérifié sur captures réseau).
- [ ] Jeton envoyé seulement sur `POST /v1/ingest/observations`.
- [ ] Lots ≤ 50 items et ≤ 256 Ko ; file et caches bornés.
- [ ] `TWR-ING-002` suspend jusqu'à minuit UTC ; `429` et `5xx` en backoff.
- [ ] `404` sur un verdict n'affiche rien ; traduction automatique signalée.
- [ ] Aucune chaîne en dur ; `fr` et `en` complets ; langue choisie appliquée partout.
- [ ] Coches X masquées ; badges par lots triés de 100 IDs ; `ETag` respecté ; indices
      dédoublonnés ; `TWR-BDG-019` sans nouvel essai automatique.
- [ ] Politique de confidentialité en ligne et formulaire du Store rempli.
