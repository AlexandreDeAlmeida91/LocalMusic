# Peak Music 1.7.7 — importer les Likes SoundCloud

Dans Importer un lien, coller https://soundcloud.com/dio-brando-86922837/likes puis Télécharger. Aucun ajout manuel à une playlist SoundCloud n’est nécessaire.

La liste publique des titres likés est parcourue page après page et les liens identiques sont dédupliqués. Les morceaux suivent le parcours existant : SoundCloud direct en priorité, YouTube si nécessaire. Ils arrivent dans la bibliothèque locale et peuvent être ajoutés aux playlists Peak Music.

Les playlists likées (collections entières), éléments sans titre accessible et contenus privés ne sont pas importés par ce lien. Un avertissement indique les éléments ignorés ou une pagination incomplète. Limite de sécurité : 100 pages. Une interruption ne fait pas passer une liste partielle pour une liste complète. L’import est un instantané, pas une synchronisation automatique des nouveaux likes.

Garder Peak Music ouvert pendant la migration. L’import ne modifie ni ne retire aucun like sur SoundCloud. Les mécanismes existants de détection des morceaux déjà importés restent actifs.

Installation : remplacer le projet complet, reconstruire l’IPA avec GitHub Actions, installer par-dessus l’application existante via SideStore sans désinstaller.

Validation : 36 tests JavaScript réussis, dont pagination, déduplication, erreurs partielles et refus de pagination vers un domaine tiers. Export iOS réussi. La migration complète sur iPhone reste à vérifier ; aucun téléchargement massif de tes morceaux n’a été effectué ici.
