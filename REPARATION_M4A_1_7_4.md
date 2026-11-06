# Peak Music 1.7.4 — durée des M4A

Le M4A de test restructuré a été confirmé à la bonne durée sur l’iPhone. Cette version intègre une reconstruction locale du conteneur M4A par AVAssetReader/AVAssetWriter, sans réencoder l’AAC. Ce moteur Apple n’est pas FFmpeg : sa validation finale nécessite la nouvelle IPA sur appareil.

- Imports par lien et depuis Fichiers : reconstruction automatique des M4A AAC à une piste avant ajout à la bibliothèque.
- Morceaux existants : menu ••• → Réparer la durée du morceau (MP3 ou M4A).
- L’original est conservé séparément dans Music. Il prend donc de la place mais n’est pas ajouté une seconde fois à la bibliothèque.
- Identifiant, playlists, pochette et paroles restent associés au morceau. Le morceau en cours est rechargé au début après réparation.
- Les paquets AAC sont copiés sans décompression/recompression. La fin du fichier provient des horodatages des paquets réellement lus, pas de la durée source potentiellement doublée. Aucun découpage au silence, aucune division arbitraire de la durée par deux.
- Une erreur de lecture, d’écriture ou de validation interrompt l’opération ; aucune réparation réussie n’est annoncée à tort. L’original reste intact.
- Accès Fichiers maintenu. Réparation MP3 précédente conservée.

## Installation
Remplacer le contenu du dépôt avec le projet complet, y compris modules et scripts, lancer GitHub Actions et installer la nouvelle IPA via SideStore par-dessus l’application existante. Ne pas désinstaller. Un simple rechargement JavaScript ne suffit pas : nouvelle fonction Swift.

## Validation
Tests JavaScript et export du bundle iOS exécutés. Pas de compilation Xcode ni d’exécution AVFoundation possibles dans cet environnement Linux. Le test de remux FFmpeg a conservé exactement le PCM du fichier original, et l’utilisateur l’a confirmé à 2:23 dans Peak Music ; cela ne remplace pas le test du nouveau moteur natif.

Sur iPhone : réparer l’ancien M4A (4:46 → environ 2:23), vérifier la fin du son et le morceau suivant, puis importer de nouveau le lien. Vérifier aussi MP3, playlists, pochettes et paroles.
