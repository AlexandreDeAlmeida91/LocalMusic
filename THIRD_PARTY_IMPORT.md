# Composants du moteur local

## YouTubeKit

Source : https://github.com/alexeichhorn/YouTubeKit

Révision intégrée : `89854c93207ad0d2b3d78d6f1aea24595ca66552`.

Licence MIT, conservée dans `modules/peak-import/ios/YouTubeKit/LICENSE`.

Modifications pour Peak Music :
- chargement des ressources JavaScript depuis le bundle CocoaPods `PeakImportResources` ;
- branche d’extraction distante désactivée (elle échoue explicitement) ;
- suppression du client réseau d’extraction distante et de ses utilitaires dédiés ;
- wrapper Expo pour l’extraction locale et le téléchargement.

Le code du fournisseur est inclus dans le projet pour que la compilation ne dépende pas d’une branche GitHub flottante.

## Ressources du solveur JavaScript

Les fichiers `meriyah.umd.js`, `astring.umd.js` et `yt_ejs_helper.js` proviennent de la révision YouTubeKit ci-dessus.

- Meriyah : https://github.com/meriyah/meriyah — ISC, texte dans `Resources/MERIYAH-LICENSE`.
- Astring : https://github.com/davidbonnet/astring — MIT, texte dans `Resources/ASTRING-LICENSE`.
- yt-dlp/ejs : https://github.com/yt-dlp/ejs — Unlicense, indiquée dans l’en-tête du helper et conservée dans `Resources/EJS-LICENSE`.

Ces ressources sont embarquées et exécutées sur le téléphone. Aucun service de conversion ou d’extraction distant n’est utilisé.
