# Peak Music V1.5.2 — pochettes personnalisées des morceaux

- Menu `•••` d’un morceau → **Modifier la pochette** → **Photos** ou **Fichiers**.
- Images JPG, PNG et photos iPhone (notamment HEIC lorsque le système les propose).
- La pochette sélectionnée est copiée dans `Documents/LocalMusic/Artwork/Custom/`.
- `library.json` conserve uniquement `customArtworkPath`, un chemin relatif stable.
- Priorité d’affichage : pochette personnalisée → pochette ID3 → note musicale.
- La pochette s’affiche dans la liste, le mini-lecteur, le lecteur plein écran et dans les métadonnées système iOS.
- Si le morceau est déjà dans la file de lecture, l’appel natif `TrackPlayer.updateMetadata` actualise l’écran verrouillé sans interrompre la musique.
- **Supprimer la pochette personnalisée** restaure la pochette ID3 ou, à défaut, le visuel par défaut.
- Les images des playlists et leurs associations avec les morceaux restent inchangées.
- Le moteur audio et l’identifiant iOS `com.alexandre.localmusic` ne changent pas.

## Installation

Cette version ajoute la dépendance `expo-image-picker`. Après avoir remplacé les fichiers :

```powershell
npx expo install expo-image-picker
npx expo-doctor
git add .
git commit -m "Peak Music 1.5.2 - pochettes des morceaux"
git push
```

Le workflow GitHub Actions reconstruit un nouveau binaire iOS intégrant le module natif.
Installer la nouvelle IPA **par-dessus** Peak Music, sans supprimer l’app, pour préserver MP3 et playlists.

**Important :** les MP3 ne sont pas modifiés. Les images choisies restent uniquement dans le stockage privé de Peak Music ; elles ne sont pas écrites dans les tags ID3.
