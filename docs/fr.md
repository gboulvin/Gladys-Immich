# Diaporama Immich pour Gladys

## Objectif

Cette intégration externe Gladys transforme un ou plusieurs **albums Immich** ou la collection **Souvenirs — ce jour-là** en caméra virtuelle. Ajoutez cette caméra au dashboard Gladys pour afficher un diaporama de photos qui change automatiquement. Les photos restent sur votre serveur Immich : l’intégration ne demande que les aperçus Immich et ne télécharge jamais les originaux.

L’intégration nécessite Gladys **5.1.0 ou version ultérieure**. Chaque diaporama est une caméra virtuelle, utilisable dans une boîte caméra du dashboard. L’intégration ajoute aussi un **widget Photo Immich** pour le dashboard et une **action de scène** qui affiche la photo suivante. Elle est disponible en anglais, français, allemand et espagnol.

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

Réglez l’intervalle entre les photos, la fréquence de mise à jour de la source et le plafond d’images conservées. Activez **Afficher la légende Immich** pour incruster en bas de l’image la description, le lieu et la date de prise de vue lorsqu’Immich les fournit. **Langue de la légende** fixe la langue de la date de ce bandeau (anglais, français, allemand ou espagnol) et du nom de la source renvoyé par l’action de scène ; le widget du dashboard utilise toujours la langue de chaque utilisateur. L’actualisation de la liste est distincte de l’intervalle d’affichage : un grand album n’est interrogé que périodiquement et seuls les aperçus effectivement affichés sont téléchargés. Les vidéos sont ignorées. Par défaut, les images les plus récentes passent en premier ; activez l’ordre aléatoire pour mélanger chaque liste rechargée.

Enregistrez la configuration, ouvrez l’onglet **Découverte** de l’intégration et créez la caméra **Immich slideshow**. Vous pouvez également créer **Immich slideshow 2** : son profil est entièrement indépendant et peut utiliser un autre album, des souvenirs, des intervalles, une légende, ou même un autre serveur Immich. Renseignez les champs du **Diaporama 2** avant de créer cette seconde caméra ; utilisez ses boutons de test, de liste d’albums et d’actualisation dédiés. Ajoutez ensuite chaque caméra à une boîte caméra sur le dashboard Gladys de votre choix : une première caméra peut donc être placée sur un dashboard et la seconde sur un autre. Chaque première image est publiée immédiatement, puis chaque caméra est mise à jour selon son propre intervalle configuré.

## État de la connexion et badge de transport

L’onglet **Configuration** affiche un état de connexion unique pour l’intégration : il passe au rouge dès qu’un diaporama configuré échoue, avec la raison (serveur inaccessible, clé refusée, source vide…), et redevient vert de lui-même lorsque le diaporama fonctionne à nouveau. Un clic réussi sur **Tester** ou **Actualiser** efface également une erreur ancienne.

Chaque caméra porte en outre un badge de transport. Il indique **local** lorsque l’URL Immich désigne votre réseau domestique (adresse privée comme `192.168.x.x`, nom en `.local`, `.lan` ou `.home.arpa`, nom court de conteneur, adresse Tailscale), **cloud** lorsqu’elle passe par Internet (nom de domaine public, proxy inverse, tunnel) et **injoignable** lorsqu’Immich ne répond pas. Un point orange signale qu’Immich répond mais que le diaporama ne peut pas tourner : survolez le badge pour lire la raison. Immich n’ayant qu’une seule URL par diaporama, l’option **Préférer la connexion locale** de l’écran de configuration n’a pas d’effet : pour passer en local, saisissez l’adresse réseau locale de votre serveur.

## Confidentialité et traitement des images

La clé API est déclarée comme un `secret` Gladys : elle est stockée de manière sécurisée et n’est jamais retournée au navigateur du dashboard. Les requêtes vers Immich contiennent l’en-tête `x-api-key` dans le conteneur de l’intégration. Avant publication dans le canal caméra Gladys, les aperçus sont orientés correctement, redimensionnés et compressés en JPEG afin de conserver un dashboard fluide et de respecter la limite de taille du canal. Lorsque l’option de légende est activée, les métadonnées sélectionnées sont incrustées dans un bandeau contrasté au bas de l’aperçu ; elles transitent alors avec l’image caméra vers le dashboard.

## Dépannage

Si le test de connexion indique une clé ou des permissions invalides, recréez une clé API Immich avec les quatre permissions précédentes. Si un album contenant des photos est signalé vide, mettez l’intégration à jour vers cette release : les versions récentes d’Immich séparent les métadonnées d’album de la liste de ses actifs, désormais lue via la recherche d’actifs filtrée par album. Si le serveur est inaccessible, vérifiez l’URL depuis le réseau de l’hôte Gladys et assurez-vous qu’un pare-feu, un proxy inverse ou la configuration Docker ne bloque pas l’accès du conteneur d’intégration à Immich. Un album vide ou une collection de souvenirs vide est un état normal : ajoutez des photos ou sélectionnez une autre source. Les journaux consultables dans l’onglet Configuration donnent la catégorie de l’erreur HTTP sans afficher la clé API.

## Widget « Photo Immich »

Dans l’édition du dashboard, ajoutez le widget **Photo Immich** puis choisissez dans ses réglages la caméra de diaporama à suivre (la caméra doit avoir été créée dans l’onglet **Découverte**). Le widget affiche la photo en cours, sa légende lorsque l’option de légende incrustée est désactivée, l’état du diaporama, le type de connexion au serveur Immich (local ou cloud), la source et le nombre de photos. Le bouton **Photo suivante** fait avancer la caméra immédiatement ; **Actualiser** relit l’album ou les souvenirs du jour. Le widget suit la caméra : il se met à jour à chaque nouvelle photo. En cas de problème, il affiche la raison à la place de la photo.

## Action de scène « Afficher la photo Immich suivante »

Dans une scène, l’action **Afficher la photo Immich suivante** fait avancer la caméra choisie, en relisant éventuellement d’abord la source. Elle produit trois variables utilisables par les actions suivantes : **Photo affichée** (vrai ou faux), **Nom du fichier de la photo** et **Album ou souvenirs**. Un diaporama non configuré ou en erreur ne fait pas échouer la scène : la variable **Photo affichée** vaut alors faux, ce qui permet de conditionner la suite.

Exemple : chaque matin à 8 h, afficher la photo suivante des souvenirs du jour, puis, si **Photo affichée** est vrai, l’envoyer par message avec l’action native **Envoyer l’image de la caméra**.

## Références

[1] [Points de terminaison de l’API Immich](https://api.immich.app/endpoints)
[2] [Intégrations externes Gladys](https://gladysassistant.com/docs/dev/external-integrations/)
