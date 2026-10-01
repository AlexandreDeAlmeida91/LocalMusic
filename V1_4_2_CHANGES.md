# LocalMusic V1.4.2 — stockage persistant et portable

Cette version corrige la disparition apparente des contenus après certaines
mises à jour iOS / SideStore.

## Cause

Les anciennes versions enregistraient des chemins absolus comme :

```text
file:///var/mobile/Containers/Data/Application/ANCIEN-UUID/Documents/LocalMusic/Music/xxx.mp3
```

iOS peut changer l'UUID du conteneur de données d'une application lors d'une
mise à jour. Les fichiers restent dans `Documents`, mais les anciens chemins
absolus deviennent invalides.

## Nouveau format

LocalMusic enregistre maintenant uniquement des chemins relatifs et stables :

```text
Music/xxx.mp3
Artwork/xxx.jpg
Lyrics/xxx.txt
PlaylistCovers/playlist-xxx.png
```

Le chemin absolu courant est reconstruit au lancement avec le
`documentDirectory` iOS actuel.

## Éléments protégés

- fichiers MP3 ;
- métadonnées de la bibliothèque ;
- pochettes ID3 extraites ;
- paroles TXT ;
- playlists elles-mêmes ;
- noms des playlists ;
- ordre des morceaux dans chaque playlist ;
- associations morceau ↔ playlist ;
- images PNG/JPG des playlists ;
- dates et autres métadonnées déjà stockées.

## Protection des playlists

Auparavant, si un chemin de morceau devenait temporairement invalide au
démarrage, LocalMusic pouvait retirer son identifiant des playlists puis
réenregistrer celles-ci.

La V1.4.2 ne modifie plus de manière destructive les `songIds` d'une playlist
au démarrage. Une relation playlist/morceau est supprimée uniquement lorsque
l'utilisateur supprime réellement le morceau ou le retire de la playlist.

## Migration automatique

Au premier démarrage :

1. les anciens chemins absolus sont convertis en chemins relatifs ;
2. les chemins sont reconstruits avec le conteneur iOS actuel ;
3. les pochettes, paroles et images de playlists sont également migrées ;
4. les fichiers MP3 encore présents dans `LocalMusic/Music/` mais absents de
   `library.json` sont détectés et réintégrés automatiquement ;
5. l'ID du morceau est récupéré depuis son nom de fichier, ce qui permet de
   conserver les associations de playlists lorsque celles-ci existent encore.

## Sauvegarde des fichiers JSON

`library.json` et `playlists.json` sont maintenant écrits de manière atomique.
La version précédente est conservée dans un fichier `.bak`.

Si le JSON principal est corrompu ou incomplet, LocalMusic tente de relire la
dernière sauvegarde valide.

## Limite importante

Cette correction protège les données lors d'une mise à jour installée
**par-dessus** LocalMusic avec le même bundle ID.

Si l'application est réellement supprimée de l'iPhone avant la réinstallation,
iOS supprime normalement son conteneur local : aucun chemin relatif ne peut
préserver des fichiers qui ont été physiquement supprimés.

Pour cette raison, continuer à installer les nouvelles IPA par-dessus la
version existante reste recommandé.
