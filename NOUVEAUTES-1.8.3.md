# Peak Music 1.8.3

Dans le menu du morceau, « Ajouter des paroles » ouvre deux options :
- Coller ou écrire les paroles (import TXT également disponible).
- Rechercher en ligne : corriger titre/artiste, lancer la recherche, sélectionner un résultat, lire son aperçu complet et l'associer.

Le même menu est accessible depuis la page Paroles du lecteur.
La recherche manuelle propose jusqu'à 20 résultats LRCLIB avec source, artiste et album. Si aucun résultat utilisable n'est trouvé, la recherche rōmaji AnimeSongLyrics est tentée. Le nombre de résultats dépend des sources ; aucune correspondance n'est garantie. Le texte choisi est conservé localement pour la lecture hors connexion.

Déploiement : remplacer les fichiers du projet GitHub, commit, lancer Build iOS IPA for SideStore. Installer par-dessus Peak Music sans désinstaller pour conserver la bibliothèque.
Commit : feat: add lyrics editor and selectable search results

Validation : tests automatisés et export JavaScript iOS. Compilation native IPA et test sur iPhone à effectuer via GitHub Actions puis SideStore.
