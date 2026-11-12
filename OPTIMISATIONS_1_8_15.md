# Peak Music 1.8.15

## Utilisation

- Dans l'import par lien, **Deux téléchargements simultanés** est activé par défaut. Désactive-le pour revenir à un seul. La réparation audio et l'enregistrement restent séquentiels.
- **Mettre en pause** conserve la file. Après fermeture, interruption ou erreur, ouvre `+ > Coller un lien > Reprendre l'import précédent`. Les morceaux terminés ne sont pas relancés. Un transfert direct encore géré par iOS est rattaché à son identifiant ; un fichier déjà reçu peut être réutilisé. Un transfert annulé peut repartir du début, sans garantie de reprise à l’octet près. Les identifiants des versions YouTube choisies sont conservés ; leurs adresses temporaires ne le sont pas.
- **Oublier la file précédente** permet de démarrer un autre lot, sans supprimer les sons déjà importés. Une seule file persistante est conservée.
- Les doublons sont vérifiés avant préparation du morceau et avant téléchargement, puis à l'enregistrement. La détection utilise les liens et identifiants de source, pas une comparaison approximative des noms. Un lien court inconnu peut encore nécessiter sa résolution réseau.
- **Stockage et cache**, dans l'onglet Morceaux, affiche l'espace des sons, pochettes de morceaux, paroles et caches gérés par Peak Music. Le total ne représente pas toute la taille système de l'app (IPA, caches iOS et pochettes de playlists exclus).
- **Vider uniquement le cache** conserve les sons, pochettes originales, paroles associées, playlists, préférences et file d'import. Cette action est bloquée pendant une opération utilisant le cache.
- Les restes du dossier temporaire d'import et les pochettes temporaires incomplètes sont nettoyés au démarrage. Le nettoyage des anciens originaux normalisés reste actif.
- Les petites pochettes (192 pixels maximum) sont créées localement et mises en cache pour les listes. Les vues agrandies conservent les originales. Si la miniature échoue, l'image originale reste utilisable.
- Les listes affichent une fenêtre limitée d'éléments ; les lignes inchangées ne refont pas leur rendu à chaque progression audio. Les accès aux morceaux des playlists utilisent un index par identifiant.
- Le tri, l'option miniature YouTube, le nombre de téléchargements simultanés, l'aléatoire et la boucle sont conservés après redémarrage.
- Les recherches de paroles trouvées sont mémorisées 30 jours et les recherches sans résultat un jour (60 entrées maximum). Les erreurs de service et annulations ne sont pas conservées. Dans la recherche manuelle, **Actualiser la recherche en ligne** ignore le cache. Vider le cache n'efface pas les paroles déjà associées.

## Limites importantes

L’import ne s’annule plus au passage en arrière-plan ou au verrouillage :

- Les fichiers directs (dont l’audio YouTube) utilisent une session de téléchargement iOS en arrière-plan. Le délégué natif conserve le fichier reçu même lorsque JavaScript est suspendu. Le système peut différer un transfert.
- Sous iOS 26 et versions suivantes, une tâche de traitement continu est demandée à chaque lancement/reprise explicite. Si iOS l’accepte, la recherche, les flux SoundCloud segmentés, la réparation et l’ajout des morceaux peuvent s’enchaîner en arrière-plan. Une progression est transmise à l’interface système.
- Sur une version antérieure ou si iOS refuse la tâche, les transferts directs déjà lancés peuvent continuer, mais les nouvelles recherches et l’enregistrement attendent le retour dans l’app. Les flux SoundCloud HLS nécessitent du temps d’exécution de l’app ; ils ne sont pas délégués à la session de téléchargement de fichiers directs.
- Un choix YouTube ambigu attend le retour au premier plan. Une expiration ou annulation depuis l’interface système conserve la file pour une reprise manuelle.
- Fermer de force Peak Music depuis le sélecteur annule les transferts iOS. Économie d’énergie, réseau et ressources disponibles peuvent limiter la poursuite. Aucune garantie de finir une playlist entière écran verrouillé.
- Le cache des transferts iOS est séparé du cache nettoyé au démarrage. Le bouton de nettoyage vérifie les transferts système en cours avant d’effacer les fichiers reçus non utilisés.

Une recherche de paroles interrompue après l’ajout du son peut être relancée depuis le menu de paroles.

Les nouveaux traitements Swift (arrière-plan, deux imports et miniatures ImageIO) nécessitent de reconstruire l'IPA. L'export JavaScript iOS n'est pas une compilation native. Vérifier sur iPhone : deux imports, pause/reprise, verrouillage, retour dans l’app, expiration système, redémarrage, miniature et nettoyage de cache.

Installer par-dessus l'application existante avec SideStore, sans la désinstaller, pour préserver les données.

Commit suggéré : `feat: add background imports and optimize cache and library`


Cette révision remplace la première archive 1.8.15 : numéro de version inchangé à la demande de l’utilisateur. Utiliser tous les fichiers de ce ZIP, notamment les deux nouveaux fichiers Swift et la configuration du module Expo. La compilation native doit utiliser Xcode 26 ou ultérieur ; le workflow cible déjà macos-26. La validation locale inclut les tests JavaScript et l’export iOS, pas une exécution sur iPhone.
