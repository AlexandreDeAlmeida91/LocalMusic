# Peak Music 1.8.16

## Inclus
- Import : bouton « Réessayer uniquement les échecs ». Les morceaux ajoutés, ignorés et en pause sont conservés dans la file ; ils ne font pas partie de cette relance ciblée. Le bouton Reprendre garde son comportement habituel.
- Erreurs réseau, limitation 429 et absence 404 expliquées plus clairement.
- Recherche YouTube : fusion de deux recherches, classement selon titre, artiste, durée et version. Bonus aux versions audio/paroles, pénalité aux clips et versions différentes. Le choix manuel reste demandé si la correspondance est incertaine ; les raisons sont affichées. Aucun changement du choix de qualité audio.
- Menu du morceau : « Modifier le titre et l’artiste ». Modification dans la bibliothèque et dans les métadonnées du lecteur, sans réencoder ni modifier le fichier. Les identifiants, playlists, pochettes, paroles et données anti-doublons sont préservés.
- Bibliothèque et contenu d’une playlist : « Sélectionner plusieurs morceaux », filtre, tout sélectionner/désélectionner, ajouter à une playlist, retirer d’une playlist ou déplacer vers une autre, supprimer les fichiers avec confirmation. Tout sélectionner concerne la liste affichée/filtrée.
- Bibliothèque : « Sauvegarder / restaurer ». Archive .peakbackup contenant audio, pochettes, paroles, repères synchronisés, playlists, ordre et réglages persistés. Le cache et les imports en attente ne sont pas exportés.
- Sauvegarde native en flux : aucun chargement de toute la bibliothèque en base64 dans JavaScript. Contrôle SHA-256 par fichier. Vérification des fichiers, chemins et références avant confirmation. Restauration par remplacement de dossier, avec retour à l’ancien dossier si le basculement échoue et récupération au prochain lancement si une interruption survient entre les déplacements.
- Suppression de la reconnaissance vocale locale : bouton, module Speech, autorisation et fichiers devenus inutiles. Les paroles synchronisées en ligne, leur animation, les textes manuels et les repères déjà enregistrés restent disponibles.

## Sauvegarde
Garder l’application ouverte pendant cette opération. Prévoir l’espace pour une copie de la bibliothèque. Choisir « Enregistrer dans Fichiers » puis iCloud Drive ou un emplacement extérieur à Peak Music. Un fichier laissé uniquement dans Peak Music disparaîtrait avec une désinstallation.
La restauration vérifie d’abord le fichier et affiche les nombres de morceaux et de playlists. Après confirmation elle **remplace**, sans fusionner, la bibliothèque actuelle. Exporter celle-ci avant si besoin. La lecture s’arrête pendant le remplacement. L’interface recharge ensuite les données et réglages.

## Mise à jour depuis le ZIP
1. Copier le contenu de LocalMusicExpoV1 dans le dépôt existant, sans supprimer le dossier .git.
2. Dans ce dépôt, exécuter `node scripts/remove-legacy-lyrics.cjs` pour enlever les anciens fichiers de reconnaissance vocale qui pourraient subsister après la copie. Le script est aussi exécuté lors de npm install.
3. `git add -A`
4. `git commit -m "feat: add library backup and bulk actions, improve matching and remove speech lyrics"`
5. `git push`
6. Construire l’IPA avec GitHub Actions puis installer la mise à jour sans désinstaller Peak Music.

L’arrière-plan validé en 1.8.15 est conservé. Aucune fiche technique audio supplémentaire n’a été ajoutée.

## Vérifications
Tests JavaScript : import, reprise, détection des doublons, classement, métadonnées, actions groupées et conservation des fichiers sur échec d’enregistrement. Export iOS JavaScript validé.
Un test natif de sauvegarde (aller-retour, corruption, troncature, chemins dangereux et récupération après interruption) est ajouté au workflow macOS avant le build. Il ne peut pas être exécuté dans cet environnement Linux. La compilation Swift et le partage/restauration sur iPhone restent à vérifier via GitHub Actions puis l’appareil. Tester d’abord une sauvegarde externe de quelques morceaux avant d’utiliser la restauration sur une bibliothèque importante.
