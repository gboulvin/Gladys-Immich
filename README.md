# Diaporama Immich pour Gladys

> **Une intégration externe Gladys qui affiche un album Immich ou les souvenirs « ce jour-là » sous la forme d’une caméra virtuelle sur le dashboard.**

Ce projet est construit à partir du [template officiel des intégrations externes JavaScript Gladys][1]. Il utilise une intégration de type `device` et le canal d’images des caméras pour fournir un diaporama réellement utilisable avec Gladys **4.85+**. Le widget Photo natif de cette version repose encore sur une liste d’URL gérée manuellement ; il ne propose pas d’API publique de source de photos externe. L’adaptateur caméra est donc le moyen compatible de présenter immédiatement les photos Immich dans le dashboard, tandis que la couche `photoProvider` isole le futur raccordement à un tel contrat de widget [2] [3].

## Fonctionnalités

| Fonction                | Comportement                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sources Immich**      | Album par UUID ou souvenirs `on_this_day`, via les API `albums` et `memories`.                                                                |
| **Affichage dashboard** | Une caméra virtuelle `Immich slideshow`, mise à jour dès la connexion puis au rythme configuré.                                               |
| **Images**              | Uniquement les éléments `IMAGE` ; les vidéos sont volontairement ignorées en v1.                                                              |
| **Qualité maîtrisée**   | Récupération de l’aperçu Immich, correction d’orientation puis redimensionnement/compression JPEG sous la limite du canal caméra Gladys.      |
| **Performance**         | Liste d’actifs limitée à 1–500 images, actualisée indépendamment du rythme d’affichage ; seul l’aperçu de la photo à afficher est téléchargé. |
| **Confidentialité**     | Clé API saisie dans un champ Gladys `secret`, donc jamais exposée au navigateur du dashboard.                                                 |
| **Contrôle**            | Boutons de test de connexion et d’actualisation immédiate, avec statuts de connexion et erreurs localisées.                                   |

## Architecture

```text
Immich API ── x-api-key ──► client Immich ──► photoProvider ──► slideshow
                                                              │
Gladys SDK ◄── publishCameraImage / onGetImage ◄── caméra virtuelle
                                                              │
                                                   Dashboard Gladys
```

La séparation entre le client HTTP, la résolution de la source et le moteur de diaporama maintient le code testable et évite de coupler la logique Immich au SDK Gladys. L’API Immich actuelle documente les endpoints `GET /albums`, `GET /albums/{id}`, `GET /memories` et `GET /assets/{id}/thumbnail`, avec les permissions associées [4] [5] [6] [7].

| Chemin                                                               | Responsabilité                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`index.js`](./index.js)                                             | Cycle de vie SDK, configuration, découverte de la caméra et actions Gladys.        |
| [`src/config.js`](./src/config.js)                                   | Valeurs par défaut, limites et messages de validation localisés.                   |
| [`src/immichClient.js`](./src/immichClient.js)                       | Requêtes HTTP authentifiées, délais et erreurs Immich explicites.                  |
| [`src/photoProvider.js`](./src/photoProvider.js)                     | Albums, souvenirs, filtrage vidéo, dédoublonnage, ordre et métadonnées de légende. |
| [`src/slideshow.js`](./src/slideshow.js)                             | Cache de liste, actualisation forcée et rotation des diapositives.                 |
| [`src/imageTransformer.js`](./src/imageTransformer.js)               | Orientation, compression et limite de taille de l’image caméra.                    |
| [`src/devices/slideshowCamera.js`](./src/devices/slideshowCamera.js) | Adaptateur de caméra virtuelle Gladys.                                             |

## Configuration utilisateur

Créez dans Immich une clé API disposant des permissions `album.read`, `asset.view` et `memory.read`. Dans Gladys, ouvrez l’intégration puis entrez l’URL de votre serveur, par exemple `http://192.168.1.20:2283`, et la clé API. Pour un album, copiez son UUID depuis l’URL de l’album dans Immich. Évitez `localhost`, qui désigne le conteneur isolé de l’intégration et non votre serveur Immich.

