# Points ouverts

Manques côté Tower relevés pendant le développement, et choix provisoires faits par le
client en attendant.

## 1. Identifiant numérique des auteurs (badges, comptes filtrés, indices)

Le lookup des badges, les indices « government » et `filters.accounts` exigent l'ID
numérique X de l'auteur ; le DOM de X montre le pseudo.

**Choix provisoire (couverture partielle)** : `src/content/author-ids.ts` apprend la
correspondance pseudo → ID là où X l'affiche déjà, dans les boutons « Suivre »
(`data-testid="<id>-follow"`) de l'en-tête de profil et des cellules de compte
(suggestions, listes d'abonnés, cartes de survol). Rien n'est chargé ni appelé : seul
ce qui est à l'écran est lu. La table vit dans `chrome.storage.session`.

Conséquence : sur le fil, un auteur n'a de badge que si son ID a été vu au moins une
fois pendant la session. **Solution visée** : une correspondance pseudo → ID servie
par Tower pour les seuls comptes connus (badgés ou suivis), l'ID restant la référence
(la règle des badges interdit au client de décider par pseudo).

## 2. Sémantique de `thresholds`

Implémentation provisoire : `min_views`, `min_likes`, `min_reposts`, `min_replies`
(métrique affichée ≥ valeur ; absente → échec) ; autres noms ignorés. À aligner dès que
`ingestion.md` et le validateur fixent la liste.

## 3. Vérifications sur tous les posts

Seuls les posts filtrés sont interrogés. Un endpoint d'index (liste compacte des posts
vérifiés, ou recherche par préfixe de hachage, téléchargée périodiquement) permettrait
d'afficher les vérifications partout sans révéler la navigation.

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
