# Peak Music 1.8.11 — Pochettes des imports

Les nouveaux imports utilisent la pochette du morceau SoundCloud ou celle de Spotify quand la page la fournit. Cette image est conservée même si le son est récupéré sur YouTube. SoundCloud : tentative en 500 pixels puis taille d’origine. Spotify : plus grande image disponible dans les métadonnées du titre.

Une option avant l’import autorise la miniature YouTube si aucune pochette n’a pu être téléchargée. Elle est désactivée par défaut, vaut pour le lot entier, et peut être changée avant le lot suivant. Pour un lien YouTube direct, elle permet aussi de récupérer sa miniature. Aucune recherche de pochette par nom sur une autre plateforme n’est effectuée.

Les images sont stockées localement dans Artwork et restent disponibles hors ligne. Un échec d’image ne fait pas échouer le son. Les anciens morceaux ignorés comme doublons ne sont pas modifiés ; les pochettes personnalisées restent conservées. Ce changement concerne les nouveaux imports, pas une recherche manuelle sur les anciens titres.

79 tests automatisés réussis, export JavaScript iOS validé. Téléchargement réel des pochettes et affichage à vérifier sur iPhone. Aucun changement du lecteur verrouillé ni de la reconnaissance des paroles.

Reconstruire l’IPA et installer sans désinstaller Peak Music.
