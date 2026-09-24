# LocalMusic V1.3

## Correctifs écran verrouillé

Le moteur audio est maintenant `@rntp/player` (React Native Track Player V5)
tout en restant sur **Expo SDK 57 stable / React Native 0.86.3**.

La file audio est gérée nativement par iOS :
- lecture continue écran verrouillé ;
- passage automatique au morceau suivant ;
- lecture / pause depuis l'écran verrouillé ;
- précédent / suivant depuis l'écran verrouillé ;
- déplacement dans la piste depuis la barre de progression système ;
- titre, artiste, album et pochette envoyés à Now Playing.

Le moteur utilise des commandes natives : elles ne dépendent pas du thread
JavaScript quand iOS suspend l'interface.

## Lecture aléatoire

Bouton **Aléatoire** :
- disponible dans la bibliothèque ;
- disponible dans une playlist ;
- disponible dans le lecteur plein écran ;
- la file native iOS est mélangée.

## Boucle

Le bouton **Boucle** passe successivement par :
1. désactivée ;
2. **Boucle tout** : recommence toute la file / playlist ;
3. **Boucle 1** : répète le morceau courant.

Ces modes sont gérés nativement par le lecteur.

## Images de playlists

Dans une playlist :
- touche directement la pochette ;
- ou `••• > Choisir une image`.

Formats acceptés :
- PNG ;
- JPEG / JPG.

L'image est copiée dans le stockage privé de LocalMusic : elle reste disponible
hors ligne et ne dépend plus de Google Drive après sélection.

## Conservation des données

Le bundle ID reste `com.alexandre.localmusic`.

Installe donc la nouvelle IPA **par-dessus** l'ancienne via SideStore pour
conserver les MP3 et les playlists.

Les anciennes pochettes ID3 stockées en base64 sont migrées vers de vrais
fichiers locaux lors du premier démarrage afin d'améliorer leur compatibilité
avec l'écran verrouillé iOS.

## Note volume iOS

LocalMusic continue de proposer un volume dans son lecteur. Sur l'écran
verrouillé, la présence d'un curseur de volume est décidée par iOS et par le
périphérique audio utilisé ; une application ne peut pas forcer son affichage.

## Dépendance RNTP

React Native Track Player V5 est gratuit pour un usage personnel ou éducatif.
Son utilisation commerciale est soumise à la licence de l'éditeur.
