# Points ouverts

Manques côté Tower relevés pendant le développement, et choix provisoires faits par le
client en attendant.

## 1. Identifiant numérique des auteurs (badges, comptes filtrés, indices)

Le lookup des badges, les indices « government » et `filters.accounts` exigent l'ID
numérique X de l'auteur ; le DOM de X montre le pseudo.

**Choix provisoire (couverture partielle)** : `src/content/author-ids.ts` apprend la
correspondance pseudo → ID là où X l'affiche déjà :

- boutons « Suivre » (`data-testid="<id>-follow"`), où qu'ils soient (en-tête de profil,
  post principal d'une page de post, cellules de compte, cartes de survol). Le pseudo
  est lu dans le **libellé du même bouton** (`aria-label="Suivre @pseudo"`), jamais dans
  l'URL : pendant une navigation profil A → profil B, X met à jour l'en-tête avant le
  bouton, et l'ancienne règle associait le pseudo de B à l'ID de A ;
- bloc JSON-LD `ProfilePage` des pages de profil (`additionalName` + `identifier`), qui
  couvre aussi son propre profil et la navigation déconnectée.

Rien n'est chargé ni appelé : seul ce qui est à l'écran est lu. La table vit dans
`chrome.storage.session`, ouvert au content script par le service worker
(`setAccessLevel`). Sans cet appel, la table était perdue à chaque rechargement.

Conséquence : sur le fil, un auteur n'a de badge que si son ID a été vu au moins une
fois pendant la session. **Solution visée** : une correspondance pseudo → ID servie
par Tower pour les seuls comptes connus (badgés ou suivis), l'ID restant la référence
(la règle des badges interdit au client de décider par pseudo).

## 2. Sémantique de `thresholds`

Implémentation provisoire : `min_views`, `min_likes`, `min_reposts`, `min_replies`
(métrique affichée ≥ valeur ; absente → échec) ; autres noms ignorés. À aligner dès que
`ingestion.md` et le validateur fixent la liste.

## 3. Vérifications sur tous les posts

**Réglé côté client (21/11/2026)** : index `GET /v1/verdict-index/x/{boîte}` (voir
`tower-contract.md`). Tant que la route n'est pas déployée en production (elle renvoie
`404 TWR-GEN-002` à cette date), l'extension garde l'ancien comportement : seuls les
posts filtrés sont interrogés, et rien ne s'affiche sans version de filtres active.

## 4. Limitation de débit des lectures publiques

`GET …/verdict` et `GET /v1/badges/lookup` n'ont que le cache HTTP. Côté client :
caches de 5 min, lots de 100, regroupement de 300 ms, une requête par post au plus
par période de cache.

## 5. Nom

Nom public à fixer (actuellement « Seat 12A », clé `extName`). Domaines fixés : gate
`https://api.seat12a.org`, site `https://seat12a.org` (valeurs par défaut du build,
modifiables par `VITE_GATE_URL` / `VITE_SITE_URL`).

## 6. Couleurs des badges

Le client utilise la table de contraste de l'équipe design (clair / sombre) pour les
cinq catégories connues et la couleur de l'API pour une catégorie inconnue. Si l'API
doit rester la source unique des couleurs, il faudra qu'elle expose les deux variantes.
