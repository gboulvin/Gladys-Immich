# Diaporama Immich pour Gladys

## Objectif

Cette intégration externe Gladys transforme un ou plusieurs **albums Immich** ou la collection **Souvenirs — ce jour-là** en caméra virtuelle. Ajoutez cette caméra au dashboard Gladys pour afficher un diaporama de photos qui change automatiquement. Les photos restent sur votre serveur Immich : l’intégration ne demande que les aperçus Immich et ne télécharge jamais les originaux.

L’intégration nécessite Gladys **4.86.0 ou version ultérieure**. Elle s’appuie sur le canal d’images des caméras afin de proposer immédiatement un diaporama fonctionnel sur le dashboard actuel. La sélection des photos est séparée de l’adaptateur caméra et pourra être reliée à la future API de fournisseur du widget Photo annoncée par Gladys.

## Prérequis

Vous avez besoin d’un serveur Immich joignable et d’une clé API créée dans **Immich → Paramètres du compte → Clés API**. Attribuez le minimum de permissions suivant :

| Permission    | Utilité                                                  |
| ------------- | -------------------------------------------------------- |
| `album.read`  | Lister les albums et lire l’album sélectionné.           |
| `asset.read`  | Rechercher les actifs appartenant à l’album sélectionné. |
| `asset.view`  | Télécharger l’aperçu de chaque image affichée.           |
| `memory.read` | Lire la source facultative des souvenirs « ce jour-là ». |

Le conteneur Gladys doit pouvoir atteindre l’URL indiquée dans le formulaire. Pour un serveur local, utilisez son adresse réseau et son port, par exemple `http://192.168.1.20:2283`. N’utilisez pas `localhost` : il désigne le conteneur isolé de l’intégration, et non l’hôte Gladys ou le serveur Immich.

## Configuration

Ouvrez **Intégrations → Immich Slideshow → Configuration**, puis renseignez l’URL et la clé API du **Diaporama 1**. Choisissez **Album** ou **Souvenirs — ce jour-là**. Pour un ou plusieurs albums, cliquez sur **Lister les albums Immich** après avoir renseigné l’URL du serveur et la clé API. L’action affiche pour chaque album son nom, son UUID et son nombre d’éléments ; copiez un ou plusieurs UUID dans **UUID des albums**, séparés par des virgules ou des retours à la ligne. Les albums sont fusionnés, les photos communes sont dédoublonnées et le plafond d’images reste appliqué à l’ensemble. Le bouton **Tester la connexion Immich** vérifie que Gladys peut lister les albums avec cette clé.

Réglez l’intervalle entre les photos, la fréquence de mise à jour de la source et le plafond d’images conservées. Activez **Afficher la légende Immich** pour incruster en bas de l’image la description, le lieu et la date de prise de vue lorsqu’Immich les fournit. L’actualisation de la liste est distincte de l’intervalle d’affichage : un grand album n’est interrogé que périodiquement et seuls les aperçus effectivement affichés sont téléchargés. Les vidéos sont ignorées. Par défaut, les images les plus récentes passent en premier ; activez l’ordre aléatoire pour mélanger chaque liste rechargée.

Enregistrez la configuration, ouvrez l’onglet **Découverte** de l’intégration et créez la caméra **Immich slideshow**. Vous pouvez également créer **Immich slideshow 2** : son profil est entièrement indépendant et peut utiliser un autre album, des souvenirs, des intervalles, une légende, ou même un autre serveur Immich. Renseignez les champs du **Diaporama 2** avant de créer cette seconde caméra ; utilisez ses boutons de test, de liste d’albums et d’actualisation dédiés. Ajoutez ensuite chaque caméra à une boîte caméra sur le dashboard Gladys de votre choix : une première caméra peut donc être placée sur un dashboard et la seconde sur un autre. Chaque première image est publiée immédiatement, puis chaque caméra est mise à jour selon son propre intervalle configuré.

## Confidentialité et traitement des images

La clé API est déclarée comme un `secret` Gladys : elle est stockée de manière sécurisée et n’est jamais retournée au navigateur du dashboard. Les requêtes vers Immich contiennent l’en-tête `x-api-key` dans le conteneur de l’intégration. Avant publication dans le canal caméra Gladys, les aperçus sont orientés correctement, redimensionnés et compressés en JPEG afin de conserver un dashboard fluide et de respecter la limite de taille du canal. Lorsque l’option de légende est activée, les métadonnées sélectionnées sont incrustées dans un bandeau contrasté au bas de l’aperçu ; elles transitent alors avec l’image caméra vers le dashboard.

## Dépannage

Si le test de connexion indique une clé ou des permissions invalides, recréez une clé API Immich avec les quatre permissions précédentes. Si un album contenant des photos est signalé vide, mettez l’intégration à jour vers cette release : les versions récentes d’Immich séparent les métadonnées d’album de la liste de ses actifs, désormais lue via la recherche d’actifs filtrée par album. Si le serveur est inaccessible, vérifiez l’URL depuis le réseau de l’hôte Gladys et assurez-vous qu’un pare-feu, un proxy inverse ou la configuration Docker ne bloque pas l’accès du conteneur d’intégration à Immich. Un album vide ou une collection de souvenirs vide est un état normal : ajoutez des photos ou sélectionnez une autre source. Les journaux consultables dans l’onglet Configuration donnent la catégorie de l’erreur HTTP sans afficher la clé API.

## Modèle dashboard actuel et futur widget Photo

Dans Gladys 4.86, le widget **Photo** accepte une liste d’URL gérée manuellement ; il n’expose pas encore d’API de source de photos externe. Ce projet fournit donc aujourd’hui un véritable diaporama sur le dashboard via une caméra virtuelle. La couche indépendante `src/photoProvider.js` résout déjà albums et souvenirs sous forme de métadonnées normalisées, dont les légendes, afin de pouvoir se raccorder au futur contrat de fournisseur du widget Photo sans réécrire le client Immich.

## Références

[1] [Points de terminaison de l’API Immich](https://api.immich.app/endpoints)
[2] [Intégrations externes Gladys](https://gladysassistant.com/docs/dev/external-integrations/)
[3] [Annonce du widget Photo Gladys 4.85](https://community.gladysassistant.com/t/gladys-assistant-4-85-0-widget-photo-navigation-dans-les-graphiques-chauffe-eau-homekit/10483)
