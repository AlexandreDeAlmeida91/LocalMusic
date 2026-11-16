# Peak Music 1.8.17 — scan des pochettes

Dans l’onglet Morceaux, toucher « Rechercher les pochettes », puis « Scanner la bibliothèque ».

- Par défaut : compléter les morceaux sans pochette, avec les miniatures YouTube en secours. L’option YouTube peut être désactivée.
- Option supplémentaire : remplacer les miniatures YouTube existantes par une pochette Spotify ou SoundCloud, lorsqu’un lien conservé le permet.
- Les pochettes choisies manuellement sont toujours conservées. Les autres pochettes existantes restent également conservées.
- Ordre des sources disponibles : Spotify, SoundCloud, puis YouTube. Cette version exploite uniquement les liens et identifiants enregistrés : elle ne cherche pas un morceau par son nom sur Spotify ou SoundCloud.
- Un import de fichier sans lien enregistré peut rester sans image. Les erreurs et liens manquants apparaissent dans le bilan.
- Aucun fichier audio n’est retéléchargé ou réencodé. Chaque nouvelle image est enregistrée et associée au morceau avant la mise à jour du lecteur. L’ancienne image téléchargée n’est supprimée qu’après enregistrement, si elle n’est plus utilisée.
- Le scan peut être arrêté ; les pochettes déjà enregistrées sont conservées. Un téléchargement d’image en cours peut prendre jusqu’à 12 secondes pour se terminer.
- Garder Peak Music ouvert. Le scan bloque les sauvegardes/restaurations et nettoyages concurrents.

## Mise à jour
Remplacer les fichiers du dépôt, faire un nouveau commit et lancer une nouvelle compilation GitHub Actions. Installer la nouvelle IPA via SideStore sans désinstaller l’application.

## Vérifications
99 tests JavaScript réussis, incluant récupération par identifiant Spotify, repli YouTube, refus des pochettes personnalisées, annulation, conservation des métadonnées et nettoyage sur échec de sauvegarde. Les réponses réseau sont simulées dans ces tests. Vérifier les vrais liens Spotify et SoundCloud sur iPhone après compilation. Aucune modification native de la sauvegarde ou du téléchargement audio dans cette version.
