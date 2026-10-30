# Peak Music 1.7.0 — playlists publiques (bêta)

Colle des liens de playlists YouTube (/playlist?list=…), Spotify ou SoundCloud (/artiste/sets/nom), séparés par des points-virgules. Les morceaux accessibles sont ajoutés à la file puis à la bibliothèque. Tu peux ensuite les ranger dans tes playlists locales. Les playlists locales ne sont pas créées automatiquement.

YouTube : lecture des pages suivantes, limite de 100 pages ; avertissement si la pagination échoue ou atteint cette limite. Les vidéos privées/supprimées ne sont pas récupérables. Un lien watch?v=…&list=… conserve le comportement d’import d’une vidéo individuelle : utilise le lien de la playlist.
SoundCloud : lecture de la collection et résolution des pistes dont seul l’identifiant est fourni.
Spotify : lecture de la vue publique intégrée, qui peut être partielle. L’app affiche toujours cette limite. Cette version ne garantit pas l’import intégral des grandes playlists Spotify et ne gère pas la connexion Spotify. Aucun extrait Spotify n’est importé.

Les correspondances YouTube claires sont choisies automatiquement. En cas d’ambiguïté, l’app demande de choisir. Un téléchargement qui échoue peut déclencher une recherche d’une autre version si le titre et l’artiste sont connus. Une seule tentative de remplacement est effectuée, pour éviter les boucles. Une page bloquée avant la récupération des métadonnées ne peut pas être recherchée de façon fiable.

Qualité : sélection du flux compatible au débit le plus élevé proposé, M4A/AAC pour YouTube, MP3 ou AAC pour SoundCloud. Aucun réencodage. Aucun gain artificiel par conversion en MP3 320 kbit/s. Ce n’est pas une promesse de qualité sans perte ni de récupération des flux réservés à un compte. Une correspondance YouTube peut être un enregistrement différent : vérifie les résultats.

Validation : 21 tests JavaScript (réponses simulées pour les playlists), export du bundle iOS. La compilation Xcode et les imports réels sur iPhone restent à vérifier. Les pages des plateformes peuvent changer.

Installation : remplace les fichiers du dépôt, lance le workflow GitHub Actions, installe la nouvelle IPA via SideStore par-dessus l’application existante. Ne la désinstalle pas. Garde l’app ouverte pendant l’import.

Commit : Ajoute les playlists publiques et la recherche YouTube automatique
