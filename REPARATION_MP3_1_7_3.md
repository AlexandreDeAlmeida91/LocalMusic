# Peak Music 1.7.3 — normalisation MP3 sans réencodage

## Utilisation

Après installation de la nouvelle IPA, ouvre le menu ••• d’un morceau MP3 et choisis « Réparer la durée du MP3 ». Si le morceau joue, sa nouvelle copie est rechargée depuis le début. Son identifiant, ses playlists, paroles et pochettes sont conservés.

Les nouveaux MP3 compatibles sont également normalisés lors de l’import depuis Fichiers ou d’un téléchargement. Les M4A ne passent pas par cette réparation.

L’original est conservé à côté de la copie normalisée dans LocalMusic/Music. Il n’est pas ajouté une seconde fois à la bibliothèque. Conserver ces originaux augmente donc l’espace utilisé. La suppression du morceau depuis l’application supprime aussi son original sauvegardé. Ne pas renommer ni déplacer ces fichiers pendant l’utilisation de l’app.

## Périmètre précis

Le correctif vise les fichiers MPEG-1 Layer III stéréo, avec en-tête Info/Xing complet de type FFmpeg/LAME, jusqu’à 64 Mo. Les autres structures restent intactes ; l’action manuelle explique quand elles ne sont pas prises en charge. Les MP3 HLS sans en-tête Info/Xing et les autres formats ne sont pas automatiquement réparés par cette version.

Les blocs audio compressés sont conservés octet pour octet. L’en-tête d’information est normalisé, son contrôle CRC recalculé, les anciennes métadonnées remplacées par un bloc ID3v2.3 avec titre/artiste/album, et le bloc ID3v1 de fin retiré. Les autres métadonnées restent disponibles dans l’original ; les pochettes et paroles utilisées par Peak Music sont conservées séparément.

Le correctif reste local au téléphone. Pas de serveur, de FFmpeg à installer, de changement de vitesse, de coupe ou de conversion avec perte.

## Validation

Sur le fichier réel fourni, le flux MPEG produit est identique à celui du MP3 remuxé qui affichait correctement 9:01 sur l’iPhone. Le hash SHA-256 de l’audio décodé est identique avant et après : aa98ef9c916092f8b61a40776fc247ee4ec0a70f2029e95c90fb9126e04eab2e.

28 tests réussis : normalisation sans changement des blocs audio, structures non prises en charge laissées intactes, répétition stable, conservation des identifiants et ressources, échec d’enregistrement sans perte de l’original, plus tests d’import existants. Bundle iOS exporté.

La compilation Xcode et l’intégration complète sur iPhone restent à vérifier. Tester le fichier d’origine avec le menu de réparation, vérifier environ 9:01, se déplacer vers 8:50, vérifier la fin et le passage au morceau suivant, puis relancer l’app pour vérifier la persistance et l’absence de doublon.

## Installation

Copier tous les fichiers dans le dépôt existant, y compris scripts et modules. Lancer GitHub Actions, puis installer via SideStore par-dessus l’app, sans désinstallation. Les options UIFileSharingEnabled et LSSupportsOpeningDocumentsInPlace sont incluses : le dossier reste visible dans Fichiers.

Commit : Ajoute la réparation sans perte des en-têtes MP3
