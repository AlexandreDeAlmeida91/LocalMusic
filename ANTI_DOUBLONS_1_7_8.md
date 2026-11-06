# Peak Music 1.7.8 — ignorer les morceaux déjà importés

Recoller le lien Likes SoundCloud puis Télécharger. L’application relit les pages pour trouver les nouveaux likes et ignore les morceaux déjà présents AVANT de télécharger leur audio. Chaque morceau ignoré affiche « Déjà présent — ignoré ». Le bilan distingue les ajouts des morceaux déjà présents.

La correspondance utilise les liens source normalisés (sans paramètres de partage), les identifiants de source et les identifiants YouTube. Cela reconnaît aussi un morceau importé depuis SoundCloud par repli vers YouTube. La bibliothèque courante est relue à chaque contrôle : les morceaux ajoutés pendant le lot sont reconnus immédiatement.

Le fichier local doit exister et ne pas être vide. Si un fichier manque, le téléchargement peut le restaurer en conservant l’identifiant utilisé par les playlists ainsi que les métadonnées personnelles. La protection existante au moment de l’enregistrement reste active.

Limite : un MP3 ajouté manuellement sans lien ni identifiant de source ne peut pas être identifié avec certitude. Le titre seul n’est pas utilisé pour éviter de confondre un remix, un live et une version studio. Ce système ne supprime pas les anciens doublons déjà présents.

Installation : remplacer le projet complet, reconstruire l’IPA puis installer avec SideStore par-dessus Peak Music sans désinstaller.

Validation : 38 tests JavaScript réussis, export iOS réussi. Les tests couvrent la normalisation des liens, le repli YouTube, les fichiers absents/vides et la restauration avec conservation de l’identifiant. Le parcours complet reste à vérifier sur iPhone.
