> Version actuelle : 1.7.9. Lire RECHERCHE_YOUTUBE_1_7_9.md.

> Version actuelle : 1.7.8. Lire ANTI_DOUBLONS_1_7_8.md.

> Version actuelle : 1.7.7. Lire LIKES_SOUNDCLOUD_1_7_7.md.

> Version actuelle : 1.7.6. Lire CORRECTIF_SOUNDCLOUD_1_7_6.md.

> Version actuelle : 1.7.5. Lire CORRECTIF_AAC_1_7_5.md.

> Version actuelle : 1.7.4. Consulter REPARATION_M4A_1_7_4.md pour la correction des M4A et REPARATION_MP3_1_7_3.md pour les MP3.

> Version actuelle : 1.7.0. Consulte PLAYLISTS_1_7.md pour les fonctions et limites à jour. Les indications 1.6 ci-dessous décrivent la version précédente.

# Peak Music 1.6.1 — import local (bêta)

Cette archive contient le **projet source complet**, pas une IPA déjà compilée.
Le moteur iOS doit être compilé dans une nouvelle IPA : copier seulement les fichiers JavaScript ne suffit pas.

## Installer depuis ton projet GitHub / SideStore

1. Extrais l’archive. Copie le contenu du dossier `LocalMusicExpoV1` dans ton dépôt Peak Music existant, à côté de `package.json`.
2. Inclus bien le dossier `modules/peak-import`, le nouveau `.gitignore`, `package-lock.json`, `tests` et le workflow `.github/workflows/build-ios-sidestore.yml`.
3. Envoie ces modifications dans ton dépôt GitHub avec ton outil habituel.
4. Dans **Actions**, lance **Build iOS IPA for SideStore → Run workflow**.
5. Une fois la compilation réussie, télécharge l’artefact **PeakMusic-iOS-IPA**, extrais l’IPA et installe-la avec SideStore **par-dessus l’application existante**.

Ne désinstalle pas Peak Music pour la mettre à jour : ses fichiers locaux seraient supprimés.
L’identifiant reste `com.alexandre.localmusic` et le dossier `Documents/LocalMusic` reste identique.
Si tu as déjà personnalisé l’identifiant ou la signature dans ton dépôt, conserve tes valeurs existantes pour effectuer une mise à jour.

La compilation peut tourner sur GitHub pour préparer l’installation. **L’utilisation du moteur après installation se fait entièrement sur l’iPhone**, sans PC allumé ni serveur de conversion.

## Utilisation

1. Ouvre **Morceaux → + → Coller un lien**.
2. Colle un lien YouTube, SoundCloud ou Spotify. Tu peux en coller jusqu’à 20, séparés par des `;` ou des retours à la ligne.
3. Appuie sur **Télécharger** et garde l’app ouverte, écran allumé, pendant l’import.
4. Pour Spotify, choisis une version YouTube si la correspondance n’est pas suffisamment claire. Pour un morceau SoundCloud sans flux compatible, une version YouTube peut être proposée : le changement de source exige toujours ton choix.
5. Ferme la fenêtre quand l’import est terminé. Le morceau est dans la bibliothèque et utilise le même menu de playlists que les fichiers importés.

Les fichiers sont conservés dans `Documents/LocalMusic/Music` avec des chemins relatifs persistants.
Le téléphone conserve le M4A/AAC de YouTube, et le MP3 ou M4A/AAC compatible de SoundCloud, sans réencodage avec perte supplémentaire.
Les noms internes sont uniques. Un même identifiant de source ou une même vidéo YouTube n’est pas ajouté deux fois.

## Périmètre et limites

- Morceaux et vidéos individuels. Les liens vers des playlists en ligne ne sont pas importés dans cette bêta.
- Spotify fournit le titre, l’artiste et la durée. L’audio provient d’une correspondance YouTube ; aucun extrait Spotify de 30 secondes n’est utilisé.
- YouTube : extraction locale avec YouTubeKit et JavaScriptCore ; flux audio M4A lisibles nativement sur iOS. Aucun serveur de repli.
- SoundCloud : flux MP3 progressifs/HLS et AAC HLS en MP4 fragmenté, complets et non chiffrés. En l’absence de flux compatible, une recherche YouTube est proposée avec choix explicite.
- Pas de connexion aux comptes des plateformes ; les contenus privés, protégés, restreints ou bloqués peuvent échouer.
- Les services peuvent modifier leurs pages ou bloquer les requêtes. Une mise à jour du moteur intégré peut alors nécessiter une nouvelle IPA.
- L’import nécessite Internet. Après son enregistrement, l’écoute est hors ligne.
- L’import s’annule si l’app passe en arrière-plan ; les morceaux déjà enregistrés restent disponibles. Les fichiers incomplets ne sont pas ajoutés.
- Le moteur est propre à iOS. Il n’est pas disponible dans Expo Go ni dans une ancienne IPA. Cette livraison n’ajoute pas un moteur Android.

## Validation de cette livraison

Les tests JavaScript couvrent notamment les liens, les correspondances, les extraits refusés, les doublons, la persistance et l’échec d’écriture.
Les 18 tests JavaScript et la génération du bundle iOS ont réussi. Les nouveaux tests utilisent des réponses simulées pour vérifier les liens courts SoundCloud, le renouvellement du client, le choix explicite de source et les erreurs lisibles.
La récupération de métadonnées publiques Spotify/YouTube/SoundCloud a également été vérifiée.

**La compilation Swift avec Xcode et le téléchargement/lecture hors ligne sur un vrai iPhone restent à valider.**
La livraison est donc une bêta source, pas une application iOS déjà testée de bout en bout.

Pour le premier essai sur iPhone : importer un lien de chaque service, vérifier la durée du morceau, relancer Peak Music, activer le mode avion, écouter le morceau et l’ajouter à une playlist.

## Développement

```sh
npm ci
npm run test:import
npx expo-doctor
npx expo export --platform ios
```

Sur Mac : `npx expo run:ios` pour compiler un build natif local. Pour SideStore, utiliser le workflow inclus.
