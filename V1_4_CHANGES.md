# LocalMusic V1.4 — Paroles TXT

## Nouveau : paroles locales

Chaque morceau peut maintenant recevoir un fichier de paroles `.txt`.

Dans le menu `•••` d'un morceau :
- **Ajouter des paroles** si aucune parole n'est encore associée ;
- **Remplacer les paroles** si un fichier existe déjà ;
- **Supprimer les paroles** pour retirer uniquement le texte, sans toucher au MP3.

La même gestion est disponible depuis la bibliothèque et depuis l'intérieur
d'une playlist.

## Format

Le format choisi est **TXT UTF-8**.

Aucun timestamp n'est nécessaire : c'est adapté aux morceaux venant de
YouTube, aux remixes, versions longues, clips, lives, etc.

Le nom du fichier TXT n'a pas besoin de correspondre au nom du MP3.
L'association est faite manuellement dans LocalMusic.

Exemple :

```text
How can I decide what's right
When you're clouding up my mind

I can't win your losing fight
All the time
```

## Stockage

Après sélection, LocalMusic copie le fichier dans son stockage privé :

```text
LocalMusic/
├── Music/
├── Artwork/
├── PlaylistCovers/
├── Lyrics/
│   └── <ID_DU_MORCEAU>.txt
└── library.json
```

Le fichier d'origine peut ensuite être retiré de Google Drive ou d'iCloud :
LocalMusic utilise sa propre copie hors ligne.

## Lecteur

Lorsqu'un morceau possède des paroles, un bouton **Paroles** apparaît en haut
à droite de l'écran de lecture.

Ce bouton ouvre une page plein écran :
- titre du morceau ;
- artiste ;
- paroles avec défilement manuel ;
- sélection/copier du texte possible.

La musique continue normalement pendant la consultation des paroles.

## Suppression

Supprimer un morceau de LocalMusic supprime aussi automatiquement son fichier
de paroles local.
