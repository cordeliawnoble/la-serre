# 🌿 La Serre

Une application légère de pilotage des projets de Cordy Corp. Les objectifs et jalons restent ici ; les actions concrètes restent dans Todum.

## État du projet

- Interface V1 publiée dans `index.html`, `style.css` et `app.js`
- Tables Supabase préfixées `serre_`, dans `supabase/001_schema.sql`
- Authentification via Supabase Auth, base `Hub writing`
- Les couleurs et icônes sont définies par projet
- Un mois cible est une intention, pas une deadline contractuelle
- Les semaines de Floraison sont facultatives et un même jalon peut être lié à plusieurs semaines
- Export JSON depuis Administration

## Connexion à Supabase

Ouvrir `config.js` et renseigner :
```js
window.SERRE_CONFIG = {
  supabaseUrl: 'https://VOTRE-REF.supabase.co',
  supabaseAnonKey: 'VOTRE_CLE_PUBLIQUE'
};
```

**Attention :** utiliser uniquement la clé publique `anon` (ou `publishable`). Ne **jamais** publier un mot de passe, une clé `service_role`, une `secret key` ou un token personnel. Les droits sont contrôlés côté Supabase par les politiques RLS. Ne pas conserver de copies locales de données métier.

## Déploiement GitHub Pages

Dans le dépôt GitHub, `Settings → Pages → Build and deployment → Deploy from a branch`, puis `main` et `/(root)`. La page sera ensuite accessible à l’URL Pages indiquée par GitHub. La publication est **à déclencher manuellement**.

## Limites de cette première version

- Pas de synchronisation automatique avec Todum ou Orée
- Pas encore d’interface complète pour les historiques de report, ni d’import JSON
- Un changement de projet sur un horizon déjà associé à des jalons peut être refusé par la base, pour préserver la cohérence
- Tests manuels de connexion, édition, RLS et adaptation tablette encore nécessaires
