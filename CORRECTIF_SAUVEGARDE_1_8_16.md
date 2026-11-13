# Correctif 1.8.16 — export de sauvegarde

Le calcul des chemins relatifs pendant l’export utilisait une découpe de chemins absolus. Cette opération est fragile sur Apple (alias /var et /private/var, séparateurs des URL de dossiers) et pouvait exclure les index. La validation à la restauration détectait alors l’absence de library.json.

L’export utilise maintenant directement les noms relatifs fournis par FileManager. Il refuse aussi de terminer une sauvegarde sans library.json et playlists.json. Le test natif conserve tous ses contrôles et ajoute un dossier source accessible par lien symbolique ainsi que la vérification explicite des quatre entrées attendues.

Version de l’app inchangée : 1.8.16. Remplacer les fichiers du dépôt par ceux de ce ZIP, git add -A, commit et push, puis lancer une nouvelle compilation sur le nouveau commit. Relancer uniquement l’ancienne exécution conserverait l’ancien code.

La compilation et l’exécution natives restent à valider par GitHub Actions (Xcode indisponible dans l’environnement de préparation).
