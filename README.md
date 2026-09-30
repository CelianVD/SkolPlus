# Skolengo Amélioré

Extension Firefox non officielle pour personnaliser l'accueil de l'ENT **Skolengo** (utilisé notamment par ÉCLAT-BFC) : réorganiser les blocs de la page d'accueil et recolorer la barre du haut, sans toucher au reste du site.

> [!WARNING]
> Ce projet n'est ni développé ni affilié à Kosmos/Skolengo, à une académie ou à un rectorat. C'est un outil personnel de personnalisation visuelle, qui ne modifie aucune donnée envoyée au serveur.

## Fonctionnalités

- **Réorganiser les blocs de l'accueil** (Séances du jour, Travail à faire,
  Évaluations, Annonces établissement, etc.) :
  - glisser-déposer par poignée (⠿), y compris entre les deux colonnes,
  - boutons ▲ / ▼ pour un déplacement précis, cran par cran,
  - bouton 👁 pour masquer / afficher un bloc.
- **Un mode édition** activé par un simple toggle intégré dans la barre du
  haut, à côté des icônes natives du site (cookies, aide…) — pas de bouton
  flottant qui dénature l'interface.
- **Recolorer la barre du haut**, avec un outil pipette 🎯 pour cibler
  précisément les zones qui ne changeraient pas de couleur par défaut (la
  barre du haut de Skolengo est composée de plusieurs éléments imbriqués).
- **Recolorer les onglets du menu de gauche au survol** (ils restent sinon
  dans leur couleur d'origine), avec la même pipette 🎯.
- Tout est **sauvegardé localement** (`storage.local` de l'extension) et
  réappliqué automatiquement à chaque visite.
- Détection automatique des blocs qui se rafraîchissent en Ajax
  (ex. "Évaluations"), pour rester à jour même après un chargement partiel
  de la page.

## 📦 Installation

### Depuis addons.mozilla.org

*(à venir)*

### Installation manuelle, en mode développeur

1. Télécharge ou clone ce dépôt.
2. Dans Firefox, ouvre `about:debugging#/runtime/this-firefox`.
3. Clique sur **"Charger un module complémentaire temporaire..."**.
4. Sélectionne le fichier `manifest.json` du dossier.
5. Va sur ton portail Skolengo : le toggle **Édition** apparaît dans la
   barre du haut, à droite.

⚠️ En mode "temporaire", l'extension est retirée à chaque redémarrage de
Firefox — il faut la recharger depuis `about:debugging`. Pour une
installation permanente sans passer par addons.mozilla.org, il faut soit :
- construire un `.xpi` signé via l'outil
  [`web-ext`](https://github.com/mozilla/web-ext) et le service de
  signature de Mozilla (gratuit, y compris pour un usage non listé sur AMO),
  soit
- utiliser Firefox Developer Edition ou Nightly et désactiver
  `xpinstall.signatures.required` dans `about:config`.

## Portails compatibles

L'extension se déclenche sur les domaines listés dans `manifest.json`
(`content_scripts[0].matches`) :

```json
"matches": [
  "*://*.eclat-bfc.fr/*",
  "*://*.arsene76.fr/*",
  "*://*.monbureaunumerique.fr/*",
  "*://*.loire.ent.auvergnerhonealpes.fr/*",
  "*://*.agora06.fr/*",
  "*://*.ent27.fr/*",
  "*://*.ecollege.haute-garonne.fr/*"
]
```

Dans tous les cas, le script vérifie d'abord que la page est bien un
portail **Skolengo** (balise `<meta name="generator" content="Skolengo">`)
avant de s'activer : ajouter un domaine supplémentaire ici ne fait rien sur
un site qui n'utilise pas Skolengo.

> [!TIP]
> Pour ajouter ton académie/collectivité, ouvre une issue ou une pull request
avec le nom de domaine, ou modifie directement `manifest.json`.

## Vie privée

- Aucune donnée n'est envoyée à un serveur externe : tout reste dans ton
  navigateur, via l'API `storage.local` de l'extension.
- La seule permission demandée est **`storage`** (pour sauvegarder tes
  préférences de mise en page et de couleurs).
- L'extension ne lit ni ne modifie tes notes, messages ou données
  personnelles ; elle ne touche qu'à l'affichage (ordre des blocs,
  visibilité, couleurs CSS).
- Code source entièrement lisible dans ce dépôt, sans dépendance externe ni
  minification.

## Structure du projet

```
skolengo-ext/
├── manifest.json   # déclaration de l'extension (WebExtension, MV3)
├── content.js      # toute la logique (détection des blocs, drag & drop,
│                    #   masquage, couleurs, panneau de réglages)
├── content.css      # styles du panneau, de la barre d'outils des blocs, etc.
└── README.md
```

Aucune étape de build n'est nécessaire : les fichiers sont chargés tels
quels par Firefox.

## Contribuer
> [!NOTE]
> Les retours, issues et pull requests sont bienvenus, notamment pour :
- ajouter le support d'autres portails Skolengo (nouvelles académies/ENT),
- porter l'extension vers Chrome/Edge (Manifest V3, très proche de celui-ci),
- améliorer l'accessibilité ou l'ergonomie du mode édition.

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