Après enregistrement, lancez **Tester la connexion Immich**, créez l’appareil **Immich slideshow** dans l’onglet **Découverte**, puis ajoutez cette caméra au dashboard. Consultez la documentation utilisateur complète : [français](./docs/fr.md) et [English](./docs/en.md).

> La source « souvenirs » se renouvelle naturellement chaque jour. Configurez un intervalle d’actualisation de la source raisonnable — une heure par défaut — et utilisez **Actualiser le diaporama maintenant** pour forcer la prise en compte d’une modification.

## Développement local

Le projet nécessite Node.js 20 ou version ultérieure ; l’image de production s’appuie sur Node 24 Alpine. Installez les dépendances puis lancez l’ensemble des contrôles :

```bash
npm ci
npm run check
```

Pour exécuter l’intégration contre une instance Gladys configurée en mode développeur, fournissez les trois variables injectées automatiquement par le superviseur en production :

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token développeur>" \
GLADYS_INTEGRATION_SELECTOR="immich-slideshow" \
LOG_LEVEL=debug \
npm start
```

Les tests unitaires couvrent la validation de configuration, le client HTTP et ses erreurs, la sélection/déduplication des actifs, le cache du diaporama, l’état vide et la cohérence du manifeste. Pour contrôler le manifeste avec l’outil du catalogue avant publication, utilisez :

```bash
npx github:GladysAssistant/integration-store .
```

## Publication

Le dépôt conserve les workflows GitHub Actions du template pour bâtir une image `linux/amd64` et `linux/arm64` vers GHCR. Les références `docker_image` et `cover_image` du manifeste sont déjà alignées sur `gboulvin/Gladys-Immich`. Le workflow publiera l’image multi-architecture sous `ghcr.io/gboulvin/gladys-immich`. La couverture `cover.jpg` respecte le format exigé par le catalogue : JPEG de **800 × 534 px** et moins de **150 KB** [3].

Une fois le dépôt public, ajoutez le sujet GitHub `gladys-assistant-integration`, rendez le package GHCR public, puis exécutez **Actions → Release → Run workflow**. Le workflow incrémente les versions, crée le tag et publie l’image multi-architecture. Le catalogue Gladys indexe ensuite le manifeste et l’image publiquement disponibles [3].

## Limite de périmètre documentée

La proposition communautaire cible, à terme, des modes **« Immich — Album »** et **« Immich — Memories »** au sein du widget Photo, avec sélecteur d’album et légendes [8]. Cela exige une extension du cœur Gladys : la documentation des intégrations externes ne recense pour l’instant que les types `device`, `communication` et `weather`, sans API de fournisseur photo ni d’extension de widget [3]. Cette intégration ne prétend donc pas modifier le widget Photo actuel. Elle fournit le résultat visible demandé — un diaporama dynamique de photos Immich sur le dashboard — via l’API caméra publiée et elle prépare la logique de source pour l’évolution native.

## Licence

Apache-2.0.

## Références

[1]: https://github.com/GladysAssistant/integration-template-js 'Template officiel des intégrations externes JavaScript'
[2]: https://community.gladysassistant.com/t/integration-immich 'Proposition communautaire de l’intégration Immich'
[3]: https://gladysassistant.com/docs/dev/external-integrations/ 'Documentation officielle des intégrations externes Gladys'
[4]: https://api.immich.app/endpoints/albums/getAllAlbums 'Immich — liste des albums'
[5]: https://api.immich.app/endpoints/albums/getAlbumInfo 'Immich — lecture d’un album'
[6]: https://api.immich.app/endpoints/memories/searchMemories 'Immich — recherche des souvenirs'
[7]: https://api.immich.app/endpoints/assets/viewAsset 'Immich — aperçu d’un média'
[8]: https://community.gladysassistant.com/t/integration-immich 'Spécification communautaire Immich'
