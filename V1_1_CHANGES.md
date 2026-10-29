# LocalMusic V1.1

Correction du lecteur audio pour l'écran verrouillé iOS.

## Changements

- Remplacement du player mono-piste par `AudioPlaylist` d'Expo Audio.
- La file de morceaux est maintenant gérée nativement.
- Passage automatique au morceau suivant même lorsque l'écran est verrouillé.
- Les commandes `next()` / `previous()` utilisent la playlist native.
- L'écran verrouillé est associé à la playlist plutôt qu'à un morceau isolé.
- Mise à jour des métadonnées lors d'un changement de piste.
- La playlist boucle sur toute la bibliothèque (`loop: all`).

## Mise à jour du dépôt existant

Le seul fichier applicatif à remplacer est :

`src/context/MusicContext.js`

Puis :

```powershell
git add src/context/MusicContext.js
git commit -m "Use native audio playlist for lock screen"
git push
```

Lance ensuite un nouveau workflow GitHub Actions pour générer le nouvel IPA.
